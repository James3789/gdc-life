-- ─────────────────────────────────────────────────────────────
-- GDC Life — 봉사자 카풀 제공(Offer)
--
-- 좌표는 클라이언트가 그대로 읽어 쓰도록 숫자로 두고,
-- 공간 연산용 geography 는 생성 컬럼(origin/dest)과 RPC(route)로 만든다.
-- Phase 3 의 경로 반경 매칭은 route 에 걸린 GiST 인덱스를 쓴다.
-- ─────────────────────────────────────────────────────────────

create type public.carpool_direction as enum ('commute-in', 'commute-out');
create type public.offer_status      as enum ('open', 'full', 'done', 'cancelled');

create table public.carpool_offers (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references public.profiles (id) on delete cascade,
  direction   public.carpool_direction not null,

  ride_date   date not null,
  -- 출근: 픽업 기준 시각 / 퇴근: 회사 출발 시각
  depart_time time not null,

  -- 출근: 봉사자 출발지 / 퇴근: 회사
  origin_lat  double precision not null check (origin_lat between -90 and 90),
  origin_lng  double precision not null check (origin_lng between -180 and 180),
  origin_addr text not null,
  origin_point extensions.geography(Point, 4326)
    generated always as (extensions.st_point(origin_lng, origin_lat)::extensions.geography) stored,

  -- 출근: 회사 / 퇴근: 봉사자 목적지
  dest_lat    double precision not null check (dest_lat between -90 and 90),
  dest_lng    double precision not null check (dest_lng between -180 and 180),
  dest_addr   text not null,
  dest_point  extensions.geography(Point, 4326)
    generated always as (extensions.st_point(dest_lng, dest_lat)::extensions.geography) stored,

  -- [{lat, lng, addr}, ...]
  waypoints   jsonb not null default '[]'::jsonb check (jsonb_typeof(waypoints) = 'array'),

  -- 길찾기 결과 경로. Phase 3 매칭의 기준선.
  route            extensions.geography(LineString, 4326),
  route_distance_m integer check (route_distance_m >= 0),
  route_duration_s integer check (route_duration_s >= 0),

  seats_total     smallint not null default 3 check (seats_total between 1 and 4),
  seats_available smallint not null check (seats_available >= 0),
  status          public.offer_status not null default 'open',

  -- 반복 등록으로 함께 생성된 건들을 묶는다
  recurring_group_id uuid,
  created_at         timestamptz not null default now(),

  constraint seats_available_within_total check (seats_available <= seats_total)
);

comment on table public.carpool_offers is '봉사자가 등록한 카풀 제공. 세부 수정은 취소 후 재등록한다.';

-- 검색(같은 날짜·방향·좌석여유) 경로
create index carpool_offers_search_idx
  on public.carpool_offers (ride_date, direction, status)
  where status = 'open';

-- 경로 반경 매칭 (ST_DWithin)
create index carpool_offers_route_idx on public.carpool_offers using gist (route);

-- 내 달력 / 반복 그룹
create index carpool_offers_driver_idx on public.carpool_offers (driver_id, ride_date);
create index carpool_offers_group_idx  on public.carpool_offers (recurring_group_id)
  where recurring_group_id is not null;

alter table public.carpool_offers enable row level security;

-- 탑승자가 검색하려면 남의 제공도 보여야 한다.
-- 노출되는 건 출발/도착 주소와 시간뿐이고, 연락처는 profile_private 에 있다.
create policy "로그인한 직원은 카풀 제공을 조회"
  on public.carpool_offers for select
  to authenticated
  using (true);

create policy "본인 제공만 등록"
  on public.carpool_offers for insert
  to authenticated
  with check (driver_id = (select auth.uid()));

create policy "본인 제공만 수정"
  on public.carpool_offers for update
  to authenticated
  using (driver_id = (select auth.uid()))
  with check (driver_id = (select auth.uid()));

create policy "본인 제공만 삭제"
  on public.carpool_offers for delete
  to authenticated
  using (driver_id = (select auth.uid()));

-- 좌석 수는 신청 허락 트랜잭션(Phase 4)에서만 바뀌어야 하므로
-- UPDATE 권한을 컬럼 단위로 제한한다. seats_available 은 클라이언트가 못 건드린다.
grant select, insert, delete on public.carpool_offers to authenticated;
grant update (status) on public.carpool_offers to authenticated;

-- ── 등록 RPC ──────────────────────────────────────────────────
-- 경로 LineString 생성과 반복 등록을 한 번에 처리한다.
-- security invoker 이므로 RLS 가 그대로 적용된다(남의 이름으로 등록 불가).
create or replace function public.create_carpool_offers(
  p_direction        public.carpool_direction,
  p_dates            date[],
  p_depart_time      time,
  p_origin           jsonb,                 -- {lat, lng, addr}
  p_dest             jsonb,                 -- {lat, lng, addr}
  p_waypoints        jsonb    default '[]'::jsonb,
  p_route            jsonb    default '[]'::jsonb,   -- [{lat, lng}, ...]
  p_route_distance_m integer  default null,
  p_route_duration_s integer  default null,
  p_seats_total      smallint default 3
)
returns setof public.carpool_offers
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_group  uuid;
  v_route  extensions.geography(LineString, 4326);
  v_date   date;
begin
  if p_dates is null or array_length(p_dates, 1) is null then
    raise exception '등록할 날짜가 없습니다.' using errcode = '22023';
  end if;
  if array_length(p_dates, 1) > 90 then
    raise exception '한 번에 90일까지만 등록할 수 있습니다.' using errcode = '22023';
  end if;
  if p_seats_total not between 1 and 4 then
    raise exception '좌석은 1~4석만 가능합니다.' using errcode = '22023';
  end if;

  -- 경로 좌표가 2개 이상일 때만 LineString 을 만든다 (길찾기 실패 시 null 허용)
  select extensions.st_makeline(
           array_agg(
             extensions.st_point((p ->> 'lng')::float8, (p ->> 'lat')::float8)
             order by ord
           )
         )::extensions.geography
    into v_route
    from jsonb_array_elements(coalesce(p_route, '[]'::jsonb)) with ordinality as t(p, ord)
   having count(*) >= 2;

  -- 반복 등록이면 같은 그룹으로 묶는다
  if array_length(p_dates, 1) > 1 then
    v_group := gen_random_uuid();
  end if;

  foreach v_date in array p_dates loop
    return query
    insert into public.carpool_offers (
      driver_id, direction, ride_date, depart_time,
      origin_lat, origin_lng, origin_addr,
      dest_lat,   dest_lng,   dest_addr,
      waypoints, route, route_distance_m, route_duration_s,
      seats_total, seats_available, recurring_group_id
    ) values (
      (select auth.uid()), p_direction, v_date, p_depart_time,
      (p_origin ->> 'lat')::float8, (p_origin ->> 'lng')::float8, p_origin ->> 'addr',
      (p_dest   ->> 'lat')::float8, (p_dest   ->> 'lng')::float8, p_dest   ->> 'addr',
      coalesce(p_waypoints, '[]'::jsonb), v_route, p_route_distance_m, p_route_duration_s,
      p_seats_total, p_seats_total, v_group
    )
    returning *;
  end loop;
end;
$$;

revoke execute on function public.create_carpool_offers from public;
grant execute on function public.create_carpool_offers to authenticated;

-- ── 취소 RPC ──────────────────────────────────────────────────
-- 반복 그룹 전체를 한 번에 취소할 수 있게 한다.
create or replace function public.cancel_carpool_offers(
  p_offer_id uuid,
  p_whole_group boolean default false
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_group   uuid;
  v_changed integer;
begin
  select recurring_group_id into v_group
    from public.carpool_offers
   where id = p_offer_id and driver_id = (select auth.uid());

  if not found then
    raise exception '취소할 카풀을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  update public.carpool_offers
     set status = 'cancelled'
   where driver_id = (select auth.uid())
     and status in ('open', 'full')
     and (
       id = p_offer_id
       or (p_whole_group and v_group is not null and recurring_group_id = v_group)
     );

  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

revoke execute on function public.cancel_carpool_offers from public;
grant execute on function public.cancel_carpool_offers to authenticated;

-- ─────────────────────────────────────────────────────────────
-- GDC Life — 탑승 신청 · 별점 · 매칭 검색
--
-- 매칭은 경로(LineString)와 탑승 지점 사이의 실제 거리로 판정한다.
-- 출근은 "예상 픽업 시각", 퇴근은 "회사 출발 시각" 을 시간 비교 기준으로 삼는다(명세 5.9).
-- ─────────────────────────────────────────────────────────────

create type public.request_status as enum ('pending', 'accepted', 'rejected', 'cancelled', 'done');

create table public.carpool_requests (
  id           uuid primary key default gen_random_uuid(),
  offer_id     uuid not null references public.carpool_offers (id) on delete cascade,
  passenger_id uuid not null references public.profiles (id) on delete cascade,

  -- 출근: 탑승 위치 / 퇴근: 목적지
  board_lat  double precision not null check (board_lat between -90 and 90),
  board_lng  double precision not null check (board_lng between -180 and 180),
  board_addr text not null,
  board_point extensions.geography(Point, 4326)
    generated always as (extensions.st_point(board_lng, board_lat)::extensions.geography) stored,

  desired_time   time not null,
  time_tolerance smallint not null default 10 check (time_tolerance in (10, 20, 30)),
  status         public.request_status not null default 'pending',
  created_at     timestamptz not null default now(),

  -- 같은 카풀에 두 번 신청할 수 없다
  unique (offer_id, passenger_id)
);

create index carpool_requests_offer_idx     on public.carpool_requests (offer_id, status);
create index carpool_requests_passenger_idx on public.carpool_requests (passenger_id, status);

alter table public.carpool_requests enable row level security;

create policy "내가 낸 신청 조회"
  on public.carpool_requests for select
  to authenticated
  using (passenger_id = (select auth.uid()));

create policy "내 카풀에 들어온 신청 조회"
  on public.carpool_requests for select
  to authenticated
  using (
    exists (
      select 1 from public.carpool_offers o
       where o.id = carpool_requests.offer_id
         and o.driver_id = (select auth.uid())
    )
  );

-- 생성·상태변경은 전부 RPC 로만. 좌석 정합성과 검증을 우회할 수 없게 한다.
grant select on public.carpool_requests to authenticated;

-- ── 별점 ──────────────────────────────────────────────────────
-- 적립은 Phase 6 에서. 지금은 검색 카드에 누적 점수를 보여주기 위해 테이블만 둔다.
create table public.driver_ratings (
  id        uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles (id) on delete cascade,
  offer_id  uuid not null references public.carpool_offers (id) on delete cascade,
  points    smallint not null default 1 check (points > 0),
  earned_at timestamptz not null default now(),
  -- 운행 1건당 1회만 적립
  unique (offer_id)
);

create index driver_ratings_driver_idx on public.driver_ratings (driver_id, earned_at);

alter table public.driver_ratings enable row level security;

-- 별점은 추천 카드에 노출되는 공개 정보
create policy "별점은 로그인한 직원이 조회"
  on public.driver_ratings for select
  to authenticated
  using (true);

grant select on public.driver_ratings to authenticated;

-- ── 매칭 검색 ─────────────────────────────────────────────────
create or replace function public.search_carpool_offers(
  p_direction     public.carpool_direction,
  p_date          date,
  p_lat           double precision,
  p_lng           double precision,
  p_desired_time  time,
  p_tolerance_min integer default 10,
  p_radius_m      integer default null
)
returns table (
  offer_id          uuid,
  driver_id         uuid,
  driver_name       text,
  driver_department text,
  driver_points     bigint,
  ride_date         date,
  depart_time       time,
  origin_lat        double precision,
  origin_lng        double precision,
  origin_addr       text,
  dest_lat          double precision,
  dest_lng          double precision,
  dest_addr         text,
  waypoints         jsonb,
  route_path        jsonb,
  route_distance_m  integer,
  route_duration_s  integer,
  seats_total       smallint,
  seats_available   smallint,
  detour_m          double precision,
  est_time          time,
  time_diff_min     integer,
  score             double precision,
  already_requested boolean
)
language plpgsql
security invoker
stable
set search_path = ''
as $$
declare
  v_radius integer;
  v_point  extensions.geography;
  v_me     uuid := (select auth.uid());
begin
  select coalesce(p_radius_m, s.match_radius_m)
    into v_radius
    from public.app_settings s
   where s.id = 1;

  v_radius := coalesce(v_radius, 1000);
  v_point  := extensions.st_point(p_lng, p_lat)::extensions.geography;

  return query
  with candidate as (
    select o.*,
           -- 경로가 있으면 경로선까지의 최단거리, 없으면 봉사자가 지정한 지점까지의 거리
           case
             when o.route is not null then extensions.st_distance(o.route, v_point)
             when p_direction = 'commute-in' then extensions.st_distance(o.origin_point, v_point)
             else extensions.st_distance(o.dest_point, v_point)
           end as dist_m,
           -- 경로상 어디쯤에서 태우는지 (0=출발, 1=도착)
           case
             when o.route is not null
               then extensions.st_linelocatepoint(
                      o.route::extensions.geometry,
                      v_point::extensions.geometry)
           end as frac
      from public.carpool_offers o
     where o.ride_date   = p_date
       and o.direction   = p_direction
       and o.status      = 'open'
       and o.seats_available > 0
       and o.driver_id  <> v_me
       -- 인덱스를 타는 1차 필터
       and (
         o.route is null
         or extensions.st_dwithin(o.route, v_point, v_radius)
       )
  ),
  timed as (
    select c.*,
           case
             -- 출근: 봉사자 출발 시각 + 탑승 지점까지 걸리는 시간 = 예상 픽업 시각
             when p_direction = 'commute-in'
                  and c.frac is not null
                  and c.route_duration_s is not null
               then c.depart_time + make_interval(secs => c.frac * c.route_duration_s)
             -- 퇴근: 회사 출발 시각이 그대로 기준
             else c.depart_time
           end as computed_time
      from candidate c
  )
  select
    t.id,
    t.driver_id,
    pr.name,
    pr.department,
    coalesce(rt.pts, 0)::bigint,
    t.ride_date,
    t.depart_time,
    t.origin_lat, t.origin_lng, t.origin_addr,
    t.dest_lat,   t.dest_lng,   t.dest_addr,
    t.waypoints,
    -- 지도 미리보기용으로 단순화한 경로 (원본은 수백 점이라 과하다)
    case
      when t.route is not null then
        (extensions.st_asgeojson(
           extensions.st_simplify(t.route::extensions.geometry, 0.0003)
         )::jsonb) -> 'coordinates'
      else '[]'::jsonb
    end,
    t.route_distance_m,
    t.route_duration_s,
    t.seats_total,
    t.seats_available,
    round(t.dist_m)::double precision,
    t.computed_time::time,
    round(abs(extract(epoch from (t.computed_time - p_desired_time)) / 60))::integer,
    -- 경로 근접도 60% + 시간 근접도 40%. 낮을수록 좋다.
    round(
      ( (t.dist_m / nullif(v_radius, 0)) * 0.6
      + (abs(extract(epoch from (t.computed_time - p_desired_time)) / 60)
         / nullif(p_tolerance_min, 0)) * 0.4
      )::numeric, 4
    )::double precision,
    exists (
      select 1 from public.carpool_requests rq
       where rq.offer_id = t.id
         and rq.passenger_id = v_me
         and rq.status in ('pending', 'accepted')
    )
    from timed t
    join public.profiles pr on pr.id = t.driver_id
    left join (
      select dr.driver_id, sum(dr.points) as pts
        from public.driver_ratings dr
       group by dr.driver_id
    ) rt on rt.driver_id = t.driver_id
   where t.dist_m <= v_radius
     and abs(extract(epoch from (t.computed_time - p_desired_time)) / 60) <= p_tolerance_min
   order by
     (t.dist_m / nullif(v_radius, 0)) * 0.6
     + (abs(extract(epoch from (t.computed_time - p_desired_time)) / 60)
        / nullif(p_tolerance_min, 0)) * 0.4;
end;
$$;

revoke execute on function public.search_carpool_offers from public;
grant execute on function public.search_carpool_offers to authenticated;

-- ── 신청 ──────────────────────────────────────────────────────
-- security definer: 클라이언트에 INSERT 권한을 주지 않고 검증을 강제한다.
create or replace function public.request_carpool(
  p_offer_id     uuid,
  p_lat          double precision,
  p_lng          double precision,
  p_addr         text,
  p_desired_time time,
  p_tolerance    smallint default 10
)
returns public.carpool_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := (select auth.uid());
  v_offer public.carpool_offers;
  v_row   public.carpool_requests;
begin
  if v_me is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into v_offer from public.carpool_offers where id = p_offer_id;
  if not found then
    raise exception '카풀을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  if v_offer.driver_id = v_me then
    raise exception '본인이 등록한 카풀에는 신청할 수 없습니다.' using errcode = '22023';
  end if;
  if v_offer.status <> 'open' then
    raise exception '신청할 수 없는 카풀입니다.' using errcode = '22023';
  end if;
  if v_offer.seats_available <= 0 then
    raise exception '남은 좌석이 없습니다.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.carpool_requests
     where offer_id = p_offer_id
       and passenger_id = v_me
       and status in ('pending', 'accepted')
  ) then
    raise exception '이미 신청한 카풀입니다.' using errcode = '23505';
  end if;

  insert into public.carpool_requests (
    offer_id, passenger_id, board_lat, board_lng, board_addr, desired_time, time_tolerance
  ) values (
    p_offer_id, v_me, p_lat, p_lng, p_addr, p_desired_time, p_tolerance
  )
  -- 취소·거절된 신청이 남아 있으면 되살린다 (운행완료 건은 건드리지 않는다)
  on conflict (offer_id, passenger_id) do update
    set board_lat      = excluded.board_lat,
        board_lng      = excluded.board_lng,
        board_addr     = excluded.board_addr,
        desired_time   = excluded.desired_time,
        time_tolerance = excluded.time_tolerance,
        status         = 'pending',
        created_at     = now()
    where public.carpool_requests.status in ('cancelled', 'rejected')
  returning * into v_row;

  if v_row.id is null then
    raise exception '이미 처리된 신청입니다.' using errcode = '23505';
  end if;

  return v_row;
end;
$$;

revoke execute on function public.request_carpool from public;
grant execute on function public.request_carpool to authenticated;

-- ── 신청 취소 (탑승자) ────────────────────────────────────────
create or replace function public.cancel_carpool_request(p_request_id uuid)
returns public.carpool_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := (select auth.uid());
  v_prev public.request_status;
  v_row  public.carpool_requests;
begin
  -- 취소 전 상태를 먼저 잡아둔다. 좌석 반환은 '허락된' 신청에만 해당한다.
  select status
    into v_prev
    from public.carpool_requests
   where id = p_request_id
     and passenger_id = v_me
     for update;

  if v_prev is null or v_prev not in ('pending', 'accepted') then
    raise exception '취소할 신청을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  update public.carpool_requests
     set status = 'cancelled'
   where id = p_request_id
  returning * into v_row;

  if v_prev = 'accepted' then
    update public.carpool_offers
       set seats_available = least(seats_available + 1, seats_total),
           status = case when status = 'full' then 'open' else status end
     where id = v_row.offer_id;
  end if;

  return v_row;
end;
$$;

revoke execute on function public.cancel_carpool_request from public;
grant execute on function public.cancel_carpool_request to authenticated;

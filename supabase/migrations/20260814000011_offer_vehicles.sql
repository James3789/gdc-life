-- ─────────────────────────────────────────────────────────────
-- GDC Life — 차량번호
--
-- 탑승자가 길에서 차를 알아보려면 차량번호가 필요하다.
-- 다만 전화번호와 같은 성격의 개인 식별 정보이므로 노출 범위를 똑같이 좁힌다.
--   · 봉사자 본인
--   · 신청이 허락된(또는 운행완료된) 탑승자
-- 검색 목록에는 나오지 않는다 — 매칭 전에는 알 필요가 없다.
--
-- carpool_offers 에 컬럼으로 붙이지 않은 이유:
-- 그 테이블은 "로그인한 직원이면 조회" 정책이라 컬럼을 추가하면 전 직원에게 열린다.
-- RLS 는 행 단위라 컬럼만 가릴 수 없으므로 표를 나눈다.
-- ─────────────────────────────────────────────────────────────

create table public.offer_vehicles (
  offer_id   uuid primary key references public.carpool_offers (id) on delete cascade,
  vehicle_no text not null,
  created_at timestamptz not null default now(),

  -- 형식은 나라·시기마다 다르므로(12가3456 / 서울12가3456 / 임시번호판)
  -- 숫자와 한글이 하나씩은 있는지만 본다. 지나치게 엄격하면 못 쓰는 사람이 생긴다.
  constraint vehicle_no_shape check (
    length(vehicle_no) between 5 and 20
    and vehicle_no ~ '[0-9]'
    and vehicle_no ~ '[가-힣]'
  )
);

comment on table public.offer_vehicles is
  '카풀 1건의 차량번호. 봉사자와 매칭된 탑승자에게만 보인다.';

alter table public.offer_vehicles enable row level security;

create policy "봉사자는 본인 카풀의 차량번호 조회"
  on public.offer_vehicles for select
  to authenticated
  using (
    exists (
      select 1 from public.carpool_offers o
       where o.id = offer_vehicles.offer_id
         and o.driver_id = (select auth.uid())
    )
  );

create policy "매칭된 탑승자만 차량번호 조회"
  on public.offer_vehicles for select
  to authenticated
  using (
    exists (
      select 1 from public.carpool_requests r
       where r.offer_id = offer_vehicles.offer_id
         and r.passenger_id = (select auth.uid())
         and r.status in ('accepted', 'done')
    )
  );

create policy "본인 카풀에만 차량번호 등록"
  on public.offer_vehicles for insert
  to authenticated
  with check (
    exists (
      select 1 from public.carpool_offers o
       where o.id = offer_vehicles.offer_id
         and o.driver_id = (select auth.uid())
    )
  );

-- 차량번호는 매칭 조건이 아니라 좌석·시간 정합성에 영향이 없다.
-- 오타를 고치거나 그날 다른 차를 쓰는 경우가 있어 수정은 열어 둔다.
create policy "본인 카풀의 차량번호만 수정"
  on public.offer_vehicles for update
  to authenticated
  using (
    exists (
      select 1 from public.carpool_offers o
       where o.id = offer_vehicles.offer_id
         and o.driver_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.carpool_offers o
       where o.id = offer_vehicles.offer_id
         and o.driver_id = (select auth.uid())
    )
  );

grant select, insert, update on public.offer_vehicles to authenticated;

-- ── 등록 RPC 에 차량번호 추가 ─────────────────────────────────
-- 인자가 늘어나면 오버로드가 생겨 호출이 모호해지므로 옛 시그니처를 지운다.
drop function if exists public.create_carpool_offers(
  public.carpool_direction, date[], time, jsonb, jsonb, jsonb, jsonb, integer, integer, smallint
);

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
  p_seats_total      smallint default 3,
  p_vehicle_no       text     default null
)
returns setof public.carpool_offers
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_group   uuid;
  v_route   extensions.geography(LineString, 4326);
  v_date    date;
  v_offer   public.carpool_offers;
  v_vehicle text;
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

  -- 공백 정리 후 빈 문자열은 없는 것으로 본다
  v_vehicle := nullif(regexp_replace(btrim(coalesce(p_vehicle_no, '')), '\s+', ' ', 'g'), '');

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
    returning * into v_offer;

    if v_vehicle is not null then
      insert into public.offer_vehicles (offer_id, vehicle_no)
      values (v_offer.id, v_vehicle);
    end if;

    return next v_offer;
  end loop;
end;
$$;

revoke execute on function public.create_carpool_offers(
  public.carpool_direction, date[], time, jsonb, jsonb, jsonb, jsonb, integer, integer, smallint, text
) from public;
grant execute on function public.create_carpool_offers(
  public.carpool_direction, date[], time, jsonb, jsonb, jsonb, jsonb, integer, integer, smallint, text
) to authenticated;

-- 등록 화면에서 지난번 차량번호를 미리 채워 준다 (매번 입력하지 않도록)
create or replace function public.my_last_vehicle_no()
returns text
language sql
security invoker
stable
set search_path = ''
as $$
  select v.vehicle_no
    from public.offer_vehicles v
    join public.carpool_offers o on o.id = v.offer_id
   where o.driver_id = (select auth.uid())
   order by o.created_at desc
   limit 1;
$$;

revoke execute on function public.my_last_vehicle_no() from public;
grant execute on function public.my_last_vehicle_no() to authenticated;

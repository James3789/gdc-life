-- ─────────────────────────────────────────────────────────────
-- GDC Life — 예상 픽업 시각 정확도 보정
--
-- 출근 매칭은 "경로상 위치 비율 × 총 소요시간" 으로 픽업 시각을 추정한다.
-- 그 비율을 ST_LineLocatePoint 로 구하는데, 지금까지는 경위도(4326)를
-- 평면처럼 다뤄 계산했다. 위도 35.5°(울산)에서 경도 1°는 위도 1°의 약 0.81배라
-- 동서 방향 구간이 실제보다 길게 계산된다 — 동서·남북이 섞인 경로에서
-- 비율이 최대 20% 가까이 틀어질 수 있고, 30분 운행이면 5분 오차가 된다.
-- 허용 범위가 ±10분인 것을 생각하면 무시할 수 없다.
--
-- 그래서 비율을 구할 때만 미터 기반 좌표계(3857)로 투영한다.
-- 거리 판정(ST_DWithin/ST_Distance)은 원래부터 geography 라 영향이 없다.
-- ─────────────────────────────────────────────────────────────

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
           -- 경로상 어디쯤에서 태우는지 (0=출발, 1=도착).
           -- 미터 좌표계로 투영해야 동서 구간이 부풀지 않는다.
           case
             when o.route is not null
               then extensions.st_linelocatepoint(
                      extensions.st_transform(o.route::extensions.geometry, 3857),
                      extensions.st_transform(v_point::extensions.geometry, 3857))
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

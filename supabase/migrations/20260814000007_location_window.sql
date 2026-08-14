-- ─────────────────────────────────────────────────────────────
-- 위치 공유 시간대 축소: 출발 3시간 후 → 1시간 후
--
-- 출퇴근 운행은 길어야 1시간이면 끝난다. 공유 창이 넓을수록
-- 운행이 끝난 뒤에도 위치가 흐를 여지가 커지므로 최소로 줄인다.
-- (출발 30분 전부터 열리는 것은 그대로 — 픽업 전 이동을 봐야 한다)
-- ─────────────────────────────────────────────────────────────

create or replace function public.can_share_location(p_offer_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.carpool_offers o
      join public.carpool_requests r on r.offer_id = o.id
     where o.id = p_offer_id
       and r.status = 'accepted'
       and o.status in ('open', 'full')
       and (o.driver_id = (select auth.uid()) or r.passenger_id = (select auth.uid()))
       -- 운행 시간대: 출발 30분 전 ~ 출발 1시간 후 (KST 기준)
       and (o.ride_date + o.depart_time)
             between (now() at time zone 'Asia/Seoul') - interval '1 hour'
                 and (now() at time zone 'Asia/Seoul') + interval '30 minutes'
  );
$$;

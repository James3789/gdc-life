-- ─────────────────────────────────────────────────────────────
-- GDC Life — 실시간 위치 공유 권한
--
-- 위치는 DB에 저장하지 않고 Realtime Broadcast 로만 흘려보낸다.
-- 따라서 보호 지점은 "누가 그 채널에 들어올 수 있는가" 하나다.
-- 채널 이름은 trip:<offer_id> 이며, realtime.messages 의 RLS 로 통제한다.
--
-- 허용 조건 (모두 만족해야 함):
--   1. 그 카풀의 봉사자이거나, 신청이 '허락된' 탑승자일 것
--   2. 카풀이 취소·운행완료 상태가 아닐 것
--   3. 운행 시간대일 것 — 출발 30분 전 ~ 출발 3시간 후
-- ─────────────────────────────────────────────────────────────

-- 위치 공유가 가능한 시각인지 (클라이언트도 UI 판단에 쓴다)
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
       -- 운행 시간대: 출발 30분 전부터 3시간 후까지 (KST 기준)
       and (o.ride_date + o.depart_time)
             between (now() at time zone 'Asia/Seoul') - interval '3 hours'
                 and (now() at time zone 'Asia/Seoul') + interval '30 minutes'
  );
$$;

revoke execute on function public.can_share_location(uuid) from public;
grant execute on function public.can_share_location(uuid) to authenticated;

-- 채널 이름(topic)을 안전하게 해석해 위 조건을 확인한다.
-- 형식이 어긋난 topic 은 무조건 거부 — 다른 채널까지 열리면 안 된다.
create or replace function public.can_use_trip_channel(p_topic text)
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_offer uuid;
begin
  if p_topic is null or p_topic !~ '^trip:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return false;
  end if;

  begin
    v_offer := substring(p_topic from 6)::uuid;
  exception
    when others then
      return false;
  end;

  return public.can_share_location(v_offer);
end;
$$;

revoke execute on function public.can_use_trip_channel(text) from public;
grant execute on function public.can_use_trip_channel(text) to authenticated;

-- ── 카풀 상세 지도용 경로 ─────────────────────────────────────
-- geography 원본은 WKB 로 내려와 쓸 수 없으므로 좌표 배열로 바꿔 준다.
create or replace function public.offer_route_path(p_offer_id uuid)
returns jsonb
language sql
security invoker
stable
set search_path = ''
as $$
  select case
           when o.route is null then '[]'::jsonb
           else (extensions.st_asgeojson(
                   extensions.st_simplify(o.route::extensions.geometry, 0.0001)
                 )::jsonb) -> 'coordinates'
         end
    from public.carpool_offers o
   where o.id = p_offer_id;
$$;

revoke execute on function public.offer_route_path(uuid) from public;
grant execute on function public.offer_route_path(uuid) to authenticated;

-- ── Realtime 채널 접근 통제 ───────────────────────────────────
-- private 채널은 realtime.messages 의 RLS 를 거친다.
-- 정책이 없으면 아무도 못 들어오고, 여기 조건이 곧 접근 통제다.
--
-- 주의: realtime.messages 의 소유자는 supabase_realtime_admin 이라
--       마이그레이션을 돌리는 postgres 역할로는 ENABLE ROW LEVEL SECURITY 를 할 수 없다.
--       (이미 켜져 있으므로 할 필요도 없다. 정책 생성은 허용된다.)

create policy "매칭된 상대만 위치 채널 수신"
  on realtime.messages for select
  to authenticated
  using (public.can_use_trip_channel(realtime.topic()));

create policy "매칭된 상대만 위치 채널 송신"
  on realtime.messages for insert
  to authenticated
  with check (public.can_use_trip_channel(realtime.topic()));

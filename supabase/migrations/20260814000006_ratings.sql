-- ─────────────────────────────────────────────────────────────
-- GDC Life — 운행완료 처리와 별점 적립
--
-- 별점은 카풀 1건당 1점. driver_ratings 의 unique(offer_id) 가 중복 적립을 막는다.
-- 적립 경로는 두 가지뿐이며 둘 다 security definer 함수다.
--   1. 봉사자가 직접 [운행완료] 를 누름
--   2. 운행 시각이 한참 지난 건을 일괄 처리 (스케줄러용)
-- 클라이언트에는 driver_ratings INSERT 권한이 없어 점수를 조작할 수 없다.
-- ─────────────────────────────────────────────────────────────

-- ── 봉사자가 직접 완료 처리 ───────────────────────────────────
create or replace function public.complete_carpool_offer(p_offer_id uuid)
returns public.carpool_offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := (select auth.uid());
  v_offer  public.carpool_offers;
  v_riders integer;
begin
  if v_me is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into v_offer
    from public.carpool_offers
   where id = p_offer_id
     for update;

  if not found then
    raise exception '카풀을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  if v_offer.driver_id <> v_me then
    raise exception '본인이 등록한 카풀만 완료 처리할 수 있습니다.' using errcode = '42501';
  end if;
  if v_offer.status = 'done' then
    raise exception '이미 운행완료된 카풀입니다.' using errcode = '22023';
  end if;
  if v_offer.status = 'cancelled' then
    raise exception '취소된 카풀입니다.' using errcode = '22023';
  end if;

  -- 출발 전에 미리 완료 처리하는 것을 막는다
  if (v_offer.ride_date + v_offer.depart_time) > (now() at time zone 'Asia/Seoul') then
    raise exception '아직 출발 시각이 되지 않았습니다.' using errcode = '22023';
  end if;

  select count(*) into v_riders
    from public.carpool_requests
   where offer_id = p_offer_id
     and status = 'accepted';

  -- 아무도 태우지 않았다면 봉사 실적이 아니다
  if v_riders = 0 then
    raise exception '탑승자가 없어 운행완료로 처리할 수 없습니다.' using errcode = '22023';
  end if;

  update public.carpool_requests
     set status = 'done'
   where offer_id = p_offer_id
     and status = 'accepted';

  update public.carpool_offers
     set status = 'done'
   where id = p_offer_id
  returning * into v_offer;

  insert into public.driver_ratings (driver_id, offer_id, points)
  values (v_offer.driver_id, p_offer_id, 1)
  on conflict (offer_id) do nothing;

  return v_offer;
end;
$$;

revoke execute on function public.complete_carpool_offer(uuid) from public;
grant execute on function public.complete_carpool_offer(uuid) to authenticated;

-- ── 시간 경과 건 일괄 완료 (스케줄러용) ───────────────────────
-- 봉사자가 버튼을 누르지 않아도 실적이 남도록 한다.
-- 운행 시각 + 4시간이 지난 건만 대상으로 하며, 탑승자가 있는 건만 적립한다.
--
-- 운영 환경에서 자동화하려면 (Supabase 대시보드에서 1회 실행):
--   select cron.schedule('gdc-life-auto-complete', '0 * * * *',
--                        $sql$ select public.auto_complete_due_offers(); $sql$);
create or replace function public.auto_complete_due_offers()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with due as (
    select o.id, o.driver_id
      from public.carpool_offers o
     where o.status in ('open', 'full')
       and (o.ride_date + o.depart_time)
             < (now() at time zone 'Asia/Seoul') - interval '4 hours'
       and exists (
         select 1 from public.carpool_requests r
          where r.offer_id = o.id and r.status = 'accepted'
       )
  ),
  closed_requests as (
    update public.carpool_requests r
       set status = 'done'
      from due
     where r.offer_id = due.id
       and r.status = 'accepted'
    returning r.id
  ),
  closed_offers as (
    update public.carpool_offers o
       set status = 'done'
      from due
     where o.id = due.id
    returning o.id, o.driver_id
  )
  insert into public.driver_ratings (driver_id, offer_id, points)
  select co.driver_id, co.id, 1 from closed_offers co
  on conflict (offer_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 사용자가 직접 부를 일은 없다. 스케줄러(service_role)만 호출한다.
-- public 에서 revoke 하면 service_role 이 상속받던 권한도 사라지므로 명시적으로 부여한다.
revoke execute on function public.auto_complete_due_offers() from public, anon, authenticated;
grant execute on function public.auto_complete_due_offers() to service_role;

-- ── 별점 집계 ─────────────────────────────────────────────────
create or replace function public.my_rating_summary()
returns table (monthly bigint, yearly bigint, total bigint, rides bigint)
language sql
security invoker
stable
set search_path = ''
as $$
  select
    coalesce(sum(points) filter (
      where (earned_at at time zone 'Asia/Seoul')
            >= date_trunc('month', now() at time zone 'Asia/Seoul')), 0)::bigint,
    coalesce(sum(points) filter (
      where (earned_at at time zone 'Asia/Seoul')
            >= date_trunc('year', now() at time zone 'Asia/Seoul')), 0)::bigint,
    coalesce(sum(points), 0)::bigint,
    count(*)::bigint
  from public.driver_ratings
  where driver_id = (select auth.uid());
$$;

revoke execute on function public.my_rating_summary() from public;
grant execute on function public.my_rating_summary() to authenticated;

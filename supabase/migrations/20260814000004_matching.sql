-- ─────────────────────────────────────────────────────────────
-- GDC Life — 매칭 성립 (허락 / 거절)
--
-- 좌석 경합: 허락은 offer 행을 FOR UPDATE 로 잠근 뒤 처리해서
--            동시에 여러 건을 허락해도 좌석이 음수가 되지 않게 한다.
-- 연락처   : 매칭이 성립한 상대에게만, 전화번호만 열린다.
--            profile_private 의 RLS 는 '본인만' 그대로 두고,
--            필요한 컬럼만 뽑는 뷰로 최소 노출한다.
-- ─────────────────────────────────────────────────────────────

-- ── 허락 ──────────────────────────────────────────────────────
create or replace function public.accept_carpool_request(p_request_id uuid)
returns public.carpool_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := (select auth.uid());
  v_req   public.carpool_requests;
  v_offer public.carpool_offers;
  v_row   public.carpool_requests;
begin
  if v_me is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into v_req from public.carpool_requests where id = p_request_id;
  if not found then
    raise exception '신청을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  -- ★ 좌석 경합 방지: 같은 카풀에 대한 허락은 여기서 직렬화된다.
  --   뒤따라 들어온 트랜잭션은 잠금이 풀린 뒤 갱신된 좌석 수를 다시 읽는다.
  select * into v_offer
    from public.carpool_offers
   where id = v_req.offer_id
     for update;

  if v_offer.driver_id <> v_me then
    raise exception '본인이 등록한 카풀의 신청만 처리할 수 있습니다.' using errcode = '42501';
  end if;
  if v_req.status <> 'pending' then
    raise exception '이미 처리된 신청입니다.' using errcode = '22023';
  end if;
  if v_offer.status = 'cancelled' then
    raise exception '취소된 카풀입니다.' using errcode = '22023';
  end if;
  if v_offer.seats_available <= 0 then
    raise exception '남은 좌석이 없습니다.' using errcode = '22023';
  end if;

  update public.carpool_offers
     set seats_available = seats_available - 1,
         status = case when seats_available - 1 <= 0 then 'full' else status end
   where id = v_offer.id;

  update public.carpool_requests
     set status = 'accepted'
   where id = p_request_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.accept_carpool_request from public;
grant execute on function public.accept_carpool_request to authenticated;

-- ── 거절 ──────────────────────────────────────────────────────
create or replace function public.reject_carpool_request(p_request_id uuid)
returns public.carpool_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  uuid := (select auth.uid());
  v_row public.carpool_requests;
begin
  update public.carpool_requests r
     set status = 'rejected'
   where r.id = p_request_id
     and r.status = 'pending'
     and exists (
       select 1 from public.carpool_offers o
        where o.id = r.offer_id
          and o.driver_id = v_me
     )
  returning r.* into v_row;

  if not found then
    raise exception '처리할 신청을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

revoke execute on function public.reject_carpool_request from public;
grant execute on function public.reject_carpool_request to authenticated;

-- ── 매칭 성립한 상대의 연락처 ─────────────────────────────────
-- 뷰 소유자 권한으로 도니(security_invoker=off) WHERE 절이 곧 접근 통제다.
-- 이메일·로그인ID 는 어떤 경우에도 나가지 않는다 — 전화번호만 뽑는다.
create view public.matched_contacts
with (security_invoker = off) as
select
  p.id          as user_id,
  p.name        as name,
  p.department  as department,
  pp.phone      as phone,
  r.id          as request_id,
  r.offer_id    as offer_id
from public.carpool_requests r
join public.carpool_offers   o  on o.id = r.offer_id
join public.profiles         p  on p.id = case
                                    when o.driver_id = (select auth.uid()) then r.passenger_id
                                    else o.driver_id
                                  end
join public.profile_private  pp on pp.id = p.id
where r.status = 'accepted'
  and (
    o.driver_id    = (select auth.uid())
    or r.passenger_id = (select auth.uid())
  );

comment on view public.matched_contacts is
  '신청이 허락된 상대의 전화번호. 성립 전에는 아무것도 나오지 않는다.';

revoke all on public.matched_contacts from public, anon;
grant select on public.matched_contacts to authenticated;

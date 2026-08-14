-- ─────────────────────────────────────────────────────────────
-- GDC Life — 별점 순위 · 관리자 계정 조회
--
-- 순위: 이름·부서·점수만 쓴다. 이미 검색 카드에 노출되는 정보라 새로 여는 것이 없다.
-- 관리자: 가입자 확인 용도. 전화번호는 서버에서 마스킹해 내보내므로
--         관리자에게도 원본이 가지 않는다.
-- ─────────────────────────────────────────────────────────────

-- ── 별점 순위 ─────────────────────────────────────────────────
create or replace function public.rating_leaderboard(
  p_period text default 'total',   -- 'month' | 'year' | 'total'
  p_limit  integer default 100
)
returns table (
  rank       bigint,
  user_id    uuid,
  name       text,
  department text,
  points     bigint,
  rides      bigint,
  is_me      boolean
)
language sql
security invoker
stable
set search_path = ''
as $$
  with scoped as (
    select dr.driver_id,
           sum(dr.points)::bigint as points,
           count(*)::bigint       as rides
      from public.driver_ratings dr
     where case p_period
             when 'month' then (dr.earned_at at time zone 'Asia/Seoul')
                                 >= date_trunc('month', now() at time zone 'Asia/Seoul')
             when 'year'  then (dr.earned_at at time zone 'Asia/Seoul')
                                 >= date_trunc('year', now() at time zone 'Asia/Seoul')
             else true
           end
     group by dr.driver_id
  )
  select rank() over (order by s.points desc, s.rides desc),
         s.driver_id,
         p.name,
         p.department,
         s.points,
         s.rides,
         s.driver_id = (select auth.uid())
    from scoped s
    join public.profiles p on p.id = s.driver_id
   order by 1, p.name
   limit p_limit;
$$;

revoke execute on function public.rating_leaderboard(text, integer) from public;
grant execute on function public.rating_leaderboard(text, integer) to authenticated;

-- 상위 목록 밖으로 밀려나도 내 등수는 보여준다
create or replace function public.my_rating_rank(p_period text default 'total')
returns table (rank bigint, points bigint, rides bigint, total_drivers bigint)
language sql
security invoker
stable
set search_path = ''
as $$
  with scoped as (
    select dr.driver_id,
           sum(dr.points)::bigint as points,
           count(*)::bigint       as rides
      from public.driver_ratings dr
     where case p_period
             when 'month' then (dr.earned_at at time zone 'Asia/Seoul')
                                 >= date_trunc('month', now() at time zone 'Asia/Seoul')
             when 'year'  then (dr.earned_at at time zone 'Asia/Seoul')
                                 >= date_trunc('year', now() at time zone 'Asia/Seoul')
             else true
           end
     group by dr.driver_id
  ),
  ranked as (
    select driver_id, points, rides,
           rank() over (order by points desc, rides desc) as rank,
           count(*) over () as total_drivers
      from scoped
  )
  select r.rank, r.points, r.rides, r.total_drivers
    from ranked r
   where r.driver_id = (select auth.uid());
$$;

revoke execute on function public.my_rating_rank(text) from public;
grant execute on function public.my_rating_rank(text) to authenticated;

-- ── 관리자 ────────────────────────────────────────────────────
-- 권한 부여는 UI 로 하지 않는다. 대시보드/SQL 로만 넣는다(권한 상승 경로 차단).
create table public.admin_users (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  note       text,
  granted_at timestamptz not null default now()
);

comment on table public.admin_users is
  '관리자 목록. 클라이언트에는 어떤 권한도 없다. service_role 또는 대시보드로만 관리.';

alter table public.admin_users enable row level security;
-- 정책도 권한도 주지 않는다 = 일반 사용자는 읽지도 쓰지도 못한다.
-- service_role 은 RLS 를 우회하지만 테이블 권한은 따로 필요하다.
grant select, insert, update, delete on public.admin_users to service_role;

-- 내가 관리자인지 확인 (definer 라 admin_users 의 RLS 를 거치지 않는다)
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 가입 계정 목록.
-- 전화번호는 여기서 마스킹해 내보낸다 — 원본은 관리자에게도 나가지 않는다.
create or replace function public.admin_list_accounts(p_query text default null)
returns table (
  user_id      uuid,
  login_id     text,
  name         text,
  department   text,
  email        text,
  phone_masked text,
  created_at   timestamptz,
  offers       bigint,
  rides        bigint,
  points       bigint,
  is_admin     boolean
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 조회할 수 있습니다.' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    pp.login_id,
    p.name,
    p.department,
    pp.email,
    regexp_replace(pp.phone, '^(01[0-9])-?([0-9]{3,4})-?([0-9]{4})$', '\1-****-\3'),
    p.created_at,
    (select count(*) from public.carpool_offers o where o.driver_id = p.id),
    (select count(*) from public.driver_ratings dr where dr.driver_id = p.id),
    coalesce((select sum(dr.points) from public.driver_ratings dr where dr.driver_id = p.id), 0)::bigint,
    exists (select 1 from public.admin_users a where a.user_id = p.id)
  from public.profiles p
  join public.profile_private pp on pp.id = p.id
  where p_query is null
     or btrim(p_query) = ''
     or p.name       ilike '%' || btrim(p_query) || '%'
     or p.department ilike '%' || btrim(p_query) || '%'
     or pp.login_id  ilike '%' || btrim(p_query) || '%'
     or pp.email     ilike '%' || btrim(p_query) || '%'
  order by p.created_at desc;
end;
$$;

revoke execute on function public.admin_list_accounts(text) from public;
grant execute on function public.admin_list_accounts(text) to authenticated;

-- 운영 현황 요약
create or replace function public.admin_stats()
returns table (
  users      bigint,
  offers     bigint,
  requests   bigint,
  matched    bigint,
  completed  bigint,
  points     bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 조회할 수 있습니다.' using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.profiles),
    (select count(*) from public.carpool_offers),
    (select count(*) from public.carpool_requests),
    (select count(*) from public.carpool_requests r where r.status in ('accepted', 'done')),
    (select count(*) from public.carpool_offers o where o.status = 'done'),
    -- 테이블 별칭 필수: 반환 컬럼명 points 와 driver_ratings.points 가 충돌한다
    coalesce((select sum(dr.points) from public.driver_ratings dr), 0)::bigint;
end;
$$;

revoke execute on function public.admin_stats() from public;
grant execute on function public.admin_stats() to authenticated;

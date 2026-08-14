-- ─────────────────────────────────────────────────────────────
-- GDC Life — 기반 스키마 (설정 · 프로필)
--
-- 개인정보 원칙이 스키마에 반영되어 있다:
--   profiles         이름/부서  → 로그인한 직원이면 조회 가능 (검색 카드에 필요)
--   profile_private  ID/이메일/전화 → 본인만 조회 가능
--   전화번호를 매칭 상대에게 여는 것은 Phase 4에서 별도 뷰로 추가한다.
-- ─────────────────────────────────────────────────────────────

create extension if not exists postgis with schema extensions;

-- ── 앱 설정 (회사 좌표 · 매칭 파라미터) ────────────────────────
-- 단일 행. 대시보드 테이블 에디터에서 바로 수정할 수 있다.
-- 좌표는 클라이언트가 그대로 읽어 쓰므로 geography 가 아닌 숫자로 둔다.
-- (공간 연산이 필요한 곳에서는 st_point(lng, lat) 로 만들어 쓴다)
create table public.app_settings (
  id                          smallint primary key default 1 check (id = 1),
  company_name                text        not null,
  company_addr                text        not null,
  company_lat                 double precision not null check (company_lat between -90 and 90),
  company_lng                 double precision not null check (company_lng between -180 and 180),
  match_radius_m              integer     not null default 1000 check (match_radius_m > 0),
  match_default_tolerance_min smallint    not null default 10,
  require_company_email       boolean     not null default false,
  company_email_domains       text[]      not null default '{}',
  updated_at                  timestamptz not null default now()
);

comment on table public.app_settings is '앱 전역 설정. 회사 좌표는 여기가 유일한 출처다.';

insert into public.app_settings (id, company_name, company_addr, company_lat, company_lng)
values (
  1,
  'HD현대마린솔루션 글로벌디지털센터',
  '울산광역시 남구 신두왕로 50',
  -- 카카오 장소검색 기준 실제 건물 좌표 (`npm run geocode` 로 재확인 가능)
  35.50512033,
  129.29956197
);

alter table public.app_settings enable row level security;

-- 설정은 로그인 전(로그인 화면)에도 필요하므로 anon 에게도 읽기 허용.
create policy "설정은 누구나 조회"
  on public.app_settings for select
  to anon, authenticated
  using (true);
-- INSERT/UPDATE/DELETE 정책 없음 → service_role 또는 대시보드에서만 수정 가능.

-- 권한은 명시적으로만 준다(RLS 이전의 1차 방어선). 읽기 외에는 주지 않는다.
grant select on public.app_settings to anon, authenticated;

-- ── 직원 디렉터리 (민감정보 제외) ─────────────────────────────
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text        not null check (length(trim(name)) between 1 and 50),
  department text        not null check (length(trim(department)) between 1 and 50),
  created_at timestamptz not null default now()
);

comment on table public.profiles is '검색 결과 카드에 노출되는 최소 정보. 전화번호는 profile_private 에 있다.';

alter table public.profiles enable row level security;

create policy "로그인한 직원은 디렉터리 조회 가능"
  on public.profiles for select
  to authenticated
  using (true);

create policy "본인 프로필만 수정"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- INSERT/DELETE 는 권한 자체를 주지 않는다 → 트리거(security definer)로만 생성된다.
grant select, update on public.profiles to authenticated;

-- ── 민감정보 (본인만) ─────────────────────────────────────────
create table public.profile_private (
  id       uuid primary key references public.profiles (id) on delete cascade,
  login_id text not null unique check (login_id ~ '^[a-z0-9_]{4,20}$'),
  email    text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone    text not null check (phone ~ '^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$')
);

comment on table public.profile_private is '본인만 조회 가능. 전화번호는 매칭 성립 시에만 상대에게 열린다(Phase 4).';

alter table public.profile_private enable row level security;

create policy "본인 연락처만 조회"
  on public.profile_private for select
  to authenticated
  using (id = (select auth.uid()));

create policy "본인 연락처만 수정"
  on public.profile_private for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

grant select, update on public.profile_private to authenticated;

-- ── 가입 시 프로필 자동 생성 ──────────────────────────────────
-- 클라이언트가 profiles 에 직접 INSERT 하지 못하게 하고(정책 없음),
-- auth.users 생성 트리거로만 만들어 위조를 막는다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, department)
  values (
    new.id,
    trim(new.raw_user_meta_data ->> 'name'),
    trim(new.raw_user_meta_data ->> 'department')
  );

  -- login_id 는 항상 소문자로 정규화한다 (is_login_id_available 과 동일 규칙).
  -- unique 제약이 있으므로 ID 중복이면 가입 트랜잭션 전체가 롤백된다.
  insert into public.profile_private (id, login_id, email, phone)
  values (
    new.id,
    lower(trim(new.raw_user_meta_data ->> 'login_id')),
    lower(trim(new.raw_user_meta_data ->> 'email')),
    trim(new.raw_user_meta_data ->> 'phone')
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── ID 중복 검사 ──────────────────────────────────────────────
-- profile_private 을 열지 않고 가용 여부만 알려준다.
create or replace function public.is_login_id_available(p_login_id text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select not exists (
    select 1 from public.profile_private where login_id = lower(trim(p_login_id))
  );
$$;

revoke execute on function public.is_login_id_available(text) from public;
grant execute on function public.is_login_id_available(text) to anon, authenticated;

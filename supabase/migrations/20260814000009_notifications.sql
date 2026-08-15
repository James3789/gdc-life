-- ─────────────────────────────────────────────────────────────
-- GDC Life — 알림
--
-- 알림은 클라이언트가 만들지 않는다. 신청·카풀의 상태가 바뀔 때
-- 트리거가 만든다. 그래서 RPC 를 새로 추가해도 알림이 빠지지 않고,
-- 스케줄러(auto_complete_due_offers)가 처리한 건도 똑같이 알림이 남는다.
--
-- 클라이언트에는 INSERT 권한이 없다 — 남에게 알림을 심을 수 없다.
-- 본인이 바꿀 수 있는 것은 read_at(읽음) 뿐이다.
-- ─────────────────────────────────────────────────────────────

create type public.notification_kind as enum (
  'request_received',   -- 봉사자 ← 새 탑승 신청
  'request_accepted',   -- 탑승자 ← 허락됨
  'request_rejected',   -- 탑승자 ← 거절됨
  'request_cancelled',  -- 봉사자 ← 탑승자가 신청 취소
  'offer_cancelled',    -- 탑승자 ← 봉사자가 카풀 취소
  'trip_completed'      -- 양쪽   ← 운행완료 (봉사자는 별점 적립)
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       public.notification_kind not null,
  title      text not null,
  body       text not null,
  -- 눌렀을 때 이동할 앱 내 경로
  link       text,
  offer_id   uuid references public.carpool_offers   (id) on delete cascade,
  request_id uuid references public.carpool_requests (id) on delete cascade,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  '앱 내 알림. 트리거만 생성한다(클라이언트 INSERT 권한 없음). 읽음 처리만 본인이 한다.';

create index notifications_user_idx on public.notifications (user_id, created_at desc);
-- 배지(안 읽은 개수)용 — 안 읽은 것만 담아 작게 유지한다
create index notifications_unread_idx on public.notifications (user_id)
  where read_at is null;

alter table public.notifications enable row level security;

create policy "내 알림만 조회"
  on public.notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "내 알림만 읽음 처리"
  on public.notifications for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "내 알림만 삭제"
  on public.notifications for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- UPDATE 는 read_at 만. 내용을 고쳐 쓸 수는 없다.
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ── 표기 헬퍼 ─────────────────────────────────────────────────
-- '8/16(일) 07:30'. to_char 의 요일은 로케일을 타므로 직접 만든다.
create or replace function public.format_ride_when(p_date date, p_time time)
returns text
language sql
stable
set search_path = ''
as $$
  select to_char(p_date, 'FMMM/FMDD')
      || '(' || (array['일','월','화','수','목','금','토'])[extract(dow from p_date)::int + 1] || ') '
      || to_char(p_time, 'HH24:MI');
$$;

-- ── 알림 생성 (내부 전용) ─────────────────────────────────────
-- 트리거(security definer)에서만 호출한다. 누구에게도 EXECUTE 를 주지 않는다.
create or replace function public.push_notification(
  p_user_id    uuid,
  p_kind       public.notification_kind,
  p_title      text,
  p_body       text,
  p_link       text default null,
  p_offer_id   uuid default null,
  p_request_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    return;
  end if;

  insert into public.notifications (user_id, kind, title, body, link, offer_id, request_id)
  values (p_user_id, p_kind, p_title, p_body, p_link, p_offer_id, p_request_id);
end;
$$;

revoke execute on function public.push_notification(
  uuid, public.notification_kind, text, text, text, uuid, uuid
) from public, anon, authenticated;

-- ── 신청 상태 변화 → 알림 ─────────────────────────────────────
-- 'done'(운행완료)은 여기서 다루지 않는다. 카풀 쪽 트리거가 한 번에 처리해
-- 봉사자·탑승자 알림이 중복되지 않게 한다.
create or replace function public.on_carpool_request_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer     public.carpool_offers;
  v_driver    text;
  v_passenger text;
  v_when      text;
  v_dir       text;
begin
  select * into v_offer from public.carpool_offers where id = new.offer_id;
  if not found then
    return new;
  end if;

  select name into v_driver    from public.profiles where id = v_offer.driver_id;
  select name into v_passenger from public.profiles where id = new.passenger_id;

  v_when := public.format_ride_when(v_offer.ride_date, v_offer.depart_time);
  v_dir  := case when v_offer.direction = 'commute-in' then '출근' else '퇴근' end;

  -- 새 신청 (취소·거절 뒤 되살아난 신청도 포함)
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    perform public.push_notification(
      v_offer.driver_id, 'request_received',
      '새 탑승 신청',
      v_passenger || '님이 ' || v_when || ' ' || v_dir || ' 카풀에 신청했습니다.',
      '/carpool/requests', v_offer.id, new.id);

  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'accepted' then
      perform public.push_notification(
        new.passenger_id, 'request_accepted',
        '신청이 허락되었습니다',
        v_driver || '님이 ' || v_when || ' ' || v_dir || ' 카풀 신청을 허락했습니다.',
        '/carpool/trip/' || v_offer.id, v_offer.id, new.id);

    elsif new.status = 'rejected' then
      perform public.push_notification(
        new.passenger_id, 'request_rejected',
        '신청이 거절되었습니다',
        v_when || ' ' || v_dir || ' 카풀 신청이 거절되었습니다. 다른 카풀을 찾아보세요.',
        '/carpool/search', v_offer.id, new.id);

    elsif new.status = 'cancelled' then
      perform public.push_notification(
        v_offer.driver_id, 'request_cancelled',
        '탑승 신청이 취소되었습니다',
        v_passenger || '님이 ' || v_when || ' ' || v_dir || ' 카풀 신청을 취소했습니다.',
        '/carpool/requests', v_offer.id, new.id);
    end if;
  end if;

  return new;
end;
$$;

create trigger carpool_requests_notify
  after insert or update of status on public.carpool_requests
  for each row execute function public.on_carpool_request_changed();

-- ── 카풀 상태 변화 → 알림 ─────────────────────────────────────
create or replace function public.on_carpool_offer_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver text;
  v_when   text;
  v_dir    text;
  v_riders integer := 0;
  r        record;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select name into v_driver from public.profiles where id = new.driver_id;
  v_when := public.format_ride_when(new.ride_date, new.depart_time);
  v_dir  := case when new.direction = 'commute-in' then '출근' else '퇴근' end;

  if new.status = 'cancelled' then
    -- 아직 살아 있는 신청을 낸 사람에게만 알린다
    for r in
      select id, passenger_id
        from public.carpool_requests
       where offer_id = new.id
         and status in ('pending', 'accepted')
    loop
      perform public.push_notification(
        r.passenger_id, 'offer_cancelled',
        '카풀이 취소되었습니다',
        v_driver || '님이 ' || v_when || ' ' || v_dir || ' 카풀을 취소했습니다.',
        '/carpool/search', new.id, r.id);
    end loop;

  elsif new.status = 'done' then
    -- 완료 처리는 신청을 먼저 done 으로 바꾸므로 두 상태를 함께 본다
    for r in
      select id, passenger_id
        from public.carpool_requests
       where offer_id = new.id
         and status in ('accepted', 'done')
    loop
      perform public.push_notification(
        r.passenger_id, 'trip_completed',
        '운행이 완료되었습니다',
        v_when || ' ' || v_driver || '님과의 카풀이 완료되었습니다.',
        '/carpool/requests', new.id, r.id);
      v_riders := v_riders + 1;
    end loop;

    -- 별점은 탑승자가 있을 때만 적립된다 (ratings 마이그레이션 참고)
    if v_riders > 0 then
      perform public.push_notification(
        new.driver_id, 'trip_completed',
        '운행완료 · 별점 1점 적립',
        v_when || ' ' || v_dir || ' 운행이 완료되어 별점 1점이 적립되었습니다.',
        '/profile', new.id, null);
    end if;
  end if;

  return new;
end;
$$;

create trigger carpool_offers_notify
  after update of status on public.carpool_offers
  for each row execute function public.on_carpool_offer_changed();

-- ── 오래된 알림 정리 ──────────────────────────────────────────
-- 알림은 쌓이기만 하므로 주기적으로 지운다. 스케줄러(service_role)용.
--   select cron.schedule('gdc-life-purge-notifications', '30 4 * * *',
--                        $sql$ select public.purge_old_notifications(); $sql$);
create or replace function public.purge_old_notifications(p_days integer default 60)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.notifications
   where created_at < now() - make_interval(days => greatest(p_days, 1));

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.purge_old_notifications(integer)
  from public, anon, authenticated;
grant execute on function public.purge_old_notifications(integer) to service_role;

-- ── Realtime ──────────────────────────────────────────────────
-- 새 알림을 즉시 받으려면 테이블이 발행 목록에 있어야 한다.
-- 구독에도 위의 SELECT 정책이 적용되므로 남의 알림은 흘러오지 않는다.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'notifications'
     )
  then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

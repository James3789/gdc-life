-- ─────────────────────────────────────────────────────────────
-- GDC Life — notifications 테이블 비로그인(anon) 접근 차단
-- ─────────────────────────────────────────────────────────────

revoke all on public.notifications from anon;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

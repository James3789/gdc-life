# 배포 가이드

정적 프론트엔드(Cloudflare Pages) + Supabase 구조로 배포한다.
상시 켜 두어야 하는 서버는 없다.

```
Cloudflare Pages ──── 정적 파일 (frontend/dist)
        │
        ├──→ Supabase : Auth · Postgres/PostGIS · Realtime · Edge Function
        └──→ Kakao    : 지도 SDK (브라우저에서 직접)
```

---

## 역할 분담

| 단계 | 누가 |
|---|---|
| 1. Supabase 프로젝트 생성 | **직접** (계정·결제·리전 선택) |
| 2. Supabase 인증 설정 | **직접** (대시보드 토글) |
| 3. 스키마 적용 · Edge Function 배포 | **대신 가능** (액세스 토큰 주시면) |
| 4. GitHub 저장소 생성·푸시 | **직접** 또는 **대신 가능** (`gh` 설치 + 로그인 시) |
| 5. Cloudflare Pages 연결 | **직접** (계정 연동) |
| 6. 카카오 도메인 등록 | **직접** (콘솔) |
| 7. 배포 후 점검 | **대신 가능** (`npm run preflight`) |
| 8. 테스트 계정 정리 | **대신 가능** (`npm run purge`) |

---

## 1. Supabase 프로젝트 생성 — 직접

1. https://supabase.com/dashboard → **New project**
2. 입력값
   - **Region: `Northeast Asia (Seoul)`** ← 동료 연락처·위치를 다루므로 국내
   - Database Password: 생성 후 **따로 보관** (분실 시 재설정 필요)
3. 생성 후 **Project Settings → General** 에서 **Reference ID** 를 복사해 둔다 (예: `abcdefghijklmno`)
4. **Project Settings → API** 에서 두 값을 복사
   - `Project URL` → `https://<ref>.supabase.co`
   - `anon public` 키

> `service_role` 키는 Cloudflare 에 넣지 않는다. 로컬 관리 작업에만 쓴다.

## 2. 인증 설정 — 직접 (빠뜨리면 아무도 로그인 못 함)

**Authentication → Sign In / Providers → Email**

| 항목 | 값 | 이유 |
|---|---|---|
| **Confirm email** | **끄기** | 사내 ID 로그인은 `@gdc-life.local` 합성 주소를 쓴다. 켜져 있으면 **가입 자체가 거부된다** — 아래 참고. |
| Minimum password length | `8` | 프론트 검증과 일치 |
| Password requirements | `Letters and digits` | 프론트 검증과 일치 |

> **`Email address "hong12@gdc-life.local" is invalid` 로 가입이 막힌다면 이것이다.**
> 확인 메일이 켜져 있으면 Supabase 가 메일을 보내려 하고, `.local` 은 실재할 수 없는
> 예약 도메인이라 발송 직전에 주소가 거부된다.
> 검증은 **계정을 실제로 만들려는 순간에만** 돌기 때문에, 다른 이유로 먼저 실패하는
> 요청에서는 이 오류가 보이지 않아 원인을 찾기 어렵다.
>
> 지금 상태를 확인하는 법 — `mailer_autoconfirm` 이 **`true`** 여야 정상이다:
>
> ```bash
> curl -s "https://<ref>.supabase.co/auth/v1/settings" -H "apikey: <anon 키>"
> ```
>
> 로컬 스택은 `supabase/config.toml` 의 `enable_confirmations = false` 라 이 문제가 없다.
> **클라우드에서만 나타난다.**

**Authentication → URL Configuration**
- Site URL: 배포 주소 (예: `https://gdc-life.pages.dev`)

## 3. 스키마 적용 · Edge Function 배포 — 대신 가능

**직접 하실 경우:**

```bash
npx supabase login                       # 브라우저가 열림
npx supabase link --project-ref <ref>    # DB 비밀번호 입력
npm run db:push                          # 마이그레이션 9개 적용
npx supabase secrets set KAKAO_REST_KEY=<REST 키>
npm run fn:deploy                        # 길찾기 함수 배포
```

**제가 대신 하려면**: https://supabase.com/dashboard/account/tokens 에서
**Access Token** 을 발급해 주세요. 그러면 위 명령을 제가 실행하고 결과까지 확인해 드립니다.
(`supabase login` 대신 `SUPABASE_ACCESS_TOKEN` 환경변수를 씁니다.)

적용 후 **관리자 지정** — 대시보드 SQL Editor 에서 한 번:

```sql
insert into public.admin_users (user_id, note)
select id, '운영 담당자' from public.profile_private where login_id = '<본인 사내ID>'
on conflict (user_id) do nothing;
```

> 본인 계정으로 먼저 회원가입한 뒤 실행해야 한다.

## 4. GitHub 저장소 — 직접 또는 대신 가능

Cloudflare Pages 는 Git 연동이 가장 편하다. 저장소가 아직 로컬에만 있다.

```bash
git remote add origin https://github.com/<계정>/gdc-life.git
git push -u origin main
```

**제가 대신 하려면**: `winget install GitHub.cli` 로 `gh` 를 설치하고 `gh auth login` 을 해 주세요.
그 다음은 저장소 생성부터 푸시까지 제가 처리합니다.

> `.env` 는 `.gitignore` 에 있어 올라가지 않는다. 키는 Cloudflare 설정에만 넣는다.

## 5. Cloudflare Pages — 직접

1. https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git**
2. 저장소 선택 후 빌드 설정

   | 항목 | 값 |
   |---|---|
   | Framework preset | `None` |
   | Build command | `npm run build` |
   | Build output directory | `frontend/dist` |
   | Root directory | (비움) |

3. **Environment variables** — Production·Preview 양쪽에 추가

   | 이름 | 값 |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | anon public 키 |
   | `VITE_KAKAO_JS_KEY` | 카카오 JavaScript 키 |

   > `VITE_` 로 시작하는 값은 **빌드 시점에 정적 번들로 들어간다.**
   > anon 키와 카카오 JS 키는 공개되어도 되는 값이다 —
   > anon 키는 RLS 가, JS 키는 도메인 허용목록이 보호한다.
   > **`KAKAO_REST_KEY` 와 `SUPABASE_SERVICE_ROLE_KEY` 는 절대 넣지 않는다.**

4. **Save and Deploy** → 몇 분 뒤 `https://<프로젝트>.pages.dev` 발급

## 6. 카카오 도메인 등록 — 직접 (안 하면 지도가 안 뜸)

https://developers.kakao.com → 내 애플리케이션 → **플랫폼 → Web → 사이트 도메인**

```
https://<프로젝트>.pages.dev
https://<커스텀 도메인>          (쓰는 경우)
http://localhost:5173            (개발용, 유지)
```

**제품 설정 → 카카오맵 → 활성화 설정 ON** 도 되어 있어야 한다.

## 7. 배포 후 점검

```bash
# .env 를 배포 대상으로 잠시 바꾸거나, 환경변수로 넘겨 실행
VITE_SUPABASE_URL=https://<ref>.supabase.co \
VITE_SUPABASE_ANON_KEY=<anon> \
npm run preflight
```

확인 항목:
- 마이그레이션 적용 여부, 회사 좌표
- Edge Function 배포 여부 + **인증 없이 호출되지 않는지**
- **빌드 산출물에 비밀 키가 섞이지 않았는지**
- `_redirects` 등 정적 호스팅 준비물

브라우저에서 직접 확인할 것:

| 확인 | 방법 |
|---|---|
| 회원가입·로그인 | 새 계정으로 가입 → 자동 로그인 유지되는지 |
| 지도 | 카풀 등록에서 지도가 뜨는지 (안 뜨면 도메인 미등록) |
| 경로 계산 | 출발지 지정 시 예상 거리·시간이 나오는지 (안 나오면 Edge Function 또는 시크릿 문제) |
| **위치 기능** | HTTPS 라 모바일에서도 현재위치·실시간 위치가 동작 |
| **알림** | 계정 두 개로 신청/허락 → 헤더 종에 배지가 **즉시** 붙는지 (안 붙으면 Realtime 확인) |
| 새로고침 | `/carpool/search` 에서 F5 → 404 안 나는지 |
| PWA | 모바일 브라우저에서 "홈 화면에 추가" |
| 화면 | 작은 폰(폭 320px)·태블릿에서 가로 스크롤이 생기지 않는지 |

## 8. 오픈 전 테스트 계정 정리

```bash
npm run purge                # 미리보기
npm run purge -- --yes       # 실제 삭제 (관리자는 항상 보존)
```

`SUPABASE_SERVICE_ROLE_KEY` 를 배포 프로젝트 값으로 두고 실행한다.
운영 프로젝트를 대상으로 하면 `DELETE` 를 직접 입력해야 진행된다.

---

## 이후 배포

`main` 에 푸시하면 Cloudflare Pages 가 자동으로 다시 빌드한다.

스키마를 바꿨다면:

```bash
npm run db:push      # 마이그레이션 적용
npm run fn:deploy    # Edge Function 을 고쳤을 때만
```

## 선택 — 자동 처리 (pg_cron)

대시보드 SQL Editor 에서 한 번 실행한다.

```sql
create extension if not exists pg_cron;

-- 봉사자가 [운행완료] 를 누르지 않아도 별점이 쌓이게
select cron.schedule(
  'gdc-life-auto-complete', '0 * * * *',
  $$ select public.auto_complete_due_offers(); $$
);

-- 60일 지난 알림 정리 (안 걸어도 동작에는 지장 없다)
select cron.schedule(
  'gdc-life-purge-notifications', '30 4 * * *',
  $$ select public.purge_old_notifications(); $$
);
```

## 알림이 실시간으로 안 뜬다면

알림 자체는 DB 트리거가 만들므로 화면을 새로 고치면 항상 보인다.
**배지가 즉시 갱신되지 않는다면** Realtime 발행 설정을 본다.

```sql
-- 목록에 public.notifications 가 있어야 한다
select * from pg_publication_tables where pubname = 'supabase_realtime';

-- 없다면
alter publication supabase_realtime add table public.notifications;
```

> 마이그레이션이 자동으로 등록하지만, 프로젝트에 따라 발행 이름이 다를 수 있다.
> 대시보드에서는 **Database → Replication** 에서도 확인된다.

---

## 비용

| | 무료 한도 | 예상 사용량 |
|---|---|---|
| Supabase DB | 500MB | 경로 저장 월 4MB |
| Supabase Realtime | 200 동시 · 월 200만 메시지 | 월 30만~60만 |
| Supabase MAU | 5만 | GDC 인원 |
| Cloudflare Pages | 월 500 빌드 · 대역폭 무제한 | — |

수년간 무료 범위 안에서 돌아간다.
단, **Supabase 무료 프로젝트는 1주일 미사용 시 일시정지**된다 (평일 사용 앱이라 평소엔 무관).

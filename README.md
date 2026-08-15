# GDC Life

HD현대마린솔루션 **글로벌디지털센터(GDC)** 임직원 대상 모바일 PWA.
첫 기능은 **출퇴근 카풀 매칭**이며, 홈 대시보드에 기능 모듈을 끼워 넣는 구조로 확장한다.

---

## 빠른 시작

```bash
npm install          # 루트 (Supabase CLI)
npm run setup        # .env 생성 + 프론트 패키지 설치
npm run db:start     # 로컬 Supabase 스택 (Docker 필요) — 출력된 URL/anon key 를 .env 에 입력
npm run dev          # http://localhost:5173
```

> **경로 계산을 쓰려면 터미널 하나를 더 열어 `npm run fn:serve` 를 실행해야 한다.**
> 카카오 길찾기는 Edge Function 을 거치는데, 로컬에서는 이 명령이 떠 있을 때만 동작한다.
> (배포 환경에서는 `npm run fn:deploy` 한 번이면 상시 동작)

### 테스트 계정

계정은 회원가입으로 만들어지며, `db:reset` 하면 모두 사라진다.
로컬에서 바로 써 볼 계정이 필요하면:

```bash
npm run seed
```

| ID | 이름 / 부서 |
|---|---|
| `driver1` | 김봉사 / 스마트십솔루션팀 |
| `driver2` | 박운전 / 디지털솔루션팀 |
| `rider1` | 이탑승 / 기술연구소 |
| `rider2` | 최동승 / 경영지원팀 |
| `admin` | 관리자 / 운영 — `/admin` 접근 가능 |

비밀번호는 모두 `gdclife1234`. 로컬 스택이 아니면 스크립트가 실행을 거부한다.

클라우드 프로젝트를 쓸 경우 `db:start` 대신:

```bash
npx supabase link --project-ref <프로젝트-ref>
npm run db:push      # 마이그레이션 적용
```

> 모바일 실기기: Vite가 LAN에 바인딩되므로 같은 Wi-Fi에서 `http://<PC의 IP>:5173` 으로 접속.

---

## 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind v4 | 모바일 우선 반응형 |
| PWA | vite-plugin-pwa (Workbox) | 홈 화면 추가 · 앱 셸 오프라인 |
| BaaS | **Supabase** | 개인 운영이라 관리할 서버가 없어야 함 |
| DB | **Postgres + PostGIS** | 경로 반경 매칭을 `ST_DWithin` 으로 정공법 처리 |
| 인증 | Supabase Auth (합성 이메일로 ID 로그인) | 아래 *ID 로그인* 참고 |
| 실시간 | Supabase Realtime **Broadcast** | 위치를 DB에 저장하지 않고 흘려보냄 |
| 서버 로직 | Edge Functions (Deno) | 카카오 REST 키 은닉 |
| 지도/경로 | Kakao Maps JS SDK + Kakao Mobility Directions | 국내 주소·도로·경유지 |

### 매칭 방식

탑승 지점이 봉사자의 **실제 도로 경로선**에서 반경 이내인지를 PostGIS 로 판정한다
(`ST_DWithin` + GiST 인덱스). 직선거리가 아니라 길찾기 결과 LineString 기준이라,
직선으로는 가까워도 도로가 돌아가면 후보에서 빠진다.

시간 비교 기준은 방향에 따라 다르다 (명세 5.9):

| | 기준 시각 | 계산 |
|---|---|---|
| 출근 | **예상 픽업 시각** | 출발 시각 + (경로상 위치 비율 × 총 소요시간) — `ST_LineLocatePoint` |
| 퇴근 | 회사 출발 시각 | 그대로 |

정렬은 경로 근접도 60% + 시간 근접도 40% 로 점수를 매겨 낮은 순.

### 왜 Supabase인가

회사 인프라와 무관하게 개인이 운영하므로 **상시 켜둘 백엔드 서버가 없어야** 한다.
Flask + VPS 조합은 월 $5~10이 들고 무료 티어는 콜드스타트가 길어 출근길 사용에 부적합하다.
무료 티어 한도(500MB DB / 실시간 200 동시접속 · 월 200만 메시지 / 5만 MAU) 대비
예상 사용량(위치 5초 간격 · 하루 20건 기준 월 30만~60만 메시지, 경로 저장 월 4MB)이라 여유가 크다.

---

## 프로젝트 구조

```
.
├── package.json              # 모든 명령의 진입점
├── .env.example
├── supabase/
│   ├── config.toml           # 로컬 스택 · Edge Function 설정
│   ├── migrations/           # 스키마 + RLS 정책 (SQL)
│   └── functions/
│       └── kakao-directions/ # 카카오 길찾기 프록시 (Deno)
├── tools/
│   ├── setup.mjs
│   ├── test-rls.mjs          # ★ 개인정보 격리 자동 검증
│   ├── geocode-company.mjs   # 주소 → 좌표
│   └── gen_icons.py          # PWA 아이콘 생성 (1회성, pip install pillow)
└── frontend/
    ├── vite.config.ts        # envDir='..', PWA
    └── src/
        ├── App.tsx           # 라우팅
        ├── components/       # AppShell · BottomTabBar · icons
        ├── lib/              # supabase · appConfig · direction · database.types
        ├── modules/          # ★ 기능 모듈 레지스트리 (확장 지점)
        └── pages/
```

**기능 추가 방법**: `frontend/src/modules/registry.tsx` 에 항목을 추가하고 라우트를 등록하면
홈 대시보드에 자동 노출된다.

---

## 명령어

| 명령 | 설명 |
|---|---|
| `npm run dev` | 프론트 개발 서버 |
| `npm run build` | 프로덕션 빌드 (`frontend/dist`) |
| `npm run db:start` / `db:stop` | 로컬 Supabase 스택 |
| `npm run db:reset` | 로컬 DB 초기화 + 마이그레이션 재적용 |
| `npm run db:push` | 연결된 클라우드 프로젝트에 마이그레이션 적용 |
| `npm run gen:types` | 스키마 → `database.types.ts` 재생성 |
| `npm run test` | 아래 두 검증을 모두 실행 |
| `npm run test:rls` | **개인정보 격리 검증** (스키마 변경 시 반드시 실행) |
| `npm run test:auth` | 가입·로그인 흐름과 유효성 규칙 검증 |
| `npm run test:session` | 자동 로그인(세션 지속) 검증 |
| `npm run test:offers` | 카풀 등록·취소·권한 검증 |
| `npm run test:search` | 매칭 검색·신청 검증 |
| `npm run test:matching` | 좌석 동시성·연락처 공개 범위 검증 |
| `npm run test:location` | 실시간 위치 채널 접근 통제 검증 |
| `npm run test:ratings` | 운행완료·별점 적립 검증 |
| `npm run test:admin` | 별점 순위·관리자 권한 검증 |
| `npm run test:notifications` | 알림 생성·격리·실시간 수신 검증 |
| `npm run test:directions` | 길찾기 Edge Function 검증 (`fn:serve` 실행 중이어야 함) |
| `npm run fn:deploy` | 카카오 길찾기 Edge Function 배포 |
| `npm run geocode` | 주소를 좌표로 변환 |
| `npm run seed` | 로컬 테스트용 데모 계정·데이터 생성 (로컬 스택에서만 동작) |
| `npm run purge` | 계정 정리 — 관리자 외 삭제 (기본은 미리보기) |
| `npm run preflight` | 배포 전 점검 (키 유출·Edge Function·정적 파일) |

---

## 설정

### 환경변수 (`.env`)

| 키 | 설명 |
|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Supabase 연결 |
| `VITE_KAKAO_JS_KEY` | 브라우저 지도 SDK (공개되어도 되는 값) |
| `KAKAO_REST_KEY` | 길찾기 REST 키 — **브라우저로 나가면 안 됨** |

### 회사 좌표 — `.env` 가 아니라 DB에 있다

`app_settings` 테이블 단일 행에 있고, Supabase 대시보드 테이블 에디터에서 바로 수정할 수 있다.
프론트는 부팅 시 이 행을 읽으므로 좌표를 바꿔도 재배포가 필요 없다.

| 컬럼 | 현재 값 |
|---|---|
| `company_name` | HD현대마린솔루션 글로벌디지털센터 |
| `company_addr` | 울산광역시 남구 신두왕로 50 |
| `company_lat` / `company_lng` | 35.50512033 / 129.29956197 (카카오 장소검색 기준) |
| `match_radius_m` | 1000 |
| `match_default_tolerance_min` | 10 |

좌표를 다시 확인하려면 `npm run geocode` (`KAKAO_REST_KEY` 필요).
값을 바꾼 뒤에는 `supabase/migrations/*_init.sql` 의 시드도 함께 고쳐야 새 환경에 반영된다.

### Supabase 프로젝트 설정 (클라우드)

1. 리전은 **Seoul (ap-northeast-2)** — 동료들의 연락처·위치를 다루므로 국내에 둔다.
2. **Authentication → Providers → Email → Confirm email 을 끈다.**
   ID 로그인용 합성 주소(`@gdc-life.local`)로는 확인 메일을 받을 수 없어,
   켜져 있으면 **가입 후 아무도 로그인하지 못한다.**
3. **Authentication → Policies → 비밀번호 정책**을 `supabase/config.toml` 과 맞춘다.
   최소 길이 **8**, 요구사항 **letters_digits**.
   `config.toml` 은 로컬 스택에만 적용되므로 클라우드는 대시보드에서 따로 설정해야 하고,
   맞추지 않으면 프론트 유효성 검사와 서버 정책이 어긋난다.
4. Edge Function 시크릿: `npx supabase secrets set KAKAO_REST_KEY=...`

### ID 로그인 방식

Supabase Auth는 이메일 기반이라, 명세의 사내 ID 로그인을 다음처럼 매핑한다.

```
login_id "hong12"  →  Auth 이메일  hong12@gdc-life.local
실제 이메일         →  profile_private.email 에 별도 보관
```

- ID 중복 검사는 `is_login_id_available()` RPC로 처리한다 (테이블을 열지 않음).
- 대소문자는 가입 트리거에서 소문자로 정규화하므로 `Hong12` 로 가입해도 `hong12` 로 로그인된다.

#### 자동 로그인

한 번 로그인하면 브라우저에 세션이 저장돼 다음 방문에 자동 로그인된다.
액세스 토큰이 만료돼도 리프레시 토큰으로 자동 갱신되므로 사실상 로그아웃 전까지 유지된다.

저장 키는 `gdc-life-auth` 로 **고정**했다. 기본값은 Supabase URL 에서 파생되기 때문에
접속 주소가 바뀌면(`localhost` → LAN IP) 로그인이 풀려 버린다.

> 공용 PC 에서는 로그아웃해야 한다. 동료 연락처를 다루는 앱이라 세션이 남으면 그대로 열린다.

#### 한계 — 비밀번호 재설정 (미구현)

합성 주소(`@gdc-life.local`)는 실재하지 않으므로 Supabase의 기본 재설정 메일이 도달하지 않는다.
현재는 **비밀번호를 잊으면 스스로 복구할 수 없다.** 선택지는 다음과 같다.

| 방식 | 내용 | 비용 |
|---|---|---|
| 관리자 수동 초기화 | 대시보드에서 비밀번호 재설정 | 0 — 사용자가 적을 때 현실적 |
| 실제 이메일로 재설정 | Edge Function이 ID→실제 이메일을 찾아 재설정 링크 발송 | SMTP 설정 + 함수 1개 |
| 이메일 로그인으로 전환 | 별도 ID를 없애고 사내 이메일로 로그인 | 명세 변경 |

가입 폼에 **비밀번호 확인** 필드를 둔 것도 이 제약 때문이다.

### Kakao 개발자 콘솔

이 앱은 **서로 다른 두 카카오 서비스**를 쓴다. 각각 따로 켜야 한다.

| 용도 | 서비스 | 키 | 상태 |
|---|---|---|---|
| 지도 표시 · 주소/장소 검색 | 카카오맵 (지도/로컬) | JS 키 + REST 키 | **활성화 필요** |
| 경로 계산 (경유지 포함) | 카카오모빌리티 Directions | REST 키 | 동작 확인됨 |

1. https://developers.kakao.com 에서 앱 생성
2. **앱 키** → JavaScript 키 → `VITE_KAKAO_JS_KEY`, REST API 키 → `KAKAO_REST_KEY`
3. **내 애플리케이션 → 제품 설정 → 카카오맵 → 활성화 설정을 ON** 으로 바꾼다.
   끄져 있으면 주소검색과 지도 SDK가 아래 오류로 실패한다:
   `App(...) disabled OPEN_MAP_AND_LOCAL service.`
   (2024-12-01부터 신규 앱은 기본 비활성. 권한이 없으면 앱 권한 신청이 필요할 수 있다.)
4. **플랫폼 → Web → 사이트 도메인** 에 모두 등록 (미등록 시 지도가 뜨지 않음)
   - `http://localhost:5173`
   - `http://<개발 PC의 LAN IP>:5173` (모바일 실기기용)
   - 운영 도메인

---

## 개인정보 설계

이 앱은 동료의 **전화번호와 실시간 위치**를 다루고, 회사가 아닌 개인이 운영한다.
따라서 보호 장치를 코드 관례가 아니라 **스키마와 자동 테스트**로 못 박았다.

| 데이터 | 테이블 | 접근 |
|---|---|---|
| 이름 · 부서 | `profiles` | 로그인한 직원이면 조회 가능 (검색 카드에 필요) |
| ID · 이메일 · 전화 | `profile_private` | **본인만** |
| 전화 (매칭 상대) | `matched_contacts` 뷰 | 신청이 **허락된** 상대만 |
| 알림 | `notifications` | **본인만** — 만드는 건 트리거뿐 |
| 실시간 위치 | **저장하지 않음** | Realtime Broadcast, 아래 조건을 모두 만족할 때만 |

- 프로필은 클라이언트가 만들 수 없다. `auth.users` 트리거로만 생성돼 위조를 막는다.
- `npm run test:rls` 가 위 격리를 매번 검증한다. **스키마를 바꾸면 반드시 다시 돌린다.**
- Geolocation 권한을 거부해도 나머지 기능은 정상 동작한다.

### 실시간 위치 — 채널 접근 통제

위치는 DB에 남지 않고 Broadcast 로만 흐르므로, 방어선은 **"누가 그 채널에 들어올 수 있는가"** 하나다.
채널 이름은 `trip:<offer_id>` 이고, Supabase Realtime 의 private 채널 기능을 써서
`realtime.messages` 의 RLS 로 입장을 통제한다. 다음을 **모두** 만족해야 입장된다.

1. 그 카풀의 봉사자이거나, 신청이 **허락된** 탑승자
2. 카풀이 취소·운행완료 상태가 아님
3. **출발 30분 전 ~ 출발 1시간 후** (KST 기준)

조건이 깨지면 구독 자체가 실패한다 — 클라이언트가 막는 게 아니라 서버가 막는다.
`test:location` 이 대기 중 탑승자·제3자·시간대 밖·매칭 해제 후를 매번 확인한다.

> `realtime.messages` 의 소유자는 `supabase_realtime_admin` 이라 마이그레이션(postgres 역할)에서
> `ENABLE ROW LEVEL SECURITY` 는 실행할 수 없다. 이미 켜져 있으므로 정책만 만들면 된다.

### 별점 — 운행완료 자동 처리

별점은 카풀 1건당 1점이며, 적립 경로는 두 가지 서버 함수뿐이다.
클라이언트에는 `driver_ratings` INSERT/UPDATE 권한이 없어 점수를 조작할 수 없다.

1. 봉사자가 **[운행완료]** 를 누름 — 출발 시각 이후 + 탑승자가 있어야 한다
2. `auto_complete_due_offers()` — 출발 후 4시간이 지난 건을 일괄 처리 (service_role 전용)

2번을 자동화하려면 **운영 프로젝트에서 한 번** 아래를 실행한다 (대시보드 SQL 에디터):

```sql
create extension if not exists pg_cron;
select cron.schedule(
  'gdc-life-auto-complete', '0 * * * *',
  $$ select public.auto_complete_due_offers(); $$
);
```

> 로컬 스택에는 일부러 넣지 않았다. 백그라운드 작업이 테스트 중 카풀을 완료시켜 결과가 흔들린다.

### 알림 — 앱이 만들지 않는다

알림은 프론트가 아니라 **DB 트리거**가 만든다. 신청·카풀의 상태가 바뀌는 순간
`notifications` 에 행이 생기므로, 새 RPC 를 추가해도 알림이 빠지지 않고
스케줄러가 처리한 건(`auto_complete_due_offers`)도 똑같이 알림이 남는다.

| 언제 | 받는 사람 | 눌렀을 때 |
|---|---|---|
| 새 탑승 신청 | 봉사자 | 신청함 |
| 신청 허락 | 탑승자 | 운행 화면 |
| 신청 거절 | 탑승자 | 카풀 찾기 |
| 탑승자가 신청 취소 | 봉사자 | 신청함 |
| 봉사자가 카풀 취소 | 신청한 탑승자 전원 | 카풀 찾기 |
| 운행완료 | 봉사자(별점 적립) · 탑승자 | 내 정보 / 신청함 |

- 클라이언트에는 **INSERT 권한이 없다.** 남에게 알림을 심을 수 없다.
- 본인이 바꿀 수 있는 것은 `read_at`(읽음) 뿐이다. 내용은 본인도 고칠 수 없다(컬럼 단위 GRANT).
- 배지·목록은 Realtime 으로 즉시 갱신되며, **구독에도 RLS 가 적용**되어
  남의 `user_id` 로 필터를 걸어도 아무것도 오지 않는다 (`test:notifications` 가 확인).

#### 한계 — 앱이 닫혀 있으면 오지 않는다

브라우저 푸시(Web Push)는 쓰지 않는다. 푸시 서버와 VAPID 키 관리가 필요해
개인 운영 범위를 벗어나기 때문이다. 대신,

- 앱이 열려 있는 동안에는 브라우저 알림으로 화면 밖에서도 눈에 띈다 (사용자가 허용한 경우)
- 앱을 닫은 사이에 쌓인 알림은 다시 열었을 때 알림함에서 모두 볼 수 있다

#### 정리

알림은 쌓이기만 하므로 60일이 지난 건을 지우는 함수를 두었다 (service_role 전용).
운영 프로젝트에서 한 번 등록하면 된다:

```sql
select cron.schedule(
  'gdc-life-purge-notifications', '30 4 * * *',
  $$ select public.purge_old_notifications(); $$
);
```

### 관리자

가입 계정을 확인하는 최소 기능이다. 화면은 `/admin`, 프로필 하단에 관리자에게만 링크가 보인다.

| 보이는 것 | 보이지 않는 것 |
|---|---|
| ID · 이름 · 부서 · 이메일 · 가입일 | **전화번호 원본** |
| 등록/운행/별점 수, 전체 운영 통계 | 신청 상세, 위치 |

전화번호는 서버에서 `010-****-1234` 로 마스킹해 내보낸다. **관리자에게도 원본은 가지 않는다.**
원본이 필요하다면 `admin_list_accounts` 의 `regexp_replace` 를 `pp.phone` 으로 바꾸면 되지만,
가입 확인 용도에는 필요하지 않다고 보고 마스킹을 기본값으로 두었다.

**권한 부여 경로는 UI 에 없다.** 스스로 관리자가 되는 길을 막기 위해 `admin_users` 테이블에는
클라이언트 권한을 하나도 주지 않았다. 대시보드 SQL 에디터에서 넣는다:

```sql
insert into public.admin_users (user_id, note)
select id, '운영 담당자' from public.profile_private where login_id = '<사번ID>'
on conflict (user_id) do nothing;
```

> `service_role` 도 명시적으로 GRANT 한 테이블에만 접근할 수 있다(`admin_users` 뿐).
> 다른 테이블을 백엔드에서 다뤄야 하면 GRANT 를 추가해야 한다.

### 좌석 동시성

여러 탑승자를 동시에 허락해도 좌석이 초과되지 않아야 한다.
`accept_carpool_request` 는 해당 카풀 행을 `SELECT ... FOR UPDATE` 로 잠근 뒤 좌석을 확인·차감하므로,
뒤따라 들어온 요청은 잠금이 풀린 뒤 **갱신된 좌석 수를 다시 읽는다**.
`test:matching` 이 2석짜리 카풀에 5건을 동시에 허락 시도해 정확히 2건만 성립하는지 매번 확인한다.

### Edge Function 인증 주의

`verify_jwt = true` 는 **"서명이 유효한 토큰"** 만 보장한다.
anon 키도 유효한 JWT 이고 프론트 번들에 그대로 실려 나가므로, 이것만으로는
누구나 함수를 호출해 카카오 쿼터를 소진시킬 수 있다.
따라서 함수 안에서 `supabase.auth.getUser()` 로 **실제 로그인 사용자인지 한 번 더 확인**한다.
새 Edge Function 을 추가할 때도 같은 패턴을 따를 것.

---

## 라우팅

| 경로 | 화면 |
|---|---|
| `/login`, `/signup` | 로그인 · 회원가입 |
| `/home` | GDC Life 홈 대시보드 |
| `/carpool` | 카풀 홈 (출근/퇴근 탭) |
| `/carpool/offer/new` | 봉사자 카풀 등록 |
| `/carpool/search` | 탑승자 검색 · 신청 |
| `/carpool/calendar` | 봉사자 달력 |
| `/carpool/requests` | 신청함 (허락/거절 · 내 신청) |
| `/carpool/trip/:id` | 매칭 상세 (실시간 위치 · 전화) |
| `/carpool/ranking` | 봉사 별점 순위 (이번 달 / 올해 / 누적) |
| `/notifications` | 알림함 (헤더의 종 아이콘) |
| `/profile` | 내 정보 · 별점 |
| `/admin` | 관리자 — 가입 계정 확인 (관리자만) |

하단 탭바: 홈 · 카풀 · 달력 · 내정보

---

## 개발 단계

- [x] **Phase 0** — 스캐폴드: PWA, 반응형 셸, 탭바, 라우팅
- [x] **Phase 0.5** — Supabase 전환: 스키마 · RLS · Edge Function · RLS 테스트
- [x] **Phase 1** — 인증: 회원가입 / ID 로그인 / 프로필 · 라우트 보호
      (비밀번호 재설정은 미구현 — 아래 *한계* 참고)
- [x] **Phase 2** — 봉사자 카풀 등록 (지도 · 주소검색 · 경유지 · 좌석 · 경로 · 반복 · 달력)
      (등록 후 세부 수정은 미지원 — 취소 후 재등록. 좌석 정합성 때문에 Phase 4 이후로 미룸)
- [x] **Phase 3** — 탑승자 검색 · 매칭 추천 · 신청
- [x] **Phase 4** — 신청 허락/거절 · 좌석 차감 · 연락처 개방 · 전화 버튼
- [x] **Phase 5** — 실시간 위치 공유 · 전화
- [x] **Phase 6** — 운행완료 처리 · 별점 (월간/연간/누적)
- [x] **Phase 7** — 알림 · 반응형 QA · 마감
      (앱 내 알림 + 실시간 배지. 앱이 닫혀 있을 때 도착하는 푸시는 미지원 — 위 *한계* 참고)

---

## 화면 기준

모바일 전용이 아니라 **모바일 우선**이다. 화면이 넓어도 480px 폭으로 가운데 정렬해
한 손 조작 폭을 유지한다(`AppShell`).

| 기준 | 값 | 이유 |
|---|---|---|
| 본문 최대 폭 | 480px 중앙 정렬 | PC 에서도 같은 레이아웃으로 검증된다 |
| 터치 타깃 | 최소 44px, 주 버튼 48px | 달리는 차 안에서도 눌리게 |
| 입력 글자 | 16px 고정 | iOS 가 입력 시 화면을 확대하는 것을 막는다 |
| 가로 스크롤 | `overflow-x: hidden` + 주소는 줄바꿈 | 긴 도로명 주소가 레이아웃을 밀지 않게 |
| 노치·홈바 | `safe-top` / `safe-bottom` | 헤더·탭바가 시스템 UI에 가리지 않게 |

실기기 확인 항목은 [DEPLOY.md](DEPLOY.md) 의 배포 후 점검표에 있다.

---

## 테스트 계정 정리 (오픈 전)

개발·테스트 중 만들어진 계정을 지우고 관리자만 남길 때 쓴다.

```bash
npm run purge                              # 미리보기 — 아무것도 지우지 않는다
npm run purge -- --keep=driver1,rider1     # 추가로 남길 계정 (사내 ID)
npm run purge -- --yes                     # 실제 삭제
```

- **관리자(`admin_users`)는 옵션과 무관하게 항상 보존**된다.
- `SUPABASE_SERVICE_ROLE_KEY` 가 필요하다 (클라우드는 Dashboard → Project Settings → API).
- 로컬이 아닌 프로젝트를 대상으로 하면 `DELETE` 를 직접 입력해야 진행된다.

계정을 지우면 **딸린 데이터가 모두 함께 사라진다** (`ON DELETE CASCADE`):

```
auth.users
  └ profiles
      ├ profile_private          (연락처)
      ├ carpool_offers           (등록한 카풀)
      │    ├ carpool_requests    (그 카풀에 들어온 신청)
      │    └ driver_ratings      (그 운행의 별점)
      ├ carpool_requests         (내가 낸 신청)
      └ admin_users              (관리자 권한)
```

> 되돌릴 수 없다. 운영 프로젝트라면 Dashboard → Database → Backups 로 백업을 먼저 확인할 것.

대시보드에서 몇 개만 지울 때는 **Authentication → Users** 에서 직접 삭제해도 결과는 같다.
`auth.users` 를 SQL 로 직접 지우는 방법은 Supabase 가 auth 스키마 쓰기를 제한하고 있어 권장하지 않는다.

## 배포

**단계별 안내는 [DEPLOY.md](DEPLOY.md) 참고.** 아래는 요약이다.

```bash
npm run build                    # frontend/dist
npm run db:push                  # 마이그레이션
npm run fn:deploy                # Edge Function
```

`dist/` 는 정적 호스팅(Vercel / Cloudflare Pages / Netlify)에 올린다.
SPA이므로 **history fallback(`index.html`) 설정이 필요**하다.
빌드 환경에도 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `VITE_KAKAO_JS_KEY` 를 넣는다.

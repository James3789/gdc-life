# GDC Life

HD현대마린솔루션 **글로벌디지털센터(GDC)** 임직원 전용 사내 플랫폼 (모바일 PWA).
첫 기능은 **출퇴근 카풀 매칭**이며, 홈 대시보드에 기능 모듈을 끼워 넣는 구조로 확장한다.

---

## 빠른 시작

```bash
npm run setup   # 최초 1회: .env 생성 + python venv + 패키지 설치
npm run dev     # 백엔드(:5000) + 프론트(:5173) 동시 실행
```

브라우저에서 http://localhost:5173 접속.

> 모바일 실기기 테스트: Vite가 LAN에 바인딩되므로 같은 Wi-Fi에서 `http://<PC의 IP>:5173` 으로 접속한다.
> API는 Vite proxy를 타므로 별도 설정이 필요 없다.

---

## 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind v4 | 모바일 우선 반응형, 빠른 HMR |
| PWA | vite-plugin-pwa (Workbox) | 홈 화면 추가 · 오프라인 셸 |
| Backend | **Flask** | 개발자 친숙도 + 확장 생태계 |
| 실시간 | **flask-socketio** | 위치 공유를 API와 같은 프로세스에서 처리 |
| DB | **SQLAlchemy + SQLite(개발) → PostgreSQL/PostGIS(운영)** | `DATABASE_URL` 만 바꿔 승격 가능 |
| 지도/경로 | Kakao Maps JS SDK + Kakao Mobility Directions | 국내 주소·도로·경유지 지원 |

**경로 매칭 방식**: 후보가 "같은 날짜 + 같은 방향"으로 좁혀져 수십 건 수준이므로,
점–경로 최단거리는 서버에서 haversine 기반으로 계산한다. 규모가 커지면 PostGIS `ST_DWithin` 으로 대체 가능하도록
매칭 로직을 서비스 레이어에 분리해 둔다.

---

## 환경변수

`.env.example` → `.env` 로 복사해서 사용한다. **백엔드·프론트가 같은 파일 하나를 공유**한다
(Vite `envDir: '..'`). 프론트에서 읽는 값만 `VITE_` 접두사를 붙인다.

| 키 | 설명 |
|---|---|
| `JWT_SECRET` | JWT 서명 키 (운영에서 반드시 교체) |
| `DATABASE_URL` | 기본 `sqlite:///gdclife.db` |
| `COMPANY_NAME` / `COMPANY_ADDR` / `COMPANY_LAT` / `COMPANY_LNG` | 회사(GDC) 좌표 — **하드코딩 금지, 여기서만 관리** |
| `MATCH_RADIUS_M` | 탑승 위치가 경로에서 이 거리(m) 이내면 후보 (기본 1000) |
| `MATCH_DEFAULT_TOLERANCE_MIN` | 기본 시간 허용 오차 (기본 10분) |
| `REQUIRE_COMPANY_EMAIL` / `COMPANY_EMAIL_DOMAINS` | 사내 이메일 도메인 검증 (기본 off) |
| `KAKAO_REST_KEY` | 서버에서 길찾기 API 호출 |
| `VITE_KAKAO_JS_KEY` | 브라우저 지도 SDK |

### 회사 좌표 설정

현재 값은 **울산광역시 남구 신두왕로 50** 도로 기준 근사 좌표다.
`KAKAO_REST_KEY` 를 넣은 뒤 아래 명령으로 정확한 건물 좌표를 뽑아 `.env` 에 반영한다.

```bash
backend/.venv/Scripts/python backend/scripts/geocode_company.py   # Windows
backend/.venv/bin/python backend/scripts/geocode_company.py       # macOS/Linux
```

프론트는 좌표를 하드코딩하지 않고 `GET /api/meta/config` 로 받아 쓴다.

### Kakao 개발자 콘솔 설정 (지도 사용 전 필수)

1. https://developers.kakao.com 에서 애플리케이션 생성
2. **앱 키** → JavaScript 키 → `VITE_KAKAO_JS_KEY`, REST API 키 → `KAKAO_REST_KEY`
3. **플랫폼 → Web → 사이트 도메인** 에 아래를 모두 등록 (등록하지 않으면 지도가 뜨지 않음)
   - `http://localhost:5173`
   - `http://<개발 PC의 LAN IP>:5173` (모바일 실기기 테스트용)
   - 운영 도메인
4. Kakao Mobility 길찾기 API는 별도 이용 신청이 필요할 수 있다.

---

## 프로젝트 구조

```
.
├── package.json           # npm run setup / dev (루트 원커맨드)
├── .env.example           # 백엔드·프론트 공용 환경변수
├── tools/
│   ├── setup.mjs          # 최초 설치
│   ├── dev.mjs            # 개발 서버 동시 실행
│   └── gen_icons.py       # PWA 아이콘 생성 (1회성)
├── backend/
│   ├── run.py             # 진입점 (socketio.run)
│   ├── requirements.txt
│   ├── scripts/
│   │   └── geocode_company.py
│   └── app/
│       ├── __init__.py    # 앱 팩토리
│       ├── config.py      # ★ COMPANY_LOCATION 등 모든 설정
│       ├── extensions.py  # db · migrate · socketio
│       ├── models/        # ORM (Phase 1~)
│       └── api/           # 블루프린트
└── frontend/
    ├── vite.config.ts     # envDir='..', /api·/socket.io proxy, PWA
    ├── public/icons/
    └── src/
        ├── App.tsx        # 라우팅
        ├── components/    # AppShell · BottomTabBar · icons
        ├── lib/           # api · appConfig · direction
        ├── modules/       # ★ 기능 모듈 레지스트리 (확장 지점)
        └── pages/
```

**기능 추가 방법**: `frontend/src/modules/registry.tsx` 에 항목을 추가하고 라우트를 등록하면
홈 대시보드에 자동 노출된다.

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
| `/profile` | 내 정보 · 별점 |

하단 탭바: 홈 · 카풀 · 달력 · 내정보

---

## 개발 단계

- [x] **Phase 0** — 스캐폴드: PWA, 반응형 셸, 하단 탭바, 라우팅, 설정 API
- [ ] **Phase 1** — 인증: 회원가입 / 로그인 / JWT / 프로필
- [ ] **Phase 2** — 봉사자 카풀 등록 (지도 · 경유지 · 좌석 · 반복 · 달력)
- [ ] **Phase 3** — 탑승자 검색 · 매칭 추천 · 신청
- [ ] **Phase 4** — 신청 허락/거절 · 좌석 차감
- [ ] **Phase 5** — 실시간 위치 공유 · 전화
- [ ] **Phase 6** — 별점 (월간/연간/누적)
- [ ] **Phase 7** — 알림 · 반응형 QA · 마감

---

## 개인정보 원칙

- 전화번호·실시간 위치는 **매칭이 성립한 상대에게만** 노출한다.
- 위치 공유는 **운행 당일 운행 시간대**로 제한하고, 운행완료·취소 즉시 중단한다.
- Geolocation 권한을 거부해도 나머지 기능은 정상 동작한다.

---

## 프로덕션 빌드

```bash
npm run build     # frontend/dist 생성
```

`dist/` 를 정적 서버(Nginx 등)로 서빙하고 `/api`, `/socket.io` 를 백엔드로 프록시한다.
SPA이므로 **정적 서버에 history fallback(`index.html`) 설정**이 필요하다.
`VITE_API_BASE` 는 프론트와 API 도메인이 다를 때만 채운다.

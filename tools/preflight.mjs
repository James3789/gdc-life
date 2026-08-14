/** 배포 전 점검.
 *
 *   npm run preflight
 *
 * 공개 배포에서 가장 위험한 것은 비밀 키가 정적 번들에 섞여 나가는 것이다.
 * 빌드 결과물을 실제로 뒤져서 확인한다.
 *
 * 검사 항목
 *   1. 필수 환경변수
 *   2. Supabase 연결 · 마이그레이션 적용 여부
 *   3. Edge Function 배포 · 인증 보호 여부
 *   4. 빌드 산출물에 비밀 키가 섞이지 않았는지  ★
 *   5. 정적 호스팅에 필요한 파일 (_redirects 등)
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DIST = join(ROOT, 'frontend', 'dist')

function env(key) {
  try {
    for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
      if (m && m[1] === key) return m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* .env 없음 */
  }
  return process.env[key] ?? ''
}

let pass = 0
let warn = 0
let fail = 0

const ok = (m, d = '') => (pass++, console.log(`  ✓ ${m}${d ? `  ${d}` : ''}`))
const bad = (m, d = '') => (fail++, console.log(`  ✗ ${m}${d ? `  → ${d}` : ''}`))
const caution = (m, d = '') => (warn++, console.log(`  ! ${m}${d ? `  → ${d}` : ''}`))

const URL_ = env('VITE_SUPABASE_URL')
const ANON = env('VITE_SUPABASE_ANON_KEY')
const JS_KEY = env('VITE_KAKAO_JS_KEY')
const REST_KEY = env('KAKAO_REST_KEY')
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')

function isLocal(url) {
  try {
    const h = new URL(url).hostname
    return (
      h === 'localhost' ||
      h === '127.0.0.1' ||
      /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[01])\./.test(h)
    )
  } catch {
    return false
  }
}

// ── 1. 환경변수 ───────────────────────────────────────────────
console.log('\n▶ 환경변수')
URL_ ? ok('VITE_SUPABASE_URL', URL_) : bad('VITE_SUPABASE_URL 없음')
ANON ? ok('VITE_SUPABASE_ANON_KEY', `${ANON.slice(0, 12)}…`) : bad('VITE_SUPABASE_ANON_KEY 없음')
JS_KEY ? ok('VITE_KAKAO_JS_KEY', `${JS_KEY.slice(0, 8)}…`) : bad('VITE_KAKAO_JS_KEY 없음')
REST_KEY ? ok('KAKAO_REST_KEY (Edge Function 시크릿용)') : caution('KAKAO_REST_KEY 없음 — 길찾기 불가')

if (URL_ && isLocal(URL_)) {
  caution('로컬 주소를 가리키고 있습니다', '배포 시 클라우드 프로젝트 URL 로 바꿔야 합니다')
}

// ── 2. Supabase ───────────────────────────────────────────────
console.log('\n▶ Supabase 연결')
if (!URL_ || !ANON) {
  bad('환경변수가 없어 건너뜀')
} else {
  try {
    const res = await fetch(`${URL_}/rest/v1/app_settings?select=company_name,company_lat,company_lng&id=eq.1`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    })
    if (!res.ok) {
      bad(`app_settings 조회 실패 (HTTP ${res.status})`, '마이그레이션이 적용되지 않았을 수 있습니다')
    } else {
      const [row] = await res.json()
      if (!row) bad('app_settings 행이 없습니다')
      else {
        ok('마이그레이션 적용됨', `회사: ${row.company_name}`)
        if (Math.abs(row.company_lat - 35.51809) < 1e-5) {
          caution('회사 좌표가 옛 근사값입니다', '35.50512 / 129.29956 로 교체 필요')
        } else {
          ok('회사 좌표 설정됨', `${row.company_lat}, ${row.company_lng}`)
        }
      }
    }
  } catch (err) {
    bad('Supabase 에 연결하지 못했습니다', err.message)
  }
}

// ── 3. Edge Function ──────────────────────────────────────────
console.log('\n▶ Edge Function (길찾기)')
if (!URL_) {
  bad('환경변수가 없어 건너뜀')
} else {
  try {
    const res = await fetch(`${URL_}/functions/v1/kakao-directions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin: { lat: 35.5, lng: 129.3 }, destination: { lat: 35.51, lng: 129.31 } }),
    })
    if (res.status === 401) ok('배포됨 · 인증 없이는 차단됨')
    else if (res.status === 404) bad('배포되지 않았습니다', 'npm run fn:deploy')
    else if (res.status === 200) bad('인증 없이 호출됩니다 ★', '카카오 쿼터가 무방비 상태입니다')
    else caution(`예상 밖 응답 (HTTP ${res.status})`)
  } catch (err) {
    caution('Edge Function 에 연결하지 못했습니다', err.message)
  }
}

// ── 4. 빌드 산출물 비밀 키 검사 ★ ─────────────────────────────
console.log('\n▶ 빌드')
try {
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
    cwd: ROOT,
    stdio: 'pipe',
    shell: process.platform === 'win32',
  })
  ok('빌드 성공')
} catch (err) {
  bad('빌드 실패', String(err.stdout ?? err.message).slice(-300))
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

console.log('\n▶ 번들에 비밀 키가 섞이지 않았는지  ★')
let files = []
try {
  files = walk(DIST).filter((f) => /\.(js|css|html|json|webmanifest)$/.test(f))
} catch {
  bad('dist 를 읽지 못했습니다')
}

const secrets = [
  ['KAKAO_REST_KEY', REST_KEY],
  ['SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY],
]

for (const [label, value] of secrets) {
  if (!value) {
    caution(`${label} 미설정 — 검사 건너뜀`)
    continue
  }
  const hit = files.find((f) => readFileSync(f, 'utf8').includes(value))
  if (hit) bad(`${label} 가 번들에 노출됨 ★`, relative(ROOT, hit))
  else ok(`${label} 노출 없음`)
}

// service_role 토큰은 payload 에 role 이 박혀 있다
const roleHit = files.find((f) => readFileSync(f, 'utf8').includes('"role":"service_role"'))
roleHit ? bad('service_role 토큰 흔적 발견 ★', relative(ROOT, roleHit)) : ok('service_role 토큰 흔적 없음')

// ── 5. 정적 호스팅 필수 파일 ──────────────────────────────────
console.log('\n▶ 정적 호스팅 준비물')
const need = ['index.html', '_redirects', 'sw.js', 'manifest.webmanifest']
for (const f of need) {
  try {
    statSync(join(DIST, f))
    ok(`dist/${f}`)
  } catch {
    f === '_redirects'
      ? bad('dist/_redirects 없음', '새로고침 시 404 가 납니다')
      : caution(`dist/${f} 없음`)
  }
}

console.log(`
─────────────────────────────
  통과 ${pass} · 주의 ${warn} · 실패 ${fail}
${fail === 0 ? '  배포 가능한 상태입니다.' : '  실패 항목을 먼저 해결하세요.'}
─────────────────────────────
`)

process.exitCode = fail === 0 ? 0 : 1

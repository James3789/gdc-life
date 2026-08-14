/** 카카오 길찾기 Edge Function 검증.
 *
 *   npm run db:start
 *   npm run fn:serve        (다른 터미널)
 *   npm run test:directions
 *
 * 확인 항목:
 *   - 비로그인 호출 차단 (REST 키가 아무에게나 프록시되면 안 됨)
 *   - 경유지 포함 경로 계산
 *   - 잘못된 입력 거부
 *   - 응답에 카카오 원본/키가 새지 않는지
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

function env(key) {
  for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (m && m[1] === key) return m[2].replace(/^["']|["']$/g, '')
  }
  return ''
}

const URL_ = env('VITE_SUPABASE_URL')
const KEY = env('VITE_SUPABASE_ANON_KEY')
const FN_URL = `${URL_}/functions/v1/kakao-directions`

let pass = 0
let fail = 0
function check(name, ok, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    console.log(`  ✗ ${name}${detail ? `  → ${detail}` : ''}`)
  }
}

// 울산 GDC 근처 좌표 (테스트용)
const GDC = { lat: 35.51809, lng: 129.28832 }
const HOME = { lat: 35.5384, lng: 129.3114 }
const VIA = { lat: 35.5312, lng: 129.3005 }

const tag = String(Date.now()).slice(-6)
const loginId = `dir${tag}`
const client = createClient(URL_, KEY, { auth: { persistSession: false } })

console.log('\n▶ 인증 없이 호출  ★ 카카오 쿼터 보호')
{
  const body = JSON.stringify({ origin: HOME, destination: GDC })
  const call = (headers) =>
    fetch(FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body })

  check('헤더 없음 → 401', (await call({})).status === 401)
  check('엉터리 토큰 → 401', (await call({ Authorization: 'Bearer garbage.token.x' })).status === 401)
  // anon 키는 서명이 유효한 JWT 라서 verify_jwt 만으로는 통과한다.
  // 프론트 번들에 노출되는 값이므로 반드시 막혀야 한다.
  check('anon 키만으로는 401', (await call({ apikey: KEY })).status === 401)
  check(
    'anon 키를 Bearer 로 써도 401',
    (await call({ Authorization: `Bearer ${KEY}` })).status === 401,
  )
}

console.log('\n▶ 로그인')
const { data: signUpData, error: signUpError } = await client.auth.signUp({
  email: `${loginId}@gdc-life.local`,
  password: 'gdclife1234',
  options: {
    data: {
      login_id: loginId,
      name: '경로테스터',
      department: '테스트',
      email: `${loginId}@example.com`,
      phone: '010-0000-0000',
    },
  },
})
if (signUpError) {
  console.error(`가입 실패: ${signUpError.message}`)
  process.exit(1)
}
const token = signUpData.session.access_token
check('세션 확보', Boolean(token))

const invoke = (body) =>
  fetch(FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

console.log('\n▶ 경로 계산 (경유지 없음)')
{
  const res = await invoke({ origin: HOME, destination: GDC })
  const data = await res.json()
  check('200 응답', res.status === 200, `HTTP ${res.status} ${JSON.stringify(data).slice(0, 200)}`)
  check('거리·소요시간 반환', data.distanceM > 0 && data.durationS > 0, JSON.stringify(data).slice(0, 120))
  check('폴리라인 좌표 반환', Array.isArray(data.path) && data.path.length > 10, `${data.path?.length}개`)
  check(
    '좌표가 {lat,lng} 형태',
    typeof data.path?.[0]?.lat === 'number' && typeof data.path?.[0]?.lng === 'number',
    JSON.stringify(data.path?.[0]),
  )
  const raw = JSON.stringify(data)
  check('카카오 원본 필드가 새지 않음', !raw.includes('result_code') && !raw.includes('KakaoAK'))
  if (res.status === 200) {
    console.log(`      거리 ${(data.distanceM / 1000).toFixed(1)}km · ${Math.round(data.durationS / 60)}분 · 좌표 ${data.path.length}개`)
  }
}

console.log('\n▶ 경유지 포함')
{
  const direct = await (await invoke({ origin: HOME, destination: GDC })).json()
  const res = await invoke({ origin: HOME, destination: GDC, waypoints: [VIA] })
  const data = await res.json()
  check('경유지 경로 200', res.status === 200, `HTTP ${res.status} ${JSON.stringify(data).slice(0, 200)}`)
  check('경유지를 거쳐 거리가 늘어남', data.distanceM >= direct.distanceM, `${direct.distanceM} → ${data.distanceM}`)
  if (res.status === 200) {
    console.log(`      경유 시 ${(data.distanceM / 1000).toFixed(1)}km (직행 ${(direct.distanceM / 1000).toFixed(1)}km)`)
  }
}

console.log('\n▶ 잘못된 입력')
{
  const bad = await invoke({ origin: { lat: 999, lng: 999 }, destination: GDC })
  check('범위 밖 좌표 400', bad.status === 400, `HTTP ${bad.status}`)

  const missing = await invoke({ origin: HOME })
  check('목적지 누락 400', missing.status === 400, `HTTP ${missing.status}`)

  const tooMany = await invoke({
    origin: HOME,
    destination: GDC,
    waypoints: Array.from({ length: 31 }, () => VIA),
  })
  check('경유지 31개 거부', tooMany.status === 400, `HTTP ${tooMany.status}`)
}

// ── 실제 경로로 카풀 등록까지 (Phase 2 통합) ──────────────────
console.log('\n▶ 실제 경로로 카풀 등록')
{
  const route = await (await invoke({ origin: HOME, destination: GDC, waypoints: [VIA] })).json()

  const { data, error } = await client.rpc('create_carpool_offers', {
    p_direction: 'commute-in',
    p_dates: ['2026-10-05'],
    p_depart_time: '07:20',
    p_origin: { ...HOME, addr: '울산 남구 삼산동' },
    p_dest: { ...GDC, addr: '울산광역시 남구 신두왕로 50' },
    p_waypoints: [{ ...VIA, addr: '울산 남구 달동' }],
    p_route: route.path,
    p_route_distance_m: route.distanceM,
    p_route_duration_s: route.durationS,
    p_seats_total: 3,
  })

  check('길찾기 결과로 등록 성공', !error && data?.length === 1, error?.message)
  const offer = data?.[0]
  check('경로 LineString 저장', Boolean(offer?.route), 'route 가 null')
  check('거리·시간이 그대로 저장', offer?.route_distance_m === route.distanceM)
  // WKB 는 점당 16바이트(32 hex) — 좌표 수에 비례해야 한다
  const hexLen = String(offer?.route ?? '').length
  check(
    `좌표 ${route.path.length}개가 모두 저장됨`,
    hexLen >= route.path.length * 32,
    `WKB ${hexLen}자`,
  )
}

console.log(`\n${fail === 0 ? '✅' : '❌'}  통과 ${pass} / 실패 ${fail}\n`)
process.exit(fail === 0 ? 0 : 1)

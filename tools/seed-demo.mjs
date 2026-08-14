/** 로컬 테스트용 데모 계정 생성.
 *
 *   npm run seed
 *
 * db:reset 하면 계정이 모두 사라지므로 다시 실행하면 된다.
 * 이미 있는 계정은 건너뛴다. 운영 환경에서는 절대 실행하지 말 것.
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

if (!URL_ || !KEY) {
  console.error('.env 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 필요합니다.')
  process.exit(1)
}

if (!URL_.includes('127.0.0.1') && !URL_.includes('localhost')) {
  console.error(`\n⚠ 로컬 스택이 아닙니다 (${URL_}). 데모 계정 생성을 중단합니다.\n`)
  process.exit(1)
}

const PASSWORD = 'gdclife1234'

const ACCOUNTS = [
  { loginId: 'driver1', name: '김봉사', department: '스마트십솔루션팀', phone: '010-1111-1111' },
  { loginId: 'driver2', name: '박운전', department: '디지털솔루션팀', phone: '010-2222-2222' },
  { loginId: 'rider1', name: '이탑승', department: '기술연구소', phone: '010-3333-3333' },
  { loginId: 'rider2', name: '최동승', department: '경영지원팀', phone: '010-4444-4444' },
]

const supabase = createClient(URL_, KEY, { auth: { persistSession: false } })

// ── 계정 ──────────────────────────────────────────────────────
console.log('\n▶ 계정')
for (const acc of ACCOUNTS) {
  const { data: available } = await supabase.rpc('is_login_id_available', {
    p_login_id: acc.loginId,
  })

  if (available === false) {
    console.log(`  · ${acc.loginId.padEnd(8)} 이미 존재 — 건너뜀`)
    continue
  }

  const { error } = await supabase.auth.signUp({
    email: `${acc.loginId}@gdc-life.local`,
    password: PASSWORD,
    options: {
      data: {
        login_id: acc.loginId,
        name: acc.name,
        department: acc.department,
        email: `${acc.loginId}@example.com`,
        phone: acc.phone,
      },
    },
  })

  if (error) console.log(`  ✗ ${acc.loginId.padEnd(8)} 실패: ${error.message}`)
  else console.log(`  ✓ ${acc.loginId.padEnd(8)} ${acc.name} / ${acc.department}`)
}

// ── 샘플 카풀 ─────────────────────────────────────────────────
const GDC = { lat: 35.50512, lng: 129.29956, addr: '울산광역시 남구 신두왕로 50' }
const SAMSAN = { lat: 35.5384, lng: 129.3114, addr: '울산 남구 삼산동' }
const TAEHWA = { lat: 35.558, lng: 129.302, addr: '울산 중구 태화동' }

/** 다음 평일 5일 */
function nextWeekdays(count) {
  const dates = []
  const cursor = new Date()
  while (dates.length < count) {
    cursor.setDate(cursor.getDate() + 1)
    const day = cursor.getDay()
    if (day !== 0 && day !== 6) {
      const y = cursor.getFullYear()
      const m = String(cursor.getMonth() + 1).padStart(2, '0')
      const d = String(cursor.getDate()).padStart(2, '0')
      dates.push(`${y}-${m}-${d}`)
    }
  }
  return dates
}

/** 길찾기가 안 되면 직선 보간으로 대체한다 */
function straightLine(from, to, n = 40) {
  return Array.from({ length: n + 1 }, (_, i) => ({
    lat: from.lat + ((to.lat - from.lat) * i) / n,
    lng: from.lng + ((to.lng - from.lng) * i) / n,
  }))
}

async function routeBetween(session, from, to) {
  try {
    const res = await fetch(`${URL_}/functions/v1/kakao-directions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ origin: from, destination: to, waypoints: [] }),
    })
    if (!res.ok) throw new Error(String(res.status))
    const data = await res.json()
    if (!Array.isArray(data.path) || data.path.length < 2) throw new Error('empty')
    return { path: data.path, distanceM: data.distanceM, durationS: data.durationS, real: true }
  } catch {
    return { path: straightLine(from, to), distanceM: null, durationS: 900, real: false }
  }
}

async function signIn(loginId) {
  const c = createClient(URL_, KEY, { auth: { persistSession: false } })
  const { data, error } = await c.auth.signInWithPassword({
    email: `${loginId}@gdc-life.local`,
    password: PASSWORD,
  })
  if (error) throw new Error(`${loginId} 로그인 실패: ${error.message}`)
  return { client: c, session: data.session }
}

console.log('\n▶ 샘플 카풀')
const dates = nextWeekdays(5)

const PLANS = [
  { loginId: 'driver1', direction: 'commute-in', time: '07:30', from: SAMSAN, to: GDC, seats: 3 },
  { loginId: 'driver1', direction: 'commute-out', time: '18:00', from: GDC, to: SAMSAN, seats: 3 },
  { loginId: 'driver2', direction: 'commute-in', time: '07:45', from: TAEHWA, to: GDC, seats: 2 },
]

for (const plan of PLANS) {
  const { client, session } = await signIn(plan.loginId)

  // 남의 카풀도 조회되므로 반드시 본인 것으로 좁혀야 한다
  const { data: existing } = await client
    .from('carpool_offers')
    .select('id')
    .eq('driver_id', session.user.id)
    .eq('direction', plan.direction)
    .eq('ride_date', dates[0])
    .limit(1)

  if (existing?.length) {
    console.log(`  · ${plan.loginId} ${plan.direction} — 이미 있음, 건너뜀`)
    continue
  }

  const route = await routeBetween(session, plan.from, plan.to)
  const { data, error } = await client.rpc('create_carpool_offers', {
    p_direction: plan.direction,
    p_dates: dates,
    p_depart_time: plan.time,
    p_origin: plan.from,
    p_dest: plan.to,
    p_route: route.path,
    p_route_distance_m: route.distanceM ?? undefined,
    p_route_duration_s: route.durationS ?? undefined,
    p_seats_total: plan.seats,
  })

  if (error) console.log(`  ✗ ${plan.loginId} ${plan.direction} 실패: ${error.message}`)
  else
    console.log(
      `  ✓ ${plan.loginId} ${plan.direction} ${plan.time} ${plan.from.addr} → ${plan.to.addr}` +
        ` (${data.length}일, ${route.real ? '실제 경로' : '직선 경로 — fn:serve 미실행'})`,
    )
}

// ── 샘플 신청 ─────────────────────────────────────────────────
// driver1 로 로그인하면 신청함에 대기 건이 보이도록 미리 하나 넣어 둔다.
console.log('\n▶ 샘플 신청')
{
  const { client: riderClient } = await signIn('rider1')
  const { data: target } = await riderClient
    .from('carpool_offers')
    .select('id, depart_time, origin_addr')
    .eq('direction', 'commute-in')
    .eq('ride_date', dates[0])
    .eq('status', 'open')
    .order('depart_time')
    .limit(1)

  if (!target?.length) {
    console.log('  · 신청할 카풀이 없습니다 — 건너뜀')
  } else {
    // 삼산동↔GDC 경로 중간 부근
    const board = { lat: 35.5223, lng: 129.3055, addr: '울산 남구 달동' }
    const { error } = await riderClient.rpc('request_carpool', {
      p_offer_id: target[0].id,
      p_lat: board.lat,
      p_lng: board.lng,
      p_addr: board.addr,
      p_desired_time: '07:35',
      p_tolerance: 10,
    })
    if (error) console.log(`  · 신청 건너뜀: ${error.message}`)
    else console.log(`  ✓ rider1 → ${dates[0]} ${target[0].depart_time.slice(0, 5)} 카풀에 신청 (대기중)`)
  }
}

// ── 완료된 운행 (별점 적립) ───────────────────────────────────
// driver1 프로필에 별점이 보이도록 지난 운행을 하나 만들어 완료 처리한다.
console.log('\n▶ 완료된 운행 (별점)')
{
  const { client: driverClient, session: driverSession } = await signIn('driver1')
  const { client: riderClient } = await signIn('rider2')

  const yesterday = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  const { data: already } = await driverClient
    .from('carpool_offers')
    .select('id')
    .eq('driver_id', driverSession.user.id)
    .eq('ride_date', yesterday)
    .limit(1)

  if (already?.length) {
    console.log('  · 이미 있음, 건너뜀')
  } else {
    const route = await routeBetween(driverSession, SAMSAN, GDC)
    const { data: offers, error } = await driverClient.rpc('create_carpool_offers', {
      p_direction: 'commute-in',
      p_dates: [yesterday],
      p_depart_time: '07:30',
      p_origin: SAMSAN,
      p_dest: GDC,
      p_route: route.path,
      p_route_distance_m: route.distanceM ?? undefined,
      p_route_duration_s: route.durationS ?? undefined,
      p_seats_total: 3,
    })

    if (error) {
      console.log(`  ✗ 등록 실패: ${error.message}`)
    } else {
      const { data: req } = await riderClient.rpc('request_carpool', {
        p_offer_id: offers[0].id,
        p_lat: 35.5223,
        p_lng: 129.3055,
        p_addr: '울산 남구 달동',
        p_desired_time: '07:35',
        p_tolerance: 30,
      })
      await driverClient.rpc('accept_carpool_request', { p_request_id: req.id })
      const { error: done } = await driverClient.rpc('complete_carpool_offer', {
        p_offer_id: offers[0].id,
      })
      if (done) console.log(`  ✗ 완료 처리 실패: ${done.message}`)
      else console.log(`  ✓ ${yesterday} 운행완료 → driver1 별점 +1`)
    }
  }
}

console.log(`
──────────────────────────────
  비밀번호는 모두  ${PASSWORD}
  샘플 카풀 기간   ${dates[0]} ~ ${dates[dates.length - 1]}

  driver1 로 로그인 → 신청함에 대기 건 1개
                    → 내 정보에 별점 1점
──────────────────────────────
`)

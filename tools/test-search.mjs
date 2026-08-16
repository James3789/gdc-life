/** 매칭 검색 · 신청 검증 (Phase 3).
 *
 *   npm run db:start && npm run test:search
 *
 * 길찾기 API 없이 돌도록 경로는 직선 보간으로 만든다.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

/** 환경변수가 있으면 그쪽이 우선 — .env 가 클라우드를 가리킬 때
 *  로컬 스택으로 돌리기 위한 탈출구다. */
function env(key) {
  if (process.env[key]) return process.env[key]
  for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (m && m[1] === key) return m[2].replace(/^["']|["']$/g, '')
  }
  return ''
}

const URL_ = env('VITE_SUPABASE_URL')
const KEY = env('VITE_SUPABASE_ANON_KEY')
const client = () => createClient(URL_, KEY, { auth: { persistSession: false } })

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

const tag = String(Date.now()).slice(-6)

async function signUp(n, name) {
  const loginId = `sch${tag}${n}`
  const c = client()
  const { data, error } = await c.auth.signUp({
    email: `${loginId}@gdc-life.local`,
    password: 'gdclife1234',
    options: {
      data: {
        login_id: loginId,
        name,
        department: '테스트팀',
        email: `${loginId}@example.com`,
        phone: `010-5555-000${n}`,
      },
    },
  })
  if (error) throw new Error(`가입 실패: ${error.message}`)
  return { client: c, id: data.user.id, name }
}

// ── 좌표 ──────────────────────────────────────────────────────
const GDC = { lat: 35.50512, lng: 129.29956, addr: 'HD현대마린솔루션 글로벌디지털센터' }
const HOME = { lat: 35.5384, lng: 129.3114, addr: '울산 남구 삼산동' }
/** HOME→GDC 직선의 중간 지점 */
const MID = { lat: (GDC.lat + HOME.lat) / 2, lng: (GDC.lng + HOME.lng) / 2, addr: '중간 지점' }
const FAR = { lat: 35.62, lng: 129.42, addr: '멀리 떨어진 곳' }

/** 두 점 사이를 n등분한 경로 */
function line(from, to, n = 50, offsetLat = 0) {
  return Array.from({ length: n + 1 }, (_, i) => ({
    lat: from.lat + ((to.lat - from.lat) * i) / n + offsetLat,
    lng: from.lng + ((to.lng - from.lng) * i) / n,
  }))
}

/** 실행마다 다른 날짜를 써서 이전 실행이 남긴 데이터와 섞이지 않게 한다 */
function isolatedDate(offsetDays) {
  const d = new Date(2027, 0, 1)
  d.setDate(d.getDate() + (Number(tag) % 900) + offsetDays)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

const DATE = isolatedDate(0)
const OTHER_DATE = isolatedDate(1)
const DURATION = 600 // 10분

console.log('\n▶ 준비')
const driver = await signUp(1, '김봉사')
const driver2 = await signUp(2, '박운전')
const rider = await signUp(3, '이탑승')
const other = await signUp(4, '무관한사람')
check('계정 4개 생성', Boolean(driver.id && driver2.id && rider.id && other.id))

// 봉사자1: HOME → GDC 직행, 07:30 출발
const { data: offers1, error: e1 } = await driver.client.rpc('create_carpool_offers', {
  p_direction: 'commute-in',
  p_dates: [DATE],
  p_depart_time: '07:30',
  p_origin: HOME,
  p_dest: GDC,
  p_route: line(HOME, GDC),
  p_route_distance_m: 3900,
  p_route_duration_s: DURATION,
  p_seats_total: 3,
})
check('봉사자1 출근 카풀 등록', !e1 && offers1?.length === 1, e1?.message)
const offer1 = offers1?.[0]

// 봉사자2: 같은 방향이지만 경로가 남쪽으로 약 780m 치우침
const { data: offers2 } = await driver2.client.rpc('create_carpool_offers', {
  p_direction: 'commute-in',
  p_dates: [DATE],
  p_depart_time: '07:30',
  p_origin: { ...HOME, lat: HOME.lat - 0.007, addr: '조금 떨어진 출발지' },
  p_dest: GDC,
  p_route: line({ ...HOME, lat: HOME.lat - 0.007 }, GDC),
  p_route_distance_m: 4000,
  p_route_duration_s: DURATION,
  p_seats_total: 2,
})
const offer2 = offers2?.[0]
check('봉사자2 카풀 등록 (경로 약 780m 이격)', Boolean(offer2))

// ── 검색 ──────────────────────────────────────────────────────
const search = (c, params) =>
  c.rpc('search_carpool_offers', {
    p_direction: 'commute-in',
    p_date: DATE,
    p_lat: MID.lat,
    p_lng: MID.lng,
    p_desired_time: '07:35',
    p_tolerance_min: 10,
    ...params,
  })

console.log('\n▶ 경로 반경 매칭')
{
  const { data, error } = await search(rider.client, {})
  check('검색 성공', !error, error?.message)
  check('경로 위 탑승 위치가 매칭됨', data?.some((r) => r.offer_id === offer1.id), `${data?.length}건`)

  const top = data?.find((r) => r.offer_id === offer1.id)
  check('경로까지 거리가 거의 0', top?.detour_m < 50, `${top?.detour_m}m`)
  check('봉사자 이름·부서 노출', top?.driver_name === '김봉사' && Boolean(top?.driver_department))
  check('별점 누적 0으로 시작', top?.driver_points === 0, String(top?.driver_points))
  check('남은 좌석 노출', top?.seats_available === 3)
  check('지도 미리보기용 경로 포함', Array.isArray(top?.route_path) && top.route_path.length >= 2, `${top?.route_path?.length}점`)

  const far = await search(rider.client, { p_lat: FAR.lat, p_lng: FAR.lng })
  check('반경 밖 탑승 위치는 매칭 안 됨', far.data?.length === 0, `${far.data?.length}건`)
}

console.log('\n▶ 예상 픽업 시각  ★ 명세 5.9')
{
  const { data } = await search(rider.client, {})
  const top = data?.find((r) => r.offer_id === offer1.id)
  // 경로 중간(50%)에서 태우므로 07:30 + 5분 = 07:35 부근이어야 한다
  check(
    '경로 중간 지점의 예상 픽업 시각이 07:35 부근',
    top?.est_time >= '07:34:00' && top?.est_time <= '07:36:00',
    top?.est_time,
  )
  check('희망 시간과의 차이가 0분', top?.time_diff_min === 0, `${top?.time_diff_min}분`)

  // 출발 시각(07:30)이 아니라 픽업 시각을 기준으로 비교하는지 확인
  const early = await search(rider.client, { p_desired_time: '07:22' })
  check(
    '07:22 희망은 제외 (출발 시각이 아니라 픽업 시각 기준)',
    !early.data?.some((r) => r.offer_id === offer1.id),
    `${early.data?.length}건`,
  )
}

console.log('\n▶ 시간 허용 범위')
{
  const off = await search(rider.client, { p_desired_time: '07:50' })
  check('±10분 밖은 제외', !off.data?.some((r) => r.offer_id === offer1.id))

  const wide = await search(rider.client, { p_desired_time: '07:50', p_tolerance_min: 30 })
  check('±30분으로 넓히면 포함', wide.data?.some((r) => r.offer_id === offer1.id))
}

console.log('\n▶ 정렬 · 제외 규칙')
{
  const { data } = await search(rider.client, { p_tolerance_min: 30 })
  const ids = data?.map((r) => r.offer_id) ?? []
  check('두 건 모두 후보', ids.includes(offer1.id) && ids.includes(offer2.id), JSON.stringify(ids))

  const ordered = ids.filter((id) => id === offer1.id || id === offer2.id)
  check('가까운 경로가 먼저 나온다', ordered[0] === offer1.id, JSON.stringify(ordered))

  const mine = await search(driver.client, { p_tolerance_min: 30 })
  check(
    '본인이 등록한 카풀은 검색 결과에서 제외',
    !mine.data?.some((r) => r.offer_id === offer1.id),
  )

  const wrongDay = await search(rider.client, { p_date: OTHER_DATE })
  check('다른 날짜는 제외', wrongDay.data?.length === 0, `${wrongDay.data?.length}건`)

  const wrongDirection = await search(rider.client, { p_direction: 'commute-out' })
  check('다른 방향은 제외', wrongDirection.data?.length === 0)
}

console.log('\n▶ 퇴근 방향')
{
  const { data: outOffers } = await driver.client.rpc('create_carpool_offers', {
    p_direction: 'commute-out',
    p_dates: [DATE],
    p_depart_time: '18:00',
    p_origin: GDC,
    p_dest: HOME,
    p_route: line(GDC, HOME),
    p_route_distance_m: 3900,
    p_route_duration_s: DURATION,
    p_seats_total: 3,
  })
  check('퇴근 카풀 등록', outOffers?.length === 1)

  const { data } = await rider.client.rpc('search_carpool_offers', {
    p_direction: 'commute-out',
    p_date: DATE,
    p_lat: MID.lat,
    p_lng: MID.lng,
    p_desired_time: '18:00',
    p_tolerance_min: 10,
  })
  const found = data?.find((r) => r.offer_id === outOffers[0].id)
  check('퇴근도 경로 반경으로 매칭', Boolean(found))
  check('퇴근 기준 시각은 회사 출발 시각 그대로', found?.est_time?.startsWith('18:00'), found?.est_time)
}

// ── 신청 ──────────────────────────────────────────────────────
console.log('\n▶ 신청')
let request
{
  const { data, error } = await rider.client.rpc('request_carpool', {
    p_offer_id: offer1.id,
    p_lat: MID.lat,
    p_lng: MID.lng,
    p_addr: MID.addr,
    p_desired_time: '07:35',
    p_tolerance: 10,
  })
  check('신청 성공', !error && Boolean(data?.id), error?.message)
  request = data
  check('상태 pending', request?.status === 'pending', request?.status)

  const dup = await rider.client.rpc('request_carpool', {
    p_offer_id: offer1.id,
    p_lat: MID.lat, p_lng: MID.lng, p_addr: MID.addr,
    p_desired_time: '07:35', p_tolerance: 10,
  })
  check('중복 신청 거부', Boolean(dup.error), '신청됨')

  const own = await driver.client.rpc('request_carpool', {
    p_offer_id: offer1.id,
    p_lat: MID.lat, p_lng: MID.lng, p_addr: MID.addr,
    p_desired_time: '07:35', p_tolerance: 10,
  })
  check('본인 카풀 신청 거부', Boolean(own.error), '신청됨')

  const { data: after } = await search(rider.client, {})
  const top = after?.find((r) => r.offer_id === offer1.id)
  check('검색 결과에 신청함 표시', top?.already_requested === true)

  const { data: notMine } = await search(other.client, {})
  check('다른 사람에게는 신청 표시 안 됨', notMine?.find((r) => r.offer_id === offer1.id)?.already_requested === false)
}

console.log('\n▶ 신청 조회 권한  ★ 핵심')
{
  const { data: asDriver } = await driver.client
    .from('carpool_requests')
    .select('id, status, board_addr')
    .eq('offer_id', offer1.id)
  check('봉사자는 자기 카풀에 온 신청을 본다', asDriver?.length === 1, `${asDriver?.length}건`)

  const { data: asRider } = await rider.client.from('carpool_requests').select('id')
  check('탑승자는 자기 신청을 본다', asRider?.length === 1)

  const { data: asOther } = await other.client.from('carpool_requests').select('id')
  check('무관한 사람은 아무 신청도 못 본다', (asOther?.length ?? 0) === 0, `${asOther?.length}건 노출`)

  const { error: insert } = await other.client.from('carpool_requests').insert({
    offer_id: offer1.id,
    passenger_id: other.id,
    board_lat: MID.lat, board_lng: MID.lng, board_addr: MID.addr,
    desired_time: '07:35',
  })
  check('직접 INSERT 불가 (RPC 우회 차단)', Boolean(insert), '삽입됨')
}

console.log('\n▶ 신청 취소')
{
  const { error: byOther } = await other.client.rpc('cancel_carpool_request', {
    p_request_id: request.id,
  })
  check('남의 신청은 취소 불가', Boolean(byOther))

  const { data: cancelled, error } = await rider.client.rpc('cancel_carpool_request', {
    p_request_id: request.id,
  })
  check('본인 신청 취소', !error && cancelled?.status === 'cancelled', error?.message)

  const { data: offerAfter } = await driver.client
    .from('carpool_offers')
    .select('seats_available')
    .eq('id', offer1.id)
    .single()
  check(
    '허락 전 취소는 좌석을 되돌리지 않는다',
    offerAfter?.seats_available === 3,
    `${offerAfter?.seats_available}석`,
  )

  const { error: again } = await rider.client.rpc('request_carpool', {
    p_offer_id: offer1.id,
    p_lat: MID.lat, p_lng: MID.lng, p_addr: MID.addr,
    p_desired_time: '07:35', p_tolerance: 10,
  })
  check('취소 후 재신청 가능', !again, again?.message)
}

console.log(`\n${fail === 0 ? '✅' : '❌'}  통과 ${pass} / 실패 ${fail}\n`)
process.exit(fail === 0 ? 0 : 1)

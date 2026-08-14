/** 운행완료 · 별점 적립 검증 (Phase 6).
 *
 *   npm run db:start && npm run test:ratings
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
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')

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
  const loginId = `rat${tag}${n}`
  const c = createClient(URL_, KEY, { auth: { persistSession: false } })
  const { data, error } = await c.auth.signUp({
    email: `${loginId}@gdc-life.local`,
    password: 'gdclife1234',
    options: {
      data: {
        login_id: loginId,
        name,
        department: '테스트팀',
        email: `${loginId}@example.com`,
        phone: `010-4444-00${String(n).padStart(2, '0')}`,
      },
    },
  })
  if (error) throw new Error(`가입 실패: ${error.message}`)
  return { client: c, id: data.user.id, name }
}

const GDC = { lat: 35.50512, lng: 129.29956, addr: 'GDC' }
const HOME = { lat: 35.5384, lng: 129.3114, addr: '삼산동' }
const MID = { lat: 35.5223, lng: 129.3055, addr: '중간' }
const line = (a, b, n = 20) =>
  Array.from({ length: n + 1 }, (_, i) => ({
    lat: a.lat + ((b.lat - a.lat) * i) / n,
    lng: a.lng + ((b.lng - a.lng) * i) / n,
  }))

const kstNow = new Date(Date.now() + 9 * 3600 * 1000)
const shiftDays = (days) => {
  const d = new Date(kstNow.getTime() + days * 24 * 3600 * 1000)
  return d.toISOString().slice(0, 10)
}
const YESTERDAY = shiftDays(-1)
const LONG_AGO = shiftDays(-3)
const NEXT_WEEK = shiftDays(7)

console.log('\n▶ 준비')
const driver = await signUp(1, '김봉사')
const rider = await signUp(2, '이탑승')
const other = await signUp(3, '무관한사람')
check('계정 3개 생성', Boolean(driver.id && rider.id && other.id))

async function makeOffer(date, seats = 3) {
  const { data, error } = await driver.client.rpc('create_carpool_offers', {
    p_direction: 'commute-in',
    p_dates: [date],
    p_depart_time: '07:30',
    p_origin: HOME,
    p_dest: GDC,
    p_route: line(HOME, GDC),
    p_route_duration_s: 600,
    p_seats_total: seats,
  })
  if (error) throw new Error(`등록 실패: ${error.message}`)
  return data[0]
}

/** 신청 → 허락까지 */
async function board(offerId, who = rider) {
  const { data, error } = await who.client.rpc('request_carpool', {
    p_offer_id: offerId,
    p_lat: MID.lat, p_lng: MID.lng, p_addr: MID.addr,
    p_desired_time: '07:35', p_tolerance: 30,
  })
  if (error) throw new Error(`신청 실패: ${error.message}`)
  const { error: e2 } = await driver.client.rpc('accept_carpool_request', {
    p_request_id: data.id,
  })
  if (e2) throw new Error(`허락 실패: ${e2.message}`)
  return data
}

// ── 운행완료 ──────────────────────────────────────────────────
console.log('\n▶ 운행완료 처리')
const past = await makeOffer(YESTERDAY)
const pastReq = await board(past.id)
{
  const { error: byOther } = await other.client.rpc('complete_carpool_offer', {
    p_offer_id: past.id,
  })
  check('제3자는 완료 처리 불가', Boolean(byOther))

  const { error: byRider } = await rider.client.rpc('complete_carpool_offer', {
    p_offer_id: past.id,
  })
  check('탑승자도 완료 처리 불가', Boolean(byRider))

  const { data, error } = await driver.client.rpc('complete_carpool_offer', {
    p_offer_id: past.id,
  })
  check('봉사자가 운행완료 처리', !error && data?.status === 'done', error?.message)

  const { data: req } = await driver.client
    .from('carpool_requests')
    .select('status')
    .eq('id', pastReq.id)
    .single()
  check('탑승 신청도 완료 상태로 변경', req?.status === 'done', req?.status)

  const { error: twice } = await driver.client.rpc('complete_carpool_offer', {
    p_offer_id: past.id,
  })
  check('두 번 완료 처리 불가', Boolean(twice))
}

// ── 완료 조건 ─────────────────────────────────────────────────
console.log('\n▶ 완료 조건')
{
  const future = await makeOffer(NEXT_WEEK)
  await board(future.id)
  const { error } = await driver.client.rpc('complete_carpool_offer', { p_offer_id: future.id })
  check('출발 전에는 완료 불가', Boolean(error), '완료됨')

  const empty = await makeOffer(YESTERDAY)
  const { error: noRider } = await driver.client.rpc('complete_carpool_offer', {
    p_offer_id: empty.id,
  })
  check('탑승자 없으면 완료 불가 (봉사 실적 아님)', Boolean(noRider), '완료됨')

  const cancelled = await makeOffer(YESTERDAY)
  await board(cancelled.id)
  await driver.client.rpc('cancel_carpool_offers', { p_offer_id: cancelled.id })
  const { error: cancelledErr } = await driver.client.rpc('complete_carpool_offer', {
    p_offer_id: cancelled.id,
  })
  check('취소된 카풀은 완료 불가', Boolean(cancelledErr), '완료됨')
}

// ── 별점 적립 ─────────────────────────────────────────────────
console.log('\n▶ 별점 적립')
{
  const { data: rows } = await driver.client
    .from('driver_ratings')
    .select('offer_id, points')
    .eq('driver_id', driver.id)
  check('운행 1건당 1점 적립', rows?.length === 1 && rows[0].points === 1, JSON.stringify(rows))
  check('적립된 건이 완료한 그 카풀', rows?.[0]?.offer_id === past.id)

  const { data: summary, error } = await driver.client.rpc('my_rating_summary')
  const s = summary?.[0]
  check('집계 RPC 동작', !error && Boolean(s), error?.message)
  check('누적 1점', Number(s?.total) === 1, JSON.stringify(s))
  check('월간·연간에도 반영', Number(s?.monthly) === 1 && Number(s?.yearly) === 1, JSON.stringify(s))

  const { data: mine } = await rider.client.rpc('my_rating_summary')
  check('탑승자는 0점', Number(mine?.[0]?.total) === 0, JSON.stringify(mine?.[0]))
}

// ── 점수 조작 방지 ★ ──────────────────────────────────────────
console.log('\n▶ 점수 조작 방지  ★')
{
  const { error: insert } = await driver.client
    .from('driver_ratings')
    .insert({ driver_id: driver.id, offer_id: past.id, points: 100 })
  check('클라이언트가 별점을 직접 넣을 수 없다', Boolean(insert), '삽입됨')

  const { error: update } = await driver.client
    .from('driver_ratings')
    .update({ points: 99 })
    .eq('driver_id', driver.id)
  check('별점 수정 불가', Boolean(update), '수정됨')

  const { error: auto } = await driver.client.rpc('auto_complete_due_offers')
  check('일괄 완료 함수는 일반 사용자가 호출 불가', Boolean(auto), '호출됨')
}

// ── 검색 카드에 노출 ──────────────────────────────────────────
console.log('\n▶ 검색 결과에 누적 점수 노출')
{
  const upcoming = await makeOffer(NEXT_WEEK)
  const { data } = await other.client.rpc('search_carpool_offers', {
    p_direction: 'commute-in',
    p_date: NEXT_WEEK,
    p_lat: MID.lat,
    p_lng: MID.lng,
    p_desired_time: '07:35',
    p_tolerance_min: 30,
  })
  const found = data?.find((r) => r.offer_id === upcoming.id)
  check('추천 카드에 봉사자 누적 점수 표시', Number(found?.driver_points) === 1, JSON.stringify(found?.driver_points))
}

// ── 자동 완료 ─────────────────────────────────────────────────
console.log('\n▶ 시간 경과 건 자동 완료')
if (!SERVICE_KEY) {
  console.log('  · SUPABASE_SERVICE_ROLE_KEY 없음 — 건너뜀')
} else {
  const overdue = await makeOffer(LONG_AGO)
  await board(overdue.id)

  const admin = createClient(URL_, SERVICE_KEY, { auth: { persistSession: false } })
  const { data: count, error } = await admin.rpc('auto_complete_due_offers')
  check('스케줄러 권한으로 일괄 완료 실행', !error, error?.message)
  check('완료된 건이 1건 이상', Number(count) >= 1, String(count))

  const { data: offer } = await driver.client
    .from('carpool_offers')
    .select('status')
    .eq('id', overdue.id)
    .single()
  check('시간 지난 카풀이 운행완료로 변경', offer?.status === 'done', offer?.status)

  const { data: summary } = await driver.client.rpc('my_rating_summary')
  check('자동 완료분도 별점 적립', Number(summary?.[0]?.total) === 2, JSON.stringify(summary?.[0]))

  // 다시 돌려도 중복 적립되지 않아야 한다
  await admin.rpc('auto_complete_due_offers')
  const { data: again } = await driver.client.rpc('my_rating_summary')
  check('재실행해도 중복 적립 없음', Number(again?.[0]?.total) === 2, JSON.stringify(again?.[0]))
}

console.log(`\n${fail === 0 ? '✅' : '❌'}  통과 ${pass} / 실패 ${fail}\n`)
process.exit(fail === 0 ? 0 : 1)

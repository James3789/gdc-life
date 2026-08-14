/** 매칭 성립 검증 (Phase 4) — 좌석 동시성과 연락처 노출이 핵심.
 *
 *   npm run db:start && npm run test:matching
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
  const loginId = `mat${tag}${n}`
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
        phone: `010-7777-00${String(n).padStart(2, '0')}`,
      },
    },
  })
  if (error) throw new Error(`가입 실패: ${error.message}`)
  return { client: c, id: data.user.id, name, phone: `010-7777-00${String(n).padStart(2, '0')}` }
}

const GDC = { lat: 35.50512, lng: 129.29956, addr: 'GDC' }
const HOME = { lat: 35.5384, lng: 129.3114, addr: '삼산동' }
const MID = { lat: (GDC.lat + HOME.lat) / 2, lng: (GDC.lng + HOME.lng) / 2, addr: '중간 지점' }

function line(from, to, n = 40) {
  return Array.from({ length: n + 1 }, (_, i) => ({
    lat: from.lat + ((to.lat - from.lat) * i) / n,
    lng: from.lng + ((to.lng - from.lng) * i) / n,
  }))
}

function isolatedDate(offset) {
  const d = new Date(2028, 0, 1)
  d.setDate(d.getDate() + (Number(tag) % 900) + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function makeOffer(driver, date, seats) {
  const { data, error } = await driver.client.rpc('create_carpool_offers', {
    p_direction: 'commute-in',
    p_dates: [date],
    p_depart_time: '07:30',
    p_origin: HOME,
    p_dest: GDC,
    p_route: line(HOME, GDC),
    p_route_distance_m: 3900,
    p_route_duration_s: 600,
    p_seats_total: seats,
  })
  if (error) throw new Error(`등록 실패: ${error.message}`)
  return data[0]
}

const request = (rider, offerId) =>
  rider.client.rpc('request_carpool', {
    p_offer_id: offerId,
    p_lat: MID.lat,
    p_lng: MID.lng,
    p_addr: MID.addr,
    p_desired_time: '07:35',
    p_tolerance: 10,
  })

console.log('\n▶ 준비')
const driver = await signUp(0, '김봉사')
const riders = await Promise.all(
  [1, 2, 3, 4, 5].map((n) => signUp(n, `탑승자${n}`)),
)
const stranger = await signUp(9, '무관한사람')
check('봉사자 1 · 탑승자 5 · 제3자 1 생성', riders.length === 5)

// ── 기본 허락 / 거절 ──────────────────────────────────────────
console.log('\n▶ 허락 · 거절')
const offerA = await makeOffer(driver, isolatedDate(0), 2)
const reqs = []
for (const rider of riders.slice(0, 3)) {
  const { data, error } = await request(rider, offerA.id)
  if (error) throw new Error(`신청 실패: ${error.message}`)
  reqs.push(data)
}
check('탑승자 3명이 신청', reqs.length === 3)

{
  const { error } = await stranger.client.rpc('accept_carpool_request', { p_request_id: reqs[0].id })
  check('제3자는 허락 불가', Boolean(error))

  const { error: byRider } = await riders[0].client.rpc('accept_carpool_request', {
    p_request_id: reqs[0].id,
  })
  check('탑승자 본인도 허락 불가', Boolean(byRider))

  const { data, error: e1 } = await driver.client.rpc('accept_carpool_request', {
    p_request_id: reqs[0].id,
  })
  check('봉사자가 허락', !e1 && data?.status === 'accepted', e1?.message)

  const { data: offer } = await driver.client
    .from('carpool_offers')
    .select('seats_available, status')
    .eq('id', offerA.id)
    .single()
  check('좌석 1 감소', offer?.seats_available === 1, `${offer?.seats_available}석`)
  check('아직 모집중', offer?.status === 'open', offer?.status)

  const { error: twice } = await driver.client.rpc('accept_carpool_request', {
    p_request_id: reqs[0].id,
  })
  check('같은 신청 두 번 허락 불가', Boolean(twice))

  const { data: rejected, error: e2 } = await driver.client.rpc('reject_carpool_request', {
    p_request_id: reqs[1].id,
  })
  check('거절 처리', !e2 && rejected?.status === 'rejected', e2?.message)

  const { data: offer2 } = await driver.client
    .from('carpool_offers')
    .select('seats_available')
    .eq('id', offerA.id)
    .single()
  check('거절은 좌석에 영향 없음', offer2?.seats_available === 1)
}

// ── 연락처 노출 ★ 핵심 ────────────────────────────────────────
console.log('\n▶ 연락처 공개 범위  ★ 핵심')
{
  const { data: mine } = await riders[0].client.from('matched_contacts').select('*')
  check('허락된 탑승자는 봉사자 연락처를 본다', mine?.length === 1, `${mine?.length}건`)
  check('전화번호가 실제 값', mine?.[0]?.phone === driver.phone, mine?.[0]?.phone)
  check('이름·부서 포함', mine?.[0]?.name === '김봉사' && Boolean(mine?.[0]?.department))
  check(
    '이메일·로그인ID 는 뷰에 없음',
    mine?.[0] && !('email' in mine[0]) && !('login_id' in mine[0]),
    JSON.stringify(Object.keys(mine?.[0] ?? {})),
  )

  const { data: asDriver } = await driver.client.from('matched_contacts').select('*')
  check('봉사자도 허락한 탑승자 연락처를 본다', asDriver?.length === 1)
  check('탑승자 전화번호가 실제 값', asDriver?.[0]?.phone === riders[0].phone)

  const { data: rejectedRider } = await riders[1].client.from('matched_contacts').select('*')
  check('거절된 탑승자는 못 본다', (rejectedRider?.length ?? 0) === 0, `${rejectedRider?.length}건`)

  const { data: pendingRider } = await riders[2].client.from('matched_contacts').select('*')
  check('대기 중 탑승자는 못 본다', (pendingRider?.length ?? 0) === 0, `${pendingRider?.length}건`)

  const { data: byStranger } = await stranger.client.from('matched_contacts').select('*')
  check('제3자는 아무것도 못 본다', (byStranger?.length ?? 0) === 0, `${byStranger?.length}건`)

  // 뷰를 우회해 원본 테이블을 직접 읽으려는 시도
  const { data: direct } = await riders[0].client
    .from('profile_private')
    .select('*')
    .eq('id', driver.id)
  check('매칭돼도 profile_private 직접 조회는 여전히 차단', (direct?.length ?? 0) === 0, `${direct?.length}건`)
}

// ── 좌석 소진 ─────────────────────────────────────────────────
console.log('\n▶ 좌석 소진')
{
  const { data, error } = await driver.client.rpc('accept_carpool_request', {
    p_request_id: reqs[2].id,
  })
  check('두 번째 허락 성공', !error && data?.status === 'accepted', error?.message)

  const { data: offer } = await driver.client
    .from('carpool_offers')
    .select('seats_available, status')
    .eq('id', offerA.id)
    .single()
  check('좌석 0', offer?.seats_available === 0, `${offer?.seats_available}석`)
  check('상태가 마감(full)', offer?.status === 'full', offer?.status)

  const { error: closed } = await request(riders[3], offerA.id)
  check('마감된 카풀에는 신청 불가', Boolean(closed))
}

// ── 좌석 반환 ─────────────────────────────────────────────────
console.log('\n▶ 허락된 신청 취소 시 좌석 반환')
{
  const { error } = await riders[0].client.rpc('cancel_carpool_request', {
    p_request_id: reqs[0].id,
  })
  check('탑승자가 취소', !error, error?.message)

  const { data: offer } = await driver.client
    .from('carpool_offers')
    .select('seats_available, status')
    .eq('id', offerA.id)
    .single()
  check('좌석 1 반환', offer?.seats_available === 1, `${offer?.seats_available}석`)
  check('상태가 다시 모집중', offer?.status === 'open', offer?.status)

  const { data: contacts } = await riders[0].client.from('matched_contacts').select('*')
  check('취소하면 연락처도 다시 가려진다', (contacts?.length ?? 0) === 0, `${contacts?.length}건`)
}

// ── 동시 허락 ★ 핵심 ──────────────────────────────────────────
console.log('\n▶ 동시 허락 (좌석 초과 방지)  ★ 핵심')
{
  const SEATS = 2
  const offerB = await makeOffer(driver, isolatedDate(1), SEATS)

  const pending = []
  for (const rider of riders) {
    const { data, error } = await request(rider, offerB.id)
    if (error) throw new Error(`신청 실패: ${error.message}`)
    pending.push(data)
  }
  check(`탑승자 ${riders.length}명이 ${SEATS}석에 신청`, pending.length === riders.length)

  // 5건을 동시에 허락 시도
  const results = await Promise.all(
    pending.map((r) =>
      driver.client.rpc('accept_carpool_request', { p_request_id: r.id }),
    ),
  )
  const ok = results.filter((r) => !r.error).length
  const rejected = results.filter((r) => r.error).length

  check(`정확히 ${SEATS}건만 허락됨`, ok === SEATS, `성공 ${ok} / 실패 ${rejected}`)

  const { data: offer } = await driver.client
    .from('carpool_offers')
    .select('seats_available, status')
    .eq('id', offerB.id)
    .single()
  check('좌석이 음수가 되지 않음', offer?.seats_available === 0, `${offer?.seats_available}석`)
  check('마감 처리', offer?.status === 'full', offer?.status)

  const { data: accepted } = await driver.client
    .from('carpool_requests')
    .select('id')
    .eq('offer_id', offerB.id)
    .eq('status', 'accepted')
  check(`허락된 신청이 정확히 ${SEATS}건`, accepted?.length === SEATS, `${accepted?.length}건`)
}

console.log(`\n${fail === 0 ? '✅' : '❌'}  통과 ${pass} / 실패 ${fail}\n`)
process.exit(fail === 0 ? 0 : 1)

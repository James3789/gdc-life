/** 카풀 제공(Offer) 등록·취소·권한 검증 (Phase 2).
 *
 *   npm run db:start && npm run test:offers
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

async function signUp(n) {
  const loginId = `ofr${tag}${n}`
  const c = client()
  const { data, error } = await c.auth.signUp({
    email: `${loginId}@gdc-life.local`,
    password: 'gdclife1234',
    options: {
      data: {
        login_id: loginId,
        name: `봉사자${n}`,
        department: '테스트팀',
        email: `${loginId}@example.com`,
        phone: `010-2222-000${n}`,
      },
    },
  })
  if (error) throw new Error(`가입 실패: ${error.message}`)
  return { client: c, id: data.user.id, loginId }
}

// 울산 GDC 인근 좌표
const GDC = { lat: 35.51809, lng: 129.28832, addr: '울산광역시 남구 신두왕로 50' }
const HOME = { lat: 35.5384, lng: 129.3114, addr: '울산 남구 삼산동' }
const VIA = { lat: 35.5312, lng: 129.3005, addr: '울산 남구 달동' }
// 길찾기 결과를 흉내 낸 경로 좌표
const ROUTE = [HOME, VIA, GDC].map(({ lat, lng }) => ({ lat, lng }))

const COLS =
  'id, driver_id, direction, ride_date, depart_time, origin_addr, dest_addr, waypoints, route_distance_m, seats_total, seats_available, status, recurring_group_id'

console.log('\n▶ 계정 준비')
const a = await signUp(1)
const b = await signUp(2)
check('봉사자 A / 타인 B 생성', Boolean(a.id && b.id))

// ── 단건 등록 ─────────────────────────────────────────────────
console.log('\n▶ 단건 등록 (출근)')
let single
{
  const { data, error } = await a.client.rpc('create_carpool_offers', {
    p_direction: 'commute-in',
    p_dates: ['2026-09-01'],
    p_depart_time: '07:30',
    p_origin: HOME,
    p_dest: GDC,
    p_waypoints: [VIA],
    p_route: ROUTE,
    p_route_distance_m: 6119,
    p_route_duration_s: 847,
    p_seats_total: 3,
  })
  check('등록 성공', !error && data?.length === 1, error?.message)
  single = data?.[0]
  check('좌석이 총좌석과 같게 초기화', single?.seats_available === 3 && single?.seats_total === 3)
  check('상태 open', single?.status === 'open', single?.status)
  check('본인이 driver 로 기록', single?.driver_id === a.id)
  check('경유지 저장', single?.waypoints?.length === 1, JSON.stringify(single?.waypoints))
  check('단건은 반복 그룹 없음', single?.recurring_group_id === null)
  check('경로 LineString 생성', Boolean(single?.route), 'route 가 null')
}

// ── 반복 등록 ─────────────────────────────────────────────────
console.log('\n▶ 반복 등록 (평일 5일)')
let group
{
  const dates = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']
  const { data, error } = await a.client.rpc('create_carpool_offers', {
    p_direction: 'commute-out',
    p_dates: dates,
    p_depart_time: '18:00',
    p_origin: GDC,
    p_dest: HOME,
    p_route: ROUTE,
    p_seats_total: 4,
  })
  check('5건 생성', !error && data?.length === 5, error?.message ?? `${data?.length}건`)
  group = data?.[0]?.recurring_group_id
  check('같은 반복 그룹으로 묶임', Boolean(group) && data.every((o) => o.recurring_group_id === group))
  check('퇴근 방향 저장', data?.every((o) => o.direction === 'commute-out'))
  check('좌석 4석 반영', data?.every((o) => o.seats_total === 4 && o.seats_available === 4))
}

// ── 입력 검증 ─────────────────────────────────────────────────
console.log('\n▶ 입력 검증')
{
  const { error: seats } = await a.client.rpc('create_carpool_offers', {
    p_direction: 'commute-in',
    p_dates: ['2026-09-02'],
    p_depart_time: '07:30',
    p_origin: HOME,
    p_dest: GDC,
    p_seats_total: 5,
  })
  check('좌석 5석 거부', Boolean(seats))

  const { error: empty } = await a.client.rpc('create_carpool_offers', {
    p_direction: 'commute-in',
    p_dates: [],
    p_depart_time: '07:30',
    p_origin: HOME,
    p_dest: GDC,
  })
  check('날짜 없으면 거부', Boolean(empty))

  const { data: noRoute, error: noRouteErr } = await a.client.rpc('create_carpool_offers', {
    p_direction: 'commute-in',
    p_dates: ['2026-09-03'],
    p_depart_time: '07:30',
    p_origin: HOME,
    p_dest: GDC,
    p_route: [],
  })
  check('길찾기 실패해도 등록은 된다 (route=null)', !noRouteErr && noRoute?.[0]?.route === null, noRouteErr?.message)
}

// ── 권한 ──────────────────────────────────────────────────────
console.log('\n▶ 권한  ★ 핵심')
{
  const { data: seen } = await b.client.from('carpool_offers').select(COLS).eq('id', single.id)
  check('타인도 검색을 위해 조회는 가능', seen?.length === 1)

  const { data: upd } = await b.client
    .from('carpool_offers')
    .update({ status: 'cancelled' })
    .eq('id', single.id)
    .select('id')
  check('타인은 수정 불가', (upd?.length ?? 0) === 0, '수정됨')

  const { data: del } = await b.client
    .from('carpool_offers')
    .delete()
    .eq('id', single.id)
    .select('id')
  check('타인은 삭제 불가', (del?.length ?? 0) === 0, '삭제됨')

  const { error: forge } = await b.client.from('carpool_offers').insert({
    driver_id: a.id,
    direction: 'commute-in',
    ride_date: '2026-09-04',
    depart_time: '07:30',
    origin_lat: HOME.lat, origin_lng: HOME.lng, origin_addr: HOME.addr,
    dest_lat: GDC.lat, dest_lng: GDC.lng, dest_addr: GDC.addr,
    seats_total: 3, seats_available: 3,
  })
  check('남의 이름으로 등록 불가', Boolean(forge), '등록됨')

  // 좌석 차감은 Phase 4 의 허락 트랜잭션에서만 일어나야 한다
  const { error: seatHack } = await a.client
    .from('carpool_offers')
    .update({ seats_available: 0 })
    .eq('id', single.id)
  check('본인도 seats_available 직접 수정 불가 (컬럼 권한)', Boolean(seatHack), '수정됨')

  const { error: timeHack } = await a.client
    .from('carpool_offers')
    .update({ depart_time: '09:00' })
    .eq('id', single.id)
  check('상태 외 컬럼 직접 수정 불가 (취소 후 재등록 정책)', Boolean(timeHack), '수정됨')
}

// ── 취소 ──────────────────────────────────────────────────────
console.log('\n▶ 취소')
{
  const { data: other } = await b.client.rpc('cancel_carpool_offers', { p_offer_id: single.id })
  check('타인은 취소 불가', other === null || other === 0, String(other))

  const { data: one, error: oneErr } = await a.client.rpc('cancel_carpool_offers', {
    p_offer_id: single.id,
  })
  check('본인 단건 취소', !oneErr && one === 1, oneErr?.message ?? String(one))

  const { data: after } = await a.client.from('carpool_offers').select('status').eq('id', single.id).single()
  check('상태가 cancelled 로 변경', after?.status === 'cancelled', after?.status)

  const { data: groupRows } = await a.client
    .from('carpool_offers')
    .select('id')
    .eq('recurring_group_id', group)
    .limit(1)
  const { data: many, error: manyErr } = await a.client.rpc('cancel_carpool_offers', {
    p_offer_id: groupRows[0].id,
    p_whole_group: true,
  })
  check('반복 그룹 5건 일괄 취소', !manyErr && many === 5, manyErr?.message ?? String(many))

  const { data: left } = await a.client
    .from('carpool_offers')
    .select('status')
    .eq('recurring_group_id', group)
  check('그룹 전체가 cancelled', left?.every((o) => o.status === 'cancelled'))
}

console.log(`\n${fail === 0 ? '✅' : '❌'}  통과 ${pass} / 실패 ${fail}\n`)
process.exit(fail === 0 ? 0 : 1)

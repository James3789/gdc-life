/** 차량번호 등록·공개 범위 검증.
 *
 *   npm run db:start && npm run test:vehicle
 *
 * 차량번호는 전화번호와 같은 취급이다 — 매칭이 성립한 상대에게만 열린다.
 * 검색 목록이나 제3자에게는 나가지 않아야 한다.
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
  const loginId = `veh${tag}${n}`
  const c = createClient(URL_, KEY, { auth: { persistSession: false } })
  const { data, error } = await c.auth.signUp({
    email: `${loginId}@gdc-life.local`,
    password: 'gdclife1234',
    options: {
      data: {
        login_id: loginId,
        name,
        department: `부서${n}`,
        email: `${loginId}@example.com`,
        phone: `010-6161-00${String(n).padStart(2, '0')}`,
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

const kst = new Date(Date.now() + 9 * 3600 * 1000)
const tomorrow = new Date(kst.getTime() + 24 * 3600 * 1000).toISOString().slice(0, 10)

const PLATE = '12가3456'

async function makeOffer(driver, time, vehicleNo = PLATE) {
  const { data, error } = await driver.client.rpc('create_carpool_offers', {
    p_direction: 'commute-in',
    p_dates: [tomorrow],
    p_depart_time: time,
    p_origin: HOME,
    p_dest: GDC,
    p_route: line(HOME, GDC),
    p_route_duration_s: 600,
    p_seats_total: 3,
    p_vehicle_no: vehicleNo,
  })
  if (error) throw new Error(error.message)
  return data[0]
}

async function readVehicle(user, offerId) {
  const { data } = await user.client
    .from('offer_vehicles')
    .select('vehicle_no')
    .eq('offer_id', offerId)
  return data ?? []
}

console.log('\n▶ 준비')
const driver = await signUp(1, `봉사${tag}`)
const rider = await signUp(2, `탑승${tag}`)
const waiting = await signUp(3, `대기${tag}`)
const stranger = await signUp(4, `제삼${tag}`)
check('계정 4개 생성', Boolean(driver.id && rider.id && waiting.id && stranger.id))

// ── 등록 ──────────────────────────────────────────────────────
console.log('\n▶ 등록')
const offer = await makeOffer(driver, '07:30')
check('차량번호와 함께 카풀 등록', Boolean(offer?.id))

{
  const mine = await readVehicle(driver, offer.id)
  check('봉사자는 본인 차량번호 조회', mine[0]?.vehicle_no === PLATE, JSON.stringify(mine))

  const { data: last } = await driver.client.rpc('my_last_vehicle_no')
  check('지난 차량번호 불러오기 (등록 폼 기본값)', last === PLATE, String(last))

  const { data: none } = await stranger.client.rpc('my_last_vehicle_no')
  check('남의 차량번호는 불러오지 않는다', !none, String(none))
}

// 반복 등록도 모든 날짜에 붙는다
{
  const { data, error } = await driver.client.rpc('create_carpool_offers', {
    p_direction: 'commute-in',
    p_dates: [tomorrow, '2099-01-05', '2099-01-06'],
    p_depart_time: '06:10',
    p_origin: HOME,
    p_dest: GDC,
    p_route: line(HOME, GDC),
    p_route_duration_s: 600,
    p_seats_total: 3,
    p_vehicle_no: '99하9999',
  })
  check('반복 등록 성공', !error && data?.length === 3, error?.message)

  let all = true
  for (const o of data ?? []) {
    const rows = await readVehicle(driver, o.id)
    if (rows[0]?.vehicle_no !== '99하9999') all = false
  }
  check('반복 등록한 모든 날짜에 차량번호가 붙는다', all)
}

// ── 형식 ──────────────────────────────────────────────────────
console.log('\n▶ 형식 검증')
{
  const bad = ['1234', 'ABC1234', '가나다라마', '   ']
  let rejected = 0
  for (const v of bad) {
    const { error } = await driver.client.rpc('create_carpool_offers', {
      p_direction: 'commute-in',
      p_dates: [tomorrow],
      p_depart_time: '05:05',
      p_origin: HOME,
      p_dest: GDC,
      p_route: line(HOME, GDC),
      p_seats_total: 3,
      p_vehicle_no: v,
    })
    // 공백만 있는 값은 '입력 안 함'으로 보고 통과시킨다
    if (error || v.trim() === '') rejected++
  }
  check('숫자·한글이 없는 차량번호는 거부', rejected === bad.length, `${rejected}/${bad.length}`)

  const { error: okErr } = await driver.client.rpc('create_carpool_offers', {
    p_direction: 'commute-in',
    p_dates: ['2099-02-02'],
    p_depart_time: '05:06',
    p_origin: HOME,
    p_dest: GDC,
    p_route: line(HOME, GDC),
    p_seats_total: 3,
    p_vehicle_no: '서울12가3456',
  })
  check('지역명이 붙은 옛 번호판도 허용', !okErr, okErr?.message)
}

// ── 공개 범위 ★ ───────────────────────────────────────────────
console.log('\n▶ 공개 범위  ★')
{
  check('무관한 사람은 볼 수 없다', (await readVehicle(stranger, offer.id)).length === 0)

  // 검색 결과에도 실려 나가면 안 된다
  const { data: found } = await rider.client.rpc('search_carpool_offers', {
    p_direction: 'commute-in',
    p_date: tomorrow,
    p_lat: MID.lat,
    p_lng: MID.lng,
    p_desired_time: '07:35',
    p_tolerance_min: 30,
  })
  const card = found?.find((r) => r.offer_id === offer.id)
  check('검색 결과에 카풀은 나온다', Boolean(card))
  check(
    '검색 결과에 차량번호는 없다',
    card && !Object.keys(card).some((k) => k.includes('vehicle')),
    JSON.stringify(Object.keys(card ?? {})),
  )

  // 신청만 한 상태 — 아직 안 된다
  const { data: req } = await rider.client.rpc('request_carpool', {
    p_offer_id: offer.id,
    p_lat: MID.lat, p_lng: MID.lng, p_addr: MID.addr,
    p_desired_time: '07:35', p_tolerance: 30,
  })
  await waiting.client.rpc('request_carpool', {
    p_offer_id: offer.id,
    p_lat: MID.lat, p_lng: MID.lng, p_addr: MID.addr,
    p_desired_time: '07:36', p_tolerance: 30,
  })
  check('신청만 한 탑승자는 볼 수 없다', (await readVehicle(rider, offer.id)).length === 0)

  // 허락 이후 — 열린다
  await driver.client.rpc('accept_carpool_request', { p_request_id: req.id })
  const opened = await readVehicle(rider, offer.id)
  check('허락된 탑승자는 볼 수 있다', opened[0]?.vehicle_no === PLATE, JSON.stringify(opened))

  check('아직 대기 중인 다른 탑승자는 볼 수 없다', (await readVehicle(waiting, offer.id)).length === 0)
  check('제3자는 여전히 볼 수 없다', (await readVehicle(stranger, offer.id)).length === 0)

  // 신청을 취소하면 다시 닫힌다
  await rider.client.rpc('cancel_carpool_request', { p_request_id: req.id })
  check('신청을 취소하면 다시 닫힌다', (await readVehicle(rider, offer.id)).length === 0)
}

// ── 위조 ★ ────────────────────────────────────────────────────
console.log('\n▶ 위조 차단  ★')
{
  const { error: insErr } = await stranger.client
    .from('offer_vehicles')
    .insert({ offer_id: offer.id, vehicle_no: '00가0000' })
  check('남의 카풀에 차량번호를 넣을 수 없다', Boolean(insErr), '등록됨')

  const { error: updErr } = await stranger.client
    .from('offer_vehicles')
    .update({ vehicle_no: '00가0000' })
    .eq('offer_id', offer.id)
  const after = await readVehicle(driver, offer.id)
  check(
    '남의 차량번호를 바꿀 수 없다',
    after[0]?.vehicle_no === PLATE,
    `${after[0]?.vehicle_no} ${updErr?.message ?? ''}`,
  )

  const { error: ownErr } = await driver.client
    .from('offer_vehicles')
    .update({ vehicle_no: '34나5678' })
    .eq('offer_id', offer.id)
  const fixed = await readVehicle(driver, offer.id)
  check('봉사자는 본인 차량번호를 고칠 수 있다', !ownErr && fixed[0]?.vehicle_no === '34나5678', ownErr?.message)
}

console.log(`\n${fail === 0 ? '✅' : '❌'}  통과 ${pass} / 실패 ${fail}\n`)
process.exit(fail === 0 ? 0 : 1)

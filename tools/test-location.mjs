/** 실시간 위치 공유 권한 검증 (Phase 5).
 *
 *   npm run db:start && npm run test:location
 *
 * 위치는 DB에 남지 않고 Broadcast 로만 흐르므로,
 * 방어선은 "누가 그 채널에 들어올 수 있는가" 하나뿐이다. 그걸 검증한다.
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
  const loginId = `loc${tag}${n}`
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
        phone: `010-6666-00${String(n).padStart(2, '0')}`,
      },
    },
  })
  if (error) throw new Error(`가입 실패: ${error.message}`)
  await c.realtime.setAuth()
  return { client: c, id: data.user.id, name }
}

// ── KST 기준 현재 시각 ────────────────────────────────────────
const kstNow = new Date(Date.now() + 9 * 3600 * 1000)
const kstDate = (d) => d.toISOString().slice(0, 10)
const kstTime = (d) =>
  `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`

const TODAY = kstDate(kstNow)
const TOMORROW = kstDate(new Date(kstNow.getTime() + 24 * 3600 * 1000))
/** 지금부터 10분 뒤 출발 → 운행 시간대(출발 30분 전~) 안 */
const SOON = kstTime(new Date(kstNow.getTime() + 10 * 60 * 1000))
/** 2시간 전 출발 → 창(출발 1시간 후)이 이미 닫힘 */
const LONG_PAST = kstTime(new Date(kstNow.getTime() - 2 * 3600 * 1000))

const GDC = { lat: 35.50512, lng: 129.29956, addr: 'GDC' }
const HOME = { lat: 35.5384, lng: 129.3114, addr: '삼산동' }
const MID = { lat: 35.5223, lng: 129.3055, addr: '중간' }
const line = (a, b, n = 20) =>
  Array.from({ length: n + 1 }, (_, i) => ({
    lat: a.lat + ((b.lat - a.lat) * i) / n,
    lng: a.lng + ((b.lng - a.lng) * i) / n,
  }))

/** 구독을 시도하고 성공 여부만 돌려준다 (타임아웃 포함) */
function trySubscribe(client, topic, { onLocation, timeoutMs = 8000 } = {}) {
  return new Promise((resolve) => {
    let settled = false
    const channel = client.channel(topic, {
      config: { private: true, broadcast: { self: false } },
    })

    if (onLocation) {
      channel.on('broadcast', { event: 'location' }, ({ payload }) => onLocation(payload))
    }

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      resolve({ ok: false, status: 'TIMEOUT', channel })
    }, timeoutMs)

    channel.subscribe((status, err) => {
      if (settled) return
      if (status === 'SUBSCRIBED') {
        settled = true
        clearTimeout(timer)
        resolve({ ok: true, status, channel })
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        settled = true
        clearTimeout(timer)
        resolve({ ok: false, status, error: err?.message, channel })
      }
    })
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── 준비 ──────────────────────────────────────────────────────
console.log('\n▶ 준비')
const driver = await signUp(1, '김봉사')
const rider = await signUp(2, '이탑승')
const waiting = await signUp(3, '대기탑승')
const stranger = await signUp(4, '무관한사람')
check('계정 4개 생성', Boolean(driver.id && rider.id && waiting.id && stranger.id))

async function makeOffer(date, time) {
  const { data, error } = await driver.client.rpc('create_carpool_offers', {
    p_direction: 'commute-in',
    p_dates: [date],
    p_depart_time: time,
    p_origin: HOME,
    p_dest: GDC,
    p_route: line(HOME, GDC),
    p_route_duration_s: 600,
    p_seats_total: 3,
  })
  if (error) throw new Error(`등록 실패: ${error.message}`)
  return data[0]
}

const active = await makeOffer(TODAY, SOON)
check(`운행 임박 카풀 등록 (${TODAY} ${SOON} 출발)`, Boolean(active?.id))

for (const who of [rider, waiting]) {
  const { error } = await who.client.rpc('request_carpool', {
    p_offer_id: active.id,
    p_lat: MID.lat,
    p_lng: MID.lng,
    p_addr: MID.addr,
    p_desired_time: SOON,
    p_tolerance: 30,
  })
  if (error) throw new Error(`신청 실패: ${error.message}`)
}

const { data: accepted } = await driver.client
  .from('carpool_requests')
  .select('id, passenger_id')
  .eq('offer_id', active.id)
const mine = accepted.find((r) => r.passenger_id === rider.id)
await driver.client.rpc('accept_carpool_request', { p_request_id: mine.id })
check('탑승자 1명만 허락 (1명은 대기)', Boolean(mine))

// ── 권한 판정 함수 ────────────────────────────────────────────
console.log('\n▶ can_share_location 판정')
{
  const ask = async (who) => {
    const { data } = await who.client.rpc('can_share_location', { p_offer_id: active.id })
    return data
  }
  check('봉사자 허용', (await ask(driver)) === true)
  check('허락된 탑승자 허용', (await ask(rider)) === true)
  check('대기 중 탑승자 거부', (await ask(waiting)) === false)
  check('제3자 거부', (await ask(stranger)) === false)

  const future = await makeOffer(TOMORROW, SOON)
  const { data: req } = await waiting.client.rpc('request_carpool', {
    p_offer_id: future.id,
    p_lat: MID.lat, p_lng: MID.lng, p_addr: MID.addr,
    p_desired_time: SOON, p_tolerance: 30,
  })
  await driver.client.rpc('accept_carpool_request', { p_request_id: req.id })
  const { data: tooEarly } = await waiting.client.rpc('can_share_location', {
    p_offer_id: future.id,
  })
  check('운행 시간대 밖(내일 건)은 허락됐어도 거부', tooEarly === false, String(tooEarly))

  // 창은 출발 1시간 후에 닫힌다 — 2시간 전 출발 건은 이미 닫혀 있어야 한다
  const past = await makeOffer(TODAY, LONG_PAST)
  const { data: pastReq } = await waiting.client.rpc('request_carpool', {
    p_offer_id: past.id,
    p_lat: MID.lat, p_lng: MID.lng, p_addr: MID.addr,
    p_desired_time: LONG_PAST, p_tolerance: 30,
  })
  await driver.client.rpc('accept_carpool_request', { p_request_id: pastReq.id })
  const { data: tooLate } = await waiting.client.rpc('can_share_location', {
    p_offer_id: past.id,
  })
  check(`출발 2시간 경과 건(${LONG_PAST})은 창이 닫힘`, tooLate === false, String(tooLate))
}

// ── 채널 접근 ★ 핵심 ──────────────────────────────────────────
console.log('\n▶ Realtime 채널 접근  ★ 핵심')
const topic = `trip:${active.id}`
const opened = []

{
  const d = await trySubscribe(driver.client, topic)
  opened.push(d.channel)
  check('봉사자는 채널 입장 성공', d.ok, d.status)

  const received = []
  const r = await trySubscribe(rider.client, topic, { onLocation: (p) => received.push(p) })
  opened.push(r.channel)
  check('허락된 탑승자는 채널 입장 성공', r.ok, r.status)

  const w = await trySubscribe(waiting.client, topic, { timeoutMs: 6000 })
  opened.push(w.channel)
  check('대기 중 탑승자는 입장 거부', !w.ok, `status=${w.status}`)

  const s = await trySubscribe(stranger.client, topic, { timeoutMs: 6000 })
  opened.push(s.channel)
  check('제3자는 입장 거부', !s.ok, `status=${s.status}`)

  // 브로드캐스트 전달 확인
  if (d.ok && r.ok) {
    await sleep(500)
    await d.channel.send({
      type: 'broadcast',
      event: 'location',
      payload: { lat: 35.52, lng: 129.305, at: Date.now() },
    })
    await sleep(2000)
    check('봉사자 위치가 탑승자에게 전달됨', received.length > 0, `${received.length}건 수신`)
    check('좌표가 그대로 전달', received[0]?.lat === 35.52 && received[0]?.lng === 129.305)
  } else {
    check('봉사자 위치가 탑승자에게 전달됨', false, '구독 실패로 확인 불가')
    check('좌표가 그대로 전달', false, '구독 실패로 확인 불가')
  }
}

// ── 취소하면 즉시 차단 ────────────────────────────────────────
console.log('\n▶ 매칭 해제 후 차단')
{
  await rider.client.rpc('cancel_carpool_request', { p_request_id: mine.id })

  const { data: after } = await rider.client.rpc('can_share_location', { p_offer_id: active.id })
  check('취소한 탑승자는 판정에서 거부', after === false, String(after))

  const again = await trySubscribe(rider.client, `${topic}`, { timeoutMs: 6000 })
  opened.push(again.channel)
  check('취소 후에는 채널 재입장 불가', !again.ok, `status=${again.status}`)
}

// 정리
for (const ch of opened) {
  try {
    await ch.unsubscribe()
  } catch {
    /* 이미 닫힘 */
  }
}
for (const who of [driver, rider, waiting, stranger]) {
  who.client.realtime.disconnect()
}

console.log(`\n${fail === 0 ? '✅' : '❌'}  통과 ${pass} / 실패 ${fail}\n`)
process.exit(fail === 0 ? 0 : 1)

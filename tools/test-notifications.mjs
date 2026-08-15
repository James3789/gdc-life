/** 알림 생성·격리 검증.
 *
 *   npm run db:start && npm run test:notifications
 *
 * 알림은 트리거가 만든다. 그래서 "RPC 를 호출하면 알림이 남는가" 와
 * "남의 알림에 손댈 수 없는가" 두 가지를 본다.
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
  const loginId = `ntf${tag}${n}`
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
        phone: `010-7171-00${String(n).padStart(2, '0')}`,
      },
    },
  })
  if (error) throw new Error(`가입 실패: ${error.message}`)
  return { client: c, id: data.user.id, loginId, name }
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
const yesterday = new Date(kst.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10)

/** 내 알림을 최신순으로 */
async function inbox(user, kind = null) {
  let q = user.client.from('notifications').select('*').order('created_at', { ascending: false })
  if (kind) q = q.eq('kind', kind)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data
}

async function makeOffer(driver, date, time) {
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
  if (error) throw new Error(error.message)
  return data[0]
}

async function apply(rider, offerId, time) {
  const { data, error } = await rider.client.rpc('request_carpool', {
    p_offer_id: offerId,
    p_lat: MID.lat,
    p_lng: MID.lng,
    p_addr: MID.addr,
    p_desired_time: time,
    p_tolerance: 30,
  })
  if (error) throw new Error(error.message)
  return data
}

console.log('\n▶ 준비')
const driver = await signUp(1, `봉사${tag}`)
const rider = await signUp(2, `탑승${tag}`)
const third = await signUp(3, `제삼${tag}`)
check('계정 3개 생성', Boolean(driver.id && rider.id && third.id))

check('가입 직후 알림함은 비어 있다', (await inbox(driver)).length === 0)

// ── 신청 → 허락 → 취소 → 재신청 → 거절 ───────────────────────
console.log('\n▶ 신청 흐름')
{
  const offer = await makeOffer(driver, tomorrow, '07:30')
  const req = await apply(rider, offer.id, '07:35')

  const received = await inbox(driver, 'request_received')
  check('신청하면 봉사자에게 알림', received.length === 1, `${received.length}건`)
  check('알림에 탑승자 이름이 들어간다', received[0]?.body.includes(rider.name), received[0]?.body)
  check('알림에 운행 일시가 들어간다', /\d+\/\d+\(.\) 07:30/.test(received[0]?.body ?? ''), received[0]?.body)
  check('신청함으로 연결된다', received[0]?.link === '/carpool/requests', received[0]?.link)
  check('신청·카풀 id 가 함께 남는다', received[0]?.request_id === req.id && received[0]?.offer_id === offer.id)
  check('처음에는 안 읽음', received[0]?.read_at === null)
  check('탑승자에게는 아직 알림이 없다', (await inbox(rider)).length === 0)

  await driver.client.rpc('accept_carpool_request', { p_request_id: req.id })
  const accepted = await inbox(rider, 'request_accepted')
  check('허락하면 탑승자에게 알림', accepted.length === 1, `${accepted.length}건`)
  check('허락 알림은 운행 화면으로 연결', accepted[0]?.link === `/carpool/trip/${offer.id}`, accepted[0]?.link)
  check('허락 알림에 봉사자 이름', accepted[0]?.body.includes(driver.name), accepted[0]?.body)

  await rider.client.rpc('cancel_carpool_request', { p_request_id: req.id })
  const cancelled = await inbox(driver, 'request_cancelled')
  check('탑승자가 취소하면 봉사자에게 알림', cancelled.length === 1, `${cancelled.length}건`)

  // 취소된 신청은 되살아난다 — 이때도 새 신청으로 알린다
  const again = await apply(rider, offer.id, '07:35')
  check('재신청도 알림', (await inbox(driver, 'request_received')).length === 2)

  await driver.client.rpc('reject_carpool_request', { p_request_id: again.id })
  const rejected = await inbox(rider, 'request_rejected')
  check('거절하면 탑승자에게 알림', rejected.length === 1, `${rejected.length}건`)
  check('거절 알림은 카풀 찾기로 연결', rejected[0]?.link === '/carpool/search', rejected[0]?.link)
}

// ── 카풀 취소 ─────────────────────────────────────────────────
console.log('\n▶ 카풀 취소')
{
  const offer = await makeOffer(driver, tomorrow, '08:10')
  await apply(rider, offer.id, '08:15')

  const { error } = await driver.client.rpc('cancel_carpool_offers', {
    p_offer_id: offer.id,
    p_whole_group: false,
  })
  check('카풀 취소 성공', !error, error?.message)

  const notes = (await inbox(rider, 'offer_cancelled')).filter((n) => n.offer_id === offer.id)
  check('봉사자가 취소하면 신청자에게 알림', notes.length === 1, `${notes.length}건`)
  check('취소 알림에 봉사자 이름', notes[0]?.body.includes(driver.name), notes[0]?.body)

  // 신청하지 않은 사람에게는 가지 않는다
  check('무관한 사람에게는 알림이 없다', (await inbox(third)).length === 0)
}

// ── 운행완료 ──────────────────────────────────────────────────
console.log('\n▶ 운행완료')
{
  const offer = await makeOffer(driver, yesterday, '06:40')
  const req = await apply(rider, offer.id, '06:45')
  await driver.client.rpc('accept_carpool_request', { p_request_id: req.id })

  const { error } = await driver.client.rpc('complete_carpool_offer', { p_offer_id: offer.id })
  check('운행완료 처리 성공', !error, error?.message)

  const forDriver = (await inbox(driver, 'trip_completed')).filter((n) => n.offer_id === offer.id)
  const forRider = (await inbox(rider, 'trip_completed')).filter((n) => n.offer_id === offer.id)
  check('봉사자에게 별점 적립 알림', forDriver.length === 1, `${forDriver.length}건`)
  check('별점 알림은 내 정보로 연결', forDriver[0]?.link === '/profile', forDriver[0]?.link)
  check('탑승자에게 완료 알림', forRider.length === 1, `${forRider.length}건`)
  check('완료 알림은 1인당 1건 (중복 없음)', forDriver.length + forRider.length === 2)
}

// ── 격리 ★ ────────────────────────────────────────────────────
console.log('\n▶ 알림 격리  ★')
{
  const mine = await inbox(rider)
  check('내 알림만 보인다', mine.every((n) => n.user_id === rider.id), '남의 알림 노출')
  check('제3자 알림함은 여전히 비어 있다', (await inbox(third)).length === 0)

  // 남의 알림을 읽거나 지울 수 없다
  const target = (await inbox(driver))[0]
  const { data: peek } = await third.client.from('notifications').select('*').eq('id', target.id)
  check('id 를 알아도 남의 알림은 못 읽는다', (peek?.length ?? 0) === 0, `${peek?.length}건`)

  await third.client.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', target.id)
  const { data: after } = await driver.client.from('notifications').select('read_at').eq('id', target.id)
  check('남의 알림을 읽음 처리할 수 없다', after?.[0]?.read_at === null, String(after?.[0]?.read_at))

  await third.client.from('notifications').delete().eq('id', target.id)
  const { data: alive } = await driver.client.from('notifications').select('id').eq('id', target.id)
  check('남의 알림을 지울 수 없다', (alive?.length ?? 0) === 1, `${alive?.length}건`)

  // 알림을 스스로 만들 수 없다
  const { error: insErr } = await third.client.from('notifications').insert({
    user_id: third.id,
    kind: 'request_accepted',
    title: '가짜',
    body: '가짜 알림',
  })
  check('클라이언트는 알림을 만들 수 없다', Boolean(insErr), '생성됨')

  const { error: pushErr } = await third.client.rpc('push_notification', {
    p_user_id: third.id,
    p_kind: 'request_accepted',
    p_title: '가짜',
    p_body: '가짜',
  })
  check('push_notification 을 직접 부를 수 없다', Boolean(pushErr), '호출됨')

  // 내용은 고칠 수 없고 읽음만 바꿀 수 있다
  const own = (await inbox(driver))[0]
  const { error: titleErr } = await driver.client
    .from('notifications')
    .update({ title: '내가 바꾼 제목' })
    .eq('id', own.id)
  check('알림 내용은 본인도 고칠 수 없다', Boolean(titleErr), '수정됨')

  const { error: readErr } = await driver.client
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', own.id)
  check('본인은 읽음 처리 가능', !readErr, readErr?.message)

  const { count: unread } = await driver.client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  check('안 읽은 개수 조회 (배지)', typeof unread === 'number' && unread >= 1, String(unread))

  const { error: delErr } = await driver.client.from('notifications').delete().eq('id', own.id)
  check('본인 알림은 삭제 가능', !delErr, delErr?.message)

  const { error: purgeErr } = await driver.client.rpc('purge_old_notifications', { p_days: 1 })
  check('오래된 알림 정리는 사용자가 못 부른다', Boolean(purgeErr), '호출됨')
}

// ── 실시간 수신 ★ ─────────────────────────────────────────────
// 배지가 즉시 갱신되는 근거이자, 채널로도 남의 알림이 새지 않는지 확인한다.
console.log('\n▶ 실시간 수신  ★')
{
  const mine = []
  const leaked = []

  const own = driver.client
    .channel(`notifications:${driver.id}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${driver.id}` },
      (payload) => mine.push(payload.new),
    )

  // 제3자가 남의 user_id 로 필터를 걸어도 RLS 가 막아야 한다
  const spy = third.client
    .channel(`spy:${driver.id}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${driver.id}` },
      (payload) => leaked.push(payload.new),
    )

  const subscribed = (channel) =>
    new Promise((resolve) =>
      channel.subscribe(
        (s) => ['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT'].includes(s) && resolve(s),
      ),
    )

  const [ownStatus, spyStatus] = await Promise.all([subscribed(own), subscribed(spy)])
  check('알림 채널 구독', ownStatus === 'SUBSCRIBED', ownStatus)

  const offer = await makeOffer(driver, tomorrow, '09:20')
  await apply(rider, offer.id, '09:25')

  // 구독 직전에 만들어진 알림이 같은 배치로 함께 실려 올 수 있으므로
  // 개수가 아니라 "방금 그 카풀의 알림이 왔는가" 로 판정한다.
  const isNew = (n) => n.body?.includes('09:20')
  const deadline = Date.now() + 10_000
  while (!mine.some(isNew) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200))
  }
  // 도청 채널에도 도착할 시간을 준다
  await new Promise((r) => setTimeout(r, 1500))

  const arrived = mine.find(isNew)
  check('새 알림이 실시간으로 도착', Boolean(arrived), `${mine.length}건 수신`)
  check('실시간 알림에도 본문이 담긴다', Boolean(arrived?.title && arrived?.body), JSON.stringify(arrived ?? {}))
  check('내 알림만 채널로 흘러온다', mine.every((n) => n.user_id === driver.id), '남의 알림 포함')
  check('채널로도 남의 알림은 새지 않는다', leaked.length === 0, `${leaked.length}건 유출 (구독 ${spyStatus})`)

  await driver.client.removeChannel(own)
  await third.client.removeChannel(spy)
}

console.log(`\n${fail === 0 ? '✅' : '❌'}  통과 ${pass} / 실패 ${fail}\n`)
process.exit(fail === 0 ? 0 : 1)

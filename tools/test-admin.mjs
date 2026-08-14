/** 별점 순위 · 관리자 계정 조회 검증.
 *
 *   npm run db:start && npm run test:admin
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
  const loginId = `adm${tag}${n}`
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
        phone: `010-8282-00${String(n).padStart(2, '0')}`,
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
const yesterday = new Date(kst.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10)

console.log('\n▶ 준비')
const alice = await signUp(1, `앨리스${tag}`)
const bob = await signUp(2, `밥${tag}`)
const rider = await signUp(3, `탑승${tag}`)
const boss = await signUp(9, `관리${tag}`)
check('계정 4개 생성', Boolean(alice.id && bob.id && rider.id && boss.id))

/** 지난 운행을 만들고 완료 처리해 별점을 쌓는다 */
async function earnPoints(driver, times) {
  for (let i = 0; i < times; i++) {
    const { data: offers, error } = await driver.client.rpc('create_carpool_offers', {
      p_direction: 'commute-in',
      p_dates: [yesterday],
      p_depart_time: `0${5 + i}:30`,
      p_origin: HOME,
      p_dest: GDC,
      p_route: line(HOME, GDC),
      p_route_duration_s: 600,
      p_seats_total: 3,
    })
    if (error) throw new Error(error.message)

    const { data: req } = await rider.client.rpc('request_carpool', {
      p_offer_id: offers[0].id,
      p_lat: MID.lat, p_lng: MID.lng, p_addr: MID.addr,
      p_desired_time: `0${5 + i}:35`, p_tolerance: 30,
    })
    await driver.client.rpc('accept_carpool_request', { p_request_id: req.id })
    await driver.client.rpc('complete_carpool_offer', { p_offer_id: offers[0].id })
  }
}

await earnPoints(alice, 3)
await earnPoints(bob, 1)
check('앨리스 3회 · 밥 1회 운행완료', true)

// ── 순위 ──────────────────────────────────────────────────────
console.log('\n▶ 별점 순위')
{
  const { data, error } = await rider.client.rpc('rating_leaderboard', {
    p_period: 'total',
    p_limit: 100,
  })
  check('순위 조회 성공', !error && Array.isArray(data), error?.message)

  const a = data?.find((r) => r.user_id === alice.id)
  const b = data?.find((r) => r.user_id === bob.id)
  check('앨리스 3점', Number(a?.points) === 3, JSON.stringify(a?.points))
  check('밥 1점', Number(b?.points) === 1, JSON.stringify(b?.points))
  check('점수 높은 쪽이 앞 등수', Number(a?.rank) < Number(b?.rank), `${a?.rank} vs ${b?.rank}`)
  check('이름·부서 노출', Boolean(a?.name && a?.department))
  check('연락처는 순위에 없음', a && !('phone' in a) && !('email' in a), JSON.stringify(Object.keys(a ?? {})))

  const { data: mine } = await alice.client.rpc('rating_leaderboard', { p_period: 'total' })
  check('내 항목에 is_me 표시', mine?.find((r) => r.user_id === alice.id)?.is_me === true)
  check('남의 항목은 is_me=false', mine?.find((r) => r.user_id === bob.id)?.is_me === false)

  const { data: rank } = await alice.client.rpc('my_rating_rank', { p_period: 'total' })
  check('내 등수 조회', Number(rank?.[0]?.points) === 3 && Number(rank?.[0]?.rank) >= 1, JSON.stringify(rank?.[0]))

  const { data: none } = await rider.client.rpc('my_rating_rank', { p_period: 'total' })
  check('별점 없는 사람은 등수 없음', (none?.length ?? 0) === 0)

  const { data: month } = await rider.client.rpc('rating_leaderboard', { p_period: 'month' })
  check('월간 기간 필터 동작', month?.some((r) => r.user_id === alice.id))
}

// ── 관리자 권한 ★ ─────────────────────────────────────────────
console.log('\n▶ 관리자 권한  ★')
{
  const { data: notAdmin } = await alice.client.rpc('is_admin')
  check('일반 사용자는 관리자 아님', notAdmin === false, String(notAdmin))

  const { error: listErr } = await alice.client.rpc('admin_list_accounts')
  check('일반 사용자는 계정 목록 조회 불가', Boolean(listErr), '조회됨')

  const { error: statErr } = await alice.client.rpc('admin_stats')
  check('일반 사용자는 통계 조회 불가', Boolean(statErr), '조회됨')

  const { data: table } = await alice.client.from('admin_users').select('*')
  check('admin_users 테이블 직접 조회 불가', (table?.length ?? 0) === 0, `${table?.length}건 노출`)

  const { error: selfGrant } = await alice.client
    .from('admin_users')
    .insert({ user_id: alice.id, note: '스스로 승격' })
  check('스스로 관리자가 될 수 없다', Boolean(selfGrant), '승격됨')
}

if (!SERVICE_KEY) {
  console.log('\n  · SUPABASE_SERVICE_ROLE_KEY 없음 — 관리자 기능 검증 건너뜀')
} else {
  const admin = createClient(URL_, SERVICE_KEY, { auth: { persistSession: false } })
  const { error: grantErr } = await admin
    .from('admin_users')
    .upsert({ user_id: boss.id, note: '테스트 관리자' }, { onConflict: 'user_id' })

  console.log('\n▶ 관리자 기능')
  check('service_role 로 관리자 권한 부여', !grantErr, grantErr?.message)
  {
    const { data: isAdmin } = await boss.client.rpc('is_admin')
    check('관리자로 인식', isAdmin === true, String(isAdmin))

    const { data, error } = await boss.client.rpc('admin_list_accounts')
    check('계정 목록 조회', !error && (data?.length ?? 0) >= 4, error?.message ?? `${data?.length}건`)

    const me = data?.find((r) => r.user_id === alice.id)
    check('ID·이름·부서·이메일 노출', Boolean(me?.login_id && me?.name && me?.department && me?.email))
    check('가입일 노출', Boolean(me?.created_at))
    check('활동 통계 포함', Number(me?.points) === 3 && Number(me?.rides) === 3, JSON.stringify(me?.points))

    check(
      '전화번호는 마스킹되어 나온다',
      me?.phone_masked === '010-****-0001',
      String(me?.phone_masked),
    )
    check(
      '원본 전화번호는 응답에 없다',
      me && !('phone' in me),
      JSON.stringify(Object.keys(me ?? {})),
    )

    const { data: found } = await boss.client.rpc('admin_list_accounts', {
      p_query: alice.loginId,
    })
    check('ID 로 검색', found?.length === 1 && found[0].user_id === alice.id, `${found?.length}건`)

    const { data: byName } = await boss.client.rpc('admin_list_accounts', { p_query: `앨리스${tag}` })
    check('이름으로 검색', byName?.length === 1, `${byName?.length}건`)

    const { data: stats } = await boss.client.rpc('admin_stats')
    const s = stats?.[0]
    check('통계 조회', Number(s?.users) >= 4 && Number(s?.completed) >= 4, JSON.stringify(s))

    // 관리자여도 원본 연락처 테이블은 여전히 막혀 있다
    const { data: direct } = await boss.client
      .from('profile_private')
      .select('phone')
      .eq('id', alice.id)
    check('관리자도 profile_private 직접 조회는 불가', (direct?.length ?? 0) === 0, `${direct?.length}건`)
  }
}

console.log(`\n${fail === 0 ? '✅' : '❌'}  통과 ${pass} / 실패 ${fail}\n`)
process.exit(fail === 0 ? 0 : 1)

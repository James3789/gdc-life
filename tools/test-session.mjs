/** 자동 로그인(세션 지속) 검증.
 *
 *   npm run db:start && npm run test:session
 *
 * 브라우저의 localStorage 를 Map 으로 흉내 내서,
 * "앱을 껐다 켜도 다시 로그인되는가" 를 실제로 확인한다.
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

/** 프론트(supabase.ts)와 같은 설정 */
const STORAGE_KEY = 'gdc-life-auth'

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

/** 브라우저 저장소 흉내 */
function makeStorage(initial = new Map()) {
  return {
    map: initial,
    getItem: (k) => initial.get(k) ?? null,
    setItem: (k, v) => initial.set(k, v),
    removeItem: (k) => initial.delete(k),
  }
}

/** 프론트와 동일한 옵션으로 클라이언트를 만든다 */
function makeClient(storage, url = URL_) {
  return createClient(url, KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: STORAGE_KEY,
      storage,
    },
  })
}

const tag = String(Date.now()).slice(-6)
const loginId = `ses${tag}`

console.log('\n▶ 가입 후 첫 로그인')
const storage = makeStorage()
{
  const c = makeClient(storage)
  const { error } = await c.auth.signUp({
    email: `${loginId}@gdc-life.local`,
    password: 'gdclife1234',
    options: {
      data: {
        login_id: loginId,
        name: '세션테스터',
        department: '테스트팀',
        email: `${loginId}@example.com`,
        phone: '010-3333-9999',
      },
    },
  })
  check('가입 성공', !error, error?.message)

  const { data } = await c.auth.getSession()
  check('세션 발급', Boolean(data.session))
  check(
    '고정된 키로 저장됨',
    storage.map.has(STORAGE_KEY),
    `저장된 키: ${[...storage.map.keys()].join(', ')}`,
  )
}

console.log('\n▶ 앱을 껐다 켠 상황 (새 클라이언트, 같은 저장소)')
{
  const restarted = makeClient(storage)
  const { data, error } = await restarted.auth.getSession()
  check('다시 로그인하지 않아도 세션 복원', !error && Boolean(data.session), error?.message)

  const { data: user } = await restarted.auth.getUser()
  check('내 계정으로 복원됨', user?.user?.email === `${loginId}@gdc-life.local`, user?.user?.email)

  // 복원된 세션으로 실제 데이터 접근이 되는지
  const { data: profile } = await restarted.from('profiles').select('name').eq('id', user.user.id).single()
  check('복원된 세션으로 데이터 조회 가능', profile?.name === '세션테스터', JSON.stringify(profile))
}

console.log('\n▶ 주소가 바뀌어도 유지되는가')
{
  // localhost ↔ LAN IP 처럼 접속 주소가 바뀌는 상황.
  // 저장 키가 URL 에서 파생되면 여기서 로그인이 풀린다.
  const otherUrl = URL_.includes('127.0.0.1')
    ? URL_.replace('127.0.0.1', 'localhost')
    : URL_.replace(/\/\/[^:]+:/, '//127.0.0.1:')

  const moved = makeClient(storage, otherUrl)
  const { data } = await moved.auth.getSession()
  check(`접속 주소가 바뀌어도 세션 유지 (${otherUrl})`, Boolean(data.session))
}

console.log('\n▶ 로그아웃')
{
  const c = makeClient(storage)
  await c.auth.getSession()
  await c.auth.signOut()

  const after = makeClient(storage)
  const { data } = await after.auth.getSession()
  check('로그아웃하면 세션이 지워진다', !data.session)
  check('저장소도 비워진다', !storage.map.has(STORAGE_KEY) || !storage.map.get(STORAGE_KEY))
}

console.log(`\n${fail === 0 ? '✅' : '❌'}  통과 ${pass} / 실패 ${fail}\n`)
process.exit(fail === 0 ? 0 : 1)

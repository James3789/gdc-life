/** RLS 정책 검증. 개인정보 노출이 이 앱의 가장 큰 리스크라 자동 테스트로 못 박아 둔다.
 *
 *   npm run db:start && npm run test:rls
 *
 * 검증 항목:
 *   - 비로그인(anon)이 연락처/디렉터리를 못 읽는다
 *   - 로그인해도 남의 연락처(전화·이메일·ID)는 못 읽는다
 *   - 이름/부서는 로그인한 직원끼리 보인다 (검색 카드에 필요)
 *   - 클라이언트가 프로필을 위조 생성/수정할 수 없다
 *   - 설정은 로그인 전에도 읽힌다
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

// 매 실행마다 새 계정을 쓰도록 접미사를 붙인다
const tag = process.argv[2] ?? String(Date.now()).slice(-6)

async function signUp(n) {
  const loginId = `tester${tag}${n}`
  const c = client()
  const { data, error } = await c.auth.signUp({
    email: `${loginId}@gdc-life.local`,
    password: 'gdclife1234',
    options: {
      data: {
        login_id: loginId,
        name: `테스터${n}`,
        department: `부서${n}`,
        email: `tester${n}@example.com`,
        phone: `010-0000-000${n}`,
      },
    },
  })
  if (error) throw new Error(`가입 실패(${loginId}): ${error.message}`)
  if (!data.session) throw new Error('세션 없음 — enable_confirmations 가 켜져 있는지 확인')
  return { client: c, id: data.user.id, loginId }
}

console.log('\n▶ 계정 2개 생성')
const a = await signUp(1)
const b = await signUp(2)
console.log(`  A=${a.loginId}  B=${b.loginId}`)

console.log('\n▶ 트리거로 프로필이 생성되었는가')
{
  const { data } = await a.client.from('profiles').select('*').eq('id', a.id).single()
  check('profiles 자동 생성', data?.name === '테스터1', JSON.stringify(data))
  const { data: p } = await a.client.from('profile_private').select('*').eq('id', a.id).single()
  check('profile_private 자동 생성', p?.phone === '010-0000-0001', JSON.stringify(p))
}

console.log('\n▶ 비로그인(anon) 차단')
{
  const anon = client()
  const { data: priv } = await anon.from('profile_private').select('*')
  check('anon 은 연락처를 못 읽는다', (priv?.length ?? 0) === 0, `${priv?.length}건 노출`)

  const { data: prof } = await anon.from('profiles').select('*')
  check('anon 은 디렉터리를 못 읽는다', (prof?.length ?? 0) === 0, `${prof?.length}건 노출`)

  const { data: cfg } = await anon.from('app_settings').select('company_name').single()
  check('anon 도 설정은 읽는다 (로그인 화면용)', Boolean(cfg?.company_name))
}

console.log('\n▶ 로그인 사용자 간 격리  ★ 핵심')
{
  const { data } = await a.client.from('profile_private').select('*').eq('id', b.id)
  check('A 는 B 의 전화/이메일/ID 를 못 읽는다', (data?.length ?? 0) === 0, JSON.stringify(data))

  const { data: all } = await a.client.from('profile_private').select('*')
  check('연락처 전체 조회는 본인 1건뿐', all?.length === 1, `${all?.length}건 노출`)

  const { data: dir } = await a.client.from('profiles').select('name, department').eq('id', b.id)
  check('A 는 B 의 이름/부서는 볼 수 있다 (검색 카드)', dir?.length === 1, JSON.stringify(dir))
}

console.log('\n▶ 위조 방지')
{
  const { error } = await a.client
    .from('profiles')
    .insert({ id: crypto.randomUUID(), name: '가짜', department: '가짜' })
  check('클라이언트가 프로필을 직접 만들 수 없다', Boolean(error), '삽입 성공해버림')

  const { data } = await a.client
    .from('profile_private')
    .update({ phone: '010-9999-9999' })
    .eq('id', b.id)
    .select()
  check('A 가 B 의 연락처를 수정할 수 없다', (data?.length ?? 0) === 0, '수정됨')

  const { data: mine } = await a.client
    .from('profile_private')
    .update({ phone: '010-1111-2222' })
    .eq('id', a.id)
    .select()
  check('본인 연락처는 수정된다', mine?.length === 1)
}

console.log('\n▶ ID 중복 검사 RPC')
{
  const anon = client()
  const { data: taken } = await anon.rpc('is_login_id_available', { p_login_id: a.loginId })
  check('사용 중인 ID → false', taken === false, String(taken))
  const { data: free } = await anon.rpc('is_login_id_available', { p_login_id: `nobody${tag}` })
  check('미사용 ID → true', free === true, String(free))
}

console.log(`\n${fail === 0 ? '✅' : '❌'}  통과 ${pass} / 실패 ${fail}\n`)
process.exit(fail === 0 ? 0 : 1)

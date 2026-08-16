/** 인증 흐름 검증 (Phase 1).
 *
 *   npm run db:start && npm run test:auth
 *
 * 프론트의 validation.ts 규칙이 실제 DB CHECK 제약 및 Supabase Auth 설정과
 * 어긋나면 여기서 잡힌다 — 세 곳이 따로 관리되므로 자동 검증이 필요하다.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const AUTH_EMAIL_DOMAIN = 'gdc-life.local'

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
if (!URL_ || !KEY) {
  console.error('.env 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 필요합니다.')
  process.exit(1)
}

const client = () => createClient(URL_, KEY, { auth: { persistSession: false } })
const authEmail = (loginId) => `${loginId.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`

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

/** 프론트 signUp() 과 동일한 형태로 호출 */
function signUp(c, { loginId, password = 'gdclife1234', ...meta }) {
  return c.auth.signUp({
    email: authEmail(loginId),
    password,
    options: {
      data: {
        login_id: loginId.trim().toLowerCase(),
        name: meta.name ?? '홍길동',
        department: meta.department ?? '디지털솔루션팀',
        email: meta.email ?? `${loginId}@example.com`,
        phone: meta.phone ?? '010-1234-5678',
      },
    },
  })
}

// ── 1. 정상 가입 ──────────────────────────────────────────────
console.log('\n▶ 회원가입')
const mainId = `user${tag}`
{
  const c = client()
  const { data, error } = await signUp(c, {
    loginId: mainId,
    name: '김카풀',
    department: '스마트십솔루션팀',
    email: 'kim@example.com',
    phone: '010-9876-5432',
  })
  check('가입 성공', !error, error?.message)
  check('가입 즉시 세션 발급 (이메일 확인 비활성)', Boolean(data?.session))

  const { data: prof } = await c.from('profiles').select('name, department').eq('id', data.user.id).single()
  check('성명·부서가 그대로 저장', prof?.name === '김카풀' && prof?.department === '스마트십솔루션팀', JSON.stringify(prof))

  const { data: priv } = await c.from('profile_private').select('*').eq('id', data.user.id).single()
  check('ID·이메일·전화가 그대로 저장', priv?.login_id === mainId && priv?.phone === '010-9876-5432', JSON.stringify(priv))
}

// ── 2. 로그인 ─────────────────────────────────────────────────
console.log('\n▶ 로그인')
{
  const c = client()
  const { data, error } = await c.auth.signInWithPassword({
    email: authEmail(mainId),
    password: 'gdclife1234',
  })
  check('ID + 비밀번호로 로그인', !error && Boolean(data?.session), error?.message)

  const { error: wrong } = await client().auth.signInWithPassword({
    email: authEmail(mainId),
    password: 'wrongpass123',
  })
  check('잘못된 비밀번호 거부', Boolean(wrong), '로그인 성공해버림')

  const { error: nobody } = await client().auth.signInWithPassword({
    email: authEmail(`nobody${tag}`),
    password: 'gdclife1234',
  })
  check('없는 ID 거부', Boolean(nobody), '로그인 성공해버림')
}

// ── 3. ID 중복 ────────────────────────────────────────────────
console.log('\n▶ ID 중복')
{
  const { data: avail } = await client().rpc('is_login_id_available', { p_login_id: mainId })
  check('RPC 가 중복을 알려준다', avail === false, String(avail))

  const { data, error } = await signUp(client(), { loginId: mainId })
  check('중복 ID 가입 차단', Boolean(error) || !data?.session, '가입되어버림')
}

// ── 4. 비밀번호 정책 (config.toml 과 일치해야 함) ──────────────
console.log('\n▶ 비밀번호 정책')
{
  const { error: short } = await signUp(client(), { loginId: `pw1${tag}`, password: 'ab12' })
  check('8자 미만 거부', Boolean(short), '가입되어버림')

  const { error: noDigit } = await signUp(client(), { loginId: `pw2${tag}`, password: 'abcdefgh' })
  check('숫자 없는 비밀번호 거부 (letters_digits)', Boolean(noDigit), '가입되어버림')
}

// ── 5. DB CHECK 제약 (validation.ts 와 일치해야 함) ────────────
console.log('\n▶ 형식 제약')
{
  const { error: badPhone } = await signUp(client(), { loginId: `ph${tag}`, phone: '12345' })
  check('잘못된 전화번호 형식 거부', Boolean(badPhone), '가입되어버림')

  const { error: badEmail } = await signUp(client(), { loginId: `em${tag}`, email: 'not-an-email' })
  check('잘못된 이메일 형식 거부', Boolean(badEmail), '가입되어버림')

  const { error: badId } = await signUp(client(), { loginId: `ab` })
  check('4자 미만 ID 거부', Boolean(badId), '가입되어버림')
}

// ── 6. ID 대소문자 정규화 ─────────────────────────────────────
console.log('\n▶ ID 정규화')
{
  const upper = `MiXeD${tag}`
  const c = client()
  const { data, error } = await signUp(c, { loginId: upper })
  check('대문자 ID 가입 허용', !error, error?.message)

  if (data?.user) {
    const { data: priv } = await c.from('profile_private').select('login_id').eq('id', data.user.id).single()
    check('소문자로 정규화되어 저장', priv?.login_id === upper.toLowerCase(), priv?.login_id)

    const { error: loginErr } = await client().auth.signInWithPassword({
      email: authEmail(upper.toUpperCase()),
      password: 'gdclife1234',
    })
    check('대소문자 무관하게 로그인', !loginErr, loginErr?.message)
  }
}

console.log(`\n${fail === 0 ? '✅' : '❌'}  통과 ${pass} / 실패 ${fail}\n`)
process.exit(fail === 0 ? 0 : 1)

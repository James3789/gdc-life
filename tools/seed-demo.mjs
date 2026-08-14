/** 로컬 테스트용 데모 계정 생성.
 *
 *   npm run seed
 *
 * db:reset 하면 계정이 모두 사라지므로 다시 실행하면 된다.
 * 이미 있는 계정은 건너뛴다. 운영 환경에서는 절대 실행하지 말 것.
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

if (!URL_.includes('127.0.0.1') && !URL_.includes('localhost')) {
  console.error(`\n⚠ 로컬 스택이 아닙니다 (${URL_}). 데모 계정 생성을 중단합니다.\n`)
  process.exit(1)
}

const PASSWORD = 'gdclife1234'

const ACCOUNTS = [
  { loginId: 'driver1', name: '김봉사', department: '스마트십솔루션팀', phone: '010-1111-1111' },
  { loginId: 'driver2', name: '박운전', department: '디지털솔루션팀', phone: '010-2222-2222' },
  { loginId: 'rider1', name: '이탑승', department: '기술연구소', phone: '010-3333-3333' },
  { loginId: 'rider2', name: '최동승', department: '경영지원팀', phone: '010-4444-4444' },
]

const supabase = createClient(URL_, KEY, { auth: { persistSession: false } })

console.log('')
for (const acc of ACCOUNTS) {
  const { data: available } = await supabase.rpc('is_login_id_available', {
    p_login_id: acc.loginId,
  })

  if (available === false) {
    console.log(`  · ${acc.loginId.padEnd(8)} 이미 존재 — 건너뜀`)
    continue
  }

  const { error } = await supabase.auth.signUp({
    email: `${acc.loginId}@gdc-life.local`,
    password: PASSWORD,
    options: {
      data: {
        login_id: acc.loginId,
        name: acc.name,
        department: acc.department,
        email: `${acc.loginId}@example.com`,
        phone: acc.phone,
      },
    },
  })

  if (error) console.log(`  ✗ ${acc.loginId.padEnd(8)} 실패: ${error.message}`)
  else console.log(`  ✓ ${acc.loginId.padEnd(8)} ${acc.name} / ${acc.department}`)
}

console.log(`
──────────────────────────────
  비밀번호는 모두  ${PASSWORD}
──────────────────────────────
`)

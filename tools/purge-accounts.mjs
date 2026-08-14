/** 계정 정리 — 관리자와 지정한 계정만 남기고 나머지를 삭제한다.
 *
 *   npm run purge                          # 미리보기 (아무것도 지우지 않음)
 *   npm run purge -- --keep=driver1,rider1 # 추가로 남길 계정
 *   npm run purge -- --yes                 # 실제 삭제
 *
 * 관리자(admin_users)는 옵션과 무관하게 항상 보존된다.
 *
 * auth.users 를 지우면 아래가 모두 함께 삭제된다 (ON DELETE CASCADE):
 *   profiles → profile_private / carpool_offers → carpool_requests / driver_ratings / admin_users
 *
 * SUPABASE_SERVICE_ROLE_KEY 가 필요하다.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { createClient } from '@supabase/supabase-js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const AUTH_EMAIL_DOMAIN = 'gdc-life.local'

function env(key) {
  try {
    for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
      if (m && m[1] === key) return m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* .env 없음 */
  }
  return process.env[key] ?? ''
}

/** 합성 이메일에서 사내 ID 를 복원 */
function loginIdOf(user) {
  return user.email?.endsWith(`@${AUTH_EMAIL_DOMAIN}`)
    ? user.email.slice(0, -(AUTH_EMAIL_DOMAIN.length + 1))
    : (user.email ?? user.id)
}

function isLocalProject(url) {
  let host
  try {
    host = new URL(url).hostname
  } catch {
    return false
  }
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
  )
}

async function main() {
  const URL_ = env('VITE_SUPABASE_URL')
  const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')

  if (!URL_ || !SERVICE_KEY) {
    console.error(`
SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.
  로컬    : npx supabase status 의 SERVICE_ROLE_KEY
  클라우드 : Dashboard → Project Settings → API → service_role
.env 에 넣거나 환경변수로 전달하세요.
`)
    return 1
  }

  const args = process.argv.slice(2)
  const execute = args.includes('--yes')
  const keepArg = args.find((a) => a.startsWith('--keep='))
  const keepLoginIds = new Set(
    (keepArg ? keepArg.slice('--keep='.length) : '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )

  const admin = createClient(URL_, SERVICE_KEY, { auth: { persistSession: false } })

  // ── 관리자는 무조건 보존 ────────────────────────────────────
  const { data: adminRows, error: adminErr } = await admin.from('admin_users').select('user_id')
  if (adminErr) {
    console.error(`관리자 목록을 읽지 못했습니다: ${adminErr.message}`)
    return 1
  }
  const adminIds = new Set((adminRows ?? []).map((r) => r.user_id))

  // ── 전체 사용자 수집 ────────────────────────────────────────
  const users = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) {
      console.error(`사용자 목록 조회 실패: ${error.message}`)
      return 1
    }
    users.push(...data.users)
    if (data.users.length < 200) break
  }

  const keep = []
  const remove = []
  for (const user of users) {
    const loginId = loginIdOf(user)
    if (adminIds.has(user.id)) keep.push({ user, loginId, why: '관리자' })
    else if (keepLoginIds.has(loginId.toLowerCase())) keep.push({ user, loginId, why: '--keep' })
    else remove.push({ user, loginId })
  }

  console.log(`
대상 프로젝트 : ${URL_}
전체 계정     : ${users.length}
보존          : ${keep.length}
삭제 예정     : ${remove.length}
`)

  if (keep.length > 0) {
    console.log('보존할 계정')
    for (const k of keep) console.log(`  · ${k.loginId.padEnd(16)} (${k.why})`)
    console.log('')
  }

  if (remove.length === 0) {
    console.log('삭제할 계정이 없습니다.\n')
    return 0
  }

  console.log('삭제할 계정')
  for (const r of remove.slice(0, 40)) console.log(`  ✗ ${r.loginId}`)
  if (remove.length > 40) console.log(`  … 외 ${remove.length - 40}건`)

  if (!execute) {
    console.log(`
── 미리보기입니다. 아무것도 삭제하지 않았습니다. ──
실제로 지우려면 --yes 를 붙이세요:
  npm run purge -- --yes${keepArg ? ` ${keepArg}` : ''}
`)
    return 0
  }

  // ── 운영 프로젝트면 한 번 더 확인받는다 ─────────────────────
  if (!isLocalProject(URL_)) {
    console.log(`
⚠ 로컬이 아닌 프로젝트입니다: ${URL_}
  ${remove.length}개 계정과 그에 딸린 카풀·신청·별점이 모두 삭제되며 되돌릴 수 없습니다.
`)
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const answer = await rl.question('계속하려면 DELETE 를 입력하세요: ')
    rl.close()
    if (answer.trim() !== 'DELETE') {
      console.log('취소했습니다.\n')
      return 1
    }
  }

  let ok = 0
  const failed = []
  for (const r of remove) {
    const { error } = await admin.auth.admin.deleteUser(r.user.id)
    if (error) failed.push(`${r.loginId}: ${error.message}`)
    else ok++
  }

  console.log(`\n삭제 완료 ${ok}건${failed.length ? ` / 실패 ${failed.length}건` : ''}`)
  for (const f of failed.slice(0, 10)) console.log(`  ✗ ${f}`)
  console.log('')
  return failed.length ? 1 : 0
}

// process.exit() 로 즉시 끝내면 Windows 에서 libuv 어서션이 뜬다.
// 종료 코드만 정하고 이벤트 루프가 자연히 비도록 둔다.
process.exitCode = await main()

/** 최초 1회 설치. 실행:  npm run setup */

import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const isWin = process.platform === 'win32'

// 1) .env
if (existsSync(join(ROOT, '.env'))) {
  console.log('✓ .env 이미 존재')
} else {
  copyFileSync(join(ROOT, '.env.example'), join(ROOT, '.env'))
  console.log('✓ .env 생성 — VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 채워주세요')
}

// 2) 프론트 패키지
console.log('\n▶ 프론트 패키지 설치')
const r = spawnSync(isWin ? 'npm.cmd' : 'npm', ['install', '--no-fund', '--no-audit'], {
  cwd: join(ROOT, 'frontend'),
  stdio: 'inherit',
  shell: isWin,
})
if (r.status !== 0) process.exit(r.status ?? 1)

console.log(`
✅ 설치 완료.

다음 순서로 진행하세요:
  1. Supabase 프로젝트 준비
       로컬  →  npm run db:start   (Docker 필요)
       클라우드 → supabase.com 에서 프로젝트 생성 후
                  npx supabase link --project-ref <ref> && npm run db:push
  2. .env 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 입력
  3. npm run dev
`)

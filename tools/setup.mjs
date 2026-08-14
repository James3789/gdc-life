/** 최초 1회 설치. 실행:  npm run setup */

import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const isWin = process.platform === 'win32'
const venvPython = join(ROOT, 'backend', '.venv', isWin ? 'Scripts' : 'bin', isWin ? 'python.exe' : 'python')

function step(label, cmd, args, cwd = ROOT) {
  console.log(`\n▶ ${label}`)
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: isWin })
  if (r.status !== 0) {
    console.error(`✗ 실패: ${label}`)
    process.exit(r.status ?? 1)
  }
}

// 1) .env
if (!existsSync(join(ROOT, '.env'))) {
  copyFileSync(join(ROOT, '.env.example'), join(ROOT, '.env'))
  console.log('✓ .env 생성 (.env.example 복사) — KAKAO 키를 채워주세요')
} else {
  console.log('✓ .env 이미 존재')
}

// 2) python venv + 패키지
if (!existsSync(venvPython)) {
  step('python 가상환경 생성', isWin ? 'python' : 'python3', ['-m', 'venv', join(ROOT, 'backend', '.venv')])
}
step('백엔드 패키지 설치', venvPython, ['-m', 'pip', 'install', '-q', '-r', join(ROOT, 'backend', 'requirements.txt')])

// 3) 프론트 패키지
step('프론트 패키지 설치', isWin ? 'npm.cmd' : 'npm', ['install', '--no-fund', '--no-audit'], join(ROOT, 'frontend'))

console.log('\n✅ 설치 완료.  `npm run dev` 로 실행하세요.\n')

/** 백엔드 + 프론트 개발 서버를 한 번에 실행. (외부 의존성 없음)
 *  실행:  npm run dev
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const isWin = process.platform === 'win32'

const venvPython = join(ROOT, 'backend', '.venv', isWin ? 'Scripts' : 'bin', isWin ? 'python.exe' : 'python')

if (!existsSync(venvPython)) {
  console.error('\n[!] backend/.venv 가 없습니다. 먼저 `npm run setup` 을 실행하세요.\n')
  process.exit(1)
}
if (!existsSync(join(ROOT, '.env'))) {
  console.error('\n[!] .env 가 없습니다. `.env.example` 을 복사해 만드세요.\n')
  process.exit(1)
}

const COLORS = { api: '\x1b[36m', web: '\x1b[35m', reset: '\x1b[0m' }

function run(name, cmd, args, cwd) {
  const child = spawn(cmd, args, { cwd, shell: isWin, env: process.env })
  const prefix = `${COLORS[name]}[${name}]${COLORS.reset} `
  const pipe = (stream, out) => {
    stream.setEncoding('utf8')
    let buf = ''
    stream.on('data', (chunk) => {
      buf += chunk
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) out.write(prefix + line + '\n')
    })
  }
  pipe(child.stdout, process.stdout)
  pipe(child.stderr, process.stderr)
  child.on('exit', (code) => {
    console.log(`${prefix}종료 (code ${code})`)
    shutdown()
  })
  return child
}

const children = [
  run('api', venvPython, ['run.py'], join(ROOT, 'backend')),
  run('web', isWin ? 'npm.cmd' : 'npm', ['run', 'dev'], join(ROOT, 'frontend')),
]

let closing = false
function shutdown() {
  if (closing) return
  closing = true
  for (const c of children) if (!c.killed) c.kill()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

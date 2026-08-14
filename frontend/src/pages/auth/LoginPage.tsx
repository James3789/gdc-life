import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { Alert, Button, Field } from '../../components/ui'
import { useAppConfig } from '../../lib/appConfig'
import { useAuth } from '../../lib/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()
  const company = useAppConfig()?.company

  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // 보호된 화면으로 진입하려다 튕긴 경우 원래 목적지로 되돌려 보낸다
  const from = (location.state as { from?: string } | null)?.from ?? '/home'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(loginId, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center bg-slate-50 px-6 py-10">
      <header className="mb-8 text-center">
        <img src="/icons/favicon.svg" alt="" className="mx-auto h-16 w-16 rounded-2xl" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">GDC Life</h1>
        <p className="mt-1 text-[13px] text-slate-500">{company?.name ?? 'HD현대마린솔루션'}</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}

        <Field
          label="ID"
          required
          value={loginId}
          onChange={(e) => setLoginId(e.target.value.toLowerCase())}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="text"
          placeholder="사내 ID"
        />

        <Field
          label="비밀번호"
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="비밀번호"
        />

        <Button type="submit" full loading={busy} disabled={!loginId || !password}>
          로그인
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-slate-500">
        아직 계정이 없으신가요?{' '}
        <Link to="/signup" className="font-semibold text-brand-700 underline-offset-2 active:underline">
          회원가입
        </Link>
      </p>
    </div>
  )
}

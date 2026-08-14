import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import AppShell from '../../components/AppShell'
import { Alert, Button, Field } from '../../components/ui'
import { useAppConfig } from '../../lib/appConfig'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import {
  formatPhone,
  validateDepartment,
  validateEmail,
  validateLoginId,
  validateName,
  validatePassword,
  validatePhone,
} from '../../lib/validation'

type Form = {
  loginId: string
  password: string
  passwordConfirm: string
  name: string
  department: string
  email: string
  phone: string
}

const EMPTY: Form = {
  loginId: '',
  password: '',
  passwordConfirm: '',
  name: '',
  department: '',
  email: '',
  phone: '',
}

type IdCheck = 'idle' | 'checking' | 'available' | 'taken'

export default function SignupPage() {
  const navigate = useNavigate()
  const { signUp } = useAuth()
  const config = useAppConfig()

  const [form, setForm] = useState<Form>(EMPTY)
  const [touched, setTouched] = useState<Partial<Record<keyof Form, boolean>>>({})
  const [idCheck, setIdCheck] = useState<IdCheck>('idle')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const allowedDomains = config?.requireCompanyEmail ? config.companyEmailDomains : []

  const errors: Partial<Record<keyof Form, string | null>> = {
    loginId: validateLoginId(form.loginId),
    password: validatePassword(form.password),
    passwordConfirm:
      form.passwordConfirm !== form.password ? '비밀번호가 일치하지 않습니다.' : null,
    name: validateName(form.name),
    department: validateDepartment(form.department),
    email: validateEmail(form.email, allowedDomains),
    phone: validatePhone(form.phone),
  }

  const formValid = Object.values(errors).every((e) => e === null)
  const canSubmit = formValid && idCheck !== 'taken' && idCheck !== 'checking'

  // ID 중복 검사 — 형식이 맞을 때만, 입력이 멈추면 조회
  useEffect(() => {
    const loginId = form.loginId.trim().toLowerCase()
    if (validateLoginId(loginId) !== null) {
      setIdCheck('idle')
      return
    }

    setIdCheck('checking')
    let alive = true
    const timer = setTimeout(async () => {
      const { data, error: rpcError } = await supabase.rpc('is_login_id_available', {
        p_login_id: loginId,
      })
      if (!alive) return
      if (rpcError) setIdCheck('idle')
      else setIdCheck(data ? 'available' : 'taken')
    }, 400)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [form.loginId])

  function set<K extends keyof Form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function markTouched(key: keyof Form) {
    setTouched((prev) => ({ ...prev, [key]: true }))
  }

  /** 제출 전에는 건드린 필드만, 제출 후에는 전부 표시 */
  function errorOf(key: keyof Form) {
    return touched[key] ? errors[key] : null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched({
      loginId: true,
      password: true,
      passwordConfirm: true,
      name: true,
      department: true,
      email: true,
      phone: true,
    })
    setError(null)
    if (!canSubmit) return

    setBusy(true)
    try {
      await signUp(form)
      // 이메일 확인이 꺼져 있어 가입 즉시 로그인된다
      navigate('/home', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '가입에 실패했습니다.')
      if (err instanceof Error && err.message.includes('ID')) setIdCheck('taken')
    } finally {
      setBusy(false)
    }
  }

  const idHint = {
    idle: '영문 소문자, 숫자, 밑줄(_) 4~20자',
    checking: '확인 중…',
    available: '✓ 사용할 수 있는 ID입니다.',
    taken: '',
  }[idCheck]

  return (
    <AppShell title="회원가입" subtitle="GDC Life" back tabs={false}>
      <form onSubmit={handleSubmit} className="space-y-4 pb-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}

        <Field
          label="ID"
          required
          value={form.loginId}
          onChange={(e) => set('loginId', e.target.value.toLowerCase().replace(/\s/g, ''))}
          onBlur={() => markTouched('loginId')}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="hong_gd"
          error={errorOf('loginId') ?? (idCheck === 'taken' ? '이미 사용 중인 ID입니다.' : null)}
          hint={
            idCheck === 'available' ? (
              <span className="font-medium text-emerald-600">{idHint}</span>
            ) : (
              idHint
            )
          }
        />

        <Field
          label="비밀번호"
          required
          type="password"
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          onBlur={() => markTouched('password')}
          autoComplete="new-password"
          error={errorOf('password')}
          hint="영문과 숫자를 포함해 8자 이상"
        />

        <Field
          label="비밀번호 확인"
          required
          type="password"
          value={form.passwordConfirm}
          onChange={(e) => set('passwordConfirm', e.target.value)}
          onBlur={() => markTouched('passwordConfirm')}
          autoComplete="new-password"
          error={errorOf('passwordConfirm')}
        />

        <Field
          label="성명"
          required
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          onBlur={() => markTouched('name')}
          autoComplete="name"
          placeholder="홍길동"
          error={errorOf('name')}
        />

        <Field
          label="부서"
          required
          value={form.department}
          onChange={(e) => set('department', e.target.value)}
          onBlur={() => markTouched('department')}
          placeholder="디지털솔루션팀"
          error={errorOf('department')}
        />

        <Field
          label="이메일"
          required
          type="email"
          inputMode="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          onBlur={() => markTouched('email')}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="hong@example.com"
          error={errorOf('email')}
          hint={
            allowedDomains.length > 0 ? `사내 도메인만 가능: ${allowedDomains.join(', ')}` : undefined
          }
        />

        <Field
          label="전화번호"
          required
          type="tel"
          inputMode="numeric"
          value={form.phone}
          onChange={(e) => set('phone', formatPhone(e.target.value))}
          onBlur={() => markTouched('phone')}
          autoComplete="tel"
          placeholder="010-1234-5678"
          error={errorOf('phone')}
          hint="매칭이 성립한 상대에게만 공개됩니다."
        />

        <Button type="submit" full loading={busy} disabled={!canSubmit} className="mt-2">
          가입하기
        </Button>

        <p className="pt-1 text-center text-[13px] text-slate-500">
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="font-semibold text-brand-700">
            로그인
          </Link>
        </p>
      </form>
    </AppShell>
  )
}

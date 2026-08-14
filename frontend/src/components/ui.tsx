/** 공용 폼/버튼 UI. 모바일 터치 타깃(최소 44px)을 지킨다. */

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { useId } from 'react'

// ── 버튼 ──────────────────────────────────────────────────────
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
  loading?: boolean
  full?: boolean
}

const VARIANTS = {
  primary: 'bg-brand-600 text-white active:bg-brand-700 disabled:bg-brand-600/40',
  secondary:
    'bg-white text-slate-700 border border-slate-300 active:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-brand-700 active:bg-brand-50 disabled:text-slate-400',
}

export function Button({
  variant = 'primary',
  loading = false,
  full = false,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${full ? 'w-full' : ''} ${className}`}
    >
      {loading && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
}

// ── 입력 필드 ─────────────────────────────────────────────────
type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string
  error?: string | null
  hint?: ReactNode
  /** 오른쪽에 붙는 보조 영역 (예: 중복확인 버튼) */
  addon?: ReactNode
}

export function Field({ label, error, hint, addon, className = '', ...rest }: FieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-slate-700">
        {label}
        {rest.required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>

      <div className="flex gap-2">
        <input
          {...rest}
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`min-h-[48px] w-full flex-1 rounded-xl border bg-white px-3.5 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:outline-none ${
            error
              ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-100'
              : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'
          }`}
        />
        {addon}
      </div>

      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[12px] text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[12px] text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

// ── 알림 배너 ─────────────────────────────────────────────────
const TONES = {
  error: 'bg-rose-50 text-rose-800 border-rose-200',
  info: 'bg-brand-50 text-brand-800 border-brand-200',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
}

export function Alert({
  tone = 'info',
  children,
}: {
  tone?: keyof typeof TONES
  children: ReactNode
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border px-4 py-3 text-[13px] leading-relaxed ${TONES[tone]}`}
    >
      {children}
    </div>
  )
}

// ── 로딩 화면 ─────────────────────────────────────────────────
export function FullScreenLoader({ label = '불러오는 중…' }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <p className="text-[13px]">{label}</p>
      </div>
    </div>
  )
}

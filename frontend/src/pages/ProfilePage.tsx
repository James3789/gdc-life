import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import AppShell from '../components/AppShell'
import ComingSoon from '../components/ComingSoon'
import { Button } from '../components/ui'
import { useAuth } from '../lib/auth'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5">
      <dt className="shrink-0 text-[13px] text-slate-500">{label}</dt>
      <dd className="text-right text-[14px] font-medium break-all text-slate-900">
        {value || '—'}
      </dd>
    </div>
  )
}

export default function ProfilePage() {
  const { me, signOut } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  async function handleSignOut() {
    setBusy(true)
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <AppShell title="내 정보" subtitle={me ? `${me.name} · ${me.department}` : undefined}>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3.5 border-b border-slate-100 p-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-50 text-lg font-bold text-brand-700">
            {me?.name?.[0] ?? '?'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[16px] font-bold text-slate-900">{me?.name ?? '—'}</p>
            <p className="truncate text-[13px] text-slate-500">{me?.department ?? '—'}</p>
          </div>
        </div>

        <dl className="divide-y divide-slate-100">
          <Row label="ID" value={me?.loginId ?? ''} />
          <Row label="이메일" value={me?.email ?? ''} />
          <Row label="전화번호" value={me?.phone ?? ''} />
        </dl>
      </section>

      <p className="mt-2 px-1 text-[12px] leading-relaxed text-slate-500">
        전화번호는 카풀 신청이 <strong>허락된 상대</strong>에게만 공개됩니다.
      </p>

      <h3 className="mt-6 mb-2 px-1 text-sm font-semibold text-slate-500">별점</h3>
      <ComingSoon phase="Phase 6" items={['월간 · 연간 · 누적 점수', '최근 운행 이력']} />

      <Button variant="secondary" full loading={busy} onClick={handleSignOut} className="mt-6">
        로그아웃
      </Button>
    </AppShell>
  )
}

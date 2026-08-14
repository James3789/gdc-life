import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import AppShell from '../components/AppShell'
import { Alert, Button } from '../components/ui'
import { checkIsAdmin } from '../lib/admin'
import { useAuth } from '../lib/auth'
import { formatDateKo } from '../lib/dates'
import { DIRECTIONS } from '../lib/direction'
import { getMyRatingSummary, listMyRatings, type RatingEntry, type RatingSummary } from '../lib/ratings'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5">
      <dt className="shrink-0 text-[13px] text-slate-500">{label}</dt>
      <dd className="text-right text-[14px] font-medium break-all text-slate-900">{value || '—'}</dd>
    </div>
  )
}

function Stat({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl px-3 py-3.5 text-center ${
        highlight ? 'bg-brand-600 text-white' : 'bg-white text-slate-900'
      }`}
    >
      <p className={`text-[11px] ${highlight ? 'text-brand-100' : 'text-slate-500'}`}>{label}</p>
      <p className="mt-1 text-[22px] leading-none font-bold tabular-nums">{value}</p>
    </div>
  )
}

export default function ProfilePage() {
  const { me, signOut } = useAuth()
  const navigate = useNavigate()

  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<RatingSummary | null>(null)
  const [history, setHistory] = useState<RatingEntry[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([getMyRatingSummary(), listMyRatings(), checkIsAdmin()])
      .then(([s, h, admin]) => {
        if (!alive) return
        setSummary(s)
        setHistory(h)
        setIsAdmin(admin)
      })
      .catch((err: Error) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [])

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

      {/* 별점 */}
      <div className="mt-6 mb-2 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-slate-500">봉사 별점</h3>
        <Link to="/carpool/ranking" className="text-[13px] font-semibold text-brand-700">
          전체 순위 →
        </Link>
      </div>
      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
        <Stat label="이번 달" value={summary?.monthly ?? 0} />
        <Stat label="올해" value={summary?.yearly ?? 0} />
        <Stat label="누적" value={summary?.total ?? 0} highlight />
      </div>
      <p className="mt-2 px-1 text-[12px] text-slate-500">
        카풀 1회 운행완료 시 1점이 적립됩니다.
      </p>

      {/* 이력 */}
      <h3 className="mt-6 mb-2 px-1 text-sm font-semibold text-slate-500">최근 이력</h3>
      {history.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
          <p className="text-[13px] text-slate-500">
            아직 완료한 운행이 없습니다.
            <br />
            카풀을 등록하고 탑승자를 태워 보세요.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {history.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-50 text-[15px]">
                ⭐
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-slate-900">
                  {formatDateKo(entry.rideDate)} · {DIRECTIONS[entry.direction].label}
                </p>
                <p className="truncate text-[12px] text-slate-500">
                  {entry.originAddr} → {entry.destAddr}
                </p>
              </div>
              <span className="shrink-0 text-[14px] font-bold text-brand-700">
                +{entry.points}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* 관리자에게만 보인다 */}
      {isAdmin && (
        <Link
          to="/admin"
          className="mt-6 block rounded-xl border border-slate-300 bg-white py-3.5 text-center text-[14px] font-semibold text-slate-700 active:bg-slate-50"
        >
          🛠 관리자 — 가입 계정 확인
        </Link>
      )}

      <Button variant="secondary" full loading={busy} onClick={handleSignOut} className="mt-3">
        로그아웃
      </Button>
    </AppShell>
  )
}

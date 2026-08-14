import { useCallback, useEffect, useState, type FormEvent } from 'react'

import AppShell from '../components/AppShell'
import { Alert, Button } from '../components/ui'
import { checkIsAdmin, getStats, listAccounts, type AdminAccount, type AdminStats } from '../lib/admin'

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white px-2 py-3 text-center">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 text-[18px] leading-none font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default function AdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [accounts, setAccounts] = useState<AdminAccount[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (q = '') => {
    setLoading(true)
    setError(null)
    try {
      const [list, s] = await Promise.all([listAccounts(q), getStats()])
      setAccounts(list)
      setStats(s)
    } catch (err) {
      setError(err instanceof Error ? err.message : '불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let alive = true
    checkIsAdmin().then((ok) => {
      if (!alive) return
      setAllowed(ok)
      if (ok) load()
      else setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [load])

  function handleSearch(e: FormEvent) {
    e.preventDefault()
    load(query)
  }

  if (allowed === false) {
    return (
      <AppShell title="관리자" back>
        <Alert tone="error">
          관리자만 접근할 수 있는 화면입니다. 권한이 필요하면 운영 담당자에게 문의하세요.
        </Alert>
      </AppShell>
    )
  }

  return (
    <AppShell title="관리자" subtitle="가입 계정 확인" back>
      {error && <Alert tone="error">{error}</Alert>}

      {/* 현황 */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
        <StatCell label="가입자" value={stats?.users ?? 0} />
        <StatCell label="등록 카풀" value={stats?.offers ?? 0} />
        <StatCell label="신청" value={stats?.requests ?? 0} />
        <StatCell label="매칭 성립" value={stats?.matched ?? 0} />
        <StatCell label="운행완료" value={stats?.completed ?? 0} />
        <StatCell label="누적 별점" value={stats?.points ?? 0} />
      </div>

      {/* 검색 */}
      <form onSubmit={handleSearch} className="mt-4 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ID · 이름 · 부서 · 이메일"
          className="min-h-[44px] flex-1 rounded-xl border border-slate-300 px-3.5 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
        />
        <Button type="submit" className="min-h-[44px] px-4">
          검색
        </Button>
      </form>

      {/* 계정 목록 */}
      <h3 className="mt-5 mb-2 px-1 text-sm font-semibold text-slate-500">
        가입 계정 {accounts.length}건
      </h3>

      {loading ? (
        <p className="px-1 text-[13px] text-slate-400">불러오는 중…</p>
      ) : accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
          <p className="text-[13px] text-slate-500">검색 결과가 없습니다.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {accounts.map((a) => (
            <li key={a.userId} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-slate-900">
                    {a.name}
                    <span className="ml-1.5 text-[12px] font-normal text-slate-500">
                      {a.department}
                    </span>
                    {a.isAdmin && (
                      <span className="ml-1.5 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        관리자
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 font-mono text-[12px] text-slate-500">{a.loginId}</p>
                </div>
                <p className="shrink-0 text-[11px] text-slate-400">{formatDate(a.createdAt)} 가입</p>
              </div>

              <dl className="mt-2.5 space-y-1 text-[12px]">
                <div className="flex gap-2">
                  <dt className="w-14 shrink-0 text-slate-500">이메일</dt>
                  <dd className="min-w-0 flex-1 break-all text-slate-800">{a.email}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-14 shrink-0 text-slate-500">전화</dt>
                  <dd className="flex-1 text-slate-800">{a.phoneMasked}</dd>
                </div>
              </dl>

              <div className="mt-2.5 flex gap-3 border-t border-slate-100 pt-2.5 text-[12px] text-slate-500">
                <span>
                  등록 <strong className="text-slate-700">{a.offers}</strong>
                </span>
                <span>
                  운행 <strong className="text-slate-700">{a.rides}</strong>
                </span>
                <span>
                  별점 <strong className="text-brand-700">{a.points}</strong>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 px-1 text-[12px] leading-relaxed text-slate-400">
        전화번호는 서버에서 마스킹되어 전달됩니다. 관리자도 원본은 조회할 수 없습니다.
      </p>
    </AppShell>
  )
}

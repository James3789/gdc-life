import { useCallback, useEffect, useState } from 'react'

import AppShell from '../../components/AppShell'
import { Alert } from '../../components/ui'
import {
  PERIOD_LABEL,
  getLeaderboard,
  getMyRank,
  type MyRank,
  type RankPeriod,
  type RankRow,
} from '../../lib/ranking'

const PERIODS: RankPeriod[] = ['month', 'year', 'total']

/** 1~3위는 메달, 그 외는 숫자 */
function RankBadge({ rank }: { rank: number }) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
  if (medal) return <span className="text-[20px] leading-none">{medal}</span>
  return (
    <span className="text-[15px] font-bold tabular-nums text-slate-400">{rank}</span>
  )
}

export default function RankingPage() {
  const [period, setPeriod] = useState<RankPeriod>('total')
  const [rows, setRows] = useState<RankRow[]>([])
  const [myRank, setMyRank] = useState<MyRank | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (p: RankPeriod) => {
    setLoading(true)
    setError(null)
    try {
      const [list, mine] = await Promise.all([getLeaderboard(p), getMyRank(p)])
      setRows(list)
      setMyRank(mine)
    } catch (err) {
      setError(err instanceof Error ? err.message : '불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(period)
  }, [load, period])

  const meInList = rows.some((r) => r.isMe)

  return (
    <AppShell title="봉사 별점 순위" subtitle="카풀 운행완료 1회당 1점" back>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-200/70 p-1">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`rounded-lg py-2.5 text-sm font-semibold transition-colors ${
              period === p ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {/* 목록 밖이면 내 등수를 따로 보여준다 */}
      {myRank && !meInList && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-brand-300 bg-brand-50 px-4 py-3">
          <RankBadge rank={myRank.rank} />
          <p className="flex-1 text-[14px] font-semibold text-brand-800">내 등수</p>
          <p className="text-[15px] font-bold text-brand-800">{myRank.points}점</p>
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <p className="px-1 text-[13px] text-slate-400">불러오는 중…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
            <p className="text-[14px] font-semibold text-slate-700">
              {PERIOD_LABEL[period]} 적립된 별점이 없습니다.
            </p>
            <p className="mt-1.5 text-[13px] text-slate-500">
              카풀을 운행하고 완료 처리하면 순위에 오릅니다.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.userId}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  row.isMe ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white'
                }`}
              >
                <span className="grid w-8 shrink-0 place-items-center">
                  <RankBadge rank={row.rank} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-slate-900">
                    {row.name}
                    {row.isMe && (
                      <span className="ml-1.5 rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        나
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[12px] text-slate-500">{row.department}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[16px] leading-none font-bold text-brand-700 tabular-nums">
                    {row.points}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">{row.rides}회</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 px-1 text-[12px] leading-relaxed text-slate-400">
        순위에는 이름과 부서만 표시됩니다. 연락처는 포함되지 않습니다.
      </p>
    </AppShell>
  )
}

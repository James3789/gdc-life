import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import AppShell from '../../components/AppShell'
import { Alert, Button } from '../../components/ui'
import {
  WEEKDAY_LABELS,
  formatDateKo,
  formatTimeKo,
  hasDeparted,
  monthGrid,
  todayISO,
} from '../../lib/dates'
import { DIRECTIONS } from '../../lib/direction'
import { formatDistance } from '../../lib/geo'
import { OFFER_STATUS_LABEL, cancelOffer, listMyOffers, type Offer } from '../../lib/offers'
import { completeOffer } from '../../lib/ratings'

const STATUS_STYLE: Record<Offer['status'], string> = {
  open: 'bg-brand-50 text-brand-700',
  full: 'bg-amber-50 text-amber-700',
  done: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-slate-100 text-slate-400 line-through',
}

export default function CalendarPage() {
  const today = todayISO()
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selected, setSelected] = useState(today)
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const days = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setOffers(await listMyOffers(days[0], days[days.length - 1]))
    } catch (err) {
      setError(err instanceof Error ? err.message : '불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    reload()
  }, [reload])

  /** 날짜별로 묶어 달력 점 표시에 쓴다 */
  const byDate = useMemo(() => {
    const map = new Map<string, Offer[]>()
    for (const offer of offers) {
      if (offer.status === 'cancelled') continue
      const list = map.get(offer.rideDate) ?? []
      list.push(offer)
      map.set(offer.rideDate, list)
    }
    return map
  }, [offers])

  const selectedOffers = offers.filter((o) => o.rideDate === selected)

  function shiftMonth(delta: number) {
    setCursor(({ year, month }) => {
      const next = new Date(year, month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  async function handleCancel(offer: Offer, wholeGroup: boolean) {
    const label = wholeGroup ? '반복 등록 전체를' : '이 카풀을'
    if (!confirm(`${label} 취소할까요?`)) return
    try {
      await cancelOffer(offer.id, wholeGroup)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '취소하지 못했습니다.')
    }
  }

  async function handleComplete(offer: Offer) {
    if (!confirm('운행완료로 처리할까요? 별점 1점이 적립됩니다.')) return
    setError(null)
    try {
      await completeOffer(offer.id)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '완료 처리하지 못했습니다.')
    }
  }

  return (
    <AppShell
      title="내 카풀 달력"
      subtitle="등록 현황"
      action={
        <Link
          to="/carpool/offer/new"
          className="rounded-lg bg-brand-600 px-3 py-2 text-[13px] font-semibold text-white active:bg-brand-700"
        >
          + 등록
        </Link>
      }
    >
      {error && <Alert tone="error">{error}</Alert>}

      {/* 월 이동 */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="이전 달"
          className="rounded-lg px-3 py-2 text-slate-500 active:bg-slate-100"
        >
          ‹
        </button>
        <p className="text-[15px] font-bold text-slate-900">
          {cursor.year}년 {cursor.month + 1}월
        </p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="다음 달"
          className="rounded-lg px-3 py-2 text-slate-500 active:bg-slate-100"
        >
          ›
        </button>
      </div>

      {/* 달력 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-2">
        <div className="grid grid-cols-7">
          {WEEKDAY_LABELS.map((label, i) => (
            <div
              key={label}
              className={`py-1.5 text-center text-[11px] font-semibold ${
                i === 0 ? 'text-rose-400' : i === 6 ? 'text-brand-500' : 'text-slate-400'
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((iso) => {
            const date = Number(iso.slice(8, 10))
            const inMonth = Number(iso.slice(5, 7)) === cursor.month + 1
            const dayOffers = byDate.get(iso) ?? []
            const isSelected = iso === selected
            const isToday = iso === today

            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelected(iso)}
                className={`relative aspect-square rounded-lg text-[13px] transition-colors ${
                  isSelected
                    ? 'bg-brand-600 font-bold text-white'
                    : inMonth
                      ? 'text-slate-800 active:bg-slate-100'
                      : 'text-slate-300'
                }`}
              >
                <span className={isToday && !isSelected ? 'font-bold text-brand-600' : undefined}>
                  {date}
                </span>
                {dayOffers.length > 0 && (
                  <span className="absolute inset-x-0 bottom-1.5 flex justify-center gap-0.5">
                    {dayOffers.slice(0, 3).map((o) => (
                      <span
                        key={o.id}
                        className={`h-1 w-1 rounded-full ${
                          isSelected
                            ? 'bg-white'
                            : o.direction === 'commute-in'
                              ? 'bg-brand-500'
                              : 'bg-amber-500'
                        }`}
                      />
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 px-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> 출근
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> 퇴근
        </span>
      </div>

      {/* 선택한 날짜의 등록 목록 */}
      <h3 className="mt-6 mb-2 px-1 text-sm font-semibold text-slate-500">
        {formatDateKo(selected)}
      </h3>

      {loading ? (
        <p className="px-1 text-[13px] text-slate-400">불러오는 중…</p>
      ) : selectedOffers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
          <p className="text-[13px] text-slate-500">등록한 카풀이 없습니다.</p>
          <Link
            to={`/carpool/offer/new?date=${selected}`}
            className="mt-2 inline-block text-[13px] font-semibold text-brand-700"
          >
            카풀 등록하기 →
          </Link>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {selectedOffers.map((offer) => (
            <li key={offer.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-slate-900">
                    {DIRECTIONS[offer.direction].label} · {formatTimeKo(offer.departTime)}
                  </p>
                  <p className="mt-1 truncate text-[13px] text-slate-500">
                    {offer.origin.addr} → {offer.dest.addr}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${STATUS_STYLE[offer.status]}`}
                >
                  {OFFER_STATUS_LABEL[offer.status]}
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">
                <span>
                  좌석 <strong className="text-slate-700">{offer.seatsAvailable}</strong>/
                  {offer.seatsTotal}
                </span>
                {offer.waypoints.length > 0 && <span>경유지 {offer.waypoints.length}곳</span>}
                {offer.routeDistanceM !== null && <span>{formatDistance(offer.routeDistanceM)}</span>}
                {offer.recurringGroupId && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium">반복</span>
                )}
              </div>

              {(offer.status === 'open' || offer.status === 'full') && (
                <div className="mt-3 flex gap-2">
                  {hasDeparted(offer.rideDate, offer.departTime) ? (
                    <Button
                      onClick={() => handleComplete(offer)}
                      className="min-h-[40px] flex-1 text-[13px]"
                    >
                      운행완료
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => handleCancel(offer, false)}
                      className="min-h-[40px] flex-1 text-[13px]"
                    >
                      취소
                    </Button>
                  )}
                  {offer.recurringGroupId && !hasDeparted(offer.rideDate, offer.departTime) && (
                    <Button
                      variant="secondary"
                      onClick={() => handleCancel(offer, true)}
                      className="min-h-[40px] flex-1 text-[13px]"
                    >
                      반복 전체 취소
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}

import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import AppShell from '../../components/AppShell'
import KakaoMap, { type Pin } from '../../components/map/KakaoMap'
import PlacePicker from '../../components/map/PlacePicker'
import { Alert, Button } from '../../components/ui'
import { useAppConfig } from '../../lib/appConfig'
import { formatDateKo, formatTimeKo, todayISO } from '../../lib/dates'
import { DIRECTIONS, type Direction, isDirection } from '../../lib/direction'
import { formatDistance, formatDuration, type Place } from '../../lib/geo'
import { requestCarpool } from '../../lib/requests'
import { searchOffers, type Match } from '../../lib/search'

export default function SearchPage() {
  const [params] = useSearchParams()
  const config = useAppConfig()

  const raw = params.get('direction')
  const [direction, setDirection] = useState<Direction>(isDirection(raw) ? raw : 'commute-in')
  const [date, setDate] = useState(todayISO())
  const [point, setPoint] = useState<Place | null>(null)
  const [desiredTime, setDesiredTime] = useState('08:00')
  const [tolerance, setTolerance] = useState(10)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const meta = DIRECTIONS[direction]
  const toleranceOptions = config?.match.toleranceOptions ?? [10, 20, 30]

  async function handleSearch() {
    if (!point) {
      setError(`${meta.passengerInputLabel}를 지정해 주세요.`)
      return
    }
    setError(null)
    setBusy(true)
    try {
      const found = await searchOffers({ direction, date, point, desiredTime, toleranceMin: tolerance })
      setMatches(found)
      setExpanded(found[0]?.offerId ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '검색에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRequest(match: Match) {
    if (!point) return
    setError(null)
    try {
      await requestCarpool({
        offerId: match.offerId,
        board: point,
        desiredTime,
        toleranceMin: tolerance,
      })
      setMatches(
        (prev) =>
          prev?.map((m) => (m.offerId === match.offerId ? { ...m, alreadyRequested: true } : m)) ??
          null,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '신청에 실패했습니다.')
    }
  }

  return (
    <AppShell title="카풀 찾기" subtitle="탑승자" back>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        {/* 조건 */}
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1">
            {(Object.keys(DIRECTIONS) as Direction[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setDirection(key)
                  setDesiredTime(key === 'commute-in' ? '08:00' : '18:00')
                  setMatches(null)
                }}
                className={`rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                  direction === key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                {DIRECTIONS[key].label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Labeled label="날짜">
              <input
                type="date"
                value={date}
                min={todayISO()}
                onChange={(e) => setDate(e.target.value)}
                className={INPUT}
              />
            </Labeled>
            <Labeled label={meta.timeLabel}>
              <input
                type="time"
                value={desiredTime}
                onChange={(e) => setDesiredTime(e.target.value)}
                className={INPUT}
              />
            </Labeled>
          </div>

          <Labeled label={meta.passengerInputLabel}>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-left active:bg-slate-50"
            >
              {point ? (
                <span className="block truncate text-[14px] font-semibold text-slate-900">
                  {point.name ?? point.addr}
                </span>
              ) : (
                <span className="text-[14px] text-slate-400">지도에서 지정</span>
              )}
            </button>
          </Labeled>

          <Labeled label="시간 허용 범위">
            <div className="grid grid-cols-3 gap-2">
              {toleranceOptions.map((min) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => setTolerance(min)}
                  className={`min-h-[44px] rounded-xl border text-[14px] font-semibold transition-colors ${
                    tolerance === min
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  ±{min}분
                </button>
              ))}
            </div>
          </Labeled>

          <Button full loading={busy} onClick={handleSearch} disabled={!point}>
            카풀 찾기
          </Button>
        </section>

        {/* 결과 */}
        {matches !== null && (
          <section>
            <h3 className="mb-2 px-1 text-sm font-semibold text-slate-500">
              {formatDateKo(date)} · {meta.label} · {matches.length}건
            </h3>

            {matches.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
                <p className="text-[14px] font-semibold text-slate-700">조건에 맞는 카풀이 없습니다.</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
                  시간 허용 범위를 넓히거나
                  <br />
                  다른 날짜로 찾아보세요.
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {matches.map((match) => (
                  <MatchCard
                    key={match.offerId}
                    match={match}
                    direction={direction}
                    boardPoint={point}
                    expanded={expanded === match.offerId}
                    onToggle={() =>
                      setExpanded((prev) => (prev === match.offerId ? null : match.offerId))
                    }
                    onRequest={() => handleRequest(match)}
                  />
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <PlacePicker
        open={pickerOpen}
        title={`${meta.passengerInputLabel} 지정`}
        initial={point}
        onClose={() => setPickerOpen(false)}
        onSelect={(place) => {
          setPoint(place)
          setPickerOpen(false)
          setMatches(null)
        }}
      />
    </AppShell>
  )
}

const INPUT =
  'min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3.5 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none'

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 px-0.5 text-[13px] font-semibold text-slate-700">{label}</p>
      {children}
    </div>
  )
}

function MatchCard({
  match,
  direction,
  boardPoint,
  expanded,
  onToggle,
  onRequest,
}: {
  match: Match
  direction: Direction
  boardPoint: Place | null
  expanded: boolean
  onToggle: () => void
  onRequest: () => void
}) {
  const [busy, setBusy] = useState(false)

  const pins: Pin[] = [
    { id: 'o', position: match.origin, kind: direction === 'commute-in' ? 'origin' : 'company' },
    ...match.waypoints.map((w, i) => ({
      id: `w${i}`,
      position: w,
      kind: 'waypoint' as const,
      label: `경유 ${i + 1}`,
    })),
    { id: 'd', position: match.dest, kind: direction === 'commute-in' ? 'company' : 'dest' },
  ]
  if (boardPoint) pins.push({ id: 'me', position: boardPoint, kind: 'me', label: '내 위치' })

  return (
    <li className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button type="button" onClick={onToggle} className="w-full p-4 text-left active:bg-slate-50">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-slate-900">
              {match.driverName}
              <span className="ml-1.5 text-[12px] font-normal text-slate-500">
                {match.driverDepartment}
              </span>
            </p>
            <p className="mt-0.5 text-[12px] text-slate-500">
              ⭐ 누적 {match.driverPoints}점
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[17px] font-bold text-brand-700">{formatTimeKo(match.estTime)}</p>
            <p className="text-[11px] text-slate-500">
              {direction === 'commute-in' ? '예상 픽업' : '회사 출발'}
              {match.timeDiffMin > 0 && ` · ${match.timeDiffMin}분 차이`}
            </p>
          </div>
        </div>

        <p className="mt-2.5 truncate text-[13px] text-slate-600">
          {match.origin.addr} → {match.dest.addr}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">
          <span className="font-medium text-slate-700">
            내 위치에서 {formatDistance(match.detourM)}
          </span>
          <span>
            좌석 <strong className="text-slate-700">{match.seatsAvailable}</strong>/
            {match.seatsTotal}
          </span>
          {match.waypoints.length > 0 && <span>경유지 {match.waypoints.length}곳</span>}
          {match.routeDistanceM !== null && match.routeDurationS !== null && (
            <span>
              {formatDistance(match.routeDistanceM)} · {formatDuration(match.routeDurationS)}
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-4 pt-3">
          <KakaoMap
            className="h-44 w-full"
            pins={pins}
            path={match.routePath.length >= 2 ? match.routePath : undefined}
          />
          {match.alreadyRequested ? (
            <div className="mt-3 rounded-xl bg-slate-100 py-3 text-center text-[14px] font-semibold text-slate-500">
              신청 완료 · 봉사자 확인 대기 중
            </div>
          ) : (
            <Button
              full
              loading={busy}
              className="mt-3"
              onClick={async () => {
                setBusy(true)
                await onRequest()
                setBusy(false)
              }}
            >
              카풀 신청
            </Button>
          )}
        </div>
      )}
    </li>
  )
}

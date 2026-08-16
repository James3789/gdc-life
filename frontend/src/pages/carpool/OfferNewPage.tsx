import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import AppShell from '../../components/AppShell'
import KakaoMap, { type Pin } from '../../components/map/KakaoMap'
import PlacePicker from '../../components/map/PlacePicker'
import { Alert, Button } from '../../components/ui'
import { useAppConfig } from '../../lib/appConfig'
import {
  WEEKDAYS,
  WEEKDAY_LABELS,
  addDays,
  expandRecurringDates,
  formatDateKo,
  todayISO,
} from '../../lib/dates'
import { DIRECTIONS, type Direction, isDirection } from '../../lib/direction'
import { fetchRoute, type Route } from '../../lib/directions'
import { formatDistance, formatDuration, type LatLng, type Place } from '../../lib/geo'
import { createOffers, getMyLastVehicleNo } from '../../lib/offers'
import { validateVehicleNo } from '../../lib/validation'

type PickerTarget = { kind: 'endpoint' } | { kind: 'waypoint'; index: number } | null

export default function OfferNewPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const config = useAppConfig()

  const raw = params.get('direction')
  const [direction, setDirection] = useState<Direction>(
    isDirection(raw) ? raw : 'commute-in',
  )

  const [rideDate, setRideDate] = useState(todayISO())
  const [departTime, setDepartTime] = useState('07:30')
  const [seats, setSeats] = useState(3)
  const [vehicleNo, setVehicleNo] = useState('')
  const [vehicleTouched, setVehicleTouched] = useState(false)

  // 매번 같은 차를 쓰는 경우가 대부분이라 지난번 번호를 채워 준다
  useEffect(() => {
    let alive = true
    getMyLastVehicleNo().then((last) => {
      if (alive && last) setVehicleNo(last)
    })
    return () => {
      alive = false
    }
  }, [])

  /** 봉사자가 직접 지정하는 지점 (출근=출발지, 퇴근=목적지) */
  const [endpoint, setEndpoint] = useState<Place | null>(null)
  const [waypoints, setWaypoints] = useState<Place[]>([])
  const [picker, setPicker] = useState<PickerTarget>(null)

  const [repeat, setRepeat] = useState(false)
  const [repeatEnd, setRepeatEnd] = useState(addDays(todayISO(), 28))
  const [repeatDays, setRepeatDays] = useState<number[]>(WEEKDAYS)

  const [route, setRoute] = useState<Route | null>(null)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [routing, setRouting] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const meta = DIRECTIONS[direction]
  const company: Place | null = config
    ? { lat: config.company.lat, lng: config.company.lng, addr: config.company.addr, name: config.company.name }
    : null

  // 출근이면 회사가 도착지, 퇴근이면 회사가 출발지
  const origin = direction === 'commute-in' ? endpoint : company
  const dest = direction === 'commute-in' ? company : endpoint

  const dates = useMemo(
    () => (repeat ? expandRecurringDates(rideDate, repeatEnd, repeatDays) : [rideDate]),
    [repeat, rideDate, repeatEnd, repeatDays],
  )

  // ── 경로 계산 (지점이 바뀌면 자동, 짧게 지연) ────────────────
  useEffect(() => {
    if (!origin || !dest) {
      setRoute(null)
      return
    }
    let alive = true
    setRouting(true)
    setRouteError(null)

    const timer = setTimeout(() => {
      fetchRoute(origin, dest, waypoints)
        .then((next) => alive && setRoute(next))
        .catch((err: Error) => {
          if (!alive) return
          setRoute(null)
          setRouteError(err.message)
        })
        .finally(() => alive && setRouting(false))
    }, 500)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [origin?.lat, origin?.lng, dest?.lat, dest?.lng, waypoints]) // eslint-disable-line react-hooks/exhaustive-deps

  const pins: Pin[] = []
  if (origin) pins.push({ id: 'origin', position: origin, kind: direction === 'commute-in' ? 'origin' : 'company' })
  waypoints.forEach((w, i) =>
    pins.push({ id: `wp-${i}`, position: w, kind: 'waypoint', label: `경유 ${i + 1}` }),
  )
  if (dest) pins.push({ id: 'dest', position: dest, kind: direction === 'commute-in' ? 'company' : 'dest' })

  function handlePicked(place: Place) {
    if (picker?.kind === 'endpoint') setEndpoint(place)
    else if (picker?.kind === 'waypoint') {
      setWaypoints((prev) => {
        const next = [...prev]
        if (picker.index === next.length) next.push(place)
        else next[picker.index] = place
        return next
      })
    }
    setPicker(null)
  }

  const vehicleError = validateVehicleNo(vehicleNo)

  async function handleSubmit() {
    setError(null)
    if (!origin || !dest) {
      setError(`${meta.driverInputLabel}를 지정해 주세요.`)
      return
    }
    if (vehicleError) {
      setVehicleTouched(true)
      setError(vehicleError)
      return
    }
    if (dates.length === 0) {
      setError('등록할 날짜가 없습니다. 요일과 기간을 확인해 주세요.')
      return
    }

    setBusy(true)
    try {
      await createOffers({
        direction,
        dates,
        departTime,
        origin,
        dest,
        waypoints,
        routePath: (route?.path ?? []) as LatLng[],
        routeDistanceM: route?.distanceM ?? null,
        routeDurationS: route?.durationS ?? null,
        seatsTotal: seats,
        vehicleNo: vehicleNo.trim().replace(/\s+/g, ' '),
      })
      navigate('/carpool/calendar', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell title="카풀 등록" subtitle="봉사자" back>
      <div className="space-y-5 pb-4">
        {error && <Alert tone="error">{error}</Alert>}

        {/* 방향 */}
        <section>
          <SectionLabel>방향</SectionLabel>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1">
            {(Object.keys(DIRECTIONS) as Direction[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setDirection(key)
                  setDepartTime(key === 'commute-in' ? '07:30' : '18:00')
                }}
                className={`rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                  direction === key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                {DIRECTIONS[key].label}
              </button>
            ))}
          </div>
        </section>

        {/* 날짜·시간 */}
        <section className="grid grid-cols-2 gap-3">
          <div>
            <SectionLabel>{repeat ? '시작 날짜' : '날짜'}</SectionLabel>
            <input
              type="date"
              value={rideDate}
              min={todayISO()}
              onChange={(e) => setRideDate(e.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3.5 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
            />
          </div>
          <div>
            <SectionLabel>
              {direction === 'commute-in' ? '출발 시각' : '회사 출발 시각'}
            </SectionLabel>
            <input
              type="time"
              value={departTime}
              onChange={(e) => setDepartTime(e.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3.5 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
            />
          </div>
        </section>

        {/* 위치 */}
        <section>
          <SectionLabel>경로</SectionLabel>
          <div className="space-y-2">
            <FixedRow
              label={direction === 'commute-in' ? '도착지' : '출발지'}
              value={company?.name ?? '회사'}
              sub={company?.addr}
            />

            <PickRow
              label={meta.driverInputLabel}
              place={endpoint}
              onClick={() => setPicker({ kind: 'endpoint' })}
            />

            {waypoints.map((w, i) => (
              <PickRow
                key={i}
                label={`경유지 ${i + 1}`}
                place={w}
                onClick={() => setPicker({ kind: 'waypoint', index: i })}
                onRemove={() => setWaypoints((prev) => prev.filter((_, idx) => idx !== i))}
              />
            ))}

            <button
              type="button"
              onClick={() => setPicker({ kind: 'waypoint', index: waypoints.length })}
              className="w-full rounded-xl border border-dashed border-slate-300 py-3 text-[13px] font-semibold text-slate-500 active:bg-slate-50"
            >
              + 경유지 추가
            </button>
          </div>
        </section>

        {/* 지도 */}
        <section>
          <KakaoMap className="h-56 w-full" pins={pins} path={route?.path} center={company ?? undefined} />
          <div className="mt-2 min-h-[20px] px-1 text-[13px]">
            {routing ? (
              <span className="text-slate-400">경로 계산 중…</span>
            ) : routeError ? (
              <span className="text-rose-600">{routeError}</span>
            ) : route ? (
              <span className="font-medium text-slate-700">
                예상 {formatDistance(route.distanceM)} · {formatDuration(route.durationS)}
              </span>
            ) : (
              <span className="text-slate-400">{meta.driverInputLabel}를 지정하면 경로를 계산합니다.</span>
            )}
          </div>
        </section>

        {/* 좌석 */}
        <section>
          <SectionLabel>좌석 수</SectionLabel>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSeats(n)}
                className={`min-h-[48px] rounded-xl border text-[15px] font-semibold transition-colors ${
                  seats === n
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-slate-300 bg-white text-slate-600'
                }`}
              >
                {n}석
              </button>
            ))}
          </div>
        </section>

        {/* 차량번호 */}
        <section>
          <SectionLabel>차량번호</SectionLabel>
          <input
            value={vehicleNo}
            onChange={(e) => setVehicleNo(e.target.value)}
            onBlur={() => setVehicleTouched(true)}
            placeholder="12가3456"
            inputMode="text"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={Boolean(vehicleTouched && vehicleError)}
            className={`min-h-[48px] w-full rounded-xl border bg-white px-3.5 focus:ring-2 focus:outline-none ${
              vehicleTouched && vehicleError
                ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-100'
                : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'
            }`}
          />
          <p
            className={`mt-1.5 px-0.5 text-[12px] leading-relaxed ${
              vehicleTouched && vehicleError ? 'text-rose-600' : 'text-slate-500'
            }`}
          >
            {vehicleTouched && vehicleError
              ? vehicleError
              : '탑승자가 차를 알아볼 수 있게 필요합니다. 매칭된 탑승자에게만 보입니다.'}
          </p>
        </section>

        {/* 반복 */}
        <section>
          <div className="flex items-center justify-between">
            <SectionLabel className="mb-0">반복 등록</SectionLabel>
            <button
              type="button"
              role="switch"
              aria-checked={repeat}
              onClick={() => setRepeat((v) => !v)}
              className={`relative h-7 w-12 rounded-full transition-colors ${repeat ? 'bg-brand-600' : 'bg-slate-300'}`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${repeat ? 'left-6' : 'left-1'}`}
              />
            </button>
          </div>

          {repeat && (
            <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-white p-3.5">
              <div>
                <p className="mb-1.5 text-[12px] font-semibold text-slate-600">요일</p>
                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAY_LABELS.map((label, day) => {
                    const on = repeatDays.includes(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          setRepeatDays((prev) =>
                            on ? prev.filter((d) => d !== day) : [...prev, day].sort(),
                          )
                        }
                        className={`min-h-[40px] rounded-lg text-[13px] font-semibold transition-colors ${
                          on ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[12px] font-semibold text-slate-600">종료 날짜</p>
                <input
                  type="date"
                  value={repeatEnd}
                  min={rideDate}
                  onChange={(e) => setRepeatEnd(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
                />
              </div>

              <p className="text-[12px] text-slate-500">
                {dates.length > 0 ? (
                  <>
                    총 <strong className="text-brand-700">{dates.length}일</strong> 등록됩니다
                    {dates.length > 0 && ` · ${formatDateKo(dates[0])} ~ ${formatDateKo(dates[dates.length - 1])}`}
                  </>
                ) : (
                  <span className="text-rose-600">선택한 조건에 해당하는 날짜가 없습니다.</span>
                )}
              </p>
            </div>
          )}
        </section>

        <Button full loading={busy} onClick={handleSubmit} disabled={!endpoint || dates.length === 0}>
          {dates.length > 1 ? `${dates.length}일 등록하기` : '등록하기'}
        </Button>

        {routeError && (
          <p className="text-center text-[12px] text-slate-500">
            경로 없이도 등록할 수 있지만, 탑승자 추천 정확도가 떨어집니다.
          </p>
        )}
      </div>

      <PlacePicker
        open={picker !== null}
        title={
          picker?.kind === 'waypoint'
            ? `경유지 ${picker.index + 1} 지정`
            : `${meta.driverInputLabel} 지정`
        }
        initial={
          picker?.kind === 'endpoint'
            ? endpoint
            : picker?.kind === 'waypoint'
              ? (waypoints[picker.index] ?? null)
              : null
        }
        onClose={() => setPicker(null)}
        onSelect={handlePicked}
      />
    </AppShell>
  )
}

// ── 작은 조각들 ───────────────────────────────────────────────

function SectionLabel({ children, className = 'mb-2' }: { children: React.ReactNode; className?: string }) {
  return <p className={`px-1 text-[13px] font-semibold text-slate-700 ${className}`}>{children}</p>
}

function FixedRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
      <span className="w-14 shrink-0 text-[12px] font-semibold text-slate-500">{label}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-slate-700">{value}</p>
        {sub && <p className="truncate text-[12px] text-slate-400">{sub}</p>}
      </div>
      <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
        고정
      </span>
    </div>
  )
}

function PickRow({
  label,
  place,
  onClick,
  onRemove,
}: {
  label: string
  place: Place | null
  onClick: () => void
  onRemove?: () => void
}) {
  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-left active:bg-slate-50"
      >
        <span className="w-14 shrink-0 text-[12px] font-semibold text-slate-500">{label}</span>
        <div className="min-w-0 flex-1">
          {place ? (
            <>
              <p className="truncate text-[14px] font-semibold text-slate-900">
                {place.name ?? place.addr}
              </p>
              {place.name && <p className="truncate text-[12px] text-slate-400">{place.addr}</p>}
            </>
          ) : (
            <p className="text-[14px] text-slate-400">지도에서 지정</p>
          )}
        </div>
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${label} 삭제`}
          className="shrink-0 rounded-xl border border-slate-300 bg-white px-3 text-slate-400 active:bg-slate-50"
        >
          ✕
        </button>
      )}
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import AppShell from '../../components/AppShell'
import KakaoMap, { type Pin } from '../../components/map/KakaoMap'
import { Alert, Button } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { formatDateKo, formatTimeKo, hasDeparted } from '../../lib/dates'
import { completeOffer } from '../../lib/ratings'
import { DIRECTIONS } from '../../lib/direction'
import { formatDistance, formatDuration, type LatLng } from '../../lib/geo'
import { canShareLocation, useLiveLocation } from '../../lib/liveLocation'
import { getOffer, getOfferRoute, type Offer } from '../../lib/offers'
import {
  listMatchedContacts,
  listMyRequests,
  listReceivedRequests,
  type CarpoolRequest,
  type MatchedContact,
} from '../../lib/requests'

export default function TripPage() {
  const { id: offerId } = useParams<{ id: string }>()
  const { me } = useAuth()

  const [offer, setOffer] = useState<Offer | null>(null)
  const [routePath, setRoutePath] = useState<LatLng[]>([])
  const [riders, setRiders] = useState<CarpoolRequest[]>([])
  const [contacts, setContacts] = useState<MatchedContact[]>([])
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)

  const live = useLiveLocation(offerId, me ? { id: me.id, name: me.name } : null)

  const load = useCallback(async () => {
    if (!offerId) return
    setLoading(true)
    setLoadError(null)
    try {
      const [o, path, received, mine, cs, can] = await Promise.all([
        getOffer(offerId),
        getOfferRoute(offerId),
        listReceivedRequests(),
        listMyRequests(),
        listMatchedContacts(),
        canShareLocation(offerId),
      ])
      setOffer(o)
      setRoutePath(path)
      setContacts(cs.filter((c) => c.offerId === offerId))
      setAllowed(can)

      // 봉사자면 허락한 탑승자들, 탑승자면 내 신청
      const isDriver = o?.driverId === me?.id
      setRiders(
        (isDriver ? received : mine).filter(
          (r) => r.offerId === offerId && r.status === 'accepted',
        ),
      )
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [offerId, me?.id])

  useEffect(() => {
    load()
  }, [load])

  async function handleComplete() {
    if (!offerId) return
    if (!confirm('운행완료로 처리할까요? 별점 1점이 적립됩니다.')) return
    setCompleting(true)
    setCompleteError(null)
    try {
      await completeOffer(offerId)
      live.stop() // 완료 후에는 위치 공유를 중단한다
      await load()
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : '완료 처리하지 못했습니다.')
    } finally {
      setCompleting(false)
    }
  }

  if (loading) {
    return (
      <AppShell title="카풀 상세" back tabs={false}>
        <p className="px-1 text-[13px] text-slate-400">불러오는 중…</p>
      </AppShell>
    )
  }

  if (loadError || !offer) {
    return (
      <AppShell title="카풀 상세" back tabs={false}>
        <Alert tone="error">{loadError ?? '카풀을 찾을 수 없습니다.'}</Alert>
      </AppShell>
    )
  }

  const isDriver = offer.driverId === me?.id
  const meta = DIRECTIONS[offer.direction]

  // ── 지도 마커 ───────────────────────────────────────────────
  const pins: Pin[] = [
    { id: 'o', position: offer.origin, kind: offer.direction === 'commute-in' ? 'origin' : 'company' },
    ...offer.waypoints.map((w, i) => ({
      id: `w${i}`,
      position: w,
      kind: 'waypoint' as const,
      label: `경유 ${i + 1}`,
    })),
    { id: 'd', position: offer.dest, kind: offer.direction === 'commute-in' ? 'company' : 'dest' },
    ...riders.map((r, i) => ({
      id: `b${i}`,
      position: r.board,
      kind: 'waypoint' as const,
      label: isDriver ? `${r.counterpart?.name ?? '탑승자'} 탑승` : '내 탑승 위치',
    })),
  ]
  if (live.myPosition) pins.push({ id: 'me', position: live.myPosition, kind: 'me', label: '내 위치' })
  live.peers.forEach((p) =>
    pins.push({ id: `p-${p.userId}`, position: p, kind: 'partner', label: p.name }),
  )

  return (
    <AppShell title="카풀 상세" subtitle={isDriver ? '봉사자' : '탑승자'} back tabs={false}>
      <div className="space-y-4 pb-4">
        {/* 운행 정보 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[15px] font-bold text-slate-900">
            {formatDateKo(offer.rideDate)} · {meta.label} · {formatTimeKo(offer.departTime)}
          </p>
          <p className="mt-1.5 text-[13px] text-slate-600">
            {offer.origin.addr} → {offer.dest.addr}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-slate-500">
            <span>
              좌석 {offer.seatsAvailable}/{offer.seatsTotal}
            </span>
            {offer.routeDistanceM !== null && <span>{formatDistance(offer.routeDistanceM)}</span>}
            {offer.routeDurationS !== null && <span>{formatDuration(offer.routeDurationS)}</span>}
          </div>
        </section>

        {/* 지도 */}
        <KakaoMap className="h-72 w-full" pins={pins} path={routePath.length >= 2 ? routePath : undefined} />

        {/* 위치 공유 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-bold text-slate-900">실시간 위치 공유</p>
              <p className="mt-0.5 text-[12px] text-slate-500">
                {STATE_LABEL[live.state]}
                {live.peers.length > 0 && ` · 상대 ${live.peers.length}명 표시 중`}
              </p>
            </div>
            {live.state === 'idle' ? (
              <Button
                onClick={live.start}
                disabled={allowed === false}
                className="min-h-[44px] shrink-0 px-4 text-[14px]"
              >
                시작
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={live.stop}
                className="min-h-[44px] shrink-0 px-4 text-[14px]"
              >
                중지
              </Button>
            )}
          </div>

          {allowed === false && live.state === 'idle' && (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] leading-relaxed text-slate-500">
              지금은 위치를 공유할 수 없습니다. 위치 공유는 <strong>출발 30분 전부터 출발 3시간
              후까지</strong>, 매칭이 성립한 상대끼리만 가능합니다.
            </p>
          )}

          {live.state === 'denied' && (
            <div className="mt-3">
              <Alert tone="error">
                위치 채널에 접속할 수 없습니다. 운행 시간대가 아니거나 매칭이 해제되었습니다.
              </Alert>
            </div>
          )}

          {live.error && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-800">
              {live.error}
            </p>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            위치는 저장되지 않고 상대에게 직접 전달됩니다. 화면을 벗어나면 즉시 중단됩니다.
          </p>
        </section>

        {/* 운행완료 (봉사자, 출발 시각 이후) */}
        {isDriver && hasDeparted(offer.rideDate, offer.departTime) && offer.status !== 'done' && (
          <section className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
            <p className="text-[14px] font-bold text-brand-800">운행을 마치셨나요?</p>
            <p className="mt-1 text-[12px] leading-relaxed text-brand-700/80">
              완료 처리하면 별점 1점이 적립되고 위치 공유가 중단됩니다.
            </p>
            {completeError && (
              <p className="mt-2 text-[12px] text-rose-600">{completeError}</p>
            )}
            <Button full loading={completing} onClick={handleComplete} className="mt-3">
              운행완료
            </Button>
          </section>
        )}

        {offer.status === 'done' && (
          <Alert tone="success">운행완료 처리된 카풀입니다. 별점이 적립되었습니다.</Alert>
        )}

        {/* 상대 연락처 */}
        <section>
          <h3 className="mb-2 px-1 text-sm font-semibold text-slate-500">
            {isDriver ? `탑승자 ${riders.length}명` : '봉사자'}
          </h3>

          {contacts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center">
              <p className="text-[13px] text-slate-500">
                매칭이 성립한 상대가 없습니다.
                <br />
                신청이 허락되면 연락처가 표시됩니다.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {contacts.map((contact) => {
                const rider = riders.find((r) => r.counterpart?.id === contact.userId)
                const live_ = live.peers.find((p) => p.userId === contact.userId)
                return (
                  <li key={contact.requestId} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold text-slate-900">
                          {contact.name}
                          <span className="ml-1.5 text-[12px] font-normal text-slate-500">
                            {contact.department}
                          </span>
                        </p>
                        {rider && (
                          <p className="mt-1 truncate text-[12px] text-slate-500">
                            {offer.direction === 'commute-in' ? '탑승' : '하차'} ·{' '}
                            {rider.board.addr}
                          </p>
                        )}
                        <p className="mt-1 text-[12px]">
                          {live_ ? (
                            <span className="font-medium text-emerald-600">● 위치 공유 중</span>
                          ) : (
                            <span className="text-slate-400">○ 위치 공유 안 함</span>
                          )}
                        </p>
                      </div>
                      <a
                        href={`tel:${contact.phone.replace(/-/g, '')}`}
                        className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2.5 text-[13px] font-semibold text-white active:bg-emerald-700"
                      >
                        📞 전화
                      </a>
                    </div>
                    <p className="mt-2 text-[13px] font-medium text-slate-700">{contact.phone}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  )
}

const STATE_LABEL: Record<string, string> = {
  idle: '중지됨',
  connecting: '연결 중…',
  sharing: '내 위치 공유 중',
  watching: '상대 위치 수신 중',
  denied: '접속 거부됨',
  error: '오류',
}

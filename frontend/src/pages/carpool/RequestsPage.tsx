import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import AppShell from '../../components/AppShell'
import { Alert, Button } from '../../components/ui'
import { formatDateKo, formatTimeKo } from '../../lib/dates'
import { DIRECTIONS } from '../../lib/direction'
import {
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_STYLE,
  acceptRequest,
  cancelRequest,
  listMatchedContacts,
  listMyRequests,
  listReceivedRequests,
  rejectRequest,
  type CarpoolRequest,
  type MatchedContact,
} from '../../lib/requests'

type Tab = 'received' | 'mine'

export default function RequestsPage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'mine' ? 'mine' : 'received'

  const [received, setReceived] = useState<CarpoolRequest[]>([])
  const [mine, setMine] = useState<CarpoolRequest[]>([])
  const [contacts, setContacts] = useState<MatchedContact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [r, m, c] = await Promise.all([
        listReceivedRequests(),
        listMyRequests(),
        listMatchedContacts(),
      ])
      setReceived(r)
      setMine(m)
      setContacts(c)
    } catch (err) {
      setError(err instanceof Error ? err.message : '불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  /** 매칭이 성립한 건에 한해 상대 연락처를 찾는다 */
  const contactFor = (request: CarpoolRequest) =>
    contacts.find((c) => c.requestId === request.id) ?? null

  async function act(label: string, fn: () => Promise<unknown>) {
    setError(null)
    setNotice(null)
    try {
      await fn()
      setNotice(label)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리하지 못했습니다.')
    }
  }

  const pendingCount = received.filter((r) => r.status === 'pending').length
  const list = tab === 'received' ? received : mine

  return (
    <AppShell title="신청함" subtitle="받은 신청 · 내 신청">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1">
        <TabButton
          active={tab === 'received'}
          onClick={() => setParams({ tab: 'received' }, { replace: true })}
          badge={pendingCount}
        >
          받은 신청
        </TabButton>
        <TabButton active={tab === 'mine'} onClick={() => setParams({ tab: 'mine' }, { replace: true })}>
          내 신청
        </TabButton>
      </div>

      <div className="mt-4 space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}

        {loading ? (
          <p className="px-1 text-[13px] text-slate-400">불러오는 중…</p>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
            <p className="text-[14px] font-semibold text-slate-700">
              {tab === 'received' ? '받은 신청이 없습니다.' : '신청한 카풀이 없습니다.'}
            </p>
            <p className="mt-1.5 text-[13px] text-slate-500">
              {tab === 'received'
                ? '카풀을 등록하면 탑승 신청을 받을 수 있습니다.'
                : '카풀 찾기에서 조건에 맞는 카풀을 신청해 보세요.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {list.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                side={tab}
                contact={contactFor(request)}
                onAccept={() => act('신청을 허락했습니다.', () => acceptRequest(request.id))}
                onReject={() => act('신청을 거절했습니다.', () => rejectRequest(request.id))}
                onCancel={() => act('신청을 취소했습니다.', () => cancelRequest(request.id))}
              />
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  )
}

function TabButton({
  active,
  badge,
  onClick,
  children,
}: {
  active: boolean
  badge?: number
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
        active ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'
      }`}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  )
}

function RequestCard({
  request,
  side,
  contact,
  onAccept,
  onReject,
  onCancel,
}: {
  request: CarpoolRequest
  side: Tab
  contact: MatchedContact | null
  onAccept: () => Promise<void>
  onReject: () => Promise<void>
  onCancel: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const { offer } = request
  const person = request.counterpart

  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true)
    await fn()
    setBusy(false)
  }

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-slate-900">
            {person?.name ?? '알 수 없음'}
            <span className="ml-1.5 text-[12px] font-normal text-slate-500">
              {person?.department}
            </span>
          </p>
          <p className="mt-0.5 text-[12px] text-slate-500">
            {side === 'received' ? '탑승 신청' : '봉사자'}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${REQUEST_STATUS_STYLE[request.status]}`}
        >
          {REQUEST_STATUS_LABEL[request.status]}
        </span>
      </div>

      <dl className="mt-3 space-y-1.5 rounded-xl bg-slate-50 px-3.5 py-3 text-[13px]">
        <Row label="카풀">
          {formatDateKo(offer.rideDate)} · {DIRECTIONS[offer.direction].label} ·{' '}
          {formatTimeKo(offer.departTime)}
        </Row>
        <Row label="경로">
          <span className="break-all">
            {offer.originAddr} → {offer.destAddr}
          </span>
        </Row>
        <Row label={offer.direction === 'commute-in' ? '탑승 위치' : '목적지'}>
          <span className="break-all">{request.board.addr}</span>
        </Row>
        <Row label="희망 시간">
          {formatTimeKo(request.desiredTime)} (±{request.timeTolerance}분)
        </Row>
        {side === 'received' && (
          <Row label="좌석">
            {offer.seatsAvailable} / {offer.seatsTotal}
          </Row>
        )}
      </dl>

      {/* 매칭 성립 시에만 연락처가 열린다 */}
      {contact && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-emerald-700">매칭 성립</p>
            <p className="truncate text-[14px] font-bold text-emerald-900">{contact.phone}</p>
          </div>
          <a
            href={`tel:${contact.phone.replace(/-/g, '')}`}
            className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2.5 text-[13px] font-semibold text-white active:bg-emerald-700"
          >
            📞 전화
          </a>
        </div>
      )}

      {/* 액션 */}
      {side === 'received' && request.status === 'pending' && (
        <div className="mt-3 flex gap-2">
          <Button full loading={busy} onClick={run(onAccept)} className="min-h-[44px] text-[14px]">
            허락
          </Button>
          <Button
            variant="secondary"
            full
            loading={busy}
            onClick={run(onReject)}
            className="min-h-[44px] text-[14px]"
          >
            거절
          </Button>
        </div>
      )}

      {side === 'mine' && (request.status === 'pending' || request.status === 'accepted') && (
        <Button
          variant="secondary"
          full
          loading={busy}
          onClick={run(onCancel)}
          className="mt-3 min-h-[44px] text-[14px]"
        >
          신청 취소
        </Button>
      )}
    </li>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-16 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium text-slate-800">{children}</dd>
    </div>
  )
}

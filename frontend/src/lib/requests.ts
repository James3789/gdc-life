/** 탑승 신청. 생성·상태변경은 모두 RPC 로만 (검증·좌석 정합성을 우회할 수 없게). */

import type { Direction } from './direction'
import type { Place } from './geo'
import { supabase } from './supabase'
import type { OfferStatus } from './offers'

export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'done'

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pending: '대기중',
  accepted: '허락됨',
  rejected: '거절됨',
  cancelled: '취소됨',
  done: '운행완료',
}

export const REQUEST_STATUS_STYLE: Record<RequestStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  accepted: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-600',
  cancelled: 'bg-slate-100 text-slate-400',
  done: 'bg-slate-100 text-slate-500',
}

export type Person = { id: string; name: string; department: string }

export type RequestOffer = {
  id: string
  driverId: string
  direction: Direction
  rideDate: string
  departTime: string
  originAddr: string
  destAddr: string
  seatsTotal: number
  seatsAvailable: number
  status: OfferStatus
}

export type CarpoolRequest = {
  id: string
  offerId: string
  passengerId: string
  board: Place
  desiredTime: string
  timeTolerance: number
  status: RequestStatus
  createdAt: string
  offer: RequestOffer
  /** 받은 신청이면 탑승자, 내 신청이면 봉사자 */
  counterpart: Person | null
}

/** 매칭이 성립한 상대의 연락처. 성립 전에는 비어 있다. */
export type MatchedContact = {
  userId: string
  name: string
  department: string
  phone: string
  requestId: string
  offerId: string
}

type OfferRow = {
  id: string
  driver_id: string
  direction: Direction
  ride_date: string
  depart_time: string
  origin_addr: string
  dest_addr: string
  seats_total: number
  seats_available: number
  status: OfferStatus
  driver?: Person | null
}

type RequestRow = {
  id: string
  offer_id: string
  passenger_id: string
  board_lat: number
  board_lng: number
  board_addr: string
  desired_time: string
  time_tolerance: number
  status: RequestStatus
  created_at: string
  offer: OfferRow | null
  passenger?: Person | null
}

const OFFER_FIELDS =
  'id, driver_id, direction, ride_date, depart_time, origin_addr, dest_addr, seats_total, seats_available, status'

const BASE_FIELDS =
  'id, offer_id, passenger_id, board_lat, board_lng, board_addr, desired_time, time_tolerance, status, created_at'

function toRequest(row: RequestRow, side: 'driver' | 'passenger'): CarpoolRequest {
  const offer = row.offer
  return {
    id: row.id,
    offerId: row.offer_id,
    passengerId: row.passenger_id,
    board: { lat: row.board_lat, lng: row.board_lng, addr: row.board_addr },
    desiredTime: row.desired_time.slice(0, 5),
    timeTolerance: row.time_tolerance,
    status: row.status,
    createdAt: row.created_at,
    offer: {
      id: offer?.id ?? row.offer_id,
      driverId: offer?.driver_id ?? '',
      direction: offer?.direction ?? 'commute-in',
      rideDate: offer?.ride_date ?? '',
      departTime: (offer?.depart_time ?? '00:00').slice(0, 5),
      originAddr: offer?.origin_addr ?? '',
      destAddr: offer?.dest_addr ?? '',
      seatsTotal: offer?.seats_total ?? 0,
      seatsAvailable: offer?.seats_available ?? 0,
      status: offer?.status ?? 'open',
    },
    counterpart: side === 'driver' ? (row.passenger ?? null) : (offer?.driver ?? null),
  }
}

/** 봉사자: 내 카풀에 들어온 신청 */
export async function listReceivedRequests(): Promise<CarpoolRequest[]> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return []

  const { data, error } = await supabase
    .from('carpool_requests')
    .select(
      `${BASE_FIELDS},
       offer:carpool_offers!inner(${OFFER_FIELDS}),
       passenger:profiles!carpool_requests_passenger_id_fkey(id, name, department)`,
    )
    .eq('offer.driver_id', auth.user.id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data as unknown as RequestRow[]).map((r) => toRequest(r, 'driver'))
}

/** 탑승자: 내가 낸 신청 */
export async function listMyRequests(): Promise<CarpoolRequest[]> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return []

  const { data, error } = await supabase
    .from('carpool_requests')
    .select(
      `${BASE_FIELDS},
       offer:carpool_offers!inner(${OFFER_FIELDS},
         driver:profiles!carpool_offers_driver_id_fkey(id, name, department))`,
    )
    .eq('passenger_id', auth.user.id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data as unknown as RequestRow[]).map((r) => toRequest(r, 'passenger'))
}

/** 대기 중인 받은 신청 수 — 배지용 */
export async function countPendingReceived(): Promise<number> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return 0

  const { count, error } = await supabase
    .from('carpool_requests')
    .select('id, carpool_offers!inner(driver_id)', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('carpool_offers.driver_id', auth.user.id)

  if (error) return 0
  return count ?? 0
}

export async function listMatchedContacts(): Promise<MatchedContact[]> {
  const { data, error } = await supabase.from('matched_contacts').select('*')
  if (error) throw new Error(error.message)

  return (data as unknown as Array<Record<string, string>>).map((r) => ({
    userId: r.user_id,
    name: r.name,
    department: r.department,
    phone: r.phone,
    requestId: r.request_id,
    offerId: r.offer_id,
  }))
}

// ── 변경 ──────────────────────────────────────────────────────

type RawRequest = {
  id: string
  offer_id: string
  passenger_id: string
  board_lat: number
  board_lng: number
  board_addr: string
  desired_time: string
  time_tolerance: number
  status: RequestStatus
  created_at: string
}

export async function requestCarpool(input: {
  offerId: string
  board: Place
  desiredTime: string
  toleranceMin: number
}): Promise<RawRequest> {
  const { data, error } = await supabase.rpc('request_carpool', {
    p_offer_id: input.offerId,
    p_lat: input.board.lat,
    p_lng: input.board.lng,
    p_addr: input.board.addr,
    p_desired_time: input.desiredTime,
    p_tolerance: input.toleranceMin,
  })
  if (error) throw new Error(error.message)
  return data as unknown as RawRequest
}

export async function acceptRequest(requestId: string): Promise<RawRequest> {
  const { data, error } = await supabase.rpc('accept_carpool_request', { p_request_id: requestId })
  if (error) throw new Error(error.message)
  return data as unknown as RawRequest
}

export async function rejectRequest(requestId: string): Promise<RawRequest> {
  const { data, error } = await supabase.rpc('reject_carpool_request', { p_request_id: requestId })
  if (error) throw new Error(error.message)
  return data as unknown as RawRequest
}

export async function cancelRequest(requestId: string): Promise<RawRequest> {
  const { data, error } = await supabase.rpc('cancel_carpool_request', { p_request_id: requestId })
  if (error) throw new Error(error.message)
  return data as unknown as RawRequest
}

/** 탑승 신청. 생성·취소는 모두 RPC 로만 (검증·좌석 정합성을 우회할 수 없게). */

import type { Place } from './geo'
import { supabase } from './supabase'

export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'done'

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pending: '신청',
  accepted: '허락',
  rejected: '거절',
  cancelled: '취소',
  done: '완료',
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
}

type Row = {
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

function toRequest(row: Row): CarpoolRequest {
  return {
    id: row.id,
    offerId: row.offer_id,
    passengerId: row.passenger_id,
    board: { lat: row.board_lat, lng: row.board_lng, addr: row.board_addr },
    desiredTime: row.desired_time.slice(0, 5),
    timeTolerance: row.time_tolerance,
    status: row.status,
    createdAt: row.created_at,
  }
}

export async function requestCarpool(input: {
  offerId: string
  board: Place
  desiredTime: string
  toleranceMin: number
}): Promise<CarpoolRequest> {
  const { data, error } = await supabase.rpc('request_carpool', {
    p_offer_id: input.offerId,
    p_lat: input.board.lat,
    p_lng: input.board.lng,
    p_addr: input.board.addr,
    p_desired_time: input.desiredTime,
    p_tolerance: input.toleranceMin,
  })

  if (error) throw new Error(error.message)
  return toRequest(data as unknown as Row)
}

export async function cancelRequest(requestId: string): Promise<CarpoolRequest> {
  const { data, error } = await supabase.rpc('cancel_carpool_request', {
    p_request_id: requestId,
  })
  if (error) throw new Error(error.message)
  return toRequest(data as unknown as Row)
}

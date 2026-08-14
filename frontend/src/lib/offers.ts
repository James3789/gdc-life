/** 카풀 제공(Offer) 데이터 접근. */

import type { Direction } from './direction'
import type { LatLng, Place } from './geo'
import { supabase } from './supabase'

export type OfferStatus = 'open' | 'full' | 'done' | 'cancelled'

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  open: '모집중',
  full: '마감',
  done: '운행완료',
  cancelled: '취소',
}

export type Offer = {
  id: string
  driverId: string
  direction: Direction
  rideDate: string
  departTime: string
  origin: Place
  dest: Place
  waypoints: Place[]
  routeDistanceM: number | null
  routeDurationS: number | null
  seatsTotal: number
  seatsAvailable: number
  status: OfferStatus
  recurringGroupId: string | null
}

/** geography 컬럼은 WKB 로 내려와 쓸모없고 용량만 크므로 명시적으로 고른다. */
const COLUMNS = `
  id, driver_id, direction, ride_date, depart_time,
  origin_lat, origin_lng, origin_addr,
  dest_lat, dest_lng, dest_addr,
  waypoints, route_distance_m, route_duration_s,
  seats_total, seats_available, status, recurring_group_id
`

type Row = {
  id: string
  driver_id: string
  direction: Direction
  ride_date: string
  depart_time: string
  origin_lat: number
  origin_lng: number
  origin_addr: string
  dest_lat: number
  dest_lng: number
  dest_addr: string
  waypoints: Place[] | null
  route_distance_m: number | null
  route_duration_s: number | null
  seats_total: number
  seats_available: number
  status: OfferStatus
  recurring_group_id: string | null
}

function toOffer(row: Row): Offer {
  return {
    id: row.id,
    driverId: row.driver_id,
    direction: row.direction,
    rideDate: row.ride_date,
    // '07:30:00' → '07:30'
    departTime: row.depart_time.slice(0, 5),
    origin: { lat: row.origin_lat, lng: row.origin_lng, addr: row.origin_addr },
    dest: { lat: row.dest_lat, lng: row.dest_lng, addr: row.dest_addr },
    waypoints: row.waypoints ?? [],
    routeDistanceM: row.route_distance_m,
    routeDurationS: row.route_duration_s,
    seatsTotal: row.seats_total,
    seatsAvailable: row.seats_available,
    status: row.status,
    recurringGroupId: row.recurring_group_id,
  }
}

export type CreateOfferInput = {
  direction: Direction
  dates: string[]
  departTime: string
  origin: Place
  dest: Place
  waypoints: Place[]
  routePath: LatLng[]
  routeDistanceM: number | null
  routeDurationS: number | null
  seatsTotal: number
}

/** 단건·반복 등록을 한 번의 RPC 로 처리한다 (경로 LineString 생성 포함). */
export async function createOffers(input: CreateOfferInput): Promise<Offer[]> {
  const { data, error } = await supabase.rpc('create_carpool_offers', {
    p_direction: input.direction,
    p_dates: input.dates,
    p_depart_time: input.departTime,
    p_origin: input.origin,
    p_dest: input.dest,
    p_waypoints: input.waypoints,
    p_route: input.routePath,
    // 생성 타입상 optional 이라 null 대신 생략한다 (길찾기 실패 시)
    p_route_distance_m: input.routeDistanceM ?? undefined,
    p_route_duration_s: input.routeDurationS ?? undefined,
    p_seats_total: input.seatsTotal,
  })

  if (error) throw new Error(error.message)
  return (data as unknown as Row[]).map(toOffer)
}

/** 내가 등록한 카풀 (달력용). */
export async function listMyOffers(fromDate: string, toDate: string): Promise<Offer[]> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return []

  const { data, error } = await supabase
    .from('carpool_offers')
    .select(COLUMNS)
    .eq('driver_id', auth.user.id)
    .gte('ride_date', fromDate)
    .lte('ride_date', toDate)
    .order('ride_date')
    .order('depart_time')

  if (error) throw new Error(error.message)
  return (data as unknown as Row[]).map(toOffer)
}

export async function cancelOffer(offerId: string, wholeGroup = false): Promise<number> {
  const { data, error } = await supabase.rpc('cancel_carpool_offers', {
    p_offer_id: offerId,
    p_whole_group: wholeGroup,
  })
  if (error) throw new Error(error.message)
  return data as unknown as number
}

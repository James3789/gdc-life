/** 탑승자 매칭 검색. 실제 판정은 PostGIS 로 서버에서 한다. */

import type { Direction } from './direction'
import type { LatLng, Place } from './geo'
import { supabase } from './supabase'

export type SearchParams = {
  direction: Direction
  date: string
  /** 출근: 탑승 위치 / 퇴근: 목적지 */
  point: Place
  desiredTime: string
  toleranceMin: number
}

export type Match = {
  offerId: string
  driverId: string
  driverName: string
  driverDepartment: string
  driverPoints: number
  rideDate: string
  departTime: string
  origin: Place
  dest: Place
  waypoints: Place[]
  routePath: LatLng[]
  routeDistanceM: number | null
  routeDurationS: number | null
  seatsTotal: number
  seatsAvailable: number
  /** 봉사자 경로에서 내 탑승 위치까지의 거리(m) */
  detourM: number
  /** 출근: 예상 픽업 시각 / 퇴근: 회사 출발 시각 */
  estTime: string
  timeDiffMin: number
  score: number
  alreadyRequested: boolean
}

type Row = {
  offer_id: string
  driver_id: string
  driver_name: string
  driver_department: string
  driver_points: number
  ride_date: string
  depart_time: string
  origin_lat: number
  origin_lng: number
  origin_addr: string
  dest_lat: number
  dest_lng: number
  dest_addr: string
  waypoints: Place[] | null
  /** GeoJSON 좌표 순서 [lng, lat] */
  route_path: [number, number][] | null
  route_distance_m: number | null
  route_duration_s: number | null
  seats_total: number
  seats_available: number
  detour_m: number
  est_time: string
  time_diff_min: number
  score: number
  already_requested: boolean
}

export async function searchOffers(params: SearchParams): Promise<Match[]> {
  const { data, error } = await supabase.rpc('search_carpool_offers', {
    p_direction: params.direction,
    p_date: params.date,
    p_lat: params.point.lat,
    p_lng: params.point.lng,
    p_desired_time: params.desiredTime,
    p_tolerance_min: params.toleranceMin,
  })

  if (error) throw new Error(error.message)

  return (data as unknown as Row[]).map((r) => ({
    offerId: r.offer_id,
    driverId: r.driver_id,
    driverName: r.driver_name,
    driverDepartment: r.driver_department,
    driverPoints: Number(r.driver_points),
    rideDate: r.ride_date,
    departTime: r.depart_time.slice(0, 5),
    origin: { lat: r.origin_lat, lng: r.origin_lng, addr: r.origin_addr },
    dest: { lat: r.dest_lat, lng: r.dest_lng, addr: r.dest_addr },
    waypoints: r.waypoints ?? [],
    // GeoJSON 은 [경도, 위도] 순서다
    routePath: (r.route_path ?? []).map(([lng, lat]) => ({ lat, lng })),
    routeDistanceM: r.route_distance_m,
    routeDurationS: r.route_duration_s,
    seatsTotal: r.seats_total,
    seatsAvailable: r.seats_available,
    detourM: r.detour_m,
    estTime: r.est_time.slice(0, 5),
    timeDiffMin: r.time_diff_min,
    score: r.score,
    alreadyRequested: r.already_requested,
  }))
}

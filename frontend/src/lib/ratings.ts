/** 별점 — 운행완료 1건당 1점. 적립은 서버 함수로만 일어난다. */

import type { Direction } from './direction'
import { supabase } from './supabase'
import type { Offer } from './offers'

export type RatingSummary = {
  monthly: number
  yearly: number
  total: number
  rides: number
}

export type RatingEntry = {
  id: string
  points: number
  earnedAt: string
  rideDate: string
  direction: Direction
  departTime: string
  originAddr: string
  destAddr: string
}

export async function getMyRatingSummary(): Promise<RatingSummary> {
  const { data, error } = await supabase.rpc('my_rating_summary')
  if (error) throw new Error(error.message)

  const row = (data as unknown as RatingSummary[] | null)?.[0]
  return {
    monthly: Number(row?.monthly ?? 0),
    yearly: Number(row?.yearly ?? 0),
    total: Number(row?.total ?? 0),
    rides: Number(row?.rides ?? 0),
  }
}

type EntryRow = {
  id: string
  points: number
  earned_at: string
  offer: {
    ride_date: string
    direction: Direction
    depart_time: string
    origin_addr: string
    dest_addr: string
  } | null
}

export async function listMyRatings(limit = 20): Promise<RatingEntry[]> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return []

  const { data, error } = await supabase
    .from('driver_ratings')
    .select(
      `id, points, earned_at,
       offer:carpool_offers!inner(ride_date, direction, depart_time, origin_addr, dest_addr)`,
    )
    .eq('driver_id', auth.user.id)
    .order('earned_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return (data as unknown as EntryRow[]).map((r) => ({
    id: r.id,
    points: r.points,
    earnedAt: r.earned_at,
    rideDate: r.offer?.ride_date ?? '',
    direction: r.offer?.direction ?? 'commute-in',
    departTime: (r.offer?.depart_time ?? '00:00').slice(0, 5),
    originAddr: r.offer?.origin_addr ?? '',
    destAddr: r.offer?.dest_addr ?? '',
  }))
}

/** 봉사자가 직접 운행완료 처리. 출발 시각 이후 + 탑승자가 있어야 한다. */
export async function completeOffer(offerId: string): Promise<Offer['status']> {
  const { data, error } = await supabase.rpc('complete_carpool_offer', { p_offer_id: offerId })
  if (error) throw new Error(error.message)
  return (data as unknown as { status: Offer['status'] }).status
}

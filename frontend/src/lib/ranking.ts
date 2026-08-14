/** 별점 순위. 이름·부서·점수만 다룬다 — 연락처는 포함되지 않는다. */

import { supabase } from './supabase'

export type RankPeriod = 'month' | 'year' | 'total'

export const PERIOD_LABEL: Record<RankPeriod, string> = {
  month: '이번 달',
  year: '올해',
  total: '누적',
}

export type RankRow = {
  rank: number
  userId: string
  name: string
  department: string
  points: number
  rides: number
  isMe: boolean
}

export type MyRank = {
  rank: number
  points: number
  rides: number
  totalDrivers: number
}

export async function getLeaderboard(period: RankPeriod, limit = 100): Promise<RankRow[]> {
  const { data, error } = await supabase.rpc('rating_leaderboard', {
    p_period: period,
    p_limit: limit,
  })
  if (error) throw new Error(error.message)

  return (data as unknown as Array<Record<string, unknown>>).map((r) => ({
    rank: Number(r.rank),
    userId: String(r.user_id),
    name: String(r.name),
    department: String(r.department),
    points: Number(r.points),
    rides: Number(r.rides),
    isMe: Boolean(r.is_me),
  }))
}

/** 상위 목록 밖으로 밀려났을 때를 위한 내 등수. 별점이 없으면 null. */
export async function getMyRank(period: RankPeriod): Promise<MyRank | null> {
  const { data, error } = await supabase.rpc('my_rating_rank', { p_period: period })
  if (error) throw new Error(error.message)

  const row = (data as unknown as Array<Record<string, unknown>>)?.[0]
  if (!row) return null

  return {
    rank: Number(row.rank),
    points: Number(row.points),
    rides: Number(row.rides),
    totalDrivers: Number(row.total_drivers),
  }
}

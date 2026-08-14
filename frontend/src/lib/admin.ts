/** 관리자 기능.
 *
 *  권한은 admin_users 테이블에만 있고, 클라이언트에는 어떤 쓰기 권한도 없다.
 *  전화번호는 서버에서 마스킹해 내려오므로 관리자에게도 원본이 가지 않는다.
 */

import { supabase } from './supabase'

export type AdminAccount = {
  userId: string
  loginId: string
  name: string
  department: string
  email: string
  phoneMasked: string
  createdAt: string
  offers: number
  rides: number
  points: number
  isAdmin: boolean
}

export type AdminStats = {
  users: number
  offers: number
  requests: number
  matched: number
  completed: number
  points: number
}

export async function checkIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin')
  if (error) return false
  return data === true
}

export async function listAccounts(query = ''): Promise<AdminAccount[]> {
  const { data, error } = await supabase.rpc('admin_list_accounts', {
    p_query: query.trim() || undefined,
  })
  if (error) throw new Error(error.message)

  return (data as unknown as Array<Record<string, unknown>>).map((r) => ({
    userId: String(r.user_id),
    loginId: String(r.login_id),
    name: String(r.name),
    department: String(r.department),
    email: String(r.email),
    phoneMasked: String(r.phone_masked ?? ''),
    createdAt: String(r.created_at),
    offers: Number(r.offers),
    rides: Number(r.rides),
    points: Number(r.points),
    isAdmin: Boolean(r.is_admin),
  }))
}

export async function getStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('admin_stats')
  if (error) throw new Error(error.message)

  const row = (data as unknown as Array<Record<string, unknown>>)?.[0]
  return {
    users: Number(row?.users ?? 0),
    offers: Number(row?.offers ?? 0),
    requests: Number(row?.requests ?? 0),
    matched: Number(row?.matched ?? 0),
    completed: Number(row?.completed ?? 0),
    points: Number(row?.points ?? 0),
  }
}

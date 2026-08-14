/** Supabase 클라이언트.
 *  키가 없으면 앱을 죽이지 않고 isConfigured=false 로 알려서
 *  화면에서 안내 문구를 띄운다 (설치 직후 흰 화면 방지).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const isConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient<Database> = createClient<Database>(
  // 미설정 시에도 createClient 가 던지지 않도록 형식만 맞춘 더미 값
  url || 'http://localhost:54321',
  anonKey || 'public-anon-key-not-set',
  {
    auth: {
      // 로그인 상태를 브라우저에 저장해 다음 방문에 자동 로그인시킨다.
      persistSession: true,
      // 액세스 토큰이 만료돼도 리프레시 토큰으로 자동 갱신한다.
      autoRefreshToken: true,
      detectSessionInUrl: false,
      // 저장 키를 고정한다. 기본값은 Supabase URL 에서 파생되기 때문에
      // 주소가 바뀌면(예: localhost → LAN IP) 로그인이 풀려 버린다.
      storageKey: 'gdc-life-auth',
    },
  },
)

/** login_id → Supabase Auth 이메일.
 *  Auth 가 이메일 기반이라 사내 ID를 합성 주소로 매핑한다.
 *  실제 이메일은 profile_private.email 에 따로 보관한다.
 */
export const AUTH_EMAIL_DOMAIN = 'gdc-life.local'

export function loginIdToAuthEmail(loginId: string): string {
  return `${loginId.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`
}

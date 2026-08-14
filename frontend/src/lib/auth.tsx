/** 인증 상태 · 가입 · 로그인.
 *
 *  Supabase Auth 는 이메일 기반이라 사내 ID 를 합성 주소로 매핑한다.
 *  실제 이메일/전화는 profile_private 에 따로 보관하며 본인만 읽을 수 있다.
 */

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'

import { isConfigured, loginIdToAuthEmail, supabase } from './supabase'

export type Me = {
  id: string
  name: string
  department: string
  loginId: string
  email: string
  phone: string
}

export type SignUpInput = {
  loginId: string
  password: string
  name: string
  department: string
  email: string
  phone: string
}

type AuthContextValue = {
  /** 세션 복원 중이면 true — 이 동안 라우팅 판단을 미룬다 */
  initializing: boolean
  session: Session | null
  me: Me | null
  signIn: (loginId: string, password: string) => Promise<void>
  signUp: (input: SignUpInput) => Promise<void>
  signOut: () => Promise<void>
  reloadMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Supabase 오류 메시지를 사용자용 한국어로 옮긴다. */
function toKoreanMessage(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'ID 또는 비밀번호가 올바르지 않습니다.'
  if (m.includes('user already registered') || m.includes('already been registered'))
    return '이미 사용 중인 ID입니다.'
  if (m.includes('email not confirmed'))
    return '계정이 확인되지 않았습니다. 관리자에게 문의해 주세요.'
  if (m.includes('password')) return '비밀번호가 정책에 맞지 않습니다. 영문과 숫자를 포함해 8자 이상.'
  if (m.includes('database error')) return '가입 정보를 저장하지 못했습니다. 입력값을 확인해 주세요.'
  if (m.includes('rate limit') || m.includes('too many'))
    return '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'
  if (m.includes('failed to fetch') || m.includes('network'))
    return '서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.'
  return message
}

export class AuthError extends Error {
  constructor(message: string) {
    super(toKoreanMessage(message))
  }
}

async function fetchMe(userId: string): Promise<Me | null> {
  const [profile, priv] = await Promise.all([
    supabase.from('profiles').select('id, name, department').eq('id', userId).single(),
    supabase.from('profile_private').select('login_id, email, phone').eq('id', userId).single(),
  ])

  if (profile.error || !profile.data) return null

  return {
    id: profile.data.id,
    name: profile.data.name,
    department: profile.data.department,
    // 연락처는 본인만 읽히므로 실패해도 화면은 뜨게 둔다
    loginId: priv.data?.login_id ?? '',
    email: priv.data?.email ?? '',
    phone: priv.data?.phone ?? '',
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initializing, setInitializing] = useState(isConfigured)
  const [session, setSession] = useState<Session | null>(null)
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    if (!isConfigured) return
    let alive = true

    // 저장된 세션 복원 → 이후 변화는 구독으로 따라간다
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data.session)
      setInitializing(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!alive) return
      setSession(next)
      setInitializing(false)
    })

    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // 세션이 바뀌면 내 프로필을 다시 읽는다
  useEffect(() => {
    const userId = session?.user.id
    if (!userId) {
      setMe(null)
      return
    }
    let alive = true
    fetchMe(userId).then((next) => alive && setMe(next))
    return () => {
      alive = false
    }
  }, [session?.user.id])

  const reloadMe = useCallback(async () => {
    if (session?.user.id) setMe(await fetchMe(session.user.id))
  }, [session?.user.id])

  const signIn = useCallback(async (loginId: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: loginIdToAuthEmail(loginId),
      password,
    })
    if (error) throw new AuthError(error.message)
  }, [])

  const signUp = useCallback(async (input: SignUpInput) => {
    const loginId = input.loginId.trim().toLowerCase()

    // 가입 전에 한 번 걸러 준다. 최종 보증은 DB의 unique 제약이다.
    const { data: available, error: rpcError } = await supabase.rpc('is_login_id_available', {
      p_login_id: loginId,
    })
    if (rpcError) throw new AuthError(rpcError.message)
    if (available === false) throw new AuthError('이미 사용 중인 ID입니다.')

    const { error } = await supabase.auth.signUp({
      email: loginIdToAuthEmail(loginId),
      password: input.password,
      options: {
        // 트리거(handle_new_user)가 이 값으로 profiles/profile_private 를 만든다
        data: {
          login_id: loginId,
          name: input.name.trim(),
          department: input.department.trim(),
          email: input.email.trim().toLowerCase(),
          phone: input.phone.trim(),
        },
      },
    })
    if (error) throw new AuthError(error.message)
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setMe(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ initializing, session, me, signIn, signUp, signOut, reloadMe }),
    [initializing, session, me, signIn, signUp, signOut, reloadMe],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error('useAuth 는 AuthProvider 안에서만 사용할 수 있습니다.')
  return ctx
}

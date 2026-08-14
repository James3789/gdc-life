import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../lib/auth'
import { useAppConfigState } from '../lib/appConfig'
import { Alert, FullScreenLoader } from './ui'

/** 로그인이 필요한 화면을 감싼다. 세션 복원 중에는 판단을 미룬다. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { initializing, session } = useAuth()
  const configState = useAppConfigState()
  const location = useLocation()

  // Supabase 키가 없으면 로그인 자체가 불가능하므로 설정 안내를 먼저 보여준다
  if (configState.status === 'unconfigured') return <SetupNotice />
  if (initializing) return <FullScreenLoader label="로그인 상태 확인 중…" />

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  return <>{children}</>
}

/** 이미 로그인한 사용자가 로그인/가입 화면에 오면 홈으로 보낸다. */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { initializing, session } = useAuth()
  const configState = useAppConfigState()

  if (configState.status === 'unconfigured') return <SetupNotice />
  if (initializing) return <FullScreenLoader />
  if (session) return <Navigate to="/home" replace />

  return <>{children}</>
}

function SetupNotice() {
  return (
    <div className="mx-auto grid min-h-dvh max-w-[480px] place-items-center bg-slate-50 px-6">
      <Alert tone="error">
        <p className="font-semibold">Supabase 연결 정보가 없습니다.</p>
        <p className="mt-1.5">
          루트 <code className="rounded bg-white/60 px-1">.env</code> 에{' '}
          <code className="rounded bg-white/60 px-1">VITE_SUPABASE_URL</code> 과{' '}
          <code className="rounded bg-white/60 px-1">VITE_SUPABASE_ANON_KEY</code> 를 채운 뒤 개발
          서버를 다시 시작해 주세요.
        </p>
        <p className="mt-1.5">
          로컬 스택은 <code className="rounded bg-white/60 px-1">npm run db:start</code> 로 띄울 수
          있습니다.
        </p>
      </Alert>
    </div>
  )
}

/** 서버(/api/meta/config)에서 내려오는 공개 설정.
 *  회사 좌표를 프론트에 하드코딩하지 않기 위한 단일 진입점.
 */

import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'

export type LatLng = { lat: number; lng: number }

export type AppConfig = {
  company: LatLng & { name: string; addr: string }
  match: { radiusM: number; defaultToleranceMin: number; toleranceOptions: number[] }
  seats: { min: number; max: number; default: number }
  requireCompanyEmail: boolean
}

type State = { status: 'loading' } | { status: 'ready'; config: AppConfig } | { status: 'error' }

const AppConfigContext = createContext<State>({ status: 'loading' })

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let alive = true
    api<AppConfig>('/meta/config')
      .then((config) => alive && setState({ status: 'ready', config }))
      .catch(() => alive && setState({ status: 'error' }))
    return () => {
      alive = false
    }
  }, [])

  return <AppConfigContext value={state}>{children}</AppConfigContext>
}

/** 설정 로딩 상태까지 포함해 반환. */
export function useAppConfigState() {
  return use(AppConfigContext)
}

/** 설정이 준비된 화면에서만 사용. 준비 전이면 null. */
export function useAppConfig(): AppConfig | null {
  const state = use(AppConfigContext)
  return state.status === 'ready' ? state.config : null
}

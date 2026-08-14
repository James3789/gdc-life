/** app_settings 테이블에서 내려오는 전역 설정.
 *  회사 좌표를 코드에 하드코딩하지 않기 위한 단일 진입점.
 */

import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import { isConfigured, supabase } from './supabase'

export type LatLng = { lat: number; lng: number }

export type AppConfig = {
  company: LatLng & { name: string; addr: string }
  match: { radiusM: number; defaultToleranceMin: number; toleranceOptions: number[] }
  seats: { min: number; max: number; default: number }
  requireCompanyEmail: boolean
  companyEmailDomains: string[]
}

export type ConfigState =
  | { status: 'loading' }
  | { status: 'ready'; config: AppConfig }
  /** VITE_SUPABASE_* 미설정 — .env 안내 필요 */
  | { status: 'unconfigured' }
  | { status: 'error'; message: string }

const AppConfigContext = createContext<ConfigState>({ status: 'loading' })

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfigState>(
    isConfigured ? { status: 'loading' } : { status: 'unconfigured' },
  )

  useEffect(() => {
    if (!isConfigured) return
    let alive = true

    supabase
      .from('app_settings')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data, error }) => {
        if (!alive) return
        if (error || !data) {
          setState({
            status: 'error',
            message: error?.message ?? '설정을 찾을 수 없습니다. 마이그레이션을 적용했는지 확인하세요.',
          })
          return
        }
        setState({
          status: 'ready',
          config: {
            company: {
              name: data.company_name,
              addr: data.company_addr,
              lat: data.company_lat,
              lng: data.company_lng,
            },
            match: {
              radiusM: data.match_radius_m,
              defaultToleranceMin: data.match_default_tolerance_min,
              toleranceOptions: [10, 20, 30],
            },
            seats: { min: 1, max: 4, default: 3 },
            requireCompanyEmail: data.require_company_email,
            companyEmailDomains: data.company_email_domains,
          },
        })
      })

    return () => {
      alive = false
    }
  }, [])

  return <AppConfigContext value={state}>{children}</AppConfigContext>
}

export function useAppConfigState(): ConfigState {
  return use(AppConfigContext)
}

/** 설정이 준비된 화면에서만 사용. 준비 전이면 null. */
export function useAppConfig(): AppConfig | null {
  const state = use(AppConfigContext)
  return state.status === 'ready' ? state.config : null
}

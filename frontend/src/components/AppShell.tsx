import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import BottomTabBar from './BottomTabBar'
import { ArrowLeftIcon } from './icons'

type Props = {
  title: string
  subtitle?: string
  /** 뒤로가기 버튼 표시 (하위 화면용) */
  back?: boolean
  /** 하단 탭바 표시 여부 */
  tabs?: boolean
  /** 헤더 우측 슬롯 */
  action?: ReactNode
  children: ReactNode
}

export default function AppShell({
  title,
  subtitle,
  back = false,
  tabs = true,
  action,
  children,
}: Props) {
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-slate-50 shadow-sm">
      <header className="safe-top sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-3">
          {back && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="뒤로"
              className="-ml-2 rounded-full p-1.5 text-slate-600 active:bg-slate-100"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] leading-tight font-bold text-slate-900">{title}</h1>
            {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      </header>

      <main className={`flex-1 px-4 pt-4 ${tabs ? 'pb-24' : 'pb-8'}`}>{children}</main>

      {tabs && <BottomTabBar />}
    </div>
  )
}

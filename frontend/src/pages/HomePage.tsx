import { Link } from 'react-router-dom'

import AppShell from '../components/AppShell'
import { ChevronRightIcon } from '../components/icons'
import { useAppConfigState } from '../lib/appConfig'
import { MODULES } from '../modules/registry'

export default function HomePage() {
  const state = useAppConfigState()
  const company = state.status === 'ready' ? state.config.company : null

  return (
    <AppShell title="GDC Life" subtitle={company?.name ?? 'HD현대마린솔루션'}>
      <section className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white">
        <p className="text-sm text-brand-100">안녕하세요 👋</p>
        <h2 className="mt-1 text-xl font-bold">오늘도 안전 운행하세요</h2>
        <p className="mt-3 text-[13px] leading-relaxed text-brand-100">
          {company ? (
            <>
              {company.name}
              <br />
              {company.addr}
            </>
          ) : state.status === 'unconfigured' ? (
            <>
              Supabase 연결 정보가 없습니다.
              <br />
              루트 <code>.env</code> 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 채워주세요.
            </>
          ) : state.status === 'error' ? (
            `설정을 불러오지 못했습니다: ${state.message}`
          ) : (
            '설정을 불러오는 중…'
          )}
        </p>
      </section>

      <h3 className="mt-6 mb-2 px-1 text-sm font-semibold text-slate-500">기능</h3>
      <ul className="space-y-2.5">
        {MODULES.map(({ key, name, description, to, Icon, enabled }) => {
          const card = (
            <div
              className={`flex items-center gap-3.5 rounded-2xl border p-4 ${
                enabled
                  ? 'border-slate-200 bg-white active:bg-slate-50'
                  : 'border-slate-200/70 bg-white/60'
              }`}
            >
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                  enabled ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-400'
                }`}
              >
                <Icon className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-[15px] font-semibold ${enabled ? 'text-slate-900' : 'text-slate-400'}`}
                >
                  {name}
                  {!enabled && (
                    <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      준비중
                    </span>
                  )}
                </p>
                <p className="truncate text-[13px] text-slate-500">{description}</p>
              </div>
              {enabled && <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate-300" />}
            </div>
          )

          return <li key={key}>{enabled ? <Link to={to}>{card}</Link> : card}</li>
        })}
      </ul>
    </AppShell>
  )
}

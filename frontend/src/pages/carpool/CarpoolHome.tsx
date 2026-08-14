import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import AppShell from '../../components/AppShell'
import { ChevronRightIcon } from '../../components/icons'
import { DIRECTIONS, type Direction, isDirection } from '../../lib/direction'
import { useAppConfig } from '../../lib/appConfig'
import { countPendingReceived } from '../../lib/requests'

export default function CarpoolHome() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('direction')
  const direction: Direction = isDirection(raw) ? raw : 'commute-in'
  const company = useAppConfig()?.company

  // 대기 중인 받은 신청 배지
  const [pending, setPending] = useState(0)
  useEffect(() => {
    let alive = true
    countPendingReceived().then((n) => alive && setPending(n))
    return () => {
      alive = false
    }
  }, [])

  const meta = DIRECTIONS[direction]

  return (
    <AppShell title="카풀" subtitle="출퇴근 함께 타기">
      {/* 출근 / 퇴근 탭 */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1">
        {(Object.keys(DIRECTIONS) as Direction[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setParams({ direction: key }, { replace: true })}
            className={`rounded-lg py-2.5 text-sm font-semibold transition-colors ${
              direction === key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            {DIRECTIONS[key].label}
          </button>
        ))}
      </div>

      <p className="mt-3 px-1 text-[13px] text-slate-500">
        {meta.fixedPointLabel}:{' '}
        <span className="font-medium text-slate-700">{company?.name ?? '회사'}</span>
      </p>

      {/* 역할 진입 */}
      <div className="mt-4 space-y-3">
        <Link
          to={`/carpool/offer/new?direction=${direction}`}
          className="block rounded-2xl border border-brand-200 bg-brand-50 p-5 active:bg-brand-100"
        >
          <p className="text-[15px] font-bold text-brand-800">🚗 봉사자로 등록하기</p>
          <p className="mt-1 text-[13px] leading-relaxed text-brand-700/80">
            {meta.driverInputLabel}를 입력하면 경로를 계산해 탑승자에게 추천됩니다.
          </p>
          <span className="mt-3 inline-flex items-center text-[13px] font-semibold text-brand-700">
            카풀 등록 <ChevronRightIcon className="h-4 w-4" />
          </span>
        </Link>

        <Link
          to={`/carpool/search?direction=${direction}`}
          className="block rounded-2xl border border-slate-200 bg-white p-5 active:bg-slate-50"
        >
          <p className="text-[15px] font-bold text-slate-900">🙋 탑승자로 찾아보기</p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
            {meta.passengerInputLabel}와 희망 시간으로 가까운 카풀을 찾습니다.
          </p>
          <span className="mt-3 inline-flex items-center text-[13px] font-semibold text-slate-700">
            카풀 찾기 <ChevronRightIcon className="h-4 w-4" />
          </span>
        </Link>
      </div>

      {/* 바로가기 */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link
          to="/carpool/requests"
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 active:bg-slate-50"
        >
          신청함
          {pending > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">
              {pending}
            </span>
          )}
        </Link>
        <Link
          to="/carpool/calendar"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-center text-sm font-semibold text-slate-700 active:bg-slate-50"
        >
          내 카풀 달력
        </Link>
      </div>

      <Link
        to="/carpool/ranking"
        className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3.5 active:bg-slate-50"
      >
        <span className="text-sm font-semibold text-slate-700">🏆 봉사 별점 순위</span>
        <ChevronRightIcon className="h-5 w-5 text-slate-300" />
      </Link>
    </AppShell>
  )
}

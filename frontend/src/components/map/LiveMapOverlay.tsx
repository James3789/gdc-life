/** 전체화면 실시간 지도.
 *
 *  운행 화면(TripPage) 위에 덮어서 띄운다. 별도 라우트로 만들지 않은 이유는
 *  화면을 옮기면 위치 채널이 끊겼다 다시 붙기 때문이다 —
 *  덮어 띄우면 공유가 끊기지 않는다.
 *
 *  열고 닫는 것은 TripPage 가 주소의 ?map=1 로 관리하므로
 *  안드로이드 뒤로가기로도 닫힌다.
 */

import { useEffect, useState } from 'react'

import { Button } from '../ui'
import type { LatLng } from '../../lib/geo'
import KakaoMap, { type Pin } from './KakaoMap'

export type MapContact = { userId: string; name: string; phone: string }

type Props = {
  title: string
  subtitle?: string
  pins: Pin[]
  path?: LatLng[]
  /** 위치 공유가 시작된 상태인가 */
  started: boolean
  /** '내 위치 공유 중' 같은 현재 상태 문구 */
  stateLabel: string
  /** 지금 위치가 보이는 상대 수 */
  peerCount: number
  /** 서버가 지금 위치 공유를 허용하는가 (false 면 시작 버튼을 막는다) */
  canShare: boolean
  contacts: MapContact[]
  onStart: () => void
  onStop: () => void
  onClose: () => void
}

export default function LiveMapOverlay({
  title,
  subtitle,
  pins,
  path,
  started,
  stateLabel,
  peerCount,
  canShare,
  contacts,
  onStart,
  onStop,
  onClose,
}: Props) {
  // 값이 바뀔 때마다 KakaoMap 이 화면을 다시 맞춘다
  const [fitToken, setFitToken] = useState(0)

  // ESC 로 닫기 + 뒤 배경 스크롤 잠금
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-slate-900/40">
      <div className="flex h-dvh w-full max-w-[480px] flex-col bg-white">
        {/* 헤더 */}
        <header className="safe-top flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[16px] font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="truncate text-[12px] text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full px-3 py-2 text-[13px] font-semibold text-slate-600 active:bg-slate-100"
          >
            닫기
          </button>
        </header>

        {/* 지도 — 남는 공간을 모두 쓴다 */}
        <div className="relative flex-1">
          <KakaoMap
            className="h-full w-full"
            pins={pins}
            path={path && path.length >= 2 ? path : undefined}
            fitToken={fitToken}
            zoomControl
            rounded={false}
          />

          <button
            type="button"
            onClick={() => setFitToken((n) => n + 1)}
            className="absolute top-3 left-3 z-10 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[13px] font-semibold text-slate-700 shadow-sm backdrop-blur active:bg-slate-100"
          >
            전체 보기
          </button>
        </div>

        {/* 조작 */}
        <div className="safe-bottom border-t border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold text-slate-900">
                {stateLabel}
                {peerCount > 0 && (
                  <span className="ml-1.5 text-[12px] font-medium text-emerald-600">
                    상대 {peerCount}명
                  </span>
                )}
              </p>
              <p className="truncate text-[11px] text-slate-400">위치는 저장되지 않습니다</p>
            </div>

            {started ? (
              <Button
                variant="secondary"
                onClick={onStop}
                className="min-h-[44px] shrink-0 px-4 text-[14px]"
              >
                중지
              </Button>
            ) : (
              <Button
                onClick={onStart}
                disabled={!canShare}
                className="min-h-[44px] shrink-0 px-4 text-[14px]"
              >
                위치 공유 시작
              </Button>
            )}
          </div>

          {!canShare && !started && (
            <p className="mt-2.5 rounded-lg bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-500">
              지금은 위치를 공유할 수 없습니다. 출발 30분 전부터 출발 1시간 후까지, 매칭이 성립한
              상대끼리만 가능합니다.
            </p>
          )}

          {contacts.length > 0 && (
            <div className="mt-2.5 flex gap-2 overflow-x-auto">
              {contacts.map((contact) => (
                <a
                  key={contact.userId}
                  href={`tel:${contact.phone.replace(/-/g, '')}`}
                  className="shrink-0 rounded-lg bg-emerald-600 px-3.5 py-2.5 text-[13px] font-semibold text-white active:bg-emerald-700"
                >
                  📞 {contact.name}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

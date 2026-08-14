/** 카카오 지도 래퍼.
 *  마커·경로를 선언적으로 받아 명령형 SDK 호출로 옮긴다.
 */

import { useEffect, useRef, useState } from 'react'

import type { LatLng } from '../../lib/geo'
import { loadKakaoMaps } from '../../lib/kakao'

export type PinKind = 'origin' | 'dest' | 'company' | 'waypoint' | 'me' | 'partner'

export type Pin = {
  id: string
  position: LatLng
  kind: PinKind
  label?: string
}

const PIN_STYLE: Record<PinKind, { bg: string; text: string }> = {
  origin: { bg: 'bg-brand-600', text: '출발' },
  dest: { bg: 'bg-rose-500', text: '도착' },
  company: { bg: 'bg-slate-800', text: '회사' },
  waypoint: { bg: 'bg-amber-500', text: '경유' },
  me: { bg: 'bg-brand-500', text: '나' },
  partner: { bg: 'bg-violet-500', text: '상대' },
}

function pinHtml(pin: Pin): string {
  const style = PIN_STYLE[pin.kind]
  const label = pin.label ?? style.text
  // Tailwind 클래스는 이 파일에서 스캔되므로 그대로 적용된다
  return `<div class="flex flex-col items-center pointer-events-none">
    <div class="${style.bg} rounded-full px-2 py-1 text-[11px] font-bold whitespace-nowrap text-white shadow-md">${label}</div>
    <div class="${style.bg} -mt-[3px] h-2.5 w-2.5 rotate-45 shadow-md"></div>
  </div>`
}

type Props = {
  /** 표시할 마커 */
  pins?: Pin[]
  /** 경로 폴리라인 */
  path?: LatLng[]
  /** 지도 클릭 시 좌표 전달. 없으면 클릭 비활성 */
  onMapClick?: (position: LatLng) => void
  /** pins/path 가 모두 보이도록 자동 맞춤 (기본 true) */
  fit?: boolean
  /** fit 대상이 없을 때의 중심 */
  center?: LatLng
  level?: number
  className?: string
}

export default function KakaoMap({
  pins = [],
  path,
  onMapClick,
  fit = true,
  center,
  level = 5,
  className = 'h-64 w-full',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<kakao.maps.Map | null>(null)
  const overlaysRef = useRef<kakao.maps.CustomOverlay[]>([])
  const polylineRef = useRef<kakao.maps.Polyline | null>(null)
  const clickHandlerRef = useRef(onMapClick)

  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  clickHandlerRef.current = onMapClick

  // ── 지도 생성 (1회) ─────────────────────────────────────────
  useEffect(() => {
    let alive = true

    loadKakaoMaps()
      .then((maps) => {
        if (!alive || !containerRef.current) return

        const map = new maps.Map(containerRef.current, {
          center: new maps.LatLng(center?.lat ?? 35.50512, center?.lng ?? 129.29956),
          level,
        })
        mapRef.current = map

        maps.event.addListener(map, 'click', ((e: kakao.maps.MouseEvent) => {
          clickHandlerRef.current?.({ lat: e.latLng.getLat(), lng: e.latLng.getLng() })
        }) as never)

        setReady(true)
      })
      .catch((err: Error) => alive && setError(err.message))

    return () => {
      alive = false
    }
    // 최초 1회만 생성한다 — 이후 변경은 아래 이펙트가 반영
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 마커 ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const maps = window.kakao.maps

    overlaysRef.current.forEach((o) => o.setMap(null))
    overlaysRef.current = pins.map((pin) => {
      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(pin.position.lat, pin.position.lng),
        content: pinHtml(pin),
        yAnchor: 1,
        zIndex: pin.kind === 'company' ? 1 : 2,
      })
      overlay.setMap(map)
      return overlay
    })
  }, [pins, ready])

  // ── 경로 ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const maps = window.kakao.maps

    polylineRef.current?.setMap(null)
    polylineRef.current = null

    if (path && path.length >= 2) {
      const line = new maps.Polyline({
        path: path.map((p) => new maps.LatLng(p.lat, p.lng)),
        strokeWeight: 5,
        strokeColor: '#0b7285',
        strokeOpacity: 0.85,
        strokeStyle: 'solid',
      })
      line.setMap(map)
      polylineRef.current = line
    }
  }, [path, ready])

  // ── 화면 맞춤 ───────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !fit) return
    const maps = window.kakao.maps

    const points: LatLng[] = [...pins.map((p) => p.position), ...(path ?? [])]
    if (points.length === 0) {
      if (center) map.setCenter(new maps.LatLng(center.lat, center.lng))
      return
    }
    if (points.length === 1) {
      map.setCenter(new maps.LatLng(points[0].lat, points[0].lng))
      map.setLevel(4)
      return
    }

    const bounds = new maps.LatLngBounds()
    points.forEach((p) => bounds.extend(new maps.LatLng(p.lat, p.lng)))
    map.setBounds(bounds, 40, 24, 40, 24)
  }, [pins, path, fit, center, ready])

  if (error) {
    return (
      <div
        className={`${className} grid place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4`}
      >
        <p className="text-center text-[12px] leading-relaxed text-slate-500">{error}</p>
      </div>
    )
  }

  return (
    <div className={`${className} relative overflow-hidden rounded-xl bg-slate-200`}>
      <div ref={containerRef} className="h-full w-full" />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-slate-100">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      )}
    </div>
  )
}

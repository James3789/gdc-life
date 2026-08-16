/** 카카오 지도 래퍼.
 *  마커·경로를 선언적으로 받아 명령형 SDK 호출로 옮긴다.
 *
 *  실시간 위치를 표시할 때 주의할 점 두 가지를 여기서 처리한다.
 *    1. 위치가 갱신될 때마다 화면을 다시 맞추면 사용자가 확대해 둔 것이 풀린다.
 *       → 마커의 "구성"(id 집합·경로 길이)이 바뀔 때만 다시 맞춘다.
 *    2. 지도를 한 번 움직인 뒤에는 자동으로 화면을 옮기지 않는다.
 *       → 다시 맞추고 싶으면 fitToken 을 바꾼다.
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
  /** 값이 바뀌면 사용자가 움직였더라도 화면을 다시 맞춘다 ([전체 보기] 용) */
  fitToken?: number
  /** fit 대상이 없을 때의 중심 */
  center?: LatLng
  level?: number
  /** 카카오 기본 확대/축소 버튼 */
  zoomControl?: boolean
  /** 모서리 둥글게 (전체화면에서는 끈다) */
  rounded?: boolean
  className?: string
}

export default function KakaoMap({
  pins = [],
  path,
  onMapClick,
  fit = true,
  fitToken = 0,
  center,
  level = 5,
  zoomControl = false,
  rounded = true,
  className = 'h-64 w-full',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<kakao.maps.Map | null>(null)
  const overlaysRef = useRef(new Map<string, kakao.maps.CustomOverlay>())
  const polylineRef = useRef<kakao.maps.Polyline | null>(null)
  const clickHandlerRef = useRef(onMapClick)
  /** 사용자가 지도를 움직였는가 — 움직였다면 자동 맞춤을 멈춘다 */
  const movedRef = useRef(false)
  const lastFitTokenRef = useRef(fitToken)

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

        if (zoomControl) {
          map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT)
        }

        maps.event.addListener(map, 'click', ((e: kakao.maps.MouseEvent) => {
          clickHandlerRef.current?.({ lat: e.latLng.getLat(), lng: e.latLng.getLng() })
        }) as never)

        // 손으로 끌었다면 그 뒤로는 화면을 마음대로 옮기지 않는다
        maps.event.addListener(map, 'dragstart', (() => {
          movedRef.current = true
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
  // 위치만 바뀐 마커는 다시 만들지 않고 옮긴다 (실시간 갱신 시 깜빡임 방지)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const maps = window.kakao.maps

    const next = new Map<string, kakao.maps.CustomOverlay>()

    for (const pin of pins) {
      const position = new maps.LatLng(pin.position.lat, pin.position.lng)
      const existing = overlaysRef.current.get(pin.id)

      if (existing) {
        existing.setPosition(position)
        existing.setContent(pinHtml(pin))
        overlaysRef.current.delete(pin.id)
        next.set(pin.id, existing)
      } else {
        const overlay = new maps.CustomOverlay({
          position,
          content: pinHtml(pin),
          yAnchor: 1,
          zIndex: pin.kind === 'company' ? 1 : 2,
        })
        overlay.setMap(map)
        next.set(pin.id, overlay)
      }
    }

    // 남은 것은 이번에 사라진 마커다
    overlaysRef.current.forEach((overlay) => overlay.setMap(null))
    overlaysRef.current = next
  }, [pins, ready])

  // ── 크기 변화 대응 ──────────────────────────────────────────
  // 지도는 만들어질 때의 크기를 기억한다. 전체화면으로 열리거나 화면을 돌리면
  // 다시 계산해 주지 않으면 회색으로 남거나 잘린 채로 그려진다.
  useEffect(() => {
    const container = containerRef.current
    if (!ready || !container || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => mapRef.current?.relayout())
    observer.observe(container)
    return () => observer.disconnect()
  }, [ready])

  // 화면을 벗어날 때 정리 (overlaysRef 는 갱신될 때마다 교체되므로 여기서 읽는다)
  useEffect(
    () => () => {
      overlaysRef.current.forEach((overlay) => overlay.setMap(null))
      overlaysRef.current.clear()
    },
    [],
  )

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
  // 마커가 "어디에 있는지"가 아니라 "무엇이 있는지"가 바뀔 때만 맞춘다.
  // 그래서 실시간 위치가 5초마다 들어와도 확대 상태가 유지된다.
  const layout = `${pins.map((p) => p.id).join('|')}#${path?.length ?? 0}`

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !fit) return
    const maps = window.kakao.maps

    // [전체 보기] 를 누르면(= fitToken 이 바뀌면) 사용자가 움직였더라도 다시 맞춘다
    if (fitToken !== lastFitTokenRef.current) {
      lastFitTokenRef.current = fitToken
      movedRef.current = false
    }
    if (movedRef.current) return

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
    // 위치 갱신마다 다시 맞추지 않도록 layout/fitToken 에만 반응한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, fitToken, fit, ready])

  if (error) {
    return (
      <div
        className={`${className} grid place-items-center border border-dashed border-slate-300 bg-slate-50 p-4 ${rounded ? 'rounded-xl' : ''}`}
      >
        <p className="text-center text-[12px] leading-relaxed text-slate-500">{error}</p>
      </div>
    )
  }

  return (
    <div
      className={`${className} relative overflow-hidden bg-slate-200 ${rounded ? 'rounded-xl' : ''}`}
    >
      <div ref={containerRef} className="h-full w-full" />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-slate-100">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      )}
    </div>
  )
}

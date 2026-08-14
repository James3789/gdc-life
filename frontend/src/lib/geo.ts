/** 위치 관련 공통 타입과 헬퍼. */

export type LatLng = { lat: number; lng: number }

/** 사용자가 고른 지점 — 좌표 + 사람이 읽을 주소 */
export type Place = LatLng & {
  addr: string
  /** 장소명(있으면). 예: "HD현대마린솔루션 글로벌디지털센터" */
  name?: string
}

/** 두 지점 사이 거리(m). 하버사인. */
export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`
}

export function formatDuration(seconds: number): string {
  const min = Math.round(seconds / 60)
  if (min < 60) return `${min}분`
  return `${Math.floor(min / 60)}시간 ${min % 60}분`
}

/** 브라우저 현재 위치. 권한 거부/실패 시 명확한 한국어 메시지로 reject. */
export function getCurrentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('이 브라우저는 현재위치를 지원하지 않습니다.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? '위치 권한이 거부되었습니다. 주소 검색이나 지도 클릭으로 지정해 주세요.'
            : err.code === err.TIMEOUT
              ? '현재위치를 가져오는 데 시간이 초과되었습니다.'
              : '현재위치를 가져오지 못했습니다.'
        reject(new Error(message))
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  })
}

/** 주소·장소 검색과 좌표→주소 변환. 모두 브라우저 SDK(services)로 처리한다. */

import type { LatLng, Place } from './geo'
import { loadKakaoMaps } from './kakao'

/** 장소명과 주소를 함께 검색한다. 장소 결과를 앞에 둔다. */
export async function searchPlaces(keyword: string): Promise<Place[]> {
  const query = keyword.trim()
  if (!query) return []

  const maps = await loadKakaoMaps()
  const places = new maps.services.Places()
  const geocoder = new maps.services.Geocoder()

  const byKeyword = new Promise<Place[]>((resolve) => {
    places.keywordSearch(
      query,
      (result, status) => {
        if (status !== maps.services.Status.OK) return resolve([])
        resolve(
          result.map((r) => ({
            lat: Number(r.y),
            lng: Number(r.x),
            addr: r.road_address_name || r.address_name,
            name: r.place_name,
          })),
        )
      },
      { size: 10 },
    )
  })

  const byAddress = new Promise<Place[]>((resolve) => {
    geocoder.addressSearch(
      query,
      (result, status) => {
        if (status !== maps.services.Status.OK) return resolve([])
        resolve(
          result.map((r) => ({
            lat: Number(r.y),
            lng: Number(r.x),
            addr: r.road_address?.address_name ?? r.address_name,
            name: r.road_address?.building_name || undefined,
          })),
        )
      },
      { size: 5 },
    )
  })

  const [placeResults, addressResults] = await Promise.all([byKeyword, byAddress])

  // 같은 좌표가 양쪽에서 나오면 하나만 남긴다
  const seen = new Set<string>()
  return [...placeResults, ...addressResults].filter((p) => {
    const key = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** 좌표 → 주소. 지도 클릭·현재위치로 지점을 잡을 때 쓴다. */
export async function coordToPlace(position: LatLng): Promise<Place> {
  const maps = await loadKakaoMaps()
  const geocoder = new maps.services.Geocoder()

  const addr = await new Promise<string>((resolve) => {
    geocoder.coord2Address(position.lng, position.lat, (result, status) => {
      if (status !== maps.services.Status.OK || result.length === 0) {
        resolve('')
        return
      }
      const top = result[0]
      resolve(top.road_address?.address_name ?? top.address?.address_name ?? '')
    })
  })

  return {
    ...position,
    // 주소를 못 찾는 지점(바다·산 등)도 있으므로 좌표로 대체한다
    addr: addr || `위도 ${position.lat.toFixed(5)}, 경도 ${position.lng.toFixed(5)}`,
  }
}

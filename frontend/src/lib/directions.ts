/** 길찾기. REST 키를 감추기 위해 Edge Function 을 거친다. */

import type { LatLng } from './geo'
import { supabase } from './supabase'

export type Route = {
  distanceM: number
  durationS: number
  path: LatLng[]
}

export async function fetchRoute(
  origin: LatLng,
  destination: LatLng,
  waypoints: LatLng[] = [],
): Promise<Route> {
  const { data, error } = await supabase.functions.invoke<Route | { error: string }>(
    'kakao-directions',
    {
      body: {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        waypoints: waypoints.map(({ lat, lng }) => ({ lat, lng })),
      },
    },
  )

  if (error) throw new Error('경로를 계산하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  if (!data || 'error' in data) {
    throw new Error(
      data && 'error' in data && data.error === 'route_not_found'
        ? '해당 지점 사이의 경로를 찾지 못했습니다. 위치를 조정해 주세요.'
        : '경로를 계산하지 못했습니다.',
    )
  }

  return data
}

/** 실시간 위치 공유.
 *
 *  위치는 DB에 저장하지 않고 Realtime Broadcast 로만 흘려보낸다.
 *  채널 접근은 서버(realtime.messages RLS)가 통제하므로,
 *  매칭되지 않은 사람은 구독 자체가 실패한다.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'

import type { LatLng } from './geo'
import { supabase } from './supabase'

export type PeerLocation = LatLng & {
  userId: string
  name: string
  /** 수신 시각 (ms) */
  at: number
}

export type ShareState =
  | 'idle' // 아직 시작 안 함
  | 'connecting'
  | 'sharing' // 내 위치를 보내는 중
  | 'watching' // 채널에는 붙었지만 내 위치는 안 보냄 (권한 거부 등)
  | 'denied' // 채널 입장 거부 — 매칭이 아니거나 운행 시간대가 아님
  | 'error'

/** 상대가 이 시간 넘게 조용하면 오래된 위치로 본다 */
const STALE_MS = 60_000

export function useLiveLocation(offerId: string | undefined, me: { id: string; name: string } | null) {
  const [state, setState] = useState<ShareState>('idle')
  const [peers, setPeers] = useState<Record<string, PeerLocation>>({})
  const [myPosition, setMyPosition] = useState<LatLng | null>(null)
  const [error, setError] = useState<string | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const watchIdRef = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    setState('idle')
    setPeers({})
    setMyPosition(null)
  }, [])

  const start = useCallback(async () => {
    if (!offerId || !me || channelRef.current) return

    setState('connecting')
    setError(null)

    // private 채널은 현재 세션 토큰으로 인가된다
    await supabase.realtime.setAuth()

    const channel = supabase.channel(`trip:${offerId}`, {
      config: { private: true, broadcast: { self: false } },
    })
    channelRef.current = channel

    channel.on('broadcast', { event: 'location' }, ({ payload }) => {
      const p = payload as PeerLocation
      if (!p?.userId || p.userId === me.id) return
      setPeers((prev) => ({ ...prev, [p.userId]: { ...p, at: Date.now() } }))
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setState('watching')
        beginWatching()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        // 서버가 막은 경우 — 매칭이 아니거나 운행 시간대가 아니다
        setState('denied')
      }
    })

    function beginWatching() {
      if (!('geolocation' in navigator)) {
        setError('이 브라우저는 위치 기능을 지원하지 않습니다. 상대 위치만 표시됩니다.')
        return
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const point = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setMyPosition(point)
          setState('sharing')
          channelRef.current?.send({
            type: 'broadcast',
            event: 'location',
            payload: { ...point, userId: me!.id, name: me!.name, at: Date.now() },
          })
        },
        (err) => {
          // 권한 거부는 정상 흐름 — 내 위치만 안 보내고 나머지는 그대로 쓴다
          setError(
            err.code === err.PERMISSION_DENIED
              ? '위치 권한이 거부되어 내 위치는 공유되지 않습니다. 상대 위치는 계속 표시됩니다.'
              : '현재위치를 가져오지 못했습니다. 상대 위치는 계속 표시됩니다.',
          )
          setState('watching')
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
      )
    }
  }, [offerId, me])

  // 화면을 벗어나면 반드시 중단한다
  useEffect(() => stop, [stop])

  const freshPeers = Object.values(peers).filter((p) => Date.now() - p.at < STALE_MS)

  return { state, peers: freshPeers, myPosition, error, start, stop }
}

/** 지금 이 카풀의 위치를 공유해도 되는지 서버에 묻는다. */
export async function canShareLocation(offerId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_share_location', { p_offer_id: offerId })
  if (error) return false
  return data === true
}

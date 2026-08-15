/** 앱 내 알림.
 *
 *  알림 자체는 서버(트리거)가 만든다. 프론트는 읽고, 읽음 처리하고,
 *  새 알림이 오면 실시간으로 받아 배지를 갱신하는 역할만 한다.
 *
 *  브라우저 푸시(닫혀 있을 때 도착하는 알림)는 쓰지 않는다.
 *  Web Push 는 별도 푸시 서버와 VAPID 키가 필요해 개인 운영 범위를 벗어난다.
 *  대신 앱이 열려 있는 동안에는 Notification API 로 화면 밖에서도 눈에 띄게 한다.
 */

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from './auth'
import { supabase } from './supabase'

export type NotificationKind =
  | 'request_received'
  | 'request_accepted'
  | 'request_rejected'
  | 'request_cancelled'
  | 'offer_cancelled'
  | 'trip_completed'

export type AppNotification = {
  id: string
  kind: NotificationKind
  title: string
  body: string
  link: string | null
  offerId: string | null
  requestId: string | null
  readAt: string | null
  createdAt: string
}

/** 종류별 아이콘 — 목록에서 한눈에 구분되게 */
export const NOTIFICATION_EMOJI: Record<NotificationKind, string> = {
  request_received: '🙋',
  request_accepted: '✅',
  request_rejected: '🚫',
  request_cancelled: '↩️',
  offer_cancelled: '⚠️',
  trip_completed: '🏁',
}

type Row = {
  id: string
  kind: NotificationKind
  title: string
  body: string
  link: string | null
  offer_id: string | null
  request_id: string | null
  read_at: string | null
  created_at: string
}

function toNotification(row: Row): AppNotification {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    link: row.link,
    offerId: row.offer_id,
    requestId: row.request_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}

const FIELDS = 'id, kind, title, body, link, offer_id, request_id, read_at, created_at'

export async function listNotifications(limit = 100): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(FIELDS)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data as unknown as Row[]).map(toNotification)
}

/** 배지용 — 목록을 받지 않고 개수만 센다 */
export async function countUnread(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)

  if (error) return 0
  return count ?? 0
}

export async function markAllRead(): Promise<void> {
  // RLS 가 본인 알림으로 범위를 좁히므로 별도 조건이 필요 없다
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)

  if (error) throw new Error(error.message)
}

export async function markRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function clearAllNotifications(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return
  const { error } = await supabase.from('notifications').delete().eq('user_id', auth.user.id)
  if (error) throw new Error(error.message)
}

// ── 실시간 수신 ───────────────────────────────────────────────

/** 새 알림이 들어오면 콜백. 반환값을 호출하면 구독을 끊는다. */
export function subscribeNotifications(
  userId: string,
  onInsert: (notification: AppNotification) => void,
): () => void {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        // 서버의 RLS 가 최종 방어선이고, 이 필터는 불필요한 수신을 줄인다
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onInsert(toNotification(payload.new as Row)),
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

// ── 브라우저 알림 (앱이 열려 있을 때만) ───────────────────────

export type DesktopPermission = 'unsupported' | 'default' | 'granted' | 'denied'

export function desktopPermission(): DesktopPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function requestDesktopPermission(): Promise<DesktopPermission> {
  if (desktopPermission() === 'unsupported') return 'unsupported'
  return await Notification.requestPermission()
}

function showDesktopNotification(notification: AppNotification) {
  if (desktopPermission() !== 'granted') return
  // 화면을 보고 있으면 배지로 충분하다
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return

  try {
    new Notification(notification.title, {
      body: notification.body,
      tag: notification.id,
      icon: '/icons/icon-192.png',
    })
  } catch {
    // 일부 모바일 브라우저는 서비스워커 없이 생성자를 막는다 — 배지로 대체
  }
}

// ── 배지 훅 ───────────────────────────────────────────────────

/** 안 읽은 알림 수. 실시간 수신 + 화면 복귀 시 재확인. */
export function useUnreadNotifications() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!userId) {
      setCount(0)
      return
    }
    setCount(await countUnread())
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setCount(0)
      return
    }
    let alive = true

    void refresh()

    const unsubscribe = subscribeNotifications(userId, (notification) => {
      if (!alive) return
      setCount((n) => n + 1)
      showDesktopNotification(notification)
    })

    // 실시간 연결이 끊겼던 동안 쌓인 것을 따라잡는다
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      alive = false
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, refresh])

  return { count, refresh }
}

// ── 표기 ──────────────────────────────────────────────────────

/** '방금', '12분 전', '어제', '8월 3일' */
export function relativeTime(iso: string): string {
  const then = new Date(iso)
  const diffMin = Math.floor((Date.now() - then.getTime()) / 60000)

  if (diffMin < 1) return '방금'
  if (diffMin < 60) return `${diffMin}분 전`

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}시간 전`
  if (diffHour < 48) return '어제'

  return `${then.getMonth() + 1}월 ${then.getDate()}일`
}

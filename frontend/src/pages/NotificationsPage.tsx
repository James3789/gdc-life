/** 알림함.
 *
 *  화면을 열면 목록을 받아오고, 이후 도착하는 알림은 실시간으로 위에 쌓인다.
 *  읽음 처리는 항목을 눌렀을 때와 [모두 읽음] 두 가지뿐이다.
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import AppShell from '../components/AppShell'
import { Alert } from '../components/ui'
import { useAuth } from '../lib/auth'
import {
  NOTIFICATION_EMOJI,
  type AppNotification,
  type DesktopPermission,
  clearAllNotifications,
  deleteNotification,
  desktopPermission,
  listNotifications,
  markAllRead,
  markRead,
  relativeTime,
  requestDesktopPermission,
  subscribeNotifications,
} from '../lib/notifications'

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id

  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [permission, setPermission] = useState<DesktopPermission>(desktopPermission())

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await listNotifications())
    } catch (err) {
      setError(err instanceof Error ? err.message : '알림을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  // 열어둔 동안 도착하는 알림은 바로 위에 붙인다
  useEffect(() => {
    if (!userId) return
    return subscribeNotifications(userId, (next) => {
      setItems((prev) => (prev.some((n) => n.id === next.id) ? prev : [next, ...prev]))
    })
  }, [userId])

  const unread = items.filter((n) => n.readAt === null).length

  async function open(notification: AppNotification) {
    if (notification.readAt === null) {
      setItems((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)),
      )
      void markRead(notification.id)
    }
    if (notification.link) navigate(notification.link)
  }

  async function readAll() {
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })))
    try {
      await markAllRead()
    } catch {
      await reload()
    }
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id))
    try {
      await deleteNotification(id)
    } catch {
      await reload()
    }
  }

  async function clearAll() {
    if (!window.confirm('알림을 모두 지울까요? 되돌릴 수 없습니다.')) return
    setItems([])
    try {
      await clearAllNotifications()
    } catch {
      await reload()
    }
  }

  async function allowDesktop() {
    setPermission(await requestDesktopPermission())
  }

  return (
    <AppShell
      title="알림"
      subtitle={unread > 0 ? `안 읽은 알림 ${unread}건` : '모두 확인했습니다'}
      back
      bell={false}
      action={
        unread > 0 ? (
          <button
            type="button"
            onClick={readAll}
            className="shrink-0 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-brand-700 active:bg-brand-50"
          >
            모두 읽음
          </button>
        ) : undefined
      }
    >
      {error && <Alert tone="error">{error}</Alert>}

      {/* 앱이 열려 있는 동안만 동작하는 알림 — 켤지 말지는 사용자가 정한다 */}
      {permission === 'default' && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-brand-800">
            앱을 켜 둔 동안 새 알림을 화면에 띄울까요?
          </p>
          <button
            type="button"
            onClick={allowDesktop}
            className="shrink-0 rounded-lg bg-brand-600 px-3.5 py-2 text-[13px] font-semibold text-white active:bg-brand-700"
          >
            허용
          </button>
        </div>
      )}

      {loading ? (
        <p className="px-1 text-[13px] text-slate-400">불러오는 중…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
          <p className="text-[14px] font-semibold text-slate-700">알림이 없습니다.</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
            신청이 들어오거나 매칭이 성립하면
            <br />
            여기로 알려드립니다.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-2.5">
            {items.map((notification) => (
              <li key={notification.id}>
                <div
                  className={`flex items-start gap-3 rounded-2xl border p-4 ${
                    notification.readAt === null
                      ? 'border-brand-200 bg-brand-50/60'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => open(notification)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <span aria-hidden className="text-[20px] leading-none">
                      {NOTIFICATION_EMOJI[notification.kind]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        {notification.readAt === null && (
                          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                        )}
                        <span className="truncate text-[14px] font-bold text-slate-900">
                          {notification.title}
                        </span>
                      </span>
                      <span className="mt-1 block text-[13px] leading-relaxed text-slate-600">
                        {notification.body}
                      </span>
                      <span className="mt-1.5 block text-[12px] text-slate-400">
                        {relativeTime(notification.createdAt)}
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => remove(notification.id)}
                    aria-label="알림 삭제"
                    className="-mt-1 -mr-1 shrink-0 rounded-full p-2 text-[15px] text-slate-300 active:bg-slate-100"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={clearAll}
            className="mt-5 w-full rounded-xl border border-slate-300 bg-white py-3 text-[14px] font-semibold text-slate-600 active:bg-slate-50"
          >
            알림 모두 지우기
          </button>
        </>
      )}

      <p className="mt-4 px-1 text-[12px] leading-relaxed text-slate-400">
        {permission === 'denied'
          ? '브라우저에서 알림이 차단되어 있습니다. 알림함에서는 계속 확인할 수 있습니다.'
          : '앱이 닫혀 있을 때는 알림이 오지 않습니다. 앱을 열면 밀린 알림을 모두 볼 수 있습니다.'}
      </p>
    </AppShell>
  )
}

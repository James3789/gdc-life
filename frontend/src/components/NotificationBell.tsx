/** 헤더의 알림 종. 안 읽은 개수를 배지로 보여준다.
 *  로그인 전에는 아무것도 그리지 않는다 (로그인·가입 화면에서도 헤더를 공유한다).
 */

import { Link } from 'react-router-dom'

import { useAuth } from '../lib/auth'
import { useUnreadNotifications } from '../lib/notifications'
import { BellIcon } from './icons'

export default function NotificationBell() {
  const { session } = useAuth()
  const { count } = useUnreadNotifications()

  if (!session) return null

  return (
    <Link
      to="/notifications"
      aria-label={count > 0 ? `알림 ${count}건` : '알림'}
      className="relative -mr-1 shrink-0 rounded-full p-2 text-slate-600 active:bg-slate-100"
    >
      <BellIcon className="h-6 w-6" />
      {count > 0 && (
        <span className="absolute top-0.5 right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] leading-none font-bold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}

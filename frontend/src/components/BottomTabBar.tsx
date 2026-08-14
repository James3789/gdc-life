import { NavLink, useLocation } from 'react-router-dom'
import { CalendarIcon, CarIcon, HomeIcon, UserIcon } from './icons'

const TABS = [
  { to: '/home', label: '홈', Icon: HomeIcon, match: (p: string) => p === '/home' },
  {
    to: '/carpool',
    label: '카풀',
    Icon: CarIcon,
    match: (p: string) => p.startsWith('/carpool') && p !== '/carpool/calendar',
  },
  {
    to: '/carpool/calendar',
    label: '달력',
    Icon: CalendarIcon,
    match: (p: string) => p === '/carpool/calendar',
  },
  { to: '/profile', label: '내정보', Icon: UserIcon, match: (p: string) => p === '/profile' },
]

export default function BottomTabBar() {
  const { pathname } = useLocation()

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] border-t border-slate-200 bg-white/95 backdrop-blur">
      <ul className="flex">
        {TABS.map(({ to, label, Icon, match }) => {
          const active = match(pathname)
          return (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                  active ? 'text-brand-600' : 'text-slate-400'
                }`}
              >
                <Icon className="h-6 w-6" />
                {label}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

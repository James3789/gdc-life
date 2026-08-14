/** 인라인 SVG 아이콘 (외부 의존성 없음). */

type Props = { className?: string }

const base = 'h-6 w-6'
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export function HomeIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5h4v5" />
    </svg>
  )
}

export function CarIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M4.5 16.5h15" />
      <path d="M5 16.5v2h2.5v-2M16.5 16.5v2H19v-2" />
      <path d="M4.5 16.5v-4l1.8-4.3A2 2 0 0 1 8.1 7h7.8a2 2 0 0 1 1.8 1.2l1.8 4.3v4" />
      <path d="M5 12.5h14" />
      <circle cx="8" cy="14.5" r=".9" fill="currentColor" stroke="none" />
      <circle cx="16" cy="14.5" r=".9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function CalendarIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3.5V6.5M16 3.5V6.5" />
      <circle cx="8.5" cy="13.5" r=".9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="13.5" r=".9" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="13.5" r=".9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function UserIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  )
}

export function ChevronRightIcon({ className = 'h-5 w-5' }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="m9.5 6 6 6-6 6" />
    </svg>
  )
}

export function ArrowLeftIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </svg>
  )
}

export function RouteIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M8.5 18h4.5a4 4 0 0 0 0-8H11a4 4 0 0 1 0-8" transform="translate(0 2)" />
    </svg>
  )
}

export function SparkIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5 10.1 12.8 4.5 10.9 10.1 9z" />
    </svg>
  )
}

/** 날짜 헬퍼. 시간대 문제를 피하려고 문자열(YYYY-MM-DD) 기준으로 다룬다. */

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const

/** 평일(월~금) */
export const WEEKDAYS = [1, 2, 3, 4, 5]

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function addDays(iso: string, days: number): string {
  const date = fromISODate(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

/** '2026-09-01' → '9월 1일 (화)' */
export function formatDateKo(iso: string): string {
  const date = fromISODate(iso)
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAY_LABELS[date.getDay()]})`
}

/** '07:30' → '오전 7:30' */
export function formatTimeKo(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h < 12 ? '오전' : '오후'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${period} ${hour}:${String(m).padStart(2, '0')}`
}

/**
 * 시작~종료 사이에서 선택한 요일에 해당하는 날짜를 모두 만든다.
 * @param weekdays 0=일 … 6=토
 */
export function expandRecurringDates(
  startISO: string,
  endISO: string,
  weekdays: number[],
  limit = 90,
): string[] {
  if (weekdays.length === 0 || endISO < startISO) return []

  const dates: string[] = []
  const end = fromISODate(endISO)
  const cursor = fromISODate(startISO)

  while (cursor <= end && dates.length < limit) {
    if (weekdays.includes(cursor.getDay())) dates.push(toISODate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

/** 달력 그리드 — 해당 월을 감싸는 6주(일요일 시작) */
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay())

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    return toISODate(date)
  })
}

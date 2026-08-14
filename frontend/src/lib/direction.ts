/** 출근/퇴근 분기 메타.
 *  기능 로직이 거의 동일하므로 화면·서비스는 공용으로 두고
 *  이 테이블로만 문구/역할을 분기한다.
 */

export type Direction = 'commute-in' | 'commute-out'

export type DirectionMeta = {
  label: string
  /** 회사가 고정되는 쪽 */
  fixedPointLabel: '도착지' | '출발지'
  /** 봉사자가 입력하는 지점 */
  driverInputLabel: '출발지' | '목적지'
  /** 탑승자가 입력하는 지점 */
  passengerInputLabel: '탑승 위치' | '목적지'
  /** 시간 필드 설명 */
  timeLabel: string
}

export const DIRECTIONS: Record<Direction, DirectionMeta> = {
  'commute-in': {
    label: '출근',
    fixedPointLabel: '도착지',
    driverInputLabel: '출발지',
    passengerInputLabel: '탑승 위치',
    timeLabel: '탑승 시간',
  },
  'commute-out': {
    label: '퇴근',
    fixedPointLabel: '출발지',
    driverInputLabel: '목적지',
    passengerInputLabel: '목적지',
    timeLabel: '회사 출발 시간',
  },
}

export function isDirection(value: unknown): value is Direction {
  return value === 'commute-in' || value === 'commute-out'
}

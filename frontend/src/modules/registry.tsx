/** GDC Life 기능 모듈 레지스트리.
 *  향후 사내 기능이 추가되면 이 배열에만 항목을 넣으면 홈 대시보드에 노출된다.
 */

import type { ComponentType } from 'react'
import { CarIcon, RouteIcon, SparkIcon } from '../components/icons'

export type AppModule = {
  key: string
  name: string
  description: string
  to: string
  Icon: ComponentType<{ className?: string }>
  enabled: boolean
}

export const MODULES: AppModule[] = [
  {
    key: 'carpool',
    name: '카풀',
    description: '출퇴근 함께 타기 · 봉사자/탑승자 매칭',
    to: '/carpool',
    Icon: CarIcon,
    enabled: true,
  },
  {
    key: 'shuttle',
    name: '셔틀 안내',
    description: '통근버스 노선 · 시간표',
    to: '#',
    Icon: RouteIcon,
    enabled: false,
  },
  {
    key: 'welfare',
    name: '사내 복지',
    description: '준비 중인 기능입니다',
    to: '#',
    Icon: SparkIcon,
    enabled: false,
  },
]

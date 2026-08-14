/** 아직 구현 전인 화면들. 각 Phase에서 개별 파일로 분리되며 실제 구현으로 대체된다. */

import AppShell from '../components/AppShell'
import ComingSoon from '../components/ComingSoon'

export function RequestsPage() {
  return (
    <AppShell title="신청함" subtitle="받은 신청 · 내 신청">
      <ComingSoon
        phase="Phase 4"
        items={[
          '봉사자: 받은 신청 허락 / 거절',
          '좌석 차감 및 마감 처리',
          '허락된 상대에게만 전화번호 공개',
        ]}
      />
    </AppShell>
  )
}

export function TripPage() {
  return (
    <AppShell title="카풀 상세" subtitle="매칭 성립" back tabs={false}>
      <ComingSoon
        phase="Phase 5"
        items={[
          '실시간 위치 공유 (운행 시간대 한정)',
          'Geolocation 권한 거부 시에도 정상 동작',
          '전화 버튼 (tel: 링크)',
        ]}
      />
    </AppShell>
  )
}

export function NotFoundPage() {
  return (
    <AppShell title="페이지를 찾을 수 없습니다" tabs={false} back>
      <p className="text-sm text-slate-500">주소를 다시 확인해 주세요.</p>
    </AppShell>
  )
}

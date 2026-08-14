/** Phase 0 스캐폴드 자리표시자 화면들.
 *  각 Phase 진행 시 개별 파일로 분리되며 실제 구현으로 대체된다.
 */

import AppShell from '../components/AppShell'
import ComingSoon from '../components/ComingSoon'

export function LoginPage() {
  return (
    <AppShell title="로그인" subtitle="GDC Life" tabs={false}>
      <ComingSoon
        phase="Phase 1"
        items={['ID / 비밀번호 로그인', 'JWT access · refresh 발급', '자동 로그인 유지']}
      />
    </AppShell>
  )
}

export function SignupPage() {
  return (
    <AppShell title="회원가입" subtitle="GDC Life" back tabs={false}>
      <ComingSoon
        phase="Phase 1"
        items={[
          'ID · 비밀번호 · 성명 · 부서 · 이메일 · 전화번호',
          'ID 중복 검사, 형식 검증',
          '사내 이메일 도메인 검증(설정 on/off)',
        ]}
      />
    </AppShell>
  )
}

export function OfferNewPage() {
  return (
    <AppShell title="카풀 등록" subtitle="봉사자" back>
      <ComingSoon
        phase="Phase 2"
        items={[
          '출근/퇴근 · 날짜 · 시간 선택',
          'Kakao 지도 주소검색 · 지도 클릭 · 현재위치',
          '경유지 추가, 좌석 1~4석(기본 3)',
          '길찾기 경로 폴리라인 표시 및 저장',
          '요일 반복 등록',
        ]}
      />
    </AppShell>
  )
}

export function SearchPage() {
  return (
    <AppShell title="카풀 찾기" subtitle="탑승자" back>
      <ComingSoon
        phase="Phase 3"
        items={[
          '탑승 위치 / 목적지 + 희망 시간 입력',
          '시간 허용 범위 ±10 / ±20 / ±30분',
          '경로 반경 + 시간 근접도 스코어링',
          '추천 리스트 · 지도 미리보기 · 카풀 신청',
        ]}
      />
    </AppShell>
  )
}

export function RequestsPage() {
  return (
    <AppShell title="신청함" subtitle="받은 신청 · 내 신청">
      <ComingSoon
        phase="Phase 4"
        items={['봉사자: 받은 신청 허락 / 거절', '좌석 차감 및 마감 처리', '탑승자: 내 신청 현황']}
      />
    </AppShell>
  )
}

export function CalendarPage() {
  return (
    <AppShell title="내 카풀 달력" subtitle="등록 현황">
      <ComingSoon
        phase="Phase 2 · 7"
        items={['월간 캘린더로 등록 카풀 확인', '반복 그룹 단위 수정 / 취소']}
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

export function ProfilePage() {
  return (
    <AppShell title="내 정보" subtitle="프로필 · 별점">
      <ComingSoon
        phase="Phase 1 · 6"
        items={['내 정보 조회 / 수정', '별점 월간 · 연간 · 누적', '최근 운행 이력']}
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

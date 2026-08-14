import AppShell from '../components/AppShell'

export function NotFoundPage() {
  return (
    <AppShell title="페이지를 찾을 수 없습니다" tabs={false} back>
      <p className="text-sm text-slate-500">주소를 다시 확인해 주세요.</p>
    </AppShell>
  )
}

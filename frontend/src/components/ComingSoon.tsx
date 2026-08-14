/** Phase 0 스캐폴드용 자리표시자. 각 Phase에서 실제 화면으로 대체된다. */

export default function ComingSoon({ phase, items }: { phase: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5">
      <span className="inline-block rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
        {phase}에서 구현
      </span>
      <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-slate-300">•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

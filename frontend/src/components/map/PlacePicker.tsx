/** 위치 지정 시트 — 주소/장소 검색 · 지도 클릭 · 현재위치. */

import { useEffect, useState, type FormEvent } from 'react'

import { Alert, Button } from '../ui'
import KakaoMap from './KakaoMap'
import { getCurrentPosition, type Place } from '../../lib/geo'
import { coordToPlace, searchPlaces } from '../../lib/places'

type Props = {
  open: boolean
  title: string
  initial?: Place | null
  onClose: () => void
  onSelect: (place: Place) => void
}

export default function PlacePicker({ open, title, initial, onClose, onSelect }: Props) {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<Place[] | null>(null)
  const [picked, setPicked] = useState<Place | null>(initial ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 열릴 때마다 초기 상태로 되돌린다
  useEffect(() => {
    if (open) {
      setKeyword('')
      setResults(null)
      setPicked(initial ?? null)
      setError(null)
    }
  }, [open, initial])

  // 시트가 떠 있는 동안 뒤 화면 스크롤 방지
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    if (!keyword.trim()) return
    setBusy(true)
    setError(null)
    try {
      const found = await searchPlaces(keyword)
      setResults(found)
      if (found.length === 0) setError('검색 결과가 없습니다. 다른 키워드로 찾아보세요.')
    } catch (err) {
      setError(err instanceof Error ? err.message : '검색에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function handleMapClick(position: { lat: number; lng: number }) {
    setError(null)
    setResults(null)
    try {
      setPicked(await coordToPlace(position))
    } catch {
      setPicked({ ...position, addr: `위도 ${position.lat.toFixed(5)}, 경도 ${position.lng.toFixed(5)}` })
    }
  }

  async function handleCurrentPosition() {
    setBusy(true)
    setError(null)
    try {
      const position = await getCurrentPosition()
      setPicked(await coordToPlace(position))
      setResults(null)
    } catch (err) {
      // 권한 거부는 정상 흐름 — 다른 방법으로 지정하면 된다
      setError(err instanceof Error ? err.message : '현재위치를 가져오지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-slate-900/40">
      <div className="flex h-dvh w-full max-w-[480px] flex-col bg-white">
        {/* 헤더 */}
        <header className="safe-top flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <h2 className="flex-1 text-[16px] font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-[13px] font-medium text-slate-500 active:bg-slate-100"
          >
            닫기
          </button>
        </header>

        {/* 검색 */}
        <form onSubmit={handleSearch} className="flex gap-2 border-b border-slate-100 px-4 py-3">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="장소명 또는 주소 검색"
            className="min-h-[44px] flex-1 rounded-xl border border-slate-300 px-3.5 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
          />
          <Button type="submit" loading={busy} className="min-h-[44px] px-4">
            검색
          </Button>
        </form>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="px-4 pt-3">
              <Alert tone="error">{error}</Alert>
            </div>
          )}

          {results && results.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {results.map((place, i) => (
                <li key={`${place.lat}-${place.lng}-${i}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setPicked(place)
                      setResults(null)
                    }}
                    className="w-full px-4 py-3.5 text-left active:bg-slate-50"
                  >
                    <p className="text-[14px] font-semibold text-slate-900">
                      {place.name ?? place.addr}
                    </p>
                    {place.name && <p className="mt-0.5 text-[12px] text-slate-500">{place.addr}</p>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4">
              <KakaoMap
                className="h-[42vh] w-full"
                pins={picked ? [{ id: 'picked', position: picked, kind: 'origin', label: '선택' }] : []}
                center={picked ?? undefined}
                onMapClick={handleMapClick}
              />
              <p className="mt-2 px-1 text-[12px] text-slate-500">
                지도를 눌러 위치를 직접 지정할 수 있습니다.
              </p>
              <Button
                variant="secondary"
                full
                onClick={handleCurrentPosition}
                loading={busy}
                className="mt-3"
              >
                📍 현재위치로 지정
              </Button>
            </div>
          )}
        </div>

        {/* 확정 */}
        <footer className="safe-bottom border-t border-slate-200 px-4 py-3">
          <p className="mb-2 min-h-[38px] rounded-lg bg-slate-50 px-3 py-2 text-[13px] leading-snug text-slate-700">
            {picked ? (
              <>
                {picked.name && <strong className="mr-1">{picked.name}</strong>}
                {picked.addr}
              </>
            ) : (
              <span className="text-slate-400">위치를 검색하거나 지도에서 선택하세요.</span>
            )}
          </p>
          <Button full disabled={!picked} onClick={() => picked && onSelect(picked)}>
            이 위치로 선택
          </Button>
        </footer>
      </div>
    </div>
  )
}

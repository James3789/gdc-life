/** Kakao Maps SDK 로더.
 *  SDK 는 무겁고 지도 화면에서만 필요하므로 필요할 때 한 번만 주입한다.
 */

const JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY ?? ''
const SDK_URL = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${JS_KEY}&libraries=services&autoload=false`

export const isKakaoConfigured = Boolean(JS_KEY)

let loading: Promise<typeof kakao.maps> | null = null

export function loadKakaoMaps(): Promise<typeof kakao.maps> {
  if (loading) return loading

  loading = new Promise<typeof kakao.maps>((resolve, reject) => {
    if (!JS_KEY) {
      reject(new Error('VITE_KAKAO_JS_KEY 가 설정되지 않았습니다.'))
      return
    }

    // 이미 주입돼 있으면 초기화만
    if (window.kakao?.maps) {
      window.kakao.maps.load(() => resolve(window.kakao.maps))
      return
    }

    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.onload = () => window.kakao.maps.load(() => resolve(window.kakao.maps))
    script.onerror = () =>
      reject(
        new Error(
          '카카오 지도를 불러오지 못했습니다. 개발자 콘솔에 현재 도메인이 등록되어 있는지 확인해 주세요.',
        ),
      )
    document.head.appendChild(script)
  })

  // 실패한 Promise 를 캐시에 남겨두면 재시도가 막힌다
  loading.catch(() => {
    loading = null
  })

  return loading
}

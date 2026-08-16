/** Kakao Maps JavaScript SDK 타입 — 이 앱이 실제로 쓰는 부분만 선언한다. */

export {}

declare global {
  interface Window {
    kakao: typeof kakao
  }

  namespace kakao.maps {
    /** autoload=false 로 로드했을 때 SDK 초기화 */
    function load(callback: () => void): void

    class LatLng {
      constructor(lat: number, lng: number)
      getLat(): number
      getLng(): number
    }

    class LatLngBounds {
      constructor()
      extend(latlng: LatLng): void
      isEmpty(): boolean
    }

    class Size {
      constructor(width: number, height: number)
    }

    class Point {
      constructor(x: number, y: number)
    }

    interface MapOptions {
      center: LatLng
      level?: number
      draggable?: boolean
      scrollwheel?: boolean
    }

    class Map {
      constructor(container: HTMLElement, options: MapOptions)
      setCenter(latlng: LatLng): void
      getCenter(): LatLng
      setLevel(level: number): void
      getLevel(): number
      setBounds(
        bounds: LatLngBounds,
        paddingTop?: number,
        paddingRight?: number,
        paddingBottom?: number,
        paddingLeft?: number,
      ): void
      setDraggable(draggable: boolean): void
      setZoomable(zoomable: boolean): void
      relayout(): void
      panTo(latlng: LatLng): void
      addControl(control: object, position: number): void
    }

    /** 기본 확대/축소 버튼 */
    class ZoomControl {
      constructor()
    }

    const ControlPosition: {
      readonly TOP: number
      readonly TOPLEFT: number
      readonly TOPRIGHT: number
      readonly LEFT: number
      readonly RIGHT: number
      readonly BOTTOM: number
      readonly BOTTOMLEFT: number
      readonly BOTTOMRIGHT: number
    }

    interface MarkerOptions {
      position: LatLng
      map?: Map | null
      title?: string
      zIndex?: number
      draggable?: boolean
    }

    class Marker {
      constructor(options: MarkerOptions)
      setMap(map: Map | null): void
      setPosition(latlng: LatLng): void
      getPosition(): LatLng
    }

    interface PolylineOptions {
      path: LatLng[]
      strokeWeight?: number
      strokeColor?: string
      strokeOpacity?: number
      strokeStyle?: string
    }

    class Polyline {
      constructor(options: PolylineOptions)
      setMap(map: Map | null): void
      setPath(path: LatLng[]): void
    }

    interface CustomOverlayOptions {
      position: LatLng
      content: HTMLElement | string
      map?: Map | null
      xAnchor?: number
      yAnchor?: number
      zIndex?: number
      clickable?: boolean
    }

    class CustomOverlay {
      constructor(options: CustomOverlayOptions)
      setMap(map: Map | null): void
      setPosition(latlng: LatLng): void
      setContent(content: HTMLElement | string): void
    }

    interface MouseEvent {
      latLng: LatLng
    }

    namespace event {
      function addListener(target: object, type: string, handler: (event: never) => void): void
      function removeListener(target: object, type: string, handler: (event: never) => void): void
    }

    namespace services {
      /** 'OK' | 'ZERO_RESULT' | 'ERROR' */
      const Status: {
        readonly OK: 'OK'
        readonly ZERO_RESULT: 'ZERO_RESULT'
        readonly ERROR: 'ERROR'
      }
      type StatusValue = 'OK' | 'ZERO_RESULT' | 'ERROR'

      interface PlaceResult {
        id: string
        place_name: string
        address_name: string
        road_address_name: string
        category_name: string
        phone: string
        /** 경도 */
        x: string
        /** 위도 */
        y: string
      }

      interface Pagination {
        totalCount: number
        hasNextPage: boolean
        nextPage(): void
      }

      class Places {
        keywordSearch(
          keyword: string,
          callback: (result: PlaceResult[], status: StatusValue, pagination: Pagination) => void,
          options?: { size?: number; page?: number },
        ): void
      }

      interface AddressDetail {
        address_name: string
        region_1depth_name?: string
        region_2depth_name?: string
        region_3depth_name?: string
        building_name?: string
      }

      interface AddressResult {
        address_name: string
        address_type?: string
        x: string
        y: string
        address?: AddressDetail | null
        road_address?: AddressDetail | null
      }

      interface Coord2AddressResult {
        address: AddressDetail | null
        road_address: AddressDetail | null
      }

      class Geocoder {
        addressSearch(
          address: string,
          callback: (result: AddressResult[], status: StatusValue) => void,
          options?: { size?: number },
        ): void
        coord2Address(
          lng: number,
          lat: number,
          callback: (result: Coord2AddressResult[], status: StatusValue) => void,
        ): void
      }
    }
  }
}

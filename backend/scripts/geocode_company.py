"""COMPANY_ADDR 을 Kakao 주소검색 API 로 정확한 좌표로 변환해 출력.

사용법:
    python backend/scripts/geocode_company.py
출력된 COMPANY_LAT / COMPANY_LNG 값을 루트 .env 에 붙여넣으면 된다.
(KAKAO_REST_KEY 필요)
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import requests  # noqa: E402

from app.config import Config  # noqa: E402


def main() -> int:
    key = Config.KAKAO_REST_KEY
    addr = Config.COMPANY_LOCATION["addr"]

    if not key:
        print("KAKAO_REST_KEY 가 .env 에 없습니다.")
        return 1
    if not addr:
        print("COMPANY_ADDR 가 .env 에 없습니다.")
        return 1

    headers = {"Authorization": f"KakaoAK {key}"}

    # 1) 주소 검색
    res = requests.get(
        "https://dapi.kakao.com/v2/local/search/address.json",
        params={"query": addr},
        headers=headers,
        timeout=10,
    )
    res.raise_for_status()
    docs = res.json().get("documents", [])

    # 2) 실패 시 키워드(장소) 검색으로 폴백
    if not docs:
        res = requests.get(
            "https://dapi.kakao.com/v2/local/search/keyword.json",
            params={"query": Config.COMPANY_LOCATION["name"]},
            headers=headers,
            timeout=10,
        )
        res.raise_for_status()
        docs = res.json().get("documents", [])

    if not docs:
        print(f"'{addr}' 검색 결과가 없습니다.")
        return 1

    for i, d in enumerate(docs[:5], 1):
        name = d.get("place_name") or d.get("address_name", "")
        road = d.get("road_address_name") or (d.get("road_address") or {}).get(
            "address_name", ""
        )
        print(f"[{i}] {name} / {road}  →  lat={d['y']}  lng={d['x']}")

    top = docs[0]
    print("\n── .env 에 반영할 값 ──")
    print(f"COMPANY_LAT={top['y']}")
    print(f"COMPANY_LNG={top['x']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

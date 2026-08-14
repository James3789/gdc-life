"""헬스체크 + 프론트 부팅용 공개 설정."""

from flask import Blueprint, current_app, jsonify

bp = Blueprint("meta", __name__, url_prefix="/api/meta")


@bp.get("/health")
def health():
    return jsonify({"status": "ok", "service": "gdc-life-api"})


@bp.get("/config")
def public_config():
    """프론트가 부팅 시 1회 조회하는 공개 설정 (비밀값 미포함)."""
    cfg = current_app.config
    return jsonify(
        {
            "company": cfg["COMPANY_LOCATION"],
            "match": {
                "radiusM": cfg["MATCH_RADIUS_M"],
                "defaultToleranceMin": cfg["MATCH_DEFAULT_TOLERANCE_MIN"],
                "toleranceOptions": [10, 20, 30],
            },
            "seats": {"min": 1, "max": 4, "default": 3},
            "requireCompanyEmail": cfg["REQUIRE_COMPANY_EMAIL"],
        }
    )

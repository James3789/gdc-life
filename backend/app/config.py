"""앱 설정. 모든 값은 루트 .env 에서 로드된다 (하드코딩 금지)."""

import os
from pathlib import Path

from dotenv import load_dotenv

# 프로젝트 루트(backend/ 의 부모)의 .env 를 단일 소스로 사용
ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")


def _bool(key: str, default: bool = False) -> bool:
    return os.getenv(key, str(default)).strip().lower() in ("1", "true", "yes", "on")


def _csv(key: str, default: str = "") -> list[str]:
    return [v.strip() for v in os.getenv(key, default).split(",") if v.strip()]


class Config:
    ENV = os.getenv("FLASK_ENV", "development")
    DEBUG = ENV == "development"
    PORT = int(os.getenv("PORT", "5000"))

    # ── DB ───────────────────────────────────────────────
    # sqlite 상대경로는 backend/instance/ 기준으로 잡히므로 절대경로로 정규화
    _db_url = os.getenv("DATABASE_URL", "sqlite:///gdclife.db")
    if _db_url.startswith("sqlite:///") and not _db_url.startswith("sqlite:////"):
        _db_name = _db_url.replace("sqlite:///", "", 1)
        _db_url = "sqlite:///" + str((ROOT_DIR / "backend" / _db_name).as_posix())
    SQLALCHEMY_DATABASE_URI = _db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ── 인증 ─────────────────────────────────────────────
    JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-insecure-secret")
    JWT_ACCESS_MINUTES = int(os.getenv("JWT_ACCESS_MINUTES", "60"))
    JWT_REFRESH_DAYS = int(os.getenv("JWT_REFRESH_DAYS", "14"))

    # ── CORS ─────────────────────────────────────────────
    CORS_ORIGINS = _csv("CORS_ORIGINS", "http://localhost:5173")

    # ── 회사(GDC) 위치 — .env 가 단일 소스 ────────────────
    COMPANY_LOCATION = {
        "name": os.getenv("COMPANY_NAME", "HD현대마린솔루션 글로벌디지털센터"),
        "addr": os.getenv("COMPANY_ADDR", "울산광역시 남구 신두왕로 50"),
        "lat": float(os.getenv("COMPANY_LAT", "35.51809")),
        "lng": float(os.getenv("COMPANY_LNG", "129.28832")),
    }

    # ── 매칭 파라미터 ────────────────────────────────────
    MATCH_RADIUS_M = int(os.getenv("MATCH_RADIUS_M", "1000"))
    MATCH_DEFAULT_TOLERANCE_MIN = int(os.getenv("MATCH_DEFAULT_TOLERANCE_MIN", "10"))

    # ── 사내 이메일 검증 (기본 off) ───────────────────────
    REQUIRE_COMPANY_EMAIL = _bool("REQUIRE_COMPANY_EMAIL", False)
    COMPANY_EMAIL_DOMAINS = _csv("COMPANY_EMAIL_DOMAINS")

    # ── Kakao ────────────────────────────────────────────
    KAKAO_REST_KEY = os.getenv("KAKAO_REST_KEY", "")

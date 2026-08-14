"""확장 인스턴스 (순환 import 방지용 단일 모듈)."""

from flask_migrate import Migrate
from flask_socketio import SocketIO
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
migrate = Migrate()
# 개발 환경 기본: threading (Windows/py3.13에서 eventlet 불필요)
socketio = SocketIO(async_mode="threading", cors_allowed_origins="*")

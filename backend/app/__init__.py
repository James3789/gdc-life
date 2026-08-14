"""GDC Life 백엔드 앱 팩토리."""

from flask import Flask, jsonify
from flask_cors import CORS

from .config import Config
from .extensions import db, migrate, socketio


def create_app(config_object: type = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_object)

    CORS(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=True,
    )

    db.init_app(app)
    migrate.init_app(app, db)
    socketio.init_app(app, cors_allowed_origins=app.config["CORS_ORIGINS"])

    # 모델 등록 (Phase 1~ 에서 채워짐)
    from . import models  # noqa: F401

    # 블루프린트
    from .api.meta import bp as meta_bp

    app.register_blueprint(meta_bp)

    @app.errorhandler(404)
    def _not_found(_e):
        return jsonify({"error": "not_found"}), 404

    @app.errorhandler(500)
    def _server_error(_e):
        return jsonify({"error": "server_error"}), 500

    with app.app_context():
        db.create_all()

    return app

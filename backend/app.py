import os

from flask import Flask, jsonify
from flask_cors import CORS

from auth.auth_routes import auth_bp
from exams.exam_routes import exam_bp
from config.config import Config


def get_allowed_origins():
    origins = []

    config_origins = getattr(Config, "ALLOWED_ORIGINS", []) or []
    if isinstance(config_origins, str):
        config_origins = config_origins.split(",")

    origins.extend(config_origins)

    env_origins = os.environ.get("ALLOWED_ORIGINS", "")
    if env_origins:
        origins.extend(env_origins.split(","))

    cleaned = [origin.strip() for origin in origins if str(origin or "").strip()]

    if cleaned:
        return cleaned

    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


def create_app():
    app = Flask(__name__)

    app.config["SECRET_KEY"] = getattr(Config, "SECRET_KEY", os.environ.get("SECRET_KEY", "change-me"))

    CORS(
        app,
        resources={
            r"/*": {
                "origins": get_allowed_origins(),
            }
        },
        supports_credentials=True,
        allow_headers=[
            "Content-Type",
            "Authorization",
        ],
        methods=[
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS",
        ],
    )

    app.register_blueprint(auth_bp)
    app.register_blueprint(exam_bp)

    @app.get("/")
    def index():
        return jsonify({
            "success": True,
            "message": "Backend API is running",
        })

    @app.get("/health")
    def health():
        return jsonify({
            "success": True,
            "status": "ok",
        })

    return app


app = create_app()


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=os.environ.get("FLASK_DEBUG", "0") == "1",
    )

from flask import Flask, jsonify
from flask_cors import CORS

from auth.auth_routes import auth_bp
from exams.exam_routes import exam_bp
from config.config import Config


def create_app():
    app = Flask(__name__)

    app.config["SECRET_KEY"] = Config.SECRET_KEY

    allowed_origins = [
        origin.strip()
        for origin in Config.ALLOWED_ORIGINS
        if origin.strip()
    ]

    if not allowed_origins:
        allowed_origins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]

    CORS(
        app,
        resources={
            r"/*": {
                "origins": allowed_origins,
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
        port=5000,
        debug=True,
    )
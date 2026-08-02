import os
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_DIR = os.path.dirname(os.path.abspath(__file__))

load_dotenv(os.path.join(BASE_DIR, ".env"))


class Config:
    LOCAL_DEV_MODE = os.getenv("LOCAL_DEV_MODE", "0") == "1"

FIREBASE_ADMIN_KEY_PATH = os.getenv(
    "GOOGLE_APPLICATION_CREDENTIALS",
    os.getenv(
        "FIREBASE_ADMIN_KEY_PATH",
        os.path.join(CONFIG_DIR, "firebase-admin-key.json"),
    ),
)

if not os.path.isabs(FIREBASE_ADMIN_KEY_PATH):
    FIREBASE_ADMIN_KEY_PATH = os.path.join(
        BASE_DIR,
        FIREBASE_ADMIN_KEY_PATH,
    )

    # Dùng khi deploy Render/Vercel/Railway: copy toàn bộ nội dung firebase-admin-key.json vào ENV này
    FIREBASE_SERVICE_ACCOUNT = os.getenv("FIREBASE_SERVICE_ACCOUNT", "")

    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev_jwt_secret_key")
    JWT_ACCESS_TOKEN_EXPIRES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES", 1800))
    JWT_REFRESH_TOKEN_EXPIRES = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES", 2592000))

    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "dev_flask_secret_key")

    ALLOWED_ORIGINS = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")

    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

    @property
    def is_development(self):
        return self.ENVIRONMENT == "development"

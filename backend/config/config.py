import os
from urllib.parse import quote_plus

from dotenv import load_dotenv


BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

load_dotenv(
    os.path.join(BASE_DIR, ".env")
)


class Config:
    # PostgreSQL
    DB_HOST = os.getenv(
        "DB_HOST",
        "127.0.0.1",
    )

    DB_PORT = os.getenv(
        "DB_PORT",
        "5432",
    )

    DB_NAME = os.getenv(
        "DB_NAME",
        "zuny",
    )

    DB_USER = os.getenv(
        "DB_USER",
        "zuny_app",
    )

    DB_PASSWORD = os.getenv(
        "DB_PASSWORD",
        "",
    )

    SQLALCHEMY_DATABASE_URI = (
        f"postgresql+psycopg://{DB_USER}:"
        f"{quote_plus(DB_PASSWORD)}@"
        f"{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT
    JWT_SECRET_KEY = os.getenv(
        "JWT_SECRET_KEY",
        "dev_jwt_secret_key",
    )

    JWT_ACCESS_TOKEN_EXPIRES = int(
        os.getenv(
            "JWT_ACCESS_TOKEN_EXPIRES",
            "1800",
        )
    )

    JWT_REFRESH_TOKEN_EXPIRES = int(
        os.getenv(
            "JWT_REFRESH_TOKEN_EXPIRES",
            "2592000",
        )
    )

    # Flask
    SECRET_KEY = os.getenv(
        "FLASK_SECRET_KEY",
        "dev_flask_secret_key",
    )

    FLASK_DEBUG = os.getenv(
        "FLASK_DEBUG",
        "0",
    ) == "1"

    ENVIRONMENT = os.getenv(
        "ENVIRONMENT",
        "development",
    )

    LOCAL_DEV_MODE = os.getenv(
        "LOCAL_DEV_MODE",
        "0",
    ) == "1"

    ALLOWED_ORIGINS = os.getenv(
        "ALLOWED_ORIGINS",
        (
            "http://localhost:5173,"
            "http://127.0.0.1:5173"
        ),
    ).split(",")

    # Google OAuth
    GOOGLE_CLIENT_ID = os.getenv(
        "GOOGLE_CLIENT_ID",
        "",
    )

    # Cloudflare R2
    R2_ACCOUNT_ID = os.getenv(
        "R2_ACCOUNT_ID",
        "",
    )

    R2_ACCESS_KEY_ID = os.getenv(
        "R2_ACCESS_KEY_ID",
        "",
    )

    R2_SECRET_ACCESS_KEY = os.getenv(
        "R2_SECRET_ACCESS_KEY",
        "",
    )

    R2_BUCKET_NAME = os.getenv(
        "R2_BUCKET_NAME",
        "",
    )

    R2_ENDPOINT_URL = os.getenv(
        "R2_ENDPOINT_URL",
        "",
    )

    R2_PUBLIC_BASE_URL = os.getenv(
        "R2_PUBLIC_BASE_URL",
        "",
    )

    @property
    def is_development(self):
        return (
            self.ENVIRONMENT
            == "development"
        )
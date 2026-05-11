import os
from dotenv import load_dotenv

load_dotenv()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
class Config:
    # API Keys
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
    FIREBASE_ADMIN_KEY_PATH = os.path.join(BASE_DIR, 'firebase-admin-key.json')

    # JWT
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    JWT_ACCESS_TOKEN_EXPIRES = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 1800))
    JWT_REFRESH_TOKEN_EXPIRES = int(os.getenv('JWT_REFRESH_TOKEN_EXPIRES', 2592000))

    # Flask
    SECRET_KEY = os.getenv('FLASK_SECRET_KEY')

    # CORS
    ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', '').split(',')

    # Rate Limiting
    REDIS_URL = os.getenv('REDIS_URL')
    RATE_LIMIT_STORAGE = os.getenv('RATE_LIMIT_STORAGE', 'memory')

    # Environment
    ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')

    @property
    def is_development(self):
        return self.ENVIRONMENT == 'development'
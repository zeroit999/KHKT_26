import jwt
import datetime
import logging
from functools import wraps

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials, firestore
from flask import request, jsonify

try:
    from config.config import Config
except ImportError:
    import os
    import sys

    sys.path.insert(
        0,
        os.path.dirname(
            os.path.dirname(
                os.path.abspath(__file__)
            )
        )
    )

    from config.config import Config


# =========================
# FIREBASE ADMIN INIT
# =========================

if not firebase_admin._apps:
    cred = credentials.Certificate(
        Config.FIREBASE_ADMIN_KEY_PATH
    )

    firebase_admin.initialize_app(cred)


db = firestore.client()


# =========================
# USER HELPERS
# =========================

def get_user_data_firebase(firebase_uid):
    """
    Lấy thông tin user từ Firestore: users/{uid}
    """

    try:
        user_ref = db.collection("users").document(firebase_uid)
        user_doc = user_ref.get()

        if user_doc.exists:
            return user_doc.to_dict()

        return None

    except Exception as error:
        logging.error(
            f"Firebase error getting user data: {error}"
        )

        return None


def get_display_name(firebase_user, user_data=None):
    user_data = user_data or {}

    return (
        user_data.get("displayName")
        or user_data.get("fullName")
        or user_data.get("name")
        or user_data.get("firstName")
        or firebase_user.get("name")
        or ""
    )


def get_user_role(user_data=None):
    user_data = user_data or {}

    return user_data.get("role", "STUDENT")


def build_firebase_user_payload(firebase_user, user_data=None):
    user_data = user_data or {}

    return {
        "uid": firebase_user["uid"],
        "user_id": firebase_user["uid"],
        "email": firebase_user.get("email", ""),
        "name": get_display_name(firebase_user, user_data),
        "role": get_user_role(user_data),
        "type": "firebase",
    }


# =========================
# JWT MANAGER
# =========================

class JWTManager:

    @staticmethod
    def create_access_token(user_data):
        """
        Tạo JWT access token.
        """

        payload = {
            "uid": user_data["uid"],
            "user_id": user_data["uid"],
            "email": user_data["email"],
            "role": user_data.get("role", "STUDENT"),

            "exp": (
                datetime.datetime.utcnow()
                + datetime.timedelta(
                    seconds=Config.JWT_ACCESS_TOKEN_EXPIRES
                )
            ),

            "iat": datetime.datetime.utcnow(),
            "type": "access",
        }

        return jwt.encode(
            payload,
            Config.JWT_SECRET_KEY,
            algorithm="HS256",
        )

    @staticmethod
    def create_refresh_token(user_id):
        """
        Tạo JWT refresh token.
        """

        payload = {
            "user_id": user_id,

            "exp": (
                datetime.datetime.utcnow()
                + datetime.timedelta(
                    seconds=Config.JWT_REFRESH_TOKEN_EXPIRES
                )
            ),

            "iat": datetime.datetime.utcnow(),
            "type": "refresh",
        }

        return jwt.encode(
            payload,
            Config.JWT_SECRET_KEY,
            algorithm="HS256",
        )

    @staticmethod
    def verify_token(token):
        """
        Verify JWT token.
        """

        try:
            payload = jwt.decode(
                token,
                Config.JWT_SECRET_KEY,
                algorithms=["HS256"],
            )

            return payload

        except jwt.ExpiredSignatureError:
            return None

        except jwt.InvalidTokenError:
            return None

    @staticmethod
    def verify_firebase_token(id_token):
        """
        Verify Firebase ID token.
        clock_skew_seconds giúp tránh lỗi:
        Token used too early
        """

        try:
            decoded_token = firebase_auth.verify_id_token(
                id_token,
                clock_skew_seconds=10,
            )

            return decoded_token

        except Exception as error:
            logging.error(
                f"Firebase token verification failed: {error}"
            )

            print("FIREBASE TOKEN VERIFY FAILED:", error)

            return None


# =========================
# DECORATORS
# =========================

def jwt_required(f):
    """
    Decorator yêu cầu JWT access token hợp lệ.
    """

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")

        if (
            not auth_header
            or not auth_header.startswith("Bearer ")
        ):
            return jsonify({
                "error": "Missing or invalid Authorization header",
            }), 401

        token = auth_header.split(" ")[1]
        payload = JWTManager.verify_token(token)

        if not payload:
            return jsonify({
                "error": "Invalid or expired token",
            }), 401

        if payload.get("type") != "access":
            return jsonify({
                "error": "Invalid token type",
            }), 401

        request.current_user = payload

        return f(*args, **kwargs)

    return decorated


def auth_required(f):
    """
    Decorator hỗ trợ cả:
    - Firebase ID token
    - JWT access token
    """

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")

        if (
            not auth_header
            or not auth_header.startswith("Bearer ")
        ):
            return jsonify({
                "error": "Missing or invalid Authorization header",
            }), 401

        token = auth_header.split(" ")[1]
        user_payload = None

        firebase_user = JWTManager.verify_firebase_token(token)

        if firebase_user:
            user_data = get_user_data_firebase(
                firebase_user["uid"]
            )

            user_payload = build_firebase_user_payload(
                firebase_user,
                user_data,
            )

        if not user_payload:
            jwt_payload = JWTManager.verify_token(token)

            if (
                jwt_payload
                and jwt_payload.get("type") == "access"
            ):
                user_payload = jwt_payload

        if not user_payload:
            return jsonify({
                "error": "Invalid or expired token",
            }), 401

        request.current_user = user_payload

        return f(*args, **kwargs)

    return decorated


def firebase_required(f):
    """
    Decorator chỉ chấp nhận Firebase ID token.
    Dùng cho API bài thi.
    """

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")

        if (
            not auth_header
            or not auth_header.startswith("Bearer ")
        ):
            return jsonify({
                "error": "Missing or invalid Authorization header",
            }), 401

        token = auth_header.split(" ")[1]

        firebase_user = JWTManager.verify_firebase_token(token)

        if not firebase_user:
            return jsonify({
                "error": "Invalid Firebase token",
            }), 401

        user_data = get_user_data_firebase(
            firebase_user["uid"]
        )

        user_payload = build_firebase_user_payload(
            firebase_user,
            user_data,
        )

        request.current_user = user_payload

        return f(*args, **kwargs)

    return decorated
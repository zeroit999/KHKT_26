from extensions import db
from models.user import User
import datetime
import secrets
from functools import wraps

import jwt
from flask import jsonify, request

from config.config import Config


class JWTManager:
    @staticmethod
    def create_access_token(user_data):
        user_id = (
            user_data.get("uid")
            or user_data.get("user_id")
            or user_data.get("id")
        )

        payload = {
            "uid": user_id,
            "user_id": user_id,
            "email": user_data.get("email", ""),
            "role": user_data.get(
                "role",
                "STUDENT",
            ),
            "exp": (
                datetime.datetime.now(
                    datetime.timezone.utc
                )
                + datetime.timedelta(
                    seconds=(
                        Config
                        .JWT_ACCESS_TOKEN_EXPIRES
                    )
                )
            ),
            "iat": datetime.datetime.now(
                datetime.timezone.utc
            ),
            "type": "access",
            "auth_version": int(
                user_data.get("auth_version")
                or user_data.get("authVersion")
                or 1
            ),
        }

        return jwt.encode(
            payload,
            Config.JWT_SECRET_KEY,
            algorithm="HS256",
        )

    @staticmethod
    def create_refresh_token(user_id):
        user = db.session.get(User, int(user_id))

        if user is None:
            raise ValueError("User does not exist")

        payload = {
            "uid": user_id,
            "user_id": user_id,
            "exp": (
                datetime.datetime.now(
                    datetime.timezone.utc
                )
                + datetime.timedelta(
                    seconds=(
                        Config
                        .JWT_REFRESH_TOKEN_EXPIRES
                    )
                )
            ),
            "iat": datetime.datetime.now(
                datetime.timezone.utc
            ),
            "type": "refresh",
            "jti": secrets.token_urlsafe(32),
            "auth_version": int(user.auth_version or 1),
        }

        return jwt.encode(
            payload,
            Config.JWT_SECRET_KEY,
            algorithm="HS256",
        )

    @staticmethod
    def verify_token(token):
        try:
            return jwt.decode(
                token,
                Config.JWT_SECRET_KEY,
                algorithms=["HS256"],
            )

        except jwt.ExpiredSignatureError:
            return None

        except jwt.InvalidTokenError:
            return None


def jwt_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get(
            "Authorization",
            "",
        )

        if not auth_header.startswith("Bearer "):
            return jsonify({
                "error": "Missing or invalid Authorization header",
            }), 401

        token = auth_header.split(
            " ",
            1,
        )[1].strip()

        payload = JWTManager.verify_token(token)

        if (
            not payload
            or payload.get("type") != "access"
        ):
            return jsonify({
                "error": "Invalid or expired token",
            }), 401

        user_id = (
            payload.get("user_id")
            or payload.get("uid")
        )

        try:
            user_id = int(user_id)
        except (TypeError, ValueError):
            return jsonify({
                "error": "Invalid token user",
            }), 401

        user = db.session.get(
            User,
            user_id,
        )

        if user is None:
            return jsonify({
                "error": "Tài khoản không tồn tại.",
            }), 401

        if user.email_verified is not True:
            return jsonify({
                "error": "Bạn cần xác minh email trước khi tiếp tục.",
                "code": "EMAIL_NOT_VERIFIED",
            }), 403

        try:
            token_auth_version = int(
                payload.get("auth_version")
            )
        except (TypeError, ValueError):
            return jsonify({
                "error": "Token đã bị thu hồi.",
                "code": "TOKEN_REVOKED",
            }), 401

        if token_auth_version != int(user.auth_version or 1):
            return jsonify({
                "error": "Token đã bị thu hồi.",
                "code": "TOKEN_REVOKED",
            }), 401

        request.current_user = payload

        return f(*args, **kwargs)

    return decorated


auth_required = jwt_required


def role_required(*allowed_roles):
    normalized_roles = {
        str(role).upper()
        for role in allowed_roles
    }

    def decorator(f):
        @wraps(f)
        @jwt_required
        def decorated(*args, **kwargs):
            role = str(
                request.current_user.get(
                    "role",
                    "",
                )
            ).upper()

            if role not in normalized_roles:
                return jsonify({
                    "error": "Forbidden",
                }), 403

            return f(*args, **kwargs)

        return decorated

    return decorator

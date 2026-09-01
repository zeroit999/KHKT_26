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
        }

        return jwt.encode(
            payload,
            Config.JWT_SECRET_KEY,
            algorithm="HS256",
        )

    @staticmethod
    def create_refresh_token(user_id):
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

        if not auth_header.startswith(
            "Bearer "
        ):
            return jsonify({
                "error": (
                    "Missing or invalid "
                    "Authorization header"
                ),
            }), 401

        token = auth_header.split(
            " ",
            1,
        )[1].strip()

        payload = JWTManager.verify_token(
            token
        )

        if (
            not payload
            or payload.get("type")
            != "access"
        ):
            return jsonify({
                "error": (
                    "Invalid or expired token"
                ),
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

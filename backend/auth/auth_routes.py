import hashlib

from flask import Blueprint, jsonify, request
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import func
from werkzeug.security import check_password_hash, generate_password_hash

from auth import JWTManager, auth_required
from config.config import Config
from extensions import db
from models import User
from auth.rate_limiter import rate_limit


auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/auth",
)


PUBLIC_ROLES = {
    "STUDENT",
    "TEACHER",
}


def normalize_email(email):
    return str(email or "").strip().lower()


def normalize_role(role):
    role = str(role or "STUDENT").strip().upper()

    # Không cho client tự cấp ADMIN_DEV.
    if role not in PUBLIC_ROLES:
        return "STUDENT"

    return role


def validate_password(password):
    password = str(password or "")

    if len(password) < 8:
        return False, "Mật khẩu phải có ít nhất 8 ký tự."

    if not any(char.isdigit() for char in password):
        return False, "Mật khẩu phải có ít nhất 1 chữ số (0-9)."

    if not any(char.isupper() for char in password):
        return False, "Mật khẩu phải có ít nhất 1 chữ cái in hoa (A-Z)."

    if not any(not char.isalnum() for char in password):
        return False, "Mật khẩu phải có ít nhất 1 ký tự đặc biệt."

    return True, None


def get_user_by_email(email):
    email = normalize_email(email)

    if not email:
        return None

    return db.session.scalar(
        db.select(User).where(
            func.lower(User.email) == email
        )
    )


MAX_REFRESH_SESSIONS = 5


def refresh_token_digest(token):
    return hashlib.sha256(
        str(token or "").encode("utf-8")
    ).hexdigest()


def get_refresh_sessions(user):
    profile = dict(user.profile_data or {})
    sessions = profile.get("refreshSessions")
    return list(sessions) if isinstance(sessions, list) else []


def set_refresh_sessions(user, sessions):
    profile = dict(user.profile_data or {})
    profile["refreshSessions"] = list(sessions)[-MAX_REFRESH_SESSIONS:]
    user.profile_data = profile


def issue_refresh_token(user):
    token = JWTManager.create_refresh_token(user.id)
    payload = JWTManager.verify_token(token) or {}
    sessions = get_refresh_sessions(user)
    sessions.append({
        "jti": payload.get("jti"),
        "digest": refresh_token_digest(token),
        "issuedAt": payload.get("iat"),
    })
    set_refresh_sessions(user, sessions)
    db.session.commit()
    return token


def build_auth_response(user):
    user_data = user.to_dict()

    return {
        "access_token": JWTManager.create_access_token(
            user_data
        ),
        "refresh_token": issue_refresh_token(user),
        "token_type": "Bearer",
        "user": user_data,
    }


# =========================================================
# REGISTER - EMAIL/PASSWORD
# =========================================================

@auth_bp.post("/register")
@rate_limit(limit=10, window=3600, per_user=False)
def register():
    try:
        data = request.get_json(silent=True) or {}

        email = normalize_email(
            data.get("email")
        )

        password = str(
            data.get("password") or ""
        )

        full_name = str(
            data.get("full_name")
            or data.get("fullName")
            or data.get("name")
            or ""
        ).strip()

        role = normalize_role(
            data.get("role")
        )

        if not email:
            return jsonify({
                "error": "Email is required",
            }), 400

        valid, error_message = validate_password(
            password
        )

        if not valid:
            return jsonify({
                "error": error_message,
            }), 400

        if get_user_by_email(email):
            return jsonify({
                "error": "Email đã được sử dụng.",
            }), 409

        user = User(
            email=email,
            password_hash=generate_password_hash(
                password
            ),
            full_name=full_name,
            role=role,
            auth_provider="local",
            profile_data={
                "isSetupComplete": False,
            },
        )

        db.session.add(user)
        db.session.commit()

        return jsonify(
            build_auth_response(user)
        ), 201

    except Exception as error:
        db.session.rollback()

        return jsonify({
            "error": "Không thể tạo tài khoản.",
            "detail": str(error),
        }), 500


# =========================================================
# LOGIN - EMAIL/PASSWORD
# =========================================================

@auth_bp.post("/login")
@rate_limit(limit=10, window=900, per_user=False)
def login():
    try:
        data = request.get_json(silent=True) or {}

        email = normalize_email(
            data.get("email")
        )

        password = str(
            data.get("password") or ""
        )

        if not email or not password:
            return jsonify({
                "error": "Email và mật khẩu là bắt buộc.",
            }), 400

        user = get_user_by_email(email)

        if not user:
            return jsonify({
                "error": "Email hoặc mật khẩu không đúng.",
            }), 401

        if not user.password_hash:
            return jsonify({
                "error": (
                    "Tài khoản này chưa có mật khẩu. "
                    "Hãy đăng nhập bằng Google."
                ),
            }), 401

        if not check_password_hash(
            user.password_hash,
            password,
        ):
            return jsonify({
                "error": "Email hoặc mật khẩu không đúng.",
            }), 401

        return jsonify(
            build_auth_response(user)
        ), 200

    except Exception as error:
        return jsonify({
            "error": "Không thể đăng nhập.",
            "detail": str(error),
        }), 500


# =========================================================
# GOOGLE LOGIN
# =========================================================

@auth_bp.post("/google")
@rate_limit(limit=20, window=900, per_user=False)
def google_login():
    try:
        data = request.get_json(silent=True) or {}

        credential = str(
            data.get("credential")
            or data.get("id_token")
            or data.get("idToken")
            or ""
        ).strip()

        requested_role = normalize_role(
            data.get("role")
        )

        if not credential:
            return jsonify({
                "error": "Google ID token is required",
            }), 400

        if not Config.GOOGLE_CLIENT_ID:
            return jsonify({
                "error": (
                    "Google Login chưa được cấu hình "
                    "trên server."
                ),
            }), 503

        google_user = (
            google_id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                Config.GOOGLE_CLIENT_ID,
                clock_skew_in_seconds=30,
            )
        )

        google_sub = str(
            google_user.get("sub") or ""
        ).strip()

        email = normalize_email(
            google_user.get("email")
        )

        email_verified = bool(
            google_user.get("email_verified")
        )

        full_name = str(
            google_user.get("name") or ""
        ).strip()

        google_photo_url = str(
            google_user.get("picture") or ""
        ).strip()

        if not google_sub:
            return jsonify({
                "error": "Google account không hợp lệ.",
            }), 401

        if not email or not email_verified:
            return jsonify({
                "error": "Google email chưa được xác minh.",
            }), 401

        # Tìm user đã liên kết Google.
        user = db.session.scalar(
            db.select(User).where(
                User.google_sub == google_sub
            )
        )

        # Nếu chưa có, tìm tài khoản cùng email.
        if not user:
            user = get_user_by_email(email)

        if user:
            if (
                user.google_sub
                and user.google_sub != google_sub
            ):
                return jsonify({
                    "error": (
                        "Email này đã liên kết với "
                        "Google account khác."
                    ),
                }), 409

            user.google_sub = google_sub

            if user.password_hash:
                user.auth_provider = "hybrid"
            else:
                user.auth_provider = "google"

            if not user.full_name and full_name:
                user.full_name = full_name

            profile_data = (
                dict(user.profile_data)
                if isinstance(user.profile_data, dict)
                else {}
            )

            if google_photo_url:
                profile_data["googlePhotoURL"] = google_photo_url

            user.profile_data = profile_data

        else:
            user = User(
                email=email,
                password_hash=None,
                full_name=full_name,
                role=requested_role,
                google_sub=google_sub,
                auth_provider="google",
                profile_data={
                    "isSetupComplete": False,
                    "googlePhotoURL": google_photo_url,
                },
            )

            db.session.add(user)

        db.session.commit()

        return jsonify(
            build_auth_response(user)
        ), 200

    except ValueError:
        return jsonify({
            "error": "Google ID token không hợp lệ.",
        }), 401

    except Exception as error:
        db.session.rollback()

        return jsonify({
            "error": "Không thể đăng nhập bằng Google.",
            "detail": str(error),
        }), 500


# =========================================================
# REFRESH JWT
# =========================================================

@auth_bp.post("/refresh")
@rate_limit(limit=60, window=3600, per_user=False)
def refresh():
    try:
        data = request.get_json(silent=True) or {}

        refresh_token = str(
            data.get("refresh_token") or ""
        ).strip()

        if not refresh_token:
            return jsonify({
                "error": "Refresh token is required",
            }), 400

        payload = JWTManager.verify_token(
            refresh_token
        )

        if (
            not payload
            or payload.get("type") != "refresh"
        ):
            return jsonify({
                "error": "Invalid or expired refresh token",
            }), 401

        user_id = (
            payload.get("user_id")
            or payload.get("uid")
        )

        user = db.session.get(
            User,
            user_id,
        )

        if not user:
            return jsonify({
                "error": "User not found",
            }), 404

        token_jti = payload.get("jti")
        token_digest = refresh_token_digest(refresh_token)
        sessions = get_refresh_sessions(user)
        matched = next((
            session for session in sessions
            if session.get("jti") == token_jti
            and session.get("digest") == token_digest
        ), None)

        if not matched:
            return jsonify({
                "error": "Refresh token đã bị thu hồi.",
            }), 401

        set_refresh_sessions(
            user,
            [session for session in sessions if session is not matched],
        )

        access_token = JWTManager.create_access_token(
            user.to_dict()
        )

        next_refresh_token = issue_refresh_token(user)

        return jsonify({
            "access_token": access_token,
            "refresh_token": next_refresh_token,
            "token_type": "Bearer",
        }), 200

    except Exception as error:
        return jsonify({
            "error": "Không thể làm mới phiên đăng nhập.",
            "detail": str(error),
        }), 500


# =========================================================
# CURRENT USER
# =========================================================

@auth_bp.get("/me")
@auth_required
def me():
    user_id = (
        request.current_user.get("user_id")
        or request.current_user.get("uid")
    )

    user = db.session.get(
        User,
        user_id,
    )

    if not user:
        return jsonify({
            "error": "User not found",
        }), 404

    return jsonify({
        "user": user.to_dict(),
    }), 200


@auth_bp.patch("/me")
@auth_required
def update_me():
    try:
        user_id = (
            request.current_user.get("user_id")
            or request.current_user.get("uid")
        )

        user = db.session.get(
            User,
            user_id,
        )

        if not user:
            return jsonify({
                "error": "User not found",
            }), 404

        data = (
            request.get_json(
                silent=True
            )
            or {}
        )

        if not isinstance(
            data,
            dict,
        ):
            return jsonify({
                "error": "Dữ liệu cập nhật không hợp lệ.",
            }), 400

        if (
            "full_name" in data
            or "fullName" in data
            or "name" in data
        ):
            full_name = str(
                data.get("full_name")
                or data.get("fullName")
                or data.get("name")
                or ""
            ).strip()

            user.full_name = (
                full_name
                or None
            )

        if "role" in data:
            user.role = normalize_role(
                data.get("role")
            )

        if (
            "grade" in data
            or "studentGrade" in data
            or "gradeLevel" in data
            or "khoi" in data
        ):
            grade = str(
                data.get("grade")
                or data.get("studentGrade")
                or data.get("gradeLevel")
                or data.get("khoi")
                or ""
            ).strip()

            user.grade = (
                grade
                or None
            )

        if (
            "class_name" in data
            or "className" in data
            or "studentClass" in data
        ):
            class_name = str(
                data.get("class_name")
                or data.get("className")
                or data.get("studentClass")
                or ""
            ).strip()

            user.class_name = (
                class_name
                or None
            )

        profile_data = (
            dict(user.profile_data)
            if isinstance(
                user.profile_data,
                dict,
            )
            else {}
        )

        protected_fields = {
            "id",
            "uid",
            "user_id",
            "email",
            "password",
            "password_hash",
            "currentPassword",
            "current_password",
            "newPassword",
            "new_password",
            "google_sub",
            "googleSub",
            "auth_provider",
            "authProvider",
        }

        core_fields = {
            "full_name",
            "fullName",
            "name",
            "role",
            "grade",
            "studentGrade",
            "gradeLevel",
            "khoi",
            "class_name",
            "className",
            "studentClass",
        }

        for key, value in data.items():
            if key in protected_fields:
                continue

            if key in core_fields:
                continue

            profile_data[key] = value

        user.profile_data = profile_data

        db.session.commit()

        user_data = user.to_dict()

        access_token = JWTManager.create_access_token(
            user_data
        )

        return jsonify({
            "success": True,
            "message": "Cập nhật hồ sơ thành công.",
            "user": user_data,
            "access_token": access_token,
            "token_type": "Bearer",
        }), 200

    except Exception as error:
        db.session.rollback()

        return jsonify({
            "error": "Không thể cập nhật hồ sơ.",
            "detail": str(error),
        }), 500


# =========================================================
# CHANGE PASSWORD
# =========================================================

@auth_bp.post("/change-password")
@auth_required
def change_password():
    try:
        data = request.get_json(silent=True) or {}

        current_password = str(
            data.get("current_password")
            or data.get("currentPassword")
            or ""
        )

        new_password = str(
            data.get("new_password")
            or data.get("newPassword")
            or ""
        )

        if not current_password:
            return jsonify({
                "error": "Mật khẩu hiện tại là bắt buộc.",
            }), 400

        valid, error_message = validate_password(
            new_password
        )

        if not valid:
            return jsonify({
                "error": error_message,
            }), 400

        user_id = (
            request.current_user.get("user_id")
            or request.current_user.get("uid")
        )

        user = db.session.get(
            User,
            user_id,
        )

        if not user:
            return jsonify({
                "error": "User not found",
            }), 404

        if not user.password_hash:
            return jsonify({
                "error": (
                    "Tài khoản này chưa có mật khẩu. "
                    "Hãy đăng nhập bằng Google."
                ),
            }), 400

        if not check_password_hash(
            user.password_hash,
            current_password,
        ):
            return jsonify({
                "error": "Mật khẩu hiện tại không đúng.",
            }), 401

        if check_password_hash(
            user.password_hash,
            new_password,
        ):
            return jsonify({
                "error": (
                    "Mật khẩu mới phải khác "
                    "mật khẩu hiện tại."
                ),
            }), 400

        user.password_hash = generate_password_hash(
            new_password
        )

        db.session.commit()

        return jsonify({
            "message": "Đổi mật khẩu thành công.",
        }), 200

    except Exception as error:
        db.session.rollback()

        return jsonify({
            "error": "Không thể đổi mật khẩu.",
            "detail": str(error),
        }), 500


# =========================================================
# LOGOUT
# =========================================================

@auth_bp.post("/logout")
@auth_required
def logout():
    data = request.get_json(silent=True) or {}
    refresh_token = str(data.get("refresh_token") or "").strip()

    if refresh_token:
        payload = JWTManager.verify_token(refresh_token) or {}
        user_id = request.current_user.get("user_id") or request.current_user.get("uid")
        if payload.get("type") == "refresh" and str(payload.get("user_id") or payload.get("uid")) == str(user_id):
            user = db.session.get(User, user_id)
            if user:
                digest = refresh_token_digest(refresh_token)
                jti = payload.get("jti")
                set_refresh_sessions(user, [
                    session for session in get_refresh_sessions(user)
                    if session.get("jti") != jti or session.get("digest") != digest
                ])
                db.session.commit()

    return jsonify({
        "message": "Logged out successfully",
    }), 200

"""ZUNY password reset via email OTP."""

import secrets
from datetime import timedelta, timezone

from flask import Blueprint, jsonify, request
from sqlalchemy import func
from werkzeug.security import generate_password_hash

from auth.email_otp import (
    OTP_MAX_ATTEMPTS,
    OTP_RESEND_COOLDOWN_SECONDS,
    generate_otp,
    otp_digest,
    otp_expires_at,
    otp_matches,
    send_verification_email,
    utc_now,
)
from auth.rate_limiter import rate_limit
from auth.auth_routes import validate_password
from extensions import db
from models import User, EmailVerification


password_reset_bp = Blueprint(
    "password_reset",
    __name__,
    url_prefix="/auth",
)

PURPOSE = "reset_password"
RESET_TOKEN_TTL_MINUTES = 10

GENERIC_MESSAGE = (
    "Nếu email thuộc tài khoản có thể đặt lại mật khẩu, "
    "chúng tôi sẽ gửi mã xác minh."
)


def normalize_email(value):
    return str(value or "").strip().lower()


def as_utc(value):
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def get_user(email, *, lock=False):
    query = db.select(User).where(
        func.lower(User.email) == email
    )
    if lock:
        query = query.with_for_update()
    return db.session.scalar(query)


def get_active_reset(user_id, *, lock=False):
    query = (
        db.select(EmailVerification)
        .where(
            EmailVerification.user_id == user_id,
            EmailVerification.purpose == PURPOSE,
            EmailVerification.consumed_at.is_(None),
        )
        .order_by(EmailVerification.id.desc())
    )
    if lock:
        query = query.with_for_update()
    return db.session.scalar(query)


def eligible(user):
    # Tài khoản Google-only không có mật khẩu local để đặt lại.
    return (
        user is not None
        and bool(user.password_hash)
        and user.email_verified is True
    )


def error_response(message, status, code=None):
    result = {"error": message}
    if code:
        result["code"] = code
    return jsonify(result), status


@password_reset_bp.post("/forgot-password")
@rate_limit(limit=10, window=3600, per_user=False)
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = normalize_email(data.get("email"))

    if not email:
        return error_response("Email là bắt buộc.", 400)

    try:
        user = get_user(email, lock=True)

        if not eligible(user):
            db.session.rollback()
            return jsonify({"message": GENERIC_MESSAGE}), 200

        now = utc_now()
        current = get_active_reset(user.id, lock=True)

        if current is not None:
            cooldown_end = (
                as_utc(current.last_sent_at)
                + timedelta(seconds=OTP_RESEND_COOLDOWN_SECONDS)
            )

            # Không để phản hồi cooldown tiết lộ email tồn tại.
            if now < cooldown_end:
                db.session.rollback()
                return jsonify({"message": GENERIC_MESSAGE}), 200

            current.consumed_at = now

        code = generate_otp()

        verification = EmailVerification(
            user_id=user.id,
            purpose=PURPOSE,
            code_hash=otp_digest(user.id, PURPOSE, code),
            expires_at=otp_expires_at(),
            attempts=0,
            created_at=now,
            last_sent_at=now,
        )

        db.session.add(verification)
        db.session.commit()

        try:
            send_verification_email(user.email, code)
        except Exception:
            # Không giữ một OTP đang hoạt động nếu email không gửi được.
            try:
                verification.consumed_at = utc_now()
                db.session.commit()
            except Exception:
                db.session.rollback()

            # Giữ phản hồi chung, không làm lộ tài khoản.
            return jsonify({"message": GENERIC_MESSAGE}), 200

        return jsonify({"message": GENERIC_MESSAGE}), 200

    except Exception:
        db.session.rollback()
        return error_response(
            "Không thể xử lý yêu cầu lúc này.",
            503,
        )


@password_reset_bp.post("/verify-reset-otp")
@rate_limit(limit=20, window=900, per_user=False)
def verify_reset_otp():
    data = request.get_json(silent=True) or {}
    email = normalize_email(data.get("email"))
    code = str(data.get("code") or "").strip()

    if not email or len(code) != 6 or not code.isdigit():
        return error_response(
            "Email hoặc mã xác minh không hợp lệ.",
            400,
            "INVALID_RESET_OTP",
        )

    try:
        user = get_user(email, lock=True)

        if not eligible(user):
            db.session.rollback()
            return error_response(
                "Mã xác minh không hợp lệ hoặc đã hết hạn.",
                400,
                "INVALID_RESET_OTP",
            )

        verification = get_active_reset(user.id, lock=True)
        now = utc_now()

        if verification is None:
            db.session.rollback()
            return error_response(
                "Mã xác minh không hợp lệ hoặc đã hết hạn.",
                400,
                "INVALID_RESET_OTP",
            )

        if as_utc(verification.expires_at) <= now:
            verification.consumed_at = now
            db.session.commit()
            return error_response(
                "Mã xác minh không hợp lệ hoặc đã hết hạn.",
                400,
                "INVALID_RESET_OTP",
            )

        if verification.attempts >= OTP_MAX_ATTEMPTS:
            # attempts == OTP_MAX_ATTEMPTS cũng được dùng để đánh dấu
            # OTP đã được đổi thành reset token. Không consume record ở
            # đây, vì reset token vẫn cần tồn tại cho /reset-password.
            db.session.rollback()
            return error_response(
                "Mã xác minh không hợp lệ hoặc đã hết hạn.",
                400,
                "INVALID_RESET_OTP",
            )

        if not otp_matches(
            user.id,
            PURPOSE,
            code,
            verification.code_hash,
        ):
            verification.attempts += 1

            if verification.attempts >= OTP_MAX_ATTEMPTS:
                verification.consumed_at = now

            db.session.commit()

            return error_response(
                "Mã xác minh không hợp lệ hoặc đã hết hạn.",
                400,
                "INVALID_RESET_OTP",
            )

        # Không lưu reset token dạng plaintext trong PostgreSQL.
        # OTP được thay bằng hash của reset token dùng một lần.
        reset_token = secrets.token_urlsafe(32)

        verification.code_hash = otp_digest(
            user.id,
            "reset_token",
            reset_token,
        )
        verification.expires_at = (
            now + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)
        )
        verification.attempts = OTP_MAX_ATTEMPTS

        db.session.commit()

        return jsonify({
            "message": "Đã xác minh mã.",
            "reset_token": reset_token,
            "expires_in": RESET_TOKEN_TTL_MINUTES * 60,
        }), 200

    except Exception:
        db.session.rollback()
        return error_response(
            "Không thể xác minh mã lúc này.",
            503,
        )


@password_reset_bp.post("/reset-password")
@rate_limit(limit=20, window=900, per_user=False)
def reset_password():
    data = request.get_json(silent=True) or {}

    email = normalize_email(data.get("email"))
    reset_token = str(data.get("reset_token") or "").strip()
    new_password = str(data.get("new_password") or "")

    valid_password, password_error = validate_password(new_password)

    if not valid_password:
        return error_response(password_error, 400)

    if not email or not reset_token:
        return error_response(
            "Email và reset token là bắt buộc.",
            400,
        )

    try:
        user = get_user(email, lock=True)

        if not eligible(user):
            db.session.rollback()
            return error_response(
                "Reset token không hợp lệ hoặc đã hết hạn.",
                400,
                "INVALID_RESET_TOKEN",
            )

        verification = get_active_reset(user.id, lock=True)
        now = utc_now()

        if (
            verification is None
            or as_utc(verification.expires_at) <= now
            or verification.attempts != OTP_MAX_ATTEMPTS
            or not otp_matches(
                user.id,
                "reset_token",
                reset_token,
                verification.code_hash,
            )
        ):
            db.session.rollback()
            return error_response(
                "Reset token không hợp lệ hoặc đã hết hạn.",
                400,
                "INVALID_RESET_TOKEN",
            )

        user.password_hash = generate_password_hash(new_password)

        # Vô hiệu hóa ngay access/refresh JWT được cấp trước reset.
        user.auth_version = int(user.auth_version or 1) + 1

        # Thu hồi toàn bộ refresh token đang lưu của tài khoản.
        profile = dict(user.profile_data or {})
        profile["refreshSessions"] = []
        user.profile_data = profile

        # Tiêu thụ reset token và mọi yêu cầu reset còn hoạt động.
        db.session.execute(
            db.update(EmailVerification)
            .where(
                EmailVerification.user_id == user.id,
                EmailVerification.purpose == PURPOSE,
                EmailVerification.consumed_at.is_(None),
            )
            .values(consumed_at=now)
        )

        db.session.commit()

        return jsonify({
            "message": "Đã đặt lại mật khẩu. Vui lòng đăng nhập.",
        }), 200

    except Exception:
        db.session.rollback()
        return error_response(
            "Không thể đặt lại mật khẩu lúc này.",
            503,
        )

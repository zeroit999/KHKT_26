from datetime import timezone
from datetime import timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy import select, func

from extensions import db
from models.user import User
from models.email_verification import EmailVerification
from auth.rate_limiter import rate_limit

from auth.email_otp import (
    OTP_MAX_ATTEMPTS,
    OTP_RESEND_COOLDOWN_SECONDS,
    generate_otp,
    otp_digest,
    otp_matches,
    otp_expires_at,
    send_verification_email,
    utc_now,
)


email_verification_bp = Blueprint(
    "email_verification",
    __name__,
    url_prefix="/auth",
)



def as_utc(value):
    """Chuẩn hóa datetime từ PostgreSQL về UTC."""
    if value.tzinfo is None:
        # PostgreSQL TIMESTAMP WITH TIME ZONE thường trả datetime
        # có timezone. Nếu driver trả naive, quy ước dữ liệu OTP
        # được ghi theo UTC.
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def normalize_email(value):
    return str(value or "").strip().lower()


def get_user(email):
    return db.session.scalar(
        select(User).where(func.lower(User.email) == email)
    )


def get_active_verification(user_id):
    return db.session.scalar(
        select(EmailVerification)
        .where(
            EmailVerification.user_id == user_id,
            EmailVerification.purpose == "register",
            EmailVerification.consumed_at.is_(None),
        )
        .order_by(
            EmailVerification.created_at.desc(),
            EmailVerification.id.desc(),
        )
        .with_for_update()
        .limit(1)
    )


@email_verification_bp.post("/verify-email")
@rate_limit(limit=20, window=900, per_user=False)
def verify_email():
    data = request.get_json(silent=True) or {}

    email = normalize_email(data.get("email"))
    code = str(data.get("code") or "").strip()

    if not email or len(code) != 6 or not code.isdigit():
        return jsonify({
            "error": "Email hoặc mã xác minh không hợp lệ.",
        }), 400

    try:
        user = get_user(email)

        if user is None:
            return jsonify({
                "error": "Email hoặc mã xác minh không hợp lệ.",
            }), 400

        # Khóa hàng user để tránh hai request xác minh đồng thời.
        user = db.session.scalar(
            select(User)
            .where(User.id == user.id)
            .with_for_update()
        )

        if user.email_verified:
            return jsonify({
                "message": "Email đã được xác minh.",
                "email_verified": True,
            }), 200

        verification = get_active_verification(user.id)

        if verification is None:
            return jsonify({
                "error": "Không tìm thấy mã xác minh còn hiệu lực.",
            }), 400

        now = utc_now()

        if as_utc(verification.expires_at) <= now:
            return jsonify({
                "error": "Mã xác minh đã hết hạn. Vui lòng gửi lại mã.",
            }), 400

        if verification.attempts >= OTP_MAX_ATTEMPTS:
            return jsonify({
                "error": "Bạn đã nhập sai quá số lần cho phép. Vui lòng gửi lại mã.",
            }), 429

        if not otp_matches(
            user.id,
            "register",
            code,
            verification.code_hash,
        ):
            verification.attempts += 1
            db.session.commit()

            return jsonify({
                "error": "Mã xác minh không chính xác.",
            }), 400

        user.email_verified = True
        user.email_verified_at = now
        verification.consumed_at = now

        db.session.commit()

        return jsonify({
            "message": "Xác minh email thành công. Bạn có thể đăng nhập.",
            "email_verified": True,
        }), 200

    except Exception:
        db.session.rollback()
        return jsonify({
            "error": "Không thể xác minh email. Vui lòng thử lại.",
        }), 500


@email_verification_bp.post("/resend-verification")
@rate_limit(limit=10, window=3600, per_user=False)
def resend_verification():
    data = request.get_json(silent=True) or {}
    email = normalize_email(data.get("email"))

    if not email:
        return jsonify({
            "error": "Vui lòng nhập email.",
        }), 400

    # Phản hồi chung, không tiết lộ email có tồn tại hay không.
    generic_response = {
        "message": (
            "Nếu tài khoản cần xác minh, "
            "mã mới sẽ được gửi đến email của bạn."
        ),
    }

    try:
        user = get_user(email)

        if user is None or user.email_verified:
            return jsonify(generic_response), 200

        user = db.session.scalar(
            select(User)
            .where(User.id == user.id)
            .with_for_update()
        )

        verification = get_active_verification(user.id)
        now = utc_now()

        if verification is not None:
            cooldown_end = as_utc(verification.last_sent_at) + timedelta(
                seconds=OTP_RESEND_COOLDOWN_SECONDS
            )

            if now < cooldown_end:
                return jsonify({
                    "error": "Vui lòng chờ trước khi yêu cầu mã mới.",
                    "retry_after": max(
                        1,
                        int((cooldown_end - now).total_seconds()) + 1,
                    ),
                }), 429

        code = generate_otp()

        # Vô hiệu hóa mã cũ trước khi tạo mã mới.
        if verification is not None:
            verification.consumed_at = now

        new_verification = EmailVerification(
            user_id=user.id,
            purpose="register",
            code_hash=otp_digest(user.id, "register", code),
            expires_at=otp_expires_at(),
            attempts=0,
            created_at=now,
            last_sent_at=now,
        )

        db.session.add(new_verification)
        db.session.commit()

        # Không ghi mã OTP vào log hoặc trả về API.
        send_verification_email(user.email, code)

        return jsonify(generic_response), 200

    except Exception:
        db.session.rollback()
        return jsonify({
            "error": "Không thể gửi mã xác minh lúc này.",
        }), 503
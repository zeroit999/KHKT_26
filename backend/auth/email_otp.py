import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

import httpx

from config.config import Config


OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_COOLDOWN_SECONDS = 60


def utc_now():
    return datetime.now(timezone.utc)


def generate_otp():
    return f"{secrets.randbelow(1_000_000):06d}"


def otp_digest(user_id, purpose, code):
    secret = str(Config.JWT_SECRET_KEY)

    message = f"{user_id}:{purpose}:{code}".encode("utf-8")

    return hmac.new(
        secret.encode("utf-8"),
        message,
        hashlib.sha256,
    ).hexdigest()


def otp_matches(user_id, purpose, code, stored_digest):
    candidate = otp_digest(user_id, purpose, code)

    return hmac.compare_digest(candidate, stored_digest)


def otp_expires_at():
    return utc_now() + timedelta(minutes=OTP_TTL_MINUTES)


def send_verification_email(recipient, code):
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    sender = os.getenv("RESEND_FROM_EMAIL", "").strip()

    if not api_key or not sender:
        raise RuntimeError("Resend chưa được cấu hình.")

    subject = f"{code} là mã xác minh ZUNY của bạn"

    text = (
        "XÁC MINH ĐỊA CHỈ EMAIL\n\n"
        "Chào bạn,\n\n"
        "Bạn vừa yêu cầu mã xác minh cho tài khoản ZUNY. "
        "Nhập mã dưới đây để tiếp tục:\n\n"
        f"{code}\n\n"
        f"Mã này có hiệu lực trong {OTP_TTL_MINUTES} phút.\n\n"
        "Vì lý do bảo mật, không chia sẻ mã này với bất kỳ ai. "
        "ZUNY sẽ không bao giờ yêu cầu bạn cung cấp mã xác minh "
        "qua tin nhắn hoặc cuộc gọi.\n\n"
        "Nếu bạn không thực hiện yêu cầu này, "
        "bạn có thể bỏ qua email.\n\n"
        "ZUNY\n"
        "Nền tảng học tập trực tuyến\n"
        "https://zunylearn.com"
    )

    html = f"""\
<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Xác minh email ZUNY</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#f5f5f5;
  font-family:Arial,Helvetica,sans-serif;
  color:#171717;
">
  <table
    role="presentation"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    border="0"
    style="background:#f5f5f5;"
  >
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="
            max-width:600px;
            background:#ffffff;
            border:1px solid #e5e5e5;
            border-radius:16px;
          "
        >
          <tr>
            <td style="padding:36px 40px 12px;text-align:center;">
              <img
                src="https://zunylearn.com/zuny-logo.png"
                alt="ZUNY"
                width="96"
                style="
                  display:inline-block;
                  max-width:96px;
                  height:auto;
                  border:0;
                "
              >
            </td>
          </tr>

          <tr>
            <td style="padding:12px 40px 40px;">
              <h1 style="
                margin:0 0 16px;
                text-align:center;
                font-size:26px;
                line-height:1.3;
                font-weight:700;
                color:#171717;
              ">
                Xác minh địa chỉ email
              </h1>

              <p style="
                margin:0 0 14px;
                font-size:16px;
                line-height:1.6;
                color:#404040;
              ">
                Chào bạn,
              </p>

              <p style="
                margin:0 0 26px;
                font-size:16px;
                line-height:1.6;
                color:#404040;
              ">
                Bạn vừa yêu cầu mã xác minh cho tài khoản
                <strong>ZUNY</strong>. Nhập mã dưới đây để
                tiếp tục:
              </p>

              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
              >
                <tr>
                  <td align="center">
                    <div style="
                      display:inline-block;
                      padding:18px 30px;
                      background:#f5f5f5;
                      border:1px solid #e5e5e5;
                      border-radius:12px;
                      font-family:
                        'Courier New',Courier,monospace;
                      font-size:34px;
                      line-height:1;
                      font-weight:700;
                      letter-spacing:8px;
                      color:#171717;
                    ">
                      {code}
                    </div>
                  </td>
                </tr>
              </table>

              <p style="
                margin:24px 0 28px;
                text-align:center;
                font-size:14px;
                line-height:1.6;
                color:#737373;
              ">
                Mã này có hiệu lực trong
                <strong>{OTP_TTL_MINUTES} phút</strong>.
              </p>

              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="
                  background:#fafafa;
                  border:1px solid #eeeeee;
                  border-radius:10px;
                "
              >
                <tr>
                  <td style="
                    padding:16px 18px;
                    font-size:14px;
                    line-height:1.6;
                    color:#525252;
                  ">
                    <strong>Lưu ý bảo mật:</strong>
                    Không chia sẻ mã này với bất kỳ ai.
                    ZUNY sẽ không bao giờ yêu cầu bạn cung cấp
                    mã xác minh qua tin nhắn hoặc cuộc gọi.
                  </td>
                </tr>
              </table>

              <p style="
                margin:26px 0 0;
                font-size:14px;
                line-height:1.6;
                color:#737373;
              ">
                Nếu bạn không thực hiện yêu cầu này,
                bạn có thể bỏ qua email.
              </p>
            </td>
          </tr>

          <tr>
            <td style="
              padding:24px 40px;
              border-top:1px solid #eeeeee;
              text-align:center;
            ">
              <p style="
                margin:0 0 5px;
                font-size:14px;
                font-weight:700;
                color:#404040;
              ">
                ZUNY
              </p>

              <p style="
                margin:0 0 8px;
                font-size:12px;
                line-height:1.5;
                color:#8a8a8a;
              ">
                Nền tảng học tập trực tuyến
              </p>

              <a
                href="https://zunylearn.com"
                style="
                  font-size:12px;
                  color:#525252;
                  text-decoration:none;
                "
              >
                zunylearn.com
              </a>
            </td>
          </tr>
        </table>

        <p style="
          margin:18px 0 0;
          font-size:11px;
          line-height:1.5;
          color:#a3a3a3;
        ">
          Đây là email tự động từ ZUNY.
          Vui lòng không trả lời email này.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    response = httpx.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "from": sender,
            "to": [recipient],
            "subject": subject,
            "text": text,
            "html": html,
        },
        timeout=10.0,
    )

    response.raise_for_status()

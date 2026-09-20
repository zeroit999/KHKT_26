import datetime

from extensions import db


def utc_now():
    return datetime.datetime.now(
        datetime.timezone.utc
    )


class EmailVerification(db.Model):
    __tablename__ = "email_verifications"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    user_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    purpose = db.Column(
        db.String(32),
        nullable=False,
    )

    code_hash = db.Column(
        db.String(64),
        nullable=False,
    )

    expires_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
    )

    attempts = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    consumed_at = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    last_sent_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    __table_args__ = (
        db.CheckConstraint(
            "purpose IN ('register', 'reset_password')",
            name="ck_email_verifications_purpose",
        ),
        db.CheckConstraint(
            "attempts >= 0",
            name="ck_email_verifications_attempts",
        ),
    )
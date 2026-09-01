from datetime import datetime, timezone

from extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    email = db.Column(
        db.String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    password_hash = db.Column(
        db.String(255),
        nullable=True,
    )

    full_name = db.Column(
        db.String(255),
        nullable=True,
    )

    role = db.Column(
        db.String(20),
        nullable=False,
        default="STUDENT",
        index=True,
    )

    grade = db.Column(
        db.String(20),
        nullable=True,
        index=True,
    )

    class_name = db.Column(
        db.String(100),
        nullable=True,
        index=True,
    )

    google_sub = db.Column(
        db.String(255),
        unique=True,
        nullable=True,
        index=True,
    )

    auth_provider = db.Column(
        db.String(20),
        nullable=False,
        default="local",
    )

    profile_data = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        db.CheckConstraint(
            "role IN ('STUDENT', 'TEACHER', 'ADMIN_DEV')",
            name="ck_users_role",
        ),
    )

    def to_dict(self):
        profile_data = (
            self.profile_data
            if isinstance(
                self.profile_data,
                dict,
            )
            else {}
        )

        return {
            **profile_data,
            "id": self.id,
            "uid": self.id,
            "user_id": self.id,
            "email": self.email,
            "name": self.full_name or "",
            "fullName": self.full_name or "",
            "role": self.role,
            "grade": self.grade or "",
            "className": self.class_name or "",
            "authProvider": self.auth_provider,
        }
from datetime import datetime, timezone

from extensions import db


def utc_now():
    return datetime.now(timezone.utc)


class CoursePlaylist(db.Model):
    __tablename__ = "course_playlists"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    owner_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    title = db.Column(
        db.String(500),
        nullable=False,
    )

    description = db.Column(
        db.Text,
        nullable=True,
    )

    thumbnail = db.Column(
        db.Text,
        nullable=True,
    )

    thumbnail_file_name = db.Column(
        db.String(500),
        nullable=True,
    )

    course_ids = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )

    playlist_data = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        index=True,
    )

    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )


class UserFollow(db.Model):
    __tablename__ = "user_follows"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    follower_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    target_user_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    active = db.Column(
        db.Boolean,
        nullable=False,
        default=True,
        index=True,
    )

    follow_data = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
    )

    followed_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    last_opened_at = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
    )

    unfollowed_at = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    __table_args__ = (
        db.UniqueConstraint(
            "follower_id",
            "target_user_id",
            name="uq_user_follows_follower_target",
        ),
    )


class ELearningNotification(db.Model):
    __tablename__ = "elearning_notifications"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    legacy_id = db.Column(
        db.String(255),
        nullable=True,
        index=True,
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

    type = db.Column(
        db.String(100),
        nullable=False,
        default="info",
        index=True,
    )

    title = db.Column(
        db.String(500),
        nullable=True,
    )

    message = db.Column(
        db.Text,
        nullable=False,
        default="",
    )

    notification_data = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
    )

    read = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
        index=True,
    )

    read_at = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
    )

    dismissed = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
        index=True,
    )

    dismissed_at = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        index=True,
    )

    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )


class CommentWarning(db.Model):
    __tablename__ = "comment_warnings"

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

    issued_by = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    course_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "courses.id",
            ondelete="CASCADE",
        ),
        nullable=True,
        index=True,
    )

    question_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "course_questions.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    reply_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "course_question_replies.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    reason = db.Column(
        db.String(500),
        nullable=False,
        default="",
    )

    detail = db.Column(
        db.Text,
        nullable=True,
    )

    status = db.Column(
        db.String(50),
        nullable=False,
        default="active",
        index=True,
    )

    warning_data = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
    )

    acknowledged_at = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        index=True,
    )

    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

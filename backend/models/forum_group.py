from datetime import datetime, timezone

from extensions import db


def utc_now():
    return datetime.now(timezone.utc)


class ForumGroup(db.Model):
    __tablename__ = "forum_groups"

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

    name = db.Column(
        db.String(255),
        nullable=False,
    )

    description = db.Column(
        db.Text,
        nullable=False,
        default="",
    )

    group_type = db.Column(
        db.String(30),
        nullable=False,
        default="public",
        index=True,
    )

    group_code = db.Column(
        db.String(32),
        nullable=False,
        unique=True,
        index=True,
    )

    invite_code = db.Column(
        db.String(128),
        nullable=True,
        unique=True,
        index=True,
    )

    member_ids = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )

    admin_ids = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )

    pending_member_ids = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )

    temporary_admin_ids = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )

    report_count = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    report_status = db.Column(
        db.String(30),
        nullable=True,
        index=True,
    )

    data = db.Column(
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


class ForumGroupReport(db.Model):
    __tablename__ = "forum_group_reports"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    group_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "forum_groups.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    reporter_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    reason = db.Column(
        db.String(255),
        nullable=False,
        default="",
    )

    detail = db.Column(
        db.Text,
        nullable=True,
    )

    status = db.Column(
        db.String(30),
        nullable=False,
        default="open",
        index=True,
    )

    resolved_by = db.Column(
        db.BigInteger,
        nullable=True,
    )

    resolved_at = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
    )

    snapshot = db.Column(
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

    __table_args__ = (
        db.UniqueConstraint(
            "group_id",
            "reporter_id",
            "status",
            name="uq_forum_group_report_open_user",
        ),
    )


class ForumGroupWarning(db.Model):
    __tablename__ = "forum_group_warnings"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    group_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "forum_groups.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
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

    admin_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    content = db.Column(
        db.Text,
        nullable=False,
    )

    report_id = db.Column(
        db.BigInteger,
        nullable=True,
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        index=True,
    )


class ForumGroupMessage(db.Model):
    __tablename__ = "forum_group_messages"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    group_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "forum_groups.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    author_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    channel_id = db.Column(
        db.String(120),
        nullable=False,
        default="thao-luan",
        index=True,
    )

    content = db.Column(
        db.Text,
        nullable=False,
        default="",
    )

    message_type = db.Column(
        db.String(30),
        nullable=False,
        default="text",
        index=True,
    )

    is_announcement = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
    )

    is_like = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
    )

    attachment_url = db.Column(
        db.Text,
        nullable=True,
    )

    attachment_key = db.Column(
        db.Text,
        nullable=True,
    )

    attachment_name = db.Column(
        db.String(512),
        nullable=True,
    )

    attachment_type = db.Column(
        db.String(255),
        nullable=True,
    )

    attachment_size = db.Column(
        db.BigInteger,
        nullable=False,
        default=0,
    )

    reply_to_id = db.Column(
        db.BigInteger,
        nullable=True,
        index=True,
    )

    reply_to_author = db.Column(
        db.String(255),
        nullable=True,
    )

    reply_to_content = db.Column(
        db.Text,
        nullable=True,
    )

    reactions = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
    )

    is_pinned = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
        index=True,
    )

    edited = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
    )

    edited_at = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
    )

    metadata_json = db.Column(
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


class ForumGroupPresence(db.Model):
    __tablename__ = "forum_group_presence"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    group_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "forum_groups.id",
            ondelete="CASCADE",
        ),
        nullable=False,
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

    channel_id = db.Column(
        db.String(120),
        nullable=False,
        default="",
    )

    channel_label = db.Column(
        db.String(255),
        nullable=False,
        default="",
    )

    online = db.Column(
        db.Boolean,
        nullable=False,
        default=True,
        index=True,
    )

    last_seen = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        index=True,
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
            "group_id",
            "user_id",
            name="uq_forum_group_presence_group_user",
        ),
    )
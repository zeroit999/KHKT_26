from datetime import datetime, timezone

from extensions import db


def utc_now():
    return datetime.now(timezone.utc)


class ForumPost(db.Model):
    __tablename__ = "forum_posts"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
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

    title = db.Column(
        db.String(255),
        nullable=True,
    )

    content = db.Column(
        db.Text,
        nullable=False,
        default="",
    )

    scope = db.Column(
        db.String(50),
        nullable=False,
        default="hall",
        index=True,
    )

    teacher_only = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
    )

    comments_count = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    # =====================================================
    # POST TYPE / TAGS
    # =====================================================

    type = db.Column(
        db.String(50),
        nullable=False,
        default="discuss",
        index=True,
    )

    tags = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )

    # =====================================================
    # GROUP POST
    # =====================================================

    group_id = db.Column(
        db.String(100),
        nullable=True,
        index=True,
    )

    group_name = db.Column(
        db.String(255),
        nullable=True,
    )

    # =====================================================
    # ATTACHMENTS
    # =====================================================

    attachment_url = db.Column(
        db.Text,
        nullable=True,
    )

    attachment_name = db.Column(
        db.String(255),
        nullable=True,
    )

    image_url = db.Column(
        db.Text,
        nullable=True,
    )

    # =====================================================
    # EVENT
    # =====================================================

    event_start_at = db.Column(
        db.String(100),
        nullable=True,
    )

    event_end_at = db.Column(
        db.String(100),
        nullable=True,
    )

    event_location = db.Column(
        db.String(255),
        nullable=True,
    )

    event_created_by_admin = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
    )

    event_interested_by = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )

    event_not_interested_by = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )

    event_started_notified_at = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
    )

    event_ended_notified_at = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
    )

    # =====================================================
    # POLL
    # =====================================================

    poll_options = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )

    poll_start_at = db.Column(
        db.String(100),
        nullable=True,
    )

    poll_end_at = db.Column(
        db.String(100),
        nullable=True,
    )

    poll_votes = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
    )

    poll_votes_count = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
    )

    # =====================================================
    # MODERATION
    # =====================================================

    status = db.Column(
        db.String(30),
        nullable=False,
        default="approved",
        index=True,
    )

    moderation_status = db.Column(
        db.String(30),
        nullable=True,
        index=True,
    )

    approved_by = db.Column(
        db.BigInteger,
        nullable=True,
    )

    approved_at = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
    )

    rejected_by = db.Column(
        db.BigInteger,
        nullable=True,
    )

    rejected_at = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
    )

    rejection_reason = db.Column(
        db.Text,
        nullable=True,
    )

    # =====================================================
    # AUTHOR DISPLAY OVERRIDES
    #
    # Giữ nguyên author_id làm khóa user SQL.
    # Các field dưới đây phục vụ dữ liệu hiển thị của post
    # và trường hợp đăng ẩn danh giống logic Forum.jsx.
    # =====================================================

    author_name_override = db.Column(
        db.String(255),
        nullable=True,
    )

    author_email_override = db.Column(
        db.String(255),
        nullable=True,
    )

    author_initials_override = db.Column(
        db.String(20),
        nullable=True,
    )

    author_photo_url = db.Column(
        db.Text,
        nullable=True,
    )

    author_role_override = db.Column(
        db.String(30),
        nullable=True,
    )

    # =====================================================
    # REACTIONS / LIKES
    # =====================================================

    likes_count = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    reactions_count = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    reaction_counts = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
    )

    reactions = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
    )

    liked_by = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )

    # =====================================================
    # VIEWS
    # =====================================================

    views_count = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    viewed_by = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )

    # =====================================================
    # SAVED POSTS
    # =====================================================

    saved_by = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )

    # =====================================================
    # POST STATE
    # =====================================================

    is_pinned = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
    )

    is_anonymous = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
    )

    is_answered = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
    )

    # =====================================================
    # REPORT
    # =====================================================

    report_count = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    reported_by = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )

    report_status = db.Column(
        db.String(30),
        nullable=True,
    )

    # =====================================================
    # TIMESTAMPS
    # =====================================================

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


class ForumComment(db.Model):
    __tablename__ = "forum_comments"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    post_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "forum_posts.id",
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

    content = db.Column(
        db.Text,
        nullable=False,
    )

    parent_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "forum_comments.id",
            ondelete="CASCADE",
        ),
        nullable=True,
        index=True,
    )

    root_comment_id = db.Column(
        db.BigInteger,
        nullable=True,
        index=True,
    )

    depth = db.Column(
        db.Integer,
        nullable=False,
        default=1,
    )

    reactions_count = db.Column(
        db.Integer,
        nullable=False,
        default=0,
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


class ForumCommentReaction(db.Model):
    __tablename__ = "forum_comment_reactions"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    comment_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "forum_comments.id",
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

    reaction = db.Column(
        db.String(30),
        nullable=False,
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
            "comment_id",
            "user_id",
            name=(
                "uq_forum_comment_reactions_"
                "comment_user"
            ),
        ),
    )


class ForumNotification(db.Model):
    __tablename__ = "forum_notifications"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    to_user_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    from_user_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    type = db.Column(
        db.String(50),
        nullable=False,
        index=True,
    )

    category = db.Column(
        db.String(50),
        nullable=False,
        default="post-interaction",
    )

    scope = db.Column(
        db.String(50),
        nullable=False,
        default="hall",
    )

    post_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "forum_posts.id",
            ondelete="CASCADE",
        ),
        nullable=True,
        index=True,
    )

    comment_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "forum_comments.id",
            ondelete="CASCADE",
        ),
        nullable=True,
        index=True,
    )

    text = db.Column(
        db.Text,
        nullable=False,
        default="",
    )

    read = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
        index=True,
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        index=True,
    )

class ForumReport(db.Model):
    __tablename__ = "forum_reports"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    post_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "forum_posts.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    post_title = db.Column(
        db.String(255),
        nullable=True,
    )

    post_content = db.Column(
        db.Text,
        nullable=True,
    )

    post_author_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=True,
        index=True,
    )

    post_author_name = db.Column(
        db.String(255),
        nullable=True,
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

    reporter_name = db.Column(
        db.String(255),
        nullable=True,
    )

    reporter_email = db.Column(
        db.String(255),
        nullable=True,
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

    scope = db.Column(
        db.String(50),
        nullable=False,
        default="hall",
        index=True,
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
            "post_id",
            "reporter_id",
            name=(
                "uq_forum_reports_"
                "post_reporter"
            ),
        ),
    )
from datetime import datetime, timezone

from extensions import db


def utc_now():
    return datetime.now(timezone.utc)


class Course(db.Model):
    __tablename__ = "courses"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    # Dùng khi migrate dữ liệu từ hệ thống cũ.
    # Legacy document ID có thể không phải số.
    legacy_id = db.Column(
        db.String(255),
        unique=True,
        nullable=True,
        index=True,
    )

    teacher_id = db.Column(
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

    topic = db.Column(
        db.String(500),
        nullable=True,
    )

    description = db.Column(
        db.Text,
        nullable=True,
    )

    content = db.Column(
        db.Text,
        nullable=True,
    )

    category = db.Column(
        db.String(255),
        nullable=True,
        index=True,
    )

    content_type = db.Column(
        db.String(50),
        nullable=True,
        index=True,
    )

    thumbnail = db.Column(
        db.Text,
        nullable=True,
    )

    thumbnail_file_name = db.Column(
        db.String(500),
        nullable=True,
    )

    document_image_url = db.Column(
        db.Text,
        nullable=True,
    )

    document_image_name = db.Column(
        db.String(500),
        nullable=True,
    )

    document_image_size = db.Column(
        db.BigInteger,
        nullable=False,
        default=0,
    )

    document_file_size = db.Column(
        db.BigInteger,
        nullable=False,
        default=0,
    )

    word_file_name = db.Column(
        db.String(500),
        nullable=True,
    )

    word_file_url = db.Column(
        db.Text,
        nullable=True,
    )

    rich_document = db.Column(
        db.Text,
        nullable=True,
    )

    document_mode = db.Column(
        db.String(100),
        nullable=True,
    )

    document_file_type = db.Column(
        db.String(100),
        nullable=True,
    )

    simulation_mode = db.Column(
        db.String(100),
        nullable=True,
    )

    simulation_url = db.Column(
        db.Text,
        nullable=True,
    )

    simulation_html = db.Column(
        db.Text,
        nullable=True,
    )

    simulation_language = db.Column(
        db.String(100),
        nullable=True,
    )

    simulation_code = db.Column(
        db.Text,
        nullable=True,
    )

    simulation_codes = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
    )

    simulation_instructions = db.Column(
        db.Text,
        nullable=True,
    )

    youtube_url = db.Column(
        db.Text,
        nullable=True,
    )

    lumi_url = db.Column(
        db.Text,
        nullable=True,
    )

    mp4_file_name = db.Column(
        db.String(500),
        nullable=True,
    )

    mp4_file_url = db.Column(
        db.Text,
        nullable=True,
    )

    video_source_type = db.Column(
        db.String(100),
        nullable=True,
    )

    video_sources = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )

    duration_seconds = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    duration = db.Column(
        db.String(100),
        nullable=True,
    )

    youtube_duration = db.Column(
        db.String(100),
        nullable=True,
    )

    attach_mode = db.Column(
        db.String(100),
        nullable=True,
    )

    code_language = db.Column(
        db.String(100),
        nullable=True,
    )

    code_content = db.Column(
        db.Text,
        nullable=True,
    )

    learning_objectives = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )

    prerequisites = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )

    difficulty = db.Column(
        db.String(50),
        nullable=False,
        default="medium",
        index=True,
    )

    estimated_minutes = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    checklist = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )

    quiz = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )

    lesson_topics = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )

    lessons = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )

    lesson_count = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    course_code = db.Column(
        db.String(255),
        unique=True,
        nullable=True,
        index=True,
    )

    teacher_code = db.Column(
        db.String(255),
        nullable=True,
    )

    teacher_email = db.Column(
        db.String(255),
        nullable=True,
        index=True,
    )

    teacher_name = db.Column(
        db.String(255),
        nullable=True,
    )

    teacher_subject = db.Column(
        db.String(255),
        nullable=True,
        index=True,
    )

    created_by_role = db.Column(
        db.String(50),
        nullable=True,
    )

    visibility = db.Column(
        db.String(50),
        nullable=False,
        default="public",
        index=True,
    )

    class_id = db.Column(
        db.String(255),
        nullable=True,
        index=True,
    )

    class_name = db.Column(
        db.String(255),
        nullable=True,
        index=True,
    )

    open_at = db.Column(
        db.String(255),
        nullable=True,
    )

    open_at_ms = db.Column(
        db.BigInteger,
        nullable=True,
        index=True,
    )

    publish_confirmed = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
    )

    status = db.Column(
        db.String(50),
        nullable=False,
        default="pending",
        index=True,
    )

    moderation_status = db.Column(
        db.String(50),
        nullable=False,
        default="pending",
        index=True,
    )

    student_count = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    rating = db.Column(
        db.Float,
        nullable=False,
        default=0,
    )

    rating_total = db.Column(
        db.Float,
        nullable=False,
        default=0,
    )

    rating_count = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    views = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    is_featured = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
        index=True,
    )

    metadata_json = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
    )

    submitted_at = db.Column(
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


class LearningProgress(db.Model):
    __tablename__ = "learning_progress"

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

    course_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "courses.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    progress = db.Column(
        db.Float,
        nullable=False,
        default=0,
    )

    watched_seconds = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    watched_date = db.Column(
        db.String(20),
        nullable=True,
        index=True,
    )

    bookmarked = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
        index=True,
    )

    completed_checklist = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
    )

    quiz_result = db.Column(
        db.JSON,
        nullable=True,
    )

    notes = db.Column(
        db.Text,
        nullable=True,
    )

    note_color = db.Column(
        db.String(50),
        nullable=True,
    )

    last_viewed_at = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
    )

    last_watched_at = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
    )

    first_watched_at = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
    )

    saved_at = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
    )

    unsaved_at = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
    )

    completed_at = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
    )

    progress_data = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
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
            "user_id",
            "course_id",
            name="uq_learning_progress_user_course",
        ),
    )


class CourseRating(db.Model):
    __tablename__ = "course_ratings"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    course_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "courses.id",
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

    rating = db.Column(
        db.Float,
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
            "course_id",
            "user_id",
            name="uq_course_rating_user",
        ),
    )


class CourseView(db.Model):
    __tablename__ = "course_views"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    course_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "courses.id",
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

    first_viewed_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    view_data = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
    )

    __table_args__ = (
        db.UniqueConstraint(
            "course_id",
            "user_id",
            name="uq_course_view_user",
        ),
    )


class CourseQuestion(db.Model):
    __tablename__ = "course_questions"

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

    course_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "courses.id",
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

    user_name = db.Column(
        db.String(255),
        nullable=True,
    )

    user_avatar = db.Column(
        db.Text,
        nullable=True,
    )

    user_role = db.Column(
        db.String(50),
        nullable=True,
        index=True,
    )

    content = db.Column(
        db.Text,
        nullable=False,
    )

    is_admin = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
    )

    question_data = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
    )

    edited_at = db.Column(
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


class CourseQuestionReply(db.Model):
    __tablename__ = "course_question_replies"

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

    question_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "course_questions.id",
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

    user_name = db.Column(
        db.String(255),
        nullable=True,
    )

    user_avatar = db.Column(
        db.Text,
        nullable=True,
    )

    user_role = db.Column(
        db.String(50),
        nullable=True,
    )

    content = db.Column(
        db.Text,
        nullable=False,
    )

    is_admin = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
    )

    is_teacher_reply = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
    )

    reply_data = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
    )

    edited_at = db.Column(
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


class CourseSavedList(db.Model):
    __tablename__ = "course_saved_lists"

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

    list_data = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
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


class CourseSavedListItem(db.Model):
    __tablename__ = "course_saved_list_items"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    saved_list_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "course_saved_lists.id",
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
        nullable=False,
        index=True,
    )

    position = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    __table_args__ = (
        db.UniqueConstraint(
            "saved_list_id",
            "course_id",
            name="uq_saved_list_course",
        ),
    )


class LearningReport(db.Model):
    __tablename__ = "learning_reports"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    report_type = db.Column(
        db.String(50),
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

    course_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "courses.id",
            ondelete="CASCADE",
        ),
        nullable=True,
        index=True,
    )

    reported_user_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
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
    )

    detail = db.Column(
        db.Text,
        nullable=True,
    )

    status = db.Column(
        db.String(50),
        nullable=False,
        default="pending",
        index=True,
    )

    report_data = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
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
from datetime import datetime, timezone

from extensions import db


def utc_now():
    return datetime.now(
        timezone.utc
    )


# =========================================================
# CLASSROOM
# =========================================================

class Classroom(db.Model):
    __tablename__ = "classrooms"

    id = db.Column(
        db.Integer,
        primary_key=True,
        autoincrement=True,
    )

    # -----------------------------------------------------
    # EXISTING FIELDS
    # -----------------------------------------------------

    name = db.Column(
        db.String(200),
        nullable=False,
    )

    description = db.Column(
        db.Text,
        nullable=True,
    )

    grade = db.Column(
        db.String(20),
        nullable=True,
        index=True,
    )

    class_code = db.Column(
        db.String(50),
        nullable=True,
        unique=True,
        index=True,
    )

    # -----------------------------------------------------
    # OWNER / TEACHER
    # -----------------------------------------------------

    teacher_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
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

    teacher_photo_url = db.Column(
        db.Text,
        nullable=True,
    )

    teacher_gender = db.Column(
        db.String(50),
        nullable=True,
    )

    # -----------------------------------------------------
    # CLASS INFORMATION
    # -----------------------------------------------------

    school = db.Column(
        db.String(500),
        nullable=True,
    )

    subject = db.Column(
        db.String(255),
        nullable=True,
    )

    school_year = db.Column(
        db.String(50),
        nullable=True,
    )

    theme_color = db.Column(
        db.String(50),
        nullable=True,
        default="#2563eb",
    )

    cover_photo_url = db.Column(
        db.Text,
        nullable=True,
    )

    logo_url = db.Column(
        db.Text,
        nullable=True,
    )

    status = db.Column(
        db.String(50),
        nullable=True,
        default="active",
        index=True,
    )

    student_count = db.Column(
        db.Integer,
        nullable=True,
        default=0,
    )

    # -----------------------------------------------------
    # LEGACY COMPATIBILITY DATA
    # -----------------------------------------------------

    member_ids = db.Column(
        db.JSON,
        nullable=True,
        default=list,
    )

    dismissed_notification_source_keys = db.Column(
        db.JSON,
        nullable=True,
        default=list,
    )

    schedule_week_configs = db.Column(
        db.JSON,
        nullable=True,
        default=dict,
    )

    schedule_time_rules = db.Column(
        db.JSON,
        nullable=True,
        default=dict,
    )

    schedule_content_rules = db.Column(
        db.JSON,
        nullable=True,
        default=dict,
    )

    class_data = db.Column(
        db.JSON,
        nullable=True,
        default=dict,
    )

    # -----------------------------------------------------
    # TIMESTAMPS
    # -----------------------------------------------------

    created_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
    )

    updated_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
        onupdate=utc_now,
    )


# =========================================================
# CLASSROOM MEMBER / STUDENT / INTERN TEACHER
# Legacy document structure:
# classes/{classId}/students/{studentId}
# =========================================================

class ClassroomMember(db.Model):
    __tablename__ = "classroom_members"

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

    classroom_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "classrooms.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    user_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    email = db.Column(
        db.String(255),
        nullable=True,
        index=True,
    )

    name = db.Column(
        db.String(255),
        nullable=True,
    )

    role = db.Column(
        db.String(50),
        nullable=True,
        default="STUDENT",
        index=True,
    )

    class_role = db.Column(
        db.String(50),
        nullable=True,
        default="",
        index=True,
    )

    student_code = db.Column(
        db.String(100),
        nullable=True,
        index=True,
    )

    photo_url = db.Column(
        db.Text,
        nullable=True,
    )

    gender = db.Column(
        db.String(50),
        nullable=True,
    )

    birth_date = db.Column(
        db.String(50),
        nullable=True,
    )

    phone = db.Column(
        db.String(100),
        nullable=True,
    )

    parent_name = db.Column(
        db.String(255),
        nullable=True,
    )

    parent_phone = db.Column(
        db.String(100),
        nullable=True,
    )

    parent_email = db.Column(
        db.String(255),
        nullable=True,
    )

    parent_relation = db.Column(
        db.String(100),
        nullable=True,
    )

    medical_note = db.Column(
        db.Text,
        nullable=True,
    )

    status = db.Column(
        db.String(50),
        nullable=True,
        default="active",
        index=True,
    )

    member_data = db.Column(
        db.JSON,
        nullable=True,
        default=dict,
    )

    created_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
    )

    updated_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
        onupdate=utc_now,
    )

    __table_args__ = (
        db.Index(
            "ix_classroom_members_class_email",
            "classroom_id",
            "email",
        ),

        db.Index(
            "ix_classroom_members_class_user",
            "classroom_id",
            "user_id",
        ),
    )


# =========================================================
# ASSIGNMENT
# Legacy document structure:
# classes/{classId}/assignments/{assignmentId}
# =========================================================

class ClassroomAssignment(db.Model):
    __tablename__ = "classroom_assignments"

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

    classroom_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "classrooms.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    teacher_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    title = db.Column(
        db.String(500),
        nullable=False,
        default="",
    )

    description = db.Column(
        db.Text,
        nullable=True,
    )

    instructions = db.Column(
        db.Text,
        nullable=True,
    )

    status = db.Column(
        db.String(50),
        nullable=True,
        default="active",
        index=True,
    )

    due_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
    )

    due_at_ms = db.Column(
        db.BigInteger,
        nullable=True,
        index=True,
    )

    attachments = db.Column(
        db.JSON,
        nullable=True,
        default=list,
    )

    assignment_data = db.Column(
        db.JSON,
        nullable=True,
        default=dict,
    )

    created_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
    )

    updated_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
        onupdate=utc_now,
    )


# =========================================================
# ASSIGNMENT SUBMISSION
#
# Replaces:
# assignment.submissions[studentId]
# =========================================================

class ClassroomSubmission(db.Model):
    __tablename__ = "classroom_submissions"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    assignment_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "classroom_assignments.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    classroom_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "classrooms.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    member_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "classroom_members.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    user_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    email = db.Column(
        db.String(255),
        nullable=True,
        index=True,
    )

    student_name = db.Column(
        db.String(255),
        nullable=True,
    )

    content = db.Column(
        db.Text,
        nullable=True,
    )

    attachment = db.Column(
        db.JSON,
        nullable=True,
    )

    attachments = db.Column(
        db.JSON,
        nullable=True,
        default=list,
    )

    status = db.Column(
        db.String(50),
        nullable=True,
        default="submitted",
        index=True,
    )

    is_late = db.Column(
        db.Boolean,
        nullable=True,
        default=False,
    )

    score = db.Column(
        db.Float,
        nullable=True,
    )

    feedback = db.Column(
        db.Text,
        nullable=True,
    )

    submission_data = db.Column(
        db.JSON,
        nullable=True,
        default=dict,
    )

    submitted_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
    )

    updated_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
        onupdate=utc_now,
    )

    __table_args__ = (
        db.Index(
            "ix_classroom_submission_assignment_member",
            "assignment_id",
            "member_id",
        ),
    )


# =========================================================
# ATTENDANCE
# Legacy document structure:
# classes/{classId}/attendance/{YYYY-MM-DD}
# =========================================================

class ClassroomAttendance(db.Model):
    __tablename__ = "classroom_attendance"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    classroom_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "classrooms.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    attendance_date = db.Column(
        db.String(20),
        nullable=False,
        index=True,
    )

    teacher_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    records = db.Column(
        db.JSON,
        nullable=True,
        default=list,
    )

    intern_records = db.Column(
        db.JSON,
        nullable=True,
        default=list,
    )

    qr_check_ins = db.Column(
        db.JSON,
        nullable=True,
        default=dict,
    )

    qr_token = db.Column(
        db.String(255),
        nullable=True,
        index=True,
    )

    qr_expires_at_ms = db.Column(
        db.BigInteger,
        nullable=True,
        index=True,
    )

    qr_created_by = db.Column(
        db.BigInteger,
        nullable=True,
    )

    qr_created_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
    )

    present_count = db.Column(
        db.Integer,
        nullable=True,
        default=0,
    )

    late_count = db.Column(
        db.Integer,
        nullable=True,
        default=0,
    )

    absent_count = db.Column(
        db.Integer,
        nullable=True,
        default=0,
    )

    excused_count = db.Column(
        db.Integer,
        nullable=True,
        default=0,
    )

    total_count = db.Column(
        db.Integer,
        nullable=True,
        default=0,
    )

    attendance_rate = db.Column(
        db.Float,
        nullable=True,
        default=0.0,
    )

    attendance_data = db.Column(
        db.JSON,
        nullable=True,
        default=dict,
    )

    created_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
    )

    updated_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
        onupdate=utc_now,
    )

    __table_args__ = (
        db.UniqueConstraint(
            "classroom_id",
            "attendance_date",
            name=
                "uq_classroom_attendance_date",
        ),
    )


# =========================================================
# ATTENDANCE HISTORY
# Legacy document structure:
# attendance/{date}/history/{historyId}
# =========================================================

class ClassroomAttendanceHistory(db.Model):
    __tablename__ = "classroom_attendance_history"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    attendance_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "classroom_attendance.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    classroom_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "classrooms.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    attendance_date = db.Column(
        db.String(20),
        nullable=False,
        index=True,
    )

    teacher_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    teacher_name = db.Column(
        db.String(255),
        nullable=True,
    )

    teacher_email = db.Column(
        db.String(255),
        nullable=True,
    )

    records = db.Column(
        db.JSON,
        nullable=True,
        default=list,
    )

    present_count = db.Column(
        db.Integer,
        nullable=True,
        default=0,
    )

    late_count = db.Column(
        db.Integer,
        nullable=True,
        default=0,
    )

    absent_count = db.Column(
        db.Integer,
        nullable=True,
        default=0,
    )

    excused_count = db.Column(
        db.Integer,
        nullable=True,
        default=0,
    )

    total_count = db.Column(
        db.Integer,
        nullable=True,
        default=0,
    )

    attendance_rate = db.Column(
        db.Float,
        nullable=True,
        default=0.0,
    )

    history_data = db.Column(
        db.JSON,
        nullable=True,
        default=dict,
    )

    saved_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
    )


# =========================================================
# SUBJECT
# Legacy document structure:
# classes/{classId}/subjects/{subjectId}
# =========================================================

class ClassroomSubject(db.Model):
    __tablename__ = "classroom_subjects"

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

    classroom_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "classrooms.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    teacher_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    name = db.Column(
        db.String(255),
        nullable=False,
        default="",
    )

    display_order = db.Column(
        db.Integer,
        nullable=True,
        default=0,
    )

    is_default = db.Column(
        db.Boolean,
        nullable=True,
        default=False,
    )

    subject_data = db.Column(
        db.JSON,
        nullable=True,
        default=dict,
    )

    created_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
    )

    updated_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
        onupdate=utc_now,
    )


# =========================================================
# SUBJECT TEST
# Legacy document structure:
# subjects/{subjectId}/tests/{testId}
# =========================================================

class ClassroomSubjectTest(db.Model):
    __tablename__ = "classroom_subject_tests"

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

    subject_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "classroom_subjects.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    classroom_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "classrooms.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    name = db.Column(
        db.String(255),
        nullable=True,
    )

    code = db.Column(
        db.String(100),
        nullable=True,
    )

    display_order = db.Column(
        db.Integer,
        nullable=True,
        default=0,
    )

    max_score = db.Column(
        db.Float,
        nullable=True,
        default=10.0,
    )

    test_data = db.Column(
        db.JSON,
        nullable=True,
        default=dict,
    )

    created_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
    )

    updated_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
        onupdate=utc_now,
    )


# =========================================================
# SUBJECT SCORE
# Legacy document structure:
# subjects/{subjectId}/scores/{studentId}
#
# scores JSON retains:
# {
#     testId: score
# }
# =========================================================

class ClassroomScore(db.Model):
    __tablename__ = "classroom_scores"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    subject_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "classroom_subjects.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    classroom_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "classrooms.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    member_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "classroom_members.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    user_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    scores = db.Column(
        db.JSON,
        nullable=True,
        default=dict,
    )

    average = db.Column(
        db.Float,
        nullable=True,
    )

    score_data = db.Column(
        db.JSON,
        nullable=True,
        default=dict,
    )

    created_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
    )

    updated_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
        onupdate=utc_now,
    )

    __table_args__ = (
        db.UniqueConstraint(
            "subject_id",
            "member_id",
            name=
                "uq_classroom_score_subject_member",
        ),
    )


# =========================================================
# SCHEDULE
# Legacy document structure:
# classes/{classId}/schedule/{scheduleId}
# =========================================================

class ClassroomSchedule(db.Model):
    __tablename__ = "classroom_schedule"

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

    classroom_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "classrooms.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    teacher_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    week_key = db.Column(
        db.String(50),
        nullable=True,
        index=True,
    )

    schedule_date = db.Column(
        db.String(20),
        nullable=True,
        index=True,
    )

    weekday = db.Column(
        db.Integer,
        nullable=True,
    )

    start_time = db.Column(
        db.String(20),
        nullable=True,
    )

    end_time = db.Column(
        db.String(20),
        nullable=True,
    )

    title = db.Column(
        db.String(500),
        nullable=True,
    )

    lesson_content = db.Column(
        db.Text,
        nullable=True,
    )

    room = db.Column(
        db.String(255),
        nullable=True,
    )

    note = db.Column(
        db.Text,
        nullable=True,
    )

    important = db.Column(
        db.Boolean,
        nullable=True,
        default=False,
        index=True,
    )

    kind = db.Column(
        db.String(100),
        nullable=True,
        index=True,
    )

    expires_at_ms = db.Column(
        db.BigInteger,
        nullable=True,
        index=True,
    )

    schedule_data = db.Column(
        db.JSON,
        nullable=True,
        default=dict,
    )

    created_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
    )

    updated_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
        onupdate=utc_now,
    )


# =========================================================
# CLASSROOM NOTIFICATION
# Legacy document structure:
# classes/{classId}/notifications/{notificationId}
# =========================================================

class ClassroomNotification(db.Model):
    __tablename__ = "classroom_notifications"

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

    classroom_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "classrooms.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    source_key = db.Column(
        db.String(500),
        nullable=True,
        index=True,
    )

    notification_type = db.Column(
        db.String(100),
        nullable=True,
        index=True,
    )

    severity = db.Column(
        db.String(50),
        nullable=True,
        index=True,
    )

    title = db.Column(
        db.String(500),
        nullable=True,
    )

    message = db.Column(
        db.Text,
        nullable=True,
    )

    content_html = db.Column(
        db.Text,
        nullable=True,
    )

    notification_kind = db.Column(
        db.String(100),
        nullable=True,
        index=True,
    )

    system_generated = db.Column(
        db.Boolean,
        nullable=True,
        default=False,
    )

    automatic_label = db.Column(
        db.String(255),
        nullable=True,
    )

    recipient_type = db.Column(
        db.String(100),
        nullable=True,
        index=True,
    )

    recipient_uid = db.Column(
        db.BigInteger,
        nullable=True,
        index=True,
    )

    recipient_email = db.Column(
        db.String(255),
        nullable=True,
        index=True,
    )

    recipient_student_id = db.Column(
        db.BigInteger,
        nullable=True,
        index=True,
    )

    author_id = db.Column(
        db.BigInteger,
        nullable=True,
        index=True,
    )

    author_name = db.Column(
        db.String(255),
        nullable=True,
    )

    attachments = db.Column(
        db.JSON,
        nullable=True,
        default=list,
    )

    read_by = db.Column(
        db.JSON,
        nullable=True,
        default=list,
    )

    dismissed_by = db.Column(
        db.JSON,
        nullable=True,
        default=list,
    )

    notification_data = db.Column(
        db.JSON,
        nullable=True,
        default=dict,
    )

    created_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
    )

    updated_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
        onupdate=utc_now,
    )


# =========================================================
# CLASSROOM MESSAGE
# Legacy document structure:
# classes/{classId}/messages/{messageId}
# =========================================================

class ClassroomMessage(db.Model):
    __tablename__ = "classroom_messages"

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

    classroom_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "classrooms.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    conversation_id = db.Column(
        db.String(500),
        nullable=True,
        index=True,
    )

    sender_id = db.Column(
        db.BigInteger,
        nullable=True,
        index=True,
    )

    sender_email = db.Column(
        db.String(255),
        nullable=True,
        index=True,
    )

    sender_name = db.Column(
        db.String(255),
        nullable=True,
    )

    sender_avatar = db.Column(
        db.Text,
        nullable=True,
    )

    receiver_id = db.Column(
        db.BigInteger,
        nullable=True,
        index=True,
    )

    receiver_email = db.Column(
        db.String(255),
        nullable=True,
        index=True,
    )

    receiver_name = db.Column(
        db.String(255),
        nullable=True,
    )

    receiver_type = db.Column(
        db.String(100),
        nullable=True,
    )

    receiver_avatar = db.Column(
        db.Text,
        nullable=True,
    )

    content = db.Column(
        db.Text,
        nullable=True,
    )

    attachment = db.Column(
        db.JSON,
        nullable=True,
    )

    recalled = db.Column(
        db.Boolean,
        nullable=True,
        default=False,
        index=True,
    )

    recalled_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
    )

    message_data = db.Column(
        db.JSON,
        nullable=True,
        default=dict,
    )

    created_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
        index=True,
    )

    updated_at = db.Column(
        db.DateTime(
            timezone=True
        ),
        nullable=True,
        default=utc_now,
        onupdate=utc_now,
    )
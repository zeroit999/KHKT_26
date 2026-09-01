from datetime import datetime, timezone

from extensions import db


def utc_now():
    return datetime.now(timezone.utc)


class Exam(db.Model):
    __tablename__ = "exams"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
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

    description = db.Column(
        db.Text,
        nullable=True,
    )

    subject = db.Column(
        db.String(255),
        nullable=True,
        index=True,
    )

    duration = db.Column(
        db.Integer,
        nullable=True,
    )

    status = db.Column(
        db.String(50),
        nullable=True,
        index=True,
    )

    visibility = db.Column(
        db.String(50),
        nullable=True,
        index=True,
    )

    selected_grades = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )

    selected_classes = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )

    settings = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
    )

    metadata_json = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
    )

    student_result_count = db.Column(
        db.Integer,
        nullable=False,
        default=0,
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


class ExamQuestion(db.Model):
    __tablename__ = "exam_questions"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    exam_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "exams.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    question_key = db.Column(
        db.String(255),
        nullable=True,
    )

    position = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    question_data = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    __table_args__ = (
        db.UniqueConstraint(
            "exam_id",
            "question_key",
            name="uq_exam_question_key",
        ),
    )


class ExamResult(db.Model):
    __tablename__ = "exam_results"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    exam_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "exams.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    student_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    result_data = db.Column(
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


class ExamAttempt(db.Model):
    __tablename__ = "exam_attempts"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    exam_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "exams.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    student_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    attempt_data = db.Column(
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
            "exam_id",
            "student_id",
            name="uq_exam_attempt_student",
        ),
    )


class ProctoringSession(db.Model):
    __tablename__ = "proctoring_sessions"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    exam_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "exams.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    student_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    session_key = db.Column(
        db.String(255),
        nullable=True,
        index=True,
    )

    status = db.Column(
        db.String(50),
        nullable=True,
        index=True,
    )

    violation_count = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    session_data = db.Column(
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


class ProctoringEvent(db.Model):
    __tablename__ = "proctoring_events"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    session_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "proctoring_sessions.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    event_type = db.Column(
        db.String(100),
        nullable=True,
        index=True,
    )

    event_data = db.Column(
        db.JSON,
        nullable=False,
        default=dict,
    )

    server_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )
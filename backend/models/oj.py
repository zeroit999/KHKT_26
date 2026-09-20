from datetime import datetime, timezone

from extensions import db


def utc_now():
    return datetime.now(timezone.utc)


class OJProblem(db.Model):
    __tablename__ = "oj_problems"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    code = db.Column(
        db.String(50),
        nullable=False,
        unique=True,
        index=True,
    )

    title = db.Column(
        db.String(500),
        nullable=False,
    )

    description = db.Column(
        db.Text,
        nullable=False,
    )

    input_description = db.Column(
        db.Text,
        nullable=True,
    )

    output_description = db.Column(
        db.Text,
        nullable=True,
    )

    constraints_text = db.Column(
        db.Text,
        nullable=True,
    )

    difficulty = db.Column(
        db.String(30),
        nullable=False,
        default="EASY",
        index=True,
    )

    category = db.Column(
        db.String(100),
        nullable=True,
        index=True,
    )

    points = db.Column(
        db.Integer,
        nullable=False,
        default=100,
    )

    time_limit_ms = db.Column(
        db.Integer,
        nullable=False,
        default=1000,
    )

    memory_limit_mb = db.Column(
        db.Integer,
        nullable=False,
        default=256,
    )

    status = db.Column(
        db.String(30),
        nullable=False,
        default="DRAFT",
        index=True,
    )

    created_by = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
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
    )

    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    __table_args__ = (
        db.CheckConstraint(
            "difficulty IN ('EASY', 'MEDIUM', 'HARD')",
            name="ck_oj_problems_difficulty",
        ),
        db.CheckConstraint(
            "status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')",
            name="ck_oj_problems_status",
        ),
        db.CheckConstraint(
            "points > 0",
            name="ck_oj_problems_points_positive",
        ),
        db.CheckConstraint(
            "time_limit_ms > 0",
            name="ck_oj_problems_time_limit_positive",
        ),
        db.CheckConstraint(
            "memory_limit_mb > 0",
            name="ck_oj_problems_memory_limit_positive",
        ),
    )


class OJTestCase(db.Model):
    __tablename__ = "oj_testcases"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    problem_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "oj_problems.id",
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

    input_data = db.Column(
        db.Text,
        nullable=False,
    )

    expected_output = db.Column(
        db.Text,
        nullable=False,
    )

    is_sample = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
        index=True,
    )

    points = db.Column(
        db.Integer,
        nullable=True,
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    __table_args__ = (
        db.UniqueConstraint(
            "problem_id",
            "position",
            name="uq_oj_testcase_position",
        ),
    )


class OJSubmission(db.Model):
    __tablename__ = "oj_submissions"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    problem_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "oj_problems.id",
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

    language = db.Column(
        db.String(30),
        nullable=False,
        index=True,
    )

    source_code = db.Column(
        db.Text,
        nullable=False,
    )

    verdict = db.Column(
        db.String(30),
        nullable=False,
        default="PENDING",
        index=True,
    )

    score = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    execution_time_ms = db.Column(
        db.Integer,
        nullable=True,
    )

    memory_used_kb = db.Column(
        db.BigInteger,
        nullable=True,
    )

    compiler_output = db.Column(
        db.Text,
        nullable=True,
    )

    judge_message = db.Column(
        db.Text,
        nullable=True,
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        index=True,
    )

    judging_started_at = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    judge_token = db.Column(
        db.String(36),
        nullable=True,
        index=True,
    )

    judged_at = db.Column(
        db.DateTime(timezone=True),
        nullable=True,
    )

    __table_args__ = (
        db.CheckConstraint(
            "language IN ('CPP23', 'PYTHON314', 'JAVA21')",
            name="ck_oj_submissions_language",
        ),
        db.CheckConstraint(
            "verdict IN ("
            "'PENDING', "
            "'JUDGING', "
            "'AC', "
            "'WA', "
            "'TLE', "
            "'MLE', "
            "'RE', "
            "'CE', "
            "'IE'"
            ")",
            name="ck_oj_submissions_verdict",
        ),
    )


class OJSubmissionResult(db.Model):
    __tablename__ = "oj_submission_results"

    id = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    submission_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "oj_submissions.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    testcase_id = db.Column(
        db.BigInteger,
        db.ForeignKey(
            "oj_testcases.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    position = db.Column(
        db.Integer,
        nullable=False,
    )

    verdict = db.Column(
        db.String(30),
        nullable=False,
    )

    execution_time_ms = db.Column(
        db.Integer,
        nullable=True,
    )

    memory_used_kb = db.Column(
        db.BigInteger,
        nullable=True,
    )

    points = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    message = db.Column(
        db.Text,
        nullable=True,
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    __table_args__ = (
        db.UniqueConstraint(
            "submission_id",
            "position",
            name="uq_oj_submission_result_position",
        ),
    )

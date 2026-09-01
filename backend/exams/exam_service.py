import re
from datetime import datetime, timezone

from sqlalchemy import select

from exams.exam_scoring import calculate_exam_score
from extensions import db
from models import (
    User,
    Exam,
    ExamQuestion,
    ExamResult,
    ExamAttempt,
    ProctoringSession,
    ProctoringEvent,
)


PROCTORING_EVENT_TYPES = {
    "session_started",
    "heartbeat",
    "permissions_granted",
    "visibility_hidden",
    "window_blur",
    "fullscreen_exit",
    "clipboard_blocked",
    "context_menu_blocked",
    "shortcut_blocked",
    "camera_stopped",
    "microphone_stopped",
    "voice_activity_suspected",
    "screen_stopped",
    "monitoring_restored",
    "submitted",
}


def utc_now():
    return datetime.now(timezone.utc)


def normalize_proctoring_config(exam_data):
    source = exam_data.get("proctoring") or {}
    legacy_limit = exam_data.get(
        "maxFullscreenViolations",
        2,
    )

    def flag(name, default):
        value = source.get(name)
        return (
            default
            if value is None
            else bool(value)
        )

    try:
        max_violations = int(
            source.get(
                "maxViolations",
                legacy_limit,
            )
            or 2
        )
    except (TypeError, ValueError):
        max_violations = 2

    try:
        heartbeat_seconds = int(
            source.get(
                "heartbeatSeconds",
                30,
            )
            or 30
        )
    except (TypeError, ValueError):
        heartbeat_seconds = 30

    return {
        "enabled": flag(
            "enabled",
            True,
        ),
        "requireFullscreen": flag(
            "requireFullscreen",
            True,
        ),
        "detectTabSwitch": flag(
            "detectTabSwitch",
            False,
        ),
        "detectWindowBlur": flag(
            "detectWindowBlur",
            False,
        ),
        "blockClipboard": flag(
            "blockClipboard",
            False,
        ),
        "blockContextMenu": flag(
            "blockContextMenu",
            False,
        ),
        "blockShortcuts": flag(
            "blockShortcuts",
            True,
        ),
        "requireCamera": flag(
            "requireCamera",
            False,
        ),
        "requireMicrophone": flag(
            "requireMicrophone",
            False,
        ),
        "detectVoiceActivity": (
            flag(
                "detectVoiceActivity",
                False,
            )
            and flag(
                "requireMicrophone",
                False,
            )
        ),
        "requireScreenShare": flag(
            "requireScreenShare",
            False,
        ),
        "requireEntireScreen": flag(
            "requireEntireScreen",
            False,
        ),
        "captureCameraEvidence": (
            flag(
                "captureCameraEvidence",
                False,
            )
            and flag(
                "requireCamera",
                False,
            )
        ),
        "captureScreenEvidence": (
            flag(
                "captureScreenEvidence",
                False,
            )
            and flag(
                "requireScreenShare",
                False,
            )
        ),
        "autoSubmit": flag(
            "autoSubmit",
            True,
        ),
        "maxViolations": max(
            1,
            min(
                max_violations,
                20,
            ),
        ),
        "heartbeatSeconds": max(
            15,
            min(
                heartbeat_seconds,
                120,
            ),
        ),
    }


def sanitize_proctoring_event(event):
    event = (
        event
        if isinstance(event, dict)
        else {}
    )

    event_type = str(
        event.get(
            "type",
            "",
        )
    )[:50]

    if event_type not in PROCTORING_EVENT_TYPES:
        raise Exception(
            "Loại sự kiện giám sát không hợp lệ"
        )

    metadata = event.get(
        "metadata",
        {},
    )

    if not isinstance(
        metadata,
        dict,
    ):
        metadata = {}

    safe_metadata = {}

    for key, value in list(
        metadata.items()
    )[:12]:
        safe_key = re.sub(
            r"[^a-zA-Z0-9_-]",
            "",
            str(key),
        )[:40]

        if not safe_key:
            continue

        if (
            isinstance(
                value,
                (bool, int, float),
            )
            or value is None
        ):
            safe_metadata[safe_key] = value
        else:
            safe_metadata[safe_key] = str(
                value
            )[:320]

    return {
        "id": re.sub(
            r"[^a-zA-Z0-9_-]",
            "",
            str(
                event.get(
                    "id",
                    "",
                )
            ),
        )[:80],
        "type": event_type,
        "severity": (
            "violation"
            if event.get("severity")
            == "violation"
            else "info"
        ),
        "message": str(
            event.get(
                "message",
                "",
            )
        )[:300],
        "clientAt": str(
            event.get(
                "at",
                "",
            )
        )[:80],
        "metadata": safe_metadata,
    }


def sanitize_proctoring_report(report):
    report = (
        report
        if isinstance(report, dict)
        else {}
    )

    events = []

    raw_events = report.get(
        "events",
        [],
    )

    if not isinstance(
        raw_events,
        list,
    ):
        raw_events = []

    for event in raw_events[:250]:
        try:
            events.append(
                sanitize_proctoring_event(
                    event
                )
            )
        except Exception:
            continue

    counts = report.get(
        "counts",
        {},
    )

    if not isinstance(
        counts,
        dict,
    ):
        counts = {}

    safe_counts = {}

    for key, value in list(
        counts.items()
    )[:20]:
        safe_key = re.sub(
            r"[^a-zA-Z0-9_-]",
            "",
            str(key),
        )[:40]

        try:
            safe_counts[safe_key] = max(
                0,
                int(value),
            )
        except (TypeError, ValueError):
            continue

    session_id = re.sub(
        r"[^a-zA-Z0-9_-]",
        "",
        str(
            report.get(
                "sessionId",
                "",
            )
        ),
    )[:80]

    return {
        "sessionId": session_id,
        "events": events,
        "counts": safe_counts,
        "totalViolations": sum(
            1
            for event in events
            if event.get("severity")
            == "violation"
        ),
        "cameraRequired": bool(
            report.get(
                "cameraRequired"
            )
        ),
        "microphoneRequired": bool(
            report.get(
                "microphoneRequired"
            )
        ),
        "screenRequired": bool(
            report.get(
                "screenRequired"
            )
        ),
        "cameraActiveAtSubmit": bool(
            report.get(
                "cameraActiveAtSubmit"
            )
        ),
        "microphoneActiveAtSubmit": bool(
            report.get(
                "microphoneActiveAtSubmit"
            )
        ),
        "screenActiveAtSubmit": bool(
            report.get(
                "screenActiveAtSubmit"
            )
        ),
        "startedAt": str(
            report.get(
                "startedAt",
                "",
            )
        )[:80],
        "submittedAt": str(
            report.get(
                "submittedAt",
                "",
            )
        )[:80],
    }


def restrict_evidence_paths(
    events,
    exam_id,
    student_id,
    session_id,
):
    expected_prefix = (
        f"exam-proctoring/"
        f"{exam_id}/"
        f"{student_id}/"
        f"{session_id}/"
        if (
            exam_id
            and student_id
            and session_id
        )
        else ""
    )

    for event in events:
        metadata = event.get(
            "metadata",
            {},
        )

        for key in (
            "evidenceCameraPath",
            "evidenceScreenPath",
        ):
            path = str(
                metadata.get(
                    key,
                    "",
                )
            )

            if (
                path
                and (
                    not expected_prefix
                    or not path.startswith(
                        expected_prefix
                    )
                )
            ):
                metadata.pop(
                    key,
                    None,
                )

    return events


def normalize_role(user):
    return str(
        user.get(
            "role",
            "",
        )
    ).strip().upper()


def is_teacher_or_admin(user):
    role = normalize_role(user)

    return role in [
        "TEACHER",
        "ADMIN",
        "ADMIN_DEV",
        "ADMIN USER",
    ]


def is_admin(user):
    role = normalize_role(user)

    return role in [
        "ADMIN",
        "ADMIN_DEV",
        "ADMIN USER",
    ]


def is_student(user):
    return (
        normalize_role(user)
        == "STUDENT"
    )


def serialize_value(value):
    if hasattr(
        value,
        "isoformat",
    ):
        return value.isoformat()

    return value


def serialize_doc_data(data):
    result = {}

    for key, value in (
        data or {}
    ).items():
        if isinstance(
            value,
            dict,
        ):
            result[key] = (
                serialize_doc_data(
                    value
                )
            )

        elif isinstance(
            value,
            list,
        ):
            result[key] = [
                (
                    serialize_doc_data(item)
                    if isinstance(
                        item,
                        dict,
                    )
                    else serialize_value(
                        item
                    )
                )
                for item in value
            ]

        else:
            result[key] = (
                serialize_value(
                    value
                )
            )

    return result


def normalize_id(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return value


def get_exam_model(exam_id):
    return db.session.get(
        Exam,
        normalize_id(exam_id),
    )


def exam_to_data(exam):
    if not exam:
        return {}

    data = dict(
        exam.metadata_json
        or {}
    )

    data.update({
        "title": exam.title,
        "description": exam.description,
        "subject": exam.subject,
        "duration": exam.duration,
        "status": exam.status,
        "visibility": exam.visibility,
        "selectedGrades": (
            exam.selected_grades
            or []
        ),
        "selectedClasses": (
            exam.selected_classes
            or []
        ),
        "settings": (
            exam.settings
            or {}
        ),
        "studentResultCount": (
            exam.student_result_count
            or 0
        ),
        "teacherId": exam.teacher_id,
        "createdAt": exam.created_at,
        "updatedAt": exam.updated_at,
    })

    return serialize_doc_data(
        data
    )


def hydrate_current_user(current_user):
    """
    Bổ sung thông tin profile từ PostgreSQL
    để giữ nguyên logic lọc đề theo khối/lớp.
    """

    uid = current_user.get(
        "uid"
    )

    if not uid:
        return current_user

    try:
        user = db.session.get(
            User,
            normalize_id(uid),
        )

        if not user:
            return current_user

        user_data = user.to_dict()

        profile_data = (
            user.profile_data
            if isinstance(user.profile_data, dict)
            else {}
        )

        profile_classes = (
            profile_data.get("classes")
            if isinstance(
                profile_data.get("classes"),
                list,
            )
            else []
        )

        profile_class = (
            str(profile_classes[0]).strip()
            if profile_classes
            else ""
        )

        profile_grade = (
            normalize_grade_value(
                profile_data.get("grade")
                or profile_data.get("khoi")
                or profile_data.get("gradeLevel")
                or profile_class
            )
        )

        return {
            **user_data,
            **current_user,
            "grade": (
                current_user.get("grade")
                or user.grade
                or profile_grade
                or ""
            ),
            "khoi": (
                current_user.get("khoi")
                or user.grade
                or profile_grade
                or ""
            ),
            "gradeLevel": (
                current_user.get(
                    "gradeLevel"
                )
                or user.grade
                or profile_grade
                or ""
            ),
            "studentGrade": (
                current_user.get(
                    "studentGrade"
                )
                or user.grade
                or profile_grade
                or ""
            ),
            "className": (
                current_user.get(
                    "className"
                )
                or user.class_name
                or ""
            ),
            "class": (
                current_user.get("class")
                or user.class_name
                or ""
            ),
            "lop": (
                current_user.get("lop")
                or user.class_name
                or ""
            ),
            "studentClass": (
                current_user.get(
                    "studentClass"
                )
                or user.class_name
                or ""
            ),
        }

    except Exception as error:
        print(
            "HYDRATE CURRENT USER ERROR:",
            error,
        )

        return current_user


def get_user_class_name(user):
    return (
        user.get("className")
        or user.get("class")
        or user.get("lop")
        or user.get("studentClass")
        or ""
    )


def get_user_grade(user):
    return str(
        user.get("grade")
        or user.get("khoi")
        or user.get("gradeLevel")
        or user.get("studentGrade")
        or ""
    ).strip()


def normalize_grade_value(value):
    text = str(
        value or ""
    ).strip()

    digits = "".join(
        char
        for char in text
        if char.isdigit()
    )

    return (
        digits
        or text
    )


def normalize_class_name(value):
    return str(
        value or ""
    ).replace(
        " ",
        "",
    ).strip().lower()


def assert_exam_owner_or_admin(
    current_user,
    exam_data,
):
    if is_admin(
        current_user
    ):
        return

    teacher_id = exam_data.get(
        "teacherId"
    )

    current_uid = current_user.get(
        "uid"
    )

    if (
        teacher_id
        and current_uid
        and str(teacher_id)
        == str(current_uid)
    ):
        return

    raise Exception(
        "Bạn không có quyền chỉnh sửa bài thi này"
    )


def parse_review_datetime(value):
    """
    Parse timestamp cấu hình review.
    Frontend hiện gửi datetime-local / ISO 8601.
    """
    if not value:
        return None

    if hasattr(value, "tzinfo"):
        return value

    try:
        raw = str(value).strip()

        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"

        return datetime.fromisoformat(raw)

    except (TypeError, ValueError):
        return None


def get_student_review_policy(exam):
    """
    Quyết định server-side việc STUDENT có được xem đáp án chuẩn hay không.

    Không dựa vào dữ liệu frontend/JWT role tự gửi trong payload.
    """
    settings = (
        exam.settings
        if exam and isinstance(exam.settings, dict)
        else {}
    )

    enabled = bool(
        settings.get("reviewEnabled", False)
    )

    start_raw = settings.get("reviewStartAt") or ""
    end_raw = settings.get("reviewEndAt") or ""

    policy = {
        "enabled": enabled,
        "allowed": False,
        "status": "disabled",
        "startAt": start_raw or None,
        "endAt": end_raw or None,
    }

    if not enabled:
        return policy

    start_at = parse_review_datetime(start_raw)
    end_at = parse_review_datetime(end_raw)

    # Cấu hình lỗi/thiếu => fail closed.
    if not start_at or not end_at:
        policy["status"] = "invalid"
        return policy

    now = utc_now()

    # Đồng bộ aware/naive datetime để tránh TypeError.
    if getattr(now, "tzinfo", None) is not None:
        if getattr(start_at, "tzinfo", None) is None:
            start_at = start_at.replace(
                tzinfo=now.tzinfo
            )

        if getattr(end_at, "tzinfo", None) is None:
            end_at = end_at.replace(
                tzinfo=now.tzinfo
            )

    elif getattr(start_at, "tzinfo", None) is not None:
        start_at = start_at.replace(
            tzinfo=None
        )
        end_at = end_at.replace(
            tzinfo=None
        )

    if now < start_at:
        policy["status"] = "not_started"
        return policy

    if now > end_at:
        policy["status"] = "expired"
        return policy

    policy["allowed"] = True
    policy["status"] = "available"

    return policy


def sanitize_question_for_student(
    question,
    reveal_answers=False,
):
    """
    STUDENT luôn được nhận nội dung câu hỏi/lựa chọn để làm bài.

    Ngoài review window:
    - bỏ correctAnswer
    - bỏ explanation/solution/answerKey
    - bỏ isCorrect khỏi từng lựa chọn

    Không thay đổi object gốc.
    """
    safe = serialize_doc_data(
        dict(question or {})
    )

    if reveal_answers:
        return safe

    sensitive_keys = (
        "correctAnswer",
        "correctAnswers",
        "answerKey",
        "explanation",
        "solution",
        "teacherNote",
    )

    for key in sensitive_keys:
        safe.pop(key, None)

    answers = safe.get("answers")

    if isinstance(answers, list):
        safe_answers = []

        for answer in answers:
            if isinstance(answer, dict):
                item = dict(answer)
                item.pop("isCorrect", None)
                item.pop("correct", None)
                item.pop("correctAnswer", None)
                item.pop("explanation", None)
                item.pop("solution", None)
                safe_answers.append(item)
            else:
                safe_answers.append(answer)

        safe["answers"] = safe_answers

    return safe


def sanitize_questions_for_student(
    questions,
    reveal_answers=False,
):
    return [
        sanitize_question_for_student(
            question,
            reveal_answers=reveal_answers,
        )
        for question in (questions or [])
    ]


def sanitize_result_for_student(
    result,
    reveal_answers=False,
):
    """
    Giữ bài làm của chính STUDENT:
      answers
      textAnswers
      score
      counts
      proctoring...

    Nhưng ngoài review window không trả answer key/correctness/lời giải.
    """
    if result is None:
        return None

    safe = serialize_doc_data(
        dict(result or {})
    )

    if reveal_answers:
        return safe

    sensitive_top_level = (
        "correctAnswer",
        "correctAnswers",
        "answerKey",
        "explanation",
        "solution",
        "teacherNote",
    )

    for key in sensitive_top_level:
        safe.pop(key, None)

    # wrongQuestions tự nó tiết lộ câu nào sai và đáp án đúng.
    # Ngoài review window không được trả danh sách này.
    safe.pop(
        "wrongQuestions",
        None,
    )

    return safe


def get_question_count(exam_id):
    return db.session.scalar(
        db.select(
            db.func.count(
                ExamQuestion.id
            )
        ).where(
            ExamQuestion.exam_id
            == normalize_id(exam_id)
        )
    ) or 0


def question_to_data(question):
    data = dict(
        question.question_data
        or {}
    )

    data["order"] = (
        question.position
    )

    return {
        "id": (
            question.question_key
            or str(question.id)
        ),
        **serialize_doc_data(
            data
        ),
    }


def get_exam_questions(exam_id):
    questions = db.session.scalars(
        db.select(
            ExamQuestion
        )
        .where(
            ExamQuestion.exam_id
            == normalize_id(exam_id)
        )
        .order_by(
            ExamQuestion.position.asc(),
            ExamQuestion.id.asc(),
        )
    ).all()

    return [
        question_to_data(
            question
        )
        for question in questions
    ]


def result_to_data(result):
    data = dict(
        result.result_data
        or {}
    )

    if (
        "createdAt"
        not in data
    ):
        data["createdAt"] = (
            result.created_at
        )

    if (
        result.submitted_at
        and "submittedAt"
        not in data
    ):
        data["submittedAt"] = (
            result.submitted_at
        )

    return {
        "id": str(result.id),
        **serialize_doc_data(
            data
        ),
    }


def get_exam_results_data(exam_id):
    results = db.session.scalars(
        db.select(
            ExamResult
        )
        .where(
            ExamResult.exam_id
            == normalize_id(exam_id)
        )
        .order_by(
            ExamResult.created_at.desc()
        )
    ).all()

    return [
        result_to_data(result)
        for result in results
    ]


def attempt_to_data(attempt):
    data = dict(
        attempt.attempt_data
        or {}
    )

    data.setdefault(
        "studentId",
        attempt.student_id,
    )

    data.setdefault(
        "updatedAt",
        attempt.updated_at,
    )

    return {
        "id": str(
            attempt.student_id
        ),
        **serialize_doc_data(
            data
        ),
    }


def get_exam_attempt_for_user(
    exam_id,
    user_id,
):
    if not user_id:
        return None

    attempt = db.session.scalar(
        db.select(
            ExamAttempt
        ).where(
            ExamAttempt.exam_id
            == normalize_id(exam_id),
            ExamAttempt.student_id
            == normalize_id(user_id),
        )
    )

    if not attempt:
        return None

    return attempt_to_data(
        attempt
    )



def get_student_attempt_state(
    current_user,
    exam_id,
    exam_data,
):
    """
    Authoritative attempt state for the authenticated student.

    Identity comes from current_user/JWT only.
    Never trusts studentId, attemptCount or role from frontend.
    """
    user_id = normalize_id(
        current_user.get(
            "uid"
        )
    )

    attempt = get_exam_attempt_for_user(
        exam_id,
        user_id,
    )

    attempt_count = int(
        (
            attempt
            or {}
        ).get(
            "count",
            0,
        )
        or 0
    )

    if (
        exam_data.get(
            "attemptMode"
        )
        == "multiple"
    ):
        try:
            max_attempts = max(
                1,
                int(
                    exam_data.get(
                        "maxAttempts",
                        1,
                    )
                    or 1
                ),
            )
        except (
            TypeError,
            ValueError,
        ):
            max_attempts = 1
    else:
        max_attempts = 1

    remaining_attempts = max(
        0,
        max_attempts
        - attempt_count,
    )

    can_attempt = (
        remaining_attempts > 0
    )

    return {
        "attemptCount": attempt_count,
        "maxAttempts": max_attempts,
        "remainingAttempts": (
            remaining_attempts
        ),
        "canAttempt": can_attempt,
        "exhausted": not can_attempt,
    }


def get_latest_result_for_user(
    exam_id,
    user_id,
):
    if not user_id:
        return None

    result = db.session.scalar(
        db.select(
            ExamResult
        )
        .where(
            ExamResult.exam_id
            == normalize_id(exam_id),
            ExamResult.student_id
            == normalize_id(user_id),
        )
        .order_by(
            ExamResult.created_at.desc()
        )
        .limit(1)
    )

    if not result:
        return None

    return result_to_data(
        result
    )


def can_student_view_exam(
    current_user,
    exam_data,
):
    status = str(
        exam_data.get(
            "status",
            "public",
        )
    ).strip().lower()

    selected_classes = (
        exam_data.get(
            "selectedClasses"
        )
        or exam_data.get(
            "targetClasses"
        )
        or []
    )

    selected_grades = (
        exam_data.get(
            "selectedGrades"
        )
        or exam_data.get(
            "targetGrades"
        )
        or []
    )

    student_class = (
        get_user_class_name(
            current_user
        )
    )

    student_grade = (
        get_user_grade(
            current_user
        )
    )

    normalized_student_class = (
        normalize_class_name(
            student_class
        )
    )

    normalized_student_grade = (
        normalize_grade_value(
            student_grade
            or student_class
        )
    )

    normalized_selected_classes = [
        normalize_class_name(
            item
        )
        for item in selected_classes
        if item is not None
    ]

    normalized_selected_grades = [
        normalize_grade_value(
            item
        )
        for item in selected_grades
        if item is not None
    ]

    if status == "public":
        if normalized_selected_grades:
            if (
                normalized_student_grade
                not in
                normalized_selected_grades
            ):
                return False

        if normalized_selected_classes:
            return (
                normalized_student_class
                in normalized_selected_classes
            )

        return True

    if normalized_selected_classes:
        return (
            normalized_student_class
            in normalized_selected_classes
        )

    return False


def get_default_scoring():
    return {
        "part1": {
            "perQuestion": 0,
        },
        "part2": {
            "oneCorrect": 0,
            "twoCorrect": 0,
            "threeCorrect": 0,
            "fourCorrect": 0,
        },
        "part3": {
            "perQuestion": 0,
        },
    }


def build_exam_summary(
    current_user,
    exam_id,
    exam_data,
):
    role = current_user.get(
        "role"
    )

    user_id = current_user.get(
        "uid"
    )

    summary = {
        "id": str(exam_id),
        **exam_data,
        "questionCount": (
            int(
                exam_data.get(
                    "questionCount",
                    0,
                )
                or 0
            )
            or get_question_count(
                exam_id
            )
        ),
        "totalScore": exam_data.get(
            "totalScore",
            0,
        ),
        "scoring": exam_data.get(
            "scoring",
            get_default_scoring(),
        ),
        "studentResultCount": (
            exam_data.get(
                "studentResultCount",
                0,
            )
        ),
        "questions": [],
        "studentResults": [],
        "attempts": [],
    }

    if role == "STUDENT":
        latest_result = (
            get_latest_result_for_user(
                exam_id,
                user_id,
            )
        )

        attempt = (
            get_exam_attempt_for_user(
                exam_id,
                user_id,
            )
        )

        if latest_result:
            summary[
                "studentResults"
            ] = [
                latest_result
            ]

        if attempt:
            summary[
                "attempts"
            ] = [
                attempt
            ]

        attempt_state = (
            get_student_attempt_state(
                current_user,
                exam_id,
                exam_data,
            )
        )

        summary[
            "attemptState"
        ] = attempt_state

        summary[
            "attemptCount"
        ] = attempt_state[
            "attemptCount"
        ]

        summary[
            "maxAttempts"
        ] = attempt_state[
            "maxAttempts"
        ]

        summary[
            "remainingAttempts"
        ] = attempt_state[
            "remainingAttempts"
        ]

        summary[
            "canAttempt"
        ] = attempt_state[
            "canAttempt"
        ]

    return summary



def get_public_exams():
    """
    Danh sách đề công khai dành cho người chưa đăng nhập.

    Chỉ trả metadata cần thiết cho trang Home.
    Không trả questions, answers, results, attempts hoặc dữ liệu riêng tư.
    """

    exam_models = db.session.scalars(
        db.select(
            Exam
        ).where(
            db.func.lower(
                db.func.coalesce(
                    Exam.status,
                    "",
                )
            ) == "public"
        ).order_by(
            Exam.created_at.desc()
        )
    ).all()

    exams = []

    for exam in exam_models:
        exam_data = exam_to_data(
            exam
        )

        # Đề gắn với lớp cụ thể không được xem là public
        # đối với khách chưa xác thực.
        selected_classes = (
            exam_data.get(
                "selectedClasses"
            )
            or []
        )

        if selected_classes:
            continue

        metadata = dict(
            exam.metadata_json
            or {}
        )

        question_count = int(
            metadata.get(
                "questionCount",
                0,
            )
            or 0
        )

        if question_count <= 0:
            question_count = (
                get_question_count(
                    exam.id
                )
            )

        attempt_count = int(
            exam.student_result_count
            or 0
        )

        exams.append({
            "id": str(exam.id),
            "title": exam.title,
            "description": exam.description,
            "subject": exam.subject,
            "duration": exam.duration,
            "status": "public",
            "visibility": exam.visibility,
            "selectedGrades": (
                exam.selected_grades
                or []
            ),
            "questionCount": question_count,
            "attemptCount": attempt_count,
            "createdAt": serialize_doc_data(
                {
                    "value": exam.created_at
                }
            ).get("value"),
            "updatedAt": serialize_doc_data(
                {
                    "value": exam.updated_at
                }
            ).get("value"),
        })

    return {
        "success": True,
        "exams": exams,
    }


def get_exams(current_user):
    current_user = (
        hydrate_current_user(
            current_user
        )
    )

    role = current_user.get(
        "role"
    )

    exam_models = db.session.scalars(
        db.select(
            Exam
        ).order_by(
            Exam.created_at.desc()
        )
    ).all()

    exams = []

    for exam in exam_models:
        exam_id = exam.id
        exam_data = exam_to_data(
            exam
        )

        if (
            role == "STUDENT"
            and not can_student_view_exam(
                current_user,
                exam_data,
            )
        ):
            continue

        exams.append(
            build_exam_summary(
                current_user,
                exam_id,
                exam_data,
            )
        )

    exams.sort(
        key=lambda item: (
            item.get(
                "createdAt"
            )
            or ""
        ),
        reverse=True,
    )

    return {
        "success": True,
        "exams": exams,
    }


def get_my_statistics(current_user):
    """
    Thống kê tiến độ thi của STUDENT hiện tại.

    SECURITY:
    - identity lấy từ JWT đã xác thực
    - không nhận studentId/userId từ query/body
    - chỉ đọc ExamResult của chính JWT user

    PRODUCT CONTRACT:
    - lịch sử đã nộp không biến mất khi giáo viên
      thay đổi visibility/status/khối/lớp của đề
    - mỗi đề chỉ dùng kết quả mới nhất
    - pending chỉ gồm các đề hiện tại student
      còn được phép tham gia và chưa hoàn thành
    - totalExams là hợp của:
        + các đề đã từng hoàn thành
        + các đề hiện tại còn visible
    """
    current_user = hydrate_current_user(
        current_user
    )

    if not is_student(current_user):
        raise Exception(
            "Chỉ học sinh mới được xem tiến độ cá nhân"
        )

    student_id = normalize_id(
        current_user.get("uid")
    )

    if not student_id:
        raise Exception(
            "Không xác định được tài khoản học sinh"
        )

    # -------------------------------------------------
    # 1. Load all exams once.
    # -------------------------------------------------

    exam_models = db.session.scalars(
        db.select(Exam).order_by(
            Exam.created_at.desc()
        )
    ).all()

    exam_models_by_id = {
        exam.id: exam
        for exam in exam_models
    }

    exam_data_by_id = {
        exam.id: exam_to_data(exam)
        for exam in exam_models
    }

    # -------------------------------------------------
    # 2. Current visible exams.
    #
    # Visibility is only used to determine what the
    # student can currently participate in.
    # It must NOT erase historical submissions.
    # -------------------------------------------------

    visible_exam_ids = set()

    for exam in exam_models:
        exam_data = exam_data_by_id[
            exam.id
        ]

        if can_student_view_exam(
            current_user,
            exam_data,
        ):
            visible_exam_ids.add(
                exam.id
            )

    # -------------------------------------------------
    # 3. Historical results.
    #
    # SECURITY:
    # Query is always scoped to JWT student_id.
    # Do not filter by current exam visibility.
    # -------------------------------------------------

    result_models = db.session.scalars(
        db.select(ExamResult)
        .where(
            ExamResult.student_id
            == student_id
        )
        .order_by(
            ExamResult.created_at.desc()
        )
    ).all()

    # One exam may have multiple attempts.
    # Because results are DESC, the first result for
    # each exam is the latest one.
    latest_by_exam = {}

    for result in result_models:
        if (
            result.exam_id
            not in latest_by_exam
        ):
            latest_by_exam[
                result.exam_id
            ] = result

    completed_exam_ids = set(
        latest_by_exam.keys()
    )

    # -------------------------------------------------
    # 4. Aggregate counters.
    # -------------------------------------------------

    all_progress_exam_ids = (
        visible_exam_ids
        | completed_exam_ids
    )

    total_exams = len(
        all_progress_exam_ids
    )

    completed_count = len(
        completed_exam_ids
    )

    pending_exam_ids = (
        visible_exam_ids
        - completed_exam_ids
    )

    pending_count = len(
        pending_exam_ids
    )

    # -------------------------------------------------
    # 5. Score average from latest historical result
    #    of each completed exam.
    # -------------------------------------------------

    scores = []

    for result in latest_by_exam.values():
        result_data = (
            result.result_data
            if isinstance(
                result.result_data,
                dict,
            )
            else {}
        )

        try:
            score = float(
                result_data.get(
                    "score",
                    0,
                )
                or 0
            )
        except (
            TypeError,
            ValueError,
        ):
            score = 0.0

        scores.append(
            score
        )

    average_score = (
        round(
            sum(scores)
            / len(scores),
            2,
        )
        if scores
        else 0.0
    )

    completion_rate = (
        round(
            (
                completed_count
                / total_exams
            )
            * 100,
            1,
        )
        if total_exams
        else 0.0
    )

    # -------------------------------------------------
    # 6. Build historical result cards.
    # -------------------------------------------------

    history = []

    for result in latest_by_exam.values():
        exam = exam_models_by_id.get(
            result.exam_id
        )

        exam_data = (
            exam_data_by_id.get(
                result.exam_id,
                {},
            )
        )

        result_data = (
            result.result_data
            if isinstance(
                result.result_data,
                dict,
            )
            else {}
        )

        history.append({
            "resultId": str(
                result.id
            ),
            "examId": str(
                result.exam_id
            ),

            "title": (
                exam_data.get(
                    "title"
                )
                or result_data.get(
                    "examTitle"
                )
                or (
                    exam.title
                    if exam
                    else None
                )
                or "Bài thi"
            ),

            "subject": (
                exam_data.get(
                    "subject"
                )
                or result_data.get(
                    "subject"
                )
                or ""
            ),

            "score": (
                result_data.get(
                    "score",
                    0,
                )
            ),

            "totalScore": (
                exam_data.get(
                    "totalScore",
                    10,
                )
                or 10
            ),

            "answeredCount": (
                result_data.get(
                    "answeredCount",
                    0,
                )
            ),

            "correctCount": (
                result_data.get(
                    "correctCount",
                    0,
                )
            ),

            "wrongCount": (
                result_data.get(
                    "wrongCount",
                    0,
                )
            ),

            "unansweredCount": (
                result_data.get(
                    "unansweredCount",
                    0,
                )
            ),

            "submittedAt": (
                result_data.get(
                    "submittedAt"
                )
                or result.submitted_at
                or result.created_at
            ),
        })

    # serialize_doc_data expects a dict, not a list.
    history = [
        serialize_doc_data(
            item
        )
        for item in history
    ]

    return {
        "success": True,
        "statistics": {
            "totalExams": total_exams,
            "completed": completed_count,
            "pending": pending_count,
            "averageScore": average_score,
            "completionRate": completion_rate,
            "history": history,
        },
    }


def get_exam_detail(
    current_user,
    exam_id,
):
    current_user = (
        hydrate_current_user(
            current_user
        )
    )

    exam = get_exam_model(
        exam_id
    )

    if not exam:
        raise Exception(
            "Không tìm thấy bài thi"
        )

    exam_data = exam_to_data(
        exam
    )

    if (
        is_student(
            current_user
        )
        and not can_student_view_exam(
            current_user,
            exam_data,
        )
    ):
        raise Exception(
            "Bạn không có quyền xem bài thi này"
        )

    questions = get_exam_questions(
        exam_id
    )

    review = None
    attempt_state = None

    if is_student(current_user):
        attempt_state = (
            get_student_attempt_state(
                current_user,
                exam.id,
                exam_data,
            )
        )

        review = get_student_review_policy(
            exam
        )

        student_result = (
            get_latest_result_for_user(
                exam_id,
                current_user.get(
                    "uid"
                ),
            )
        )

        has_submitted = (
            student_result is not None
        )

        review = {
            **review,
            "submitted": has_submitted,
        }

        # SECURITY:
        # Dù review window đang mở, học sinh chưa nộp bài
        # tuyệt đối không được nhận answer key.
        if (
            review["allowed"]
            and not has_submitted
        ):
            review["allowed"] = False
            review["status"] = (
                "not_submitted"
            )

        # SECURITY:
        # Học sinh đã dùng hết lượt không được nhận nội dung
        # câu hỏi qua deep-link/API detail.
        #
        # Vẫn trả metadata + attemptState để frontend hiển thị
        # trạng thái "Phòng thi đã khóa".
        if not attempt_state[
            "canAttempt"
        ]:
            questions = []
        else:
            questions = (
                sanitize_questions_for_student(
                    questions,
                    reveal_answers=review[
                        "allowed"
                    ],
                )
            )

    response = {
        "success": True,
        "exam": {
            "id": str(
                exam.id
            ),
            **exam_data,
            "questionCount": len(
                questions
            ),
            "questions": questions,
            "scoring": exam_data.get(
                "scoring",
                get_default_scoring(),
            ),
            **(
                {
                    "attemptState": (
                        attempt_state
                    ),
                    "attemptCount": (
                        attempt_state[
                            "attemptCount"
                        ]
                    ),
                    "maxAttempts": (
                        attempt_state[
                            "maxAttempts"
                        ]
                    ),
                    "remainingAttempts": (
                        attempt_state[
                            "remainingAttempts"
                        ]
                    ),
                    "canAttempt": (
                        attempt_state[
                            "canAttempt"
                        ]
                    ),
                }
                if attempt_state
                is not None
                else {}
            ),
        },
    }

    if review is not None:
        response["review"] = review

    return response


def split_exam_payload(payload):
    payload = dict(
        payload or {}
    )

    known = {
        "title",
        "description",
        "subject",
        "duration",
        "status",
        "visibility",
        "selectedGrades",
        "selectedClasses",
        "settings",
    }

    metadata = {
        key: value
        for key, value
        in payload.items()
        if key not in known
    }

    return payload, metadata


def apply_exam_payload(
    exam,
    payload,
):
    payload, metadata = (
        split_exam_payload(
            payload
        )
    )

    if "title" in payload:
        exam.title = str(
            payload.get("title")
            or ""
        )

    if "description" in payload:
        exam.description = (
            payload.get(
                "description"
            )
        )

    if "subject" in payload:
        exam.subject = (
            payload.get(
                "subject"
            )
        )

    if "duration" in payload:
        exam.duration = (
            payload.get(
                "duration"
            )
        )

    if "status" in payload:
        exam.status = (
            payload.get(
                "status"
            )
        )

    if "visibility" in payload:
        exam.visibility = (
            payload.get(
                "visibility"
            )
        )

    if "selectedGrades" in payload:
        exam.selected_grades = (
            payload.get(
                "selectedGrades"
            )
            or []
        )

    if "selectedClasses" in payload:
        exam.selected_classes = (
            payload.get(
                "selectedClasses"
            )
            or []
        )

    if "settings" in payload:
        exam.settings = (
            payload.get(
                "settings"
            )
            or {}
        )

    current_metadata = dict(
        exam.metadata_json
        or {}
    )

    current_metadata.update(
        metadata
    )

    exam.metadata_json = (
        current_metadata
    )

    exam.updated_at = utc_now()


def create_exam(
    current_user,
    payload,
):
    if not is_teacher_or_admin(
        current_user
    ):
        raise Exception(
            "Bạn không có quyền tạo bài thi"
        )

    payload = dict(
        payload or {}
    )

    questions = payload.pop(
        "questions",
        [],
    )

    scoring = payload.get(
        "scoring",
        get_default_scoring(),
    )

    payload["proctoring"] = (
        normalize_proctoring_config(
            payload
        )
    )

    payload[
        "maxFullscreenViolations"
    ] = payload[
        "proctoring"
    ]["maxViolations"]

    payload["scoring"] = scoring
    payload["questionCount"] = len(
        questions
    )

    payload[
        "studentResultCount"
    ] = 0

    payload["teacherId"] = (
        current_user.get(
            "uid"
        )
    )

    payload["teacherEmail"] = (
        current_user.get(
            "email"
        )
    )

    payload["teacherName"] = (
        current_user.get("name")
        or current_user.get(
            "displayName"
        )
        or current_user.get(
            "fullName"
        )
        or current_user.get(
            "email"
        )
    )

    now = utc_now()

    # JSON/JSONB chỉ lưu giá trị JSON-serializable.
    # Giữ `now` dạng datetime cho các cột DateTime của Exam,
    # còn timestamp nằm trong metadata/payload dùng ISO 8601.
    payload["createdAt"] = now.isoformat()
    payload["updatedAt"] = now.isoformat()

    exam = Exam(
        teacher_id=normalize_id(
            current_user.get(
                "uid"
            )
        ),
        title=str(
            payload.get(
                "title",
                "",
            )
        ),
        description=payload.get(
            "description"
        ),
        subject=payload.get(
            "subject"
        ),
        duration=payload.get(
            "duration"
        ),
        status=payload.get(
            "status"
        ),
        visibility=payload.get(
            "visibility"
        ),
        selected_grades=(
            payload.get(
                "selectedGrades"
            )
            or []
        ),
        selected_classes=(
            payload.get(
                "selectedClasses"
            )
            or []
        ),
        settings=(
            payload.get(
                "settings"
            )
            or {}
        ),
        student_result_count=0,
        created_at=now,
        updated_at=now,
    )

    _, metadata = (
        split_exam_payload(
            payload
        )
    )

    exam.metadata_json = metadata

    try:
        db.session.add(
            exam
        )

        db.session.flush()

        for index, question in enumerate(
            questions
        ):
            question_data = {
                **question,
                "order": index,
                "updatedAt": now.isoformat(),
            }

            question_key = (
                question.get(
                    "id"
                )
            )

            db.session.add(
                ExamQuestion(
                    exam_id=exam.id,
                    question_key=(
                        str(
                            question_key
                        )
                        if question_key
                        else None
                    ),
                    position=index,
                    question_data=(
                        question_data
                    ),
                )
            )

        db.session.commit()

    except Exception:
        db.session.rollback()
        raise

    return {
        "success": True,
        "message": "Đã tạo bài thi",
        "examId": str(
            exam.id
        ),
    }


def update_exam(
    current_user,
    exam_id,
    payload,
):
    if not is_teacher_or_admin(
        current_user
    ):
        raise Exception(
            "Bạn không có quyền cập nhật bài thi"
        )

    exam = get_exam_model(
        exam_id
    )

    if not exam:
        raise Exception(
            "Không tìm thấy bài thi"
        )

    exam_data = exam_to_data(
        exam
    )

    assert_exam_owner_or_admin(
        current_user,
        exam_data,
    )

    payload = dict(
        payload or {}
    )

    questions = payload.pop(
        "questions",
        None,
    )

    if (
        "proctoring" in payload
        or "maxFullscreenViolations"
        in payload
    ):
        payload["proctoring"] = (
            normalize_proctoring_config(
                payload
            )
        )

        payload[
            "maxFullscreenViolations"
        ] = payload[
            "proctoring"
        ]["maxViolations"]

    if questions is not None:
        payload[
            "questionCount"
        ] = len(
            questions
        )

    try:
        apply_exam_payload(
            exam,
            payload,
        )

        if questions is not None:
            db.session.execute(
                db.delete(
                    ExamQuestion
                ).where(
                    ExamQuestion.exam_id
                    == exam.id
                )
            )

            now = utc_now()

            for index, question in enumerate(
                questions
            ):
                question_data = {
                    **question,
                    "order": index,
                    "updatedAt": now.isoformat(),
                }

                question_key = (
                    question.get(
                        "id"
                    )
                )

                db.session.add(
                    ExamQuestion(
                        exam_id=exam.id,
                        question_key=(
                            str(
                                question_key
                            )
                            if question_key
                            else None
                        ),
                        position=index,
                        question_data=(
                            question_data
                        ),
                    )
                )

        db.session.commit()

    except Exception:
        db.session.rollback()
        raise

    return {
        "success": True,
        "message": "Đã cập nhật bài thi",
        "examId": str(
            exam.id
        ),
    }


def delete_exam(
    current_user,
    exam_id,
):
    if not is_teacher_or_admin(
        current_user
    ):
        raise Exception(
            "Bạn không có quyền xóa bài thi"
        )

    exam = get_exam_model(
        exam_id
    )

    if not exam:
        raise Exception(
            "Không tìm thấy bài thi"
        )

    exam_data = exam_to_data(
        exam
    )

    assert_exam_owner_or_admin(
        current_user,
        exam_data,
    )

    try:
        db.session.delete(
            exam
        )

        db.session.commit()

    except Exception:
        db.session.rollback()
        raise

    return {
        "success": True,
        "message": "Đã xóa bài thi",
        "examId": str(
            exam_id
        ),
    }


def get_proctoring_session(
    exam_id,
    student_id,
    session_key,
):
    return db.session.scalar(
        db.select(
            ProctoringSession
        ).where(
            ProctoringSession.exam_id
            == normalize_id(exam_id),
            ProctoringSession.student_id
            == normalize_id(student_id),
            ProctoringSession.session_key
            == session_key,
        )
    )


def log_proctoring_event(
    current_user,
    exam_id,
    payload,
):
    current_user = (
        hydrate_current_user(
            current_user
        )
    )

    if not is_student(
        current_user
    ):
        raise Exception(
            "Chỉ học sinh mới gửi được sự kiện giám sát"
        )

    exam = get_exam_model(
        exam_id
    )

    if not exam:
        raise Exception(
            "Không tìm thấy bài thi"
        )

    exam_data = exam_to_data(
        exam
    )

    if not can_student_view_exam(
        current_user,
        exam_data,
    ):
        raise Exception(
            "Bạn không có quyền làm bài thi này"
        )

    config = (
        normalize_proctoring_config(
            exam_data
        )
    )

    if not config["enabled"]:
        raise Exception(
            "Đề thi này không bật giám sát"
        )

    session_id = re.sub(
        r"[^a-zA-Z0-9_-]",
        "",
        str(
            payload.get(
                "sessionId",
                "",
            )
        ),
    )[:80]

    if not session_id:
        raise Exception(
            "Thiếu mã phiên giám sát"
        )

    event = sanitize_proctoring_event(
        payload.get(
            "event"
        )
    )

    restrict_evidence_paths(
        [event],
        exam_id,
        current_user.get(
            "uid"
        ),
        session_id,
    )

    student_id = normalize_id(
        current_user.get(
            "uid"
        )
    )

    session = (
        get_proctoring_session(
            exam.id,
            student_id,
            session_id,
        )
    )

    now = utc_now()

    try:
        if not session:
            session = (
                ProctoringSession(
                    exam_id=exam.id,
                    student_id=student_id,
                    session_key=session_id,
                    status="active",
                    violation_count=0,
                    session_data={},
                    created_at=now,
                    updated_at=now,
                )
            )

            db.session.add(
                session
            )

            db.session.flush()

        session.status = "active"
        session.updated_at = now

        session_data = dict(
            session.session_data
            or {}
        )

        session_data.update({
            "sessionId": session_id,
            "studentId": (
                current_user.get(
                    "uid"
                )
            ),
            "studentEmail": (
                current_user.get(
                    "email"
                )
            ),
            "studentName": (
                current_user.get(
                    "name"
                )
                or current_user.get(
                    "fullName"
                )
            ),
            "status": "active",
            "config": config,
            "lastSeenAt": now.isoformat(),
            "updatedAt": now.isoformat(),
        })

        session.session_data = (
            session_data
        )

        event_id = event.get(
            "id"
        )

        existing_event = None

        if event_id:
            existing_event = (
                db.session.scalar(
                    db.select(
                        ProctoringEvent
                    ).where(
                        ProctoringEvent.session_id
                        == session.id,
                        ProctoringEvent.event_data[
                            "id"
                        ].as_string()
                        == event_id,
                    )
                )
            )

        evidence_update = any(
            key
            in event.get(
                "metadata",
                {},
            )
            for key in (
                "evidenceCameraPath",
                "evidenceScreenPath",
            )
        )

        event_already_exists = (
            evidence_update
            and existing_event
            is not None
        )

        if existing_event:
            event_model = (
                existing_event
            )
        else:
            event_model = (
                ProctoringEvent(
                    session_id=session.id,
                    event_type=event[
                        "type"
                    ],
                    event_data={},
                    server_at=now,
                )
            )

            db.session.add(
                event_model
            )

            db.session.flush()

        final_event_id = (
            event_id
            or str(
                event_model.id
            )
        )

        event_data = {
            **event,
            "id": final_event_id,
            "serverAt": now,
        }

        event_model.event_type = (
            event["type"]
        )

        event_model.event_data = (
            event_data
        )

        event_model.server_at = now

        if (
            event["severity"]
            == "violation"
            and not event_already_exists
        ):
            session.violation_count = (
                session.violation_count
                or 0
            ) + 1

        db.session.commit()

    except Exception:
        db.session.rollback()
        raise

    return {
        "success": True,
        "eventId": final_event_id,
    }


def submit_exam(
    current_user,
    exam_id,
    payload,
):
    current_user = (
        hydrate_current_user(
            current_user
        )
    )

    if not is_student(
        current_user
    ):
        raise Exception(
            "Chỉ học sinh mới được nộp bài thi"
        )

    exam = get_exam_model(
        exam_id
    )

    if not exam:
        raise Exception(
            "Không tìm thấy bài thi"
        )

    exam_data = exam_to_data(
        exam
    )

    if not can_student_view_exam(
        current_user,
        exam_data,
    ):
        raise Exception(
            "Bạn không có quyền làm bài thi này"
        )

    answers = payload.get(
        "answers",
        {},
    )

    text_answers = payload.get(
        "textAnswers",
        {},
    )

    fullscreen_violations = int(
        payload.get(
            "fullscreenViolations",
            0,
        )
        or 0
    )

    proctoring_report = (
        sanitize_proctoring_report(
            payload.get(
                "proctoringReport"
            )
        )
    )

    restrict_evidence_paths(
        proctoring_report[
            "events"
        ],
        exam_id,
        current_user.get(
            "uid"
        ),
        proctoring_report[
            "sessionId"
        ],
    )

    questions = get_exam_questions(
        exam_id
    )

    scoring = exam_data.get(
        "scoring",
        get_default_scoring(),
    )

    student_id = normalize_id(
        current_user.get(
            "uid"
        )
    )

    attempt = db.session.scalar(
        db.select(
            ExamAttempt
        ).where(
            ExamAttempt.exam_id
            == exam.id,
            ExamAttempt.student_id
            == student_id,
        )
    )

    attempt_state = (
        get_student_attempt_state(
            current_user,
            exam.id,
            exam_data,
        )
    )

    attempt_count = (
        attempt_state[
            "attemptCount"
        ]
    )

    if not attempt_state[
        "canAttempt"
    ]:
        raise Exception(
            "Bạn đã hết số lượt làm bài thi này"
        )

    score_data = (
        calculate_exam_score(
            questions=questions,
            answers=answers,
            text_answers=(
                text_answers
            ),
            scoring=scoring,
        )
    )

    now = utc_now()

    result_data = {
        "studentId": (
            current_user.get(
                "uid"
            )
        ),
        "studentEmail": (
            current_user.get(
                "email"
            )
        ),
        "studentName": (
            current_user.get(
                "name"
            )
        ),
        "role": (
            current_user.get(
                "role"
            )
        ),
        "answers": answers,
        "textAnswers": (
            text_answers
        ),
        "fullscreenViolations": (
            fullscreen_violations
        ),
        "proctoringViolations": (
            proctoring_report[
                "totalViolations"
            ]
        ),
        "proctoringReport": (
            proctoring_report
        ),
        "scoring": scoring,
        **score_data,
        "createdAt": now.isoformat(),
    }

    try:
        result = ExamResult(
            exam_id=exam.id,
            student_id=student_id,
            result_data=result_data,
            submitted_at=now,
            created_at=now,
            updated_at=now,
        )

        db.session.add(
            result
        )

        db.session.flush()

        session_id = (
            proctoring_report[
                "sessionId"
            ]
        )

        if session_id:
            session = (
                get_proctoring_session(
                    exam.id,
                    student_id,
                    session_id,
                )
            )

            if not session:
                session = (
                    ProctoringSession(
                        exam_id=exam.id,
                        student_id=student_id,
                        session_key=(
                            session_id
                        ),
                        status=(
                            "submitted"
                        ),
                        violation_count=(
                            proctoring_report[
                                "totalViolations"
                            ]
                        ),
                        session_data={},
                        created_at=now,
                        updated_at=now,
                    )
                )

                db.session.add(
                    session
                )

            session.status = (
                "submitted"
            )

            session.violation_count = (
                proctoring_report[
                    "totalViolations"
                ]
            )

            session.updated_at = now

            session_data = dict(
                session.session_data
                or {}
            )

            session_data.update({
                "status": "submitted",
                "resultId": str(
                    result.id
                ),
                "submittedAt": now.isoformat(),
                "violationCount": (
                    proctoring_report[
                        "totalViolations"
                    ]
                ),
            })

            session.session_data = (
                session_data
            )

        if not attempt:
            attempt = ExamAttempt(
                exam_id=exam.id,
                student_id=student_id,
                attempt_data={},
                created_at=now,
                updated_at=now,
            )

            db.session.add(
                attempt
            )

        attempt.attempt_data = {
            "studentId": (
                current_user.get(
                    "uid"
                )
            ),
            "count": (
                attempt_count
                + 1
            ),
            "updatedAt": now.isoformat(),
        }

        attempt.updated_at = now

        exam.student_result_count = (
            exam.student_result_count
            or 0
        ) + 1

        exam_metadata = dict(
            exam.metadata_json
            or {}
        )

        exam_metadata[
            "studentResultCount"
        ] = (
            exam.student_result_count
        )

        exam_metadata[
            "questionCount"
        ] = len(
            questions
        )

        exam.metadata_json = (
            exam_metadata
        )

        exam.updated_at = now

        db.session.commit()

    except Exception:
        db.session.rollback()
        raise

    review = get_student_review_policy(
        exam
    )

    response_result = {
        "id": str(
            result.id
        ),
        **serialize_doc_data(
            result_data
        ),
        "createdAt": None,
    }

    response_result = (
        sanitize_result_for_student(
            response_result,
            reveal_answers=review[
                "allowed"
            ],
        )
    )

    return {
        "success": True,
        "message": "Đã nộp bài thi",
        "resultId": str(
            result.id
        ),
        "result": response_result,
        "review": review,
    }


def get_my_result(
    current_user,
    exam_id,
):
    exam = get_exam_model(
        exam_id
    )

    if not exam:
        raise Exception(
            "Không tìm thấy bài thi"
        )

    result = (
        get_latest_result_for_user(
            exam_id,
            current_user.get(
                "uid"
            ),
        )
    )

    review = get_student_review_policy(
        exam
    )

    has_submitted = result is not None

    review = {
        **review,
        "submitted": has_submitted,
    }

    if (
        review["allowed"]
        and not has_submitted
    ):
        review["allowed"] = False
        review["status"] = (
            "not_submitted"
        )

    result = sanitize_result_for_student(
        result,
        reveal_answers=(
            review["allowed"]
            and has_submitted
        ),
    )

    return {
        "success": True,
        "result": result,
        "review": review,
    }


def get_exam_results(
    current_user,
    exam_id,
):
    if not is_teacher_or_admin(
        current_user
    ):
        raise Exception(
            "Bạn không có quyền xem kết quả bài thi"
        )

    exam = get_exam_model(
        exam_id
    )

    if not exam:
        raise Exception(
            "Không tìm thấy bài thi"
        )

    exam_data = exam_to_data(
        exam
    )

    assert_exam_owner_or_admin(
        current_user,
        exam_data,
    )

    results = get_exam_results_data(
        exam_id
    )

    return {
        "success": True,
        "results": results,
    }
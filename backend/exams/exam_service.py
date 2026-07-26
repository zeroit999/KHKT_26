import re

from firebase_admin import firestore

from exams.exam_scoring import calculate_exam_score

db = firestore.client()


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


def normalize_proctoring_config(exam_data):
    source = exam_data.get("proctoring") or {}
    legacy_limit = exam_data.get("maxFullscreenViolations", 2)

    def flag(name, default):
        value = source.get(name)
        return default if value is None else bool(value)

    try:
        max_violations = int(source.get("maxViolations", legacy_limit) or 2)
    except (TypeError, ValueError):
        max_violations = 2

    try:
        heartbeat_seconds = int(source.get("heartbeatSeconds", 30) or 30)
    except (TypeError, ValueError):
        heartbeat_seconds = 30

    return {
        "enabled": flag("enabled", True),
        "requireFullscreen": flag("requireFullscreen", True),
        "detectTabSwitch": flag("detectTabSwitch", False),
        "detectWindowBlur": flag("detectWindowBlur", False),
        "blockClipboard": flag("blockClipboard", False),
        "blockContextMenu": flag("blockContextMenu", False),
        "blockShortcuts": flag("blockShortcuts", True),
        "requireCamera": flag("requireCamera", False),
        "requireMicrophone": flag("requireMicrophone", False),
        "detectVoiceActivity": (
            flag("detectVoiceActivity", False)
            and flag("requireMicrophone", False)
        ),
        "requireScreenShare": flag("requireScreenShare", False),
        "requireEntireScreen": flag("requireEntireScreen", False),
        "captureCameraEvidence": (
            flag("captureCameraEvidence", False)
            and flag("requireCamera", False)
        ),
        "captureScreenEvidence": (
            flag("captureScreenEvidence", False)
            and flag("requireScreenShare", False)
        ),
        "autoSubmit": flag("autoSubmit", True),
        "maxViolations": max(1, min(max_violations, 20)),
        "heartbeatSeconds": max(15, min(heartbeat_seconds, 120)),
    }


def sanitize_proctoring_event(event):
    event = event if isinstance(event, dict) else {}
    event_type = str(event.get("type", ""))[:50]
    if event_type not in PROCTORING_EVENT_TYPES:
        raise Exception("Loại sự kiện giám sát không hợp lệ")

    metadata = event.get("metadata", {})
    if not isinstance(metadata, dict):
        metadata = {}

    safe_metadata = {}
    for key, value in list(metadata.items())[:12]:
        safe_key = re.sub(r"[^a-zA-Z0-9_-]", "", str(key))[:40]
        if not safe_key:
            continue
        if isinstance(value, (bool, int, float)) or value is None:
            safe_metadata[safe_key] = value
        else:
            safe_metadata[safe_key] = str(value)[:320]

    return {
        "id": re.sub(r"[^a-zA-Z0-9_-]", "", str(event.get("id", "")))[:80],
        "type": event_type,
        "severity": "violation" if event.get("severity") == "violation" else "info",
        "message": str(event.get("message", ""))[:300],
        "clientAt": str(event.get("at", ""))[:80],
        "metadata": safe_metadata,
    }


def sanitize_proctoring_report(report):
    report = report if isinstance(report, dict) else {}
    events = []
    raw_events = report.get("events", [])
    if not isinstance(raw_events, list):
        raw_events = []
    for event in raw_events[:250]:
        try:
            events.append(sanitize_proctoring_event(event))
        except Exception:
            continue

    counts = report.get("counts", {})
    if not isinstance(counts, dict):
        counts = {}

    safe_counts = {}
    for key, value in list(counts.items())[:20]:
        safe_key = re.sub(r"[^a-zA-Z0-9_-]", "", str(key))[:40]
        try:
            safe_counts[safe_key] = max(0, int(value))
        except (TypeError, ValueError):
            continue

    session_id = re.sub(
        r"[^a-zA-Z0-9_-]",
        "",
        str(report.get("sessionId", "")),
    )[:80]

    return {
        "sessionId": session_id,
        "events": events,
        "counts": safe_counts,
        "totalViolations": sum(
            1 for event in events if event.get("severity") == "violation"
        ),
        "cameraRequired": bool(report.get("cameraRequired")),
        "microphoneRequired": bool(report.get("microphoneRequired")),
        "screenRequired": bool(report.get("screenRequired")),
        "cameraActiveAtSubmit": bool(report.get("cameraActiveAtSubmit")),
        "microphoneActiveAtSubmit": bool(report.get("microphoneActiveAtSubmit")),
        "screenActiveAtSubmit": bool(report.get("screenActiveAtSubmit")),
        "startedAt": str(report.get("startedAt", ""))[:80],
        "submittedAt": str(report.get("submittedAt", ""))[:80],
    }


def restrict_evidence_paths(events, exam_id, student_id, session_id):
    expected_prefix = (
        f"exam-proctoring/{exam_id}/{student_id}/{session_id}/"
        if exam_id and student_id and session_id
        else ""
    )
    for event in events:
        metadata = event.get("metadata", {})
        for key in ("evidenceCameraPath", "evidenceScreenPath"):
            path = str(metadata.get(key, ""))
            if path and (not expected_prefix or not path.startswith(expected_prefix)):
                metadata.pop(key, None)
    return events


def normalize_role(user):
    return str(user.get("role", "")).strip().upper()


def is_teacher_or_admin(user):
    role = normalize_role(user)
    return role in ["TEACHER", "ADMIN", "ADMIN_DEV", "ADMIN USER"]


def is_admin(user):
    role = normalize_role(user)
    return role in ["ADMIN", "ADMIN_DEV", "ADMIN USER"]


def is_student(user):
    role = normalize_role(user)
    return role == "STUDENT"


def serialize_firestore_value(value):
    if hasattr(value, "isoformat"):
        return value.isoformat()

    return value


def serialize_doc_data(data):
    result = {}

    for key, value in (data or {}).items():
        if isinstance(value, dict):
            result[key] = serialize_doc_data(value)
        elif isinstance(value, list):
            result[key] = [
                serialize_doc_data(item)
                if isinstance(item, dict)
                else serialize_firestore_value(item)
                for item in value
            ]
        else:
            result[key] = serialize_firestore_value(value)

    return result


def hydrate_current_user(current_user):
    """
    request.current_user lấy từ Firebase token chỉ có uid/email/name/role.
    Học sinh cần thêm grade/className từ Firestore users/{uid}
    để backend lọc đề công khai theo khối/lớp.
    """

    uid = current_user.get("uid")

    if not uid:
        return current_user

    try:
        user_doc = db.collection("users").document(uid).get()

        if not user_doc.exists:
            return current_user

        user_data = serialize_doc_data(user_doc.to_dict() or {})

        return {
            **user_data,
            **current_user,
            "grade": current_user.get("grade") or user_data.get("grade"),
            "khoi": current_user.get("khoi") or user_data.get("khoi"),
            "gradeLevel": current_user.get("gradeLevel") or user_data.get("gradeLevel"),
            "studentGrade": current_user.get("studentGrade") or user_data.get("studentGrade"),
            "className": current_user.get("className") or user_data.get("className"),
            "class": current_user.get("class") or user_data.get("class"),
            "lop": current_user.get("lop") or user_data.get("lop"),
            "studentClass": current_user.get("studentClass") or user_data.get("studentClass"),
        }

    except Exception as error:
        print("HYDRATE CURRENT USER ERROR:", error)
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
    text = str(value or "").strip()
    digits = "".join(char for char in text if char.isdigit())

    return digits or text


def normalize_class_name(value):
    return str(value or "").replace(" ", "").strip().lower()


def assert_exam_owner_or_admin(current_user, exam_data):
    if is_admin(current_user):
        return

    teacher_id = exam_data.get("teacherId")
    current_uid = current_user.get("uid")

    if teacher_id and current_uid and teacher_id == current_uid:
        return

    raise Exception("Bạn không có quyền chỉnh sửa bài thi này")


def get_question_count(exam_id):
    question_docs = (
        db.collection("exams")
        .document(exam_id)
        .collection("questions")
        .stream()
    )

    return sum(1 for _ in question_docs)


def get_exam_questions(exam_id):
    question_docs = (
        db.collection("exams")
        .document(exam_id)
        .collection("questions")
        .order_by("order")
        .stream()
    )

    return [
        {
            "id": question_doc.id,
            **serialize_doc_data(question_doc.to_dict() or {}),
        }
        for question_doc in question_docs
    ]


def get_exam_results_data(exam_id):
    result_docs = (
        db.collection("exams")
        .document(exam_id)
        .collection("results")
        .stream()
    )

    return [
        {
            "id": result_doc.id,
            **serialize_doc_data(result_doc.to_dict() or {}),
        }
        for result_doc in result_docs
    ]


def get_exam_attempt_for_user(exam_id, user_id):
    if not user_id:
        return None

    attempt_doc = (
        db.collection("exams")
        .document(exam_id)
        .collection("attempts")
        .document(user_id)
        .get()
    )

    if not attempt_doc.exists:
        return None

    return {
        "id": attempt_doc.id,
        **serialize_doc_data(attempt_doc.to_dict() or {}),
    }


def get_latest_result_for_user(exam_id, user_id):
    if not user_id:
        return None

    result_docs = (
        db.collection("exams")
        .document(exam_id)
        .collection("results")
        .where("studentId", "==", user_id)
        .stream()
    )

    results = [
        {
            "id": result_doc.id,
            **serialize_doc_data(result_doc.to_dict() or {}),
        }
        for result_doc in result_docs
    ]

    results.sort(
        key=lambda item: item.get("createdAt") or "",
        reverse=True,
    )

    return results[0] if results else None


def can_student_view_exam(current_user, exam_data):
    status = str(exam_data.get("status", "public")).strip().lower()

    selected_classes = (
        exam_data.get("selectedClasses")
        or exam_data.get("targetClasses")
        or []
    )

    selected_grades = (
        exam_data.get("selectedGrades")
        or exam_data.get("targetGrades")
        or []
    )

    student_class = get_user_class_name(current_user)
    student_grade = get_user_grade(current_user)

    normalized_student_class = normalize_class_name(student_class)
    normalized_student_grade = normalize_grade_value(student_grade or student_class)

    normalized_selected_classes = [
        normalize_class_name(item)
        for item in selected_classes
        if item is not None
    ]

    normalized_selected_grades = [
        normalize_grade_value(item)
        for item in selected_grades
        if item is not None
    ]

    if status == "public":
        if normalized_selected_grades:
            if normalized_student_grade not in normalized_selected_grades:
                return False

        if normalized_selected_classes:
            return normalized_student_class in normalized_selected_classes

        return True

    if normalized_selected_classes:
        return normalized_student_class in normalized_selected_classes

    return False


def get_default_scoring():
    return {
        "part1": {"perQuestion": 0},
        "part2": {
            "oneCorrect": 0,
            "twoCorrect": 0,
            "threeCorrect": 0,
            "fourCorrect": 0,
        },
        "part3": {"perQuestion": 0},
    }


def build_exam_summary(current_user, exam_id, exam_data):
    role = current_user.get("role")
    user_id = current_user.get("uid")

    summary = {
        "id": exam_id,
        **exam_data,
        "questionCount": (
            int(exam_data.get("questionCount", 0) or 0)
            or get_question_count(exam_id)
        ),
        "totalScore": exam_data.get("totalScore", 0),
        "scoring": exam_data.get("scoring", get_default_scoring()),
        "studentResultCount": exam_data.get("studentResultCount", 0),
        "questions": [],
        "studentResults": [],
        "attempts": [],
    }

    if role == "STUDENT":
        latest_result = get_latest_result_for_user(exam_id, user_id)
        attempt = get_exam_attempt_for_user(exam_id, user_id)

        if latest_result:
            summary["studentResults"] = [latest_result]

        if attempt:
            summary["attempts"] = [attempt]

    return summary


def get_exams(current_user):
    current_user = hydrate_current_user(current_user)

    role = current_user.get("role")
    exam_docs = db.collection("exams").stream()
    exams = []

    for exam_doc in exam_docs:
        exam_id = exam_doc.id
        exam_data = serialize_doc_data(exam_doc.to_dict() or {})

        if role == "STUDENT" and not can_student_view_exam(current_user, exam_data):
            continue

        exams.append(build_exam_summary(current_user, exam_id, exam_data))

    exams.sort(
        key=lambda item: item.get("createdAt") or "",
        reverse=True,
    )

    return {
        "success": True,
        "exams": exams,
    }


def get_exam_detail(current_user, exam_id):
    current_user = hydrate_current_user(current_user)

    exam_ref = db.collection("exams").document(exam_id)
    exam_doc = exam_ref.get()

    if not exam_doc.exists:
        raise Exception("Không tìm thấy bài thi")

    exam_data = serialize_doc_data(exam_doc.to_dict() or {})

    if is_student(current_user) and not can_student_view_exam(current_user, exam_data):
        raise Exception("Bạn không có quyền xem bài thi này")

    questions = get_exam_questions(exam_id)

    return {
        "success": True,
        "exam": {
            "id": exam_id,
            **exam_data,
            "questionCount": len(questions),
            "questions": questions,
            "scoring": exam_data.get("scoring", get_default_scoring()),
        },
    }


def create_exam(current_user, payload):
    if not is_teacher_or_admin(current_user):
        raise Exception("Bạn không có quyền tạo bài thi")

    questions = payload.pop("questions", [])
    scoring = payload.get("scoring", get_default_scoring())
    payload["proctoring"] = normalize_proctoring_config(payload)
    payload["maxFullscreenViolations"] = payload["proctoring"]["maxViolations"]

    exam_data = {
        **payload,
        "scoring": scoring,
        "questionCount": len(questions),
        "studentResultCount": 0,
        "teacherId": current_user.get("uid"),
        "teacherEmail": current_user.get("email"),
        "teacherName": (
            current_user.get("name")
            or current_user.get("displayName")
            or current_user.get("fullName")
            or current_user.get("email")
        ),
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }

    exam_ref = db.collection("exams").document()
    exam_ref.set(exam_data)

    for index, question in enumerate(questions):
        question_id = question.get("id")

        question_data = {
            **question,
            "order": index,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }

        if question_id:
            exam_ref.collection("questions").document(question_id).set(question_data)
        else:
            exam_ref.collection("questions").document().set(question_data)

    return {
        "success": True,
        "message": "Đã tạo bài thi",
        "examId": exam_ref.id,
    }


def update_exam(current_user, exam_id, payload):
    if not is_teacher_or_admin(current_user):
        raise Exception("Bạn không có quyền cập nhật bài thi")

    exam_ref = db.collection("exams").document(exam_id)
    exam_doc = exam_ref.get()

    if not exam_doc.exists:
        raise Exception("Không tìm thấy bài thi")

    exam_data = exam_doc.to_dict() or {}
    assert_exam_owner_or_admin(current_user, exam_data)

    questions = payload.pop("questions", None)
    if "proctoring" in payload or "maxFullscreenViolations" in payload:
        payload["proctoring"] = normalize_proctoring_config(payload)
        payload["maxFullscreenViolations"] = payload["proctoring"]["maxViolations"]

    exam_update_data = {
        **payload,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }

    if questions is not None:
        exam_update_data["questionCount"] = len(questions)

    exam_ref.update(exam_update_data)

    if questions is not None:
        old_questions = exam_ref.collection("questions").stream()
        batch = db.batch()

        for old_question in old_questions:
            batch.delete(old_question.reference)

        batch.commit()

        for index, question in enumerate(questions):
            question_id = question.get("id")

            question_data = {
                **question,
                "order": index,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }

            if question_id:
                exam_ref.collection("questions").document(question_id).set(question_data)
            else:
                exam_ref.collection("questions").document().set(question_data)

    return {
        "success": True,
        "message": "Đã cập nhật bài thi",
        "examId": exam_id,
    }


def delete_exam(current_user, exam_id):
    if not is_teacher_or_admin(current_user):
        raise Exception("Bạn không có quyền xóa bài thi")

    exam_ref = db.collection("exams").document(exam_id)
    exam_doc = exam_ref.get()

    if not exam_doc.exists:
        raise Exception("Không tìm thấy bài thi")

    exam_data = exam_doc.to_dict() or {}
    assert_exam_owner_or_admin(current_user, exam_data)

    for sub_collection in ["questions", "results", "attempts"]:
        docs = exam_ref.collection(sub_collection).stream()
        batch = db.batch()

        for item in docs:
            batch.delete(item.reference)

        batch.commit()

    exam_ref.delete()

    return {
        "success": True,
        "message": "Đã xóa bài thi",
        "examId": exam_id,
    }


def log_proctoring_event(current_user, exam_id, payload):
    current_user = hydrate_current_user(current_user)
    if not is_student(current_user):
        raise Exception("Chỉ học sinh mới gửi được sự kiện giám sát")

    exam_ref = db.collection("exams").document(exam_id)
    exam_doc = exam_ref.get()
    if not exam_doc.exists:
        raise Exception("Không tìm thấy bài thi")

    exam_data = exam_doc.to_dict() or {}
    if not can_student_view_exam(current_user, exam_data):
        raise Exception("Bạn không có quyền làm bài thi này")

    config = normalize_proctoring_config(exam_data)
    if not config["enabled"]:
        raise Exception("Đề thi này không bật giám sát")

    session_id = re.sub(
        r"[^a-zA-Z0-9_-]",
        "",
        str(payload.get("sessionId", "")),
    )[:80]
    if not session_id:
        raise Exception("Thiếu mã phiên giám sát")

    event = sanitize_proctoring_event(payload.get("event"))
    restrict_evidence_paths(
        [event],
        exam_id,
        current_user.get("uid"),
        session_id,
    )
    session_ref = exam_ref.collection("proctoringSessions").document(session_id)
    session_ref.set({
        "sessionId": session_id,
        "studentId": current_user.get("uid"),
        "studentEmail": current_user.get("email"),
        "studentName": current_user.get("name") or current_user.get("fullName"),
        "status": "active",
        "config": config,
        "lastSeenAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }, merge=True)

    event_ref = (
        session_ref.collection("events").document(event["id"])
        if event["id"]
        else session_ref.collection("events").document()
    )
    evidence_update = any(
        key in event.get("metadata", {})
        for key in ("evidenceCameraPath", "evidenceScreenPath")
    )
    event_already_exists = evidence_update and event_ref.get().exists
    event_ref.set({
        **event,
        "id": event_ref.id,
        "serverAt": firestore.SERVER_TIMESTAMP,
    })

    if event["severity"] == "violation" and not event_already_exists:
        session_ref.set({
            "violationCount": firestore.Increment(1),
        }, merge=True)

    return {
        "success": True,
        "eventId": event_ref.id,
    }


def submit_exam(current_user, exam_id, payload):
    current_user = hydrate_current_user(current_user)

    if not is_student(current_user):
        raise Exception("Chỉ học sinh mới được nộp bài thi")

    exam_ref = db.collection("exams").document(exam_id)
    exam_doc = exam_ref.get()

    if not exam_doc.exists:
        raise Exception("Không tìm thấy bài thi")

    exam_data = exam_doc.to_dict() or {}

    if not can_student_view_exam(current_user, exam_data):
        raise Exception("Bạn không có quyền làm bài thi này")

    answers = payload.get("answers", {})
    text_answers = payload.get("textAnswers", {})
    fullscreen_violations = int(payload.get("fullscreenViolations", 0) or 0)
    proctoring_report = sanitize_proctoring_report(payload.get("proctoringReport"))
    restrict_evidence_paths(
        proctoring_report["events"],
        exam_id,
        current_user.get("uid"),
        proctoring_report["sessionId"],
    )

    questions = get_exam_questions(exam_id)
    scoring = exam_data.get("scoring", get_default_scoring())

    attempt_ref = exam_ref.collection("attempts").document(current_user.get("uid"))
    attempt_doc = attempt_ref.get()
    attempt_count = 0

    if attempt_doc.exists:
        attempt_count = int((attempt_doc.to_dict() or {}).get("count", 0))

    max_attempts = (
        int(exam_data.get("maxAttempts", 1))
        if exam_data.get("attemptMode") == "multiple"
        else 1
    )

    if attempt_count >= max_attempts:
        raise Exception("Bạn đã hết số lượt làm bài thi này")

    score_data = calculate_exam_score(
        questions=questions,
        answers=answers,
        text_answers=text_answers,
        scoring=scoring,
    )

    result_ref = exam_ref.collection("results").document()

    result_data = {
        "studentId": current_user.get("uid"),
        "studentEmail": current_user.get("email"),
        "studentName": current_user.get("name"),
        "role": current_user.get("role"),
        "answers": answers,
        "textAnswers": text_answers,
        "fullscreenViolations": fullscreen_violations,
        "proctoringViolations": proctoring_report["totalViolations"],
        "proctoringReport": proctoring_report,
        "scoring": scoring,
        **score_data,
        "createdAt": firestore.SERVER_TIMESTAMP,
    }

    result_ref.set(result_data)

    if proctoring_report["sessionId"]:
        exam_ref.collection("proctoringSessions").document(
            proctoring_report["sessionId"]
        ).set({
            "status": "submitted",
            "resultId": result_ref.id,
            "submittedAt": firestore.SERVER_TIMESTAMP,
            "violationCount": proctoring_report["totalViolations"],
        }, merge=True)

    attempt_ref.set({
        "studentId": current_user.get("uid"),
        "count": attempt_count + 1,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })

    exam_ref.update({
        "studentResultCount": firestore.Increment(1),
        "questionCount": len(questions),
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })

    return {
        "success": True,
        "message": "Đã nộp bài thi",
        "resultId": result_ref.id,
        "result": {
            "id": result_ref.id,
            **serialize_doc_data(result_data),
            "createdAt": None,
        },
    }


def get_my_result(current_user, exam_id):
    exam_ref = db.collection("exams").document(exam_id)
    exam_doc = exam_ref.get()

    if not exam_doc.exists:
        raise Exception("Không tìm thấy bài thi")

    result = get_latest_result_for_user(exam_id, current_user.get("uid"))

    return {
        "success": True,
        "result": result,
    }


def get_exam_results(current_user, exam_id):
    if not is_teacher_or_admin(current_user):
        raise Exception("Bạn không có quyền xem kết quả bài thi")

    exam_ref = db.collection("exams").document(exam_id)
    exam_doc = exam_ref.get()

    if not exam_doc.exists:
        raise Exception("Không tìm thấy bài thi")

    exam_data = exam_doc.to_dict() or {}
    assert_exam_owner_or_admin(current_user, exam_data)

    results = get_exam_results_data(exam_id)

    return {
        "success": True,
        "results": results,
    }

import re

from auth.auth import db


MAX_CONTEXT_COURSES = 24
MAX_CONTEXT_LESSONS = 12


def _text(value, limit=500):
    return str(value or "").replace("\x00", "").strip()[:limit]


def _list(value):
    return value if isinstance(value, list) else []


def _normalize(value):
    return re.sub(r"\s+", "", _text(value).lower())


def _user_classes(user):
    values = [
        user.get("className"),
        user.get("class"),
        user.get("studentClass"),
        user.get("lop"),
        *_list(user.get("classes")),
    ]
    return {_normalize(value) for value in values if _text(value)}


def _user_class_ids(user):
    return {_text(value) for value in _list(user.get("classIds")) if _text(value)}


def _can_read_course(user, course):
    role = _text(user.get("role")).upper()
    uid = _text(user.get("uid"))
    class_locked = (
        course.get("visibility") == "private"
        or course.get("accessMode") == "class_locked"
    )

    if role in {"TEACHER", "ADMIN", "ADMINDEV", "ADMIN_DEV"}:
        if role in {"ADMIN", "ADMINDEV", "ADMIN_DEV"}:
            return True
        owners = {
            _text(course.get("teacherId")),
            _text(course.get("createdByUid")),
            _text(course.get("ownerId")),
        }
        if uid in owners:
            return True
        if not class_locked:
            return True

    if not class_locked:
        return True

    allowed = {
        _normalize(course.get("className")),
        *[_normalize(value) for value in _list(course.get("classNames"))],
        *[_normalize(value) for value in _list(course.get("allowedClasses"))],
    }
    allowed.discard("")
    allowed_ids = {_text(value) for value in _list(course.get("allowedClassIds")) if _text(value)}
    return bool(
        allowed.intersection(_user_classes(user))
        or allowed_ids.intersection(_user_class_ids(user))
    )


def _load_progress(uid):
    if not uid:
        return {}

    try:
        docs = (
            db.collection("learningStats")
            .document(uid)
            .collection("courses")
            .stream()
        )
        return {doc.id: doc.to_dict() or {} for doc in docs}
    except Exception as error:
        print("CHATBOT PROGRESS CONTEXT ERROR:", error)
        return {}


def _lesson_summary(lesson, index):
    return {
        "number": index + 1,
        "title": _text(lesson.get("title") or f"Bài {index + 1}", 160),
        "summary": _text(
            lesson.get("content")
            or lesson.get("description")
            or lesson.get("fileExtractedText"),
            700,
        ),
        "format": _text(lesson.get("attachMode") or "document", 40),
    }


def _course_summary(course_id, course, progress=None, detailed=False):
    lessons = _list(course.get("lessons"))
    lesson_limit = MAX_CONTEXT_LESSONS if detailed else 5
    return {
        "id": course_id,
        "title": _text(course.get("title") or "Khóa học chưa đặt tên", 180),
        "topic": _text(course.get("topic"), 180),
        "subject": _text(course.get("subject") or course.get("category"), 100),
        "description": _text(course.get("description"), 900 if detailed else 350),
        "teacher": _text(course.get("teacherName"), 120),
        "courseCode": _text(course.get("courseCode"), 60),
        "lessonCount": int(course.get("lessonCount") or len(lessons) or 0),
        "progress": int((progress or {}).get("progress") or 0),
        "lessons": [
            _lesson_summary(lesson, index)
            for index, lesson in enumerate(lessons[:lesson_limit])
            if isinstance(lesson, dict)
        ],
    }


def _extract_course_id(path):
    match = re.match(r"^/(?:e-learning|courses|learn)/([^/?#]+)", _text(path, 300), re.I)
    return match.group(1) if match else ""


def build_platform_context(current_user, page_context=None):
    if not current_user:
        return {
            "authenticated": False,
            "profile": {},
            "courses": [],
            "courseCount": 0,
            "lessonCount": 0,
        }

    page_context = page_context or {}
    path = _text(page_context.get("path") or "/", 300)
    uid = _text(current_user.get("uid"))
    profile = {
        "name": _text(current_user.get("name") or current_user.get("fullName"), 120),
        "role": _text(current_user.get("role"), 40),
        "grade": _text(current_user.get("grade") or current_user.get("studentGrade"), 30),
        "className": _text(current_user.get("className") or current_user.get("studentClass"), 80),
        "subject": _text(current_user.get("subject") or current_user.get("teacherSubject"), 100),
        "school": _text(current_user.get("school"), 160),
    }

    # Phòng thi tuyệt đối không nạp dữ liệu học tập hoặc nội dung đề vào AI.
    if re.match(r"^/exam/[^/]+/?$", path, re.I):
        return {
            "authenticated": True,
            "profile": profile,
            "courses": [],
            "courseCount": 0,
            "lessonCount": 0,
            "restricted": True,
        }

    progress = _load_progress(uid)
    requested_course_id = _extract_course_id(path)
    courses = []

    try:
        if requested_course_id:
            course_doc = db.collection("courses").document(requested_course_id).get()
            if course_doc.exists:
                course = course_doc.to_dict() or {}
                if _can_read_course(current_user, course):
                    courses.append(
                        _course_summary(
                            course_doc.id,
                            course,
                            progress.get(course_doc.id),
                            detailed=True,
                        )
                    )
        else:
            for course_doc in db.collection("courses").limit(80).stream():
                course = course_doc.to_dict() or {}
                if not _can_read_course(current_user, course):
                    continue
                courses.append(
                    _course_summary(
                        course_doc.id,
                        course,
                        progress.get(course_doc.id),
                    )
                )
                if len(courses) >= MAX_CONTEXT_COURSES:
                    break
    except Exception as error:
        print("CHATBOT COURSE CONTEXT ERROR:", error)

    return {
        "authenticated": True,
        "profile": profile,
        "courses": courses,
        "courseCount": len(courses),
        "lessonCount": sum(course.get("lessonCount", 0) for course in courses),
        "restricted": False,
    }


def format_platform_context(data_context):
    data_context = data_context or {}
    if not data_context.get("authenticated"):
        return "Người dùng chưa đăng nhập; không có dữ liệu cá nhân."

    profile = data_context.get("profile") or {}
    profile_text = ", ".join(
        f"{key}={value}"
        for key, value in profile.items()
        if _text(value)
    ) or "chưa có dữ liệu hồ sơ"

    if data_context.get("restricted"):
        return f"Hồ sơ: {profile_text}. Phòng thi đang bật chế độ giới hạn dữ liệu."

    course_lines = []
    for course in data_context.get("courses") or []:
        lesson_text = "; ".join(
            f"Bài {lesson['number']} {lesson['title']}: {lesson['summary']}"
            for lesson in course.get("lessons") or []
        )
        course_lines.append(
            " | ".join(filter(None, [
                f"ID={course.get('id')}",
                f"Tên={course.get('title')}",
                f"Chủ đề={course.get('topic')}",
                f"Môn={course.get('subject')}",
                f"Mô tả={course.get('description')}",
                f"Giáo viên={course.get('teacher')}",
                f"Tiến độ={course.get('progress')}%",
                f"Bài giảng={lesson_text}" if lesson_text else "",
            ]))
        )

    return (
        f"Hồ sơ người dùng: {profile_text}\n"
        f"Dữ liệu khóa học được phép xem ({len(course_lines)}):\n"
        + ("\n".join(f"- {line}" for line in course_lines) if course_lines else "- Chưa có khóa học phù hợp")
    )


def get_contextual_actions(message, data_context, limit=3):
    normalized = _text(message).lower()
    courses = data_context.get("courses") or []
    wants_course = any(
        keyword in normalized
        for keyword in ("khóa học", "bài học", "bài giảng", "học gì", "học nào", "course")
    )
    if not wants_course:
        return []

    ranked = sorted(
        courses,
        key=lambda course: (
            0 if _normalize(course.get("title")) in _normalize(message) else 1,
            course.get("progress", 0),
        ),
    )
    return [
        {
            "id": f"open_course_{course['id']}",
            "label": f"Mở {course['title'][:42]}",
            "type": "navigate",
            "target": f"/courses/{course['id']}",
        }
        for course in ranked[:limit]
    ]

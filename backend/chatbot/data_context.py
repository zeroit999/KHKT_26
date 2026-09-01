import re
from datetime import date, datetime, timedelta

from extensions import db
from models import (
    Classroom,
    Course,
    Exam,
    ExamResult,
    LearningProgress,
)


LIMITS = {
    "courses": 24,
    "lessons": 12,
    "exams": 20,
    "classes": 10,
    "subjects": 8,
    "posts": 16,
}


def _text(value, limit=500):
    return str(value or "").replace("\x00", "").strip()[:limit]


def _list(value):
    return value if isinstance(value, list) else []


def _dict(value):
    return value if isinstance(value, dict) else {}


def _normalize(value):
    return re.sub(
        r"\s+",
        "",
        _text(value).lower(),
    )


def _number(value, default=0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _integer(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _role(user):
    return _text(
        (user or {}).get("role")
    ).upper()


def _is_admin(user):
    return _role(user) in {
        "ADMIN",
        "ADMINDEV",
        "ADMIN_DEV",
    }


def _is_teacher(user):
    return (
        _role(user) == "TEACHER"
        or _is_admin(user)
    )


def _user_classes(user):
    user = user or {}

    values = [
        user.get("className"),
        user.get("class"),
        user.get("studentClass"),
        user.get("lop"),
        *_list(user.get("classes")),
    ]

    return {
        _normalize(value)
        for value in values
        if _text(value)
    }


def _user_class_ids(user):
    user = user or {}

    return {
        _text(value)
        for value in _list(
            user.get("classIds")
        )
        if _text(value)
    }


def _owner_ids(data):
    data = data or {}

    return {
        _text(data.get("teacherId")),
        _text(data.get("createdByUid")),
        _text(data.get("ownerId")),
        *[
            _text(value)
            for value in _list(
                data.get("teacherIds")
            )
        ],
        *[
            _text(value)
            for value in _list(
                data.get("coTeacherIds")
            )
        ],
    }


def _can_read_course(user, course):
    uid = _text(
        (user or {}).get("uid")
    )

    visibility = _text(
        course.get("visibility")
    ).lower()

    class_locked = (
        visibility in {
            "private",
            "class",
        }
        or course.get(
            "accessMode"
        )
        == "class_locked"
    )

    if (
        _is_teacher(user)
        and (
            _is_admin(user)
            or uid in _owner_ids(course)
            or not class_locked
        )
    ):
        return True

    if not class_locked:
        return True

    allowed_names = {
        _normalize(
            course.get("className")
        ),
        *[
            _normalize(value)
            for value in _list(
                course.get("classNames")
            )
        ],
        *[
            _normalize(value)
            for value in _list(
                course.get(
                    "allowedClasses"
                )
            )
        ],
    }

    allowed_names.discard("")

    allowed_ids = {
        _text(value)
        for value in _list(
            course.get(
                "allowedClassIds"
            )
        )
        if _text(value)
    }

    class_id = _text(
        course.get("classId")
    )

    if class_id:
        allowed_ids.add(class_id)

    return bool(
        allowed_names.intersection(
            _user_classes(user)
        )
        or allowed_ids.intersection(
            _user_class_ids(user)
        )
    )


def _can_read_exam(user, exam):
    uid = _text(
        (user or {}).get("uid")
    )

    if (
        _is_admin(user)
        or (
            _is_teacher(user)
            and uid in _owner_ids(exam)
        )
    ):
        return True

    if _is_teacher(user):
        return False

    status = _text(
        exam.get("status")
        or "public"
    ).lower()

    class_names = {
        _normalize(value)
        for value in _list(
            exam.get(
                "selectedClasses"
            )
            or exam.get(
                "targetClasses"
            )
        )
        if _text(value)
    }

    grades = {
        _normalize(value)
        for value in _list(
            exam.get(
                "selectedGrades"
            )
            or exam.get(
                "targetGrades"
            )
        )
        if _text(value)
    }

    user_grades = {
        _normalize(
            (user or {}).get("grade")
        ),
        _normalize(
            (user or {}).get(
                "studentGrade"
            )
        ),
    } - {""}

    if (
        status != "public"
        and not class_names
    ):
        return False

    if (
        grades
        and not grades.intersection(
            user_grades
        )
    ):
        return False

    return (
        not class_names
        or bool(
            class_names.intersection(
                _user_classes(user)
            )
        )
    )


def _can_read_class(
    user,
    class_id,
    data,
):
    if _is_admin(user):
        return True

    normalized_class_id = _normalize(
        class_id
    )

    normalized_name = _normalize(
        data.get("name")
        or data.get("className")
    )

    normalized_code = _normalize(
        data.get("classCode")
    )

    user_classes = _user_classes(
        user
    )

    user_class_ids = {
        _normalize(value)
        for value in _user_class_ids(
            user
        )
    }

    return bool(
        normalized_class_id
        in user_class_ids
        or normalized_class_id
        in user_classes
        or normalized_name
        in user_classes
        or normalized_code
        in user_classes
    )


def _selected_domains(
    message,
    path,
):
    value = (
        f"{_text(message, 1200)} "
        f"{_text(path, 300)}"
    ).lower()

    all_data = any(
        term in value
        for term in (
            "database",
            "cơ sở dữ liệu",
            "dữ liệu của tôi",
            "tổng quan của tôi",
            "tôi có gì",
            "phân tích toàn bộ",
            "thống kê của tôi",
        )
    )

    domains = {
        "learning"
    }

    rules = {
        "courses": (
            r"/(?:courses|e-learning|learn)",
            (
                "khóa học",
                "bài học",
                "bài giảng",
                "course",
                "lesson",
            ),
        ),
        "exams": (
            r"/(?:exams|exam/)",
            (
                "bài thi",
                "đề thi",
                "kết quả thi",
                "điểm thi",
                "lần làm",
                "exam",
            ),
        ),
        "classes": (
            r"/(?:classes|learning/classes)",
            (
                "lớp học",
                "môn học",
                "bảng điểm",
                "học sinh",
                "giáo viên",
                "class",
            ),
        ),
        "forum": (
            r"/forum",
            (
                "diễn đàn",
                "bài viết",
                "thảo luận",
                "forum",
                "cộng đồng",
            ),
        ),
    }

    for (
        domain,
        (
            pattern,
            keywords,
        ),
    ) in rules.items():
        if (
            all_data
            or re.search(
                pattern,
                path,
                re.I,
            )
            or any(
                keyword in value
                for keyword
                in keywords
            )
        ):
            domains.add(
                domain
            )

    return domains


def _parse_date_key(value):
    value = _text(
        value,
        30,
    )

    if not value:
        return None

    try:
        return datetime.strptime(
            value[:10],
            "%Y-%m-%d",
        ).date()
    except ValueError:
        return None


def _calculate_streak(
    watched_dates,
):
    parsed_dates = {
        parsed
        for parsed in (
            _parse_date_key(value)
            for value
            in watched_dates
        )
        if parsed
    }

    if not parsed_dates:
        return 0

    today = date.today()

    if today in parsed_dates:
        cursor = today
    elif (
        today
        - timedelta(days=1)
    ) in parsed_dates:
        cursor = (
            today
            - timedelta(days=1)
        )
    else:
        return 0

    streak = 0

    while cursor in parsed_dates:
        streak += 1
        cursor -= timedelta(
            days=1
        )

    return streak


def _progress_to_dict(
    row,
):
    if not row:
        return {}

    data = {
        "progress": _number(
            row.progress,
            0,
        ),
        "watchedSeconds": _integer(
            row.watched_seconds,
            0,
        ),
        "watchedDate": _text(
            row.watched_date,
            30,
        ),
        "bookmarked": bool(
            row.bookmarked
        ),
        "completedChecklist": (
            row.completed_checklist
            if isinstance(
                row.completed_checklist,
                dict,
            )
            else {}
        ),
        "quizResult": (
            row.quiz_result
            if isinstance(
                row.quiz_result,
                dict,
            )
            else row.quiz_result
        ),
        "notes": _text(
            row.notes,
            5000,
        ),
        "noteColor": _text(
            row.note_color,
            50,
        ),
        "lastViewedAt": (
            row.last_viewed_at
        ),
        "lastWatchedAt": (
            row.last_watched_at
        ),
        "firstWatchedAt": (
            row.first_watched_at
        ),
        "savedAt": (
            row.saved_at
        ),
        "unsavedAt": (
            row.unsaved_at
        ),
        "completedAt": (
            row.completed_at
        ),
    }

    extra = (
        row.progress_data
        if isinstance(
            row.progress_data,
            dict,
        )
        else {}
    )

    return {
        **extra,
        **data,
    }


def _load_learning(uid):
    if not uid:
        return {}, {}

    try:
        try:
            user_id = int(uid)
        except (
            TypeError,
            ValueError,
        ):
            return {}, {}

        rows = (
            db.session.execute(
                db.select(
                    LearningProgress
                )
                .where(
                    LearningProgress.user_id
                    == user_id
                )
                .order_by(
                    LearningProgress.updated_at.desc()
                )
            )
            .scalars()
            .all()
        )

        progress = {}

        watched_dates = []

        for row in rows:
            course_key = _text(
                row.course_id
            )

            progress[
                course_key
            ] = _progress_to_dict(
                row
            )

            if row.watched_date:
                watched_dates.append(
                    row.watched_date
                )

        unique_dates = sorted(
            {
                _text(value)
                for value
                in watched_dates
                if _text(value)
            }
        )

        watched_count = len(
            rows
        )

        return {
            "watchedLessons": (
                watched_count
            ),
            "watchedCourses": (
                watched_count
            ),
            "streak": (
                _calculate_streak(
                    unique_dates
                )
            ),
            "activeDays": len(
                unique_dates
            ),
            "courseProgressCount": (
                len(progress)
            ),
        }, progress

    except Exception as error:
        print(
            "CHATBOT LEARNING "
            "CONTEXT ERROR:",
            error,
        )

        return {}, {}


def _lesson_summary(
    lesson,
    index,
):
    return {
        "number": (
            index + 1
        ),
        "title": _text(
            lesson.get("title")
            or f"Bài {index + 1}",
            160,
        ),
        "summary": _text(
            lesson.get("content")
            or lesson.get(
                "description"
            )
            or lesson.get(
                "fileExtractedText"
            ),
            700,
        ),
        "format": _text(
            lesson.get(
                "attachMode"
            )
            or "document",
            40,
        ),
    }


def _course_model_to_access_data(
    course,
):
    metadata = _dict(
        course.metadata_json
    )

    return {
        **metadata,
        "teacherId": _text(
            course.teacher_id
        ),
        "createdByUid": _text(
            course.teacher_id
        ),
        "ownerId": _text(
            course.teacher_id
        ),
        "visibility": _text(
            course.visibility
        ),
        "classId": _text(
            course.class_id
        ),
        "className": _text(
            course.class_name
        ),
        "status": _text(
            course.status
        ),
        "moderationStatus": _text(
            course.moderation_status
        ),
    }


def _course_public_id(
    course,
):
    return _text(
        course.legacy_id
        or course.id
    )


def _course_progress_for(
    progress,
    course,
):
    keys = [
        _text(
            course.id
        ),
        _text(
            course.legacy_id
        ),
    ]

    for key in keys:
        if (
            key
            and key in progress
        ):
            return progress[
                key
            ]

    return {}


def _course_summary(
    course_id,
    course,
    progress=None,
    detailed=False,
):
    lessons = (
        course.lessons
        if isinstance(
            course.lessons,
            list,
        )
        else []
    )

    lesson_limit = (
        LIMITS["lessons"]
        if detailed
        else 5
    )

    return {
        "id": course_id,
        "title": _text(
            course.title
            or "Khóa học chưa đặt tên",
            180,
        ),
        "topic": _text(
            course.topic,
            180,
        ),
        "subject": _text(
            course.teacher_subject
            or course.category,
            100,
        ),
        "description": _text(
            course.description,
            900
            if detailed
            else 350,
        ),
        "teacher": _text(
            course.teacher_name,
            120,
        ),
        "lessonCount": int(
            course.lesson_count
            or len(lessons)
            or 0
        ),
        "progress": int(
            _number(
                (progress or {}).get(
                    "progress"
                ),
                0,
            )
        ),
        "lessons": [
            _lesson_summary(
                lesson,
                index,
            )
            for (
                index,
                lesson,
            )
            in enumerate(
                lessons[
                    :lesson_limit
                ]
            )
            if isinstance(
                lesson,
                dict,
            )
        ],
    }


def _extract_id(
    path,
    pattern,
):
    match = re.match(
        pattern,
        _text(
            path,
            300,
        ),
        re.I,
    )

    return (
        match.group(1)
        if match
        else ""
    )


def _find_course(
    requested_id,
):
    requested_id = _text(
        requested_id,
        255,
    )

    if not requested_id:
        return None

    course = (
        db.session.execute(
            db.select(
                Course
            )
            .where(
                Course.legacy_id
                == requested_id
            )
            .limit(1)
        )
        .scalars()
        .first()
    )

    if course:
        return course

    try:
        numeric_id = int(
            requested_id
        )
    except (
        TypeError,
        ValueError,
    ):
        return None

    return db.session.get(
        Course,
        numeric_id,
    )


def _load_courses(
    user,
    path,
    progress,
):
    requested_id = _extract_id(
        path,
        (
            r"^/(?:e-learning|"
            r"courses|learn)/"
            r"([^/?#]+)"
        ),
    )

    courses = []

    try:
        if requested_id:
            requested_course = (
                _find_course(
                    requested_id
                )
            )

            rows = (
                [requested_course]
                if requested_course
                else []
            )
        else:
            rows = (
                db.session.execute(
                    db.select(
                        Course
                    )
                    .order_by(
                        Course.created_at.desc()
                    )
                    .limit(80)
                )
                .scalars()
                .all()
            )

        for course in rows:
            access_data = (
                _course_model_to_access_data(
                    course
                )
            )

            if not _can_read_course(
                user,
                access_data,
            ):
                continue

            public_id = (
                _course_public_id(
                    course
                )
            )

            courses.append(
                _course_summary(
                    public_id,
                    course,
                    _course_progress_for(
                        progress,
                        course,
                    ),
                    bool(
                        requested_id
                    ),
                )
            )

            if (
                len(courses)
                >= LIMITS[
                    "courses"
                ]
            ):
                break

    except Exception as error:
        print(
            "CHATBOT COURSE "
            "CONTEXT ERROR:",
            error,
        )

    return courses


def _exam_model_to_access_data(
    exam,
):
    settings = _dict(
        exam.settings
    )

    metadata = _dict(
        exam.metadata_json
    )

    return {
        **metadata,
        **settings,
        "teacherId": _text(
            exam.teacher_id
        ),
        "createdByUid": _text(
            exam.teacher_id
        ),
        "ownerId": _text(
            exam.teacher_id
        ),
        "status": _text(
            exam.status
            or "public"
        ),
        "visibility": _text(
            exam.visibility
        ),
        "selectedClasses": (
            exam.selected_classes
            if isinstance(
                exam.selected_classes,
                list,
            )
            else []
        ),
        "selectedGrades": (
            exam.selected_grades
            if isinstance(
                exam.selected_grades,
                list,
            )
            else []
        ),
    }


def _load_results(
    exam,
    user,
    owned,
):
    uid = _text(
        (user or {}).get("uid")
    )

    rows = []
    scores = []

    try:
        statement = (
            db.select(
                ExamResult
            )
            .where(
                ExamResult.exam_id
                == exam.id
            )
            .order_by(
                ExamResult.created_at.asc()
            )
        )

        if not owned:
            try:
                user_id = int(uid)
            except (
                TypeError,
                ValueError,
            ):
                return [], {}

            statement = (
                statement.where(
                    ExamResult.student_id
                    == user_id
                )
            )

        result_rows = (
            db.session.execute(
                statement
            )
            .scalars()
            .all()
        )

        for result in result_rows:
            data = _dict(
                result.result_data
            )

            score = _number(
                data.get("score"),
                0,
            )

            scores.append(
                score
            )

            proctoring = _dict(
                data.get(
                    "proctoring"
                )
            )

            wrong_questions = (
                data.get(
                    "wrongQuestions"
                )
            )

            rows.append({
                "id": _text(
                    result.id
                ),
                "score": score,
                "totalScore": (
                    _number(
                        data.get(
                            "totalScore"
                        ),
                        10,
                    )
                ),
                "correctCount": (
                    _integer(
                        data.get(
                            "correctCount"
                        ),
                        0,
                    )
                ),
                "wrongCount": (
                    len(
                        _list(
                            wrong_questions
                        )
                    )
                    or _integer(
                        data.get(
                            "wrongCount"
                        ),
                        0,
                    )
                ),
                "answeredCount": (
                    _integer(
                        data.get(
                            "answeredCount"
                        ),
                        0,
                    )
                ),
                "violationCount": (
                    _integer(
                        data.get(
                            "totalViolations"
                        )
                        or proctoring.get(
                            "totalViolations"
                        ),
                        0,
                    )
                ),
            })

    except Exception as error:
        print(
            "CHATBOT EXAM RESULT "
            "CONTEXT ERROR:",
            error,
        )

    aggregate = {}

    if owned:
        aggregate = {
            "submissionCount": (
                len(scores)
            ),
            "averageScore": (
                round(
                    sum(scores)
                    / len(scores),
                    2,
                )
                if scores
                else 0
            ),
            "highestScore": (
                max(scores)
                if scores
                else 0
            ),
            "lowestScore": (
                min(scores)
                if scores
                else 0
            ),
        }

        rows = []

    return (
        rows[-5:],
        aggregate,
    )


def _find_exam(
    requested_id,
):
    try:
        exam_id = int(
            requested_id
        )
    except (
        TypeError,
        ValueError,
    ):
        return None

    return db.session.get(
        Exam,
        exam_id,
    )


def _exam_question_count(
    exam,
):
    metadata = _dict(
        exam.metadata_json
    )

    settings = _dict(
        exam.settings
    )

    return _integer(
        metadata.get(
            "questionCount"
        )
        or settings.get(
            "questionCount"
        ),
        0,
    )


def _exam_total_score(
    exam,
):
    metadata = _dict(
        exam.metadata_json
    )

    settings = _dict(
        exam.settings
    )

    return _number(
        metadata.get(
            "totalScore"
        )
        or settings.get(
            "totalScore"
        ),
        10,
    )


def _exam_max_attempts(
    exam,
):
    metadata = _dict(
        exam.metadata_json
    )

    settings = _dict(
        exam.settings
    )

    return _integer(
        metadata.get(
            "maxAttempts"
        )
        or settings.get(
            "maxAttempts"
        ),
        1,
    )


def _load_exams(
    user,
    path,
):
    requested_id = _extract_id(
        path,
        (
            r"^/exam/"
            r"([^/?#]+)"
            r"(?:/result)?/?$"
        ),
    )

    exams = []

    result_count = 0

    try:
        if requested_id:
            requested_exam = (
                _find_exam(
                    requested_id
                )
            )

            rows = (
                [requested_exam]
                if requested_exam
                else []
            )
        else:
            rows = (
                db.session.execute(
                    db.select(
                        Exam
                    )
                    .order_by(
                        Exam.created_at.desc()
                    )
                    .limit(80)
                )
                .scalars()
                .all()
            )

        for exam in rows:
            access_data = (
                _exam_model_to_access_data(
                    exam
                )
            )

            if not _can_read_exam(
                user,
                access_data,
            ):
                continue

            owned = (
                _is_admin(user)
                or (
                    _is_teacher(user)
                    and _text(
                        (user or {}).get(
                            "uid"
                        )
                    )
                    in _owner_ids(
                        access_data
                    )
                )
            )

            (
                results,
                aggregate,
            ) = _load_results(
                exam,
                user,
                owned,
            )

            result_count += (
                aggregate.get(
                    "submissionCount",
                    len(results),
                )
            )

            exams.append({
                "id": _text(
                    exam.id
                ),
                "title": _text(
                    exam.title
                    or "Bài thi chưa đặt tên",
                    180,
                ),
                "subject": _text(
                    exam.subject,
                    100,
                ),
                "description": _text(
                    exam.description,
                    400,
                ),
                "duration": _integer(
                    exam.duration,
                    0,
                ),
                "questionCount": (
                    _exam_question_count(
                        exam
                    )
                ),
                "totalScore": (
                    _exam_total_score(
                        exam
                    )
                ),
                "status": _text(
                    exam.status,
                    40,
                ),
                "maxAttempts": (
                    _exam_max_attempts(
                        exam
                    )
                ),
                "results": results,
                "aggregate": aggregate,
            })

            if (
                len(exams)
                >= LIMITS[
                    "exams"
                ]
            ):
                break

    except Exception as error:
        print(
            "CHATBOT EXAM "
            "CONTEXT ERROR:",
            error,
        )

    return (
        exams,
        result_count,
    )


def _score_values(rows):
    values = []

    for row in rows:
        scores = (
            row.get("scores")
            or {}
        )

        if isinstance(
            scores,
            dict,
        ):
            raw_values = (
                scores.values()
            )
        elif isinstance(
            scores,
            list,
        ):
            raw_values = (
                scores
            )
        else:
            raw_values = []

        values.extend(
            _number(
                value,
                None,
            )
            for value
            in raw_values
        )

    return [
        value
        for value in values
        if value is not None
    ]


def _load_subjects(
    class_ref,
    user,
    owned,
):
    # PostgreSQL hiện chưa có model ClassroomSubject /
    # ClassroomTest / ClassroomScore.
    #
    # Giữ nguyên interface để format_platform_context()
    # và chatbot.service không bị thay đổi.
    #
    # Khi các model lớp học chi tiết được migrate,
    # phần này sẽ được nối vào SQLAlchemy.
    return []


def _classroom_to_access_data(
    classroom,
):
    return {
        "name": _text(
            classroom.name
        ),
        "className": _text(
            classroom.name
        ),
        "classCode": _text(
            classroom.class_code
        ),
        "grade": _text(
            classroom.grade
        ),
    }


def _load_classes(user):
    classes = []

    try:
        rows = (
            db.session.execute(
                db.select(
                    Classroom
                )
                .order_by(
                    Classroom.id.asc()
                )
                .limit(60)
            )
            .scalars()
            .all()
        )

        for classroom in rows:
            data = (
                _classroom_to_access_data(
                    classroom
                )
            )

            if not _can_read_class(
                user,
                classroom.id,
                data,
            ):
                continue

            owned = (
                _is_admin(user)
            )

            classes.append({
                "id": _text(
                    classroom.id
                ),
                "name": _text(
                    classroom.name
                    or classroom.id,
                    120,
                ),
                "grade": _text(
                    classroom.grade,
                    30,
                ),
                "schoolYear": "",
                "studentCount": 0,
                "subjects": (
                    _load_subjects(
                        classroom,
                        user,
                        owned,
                    )
                ),
                "owned": owned,
            })

            if (
                len(classes)
                >= LIMITS[
                    "classes"
                ]
            ):
                break

    except Exception as error:
        print(
            "CHATBOT CLASS "
            "CONTEXT ERROR:",
            error,
        )

    return classes


def _load_forum(user):
    # PostgreSQL hiện chưa có ForumGroup / ForumPost.
    #
    # Không fallback về hệ thống dữ liệu cũ;
    # backend hiện sử dụng SQL.
    #
    # Giữ nguyên function/interface để chatbot.service,
    # build_platform_context và format_platform_context
    # không phải thay đổi.
    return []


def build_platform_context(
    current_user,
    page_context=None,
    message="",
):
    empty = {
        "authenticated": False,
        "profile": {},
        "learning": {},
        "courses": [],
        "exams": [],
        "classes": [],
        "forumPosts": [],
        "courseCount": 0,
        "lessonCount": 0,
        "examCount": 0,
        "resultCount": 0,
        "classCount": 0,
        "forumPostCount": 0,
    }

    if not current_user:
        return empty

    page_context = (
        page_context
        or {}
    )

    path = _text(
        page_context.get(
            "path"
        )
        or "/",
        300,
    )

    uid = _text(
        current_user.get(
            "uid"
        )
    )

    profile = {
        "name": _text(
            current_user.get(
                "name"
            )
            or current_user.get(
                "fullName"
            ),
            120,
        ),
        "role": _text(
            current_user.get(
                "role"
            ),
            40,
        ),
        "grade": _text(
            current_user.get(
                "grade"
            )
            or current_user.get(
                "studentGrade"
            ),
            30,
        ),
        "className": _text(
            current_user.get(
                "className"
            )
            or current_user.get(
                "studentClass"
            ),
            80,
        ),
        "subject": _text(
            current_user.get(
                "subject"
            )
            or current_user.get(
                "teacherSubject"
            ),
            100,
        ),
        "school": _text(
            current_user.get(
                "school"
            ),
            160,
        ),
    }

    if re.match(
        r"^/exam/[^/]+/?$",
        path,
        re.I,
    ):
        return {
            **empty,
            "authenticated": True,
            "profile": profile,
            "restricted": True,
        }

    domains = (
        _selected_domains(
            message,
            path,
        )
    )

    (
        learning,
        progress,
    ) = _load_learning(
        uid
    )

    courses = (
        _load_courses(
            current_user,
            path,
            progress,
        )
        if "courses"
        in domains
        else []
    )

    (
        exams,
        result_count,
    ) = (
        _load_exams(
            current_user,
            path,
        )
        if "exams"
        in domains
        else (
            [],
            0,
        )
    )

    classes = (
        _load_classes(
            current_user
        )
        if "classes"
        in domains
        else []
    )

    posts = (
        _load_forum(
            current_user
        )
        if "forum"
        in domains
        else []
    )

    return {
        "authenticated": True,
        "profile": profile,
        "learning": learning,
        "courses": courses,
        "exams": exams,
        "classes": classes,
        "forumPosts": posts,
        "courseCount": len(
            courses
        ),
        "lessonCount": sum(
            course.get(
                "lessonCount",
                0,
            )
            for course
            in courses
        ),
        "examCount": len(
            exams
        ),
        "resultCount": (
            result_count
        ),
        "classCount": len(
            classes
        ),
        "forumPostCount": len(
            posts
        ),
        "loadedDomains": sorted(
            domains
        ),
        "restricted": False,
    }


def format_platform_context(
    context,
):
    context = context or {}

    if not context.get(
        "authenticated"
    ):
        return (
            "Người dùng chưa đăng nhập; "
            "không có dữ liệu cá nhân."
        )

    profile = (
        context.get(
            "profile"
        )
        or {}
    )

    profile_text = (
        ", ".join(
            f"{key}={value}"
            for (
                key,
                value,
            )
            in profile.items()
            if _text(value)
        )
        or "chưa có dữ liệu hồ sơ"
    )

    if context.get(
        "restricted"
    ):
        return (
            f"Hồ sơ: {profile_text}. "
            "Phòng thi đang bật chế độ "
            "giới hạn dữ liệu; không được "
            "suy đoán nội dung hoặc đáp án."
        )

    sections = [
        (
            "Hồ sơ người dùng: "
            f"{profile_text}"
        )
    ]

    if context.get(
        "learning"
    ):
        sections.append(
            "THỐNG KÊ HỌC TẬP "
            "CÁ NHÂN: "
            + ", ".join(
                f"{key}={value}"
                for (
                    key,
                    value,
                )
                in context[
                    "learning"
                ].items()
            )
        )

    if context.get(
        "courses"
    ):
        lines = []

        for course in context[
            "courses"
        ]:
            lessons = "; ".join(
                (
                    f"Bài "
                    f"{item['number']} "
                    f"{item['title']}: "
                    f"{item['summary']}"
                )
                for item
                in (
                    course.get(
                        "lessons"
                    )
                    or []
                )
            )

            lines.append(
                (
                    f"ID="
                    f"{course.get('id')} "
                    f"| Tên="
                    f"{course.get('title')} "
                    f"| Môn="
                    f"{course.get('subject', '')} "
                    f"| Mô tả="
                    f"{course.get('description', '')} "
                    f"| Giáo viên="
                    f"{course.get('teacher', '')} "
                    f"| Tiến độ="
                    f"{course.get('progress', 0)}%"
                )
                + (
                    (
                        f" | Bài giảng="
                        f"{lessons}"
                    )
                    if lessons
                    else ""
                )
            )

        sections.append(
            "KHÓA HỌC VÀ BÀI GIẢNG "
            "ĐƯỢC PHÉP XEM:\n"
            + "\n".join(
                f"- {line}"
                for line
                in lines
            )
        )

    if context.get(
        "exams"
    ):
        lines = []

        for exam in context[
            "exams"
        ]:
            results = "; ".join(
                (
                    f"điểm "
                    f"{item.get('score', 0)}/"
                    f"{item.get('totalScore', exam.get('totalScore', 10))}, "
                    f"đúng "
                    f"{item.get('correctCount', 0)}, "
                    f"sai "
                    f"{item.get('wrongCount', 0)}, "
                    f"vi phạm "
                    f"{item.get('violationCount', 0)}"
                )
                for item
                in (
                    exam.get(
                        "results"
                    )
                    or []
                )
            )

            aggregate = ", ".join(
                f"{key}={value}"
                for (
                    key,
                    value,
                )
                in (
                    exam.get(
                        "aggregate"
                    )
                    or {}
                ).items()
            )

            lines.append(
                (
                    f"ID="
                    f"{exam.get('id')} "
                    f"| Tên="
                    f"{exam.get('title')} "
                    f"| Môn="
                    f"{exam.get('subject', '')} "
                    f"| "
                    f"{exam.get('duration', 0)} "
                    f"phút | "
                    f"{exam.get('questionCount', 0)} "
                    f"câu | Trạng thái="
                    f"{exam.get('status', '')}"
                )
                + (
                    (
                        " | Kết quả của "
                        "người dùng="
                        f"{results}"
                    )
                    if results
                    else ""
                )
                + (
                    (
                        " | Thống kê bài "
                        "giáo viên phụ trách="
                        f"{aggregate}"
                    )
                    if aggregate
                    else ""
                )
            )

        sections.append(
            "BÀI THI VÀ KẾT QUẢ "
            "ĐƯỢC PHÉP XEM:\n"
            + "\n".join(
                f"- {line}"
                for line
                in lines
            )
        )

    if context.get(
        "classes"
    ):
        lines = []

        for item in context[
            "classes"
        ]:
            subjects = "; ".join(
                (
                    f"{subject['name']} "
                    "(bài kiểm tra: "
                    f"{', '.join(test['name'] for test in subject['tests']) or 'chưa có'}; "
                    + (
                        (
                            "điểm của người dùng="
                            f"{subject.get('scores')}, "
                            "trung bình="
                            f"{subject.get('average')}"
                        )
                        if not item.get(
                            "owned"
                        )
                        else (
                            "số dòng điểm="
                            f"{subject.get('studentRows')}, "
                            "trung bình lớp="
                            f"{subject.get('average')}"
                        )
                    )
                    + ")"
                )
                for subject
                in (
                    item.get(
                        "subjects"
                    )
                    or []
                )
            )

            lines.append(
                (
                    f"ID="
                    f"{item.get('id')} "
                    f"| Lớp="
                    f"{item.get('name')} "
                    f"| Khối="
                    f"{item.get('grade', '')} "
                    f"| Sĩ số="
                    f"{item.get('studentCount', 0)} "
                    f"| Môn="
                    f"{subjects or 'chưa có'}"
                )
            )

        sections.append(
            "LỚP, MÔN VÀ ĐIỂM "
            "ĐƯỢC PHÉP XEM:\n"
            + "\n".join(
                f"- {line}"
                for line
                in lines
            )
        )

    if context.get(
        "forumPosts"
    ):
        sections.append(
            "BÀI VIẾT DIỄN ĐÀN "
            "ĐƯỢC PHÉP XEM:\n"
            + "\n".join(
                (
                    f"- ID="
                    f"{post.get('id')} "
                    f"| {post.get('title')} "
                    f"| {post.get('content', '')} "
                    f"| tags="
                    f"{', '.join(post.get('tags') or [])} "
                    f"| có thể trả lời="
                    f"{post.get('canReply', False)}"
                )
                for post
                in context[
                    "forumPosts"
                ]
            )
        )

    if len(
        sections
    ) == 1:
        sections.append(
            "Không có dữ liệu phù hợp "
            "với câu hỏi/trang hiện tại."
        )

    return "\n".join(
        sections
    )


def get_contextual_actions(
    message,
    context,
    limit=4,
):
    normalized = _text(
        message
    ).lower()

    actions = []

    asks_database = any(
        word in normalized
        for word in (
            "database",
            "cơ sở dữ liệu",
            "phân tích toàn bộ",
            "tổng quan của tôi",
        )
    )

    if asks_database:
        if context.get(
            "courses"
        ):
            item = context[
                "courses"
            ][0]

            actions.append({
                "id": (
                    f"open_course_"
                    f"{item['id']}"
                ),
                "label": (
                    f"Mở "
                    f"{item['title'][:42]}"
                ),
                "type": "navigate",
                "target": (
                    f"/courses/"
                    f"{item['id']}"
                ),
            })

        if context.get(
            "exams"
        ):
            item = context[
                "exams"
            ][0]

            result = bool(
                item.get(
                    "results"
                )
            )

            actions.append({
                "id": (
                    f"open_exam_"
                    f"{item['id']}_"
                    f"{'result' if result else 'detail'}"
                ),
                "label": (
                    f"{'Xem kết quả' if result else 'Mở'} "
                    f"{item['title'][:36]}"
                ),
                "type": "navigate",
                "target": (
                    f"/exam/"
                    f"{item['id']}/result"
                    if result
                    else (
                        f"/exam/"
                        f"{item['id']}"
                    )
                ),
            })

        if context.get(
            "classes"
        ):
            actions.append({
                "id": (
                    "open_classes_context"
                ),
                "label": (
                    "Mở lớp học"
                ),
                "type": (
                    "navigate"
                ),
                "target": (
                    "/classes"
                ),
            })

        if context.get(
            "forumPosts"
        ):
            actions.append({
                "id": (
                    "open_forum_context"
                ),
                "label": (
                    "Mở diễn đàn"
                ),
                "type": (
                    "navigate"
                ),
                "target": (
                    "/Forum"
                ),
            })

    if any(
        word in normalized
        for word in (
            "khóa học",
            "bài học",
            "bài giảng",
            "học gì",
            "học nào",
            "course",
        )
    ):
        courses = sorted(
            context.get(
                "courses"
            )
            or [],
            key=lambda item: (
                0
                if _normalize(
                    item.get(
                        "title"
                    )
                )
                in _normalize(
                    message
                )
                else 1,
                item.get(
                    "progress",
                    0,
                ),
            ),
        )

        actions.extend(
            {
                "id": (
                    f"open_course_"
                    f"{item['id']}"
                ),
                "label": (
                    f"Mở "
                    f"{item['title'][:42]}"
                ),
                "type": "navigate",
                "target": (
                    f"/courses/"
                    f"{item['id']}"
                ),
            }
            for item
            in courses[:limit]
        )

    if any(
        word in normalized
        for word in (
            "bài thi",
            "đề thi",
            "kết quả",
            "điểm thi",
            "exam",
        )
    ):
        for item in (
            context.get(
                "exams"
            )
            or []
        )[:limit]:
            result = bool(
                item.get(
                    "results"
                )
            )

            actions.append({
                "id": (
                    f"open_exam_"
                    f"{item['id']}_"
                    f"{'result' if result else 'detail'}"
                ),
                "label": (
                    f"{'Xem kết quả' if result else 'Mở'} "
                    f"{item['title'][:36]}"
                ),
                "type": (
                    "navigate"
                ),
                "target": (
                    f"/exam/"
                    f"{item['id']}/result"
                    if result
                    else (
                        f"/exam/"
                        f"{item['id']}"
                    )
                ),
            })

    if (
        any(
            word in normalized
            for word in (
                "lớp học",
                "bảng điểm",
                "môn học",
                "class",
            )
        )
        and context.get(
            "classes"
        )
    ):
        actions.append({
            "id": (
                "open_classes_context"
            ),
            "label": (
                "Mở lớp học"
            ),
            "type": (
                "navigate"
            ),
            "target": (
                "/classes"
            ),
        })

    if (
        any(
            word in normalized
            for word in (
                "diễn đàn",
                "bài viết",
                "thảo luận",
                "forum",
            )
        )
        and context.get(
            "forumPosts"
        )
    ):
        actions.append({
            "id": (
                "open_forum_context"
            ),
            "label": (
                "Mở diễn đàn"
            ),
            "type": (
                "navigate"
            ),
            "target": (
                "/Forum"
            ),
        })

    output = []

    seen = set()

    for action in actions:
        if action[
            "id"
        ] not in seen:
            output.append(
                action
            )

            seen.add(
                action[
                    "id"
                ]
            )

        if len(
            output
        ) >= limit:
            break

    return output
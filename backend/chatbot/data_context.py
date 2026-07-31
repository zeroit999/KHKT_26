import re

from auth.auth import db


LIMITS = {"courses": 24, "lessons": 12, "exams": 20, "classes": 10, "subjects": 8, "posts": 16}


def _text(value, limit=500):
    return str(value or "").replace("\x00", "").strip()[:limit]


def _list(value):
    return value if isinstance(value, list) else []


def _normalize(value):
    return re.sub(r"\s+", "", _text(value).lower())


def _number(value, default=0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _role(user):
    return _text((user or {}).get("role")).upper()


def _is_admin(user):
    return _role(user) in {"ADMIN", "ADMINDEV", "ADMIN_DEV"}


def _is_teacher(user):
    return _role(user) == "TEACHER" or _is_admin(user)


def _user_classes(user):
    values = [user.get("className"), user.get("class"), user.get("studentClass"), user.get("lop"), *_list(user.get("classes"))]
    return {_normalize(value) for value in values if _text(value)}


def _user_class_ids(user):
    return {_text(value) for value in _list(user.get("classIds")) if _text(value)}


def _owner_ids(data):
    return {
        _text(data.get("teacherId")), _text(data.get("createdByUid")), _text(data.get("ownerId")),
        *[_text(value) for value in _list(data.get("teacherIds"))],
        *[_text(value) for value in _list(data.get("coTeacherIds"))],
    }


def _can_read_course(user, course):
    uid = _text(user.get("uid"))
    class_locked = course.get("visibility") == "private" or course.get("accessMode") == "class_locked"
    if _is_teacher(user) and (_is_admin(user) or uid in _owner_ids(course) or not class_locked):
        return True
    if not class_locked:
        return True
    allowed_names = {
        _normalize(course.get("className")),
        *[_normalize(value) for value in _list(course.get("classNames"))],
        *[_normalize(value) for value in _list(course.get("allowedClasses"))],
    }
    allowed_names.discard("")
    allowed_ids = {_text(value) for value in _list(course.get("allowedClassIds")) if _text(value)}
    return bool(allowed_names.intersection(_user_classes(user)) or allowed_ids.intersection(_user_class_ids(user)))


def _can_read_exam(user, exam):
    uid = _text(user.get("uid"))
    if _is_admin(user) or (_is_teacher(user) and uid in _owner_ids(exam)):
        return True
    if _is_teacher(user):
        return False
    status = _text(exam.get("status") or "public").lower()
    class_names = {_normalize(value) for value in _list(exam.get("selectedClasses") or exam.get("targetClasses")) if _text(value)}
    grades = {_normalize(value) for value in _list(exam.get("selectedGrades") or exam.get("targetGrades")) if _text(value)}
    user_grades = {_normalize(user.get("grade")), _normalize(user.get("studentGrade"))} - {""}
    if status != "public" and not class_names:
        return False
    if grades and not grades.intersection(user_grades):
        return False
    return not class_names or bool(class_names.intersection(_user_classes(user)))


def _can_read_class(user, class_id, data):
    uid = _text(user.get("uid"))
    if _is_admin(user) or (_is_teacher(user) and uid in _owner_ids(data)):
        return True
    if _is_teacher(user):
        return False
    members = { *[_text(value) for value in _list(data.get("studentIds"))], *[_text(value) for value in _list(data.get("memberIds"))] }
    return bool(
        uid in members or _text(class_id) in _user_class_ids(user)
        or _normalize(class_id) in _user_classes(user)
        or _normalize(data.get("name") or data.get("className")) in _user_classes(user)
    )


def _selected_domains(message, path):
    value = f"{_text(message, 1200)} {_text(path, 300)}".lower()
    all_data = any(term in value for term in (
        "database", "cơ sở dữ liệu", "dữ liệu của tôi", "tổng quan của tôi", "tôi có gì", "phân tích toàn bộ", "thống kê của tôi",
    ))
    domains = {"learning"}
    rules = {
        "courses": (
            r"/(?:courses|e-learning|learn)",
            ("khóa học", "bài học", "bài giảng", "học gì", "học nào", "học tiếp", "course", "lesson"),
        ),
        "exams": (r"/(?:exams|exam/)", ("bài thi", "đề thi", "kết quả thi", "điểm thi", "lần làm", "exam")),
        "classes": (r"/(?:classes|learning/classes)", ("lớp học", "môn học", "bảng điểm", "học sinh", "giáo viên", "class")),
        "forum": (r"/forum", ("diễn đàn", "bài viết", "thảo luận", "forum", "cộng đồng")),
    }
    for domain, (pattern, keywords) in rules.items():
        if all_data or re.search(pattern, path, re.I) or any(keyword in value for keyword in keywords):
            domains.add(domain)
    return domains


def _load_learning(uid):
    if not uid:
        return {}, {}
    try:
        root = db.collection("learningStats").document(uid).get()
        stats = (root.to_dict() or {}) if root.exists else {}
        progress = {doc.id: doc.to_dict() or {} for doc in db.collection("learningStats").document(uid).collection("courses").stream()}
        return {
            "watchedLessons": int(stats.get("watchedLessons") or 0),
            "watchedCourses": int(stats.get("watchedCourses") or len(progress)),
            "streak": int(stats.get("streak") or stats.get("learningStreak") or 0),
            "activeDays": len(_list(stats.get("watchedDates"))),
            "courseProgressCount": len(progress),
        }, progress
    except Exception as error:
        print("CHATBOT LEARNING CONTEXT ERROR:", error)
        return {}, {}


def _lesson_summary(lesson, index):
    return {
        "number": index + 1,
        "title": _text(lesson.get("title") or f"Bài {index + 1}", 160),
        "summary": _text(lesson.get("content") or lesson.get("description") or lesson.get("fileExtractedText"), 700),
        "format": _text(lesson.get("attachMode") or "document", 40),
    }


def _course_summary(course_id, course, progress=None, detailed=False):
    lessons = _list(course.get("lessons"))
    lesson_limit = LIMITS["lessons"] if detailed else 5
    return {
        "id": course_id, "title": _text(course.get("title") or "Khóa học chưa đặt tên", 180),
        "topic": _text(course.get("topic"), 180), "subject": _text(course.get("subject") or course.get("category"), 100),
        "description": _text(course.get("description"), 900 if detailed else 350), "teacher": _text(course.get("teacherName"), 120),
        "lessonCount": int(course.get("lessonCount") or len(lessons) or 0), "progress": int((progress or {}).get("progress") or 0),
        "lessons": [_lesson_summary(lesson, index) for index, lesson in enumerate(lessons[:lesson_limit]) if isinstance(lesson, dict)],
    }


def _extract_id(path, pattern):
    match = re.match(pattern, _text(path, 300), re.I)
    return match.group(1) if match else ""


def _load_courses(user, path, progress):
    requested_id = _extract_id(path, r"^/(?:e-learning|courses|learn)/([^/?#]+)")
    courses = []
    try:
        docs = [db.collection("courses").document(requested_id).get()] if requested_id else db.collection("courses").limit(80).stream()
        for doc in docs:
            if doc.exists:
                data = doc.to_dict() or {}
                if _can_read_course(user, data):
                    courses.append(_course_summary(doc.id, data, progress.get(doc.id), bool(requested_id)))
            if len(courses) >= LIMITS["courses"]:
                break
    except Exception as error:
        print("CHATBOT COURSE CONTEXT ERROR:", error)
    return courses


def _load_results(exam_ref, user, owned):
    uid = _text(user.get("uid"))
    rows, scores = [], []
    try:
        for doc in exam_ref.collection("results").stream():
            data = doc.to_dict() or {}
            if not owned and _text(data.get("studentId") or data.get("userId")) != uid:
                continue
            score = _number(data.get("score"))
            scores.append(score)
            rows.append({
                "id": doc.id, "score": score, "totalScore": _number(data.get("totalScore"), 10),
                "correctCount": int(data.get("correctCount") or 0),
                "wrongCount": len(_list(data.get("wrongQuestions"))) or int(data.get("wrongCount") or 0),
                "answeredCount": int(data.get("answeredCount") or 0),
                "violationCount": int(data.get("totalViolations") or (data.get("proctoring") or {}).get("totalViolations") or 0),
            })
    except Exception as error:
        print("CHATBOT EXAM RESULT CONTEXT ERROR:", error)
    aggregate = {}
    if owned:
        aggregate = {
            "submissionCount": len(scores), "averageScore": round(sum(scores) / len(scores), 2) if scores else 0,
            "highestScore": max(scores) if scores else 0, "lowestScore": min(scores) if scores else 0,
        }
        rows = []
    return rows[-5:], aggregate


def _load_exams(user, path):
    requested_id = _extract_id(path, r"^/exam/([^/?#]+)(?:/result)?/?$")
    exams, result_count = [], 0
    try:
        docs = [db.collection("exams").document(requested_id).get()] if requested_id else db.collection("exams").limit(80).stream()
        for doc in docs:
            if not doc.exists:
                continue
            data = doc.to_dict() or {}
            if not _can_read_exam(user, data):
                continue
            owned = _is_admin(user) or (_is_teacher(user) and _text(user.get("uid")) in _owner_ids(data))
            results, aggregate = _load_results(doc.reference, user, owned)
            result_count += aggregate.get("submissionCount", len(results))
            exams.append({
                "id": doc.id, "title": _text(data.get("title") or "Bài thi chưa đặt tên", 180),
                "subject": _text(data.get("subject"), 100), "description": _text(data.get("description"), 400),
                "duration": int(data.get("duration") or 0), "questionCount": int(data.get("questionCount") or 0),
                "totalScore": _number(data.get("totalScore"), 10), "status": _text(data.get("status"), 40),
                "maxAttempts": int(data.get("maxAttempts") or 1), "results": results, "aggregate": aggregate,
            })
            if len(exams) >= LIMITS["exams"]:
                break
    except Exception as error:
        print("CHATBOT EXAM CONTEXT ERROR:", error)
    return exams, result_count


def _score_values(rows):
    values = []
    for row in rows:
        scores = row.get("scores") or {}
        raw_values = scores.values() if isinstance(scores, dict) else scores if isinstance(scores, list) else []
        values.extend(_number(value, None) for value in raw_values)
    return [value for value in values if value is not None]


def _load_subjects(class_ref, user, owned):
    subjects = []
    try:
        for doc in class_ref.collection("subjects").limit(LIMITS["subjects"]).stream():
            data = doc.to_dict() or {}
            tests = [{"id": test.id, "name": _text((test.to_dict() or {}).get("name"), 120)} for test in doc.reference.collection("tests").limit(20).stream()]
            if owned:
                rows = [row.to_dict() or {} for row in doc.reference.collection("scores").stream()]
                values = _score_values(rows)
                score_data = {"studentRows": len(rows), "scoreEntries": len(values), "average": round(sum(values) / len(values), 2) if values else 0}
            else:
                score_doc = doc.reference.collection("scores").document(_text(user.get("uid"))).get()
                row = (score_doc.to_dict() or {}) if score_doc.exists else {}
                score_data = {"scores": row.get("scores") if isinstance(row.get("scores"), dict) else {}, "average": _number(row.get("average"), None)}
            subjects.append({"id": doc.id, "name": _text(data.get("name") or doc.id, 120), "tests": tests, **score_data})
    except Exception as error:
        print("CHATBOT CLASS SUBJECT CONTEXT ERROR:", error)
    return subjects


def _load_classes(user):
    classes = []
    try:
        for doc in db.collection("classes").limit(60).stream():
            data = doc.to_dict() or {}
            if not _can_read_class(user, doc.id, data):
                continue
            owned = _is_admin(user) or (_is_teacher(user) and _text(user.get("uid")) in _owner_ids(data))
            student_count = int(data.get("studentCount") or len(_list(data.get("studentIds"))) or 0)
            if owned and not student_count:
                try:
                    student_count = sum(1 for _ in doc.reference.collection("students").stream())
                except Exception:
                    pass
            classes.append({
                "id": doc.id, "name": _text(data.get("name") or data.get("className") or doc.id, 120),
                "grade": _text(data.get("grade"), 30), "schoolYear": _text(data.get("schoolYear"), 30),
                "studentCount": student_count, "subjects": _load_subjects(doc.reference, user, owned), "owned": owned,
            })
            if len(classes) >= LIMITS["classes"]:
                break
    except Exception as error:
        print("CHATBOT CLASS CONTEXT ERROR:", error)
    return classes


def _load_forum(user):
    uid, joined = _text(user.get("uid")), set()
    try:
        for doc in db.collection("forumGroups").limit(80).stream():
            data = doc.to_dict() or {}
            if uid in {_text(value) for value in _list(data.get("memberIds"))} or uid == _text(data.get("ownerId")) or _is_admin(user):
                joined.add(doc.id)
    except Exception as error:
        print("CHATBOT FORUM GROUP CONTEXT ERROR:", error)
    posts = []
    try:
        for doc in db.collection("forumPosts").limit(120).stream():
            data = doc.to_dict() or {}
            if _text(data.get("status") or "approved").lower() != "approved":
                continue
            scope = _text(data.get("scope") or "hall").lower()
            if scope == "group" and _text(data.get("groupId")) not in joined:
                continue
            teacher_only = bool(data.get("teacherOnly"))
            posts.append({
                "id": doc.id, "title": _text(data.get("title") or "Bài viết chưa đặt tên", 180),
                "content": _text(data.get("content"), 700), "type": _text(data.get("type"), 40),
                "tags": [_text(value, 50) for value in _list(data.get("tags"))[:8]], "scope": scope,
                "groupName": _text(data.get("groupName"), 120), "teacherOnly": teacher_only,
                "canReply": not teacher_only or _is_teacher(user), "commentsCount": int(data.get("commentsCount") or 0),
            })
            if len(posts) >= LIMITS["posts"]:
                break
    except Exception as error:
        print("CHATBOT FORUM CONTEXT ERROR:", error)
    return posts


def build_platform_context(current_user, page_context=None, message=""):
    empty = {
        "authenticated": False, "profile": {}, "learning": {}, "courses": [], "exams": [], "classes": [], "forumPosts": [],
        "courseCount": 0, "lessonCount": 0, "examCount": 0, "resultCount": 0, "classCount": 0, "forumPostCount": 0,
    }
    if not current_user:
        return empty
    page_context = page_context or {}
    path, uid = _text(page_context.get("path") or "/", 300), _text(current_user.get("uid"))
    profile = {
        "name": _text(current_user.get("name") or current_user.get("fullName"), 120), "role": _text(current_user.get("role"), 40),
        "grade": _text(current_user.get("grade") or current_user.get("studentGrade"), 30),
        "className": _text(current_user.get("className") or current_user.get("studentClass"), 80),
        "subject": _text(current_user.get("subject") or current_user.get("teacherSubject"), 100), "school": _text(current_user.get("school"), 160),
    }
    if re.match(r"^/exam/[^/]+/?$", path, re.I):
        return {**empty, "authenticated": True, "profile": profile, "restricted": True}
    domains = _selected_domains(message, path)
    learning, progress = _load_learning(uid)
    courses = _load_courses(current_user, path, progress) if "courses" in domains else []
    exams, result_count = _load_exams(current_user, path) if "exams" in domains else ([], 0)
    classes = _load_classes(current_user) if "classes" in domains else []
    posts = _load_forum(current_user) if "forum" in domains else []
    return {
        "authenticated": True, "profile": profile, "learning": learning, "courses": courses, "exams": exams,
        "classes": classes, "forumPosts": posts, "courseCount": len(courses),
        "lessonCount": sum(course.get("lessonCount", 0) for course in courses), "examCount": len(exams),
        "resultCount": result_count, "classCount": len(classes), "forumPostCount": len(posts),
        "loadedDomains": sorted(domains), "restricted": False,
    }


def format_platform_context(context):
    context = context or {}
    if not context.get("authenticated"):
        return "Người dùng chưa đăng nhập; không có dữ liệu cá nhân."
    profile = context.get("profile") or {}
    profile_text = ", ".join(f"{key}={value}" for key, value in profile.items() if _text(value)) or "chưa có dữ liệu hồ sơ"
    if context.get("restricted"):
        return f"Hồ sơ: {profile_text}. Phòng thi đang bật chế độ giới hạn dữ liệu; không được suy đoán nội dung hoặc đáp án."
    sections = [f"Hồ sơ người dùng: {profile_text}"]
    if context.get("learning"):
        sections.append("THỐNG KÊ HỌC TẬP CÁ NHÂN: " + ", ".join(f"{key}={value}" for key, value in context["learning"].items()))
    if context.get("courses"):
        lines = []
        for course in context["courses"]:
            lessons = "; ".join(f"Bài {item['number']} {item['title']}: {item['summary']}" for item in course.get("lessons") or [])
            lines.append(
                f"ID={course.get('id')} | Tên={course.get('title')} | Môn={course.get('subject', '')} | "
                f"Mô tả={course.get('description', '')} | Giáo viên={course.get('teacher', '')} | "
                f"Tiến độ={course.get('progress', 0)}%" + (f" | Bài giảng={lessons}" if lessons else "")
            )
        sections.append("KHÓA HỌC VÀ BÀI GIẢNG ĐƯỢC PHÉP XEM:\n" + "\n".join(f"- {line}" for line in lines))
    if context.get("exams"):
        lines = []
        for exam in context["exams"]:
            results = "; ".join(
                f"điểm {item.get('score', 0)}/{item.get('totalScore', exam.get('totalScore', 10))}, "
                f"đúng {item.get('correctCount', 0)}, sai {item.get('wrongCount', 0)}, "
                f"vi phạm {item.get('violationCount', 0)}"
                for item in exam.get("results") or []
            )
            aggregate = ", ".join(f"{key}={value}" for key, value in (exam.get("aggregate") or {}).items())
            lines.append(
                f"ID={exam.get('id')} | Tên={exam.get('title')} | Môn={exam.get('subject', '')} | "
                f"{exam.get('duration', 0)} phút | {exam.get('questionCount', 0)} câu | Trạng thái={exam.get('status', '')}"
                + (f" | Kết quả của người dùng={results}" if results else "")
                + (f" | Thống kê bài giáo viên phụ trách={aggregate}" if aggregate else "")
            )
        sections.append("BÀI THI VÀ KẾT QUẢ ĐƯỢC PHÉP XEM:\n" + "\n".join(f"- {line}" for line in lines))
    if context.get("classes"):
        lines = []
        for item in context["classes"]:
            subjects = "; ".join(
                f"{subject['name']} (bài kiểm tra: {', '.join(test['name'] for test in subject['tests']) or 'chưa có'}; "
                + (f"điểm của người dùng={subject.get('scores')}, trung bình={subject.get('average')}" if not item.get("owned") else f"số dòng điểm={subject.get('studentRows')}, trung bình lớp={subject.get('average')}") + ")"
                for subject in item.get("subjects") or []
            )
            lines.append(
                f"ID={item.get('id')} | Lớp={item.get('name')} | Khối={item.get('grade', '')} | "
                f"Sĩ số={item.get('studentCount', 0)} | Môn={subjects or 'chưa có'}"
            )
        sections.append("LỚP, MÔN VÀ ĐIỂM ĐƯỢC PHÉP XEM:\n" + "\n".join(f"- {line}" for line in lines))
    if context.get("forumPosts"):
        sections.append("BÀI VIẾT DIỄN ĐÀN ĐƯỢC PHÉP XEM:\n" + "\n".join(
            f"- ID={post.get('id')} | {post.get('title')} | {post.get('content', '')} | "
            f"tags={', '.join(post.get('tags') or [])} | có thể trả lời={post.get('canReply', False)}"
            for post in context["forumPosts"]
        ))
    if len(sections) == 1:
        sections.append("Không có dữ liệu phù hợp với câu hỏi/trang hiện tại.")
    return "\n".join(sections)


def get_contextual_actions(message, context, limit=4):
    normalized, actions = _text(message).lower(), []
    asks_database = any(word in normalized for word in ("database", "cơ sở dữ liệu", "phân tích toàn bộ", "tổng quan của tôi"))
    if asks_database:
        if context.get("courses"):
            item = context["courses"][0]
            actions.append({"id": f"open_course_{item['id']}", "label": f"Mở {item['title'][:42]}", "type": "navigate", "target": f"/courses/{item['id']}"})
        if context.get("exams"):
            item = context["exams"][0]
            result = bool(item.get("results"))
            actions.append({
                "id": f"open_exam_{item['id']}_{'result' if result else 'detail'}", "label": f"{'Xem kết quả' if result else 'Mở'} {item['title'][:36]}",
                "type": "navigate", "target": f"/exam/{item['id']}/result" if result else f"/exam/{item['id']}",
            })
        if context.get("classes"):
            actions.append({"id": "open_classes_context", "label": "Mở lớp học", "type": "navigate", "target": "/classes"})
        if context.get("forumPosts"):
            actions.append({"id": "open_forum_context", "label": "Mở diễn đàn", "type": "navigate", "target": "/Forum"})
    if any(word in normalized for word in ("khóa học", "bài học", "bài giảng", "học gì", "học nào", "course")):
        courses = sorted(context.get("courses") or [], key=lambda item: (0 if _normalize(item.get("title")) in _normalize(message) else 1, item.get("progress", 0)))
        actions.extend({"id": f"open_course_{item['id']}", "label": f"Mở {item['title'][:42]}", "type": "navigate", "target": f"/courses/{item['id']}"} for item in courses[:limit])
    if any(word in normalized for word in ("bài thi", "đề thi", "kết quả", "điểm thi", "exam")):
        for item in (context.get("exams") or [])[:limit]:
            result = bool(item.get("results"))
            actions.append({
                "id": f"open_exam_{item['id']}_{'result' if result else 'detail'}", "label": f"{'Xem kết quả' if result else 'Mở'} {item['title'][:36]}",
                "type": "navigate", "target": f"/exam/{item['id']}/result" if result else f"/exam/{item['id']}",
            })
    if any(word in normalized for word in ("lớp học", "bảng điểm", "môn học", "class")) and context.get("classes"):
        actions.append({"id": "open_classes_context", "label": "Mở lớp học", "type": "navigate", "target": "/classes"})
    if any(word in normalized for word in ("diễn đàn", "bài viết", "thảo luận", "forum")) and context.get("forumPosts"):
        actions.append({"id": "open_forum_context", "label": "Mở diễn đàn", "type": "navigate", "target": "/Forum"})
    output, seen = [], set()
    for action in actions:
        if action["id"] not in seen:
            output.append(action)
            seen.add(action["id"])
        if len(output) >= limit:
            break
    return output

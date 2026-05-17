# backend/exams/exam_service.py

from firebase_admin import firestore
from exams.exam_scoring import calculate_exam_score

db = firestore.client()


# =========================
# ROLE HELPERS
# =========================

def normalize_role(value):
    return str(value or "").strip().lower().replace(" ", "_")


def is_student_role(role):
    """
    Học sinh:
    - STUDENT
    - user
    - student
    """
    normalized = normalize_role(role)

    return normalized in [
        "student",
        "user",
    ]


def is_teacher_role(role):
    """
    Giáo viên:
    - TEACHER
    - Admin user
    - admin_user
    """
    normalized = normalize_role(role)

    return normalized in [
        "teacher",
        "admin_user",
    ]


def is_admin_role(role):
    """
    Admin hệ thống:
    - Admin_Dev
    - admin_dev
    """
    normalized = normalize_role(role)

    return normalized in [
        "admin_dev",
    ]


def can_manage_exams(role):
    """
    Giáo viên và Admin được quản lý đề thi.
    """
    return is_teacher_role(role) or is_admin_role(role)


# =========================
# EXAM READ HELPERS
# =========================

def get_exam_with_questions(exam_id):
    exam_ref = db.collection("exams").document(exam_id)
    exam_snap = exam_ref.get()

    if not exam_snap.exists:
        raise Exception("Không tìm thấy bài thi")

    exam = exam_snap.to_dict()
    exam["id"] = exam_snap.id

    question_docs = (
        exam_ref
        .collection("questions")
        .order_by("order")
        .stream()
    )

    questions = []

    for question_doc in question_docs:
        question = question_doc.to_dict()
        question["id"] = question_doc.id
        questions.append(question)

    exam["questions"] = questions

    return exam


def get_user_profile(user_id):
    user_snap = db.collection("users").document(user_id).get()

    if not user_snap.exists:
        return None

    user_data = user_snap.to_dict()
    user_data["id"] = user_snap.id

    return user_data


def get_attempt_count(exam_id, student_id):
    attempt_ref = (
        db.collection("exams")
        .document(exam_id)
        .collection("attempts")
        .document(student_id)
    )

    attempt_snap = attempt_ref.get()

    if not attempt_snap.exists:
        return 0

    return int(attempt_snap.to_dict().get("count", 0) or 0)


def get_max_attempts(exam):
    attempt_mode = exam.get("attemptMode", "once")

    if attempt_mode == "multiple":
        return int(exam.get("maxAttempts", 1) or 1)

    return 1


def get_attempts_left(exam, student_id):
    attempt_count = get_attempt_count(exam["id"], student_id)
    max_attempts = get_max_attempts(exam)

    return max(0, max_attempts - attempt_count)


# =========================
# PERMISSION HELPERS
# =========================

def normalize_class_name(value):
    return str(value or "").strip().lower()


def get_user_class_names(user_data):
    """
    Dự phòng nhiều field vì frontend hiện tại có thể đang dùng:
    className, class, lop, grade, studentClass...
    """
    values = [
        user_data.get("className"),
        user_data.get("class"),
        user_data.get("lop"),
        user_data.get("grade"),
        user_data.get("studentClass"),
        user_data.get("classId"),
        user_data.get("classNameText"),
    ]

    return [
        str(value).strip()
        for value in values
        if str(value or "").strip()
    ]


def student_can_access_exam(exam, user_data):
    """
    Bài công khai: học sinh nào cũng làm được.
    Bài riêng tư: học sinh phải thuộc lớp được chọn.
    """
    exam_status = exam.get("status", "public")

    if exam_status == "public":
        return True

    selected_classes = exam.get("selectedClasses") or []

    if not selected_classes:
        return False

    student_classes = get_user_class_names(user_data)

    normalized_student_classes = [
        normalize_class_name(item)
        for item in student_classes
    ]

    for class_name in selected_classes:
        if normalize_class_name(class_name) in normalized_student_classes:
            return True

    return False


def assert_student_can_submit_exam(current_user, exam):
    student_id = current_user.get("uid")
    role = current_user.get("role")

    if not student_id:
        raise Exception("Bạn chưa đăng nhập")

    if not is_student_role(role):
        raise Exception("Chỉ học sinh mới được nộp bài thi")

    user_data = get_user_profile(student_id)

    if not user_data:
        raise Exception("Không tìm thấy thông tin học sinh")

    if not student_can_access_exam(exam, user_data):
        raise Exception("Bạn không có quyền làm bài thi này")

    attempts_left = get_attempts_left(exam, student_id)

    if attempts_left <= 0:
        raise Exception("Bạn đã hết số lượt làm bài thi này")


# =========================
# MAIN SERVICES
# =========================

def submit_exam(current_user, exam_id, payload):
    """
    Backend xử lý toàn bộ:
    - kiểm tra quyền học sinh
    - kiểm tra bài thi
    - kiểm tra lượt làm
    - chấm điểm
    - lưu kết quả
    - tăng số lượt làm
    """
    student_id = current_user.get("uid")
    role = current_user.get("role")

    exam = get_exam_with_questions(exam_id)

    assert_student_can_submit_exam(current_user, exam)

    attempt_count = get_attempt_count(exam_id, student_id)
    max_attempts = get_max_attempts(exam)

    answers = payload.get("answers") or {}
    text_answers = payload.get("textAnswers") or {}

    scoring = calculate_exam_score(
        exam.get("questions", []),
        answers,
        text_answers,
    )

    result_data = {
        "studentId": student_id,
        "role": normalize_role(role),
        "originalRole": role,
        "score": scoring["score"],
        "answers": answers,
        "textAnswers": text_answers,
        "wrongQuestions": scoring["wrongQuestions"],
        "totalQuestions": scoring["totalQuestions"],
        "answeredCount": scoring["answeredCount"],
        "createdAt": firestore.SERVER_TIMESTAMP,
    }

    result_ref = (
        db.collection("exams")
        .document(exam_id)
        .collection("results")
        .document()
    )

    result_ref.set(result_data)

    attempt_ref = (
        db.collection("exams")
        .document(exam_id)
        .collection("attempts")
        .document(student_id)
    )

    next_attempt_count = attempt_count + 1

    attempt_ref.set(
        {
            "studentId": student_id,
            "count": next_attempt_count,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        merge=True,
    )

    return {
        "success": True,
        "resultId": result_ref.id,
        "score": scoring["score"],
        "answeredCount": scoring["answeredCount"],
        "totalQuestions": scoring["totalQuestions"],
        "wrongQuestions": scoring["wrongQuestions"],
        "attemptCount": next_attempt_count,
        "attemptsLeft": max(0, max_attempts - next_attempt_count),
    }


def get_my_result(current_user, exam_id):
    student_id = current_user.get("uid")
    role = current_user.get("role")

    if not student_id:
        raise Exception("Bạn chưa đăng nhập")

    if not is_student_role(role):
        raise Exception("Chỉ học sinh mới xem kết quả cá nhân theo API này")

    result_docs = (
        db.collection("exams")
        .document(exam_id)
        .collection("results")
        .where("studentId", "==", student_id)
        .stream()
    )

    results = []

    for result_doc in result_docs:
        item = result_doc.to_dict()
        item["id"] = result_doc.id
        results.append(item)

    results.sort(
        key=lambda item: item.get("createdAt").timestamp()
        if item.get("createdAt")
        else 0,
        reverse=True,
    )

    if not results:
        return {
            "success": True,
            "result": None,
        }

    return {
        "success": True,
        "result": results[0],
    }


def get_exam_results(current_user, exam_id):
    """
    Giáo viên và Admin xem danh sách bài làm học sinh.
    """
    role = current_user.get("role")

    if not can_manage_exams(role):
        raise Exception("Bạn không có quyền xem kết quả bài thi")

    result_docs = (
        db.collection("exams")
        .document(exam_id)
        .collection("results")
        .stream()
    )

    results = []

    for result_doc in result_docs:
        item = result_doc.to_dict()
        item["id"] = result_doc.id

        student_id = item.get("studentId")
        student_profile = get_user_profile(student_id) if student_id else None

        item["studentName"] = get_student_display_name(student_profile)

        results.append(item)

    results.sort(
        key=lambda item: item.get("createdAt").timestamp()
        if item.get("createdAt")
        else 0,
        reverse=True,
    )

    return {
        "success": True,
        "results": results,
    }


def get_student_display_name(user_data):
    if not user_data:
        return "Tên học sinh"

    return (
        user_data.get("displayName")
        or user_data.get("fullName")
        or user_data.get("name")
        or user_data.get("studentName")
        or user_data.get("email")
        or "Tên học sinh"
    )
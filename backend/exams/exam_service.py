from firebase_admin import firestore

from exams.exam_scoring import calculate_exam_score

db = firestore.client()


def is_teacher_or_admin(user):
    role = str(user.get("role", "")).strip()
    return role in ["TEACHER", "Admin_Dev", "ADMIN_DEV"]


def is_student(user):
    role = str(user.get("role", "")).strip()
    return role == "STUDENT"


def get_user_class_name(user):
    return (
        user.get("className")
        or user.get("class")
        or user.get("lop")
        or user.get("grade")
        or user.get("studentClass")
        or ""
    )


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
    status = exam_data.get("status", "public")
    selected_classes = exam_data.get("selectedClasses", [])
    student_class = get_user_class_name(current_user)

    is_public = status == "public"
    is_assigned = student_class and student_class in selected_classes

    return is_public or is_assigned


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

    exam_data = {
        **payload,
        "scoring": scoring,
        "questionCount": len(questions),
        "studentResultCount": 0,
        "teacherId": current_user.get("uid"),
        "teacherEmail": current_user.get("email"),
        "teacherName": current_user.get("name"),
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

    questions = payload.pop("questions", None)

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


def submit_exam(current_user, exam_id, payload):
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
        "scoring": scoring,
        **score_data,
        "createdAt": firestore.SERVER_TIMESTAMP,
    }

    result_ref.set(result_data)

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

    results = get_exam_results_data(exam_id)

    return {
        "success": True,
        "results": results,
    }

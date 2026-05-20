def normalize_text(value):
    return str(value or "").strip().lower()


def is_same_answer(student_value, correct_value):
    return normalize_text(student_value) == normalize_text(correct_value)


def get_selected_value(answers, question_id):
    if not isinstance(answers, dict):
        return None

    return answers.get(question_id)


def grade_multiple(question, answers, scoring):
    question_id = question.get("id")
    selected = get_selected_value(answers, question_id)

    correct_indexes = [
        index
        for index, answer in enumerate(question.get("answers", []))
        if answer.get("isCorrect")
    ]

    is_correct = selected in correct_indexes
    point = float(scoring.get("part1", {}).get("perQuestion", 0) or 0)

    if is_correct:
        return point, None

    correct_answer = ", ".join(chr(65 + index) for index in correct_indexes)

    return 0, {
        "question": question.get("question", ""),
        "correctAnswer": correct_answer,
        "teacherNote": question.get("explanation", ""),
    }


def grade_truefalse(question, answers, scoring):
    question_id = question.get("id")
    selected_map = get_selected_value(answers, question_id)

    if not isinstance(selected_map, dict):
        selected_map = {}

    correct_count = 0

    for index, answer in enumerate(question.get("answers", [])):
        correct_value = bool(answer.get("isCorrect"))
        selected_value = selected_map.get(str(index))

        if selected_value is None:
            selected_value = selected_map.get(index)

        if bool(selected_value) == correct_value:
            correct_count += 1

    part2 = scoring.get("part2", {}) or {}

    point_map = {
        0: 0,
        1: float(part2.get("oneCorrect", 0) or 0),
        2: float(part2.get("twoCorrect", 0) or 0),
        3: float(part2.get("threeCorrect", 0) or 0),
        4: float(part2.get("fourCorrect", 0) or 0),
    }

    point = point_map.get(correct_count, 0)

    if correct_count == 4:
        return point, None

    correct_answer = "; ".join(
        f"{index + 1}. {'Đúng' if answer.get('isCorrect') else 'Sai'}"
        for index, answer in enumerate(question.get("answers", []))
    )

    return point, {
        "question": question.get("question", ""),
        "correctAnswer": correct_answer,
        "teacherNote": question.get("explanation", ""),
    }


def grade_short_answer(question, text_answers, scoring):
    question_id = question.get("id")
    student_value = ""

    if isinstance(text_answers, dict):
        student_value = text_answers.get(question_id, "")

    correct_value = (
        question.get("correctAnswer")
        or question.get("answer")
        or question.get("expectedAnswer")
        or ""
    )

    is_correct = is_same_answer(student_value, correct_value)
    point = float(scoring.get("part3", {}).get("perQuestion", 0) or 0)

    if is_correct:
        return point, None

    return 0, {
        "question": question.get("question", ""),
        "correctAnswer": correct_value,
        "teacherNote": question.get("explanation", ""),
    }


def get_answered_count(questions, answers, text_answers):
    count = 0

    for question in questions:
        question_id = question.get("id")
        question_type = question.get("type", "multiple")

        if question_type in ["essay", "code", "short-answer", "short_answer"]:
            value = ""

            if isinstance(text_answers, dict):
                value = text_answers.get(question_id, "")

            if str(value).strip():
                count += 1

        elif question_type == "truefalse":
            value = answers.get(question_id) if isinstance(answers, dict) else None

            if isinstance(value, dict) and len(value.keys()) > 0:
                count += 1

        else:
            if (
                isinstance(answers, dict)
                and question_id in answers
                and answers.get(question_id) is not None
            ):
                count += 1

    return count


def calculate_exam_score(questions, answers, text_answers, scoring):
    wrong_questions = []
    score = 0

    for question in questions:
        question_type = question.get("type", "multiple")
        section = question.get("section", "part1")

        if section == "part1" or question_type == "multiple":
            point, wrong = grade_multiple(question, answers, scoring)

        elif section == "part2" or question_type == "truefalse":
            point, wrong = grade_truefalse(question, answers, scoring)

        elif section == "part3" or question_type in ["short-answer", "short_answer"]:
            point, wrong = grade_short_answer(question, text_answers, scoring)

        else:
            point, wrong = 0, None

        score += point

        if wrong:
            wrong_questions.append(wrong)

    answered_count = get_answered_count(questions, answers, text_answers)

    return {
        "score": round(score, 2),
        "wrongQuestions": wrong_questions,
        "answeredCount": answered_count,
        "totalQuestions": len(questions),
        "wrongCount": len(wrong_questions),
    }

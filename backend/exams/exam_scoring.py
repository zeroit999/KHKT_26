def calculate_exam_score(questions, answers, text_answers):
    wrong_questions = []
    multiple_questions = [
        question for question in questions
        if question.get("type", "multiple") == "multiple"
    ]

    for question in multiple_questions:
        question_id = question.get("id")
        selected_index = answers.get(question_id)

        correct_index = -1
        for index, answer in enumerate(question.get("answers", [])):
            if answer.get("isCorrect"):
                correct_index = index
                break

        if selected_index != correct_index:
            correct_answer = "Đang cập nhật"

            for answer in question.get("answers", []):
                if answer.get("isCorrect"):
                    correct_answer = answer.get("content", "Đang cập nhật")
                    break

            wrong_questions.append({
                "question": question.get("question", ""),
                "correctAnswer": correct_answer,
                "teacherNote": question.get("explanation", ""),
            })

    correct_count = len(multiple_questions) - len(wrong_questions)

    if len(multiple_questions) == 0:
        score = 0
    else:
        score = round((correct_count / len(multiple_questions)) * 10, 1)

    answered_count = get_answered_count(questions, answers, text_answers)

    return {
        "score": score,
        "wrongQuestions": wrong_questions,
        "answeredCount": answered_count,
        "totalQuestions": len(questions),
        "correctCount": correct_count,
        "wrongCount": len(wrong_questions),
    }


def get_answered_count(questions, answers, text_answers):
    count = 0

    for question in questions:
        question_id = question.get("id")
        question_type = question.get("type", "multiple")

        if question_type in ["essay", "code"]:
            value = str(text_answers.get(question_id, "")).strip()
            if value:
                count += 1

        elif question_type == "truefalse":
            value = answers.get(question_id)
            if isinstance(value, dict) and len(value.keys()) > 0:
                count += 1

        else:
            if question_id in answers and answers.get(question_id) is not None:
                count += 1

    return count
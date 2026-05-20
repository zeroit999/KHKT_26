import re
from docx import Document


SECTION_PATTERNS = [
    ("part4", r"PHẦN\s*(IV|4)(\s|\.|\-|:|$)"),
    ("part3", r"PHẦN\s*(III|3)(\s|\.|\-|:|$)"),
    ("part2", r"PHẦN\s*(II|2)(\s|\.|\-|:|$)"),
    ("part1", r"PHẦN\s*(I|1)(\s|\.|\-|:|$)"),
]


def normalize_space(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def create_id(prefix, index):
    return f"{prefix}_{index}"


def is_underlined_run(run):
    return bool(run.underline)


def split_segments(text):
    raw_parts = []

    for part in re.split(r"\t+", text or ""):
        part = normalize_space(part)
        if part:
            raw_parts.append(part)

    segments = []

    for part in raw_parts:
        items = re.split(
            r"(?=\b[A-D][\.\:]\s+|\b[a-d]\)\s+)",
            part,
        )

        for item in items:
            item = normalize_space(item)
            if item:
                segments.append(item)

    return segments


def read_segments(file_stream):
    document = Document(file_stream)
    segments = []

    for paragraph in document.paragraphs:
        text = paragraph.text or ""

        if not text.strip():
            continue

        underlined_text = normalize_space(
            " ".join(run.text for run in paragraph.runs if is_underlined_run(run))
        )

        for item in split_segments(text):
            segments.append({
                "text": item,
                "underlinedText": underlined_text,
            })

    return segments


def detect_section(text, current_section):
    upper = normalize_space(text).upper()

    for section, pattern in SECTION_PATTERNS:
        if re.search(pattern, upper):
            return section

    return current_section


def is_section_line(text):
    upper = normalize_space(text).upper()

    return any(re.search(pattern, upper) for _, pattern in SECTION_PATTERNS)


def is_question_line(text):
    return bool(re.match(r"^Câu\s+\d+[\.\:]\s*", text, flags=re.IGNORECASE))


def get_question_content(text):
    return normalize_space(
        re.sub(r"^Câu\s+\d+[\.\:]\s*", "", text, flags=re.IGNORECASE)
    )


def is_solution_line(text):
    return normalize_space(text).lower().startswith("bài giải:")


def get_solution_content(text):
    return normalize_space(re.sub(r"^Bài giải\:\s*", "", text, flags=re.IGNORECASE))


def is_numeric_answer_line(text):
    return bool(re.match(r"^Đáp\s*án\:\s*", text, flags=re.IGNORECASE))


def get_numeric_answer(text):
    return normalize_space(re.sub(r"^Đáp\s*án\:\s*", "", text, flags=re.IGNORECASE))


def is_answer_correct(label, content, underlined_text):
    underlined = normalize_space(underlined_text).lower()
    normalized_content = normalize_space(content).lower()

    if not underlined:
        return "đúng" in normalized_content and "sai" not in normalized_content

    if label.lower() in underlined:
        return True

    words = [
        word
        for word in re.split(r"\W+", normalized_content)
        if len(word) >= 3
    ]

    return any(word in underlined for word in words)


def parse_part1_answer(segment):
    text = segment["text"]

    match = re.match(r"^([A-D])\.\s*(.+)$", text, flags=re.IGNORECASE)

    if not match:
        return None

    label = match.group(1).upper()
    content = normalize_space(match.group(2))

    return {
        "label": label,
        "content": content,
        "answerType": "multiple",
        "isCorrect": is_answer_correct(
            label,
            content,
            segment.get("underlinedText", ""),
        ),
    }


def parse_part2_answer(segment):
    text = segment["text"]

    match = re.match(
        r"^([a-dA-D])\)\s*(Đúng|Sai)\s*[-\:]\s*(.+)$",
        text,
        flags=re.IGNORECASE,
    )

    if match:
        label = match.group(1).lower()
        status = normalize_space(match.group(2)).lower()
        content = normalize_space(match.group(3))

        return {
            "label": label,
            "content": content,
            "answerType": "truefalse",
            "isCorrect": status == "đúng",
        }

    fallback_patterns = [
        r"^([A-D])\:\s*(.+)$",
        r"^([a-d])\)\s*(.+)$",
    ]

    for pattern in fallback_patterns:
        fallback_match = re.match(pattern, text)

        if fallback_match:
            label = fallback_match.group(1).lower()
            content = normalize_space(fallback_match.group(2))

            is_correct = is_answer_correct(
                label,
                content,
                segment.get("underlinedText", ""),
            )

            return {
                "label": label,
                "content": content,
                "answerType": "truefalse",
                "isCorrect": is_correct,
            }

    return None


def parse_answer_segment(segment, section):
    if section == "part2":
        return parse_part2_answer(segment)

    if section == "part1":
        return parse_part1_answer(segment)

    return None


def default_question_type(section):
    if section == "part2":
        return "truefalse"

    if section == "part3":
        return "short-answer"

    if section == "part4":
        return "essay"

    return "multiple"


def build_answers(parsed_answers):
    return [
        {
            "id": create_id("answer", index + 1),
            "content": item["content"],
            "isCorrect": bool(item.get("isCorrect")),
            "trueFalse": "",
        }
        for index, item in enumerate(parsed_answers)
    ]


def ensure_truefalse_four_items(answers):
    fixed = list(answers[:4])

    while len(fixed) < 4:
        fixed.append({
            "id": create_id("answer", len(fixed) + 1),
            "content": "",
            "isCorrect": False,
            "trueFalse": "",
        })

    return fixed


def finalize_question(question, questions):
    if not question:
        return

    parsed_answers = question.pop("_parsedAnswers", [])
    section = question.get("section", "part1")

    if section == "part1":
        question["type"] = "multiple"
        question["answers"] = build_answers(parsed_answers)

    elif section == "part2":
        question["type"] = "truefalse"
        question["answers"] = ensure_truefalse_four_items(
            build_answers(parsed_answers)
        )

    elif section == "part3":
        question["type"] = "short-answer"
        question["answers"] = []

    elif section == "part4":
        question["type"] = "essay"
        question["answers"] = []

    question["question"] = normalize_space(question.get("question", ""))

    questions.append(question)


def parse_docx_exam(file_stream):
    segments = read_segments(file_stream)

    questions = []
    current_question = None
    current_section = "part1"
    current_passage = ""
    question_index = 0

    for segment in segments:
        text = normalize_space(segment["text"])

        if not text:
            continue

        detected_section = detect_section(text, current_section)

        if is_section_line(text):
            finalize_question(current_question, questions)
            current_question = None
            current_section = detected_section
            current_passage = ""
            continue

        if text.startswith("Đọc kỹ đoạn văn"):
            current_passage = text
            continue

        if is_question_line(text):
            finalize_question(current_question, questions)

            question_index += 1
            content = get_question_content(text)

            if current_passage and current_section == "part1":
                content = f"{current_passage}\n\n{content}"

            current_question = {
                "id": create_id("question", question_index),
                "type": default_question_type(current_section),
                "section": current_section,
                "question": content,
                "code": "",
                "explanation": "",
                "score": "",
                "correctAnswer": "",
                "answers": [],
                "_parsedAnswers": [],
            }
            continue

        if not current_question:
            continue

        if is_solution_line(text):
            current_question["explanation"] = get_solution_content(text)
            continue

        if is_numeric_answer_line(text):
            current_question["correctAnswer"] = get_numeric_answer(text)
            current_question["type"] = "short-answer"
            current_question["section"] = "part3"
            continue

        parsed_answer = parse_answer_segment(segment, current_section)

        if parsed_answer:
            current_question["_parsedAnswers"].append(parsed_answer)
            continue

        current_question["question"] = normalize_space(
            f"{current_question.get('question', '')}\n{text}"
        )

    finalize_question(current_question, questions)

    return {
        "questionCount": len(questions),
        "questions": questions,
    }
from datetime import datetime, timezone
import unicodedata

from extensions import db
from models import (
    OJProblem,
    OJSubmission,
    OJSubmissionResult,
    OJTestCase,
    User,
)


SUPPORTED_LANGUAGES = {
    "CPP23",
    "PYTHON314",
    "JAVA21",
}

DIFFICULTIES = {
    "EASY",
    "MEDIUM",
    "HARD",
}

PROBLEM_STATUSES = {
    "DRAFT",
    "PUBLISHED",
    "ARCHIVED",
}


class OJError(Exception):
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code



# Giới hạn thời gian tối đa cho một testcase OJ.
MAX_TIME_LIMIT_MS = 30_000

def utc_now():
    return datetime.now(timezone.utc)


def normalize_text(value):
    return str(value or "").strip()


def normalize_upper(value):
    return normalize_text(value).upper()


def normalize_subject(value):
    value = normalize_text(value).casefold()

    value = unicodedata.normalize(
        "NFD",
        value,
    )

    value = "".join(
        character
        for character in value
        if unicodedata.category(character) != "Mn"
    )

    # Đ/đ không bị tách bởi NFD.
    value = value.replace("đ", "d")

    return " ".join(
        value.split()
    )


def teacher_subject(user):
    if not user:
        return ""

    profile = (
        user.profile_data
        if isinstance(
            user.profile_data,
            dict,
        )
        else {}
    )

    return normalize_subject(
        profile.get("subject")
        or profile.get("specialty")
    )


def is_informatics_teacher(user):
    if (
        not user
        or role(user) != "TEACHER"
    ):
        return False

    subject = teacher_subject(user)

    return subject in {
        "tin hoc",
        "informatique",
        "informatics",
        "computer science",
    }


def get_user(current_user):
    if not current_user:
        return None

    user_id = (
        current_user.get("user_id")
        or current_user.get("uid")
    )

    if not user_id:
        return None

    return db.session.get(
        User,
        user_id,
    )


def role(user):
    return normalize_upper(
        getattr(
            user,
            "role",
            "",
        )
    )


def is_admin(user):
    return bool(
        user
        and role(user) == "ADMIN_DEV"
    )


def is_teacher(user):
    return bool(
        user
        and role(user)
        in {
            "TEACHER",
            "ADMIN_DEV",
        }
    )


def require_user(current_user):
    user = get_user(current_user)

    if not user:
        raise OJError(
            "Không tìm thấy tài khoản người dùng.",
            401,
        )

    return user


def require_manager(current_user):
    user = require_user(current_user)

    if is_admin(user):
        return user

    if not is_informatics_teacher(user):
        raise OJError(
            (
                "Chỉ giáo viên Tin học "
                "hoặc quản trị viên mới có quyền "
                "quản lý bài lập trình."
            ),
            403,
        )

    return user


def serialize_sample(testcase):
    return {
        "id": testcase.id,
        "position": testcase.position,
        "input": testcase.input_data,
        "output": testcase.expected_output,
    }


def serialize_problem(
    problem,
    include_detail=False,
    include_samples=False,
):
    data = {
        "id": problem.id,
        "code": str(problem.id),
        "title": problem.title,
        "difficulty": problem.difficulty,
        "category": problem.category or "",
        "points": problem.points,
        "timeLimitMs": problem.time_limit_ms,
        "memoryLimitMb": problem.memory_limit_mb,
        "status": problem.status,
        "createdBy": problem.created_by,
        "createdAt": (
            problem.created_at.isoformat()
            if problem.created_at
            else None
        ),
        "updatedAt": (
            problem.updated_at.isoformat()
            if problem.updated_at
            else None
        ),
    }

    if include_detail:
        data.update({
            "description": problem.description,
            "inputDescription":
                problem.input_description or "",
            "outputDescription":
                problem.output_description or "",
            "constraints":
                problem.constraints_text or "",
            "metadata":
                problem.metadata_json
                if isinstance(
                    problem.metadata_json,
                    dict,
                )
                else {},
        })

    if include_samples:
        samples = (
            db.session.execute(
                db.select(OJTestCase)
                .where(
                    OJTestCase.problem_id
                    == problem.id,
                    OJTestCase.is_sample.is_(True),
                )
                .order_by(
                    OJTestCase.position.asc()
                )
            )
            .scalars()
            .all()
        )

        data["samples"] = [
            serialize_sample(row)
            for row in samples
        ]

    return data


def serialize_submission(
    submission,
    include_source=False,
    include_results=False,
):
    problem = db.session.get(
        OJProblem,
        submission.problem_id,
    )

    data = {
        "id": submission.id,
        "problemId": submission.problem_id,
        "problemCode":
            str(problem.id) if problem else None,
        "problemTitle":
            problem.title if problem else None,
        "userId": submission.user_id,
        "language": submission.language,
        "verdict": submission.verdict,
        "score": submission.score,
        "executionTimeMs":
            submission.execution_time_ms,
        "memoryUsedKb":
            submission.memory_used_kb,
        "compilerOutput":
            submission.compiler_output,
        "judgeMessage":
            submission.judge_message,
        "createdAt": (
            submission.created_at.isoformat()
            if submission.created_at
            else None
        ),
        "judgedAt": (
            submission.judged_at.isoformat()
            if submission.judged_at
            else None
        ),
    }

    if include_source:
        data["sourceCode"] = (
            submission.source_code
        )

    if include_results:
        rows = (
            db.session.execute(
                db.select(OJSubmissionResult)
                .where(
                    OJSubmissionResult.submission_id
                    == submission.id
                )
                .order_by(
                    OJSubmissionResult.position.asc()
                )
            )
            .scalars()
            .all()
        )

        # Không trả testcase_id để tránh cung cấp
        # thông tin nội bộ không cần thiết.
        data["testResults"] = [
            {
                "position": row.position,
                "verdict": row.verdict,
                "executionTimeMs":
                    row.execution_time_ms,
                "memoryUsedKb":
                    row.memory_used_kb,
                "points": row.points,
                "message": row.message,
            }
            for row in rows
        ]

    return data


def find_problem(problem_id):
    try:
        problem_id = int(problem_id)
    except (TypeError, ValueError):
        return None

    if problem_id < 1:
        return None

    return db.session.get(
        OJProblem,
        problem_id,
    )


def get_problems(current_user):
    user = require_user(current_user)

    statement = db.select(OJProblem)

    if not is_teacher(user):
        statement = statement.where(
            OJProblem.status == "PUBLISHED"
        )

    problems = (
        db.session.execute(
            statement.order_by(
                OJProblem.id.asc()
            )
        )
        .scalars()
        .all()
    )

    return {
        "success": True,
        "problems": [
            serialize_problem(problem)
            for problem in problems
        ],
    }


def get_problem_detail(
    current_user,
    problem_id,
):
    user = require_user(current_user)
    problem = find_problem(problem_id)

    if not problem:
        raise OJError(
            "Không tìm thấy bài lập trình.",
            404,
        )

    if (
        problem.status != "PUBLISHED"
        and not is_teacher(user)
    ):
        raise OJError(
            "Không tìm thấy bài lập trình.",
            404,
        )

    return {
        "success": True,
        "problem": serialize_problem(
            problem,
            include_detail=True,
            include_samples=True,
        ),
        "languages": [
            "CPP23",
            "PYTHON314",
            "JAVA21",
        ],
    }



def serialize_manager_testcase(testcase):
    """
    Serializer CHỈ dành cho OJ Manager.

    Hidden testcase có input/output nên tuyệt đối
    không dùng serializer này ở public API.
    """
    return {
        "id": testcase.id,
        "position": testcase.position,
        "input": testcase.input_data,
        "output": testcase.expected_output,
        "isSample": testcase.is_sample,
        "points": testcase.points,
    }


def get_manager_problem_detail(
    current_user,
    problem_id,
):
    require_manager(current_user)

    problem = find_problem(problem_id)

    if not problem:
        raise OJError(
            "Không tìm thấy bài lập trình.",
            404,
        )

    testcases = (
        db.session.execute(
            db.select(OJTestCase)
            .where(
                OJTestCase.problem_id
                == problem.id
            )
            .order_by(
                OJTestCase.position.asc()
            )
        )
        .scalars()
        .all()
    )

    data = serialize_problem(
        problem,
        include_detail=True,
        include_samples=False,
    )

    data["testcases"] = [
        serialize_manager_testcase(row)
        for row in testcases
    ]

    return {
        "success": True,
        "problem": data,
        "languages": [
            "CPP23",
            "PYTHON314",
            "JAVA21",
        ],
    }


def find_problem_testcase(
    problem,
    testcase_id,
):
    try:
        testcase_id = int(testcase_id)
    except (TypeError, ValueError):
        return None

    return (
        db.session.execute(
            db.select(OJTestCase)
            .where(
                OJTestCase.id
                == testcase_id,
                OJTestCase.problem_id
                == problem.id,
            )
        )
        .scalar_one_or_none()
    )


def update_testcase(
    current_user,
    problem_id,
    testcase_id,
    payload,
):
    require_manager(current_user)

    problem = find_problem(problem_id)

    if not problem:
        raise OJError(
            "Không tìm thấy bài lập trình.",
            404,
        )

    testcase = find_problem_testcase(
        problem,
        testcase_id,
    )

    if not testcase:
        raise OJError(
            "Không tìm thấy testcase.",
            404,
        )

    changes = {}

    if "input" in payload:
        changes["input_data"] = str(
            payload.get("input")
            if payload.get("input")
            is not None
            else ""
        )

    if "output" in payload:
        changes["expected_output"] = str(
            payload.get("output")
            if payload.get("output")
            is not None
            else ""
        )

    if "isSample" in payload:
        value = payload.get("isSample")

        if not isinstance(value, bool):
            raise OJError(
                "Trạng thái testcase mẫu "
                "không hợp lệ."
            )

        changes["is_sample"] = value

    if "points" in payload:
        value = payload.get("points")

        if value in (None, ""):
            changes["points"] = None
        else:
            try:
                value = int(value)
            except (TypeError, ValueError):
                raise OJError(
                    "Điểm testcase "
                    "không hợp lệ."
                )

            if value < 0:
                raise OJError(
                    "Điểm testcase "
                    "không được âm."
                )

            changes["points"] = value

    if "position" in payload:
        try:
            position = int(
                payload.get("position")
            )
        except (TypeError, ValueError):
            raise OJError(
                "Vị trí testcase "
                "không hợp lệ."
            )

        if position < 1:
            raise OJError(
                "Vị trí testcase "
                "phải từ 1."
            )

        existing = (
            db.session.execute(
                db.select(OJTestCase)
                .where(
                    OJTestCase.problem_id
                    == problem.id,
                    OJTestCase.position
                    == position,
                    OJTestCase.id
                    != testcase.id,
                )
            )
            .scalar_one_or_none()
        )

        if existing:
            raise OJError(
                "Vị trí testcase "
                "đã tồn tại.",
                409,
            )

        changes["position"] = position

    for field, value in changes.items():
        setattr(
            testcase,
            field,
            value,
        )

    db.session.commit()

    return {
        "success": True,
        "message":
            "Đã cập nhật testcase.",
        "testcase":
            serialize_manager_testcase(
                testcase
            ),
    }


def delete_testcase(
    current_user,
    problem_id,
    testcase_id,
):
    require_manager(current_user)

    problem = find_problem(problem_id)

    if not problem:
        raise OJError(
            "Không tìm thấy bài lập trình.",
            404,
        )

    testcase = find_problem_testcase(
        problem,
        testcase_id,
    )

    if not testcase:
        raise OJError(
            "Không tìm thấy testcase.",
            404,
        )

    db.session.delete(testcase)
    db.session.commit()

    return {
        "success": True,
        "message": "Đã xóa testcase.",
    }


def create_problem(
    current_user,
    payload,
):
    user = require_manager(current_user)

    title = normalize_text(
        payload.get("title")
    )
    description = normalize_text(
        payload.get("description")
    )

    if not title:
        raise OJError(
            "Tên bài không được để trống."
        )

    if len(title) > 500:
        raise OJError(
            "Tên bài tối đa 500 ký tự."
        )

    if not description:
        raise OJError(
            "Nội dung đề không được để trống."
        )

    difficulty = normalize_upper(
        payload.get("difficulty")
        or "EASY"
    )

    if difficulty not in DIFFICULTIES:
        raise OJError(
            "Độ khó không hợp lệ."
        )

    status = normalize_upper(
        payload.get("status")
        or "DRAFT"
    )

    if status not in PROBLEM_STATUSES:
        raise OJError(
            "Trạng thái bài không hợp lệ."
        )

    try:
        points = int(
            payload.get("points", 100)
        )
        time_limit_ms = int(
            payload.get(
                "timeLimitMs",
                1000,
            )
        )
        memory_limit_mb = int(
            payload.get(
                "memoryLimitMb",
                256,
            )
        )
    except (TypeError, ValueError):
        raise OJError(
            "Điểm hoặc giới hạn tài nguyên không hợp lệ."
        )

    if points <= 0:
        raise OJError(
            "Điểm phải lớn hơn 0."
        )

    if time_limit_ms <= 0:
        raise OJError(
            "Giới hạn thời gian phải lớn hơn 0."
        )

    if time_limit_ms > MAX_TIME_LIMIT_MS:
        raise OJError(
            "Giới hạn thời gian tối đa là 30000 ms."
        )

    if memory_limit_mb <= 0:
        raise OJError(
            "Giới hạn bộ nhớ phải lớn hơn 0."
        )

    metadata = payload.get("metadata")

    if not isinstance(metadata, dict):
        metadata = {}

    # Cột code vẫn NOT NULL + UNIQUE trong schema hiện tại.
    # Giá trị TEMP chỉ tồn tại trong transaction để PostgreSQL
    # có thể cấp ID trước khi code được đồng bộ thành ID.
    import uuid

    problem = OJProblem(
        code=f"TEMP-{uuid.uuid4().hex}",
        title=title,
        description=description,
        input_description=normalize_text(
            payload.get("inputDescription")
        ),
        output_description=normalize_text(
            payload.get("outputDescription")
        ),
        constraints_text=normalize_text(
            payload.get("constraints")
        ),
        difficulty=difficulty,
        category=normalize_text(
            payload.get("category")
        ) or None,
        points=points,
        time_limit_ms=time_limit_ms,
        memory_limit_mb=memory_limit_mb,
        status=status,
        created_by=user.id,
        metadata_json=metadata,
    )

    db.session.add(problem)

    # PostgreSQL sinh ID giống cơ chế Exams.
    db.session.flush()

    # Giữ cột legacy code đồng bộ với ID.
    # Client không được tự đặt mã này.
    problem.code = str(problem.id)

    db.session.commit()

    return {
        "success": True,
        "message": "Đã tạo bài lập trình.",
        "problem": serialize_problem(
            problem,
            include_detail=True,
            include_samples=True,
        ),
    }


def update_problem(
    current_user,
    problem_id,
    payload,
):
    require_manager(current_user)

    problem = find_problem(problem_id)

    if not problem:
        raise OJError(
            "Không tìm thấy bài lập trình.",
            404,
        )

    # -------------------------------------------------
    # 1. VALIDATE + NORMALIZE
    #
    # Không thay đổi ORM object ở giai đoạn này.
    # Nếu bất kỳ field nào không hợp lệ, request thất bại
    # mà problem vẫn giữ nguyên trạng thái ban đầu.
    # -------------------------------------------------

    changes = {}

    if "title" in payload:
        title = normalize_text(
            payload.get("title")
        )

        if not title:
            raise OJError(
                "Tên bài không được để trống."
            )

        if len(title) > 500:
            raise OJError(
                "Tên bài tối đa 500 ký tự."
            )

        changes["title"] = title

    if "description" in payload:
        description = normalize_text(
            payload.get("description")
        )

        if not description:
            raise OJError(
                "Nội dung đề không được để trống."
            )

        changes["description"] = description

    mappings = {
        "inputDescription":
            "input_description",
        "outputDescription":
            "output_description",
        "constraints":
            "constraints_text",
        "category":
            "category",
    }

    for source, target in mappings.items():
        if source in payload:
            value = normalize_text(
                payload.get(source)
            )

            changes[target] = value or None

    if "difficulty" in payload:
        difficulty = normalize_upper(
            payload.get("difficulty")
        )

        if difficulty not in DIFFICULTIES:
            raise OJError(
                "Độ khó không hợp lệ."
            )

        changes["difficulty"] = difficulty

    if "status" in payload:
        status = normalize_upper(
            payload.get("status")
        )

        if status not in PROBLEM_STATUSES:
            raise OJError(
                "Trạng thái bài không hợp lệ."
            )

        changes["status"] = status

    integer_fields = {
        "points": "points",
        "timeLimitMs": "time_limit_ms",
        "memoryLimitMb": "memory_limit_mb",
    }

    for source, target in integer_fields.items():
        if source not in payload:
            continue

        try:
            value = int(
                payload.get(source)
            )
        except (TypeError, ValueError):
            raise OJError(
                f"{source} không hợp lệ."
            )

        if value <= 0:
            raise OJError(
                f"{source} phải lớn hơn 0."
            )

        if (
            source == "timeLimitMs"
            and value > MAX_TIME_LIMIT_MS
        ):
            raise OJError(
                "Giới hạn thời gian tối đa là 30000 ms."
            )

        changes[target] = value

    if "metadata" in payload:
        metadata = payload.get("metadata")

        if not isinstance(metadata, dict):
            raise OJError(
                "metadata phải là object."
            )

        changes["metadata_json"] = metadata

    # -------------------------------------------------
    # 2. APPLY
    #
    # Chỉ tới đây mới mutate ORM object vì toàn bộ
    # payload đã vượt qua validation.
    # -------------------------------------------------

    for target, value in changes.items():
        setattr(
            problem,
            target,
            value,
        )

    problem.updated_at = utc_now()

    db.session.commit()

    return {
        "success": True,
        "message": "Đã cập nhật bài lập trình.",
        "problem": serialize_problem(
            problem,
            include_detail=True,
            include_samples=True,
        ),
    }


def add_testcase(
    current_user,
    problem_id,
    payload,
):
    require_manager(current_user)

    problem = find_problem(problem_id)

    if not problem:
        raise OJError(
            "Không tìm thấy bài lập trình.",
            404,
        )

    if "input" not in payload:
        raise OJError(
            "Thiếu dữ liệu input."
        )

    if "output" not in payload:
        raise OJError(
            "Thiếu đáp án output."
        )

    input_data = str(
        payload.get("input")
        if payload.get("input") is not None
        else ""
    )

    output_data = str(
        payload.get("output")
        if payload.get("output") is not None
        else ""
    )

    position = payload.get("position")

    if position is None:
        last_position = (
            db.session.execute(
                db.select(
                    db.func.max(
                        OJTestCase.position
                    )
                )
                .where(
                    OJTestCase.problem_id
                    == problem.id
                )
            )
            .scalar()
        )

        position = (
            int(last_position) + 1
            if last_position is not None
            else 1
        )
    else:
        try:
            position = int(position)
        except (TypeError, ValueError):
            raise OJError(
                "Vị trí testcase không hợp lệ."
            )

    if position < 1:
        raise OJError(
            "Vị trí testcase phải từ 1."
        )

    existing = (
        db.session.execute(
            db.select(OJTestCase)
            .where(
                OJTestCase.problem_id
                == problem.id,
                OJTestCase.position
                == position,
            )
        )
        .scalar_one_or_none()
    )

    if existing:
        raise OJError(
            "Vị trí testcase đã tồn tại.",
            409,
        )

    points = payload.get("points")

    if points is not None:
        try:
            points = int(points)
        except (TypeError, ValueError):
            raise OJError(
                "Điểm testcase không hợp lệ."
            )

        if points < 0:
            raise OJError(
                "Điểm testcase không được âm."
            )

    testcase = OJTestCase(
        problem_id=problem.id,
        position=position,
        input_data=input_data,
        expected_output=output_data,
        is_sample=bool(
            payload.get("isSample", False)
        ),
        points=points,
    )

    db.session.add(testcase)
    db.session.commit()

    # Cố ý không trả expected_output của hidden testcase.
    data = {
        "id": testcase.id,
        "position": testcase.position,
        "isSample": testcase.is_sample,
        "points": testcase.points,
    }

    if testcase.is_sample:
        data.update({
            "input": testcase.input_data,
            "output": testcase.expected_output,
        })

    return {
        "success": True,
        "message": "Đã thêm testcase.",
        "testcase": data,
    }


def create_submission(
    current_user,
    problem_id,
    payload,
):
    user = require_user(current_user)

    problem = find_problem(problem_id)

    if not problem:
        raise OJError(
            "Không tìm thấy bài lập trình.",
            404,
        )

    if (
        problem.status != "PUBLISHED"
        and not is_teacher(user)
    ):
        raise OJError(
            "Không tìm thấy bài lập trình.",
            404,
        )

    language = normalize_upper(
        payload.get("language")
    )

    if language not in SUPPORTED_LANGUAGES:
        raise OJError(
            "Ngôn ngữ lập trình không được hỗ trợ."
        )

    source_code = str(
        payload.get("sourceCode")
        or ""
    )

    if not source_code.strip():
        raise OJError(
            "Source problem_id không được để trống."
        )

    # Giới hạn 256 KiB cho một bài nộp.
    if len(
        source_code.encode("utf-8")
    ) > 256 * 1024:
        raise OJError(
            "Source problem_id vượt quá giới hạn 256 KiB.",
            413,
        )

    submission = OJSubmission(
        problem_id=problem.id,
        user_id=user.id,
        language=language,
        source_code=source_code,
        verdict="PENDING",
        score=0,
    )

    db.session.add(submission)
    db.session.commit()

    return {
        "success": True,
        "message":
            "Đã tiếp nhận bài nộp và đưa vào hàng chờ chấm.",
        "submission": serialize_submission(
            submission,
            include_source=True,
        ),
    }


def get_my_submissions(
    current_user,
    problem_id=None,
):
    user = require_user(current_user)

    statement = (
        db.select(OJSubmission)
        .where(
            OJSubmission.user_id
            == user.id
        )
    )

    if problem_id:
        problem = find_problem(problem_id)

        if not problem:
            raise OJError(
                "Không tìm thấy bài lập trình.",
                404,
            )

        statement = statement.where(
            OJSubmission.problem_id
            == problem.id
        )

    submissions = (
        db.session.execute(
            statement.order_by(
                OJSubmission.created_at.desc(),
                OJSubmission.id.desc(),
            )
            .limit(100)
        )
        .scalars()
        .all()
    )

    return {
        "success": True,
        "submissions": [
            serialize_submission(row)
            for row in submissions
        ],
    }


def get_submission_detail(
    current_user,
    submission_id,
):
    user = require_user(current_user)

    submission = db.session.get(
        OJSubmission,
        submission_id,
    )

    if not submission:
        raise OJError(
            "Không tìm thấy bài nộp.",
            404,
        )

    if (
        int(submission.user_id)
        != int(user.id)
        and not is_teacher(user)
    ):
        raise OJError(
            "Bạn không có quyền xem bài nộp này.",
            403,
        )

    return {
        "success": True,
        "submission": serialize_submission(
            submission,
            include_source=True,
            include_results=True,
        ),
    }

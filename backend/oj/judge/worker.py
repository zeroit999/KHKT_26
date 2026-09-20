import shutil
import tempfile
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app import create_app
from extensions import db
from models import (
    OJProblem,
    OJSubmission,
    OJSubmissionResult,
    OJTestCase,
)

from oj.judge.comparator import outputs_equal
from oj.judge.languages import get_language
from oj.judge.sandbox import run_in_sandbox


POLL_SECONDS = 1.0
MAX_CAPTURE_CHARS = 16_384

# Giới hạn riêng cho giai đoạn biên dịch.
# Không phụ thuộc memory limit của bài thi.
COMPILE_MEMORY_MB = 512
COMPILE_TIMEOUT_MS = 15_000
COMPILE_HOST_TIMEOUT_SECONDS = 20

# judging_started_at đồng thời được dùng làm
# heartbeat của lease chấm bài.
#
# Worker đang hoạt động sẽ gia hạn timestamp.
# Chỉ submission không heartbeat quá lâu mới
# được đưa trở lại queue.
# API giới hạn mỗi testcase tối đa 30 giây.
#
# Worker heartbeat ngay trước mỗi sandbox call.
# Lease 60 giây lớn hơn runtime tối đa + thời gian
# khởi tạo/dọn Podman, tránh reclaim một worker
# vẫn đang chấm hợp lệ.
STALE_JUDGE_SECONDS = 60
RECOVERY_INTERVAL_SECONDS = 30


def utc_now():
    return datetime.now(timezone.utc)


def limit_text(value):
    value = str(value or "")

    if len(value) <= MAX_CAPTURE_CHARS:
        return value

    return (
        value[:MAX_CAPTURE_CHARS]
        + "\n...[đã cắt bớt]"
    )


def claim_submission():
    """
    Claim một submission bằng PostgreSQL
    FOR UPDATE SKIP LOCKED.

    Trả về:
        (submission_id, judge_token)

    judge_token xác định worker đang sở hữu
    quyền chấm submission này.
    """
    submission = (
        db.session.execute(
            db.select(OJSubmission)
            .where(
                OJSubmission.verdict
                == "PENDING"
            )
            .order_by(
                OJSubmission.created_at.asc(),
                OJSubmission.id.asc(),
            )
            .with_for_update(
                skip_locked=True
            )
            .limit(1)
        )
        .scalars()
        .first()
    )

    if not submission:
        db.session.rollback()
        return None

    judge_token = str(uuid.uuid4())

    submission.verdict = "JUDGING"
    submission.score = 0
    submission.execution_time_ms = None
    submission.memory_used_kb = None
    submission.compiler_output = None
    submission.judged_at = None
    submission.judging_started_at = utc_now()
    submission.judge_token = judge_token
    submission.judge_message = (
        "Đang chấm bài."
    )

    submission_id = submission.id

    db.session.commit()

    return (
        submission_id,
        judge_token,
    )


def owns_submission(
    submission_id,
    judge_token,
    *,
    lock=False,
):
    """
    Kiểm tra worker còn sở hữu submission.

    lock=True dùng SELECT FOR UPDATE để khóa row
    trong transaction trước khi ghi kết quả.
    """
    statement = (
        db.select(OJSubmission)
        .where(
            OJSubmission.id
            == submission_id,
            OJSubmission.verdict
            == "JUDGING",
            OJSubmission.judge_token
            == judge_token,
        )
    )

    if lock:
        statement = (
            statement.with_for_update()
        )

    return (
        db.session.execute(statement)
        .scalars()
        .first()
    )


def ensure_ownership(
    submission_id,
    judge_token,
    *,
    lock=False,
):
    submission = owns_submission(
        submission_id,
        judge_token,
        lock=lock,
    )

    if submission is None:
        db.session.rollback()
        return None

    return submission

def heartbeat_submission(
    submission_id,
    judge_token,
):
    """
    Gia hạn lease nếu worker vẫn còn ownership.
    """
    submission = ensure_ownership(
        submission_id,
        judge_token,
        lock=True,
    )

    if submission is None:
        return False

    submission.judging_started_at = utc_now()

    db.session.commit()

    return True


def recover_stale_submissions(
    *,
    stale_seconds=STALE_JUDGE_SECONDS,
):
    """
    Đưa các submission JUDGING bị mất worker
    trở lại PENDING.

    Row được khóa trước khi reset để tránh race
    với heartbeat/save_result/finish_submission.
    """
    cutoff = (
        utc_now()
        - timedelta(
            seconds=max(
                1,
                int(stale_seconds),
            )
        )
    )

    stale_submissions = (
        db.session.execute(
            db.select(OJSubmission)
            .where(
                OJSubmission.verdict
                == "JUDGING",
                OJSubmission.judging_started_at
                .is_not(None),
                OJSubmission.judging_started_at
                < cutoff,
            )
            .order_by(
                OJSubmission.judging_started_at.asc(),
                OJSubmission.id.asc(),
            )
            .with_for_update(
                skip_locked=True
            )
        )
        .scalars()
        .all()
    )

    recovered_ids = []

    for submission in stale_submissions:
        # Xóa partial testcase results để lần chấm
        # mới không đụng unique constraint position.
        db.session.execute(
            db.delete(
                OJSubmissionResult
            ).where(
                OJSubmissionResult.submission_id
                == submission.id
            )
        )

        submission.verdict = "PENDING"
        submission.score = 0
        submission.execution_time_ms = None
        submission.memory_used_kb = None
        submission.compiler_output = None
        submission.judged_at = None

        submission.judge_token = None
        submission.judging_started_at = None

        submission.judge_message = (
            "Đưa lại vào hàng chờ sau khi "
            "Judge bị gián đoạn."
        )

        recovered_ids.append(
            submission.id
        )

    db.session.commit()

    return recovered_ids


def get_testcases(problem_id):
    return (
        db.session.execute(
            db.select(OJTestCase)
            .where(
                OJTestCase.problem_id
                == problem_id
            )
            .order_by(
                OJTestCase.position.asc()
            )
        )
        .scalars()
        .all()
    )


def calculate_test_points(
    problem,
    testcases,
):
    """
    Nếu testcase có points riêng thì dùng points đó.

    Nếu không có, chia đều điểm của bài cho toàn bộ
    testcase; testcase cuối nhận phần dư.
    """
    explicit = [
        testcase.points
        for testcase in testcases
    ]

    if all(
        value is not None
        for value in explicit
    ):
        return {
            testcase.id: max(
                0,
                int(testcase.points),
            )
            for testcase in testcases
        }

    count = len(testcases)

    if count == 0:
        return {}

    base = problem.points // count
    remainder = problem.points % count

    result = {}

    for index, testcase in enumerate(
        testcases
    ):
        result[testcase.id] = (
            base
            + (
                1
                if index < remainder
                else 0
            )
        )

    return result


def save_result(
    submission,
    testcase,
    verdict,
    *,
    execution_time_ms=None,
    memory_used_kb=None,
    points=0,
    message=None,
):
    row = OJSubmissionResult(
        submission_id=submission.id,
        testcase_id=testcase.id,
        position=testcase.position,
        verdict=verdict,
        execution_time_ms=execution_time_ms,
        memory_used_kb=memory_used_kb,
        points=points,
        message=message,
    )

    db.session.add(row)


def finish_submission(
    submission_id,
    judge_token,
    verdict,
    *,
    score=0,
    execution_time_ms=None,
    memory_used_kb=None,
    compiler_output=None,
    judge_message=None,
):
    """
    Chỉ worker còn giữ đúng judge_token mới
    được ghi verdict cuối cùng.
    """
    submission = ensure_ownership(
        submission_id,
        judge_token,
        lock=True,
    )

    if submission is None:
        return False

    submission.verdict = verdict
    submission.score = max(
        0,
        int(score),
    )
    submission.execution_time_ms = (
        execution_time_ms
    )
    submission.memory_used_kb = (
        memory_used_kb
    )
    submission.compiler_output = (
        limit_text(compiler_output)
        if compiler_output
        else None
    )
    submission.judge_message = (
        judge_message
    )
    submission.judged_at = utc_now()

    # Claim đã hoàn tất, không còn lease active.
    submission.judging_started_at = None
    submission.judge_token = None

    db.session.commit()

    return True

def judge_submission(
    submission_id,
    judge_token,
):
    submission = ensure_ownership(
        submission_id,
        judge_token,
    )

    if submission is None:
        return False

    problem = db.session.get(
        OJProblem,
        submission.problem_id,
    )

    if not problem:
        finish_submission(
            submission_id,
            judge_token,
            "IE",
            judge_message=(
                "Không tìm thấy bài lập trình."
            ),
        )
        return

    language = get_language(
        submission.language
    )

    if not language:
        finish_submission(
            submission_id,
            judge_token,
            "IE",
            judge_message=(
                "Ngôn ngữ chấm không được hỗ trợ."
            ),
        )
        return

    testcases = get_testcases(
        problem.id
    )

    if not testcases:
        finish_submission(
            submission_id,
            judge_token,
            "IE",
            judge_message=(
                "Bài chưa có testcase để chấm."
            ),
        )
        return

    points_map = calculate_test_points(
        problem,
        testcases,
    )

    workspace = Path(
        tempfile.mkdtemp(
            prefix=(
                f"zuny-oj-{submission.id}-"
            )
        )
    )

    try:
        source_path = (
            workspace
            / language["source_file"]
        )

        source_path.write_text(
            submission.source_code,
            encoding="utf-8",
        )

        compile_command = language[
            "compile"
        ]

        if compile_command:
            if not heartbeat_submission(
                submission_id,
                judge_token,
            ):
                return False

            compile_result = run_in_sandbox(
                workspace,
                compile_command,
                # Compiler có quota riêng, không dùng
                # memory limit của chương trình.
                memory_mb=COMPILE_MEMORY_MB,
                # Runner giới hạn thời gian biên dịch
                # bên trong container. Host timeout chỉ
                # là watchdog cho Podman.
                timeout_seconds=(
                    COMPILE_HOST_TIMEOUT_SECONDS
                ),
                measured=True,
                execution_timeout_ms=(
                    COMPILE_TIMEOUT_MS
                ),
            )

            if compile_result.timed_out:
                finish_submission(
                    submission_id,
                    judge_token,
                    "CE",
                    compiler_output=(
                        "Quá thời gian biên dịch."
                    ),
                    judge_message=(
                        "Biên dịch không thành công."
                    ),
                )
                return

            if compile_result.output_exceeded:
                finish_submission(
                    submission_id,
                    judge_token,
                    "CE",
                    compiler_output=(
                        "Đầu ra trình biên dịch "
                        "vượt quá giới hạn."
                    ),
                    judge_message=(
                        "Biên dịch không thành công."
                    ),
                )
                return

            if compile_result.return_code != 0:
                finish_submission(
                    submission_id,
                    judge_token,
                    "CE",
                    compiler_output=(
                        compile_result.stderr
                        or compile_result.stdout
                    ),
                    judge_message=(
                        "Biên dịch không thành công."
                    ),
                )
                return

        total_score = 0
        max_time_ms = 0
        max_memory_kb = 0
        final_verdict = "AC"

        # Host timeout có thêm một khoảng nhỏ để Podman
        # khởi tạo/dọn container.
        execution_timeout = max(
            1.0,
            problem.time_limit_ms / 1000.0,
        )

        host_timeout = (
            execution_timeout
            + 1.5
        )

        for testcase in testcases:
            if not heartbeat_submission(
                submission_id,
                judge_token,
            ):
                return False

            result = run_in_sandbox(
                workspace,
                language["run"],
                stdin_data=testcase.input_data,
                memory_mb=(
                    problem.memory_limit_mb
                ),
                timeout_seconds=host_timeout,
                measured=True,
                execution_timeout_ms=(
                    problem.time_limit_ms
                ),
            )

            elapsed_ms = (
                int(result.execution_time_ms)
                if result.execution_time_ms
                is not None
                else None
            )

            memory_used_kb = (
                result.memory_used_kb
            )

            if elapsed_ms is not None:
                max_time_ms = max(
                    max_time_ms,
                    elapsed_ms,
                )

            if memory_used_kb is not None:
                max_memory_kb = max(
                    max_memory_kb,
                    memory_used_kb,
                )

            if result.timed_out:
                verdict = "TLE"
                message = (
                    "Vượt quá giới hạn thời gian."
                )

            elif (
                result.memory_exceeded
            ):
                verdict = "MLE"
                message = (
                    "Vượt quá giới hạn bộ nhớ."
                )

            elif result.output_exceeded:
                verdict = "RE"
                message = (
                    "Vượt quá giới hạn đầu ra."
                )

            elif result.return_code != 0:
                verdict = "RE"
                message = (
                    "Chương trình kết thúc bất thường."
                )

            elif (
                elapsed_ms is not None
                and elapsed_ms
                > problem.time_limit_ms
            ):
                verdict = "TLE"
                message = (
                    "Vượt quá giới hạn thời gian."
                )

            elif outputs_equal(
                result.stdout,
                testcase.expected_output,
            ):
                verdict = "AC"
                message = "Đúng."

            else:
                verdict = "WA"
                message = "Sai kết quả."

            earned_points = (
                points_map.get(
                    testcase.id,
                    0,
                )
                if verdict == "AC"
                else 0
            )

            total_score += earned_points

            # Khóa submission và xác nhận worker
            # vẫn còn ownership trước khi ghi result.
            owned_submission = ensure_ownership(
                submission_id,
                judge_token,
                lock=True,
            )

            if owned_submission is None:
                return False

            owned_submission.judging_started_at = (
                utc_now()
            )

            save_result(
                owned_submission,
                testcase,
                verdict,
                execution_time_ms=elapsed_ms,
                memory_used_kb=memory_used_kb,
                points=earned_points,
                message=message,
            )

            # Result và ownership check nằm trong cùng
            # transaction. Worker mất token không thể
            # commit testcase mới.
            db.session.commit()

            if verdict != "AC":
                final_verdict = verdict
                break

        finish_submission(
            submission_id,
            judge_token,
            final_verdict,
            score=total_score,
            execution_time_ms=max_time_ms,
            memory_used_kb=max_memory_kb,
            judge_message=(
                "Chấm bài hoàn tất."
            ),
        )

    finally:
        shutil.rmtree(
            workspace,
            ignore_errors=True,
        )


def mark_internal_error(
    submission_id,
    judge_token,
    error,
):
    db.session.rollback()

    # Không ghi IE nếu submission đã được worker
    # khác reclaim và nhận token mới.
    finish_submission(
        submission_id,
        judge_token,
        "IE",
        judge_message=(
            "Judge gặp lỗi nội bộ."
        ),
    )

def run_worker():
    app = create_app()

    print(
        "ZUNY Judge Worker"
    )
    print(
        "Queue: PostgreSQL"
    )
    print(
        "Sandbox: Podman rootless"
    )

    with app.app_context():
        last_recovery = 0.0

        while True:
            submission_id = None
            judge_token = None

            try:
                now_monotonic = time.monotonic()

                if (
                    now_monotonic
                    - last_recovery
                    >= RECOVERY_INTERVAL_SECONDS
                ):
                    recovered_ids = (
                        recover_stale_submissions()
                    )

                    for recovered_id in recovered_ids:
                        print(
                            "[RECOVERY] submission "
                            f"#{recovered_id} -> PENDING"
                        )

                    last_recovery = now_monotonic

                claim = claim_submission()

                if claim is None:
                    time.sleep(
                        POLL_SECONDS
                    )
                    continue

                (
                    submission_id,
                    judge_token,
                ) = claim

                print(
                    f"[JUDGE] submission "
                    f"#{submission_id}"
                )

                judge_submission(
                    submission_id,
                    judge_token,
                )

            except KeyboardInterrupt:
                print(
                    "\nJudge Worker stopped."
                )
                break

            except Exception as error:
                print(
                    "[JUDGE ERROR]",
                    repr(error),
                )

                if (
                    submission_id
                    and judge_token
                ):
                    mark_internal_error(
                        submission_id,
                        judge_token,
                        error,
                    )

                time.sleep(
                    POLL_SECONDS
                )


if __name__ == "__main__":
    run_worker()

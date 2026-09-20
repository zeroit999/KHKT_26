import unittest
import uuid

from app import create_app
from extensions import db
from models import (
    User,
    OJProblem,
    OJTestCase,
    OJSubmission,
    OJSubmissionResult,
)

from oj.judge.worker import (
    claim_submission,
    judge_submission,
)


class OJWorkerIntegrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.ctx = cls.app.app_context()
        cls.ctx.push()

        cls.user = (
            db.session.execute(
                db.select(User)
                .order_by(User.id.asc())
                .limit(1)
            )
            .scalars()
            .first()
        )

        if cls.user is None:
            raise unittest.SkipTest(
                "DB local chưa có user để chạy "
                "OJ integration test."
            )

        cls.problem_ids = []

    @classmethod
    def tearDownClass(cls):
        try:
            db.session.rollback()

            for problem_id in reversed(
                cls.problem_ids
            ):
                # Xóa result trước để không phụ thuộc
                # hoàn toàn vào DB cascade.
                submission_ids = (
                    db.session.execute(
                        db.select(
                            OJSubmission.id
                        ).where(
                            OJSubmission.problem_id
                            == problem_id
                        )
                    )
                    .scalars()
                    .all()
                )

                if submission_ids:
                    db.session.execute(
                        db.delete(
                            OJSubmissionResult
                        ).where(
                            OJSubmissionResult
                            .submission_id.in_(
                                submission_ids
                            )
                        )
                    )

                db.session.execute(
                    db.delete(
                        OJSubmission
                    ).where(
                        OJSubmission.problem_id
                        == problem_id
                    )
                )

                db.session.execute(
                    db.delete(
                        OJTestCase
                    ).where(
                        OJTestCase.problem_id
                        == problem_id
                    )
                )

                db.session.execute(
                    db.delete(
                        OJProblem
                    ).where(
                        OJProblem.id
                        == problem_id
                    )
                )

            db.session.commit()

        finally:
            # Trả scoped session về SQLAlchemy trước.
            db.session.remove()

            # Integration test tạo app/engine riêng.
            # Dispose pool để không giữ psycopg
            # connection sau khi test kết thúc.
            db.engine.dispose()

            cls.ctx.pop()

    def make_problem(
        self,
        *,
        time_limit_ms=1000,
        memory_limit_mb=128,
        points=100,
        testcases=None,
    ):
        code = (
            "ZTEST_REG_"
            + uuid.uuid4().hex[:12].upper()
        )

        problem = OJProblem(
            code=code,
            title="ZUNY Judge Regression",
            description=(
                "Bài kiểm thử tự động Judge."
            ),
            difficulty="EASY",
            category="REGRESSION",
            points=points,
            time_limit_ms=time_limit_ms,
            memory_limit_mb=memory_limit_mb,
            status="DRAFT",
            created_by=self.user.id,
            metadata_json={
                "integrationTest": True,
            },
        )

        db.session.add(problem)
        db.session.flush()

        self.problem_ids.append(
            problem.id
        )

        for position, item in enumerate(
            testcases or [],
            start=1,
        ):
            testcase = OJTestCase(
                problem_id=problem.id,
                position=position,
                input_data=item["input"],
                expected_output=(
                    item["output"]
                ),
                is_sample=False,
                points=item.get(
                    "points"
                ),
            )

            db.session.add(testcase)

        db.session.commit()

        return problem

    def make_submission(
        self,
        problem,
        *,
        language,
        source_code,
    ):
        submission = OJSubmission(
            problem_id=problem.id,
            user_id=self.user.id,
            language=language,
            source_code=source_code,
            verdict="PENDING",
            score=0,
        )

        db.session.add(submission)
        db.session.commit()

        return submission.id

    def reload_submission(
        self,
        submission_id,
    ):
        db.session.expire_all()

        return db.session.get(
            OJSubmission,
            submission_id,
        )

    def get_results(
        self,
        submission_id,
    ):
        db.session.expire_all()

        return (
            db.session.execute(
                db.select(
                    OJSubmissionResult
                )
                .where(
                    OJSubmissionResult.submission_id
                    == submission_id
                )
                .order_by(
                    OJSubmissionResult.position.asc()
                )
            )
            .scalars()
            .all()
        )

    def judge_direct(
        self,
        problem,
        *,
        language,
        source_code,
    ):
        submission_id = (
            self.make_submission(
                problem,
                language=language,
                source_code=source_code,
            )
        )

        claim = claim_submission()

        self.assertIsNotNone(
            claim
        )

        claimed_id, judge_token = claim

        self.assertEqual(
            claimed_id,
            submission_id,
        )

        judge_submission(
            submission_id,
            judge_token,
        )

        return (
            self.reload_submission(
                submission_id
            )
        )

    def test_01_queue_claims_pending_submission(self):
        problem = self.make_problem(
            testcases=[{
                "input": "1 2\n",
                "output": "3\n",
            }]
        )

        submission_id = (
            self.make_submission(
                problem,
                language="PYTHON314",
                source_code=(
                    "print(sum(map(int, "
                    "input().split())))"
                ),
            )
        )

        claim = claim_submission()

        self.assertIsNotNone(
            claim
        )

        claimed_id, judge_token = claim

        self.assertEqual(
            claimed_id,
            submission_id,
        )

        submission = (
            self.reload_submission(
                submission_id
            )
        )

        self.assertEqual(
            submission.verdict,
            "JUDGING",
        )

        self.assertEqual(
            submission.judge_message,
            "Đang chấm bài.",
        )

        # Hoàn tất submission đã claim để không
        # để lại trạng thái JUDGING trong lúc test.
        judge_submission(
            submission_id,
            judge_token,
        )

        submission = (
            self.reload_submission(
                submission_id
            )
        )

        self.assertEqual(
            submission.verdict,
            "AC",
        )

    def test_02_python_ac_and_score(self):
        problem = self.make_problem(
            points=100,
            testcases=[
                {
                    "input": "20 22\n",
                    "output": "42\n",
                    "points": 40,
                },
                {
                    "input": "100 23\n",
                    "output": "123\n",
                    "points": 60,
                },
            ],
        )

        submission = self.judge_direct(
            problem,
            language="PYTHON314",
            source_code="""
a, b = map(int, input().split())
print(a + b)
""".strip(),
        )

        self.assertEqual(
            submission.verdict,
            "AC",
        )

        self.assertEqual(
            submission.score,
            100,
        )

        self.assertIsNotNone(
            submission.judged_at
        )

        self.assertGreater(
            submission.memory_used_kb or 0,
            0,
        )

        results = self.get_results(
            submission.id
        )

        self.assertEqual(
            len(results),
            2,
        )

        self.assertEqual(
            [row.verdict for row in results],
            ["AC", "AC"],
        )

        self.assertEqual(
            sum(
                row.points
                for row in results
            ),
            100,
        )

    def test_03_wrong_answer(self):
        problem = self.make_problem(
            testcases=[{
                "input": "20 22\n",
                "output": "42\n",
            }],
        )

        submission = self.judge_direct(
            problem,
            language="PYTHON314",
            source_code='print("41")',
        )

        self.assertEqual(
            submission.verdict,
            "WA",
        )

        self.assertEqual(
            submission.score,
            0,
        )

        results = self.get_results(
            submission.id
        )

        self.assertEqual(
            len(results),
            1,
        )

        self.assertEqual(
            results[0].verdict,
            "WA",
        )

    def test_04_cpp_compile_error(self):
        problem = self.make_problem(
            testcases=[{
                "input": "",
                "output": "42\n",
            }],
        )

        submission = self.judge_direct(
            problem,
            language="CPP23",
            source_code="""
#include <iostream>

int main() {
    this_is_not_valid_cpp
}
""".strip(),
        )

        self.assertEqual(
            submission.verdict,
            "CE",
        )

        self.assertEqual(
            submission.score,
            0,
        )

        self.assertTrue(
            submission.compiler_output
        )

        self.assertEqual(
            len(
                self.get_results(
                    submission.id
                )
            ),
            0,
        )

    def test_05_python_runtime_error(self):
        problem = self.make_problem(
            testcases=[{
                "input": "",
                "output": "",
            }],
        )

        submission = self.judge_direct(
            problem,
            language="PYTHON314",
            source_code=(
                'raise RuntimeError("ZUNY")'
            ),
        )

        self.assertEqual(
            submission.verdict,
            "RE",
        )

        results = self.get_results(
            submission.id
        )

        self.assertEqual(
            len(results),
            1,
        )

        self.assertEqual(
            results[0].verdict,
            "RE",
        )

    def test_06_internal_tle_has_telemetry(self):
        problem = self.make_problem(
            time_limit_ms=300,
            memory_limit_mb=128,
            testcases=[{
                "input": "",
                "output": "",
            }],
        )

        submission = self.judge_direct(
            problem,
            language="PYTHON314",
            source_code="""
x = 0

while True:
    x += 1
""".strip(),
        )

        self.assertEqual(
            submission.verdict,
            "TLE",
        )

        self.assertGreaterEqual(
            submission.execution_time_ms or 0,
            250,
        )

        self.assertLess(
            submission.execution_time_ms or 0,
            1000,
        )

        self.assertGreater(
            submission.memory_used_kb or 0,
            0,
        )

        results = self.get_results(
            submission.id
        )

        self.assertEqual(
            len(results),
            1,
        )

        self.assertEqual(
            results[0].verdict,
            "TLE",
        )

        self.assertGreaterEqual(
            results[0].execution_time_ms or 0,
            250,
        )

        self.assertGreater(
            results[0].memory_used_kb or 0,
            0,
        )

    def test_07_memory_limit(self):
        problem = self.make_problem(
            time_limit_ms=3000,
            memory_limit_mb=64,
            testcases=[{
                "input": "",
                "output": "",
            }],
        )

        submission = self.judge_direct(
            problem,
            language="PYTHON314",
            source_code="""
chunks = []

while True:
    chunks.append(
        bytearray(8 * 1024 * 1024)
    )
""".strip(),
        )

        self.assertEqual(
            submission.verdict,
            "MLE",
        )

        self.assertGreater(
            submission.memory_used_kb or 0,
            0,
        )

        results = self.get_results(
            submission.id
        )

        self.assertEqual(
            len(results),
            1,
        )

        self.assertEqual(
            results[0].verdict,
            "MLE",
        )

    def test_08_output_limit_maps_to_re(self):
        problem = self.make_problem(
            time_limit_ms=3000,
            memory_limit_mb=128,
            testcases=[{
                "input": "",
                "output": "",
            }],
        )

        submission = self.judge_direct(
            problem,
            language="PYTHON314",
            source_code="""
import sys

chunk = "A" * 65536

while True:
    sys.stdout.write(chunk)
    sys.stdout.flush()
""".strip(),
        )

        self.assertEqual(
            submission.verdict,
            "RE",
        )

        results = self.get_results(
            submission.id
        )

        self.assertEqual(
            len(results),
            1,
        )

        self.assertEqual(
            results[0].verdict,
            "RE",
        )

        self.assertEqual(
            results[0].message,
            "Vượt quá giới hạn đầu ra.",
        )


    def test_09_old_worker_cannot_finish_after_reclaim(
        self,
    ):
        """
        Worker A claim submission.

        Sau đó mô phỏng recovery + worker B reclaim
        bằng token mới.

        Worker A không được phép ghi verdict cuối.
        """
        import uuid

        from oj.judge.worker import (
            finish_submission,
            utc_now,
        )

        problem = self.make_problem(
            testcases=[
                {
                    "input": "1\\n",
                    "output": "2\\n",
                },
            ],
        )

        submission_id = self.make_submission(
            problem,
            language="PYTHON314",
            source_code=(
                "print(int(input()) + 1)"
            ),
        )

        claim = claim_submission()

        self.assertIsNotNone(
            claim
        )

        claimed_id, token_a = claim

        self.assertEqual(
            claimed_id,
            submission_id,
        )

        current = self.reload_submission(
            submission_id
        )

        self.assertEqual(
            current.verdict,
            "JUDGING",
        )
        self.assertEqual(
            current.judge_token,
            token_a,
        )
        self.assertIsNotNone(
            current.judging_started_at
        )

        # Mô phỏng recovery đã thu hồi ownership
        # của A và worker B đã claim submission.
        token_b = str(uuid.uuid4())

        current.judge_token = token_b
        current.judging_started_at = utc_now()
        current.judge_message = (
            "Worker B đang chấm bài."
        )

        db.session.commit()

        # Worker A sống lại và cố ghi AC.
        finished = finish_submission(
            submission_id,
            token_a,
            "AC",
            score=100,
            execution_time_ms=1,
            memory_used_kb=1024,
            judge_message=(
                "Worker A không được ghi."
            ),
        )

        self.assertFalse(
            finished
        )

        current = self.reload_submission(
            submission_id
        )

        # Submission vẫn thuộc worker B.
        self.assertEqual(
            current.verdict,
            "JUDGING",
        )
        self.assertEqual(
            current.judge_token,
            token_b,
        )
        self.assertIsNotNone(
            current.judging_started_at
        )

        # Worker A không được thay đổi kết quả.
        self.assertEqual(
            current.score,
            0,
        )
        self.assertIsNone(
            current.judged_at
        )
        self.assertEqual(
            current.judge_message,
            "Worker B đang chấm bài.",
        )


    def test_10_stale_recovery_requeues_and_rejudges(
        self,
    ):
        """
        Submission bị crash giữa lúc chấm phải:
        - xóa partial testcase results;
        - trở lại PENDING;
        - mất ownership token cũ;
        - được worker mới claim;
        - chấm lại bình thường.
        """
        from datetime import timedelta

        from oj.judge.worker import (
            finish_submission,
            recover_stale_submissions,
            utc_now,
        )

        problem = self.make_problem(
            testcases=[
                {
                    "input": "1\n",
                    "output": "2\n",
                    "points": 50,
                },
                {
                    "input": "10\n",
                    "output": "11\n",
                    "points": 50,
                },
            ],
        )

        submission_id = self.make_submission(
            problem,
            language="PYTHON314",
            source_code=(
                "print(int(input()) + 1)"
            ),
        )

        claim = claim_submission()

        self.assertIsNotNone(
            claim
        )

        claimed_id, token_a = claim

        self.assertEqual(
            claimed_id,
            submission_id,
        )

        submission = self.reload_submission(
            submission_id
        )

        self.assertEqual(
            submission.verdict,
            "JUDGING",
        )

        # Giả lập worker A đã chấm xong testcase 1
        # rồi bị crash trước testcase tiếp theo.
        testcase = (
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
            .first()
        )

        partial_result = OJSubmissionResult(
            submission_id=submission_id,
            testcase_id=testcase.id,
            position=testcase.position,
            verdict="AC",
            execution_time_ms=1,
            memory_used_kb=1024,
            points=50,
        )

        db.session.add(
            partial_result
        )

        submission.score = 50
        submission.execution_time_ms = 1
        submission.memory_used_kb = 1024
        submission.judge_message = (
            "Worker A đang chấm dở."
        )

        # Làm heartbeat đủ cũ để recovery nhận diện.
        submission.judging_started_at = (
            utc_now()
            - timedelta(seconds=10)
        )

        db.session.commit()

        self.assertEqual(
            len(
                self.get_results(
                    submission_id
                )
            ),
            1,
        )

        # stale_seconds=1 giúp test chạy ngay,
        # không phải chờ timeout production.
        recovered_ids = (
            recover_stale_submissions(
                stale_seconds=1,
            )
        )

        self.assertIn(
            submission_id,
            recovered_ids,
        )

        submission = self.reload_submission(
            submission_id
        )

        self.assertEqual(
            submission.verdict,
            "PENDING",
        )
        self.assertEqual(
            submission.score,
            0,
        )
        self.assertIsNone(
            submission.judge_token
        )
        self.assertIsNone(
            submission.judging_started_at
        )
        self.assertIsNone(
            submission.execution_time_ms
        )
        self.assertIsNone(
            submission.memory_used_kb
        )
        self.assertIsNone(
            submission.judged_at
        )

        # Partial result phải bị xóa, nếu không
        # lần chấm lại sẽ đụng unique constraint.
        self.assertEqual(
            self.get_results(
                submission_id
            ),
            [],
        )

        # Worker mới claim lại submission.
        claim = claim_submission()

        self.assertIsNotNone(
            claim
        )

        claimed_id, token_b = claim

        self.assertEqual(
            claimed_id,
            submission_id,
        )

        self.assertNotEqual(
            token_a,
            token_b,
        )

        # Token cũ không còn ownership.
        old_worker_finished = finish_submission(
            submission_id,
            token_a,
            "AC",
            score=100,
            judge_message=(
                "Worker A không được ghi."
            ),
        )

        self.assertFalse(
            old_worker_finished
        )

        # Worker B chấm lại từ đầu.
        judge_submission(
            submission_id,
            token_b,
        )

        submission = self.reload_submission(
            submission_id
        )

        self.assertEqual(
            submission.verdict,
            "AC",
        )
        self.assertEqual(
            submission.score,
            100,
        )
        self.assertIsNotNone(
            submission.judged_at
        )

        # finish_submission phải giải phóng lease.
        self.assertIsNone(
            submission.judge_token
        )
        self.assertIsNone(
            submission.judging_started_at
        )

        results = self.get_results(
            submission_id
        )

        self.assertEqual(
            len(results),
            2,
        )

        self.assertTrue(
            all(
                result.verdict == "AC"
                for result in results
            )
        )

    def test_11_default_lease_keeps_fresh_submission(self):
        """Heartbeat 59s chưa được recovery với lease 60s."""
        from datetime import timedelta
        from oj.judge.worker import (
            STALE_JUDGE_SECONDS,
            recover_stale_submissions,
            utc_now,
        )

        self.assertEqual(STALE_JUDGE_SECONDS, 60)

        problem = self.make_problem()
        submission_id = self.make_submission(
            problem,
            language="PYTHON314",
            source_code="print('OK')",
        )

        claim = claim_submission()
        self.assertIsNotNone(claim)

        claimed_id, token = claim
        self.assertEqual(claimed_id, submission_id)

        submission = self.reload_submission(
            submission_id
        )
        submission.judging_started_at = (
            utc_now() - timedelta(seconds=59)
        )
        db.session.commit()

        recovered_ids = recover_stale_submissions()

        self.assertNotIn(
            submission_id,
            recovered_ids,
        )

        submission = self.reload_submission(
            submission_id
        )
        self.assertEqual(
            submission.verdict,
            "JUDGING",
        )
        self.assertEqual(
            submission.judge_token,
            token,
        )

        # Cleanup trạng thái để submission này không
        # quay trở lại queue và ảnh hưởng test sau.
        submission.verdict = "AC"
        submission.judge_token = None
        submission.judging_started_at = None
        submission.judged_at = utc_now()
        db.session.commit()

    def test_12_default_lease_recovers_stale_submission(self):
        """Heartbeat 61s phải được recovery với lease 60s."""
        from datetime import timedelta
        from oj.judge.worker import (
            STALE_JUDGE_SECONDS,
            recover_stale_submissions,
            utc_now,
        )

        self.assertEqual(STALE_JUDGE_SECONDS, 60)

        problem = self.make_problem()
        submission_id = self.make_submission(
            problem,
            language="PYTHON314",
            source_code="print('OK')",
        )

        claim = claim_submission()
        self.assertIsNotNone(claim)

        claimed_id, _token = claim
        self.assertEqual(claimed_id, submission_id)

        submission = self.reload_submission(
            submission_id
        )
        submission.judging_started_at = (
            utc_now() - timedelta(seconds=61)
        )
        db.session.commit()

        recovered_ids = recover_stale_submissions()

        self.assertIn(
            submission_id,
            recovered_ids,
        )

        submission = self.reload_submission(
            submission_id
        )
        self.assertEqual(
            submission.verdict,
            "PENDING",
        )
        self.assertIsNone(
            submission.judge_token,
        )
        self.assertIsNone(
            submission.judging_started_at,
        )

        # Recovery phải đưa submission về PENDING.
        # Sau khi đã xác nhận hành vi đó, cleanup để
        # submission này không chen vào queue của test sau.
        submission.verdict = "AC"
        submission.score = 0
        submission.judge_token = None
        submission.judging_started_at = None
        submission.judged_at = utc_now()
        db.session.commit()


    def test_13_compile_uses_fixed_memory_quota(self):
        """
        Compiler phải dùng quota 512 MiB riêng.

        Runtime vẫn phải dùng memory limit của problem,
        không bị ép về quota compiler.
        """
        from unittest.mock import patch

        from oj.judge.sandbox import SandboxResult
        from oj.judge.worker import (
            COMPILE_HOST_TIMEOUT_SECONDS,
            COMPILE_MEMORY_MB,
            COMPILE_TIMEOUT_MS,
        )

        self.assertEqual(
            COMPILE_MEMORY_MB,
            512,
        )
        self.assertEqual(
            COMPILE_TIMEOUT_MS,
            15_000,
        )
        self.assertEqual(
            COMPILE_HOST_TIMEOUT_SECONDS,
            20,
        )

        problem = self.make_problem(
            time_limit_ms=1234,
            memory_limit_mb=2048,
            testcases=[{
                "input": "",
                "output": "42\n",
            }],
        )

        calls = []

        def fake_run_in_sandbox(
            workspace,
            command,
            **kwargs,
        ):
            calls.append({
                "workspace": workspace,
                "command": command,
                **kwargs,
            })

            if len(calls) == 1:
                # Compile thành công.
                return SandboxResult(
                    return_code=0,
                    stdout="",
                    stderr="",
                    timed_out=False,
                    execution_time_ms=50,
                    memory_used_kb=32_768,
                    memory_exceeded=False,
                    output_exceeded=False,
                )

            if len(calls) == 2:
                # Runtime thành công và khớp expected output.
                return SandboxResult(
                    return_code=0,
                    stdout="42\n",
                    stderr="",
                    timed_out=False,
                    execution_time_ms=10,
                    memory_used_kb=16_384,
                    memory_exceeded=False,
                    output_exceeded=False,
                )

            self.fail(
                "Worker gọi sandbox nhiều hơn 2 lần."
            )

        with patch(
            "oj.judge.worker.run_in_sandbox",
            side_effect=fake_run_in_sandbox,
        ):
            submission = self.judge_direct(
                problem,
                language="CPP23",
                source_code=(
                    "#include <iostream>\n"
                    "int main() {\n"
                    "    std::cout << 42 << '\\n';\n"
                    "}\n"
                ),
            )

        self.assertEqual(
            submission.verdict,
            "AC",
        )

        self.assertEqual(
            len(calls),
            2,
        )

        compile_call = calls[0]
        runtime_call = calls[1]

        # Compile có quota độc lập với problem.
        self.assertEqual(
            compile_call["memory_mb"],
            512,
        )
        self.assertEqual(
            compile_call["timeout_seconds"],
            20,
        )
        self.assertEqual(
            compile_call["execution_timeout_ms"],
            15_000,
        )
        self.assertTrue(
            compile_call["measured"],
        )

        # Runtime vẫn dùng giới hạn của problem.
        self.assertEqual(
            runtime_call["memory_mb"],
            2048,
        )
        self.assertEqual(
            runtime_call["execution_timeout_ms"],
            1234,
        )
        self.assertAlmostEqual(
            runtime_call["timeout_seconds"],
            2.734,
            places=3,
        )
        self.assertTrue(
            runtime_call["measured"],
        )

        results = self.get_results(
            submission.id
        )

        self.assertEqual(
            len(results),
            1,
        )
        self.assertEqual(
            results[0].verdict,
            "AC",
        )


if __name__ == "__main__":
    unittest.main()

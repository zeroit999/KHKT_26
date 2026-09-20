import unittest
import uuid
from unittest.mock import patch

from app import create_app
from extensions import db
from models import User, OJProblem
from oj.oj_service import (
    MAX_TIME_LIMIT_MS,
    OJError,
    create_problem,
    update_problem,
)


class OJServiceTimeLimitTest(unittest.TestCase):
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
                "OJ service integration test."
            )

        cls.problem_ids = []

    @classmethod
    def tearDownClass(cls):
        try:
            db.session.rollback()

            for problem_id in reversed(
                cls.problem_ids
            ):
                db.session.execute(
                    db.delete(OJProblem).where(
                        OJProblem.id == problem_id
                    )
                )

            db.session.commit()

        finally:
            db.session.remove()
            db.engine.dispose()
            cls.ctx.pop()

    def setUp(self):
        db.session.rollback()

    def manager_patch(self):
        return patch(
            "oj.oj_service.require_manager",
            return_value=self.user,
        )

    def unique_code(self):
        return (
            "ZLIMIT_"
            + uuid.uuid4().hex[:12].upper()
        )

    def payload(
        self,
        *,
        code=None,
        time_limit_ms=1000,
        title="ZUNY Time Limit Regression",
    ):
        return {
            "code": code or self.unique_code(),
            "title": title,
            "description":
                "Kiểm thử giới hạn thời gian OJ.",
            "difficulty": "EASY",
            "status": "DRAFT",
            "points": 100,
            "timeLimitMs": time_limit_ms,
            "memoryLimitMb": 128,
            "metadata": {
                "integrationTest": True,
            },
        }

    def remember_problem(self, problem):
        if problem.id not in self.problem_ids:
            self.problem_ids.append(problem.id)

    def create_valid_problem(
        self,
        *,
        time_limit_ms=1000,
        title="ZUNY Atomic Update",
    ):
        payload = self.payload(
            time_limit_ms=time_limit_ms,
            title=title,
        )

        with self.manager_patch():
            result = create_problem(
                {"user_id": self.user.id},
                payload,
            )

        problem = (
            db.session.execute(
                db.select(OJProblem).where(
                    OJProblem.code
                    == payload["code"]
                )
            )
            .scalars()
            .one()
        )

        self.remember_problem(problem)

        self.assertTrue(result["success"])

        return problem

    def reload_problem(self, problem_id):
        db.session.expire_all()

        return db.session.get(
            OJProblem,
            problem_id,
        )

    def test_01_max_time_limit_constant(self):
        self.assertEqual(
            MAX_TIME_LIMIT_MS,
            30_000,
        )

    def test_02_create_accepts_30000_ms(self):
        payload = self.payload(
            time_limit_ms=30_000,
        )

        with self.manager_patch():
            result = create_problem(
                {"user_id": self.user.id},
                payload,
            )

        problem = (
            db.session.execute(
                db.select(OJProblem).where(
                    OJProblem.code
                    == payload["code"]
                )
            )
            .scalars()
            .one()
        )

        self.remember_problem(problem)

        self.assertTrue(result["success"])
        self.assertEqual(
            problem.time_limit_ms,
            30_000,
        )

    def test_03_create_rejects_30001_ms(self):
        payload = self.payload(
            time_limit_ms=30_001,
        )

        with self.manager_patch():
            with self.assertRaises(OJError) as ctx:
                create_problem(
                    {"user_id": self.user.id},
                    payload,
                )

        self.assertEqual(
            str(ctx.exception),
            "Giới hạn thời gian tối đa là 30000 ms.",
        )

        problem = (
            db.session.execute(
                db.select(OJProblem).where(
                    OJProblem.code
                    == payload["code"]
                )
            )
            .scalars()
            .first()
        )

        self.assertIsNone(problem)

    def test_04_create_rejects_zero_ms(self):
        payload = self.payload(
            time_limit_ms=0,
        )

        with self.manager_patch():
            with self.assertRaises(OJError) as ctx:
                create_problem(
                    {"user_id": self.user.id},
                    payload,
                )

        self.assertEqual(
            str(ctx.exception),
            "Giới hạn thời gian phải lớn hơn 0.",
        )

        problem = (
            db.session.execute(
                db.select(OJProblem).where(
                    OJProblem.code
                    == payload["code"]
                )
            )
            .scalars()
            .first()
        )

        self.assertIsNone(problem)

    def test_05_update_accepts_30000_ms(self):
        problem = self.create_valid_problem()

        with self.manager_patch():
            result = update_problem(
                {"user_id": self.user.id},
                problem.code,
                {
                    "timeLimitMs": 30_000,
                },
            )

        problem = self.reload_problem(
            problem.id
        )

        self.assertTrue(result["success"])
        self.assertEqual(
            problem.time_limit_ms,
            30_000,
        )

    def test_06_update_rejects_30001_ms(self):
        problem = self.create_valid_problem(
            time_limit_ms=1000,
        )

        with self.manager_patch():
            with self.assertRaises(OJError) as ctx:
                update_problem(
                    {"user_id": self.user.id},
                    problem.code,
                    {
                        "timeLimitMs": 30_001,
                    },
                )

        self.assertEqual(
            str(ctx.exception),
            "Giới hạn thời gian tối đa là 30000 ms.",
        )

        # Xóa trạng thái ORM hiện tại và đọc lại DB.
        db.session.rollback()

        problem = self.reload_problem(
            problem.id
        )

        self.assertEqual(
            problem.time_limit_ms,
            1000,
        )

    def test_07_failed_update_is_atomic(self):
        original_title = "Tên bài ban đầu"

        problem = self.create_valid_problem(
            time_limit_ms=1000,
            title=original_title,
        )

        problem_id = problem.id
        problem_code = problem.code

        with self.manager_patch():
            with self.assertRaises(OJError) as ctx:
                update_problem(
                    {"user_id": self.user.id},
                    problem_code,
                    {
                        "title":
                            "Tên KHÔNG được lưu",
                        "description":
                            "Nội dung KHÔNG được lưu",
                        "timeLimitMs": 30_001,
                    },
                )

        self.assertEqual(
            str(ctx.exception),
            "Giới hạn thời gian tối đa là 30000 ms.",
        )

        # Quan trọng:
        # rollback + expire để không kiểm tra nhầm
        # object đang cache trong SQLAlchemy.
        db.session.rollback()
        db.session.expire_all()

        problem = db.session.get(
            OJProblem,
            problem_id,
        )

        self.assertEqual(
            problem.title,
            original_title,
        )

        self.assertEqual(
            problem.description,
            "Kiểm thử giới hạn thời gian OJ.",
        )

        self.assertEqual(
            problem.time_limit_ms,
            1000,
        )


if __name__ == "__main__":
    unittest.main()

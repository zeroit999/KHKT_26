import unittest
from uuid import uuid4

from app import create_app
from auth.auth import JWTManager
from extensions import db
from models import User
from models.oj import OJProblem, OJTestCase


class OJManagerAPITest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config["TESTING"] = True

        cls.ctx = cls.app.app_context()
        cls.ctx.push()

        suffix = uuid4().hex[:8]

        cls.student = User(
            email=f"oj-manager-student-{suffix}@test.local",
            full_name="OJ Student",
            role="STUDENT",
            profile_data={},
        )

        cls.math_teacher = User(
            email=f"oj-manager-math-{suffix}@test.local",
            full_name="GV Toán",
            role="TEACHER",
            profile_data={
                "subject": "Toán",
            },
        )

        cls.info_teacher = User(
            email=f"oj-manager-info-{suffix}@test.local",
            full_name="GV Tin học",
            role="TEACHER",
            profile_data={
                "subject": "Tin học",
            },
        )

        db.session.add_all([
            cls.student,
            cls.math_teacher,
            cls.info_teacher,
        ])
        db.session.flush()

        cls.code = (
            "MGR"
            + uuid4().hex[:8].upper()
        )

        cls.problem = OJProblem(
            code=cls.code,
            title="Manager API Test",
            description="Đề kiểm thử manager.",
            difficulty="EASY",
            category="Test",
            points=100,
            time_limit_ms=1000,
            memory_limit_mb=256,
            status="PUBLISHED",
            created_by=cls.info_teacher.id,
            metadata_json={},
        )

        db.session.add(cls.problem)
        db.session.flush()

        cls.sample = OJTestCase(
            problem_id=cls.problem.id,
            position=1,
            input_data="1 2\n",
            expected_output="3\n",
            is_sample=True,
            points=20,
        )

        cls.hidden = OJTestCase(
            problem_id=cls.problem.id,
            position=2,
            input_data="100 200\n",
            expected_output="300\n",
            is_sample=False,
            points=80,
        )

        db.session.add_all([
            cls.sample,
            cls.hidden,
        ])
        db.session.commit()

        cls.client = cls.app.test_client()

    @classmethod
    def tearDownClass(cls):
        db.session.execute(
            db.delete(OJTestCase).where(
                OJTestCase.problem_id
                == cls.problem.id
            )
        )

        db.session.execute(
            db.delete(OJProblem).where(
                OJProblem.id
                == cls.problem.id
            )
        )

        db.session.execute(
            db.delete(User).where(
                User.id.in_([
                    cls.student.id,
                    cls.math_teacher.id,
                    cls.info_teacher.id,
                ])
            )
        )

        db.session.commit()
        db.session.remove()
        db.engine.dispose()
        cls.ctx.pop()

    def token(self, user):
        return JWTManager.create_access_token(
            user.to_dict()
        )

    def headers(self, user):
        return {
            "Authorization":
                f"Bearer {self.token(user)}",
        }

    def test_01_public_detail_never_leaks_hidden(self):
        response = self.client.get(
            f"/api/oj/problems/{self.code}",
            headers=self.headers(
                self.student
            ),
        )

        self.assertEqual(
            response.status_code,
            200,
        )

        data = response.get_json()
        problem = data["problem"]

        self.assertEqual(
            len(problem["samples"]),
            1,
        )

        self.assertEqual(
            problem["samples"][0]["input"],
            "1 2\n",
        )

        raw = response.get_data(
            as_text=True
        )

        self.assertNotIn(
            "100 200",
            raw,
        )
        self.assertNotIn(
            "300\\n",
            raw,
        )

    def test_02_student_cannot_read_manager_detail(self):
        response = self.client.get(
            f"/api/oj/manage/problems/{self.code}",
            headers=self.headers(
                self.student
            ),
        )

        self.assertEqual(
            response.status_code,
            403,
        )

    def test_03_math_teacher_cannot_read_manager_detail(self):
        response = self.client.get(
            f"/api/oj/manage/problems/{self.code}",
            headers=self.headers(
                self.math_teacher
            ),
        )

        self.assertEqual(
            response.status_code,
            403,
        )

    def test_04_info_teacher_can_read_hidden_testcase(self):
        response = self.client.get(
            f"/api/oj/manage/problems/{self.code}",
            headers=self.headers(
                self.info_teacher
            ),
        )

        self.assertEqual(
            response.status_code,
            200,
        )

        problem = response.get_json()[
            "problem"
        ]

        self.assertEqual(
            len(problem["testcases"]),
            2,
        )

        hidden = problem[
            "testcases"
        ][1]

        self.assertFalse(
            hidden["isSample"]
        )
        self.assertEqual(
            hidden["input"],
            "100 200\n",
        )
        self.assertEqual(
            hidden["output"],
            "300\n",
        )

    def test_05_manager_can_update_hidden_testcase(self):
        response = self.client.put(
            (
                f"/api/oj/manage/problems/"
                f"{self.code}/testcases/"
                f"{self.hidden.id}"
            ),
            json={
                "input": "7 8\n",
                "output": "15\n",
                "points": 70,
                "position": 2,
                "isSample": False,
            },
            headers=self.headers(
                self.info_teacher
            ),
        )

        self.assertEqual(
            response.status_code,
            200,
        )

        db.session.expire_all()

        testcase = db.session.get(
            OJTestCase,
            self.hidden.id,
        )

        self.assertEqual(
            testcase.input_data,
            "7 8\n",
        )
        self.assertEqual(
            testcase.expected_output,
            "15\n",
        )
        self.assertEqual(
            testcase.points,
            70,
        )

    def test_06_testcase_cannot_cross_problem_boundary(self):
        other = OJProblem(
            code=(
                "OTH"
                + uuid4().hex[:8].upper()
            ),
            title="Other",
            description="Other",
            difficulty="EASY",
            points=100,
            time_limit_ms=1000,
            memory_limit_mb=256,
            status="DRAFT",
            created_by=self.info_teacher.id,
            metadata_json={},
        )

        db.session.add(other)
        db.session.commit()

        try:
            response = self.client.put(
                (
                    f"/api/oj/manage/problems/"
                    f"{other.code}/testcases/"
                    f"{self.hidden.id}"
                ),
                json={
                    "output": "BYPASS",
                },
                headers=self.headers(
                    self.info_teacher
                ),
            )

            self.assertEqual(
                response.status_code,
                404,
            )
        finally:
            db.session.delete(other)
            db.session.commit()

    def test_07_manager_can_delete_testcase(self):
        testcase = OJTestCase(
            problem_id=self.problem.id,
            position=99,
            input_data="delete\n",
            expected_output="delete\n",
            is_sample=False,
            points=0,
        )

        db.session.add(testcase)
        db.session.commit()

        testcase_id = testcase.id

        response = self.client.delete(
            (
                f"/api/oj/manage/problems/"
                f"{self.code}/testcases/"
                f"{testcase_id}"
            ),
            headers=self.headers(
                self.info_teacher
            ),
        )

        self.assertEqual(
            response.status_code,
            200,
        )

        self.assertIsNone(
            db.session.get(
                OJTestCase,
                testcase_id,
            )
        )


if __name__ == "__main__":
    unittest.main()

import unittest
import uuid

from app import create_app
from extensions import db
from models import User
from oj.oj_service import (
    OJError,
    is_informatics_teacher,
    require_manager,
    teacher_subject,
)


class OJPermissionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.ctx = cls.app.app_context()
        cls.ctx.push()

        cls.user_ids = []

    @classmethod
    def tearDownClass(cls):
        try:
            db.session.rollback()

            if cls.user_ids:
                db.session.execute(
                    db.delete(User).where(
                        User.id.in_(cls.user_ids)
                    )
                )

            db.session.commit()

        finally:
            db.session.remove()
            db.engine.dispose()
            cls.ctx.pop()

    def setUp(self):
        db.session.rollback()

    def create_user(
        self,
        role,
        *,
        subject_marker=False,
        subject=None,
        use_specialty=False,
    ):
        token = uuid.uuid4().hex

        profile_data = {
            "integrationTest": True,
        }

        if subject_marker:
            key = (
                "specialty"
                if use_specialty
                else "subject"
            )

            profile_data[key] = subject

        user = User(
            email=f"oj-permission-{token}@local.test",
            full_name="OJ Permission Test",
            role=role,
            profile_data=profile_data,
        )

        db.session.add(user)
        db.session.commit()

        self.user_ids.append(user.id)

        return user

    def assert_forbidden(self, user):
        with self.assertRaises(OJError) as ctx:
            require_manager(
                {
                    "user_id": user.id,
                }
            )

        self.assertEqual(
            ctx.exception.status_code,
            403,
        )

    def test_01_student_is_forbidden(self):
        user = self.create_user(
            "STUDENT",
        )

        self.assert_forbidden(user)

    def test_02_teacher_without_subject_is_forbidden(self):
        user = self.create_user(
            "TEACHER",
        )

        self.assertEqual(
            teacher_subject(user),
            "",
        )

        self.assertFalse(
            is_informatics_teacher(user)
        )

        self.assert_forbidden(user)

    def test_03_math_teacher_is_forbidden(self):
        user = self.create_user(
            "TEACHER",
            subject_marker=True,
            subject="Toán",
        )

        self.assertFalse(
            is_informatics_teacher(user)
        )

        self.assert_forbidden(user)

    def test_04_informatics_teacher_is_allowed(self):
        user = self.create_user(
            "TEACHER",
            subject_marker=True,
            subject="Tin học",
        )

        self.assertTrue(
            is_informatics_teacher(user)
        )

        manager = require_manager(
            {
                "user_id": user.id,
            }
        )

        self.assertEqual(
            manager.id,
            user.id,
        )

    def test_05_unaccented_informatics_is_allowed(self):
        user = self.create_user(
            "TEACHER",
            subject_marker=True,
            subject="tin hoc",
        )

        self.assertTrue(
            is_informatics_teacher(user)
        )

        manager = require_manager(
            {
                "user_id": user.id,
            }
        )

        self.assertEqual(
            manager.id,
            user.id,
        )

    def test_06_specialty_fallback_is_allowed(self):
        user = self.create_user(
            "TEACHER",
            subject_marker=True,
            subject="TIN HỌC",
            use_specialty=True,
        )

        self.assertEqual(
            teacher_subject(user),
            "tin hoc",
        )

        manager = require_manager(
            {
                "user_id": user.id,
            }
        )

        self.assertEqual(
            manager.id,
            user.id,
        )

    def test_07_admin_is_allowed_without_subject(self):
        user = self.create_user(
            "ADMIN_DEV",
        )

        manager = require_manager(
            {
                "user_id": user.id,
            }
        )

        self.assertEqual(
            manager.id,
            user.id,
        )

    def test_08_teacher_role_cannot_be_bypassed_by_jwt_payload(self):
        user = self.create_user(
            "TEACHER",
            subject_marker=True,
            subject="Toán",
        )

        with self.assertRaises(OJError) as ctx:
            require_manager(
                {
                    "user_id": user.id,

                    # Dữ liệu giả trong payload không được
                    # phép ghi đè dữ liệu PostgreSQL.
                    "role": "ADMIN_DEV",
                    "subject": "Tin học",
                }
            )

        self.assertEqual(
            ctx.exception.status_code,
            403,
        )


if __name__ == "__main__":
    unittest.main()

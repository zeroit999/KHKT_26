import unittest
import uuid

from app import create_app
from extensions import db
from models import User
from auth.auth import JWTManager


class AuthProfilePermissionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config.update(
            TESTING=True,
        )

        cls.ctx = cls.app.app_context()
        cls.ctx.push()

        suffix = uuid.uuid4().hex[:10]

        cls.student = User(
            email=f"authz-student-{suffix}@example.com",
            full_name="Authz Student",
            role="STUDENT",
            profile_data={},
        )

        cls.teacher_new = User(
            email=f"authz-teacher-new-{suffix}@example.com",
            full_name="Authz Teacher New",
            role="TEACHER",
            profile_data={},
        )

        cls.teacher_math = User(
            email=f"authz-teacher-math-{suffix}@example.com",
            full_name="Authz Teacher Math",
            role="TEACHER",
            profile_data={
                "subject": "Toán",
            },
        )

        db.session.add_all([
            cls.student,
            cls.teacher_new,
            cls.teacher_math,
        ])
        db.session.commit()

        cls.user_ids = [
            cls.student.id,
            cls.teacher_new.id,
            cls.teacher_math.id,
        ]

    @classmethod
    def tearDownClass(cls):
        db.session.rollback()

        for user_id in cls.user_ids:
            user = db.session.get(
                User,
                user_id,
            )
            if user:
                db.session.delete(user)

        db.session.commit()
        db.session.remove()

        # Đóng pool connection của test để psycopg không
        # phát ResourceWarning khi interpreter kết thúc.
        db.engine.dispose()

        cls.ctx.pop()

    def setUp(self):
        db.session.expire_all()
        self.client = self.app.test_client()

    def token_for(self, user):
        db.session.refresh(user)

        return JWTManager.create_access_token(
            user.to_dict()
        )

    def patch_me(self, user, payload):
        token = self.token_for(user)

        return self.client.patch(
            "/auth/me",
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

    def reload_user(self, user_id):
        db.session.expire_all()

        return db.session.get(
            User,
            user_id,
        )

    def test_01_student_cannot_promote_role(self):
        response = self.patch_me(
            self.student,
            {
                "role": "ADMIN_DEV",
            },
        )

        self.assertEqual(
            response.status_code,
            200,
        )

        user = self.reload_user(
            self.student.id
        )

        self.assertEqual(
            user.role,
            "STUDENT",
        )

    def test_02_student_cannot_set_subject(self):
        response = self.patch_me(
            self.student,
            {
                "subject": "Tin học",
            },
        )

        self.assertEqual(
            response.status_code,
            403,
        )

        user = self.reload_user(
            self.student.id
        )

        profile = user.profile_data or {}

        self.assertNotIn(
            "subject",
            profile,
        )

    def test_03_teacher_can_set_subject_once(self):
        response = self.patch_me(
            self.teacher_new,
            {
                "subject": "Tin học",
            },
        )

        self.assertEqual(
            response.status_code,
            200,
        )

        user = self.reload_user(
            self.teacher_new.id
        )

        profile = user.profile_data or {}

        self.assertEqual(
            profile.get("subject"),
            "Tin học",
        )

    def test_04_teacher_cannot_change_subject(self):
        response = self.patch_me(
            self.teacher_math,
            {
                "subject": "Tin học",
            },
        )

        self.assertEqual(
            response.status_code,
            403,
        )

        user = self.reload_user(
            self.teacher_math.id
        )

        profile = user.profile_data or {}

        self.assertEqual(
            profile.get("subject"),
            "Toán",
        )

    def test_05_specialty_cannot_bypass_subject_lock(self):
        response = self.patch_me(
            self.teacher_math,
            {
                "specialty": "Tin học",
            },
        )

        self.assertEqual(
            response.status_code,
            403,
        )

        user = self.reload_user(
            self.teacher_math.id
        )

        profile = user.profile_data or {}

        self.assertEqual(
            profile.get("subject"),
            "Toán",
        )

        self.assertNotIn(
            "specialty",
            profile,
        )

    def test_06_teacher_subject_alias_cannot_bypass_lock(self):
        response = self.patch_me(
            self.teacher_math,
            {
                "teacherSubject": "Tin học",
            },
        )

        self.assertEqual(
            response.status_code,
            403,
        )

        user = self.reload_user(
            self.teacher_math.id
        )

        profile = user.profile_data or {}

        self.assertEqual(
            profile.get("subject"),
            "Toán",
        )

        self.assertNotIn(
            "teacherSubject",
            profile,
        )

    def test_07_same_subject_is_idempotent(self):
        response = self.patch_me(
            self.teacher_math,
            {
                "subject": "Toán",
            },
        )

        self.assertEqual(
            response.status_code,
            200,
        )

        user = self.reload_user(
            self.teacher_math.id
        )

        self.assertEqual(
            (user.profile_data or {}).get(
                "subject"
            ),
            "Toán",
        )


    def test_08_learning_profile_cannot_bypass_subject_lock(self):
        """Learning API không được phép đổi chuyên môn giáo viên."""

        teacher = self.teacher_math

        token = JWTManager.create_access_token(
            teacher.to_dict()
        )

        response = self.client.patch(
            f"/api/learning/users/{teacher.id}",
            json={
                "subject": "Tin học",
                "specialty": "Tin học",
                "teacherSubject": "Tin học",
            },
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        self.assertEqual(response.status_code, 200)

        db.session.expire_all()

        refreshed = db.session.get(
            User,
            teacher.id,
        )

        profile = dict(
            refreshed.profile_data or {}
        )

        self.assertEqual(
            profile.get("subject"),
            "Toán",
        )

        self.assertNotEqual(
            profile.get("specialty"),
            "Tin học",
        )

        self.assertNotEqual(
            profile.get("teacherSubject"),
            "Tin học",
        )


if __name__ == "__main__":
    unittest.main()

import unittest
import uuid
from unittest.mock import patch

from app import create_app
from extensions import db
from auth import JWTManager
from models import (
    Exam,
    ProctoringSession,
    User,
)


class ProctoringEvidenceUrlTest(
    unittest.TestCase
):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True

        self.ctx = self.app.app_context()
        self.ctx.push()

        suffix = uuid.uuid4().hex

        self.teacher = User(
            email=f"teacher-{suffix}@example.com",
            password_hash="test",
            role="TEACHER",
            email_verified=True,
        )

        self.other_teacher = User(
            email=f"other-teacher-{suffix}@example.com",
            password_hash="test",
            role="TEACHER",
            email_verified=True,
        )

        self.student = User(
            email=f"student-{suffix}@example.com",
            password_hash="test",
            role="STUDENT",
            email_verified=True,
        )

        db.session.add_all([
            self.teacher,
            self.other_teacher,
            self.student,
        ])
        db.session.flush()

        self.exam = Exam(
            teacher_id=self.teacher.id,
            title="Evidence URL Test",
            selected_grades=[],
            selected_classes=[],
            settings={},
            metadata_json={},
        )

        db.session.add(self.exam)
        db.session.flush()

        self.session_key = (
            f"session-{uuid.uuid4().hex}"
        )

        self.session = ProctoringSession(
            exam_id=self.exam.id,
            student_id=self.student.id,
            session_key=self.session_key,
            status="ACTIVE",
            session_data={},
        )

        db.session.add(self.session)
        db.session.commit()

        self.client = self.app.test_client()

        self.teacher_token = (
            JWTManager.create_access_token(
                self.teacher.to_dict()
            )
        )

        self.other_teacher_token = (
            JWTManager.create_access_token(
                self.other_teacher.to_dict()
            )
        )

        self.student_token = (
            JWTManager.create_access_token(
                self.student.to_dict()
            )
        )

        self.path = (
            f"exam-proctoring/"
            f"{self.exam.id}/"
            f"{self.student.id}/"
            f"{self.session_key}/"
            f"event-camera-video.mp4"
        )

    def tearDown(self):
        db.session.rollback()

        ProctoringSession.query.filter_by(
            id=self.session.id
        ).delete()

        Exam.query.filter_by(
            id=self.exam.id
        ).delete()

        User.query.filter(
            User.id.in_([
                self.teacher.id,
                self.other_teacher.id,
                self.student.id,
            ])
        ).delete(
            synchronize_session=False
        )

        db.session.commit()
        self.ctx.pop()

    @staticmethod
    def headers(token):
        return {
            "Authorization":
                f"Bearer {token}",
        }

    @patch(
        "storage.storage_routes."
        "generate_presigned_get_url"
    )
    def test_owner_teacher_can_sign_video(
        self,
        mock_sign,
    ):
        mock_sign.return_value = (
            "https://example.test/video"
        )

        response = self.client.get(
            "/api/storage/proctoring/evidence-url",
            query_string={
                "path": self.path,
            },
            headers=self.headers(
                self.teacher_token
            ),
        )

        self.assertEqual(
            response.status_code,
            200,
            response.get_json(),
        )

        data = response.get_json()

        self.assertTrue(data["success"])
        self.assertEqual(
            data["url"],
            "https://example.test/video",
        )
        self.assertEqual(
            data["expiresIn"],
            900,
        )

        mock_sign.assert_called_once_with(
            self.path,
            expires_in=900,
        )

    @patch(
        "storage.storage_routes."
        "generate_presigned_get_url"
    )
    def test_other_teacher_is_forbidden(
        self,
        mock_sign,
    ):
        response = self.client.get(
            "/api/storage/proctoring/evidence-url",
            query_string={
                "path": self.path,
            },
            headers=self.headers(
                self.other_teacher_token
            ),
        )

        self.assertEqual(
            response.status_code,
            403,
            response.get_json(),
        )

        mock_sign.assert_not_called()

    @patch(
        "storage.storage_routes."
        "generate_presigned_get_url"
    )
    def test_student_is_forbidden(
        self,
        mock_sign,
    ):
        response = self.client.get(
            "/api/storage/proctoring/evidence-url",
            query_string={
                "path": self.path,
            },
            headers=self.headers(
                self.student_token
            ),
        )

        self.assertEqual(
            response.status_code,
            403,
            response.get_json(),
        )

        mock_sign.assert_not_called()

    @patch(
        "storage.storage_routes."
        "generate_presigned_get_url"
    )
    def test_wrong_session_is_rejected(
        self,
        mock_sign,
    ):
        wrong_path = (
            f"exam-proctoring/"
            f"{self.exam.id}/"
            f"{self.student.id}/"
            f"wrong-session/"
            f"event-camera-video.mp4"
        )

        response = self.client.get(
            "/api/storage/proctoring/evidence-url",
            query_string={
                "path": wrong_path,
            },
            headers=self.headers(
                self.teacher_token
            ),
        )

        self.assertEqual(
            response.status_code,
            404,
            response.get_json(),
        )

        mock_sign.assert_not_called()

    @patch(
        "storage.storage_routes."
        "generate_presigned_get_url"
    )
    def test_non_proctoring_path_is_rejected(
        self,
        mock_sign,
    ):
        response = self.client.get(
            "/api/storage/proctoring/evidence-url",
            query_string={
                "path":
                    "classrooms/1/file.mp4",
            },
            headers=self.headers(
                self.teacher_token
            ),
        )

        self.assertEqual(
            response.status_code,
            400,
            response.get_json(),
        )

        mock_sign.assert_not_called()


if __name__ == "__main__":
    unittest.main()

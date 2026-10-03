import unittest
import uuid

from app import create_app
from auth.auth import JWTManager
from extensions import db
from models import (
    Exam,
    ProctoringEvent,
    ProctoringSession,
    User,
)


class ProctoringEventIntegrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config.update(
            TESTING=True,
        )

        cls.ctx = cls.app.app_context()
        cls.ctx.push()

        suffix = uuid.uuid4().hex[:10]

        cls.teacher = User(
            email=f"proctor-teacher-{suffix}@example.com",
            full_name="Proctor Teacher",
            role="TEACHER",
            profile_data={},
            email_verified=True,
        )

        cls.student = User(
            email=f"proctor-student-{suffix}@example.com",
            full_name="Proctor Student",
            role="STUDENT",
            grade="11",
            class_name="11A04",
            profile_data={},
            email_verified=True,
        )

        db.session.add_all([
            cls.teacher,
            cls.student,
        ])
        db.session.flush()

        cls.exam = Exam(
            teacher_id=cls.teacher.id,
            title=f"AI Proctor Integration {suffix}",
            subject="Tin học",
            duration=45,
            status="public",
            visibility="public",
            selected_grades=[],
            selected_classes=[],
            settings={},
            metadata_json={
                "proctoring": {
                    "enabled": True,
                    "requireCamera": True,
                    "captureCameraEvidence": True,
                },
            },
        )

        db.session.add(cls.exam)
        db.session.commit()

        cls.teacher_id = cls.teacher.id
        cls.student_id = cls.student.id
        cls.exam_id = cls.exam.id

    @classmethod
    def tearDownClass(cls):
        db.session.rollback()

        sessions = db.session.scalars(
            db.select(ProctoringSession).where(
                ProctoringSession.exam_id == cls.exam_id,
                ProctoringSession.student_id == cls.student_id,
            )
        ).all()

        for session in sessions:
            events = db.session.scalars(
                db.select(ProctoringEvent).where(
                    ProctoringEvent.session_id == session.id
                )
            ).all()

            for event in events:
                db.session.delete(event)

            db.session.delete(session)

        exam = db.session.get(
            Exam,
            cls.exam_id,
        )

        if exam:
            db.session.delete(exam)

        for user_id in (
            cls.student_id,
            cls.teacher_id,
        ):
            user = db.session.get(
                User,
                user_id,
            )

            if user:
                db.session.delete(user)

        db.session.commit()
        db.session.remove()
        db.engine.dispose()
        cls.ctx.pop()

    def setUp(self):
        db.session.expire_all()
        self.client = self.app.test_client()

        self.student = db.session.get(
            User,
            self.student_id,
        )

        self.token = JWTManager.create_access_token(
            self.student.to_dict()
        )

        self.headers = {
            "Authorization": f"Bearer {self.token}",
        }

    def test_ai_evidence_merges_without_double_violation(self):
        session_id = "ai-integration-session"
        event_id = "ai-event-001"

        first_payload = {
            "sessionId": session_id,
            "event": {
                "id": event_id,
                "type": "camera_stopped",
                "severity": "violation",
                "metadata": {
                    "aiEventType": "PHONE_DETECTED",
                    "aiConfidence": 0.91,
                    "aiReason": "phone persisted 70%",
                    "aiStatus": "PENDING_REVIEW",
                },
            },
        }

        first_response = self.client.post(
            f"/api/exams/{self.exam_id}/proctoring/events",
            json=first_payload,
            headers=self.headers,
        )

        self.assertEqual(
            first_response.status_code,
            201,
            first_response.get_json(),
        )

        session = db.session.scalar(
            db.select(ProctoringSession).where(
                ProctoringSession.exam_id == self.exam_id,
                ProctoringSession.student_id == self.student_id,
                ProctoringSession.session_key == session_id,
            )
        )

        self.assertIsNotNone(session)
        self.assertEqual(
            session.violation_count,
            1,
        )

        events = db.session.scalars(
            db.select(ProctoringEvent).where(
                ProctoringEvent.session_id == session.id
            )
        ).all()

        self.assertEqual(
            len(events),
            1,
        )

        first_event = events[0]

        self.assertEqual(
            first_event.event_data["id"],
            event_id,
        )

        first_metadata = (
            first_event.event_data["metadata"]
        )

        self.assertEqual(
            first_metadata["aiEventType"],
            "PHONE_DETECTED",
        )
        self.assertEqual(
            first_metadata["aiConfidence"],
            0.91,
        )
        self.assertEqual(
            first_metadata["aiReason"],
            "phone persisted 70%",
        )
        self.assertEqual(
            first_metadata["aiStatus"],
            "PENDING_REVIEW",
        )

        prefix = (
            f"exam-proctoring/"
            f"{self.exam_id}/"
            f"{self.student_id}/"
            f"{session_id}/"
        )

        pre_path = (
            prefix
            + f"{event_id}-camera-snapshot_pre.jpg"
        )

        event_path = (
            prefix
            + f"{event_id}-camera-snapshot_event.jpg"
        )

        video_path = (
            prefix
            + f"{event_id}-camera-video.mp4"
        )

        second_payload = {
            "sessionId": session_id,
            "event": {
                "id": event_id,
                "type": "camera_stopped",
                "severity": "violation",
                "metadata": {
                    "evidenceAiPrePath": pre_path,
                    "evidenceAiEventPath": event_path,
                    "evidenceAiVideoPath": video_path,
                },
            },
        }

        second_response = self.client.post(
            f"/api/exams/{self.exam_id}/proctoring/events",
            json=second_payload,
            headers=self.headers,
        )

        self.assertEqual(
            second_response.status_code,
            201,
            second_response.get_json(),
        )

        db.session.expire_all()

        session = db.session.scalar(
            db.select(ProctoringSession).where(
                ProctoringSession.exam_id == self.exam_id,
                ProctoringSession.student_id == self.student_id,
                ProctoringSession.session_key == session_id,
            )
        )

        self.assertEqual(
            session.violation_count,
            1,
        )

        events = db.session.scalars(
            db.select(ProctoringEvent).where(
                ProctoringEvent.session_id == session.id
            )
        ).all()

        self.assertEqual(
            len(events),
            1,
        )

        merged_event = events[0]
        metadata = (
            merged_event.event_data["metadata"]
        )

        # Metadata ban đầu phải còn nguyên.
        self.assertEqual(
            metadata["aiEventType"],
            "PHONE_DETECTED",
        )
        self.assertEqual(
            metadata["aiConfidence"],
            0.91,
        )
        self.assertEqual(
            metadata["aiReason"],
            "phone persisted 70%",
        )
        self.assertEqual(
            metadata["aiStatus"],
            "PENDING_REVIEW",
        )

        # Evidence được bổ sung vào cùng incident.
        self.assertEqual(
            metadata["evidenceAiPrePath"],
            pre_path,
        )
        self.assertEqual(
            metadata["evidenceAiEventPath"],
            event_path,
        )
        self.assertEqual(
            metadata["evidenceAiVideoPath"],
            video_path,
        )

        self.assertEqual(
            merged_event.event_data["id"],
            event_id,
        )


if __name__ == "__main__":
    unittest.main()

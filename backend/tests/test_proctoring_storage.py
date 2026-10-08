import hashlib
import io
import unittest
from unittest.mock import patch

from app import create_app
from auth import JWTManager
from extensions import db
from models import User


class ProctoringStorageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config.update(
            TESTING=True,
        )

        cls.ctx = cls.app.app_context()
        cls.ctx.push()

        cls.user = User(
            email="proctoring-storage-test@zuny.local",
            role="STUDENT",
        )

        cls.user.email_verified = True
        cls.user.auth_version = 1

        db.session.add(cls.user)
        db.session.commit()
        db.session.refresh(cls.user)

        cls.user_id = cls.user.id

    @classmethod
    def tearDownClass(cls):
        db.session.rollback()

        user = db.session.get(
            User,
            cls.user_id,
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

    def token(self):
        db.session.refresh(self.user)

        return JWTManager.create_access_token(
            self.user.to_dict()
        )

    def post_evidence(
        self,
        *,
        content=b"test-data",
        filename="evidence.jpg",
        content_type="image/jpeg",
        evidence_type=None,
    ):
        data = {
            "file": (
                io.BytesIO(content),
                filename,
                content_type,
            ),
            "examId": "exam123",
            "sessionId": "session123",
            "eventId": "event123",
            "source": "camera",
        }

        if evidence_type is not None:
            data["evidenceType"] = evidence_type

        return self.client.post(
            "/api/storage/proctoring/evidence",
            data=data,
            content_type="multipart/form-data",
            headers={
                "Authorization":
                    f"Bearer {self.token()}",
            },
        )

    def run_with_mocks(self, **kwargs):
        with patch(
            "storage.storage_routes.upload_file_object",
            return_value={
                "contentType":
                    kwargs.get(
                        "upload_content_type",
                        "image/jpeg",
                    ),
            },
        ) as upload_mock:
            response = self.post_evidence(
                **{
                    key: value
                    for key, value in kwargs.items()
                    if key != "upload_content_type"
                }
            )

        return response, upload_mock


    def test_snapshot_sha256_integrity(self):
        content = b"ZUNY snapshot integrity test"

        response, upload_mock = self.run_with_mocks(
            content=content,
        )

        self.assertEqual(response.status_code, 200)
        upload_mock.assert_called_once()

        expected = hashlib.sha256(content).hexdigest()
        payload = response.get_json()
        args, kwargs = upload_mock.call_args

        self.assertEqual(payload["sha256"], expected)
        self.assertEqual(kwargs["metadata"]["sha256"], expected)

    def test_video_sha256_integrity(self):
        content = b"ZUNY video integrity test" * 1024

        response, upload_mock = self.run_with_mocks(
            content=content,
            filename="evidence.mp4",
            content_type="video/mp4",
            evidence_type="video",
            upload_content_type="video/mp4",
        )

        self.assertEqual(response.status_code, 200)
        upload_mock.assert_called_once()

        expected = hashlib.sha256(content).hexdigest()
        payload = response.get_json()
        args, kwargs = upload_mock.call_args

        self.assertEqual(payload["sha256"], expected)
        self.assertEqual(kwargs["metadata"]["sha256"], expected)


    def test_sha256_preserves_upload_bytes(self):
        content = b"ZUNY R2 byte integrity" * 4096
        captured = {}

        def fake_upload(file_storage, object_key, **kwargs):
            captured["position"] = file_storage.stream.tell()
            captured["data"] = file_storage.stream.read()
            captured["metadata"] = kwargs["metadata"]
            captured["key"] = object_key

            return {"contentType": "image/jpeg"}

        with patch(
            "storage.storage_routes.upload_file_object",
            side_effect=fake_upload,
        ) as upload_mock:
            response = self.post_evidence(content=content)

        self.assertEqual(response.status_code, 200)
        upload_mock.assert_called_once()

        expected = hashlib.sha256(content).hexdigest()

        self.assertEqual(captured["position"], 0)
        self.assertEqual(captured["data"], content)
        self.assertEqual(captured["metadata"]["sha256"], expected)
        self.assertEqual(response.get_json()["sha256"], expected)

    def test_legacy_image_defaults_to_snapshot(self):
        response, upload_mock = self.run_with_mocks()

        self.assertEqual(
            response.status_code,
            200,
        )

        payload = response.get_json()

        self.assertTrue(payload["success"])
        self.assertEqual(
            payload["evidenceType"],
            "snapshot",
        )
        self.assertEqual(
            payload["contentType"],
            "image/jpeg",
        )

        upload_mock.assert_called_once()

        args, kwargs = upload_mock.call_args

        self.assertEqual(
            args[1],
            (
                "exam-proctoring/"
                f"exam123/{self.user.id}/session123/"
                "event123-camera-snapshot.jpg"
            ),
        )

        self.assertEqual(
            kwargs["content_type"],
            "image/jpeg",
        )
        self.assertEqual(
            kwargs["metadata"]["evidence_type"],
            "snapshot",
        )

    def test_snapshot_pre_upload(self):
        response, upload_mock = self.run_with_mocks(
            evidence_type="snapshot_pre",
        )

        self.assertEqual(
            response.status_code,
            200,
        )

        args, kwargs = upload_mock.call_args

        self.assertEqual(
            args[1],
            (
                "exam-proctoring/"
                f"exam123/{self.user.id}/session123/"
                "event123-camera-snapshot_pre.jpg"
            ),
        )

        self.assertEqual(
            kwargs["metadata"]["evidence_type"],
            "snapshot_pre",
        )

    def test_snapshot_event_upload(self):
        response, upload_mock = self.run_with_mocks(
            evidence_type="snapshot_event",
        )

        self.assertEqual(
            response.status_code,
            200,
        )

        args, kwargs = upload_mock.call_args

        self.assertEqual(
            args[1],
            (
                "exam-proctoring/"
                f"exam123/{self.user.id}/session123/"
                "event123-camera-snapshot_event.jpg"
            ),
        )

        self.assertEqual(
            kwargs["metadata"]["evidence_type"],
            "snapshot_event",
        )

    def test_video_mp4_upload(self):
        response, upload_mock = self.run_with_mocks(
            content=b"fake-mp4-data",
            filename="evidence.mp4",
            content_type="video/mp4",
            evidence_type="video",
            upload_content_type="video/mp4",
        )

        self.assertEqual(
            response.status_code,
            200,
        )

        payload = response.get_json()

        self.assertEqual(
            payload["evidenceType"],
            "video",
        )
        self.assertEqual(
            payload["contentType"],
            "video/mp4",
        )

        upload_mock.assert_called_once()

        args, kwargs = upload_mock.call_args

        self.assertEqual(
            args[1],
            (
                "exam-proctoring/"
                f"exam123/{self.user.id}/session123/"
                "event123-camera-video.mp4"
            ),
        )

        self.assertEqual(
            kwargs["content_type"],
            "video/mp4",
        )
        self.assertEqual(
            kwargs["metadata"]["evidence_type"],
            "video",
        )

    def test_video_over_10mb_is_rejected_before_r2(self):
        response, upload_mock = self.run_with_mocks(
            content=b"x" * (
                10 * 1024 * 1024 + 1
            ),
            filename="large.mp4",
            content_type="video/mp4",
            evidence_type="video",
        )

        self.assertEqual(
            response.status_code,
            400,
        )

        upload_mock.assert_not_called()

    def test_video_wrong_mime_is_rejected_before_r2(self):
        response, upload_mock = self.run_with_mocks(
            content=b"not-video",
            filename="evidence.jpg",
            content_type="image/jpeg",
            evidence_type="video",
        )

        self.assertEqual(
            response.status_code,
            400,
        )

        upload_mock.assert_not_called()

    def test_invalid_evidence_type_is_rejected_before_r2(self):
        response, upload_mock = self.run_with_mocks(
            evidence_type="anything",
        )

        self.assertEqual(
            response.status_code,
            400,
        )

        upload_mock.assert_not_called()


if __name__ == "__main__":
    unittest.main()

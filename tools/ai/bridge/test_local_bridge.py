from __future__ import annotations

import tempfile
import unittest

from pathlib import Path

from local_bridge import IncidentStore


class IncidentStoreTest(
    unittest.TestCase,
):
    def test_publish_pending_claim(
        self,
    ):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)

            (
                root /
                "snapshot_pre.jpg"
            ).write_bytes(b"pre")

            (
                root /
                "snapshot_event.jpg"
            ).write_bytes(b"event")

            (
                root /
                "evidence.mp4"
            ).write_bytes(b"video")

            store = IncidentStore()

            incident = store.publish(
                event_type="PHONE_DETECTED",
                confidence=0.91,
                reason="phone persisted",
                started_at=123.4,
                evidence_dir=root,
            )

            pending = store.pending()

            self.assertEqual(
                len(pending),
                1,
            )

            self.assertEqual(
                pending[0].bridge_id,
                incident.bridge_id,
            )

            payload = (
                incident.to_dict()
            )

            self.assertEqual(
                payload["eventType"],
                "PHONE_DETECTED",
            )

            self.assertEqual(
                payload["status"],
                "PENDING_REVIEW",
            )

            self.assertTrue(
                payload[
                    "evidence"
                ][
                    "video"
                ].endswith(
                    "/evidence.mp4"
                ),
            )

            self.assertTrue(
                store.claim(
                    incident.bridge_id,
                ),
            )

            self.assertEqual(
                store.pending(),
                [],
            )

    def test_missing_evidence_rejected(
        self,
    ):
        with tempfile.TemporaryDirectory() as tmp:
            store = IncidentStore()

            with self.assertRaises(
                ValueError,
            ):
                store.publish(
                    event_type="PHONE_DETECTED",
                    confidence=0.9,
                    reason="test",
                    started_at=1.0,
                    evidence_dir=tmp,
                )


if __name__ == "__main__":
    unittest.main(
        verbosity=2,
    )

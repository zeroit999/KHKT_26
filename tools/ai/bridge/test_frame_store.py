from __future__ import annotations

import threading
import time
import unittest

from local_bridge import FrameStore


class FrameStoreTest(unittest.TestCase):
    def test_latest_frame_replaces_old_frame(self):
        store = FrameStore()

        first = store.publish(
            data=b"frame-1",
            content_type="image/jpeg",
        )

        second = store.publish(
            data=b"frame-2",
            content_type="image/webp",
        )

        latest = store.latest()

        self.assertIsNotNone(latest)
        self.assertEqual(
            latest.sequence,
            second.sequence,
        )
        self.assertGreater(
            second.sequence,
            first.sequence,
        )
        self.assertEqual(
            latest.data,
            b"frame-2",
        )

    def test_wait_for_next_frame(self):
        store = FrameStore()

        def producer():
            time.sleep(0.05)

            store.publish(
                data=b"new-frame",
                content_type="image/jpeg",
            )

        thread = threading.Thread(
            target=producer,
            daemon=True,
        )
        thread.start()

        frame = store.wait_for_next(
            after_sequence=0,
            timeout=1.0,
        )

        thread.join(timeout=1.0)

        self.assertIsNotNone(frame)
        self.assertEqual(
            frame.data,
            b"new-frame",
        )

    def test_wait_does_not_return_same_frame_twice(self):
        store = FrameStore()

        frame = store.publish(
            data=b"frame",
            content_type="image/jpeg",
        )

        result = store.wait_for_next(
            after_sequence=frame.sequence,
            timeout=0.05,
        )

        self.assertIsNone(result)

    def test_rejects_invalid_frame(self):
        store = FrameStore()

        with self.assertRaises(ValueError):
            store.publish(
                data=b"",
                content_type="image/jpeg",
            )

        with self.assertRaises(ValueError):
            store.publish(
                data=b"video",
                content_type="video/mp4",
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)

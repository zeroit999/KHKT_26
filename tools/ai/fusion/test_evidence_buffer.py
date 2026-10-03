from pathlib import Path
from tempfile import TemporaryDirectory
import json

import cv2
import numpy as np

from evidence_buffer import EvidenceBuffer


def make_frame(value: int) -> np.ndarray:
    return np.full(
        (240, 320, 3),
        value,
        dtype=np.uint8,
    )


with TemporaryDirectory() as temp:
    root = Path(temp)

    recorder = EvidenceBuffer(
        output_dir=root,
        pre_seconds=2.0,
        post_seconds=3.0,
    )

    saved = []

    # 10 FPS, normal rolling history 0 -> 3 sec.
    for i in range(31):
        t = i / 10
        saved += recorder.add_frame(
            t,
            make_frame(i),
        )

    started = recorder.start(
        event_type="PHONE_DETECTED",
        timestamp=3.0,
        confidence=0.82,
        reason="synthetic phone test",
        frame=make_frame(30),
    )

    assert started is True

    # Duplicate START phải bị từ chối.
    assert recorder.start(
        event_type="PHONE_DETECTED",
        timestamp=3.5,
        confidence=0.90,
        reason="duplicate",
        frame=make_frame(35),
    ) is False

    # Thu thêm 3 sec.
    for i in range(31, 62):
        t = i / 10
        saved += recorder.add_frame(
            t,
            make_frame(i),
        )

    assert len(saved) == 1

    directory = saved[0]

    pre = directory / "snapshot_pre.jpg"
    event = directory / "snapshot_event.jpg"
    video = directory / "evidence.mp4"
    metadata_path = directory / "metadata.json"

    assert pre.exists()
    assert event.exists()
    assert video.exists()
    assert metadata_path.exists()

    metadata = json.loads(
        metadata_path.read_text(
            encoding="utf-8"
        )
    )

    assert metadata["event_type"] == "PHONE_DETECTED"
    assert metadata["status"] == "PENDING_REVIEW"
    assert metadata["verdict"] is None

    duration = (
        metadata["last_frame_at"]
        - metadata["first_frame_at"]
    )

    # Xấp xỉ 2 sec trước + 3 sec sau.
    assert 4.8 <= duration <= 5.2

    cap = cv2.VideoCapture(
        str(video)
    )

    assert cap.isOpened()

    video_frames = int(
        cap.get(
            cv2.CAP_PROP_FRAME_COUNT
        )
    )

    cap.release()

    assert video_frames >= 45

    print(
        "EVIDENCE_DIR:",
        directory,
    )

    print(
        "DURATION:",
        f"{duration:.2f}s",
    )

    print(
        "FRAME_COUNT:",
        metadata["frame_count"],
    )

    print(
        "VIDEO_FRAMES:",
        video_frames,
    )

    print(
        "ESTIMATED_FPS:",
        f"{metadata['estimated_fps']:.2f}",
    )

    print(
        "STATUS:",
        metadata["status"],
    )

    print()
    print(
        "ALL EVIDENCE BUFFER TESTS PASSED"
    )


def test_restart_sequence():
    from pathlib import Path
    from tempfile import TemporaryDirectory

    with TemporaryDirectory() as tmp:
        root = Path(tmp)

        (root / "incident_000003_PHONE_DETECTED").mkdir()
        (root / "incident_000007_BOOK_DETECTED").mkdir()

        # Những thư mục không đúng format phải bị bỏ qua.
        (root / "other_directory").mkdir()
        (root / "incident_invalid_PHONE_DETECTED").mkdir()

        restarted = EvidenceBuffer(
            output_dir=root,
            pre_seconds=2.0,
            post_seconds=3.0,
        )

        assert restarted.sequence == 7, (
            f"expected sequence 7, got {restarted.sequence}"
        )

    print(
        "RESTART_SEQUENCE_TEST=PASS"
    )


if __name__ == "__main__":
    test_restart_sequence()

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from pathlib import Path
import json

import cv2
import numpy as np
import subprocess


@dataclass
class BufferedFrame:
    timestamp: float
    frame: np.ndarray


@dataclass
class PendingEvidence:
    event_type: str
    started_at: float
    confidence: float
    reason: str
    frames: list[BufferedFrame]
    event_frame: np.ndarray
    finish_at: float


class EvidenceBuffer:
    """
    Local evidence recorder for ZUNY AI.

    - Giữ rolling buffer trước incident.
    - START tạo một evidence job.
    - Thu thêm frame sau START.
    - Lưu 2 snapshot + MP4 + metadata JSON.
    - Không đưa ra kết luận gian lận.
    """

    def __init__(
        self,
        output_dir: Path,
        pre_seconds: float = 2.0,
        post_seconds: float = 3.0,
    ):
        self.output_dir = Path(output_dir)
        self.pre_seconds = pre_seconds
        self.post_seconds = post_seconds

        self.buffer: deque[BufferedFrame] = deque()
        self.pending: dict[str, PendingEvidence] = {}

        self.output_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        self.sequence = self._load_sequence()

    def _load_sequence(self) -> int:
        """Return the highest existing evidence sequence.

        Evidence directories survive process restarts, so the
        in-memory sequence must continue after the largest existing
        incident_<sequence>_* directory instead of starting at zero.
        """

        highest = 0

        for path in self.output_dir.iterdir():
            if not path.is_dir():
                continue

            parts = path.name.split(
                "_",
                2,
            )

            if (
                len(parts) != 3
                or parts[0] != "incident"
                or not parts[1].isdigit()
            ):
                continue

            highest = max(
                highest,
                int(parts[1]),
            )

        return highest

    def _trim(
        self,
        timestamp: float,
    ) -> None:
        cutoff = timestamp - self.pre_seconds

        while (
            self.buffer
            and self.buffer[0].timestamp < cutoff
        ):
            self.buffer.popleft()

    def add_frame(
        self,
        timestamp: float,
        frame: np.ndarray,
    ) -> list[Path]:
        """
        Gọi đúng một lần cho mỗi camera frame.

        Trả về danh sách evidence directory vừa hoàn tất.
        """

        saved: list[Path] = []

        item = BufferedFrame(
            timestamp=timestamp,
            frame=frame.copy(),
        )

        self.buffer.append(item)
        self._trim(timestamp)

        for event_type in list(self.pending):
            job = self.pending[event_type]

            # Không append lại frame START nếu frame đó
            # đã nằm trong pre-buffer.
            if (
                not job.frames
                or timestamp
                > job.frames[-1].timestamp
            ):
                job.frames.append(
                    BufferedFrame(
                        timestamp=timestamp,
                        frame=frame.copy(),
                    )
                )

            if timestamp >= job.finish_at:
                saved.append(
                    self._save(job)
                )

                del self.pending[event_type]

        return saved

    def start(
        self,
        event_type: str,
        timestamp: float,
        confidence: float,
        reason: str,
        frame: np.ndarray,
    ) -> bool:
        """
        Bắt đầu evidence cho một incident.

        Một event_type đang ghi sẽ không tạo recorder thứ hai.
        """

        if event_type in self.pending:
            return False

        frames = [
            BufferedFrame(
                timestamp=item.timestamp,
                frame=item.frame.copy(),
            )
            for item in self.buffer
        ]

        self.pending[event_type] = PendingEvidence(
            event_type=event_type,
            started_at=timestamp,
            confidence=confidence,
            reason=reason,
            frames=frames,
            event_frame=frame.copy(),
            finish_at=(
                timestamp
                + self.post_seconds
            ),
        )

        return True

    def _estimate_fps(
        self,
        frames: list[BufferedFrame],
    ) -> float:
        if len(frames) < 2:
            return 10.0

        duration = (
            frames[-1].timestamp
            - frames[0].timestamp
        )

        if duration <= 0:
            return 10.0

        fps = (
            (len(frames) - 1)
            / duration
        )

        return max(
            5.0,
            min(30.0, fps),
        )

    def _save(
        self,
        job: PendingEvidence,
    ) -> Path:
        self.sequence += 1

        dirname = (
            f"incident_{self.sequence:06d}_"
            f"{job.event_type}"
        )

        directory = (
            self.output_dir
            / dirname
        )

        directory.mkdir(
            parents=True,
            exist_ok=False,
        )

        frames = job.frames

        if not frames:
            raise RuntimeError(
                "Evidence has no frames"
            )

        # Snapshot gần đầu rolling buffer nhất.
        pre_frame = frames[0].frame

        cv2.imwrite(
            str(directory / "snapshot_pre.jpg"),
            pre_frame,
        )

        cv2.imwrite(
            str(directory / "snapshot_event.jpg"),
            job.event_frame,
        )

        height, width = frames[0].frame.shape[:2]

        fps = self._estimate_fps(frames)

        video_path = (
            directory
            / "evidence.mp4"
        )

        temp_video_path = (
            directory
            / "evidence_source.mp4"
        )

        writer = cv2.VideoWriter(
            str(temp_video_path),
            cv2.VideoWriter_fourcc(
                *"mp4v"
            ),
            fps,
            (width, height),
        )

        if not writer.isOpened():
            raise RuntimeError(
                "Cannot open evidence video writer"
            )

        try:
            for item in frames:
                current = item.frame

                if (
                    current.shape[1] != width
                    or current.shape[0] != height
                ):
                    current = cv2.resize(
                        current,
                        (width, height),
                    )

                writer.write(current)

        finally:
            writer.release()

        try:
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-loglevel",
                    "error",
                    "-i",
                    str(temp_video_path),
                    "-an",
                    "-c:v",
                    "libx264",
                    "-preset",
                    "veryfast",
                    "-crf",
                    "23",
                    "-pix_fmt",
                    "yuv420p",
                    "-movflags",
                    "+faststart",
                    str(video_path),
                ],
                check=True,
            )
        except (
            FileNotFoundError,
            subprocess.CalledProcessError,
        ) as exc:
            raise RuntimeError(
                "Cannot encode H.264 evidence video"
            ) from exc
        finally:
            temp_video_path.unlink(
                missing_ok=True
            )

        metadata = {
            "event_type": job.event_type,
            "started_at": job.started_at,
            "confidence": job.confidence,
            "reason": job.reason,
            "status": "PENDING_REVIEW",
            "verdict": None,
            "pre_seconds": self.pre_seconds,
            "post_seconds": self.post_seconds,
            "frame_count": len(frames),
            "estimated_fps": fps,
            "first_frame_at": frames[0].timestamp,
            "last_frame_at": frames[-1].timestamp,
            "files": {
                "snapshot_pre": "snapshot_pre.jpg",
                "snapshot_event": "snapshot_event.jpg",
                "video": "evidence.mp4",
            },
        }

        (
            directory
            / "metadata.json"
        ).write_text(
            json.dumps(
                metadata,
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        return directory

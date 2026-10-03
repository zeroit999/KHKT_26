from __future__ import annotations

import hmac
import json
import mimetypes
import secrets
import threading
import time
import uuid

from dataclasses import dataclass, field
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


HOST = "127.0.0.1"
PORT = 8765

BRIDGE_TOKEN = secrets.token_urlsafe(32)

ALLOWED_ORIGINS = {
    "https://zunylearn.com",
    "https://www.zunylearn.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
}

ALLOWED_EVIDENCE = {
    "snapshot_pre.jpg": "image/jpeg",
    "snapshot_event.jpg": "image/jpeg",
    "evidence.mp4": "video/mp4",
}

ALLOWED_FRAME_MIME_TYPES = {
    "image/jpeg",
    "image/webp",
}

MAX_FRAME_SIZE = 2 * 1024 * 1024


@dataclass
class BridgeIncident:
    bridge_id: str
    event_type: str
    confidence: float
    reason: str
    started_at: float
    evidence_dir: Path
    created_at: float = field(
        default_factory=time.time,
    )
    claimed: bool = False

    def to_dict(self) -> dict:
        return {
            "bridgeId": self.bridge_id,
            "eventType": self.event_type,
            "confidence": self.confidence,
            "reason": self.reason,
            "startedAt": self.started_at,
            "status": "PENDING_REVIEW",
            "evidence": {
                "snapshotPre": (
                    f"/evidence/{self.bridge_id}/snapshot_pre.jpg"
                ),
                "snapshotEvent": (
                    f"/evidence/{self.bridge_id}/snapshot_event.jpg"
                ),
                "video": (
                    f"/evidence/{self.bridge_id}/evidence.mp4"
                ),
            },
        }


class IncidentStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._incidents: dict[str, BridgeIncident] = {}

    def publish(
        self,
        *,
        event_type: str,
        confidence: float,
        reason: str,
        started_at: float,
        evidence_dir: str | Path,
    ) -> BridgeIncident:
        evidence_path = Path(
            evidence_dir,
        ).resolve()

        if not evidence_path.is_dir():
            raise ValueError(
                f"Evidence directory does not exist: {evidence_path}"
            )

        missing = [
            name
            for name in ALLOWED_EVIDENCE
            if not (
                evidence_path / name
            ).is_file()
        ]

        if missing:
            raise ValueError(
                "Missing evidence files: "
                + ", ".join(missing)
            )

        incident = BridgeIncident(
            bridge_id=uuid.uuid4().hex,
            event_type=str(event_type),
            confidence=max(
                0.0,
                min(
                    1.0,
                    float(confidence),
                ),
            ),
            reason=str(reason),
            started_at=float(started_at),
            evidence_dir=evidence_path,
        )

        with self._lock:
            self._incidents[
                incident.bridge_id
            ] = incident

        return incident

    def pending(self) -> list[BridgeIncident]:
        with self._lock:
            return [
                incident
                for incident in self._incidents.values()
                if not incident.claimed
            ]

    def get(
        self,
        bridge_id: str,
    ) -> BridgeIncident | None:
        with self._lock:
            return self._incidents.get(
                bridge_id,
            )

    def claim(
        self,
        bridge_id: str,
    ) -> bool:
        with self._lock:
            incident = self._incidents.get(
                bridge_id,
            )

            if incident is None:
                return False

            incident.claimed = True
            return True


STORE = IncidentStore()


@dataclass(frozen=True)
class BridgeFrame:
    sequence: int
    received_at: float
    content_type: str
    data: bytes


class FrameStore:
    def __init__(self) -> None:
        self._condition = threading.Condition()
        self._frame: BridgeFrame | None = None
        self._sequence = 0

    def publish(
        self,
        *,
        data: bytes,
        content_type: str,
    ) -> BridgeFrame:
        if not data:
            raise ValueError("Frame is empty")

        if content_type not in {
            "image/jpeg",
            "image/webp",
        }:
            raise ValueError(
                "Unsupported frame content type"
            )

        with self._condition:
            self._sequence += 1

            frame = BridgeFrame(
                sequence=self._sequence,
                received_at=time.time(),
                content_type=content_type,
                data=bytes(data),
            )

            # Latest-frame mailbox:
            # frame mới luôn thay frame cũ, không tạo queue.
            self._frame = frame
            self._condition.notify_all()

            return frame

    def latest(self) -> BridgeFrame | None:
        with self._condition:
            return self._frame

    def wait_for_next(
        self,
        *,
        after_sequence: int = 0,
        timeout: float | None = None,
    ) -> BridgeFrame | None:
        with self._condition:
            if (
                self._frame is not None
                and self._frame.sequence > after_sequence
            ):
                return self._frame

            self._condition.wait_for(
                lambda: (
                    self._frame is not None
                    and self._frame.sequence > after_sequence
                ),
                timeout=timeout,
            )

            if (
                self._frame is None
                or self._frame.sequence <= after_sequence
            ):
                return None

            return self._frame


FRAME_STORE = FrameStore()


class BridgeHandler(BaseHTTPRequestHandler):
    server_version = "ZunyAIBridge/1.0"

    def log_message(
        self,
        format: str,
        *args,
    ) -> None:
        print(
            "[bridge]",
            format % args,
        )

    def _origin(self) -> str:
        return (
            self.headers.get(
                "Origin",
                "",
            )
            .strip()
        )

    def _origin_allowed(self) -> bool:
        return (
            self._origin()
            in ALLOWED_ORIGINS
        )

    def _cors(self) -> None:
        origin = self._origin()

        if origin in ALLOWED_ORIGINS:
            self.send_header(
                "Access-Control-Allow-Origin",
                origin,
            )
            self.send_header(
                "Vary",
                "Origin",
            )

        self.send_header(
            "Access-Control-Allow-Methods",
            "GET, POST, OPTIONS",
        )
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type, X-Zuny-Bridge-Token",
        )
        self.send_header(
            "Cache-Control",
            "no-store",
        )

    def _token_valid(self) -> bool:
        supplied = (
            self.headers.get(
                "X-Zuny-Bridge-Token",
                "",
            )
            .strip()
        )

        return (
            bool(supplied)
            and hmac.compare_digest(
                supplied,
                BRIDGE_TOKEN,
            )
        )

    def _require_origin(self) -> bool:
        if self._origin_allowed():
            return True

        self._json(
            HTTPStatus.FORBIDDEN,
            {
                "error": "origin_not_allowed",
            },
        )
        return False

    def _require_auth(self) -> bool:
        if not self._origin_allowed():
            self._json(
                HTTPStatus.FORBIDDEN,
                {
                    "error": "origin_not_allowed",
                },
            )
            return False

        if not self._token_valid():
            self._json(
                HTTPStatus.UNAUTHORIZED,
                {
                    "error": "invalid_bridge_token",
                },
            )
            return False

        return True

    def _json(
        self,
        status: int,
        payload: dict | list,
    ) -> None:
        raw = json.dumps(
            payload,
            ensure_ascii=False,
        ).encode("utf-8")

        self.send_response(
            status,
        )
        self._cors()
        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8",
        )
        self.send_header(
            "Content-Length",
            str(len(raw)),
        )
        self.end_headers()
        self.wfile.write(
            raw,
        )

    def do_OPTIONS(self) -> None:
        if not self._origin_allowed():
            self.send_response(
                HTTPStatus.FORBIDDEN,
            )
            self._cors()
            self.end_headers()
            return

        self.send_response(
            HTTPStatus.NO_CONTENT,
        )
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(
            self.path,
        )

        if parsed.path == "/health":
            self._json(
                HTTPStatus.OK,
                {
                    "ok": True,
                    "service": "zuny-ai-bridge",
                    "version": 1,
                },
            )
            return

        if parsed.path == "/pair":
            if not self._require_origin():
                return

            self._json(
                HTTPStatus.OK,
                {
                    "ok": True,
                    "token": BRIDGE_TOKEN,
                },
            )
            return

        if parsed.path == "/incidents":
            if not self._require_auth():
                return

            self._json(
                HTTPStatus.OK,
                {
                    "incidents": [
                        incident.to_dict()
                        for incident in STORE.pending()
                    ],
                },
            )
            return

        prefix = "/evidence/"

        if parsed.path.startswith(prefix):
            if not self._require_auth():
                return

            relative = unquote(
                parsed.path[len(prefix):],
            )

            parts = relative.split(
                "/",
            )

            if len(parts) != 2:
                self.send_error(
                    HTTPStatus.NOT_FOUND,
                )
                return

            bridge_id, filename = parts

            if filename not in ALLOWED_EVIDENCE:
                self.send_error(
                    HTTPStatus.NOT_FOUND,
                )
                return

            incident = STORE.get(
                bridge_id,
            )

            if incident is None:
                self.send_error(
                    HTTPStatus.NOT_FOUND,
                )
                return

            file_path = (
                incident.evidence_dir /
                filename
            ).resolve()

            try:
                file_path.relative_to(
                    incident.evidence_dir,
                )
            except ValueError:
                self.send_error(
                    HTTPStatus.FORBIDDEN,
                )
                return

            if not file_path.is_file():
                self.send_error(
                    HTTPStatus.NOT_FOUND,
                )
                return

            data = file_path.read_bytes()

            self.send_response(
                HTTPStatus.OK,
            )
            self._cors()
            self.send_header(
                "Content-Type",
                ALLOWED_EVIDENCE.get(
                    filename,
                    mimetypes.guess_type(
                        filename,
                    )[0]
                    or "application/octet-stream",
                ),
            )
            self.send_header(
                "Content-Length",
                str(len(data)),
            )
            self.end_headers()
            self.wfile.write(
                data,
            )
            return

        self.send_error(
            HTTPStatus.NOT_FOUND,
        )

    def do_POST(self) -> None:
        parsed = urlparse(
            self.path,
        )

        if parsed.path == "/frames":
            if not self._require_auth():
                return

            content_type = (
                self.headers.get(
                    "Content-Type",
                    "",
                )
                .split(";", 1)[0]
                .strip()
                .lower()
            )

            if (
                content_type
                not in ALLOWED_FRAME_MIME_TYPES
            ):
                self._json(
                    HTTPStatus.UNSUPPORTED_MEDIA_TYPE,
                    {
                        "error":
                            "unsupported_frame_type",
                    },
                )
                return

            raw_length = (
                self.headers.get(
                    "Content-Length",
                    "",
                )
                .strip()
            )

            try:
                content_length = int(
                    raw_length
                )
            except ValueError:
                self._json(
                    HTTPStatus.BAD_REQUEST,
                    {
                        "error":
                            "invalid_content_length",
                    },
                )
                return

            if content_length <= 0:
                self._json(
                    HTTPStatus.BAD_REQUEST,
                    {
                        "error": "empty_frame",
                    },
                )
                return

            if content_length > MAX_FRAME_SIZE:
                self._json(
                    HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
                    {
                        "error": "frame_too_large",
                    },
                )
                return

            data = self.rfile.read(
                content_length
            )

            if len(data) != content_length:
                self._json(
                    HTTPStatus.BAD_REQUEST,
                    {
                        "error": "incomplete_frame",
                    },
                )
                return

            try:
                frame = FRAME_STORE.publish(
                    data=data,
                    content_type=content_type,
                )
            except ValueError as exc:
                self._json(
                    HTTPStatus.BAD_REQUEST,
                    {
                        "error": "invalid_frame",
                        "message": str(exc),
                    },
                )
                return

            self._json(
                HTTPStatus.OK,
                {
                    "ok": True,
                    "sequence": frame.sequence,
                    "receivedAt":
                        frame.received_at,
                },
            )
            return

        prefix = "/incidents/"
        suffix = "/claim"

        if (
            parsed.path.startswith(prefix)
            and parsed.path.endswith(suffix)
        ):
            if not self._require_auth():
                return

            bridge_id = parsed.path[
                len(prefix):
                -len(suffix)
            ].strip("/")

            if not bridge_id:
                self.send_error(
                    HTTPStatus.NOT_FOUND,
                )
                return

            if not STORE.claim(
                bridge_id,
            ):
                self.send_error(
                    HTTPStatus.NOT_FOUND,
                )
                return

            self._json(
                HTTPStatus.OK,
                {
                    "ok": True,
                    "bridgeId": bridge_id,
                },
            )
            return

        self.send_error(
            HTTPStatus.NOT_FOUND,
        )


def run_bridge(
    host: str = HOST,
    port: int = PORT,
) -> None:
    server = ThreadingHTTPServer(
        (
            host,
            port,
        ),
        BridgeHandler,
    )

    print(
        f"ZUNY AI Bridge listening on "
        f"http://{host}:{port}"
    )

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


def start_bridge_thread(
    host: str = HOST,
    port: int = PORT,
) -> threading.Thread:
    thread = threading.Thread(
        target=run_bridge,
        kwargs={
            "host": host,
            "port": port,
        },
        name="zuny-ai-bridge",
        daemon=True,
    )
    thread.start()
    return thread


if __name__ == "__main__":
    run_bridge()

from pathlib import Path
from time import perf_counter
import sys

import cv2
import numpy as np
import torch
from torch import nn
from torchvision import transforms
from torchvision.models import efficientnet_b0
from PIL import Image
from ultralytics import YOLO

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from temporal_engine import TemporalFusionEngine
from incident_lifecycle import IncidentLifecycle
from evidence_buffer import EvidenceBuffer

BRIDGE_DIR = HERE.parent / "bridge"
sys.path.insert(0, str(BRIDGE_DIR))

from local_bridge import (
    FRAME_STORE,
    STORE,
    start_bridge_thread,
)


ROOT = Path(__file__).resolve().parents[3]

YOLO_PATH = (
    ROOT
    / "runs/proctoring/zuny-proctor-v1/weights/best.pt"
)

BEHAVIOR_PATH = (
    ROOT
    / "runs/behavior/zuny-behavior-v1/best.pt"
)

YOLO_CONF = 0.35

# Production/headless mode.
# Browser owns the camera; OpenCV preview is disabled by default.
ENABLE_PREVIEW = False

DEVICE = torch.device(
    "cuda"
    if torch.cuda.is_available()
    else "cpu"
)


print("===== ZUNY LIVE FUSION V1 =====")
print("Device:", DEVICE)

if DEVICE.type == "cuda":
    print(
        "GPU:",
        torch.cuda.get_device_name(0)
    )


# ============================================================
# YOLO
# ============================================================

detector = YOLO(
    str(YOLO_PATH)
)

print(
    "YOLO:",
    YOLO_PATH
)


# ============================================================
# BEHAVIOR
# ============================================================

checkpoint = torch.load(
    BEHAVIOR_PATH,
    map_location=DEVICE,
    weights_only=False,
)

classes = checkpoint["classes"]

classifier = efficientnet_b0(
    weights=None
)

classifier.classifier[1] = nn.Linear(
    classifier.classifier[1].in_features,
    len(classes),
)

classifier.load_state_dict(
    checkpoint["model_state_dict"]
)

classifier = classifier.to(DEVICE)
classifier.eval()

print(
    "Behavior:",
    BEHAVIOR_PATH
)


behavior_tf = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[
            0.485,
            0.456,
            0.406,
        ],
        std=[
            0.229,
            0.224,
            0.225,
        ],
    ),
])


# ============================================================
# FUSION
# ============================================================

engine = TemporalFusionEngine(
    window_seconds=3.0,
    cooldown_seconds=8.0,
)

lifecycle = IncidentLifecycle(
    release_seconds=2.0,
)

evidence = EvidenceBuffer(
    output_dir=ROOT / "runs/evidence",
    pre_seconds=2.0,
    post_seconds=3.0,
)

bridge_thread = start_bridge_thread()

print(
    "AI Bridge:",
    "http://127.0.0.1:8765",
)


# ============================================================
# BROWSER CAMERA SOURCE
# ============================================================

print(
    "Camera source:",
    "browser -> ZUNY AI Bridge /frames",
)

print(
    "Waiting for browser camera frames..."
)

print()
print(
    "Q = quit"
)
print()

last_frame_sequence = 0


# ============================================================
# TIMING
# ============================================================

start_time = perf_counter()

fps_start = start_time
fps_frames = 0
fps = 0.0

last_status = start_time


# ============================================================
# LOOP
# ============================================================

while True:

    bridge_frame = FRAME_STORE.wait_for_next(
        after_sequence=last_frame_sequence,
        timeout=0.5,
    )

    if bridge_frame is None:
        continue

    last_frame_sequence = (
        bridge_frame.sequence
    )

    encoded = np.frombuffer(
        bridge_frame.data,
        dtype=np.uint8,
    )

    frame = cv2.imdecode(
        encoded,
        cv2.IMREAD_COLOR,
    )

    if frame is None:
        print(
            "WARNING: invalid browser frame skipped"
        )
        continue

    now = perf_counter()

    timestamp = (
        now - start_time
    )

    completed_evidence = evidence.add_frame(
        timestamp=timestamp,
        frame=frame,
    )

    for evidence_dir in completed_evidence:
        print()
        print(
            ">>> EVIDENCE SAVED:",
            evidence_dir,
        )

        metadata_path = (
            Path(evidence_dir)
            / "metadata.json"
        )

        try:
            import json

            metadata = json.loads(
                metadata_path.read_text(
                    encoding="utf-8",
                )
            )

            bridge_incident = STORE.publish(
                event_type=metadata[
                    "event_type"
                ],
                confidence=metadata[
                    "confidence"
                ],
                reason=metadata[
                    "reason"
                ],
                started_at=metadata[
                    "started_at"
                ],
                evidence_dir=evidence_dir,
            )

            print(
                ">>> AI BRIDGE PUBLISHED:",
                bridge_incident.bridge_id,
                bridge_incident.event_type,
            )

        except (
            OSError,
            KeyError,
            TypeError,
            ValueError,
            json.JSONDecodeError,
        ) as exc:
            print(
                ">>> AI BRIDGE PUBLISH FAILED:",
                exc,
            )

        print()


    # ========================================================
    # YOLO
    # ========================================================

    result = detector.predict(
        frame,
        imgsz=640,
        conf=YOLO_CONF,
        device=(
            0
            if DEVICE.type == "cuda"
            else "cpu"
        ),
        verbose=False,
    )[0]


    annotated = frame.copy()

    yolo_signals = {}


    if result.boxes is not None:

        for box in result.boxes:

            cls_id = int(
                box.cls[0].item()
            )

            confidence = float(
                box.conf[0].item()
            )

            name = result.names[
                cls_id
            ]

            # Nếu cùng class xuất hiện nhiều lần,
            # giữ confidence cao nhất.
            yolo_signals[name] = max(
                yolo_signals.get(
                    name,
                    0.0,
                ),
                confidence,
            )

            x1, y1, x2, y2 = (
                box.xyxy[0]
                .cpu()
                .numpy()
                .astype(int)
            )

            cv2.rectangle(
                annotated,
                (x1, y1),
                (x2, y2),
                (0, 255, 0),
                2,
            )

            cv2.putText(
                annotated,
                f"{name} {confidence:.2f}",
                (
                    x1,
                    max(
                        25,
                        y1 - 8,
                    ),
                ),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 255, 0),
                2,
            )


    # ========================================================
    # BEHAVIOR
    # ========================================================

    rgb = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2RGB,
    )

    image = Image.fromarray(
        rgb
    )

    tensor = (
        behavior_tf(image)
        .unsqueeze(0)
        .to(DEVICE)
    )


    with torch.no_grad():

        with torch.amp.autocast(
            "cuda",
            enabled=(
                DEVICE.type == "cuda"
            ),
        ):

            logits = classifier(
                tensor
            )

        probabilities = torch.softmax(
            logits,
            dim=1,
        )[0]


    behavior_signals = {
        classes[i]: float(
            probabilities[i].item()
        )
        for i in range(
            len(classes)
        )
    }


    behavior_idx = int(
        probabilities.argmax().item()
    )

    behavior_name = classes[
        behavior_idx
    ]

    behavior_conf = (
        behavior_signals[
            behavior_name
        ]
    )


    # ========================================================
    # FUSION ENGINE
    # ========================================================

    # Giữ engine.update() để bảo toàn API/test hiện tại.
    # Lifecycle KHÔNG dùng output cooldown của hàm này.
    engine.update(
        timestamp=timestamp,
        yolo=yolo_signals,
        behavior=behavior_signals,
    )

    active_signals = (
        engine.get_active_signals()
    )

    lifecycle_events = lifecycle.update(
        timestamp=timestamp,
        detected=active_signals,
    )

    for event in lifecycle_events:

        if event.action == "START":
            evidence_started = evidence.start(
                event_type=event.event_type,
                timestamp=event.timestamp,
                confidence=event.confidence,
                reason=event.reason,
                frame=frame,
            )

            if evidence_started:
                print()
                print(
                    ">>> EVIDENCE RECORDING STARTED | "
                    f"{event.event_type}"
                )

        print()

        print(
            f">>> {event.action} "
            f"t={event.timestamp:.1f}s | "
            f"{event.event_type} | "
            f"conf={event.confidence:.2f}"
        )

        print(
            "    started_at:",
            f"{event.started_at:.1f}s",
        )

        print(
            "    reason:",
            event.reason,
        )

        print(
            "    objects:",
            yolo_signals,
        )

        print(
            "    behavior:",
            (
                f"{behavior_name} "
                f"{behavior_conf:.2f}"
            ),
        )

        print()

    # ========================================================
    # FPS
    # ========================================================

    fps_frames += 1

    elapsed = (
        now - fps_start
    )

    if elapsed >= 1.0:

        fps = (
            fps_frames
            / elapsed
        )

        fps_frames = 0
        fps_start = now


    # ========================================================
    # PERIODIC STATUS
    # ========================================================

    if (
        now - last_status
        >= 3.0
    ):

        objects_text = (
            ", ".join(
                f"{k}:{v:.2f}"
                for k, v
                in yolo_signals.items()
            )
            or "none"
        )

        print(
            f"STATUS t={timestamp:5.1f}s | "
            f"FPS={fps:4.1f} | "
            f"behavior="
            f"{behavior_name}:"
            f"{behavior_conf:.2f} | "
            f"objects=[{objects_text}]"
        )

        last_status = now


    # ========================================================
    # UI
    # ========================================================

    cv2.rectangle(
        annotated,
        (10, 10),
        (650, 115),
        (0, 0, 0),
        -1,
    )

    cv2.putText(
        annotated,
        "ZUNY AI - LIVE FUSION V1",
        (25, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.72,
        (255, 255, 255),
        2,
    )

    cv2.putText(
        annotated,
        (
            f"Behavior: "
            f"{behavior_name} "
            f"{behavior_conf:.2f}"
        ),
        (25, 72),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.62,
        (255, 255, 255),
        2,
    )

    cv2.putText(
        annotated,
        f"FPS: {fps:.1f}",
        (25, 102),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.60,
        (255, 255, 255),
        2,
    )


    if lifecycle.active:

        cv2.putText(
            annotated,
            "SUSPICIOUS EVENT",
            (
                max(
                    20,
                    annotated.shape[1] - 310,
                ),
                45,
            ),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.75,
            (0, 0, 255),
            2,
        )


    if ENABLE_PREVIEW:
        cv2.imshow(
            "ZUNY Live Fusion",
            annotated,
        )

        key = (
            cv2.waitKey(1)
            & 0xFF
        )

        if key == ord("q"):
            break


if ENABLE_PREVIEW:
    cv2.destroyAllWindows()

print()
print(
    "===== LIVE FUSION ENDED ====="
)

from pathlib import Path
from collections import deque
from time import perf_counter

import cv2
import numpy as np
import torch
from torch import nn
from torchvision import transforms
from torchvision.models import efficientnet_b0
from PIL import Image
from ultralytics import YOLO


# ============================================================
# CONFIG
# ============================================================

YOLO_PATH = Path(
    "runs/proctoring/zuny-proctor-v1/weights/best.pt"
)

BEHAVIOR_PATH = Path(
    "runs/behavior/zuny-behavior-v1/best.pt"
)

CAMERA_ID = 0

YOLO_CONF = 0.35
SMOOTH_FRAMES = 8

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available()
    else "cpu"
)


# ============================================================
# VERIFY
# ============================================================

if not YOLO_PATH.exists():
    raise SystemExit(
        f"Missing YOLO model: {YOLO_PATH}"
    )

if not BEHAVIOR_PATH.exists():
    raise SystemExit(
        f"Missing behavior model: {BEHAVIOR_PATH}"
    )

print("===== ZUNY AI LIVE TEST V2 =====")
print("Device :", DEVICE)

if torch.cuda.is_available():
    print(
        "GPU    :",
        torch.cuda.get_device_name(0)
    )


# ============================================================
# YOLO
# ============================================================

detector = YOLO(
    str(YOLO_PATH)
)

print(
    "YOLO   :",
    YOLO_PATH
)


# ============================================================
# BEHAVIOR
# ============================================================

checkpoint = torch.load(
    BEHAVIOR_PATH,
    map_location=DEVICE,
    weights_only=False
)

classes = checkpoint["classes"]

behavior = efficientnet_b0(
    weights=None
)

behavior.classifier[1] = nn.Linear(
    behavior.classifier[1].in_features,
    len(classes)
)

behavior.load_state_dict(
    checkpoint["model_state_dict"]
)

behavior = behavior.to(DEVICE)
behavior.eval()

print(
    "Behavior:",
    BEHAVIOR_PATH
)

print(
    "Classes :",
    classes
)


# ============================================================
# TRANSFORM
# ============================================================

behavior_tf = transforms.Compose([
    transforms.Resize(256),

    transforms.CenterCrop(224),

    transforms.ToTensor(),

    transforms.Normalize(
        mean=[
            0.485,
            0.456,
            0.406
        ],
        std=[
            0.229,
            0.224,
            0.225
        ]
    ),
])


# ============================================================
# CAMERA
# ============================================================

cap = cv2.VideoCapture(
    CAMERA_ID
)

if not cap.isOpened():
    raise SystemExit(
        f"Cannot open camera {CAMERA_ID}"
    )

cap.set(
    cv2.CAP_PROP_FRAME_WIDTH,
    1280
)

cap.set(
    cv2.CAP_PROP_FRAME_HEIGHT,
    720
)

width = int(
    cap.get(
        cv2.CAP_PROP_FRAME_WIDTH
    )
)

height = int(
    cap.get(
        cv2.CAP_PROP_FRAME_HEIGHT
    )
)

print(
    f"Camera : /dev/video{CAMERA_ID}"
)

print(
    f"Size   : {width}x{height}"
)

print()
print("Press Q to quit.")
print()


# ============================================================
# STATE
# ============================================================

history = deque(
    maxlen=SMOOTH_FRAMES
)

fps_start = perf_counter()
fps_frames = 0
fps = 0.0

last_log = 0.0
last_behavior = None


# ============================================================
# LOOP
# ============================================================

while True:

    ok, frame = cap.read()

    if not ok:
        print(
            "ERROR: camera frame failed"
        )
        break


    # ========================================================
    # YOLO
    # ========================================================

    result = detector.predict(
        source=frame,
        imgsz=640,
        conf=YOLO_CONF,
        device=(
            0
            if DEVICE.type == "cuda"
            else "cpu"
        ),
        verbose=False
    )[0]

    annotated = frame.copy()

    detections = []

    if result.boxes is not None:

        for box in result.boxes:

            cls_id = int(
                box.cls[0].item()
            )

            conf = float(
                box.conf[0].item()
            )

            name = result.names[
                cls_id
            ]

            detections.append(
                (name, conf)
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
                2
            )

            cv2.putText(
                annotated,
                f"{name} {conf:.2f}",
                (
                    x1,
                    max(
                        25,
                        y1 - 8
                    )
                ),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.60,
                (0, 255, 0),
                2
            )


    # ========================================================
    # BEHAVIOR
    # ========================================================

    rgb = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2RGB
    )

    pil = Image.fromarray(
        rgb
    )

    tensor = (
        behavior_tf(pil)
        .unsqueeze(0)
        .to(DEVICE)
    )

    with torch.no_grad():

        with torch.amp.autocast(
            "cuda",
            enabled=(
                DEVICE.type == "cuda"
            )
        ):

            logits = behavior(
                tensor
            )

        probabilities = torch.softmax(
            logits,
            dim=1
        )[0]

    history.append(
        probabilities
        .detach()
        .cpu()
        .numpy()
    )

    smooth = np.mean(
        history,
        axis=0
    )

    order = np.argsort(
        smooth
    )[::-1]

    best_idx = int(
        order[0]
    )

    behavior_name = classes[
        best_idx
    ]

    behavior_conf = float(
        smooth[best_idx]
    )

    top3 = [
        (
            classes[int(i)],
            float(smooth[int(i)])
        )
        for i in order[:3]
    ]


    # ========================================================
    # FPS
    # ========================================================

    fps_frames += 1

    now = perf_counter()

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
    # TERMINAL LOG
    # ========================================================

    behavior_changed = (
        behavior_name
        != last_behavior
    )

    periodic_log = (
        now - last_log
        >= 2.0
    )

    if (
        behavior_changed
        or periodic_log
    ):

        det_text = (
            ", ".join(
                f"{name}:{conf:.2f}"
                for name, conf
                in detections
            )
            if detections
            else "none"
        )

        top_text = " | ".join(
            f"{name}:{conf:.2f}"
            for name, conf
            in top3
        )

        print(
            f"FPS={fps:5.1f} | "
            f"behavior="
            f"{behavior_name}:"
            f"{behavior_conf:.2f} | "
            f"top3=[{top_text}] | "
            f"objects=[{det_text}]"
        )

        last_behavior = (
            behavior_name
        )

        last_log = now


    # ========================================================
    # UI
    # ========================================================

    cv2.rectangle(
        annotated,
        (10, 10),
        (610, 150),
        (0, 0, 0),
        -1
    )

    cv2.putText(
        annotated,
        "ZUNY AI - LIVE TEST V2",
        (25, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.75,
        (255, 255, 255),
        2
    )

    cv2.putText(
        annotated,
        (
            f"Behavior: "
            f"{behavior_name}"
        ),
        (25, 72),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.70,
        (255, 255, 255),
        2
    )

    cv2.putText(
        annotated,
        (
            f"Confidence: "
            f"{behavior_conf:.2f}"
        ),
        (25, 102),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        (255, 255, 255),
        2
    )

    top2_text = (
        f"2nd: "
        f"{top3[1][0]} "
        f"{top3[1][1]:.2f}"
    )

    cv2.putText(
        annotated,
        top2_text,
        (25, 132),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.60,
        (255, 255, 255),
        2
    )

    cv2.putText(
        annotated,
        f"FPS: {fps:.1f}",
        (
            max(
                10,
                annotated.shape[1]
                - 170
            ),
            35
        ),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.70,
        (255, 255, 255),
        2
    )

    cv2.imshow(
        "ZUNY AI Live Test V2",
        annotated
    )

    key = (
        cv2.waitKey(1)
        & 0xFF
    )

    if key == ord("q"):
        break


# ============================================================
# CLEANUP
# ============================================================

cap.release()
cv2.destroyAllWindows()

print()
print(
    "===== LIVE TEST ENDED ====="
)

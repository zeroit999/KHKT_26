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


YOLO_PATH = Path(
    "runs/proctoring/zuny-proctor-v1/weights/best.pt"
)

BEHAVIOR_PATH = Path(
    "runs/behavior/zuny-behavior-v1/best.pt"
)

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available()
    else "cpu"
)

CAMERA_ID = 0
YOLO_CONF = 0.35
SMOOTH = 8


# ============================================================
# MODELS
# ============================================================

print("===== ZUNY AI FULL vs STUDENT CROP =====")
print("Device:", DEVICE)

detector = YOLO(
    str(YOLO_PATH)
)

checkpoint = torch.load(
    BEHAVIOR_PATH,
    map_location=DEVICE,
    weights_only=False
)

classes = checkpoint["classes"]

classifier = efficientnet_b0(
    weights=None
)

classifier.classifier[1] = nn.Linear(
    classifier.classifier[1].in_features,
    len(classes)
)

classifier.load_state_dict(
    checkpoint["model_state_dict"]
)

classifier = classifier.to(DEVICE)
classifier.eval()


tf = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])


# ============================================================
# CLASSIFIER FUNCTION
# ============================================================

def classify(image_bgr):

    rgb = cv2.cvtColor(
        image_bgr,
        cv2.COLOR_BGR2RGB
    )

    image = Image.fromarray(rgb)

    tensor = (
        tf(image)
        .unsqueeze(0)
        .to(DEVICE)
    )

    with torch.no_grad():

        with torch.amp.autocast(
            "cuda",
            enabled=DEVICE.type == "cuda"
        ):

            logits = classifier(tensor)

        probs = torch.softmax(
            logits,
            dim=1
        )[0]

    return (
        probs.detach()
        .cpu()
        .numpy()
    )


# ============================================================
# CAMERA
# ============================================================

cap = cv2.VideoCapture(
    CAMERA_ID
)

if not cap.isOpened():
    raise SystemExit(
        "Cannot open camera"
    )

cap.set(
    cv2.CAP_PROP_FRAME_WIDTH,
    1280
)

cap.set(
    cv2.CAP_PROP_FRAME_HEIGHT,
    720
)


full_history = deque(
    maxlen=SMOOTH
)

crop_history = deque(
    maxlen=SMOOTH
)


fps_start = perf_counter()
fps_frames = 0
fps = 0.0

last_log = 0.0


print("Press Q to quit.")
print()


# ============================================================
# LOOP
# ============================================================

while True:

    ok, frame = cap.read()

    if not ok:
        break


    # --------------------------------------------------------
    # YOLO
    # --------------------------------------------------------

    result = detector.predict(
        frame,
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

    student_candidates = []

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

            coords = (
                box.xyxy[0]
                .cpu()
                .numpy()
                .astype(int)
            )

            x1, y1, x2, y2 = coords

            detections.append(
                (name, conf)
            )

            if name == "student":

                area = max(
                    0,
                    (x2 - x1)
                    * (y2 - y1)
                )

                student_candidates.append(
                    (
                        area,
                        conf,
                        x1,
                        y1,
                        x2,
                        y2
                    )
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
                    max(25, y1 - 8)
                ),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 255, 0),
                2
            )


    # --------------------------------------------------------
    # FULL FRAME CLASSIFICATION
    # --------------------------------------------------------

    full_probs = classify(
        frame
    )

    full_history.append(
        full_probs
    )

    full_smooth = np.mean(
        full_history,
        axis=0
    )

    full_idx = int(
        np.argmax(full_smooth)
    )

    full_name = classes[
        full_idx
    ]

    full_conf = float(
        full_smooth[full_idx]
    )


    # --------------------------------------------------------
    # STUDENT CROP
    # --------------------------------------------------------

    crop_name = "NO STUDENT"
    crop_conf = 0.0

    crop_box = None


    if student_candidates:

        # Largest student = primary examinee
        student_candidates.sort(
            reverse=True,
            key=lambda x: x[0]
        )

        (
            _,
            student_det_conf,
            x1,
            y1,
            x2,
            y2
        ) = student_candidates[0]


        h, w = frame.shape[:2]

        # Add 15% context around student.
        bw = x2 - x1
        bh = y2 - y1

        padx = int(
            bw * 0.15
        )

        pady = int(
            bh * 0.15
        )

        cx1 = max(
            0,
            x1 - padx
        )

        cy1 = max(
            0,
            y1 - pady
        )

        cx2 = min(
            w,
            x2 + padx
        )

        cy2 = min(
            h,
            y2 + pady
        )


        if (
            cx2 > cx1
            and cy2 > cy1
        ):

            crop = frame[
                cy1:cy2,
                cx1:cx2
            ]

            crop_probs = classify(
                crop
            )

            crop_history.append(
                crop_probs
            )

            crop_smooth = np.mean(
                crop_history,
                axis=0
            )

            crop_idx = int(
                np.argmax(
                    crop_smooth
                )
            )

            crop_name = classes[
                crop_idx
            ]

            crop_conf = float(
                crop_smooth[
                    crop_idx
                ]
            )

            crop_box = (
                cx1,
                cy1,
                cx2,
                cy2
            )


    # --------------------------------------------------------
    # CROP BOX
    # --------------------------------------------------------

    if crop_box is not None:

        cx1, cy1, cx2, cy2 = (
            crop_box
        )

        cv2.rectangle(
            annotated,
            (cx1, cy1),
            (cx2, cy2),
            (255, 255, 255),
            2
        )


    # --------------------------------------------------------
    # FPS
    # --------------------------------------------------------

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


    # --------------------------------------------------------
    # TERMINAL
    # --------------------------------------------------------

    if now - last_log >= 2.0:

        objects = ", ".join(
            f"{name}:{conf:.2f}"
            for name, conf
            in detections
        )

        if not objects:
            objects = "none"

        print(
            f"FPS={fps:4.1f} | "
            f"FULL={full_name}:{full_conf:.2f} | "
            f"CROP={crop_name}:{crop_conf:.2f} | "
            f"objects=[{objects}]"
        )

        last_log = now


    # --------------------------------------------------------
    # DISPLAY
    # --------------------------------------------------------

    cv2.rectangle(
        annotated,
        (10, 10),
        (650, 130),
        (0, 0, 0),
        -1
    )

    cv2.putText(
        annotated,
        "ZUNY AI - A/B TEST",
        (25, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.75,
        (255, 255, 255),
        2
    )

    cv2.putText(
        annotated,
        (
            f"FULL : "
            f"{full_name} "
            f"{full_conf:.2f}"
        ),
        (25, 75),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        (255, 255, 255),
        2
    )

    cv2.putText(
        annotated,
        (
            f"CROP : "
            f"{crop_name} "
            f"{crop_conf:.2f}"
        ),
        (25, 108),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        (255, 255, 255),
        2
    )

    cv2.putText(
        annotated,
        f"FPS {fps:.1f}",
        (
            max(
                10,
                annotated.shape[1] - 150
            ),
            35
        ),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        (255, 255, 255),
        2
    )


    cv2.imshow(
        "ZUNY AI A-B Test",
        annotated
    )


    if (
        cv2.waitKey(1)
        & 0xFF
    ) == ord("q"):
        break


cap.release()

cv2.destroyAllWindows()

print()
print("===== TEST COMPLETE =====")

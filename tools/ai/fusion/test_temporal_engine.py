from temporal_engine import TemporalFusionEngine


def run_scenario(
    name,
    frames,
):
    print()
    print("=" * 65)
    print(name)
    print("=" * 65)

    engine = TemporalFusionEngine(
        window_seconds=3.0,
        cooldown_seconds=8.0,
    )

    incidents = []

    for frame in frames:

        found = engine.update(
            timestamp=frame["t"],
            yolo=frame.get(
                "yolo",
                {}
            ),
            behavior=frame.get(
                "behavior",
                {}
            ),
        )

        for incident in found:
            incidents.append(incident)

            print(
                f"t={incident.timestamp:5.1f}s | "
                f"{incident.event_type:24s} | "
                f"conf={incident.confidence:.2f} | "
                f"{incident.reason}"
            )

    if not incidents:
        print("NO INCIDENT")

    return incidents


# ============================================================
# 10 FPS synthetic stream
# ============================================================

def stream(
    seconds,
    generator,
):
    result = []

    total = int(
        seconds * 10
    )

    for i in range(total):

        t = i / 10

        result.append(
            generator(t)
        )

    return result


# ------------------------------------------------------------
# Scenario 1:
# Bình thường -> KHÔNG được tạo incident
# ------------------------------------------------------------

normal = stream(
    6,
    lambda t: {
        "t": t,
        "yolo": {
            "student": 0.85
        },
        "behavior": {
            "normal act": 0.70,
            "looking friend": 0.20,
        },
    },
)

a = run_scenario(
    "SCENARIO 1 - NORMAL",
    normal,
)

assert len(a) == 0


# ------------------------------------------------------------
# Scenario 2:
# Phone chỉ lóe 2 frame -> KHÔNG cảnh báo
# ------------------------------------------------------------

phone_flash = stream(
    6,
    lambda t: {
        "t": t,
        "yolo": {
            "student": 0.85,
            "phone": (
                0.80
                if 2.0 <= t < 2.2
                else 0.0
            ),
        },
        "behavior": {
            "normal act": 0.70
        },
    },
)

b = run_scenario(
    "SCENARIO 2 - PHONE FLASH",
    phone_flash,
)

assert not any(
    x.event_type
    == "PHONE_DETECTED"
    for x in b
)


# ------------------------------------------------------------
# Scenario 3:
# Phone duy trì -> PHẢI cảnh báo
# ------------------------------------------------------------

phone_persist = stream(
    8,
    lambda t: {
        "t": t,
        "yolo": {
            "student": 0.85,
            "phone": (
                0.82
                if 2.0 <= t <= 6.0
                else 0.0
            ),
        },
        "behavior": {
            "normal act": 0.65
        },
    },
)

c = run_scenario(
    "SCENARIO 3 - PHONE PERSIST",
    phone_persist,
)

assert any(
    x.event_type
    == "PHONE_DETECTED"
    for x in c
)


# ------------------------------------------------------------
# Scenario 4:
# Behavior looking_friend 0.95 thoáng qua
# -> KHÔNG cảnh báo
# ------------------------------------------------------------

look_flash = stream(
    6,
    lambda t: {
        "t": t,
        "yolo": {
            "student": 0.85
        },
        "behavior": {
            "looking friend": (
                0.95
                if 2.0 <= t < 2.5
                else 0.25
            ),
            "normal act": 0.60,
        },
    },
)

d = run_scenario(
    "SCENARIO 4 - LOOK FLASH",
    look_flash,
)

assert len(d) == 0


# ------------------------------------------------------------
# Scenario 5:
# Behavior looking_friend rất cao liên tục
# -> KHÔNG được tự tạo incident.
#
# Behavior v1 có false-positive/domain shift trên webcam thật.
# ------------------------------------------------------------

look_persist = stream(
    8,
    lambda t: {
        "t": t,
        "yolo": {
            "student": 0.85
        },
        "behavior": {
            "looking friend": (
                0.96
                if 1.0 <= t <= 6.5
                else 0.20
            ),
            "normal act": 0.03,
        },
    },
)

e = run_scenario(
    "SCENARIO 5 - LOOK PERSIST MUST NOT ALERT",
    look_persist,
)

assert len(e) == 0


# ------------------------------------------------------------
# Scenario 6:
# Extra person duy trì
# ------------------------------------------------------------

extra_person = stream(
    8,
    lambda t: {
        "t": t,
        "yolo": {
            "student": 0.85,
            "extra_person": (
                0.72
                if 2.0 <= t <= 6.5
                else 0.0
            ),
        },
        "behavior": {
            "normal act": 0.60
        },
    },
)

f = run_scenario(
    "SCENARIO 6 - EXTRA PERSON",
    extra_person,
)

assert any(
    x.event_type
    == "EXTRA_PERSON"
    for x in f
)


print()
print("=" * 65)
print("ALL TEMPORAL FUSION TESTS PASSED")
print("=" * 65)

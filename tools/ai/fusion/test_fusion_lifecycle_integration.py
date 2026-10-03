from temporal_engine import TemporalFusionEngine
from incident_lifecycle import IncidentLifecycle


def run_sequence(frames):
    engine = TemporalFusionEngine(
        window_seconds=3.0,
        cooldown_seconds=8.0,
    )

    lifecycle = IncidentLifecycle(
        release_seconds=2.0,
    )

    events = []

    for timestamp, yolo, behavior in frames:
        engine.update(
            timestamp,
            yolo,
            behavior,
        )

        active = engine.get_active_signals()

        events.extend(
            lifecycle.update(
                timestamp=timestamp,
                detected=active,
            )
        )

    return events


def count(events, action, event_type):
    return sum(
        1
        for event in events
        if event.action == action
        and event.event_type == event_type
    )


def frames_for(
    duration,
    signal_fn,
    fps=10,
):
    frames = []

    total = int(duration * fps)

    for index in range(total):
        t = index / fps

        yolo, behavior = signal_fn(t)

        frames.append(
            (
                t,
                yolo,
                behavior,
            )
        )

    return frames


print("TEST 1 - PHONE FLASH")

events = run_sequence(
    frames_for(
        6,
        lambda t: (
            {"phone": 0.90}
            if 1.0 <= t < 1.3
            else {},
            {},
        ),
    )
)

assert count(
    events,
    "START",
    "PHONE_DETECTED",
) == 0

print("PASS")


print("TEST 2 - LONG PHONE = ONE INCIDENT")

events = run_sequence(
    frames_for(
        16,
        lambda t: (
            {"phone": 0.85}
            if 1 <= t < 11
            else {},
            {},
        ),
    )
)

starts = count(
    events,
    "START",
    "PHONE_DETECTED",
)

ends = count(
    events,
    "END",
    "PHONE_DETECTED",
)

print("START =", starts)
print("END   =", ends)

assert starts == 1
assert ends == 1

print("PASS")


print("TEST 3 - PHONE REAPPEARS")

events = run_sequence(
    frames_for(
        20,
        lambda t: (
            {"phone": 0.88}
            if (
                1 <= t < 6
                or 12 <= t < 17
            )
            else {},
            {},
        ),
    )
)

starts = count(
    events,
    "START",
    "PHONE_DETECTED",
)

assert starts == 2

print("START =", starts)
print("PASS")


print("TEST 4 - LOOKING FRIEND MUST NOT ALERT")

events = run_sequence(
    frames_for(
        12,
        lambda t: (
            {},
            {
                "label": "looking friend",
                "confidence": 0.98,
            },
        ),
    )
)

assert not events

print("PASS")


print("TEST 5 - EXTRA PERSON")

events = run_sequence(
    frames_for(
        14,
        lambda t: (
            {"extra_person": 0.80}
            if 1 <= t < 9
            else {},
            {},
        ),
    )
)

starts = count(
    events,
    "START",
    "EXTRA_PERSON",
)

ends = count(
    events,
    "END",
    "EXTRA_PERSON",
)

print("START =", starts)
print("END   =", ends)

assert starts == 1
assert ends == 1

print("PASS")


print()
print(
    "ALL FUSION + LIFECYCLE "
    "INTEGRATION TESTS PASSED"
)

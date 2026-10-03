from incident_lifecycle import IncidentLifecycle


def show(events):
    for event in events:
        print(
            f"{event.timestamp:4.1f}s | "
            f"{event.action:5s} | "
            f"{event.event_type:18s} | "
            f"conf={event.confidence:.2f}"
        )


print("=" * 65)
print("TEST 1 - ONE LONG PHONE INCIDENT")
print("=" * 65)

engine = IncidentLifecycle(
    release_seconds=2.0
)

all_events = []

for i in range(100):

    t = i / 10

    detected = {}

    if 1.0 <= t <= 6.0:
        detected["PHONE_DETECTED"] = (
            0.80,
            "phone persisted",
        )

    events = engine.update(
        t,
        detected,
    )

    all_events.extend(events)
    show(events)


starts = [
    x for x in all_events
    if (
        x.action == "START"
        and x.event_type
        == "PHONE_DETECTED"
    )
]

ends = [
    x for x in all_events
    if (
        x.action == "END"
        and x.event_type
        == "PHONE_DETECTED"
    )
]

assert len(starts) == 1
assert len(ends) == 1

assert starts[0].timestamp == 1.0

assert (
    ends[0].timestamp
    >= 7.9
)


print()
print("=" * 65)
print("TEST 2 - SHORT GAP MUST STAY ACTIVE")
print("=" * 65)

engine = IncidentLifecycle(
    release_seconds=2.0
)

all_events = []

for i in range(100):

    t = i / 10

    detected = {}

    # First section
    if 1.0 <= t < 4.0:
        detected["PHONE_DETECTED"] = (
            0.75,
            "phone persisted",
        )

    # Gap only 1 second
    if 5.0 <= t <= 7.0:
        detected["PHONE_DETECTED"] = (
            0.82,
            "phone persisted",
        )

    events = engine.update(
        t,
        detected,
    )

    all_events.extend(events)
    show(events)


starts = [
    x for x in all_events
    if x.action == "START"
]

ends = [
    x for x in all_events
    if x.action == "END"
]

assert len(starts) == 1
assert len(ends) == 1


print()
print("=" * 65)
print("TEST 3 - LONG GAP CREATES NEW INCIDENT")
print("=" * 65)

engine = IncidentLifecycle(
    release_seconds=2.0
)

all_events = []

for i in range(140):

    t = i / 10

    detected = {}

    if 1.0 <= t <= 4.0:
        detected["PHONE_DETECTED"] = (
            0.75,
            "phone first appearance",
        )

    if 8.0 <= t <= 10.0:
        detected["PHONE_DETECTED"] = (
            0.88,
            "phone second appearance",
        )

    events = engine.update(
        t,
        detected,
    )

    all_events.extend(events)
    show(events)


starts = [
    x for x in all_events
    if x.action == "START"
]

ends = [
    x for x in all_events
    if x.action == "END"
]

assert len(starts) == 2
assert len(ends) == 2


print()
print("=" * 65)
print("ALL INCIDENT LIFECYCLE TESTS PASSED")
print("=" * 65)

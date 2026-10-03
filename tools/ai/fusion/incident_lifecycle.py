from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ActiveIncident:
    event_type: str
    started_at: float
    last_seen_at: float
    peak_confidence: float
    reason: str


@dataclass(frozen=True)
class LifecycleEvent:
    action: str
    event_type: str
    timestamp: float
    started_at: float
    confidence: float
    reason: str


class IncidentLifecycle:
    """
    Quản lý vòng đời incident:

        DETECTED -> START -> ACTIVE -> END

    Một tín hiệu kéo dài chỉ tạo một START.
    Incident chỉ END khi tín hiệu biến mất đủ release_seconds.
    """

    def __init__(
        self,
        release_seconds: float = 2.0,
    ):
        self.release_seconds = release_seconds

        self.active: dict[
            str,
            ActiveIncident
        ] = {}

    def update(
        self,
        timestamp: float,
        detected: dict[
            str,
            tuple[float, str]
        ],
    ) -> list[LifecycleEvent]:

        events: list[LifecycleEvent] = []

        # -----------------------------------------------------
        # START / ACTIVE
        # -----------------------------------------------------

        for event_type, (
            confidence,
            reason,
        ) in detected.items():

            current = self.active.get(
                event_type
            )

            if current is None:

                current = ActiveIncident(
                    event_type=event_type,
                    started_at=timestamp,
                    last_seen_at=timestamp,
                    peak_confidence=confidence,
                    reason=reason,
                )

                self.active[
                    event_type
                ] = current

                events.append(
                    LifecycleEvent(
                        action="START",
                        event_type=event_type,
                        timestamp=timestamp,
                        started_at=timestamp,
                        confidence=confidence,
                        reason=reason,
                    )
                )

            else:

                current.last_seen_at = timestamp

                if (
                    confidence
                    > current.peak_confidence
                ):
                    current.peak_confidence = (
                        confidence
                    )

                current.reason = reason

        # -----------------------------------------------------
        # END
        # -----------------------------------------------------

        for event_type in list(
            self.active
        ):

            if event_type in detected:
                continue

            current = self.active[
                event_type
            ]

            missing_for = (
                timestamp
                - current.last_seen_at
            )

            if (
                missing_for
                >= self.release_seconds
            ):

                events.append(
                    LifecycleEvent(
                        action="END",
                        event_type=event_type,
                        timestamp=timestamp,
                        started_at=current.started_at,
                        confidence=current.peak_confidence,
                        reason=current.reason,
                    )
                )

                del self.active[
                    event_type
                ]

        return events

    def is_active(
        self,
        event_type: str,
    ) -> bool:

        return event_type in self.active

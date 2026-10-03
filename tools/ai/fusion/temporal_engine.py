from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Deque


@dataclass(frozen=True)
class Signal:
    timestamp: float
    yolo: dict[str, float]
    behavior: dict[str, float]


@dataclass(frozen=True)
class Incident:
    event_type: str
    timestamp: float
    confidence: float
    reason: str


class TemporalFusionEngine:
    """
    ZUNY Temporal Fusion Engine v1.

    Đây là bộ phát hiện SỰ KIỆN NGHI VẤN.
    Không tự kết luận học sinh gian lận.
    """

    def __init__(
        self,
        window_seconds: float = 3.0,
        cooldown_seconds: float = 8.0,
    ):
        self.window_seconds = window_seconds
        self.cooldown_seconds = cooldown_seconds

        self.history: Deque[Signal] = deque()

        self.last_incident = defaultdict(
            lambda: -10_000.0
        )

    def _cleanup(self, now: float) -> None:
        cutoff = now - self.window_seconds

        while (
            self.history
            and self.history[0].timestamp < cutoff
        ):
            self.history.popleft()

    def _ratio(
        self,
        predicate,
    ) -> float:
        if not self.history:
            return 0.0

        hits = sum(
            1
            for signal in self.history
            if predicate(signal)
        )

        return hits / len(self.history)

    def _avg(
        self,
        getter,
    ) -> float:
        values = [
            getter(signal)
            for signal in self.history
        ]

        if not values:
            return 0.0

        return sum(values) / len(values)

    def _can_emit(
        self,
        event_type: str,
        now: float,
    ) -> bool:
        return (
            now
            - self.last_incident[event_type]
            >= self.cooldown_seconds
        )

    def _emit(
        self,
        event_type: str,
        now: float,
        confidence: float,
        reason: str,
    ) -> Incident | None:

        if not self._can_emit(
            event_type,
            now,
        ):
            return None

        self.last_incident[event_type] = now

        return Incident(
            event_type=event_type,
            timestamp=now,
            confidence=max(
                0.0,
                min(1.0, confidence),
            ),
            reason=reason,
        )

    def get_active_signals(
        self,
    ) -> dict[str, tuple[float, str]]:
        """
        Trả về các tín hiệu temporal đang ACTIVE.

        Khác với _emit(), hàm này KHÔNG có cooldown.
        Nó được dùng bởi IncidentLifecycle để duy trì
        START -> ACTIVE -> END chính xác qua từng frame.
        """

        active: dict[
            str,
            tuple[float, str]
        ] = {}

        if len(self.history) < 5:
            return active

        # PHONE
        phone_ratio = self._ratio(
            lambda s:
            s.yolo.get("phone", 0.0) >= 0.50
        )

        if phone_ratio >= 0.60:
            phone_avg = self._avg(
                lambda s:
                s.yolo.get("phone", 0.0)
            )

            active["PHONE_DETECTED"] = (
                phone_avg,
                (
                    f"phone persisted in "
                    f"{phone_ratio:.0%} of recent frames"
                ),
            )

        # EXTRA PERSON
        extra_ratio = self._ratio(
            lambda s:
            s.yolo.get(
                "extra_person",
                0.0,
            ) >= 0.40
        )

        if extra_ratio >= 0.60:
            extra_avg = self._avg(
                lambda s:
                s.yolo.get(
                    "extra_person",
                    0.0,
                )
            )

            active["EXTRA_PERSON"] = (
                extra_avg,
                (
                    f"extra_person persisted in "
                    f"{extra_ratio:.0%} of recent frames"
                ),
            )

        # BOOK
        book_ratio = self._ratio(
            lambda s:
            s.yolo.get("book", 0.0) >= 0.50
        )

        if book_ratio >= 0.70:
            book_avg = self._avg(
                lambda s:
                s.yolo.get("book", 0.0)
            )

            active["BOOK_DETECTED"] = (
                book_avg,
                (
                    f"book persisted in "
                    f"{book_ratio:.0%} of recent frames"
                ),
            )

        # MULTI SIGNAL
        if len(self.history) >= 8:

            behavior_ratio = self._ratio(
                lambda s:
                max(
                    s.behavior.get(
                        "cheating",
                        0.0,
                    ),
                    s.behavior.get(
                        "giving code",
                        0.0,
                    ),
                    s.behavior.get(
                        "giving object",
                        0.0,
                    ),
                ) >= 0.70
            )

            object_ratio = self._ratio(
                lambda s:
                max(
                    s.yolo.get(
                        "phone",
                        0.0,
                    ),
                    s.yolo.get(
                        "extra_person",
                        0.0,
                    ),
                    s.yolo.get(
                        "book",
                        0.0,
                    ),
                ) >= 0.45
            )

            if (
                behavior_ratio >= 0.50
                and object_ratio >= 0.40
            ):
                confidence = min(
                    1.0,
                    (
                        behavior_ratio
                        + object_ratio
                    ) / 2,
                )

                active[
                    "MULTI_SIGNAL_SUSPICION"
                ] = (
                    confidence,
                    (
                        "behavior and object signals "
                        "persisted simultaneously"
                    ),
                )

        return active

    def update(
        self,
        timestamp: float,
        yolo: dict[str, float],
        behavior: dict[str, float],
    ) -> list[Incident]:

        self.history.append(
            Signal(
                timestamp=timestamp,
                yolo=yolo,
                behavior=behavior,
            )
        )

        self._cleanup(timestamp)

        incidents: list[Incident] = []

        # ----------------------------------------------------
        # 1. PHONE
        #
        # YOLO là tín hiệu chính.
        # Phải xuất hiện ở >= 60% frame trong cửa sổ.
        # ----------------------------------------------------

        phone_ratio = self._ratio(
            lambda s:
            s.yolo.get("phone", 0.0) >= 0.50
        )

        phone_avg = self._avg(
            lambda s:
            s.yolo.get("phone", 0.0)
        )

        if (
            len(self.history) >= 5
            and phone_ratio >= 0.60
        ):
            incident = self._emit(
                "PHONE_DETECTED",
                timestamp,
                phone_avg,
                (
                    f"phone persisted in "
                    f"{phone_ratio:.0%} of recent frames"
                ),
            )

            if incident:
                incidents.append(incident)

        # ----------------------------------------------------
        # 2. EXTRA PERSON
        #
        # YOLO là tín hiệu chính.
        # ----------------------------------------------------

        extra_ratio = self._ratio(
            lambda s:
            s.yolo.get(
                "extra_person",
                0.0
            ) >= 0.40
        )

        extra_avg = self._avg(
            lambda s:
            s.yolo.get(
                "extra_person",
                0.0
            )
        )

        if (
            len(self.history) >= 5
            and extra_ratio >= 0.60
        ):
            incident = self._emit(
                "EXTRA_PERSON",
                timestamp,
                extra_avg,
                (
                    f"extra_person persisted in "
                    f"{extra_ratio:.0%} of recent frames"
                ),
            )

            if incident:
                incidents.append(incident)

        # ----------------------------------------------------
        # 3. BOOK
        #
        # Chỉ là sự kiện nghi vấn.
        # ----------------------------------------------------

        book_ratio = self._ratio(
            lambda s:
            s.yolo.get("book", 0.0) >= 0.50
        )

        book_avg = self._avg(
            lambda s:
            s.yolo.get("book", 0.0)
        )

        if (
            len(self.history) >= 5
            and book_ratio >= 0.70
        ):
            incident = self._emit(
                "BOOK_DETECTED",
                timestamp,
                book_avg,
                (
                    f"book persisted in "
                    f"{book_ratio:.0%} of recent frames"
                ),
            )

            if incident:
                incidents.append(incident)

        # ----------------------------------------------------
        # 4. BEHAVIOR SUPPORT SIGNAL
        #
        # Behavior v1 có domain shift trên webcam thật.
        # Đặc biệt "looking friend" có false-positive cao
        # khi học sinh chỉ nhìn vào các vùng khác nhau
        # trên màn hình.
        #
        # Vì vậy Behavior KHÔNG được tự tạo incident.
        # Nó chỉ được dùng làm tín hiệu hỗ trợ cho
        # multi-signal fusion bên dưới.
        # ----------------------------------------------------

        # ----------------------------------------------------
        # 5. MULTI-SIGNAL
        #
        # Behavior chỉ tăng mức chú ý khi đồng thời có
        # tín hiệu YOLO.
        # ----------------------------------------------------

        suspicious_behavior_ratio = self._ratio(
            lambda s:
            max(
                s.behavior.get(
                    "cheating",
                    0.0
                ),
                s.behavior.get(
                    "giving code",
                    0.0
                ),
                s.behavior.get(
                    "giving object",
                    0.0
                ),
            ) >= 0.70
        )

        object_ratio = self._ratio(
            lambda s:
            max(
                s.yolo.get(
                    "phone",
                    0.0
                ),
                s.yolo.get(
                    "extra_person",
                    0.0
                ),
                s.yolo.get(
                    "book",
                    0.0
                ),
            ) >= 0.45
        )

        if (
            len(self.history) >= 8
            and suspicious_behavior_ratio >= 0.50
            and object_ratio >= 0.40
        ):
            confidence = min(
                1.0,
                (
                    suspicious_behavior_ratio
                    + object_ratio
                ) / 2,
            )

            incident = self._emit(
                "MULTI_SIGNAL_SUSPICION",
                timestamp,
                confidence,
                (
                    "behavior and object signals "
                    "persisted simultaneously"
                ),
            )

            if incident:
                incidents.append(incident)

        return incidents

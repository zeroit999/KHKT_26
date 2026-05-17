import time
from functools import wraps
from flask import request, jsonify
from collections import defaultdict

try:
    from config.config import Config
except ImportError:
    import os
    import sys

    sys.path.insert(
        0,
        os.path.dirname(
            os.path.dirname(
                os.path.abspath(__file__)
            )
        )
    )

    from config.config import Config


class InMemoryRateLimiter:
    def __init__(self):
        self.requests = defaultdict(list)

    def is_allowed(self, key, limit, window):
        now = time.time()

        self.requests[key] = [
            req_time
            for req_time in self.requests[key]
            if now - req_time < window
        ]

        if len(self.requests[key]) >= limit:
            return False, len(self.requests[key])

        self.requests[key].append(now)

        return True, len(self.requests[key])


rate_limiter = InMemoryRateLimiter()


def rate_limit(limit=60, window=3600, per_user=True):
    """
    Rate limiting decorator.

    Không còn phân biệt:
    - pro
    - premium
    - enterprise
    - subscription

    Tất cả user dùng cùng giới hạn.
    """

    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if per_user and hasattr(request, "current_user"):
                user_id = (
                    request.current_user.get("user_id")
                    or request.current_user.get("uid")
                    or "unknown"
                )

                key = f"user:{user_id}:{f.__name__}"
            else:
                key = f"ip:{request.remote_addr}:{f.__name__}"

            allowed, current_count = rate_limiter.is_allowed(
                key,
                limit,
                window,
            )

            if not allowed:
                return jsonify({
                    "error": "Rate limit exceeded",
                    "limit": limit,
                    "window": window,
                    "current_count": current_count,
                }), 429

            return f(*args, **kwargs)

        return decorated

    return decorator
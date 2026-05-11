import time
from functools import wraps
from flask import request, jsonify
from collections import defaultdict

# Import config with fallback
try:
    from config.config import Config
except ImportError:
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from config.config import Config

class InMemoryRateLimiter:
    def __init__(self):
        self.requests = defaultdict(list)

    def is_allowed(self, key, limit, window):
        now = time.time()
        # Remove old requests outside window
        self.requests[key] = [req_time for req_time in self.requests[key] if now - req_time < window]

        if len(self.requests[key]) >= limit:
            return False, len(self.requests[key])

        self.requests[key].append(now)
        return True, len(self.requests[key])

# Global rate limiter instance
rate_limiter = InMemoryRateLimiter()

def rate_limit(limit=60, window=3600, per_user=True):
    """
    Rate limiting decorator
    limit: số requests allowed
    window: time window in seconds
    per_user: True = per user, False = per IP
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if per_user and hasattr(request, 'current_user'):
                key = f"user:{request.current_user['user_id']}:{f.__name__}"
                # Adjust limits based on subscription
                user_subscription = request.current_user.get('subscription', 'free')
                if user_subscription == 'premium':
                    limit_adjusted = limit * 10  # Premium gets 10x more
                elif user_subscription == 'enterprise':
                    limit_adjusted = limit * 50  # Enterprise gets 50x more
                else:
                    limit_adjusted = limit
            else:
                key = f"ip:{request.remote_addr}:{f.__name__}"
                limit_adjusted = limit

            allowed, current_count = rate_limiter.is_allowed(key, limit_adjusted, window)

            if not allowed:
                return jsonify({
                    'error': 'Rate limit exceeded',
                    'limit': limit_adjusted,
                    'window': window,
                    'current_count': current_count
                }), 429

            return f(*args, **kwargs)
        return decorated
    return decorator
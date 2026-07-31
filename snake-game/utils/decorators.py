"""Reusable Flask decorators."""
from functools import wraps

from flask import jsonify, session


def login_required(f):
    """Reject the request with 401 unless a user is logged in (session-based)."""

    @wraps(f)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"success": False, "error": "Authentication required."}), 401
        return f(*args, **kwargs)

    return wrapper

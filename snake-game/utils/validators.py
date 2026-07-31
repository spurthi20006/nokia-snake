"""Simple input validation helpers used across routes."""
import re

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,20}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validate_username(username: str):
    if not username or not USERNAME_RE.match(username):
        return "Username must be 3-20 characters (letters, numbers, underscore only)."
    return None


def validate_email(email: str):
    if not email or not EMAIL_RE.match(email):
        return "Please provide a valid email address."
    return None


def validate_password(password: str):
    if not password or len(password) < 6:
        return "Password must be at least 6 characters long."
    return None

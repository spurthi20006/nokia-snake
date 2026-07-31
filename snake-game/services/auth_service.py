"""Business logic for registration and login."""
from models.user import User
from utils.validators import validate_email, validate_password, validate_username


class AuthService:
    def __init__(self, db):
        self.user_model = User(db)

    def register(self, username, email, password):
        error = (
            validate_username(username)
            or validate_email(email)
            or validate_password(password)
        )
        if error:
            return None, error

        if self.user_model.find_by_username(username):
            return None, "That username is already taken."
        if self.user_model.find_by_email(email):
            return None, "That email is already registered."

        try:
            user_doc = self.user_model.create(username, email, password)
        except Exception:  # noqa: BLE001 - e.g. race condition on unique index
            return None, "Could not create account. Try a different username/email."

        return user_doc, None

    def login(self, username_or_email, password):
        user_doc = self.user_model.find_by_username(
            username_or_email
        ) or self.user_model.find_by_email(username_or_email)

        if not user_doc or not User.verify_password(user_doc, password):
            return None, "Invalid username/email or password."

        return user_doc, None

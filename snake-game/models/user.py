"""User model - thin wrapper around the `users` collection."""
from datetime import datetime, timezone

import bcrypt
from bson import ObjectId


class User:
    collection_name = "users"

    def __init__(self, db):
        self.collection = db[self.collection_name]

    def create(self, username: str, email: str, password: str):
        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
        doc = {
            "username": username,
            "email": email.lower(),
            "password_hash": hashed,
            "created_at": datetime.now(timezone.utc),
        }
        result = self.collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    def find_by_username(self, username: str):
        return self.collection.find_one({"username": username})

    def find_by_email(self, email: str):
        return self.collection.find_one({"email": email.lower()})

    def find_by_id(self, user_id):
        try:
            oid = ObjectId(user_id) if not isinstance(user_id, ObjectId) else user_id
        except Exception:  # noqa: BLE001
            return None
        return self.collection.find_one({"_id": oid})

    @staticmethod
    def verify_password(user_doc, password: str) -> bool:
        return bcrypt.checkpw(password.encode("utf-8"), user_doc["password_hash"])

    @staticmethod
    def to_public_dict(user_doc):
        if not user_doc:
            return None
        return {
            "id": str(user_doc["_id"]),
            "username": user_doc["username"],
            "email": user_doc["email"],
            "created_at": user_doc.get("created_at").isoformat()
            if user_doc.get("created_at")
            else None,
        }

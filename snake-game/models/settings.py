"""Settings model - thin wrapper around the `settings` collection."""
from bson import ObjectId

DEFAULT_SETTINGS = {
    "theme": "classic",  # classic | dark | neon | blue
    "difficulty": "medium",
    "sound_enabled": True,
    "music_enabled": True,
    "volume": 0.7,
    "controls": "arrows",  # arrows | wasd
}


class Settings:
    collection_name = "settings"

    def __init__(self, db):
        self.collection = db[self.collection_name]

    def get_for_user(self, user_id):
        doc = self.collection.find_one({"user_id": ObjectId(user_id)})
        if not doc:
            return dict(DEFAULT_SETTINGS)
        merged = dict(DEFAULT_SETTINGS)
        merged.update({k: v for k, v in doc.items() if k not in ("_id", "user_id")})
        return merged

    def update_for_user(self, user_id, updates: dict):
        allowed = {k: v for k, v in updates.items() if k in DEFAULT_SETTINGS}
        self.collection.update_one(
            {"user_id": ObjectId(user_id)}, {"$set": allowed}, upsert=True
        )
        return self.get_for_user(user_id)

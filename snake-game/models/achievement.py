"""Achievement model - thin wrapper around the `achievements` collection."""
from datetime import datetime, timezone

from bson import ObjectId

# Master list of achievements available in the game.
ACHIEVEMENT_CATALOG = {
    "first_bite": {"name": "First Bite", "description": "Eat your first food item.", "icon": "🍎"},
    "century": {"name": "Century", "description": "Score 100 points in a single game.", "icon": "💯"},
    "half_k": {"name": "High Roller", "description": "Score 500 points in a single game.", "icon": "🔥"},
    "long_boi": {"name": "Long Boi", "description": "Reach a snake length of 20.", "icon": "🐍"},
    "golden_gourmet": {"name": "Golden Gourmet", "description": "Eat 10 golden apples.", "icon": "⭐"},
    "survivor": {"name": "Survivor", "description": "Survive with obstacles on screen.", "icon": "🧱"},
    "combo_master": {"name": "Combo Master", "description": "Reach a 5x combo multiplier.", "icon": "⚡"},
    "explorer": {"name": "Explorer", "description": "Win a game in every mode.", "icon": "🗺"},
}


class Achievement:
    collection_name = "achievements"

    def __init__(self, db):
        self.collection = db[self.collection_name]

    def unlock(self, user_id, key):
        if key not in ACHIEVEMENT_CATALOG:
            return None, "Unknown achievement key."

        existing = self.collection.find_one({"user_id": ObjectId(user_id), "key": key})
        if existing:
            return existing, None

        doc = {
            "user_id": ObjectId(user_id),
            "key": key,
            **ACHIEVEMENT_CATALOG[key],
            "unlocked_at": datetime.now(timezone.utc),
        }
        result = self.collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc, None

    def list_for_user(self, user_id):
        unlocked = list(self.collection.find({"user_id": ObjectId(user_id)}))
        unlocked_keys = {d["key"] for d in unlocked}
        result = []
        for key, meta in ACHIEVEMENT_CATALOG.items():
            unlocked_doc = next((d for d in unlocked if d["key"] == key), None)
            result.append(
                {
                    "key": key,
                    **meta,
                    "unlocked": key in unlocked_keys,
                    "unlocked_at": unlocked_doc["unlocked_at"].isoformat()
                    if unlocked_doc
                    else None,
                }
            )
        return result

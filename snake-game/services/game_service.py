"""Business logic for saving scores and computing statistics."""
from models.achievement import Achievement
from models.score import Score


class GameService:
    def __init__(self, db):
        self.score_model = Score(db)
        self.achievement_model = Achievement(db)

    def save_score(self, user_id, payload):
        required = ["score", "length", "mode", "difficulty", "food_eaten", "play_time"]
        missing = [f for f in required if f not in payload]
        if missing:
            return None, f"Missing fields: {', '.join(missing)}"

        doc = self.score_model.save(
            user_id=user_id,
            score=payload["score"],
            length=payload["length"],
            mode=payload["mode"],
            difficulty=payload["difficulty"],
            food_eaten=payload["food_eaten"],
            play_time=payload["play_time"],
        )

        unlocked = self._check_achievements(user_id, payload)
        is_high_score = payload["score"] >= self.score_model.high_score_for_user(user_id)

        return {
            "score_id": str(doc["_id"]),
            "is_high_score": is_high_score,
            "unlocked_achievements": unlocked,
        }, None

    def _check_achievements(self, user_id, payload):
        unlocked = []
        candidates = []
        if payload.get("food_eaten", 0) >= 1:
            candidates.append("first_bite")
        if payload.get("score", 0) >= 100:
            candidates.append("century")
        if payload.get("score", 0) >= 500:
            candidates.append("half_k")
        if payload.get("length", 0) >= 20:
            candidates.append("long_boi")
        if payload.get("score", 0) >= 100:
            candidates.append("survivor")
        if payload.get("max_combo", 0) >= 5:
            candidates.append("combo_master")
        if payload.get("golden_eaten_total", 0) >= 10:
            candidates.append("golden_gourmet")

        for key in candidates:
            doc, err = self.achievement_model.unlock(user_id, key)
            if not err and doc:
                unlocked.append(key)
        return unlocked

    def high_score(self, user_id):
        return self.score_model.high_score_for_user(user_id)

    def statistics(self, user_id):
        return self.score_model.stats_for_user(user_id)

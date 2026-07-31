"""Business logic for leaderboards."""
from models.score import Score
from models.user import User


class LeaderboardService:
    def __init__(self, db):
        self.score_model = Score(db)
        self.user_model = User(db)

    def get_leaderboard(self, period="global", limit=20, user_id=None):
        if period == "personal":
            if not user_id:
                return []
            docs = self.score_model.collection.find(
                {"user_id": self._as_oid(user_id)}
            ).sort("score", -1).limit(limit)
        else:
            docs = self.score_model.leaderboard(period=period, limit=limit)

        results = []
        for rank, doc in enumerate(docs, start=1):
            user_doc = self.user_model.find_by_id(doc["user_id"])
            results.append(
                {
                    "rank": rank,
                    "username": user_doc["username"] if user_doc else "Unknown",
                    "score": doc["score"],
                    "mode": doc.get("mode"),
                    "difficulty": doc.get("difficulty"),
                    "created_at": doc["created_at"].isoformat(),
                }
            )
        return results

    @staticmethod
    def _as_oid(user_id):
        from bson import ObjectId

        return ObjectId(user_id)

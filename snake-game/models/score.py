"""Score model - thin wrapper around the `scores` collection."""
from datetime import datetime, timezone

from bson import ObjectId


class Score:
    collection_name = "scores"

    def __init__(self, db):
        self.collection = db[self.collection_name]

    def save(self, user_id, score, length, mode, difficulty, food_eaten, play_time):
        doc = {
            "user_id": ObjectId(user_id),
            "score": int(score),
            "length": int(length),
            "mode": mode,
            "difficulty": difficulty,
            "food_eaten": int(food_eaten),
            "play_time": float(play_time),
            "created_at": datetime.now(timezone.utc),
        }
        result = self.collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    def high_score_for_user(self, user_id):
        doc = self.collection.find_one(
            {"user_id": ObjectId(user_id)}, sort=[("score", -1)]
        )
        return doc["score"] if doc else 0

    def stats_for_user(self, user_id):
        cursor = self.collection.find({"user_id": ObjectId(user_id)})
        docs = list(cursor)
        if not docs:
            return {
                "highest_score": 0,
                "average_score": 0,
                "longest_snake": 3,
                "games_played": 0,
                "total_food_eaten": 0,
                "total_play_time": 0,
                "favorite_mode": None,
                "win_percentage": 0,
            }

        games_played = len(docs)
        highest_score = max(d["score"] for d in docs)
        average_score = round(sum(d["score"] for d in docs) / games_played, 2)
        longest_snake = max(d["length"] for d in docs)
        total_food_eaten = sum(d["food_eaten"] for d in docs)
        total_play_time = round(sum(d["play_time"] for d in docs), 2)

        mode_counts = {}
        for d in docs:
            mode_counts[d["mode"]] = mode_counts.get(d["mode"], 0) + 1
        favorite_mode = max(mode_counts, key=mode_counts.get)

        # "Win" heuristic: a game where the player survived long enough to
        # reach the obstacle threshold (score >= 100).
        wins = sum(1 for d in docs if d["score"] >= 100)
        win_percentage = round((wins / games_played) * 100, 2)

        return {
            "highest_score": highest_score,
            "average_score": average_score,
            "longest_snake": longest_snake,
            "games_played": games_played,
            "total_food_eaten": total_food_eaten,
            "total_play_time": total_play_time,
            "favorite_mode": favorite_mode,
            "win_percentage": win_percentage,
        }

    def leaderboard(self, period="global", limit=20):
        query = {}
        if period in ("weekly", "monthly"):
            days = 7 if period == "weekly" else 30
            since = datetime.now(timezone.utc).timestamp() - days * 86400
            query["created_at"] = {"$gte": datetime.fromtimestamp(since, tz=timezone.utc)}

        cursor = self.collection.find(query).sort("score", -1).limit(limit)
        return list(cursor)

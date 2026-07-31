"""Daily challenge endpoints (bonus feature)."""
import random
from datetime import date

from flask import Blueprint, current_app, jsonify, session
from bson import ObjectId

from utils.decorators import login_required

daily_bp = Blueprint("daily", __name__, url_prefix="/api")

CHALLENGE_POOL = [
    {"key": "eat_20_food", "description": "Eat 20 food items in one session.", "target": 20},
    {"key": "score_150", "description": "Score at least 150 points in a single game.", "target": 150},
    {"key": "eat_3_golden", "description": "Eat 3 golden apples in one game.", "target": 3},
    {"key": "survive_120s", "description": "Survive for 120 seconds in one game.", "target": 120},
    {"key": "combo_4x", "description": "Reach a 4x combo multiplier.", "target": 4},
]


def _todays_challenge():
    today = date.today()
    # Deterministic "random" pick per day so everyone gets the same challenge.
    index = today.toordinal() % len(CHALLENGE_POOL)
    return {"date": today.isoformat(), **CHALLENGE_POOL[index]}


@daily_bp.get("/daily-challenge")
@login_required
def get_daily_challenge():
    db = current_app.db
    challenge = _todays_challenge()
    doc = db.daily_challenges.find_one(
        {"user_id": ObjectId(session["user_id"]), "date": challenge["date"]}
    )
    completed = bool(doc and doc.get("completed"))
    return jsonify({"success": True, "challenge": challenge, "completed": completed}), 200


@daily_bp.post("/daily-challenge/complete")
@login_required
def complete_daily_challenge():
    db = current_app.db
    challenge = _todays_challenge()
    db.daily_challenges.update_one(
        {"user_id": ObjectId(session["user_id"]), "date": challenge["date"]},
        {"$set": {"completed": True, "key": challenge["key"]}},
        upsert=True,
    )
    return jsonify({"success": True}), 200

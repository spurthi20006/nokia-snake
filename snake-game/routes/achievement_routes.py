"""Achievement endpoints."""
from flask import Blueprint, current_app, jsonify, request, session

from models.achievement import Achievement
from utils.decorators import login_required

achievement_bp = Blueprint("achievement", __name__, url_prefix="/api")


@achievement_bp.post("/unlock-achievement")
@login_required
def unlock_achievement():
    data = request.get_json(silent=True) or {}
    key = data.get("key")
    if not key:
        return jsonify({"success": False, "error": "Missing achievement key."}), 400

    model = Achievement(current_app.db)
    doc, error = model.unlock(session["user_id"], key)
    if error:
        return jsonify({"success": False, "error": error}), 400

    return jsonify(
        {
            "success": True,
            "achievement": {
                "key": doc["key"],
                "name": doc["name"],
                "description": doc["description"],
                "icon": doc["icon"],
            },
        }
    ), 200


@achievement_bp.get("/achievements")
@login_required
def list_achievements():
    model = Achievement(current_app.db)
    return jsonify(
        {"success": True, "achievements": model.list_for_user(session["user_id"])}
    ), 200

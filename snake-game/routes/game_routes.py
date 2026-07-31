"""Game endpoints: save score, high score, statistics."""
from flask import Blueprint, current_app, jsonify, request, session

from services.game_service import GameService
from utils.decorators import login_required

game_bp = Blueprint("game", __name__, url_prefix="/api")


@game_bp.post("/save-score")
@login_required
def save_score():
    payload = request.get_json(silent=True) or {}
    service = GameService(current_app.db)
    result, error = service.save_score(session["user_id"], payload)
    if error:
        return jsonify({"success": False, "error": error}), 400
    return jsonify({"success": True, **result}), 201


@game_bp.get("/high-score")
@login_required
def high_score():
    service = GameService(current_app.db)
    return jsonify(
        {"success": True, "high_score": service.high_score(session["user_id"])}
    ), 200


@game_bp.get("/statistics")
@login_required
def statistics():
    service = GameService(current_app.db)
    return jsonify(
        {"success": True, "statistics": service.statistics(session["user_id"])}
    ), 200

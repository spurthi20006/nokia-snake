"""Leaderboard endpoint."""
from flask import Blueprint, current_app, jsonify, request, session

from services.leaderboard_service import LeaderboardService

leaderboard_bp = Blueprint("leaderboard", __name__, url_prefix="/api")


@leaderboard_bp.get("/leaderboard")
def leaderboard():
    period = request.args.get("period", "global")
    limit = min(int(request.args.get("limit", 20)), 100)

    if period not in ("global", "weekly", "monthly", "personal"):
        return jsonify({"success": False, "error": "Invalid period."}), 400

    if period == "personal" and "user_id" not in session:
        return jsonify({"success": False, "error": "Login required for personal best."}), 401

    service = LeaderboardService(current_app.db)
    entries = service.get_leaderboard(
        period=period, limit=limit, user_id=session.get("user_id")
    )
    return jsonify({"success": True, "period": period, "entries": entries}), 200

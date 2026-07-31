"""Settings endpoints."""
from flask import Blueprint, current_app, jsonify, request, session

from models.settings import Settings
from utils.decorators import login_required

settings_bp = Blueprint("settings", __name__, url_prefix="/api")


@settings_bp.get("/settings")
@login_required
def get_settings():
    model = Settings(current_app.db)
    return jsonify({"success": True, "settings": model.get_for_user(session["user_id"])}), 200


@settings_bp.put("/settings")
@login_required
def update_settings():
    data = request.get_json(silent=True) or {}
    model = Settings(current_app.db)
    updated = model.update_for_user(session["user_id"], data)
    return jsonify({"success": True, "settings": updated}), 200

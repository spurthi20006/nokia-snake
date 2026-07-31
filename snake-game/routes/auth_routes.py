"""Authentication endpoints: register, login, logout."""
from flask import Blueprint, current_app, jsonify, request, session

from models.user import User
from services.auth_service import AuthService

auth_bp = Blueprint("auth", __name__, url_prefix="/api")


@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    service = AuthService(current_app.db)
    user_doc, error = service.register(username, email, password)
    if error:
        return jsonify({"success": False, "error": error}), 400

    session.clear()
    session["user_id"] = str(user_doc["_id"])
    session["username"] = user_doc["username"]
    session.permanent = True

    return jsonify({"success": True, "user": User.to_public_dict(user_doc)}), 201


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    identifier = (data.get("username") or data.get("email") or "").strip()
    password = data.get("password") or ""

    service = AuthService(current_app.db)
    user_doc, error = service.login(identifier, password)
    if error:
        return jsonify({"success": False, "error": error}), 401

    session.clear()
    session["user_id"] = str(user_doc["_id"])
    session["username"] = user_doc["username"]
    session.permanent = True

    return jsonify({"success": True, "user": User.to_public_dict(user_doc)}), 200


@auth_bp.post("/logout")
def logout():
    session.clear()
    return jsonify({"success": True, "message": "Logged out."}), 200


@auth_bp.get("/me")
def me():
    if "user_id" not in session:
        return jsonify({"success": True, "user": None}), 200
    user_model = User(current_app.db)
    user_doc = user_model.find_by_id(session["user_id"])
    return jsonify({"success": True, "user": User.to_public_dict(user_doc)}), 200

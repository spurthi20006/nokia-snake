"""
Snake Game - Flask application factory / entrypoint.

Run locally with:
    python app.py

Or with gunicorn in production:
    gunicorn -w 4 -b 0.0.0.0:5000 app:app
"""
import logging

from flask import Flask, render_template
from flask_cors import CORS

from config import Config
from database.db import init_db

from routes.auth_routes import auth_bp
from routes.game_routes import game_bp
from routes.leaderboard_routes import leaderboard_bp
from routes.achievement_routes import achievement_bp
from routes.settings_routes import settings_bp
from routes.daily_routes import daily_bp

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, supports_credentials=True)

    init_db(app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(game_bp)
    app.register_blueprint(leaderboard_bp)
    app.register_blueprint(achievement_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(daily_bp)

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.get("/health")
    def health():
        return {
            "status": "ok",
            "database": "mongomock (in-memory)" if app.using_mock_db else "MongoDB Atlas",
        }

    @app.errorhandler(404)
    def not_found(_e):
        return {"success": False, "error": "Not found."}, 404

    @app.errorhandler(500)
    def server_error(_e):
        return {"success": False, "error": "Internal server error."}, 500

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=app.config["PORT"], debug=app.config["DEBUG"])

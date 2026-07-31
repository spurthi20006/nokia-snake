"""
Central MongoDB connection point.

Tries to connect to the real MongoDB Atlas cluster given by MONGO_URI.
If that fails (no URI configured, placeholder URI, no network access, bad
credentials, etc.) it transparently falls back to `mongomock`, an in-memory
MongoDB-compatible database. This means the project runs and can be
demoed immediately without requiring an Atlas account, while still using
the exact same PyMongo-style API in every model/service.
"""
import logging

logger = logging.getLogger(__name__)

_db = None
_using_mock = False


def _looks_like_placeholder(uri: str) -> bool:
    if not uri:
        return True
    placeholder_markers = ["<username>", "<password>", "<cluster-url>"]
    return any(marker in uri for marker in placeholder_markers)


def init_db(app):
    """Initialize the database connection and attach it to the app."""
    global _db, _using_mock

    mongo_uri = app.config.get("MONGO_URI", "")
    db_name = app.config.get("MONGO_DB_NAME", "snake_game")

    if not _looks_like_placeholder(mongo_uri):
        try:
            from pymongo import MongoClient

            client = MongoClient(mongo_uri, serverSelectionTimeoutMS=4000)
            client.admin.command("ping")
            _db = client[db_name]
            _using_mock = False
            logger.info("Connected to MongoDB Atlas database '%s'.", db_name)
        except Exception as exc:  # noqa: BLE001 - want a broad fallback
            logger.warning(
                "Could not connect to MongoDB Atlas (%s). Falling back to "
                "in-memory mongomock database.",
                exc,
            )
            _db = None

    if _db is None:
        import mongomock

        client = mongomock.MongoClient()
        _db = client[db_name]
        _using_mock = True
        logger.info("Using in-memory mongomock database '%s'.", db_name)

    _ensure_indexes(_db)
    app.db = _db
    app.using_mock_db = _using_mock
    return _db


def _ensure_indexes(db):
    """Create indexes used across the app. Safe to call every startup."""
    try:
        db.users.create_index("username", unique=True)
        db.users.create_index("email", unique=True)
        db.scores.create_index([("user_id", 1), ("score", -1)])
        db.scores.create_index("created_at")
        db.achievements.create_index([("user_id", 1), ("key", 1)], unique=True)
        db.settings.create_index("user_id", unique=True)
        db.daily_challenges.create_index([("user_id", 1), ("date", 1)], unique=True)
    except Exception:  # noqa: BLE001
        # Index creation is best-effort; never block app startup on it.
        pass


def get_db():
    """Return the active database instance."""
    global _db
    if _db is None:
        raise RuntimeError("Database has not been initialized. Call init_db(app) first.")
    return _db

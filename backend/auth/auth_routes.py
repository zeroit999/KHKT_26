from flask import Blueprint, request, jsonify
from auth import JWTManager
import sqlite3


auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


# =========================
# SQLITE HELPERS
# =========================

def get_db_connection():
    conn = sqlite3.connect("users.db")
    conn.row_factory = sqlite3.Row

    return conn


def init_db():
    conn = get_db_connection()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            firebase_uid TEXT UNIQUE NOT NULL,
            email TEXT NOT NULL,
            role TEXT DEFAULT 'STUDENT',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS usage_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            feature TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            quota_consumed INTEGER DEFAULT 1
        )
    """)

    conn.commit()
    conn.close()


def get_or_create_user(firebase_user):
    conn = get_db_connection()

    user = conn.execute(
        """
        SELECT *
        FROM users
        WHERE firebase_uid = ?
        """,
        (firebase_user["uid"],),
    ).fetchone()

    if not user:
        conn.execute(
            """
            INSERT INTO users (firebase_uid, email, role)
            VALUES (?, ?, ?)
            """,
            (
                firebase_user["uid"],
                firebase_user.get("email", ""),
                "STUDENT",
            ),
        )

        conn.commit()

        user = conn.execute(
            """
            SELECT *
            FROM users
            WHERE firebase_uid = ?
            """,
            (firebase_user["uid"],),
        ).fetchone()

    conn.close()

    return user


def build_auth_response(user):
    user_data = {
        "uid": user["firebase_uid"],
        "email": user["email"],
        "role": user["role"],
    }

    access_token = JWTManager.create_access_token(user_data)
    refresh_token = JWTManager.create_refresh_token(
        user["firebase_uid"]
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": user["firebase_uid"],
            "uid": user["firebase_uid"],
            "email": user["email"],
            "role": user["role"],
        },
    }


# =========================
# ROUTES
# =========================

@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Register bằng Firebase token.
    Mặc định role là STUDENT.
    """

    try:
        data = request.json or {}
        firebase_token = data.get("firebase_token")

        if not firebase_token:
            return jsonify({
                "error": "Firebase token required",
            }), 400

        firebase_user = JWTManager.verify_firebase_token(
            firebase_token
        )

        if not firebase_user:
            return jsonify({
                "error": "Invalid Firebase token",
            }), 401

        conn = get_db_connection()

        existing_user = conn.execute(
            """
            SELECT *
            FROM users
            WHERE firebase_uid = ?
            """,
            (firebase_user["uid"],),
        ).fetchone()

        if existing_user:
            conn.close()

            return jsonify({
                "error": "User already exists",
            }), 400

        conn.execute(
            """
            INSERT INTO users (firebase_uid, email, role)
            VALUES (?, ?, ?)
            """,
            (
                firebase_user["uid"],
                firebase_user.get("email", ""),
                "STUDENT",
            ),
        )

        conn.commit()

        user = conn.execute(
            """
            SELECT *
            FROM users
            WHERE firebase_uid = ?
            """,
            (firebase_user["uid"],),
        ).fetchone()

        conn.close()

        return jsonify(build_auth_response(user)), 200

    except Exception as error:
        return jsonify({
            "error": str(error),
        }), 500


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Login bằng Firebase token.
    Nếu user chưa có trong SQLite thì tự tạo với role STUDENT.
    """

    try:
        data = request.json or {}
        firebase_token = data.get("firebase_token")

        if not firebase_token:
            return jsonify({
                "error": "Firebase token required",
            }), 400

        firebase_user = JWTManager.verify_firebase_token(
            firebase_token
        )

        if not firebase_user:
            return jsonify({
                "error": "Invalid Firebase token",
            }), 401

        user = get_or_create_user(firebase_user)

        return jsonify(build_auth_response(user)), 200

    except Exception as error:
        return jsonify({
            "error": str(error),
        }), 500


@auth_bp.route("/refresh", methods=["POST"])
def refresh():
    """
    Refresh access token.
    """

    try:
        data = request.json or {}
        refresh_token = data.get("refresh_token")

        if not refresh_token:
            return jsonify({
                "error": "Refresh token required",
            }), 400

        payload = JWTManager.verify_token(refresh_token)

        if not payload or payload.get("type") != "refresh":
            return jsonify({
                "error": "Invalid refresh token",
            }), 401

        conn = get_db_connection()

        user = conn.execute(
            """
            SELECT *
            FROM users
            WHERE firebase_uid = ?
            """,
            (payload["user_id"],),
        ).fetchone()

        conn.close()

        if not user:
            return jsonify({
                "error": "User not found",
            }), 404

        user_data = {
            "uid": user["firebase_uid"],
            "email": user["email"],
            "role": user["role"],
        }

        access_token = JWTManager.create_access_token(
            user_data
        )

        return jsonify({
            "access_token": access_token,
        }), 200

    except Exception as error:
        return jsonify({
            "error": str(error),
        }), 500


@auth_bp.route("/logout", methods=["POST"])
def logout():
    """
    Logout.
    Hiện tại phía server chưa blacklist token.
    """

    return jsonify({
        "message": "Logged out successfully",
    }), 200


init_db()
from flask import Blueprint, request, jsonify
from auth import JWTManager
from config.config import Config
import sqlite3
from datetime import datetime

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

# Simple user database (trong production dùng proper database)
def get_db_connection():
    conn = sqlite3.connect('users.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            firebase_uid TEXT UNIQUE NOT NULL,
            email TEXT NOT NULL,
            role TEXT DEFAULT 'free',
            subscription TEXT DEFAULT 'free',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS usage_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            feature TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            quota_consumed INTEGER DEFAULT 1
        )
    ''')
    conn.commit()
    conn.close()
@auth_bp.route('/register', methods=['POST'])
def register():
    """Register với Firebase token"""
    try:
        data = request.json
        firebase_token = data.get('firebase_token')

        if not firebase_token:
            return jsonify({'error': 'Firebase token required'}), 400

        # Verify Firebase token
        firebase_user = JWTManager.verify_firebase_token(firebase_token)
        if not firebase_user:
            return jsonify({'error': 'Invalid Firebase token'}), 401

        # Check if user already exists
        conn = get_db_connection()
        existing_user = conn.execute(
            'SELECT * FROM users WHERE firebase_uid = ?',
            (firebase_user['uid'],)
        ).fetchone()

        if existing_user:
            conn.close()
            return jsonify({'error': 'User already exists'}), 400

        # Create new user
        conn.execute(
            'INSERT INTO users (firebase_uid, email, role, subscription) VALUES (?, ?, ?, ?)',
            (firebase_user['uid'], firebase_user['email'], 'free', 'free')
        )
        conn.commit()

        user = conn.execute(
            'SELECT * FROM users WHERE firebase_uid = ?',
            (firebase_user['uid'],)
        ).fetchone()
        conn.close()

        # Create JWT tokens
        user_data = {
            'uid': user['firebase_uid'],
            'email': user['email'],
            'role': user['role'],
            'subscription': user['subscription']
        }

        access_token = JWTManager.create_access_token(user_data)
        refresh_token = JWTManager.create_refresh_token(user['firebase_uid'])

        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': {
                'id': user['firebase_uid'],
                'email': user['email'],
                'role': user['role'],
                'subscription': user['subscription']
            }
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500
@auth_bp.route('/login', methods=['POST'])
def login():
    """Login với Firebase token"""
    try:
        data = request.json
        firebase_token = data.get('firebase_token')

        if not firebase_token:
            return jsonify({'error': 'Firebase token required'}), 400

        # Verify Firebase token
        firebase_user = JWTManager.verify_firebase_token(firebase_token)
        if not firebase_user:
            return jsonify({'error': 'Invalid Firebase token'}), 401

        # Get or create user in local database
        conn = get_db_connection()
        user = conn.execute(
            'SELECT * FROM users WHERE firebase_uid = ?',
            (firebase_user['uid'],)
        ).fetchone()

        if not user:
            # Create new user
            conn.execute(
                'INSERT INTO users (firebase_uid, email) VALUES (?, ?)',
                (firebase_user['uid'], firebase_user['email'])
            )
            conn.commit()
            user = conn.execute(
                'SELECT * FROM users WHERE firebase_uid = ?',
                (firebase_user['uid'],)
            ).fetchone()

        conn.close()

        # Create JWT tokens
        user_data = {
            'uid': user['firebase_uid'],
            'email': user['email'],
            'role': user['role'],
            'subscription': user['subscription']
        }

        access_token = JWTManager.create_access_token(user_data)
        refresh_token = JWTManager.create_refresh_token(user['firebase_uid'])

        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': {
                'id': user['firebase_uid'],
                'email': user['email'],
                'role': user['role'],
                'subscription': user['subscription']
            }
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/refresh', methods=['POST'])
def refresh():
    """Refresh access token"""
    try:
        data = request.json
        refresh_token = data.get('refresh_token')

        if not refresh_token:
            return jsonify({'error': 'Refresh token required'}), 400

        payload = JWTManager.verify_token(refresh_token)
        if not payload or payload.get('type') != 'refresh':
            return jsonify({'error': 'Invalid refresh token'}), 401

        # Get user data
        conn = get_db_connection()
        user = conn.execute(
            'SELECT * FROM users WHERE firebase_uid = ?',
            (payload['user_id'],)
        ).fetchone()
        conn.close()

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Create new access token
        user_data = {
            'uid': user['firebase_uid'],
            'email': user['email'],
            'role': user['role'],
            'subscription': user['subscription']
        }

        access_token = JWTManager.create_access_token(user_data)

        return jsonify({'access_token': access_token})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Logout (token blacklisting would go here)"""
    return jsonify({'message': 'Logged out successfully'})

# Initialize database when module is imported
init_db()

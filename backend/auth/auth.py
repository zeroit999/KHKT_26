import jwt
import datetime
import logging
from functools import wraps
from flask import request, jsonify
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials, firestore

# Import config with fallback
try:
    from config.config import Config
except ImportError:
    import sys
    import os

    sys.path.insert(
        0,
        os.path.dirname(
            os.path.dirname(
                os.path.abspath(__file__)
            )
        )
    )

    from config.config import Config

# Initialize Firebase Admin
if not firebase_admin._apps:
    cred = credentials.Certificate(
        Config.FIREBASE_ADMIN_KEY_PATH
    )

    firebase_admin.initialize_app(cred)

# Get Firestore client
db = firestore.client()


def get_user_data_firebase(firebase_uid):
    """Get complete user data from Firebase Firestore"""

    try:
        logging.info(
            f"🔍 [DEBUG] Getting user data for: {firebase_uid}"
        )

        user_ref = db.collection('users').document(firebase_uid)

        user_doc = user_ref.get()

        if user_doc.exists:
            user_data = user_doc.to_dict()

            logging.info(
                f"✅ [DEBUG] User data found: "
                f"{user_data.get('email', 'unknown')}"
            )

            return user_data

        else:
            logging.info(
                f"❌ [DEBUG] User data not found in Firestore"
            )

            return None

    except Exception as e:
        logging.error(
            f"💥 [DEBUG] Firebase error getting user data: {e}"
        )

        return None


class JWTManager:

    @staticmethod
    def create_access_token(user_data):
        """Tạo JWT access token"""

        payload = {
            'user_id': user_data['uid'],
            'email': user_data['email'],

            'permissions': user_data.get(
                'permissions',
                ['basic']
            ),

            'exp': (
                datetime.datetime.utcnow()
                + datetime.timedelta(
                    seconds=Config.JWT_ACCESS_TOKEN_EXPIRES
                )
            ),

            'iat': datetime.datetime.utcnow(),

            'type': 'access'
        }

        return jwt.encode(
            payload,
            Config.JWT_SECRET_KEY,
            algorithm='HS256'
        )

    @staticmethod
    def create_refresh_token(user_id):
        """Tạo JWT refresh token"""

        payload = {
            'user_id': user_id,

            'exp': (
                datetime.datetime.utcnow()
                + datetime.timedelta(
                    seconds=Config.JWT_REFRESH_TOKEN_EXPIRES
                )
            ),

            'iat': datetime.datetime.utcnow(),

            'type': 'refresh'
        }

        return jwt.encode(
            payload,
            Config.JWT_SECRET_KEY,
            algorithm='HS256'
        )

    @staticmethod
    def verify_token(token):
        """Verify JWT token"""

        try:
            payload = jwt.decode(
                token,
                Config.JWT_SECRET_KEY,
                algorithms=['HS256']
            )

            return payload

        except jwt.ExpiredSignatureError:
            return None

        except jwt.InvalidTokenError:
            return None

    @staticmethod
    def verify_firebase_token(id_token):
        """Verify Firebase ID token"""

        try:
            decoded_token = firebase_auth.verify_id_token(
                id_token
            )

            return decoded_token

        except Exception as e:
            logging.error(
                f"Firebase token verification failed: {e}"
            )

            return None


def jwt_required(f):
    """
    Decorator yêu cầu JWT token hợp lệ
    (backward compatibility)
    """

    @wraps(f)
    def decorated(*args, **kwargs):

        auth_header = request.headers.get(
            'Authorization'
        )

        if (
            not auth_header
            or not auth_header.startswith('Bearer ')
        ):

            return jsonify({
                'error': (
                    'Missing or invalid '
                    'Authorization header'
                )
            }), 401

        token = auth_header.split(' ')[1]

        payload = JWTManager.verify_token(token)

        if not payload:
            return jsonify({
                'error': 'Invalid or expired token'
            }), 401

        if payload.get('type') != 'access':
            return jsonify({
                'error': 'Invalid token type'
            }), 401

        # Attach user info to request
        request.current_user = payload

        return f(*args, **kwargs)

    return decorated


def auth_required(f):
    """
    Decorator hỗ trợ cả
    JWT token và Firebase ID token
    """

    @wraps(f)
    def decorated(*args, **kwargs):

        auth_header = request.headers.get(
            'Authorization'
        )

        if (
            not auth_header
            or not auth_header.startswith('Bearer ')
        ):

            return jsonify({
                'error': (
                    'Missing or invalid '
                    'Authorization header'
                )
            }), 401

        token = auth_header.split(' ')[1]

        user_payload = None

        # Try Firebase token first
        firebase_user = (
            JWTManager.verify_firebase_token(token)
        )

        if firebase_user:

            # Get user data from Firestore
            user_data = get_user_data_firebase(
                firebase_user['uid']
            )

            # Convert Firebase user to our format
            user_payload = {
                'user_id': firebase_user['uid'],

                'email': firebase_user.get(
                    'email',
                    ''
                ),

                'name': firebase_user.get(
                    'name',
                    ''
                ),

                'type': 'firebase'
            }

            # Update with Firestore data
            if user_data:

                user_payload.update({
                    'name': user_data.get(
                        'firstName',
                        user_payload['name']
                    )
                })

        # If not Firebase token, try JWT token
        if not user_payload:

            jwt_payload = (
                JWTManager.verify_token(token)
            )

            if (
                jwt_payload
                and jwt_payload.get('type') == 'access'
            ):

                user_payload = jwt_payload

        if not user_payload:

            return jsonify({
                'error': 'Invalid or expired token'
            }), 401

        # Attach user info to request
        request.current_user = user_payload

        return f(*args, **kwargs)

    return decorated


def firebase_required(f):
    """
    Decorator chỉ chấp nhận Firebase ID token
    """

    @wraps(f)
    def decorated(*args, **kwargs):

        auth_header = request.headers.get(
            'Authorization'
        )

        if (
            not auth_header
            or not auth_header.startswith('Bearer ')
        ):

            return jsonify({
                'error': (
                    'Missing or invalid '
                    'Authorization header'
                )
            }), 401

        token = auth_header.split(' ')[1]

        # Verify Firebase token
        firebase_user = (
            JWTManager.verify_firebase_token(token)
        )

        if not firebase_user:

            return jsonify({
                'error': 'Invalid Firebase token'
            }), 401

        # Get user data from Firestore
        user_data = get_user_data_firebase(
            firebase_user['uid']
        )

        # Convert to our user format
        user_payload = {
            'user_id': firebase_user['uid'],

            'email': firebase_user.get(
                'email',
                ''
            ),

            'name': firebase_user.get(
                'name',
                ''
            ),

            'type': 'firebase'
        }

        # Update with Firestore data
        if user_data:

            user_payload.update({
                'name': user_data.get(
                    'firstName',
                    user_payload['name']
                )
            })

        # Attach user info to request
        request.current_user = user_payload

        return f(*args, **kwargs)

    return decorated
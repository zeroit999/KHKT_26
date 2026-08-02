import os
import tempfile

from flask import Flask, jsonify, request
from flask_cors import CORS
from docx import Document
from pypdf import PdfReader
from dotenv import load_dotenv
from config.config import Config
from chatbot.service import ChatbotError, create_chat_response, get_capabilities
from chatbot.data_context import build_platform_context
from chatbot.memory import append_chat_turn, clear_chat_memory, load_chat_memory
from auth.auth import (
    JWTManager,
    auth_required,
    build_firebase_user_payload,
    get_user_data_firebase,
)


load_dotenv()


DEFAULT_ALLOWED_ORIGINS = [
    "https://ai-exam-monitoring.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

SUPPORTED_FILE_EXTENSIONS = {".docx", ".pdf"}


def get_optional_chat_user():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header:
        return None
    if not auth_header.startswith("Bearer "):
        raise ChatbotError("Authorization header không hợp lệ.")

    token = auth_header.split(" ", 1)[1].strip()
    firebase_user = JWTManager.verify_firebase_token(token)
    if firebase_user:
        user_data = get_user_data_firebase(firebase_user["uid"]) or {}
        return {
            **user_data,
            **build_firebase_user_payload(firebase_user, user_data),
        }

    jwt_payload = JWTManager.verify_token(token)
    if jwt_payload and jwt_payload.get("type") == "access":
        user_data = get_user_data_firebase(jwt_payload.get("uid")) or {}
        return {**user_data, **jwt_payload}

    raise ChatbotError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.")

def get_allowed_origins():
    origins = list(DEFAULT_ALLOWED_ORIGINS)

    config_origins = getattr(Config, "ALLOWED_ORIGINS", []) or []

    if isinstance(config_origins, str):
        config_origins = config_origins.split(",")

    origins.extend(config_origins)

    env_origins = os.environ.get("ALLOWED_ORIGINS", "")

    if env_origins:
        origins.extend(env_origins.split(","))

    cleaned_origins = [
        origin.strip()
        for origin in origins
        if str(origin or "").strip()
    ]

    return list(dict.fromkeys(cleaned_origins))


def configure_cors(app):
    CORS(
        app,
        resources={
            r"/*": {
                "origins": get_allowed_origins(),
            }
        },
        supports_credentials=True,
        allow_headers=[
            "Content-Type",
            "Authorization",
        ],
        methods=[
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS",
        ],
    )


def register_blueprints(app):
    from auth.auth_routes import auth_bp
    from exams.exam_routes import exam_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(exam_bp)


def extract_docx_text(file_path):
    document = Document(file_path)

    return "\n".join(
        paragraph.text
        for paragraph in document.paragraphs
        if paragraph.text.strip()
    ).strip()


def extract_pdf_text(file_path):
    reader = PdfReader(file_path)

    return "\n".join(
        page.extract_text() or ""
        for page in reader.pages
    ).strip()


def extract_file_text(file_path, suffix):
    if suffix == ".docx":
        return extract_docx_text(file_path)

    if suffix == ".pdf":
        return extract_pdf_text(file_path)

    return ""


def create_app():
    app = Flask(__name__)

    app.config["SECRET_KEY"] = getattr(
        Config,
        "SECRET_KEY",
        os.environ.get("SECRET_KEY", "change-me"),
    )

    configure_cors(app)
    register_blueprints(app)

    @app.get("/")
    def index():
        return jsonify({
            "success": True,
            "message": "Backend API is running",
        })

    @app.get("/health")
    def health():
        return jsonify({
            "success": True,
            "status": "ok",
            "localDevMode": Config.LOCAL_DEV_MODE,
            "chatbot": get_capabilities(),
        })

    @app.get("/api/chat/capabilities")
    def chat_capabilities():
        return jsonify({"success": True, **get_capabilities()})

    @app.get("/api/chat/history")
    @auth_required
    def chat_history():
        messages = load_chat_memory(request.current_user.get("uid"))
        return jsonify({
            "success": True,
            "messages": messages,
            "messageCount": len(messages),
        })

    @app.delete("/api/chat/history")
    @auth_required
    def delete_chat_history():
        clear_chat_memory(request.current_user.get("uid"))
        return jsonify({"success": True, "messages": []})

    @app.post("/api/chat")
    def chat():
        data = request.get_json(silent=True) or {}
        message = str(data.get("message", "")).strip()
        history = data.get("history", [])
        page_context = data.get("context", {})

        if not message:
            return jsonify({
                "success": False,
                "reply": "Vui lòng nhập câu hỏi.",
            }), 400

        try:
            current_user = get_optional_chat_user()
            stored_history = load_chat_memory(current_user.get("uid")) if current_user else []
            effective_history = stored_history or history
            data_context = build_platform_context(current_user, page_context, message)
            result = create_chat_response(
                message=message,
                history=effective_history,
                page_context=page_context,
                data_context=data_context,
            )
            if current_user:
                saved_messages = append_chat_turn(
                    current_user.get("uid"),
                    effective_history,
                    message,
                    result["reply"],
                )
                result["memoryCount"] = len(saved_messages)
            else:
                result["memoryCount"] = len(effective_history)
            return jsonify({"success": True, **result})

        except ChatbotError as error:
            print("Chatbot error:", error)

            return jsonify({
                "success": False,
                "reply": str(error),
            }), 500

    @app.post("/api/extract-file")
    def extract_file():
        uploaded_file = request.files.get("file")

        if not uploaded_file:
            return jsonify({
                "success": False,
                "message": "Không tìm thấy file upload.",
                "text": "",
            }), 400

        file_name = uploaded_file.filename or ""
        suffix = os.path.splitext(file_name)[1].lower()

        if suffix not in SUPPORTED_FILE_EXTENSIONS:
            return jsonify({
                "success": False,
                "message": "Chỉ hỗ trợ file .docx và .pdf.",
                "text": "",
            }), 400

        temp_path = ""

        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                uploaded_file.save(temp_file.name)
                temp_path = temp_file.name

            text = extract_file_text(temp_path, suffix)

            return jsonify({
                "success": True,
                "filename": file_name,
                "text": text,
                "can_download": True,
            })

        except Exception as error:
            return jsonify({
                "success": False,
                "message": f"Không thể đọc nội dung file: {str(error)}",
                "text": "",
                "can_download": True,
            }), 500

        finally:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=os.environ.get("FLASK_DEBUG", "0") == "1",
    )

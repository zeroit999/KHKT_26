from flask import Flask, jsonify, request
from flask_cors import CORS

from auth.auth_routes import auth_bp
from exams.exam_routes import exam_bp
from config.config import Config

import os
import tempfile
from docx import Document
from pypdf import PdfReader


DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

SUPPORTED_FILE_EXTENSIONS = {".docx", ".pdf"}


def get_allowed_origins():
    allowed_origins = [
        origin.strip()
        for origin in Config.ALLOWED_ORIGINS
        if origin.strip()
    ]

    return allowed_origins or DEFAULT_ALLOWED_ORIGINS


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
    app.register_blueprint(auth_bp)
    app.register_blueprint(exam_bp)


def extract_docx_text(file_path):
    document = Document(file_path)
    return "\n".join(
        paragraph.text
        for paragraph in document.paragraphs
        if paragraph.text.strip()
    )


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

    app.config["SECRET_KEY"] = Config.SECRET_KEY

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
        })

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
        port=5000,
        debug=True,
    )

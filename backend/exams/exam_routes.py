from flask import Blueprint, request, jsonify

from auth import auth_required

from exams.exam_service import (
    get_exams,
    get_public_exams,
    get_exam_detail,
    create_exam,
    update_exam,
    delete_exam,
    log_proctoring_event,
    submit_exam,
    get_my_result,
    get_exam_results,
    get_my_statistics,
)

from exams.word_parser import parse_docx_exam

exam_bp = Blueprint("exam_bp", __name__, url_prefix="/api/exams")


@exam_bp.post("/parse-word")
@auth_required
def parse_word_exam_route():
    try:
        file = request.files.get("file")

        if not file:
            return jsonify({
                "success": False,
                "message": "Chưa có file Word",
            }), 400

        filename = file.filename or ""

        if not filename.lower().endswith(".docx"):
            return jsonify({
                "success": False,
                "message": "Chỉ hỗ trợ file .docx",
            }), 400

        data = parse_docx_exam(file.stream)

        return jsonify({
            "success": True,
            "fileName": filename,
            **data,
        }), 200

    except Exception as error:
        print("PARSE WORD ERROR:", error)

        return jsonify({
            "success": False,
            "message": str(error),
        }), 400


@exam_bp.get("/public")
def get_public_exams_route():
    try:
        data = get_public_exams()
        return jsonify(data), 200
    except Exception as error:
        return jsonify({
            "success": False,
            "message": str(error),
        }), 400


@exam_bp.get("")
@auth_required
def get_exams_route():
    try:
        data = get_exams(request.current_user)
        return jsonify(data), 200
    except Exception as error:
        return jsonify({
            "success": False,
            "message": str(error),
        }), 400


@exam_bp.get("/my-statistics")
@auth_required
def get_my_statistics_route():
    try:
        data = get_my_statistics(
            request.current_user
        )

        return jsonify(data), 200

    except Exception as error:
        return jsonify({
            "success": False,
            "message": str(error),
        }), 400



@exam_bp.get("/<int:exam_id>")
@auth_required
def get_exam_detail_route(exam_id):
    try:
        data = get_exam_detail(request.current_user, exam_id)
        return jsonify(data), 200
    except Exception as error:
        return jsonify({
            "success": False,
            "message": str(error),
        }), 400


@exam_bp.post("")
@auth_required
def create_exam_route():
    try:
        payload = request.get_json() or {}
        data = create_exam(request.current_user, payload)
        return jsonify(data), 201
    except Exception as error:
        return jsonify({
            "success": False,
            "message": str(error),
        }), 400


@exam_bp.put("/<int:exam_id>")
@auth_required
def update_exam_route(exam_id):
    try:
        payload = request.get_json() or {}
        data = update_exam(request.current_user, exam_id, payload)
        return jsonify(data), 200
    except Exception as error:
        return jsonify({
            "success": False,
            "message": str(error),
        }), 400


@exam_bp.delete("/<int:exam_id>")
@auth_required
def delete_exam_route(exam_id):
    try:
        data = delete_exam(request.current_user, exam_id)
        return jsonify(data), 200
    except Exception as error:
        return jsonify({
            "success": False,
            "message": str(error),
        }), 400


@exam_bp.post("/<int:exam_id>/submit")
@auth_required
def submit_exam_route(exam_id):
    try:
        payload = request.get_json() or {}
        data = submit_exam(request.current_user, exam_id, payload)
        return jsonify(data), 200
    except Exception as error:
        return jsonify({
            "success": False,
            "message": str(error),
        }), 400


@exam_bp.post("/<int:exam_id>/proctoring/events")
@auth_required
def log_proctoring_event_route(exam_id):
    try:
        payload = request.get_json() or {}
        data = log_proctoring_event(request.current_user, exam_id, payload)
        return jsonify(data), 201
    except Exception as error:
        return jsonify({
            "success": False,
            "message": str(error),
        }), 400


@exam_bp.get("/<int:exam_id>/my-result")
@auth_required
def get_my_result_route(exam_id):
    try:
        data = get_my_result(request.current_user, exam_id)
        return jsonify(data), 200
    except Exception as error:
        return jsonify({
            "success": False,
            "message": str(error),
        }), 400


@exam_bp.get("/<int:exam_id>/results")
@auth_required
def get_exam_results_route(exam_id):
    try:
        data = get_exam_results(request.current_user, exam_id)
        return jsonify(data), 200
    except Exception as error:
        return jsonify({
            "success": False,
            "message": str(error),
        }), 400

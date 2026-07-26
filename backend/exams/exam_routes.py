from flask import Blueprint, request, jsonify

from auth import firebase_required

from exams.exam_service import (
    get_exams,
    get_exam_detail,
    create_exam,
    update_exam,
    delete_exam,
    submit_exam,
    get_my_result,
    get_exam_results,
    grade_exam_result,
)

from exams.word_parser import parse_docx_exam

exam_bp = Blueprint("exam_bp", __name__, url_prefix="/api/exams")


@exam_bp.post("/parse-word")
@firebase_required
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


@exam_bp.get("")
@firebase_required
def get_exams_route():
    try:
        data = get_exams(request.current_user)
        return jsonify(data), 200
    except Exception as error:
        return jsonify({
            "success": False,
            "message": str(error),
        }), 400


@exam_bp.get("/<exam_id>")
@firebase_required
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
@firebase_required
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


@exam_bp.put("/<exam_id>")
@firebase_required
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


@exam_bp.delete("/<exam_id>")
@firebase_required
def delete_exam_route(exam_id):
    try:
        data = delete_exam(request.current_user, exam_id)
        return jsonify(data), 200
    except Exception as error:
        return jsonify({
            "success": False,
            "message": str(error),
        }), 400


@exam_bp.post("/<exam_id>/submit")
@firebase_required
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


@exam_bp.get("/<exam_id>/my-result")
@firebase_required
def get_my_result_route(exam_id):
    try:
        data = get_my_result(request.current_user, exam_id)
        return jsonify(data), 200
    except Exception as error:
        return jsonify({
            "success": False,
            "message": str(error),
        }), 400


@exam_bp.get("/<exam_id>/results")
@firebase_required
def get_exam_results_route(exam_id):
    try:
        data = get_exam_results(request.current_user, exam_id)
        return jsonify(data), 200
    except Exception as error:
        return jsonify({
            "success": False,
            "message": str(error),
        }), 400


@exam_bp.post("/<exam_id>/results/<result_id>/grade")
@firebase_required
def grade_exam_result_route(exam_id, result_id):
    try:
        payload = request.get_json() or {}
        data = grade_exam_result(request.current_user, exam_id, result_id, payload)
        return jsonify(data), 200
    except Exception as error:
        return jsonify({
            "success": False,
            "message": str(error),
        }), 400

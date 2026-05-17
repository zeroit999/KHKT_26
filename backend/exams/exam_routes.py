from flask import Blueprint, request, jsonify
from auth import firebase_required
from exams.exam_service import (
    submit_exam,
    get_my_result,
    get_exam_results,
)

exam_bp = Blueprint("exam_bp", __name__, url_prefix="/api/exams")


@exam_bp.post("/<exam_id>/submit")
@firebase_required
def submit_exam_route(exam_id):
    try:
        payload = request.get_json() or {}
        current_user = request.current_user

        print("CURRENT USER:", current_user)

        data = submit_exam(current_user, exam_id, payload)

        return jsonify(data), 200

    except Exception as error:
        print("SUBMIT EXAM ERROR:", error)

        return jsonify({
            "success": False,
            "message": str(error),
        }), 400


@exam_bp.get("/<exam_id>/my-result")
@firebase_required
def get_my_result_route(exam_id):
    try:
        current_user = request.current_user

        data = get_my_result(current_user, exam_id)

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
        current_user = request.current_user

        data = get_exam_results(current_user, exam_id)

        return jsonify(data), 200

    except Exception as error:
        return jsonify({
            "success": False,
            "message": str(error),
        }), 400
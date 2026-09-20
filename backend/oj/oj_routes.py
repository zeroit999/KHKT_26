from flask import Blueprint, jsonify, request

from auth import auth_required

from oj.oj_service import (
    OJError,
    add_testcase,
    create_problem,
    delete_testcase,
    get_manager_problem_detail,
    create_submission,
    get_my_submissions,
    get_problem_detail,
    get_problems,
    get_submission_detail,
    update_problem,
    update_testcase,
)


oj_bp = Blueprint(
    "oj",
    __name__,
    url_prefix="/api/oj",
)


def error_response(error):
    if isinstance(error, OJError):
        return jsonify({
            "success": False,
            "message": error.message,
        }), error.status_code

    print("OJ ERROR:", error)

    return jsonify({
        "success": False,
        "message":
            "Đã xảy ra lỗi khi xử lý Online Judge.",
    }), 500


@oj_bp.get("/problems")
@auth_required
def get_problems_route():
    try:
        return jsonify(
            get_problems(
                request.current_user
            )
        ), 200
    except Exception as error:
        return error_response(error)


@oj_bp.get("/problems/<int:problem_id>")
@auth_required
def get_problem_detail_route(problem_id):
    try:
        return jsonify(
            get_problem_detail(
                request.current_user,
                problem_id,
            )
        ), 200
    except Exception as error:
        return error_response(error)


@oj_bp.get(
    "/manage/problems/<int:problem_id>"
)
@auth_required
def get_manager_problem_detail_route(
    problem_id,
):
    try:
        return jsonify(
            get_manager_problem_detail(
                request.current_user,
                problem_id,
            )
        ), 200
    except Exception as error:
        return error_response(error)


@oj_bp.put(
    "/manage/problems/"
    "<int:problem_id>/testcases/"
    "<int:testcase_id>"
)
@auth_required
def update_testcase_route(
    problem_id,
    testcase_id,
):
    try:
        payload = request.get_json(
            silent=True
        ) or {}

        return jsonify(
            update_testcase(
                request.current_user,
                problem_id,
                testcase_id,
                payload,
            )
        ), 200
    except Exception as error:
        return error_response(error)


@oj_bp.delete(
    "/manage/problems/"
    "<int:problem_id>/testcases/"
    "<int:testcase_id>"
)
@auth_required
def delete_testcase_route(
    problem_id,
    testcase_id,
):
    try:
        return jsonify(
            delete_testcase(
                request.current_user,
                problem_id,
                testcase_id,
            )
        ), 200
    except Exception as error:
        return error_response(error)



@oj_bp.post("/problems")
@auth_required
def create_problem_route():
    try:
        payload = request.get_json(
            silent=True
        ) or {}

        return jsonify(
            create_problem(
                request.current_user,
                payload,
            )
        ), 201
    except Exception as error:
        return error_response(error)


@oj_bp.put("/problems/<int:problem_id>")
@auth_required
def update_problem_route(problem_id):
    try:
        payload = request.get_json(
            silent=True
        ) or {}

        return jsonify(
            update_problem(
                request.current_user,
                problem_id,
                payload,
            )
        ), 200
    except Exception as error:
        return error_response(error)


@oj_bp.post(
    "/problems/<int:problem_id>/testcases"
)
@auth_required
def add_testcase_route(problem_id):
    try:
        payload = request.get_json(
            silent=True
        ) or {}

        return jsonify(
            add_testcase(
                request.current_user,
                problem_id,
                payload,
            )
        ), 201
    except Exception as error:
        return error_response(error)


@oj_bp.post(
    "/problems/<int:problem_id>/submit"
)
@auth_required
def submit_problem_route(problem_id):
    try:
        payload = request.get_json(
            silent=True
        ) or {}

        return jsonify(
            create_submission(
                request.current_user,
                problem_id,
                payload,
            )
        ), 202
    except Exception as error:
        return error_response(error)


@oj_bp.get("/submissions")
@auth_required
def get_submissions_route():
    try:
        problem_id = request.args.get(
            "problemCode"
        )

        return jsonify(
            get_my_submissions(
                request.current_user,
                problem_id=problem_id,
            )
        ), 200
    except Exception as error:
        return error_response(error)


@oj_bp.get(
    "/submissions/<int:submission_id>"
)
@auth_required
def get_submission_detail_route(
    submission_id,
):
    try:
        return jsonify(
            get_submission_detail(
                request.current_user,
                submission_id,
            )
        ), 200
    except Exception as error:
        return error_response(error)

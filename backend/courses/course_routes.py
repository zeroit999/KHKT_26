from datetime import datetime, timezone

import secrets

from flask import Blueprint, jsonify, request

from auth import auth_required
from auth.rate_limiter import rate_limit
from extensions import db
from models import (
    Classroom,
    ClassroomMember,
    CommentWarning,
    Course,
    CoursePlaylist,
    CourseQuestion,
    CourseQuestionReply,
    CourseRating,
    CourseSavedList,
    CourseSavedListItem,
    CourseView,
    ELearningNotification,
    LearningProgress,
    LearningReport,
    User,
    UserFollow,
)


course_bp = Blueprint(
    "courses_sql",
    __name__,
    url_prefix="/api/courses",
)

learning_bp = Blueprint(
    "learning_sql",
    __name__,
    url_prefix="/api/learning",
)


def utc_now():
    return datetime.now(timezone.utc)


def current_user():
    user_id = (
        request.current_user.get("user_id")
        or request.current_user.get("uid")
    )

    return (
        db.session.get(
            User,
            user_id,
        )
        if user_id
        else None
    )


def role(user):
    return str(
        getattr(
            user,
            "role",
            "",
        )
        or ""
    ).upper()


def is_admin(user):
    return bool(
        user
        and role(user)
        == "ADMIN_DEV"
    )


def is_teacher(user):
    return bool(
        user
        and role(user)
        in {
            "TEACHER",
            "ADMIN_DEV",
        }
    )


def normalize_text(value):
    return str(value or "").strip()


def get_user_classrooms(user):
    if not user:
        return []

    owned = (
        db.session.execute(
            db.select(Classroom)
            .where(Classroom.teacher_id == user.id)
        )
        .scalars()
        .all()
    )

    memberships = (
        db.session.execute(
            db.select(Classroom)
            .join(
                ClassroomMember,
                ClassroomMember.classroom_id == Classroom.id,
            )
            .where(
                db.or_(
                    ClassroomMember.user_id == user.id,
                    db.func.lower(ClassroomMember.email)
                    == normalize_text(user.email).lower(),
                )
            )
        )
        .scalars()
        .all()
    )

    by_id = {
        int(classroom.id): classroom
        for classroom in [*owned, *memberships]
    }
    return list(by_id.values())


def can_manage_course_class(user, class_id):
    if not user:
        return False
    if is_admin(user):
        return True

    class_id_text = normalize_text(class_id)
    if not class_id_text.isdigit():
        return False

    classroom = db.session.get(Classroom, int(class_id_text))
    if not classroom:
        return False

    if classroom.teacher_id and int(classroom.teacher_id) == int(user.id):
        return True

    member = db.session.scalar(
        db.select(ClassroomMember)
        .where(
            ClassroomMember.classroom_id == classroom.id,
            db.or_(
                ClassroomMember.user_id == user.id,
                db.func.lower(ClassroomMember.email)
                == normalize_text(user.email).lower(),
            ),
        )
    )
    if not member:
        return False

    return (
        normalize_text(member.role).upper() in {"TEACHER", "ADMIN_DEV"}
        or normalize_text(member.class_role).lower()
        in {"teacher", "co_teacher", "intern_teacher"}
    )


def course_is_open_for_student(row):
    now = utc_now()
    if row.open_at_ms:
        try:
            return int(row.open_at_ms) <= int(now.timestamp() * 1000)
        except (TypeError, ValueError):
            return False

    open_at = normalize_text(row.open_at)
    if not open_at:
        return True

    try:
        parsed = datetime.fromisoformat(open_at.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed <= now
    except ValueError:
        return False


def can_view_course(row, user, user_classrooms=None):
    if not row or not user:
        return False

    if is_admin(user) or int(row.teacher_id) == int(user.id):
        return True

    moderation_status = normalize_text(
        row.moderation_status or row.status or "approved"
    ).lower()
    if moderation_status != "approved":
        return False

    if not course_is_open_for_student(row):
        return False

    visibility = normalize_text(row.visibility or "public").lower()
    if visibility == "public":
        return True

    classrooms = (
        user_classrooms
        if user_classrooms is not None
        else get_user_classrooms(user)
    )
    class_id_text = normalize_text(row.class_id)

    if visibility == "class":
        if class_id_text.isdigit():
            return any(
                int(classroom.id) == int(class_id_text)
                for classroom in classrooms
            )
        class_name = normalize_text(row.class_name).lower()
        return bool(
            class_name
            and any(
                normalize_text(classroom.name).lower() == class_name
                for classroom in classrooms
            )
        )

    if visibility == "private":
        target = normalize_text(row.class_name).lower()
        if not target:
            return False

        if target in {"10", "11", "12"}:
            if normalize_text(getattr(user, "grade", "")).lower() == target:
                return True
            return any(
                normalize_text(classroom.grade).lower() == target
                for classroom in classrooms
            )

        return any(
            normalize_text(classroom.name).lower() == target
            for classroom in classrooms
        )

    return False


def get_course_for_update(course_id):
    return db.session.scalar(
        db.select(Course)
        .where(Course.id == course_id)
        .with_for_update()
    )


def as_iso(value):
    return (
        value.isoformat()
        if value
        else None
    )


def positive_int(value):
    text = str(
        value
        or ""
    ).strip()

    return (
        int(text)
        if text.isdigit()
        else None
    )


def serialize_saved_list(
    row,
    course_ids=None,
):
    data = dict(
        row.list_data
        or {}
    )

    data.update({
        "id":
            str(row.id),

        "ownerId":
            str(row.owner_id),

        "title":
            row.title,

        "description":
            row.description
            or "",

        "thumbnail":
            row.thumbnail
            or "",

        "thumbnailFileName":
            row.thumbnail_file_name
            or "",

        "courseIds":
            [
                str(item)
                for item in (
                    course_ids
                    or []
                )
            ],

        "createdAt":
            as_iso(
                row.created_at
            ),

        "updatedAt":
            as_iso(
                row.updated_at
            ),
    })

    return data


def serialize_playlist(row):
    data = dict(
        row.playlist_data
        or {}
    )

    data.update({
        "id":
            str(row.id),

        "ownerId":
            str(row.owner_id),

        "title":
            row.title,

        "description":
            row.description
            or "",

        "thumbnail":
            row.thumbnail
            or "",

        "thumbnailFileName":
            row.thumbnail_file_name
            or "",

        "courseIds":
            [
                str(item)
                for item in (
                    row.course_ids
                    or []
                )
            ],

        "createdAt":
            as_iso(
                row.created_at
            ),

        "updatedAt":
            as_iso(
                row.updated_at
            ),
    })

    return data


def build_share_code():
    alphabet = (
        "ABCDEFGHJKLMNPQRSTUVWXYZ"
        "23456789"
    )

    for _ in range(64):
        code = "".join(
            secrets.choice(
                alphabet
            )
            for _ in range(6)
        )

        exists = False

        rows = (
            db.session.execute(
                db.select(
                    CourseSavedList
                )
            )
            .scalars()
            .all()
        )

        for row in rows:
            data = dict(
                row.list_data
                or {}
            )

            if (
                str(
                    data.get(
                        "shareCode"
                    )
                    or ""
                ).upper()
                == code
            ):
                exists = True
                break

        if not exists:
            return code

    raise RuntimeError(
        "Không thể tạo mã chia sẻ."
    )


def serialize_course(row):
    data = dict(
        row.metadata_json
        or {}
    )

    data.update({
        "id":
            str(row.id),

        "legacyId":
            row.legacy_id
            or "",

        "teacherId":
            str(row.teacher_id),

        "title":
            row.title,

        "topic":
            row.topic
            or "",

        "description":
            row.description
            or "",

        "content":
            row.content
            or "",

        "category":
            row.category
            or "",

        "contentType":
            row.content_type
            or "",

        "thumbnail":
            row.thumbnail
            or "",

        "thumbnailFileName":
            row.thumbnail_file_name
            or "",

        "documentImageUrl":
            row.document_image_url
            or "",

        "documentImageName":
            row.document_image_name
            or "",

        "documentImageSize":
            int(
                row.document_image_size
                or 0
            ),

        "documentFileSize":
            int(
                row.document_file_size
                or 0
            ),

        "wordFileName":
            row.word_file_name
            or "",

        "wordFileUrl":
            row.word_file_url
            or "",

        "richDocument":
            row.rich_document
            or "",

        "documentMode":
            row.document_mode
            or "",

        "documentFileType":
            row.document_file_type
            or "",

        "simulationMode":
            row.simulation_mode
            or "",

        "simulationUrl":
            row.simulation_url
            or "",

        "simulationHtml":
            row.simulation_html
            or "",

        "simulationLanguage":
            row.simulation_language
            or "",

        "simulationCode":
            row.simulation_code
            or "",

        "simulationCodes":
            row.simulation_codes
            or [],

        "simulationInstructions":
            row.simulation_instructions
            or "",

        "youtubeUrl":
            row.youtube_url
            or "",

        "lumiUrl":
            row.lumi_url
            or "",

        "mp4FileName":
            row.mp4_file_name
            or "",

        "mp4FileUrl":
            row.mp4_file_url
            or "",

        "videoSourceType":
            row.video_source_type
            or "",

        "videoSources":
            row.video_sources
            or [],

        "durationSeconds":
            int(
                row.duration_seconds
                or 0
            ),

        "duration":
            row.duration
            or "",

        "youtubeDuration":
            row.youtube_duration
            or "",

        "attachMode":
            row.attach_mode
            or "",

        "codeLanguage":
            row.code_language
            or "",

        "codeContent":
            row.code_content
            or "",

        "learningObjectives":
            row.learning_objectives
            or [],

        "prerequisites":
            row.prerequisites
            or [],

        "difficulty":
            row.difficulty
            or "beginner",

        "estimatedMinutes":
            int(
                row.estimated_minutes
                or 0
            ),

        "checklist":
            row.checklist
            or [],

        "quiz":
            row.quiz
            or [],

        "lessonTopics":
            row.lesson_topics
            or [],

        "lessons":
            row.lessons
            or [],

        "lessonCount":
            int(
                row.lesson_count
                or 0
            ),

        "courseCode":
            row.course_code
            or "",

        "teacherCode":
            row.teacher_code
            or "",

        "teacherEmail":
            row.teacher_email
            or "",

        "teacherName":
            row.teacher_name
            or "",

        "teacherSubject":
            row.teacher_subject
            or "",

        "createdByRole":
            row.created_by_role
            or "",

        "visibility":
            row.visibility
            or "public",

        "classId":
            row.class_id
            or "",

        "className":
            row.class_name
            or "",

        "openAt":
            row.open_at
            or "",

        "openAtMs":
            row.open_at_ms,

        "publishConfirmed":
            bool(
                row.publish_confirmed
            ),

        "status":
            row.status
            or "",

        "moderationStatus":
            row.moderation_status
            or "",

        "studentCount":
            int(
                row.student_count
                or 0
            ),

        "rating":
            float(
                row.rating
                or 0
            ),

        "ratingTotal":
            float(
                row.rating_total
                or 0
            ),

        "ratingCount":
            int(
                row.rating_count
                or 0
            ),

        "views":
            int(
                row.views
                or 0
            ),

        "isFeatured":
            bool(
                row.is_featured
            ),

        "submittedAt":
            as_iso(
                row.submitted_at
            ),

        "createdAt":
            as_iso(
                row.created_at
            ),

        "updatedAt":
            as_iso(
                row.updated_at
            ),
    })

    return data


def serialize_progress(row):
    data = dict(
        row.progress_data
        or {}
    )

    data.update({
        "id":
            str(row.id),

        "userId":
            str(row.user_id),

        "courseId":
            str(row.course_id),

        "progress":
            float(
                row.progress
                or 0
            ),

        "watchedSeconds":
            int(
                row.watched_seconds
                or 0
            ),

        "watchedDate":
            row.watched_date
            or "",

        "bookmarked":
            bool(
                row.bookmarked
            ),

        "completedChecklist":
            row.completed_checklist
            or [],

        "quizResult":
            row.quiz_result,

        "notes":
            row.notes
            or "",

        "noteColor":
            row.note_color
            or "",

        "lastViewedAt":
            as_iso(
                row.last_viewed_at
            ),

        "lastWatchedAt":
            as_iso(
                row.last_watched_at
            ),

        "firstWatchedAt":
            as_iso(
                row.first_watched_at
            ),

        "savedAt":
            as_iso(
                row.saved_at
            ),

        "unsavedAt":
            as_iso(
                row.unsaved_at
            ),

        "completedAt":
            as_iso(
                row.completed_at
            ),

        "createdAt":
            as_iso(
                row.created_at
            ),

        "updatedAt":
            as_iso(
                row.updated_at
            ),
    })

    return data


def serialize_question(row, replies=None):
    data = dict(
        row.question_data
        or {}
    )

    data.update({
        "id":
            str(row.id),

        "courseId":
            str(row.course_id),

        "userId":
            str(row.user_id),

        "userName":
            row.user_name
            or "",

        "userAvatar":
            row.user_avatar
            or "",

        "userRole":
            row.user_role
            or "",

        "content":
            row.content,

        "isAdmin":
            bool(
                row.is_admin
            ),

        "editedAt":
            as_iso(
                row.edited_at
            ),

        "createdAt":
            as_iso(
                row.created_at
            ),

        "updatedAt":
            as_iso(
                row.updated_at
            ),

        "replies":
            replies
            or [],
    })

    return data


def serialize_reply(row):
    data = dict(
        row.reply_data
        or {}
    )

    data.update({
        "id":
            str(row.id),

        "questionId":
            str(
                row.question_id
            ),

        "userId":
            str(
                row.user_id
            ),

        "userName":
            row.user_name
            or "",

        "userAvatar":
            row.user_avatar
            or "",

        "userRole":
            row.user_role
            or "",

        "content":
            row.content,

        "isAdmin":
            bool(
                row.is_admin
            ),

        "isTeacherReply":
            bool(
                row.is_teacher_reply
            ),

        "editedAt":
            as_iso(
                row.edited_at
            ),

        "createdAt":
            as_iso(
                row.created_at
            ),

        "updatedAt":
            as_iso(
                row.updated_at
            ),
    })

    return data


def apply_course_payload(
    row,
    data,
):
    mapping = {
        "legacyId":
            "legacy_id",
        "topic":
            "topic",
        "description":
            "description",
        "content":
            "content",
        "category":
            "category",
        "contentType":
            "content_type",
        "thumbnail":
            "thumbnail",
        "thumbnailFileName":
            "thumbnail_file_name",
        "documentImageUrl":
            "document_image_url",
        "documentImageName":
            "document_image_name",
        "documentImageSize":
            "document_image_size",
        "documentFileSize":
            "document_file_size",
        "wordFileName":
            "word_file_name",
        "wordFileUrl":
            "word_file_url",
        "richDocument":
            "rich_document",
        "documentMode":
            "document_mode",
        "documentFileType":
            "document_file_type",
        "simulationMode":
            "simulation_mode",
        "simulationUrl":
            "simulation_url",
        "simulationHtml":
            "simulation_html",
        "simulationLanguage":
            "simulation_language",
        "simulationCode":
            "simulation_code",
        "simulationCodes":
            "simulation_codes",
        "simulationInstructions":
            "simulation_instructions",
        "youtubeUrl":
            "youtube_url",
        "lumiUrl":
            "lumi_url",
        "mp4FileName":
            "mp4_file_name",
        "mp4FileUrl":
            "mp4_file_url",
        "videoSourceType":
            "video_source_type",
        "videoSources":
            "video_sources",
        "durationSeconds":
            "duration_seconds",
        "duration":
            "duration",
        "youtubeDuration":
            "youtube_duration",
        "attachMode":
            "attach_mode",
        "codeLanguage":
            "code_language",
        "codeContent":
            "code_content",
        "learningObjectives":
            "learning_objectives",
        "prerequisites":
            "prerequisites",
        "difficulty":
            "difficulty",
        "estimatedMinutes":
            "estimated_minutes",
        "checklist":
            "checklist",
        "quiz":
            "quiz",
        "lessonTopics":
            "lesson_topics",
        "lessons":
            "lessons",
        "lessonCount":
            "lesson_count",
        "courseCode":
            "course_code",
        "teacherCode":
            "teacher_code",
        "teacherEmail":
            "teacher_email",
        "teacherName":
            "teacher_name",
        "teacherSubject":
            "teacher_subject",
        "createdByRole":
            "created_by_role",
        "visibility":
            "visibility",
        "classId":
            "class_id",
        "className":
            "class_name",
        "openAt":
            "open_at",
        "openAtMs":
            "open_at_ms",
        "publishConfirmed":
            "publish_confirmed",
        "status":
            "status",
        "moderationStatus":
            "moderation_status",
        "studentCount":
            "student_count",
        "rating":
            "rating",
        "ratingTotal":
            "rating_total",
        "ratingCount":
            "rating_count",
        "views":
            "views",
        "isFeatured":
            "is_featured",
    }

    for key, attr in mapping.items():
        if key in data:
            setattr(
                row,
                attr,
                data[
                    key
                ],
            )

    if "title" in data:
        row.title = str(
            data.get(
                "title"
            )
            or ""
        ).strip()

    metadata = dict(
        row.metadata_json
        or {}
    )

    known = set(
        mapping.keys()
    ) | {
        "id",
        "teacherId",
        "title",
        "createdAt",
        "updatedAt",
        "submittedAt",
        "expectedUpdatedAt",
    }

    for key, value in data.items():
        if key not in known:
            metadata[
                key
            ] = value

    row.metadata_json = metadata
    row.updated_at = utc_now()


@course_bp.get("")
@auth_required
@rate_limit(limit=300, window=3600, per_user=True)
def list_courses():
    user = current_user()
    if not user:
        return jsonify({"success": False, "error": "Không tìm thấy tài khoản."}), 404

    limit = max(1, min(request.args.get("limit", 300, type=int) or 300, 1000))
    rows = (
        db.session.execute(
            db.select(Course)
            .order_by(Course.created_at.desc(), Course.id.desc())
            .limit(limit)
        )
        .scalars()
        .all()
    )
    classrooms = get_user_classrooms(user)
    visible_rows = [
        row for row in rows
        if can_view_course(row, user, classrooms)
    ]
    return jsonify({
        "success": True,
        "courses": [serialize_course(row) for row in visible_rows],
        "count": len(visible_rows),
    }), 200


@course_bp.get(
    "/<int:course_id>"
)
@auth_required
@rate_limit(limit=600, window=3600, per_user=True)
def get_course(course_id):
    user = current_user()
    if not user:
        return jsonify({"success": False, "error": "Không tìm thấy tài khoản."}), 404

    row = db.session.get(Course, course_id)
    if not row or not can_view_course(row, user):
        return jsonify({
            "success": False,
            "error": "Khóa học không tồn tại hoặc bạn không có quyền truy cập.",
        }), 404

    return jsonify({
        "success": True,
        "course": serialize_course(row),
    }), 200


@course_bp.post("")
@auth_required
@rate_limit(limit=60, window=3600, per_user=True)
def create_course():
    user = current_user()
    if not user:
        return jsonify({"success": False, "error": "Không tìm thấy tài khoản."}), 404
    if not is_teacher(user):
        return jsonify({"success": False, "error": "Bạn không có quyền tạo khóa học."}), 403

    data = request.get_json(silent=True) or {}
    title = normalize_text(data.get("title"))
    if not title:
        return jsonify({"success": False, "error": "Tên khóa học không được để trống."}), 400
    if len(title) > 300:
        return jsonify({"success": False, "error": "Tên khóa học quá dài."}), 400

    visibility = normalize_text(data.get("visibility") or "public").lower()
    if visibility not in {"public", "private", "class"}:
        return jsonify({"success": False, "error": "Phạm vi hiển thị không hợp lệ."}), 400

    class_id = normalize_text(data.get("classId"))
    if visibility == "class" and not can_manage_course_class(user, class_id):
        return jsonify({
            "success": False,
            "error": "Bạn không có quyền đăng học liệu cho lớp này.",
        }), 403

    row = Course(teacher_id=user.id, title=title)
    apply_course_payload(row, data)
    row.teacher_id = user.id
    row.teacher_email = user.email or ""
    row.teacher_name = user.full_name or user.email or ""
    row.created_by_role = role(user)
    row.visibility = visibility

    db.session.add(row)
    db.session.commit()
    return jsonify({"success": True, "course": serialize_course(row)}), 201


@course_bp.patch(
    "/<int:course_id>"
)
@auth_required
@rate_limit(limit=180, window=3600, per_user=True)
def update_course(course_id):
    user = current_user()
    if not user:
        return jsonify({"success": False, "error": "Không tìm thấy tài khoản."}), 404

    row = get_course_for_update(course_id)
    if not row:
        return jsonify({"success": False, "error": "Khóa học không tồn tại."}), 404

    if not is_admin(user) and int(row.teacher_id) != int(user.id):
        db.session.rollback()
        return jsonify({"success": False, "error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    expected_updated_at = normalize_text(data.get("expectedUpdatedAt"))
    current_updated_at = row.updated_at.isoformat() if row.updated_at else ""
    if expected_updated_at and expected_updated_at != current_updated_at:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": "Dữ liệu khóa học đã được cập nhật bởi phiên khác.",
            "code": "WRITE_CONFLICT",
            "currentUpdatedAt": current_updated_at,
        }), 409

    if "title" in data:
        title = normalize_text(data.get("title"))
        if not title:
            db.session.rollback()
            return jsonify({"success": False, "error": "Tên khóa học không được để trống."}), 400
        if len(title) > 300:
            db.session.rollback()
            return jsonify({"success": False, "error": "Tên khóa học quá dài."}), 400

    if "visibility" in data:
        visibility = normalize_text(data.get("visibility")).lower()
        if visibility not in {"public", "private", "class"}:
            db.session.rollback()
            return jsonify({"success": False, "error": "Phạm vi hiển thị không hợp lệ."}), 400
        target_class_id = normalize_text(data.get("classId") if "classId" in data else row.class_id)
        if visibility == "class" and not can_manage_course_class(user, target_class_id):
            db.session.rollback()
            return jsonify({
                "success": False,
                "error": "Bạn không có quyền đăng học liệu cho lớp này.",
            }), 403

    apply_course_payload(row, data)
    row.updated_at = utc_now()
    db.session.commit()
    return jsonify({"success": True, "course": serialize_course(row)}), 200


@course_bp.delete(
    "/<int:course_id>"
)
@auth_required
@rate_limit(limit=60, window=3600, per_user=True)
def delete_course(course_id):
    user = current_user()
    if not user:
        return jsonify({"success": False, "error": "Không tìm thấy tài khoản."}), 404

    row = get_course_for_update(course_id)
    if not row:
        return jsonify({"success": False, "error": "Khóa học không tồn tại."}), 404

    if not is_admin(user) and int(row.teacher_id) != int(user.id):
        db.session.rollback()
        return jsonify({"success": False, "error": "Forbidden"}), 403

    db.session.delete(row)
    db.session.commit()
    return jsonify({"success": True, "courseId": str(course_id)}), 200


@course_bp.get(
    "/<int:course_id>/progress"
)
@auth_required
def get_progress(
    course_id,
):
    user = current_user()

    row = db.session.scalar(
        db.select(
            LearningProgress
        )
        .where(
            LearningProgress.user_id
            == user.id,

            LearningProgress.course_id
            == course_id,
        )
    )

    return jsonify({
        "success": True,
        "progress":
            (
                serialize_progress(
                    row
                )
                if row
                else None
            ),
    }), 200


@course_bp.patch(
    "/<int:course_id>/progress"
)
@auth_required
def update_progress(
    course_id,
):
    user = current_user()

    row = db.session.scalar(
        db.select(
            LearningProgress
        )
        .where(
            LearningProgress.user_id
            == user.id,

            LearningProgress.course_id
            == course_id,
        )
    )

    if not row:
        row = LearningProgress(
            user_id=
                user.id,

            course_id=
                course_id,
        )

        db.session.add(
            row
        )

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    simple = {
        "progress":
            "progress",
        "watchedSeconds":
            "watched_seconds",
        "watchedDate":
            "watched_date",
        "bookmarked":
            "bookmarked",
        "completedChecklist":
            "completed_checklist",
        "quizResult":
            "quiz_result",
        "notes":
            "notes",
        "noteColor":
            "note_color",
    }

    for key, attr in simple.items():
        if key in data:
            setattr(
                row,
                attr,
                data[
                    key
                ],
            )

    now = utc_now()

    if data.get(
        "markViewed"
    ):
        row.last_viewed_at = now

    if data.get(
        "markWatched"
    ):
        row.last_watched_at = now

        if not row.first_watched_at:
            row.first_watched_at = now

    if "bookmarked" in data:
        if bool(
            data[
                "bookmarked"
            ]
        ):
            row.saved_at = now
            row.unsaved_at = None
        else:
            row.unsaved_at = now

    if data.get(
        "completed"
    ):
        row.completed_at = now

    extra = dict(
        row.progress_data
        or {}
    )

    known = set(
        simple.keys()
    ) | {
        "markViewed",
        "markWatched",
        "completed",
    }

    for key, value in data.items():
        if key not in known:
            extra[
                key
            ] = value

    row.progress_data = extra
    row.updated_at = now

    db.session.commit()

    return jsonify({
        "success": True,
        "progress":
            serialize_progress(
                row
            ),
    }), 200


@course_bp.post(
    "/<int:course_id>/view"
)
@auth_required
def add_view(
    course_id,
):
    user = current_user()

    existing = db.session.scalar(
        db.select(
            CourseView
        )
        .where(
            CourseView.course_id
            == course_id,

            CourseView.user_id
            == user.id,
        )
    )

    created = False

    if not existing:
        existing = CourseView(
            course_id=
                course_id,

            user_id=
                user.id,

            view_data={},
        )

        db.session.add(
            existing
        )

        course = db.session.get(
            Course,
            course_id,
        )

        if course:
            course.views = (
                int(
                    course.views
                    or 0
                )
                + 1
            )

        created = True

    db.session.commit()

    return jsonify({
        "success": True,
        "created":
            created,
        "viewId":
            str(
                existing.id
            ),
    }), 200


@course_bp.get(
    "/<int:course_id>/ratings"
)
@auth_required
def get_ratings(
    course_id,
):
    rows = (
        db.session.execute(
            db.select(
                CourseRating
            )
            .where(
                CourseRating.course_id
                == course_id
            )
            .order_by(
                CourseRating.created_at.desc()
            )
        )
        .scalars()
        .all()
    )

    return jsonify({
        "success": True,
        "ratings": [
            {
                "id":
                    str(row.id),

                "userId":
                    str(row.user_id),

                "courseId":
                    str(row.course_id),

                "rating":
                    float(row.rating),

                "createdAt":
                    as_iso(
                        row.created_at
                    ),

                "updatedAt":
                    as_iso(
                        row.updated_at
                    ),
            }
            for row in rows
        ],
        "count":
            len(rows),
    }), 200


@course_bp.post(
    "/<int:course_id>/ratings"
)
@auth_required
def set_rating(
    course_id,
):
    user = current_user()

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    value = float(
        data.get(
            "rating"
        )
        or 0
    )

    if (
        value
        < 1
        or value
        > 5
    ):
        return jsonify({
            "success": False,
            "error":
                "Rating phải từ 1 đến 5.",
        }), 400

    row = db.session.scalar(
        db.select(
            CourseRating
        )
        .where(
            CourseRating.course_id
            == course_id,

            CourseRating.user_id
            == user.id,
        )
    )

    if not row:
        row = CourseRating(
            course_id=
                course_id,

            user_id=
                user.id,

            rating=
                value,
        )

        db.session.add(
            row
        )
    else:
        row.rating = value
        row.updated_at = utc_now()

    db.session.flush()

    stats = db.session.execute(
        db.select(
            db.func.coalesce(
                db.func.sum(
                    CourseRating.rating
                ),
                0,
            ),
            db.func.count(
                CourseRating.id
            ),
        )
        .where(
            CourseRating.course_id
            == course_id
        )
    ).one()

    total = float(
        stats[0]
        or 0
    )

    count = int(
        stats[1]
        or 0
    )

    course = db.session.get(
        Course,
        course_id,
    )

    if course:
        course.rating_total = total
        course.rating_count = count
        course.rating = (
            total / count
            if count
            else 0
        )

    db.session.commit()

    return jsonify({
        "success": True,
        "rating":
            value,
        "ratingTotal":
            total,
        "ratingCount":
            count,
        "average":
            (
                total / count
                if count
                else 0
            ),
    }), 200


@course_bp.get(
    "/<int:course_id>/questions"
)
@auth_required
def get_questions(
    course_id,
):
    rows = (
        db.session.execute(
            db.select(
                CourseQuestion
            )
            .where(
                CourseQuestion.course_id
                == course_id
            )
            .order_by(
                CourseQuestion.created_at.asc()
            )
        )
        .scalars()
        .all()
    )

    question_ids = {
        row.id
        for row in rows
    }

    replies = (
        db.session.execute(
            db.select(
                CourseQuestionReply
            )
            .where(
                CourseQuestionReply.question_id
                .in_(
                    question_ids
                )
            )
            .order_by(
                CourseQuestionReply.created_at.asc()
            )
        )
        .scalars()
        .all()
        if question_ids
        else []
    )

    by_question = {}

    for reply in replies:
        by_question.setdefault(
            reply.question_id,
            [],
        ).append(
            serialize_reply(
                reply
            )
        )

    items = [
        serialize_question(
            row,
            by_question.get(
                row.id,
                [],
            ),
        )
        for row in rows
    ]

    return jsonify({
        "success": True,
        "questions":
            items,
        "count":
            len(items),
    }), 200


@course_bp.post(
    "/<int:course_id>/questions"
)
@auth_required
def create_question(
    course_id,
):
    user = current_user()

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    content = str(
        data.get(
            "content"
        )
        or ""
    ).strip()

    if not content:
        return jsonify({
            "success": False,
            "error":
                "Nội dung câu hỏi trống.",
        }), 400

    row = CourseQuestion(
        course_id=
            course_id,

        user_id=
            user.id,

        user_name=
            user.full_name
            or "",

        user_avatar=
            (
                user.profile_data
                or {}
            ).get(
                "photoURL",
                "",
            ),

        user_role=
            role(user)
            .lower(),

        content=
            content,

        is_admin=
            is_admin(
                user
            ),

        question_data=
            dict(
                data.get(
                    "data"
                )
                or {}
            ),
    )

    db.session.add(
        row
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "question":
            serialize_question(
                row,
                [],
            ),
    }), 201


@course_bp.patch(
    "/<int:course_id>/questions/<int:question_id>"
)
@auth_required
def update_question(
    course_id,
    question_id,
):
    user = current_user()

    row = db.session.get(
        CourseQuestion,
        question_id,
    )

    if (
        not row
        or int(
            row.course_id
        )
        != int(
            course_id
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Bình luận không tồn tại.",
        }), 404

    if (
        not is_admin(
            user
        )
        and int(
            row.user_id
        )
        != int(
            user.id
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    if "content" in data:
        row.content = str(
            data.get(
                "content"
            )
            or ""
        ).strip()

        row.edited_at = (
            utc_now()
        )

    extra = dict(
        row.question_data
        or {}
    )

    if "data" in data:
        extra.update(
            data.get(
                "data"
            )
            or {}
        )

    row.question_data = extra
    row.updated_at = utc_now()

    db.session.commit()

    return jsonify({
        "success": True,
        "question":
            serialize_question(
                row,
                [],
            ),
    }), 200


@course_bp.delete(
    "/<int:course_id>/questions/<int:question_id>"
)
@auth_required
def delete_question(
    course_id,
    question_id,
):
    user = current_user()

    row = db.session.get(
        CourseQuestion,
        question_id,
    )

    if (
        not row
        or int(
            row.course_id
        )
        != int(
            course_id
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Bình luận không tồn tại.",
        }), 404

    if (
        not is_admin(
            user
        )
        and int(
            row.user_id
        )
        != int(
            user.id
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    db.session.delete(
        row
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "questionId":
            str(
                question_id
            ),
    }), 200


@course_bp.post(
    "/<int:course_id>/questions/<int:question_id>/replies"
)
@auth_required
def create_reply(
    course_id,
    question_id,
):
    user = current_user()

    question = db.session.get(
        CourseQuestion,
        question_id,
    )

    if (
        not question
        or int(
            question.course_id
        )
        != int(
            course_id
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Bình luận không tồn tại.",
        }), 404

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    content = str(
        data.get(
            "content"
        )
        or ""
    ).strip()

    if not content:
        return jsonify({
            "success": False,
            "error":
                "Nội dung phản hồi trống.",
        }), 400

    course = db.session.get(
        Course,
        course_id,
    )

    row = CourseQuestionReply(
        question_id=
            question_id,

        user_id=
            user.id,

        user_name=
            user.full_name
            or "",

        user_avatar=
            (
                user.profile_data
                or {}
            ).get(
                "photoURL",
                "",
            ),

        user_role=
            role(user)
            .lower(),

        content=
            content,

        is_admin=
            is_admin(
                user
            ),

        is_teacher_reply=
            bool(
                course
                and int(
                    course.teacher_id
                )
                == int(
                    user.id
                )
            ),

        reply_data=
            dict(
                data.get(
                    "data"
                )
                or {}
            ),
    )

    db.session.add(
        row
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "reply":
            serialize_reply(
                row
            ),
    }), 201


@course_bp.delete(
    "/<int:course_id>/questions/<int:question_id>/replies/<int:reply_id>"
)
@auth_required
def delete_reply(
    course_id,
    question_id,
    reply_id,
):
    user = current_user()

    question = db.session.get(
        CourseQuestion,
        question_id,
    )

    if (
        not question
        or int(
            question.course_id
        )
        != int(
            course_id
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Bình luận không tồn tại.",
        }), 404

    reply = db.session.get(
        CourseQuestionReply,
        reply_id,
    )

    if (
        not reply
        or int(
            reply.question_id
        )
        != int(
            question_id
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Phản hồi không tồn tại.",
        }), 404

    if (
        not is_admin(
            user
        )
        and int(
            reply.user_id
        )
        != int(
            user.id
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    db.session.delete(
        reply
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "replyId":
            str(
                reply_id
            ),
    }), 200


@learning_bp.patch(
    "/users/<int:user_id>"
)
@auth_required
def update_learning_user(
    user_id,
):
    actor = current_user()

    target = db.session.get(
        User,
        user_id,
    )

    if not target:
        return jsonify({
            "success": False,
            "error":
                "User not found",
        }), 404

    if (
        int(actor.id) != int(target.id)
        and not is_admin(
            actor
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    profile = dict(
        target.profile_data
        or {}
    )

    direct_mapping = {
        "fullName":
            "full_name",
        "full_name":
            "full_name",
        "grade":
            "grade",
        "className":
            "class_name",
        "class_name":
            "class_name",
    }

    for key, attr in direct_mapping.items():
        if key in data:
            value = (
                str(
                    data.get(
                        key
                    )
                    or ""
                ).strip()
                or None
            )

            setattr(
                target,
                attr,
                value,
            )

    protected = {
        "id",
        "email",
        "role",
        "password",
        "password_hash",
        "authProvider",
        "auth_provider",
        "googleSub",
        "google_sub",
    }

    direct_keys = set(
        direct_mapping.keys()
    )

    for key, value in data.items():
        if (
            key in protected
            or key in direct_keys
        ):
            continue

        profile[
            key
        ] = value

    target.profile_data = (
        profile
    )
    target.updated_at = utc_now()

    db.session.commit()

    result = (
        target.to_dict()
        if hasattr(
            target,
            "to_dict",
        )
        else {
            "id":
                str(target.id),

            "email":
                target.email,

            "fullName":
                target.full_name
                or "",

            "role":
                target.role,

            **profile,
        }
    )

    return jsonify({
        "success": True,
        "user":
            result,
    }), 200


@learning_bp.get(
    "/saved-lists"
)
@auth_required
def list_saved_lists():
    user = current_user()

    rows = (
        db.session.execute(
            db.select(
                CourseSavedList
            )
            .where(
                CourseSavedList.owner_id
                == user.id
            )
            .order_by(
                CourseSavedList.created_at.desc()
            )
        )
        .scalars()
        .all()
    )

    list_ids = {
        row.id
        for row in rows
    }

    items = (
        db.session.execute(
            db.select(
                CourseSavedListItem
            )
            .where(
                CourseSavedListItem.saved_list_id
                .in_(
                    list_ids
                )
            )
            .order_by(
                CourseSavedListItem.position.asc()
            )
        )
        .scalars()
        .all()
        if list_ids
        else []
    )

    by_list = {}

    for item in items:
        by_list.setdefault(
            item.saved_list_id,
            [],
        ).append(
            str(
                item.course_id
            )
        )

    result = []

    for row in rows:
        data = dict(
            row.list_data
            or {}
        )

        data.update({
            "id":
                str(
                    row.id
                ),

            "ownerId":
                str(
                    row.owner_id
                ),

            "title":
                row.title,

            "description":
                row.description
                or "",

            "thumbnail":
                row.thumbnail
                or "",

            "thumbnailFileName":
                row.thumbnail_file_name
                or "",

            "courseIds":
                by_list.get(
                    row.id,
                    [],
                ),

            "createdAt":
                as_iso(
                    row.created_at
                ),

            "updatedAt":
                as_iso(
                    row.updated_at
                ),
        })

        result.append(
            data
        )

    return jsonify({
        "success": True,
        "lists":
            result,
        "count":
            len(result),
    }), 200


@learning_bp.post(
    "/saved-lists"
)
@auth_required
def create_saved_list():
    user = current_user()

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    title = str(
        data.get(
            "title"
        )
        or ""
    ).strip()

    if not title:
        return jsonify({
            "success": False,
            "error":
                "Tên danh sách trống.",
        }), 400

    row = CourseSavedList(
        owner_id=
            user.id,

        title=
            title,

        description=
            str(
                data.get(
                    "description"
                )
                or ""
            ),

        thumbnail=
            str(
                data.get(
                    "thumbnail"
                )
                or ""
            )
            or None,

        thumbnail_file_name=
            str(
                data.get(
                    "thumbnailFileName"
                )
                or ""
            )
            or None,

        list_data=
            dict(
                data.get(
                    "data"
                )
                or {}
            ),
    )

    db.session.add(
        row
    )

    db.session.flush()

    for index, course_id in enumerate(
        data.get(
            "courseIds"
        )
        or []
    ):
        if str(
            course_id
        ).isdigit():
            db.session.add(
                CourseSavedListItem(
                    saved_list_id=
                        row.id,

                    course_id=
                        int(
                            course_id
                        ),

                    position=
                        index,
                )
            )

    db.session.commit()

    return jsonify({
        "success": True,
        "listId":
            str(
                row.id
            ),
    }), 201


@learning_bp.patch(
    "/saved-lists/<int:list_id>"
)
@auth_required
def update_saved_list(
    list_id,
):
    user = current_user()

    row = db.session.get(
        CourseSavedList,
        list_id,
    )

    if not row:
        return jsonify({
            "success": False,
            "error":
                "Danh sách lưu không tồn tại.",
        }), 404

    if int(row.owner_id) != int(user.id):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    if "title" in data:
        title = str(
            data.get(
                "title"
            )
            or ""
        ).strip()

        if not title:
            return jsonify({
                "success": False,
                "error":
                    "Tên danh sách trống.",
            }), 400

        row.title = title

    if "description" in data:
        row.description = str(
            data.get(
                "description"
            )
            or ""
        )

    if "thumbnail" in data:
        row.thumbnail = (
            str(
                data.get(
                    "thumbnail"
                )
                or ""
            )
            or None
        )

    if "thumbnailFileName" in data:
        row.thumbnail_file_name = (
            str(
                data.get(
                    "thumbnailFileName"
                )
                or ""
            )
            or None
        )

    if "data" in data:
        list_data = dict(
            row.list_data
            or {}
        )

        list_data.update(
            data.get(
                "data"
            )
            or {}
        )

        row.list_data = list_data

    if "courseIds" in data:
        normalized = []
        seen = set()

        for raw_id in (
            data.get(
                "courseIds"
            )
            or []
        ):
            course_id = positive_int(
                raw_id
            )

            if (
                not course_id
                or course_id in seen
            ):
                continue

            if not db.session.get(
                Course,
                course_id,
            ):
                continue

            seen.add(
                course_id
            )
            normalized.append(
                course_id
            )

        db.session.query(
            CourseSavedListItem
        ).filter(
            CourseSavedListItem.saved_list_id
            == row.id
        ).delete(
            synchronize_session=False
        )

        for position, course_id in enumerate(
            normalized
        ):
            db.session.add(
                CourseSavedListItem(
                    saved_list_id=
                        row.id,

                    course_id=
                        course_id,

                    position=
                        position,
                )
            )

    row.updated_at = utc_now()

    db.session.commit()

    items = (
        db.session.execute(
            db.select(
                CourseSavedListItem
            )
            .where(
                CourseSavedListItem.saved_list_id
                == row.id
            )
            .order_by(
                CourseSavedListItem.position.asc()
            )
        )
        .scalars()
        .all()
    )

    return jsonify({
        "success": True,
        "list":
            serialize_saved_list(
                row,
                [
                    item.course_id
                    for item in items
                ],
            ),
    }), 200


@learning_bp.delete(
    "/saved-lists/<int:list_id>"
)
@auth_required
def delete_saved_list(
    list_id,
):
    user = current_user()

    row = db.session.get(
        CourseSavedList,
        list_id,
    )

    if not row:
        return jsonify({
            "success": False,
            "error":
                "Danh sách lưu không tồn tại.",
        }), 404

    if int(row.owner_id) != int(user.id):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    db.session.query(
        CourseSavedListItem
    ).filter(
        CourseSavedListItem.saved_list_id
        == row.id
    ).delete(
        synchronize_session=False
    )

    db.session.delete(
        row
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "listId":
            str(list_id),
    }), 200


@learning_bp.post(
    "/saved-lists/<int:list_id>/share"
)
@auth_required
def share_saved_list(
    list_id,
):
    user = current_user()

    row = db.session.get(
        CourseSavedList,
        list_id,
    )

    if not row:
        return jsonify({
            "success": False,
            "error":
                "Danh sách lưu không tồn tại.",
        }), 404

    if int(row.owner_id) != int(user.id):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    data = dict(
        row.list_data
        or {}
    )

    share_code = str(
        data.get(
            "shareCode"
        )
        or ""
    ).strip().upper()

    if len(share_code) != 6:
        share_code = (
            build_share_code()
        )

    data["shareCode"] = (
        share_code
    )
    data["shareEnabled"] = True
    data["shareEnabledAt"] = (
        as_iso(
            utc_now()
        )
    )

    row.list_data = data
    row.updated_at = utc_now()

    db.session.commit()

    items = (
        db.session.execute(
            db.select(
                CourseSavedListItem
            )
            .where(
                CourseSavedListItem.saved_list_id
                == row.id
            )
            .order_by(
                CourseSavedListItem.position.asc()
            )
        )
        .scalars()
        .all()
    )

    return jsonify({
        "success": True,
        "shareCode":
            share_code,
        "list":
            serialize_saved_list(
                row,
                [
                    item.course_id
                    for item in items
                ],
            ),
    }), 200


@learning_bp.post(
    "/saved-lists/import"
)
@auth_required
def import_saved_list():
    user = current_user()

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    code = str(
        data.get(
            "code"
        )
        or ""
    ).strip().upper()

    if len(code) != 6:
        return jsonify({
            "success": False,
            "error":
                "Mã chia sẻ phải gồm 6 ký tự.",
        }), 400

    source = None

    rows = (
        db.session.execute(
            db.select(
                CourseSavedList
            )
        )
        .scalars()
        .all()
    )

    for row in rows:
        row_data = dict(
            row.list_data
            or {}
        )

        if (
            bool(
                row_data.get(
                    "shareEnabled"
                )
            )
            and str(
                row_data.get(
                    "shareCode"
                )
                or ""
            ).strip().upper()
            == code
        ):
            source = row
            break

    if not source:
        return jsonify({
            "success": False,
            "error":
                "Không tìm thấy danh sách với mã chia sẻ này.",
        }), 404

    if int(source.owner_id) == int(user.id):
        return jsonify({
            "success": False,
            "error":
                "Không thể nhập danh sách của chính bạn.",
        }), 409

    existing_rows = (
        db.session.execute(
            db.select(
                CourseSavedList
            )
            .where(
                CourseSavedList.owner_id
                == user.id
            )
        )
        .scalars()
        .all()
    )

    for existing in existing_rows:
        existing_data = dict(
            existing.list_data
            or {}
        )

        if (
            str(
                existing_data.get(
                    "importedFromListId"
                )
                or ""
            )
            == str(source.id)
        ):
            return jsonify({
                "success": False,
                "error":
                    "Bạn đã lưu danh sách này rồi.",
            }), 409

    source_items = (
        db.session.execute(
            db.select(
                CourseSavedListItem
            )
            .where(
                CourseSavedListItem.saved_list_id
                == source.id
            )
            .order_by(
                CourseSavedListItem.position.asc()
            )
        )
        .scalars()
        .all()
    )

    source_data = dict(
        source.list_data
        or {}
    )

    imported_data = {
        "importedFromListId":
            str(source.id),

        "importedFromOwnerId":
            str(source.owner_id),

        "importedShareCode":
            code,

        "importedAt":
            as_iso(
                utc_now()
            ),
    }

    row = CourseSavedList(
        owner_id=
            user.id,

        title=
            source.title,

        description=
            source.description,

        thumbnail=
            source.thumbnail,

        thumbnail_file_name=
            source.thumbnail_file_name,

        list_data=
            imported_data,
    )

    db.session.add(
        row
    )

    db.session.flush()

    for position, item in enumerate(
        source_items
    ):
        if db.session.get(
            Course,
            item.course_id,
        ):
            db.session.add(
                CourseSavedListItem(
                    saved_list_id=
                        row.id,

                    course_id=
                        item.course_id,

                    position=
                        position,
                )
            )

    source_data[
        "sharedSaveCount"
    ] = (
        int(
            source_data.get(
                "sharedSaveCount"
            )
            or 0
        )
        + 1
    )

    source.list_data = (
        source_data
    )
    source.updated_at = utc_now()

    db.session.commit()

    return jsonify({
        "success": True,
        "listId":
            str(row.id),
        "sourceListId":
            str(source.id),
    }), 201


@learning_bp.get(
    "/playlists"
)
@auth_required
def list_playlists():
    rows = (
        db.session.execute(
            db.select(
                CoursePlaylist
            )
            .order_by(
                CoursePlaylist.created_at.desc()
            )
        )
        .scalars()
        .all()
    )

    items = []

    for row in rows:
        data = dict(
            row.playlist_data
            or {}
        )

        data.update({
            "id":
                str(row.id),

            "ownerId":
                str(
                    row.owner_id
                ),

            "title":
                row.title,

            "description":
                row.description
                or "",

            "thumbnail":
                row.thumbnail
                or "",

            "thumbnailFileName":
                row.thumbnail_file_name
                or "",

            "courseIds":
                [
                    str(item)
                    for item in (
                        row.course_ids
                        or []
                    )
                ],

            "createdAt":
                as_iso(
                    row.created_at
                ),

            "updatedAt":
                as_iso(
                    row.updated_at
                ),
        })

        items.append(
            data
        )

    return jsonify({
        "success": True,
        "playlists":
            items,
        "count":
            len(items),
    }), 200


@learning_bp.post(
    "/playlists"
)
@auth_required
def create_playlist():
    user = current_user()

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    title = str(
        data.get(
            "title"
        )
        or ""
    ).strip()

    if not title:
        return jsonify({
            "success": False,
            "error":
                "Tên bộ sưu tập trống.",
        }), 400

    row = CoursePlaylist(
        owner_id=
            user.id,

        title=
            title,

        description=
            str(
                data.get(
                    "description"
                )
                or ""
            ),

        thumbnail=
            str(
                data.get(
                    "thumbnail"
                )
                or ""
            )
            or None,

        thumbnail_file_name=
            str(
                data.get(
                    "thumbnailFileName"
                )
                or ""
            )
            or None,

        course_ids=[
            str(item)
            for item in (
                data.get(
                    "courseIds"
                )
                or []
            )
        ],

        playlist_data=
            dict(
                data.get(
                    "data"
                )
                or {}
            ),
    )

    db.session.add(
        row
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "playlist": {
            "id":
                str(row.id),

            "ownerId":
                str(row.owner_id),

            "title":
                row.title,

            "courseIds":
                row.course_ids
                or [],
        },
    }), 201


@learning_bp.patch(
    "/playlists/<int:playlist_id>"
)
@auth_required
def update_playlist(
    playlist_id,
):
    user = current_user()

    row = db.session.get(
        CoursePlaylist,
        playlist_id,
    )

    if not row:
        return jsonify({
            "success": False,
            "error":
                "Danh sách phát không tồn tại.",
        }), 404

    if int(row.owner_id) != int(user.id):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    if "title" in data:
        title = str(
            data.get(
                "title"
            )
            or ""
        ).strip()

        if not title:
            return jsonify({
                "success": False,
                "error":
                    "Tên bộ sưu tập trống.",
            }), 400

        row.title = title

    if "description" in data:
        row.description = str(
            data.get(
                "description"
            )
            or ""
        )

    if "thumbnail" in data:
        row.thumbnail = (
            str(
                data.get(
                    "thumbnail"
                )
                or ""
            )
            or None
        )

    if "thumbnailFileName" in data:
        row.thumbnail_file_name = (
            str(
                data.get(
                    "thumbnailFileName"
                )
                or ""
            )
            or None
        )

    if "courseIds" in data:
        seen = set()
        course_ids = []

        for raw_id in (
            data.get(
                "courseIds"
            )
            or []
        ):
            course_id = positive_int(
                raw_id
            )

            if (
                not course_id
                or course_id in seen
            ):
                continue

            if not db.session.get(
                Course,
                course_id,
            ):
                continue

            seen.add(
                course_id
            )
            course_ids.append(
                str(course_id)
            )

        row.course_ids = (
            course_ids
        )

    if "data" in data:
        extra = dict(
            row.playlist_data
            or {}
        )

        extra.update(
            data.get(
                "data"
            )
            or {}
        )

        row.playlist_data = (
            extra
        )

    row.updated_at = utc_now()

    db.session.commit()

    return jsonify({
        "success": True,
        "playlist":
            serialize_playlist(
                row
            ),
    }), 200


@learning_bp.delete(
    "/playlists/<int:playlist_id>"
)
@auth_required
def delete_playlist(
    playlist_id,
):
    user = current_user()

    row = db.session.get(
        CoursePlaylist,
        playlist_id,
    )

    if not row:
        return jsonify({
            "success": False,
            "error":
                "Danh sách phát không tồn tại.",
        }), 404

    if int(row.owner_id) != int(user.id):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    db.session.delete(
        row
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "playlistId":
            str(playlist_id),
    }), 200


@learning_bp.get(
    "/following"
)
@auth_required
def get_following():
    user = current_user()

    rows = (
        db.session.execute(
            db.select(
                UserFollow
            )
            .where(
                UserFollow.follower_id
                == user.id,

                UserFollow.active
                .is_(True),
            )
        )
        .scalars()
        .all()
    )

    return jsonify({
        "success": True,
        "following": [
            {
                "id":
                    str(row.id),

                "targetUserId":
                    str(
                        row.target_user_id
                    ),

                "followedAt":
                    as_iso(
                        row.followed_at
                    ),

                "lastOpenedAt":
                    as_iso(
                        row.last_opened_at
                    ),
            }
            for row in rows
        ],
        "count":
            len(rows),
    }), 200


@learning_bp.post(
    "/following/<int:target_user_id>"
)
@auth_required
def toggle_follow(
    target_user_id,
):
    user = current_user()

    if (
        int(
            user.id
        )
        == int(
            target_user_id
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Không thể tự theo dõi chính mình.",
        }), 409

    row = db.session.scalar(
        db.select(
            UserFollow
        )
        .where(
            UserFollow.follower_id
            == user.id,

            UserFollow.target_user_id
            == target_user_id,
        )
    )

    now = utc_now()

    if not row:
        row = UserFollow(
            follower_id=
                user.id,

            target_user_id=
                target_user_id,

            active=True,

            followed_at=
                now,

            last_opened_at=
                now,
        )

        db.session.add(
            row
        )

        active = True

    else:
        row.active = (
            not bool(
                row.active
            )
        )

        active = bool(
            row.active
        )

        if active:
            row.followed_at = now
            row.unfollowed_at = None
        else:
            row.unfollowed_at = now

        row.updated_at = now

    db.session.commit()

    return jsonify({
        "success": True,
        "following":
            active,
    }), 200


@learning_bp.patch(
    "/following/<int:target_user_id>"
)
@auth_required
def update_follow(
    target_user_id,
):
    user = current_user()

    row = db.session.scalar(
        db.select(
            UserFollow
        )
        .where(
            UserFollow.follower_id
            == user.id,

            UserFollow.target_user_id
            == target_user_id,

            UserFollow.active
            .is_(True),
        )
    )

    if not row:
        return jsonify({
            "success": False,
            "error":
                "Quan hệ theo dõi không tồn tại.",
        }), 404

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    now = utc_now()

    if data.get(
        "lastOpened"
    ):
        row.last_opened_at = (
            now
        )

    extra = dict(
        row.follow_data
        or {}
    )

    if "data" in data:
        extra.update(
            data.get(
                "data"
            )
            or {}
        )

    row.follow_data = extra
    row.updated_at = now

    db.session.commit()

    return jsonify({
        "success": True,
        "targetUserId":
            str(target_user_id),
        "following": True,
        "lastOpenedAt":
            as_iso(
                row.last_opened_at
            ),
    }), 200


@learning_bp.get(
    "/notifications"
)
@auth_required
def get_notifications():
    user = current_user()

    rows = (
        db.session.execute(
            db.select(
                ELearningNotification
            )
            .where(
                ELearningNotification.user_id
                == user.id
            )
            .order_by(
                ELearningNotification.created_at.desc()
            )
            .limit(
                300
            )
        )
        .scalars()
        .all()
    )

    items = []

    for row in rows:
        data = dict(
            row.notification_data
            or {}
        )

        data.update({
            "id":
                str(row.id),

            "legacyId":
                row.legacy_id
                or "",

            "userId":
                str(row.user_id),

            "type":
                row.type,

            "title":
                row.title
                or "",

            "message":
                row.message
                or "",

            "read":
                bool(row.read),

            "readAt":
                as_iso(
                    row.read_at
                ),

            "dismissed":
                bool(
                    row.dismissed
                ),

            "dismissedAt":
                as_iso(
                    row.dismissed_at
                ),

            "createdAt":
                as_iso(
                    row.created_at
                ),
        })

        items.append(
            data
        )

    return jsonify({
        "success": True,
        "notifications":
            items,
        "count":
            len(items),
    }), 200


@learning_bp.post(
    "/notifications"
)
@auth_required
def create_notification():
    actor = current_user()

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    user_id = int(
        data.get(
            "userId"
        )
        or actor.id
    )

    if (
        user_id
        != int(
            actor.id
        )
        and not is_admin(
            actor
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    row = ELearningNotification(
        legacy_id=
            str(
                data.get(
                    "legacyId"
                )
                or ""
            )
            or None,

        user_id=
            user_id,

        type=
            str(
                data.get(
                    "type"
                )
                or "info"
            ),

        title=
            str(
                data.get(
                    "title"
                )
                or ""
            )
            or None,

        message=
            str(
                data.get(
                    "message"
                )
                or ""
            ),

        notification_data=
            dict(
                data.get(
                    "data"
                )
                or {}
            ),
    )

    db.session.add(
        row
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "notificationId":
            str(
                row.id
            ),
    }), 201


@learning_bp.patch(
    "/notifications/<int:notification_id>"
)
@auth_required
def update_notification(
    notification_id,
):
    user = current_user()

    row = db.session.get(
        ELearningNotification,
        notification_id,
    )

    if (
        not row
        or int(
            row.user_id
        )
        != int(
            user.id
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Thông báo không tồn tại.",
        }), 404

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    now = utc_now()

    if "read" in data:
        row.read = bool(
            data[
                "read"
            ]
        )

        row.read_at = (
            now
            if row.read
            else None
        )

    if "dismissed" in data:
        row.dismissed = bool(
            data[
                "dismissed"
            ]
        )

        row.dismissed_at = (
            now
            if row.dismissed
            else None
        )

    row.updated_at = now

    db.session.commit()

    return jsonify({
        "success": True,
    }), 200


@learning_bp.get(
    "/comment-warnings"
)
@auth_required
def get_comment_warnings():
    user = current_user()

    rows = (
        db.session.execute(
            db.select(
                CommentWarning
            )
            .where(
                CommentWarning.user_id
                == user.id
            )
            .order_by(
                CommentWarning.created_at.desc()
            )
        )
        .scalars()
        .all()
    )

    return jsonify({
        "success": True,
        "warnings": [
            {
                "id":
                    str(row.id),

                "userId":
                    str(row.user_id),

                "issuedBy":
                    str(
                        row.issued_by
                    ),

                "courseId":
                    (
                        str(
                            row.course_id
                        )
                        if row.course_id
                        else ""
                    ),

                "questionId":
                    (
                        str(
                            row.question_id
                        )
                        if row.question_id
                        else ""
                    ),

                "replyId":
                    (
                        str(
                            row.reply_id
                        )
                        if row.reply_id
                        else ""
                    ),

                "reason":
                    row.reason,

                "detail":
                    row.detail
                    or "",

                "status":
                    row.status,

                "acknowledgedAt":
                    as_iso(
                        row.acknowledged_at
                    ),

                "createdAt":
                    as_iso(
                        row.created_at
                    ),
            }
            for row in rows
        ],
        "count":
            len(rows),
    }), 200


@learning_bp.post(
    "/comment-warnings"
)
@auth_required
def create_comment_warning():
    actor = current_user()

    if not is_admin(
        actor
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    user_id = positive_int(
        data.get(
            "userId"
        )
        or data.get(
            "reportedUserId"
        )
        or data.get(
            "commentUserId"
        )
    )

    if not user_id:
        return jsonify({
            "success": False,
            "error":
                "Thiếu userId.",
        }), 400

    target = db.session.get(
        User,
        user_id,
    )

    if not target:
        return jsonify({
            "success": False,
            "error":
                "User not found",
        }), 404

    reason = str(
        data.get(
            "reason"
        )
        or ""
    ).strip()

    if not reason:
        return jsonify({
            "success": False,
            "error":
                "Lý do cảnh báo trống.",
        }), 400

    course_id = positive_int(
        data.get(
            "courseId"
        )
    )

    question_id = positive_int(
        data.get(
            "questionId"
        )
    )

    reply_id = positive_int(
        data.get(
            "replyId"
        )
    )

    known = {
        "userId",
        "reportedUserId",
        "commentUserId",
        "courseId",
        "questionId",
        "replyId",
        "reason",
        "detail",
        "status",
    }

    warning_data = {
        key: value
        for key, value
        in data.items()
        if key not in known
    }

    row = CommentWarning(
        user_id=
            user_id,

        issued_by=
            actor.id,

        course_id=
            course_id,

        question_id=
            question_id,

        reply_id=
            reply_id,

        reason=
            reason,

        detail=
            str(
                data.get(
                    "detail"
                )
                or ""
            ),

        status=
            str(
                data.get(
                    "status"
                )
                or "pending"
            ),

        warning_data=
            warning_data,
    )

    db.session.add(
        row
    )

    db.session.flush()

    warning_count = (
        db.session.scalar(
            db.select(
                db.func.count(
                    CommentWarning.id
                )
            )
            .where(
                CommentWarning.user_id
                == user_id
            )
        )
        or 0
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "warningId":
            str(row.id),
        "warningCount":
            int(
                warning_count
            ),
    }), 201


@learning_bp.patch(
    "/comment-warnings/<int:warning_id>"
)
@auth_required
def acknowledge_warning(
    warning_id,
):
    user = current_user()

    row = db.session.get(
        CommentWarning,
        warning_id,
    )

    if (
        not row
        or int(
            row.user_id
        )
        != int(
            user.id
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Cảnh báo không tồn tại.",
        }), 404

    row.status = (
        "acknowledged"
    )
    row.acknowledged_at = (
        utc_now()
    )
    row.updated_at = (
        utc_now()
    )

    db.session.commit()

    return jsonify({
        "success": True,
    }), 200


@learning_bp.post(
    "/comment-reports"
)
@auth_required
def create_comment_report():
    user = current_user()

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    course_id = (
        int(
            data[
                "courseId"
            ]
        )
        if str(
            data.get(
                "courseId"
            )
            or ""
        ).isdigit()
        else None
    )

    question_id = (
        int(
            data[
                "questionId"
            ]
        )
        if str(
            data.get(
                "questionId"
            )
            or ""
        ).isdigit()
        else None
    )

    reply_id = (
        int(
            data[
                "replyId"
            ]
        )
        if str(
            data.get(
                "replyId"
            )
            or ""
        ).isdigit()
        else None
    )

    reported_user_id = (
        int(
            data[
                "reportedUserId"
            ]
        )
        if str(
            data.get(
                "reportedUserId"
            )
            or ""
        ).isdigit()
        else None
    )

    reason = str(
        data.get(
            "reason"
        )
        or ""
    ).strip()

    if not reason:
        return jsonify({
            "success": False,
            "error":
                "Lý do báo cáo trống.",
        }), 400

    if (
        not course_id
        or not question_id
    ):
        return jsonify({
            "success": False,
            "error":
                "Thiếu courseId hoặc questionId.",
        }), 400

    duplicate_statement = (
        db.select(
            LearningReport
        )
        .where(
            LearningReport.reporter_id
            == user.id,

            LearningReport.course_id
            == course_id,

            LearningReport.question_id
            == question_id,

            LearningReport.report_type
            == "comment",
        )
    )

    if reply_id:
        duplicate_statement = (
            duplicate_statement.where(
                LearningReport.reply_id
                == reply_id
            )
        )
    else:
        duplicate_statement = (
            duplicate_statement.where(
                LearningReport.reply_id
                .is_(None)
            )
        )

    duplicate = db.session.scalar(
        duplicate_statement
    )

    if duplicate:
        return jsonify({
            "success": False,
            "error":
                "DUPLICATE_REPORT",
            "message":
                "Bạn đã báo cáo nội dung này.",
        }), 409

    last_report = db.session.scalar(
        db.select(
            LearningReport
        )
        .where(
            LearningReport.reporter_id
            == user.id,

            LearningReport.report_type
            == "comment",
        )
        .order_by(
            LearningReport.created_at.desc()
        )
        .limit(
            1
        )
    )

    now = utc_now()

    if (
        last_report
        and last_report.created_at
    ):
        elapsed = (
            now
            - last_report.created_at
        ).total_seconds()

        if elapsed < 10:
            remaining = max(
                1,
                int(
                    10
                    - elapsed
                    + 0.999
                ),
            )

            return jsonify({
                "success": False,
                "error":
                    "REPORT_COOLDOWN",
                "retryAfter":
                    remaining,
                "message":
                    (
                        "Vui lòng chờ trước "
                        "khi gửi báo cáo tiếp."
                    ),
            }), 429

    question = db.session.get(
        CourseQuestion,
        question_id,
    )

    if (
        not question
        or int(
            question.course_id
        )
        != int(
            course_id
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Bình luận không tồn tại.",
        }), 404

    reply = None

    if reply_id:
        reply = db.session.get(
            CourseQuestionReply,
            reply_id,
        )

        if (
            not reply
            or int(
                reply.question_id
            )
            != int(
                question_id
            )
        ):
            return jsonify({
                "success": False,
                "error":
                    "Phản hồi không tồn tại.",
            }), 404

    row = LearningReport(
        report_type=
            "comment",

        reporter_id=
            user.id,

        course_id=
            course_id,

        reported_user_id=
            reported_user_id,

        question_id=
            question_id,

        reply_id=
            reply_id,

        reason=
            reason,

        detail=
            str(
                data.get(
                    "detail"
                )
                or ""
            ),

        status=
            "pending",

        report_data={
            "commentType":
                (
                    "reply"
                    if reply_id
                    else "question"
                ),

            "commentContent":
                str(
                    data.get(
                        "commentContent"
                    )
                    or (
                        reply.content
                        if reply
                        else question.content
                    )
                ),

            "commentUserName":
                str(
                    data.get(
                        "commentUserName"
                    )
                    or (
                        reply.user_name
                        if reply
                        else question.user_name
                    )
                    or ""
                ),

            "reporterName":
                user.full_name
                or "",

            "reporterEmail":
                user.email
                or "",
        },
    )

    db.session.add(
        row
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "reportId":
            str(
                row.id
            ),
    }), 201


@learning_bp.get(
    "/reports"
)
@auth_required
def get_reports():
    user = current_user()

    statement = db.select(
        LearningReport
    )

    if not is_admin(
        user
    ):
        statement = statement.where(
            LearningReport.reporter_id
            == user.id
        )

    rows = (
        db.session.execute(
            statement.order_by(
                LearningReport.created_at.desc()
            )
        )
        .scalars()
        .all()
    )

    return jsonify({
        "success": True,
        "reports": [
            {
                **dict(
                    row.report_data
                    or {}
                ),

                "id":
                    str(row.id),

                "reportType":
                    row.report_type,

                "reporterId":
                    str(
                        row.reporter_id
                    ),

                "courseId":
                    (
                        str(
                            row.course_id
                        )
                        if row.course_id
                        else ""
                    ),

                "reportedUserId":
                    (
                        str(
                            row.reported_user_id
                        )
                        if row.reported_user_id
                        else ""
                    ),

                "questionId":
                    (
                        str(
                            row.question_id
                        )
                        if row.question_id
                        else ""
                    ),

                "replyId":
                    (
                        str(
                            row.reply_id
                        )
                        if row.reply_id
                        else ""
                    ),

                "reason":
                    row.reason,

                "detail":
                    row.detail
                    or "",

                "status":
                    row.status,

                "createdAt":
                    as_iso(
                        row.created_at
                    ),

                "updatedAt":
                    as_iso(
                        row.updated_at
                    ),
            }
            for row in rows
        ],
        "count":
            len(rows),
    }), 200


@learning_bp.post(
    "/reports"
)
@auth_required
def create_report():
    user = current_user()

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    reason = str(
        data.get(
            "reason"
        )
        or ""
    ).strip()

    if not reason:
        return jsonify({
            "success": False,
            "error":
                "Lý do báo cáo trống.",
        }), 400

    row = LearningReport(
        report_type=
            str(
                data.get(
                    "reportType"
                )
                or "course"
            ),

        reporter_id=
            user.id,

        course_id=
            (
                int(
                    data[
                        "courseId"
                    ]
                )
                if str(
                    data.get(
                        "courseId"
                    )
                    or ""
                ).isdigit()
                else None
            ),

        reported_user_id=
            (
                int(
                    data[
                        "reportedUserId"
                    ]
                )
                if str(
                    data.get(
                        "reportedUserId"
                    )
                    or ""
                ).isdigit()
                else None
            ),

        question_id=
            (
                int(
                    data[
                        "questionId"
                    ]
                )
                if str(
                    data.get(
                        "questionId"
                    )
                    or ""
                ).isdigit()
                else None
            ),

        reply_id=
            (
                int(
                    data[
                        "replyId"
                    ]
                )
                if str(
                    data.get(
                        "replyId"
                    )
                    or ""
                ).isdigit()
                else None
            ),

        reason=
            reason,

        detail=
            str(
                data.get(
                    "detail"
                )
                or ""
            ),

        status=
            str(
                data.get(
                    "status"
                )
                or "pending"
            ),

        report_data=
            dict(
                data.get(
                    "data"
                )
                or {}
            ),
    )

    db.session.add(
        row
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "reportId":
            str(
                row.id
            ),
    }), 201


@learning_bp.patch(
    "/reports/<int:report_id>"
)
@auth_required
def update_report(
    report_id,
):
    user = current_user()

    if not is_admin(
        user
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    row = db.session.get(
        LearningReport,
        report_id,
    )

    if not row:
        return jsonify({
            "success": False,
            "error":
                "Báo cáo không tồn tại.",
        }), 404

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    if "status" in data:
        row.status = str(
            data[
                "status"
            ]
            or row.status
        )

    report_data = dict(
        row.report_data
        or {}
    )

    report_data.update(
        data.get(
            "data"
        )
        or {}
    )

    row.report_data = (
        report_data
    )
    row.updated_at = (
        utc_now()
    )

    db.session.commit()

    return jsonify({
        "success": True,
    }), 200

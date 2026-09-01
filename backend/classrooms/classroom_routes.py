import secrets
import string

import math

from flask import (
    Blueprint,
    jsonify,
    request,
)

import time
from datetime import datetime, timezone

from auth import auth_required
from extensions import db
from auth.rate_limiter import rate_limit
from models import (
    Classroom,
    ClassroomMember,
    ClassroomSubject,
    ClassroomAttendance,
    ClassroomAttendanceHistory,
    ClassroomSubjectTest,
    ClassroomScore,
    ClassroomSchedule,
    ClassroomNotification,
    ClassroomMessage,
    ClassroomAssignment,
    ClassroomSubmission,
    User,
)

classroom_bp = Blueprint(
    "classrooms",
    __name__,
    url_prefix="/api/classrooms",
)


# =========================================================
# HELPERS
# =========================================================

def current_user():
    user_id = (
        request.current_user.get(
            "user_id"
        )
        or request.current_user.get(
            "uid"
        )
    )

    if not user_id:
        return None

    return db.session.get(
        User,
        user_id,
    )


def normalize_text(
    value,
):
    return str(
        value
        or ""
    ).strip()

def is_text_within_limit(
    value,
    max_length,
    allow_empty=True,
):
    text = normalize_text(
        value
    )

    if (
        not allow_empty
        and not text
    ):
        return False

    return (
        len(text)
        <= max_length
    )

def normalize_email(
    value,
):
    return normalize_text(
        value
    ).lower()


def is_admin(
    user,
):
    return bool(
        user
        and str(
            user.role
            or ""
        ).upper()
        == "ADMIN_DEV"
    )


def is_teacher(
    user,
):
    return bool(
        user
        and str(
            user.role
            or ""
        ).upper()
        in {
            "TEACHER",
            "ADMIN_DEV",
        }
    )


def serialize_user(
    user,
):
    if not user:
        return None

    if hasattr(
        user,
        "to_dict",
    ):
        return user.to_dict()

    return {
        "id":
            user.id,

        "uid":
            user.id,

        "user_id":
            user.id,

        "email":
            user.email,

        "name":
            user.full_name
            or "",

        "fullName":
            user.full_name
            or "",

        "role":
            user.role,

        "grade":
            user.grade
            or "",

        "className":
            user.class_name
            or "",
    }


def serialize_classroom(
    classroom,
):
    data = dict(
        classroom.class_data
        or {}
    )

    data.update({
        "id":
            str(
                classroom.id
            ),

        "name":
            classroom.name,

        "description":
            classroom.description
            or "",

        "grade":
            classroom.grade
            or "",

        "classCode":
            classroom.class_code
            or "",

        "class_code":
            classroom.class_code
            or "",

        "teacherId":
            (
                str(
                    classroom.teacher_id
                )
                if classroom.teacher_id
                else ""
            ),

        "teacherEmail":
            classroom.teacher_email
            or "",

        "teacherName":
            classroom.teacher_name
            or "",

        "teacherPhotoURL":
            classroom.teacher_photo_url
            or "",

        "teacherGender":
            classroom.teacher_gender
            or "",

        "school":
            classroom.school
            or "",

        "subject":
            classroom.subject
            or "",

        "schoolYear":
            classroom.school_year
            or "",

        "themeColor":
            classroom.theme_color
            or "#2563eb",

        "coverPhotoUrl":
            classroom.cover_photo_url
            or "",

        "logoUrl":
            classroom.logo_url
            or "",

        "status":
            classroom.status
            or "active",

        "studentCount":
            int(
                classroom.student_count
                or 0
            ),

        "memberIds": [
            str(
                item
            )
            for item in (
                classroom.member_ids
                or []
            )
        ],

        "dismissedNotificationSourceKeys":
            list(
                classroom
                .dismissed_notification_source_keys
                or []
            ),

        "scheduleWeekConfigs":
            dict(
                classroom
                .schedule_week_configs
                or {}
            ),

        "scheduleTimeRules":
            dict(
                classroom
                .schedule_time_rules
                or {}
            ),

        "scheduleContentRules":
            dict(
                classroom
                .schedule_content_rules
                or {}
            ),

        "createdAt":
            (
                classroom.created_at
                .isoformat()
                if classroom.created_at
                else None
            ),

        "updatedAt":
            (
                classroom.updated_at
                .isoformat()
                if classroom.updated_at
                else None
            ),
    })

    return data


def serialize_member(
    member,
):
    data = dict(
        member.member_data
        or {}
    )

    data.update({
        "id":
            str(
                member.id
            ),

        "legacyId":
            member.legacy_id
            or "",

        "classId":
            str(
                member.classroom_id
            ),

        "uid":
            (
                str(
                    member.user_id
                )
                if member.user_id
                else ""
            ),

        "userId":
            (
                str(
                    member.user_id
                )
                if member.user_id
                else ""
            ),

        "email":
            member.email
            or "",

        "name":
            member.name
            or "",

        "role":
            member.role
            or "STUDENT",

        "classRole":
            member.class_role
            or "",

        "studentCode":
            member.student_code
            or "",

        "photoURL":
            member.photo_url
            or "",

        "gender":
            member.gender
            or "",

        "birthDate":
            member.birth_date
            or "",

        "phone":
            member.phone
            or "",

        "parentName":
            member.parent_name
            or "",

        "parentPhone":
            member.parent_phone
            or "",

        "parentEmail":
            member.parent_email
            or "",

        "parentRelation":
            member.parent_relation
            or "",

        "medicalNote":
            member.medical_note
            or "",

        "status":
            member.status
            or "active",

        "createdAt":
            (
                member.created_at
                .isoformat()
                if member.created_at
                else None
            ),

        "updatedAt":
            (
                member.updated_at
                .isoformat()
                if member.updated_at
                else None
            ),
    })

    return data


def generate_class_code():
    alphabet = (
        string.ascii_uppercase
        + string.digits
    )

    # Loại các ký tự dễ nhầm.
    alphabet = "".join(
        character
        for character in alphabet
        if character
        not in {
            "0",
            "O",
            "1",
            "I",
        }
    )

    for _ in range(
        64
    ):
        code = "".join(
            secrets.choice(
                alphabet
            )
            for _ in range(
                6
            )
        )

        existing = db.session.scalar(
            db.select(
                Classroom
            )
            .where(
                Classroom.class_code
                == code
            )
        )

        if not existing:
            return code

    raise RuntimeError(
        "Không thể tạo mã lớp duy nhất."
    )


def find_member_for_user(
    classroom_id,
    user,
):
    if not user:
        return None

    row = db.session.scalar(
        db.select(
            ClassroomMember
        )
        .where(
            ClassroomMember.classroom_id
            == classroom_id,

            ClassroomMember.user_id
            == user.id,
        )
    )

    if row:
        return row

    email = normalize_email(
        user.email
    )

    if not email:
        return None

    return db.session.scalar(
        db.select(
            ClassroomMember
        )
        .where(
            ClassroomMember.classroom_id
            == classroom_id,

            ClassroomMember.email
            == email,
        )
    )


def is_class_owner(
    classroom,
    user,
):
    return bool(
        classroom
        and user
        and classroom.teacher_id
        and int(
            classroom.teacher_id
        )
        == int(
            user.id
        )
    )


def can_teach_class(
    classroom,
    user,
):
    if not classroom or not user:
        return False

    if (
        is_admin(
            user
        )
        or is_class_owner(
            classroom,
            user,
        )
    ):
        return True

    member = find_member_for_user(
        classroom.id,
        user,
    )

    if not member:
        return False

    if normalize_text(member.status).lower() != "active":
        return False

    role = normalize_text(
        member.role
    ).upper()

    class_role = normalize_text(
        member.class_role
    ).lower()

    return (
        role
        in {
            "TEACHER",
            "ADMIN_DEV",
        }
        or class_role
        == "intern_teacher"
    )

def is_active_class_member(member):
    return bool(
        member
        and normalize_text(
            member.status
        ).lower() == "active"
    )


def can_access_class(
    classroom,
    user,
):
    """
    True khi user được phép truy cập dữ liệu của lớp:
    - ADMIN_DEV
    - chủ lớp
    - thành viên thực sự của lớp
    """
    if not classroom or not user:
        return False

    if (
        is_admin(user)
        or is_class_owner(
            classroom,
            user,
        )
    ):
        return True

    member = find_member_for_user(
        classroom.id,
        user,
    )

    if not member:
        return False

    return (
        normalize_text(
            member.status
        ).lower()
        == "active"
    )

def sync_member_ids(
    classroom,
):
    rows = (
        db.session.execute(
            db.select(
                ClassroomMember
            )
            .where(
                ClassroomMember.classroom_id
                == classroom.id,

                ClassroomMember.user_id
                .is_not(
                    None
                ),
            )
        )
        .scalars()
        .all()
    )

    ids = {
        str(
            row.user_id
        )
        for row in rows
        if row.user_id
    }

    if classroom.teacher_id:
        ids.add(
            str(
                classroom.teacher_id
            )
        )

    classroom.member_ids = list(
        sorted(
            ids,
            key=str,
        )
    )


def sync_student_count(
    classroom,
):
    rows = (
        db.session.execute(
            db.select(
                ClassroomMember
            )
            .where(
                ClassroomMember.classroom_id
                == classroom.id
            )
        )
        .scalars()
        .all()
    )

    count = 0

    for row in rows:
        role = normalize_text(
            row.role
        ).upper()

        if role not in {
            "TEACHER",
            "ADMIN_DEV",
        }:
            count += 1

    classroom.student_count = (
        count
    )


def resolve_user_by_email(
    email,
):
    normalized = normalize_email(
        email
    )

    if not normalized:
        return None

    return db.session.scalar(
        db.select(
            User
        )
        .where(
            db.func.lower(
                User.email
            )
            == normalized
        )
    )


def next_student_code(
    classroom_id,
):
    count = (
        db.session.scalar(
            db.select(
                db.func.count(
                    ClassroomMember.id
                )
            )
            .where(
                ClassroomMember.classroom_id
                == classroom_id,

                ClassroomMember.role
                == "STUDENT",
            )
        )
        or 0
    )

    return (
        f"HS{int(count) + 1:03d}"
    )


# =========================================================
# USERS
# Resolve an account by normalized email for classroom membership.
# =========================================================

@classroom_bp.get(
    "/users/resolve"
)
@auth_required
@rate_limit(limit=240, window=3600, per_user=True)

def resolve_user():
    email = normalize_email(
        request.args.get(
            "email"
        )
    )

    if not email:
        return jsonify({
            "success": False,
            "error":
                "Thiếu email.",
        }), 400

    user = resolve_user_by_email(
        email
    )

    if not user:
        return jsonify({
            "success": False,
            "error":
                "Không tìm thấy tài khoản.",
        }), 404

    return jsonify({
        "success": True,
        "user":
            serialize_user(
                user
            ),
    }), 200


# =========================================================
# GET CLASSROOMS
#
# Giữ route cũ.
# Bổ sung ?mine=1 nếu frontend chỉ muốn lớp của user.
# =========================================================

@classroom_bp.get("")
@auth_required
def get_classrooms():
    try:
        user = current_user()

        statement = db.select(
            Classroom
        )

        mine_only = (
            normalize_text(
                request.args.get(
                    "mine"
                )
            ).lower()
            in {
                "1",
                "true",
                "yes",
            }
        )

        classrooms = (
            db.session.execute(
                statement.order_by(
                    Classroom.grade.asc(),
                    Classroom.name.asc(),
                    Classroom.id.asc(),
                )
            )
            .scalars()
            .all()
        )

        if mine_only and user:
            member_class_ids = {
                row.classroom_id
                for row in (
                    db.session.execute(
                        db.select(
                            ClassroomMember
                        )
                        .where(
                            ClassroomMember.user_id
                            == user.id
                        )
                    )
                    .scalars()
                    .all()
                )
            }

            classrooms = [
                classroom
                for classroom in classrooms
                if (
                    is_class_owner(
                        classroom,
                        user,
                    )
                    or classroom.id
                    in member_class_ids
                )
            ]

        items = [
            serialize_classroom(
                classroom
            )
            for classroom in classrooms
        ]

        return jsonify({
            "success": True,
            "classes":
                items,
            "count":
                len(
                    items
                ),
        }), 200

    except Exception as error:
        return jsonify({
            "success": False,
            "error":
                "Không thể tải danh sách lớp học.",
            "detail":
                str(
                    error
                ),
        }), 500


# =========================================================
# GET CLASSROOM
# =========================================================

@classroom_bp.get(
    "/<int:classroom_id>"
)
@auth_required
def get_classroom(
    classroom_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not can_access_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error": "Forbidden",
        }), 403

    return jsonify({
        "success": True,
        "classroom":
            serialize_classroom(
                classroom
            ),
    }), 200


# =========================================================
# CREATE CLASSROOM
# =========================================================

@classroom_bp.post("")
@auth_required
@rate_limit(limit=30, window=3600, per_user=True)
def create_classroom():
    user = current_user()

    if not user:
        return jsonify({
            "success": False,
            "error":
                "User not found",
        }), 404

    if not is_teacher(
        user
    ):
        return jsonify({
            "success": False,
            "error":
                "Chỉ giáo viên mới có thể tạo lớp học.",
        }), 403

    data = request.get_json(
    silent=True
    )

    if data is None:
      data = {}

    if not isinstance(
      data,
      dict,
    ):
      return jsonify({
        "success": False,
        "error":
            "Dữ liệu JSON phải là object.",
    }), 400

    name = normalize_text(
        data.get(
            "name"
        )
    )

    grade = normalize_text(
        data.get(
            "grade"
        )
    )

    if not name:
        return jsonify({
            "success": False,
            "error":
                "Tên lớp không được để trống.",
        }), 400

    if not grade:
        return jsonify({
            "success": False,
            "error":
                "Khối lớp không được để trống.",
        }), 400

    class_code = normalize_text(
        data.get(
            "classCode"
        )
        or data.get(
            "class_code"
        )
    ).upper()

    if class_code:
        existing = db.session.scalar(
            db.select(
                Classroom
            )
            .where(
                Classroom.class_code
                == class_code
            )
        )

        if existing:
            return jsonify({
                "success": False,
                "error":
                    "Mã lớp đã tồn tại.",
            }), 409

    else:
        class_code = (
            generate_class_code()
        )

    profile = dict(
        user.profile_data
        or {}
    )

    teacher_subject = normalize_text(
        data.get(
            "subject"
        )
        or profile.get(
            "subject"
        )
        or profile.get(
            "specialty"
        )
    )

    known_keys = {
        "name",
        "description",
        "grade",
        "classCode",
        "class_code",
        "school",
        "subject",
        "schoolYear",
        "themeColor",
        "coverPhotoUrl",
        "logoUrl",
        "status",
    }

    class_data = {
        key: value
        for key, value
        in data.items()
        if key not in known_keys
    }

    classroom = Classroom(
        name=
            name,

        description=
            normalize_text(
                data.get(
                    "description"
                )
            ),

        grade=
            grade,

        class_code=
            class_code,

        teacher_id=
            user.id,

        teacher_email=
            user.email,

        teacher_name=
            (
                user.full_name
                or user.email
            ),

        teacher_photo_url=
            normalize_text(
                profile.get(
                    "photoURL"
                )
                or profile.get(
                    "photoUrl"
                )
                or profile.get(
                    "avatarUrl"
                )
                or profile.get(
                    "avatar"
                )
            ),

        teacher_gender=
            normalize_text(
                profile.get(
                    "gender"
                )
                or profile.get(
                    "sex"
                )
            ),

        school=
            normalize_text(
                data.get(
                    "school"
                )
            ),

        subject=
            teacher_subject,

        school_year=
            normalize_text(
                data.get(
                    "schoolYear"
                )
            ),

        theme_color=
            normalize_text(
                data.get(
                    "themeColor"
                )
            )
            or "#2563eb",

        cover_photo_url=
            normalize_text(
                data.get(
                    "coverPhotoUrl"
                )
            ),

        logo_url=
            normalize_text(
                data.get(
                    "logoUrl"
                )
            ),

        status=
            normalize_text(
                data.get(
                    "status"
                )
            )
            or "active",

        student_count=
            0,

        member_ids=[
            str(
                user.id
            )
        ],

        dismissed_notification_source_keys=[],

        schedule_week_configs={},

        schedule_time_rules={},

        schedule_content_rules={},

        class_data=
            class_data,
    )

    db.session.add(
        classroom
    )

    db.session.flush()

    # Owner cũng được lưu trong classroom_members
    owner_member = ClassroomMember(
        classroom_id=
            classroom.id,

        user_id=
            user.id,

        email=
            normalize_email(
                user.email
            ),

        name=
            user.full_name
            or "",

        role=
            "TEACHER",

        class_role=
            "owner",

        photo_url=
            classroom.teacher_photo_url,

        gender=
            classroom.teacher_gender,

        status=
            "active",

        member_data={
            "owner":
                True,
        },
    )

    db.session.add(
        owner_member
    )

    if teacher_subject:
        subject = ClassroomSubject(
            classroom_id=
                classroom.id,

            teacher_id=
                user.id,

            name=
                teacher_subject,

            display_order=
                1,

            is_default=
                True,

            subject_data={},
        )

        db.session.add(
            subject
        )

    db.session.commit()

    return jsonify({
        "success": True,
        "classroom":
            serialize_classroom(
                classroom
            ),
    }), 201


# =========================================================
# UPDATE CLASSROOM
# =========================================================

@classroom_bp.patch(
    "/<int:classroom_id>"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)
def update_classroom(
    classroom_id,
):
    user = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not (
        is_admin(
            user
        )
        or is_class_owner(
            classroom,
            user,
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

    mapping = {
        "name":
            "name",

        "description":
            "description",

        "grade":
            "grade",

        "school":
            "school",

        "subject":
            "subject",

        "schoolYear":
            "school_year",

        "themeColor":
            "theme_color",

        "coverPhotoUrl":
            "cover_photo_url",

        "logoUrl":
            "logo_url",

        "status":
            "status",
    }

    for key, attribute in mapping.items():
        if key in data:
            setattr(
                classroom,
                attribute,
                normalize_text(
                    data.get(
                        key
                    )
                ),
            )

    if "dismissedNotificationSourceKeys" in data:
        classroom.dismissed_notification_source_keys = list(
            data.get(
                "dismissedNotificationSourceKeys"
            )
            or []
        )

    if "scheduleWeekConfigs" in data:
        classroom.schedule_week_configs = dict(
            data.get(
                "scheduleWeekConfigs"
            )
            or {}
        )

    if "scheduleTimeRules" in data:
        classroom.schedule_time_rules = dict(
            data.get(
                "scheduleTimeRules"
            )
            or {}
        )

    if "scheduleContentRules" in data:
        classroom.schedule_content_rules = dict(
            data.get(
                "scheduleContentRules"
            )
            or {}
        )

    protected = {
        *mapping.keys(),
        "id",
        "teacherId",
        "teacherEmail",
        "teacherName",
        "classCode",
        "class_code",
        "memberIds",
        "studentCount",
        "dismissedNotificationSourceKeys",
        "scheduleWeekConfigs",
        "scheduleTimeRules",
        "scheduleContentRules",
    }

    extra = dict(
        classroom.class_data
        or {}
    )

    for key, value in data.items():
        if key in protected:
            continue

        extra[
            key
        ] = value

    classroom.class_data = (
        extra
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "classroom":
            serialize_classroom(
                classroom
            ),
    }), 200


# =========================================================
# DELETE CLASSROOM
# PostgreSQL CASCADE sẽ xóa các bảng con.
# =========================================================

@classroom_bp.delete(
    "/<int:classroom_id>"
)
@auth_required
@rate_limit(limit=20, window=3600, per_user=True)
def delete_classroom(
    classroom_id,
):
    user = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not (
        is_admin(
            user
        )
        or is_class_owner(
            classroom,
            user,
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    db.session.delete(
        classroom
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "classroomId":
            str(
                classroom_id
            ),
    }), 200


# =========================================================
# JOIN CLASSROOM
# body:
# {
#     "classCode": "ABC123"
# }
# =========================================================

@classroom_bp.post(
    "/join"
)
@auth_required
@rate_limit(limit=30, window=3600, per_user=True)
def join_classroom():
    user = current_user()

    if not user:
        return jsonify({
            "success": False,
            "error":
                "User not found",
        }), 404

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    class_code = normalize_text(
        data.get(
            "classCode"
        )
        or data.get(
            "class_code"
        )
    ).upper()

    if not class_code:
        return jsonify({
            "success": False,
            "error":
                "Vui lòng nhập mã lớp.",
        }), 400

    classroom = db.session.scalar(
        db.select(
            Classroom
        )
        .where(
            Classroom.class_code
            == class_code
        )
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Không tìm thấy lớp với mã này.",
        }), 404

    if is_class_owner(
        classroom,
        user,
    ):
        return jsonify({
            "success": False,
            "error":
                "Bạn là người tạo lớp này.",
        }), 409

    existing = find_member_for_user(
        classroom.id,
        user,
    )

    if existing:
        if (
            normalize_text(
                existing.status
            ).lower()
            != "active"
        ):
            existing.status = (
                "active"
            )

        existing.user_id = (
            user.id
        )

        if not existing.name:
            existing.name = (
                user.full_name
                or ""
            )

        if not existing.role:
            existing.role = (
                user.role
                or "STUDENT"
            )

        member = existing

    else:
        profile = dict(
            user.profile_data
            or {}
        )

        role = normalize_text(
            user.role
        ).upper() or "STUDENT"

        member = ClassroomMember(
            classroom_id=
                classroom.id,

            user_id=
                user.id,

            email=
                normalize_email(
                    user.email
                ),

            name=
                user.full_name
                or "",

            role=
                role,

            class_role=
                "",

            student_code=
                (
                    ""
                    if role
                    == "TEACHER"
                    else next_student_code(
                        classroom.id
                    )
                ),

            photo_url=
                normalize_text(
                    profile.get(
                        "photoURL"
                    )
                    or profile.get(
                        "photoUrl"
                    )
                    or profile.get(
                        "avatarUrl"
                    )
                    or profile.get(
                        "avatar"
                    )
                ),

            gender=
                normalize_text(
                    profile.get(
                        "gender"
                    )
                    or profile.get(
                        "sex"
                    )
                ),

            status=
                "active",

            member_data={},
        )

        db.session.add(
            member
        )

        db.session.flush()

    sync_member_ids(
        classroom
    )

    sync_student_count(
        classroom
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "classroom":
            serialize_classroom(
                classroom
            ),
        "member":
            serialize_member(
                member
            ),
    }), 200


# =========================================================
# LEAVE CLASSROOM
# =========================================================

@classroom_bp.post(
    "/<int:classroom_id>/leave"
)
@auth_required
@rate_limit(limit=30, window=3600, per_user=True)

def leave_classroom(
    classroom_id,
):
    user = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if is_class_owner(
        classroom,
        user,
    ):
        return jsonify({
            "success": False,
            "error":
                "Chủ lớp không thể rời lớp.",
        }), 409

    member = find_member_for_user(
        classroom.id,
        user,
    )

    if not member:
        return jsonify({
            "success": False,
            "error":
                "Bạn không phải thành viên của lớp.",
        }), 404

    db.session.delete(
        member
    )

    db.session.flush()

    sync_member_ids(
        classroom
    )

    sync_student_count(
        classroom
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "classroomId":
            str(
                classroom_id
            ),
    }), 200


# =========================================================
# GET MEMBERS
# =========================================================

@classroom_bp.get(
    "/<int:classroom_id>/members"
)
@auth_required
def get_members(
    classroom_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not can_access_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    rows = (
        db.session.execute(
            db.select(
                ClassroomMember
            )
            .where(
                ClassroomMember.classroom_id
                == classroom_id
            )
            .order_by(
                ClassroomMember.created_at.asc(),
                ClassroomMember.id.asc(),
            )
        )
        .scalars()
        .all()
    )

    can_view_private_member_data = can_teach_class(
        classroom,
        actor,
    )

    members = []

    for row in rows:
        item = serialize_member(
            row
        )

        if not can_view_private_member_data:
            is_self = (
                row.user_id is not None
                and actor is not None
                and str(row.user_id)
                == str(actor.id)
            )

            if not is_self:
                for field in (
                    "email",
                    "birthDate",
                    "phone",
                    "parentName",
                    "parentPhone",
                    "parentEmail",
                    "parentRelation",
                    "medicalNote",
                ):
                    item.pop(
                        field,
                        None,
                    )

        members.append(
            item
        )

    return jsonify({
        "success": True,
        "members": members,
        "count": len(
            members
        ),
    }), 200

# =========================================================
# ADD MEMBER
#
# body may contain:
# {
#   email,
#   name,
#   role,
#   studentCode,
#   gender,
#   ...
# }
#
# Used for manual add / CSV / XLS imports.
# =========================================================

@classroom_bp.post(
    "/<int:classroom_id>/members"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)
def add_member(
    classroom_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not can_teach_class(
        classroom,
        actor,
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

    email = normalize_email(
        data.get(
            "email"
        )
    )

    if not email:
        return jsonify({
            "success": False,
            "error":
                "Email thành viên không được để trống.",
        }), 400

    existing = db.session.scalar(
        db.select(
            ClassroomMember
        )
        .where(
            ClassroomMember.classroom_id
            == classroom_id,

            ClassroomMember.email
            == email,
        )
    )

    if existing:
        return jsonify({
            "success": False,
            "error":
                "Email đã có trong lớp.",
        }), 409

    user = resolve_user_by_email(
        email
    )

    if not user:
        return jsonify({
            "success": False,
            "error":
                "Email không tồn tại trong hệ thống.",
        }), 404

    role = normalize_text(
        data.get(
            "role"
        )
        or user.role
        or "STUDENT"
    ).upper()

    profile = dict(
        user.profile_data
        or {}
    )

    known = {
        "email",
        "name",
        "role",
        "classRole",
        "studentCode",
        "photoURL",
        "gender",
        "birthDate",
        "phone",
        "parentName",
        "parentPhone",
        "parentEmail",
        "parentRelation",
        "medicalNote",
        "status",
    }

    member = ClassroomMember(
        classroom_id=
            classroom.id,

        user_id=
            user.id,

        email=
            email,

        name=
            normalize_text(
                data.get(
                    "name"
                )
            )
            or user.full_name
            or "",

        role=
            role,

        class_role=
            normalize_text(
                data.get(
                    "classRole"
                )
            ),

        student_code=
            normalize_text(
                data.get(
                    "studentCode"
                )
            )
            or (
                next_student_code(
                    classroom.id
                )
                if role
                == "STUDENT"
                else ""
            ),

        photo_url=
            normalize_text(
                data.get(
                    "photoURL"
                )
            )
            or normalize_text(
                profile.get(
                    "photoURL"
                )
                or profile.get(
                    "photoUrl"
                )
                or profile.get(
                    "avatarUrl"
                )
                or profile.get(
                    "avatar"
                )
            ),

        gender=
            normalize_text(
                data.get(
                    "gender"
                )
            )
            or normalize_text(
                profile.get(
                    "gender"
                )
                or profile.get(
                    "sex"
                )
            ),

        birth_date=
            normalize_text(
                data.get(
                    "birthDate"
                )
            ),

        phone=
            normalize_text(
                data.get(
                    "phone"
                )
            ),

        parent_name=
            normalize_text(
                data.get(
                    "parentName"
                )
            ),

        parent_phone=
            normalize_text(
                data.get(
                    "parentPhone"
                )
            ),

        parent_email=
            normalize_email(
                data.get(
                    "parentEmail"
                )
            ),

        parent_relation=
            normalize_text(
                data.get(
                    "parentRelation"
                )
            ),

        medical_note=
            normalize_text(
                data.get(
                    "medicalNote"
                )
            ),

        status=
            normalize_text(
                data.get(
                    "status"
                )
            )
            or "active",

        member_data={
            key: value
            for key, value
            in data.items()
            if key not in known
        },
    )

    db.session.add(
        member
    )

    db.session.flush()

    sync_member_ids(
        classroom
    )

    sync_student_count(
        classroom
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "member":
            serialize_member(
                member
            ),
    }), 201


# =========================================================
# UPDATE MEMBER
# =========================================================

@classroom_bp.patch(
    "/<int:classroom_id>/members/<int:member_id>"
)
@auth_required
@rate_limit(limit=240, window=3600, per_user=True)
def update_member(
    classroom_id,
    member_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    member = db.session.get(
        ClassroomMember,
        member_id,
    )

    if (
        not member
        or int(
            member.classroom_id
        )
        != int(
            classroom_id
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Thành viên không tồn tại.",
        }), 404

    own_record = bool(
        actor
        and member.user_id
        and int(
            actor.id
        )
        == int(
            member.user_id
        )
        and normalize_text(
            member.status
        ).lower()
        == "active"
    )

    if not (
        own_record
        or can_teach_class(
            classroom,
            actor,
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

    normal_fields = {
        "name":
            "name",

        "email":
            "email",

        "studentCode":
            "student_code",

        "photoURL":
            "photo_url",

        "gender":
            "gender",

        "birthDate":
            "birth_date",

        "phone":
            "phone",

        "parentName":
            "parent_name",

        "parentPhone":
            "parent_phone",

        "parentEmail":
            "parent_email",

        "parentRelation":
            "parent_relation",

        "medicalNote":
            "medical_note",

        "status":
            "status",
    }

    for key, attribute in normal_fields.items():
        if key not in data:
            continue

        value = (
            normalize_email(
                data.get(
                    key
                )
            )
            if key
            in {
                "email",
                "parentEmail",
            }
            else normalize_text(
                data.get(
                    key
                )
            )
        )

        setattr(
            member,
            attribute,
            value,
        )

    # Role/classRole chỉ giáo viên quản lý.
    if can_teach_class(
        classroom,
        actor,
    ):
        if "role" in data:
            member.role = normalize_text(
                data.get(
                    "role"
                )
            ).upper()

        if "classRole" in data:
            member.class_role = normalize_text(
                data.get(
                    "classRole"
                )
            )

    known = {
        *normal_fields.keys(),
        "role",
        "classRole",
        "uid",
        "userId",
        "id",
        "classId",
    }

    extra = dict(
        member.member_data
        or {}
    )

    for key, value in data.items():
        if key in known:
            continue

        extra[
            key
        ] = value

    member.member_data = (
        extra
    )

    sync_student_count(
        classroom
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "member":
            serialize_member(
                member
            ),
    }), 200


# =========================================================
# DELETE MEMBER
# =========================================================

@classroom_bp.delete(
    "/<int:classroom_id>/members/<int:member_id>"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)
def delete_member(
    classroom_id,
    member_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not (
        is_admin(
            actor
        )
        or is_class_owner(
            classroom,
            actor,
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Chỉ chủ lớp mới có thể xóa thành viên.",
        }), 403

    member = db.session.get(
        ClassroomMember,
        member_id,
    )

    if (
        not member
        or int(
            member.classroom_id
        )
        != int(
            classroom_id
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Thành viên không tồn tại.",
        }), 404

    if (
        member.user_id
        and classroom.teacher_id
        and int(
            member.user_id
        )
        == int(
            classroom.teacher_id
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Không thể xóa chủ lớp.",
        }), 409

    db.session.delete(
        member
    )

    db.session.flush()

    sync_member_ids(
        classroom
    )

    sync_student_count(
        classroom
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "memberId":
            str(
                member_id
            ),
    }), 200

# =========================================================
# PHASE 2
# CLASSROOM ATTENDANCE + QR + HISTORY
# =========================================================


def classroom_utc_now():
    return datetime.now(
        timezone.utc
    )


def attendance_iso(value):
    return (
        value.isoformat()
        if value
        else None
    )


def is_valid_date_key(
    value,
):
    value = normalize_text(
        value
    )

    if len(value) != 10:
        return False

    try:
        parsed = datetime.strptime(
            value,
            "%Y-%m-%d",
        )

    except ValueError:
        return False

    return (
        parsed.strftime(
            "%Y-%m-%d"
        )
        == value
    )

def is_valid_time_key(
    value,
):
    value = normalize_text(
        value
    )

    if len(value) != 5:
        return False

    try:
        parsed = datetime.strptime(
            value,
            "%H:%M",
        )

    except ValueError:
        return False

    return (
        parsed.strftime(
            "%H:%M"
        )
        == value
    )

def is_valid_attendance_date(
    value,
):
    return is_valid_date_key(
        value
    )

def normalize_attendance_status(
    value,
):
    status = normalize_text(
        value
    ).lower()

    aliases = {
        "present":
            "present",

        "late":
            "late",

        "absent":
            "absent",

        "excused":
            "excused",

        "co mat":
            "present",

        "có mặt":
            "present",

        "di tre":
            "late",

        "đi trễ":
            "late",

        "vang":
            "absent",

        "vắng":
            "absent",

        "vang co phep":
            "excused",

        "vắng có phép":
            "excused",
    }

    return aliases.get(
        status,
        status,
    )

def serialize_attendance(
    row,
):
    data = dict(
        row.attendance_data
        or {}
    )

    data.update({
        "id":
            str(
                row.id
            ),

        "classId":
            str(
                row.classroom_id
            ),

        "date":
            row.attendance_date,

        "attendanceDate":
            row.attendance_date,

        "teacherId":
            (
                str(
                    row.teacher_id
                )
                if row.teacher_id
                else ""
            ),

        "records":
            list(
                row.records
                or []
            ),

        "internRecords":
            list(
                row.intern_records
                or []
            ),

        "qrCheckIns":
            dict(
                row.qr_check_ins
                or {}
            ),

        "qrToken":
            row.qr_token
            or "",

        "qrExpiresAt":
            row.qr_expires_at_ms,

        "qrCreatedBy":
            (
                str(
                    row.qr_created_by
                )
                if row.qr_created_by
                else ""
            ),

        "qrCreatedAt":
            attendance_iso(
                row.qr_created_at
            ),

        "presentCount":
            int(
                row.present_count
                or 0
            ),

        "lateCount":
            int(
                row.late_count
                or 0
            ),

        "absentCount":
            int(
                row.absent_count
                or 0
            ),

        "excusedCount":
            int(
                row.excused_count
                or 0
            ),

        "totalCount":
            int(
                row.total_count
                or 0
            ),

        "attendanceRate":
            float(
                row.attendance_rate
                or 0
            ),

        "createdAt":
            attendance_iso(
                row.created_at
            ),

        "updatedAt":
            attendance_iso(
                row.updated_at
            ),
    })

    return data


def serialize_attendance_history(
    row,
):
    data = dict(
        row.history_data
        or {}
    )

    data.update({
        "id":
            str(
                row.id
            ),

        "attendanceId":
            str(
                row.attendance_id
            ),

        "classId":
            str(
                row.classroom_id
            ),

        "date":
            row.attendance_date,

        "attendanceDate":
            row.attendance_date,

        "teacherId":
            (
                str(
                    row.teacher_id
                )
                if row.teacher_id
                else ""
            ),

        "teacherName":
            row.teacher_name
            or "",

        "teacherEmail":
            row.teacher_email
            or "",

        "records":
            list(
                row.records
                or []
            ),

        "presentCount":
            int(
                row.present_count
                or 0
            ),

        "lateCount":
            int(
                row.late_count
                or 0
            ),

        "absentCount":
            int(
                row.absent_count
                or 0
            ),

        "excusedCount":
            int(
                row.excused_count
                or 0
            ),

        "totalCount":
            int(
                row.total_count
                or 0
            ),

        "attendanceRate":
            float(
                row.attendance_rate
                or 0
            ),

        "savedAt":
            attendance_iso(
                row.saved_at
            ),
    })

    return data


def find_attendance(
    classroom_id,
    attendance_date,
):
    return db.session.scalar(
        db.select(
            ClassroomAttendance
        )
        .where(
            ClassroomAttendance.classroom_id
            == classroom_id,

            ClassroomAttendance.attendance_date
            == attendance_date,
        )
    )


def attendance_statistics(
    records,
):
    normalized = []

    for row in (
        records
        or []
    ):
        item = dict(
            row
            or {}
        )

        item[
            "status"
        ] = normalize_attendance_status(
            item.get(
                "status"
            )
            or item.get(
                "attendanceStatus"
            )
            or item.get(
                "state"
            )
        )

        normalized.append(
            item
        )

    present = sum(
        1
        for item in normalized
        if item.get(
            "status"
        )
        == "present"
    )

    late = sum(
        1
        for item in normalized
        if item.get(
            "status"
        )
        == "late"
    )

    absent = sum(
        1
        for item in normalized
        if item.get(
            "status"
        )
        == "absent"
    )

    excused = sum(
        1
        for item in normalized
        if item.get(
            "status"
        )
        == "excused"
    )

    total = len(
        normalized
    )

    rate = (
        (
            present
            + late * 0.5
        )
        / total
        * 100
        if total
        else 0
    )

    return {
        "records":
            normalized,

        "present":
            present,

        "late":
            late,

        "absent":
            absent,

        "excused":
            excused,

        "total":
            total,

        "rate":
            round(
                rate,
                1,
            ),
    }


# # =========================================================
# GET ALL ATTENDANCE RECORDS
#
# PostgreSQL API:
# collection(
#   db,
#   "classes",
#   classId,
#   "attendance"
# )
# =========================================================

@classroom_bp.get(
    "/<int:classroom_id>/attendance"
)
@auth_required
def get_attendance_records(
    classroom_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not can_access_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    rows = (
        db.session.execute(
            db.select(
                ClassroomAttendance
            )
            .where(
                ClassroomAttendance.classroom_id
                == classroom_id
            )
            .order_by(
                ClassroomAttendance
                .attendance_date
                .desc()
            )
        )
        .scalars()
        .all()
    )

    return jsonify({
        "success": True,
        "attendance": [
            serialize_attendance(
                row
            )
            for row in rows
        ],
        "records": [
            serialize_attendance(
                row
            )
            for row in rows
        ],
        "count":
            len(
                rows
            ),
    }), 200


# =========================================================
# GET ATTENDANCE BY DATE
#
# PostgreSQL API:
# doc(
#   db,
#   "classes",
#   classId,
#   "attendance",
#   date
# )
# =========================================================

@classroom_bp.get(
    "/<int:classroom_id>/attendance/<string:attendance_date>"
)
@auth_required
def get_attendance_by_date(
    classroom_id,
    attendance_date,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not can_access_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    row = find_attendance(
        classroom_id,
        attendance_date,
    )

    return jsonify({
        "success": True,
        "attendance":
            (
                serialize_attendance(
                    row
                )
                if row
                else None
            ),
    }), 200

# =========================================================
# SAVE / UPDATE ATTENDANCE
#
# Replacement for:
# setDoc(attendanceRef, latestData, { merge: true })
#
# Automatically creates history when records are supplied.
# =========================================================

@classroom_bp.patch(
    "/<int:classroom_id>/attendance/<string:attendance_date>"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)
def update_attendance(
    classroom_id,
    attendance_date,
):
    actor = current_user()

    if not is_valid_attendance_date(
        attendance_date
    ):
        return jsonify({
            "success": False,
            "error":
                "Ngày điểm danh không hợp lệ. Định dạng yêu cầu: YYYY-MM-DD.",
        }), 400

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not can_teach_class(
        classroom,
        actor,
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

    if not isinstance(
        data,
        dict,
    ):
        return jsonify({
            "success": False,
            "error":
                "Dữ liệu gửi lên phải là JSON object.",
        }), 400

    if "records" in data:
        records = data.get(
            "records"
        )

        if not isinstance(
            records,
            list,
        ):
            return jsonify({
                "success": False,
                "error":
                    "records phải là một danh sách.",
            }), 400

        allowed_statuses = {
            "present",
            "late",
            "absent",
            "excused",
        }

        for record in records:
            if not isinstance(
                record,
                dict,
            ):
                return jsonify({
                    "success": False,
                    "error":
                        "Mỗi phần tử trong records phải là JSON object.",
                }), 400

            status = normalize_attendance_status(
                record.get(
                    "status"
                )
                or record.get(
                    "attendanceStatus"
                )
                or record.get(
                    "state"
                )
            )

            if status not in allowed_statuses:
                return jsonify({
                    "success": False,
                    "error":
                        "Trạng thái điểm danh không hợp lệ.",
                }), 400

    if "internRecords" in data:
        intern_records = data.get(
            "internRecords"
        )

        if not isinstance(
            intern_records,
            list,
        ):
            return jsonify({
                "success": False,
                "error":
                    "internRecords phải là một danh sách.",
            }), 400

    row = find_attendance(
        classroom_id,
        attendance_date,
    )

    is_new = (
        row is None
    )

    if is_new:
        row = ClassroomAttendance(
            classroom_id=
                classroom_id,

            attendance_date=
                attendance_date,

            teacher_id=
                actor.id,

            records=[],

            intern_records=[],

            qr_check_ins={},

            attendance_data={},
        )

        db.session.add(
            row
        )

        db.session.flush()

    if "records" in data:
        stats = attendance_statistics(
            data.get(
                "records"
            )
            or []
        )

        row.records = (
            stats[
                "records"
            ]
        )

        row.present_count = (
            stats[
                "present"
            ]
        )

        row.late_count = (
            stats[
                "late"
            ]
        )

        row.absent_count = (
            stats[
                "absent"
            ]
        )

        row.excused_count = (
            stats[
                "excused"
            ]
        )

        row.total_count = (
            stats[
                "total"
            ]
        )

        row.attendance_rate = (
            stats[
                "rate"
            ]
        )

        # QR check-in đã được giáo viên xử lý vào
        # attendance chính.
        if data.get(
            "clearQrCheckIns",
            True,
        ):
            row.qr_check_ins = {}

        history = (
            ClassroomAttendanceHistory(
                attendance_id=
                    row.id,

                classroom_id=
                    classroom_id,

                attendance_date=
                    attendance_date,

                teacher_id=
                    actor.id,

                teacher_name=
                    actor.full_name
                    or actor.email
                    or "Giáo viên",

                teacher_email=
                    actor.email
                    or "",

                records=
                    stats[
                        "records"
                    ],

                present_count=
                    stats[
                        "present"
                    ],

                late_count=
                    stats[
                        "late"
                    ],

                absent_count=
                    stats[
                        "absent"
                    ],

                excused_count=
                    stats[
                        "excused"
                    ],

                total_count=
                    stats[
                        "total"
                    ],

                attendance_rate=
                    stats[
                        "rate"
                    ],

                history_data={},
            )
        )

        db.session.add(
            history
        )

    if "internRecords" in data:
        row.intern_records = list(
            data.get(
                "internRecords"
            )
            or []
        )

    known = {
        "records",
        "internRecords",
        "qrCheckIns",
        "qrToken",
        "qrExpiresAt",
        "qrCreatedBy",
        "clearQrCheckIns",
        "presentCount",
        "lateCount",
        "absentCount",
        "excusedCount",
        "totalCount",
        "attendanceRate",
        "teacherId",
        "classId",
        "date",
        "attendanceDate",
    }

    extra = dict(
        row.attendance_data
        or {}
    )

    for key, value in data.items():
        if key in known:
            continue

        extra[
            key
        ] = value

    row.attendance_data = (
        extra
    )

    row.teacher_id = (
        actor.id
    )

    row.updated_at = (
        classroom_utc_now()
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "created":
            is_new,
        "attendance":
            serialize_attendance(
                row
            ),
    }), 200


# =========================================================
# ATTENDANCE HISTORY
# =========================================================

@classroom_bp.get(
    "/<int:classroom_id>/attendance/<string:attendance_date>/history"
)
@auth_required
def get_attendance_history(
    classroom_id,
    attendance_date,
):
    actor = current_user()

    if not is_valid_attendance_date(
        attendance_date
    ):
        return jsonify({
            "success": False,
            "error":
                "Ngày điểm danh không hợp lệ. Định dạng yêu cầu: YYYY-MM-DD.",
        }), 400

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not can_access_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    rows = (
        db.session.execute(
            db.select(
                ClassroomAttendanceHistory
            )
            .where(
                ClassroomAttendanceHistory.classroom_id
                == classroom_id,

                ClassroomAttendanceHistory.attendance_date
                == attendance_date,
            )
            .order_by(
                ClassroomAttendanceHistory
                .saved_at
                .desc(),

                ClassroomAttendanceHistory
                .id
                .desc(),
            )
        )
        .scalars()
        .all()
    )

    return jsonify({
        "success": True,
        "history": [
            serialize_attendance_history(
                row
            )
            for row in rows
        ],
        "count":
            len(
                rows
            ),
    }), 200

# =========================================================
# CREATE / REFRESH QR SESSION
#
# PostgreSQL API:
# {
#   qrToken,
#   qrExpiresAt: Date.now() + 10*60*1000,
#   qrCreatedBy,
#   qrCreatedAt
# }
# =========================================================

@classroom_bp.post(
    "/<int:classroom_id>/attendance/<string:attendance_date>/qr"
)

@auth_required
@rate_limit(limit=60, window=3600, per_user=True)

def create_attendance_qr(
    classroom_id,
    attendance_date,
):
    actor = current_user()

    if not is_valid_attendance_date(
        attendance_date
    ):
        return jsonify({
            "success": False,
            "error":
                "Ngày điểm danh không hợp lệ. Định dạng yêu cầu: YYYY-MM-DD.",
        }), 400

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not can_teach_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    data = request.get_json(
        silent=True
    )

    if data is None:
        data = {}

    if not isinstance(
        data,
        dict,
    ):
        return jsonify({
            "success": False,
            "error":
                "Dữ liệu JSON phải là object.",
        }), 400

    ttl_value = data.get(
        "ttlSeconds",
        600,
    )

    if isinstance(
        ttl_value,
        bool,
    ):
        return jsonify({
            "success": False,
            "error":
                "ttlSeconds phải là số nguyên.",
        }), 400

    try:
        ttl_seconds = int(
            ttl_value
        )
    except (
        TypeError,
        ValueError,
    ):
        return jsonify({
            "success": False,
            "error":
                "ttlSeconds phải là số nguyên.",
        }), 400

    ttl_seconds = max(
        60,
        min(
            ttl_seconds,
            3600,
        ),
    )

    row = find_attendance(
        classroom_id,
        attendance_date,
    )

    if not row:
        row = ClassroomAttendance(
            classroom_id=
                classroom_id,

            attendance_date=
                attendance_date,

            teacher_id=
                actor.id,

            records=[],

            intern_records=[],

            qr_check_ins={},

            attendance_data={},
        )

        db.session.add(
            row
        )

        db.session.flush()

    now_ms = int(
        time.time()
        * 1000
    )

    row.qr_token = (
        secrets.token_urlsafe(
            24
        )
    )

    row.qr_expires_at_ms = (
        now_ms
        + ttl_seconds
        * 1000
    )

    row.qr_created_by = (
        actor.id
    )

    row.qr_created_at = (
        classroom_utc_now()
    )

    row.updated_at = (
        classroom_utc_now()
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "attendance":
            serialize_attendance(
                row
            ),

        "qrToken":
            row.qr_token,

        "qrExpiresAt":
            row.qr_expires_at_ms,
    }), 200


# =========================================================
# VALIDATE QR
#
# Used by QR check-in page before student confirms.
# =========================================================

@classroom_bp.get(
    "/<int:classroom_id>/attendance/<string:attendance_date>/qr"
)
@auth_required
@rate_limit(limit=60, window=3600, per_user=True)
def validate_attendance_qr(
    classroom_id,
    attendance_date,
):
    actor = current_user()

    if not is_valid_attendance_date(
        attendance_date
    ):
        return jsonify({
            "success": False,
            "valid": False,
            "error":
                "Ngày điểm danh không hợp lệ. Định dạng yêu cầu: YYYY-MM-DD.",
        }), 400

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "valid": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not can_access_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "valid": False,
            "error":
                "Forbidden",
        }), 403

    token = normalize_text(
        request.args.get(
            "token"
        )
    )

    if not token:
        return jsonify({
            "success": False,
            "valid": False,
            "error":
                "Thiếu mã QR.",
        }), 400

    if len(token) > 255:
        return jsonify({
            "success": False,
            "valid": False,
            "error":
                "Mã QR không hợp lệ.",
        }), 400

    row = find_attendance(
        classroom_id,
        attendance_date,
    )

    if not row:
        return jsonify({
            "success": False,
            "valid": False,
            "error":
                "Phiên điểm danh không tồn tại.",
        }), 404

    now_ms = int(
        time.time()
        * 1000
    )

    valid = bool(
        token
        and row.qr_token
        and secrets.compare_digest(
            token,
            row.qr_token,
        )
        and row.qr_expires_at_ms
        and now_ms
        < int(
            row.qr_expires_at_ms
        )
    )

    return jsonify({
        "success": True,
        "valid":
            valid,
        "attendance":
            serialize_attendance(
                row
            ),
    }), 200

# =========================================================
# STUDENT QR CHECK-IN
#
# PostgreSQL API:
# qrCheckIns.{studentId} = {...}
# =========================================================

@classroom_bp.post(
    "/<int:classroom_id>/attendance/<string:attendance_date>/check-in"
)
@auth_required
@rate_limit(limit=60, window=3600, per_user=True)

def attendance_check_in(
    classroom_id,
    attendance_date,
):
    user = current_user()

    if not is_valid_attendance_date(
        attendance_date
    ):
        return jsonify({
            "success": False,
            "error":
                "Ngày điểm danh không hợp lệ. Định dạng yêu cầu: YYYY-MM-DD.",
        }), 400

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    member = find_member_for_user(
        classroom_id,
        user,
    )

    if not member:
        return jsonify({
            "success": False,
            "error":
                "Bạn chưa phải thành viên của lớp.",
        }), 403

    role = normalize_text(
        member.role
    ).upper()

    class_role = normalize_text(
        member.class_role
    ).lower()

    if (
        role
        in {
            "TEACHER",
            "ADMIN_DEV",
        }
        or class_role
        == "intern_teacher"
    ):
        return jsonify({
            "success": False,
            "error":
                "Tài khoản giáo viên không được điểm danh như học sinh.",
        }), 403

    data = request.get_json(
        silent=True
    )

    if data is None:
        data = {}

    if not isinstance(
        data,
        dict,
    ):
        return jsonify({
            "success": False,
            "error":
                "Dữ liệu gửi lên phải là JSON object.",
        }), 400

    token = normalize_text(
        data.get(
            "token"
        )
        or data.get(
            "qrToken"
        )
    )

    if not token:
        return jsonify({
            "success": False,
            "error":
                "Thiếu mã QR.",
        }), 400

    if len(token) > 255:
        return jsonify({
            "success": False,
            "error":
                "Mã QR không hợp lệ.",
        }), 400

    row = find_attendance(
        classroom_id,
        attendance_date,
    )

    if not row:
        return jsonify({
            "success": False,
            "error":
                "Phiên điểm danh không tồn tại.",
        }), 404

    now_ms = int(
        time.time()
        * 1000
    )

    if (
        not token
        or not row.qr_token
        or not secrets.compare_digest(
            token,
            row.qr_token,
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Mã QR không hợp lệ.",
        }), 400

    if (
        not row.qr_expires_at_ms
        or now_ms
        >= int(
            row.qr_expires_at_ms
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Mã QR đã hết hạn.",
        }), 410

    status = normalize_attendance_status(
        data.get(
            "status"
        )
        or "present"
    )

    if status not in {
        "present",
        "excused",
    }:
        return jsonify({
            "success": False,
            "error":
                "Trạng thái điểm danh QR không hợp lệ.",
        }), 400

    note = normalize_text(
        data.get(
            "note"
        )
    )

    if len(note) > 1000:
        return jsonify({
            "success": False,
            "error":
                "Ghi chú không được vượt quá 1000 ký tự.",
        }), 400

    if (
        status
        == "excused"
        and not note
    ):
        return jsonify({
            "success": False,
            "error":
                "Vui lòng nhập lý do vắng có phép.",
        }), 400

    qr_check_ins = dict(
        row.qr_check_ins
        or {}
    )

    qr_check_ins[
        str(
            member.id
        )
    ] = {
        "studentId":
            str(
                member.id
            ),

        "uid":
            str(
                user.id
            ),

        "email":
            user.email
            or member.email
            or "",

        "name":
            member.name
            or user.full_name
            or "",

        "status":
            status,

        "note":
            note,

        "confirmedAt":
            classroom_utc_now()
            .isoformat(),
    }

    row.qr_check_ins = (
        qr_check_ins
    )

    row.updated_at = (
        classroom_utc_now()
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "checkIn":
            qr_check_ins[
                str(
                    member.id
                )
            ],
        "attendance":
            serialize_attendance(
                row
            ),
    }), 200


# =========================================================
# INTERN TEACHER ATTENDANCE
#
# Replacement for:
# attendance.internRecords
# =========================================================

@classroom_bp.patch(
    "/<int:classroom_id>/attendance/<string:attendance_date>/intern/<int:member_id>"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)

def update_intern_attendance(
    classroom_id,
    attendance_date,
    member_id,
):
    actor = current_user()

    if not is_valid_attendance_date(
        attendance_date
    ):
        return jsonify({
            "success": False,
            "error":
                "Ngày điểm danh không hợp lệ. Định dạng yêu cầu: YYYY-MM-DD.",
        }), 400

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not (
        is_admin(
            actor
        )
        or is_class_owner(
            classroom,
            actor,
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Chỉ chủ lớp mới có thể điểm danh giáo viên thực tập.",
        }), 403

    member = db.session.get(
        ClassroomMember,
        member_id,
    )

    if (
        not member
        or int(
            member.classroom_id
        )
        != int(
            classroom_id
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Giáo viên không tồn tại trong lớp.",
        }), 404

    if normalize_text(
        member.class_role
    ).lower() != "intern_teacher":
        return jsonify({
            "success": False,
            "error":
                "Thành viên không phải giáo viên thực tập.",
        }), 400

    data = request.get_json(
        silent=True
    )

    if data is None:
        data = {}

    if not isinstance(
        data,
        dict,
    ):
        return jsonify({
            "success": False,
            "error":
                "Dữ liệu gửi lên phải là JSON object.",
        }), 400

    status = normalize_attendance_status(
        data.get(
            "status"
        )
    )

    if status not in {
        "present",
        "excused",
    }:
        return jsonify({
            "success": False,
            "error":
                "Trạng thái điểm danh giáo viên thực tập không hợp lệ.",
        }), 400

    row = find_attendance(
        classroom_id,
        attendance_date,
    )

    if not row:
        row = ClassroomAttendance(
            classroom_id=
                classroom_id,

            attendance_date=
                attendance_date,

            teacher_id=
                actor.id,

            records=[],

            intern_records=[],

            qr_check_ins={},

            attendance_data={},
        )

        db.session.add(
            row
        )

        db.session.flush()

    current_rows = list(
        row.intern_records
        or []
    )

    current_rows = [
        item
        for item in current_rows
        if str(
            item.get(
                "teacherId"
            )
            or ""
        )
        != str(
            member.id
        )
    ]

    current_rows.append({
        "teacherId":
            str(
                member.id
            ),

        "uid":
            (
                str(
                    member.user_id
                )
                if member.user_id
                else ""
            ),

        "email":
            member.email
            or "",

        "name":
            member.name
            or "",

        "status":
            status,

        "updatedAtMillis":
            int(
                time.time()
                * 1000
            ),
    })

    row.intern_records = (
        current_rows
    )

    row.updated_at = (
        classroom_utc_now()
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "attendance":
            serialize_attendance(
                row
            ),
    }), 200

# =========================================================
# PHASE 3
# SUBJECTS + TESTS + SCORES
# =========================================================


def serialize_subject(
    row,
):
    data = dict(
        row.subject_data
        or {}
    )

    data.update({
        "id":
            str(row.id),

        "legacyId":
            row.legacy_id
            or "",

        "classId":
            str(
                row.classroom_id
            ),

        "teacherId":
            (
                str(
                    row.teacher_id
                )
                if row.teacher_id
                else ""
            ),

        "name":
            row.name
            or "",

        "displayOrder":
            int(
                row.display_order
                or 0
            ),

        "isDefault":
            bool(
                row.is_default
            ),

        "createdAt":
            (
                row.created_at.isoformat()
                if row.created_at
                else None
            ),

        "updatedAt":
            (
                row.updated_at.isoformat()
                if row.updated_at
                else None
            ),
    })

    return data


def serialize_subject_test(
    row,
):
    data = dict(
        row.test_data
        or {}
    )

    data.update({
        "id":
            str(row.id),

        "legacyId":
            row.legacy_id
            or "",

        "subjectId":
            str(
                row.subject_id
            ),

        "classId":
            str(
                row.classroom_id
            ),

        "name":
            row.name
            or "",

        "code":
            row.code
            or "",

        "displayOrder":
            int(
                row.display_order
                or 0
            ),

        "maxScore":
            float(
                row.max_score
                or 10.0
            ),

        "createdAt":
            (
                row.created_at.isoformat()
                if row.created_at
                else None
            ),

        "updatedAt":
            (
                row.updated_at.isoformat()
                if row.updated_at
                else None
            ),
    })

    return data


def serialize_score(
    row,
):
    data = dict(
        row.score_data
        or {}
    )

    data.update({
        "id":
            str(row.id),

        "subjectId":
            str(
                row.subject_id
            ),

        "classId":
            str(
                row.classroom_id
            ),

        "memberId":
            str(
                row.member_id
            ),

        "userId":
            (
                str(
                    row.user_id
                )
                if row.user_id
                else ""
            ),

        "scores":
            dict(
                row.scores
                or {}
            ),

        "average":
            (
                float(
                    row.average
                )
                if row.average
                is not None
                else None
            ),

        "createdAt":
            (
                row.created_at.isoformat()
                if row.created_at
                else None
            ),

        "updatedAt":
            (
                row.updated_at.isoformat()
                if row.updated_at
                else None
            ),
    })

    return data


def get_subject_or_none(
    classroom_id,
    subject_id,
):
    row = db.session.get(
        ClassroomSubject,
        subject_id,
    )

    if (
        not row
        or int(
            row.classroom_id
        )
        != int(
            classroom_id
        )
    ):
        return None

    return row


def get_test_or_none(
    classroom_id,
    subject_id,
    test_id,
):
    row = db.session.get(
        ClassroomSubjectTest,
        test_id,
    )

    if (
        not row
        or int(
            row.classroom_id
        )
        != int(
            classroom_id
        )
        or int(
            row.subject_id
        )
        != int(
            subject_id
        )
    ):
        return None

    return row


def calculate_score_average(
    scores,
):
    values = []

    for value in (
        scores
        or {}
    ).values():
        try:
            number = float(
                value
            )

        except (
            TypeError,
            ValueError,
        ):
            continue

        values.append(
            number
        )

    if not values:
        return None

    return round(
        sum(
            values
        )
        / len(
            values
        ),
        2,
    )


# =========================================================
# GET SUBJECTS
# =========================================================

@classroom_bp.get(
    "/<int:classroom_id>/subjects"
)
@auth_required
def get_subjects(
    classroom_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not can_access_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    rows = (
        db.session.execute(
            db.select(
                ClassroomSubject
            )
            .where(
                ClassroomSubject.classroom_id
                == classroom_id
            )
            .order_by(
                ClassroomSubject.display_order.asc(),
                ClassroomSubject.id.asc(),
            )
        )
        .scalars()
        .all()
    )

    return jsonify({
        "success": True,

        "subjects": [
            serialize_subject(
                row
            )
            for row in rows
        ],

        "count":
            len(rows),
    }), 200


# =========================================================
# CREATE SUBJECT
# =========================================================

@classroom_bp.post(
    "/<int:classroom_id>/subjects"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)

def create_subject(
    classroom_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not can_teach_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    data = request.get_json(
        silent=True
    )

    if data is None:
        data = {}

    if not isinstance(
        data,
        dict,
    ):
        return jsonify({
            "success": False,
            "error":
                "Dữ liệu gửi lên phải là JSON object.",
        }), 400

    name = normalize_text(
        data.get(
            "name"
        )
    )

    if not name:
        return jsonify({
            "success": False,
            "error":
                "Tên môn học không được để trống.",
        }), 400

    existing = db.session.scalar(
        db.select(
            ClassroomSubject
        )
        .where(
            ClassroomSubject.classroom_id
            == classroom_id,

            db.func.lower(
                ClassroomSubject.name
            )
            == name.lower(),
        )
    )

    if existing:
        return jsonify({
            "success": False,
            "error":
                "Môn học đã tồn tại.",
        }), 409

    max_order = (
        db.session.scalar(
            db.select(
                db.func.max(
                    ClassroomSubject.display_order
                )
            )
            .where(
                ClassroomSubject.classroom_id
                == classroom_id
            )
        )
        or 0
    )

    raw_display_order = data.get(
        "displayOrder"
    )

    if raw_display_order in (
        None,
        "",
    ):
        display_order = (
            int(max_order)
            + 1
        )
    else:
        if isinstance(
            raw_display_order,
            bool,
        ):
            return jsonify({
                "success": False,
                "error":
                    "Thứ tự hiển thị không hợp lệ.",
            }), 400

        try:
            display_order = int(
                raw_display_order
            )
        except (
            TypeError,
            ValueError,
        ):
            return jsonify({
                "success": False,
                "error":
                    "Thứ tự hiển thị không hợp lệ.",
            }), 400

    known = {
        "name",
        "displayOrder",
        "isDefault",
    }

    row = ClassroomSubject(
        classroom_id=
            classroom_id,

        teacher_id=
            actor.id,

        name=
            name,

        display_order=
            display_order,

        is_default=
            bool(
                data.get(
                    "isDefault",
                    False,
                )
            ),

        subject_data={
            key: value
            for key, value
            in data.items()
            if key not in known
        },
    )

    db.session.add(
        row
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "subject":
            serialize_subject(
                row
            ),
    }), 201


# =========================================================
# UPDATE SUBJECT
# =========================================================

@classroom_bp.patch(
    "/<int:classroom_id>/subjects/<int:subject_id>"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)

def update_subject(
    classroom_id,
    subject_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not can_teach_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    row = get_subject_or_none(
        classroom_id,
        subject_id,
    )

    if not row:
        return jsonify({
            "success": False,
            "error":
                "Môn học không tồn tại.",
        }), 404

    data = request.get_json(
        silent=True
    )

    if data is None:
        data = {}

    if not isinstance(
        data,
        dict,
    ):
        return jsonify({
            "success": False,
            "error":
                "Dữ liệu gửi lên phải là JSON object.",
        }), 400

    if "name" in data:
        name = normalize_text(
            data.get(
                "name"
            )
        )

        if not name:
            return jsonify({
                "success": False,
                "error":
                    "Tên môn học không được để trống.",
            }), 400

        row.name = name

    if "displayOrder" in data:
        raw_display_order = data.get(
            "displayOrder"
        )

        if isinstance(
            raw_display_order,
            bool,
        ):
            return jsonify({
                "success": False,
                "error":
                    "displayOrder không hợp lệ.",
            }), 400

        try:
            row.display_order = int(
                raw_display_order
                or 0
            )

        except (
            TypeError,
            ValueError,
        ):
            return jsonify({
                "success": False,
                "error":
                    "displayOrder không hợp lệ.",
            }), 400

    if "isDefault" in data:
        row.is_default = bool(
            data.get(
                "isDefault"
            )
        )

    known = {
        "name",
        "displayOrder",
        "isDefault",
        "id",
        "classId",
        "teacherId",
    }

    extra = dict(
        row.subject_data
        or {}
    )

    for key, value in data.items():
        if key in known:
            continue

        extra[
            key
        ] = value

    row.subject_data = (
        extra
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "subject":
            serialize_subject(
                row
            ),
    }), 200


# =========================================================
# DELETE SUBJECT
# =========================================================

@classroom_bp.delete(
    "/<int:classroom_id>/subjects/<int:subject_id>"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)

def delete_subject(
    classroom_id,
    subject_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not can_teach_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    row = get_subject_or_none(
        classroom_id,
        subject_id,
    )

    if not row:
        return jsonify({
            "success": False,
            "error":
                "Môn học không tồn tại.",
        }), 404

    db.session.delete(
        row
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "subjectId":
            str(subject_id),
    }), 200


# =========================================================
# GET TESTS
# =========================================================

@classroom_bp.get(
    "/<int:classroom_id>/subjects/<int:subject_id>/tests"
)
@auth_required
def get_subject_tests(
    classroom_id,
    subject_id,
):

    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    subject = get_subject_or_none(
        classroom_id,
        subject_id,
    )

    if not classroom or not subject:
        return jsonify({
            "success": False,
            "error":
                "Lớp hoặc môn học không tồn tại.",
        }), 404

    if not can_access_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    rows = (
        db.session.execute(
            db.select(
                ClassroomSubjectTest
            )
            .where(
                ClassroomSubjectTest.subject_id
                == subject_id,

                ClassroomSubjectTest.classroom_id
                == classroom_id,
            )
            .order_by(
                ClassroomSubjectTest.display_order.asc(),
                ClassroomSubjectTest.id.asc(),
            )
        )
        .scalars()
        .all()
    )

    return jsonify({
        "success": True,

        "tests": [
            serialize_subject_test(
                row
            )
            for row in rows
        ],

        "count":
            len(rows),
    }), 200


# =========================================================
# CREATE TEST
# =========================================================

@classroom_bp.post(
    "/<int:classroom_id>/subjects/<int:subject_id>/tests"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)

def create_subject_test(
    classroom_id,
    subject_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    subject = get_subject_or_none(
        classroom_id,
        subject_id,
    )

    if not classroom or not subject:
        return jsonify({
            "success": False,
            "error":
                "Lớp hoặc môn học không tồn tại.",
        }), 404

    if not can_teach_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    data = request.get_json(
        silent=True
    )

    if data is None:
        data = {}

    if not isinstance(
        data,
        dict,
    ):
        return jsonify({
            "success": False,
            "error":
                "Dữ liệu gửi lên phải là JSON object.",
        }), 400

    name = normalize_text(
        data.get(
            "name"
        )
    )

    if not name:
        return jsonify({
            "success": False,
            "error":
                "Tên cột điểm không được để trống.",
        }), 400

    max_order = (
        db.session.scalar(
            db.select(
                db.func.max(
                    ClassroomSubjectTest.display_order
                )
            )
            .where(
                ClassroomSubjectTest.subject_id
                == subject_id
            )
        )
        or 0
    )

    raw_max_score = data.get(
        "maxScore"
    )

    if raw_max_score in (
        None,
        "",
    ):
        raw_max_score = 10

    if isinstance(
        raw_max_score,
        bool,
    ):
        return jsonify({
            "success": False,
            "error":
                "Điểm tối đa không hợp lệ.",
        }), 400

    try:
        max_score = float(
            raw_max_score
        )
    except (
        TypeError,
        ValueError,
    ):
        return jsonify({
            "success": False,
            "error":
                "Điểm tối đa không hợp lệ.",
        }), 400

    if (
        not math.isfinite(
            max_score
        )
        or max_score <= 0
        or max_score > 1000
    ):
        return jsonify({
            "success": False,
            "error":
                "Điểm tối đa phải lớn hơn 0 và không vượt quá 1000.",
        }), 400

    raw_display_order = data.get(
        "displayOrder"
    )

    if raw_display_order in (
        None,
        "",
    ):
        display_order = (
            int(max_order)
            + 1
        )
    else:
        if isinstance(
            raw_display_order,
            bool,
        ):
            return jsonify({
                "success": False,
                "error":
                    "Thứ tự hiển thị không hợp lệ.",
            }), 400

        try:
            display_order = int(
                raw_display_order
            )
        except (
            TypeError,
            ValueError,
        ):
            return jsonify({
                "success": False,
                "error":
                    "Thứ tự hiển thị không hợp lệ.",
            }), 400

    known = {
        "name",
        "code",
        "displayOrder",
        "maxScore",
    }

    row = ClassroomSubjectTest(
        subject_id=
            subject_id,

        classroom_id=
            classroom_id,

        name=
            name,

        code=
            normalize_text(
                data.get(
                    "code"
                )
            ),

        display_order=
            display_order,

        max_score=
            max_score,

        test_data={
            key: value
            for key, value
            in data.items()
            if key not in known
        },
    )

    db.session.add(
        row
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "test":
            serialize_subject_test(
                row
            ),
    }), 201


# =========================================================
# UPDATE TEST
# =========================================================

@classroom_bp.patch(
    "/<int:classroom_id>/subjects/<int:subject_id>/tests/<int:test_id>"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)

def update_subject_test(
    classroom_id,
    subject_id,
    test_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    test = get_test_or_none(
        classroom_id,
        subject_id,
        test_id,
    )

    if not classroom or not test:
        return jsonify({
            "success": False,
            "error":
                "Cột điểm không tồn tại.",
        }), 404

    if not can_teach_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    data = request.get_json(
        silent=True
    )

    if data is None:
        data = {}

    if not isinstance(
        data,
        dict,
    ):
        return jsonify({
            "success": False,
            "error":
                "Dữ liệu gửi lên phải là JSON object.",
        }), 400

    if "name" in data:
        name = normalize_text(
            data.get(
                "name"
            )
        )

        if not name:
            return jsonify({
                "success": False,
                "error":
                    "Tên cột điểm không được để trống.",
            }), 400

        test.name = name

    if "code" in data:
        test.code = normalize_text(
            data.get(
                "code"
            )
        )

    if "displayOrder" in data:
        raw_display_order = data.get(
            "displayOrder"
        )

        if isinstance(
            raw_display_order,
            bool,
        ):
            return jsonify({
                "success": False,
                "error":
                    "displayOrder không hợp lệ.",
            }), 400

        try:
            test.display_order = int(
                raw_display_order
                or 0
            )

        except (
            TypeError,
            ValueError,
        ):
            return jsonify({
                "success": False,
                "error":
                    "displayOrder không hợp lệ.",
            }), 400

    if "maxScore" in data:
        raw_max_score = data.get(
            "maxScore"
        )

        if isinstance(
            raw_max_score,
            bool,
        ):
            return jsonify({
                "success": False,
                "error":
                    "Điểm tối đa không hợp lệ.",
            }), 400

        try:
            max_score = float(
                raw_max_score
            )

        except (
            TypeError,
            ValueError,
        ):
            return jsonify({
                "success": False,
                "error":
                    "Điểm tối đa không hợp lệ.",
            }), 400

        if (
            not math.isfinite(
                max_score
            )
            or max_score <= 0
            or max_score > 1000
        ):
            return jsonify({
                "success": False,
                "error":
                    "Điểm tối đa phải lớn hơn 0 và không vượt quá 1000.",
            }), 400

        test.max_score = (
            max_score
        )

    known = {
        "name",
        "code",
        "displayOrder",
        "maxScore",
        "id",
        "subjectId",
        "classId",
    }

    extra = dict(
        test.test_data
        or {}
    )

    for key, value in data.items():
        if key in known:
            continue

        extra[
            key
        ] = value

    test.test_data = (
        extra
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "test":
            serialize_subject_test(
                test
            ),
    }), 200


# =========================================================
# DELETE TEST
#
# Also removes this test key from each student's scores.
# =========================================================

@classroom_bp.delete(
    "/<int:classroom_id>/subjects/<int:subject_id>/tests/<int:test_id>"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)

def delete_subject_test(
    classroom_id,
    subject_id,
    test_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    test = get_test_or_none(
        classroom_id,
        subject_id,
        test_id,
    )

    if not classroom or not test:
        return jsonify({
            "success": False,
            "error":
                "Cột điểm không tồn tại.",
        }), 404

    if not can_teach_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    rows = (
        db.session.execute(
            db.select(
                ClassroomScore
            )
            .where(
                ClassroomScore.subject_id
                == subject_id
            )
        )
        .scalars()
        .all()
    )

    key = str(
        test_id
    )

    for row in rows:
        scores = dict(
            row.scores
            or {}
        )

        scores.pop(
            key,
            None,
        )

        row.scores = scores
        row.average = (
            calculate_score_average(
                scores
            )
        )

    db.session.delete(
        test
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "testId":
            str(test_id),
    }), 200


# =========================================================
# GET SCORES
#
# Teacher:
#   gets every student's score.
#
# Student:
#   only gets own score.
# =========================================================

@classroom_bp.get(
    "/<int:classroom_id>/subjects/<int:subject_id>/scores"
)
@auth_required
def get_subject_scores(
    classroom_id,
    subject_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    subject = get_subject_or_none(
        classroom_id,
        subject_id,
    )

    if not classroom or not subject:
        return jsonify({
            "success": False,
            "error":
                "Lớp hoặc môn học không tồn tại.",
        }), 404

    statement = db.select(
        ClassroomScore
    ).where(
        ClassroomScore.subject_id
        == subject_id,

        ClassroomScore.classroom_id
        == classroom_id,
    )

    if not can_teach_class(
        classroom,
        actor,
    ):
        member = find_member_for_user(
            classroom_id,
            actor,
        )

        if (
            not member
            or normalize_text(
                member.status
            ).lower()
            != "active"
        ):
            return jsonify({
                "success": False,
                "error":
                    "Bạn không phải thành viên đang hoạt động của lớp.",
            }), 403

        statement = statement.where(
            ClassroomScore.member_id
            == member.id
        )

    rows = (
        db.session.execute(
            statement.order_by(
                ClassroomScore.member_id.asc()
            )
        )
        .scalars()
        .all()
    )

    return jsonify({
        "success": True,

        "scores": [
            serialize_score(
                row
            )
            for row in rows
        ],

        "count":
            len(rows),
    }), 200


# =========================================================
# GET ONE MEMBER SCORE
# =========================================================

@classroom_bp.get(
    "/<int:classroom_id>/subjects/<int:subject_id>/scores/<int:member_id>"
)
@auth_required
def get_member_score(
    classroom_id,
    subject_id,
    member_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    subject = get_subject_or_none(
        classroom_id,
        subject_id,
    )

    member = db.session.get(
        ClassroomMember,
        member_id,
    )

    if (
        not classroom
        or not subject
        or not member
        or int(
            member.classroom_id
        )
        != int(
            classroom_id
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Dữ liệu không tồn tại.",
        }), 404

    own_record = bool(
        actor
        and member.user_id
        and int(actor.id) == int(member.user_id)
        and normalize_text(member.status).lower() == "active"
    )

    if not (
        own_record
        or can_teach_class(
            classroom,
            actor,
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    row = db.session.scalar(
        db.select(
            ClassroomScore
        )
        .where(
            ClassroomScore.subject_id
            == subject_id,

            ClassroomScore.member_id
            == member_id,
        )
    )

    return jsonify({
        "success": True,

        "score":
            (
                serialize_score(
                    row
                )
                if row
                else None
            ),
    }), 200


# =========================================================
# UPSERT MEMBER SCORES
#
# Compatible forms:
#
# {
#   "scores": {
#       "1": 8.5,
#       "2": 9
#   }
# }
#
# OR:
#
# {
#   "testId": 1,
#   "score": 8.5
# }
# =========================================================

@classroom_bp.patch(
    "/<int:classroom_id>/subjects/<int:subject_id>/scores/<int:member_id>"
)
@auth_required
@rate_limit(limit=240, window=3600, per_user=True)

def update_member_score(
    classroom_id,
    subject_id,
    member_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    subject = get_subject_or_none(
        classroom_id,
        subject_id,
    )

    member = db.session.get(
        ClassroomMember,
        member_id,
    )

    if (
        not classroom
        or not subject
        or not member
        or int(
            member.classroom_id
        )
        != int(
            classroom_id
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Dữ liệu không tồn tại.",
        }), 404

    if not can_teach_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    data = request.get_json(
        silent=True
    )

    if data is None:
        data = {}

    if not isinstance(
        data,
        dict,
    ):
        return jsonify({
            "success": False,
            "error":
                "Dữ liệu gửi lên phải là JSON object.",
        }), 400

    row = db.session.scalar(
        db.select(
            ClassroomScore
        )
        .where(
            ClassroomScore.subject_id
            == subject_id,

            ClassroomScore.member_id
            == member_id,
        )
    )

    if not row:
        row = ClassroomScore(
            subject_id=
                subject_id,

            classroom_id=
                classroom_id,

            member_id=
                member_id,

            user_id=
                member.user_id,

            scores={},

            score_data={},
        )

        db.session.add(
            row
        )

        db.session.flush()

    scores = dict(
        row.scores
        or {}
    )

    if isinstance(
        data.get(
            "scores"
        ),
        dict,
    ):
        for key, value in (
            data.get(
                "scores"
            )
            or {}
        ).items():
            test_id = str(
                key
            )

            if not test_id.isdigit():
                return jsonify({
                    "success": False,
                    "error":
                        f"Cột điểm {key} không hợp lệ.",
                }), 400

            test = db.session.get(
                ClassroomSubjectTest,
                int(test_id),
            )

            if (
                not test
                or int(
                    test.subject_id
                )
                != int(
                    subject_id
                )
                or int(
                    test.classroom_id
                )
                != int(
                    classroom_id
                )
            ):
                return jsonify({
                    "success": False,
                    "error":
                        f"Cột điểm {key} không tồn tại.",
                }), 404

            if (
                value is None
                or value == ""
            ):
                scores.pop(
                    test_id,
                    None,
                )

                continue

            if isinstance(
                value,
                bool,
            ):
                return jsonify({
                    "success": False,
                    "error":
                        f"Điểm {key} không hợp lệ.",
                }), 400

            try:
                score_value = float(
                    value
                )

            except (
                TypeError,
                ValueError,
            ):
                return jsonify({
                    "success": False,
                    "error":
                        f"Điểm {key} không hợp lệ.",
                }), 400

            if not math.isfinite(
                score_value
            ):
                return jsonify({
                    "success": False,
                    "error":
                        f"Điểm {key} không hợp lệ.",
                }), 400

            max_score = float(
                test.max_score
                or 10
            )

            if (
                score_value < 0
                or score_value
                > max_score
            ):
                return jsonify({
                    "success": False,
                    "error":
                        (
                            f"Điểm phải từ 0 đến "
                            f"{max_score:g}."
                        ),
                }), 400

            scores[
                test_id
            ] = score_value

    elif (
        data.get(
            "testId"
        )
        is not None
    ):
        raw_test_id = data.get(
            "testId"
        )

        if isinstance(
            raw_test_id,
            bool,
        ):
            return jsonify({
                "success": False,
                "error":
                    "Cột điểm không hợp lệ.",
            }), 400

        test_id = str(
            raw_test_id
        )

        if not test_id.isdigit():
            return jsonify({
                "success": False,
                "error":
                    "Cột điểm không hợp lệ.",
            }), 400

        test = db.session.get(
            ClassroomSubjectTest,
            int(test_id),
        )

        if (
            not test
            or int(
                test.subject_id
            )
            != int(
                subject_id
            )
            or int(
                test.classroom_id
            )
            != int(
                classroom_id
            )
        ):
            return jsonify({
                "success": False,
                "error":
                    "Cột điểm không tồn tại.",
            }), 404

        value = data.get(
            "score"
        )

        if (
            value is None
            or value == ""
        ):
            scores.pop(
                test_id,
                None,
            )

        else:
            if isinstance(
                value,
                bool,
            ):
                return jsonify({
                    "success": False,
                    "error":
                        "Điểm không hợp lệ.",
                }), 400

            try:
                score_value = float(
                    value
                )

            except (
                TypeError,
                ValueError,
            ):
                return jsonify({
                    "success": False,
                    "error":
                        "Điểm không hợp lệ.",
                }), 400

            if not math.isfinite(
                score_value
            ):
                return jsonify({
                    "success": False,
                    "error":
                        "Điểm không hợp lệ.",
                }), 400

            max_score = float(
                test.max_score
                or 10
            )

            if (
                score_value < 0
                or score_value
                > max_score
            ):
                return jsonify({
                    "success": False,
                    "error":
                        (
                            f"Điểm phải từ 0 đến "
                            f"{max_score:g}."
                        ),
                }), 400

            scores[
                test_id
            ] = score_value

    else:
        return jsonify({
            "success": False,
            "error":
                "Thiếu dữ liệu điểm.",
        }), 400

    known = {
        "scores",
        "testId",
        "score",
    }

    extra = dict(
        row.score_data
        or {}
    )

    for key, value in data.items():
        if key in known:
            continue

        extra[
            key
        ] = value

    row.scores = scores
    row.average = (
        calculate_score_average(
            scores
        )
    )
    row.score_data = extra

    db.session.commit()

    return jsonify({
        "success": True,
        "score":
            serialize_score(
                row
            ),
    }), 200

# =========================================================
# PHASE 4
# CLASSROOM SCHEDULE
# =========================================================


def serialize_schedule(
    row,
):
    data = dict(
        row.schedule_data
        or {}
    )

    data.update({
        "id":
            str(
                row.id
            ),

        "legacyId":
            row.legacy_id
            or "",

        "classId":
            str(
                row.classroom_id
            ),

        "teacherId":
            (
                str(
                    row.teacher_id
                )
                if row.teacher_id
                else ""
            ),

        "weekKey":
            row.week_key
            or "",

        "date":
            row.schedule_date
            or "",

        "scheduleDate":
            row.schedule_date
            or "",

        "weekday":
            row.weekday,

        "startTime":
            row.start_time
            or "",

        "endTime":
            row.end_time
            or "",

        "title":
            row.title
            or "",

        "lessonContent":
            row.lesson_content
            or "",

        "room":
            row.room
            or "",

        "note":
            row.note
            or "",

        "important":
            bool(
                row.important
            ),

        "kind":
            row.kind
            or "",

        "expiresAtMs":
            row.expires_at_ms,

        "createdAt":
            (
                row.created_at.isoformat()
                if row.created_at
                else None
            ),

        "updatedAt":
            (
                row.updated_at.isoformat()
                if row.updated_at
                else None
            ),
    })

    return data


def get_schedule_or_none(
    classroom_id,
    schedule_id,
):
    row = db.session.get(
        ClassroomSchedule,
        schedule_id,
    )

    if (
        not row
        or int(
            row.classroom_id
        )
        != int(
            classroom_id
        )
    ):
        return None

    return row


def apply_schedule_batch_payload(row, data, actor):
    if not isinstance(data, dict):
        raise ValueError("Dữ liệu lịch không hợp lệ.")

    mapping = {
        "weekKey": "week_key",
        "date": "schedule_date",
        "scheduleDate": "schedule_date",
        "weekday": "weekday",
        "startTime": "start_time",
        "endTime": "end_time",
        "title": "title",
        "lessonContent": "lesson_content",
        "room": "room",
        "note": "note",
        "important": "important",
        "kind": "kind",
        "expiresAtMillis": "expires_at_ms",
        "expiresAtMs": "expires_at_ms",
    }

    for source, target in mapping.items():
        if source in data:
            setattr(row, target, data.get(source))

    if "important" in data:
        if not isinstance(
            data.get("important"),
            bool,
        ):
            raise ValueError(
                "important phải là boolean."
            )

        row.important = data.get(
            "important"
        )

    expires_key = None

    if "expiresAtMs" in data:
        expires_key = "expiresAtMs"
    elif "expiresAtMillis" in data:
        expires_key = "expiresAtMillis"

    if expires_key is not None:
        expires_value = data.get(
            expires_key
        )

        if (
            expires_value is None
            or expires_value == ""
        ):
            row.expires_at_ms = None

        else:
            if isinstance(
                expires_value,
                bool,
            ):
                raise ValueError(
                    "expiresAtMs không hợp lệ."
                )

            try:
                expires_value = int(
                    expires_value
                )
            except (
                TypeError,
                ValueError,
            ) as error:
                raise ValueError(
                    "expiresAtMs không hợp lệ."
                ) from error

            if expires_value < 0:
                raise ValueError(
                    "expiresAtMs không được âm."
                )

            row.expires_at_ms = expires_value

    if row.weekday is not None:
        if isinstance(
            row.weekday,
            bool,
        ):
            raise ValueError(
                "Thứ trong tuần không hợp lệ."
            )

        try:
            row.weekday = int(
                row.weekday
            )
        except (
            TypeError,
            ValueError,
        ) as error:
            raise ValueError(
                "Thứ trong tuần không hợp lệ."
            ) from error

        if (
            row.weekday < 0
            or row.weekday > 6
        ):
            raise ValueError(
                "Thứ trong tuần phải từ 0 đến 6."
            )

    for field_name in ("week_key", "schedule_date", "start_time", "end_time", "title"):
        value = getattr(row, field_name, None)
        if not normalize_text(value):
            raise ValueError(f"Thiếu trường lịch bắt buộc: {field_name}.")

    text_limits = {
        "week_key": 50,
        "schedule_date": 20,
        "start_time": 20,
        "end_time": 20,
        "title": 500,
        "room": 255,
        "kind": 100,
    }

    for field_name, max_length in text_limits.items():
        value = getattr(
            row,
            field_name,
            None,
        )

        if (
            value is not None
            and len(normalize_text(value)) > max_length
        ):
            raise ValueError(
                f"{field_name} vượt quá {max_length} ký tự."
            )

    if not is_valid_date_key(
        row.schedule_date
    ):
        raise ValueError(
            "Ngày lịch phải có định dạng YYYY-MM-DD."
        )

    if not is_valid_time_key(
        row.start_time
    ):
        raise ValueError(
            "Giờ bắt đầu phải có định dạng HH:MM."
        )

    if not is_valid_time_key(
        row.end_time
    ):
        raise ValueError(
            "Giờ kết thúc phải có định dạng HH:MM."
        )

    if normalize_text(row.end_time) <= normalize_text(row.start_time):
        raise ValueError("Giờ kết thúc phải sau giờ bắt đầu.")

    if not row.teacher_id and actor:
        row.teacher_id = actor.id

    known = set(mapping) | {
        "id",
        "classId",
        "teacherId",
        "createdAt",
        "updatedAt",
    }
    extra = dict(row.schedule_data or {})
    for key, value in data.items():
        if key not in known:
            extra[key] = value
    row.schedule_data = extra
    row.updated_at = classroom_utc_now()


# =========================================================
# GET SCHEDULE
#
# Optional:
# ?weekKey=2026-W35
# ?date=2026-08-25
# =========================================================

@classroom_bp.get(
    "/<int:classroom_id>/schedule"
)
@auth_required
def get_schedule(
    classroom_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not can_access_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    statement = db.select(
        ClassroomSchedule
    ).where(
        ClassroomSchedule.classroom_id
        == classroom_id
    )

    week_key = normalize_text(
        request.args.get(
            "weekKey"
        )
    )

    schedule_date = normalize_text(
        request.args.get(
            "date"
        )
    )

    if week_key:
        statement = statement.where(
            ClassroomSchedule.week_key
            == week_key
        )

    if schedule_date:
        statement = statement.where(
            ClassroomSchedule.schedule_date
            == schedule_date
        )

    rows = (
        db.session.execute(
            statement.order_by(
                ClassroomSchedule.schedule_date.asc(),
                ClassroomSchedule.weekday.asc(),
                ClassroomSchedule.start_time.asc(),
                ClassroomSchedule.id.asc(),
            )
        )
        .scalars()
        .all()
    )

    return jsonify({
        "success": True,

        "schedule": [
            serialize_schedule(
                row
            )
            for row in rows
        ],

        "items": [
            serialize_schedule(
                row
            )
            for row in rows
        ],

        "count":
            len(
                rows
            ),

        "weekConfigs":
            dict(
                classroom.schedule_week_configs
                or {}
            ),

        "timeRules":
            dict(
                classroom.schedule_time_rules
                or {}
            ),

        "contentRules":
            dict(
                classroom.schedule_content_rules
                or {}
            ),
    }), 200


# =========================================================
# CREATE SCHEDULE ITEM
# =========================================================

@classroom_bp.post(
    "/<int:classroom_id>/schedule"
)
@auth_required
@rate_limit(limit=240, window=3600, per_user=True)
def create_schedule(
    classroom_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not can_teach_class(
        classroom,
        actor,
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

    title = normalize_text(
        data.get(
            "title"
        )
    )

    if not title:
        return jsonify({
            "success": False,
            "error":
                "Nội dung lịch không được để trống.",
        }), 400

    weekday = data.get(
        "weekday"
    )

    if (
        weekday is not None
        and weekday != ""
    ):
        try:
            weekday = int(
                weekday
            )

        except (
            TypeError,
            ValueError,
        ):
            return jsonify({
                "success": False,
                "error":
                    "weekday không hợp lệ.",
            }), 400

    expires_at_ms = data.get(
        "expiresAtMs"
    )

    if (
        expires_at_ms is not None
        and expires_at_ms != ""
    ):
        try:
            expires_at_ms = int(
                expires_at_ms
            )

        except (
            TypeError,
            ValueError,
        ):
            return jsonify({
                "success": False,
                "error":
                    "expiresAtMs không hợp lệ.",
            }), 400

    known = {
        "weekKey",
        "date",
        "scheduleDate",
        "weekday",
        "startTime",
        "endTime",
        "title",
        "lessonContent",
        "room",
        "note",
        "important",
        "kind",
        "expiresAtMs",
    }

    row = ClassroomSchedule(
        classroom_id=
            classroom_id,

        teacher_id=
            actor.id,

        week_key=
            normalize_text(
                data.get(
                    "weekKey"
                )
            ),

        schedule_date=
            normalize_text(
                data.get(
                    "date"
                )
                or data.get(
                    "scheduleDate"
                )
            ),

        weekday=
            weekday,

        start_time=
            normalize_text(
                data.get(
                    "startTime"
                )
            ),

        end_time=
            normalize_text(
                data.get(
                    "endTime"
                )
            ),

        title=
            title,

        lesson_content=
            normalize_text(
                data.get(
                    "lessonContent"
                )
            ),

        room=
            normalize_text(
                data.get(
                    "room"
                )
            ),

        note=
            normalize_text(
                data.get(
                    "note"
                )
            ),

        important=
            bool(
                data.get(
                    "important",
                    False,
                )
            ),

        kind=
            normalize_text(
                data.get(
                    "kind"
                )
            ),

        expires_at_ms=
            expires_at_ms,

        schedule_data={
            key: value
            for key, value
            in data.items()
            if key not in known
        },
    )

    db.session.add(
        row
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "schedule":
            serialize_schedule(
                row
            ),
    }), 201


# =========================================================
# UPDATE SCHEDULE ITEM
# =========================================================

@classroom_bp.patch(
    "/<int:classroom_id>/schedule/<int:schedule_id>"
)
@auth_required
@rate_limit(limit=240, window=3600, per_user=True)

def update_schedule(
    classroom_id,
    schedule_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not can_teach_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    row = get_schedule_or_none(
        classroom_id,
        schedule_id,
    )

    if not row:
        return jsonify({
            "success": False,
            "error":
                "Lịch học không tồn tại.",
        }), 404

    data = request.get_json(
        silent=True
    )

    if data is None:
        data = {}

    if not isinstance(
        data,
        dict,
    ):
        return jsonify({
            "success": False,
            "error":
                "Dữ liệu gửi lên phải là JSON object.",
        }), 400

    mapping = {
        "weekKey":
            "week_key",

        "startTime":
            "start_time",

        "endTime":
            "end_time",

        "title":
            "title",

        "lessonContent":
            "lesson_content",

        "room":
            "room",

        "note":
            "note",

        "kind":
            "kind",
    }

    for key, attr in mapping.items():
        if key in data:
            setattr(
                row,
                attr,
                normalize_text(
                    data.get(
                        key
                    )
                ),
            )

    if (
        "startTime" in data
        and not is_valid_time_key(
            row.start_time
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "startTime phải có định dạng HH:MM hợp lệ.",
        }), 400

    if (
        "endTime" in data
        and not is_valid_time_key(
            row.end_time
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "endTime phải có định dạng HH:MM hợp lệ.",
        }), 400

    if (
        normalize_text(
            row.start_time
        )
        and normalize_text(
            row.end_time
        )
        and (
            not is_valid_time_key(
                row.start_time
            )
            or not is_valid_time_key(
                row.end_time
            )
            or row.end_time
            <= row.start_time
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Giờ kết thúc phải sau giờ bắt đầu.",
        }), 400

    if (
        "date" in data
        or "scheduleDate" in data
    ):
        schedule_date = normalize_text(
            data.get(
                "date"
            )
            or data.get(
                "scheduleDate"
            )
        )

        if not is_valid_date_key(
            schedule_date
        ):
            return jsonify({
                "success": False,
                "error":
                    "Ngày lịch phải có định dạng YYYY-MM-DD.",
            }), 400

        row.schedule_date = (
            schedule_date
        )

    if (
        "date" in data
        or "scheduleDate" in data
    ):
        schedule_date = normalize_text(
            data.get(
                "date"
            )
            or data.get(
                "scheduleDate"
            )
        )

        if not is_valid_date_key(
            schedule_date
        ):
            return jsonify({
                "success": False,
                "error":
                    "Ngày lịch phải có định dạng YYYY-MM-DD.",
            }), 400

        row.schedule_date = (
            schedule_date
        )

    if "weekday" in data:
        value = data.get(
            "weekday"
        )

        if (
            value is None
            or value == ""
        ):
            row.weekday = None

        else:
            if isinstance(
                value,
                bool,
            ):
                return jsonify({
                    "success": False,
                    "error":
                        "weekday không hợp lệ.",
                }), 400

            try:
                weekday = int(
                    value
                )

            except (
                TypeError,
                ValueError,
            ):
                return jsonify({
                    "success": False,
                    "error":
                        "weekday không hợp lệ.",
                }), 400

            if (
                weekday < 0
                or weekday > 6
            ):
                return jsonify({
                    "success": False,
                    "error":
                        "weekday phải từ 0 đến 6.",
                }), 400

            row.weekday = weekday

    if "important" in data:
        value = data.get(
            "important"
        )

        if not isinstance(
            value,
            bool,
        ):
            return jsonify({
                "success": False,
                "error":
                    "important phải là boolean.",
            }), 400

        row.important = value

    if "expiresAtMs" in data:
        value = data.get(
            "expiresAtMs"
        )

        if (
            value is None
            or value == ""
        ):
            row.expires_at_ms = None

        else:
            if isinstance(
                value,
                bool,
            ):
                return jsonify({
                    "success": False,
                    "error":
                        "expiresAtMs không hợp lệ.",
                }), 400

            try:
                expires_at_ms = int(
                    value
                )

            except (
                TypeError,
                ValueError,
            ):
                return jsonify({
                    "success": False,
                    "error":
                        "expiresAtMs không hợp lệ.",
                }), 400

            if expires_at_ms < 0:
                return jsonify({
                    "success": False,
                    "error":
                        "expiresAtMs không được âm.",
                }), 400

            row.expires_at_ms = (
                expires_at_ms
            )

    known = {
        *mapping.keys(),
        "date",
        "scheduleDate",
        "weekday",
        "important",
        "expiresAtMs",
        "id",
        "classId",
        "teacherId",
    }

    extra = dict(
        row.schedule_data
        or {}
    )

    for key, value in data.items():
        if key in known:
            continue

        extra[
            key
        ] = value

    row.schedule_data = (
        extra
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "schedule":
            serialize_schedule(
                row
            ),
    }), 200


# =========================================================
# DELETE SCHEDULE ITEM
# =========================================================

@classroom_bp.delete(
    "/<int:classroom_id>/schedule/<int:schedule_id>"
)
@auth_required
@rate_limit(limit=240, window=3600, per_user=True)
def delete_schedule(
    classroom_id,
    schedule_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not can_teach_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    row = get_schedule_or_none(
        classroom_id,
        schedule_id,
    )

    if not row:
        return jsonify({
            "success": False,
            "error":
                "Lịch học không tồn tại.",
        }), 404

    db.session.delete(
        row
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "scheduleId":
            str(
                schedule_id
            ),
    }), 200


# =========================================================
# SCHEDULE CONFIG
#
# Replaces:
# scheduleWeekConfigs
# scheduleTimeRules
# scheduleContentRules
# =========================================================

@classroom_bp.get(
    "/<int:classroom_id>/schedule-config"
)
@auth_required
def get_schedule_config(
    classroom_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not can_access_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    return jsonify({
        "success": True,

        "weekConfigs":
            dict(
                classroom.schedule_week_configs
                or {}
            ),

        "timeRules":
            dict(
                classroom.schedule_time_rules
                or {}
            ),

        "contentRules":
            dict(
                classroom.schedule_content_rules
                or {}
            ),
    }), 200


@classroom_bp.patch(
    "/<int:classroom_id>/schedule-config"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)

def update_schedule_config(
    classroom_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not can_teach_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    data = request.get_json(
        silent=True
    )

    if data is None:
        data = {}

    if not isinstance(
        data,
        dict,
    ):
        return jsonify({
            "success": False,
            "error":
                "Dữ liệu gửi lên phải là JSON object.",
        }), 400

    config_fields = (
        (
            "weekConfigs",
            "scheduleWeekConfigs",
            "weekConfigs",
        ),
        (
            "timeRules",
            "scheduleTimeRules",
            "timeRules",
        ),
        (
            "contentRules",
            "scheduleContentRules",
            "contentRules",
        ),
    )

    validated_configs = {}

    for (
        primary_key,
        legacy_key,
        output_key,
    ) in config_fields:
        if (
            primary_key not in data
            and legacy_key not in data
        ):
            continue

        value = (
            data.get(primary_key)
            if primary_key in data
            else data.get(legacy_key)
        )

        if value is None:
            value = {}

        if not isinstance(
            value,
            dict,
        ):
            return jsonify({
                "success": False,
                "error":
                    f"{output_key} phải là JSON object.",
            }), 400

        validated_configs[
            output_key
        ] = value

    if "weekConfigs" in validated_configs:
        classroom.schedule_week_configs = dict(
            validated_configs[
                "weekConfigs"
            ]
        )

    if "timeRules" in validated_configs:
        classroom.schedule_time_rules = dict(
            validated_configs[
                "timeRules"
            ]
        )

    if "contentRules" in validated_configs:
        classroom.schedule_content_rules = dict(
            validated_configs[
                "contentRules"
            ]
        )

    db.session.commit()

    return jsonify({
        "success": True,

        "weekConfigs":
            dict(
                classroom.schedule_week_configs
                or {}
            ),

        "timeRules":
            dict(
                classroom.schedule_time_rules
                or {}
            ),

        "contentRules":
            dict(
                classroom.schedule_content_rules
                or {}
            ),
    }), 200


@classroom_bp.post(
    "/<int:classroom_id>/schedule/batch"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)
def batch_schedule(
    classroom_id,
):
    actor = current_user()
    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error": "Lớp học không tồn tại.",
        }), 404

    if not can_teach_class(classroom, actor):
        return jsonify({
            "success": False,
            "error": "Forbidden",
        }), 403

    data = request.get_json(
        silent=True
    )

    if data is None:
        data = {}

    if not isinstance(
        data,
        dict,
    ):
        return jsonify({
            "success": False,
            "error":
                "Dữ liệu gửi lên phải là JSON object.",
        }), 400

    creates = data.get("creates") or []
    updates = data.get("updates") or []
    delete_ids = data.get("deleteIds") or []
    config = data.get("config") or {}

    if not all(isinstance(value, list) for value in [creates, updates, delete_ids]):
        return jsonify({
            "success": False,
            "error": "Batch payload không hợp lệ.",
        }), 400

    if not isinstance(config, dict):
        return jsonify({
            "success": False,
            "error": "Cấu hình lịch không hợp lệ.",
        }), 400

    for config_key in (
        "weekConfigs",
        "timeRules",
        "contentRules",
    ):
        if (
            config_key in config
            and config.get(
                config_key
            )
            is not None
            and not isinstance(
                config.get(
                    config_key
                ),
                dict,
            )
        ):
            return jsonify({
                "success": False,
                "error":
                    f"{config_key} phải là JSON object.",
            }), 400

    if len(creates) + len(updates) + len(delete_ids) > 1000:
        return jsonify({
            "success": False,
            "error": "Batch vượt quá 1000 thao tác.",
        }), 400

    expected_updated_at = str(data.get("expectedUpdatedAt") or "").strip()
    current_updated_at = (
        classroom.updated_at.isoformat()
        if classroom.updated_at
        else ""
    )

    if expected_updated_at and expected_updated_at != current_updated_at:
        return jsonify({
            "success": False,
            "error": "Dữ liệu lớp đã được cập nhật bởi phiên khác.",
            "code": "WRITE_CONFLICT",
            "currentUpdatedAt": current_updated_at,
        }), 409

    try:
        if "weekConfigs" in config:
            classroom.schedule_week_configs = dict(config.get("weekConfigs") or {})
        if "timeRules" in config:
            classroom.schedule_time_rules = dict(config.get("timeRules") or {})
        if "contentRules" in config:
            classroom.schedule_content_rules = dict(config.get("contentRules") or {})

        normalized_delete_ids = []

        for raw_id in delete_ids:
            if isinstance(
                raw_id,
                bool,
            ):
                raise ValueError(
                    "Mã lịch xóa không hợp lệ."
                )

            try:
                schedule_id = int(
                    raw_id
                )

            except (
                TypeError,
                ValueError,
            ):
                raise ValueError(
                    "Mã lịch xóa không hợp lệ."
                )

            if schedule_id <= 0:
                raise ValueError(
                    "Mã lịch xóa không hợp lệ."
                )

            normalized_delete_ids.append(
                schedule_id
            )

        normalized_update_ids = []

        for item in updates:
            if not isinstance(
                item,
                dict,
            ):
                raise ValueError(
                    "Dữ liệu cập nhật lịch không hợp lệ."
                )

            raw_id = item.get(
                "id"
            )

            if isinstance(
                raw_id,
                bool,
            ):
                raise ValueError(
                    "Mã lịch cập nhật không hợp lệ."
                )

            try:
                schedule_id = int(
                    raw_id
                )

            except (
                TypeError,
                ValueError,
            ):
                raise ValueError(
                    "Mã lịch cập nhật không hợp lệ."
                )

            if schedule_id <= 0:
                raise ValueError(
                    "Mã lịch cập nhật không hợp lệ."
                )

            payload = item.get(
                "payload"
            )

            if payload is None:
                payload = {}

            if not isinstance(
                payload,
                dict,
            ):
                raise ValueError(
                    "Payload cập nhật lịch phải là JSON object."
                )

            normalized_update_ids.append(
                schedule_id
            )

        all_target_ids = normalized_delete_ids + normalized_update_ids
        if any(schedule_id <= 0 for schedule_id in all_target_ids):
            raise ValueError("Mã lịch không hợp lệ.")
        if len(all_target_ids) != len(set(all_target_ids)):
            raise ValueError("Một lịch không thể bị ghi nhiều lần trong cùng batch.")

        for schedule_id in normalized_delete_ids:
            row = get_schedule_or_none(classroom_id, int(schedule_id))
            if not row:
                raise ValueError(f"Không tìm thấy lịch {schedule_id}.")
            db.session.delete(row)

        for item, schedule_id in zip(updates, normalized_update_ids):
            payload = item.get("payload") or {}
            row = get_schedule_or_none(classroom_id, int(schedule_id))
            if not row:
                raise ValueError(f"Không tìm thấy lịch {schedule_id}.")
            apply_schedule_batch_payload(row, payload, actor)

        created_rows = []
        for payload in creates:
            if not isinstance(payload, dict):
                raise ValueError("Dữ liệu lịch tạo mới không hợp lệ.")
            row = ClassroomSchedule(
                classroom_id=classroom_id,
                teacher_id=actor.id,
            )
            apply_schedule_batch_payload(row, payload, actor)
            db.session.add(row)
            created_rows.append(row)

        classroom.updated_at = classroom_utc_now()
        db.session.commit()

        rows = (
            db.session.execute(
                db.select(ClassroomSchedule)
                .where(ClassroomSchedule.classroom_id == classroom_id)
                .order_by(ClassroomSchedule.schedule_date.asc(), ClassroomSchedule.start_time.asc())
            )
            .scalars()
            .all()
        )

        return jsonify({
            "success": True,
            "schedule": [serialize_schedule(row) for row in rows],
            "classroomUpdatedAt": classroom.updated_at.isoformat(),
        }), 200

    except (TypeError, ValueError) as error:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": str(error),
        }), 400

    except Exception as error:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": "Không thể xử lý batch lịch học.",
        }), 500

# =========================================================
# UPDATE NOTIFICATION
# =========================================================

@classroom_bp.patch(
    "/<int:classroom_id>/notifications/<int:notification_id>"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)

def update_classroom_notification(
    classroom_id,
    notification_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    row = get_classroom_notification_or_none(
        classroom_id,
        notification_id,
    )

    if not row:
        return jsonify({
            "success": False,
            "error":
                "Thông báo không tồn tại.",
        }), 404

    if not can_teach_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    data = request.get_json(
        silent=True
    )

    if data is None:
        data = {}

    if not isinstance(
        data,
        dict,
    ):
        return jsonify({
            "success": False,
            "error":
                "Dữ liệu JSON phải là object.",
        }), 400

    mapping = {
        "sourceKey":
            "source_key",

        "type":
            "notification_type",

        "notificationType":
            "notification_type",

        "severity":
            "severity",

        "title":
            "title",

        "message":
            "message",

        "content":
            "message",

        "contentHtml":
            "content_html",

        "kind":
            "notification_kind",

        "notificationKind":
            "notification_kind",

        "automaticLabel":
            "automatic_label",

        "recipientType":
            "recipient_type",

        "recipientEmail":
            "recipient_email",

        "authorName":
            "author_name",
    }

    for key, attribute in mapping.items():
        if key not in data:
            continue

        value = (
            normalize_email(
                data.get(
                    key
                )
            )
            if key
            == "recipientEmail"
            else normalize_text(
                data.get(
                    key
                )
            )
        )

        setattr(
            row,
            attribute,
            value,
        )

    if "systemGenerated" in data:
        row.system_generated = bool(
            data.get(
                "systemGenerated"
            )
        )

    if "attachments" in data:
        row.attachments = list(
            data.get(
                "attachments"
            )
            or []
        )

    if "recipientUid" in data:
        value = data.get(
            "recipientUid"
        )

        row.recipient_uid = (
            int(value)
            if str(
                value
                or ""
            ).isdigit()
            else None
        )

    if "recipientStudentId" in data:
        value = data.get(
            "recipientStudentId"
        )

        row.recipient_student_id = (
            int(value)
            if str(
                value
                or ""
            ).isdigit()
            else None
        )

    known = {
        *mapping.keys(),
        "systemGenerated",
        "attachments",
        "recipientUid",
        "recipientStudentId",
        "readBy",
        "dismissedBy",
        "id",
        "classId",
        "authorId",
    }

    extra = dict(
        row.notification_data
        or {}
    )

    for key, value in data.items():
        if key in known:
            continue

        extra[
            key
        ] = value

    row.notification_data = (
        extra
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "notification":
            serialize_classroom_notification(
                row
            ),
    }), 200


# =========================================================
# MARK READ
# =========================================================

@classroom_bp.post(
    "/<int:classroom_id>/notifications/<int:notification_id>/read"
)
@auth_required
@rate_limit(limit=300, window=3600, per_user=True)
def read_classroom_notification(
    classroom_id,
    notification_id,
):
    user = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    row = get_classroom_notification_or_none(
        classroom_id,
        notification_id,
    )

    if not classroom or not row:
        return jsonify({
            "success": False,
            "error":
                "Thông báo không tồn tại.",
        }), 404

    member = find_member_for_user(
        classroom_id,
        user,
    )

    if not (
        is_admin(
            user
        )
        or is_class_owner(
            classroom,
            user,
        )
        or is_active_class_member(member)
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    uid = str(
        user.id
    )

    read_by = {
        str(item)
        for item in (
            row.read_by
            or []
        )
    }

    read_by.add(
        uid
    )

    row.read_by = list(
        sorted(
            read_by,
            key=str,
        )
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "notification":
            serialize_classroom_notification(
                row
            ),
    }), 200


# =========================================================
# DISMISS
# =========================================================

@classroom_bp.post(
    "/<int:classroom_id>/notifications/<int:notification_id>/dismiss"
)
@auth_required
@rate_limit(limit=300, window=3600, per_user=True)

def dismiss_classroom_notification(
    classroom_id,
    notification_id,
):
    user = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    row = get_classroom_notification_or_none(
        classroom_id,
        notification_id,
    )

    if not classroom or not row:
        return jsonify({
            "success": False,
            "error":
                "Thông báo không tồn tại.",
        }), 404

    member = find_member_for_user(
        classroom_id,
        user,
    )

    if not (
        is_admin(
            user
        )
        or is_class_owner(
            classroom,
            user,
        )
        or is_active_class_member(member)
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    uid = str(
        user.id
    )

    dismissed = {
        str(item)
        for item in (
            row.dismissed_by
            or []
        )
    }

    dismissed.add(
        uid
    )

    row.dismissed_by = list(
        sorted(
            dismissed,
            key=str,
        )
    )

    # Keep source-level dismissal compatibility.
    if row.source_key:
        keys = {
            str(item)
            for item in (
                classroom
                .dismissed_notification_source_keys
                or []
            )
        }

        keys.add(
            row.source_key
        )

        classroom.dismissed_notification_source_keys = list(
            sorted(
                keys,
                key=str,
            )
        )

    db.session.commit()

    return jsonify({
        "success": True,
        "notification":
            serialize_classroom_notification(
                row
            ),
    }), 200


# =========================================================
# DELETE NOTIFICATION
# =========================================================

@classroom_bp.delete(
    "/<int:classroom_id>/notifications/<int:notification_id>"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)

def delete_classroom_notification(
    classroom_id,
    notification_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    row = get_classroom_notification_or_none(
        classroom_id,
        notification_id,
    )

    if not classroom or not row:
        return jsonify({
            "success": False,
            "error":
                "Thông báo không tồn tại.",
        }), 404

    if not can_teach_class(
        classroom,
        actor,
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
        "notificationId":
            str(
                notification_id
            ),
    }), 200

# =========================================================
# PHASE 5 HELPERS
# CLASSROOM NOTIFICATIONS
# =========================================================


def serialize_classroom_notification(
    row,
):
    data = dict(
        row.notification_data
        or {}
    )

    data.update({
        "id":
            str(
                row.id
            ),

        "legacyId":
            row.legacy_id
            or "",

        "classId":
            str(
                row.classroom_id
            ),

        "sourceKey":
            row.source_key
            or "",

        "type":
            row.notification_type
            or "",

        "notificationType":
            row.notification_type
            or "",

        "severity":
            row.severity
            or "",

        "title":
            row.title
            or "",

        "message":
            row.message
            or "",

        "contentHtml":
            row.content_html
            or "",

        "kind":
            row.notification_kind
            or "",

        "notificationKind":
            row.notification_kind
            or "",

        "systemGenerated":
            bool(
                row.system_generated
            ),

        "automaticLabel":
            row.automatic_label
            or "",

        "recipientType":
            row.recipient_type
            or "",

        "recipientUid":
            (
                str(
                    row.recipient_uid
                )
                if row.recipient_uid
                else ""
            ),

        "recipientEmail":
            row.recipient_email
            or "",

        "recipientStudentId":
            (
                str(
                    row.recipient_student_id
                )
                if row.recipient_student_id
                else ""
            ),

        "authorId":
            (
                str(
                    row.author_id
                )
                if row.author_id
                else ""
            ),

        "authorName":
            row.author_name
            or "",

        "attachments":
            list(
                row.attachments
                or []
            ),

        "readBy":
            [
                str(
                    item
                )
                for item in (
                    row.read_by
                    or []
                )
            ],

        "dismissedBy":
            [
                str(
                    item
                )
                for item in (
                    row.dismissed_by
                    or []
                )
            ],

        "createdAt":
            (
                row.created_at.isoformat()
                if row.created_at
                else None
            ),

        "updatedAt":
            (
                row.updated_at.isoformat()
                if row.updated_at
                else None
            ),
    })

    return data


def get_classroom_notification_or_none(
    classroom_id,
    notification_id,
):
    row = db.session.get(
        ClassroomNotification,
        notification_id,
    )

    if (
        not row
        or int(
            row.classroom_id
        )
        != int(
            classroom_id
        )
    ):
        return None

    return row


def notification_visible_to_user(
    row,
    user,
    member,
):
    if not user:
        return False

    recipient_type = normalize_text(
        row.recipient_type
    ).lower()

    # -----------------------------------------------------
    # PUBLIC / WHOLE CLASS
    # -----------------------------------------------------

    if (
        not recipient_type
        or recipient_type
        in {
            "all",
            "class",
            "everyone",
        }
    ):
        return True

    # -----------------------------------------------------
    # PRIVATE STUDENT / USER
    # -----------------------------------------------------

    if recipient_type in {
        "student",
        "user",
        "private",
    }:
        if (
            row.recipient_uid
            and int(
                row.recipient_uid
            )
            == int(
                user.id
            )
        ):
            return True

        if (
            row.recipient_email
            and normalize_email(
                row.recipient_email
            )
            == normalize_email(
                user.email
            )
        ):
            return True

        if (
            member
            and row.recipient_student_id
            and int(
                row.recipient_student_id
            )
            == int(
                member.id
            )
        ):
            return True

        return False

    # -----------------------------------------------------
    # TEACHERS
    # -----------------------------------------------------

    if recipient_type in {
        "teacher",
        "teachers",
    }:
        if not is_active_class_member(
            member
        ):
            return False

        member_role = normalize_text(
            member.role
        ).upper()

        class_role = normalize_text(
            member.class_role
        ).lower()

        return (
            member_role in {
                "TEACHER",
                "ADMIN_DEV",
            }
            or class_role
            == "intern_teacher"
        )

    # Unknown recipient types fail closed.
    return False

# =========================================================
# GET CLASSROOM NOTIFICATIONS
# =========================================================

@classroom_bp.get(
    "/<int:classroom_id>/notifications"
)
@auth_required
def get_classroom_notifications(
    classroom_id,
):
    user = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    member = find_member_for_user(
        classroom_id,
        user,
    )

    if not (
        is_admin(
            user
        )
        or is_class_owner(
            classroom,
            user,
        )
        or is_active_class_member(member)
    ):
        return jsonify({
            "success": False,
            "error":
                "Bạn không phải thành viên của lớp.",
        }), 403

    try:
        limit_value = int(
            request.args.get(
                "limit"
            )
            or 200
        )

    except (
        TypeError,
        ValueError,
    ):
        limit_value = 200

    limit_value = max(
        1,
        min(
            limit_value,
            500,
        ),
    )

    statement = (
        db.select(
            ClassroomNotification
        )
        .where(
            ClassroomNotification.classroom_id
            == classroom_id
        )
    )

    notification_type = normalize_text(
        request.args.get(
            "type"
        )
    )

    if notification_type:
        statement = statement.where(
            ClassroomNotification.notification_type
            == notification_type
        )

    rows = (
        db.session.execute(
            statement
            .order_by(
                ClassroomNotification.created_at.desc(),
                ClassroomNotification.id.desc(),
            )
            .limit(
                limit_value
            )
        )
        .scalars()
        .all()
    )

    show_all = (
        normalize_text(
            request.args.get(
                "all"
            )
        ).lower()
        in {
            "1",
            "true",
            "yes",
        }
    )

    if not (
        show_all
        and can_teach_class(
            classroom,
            user,
        )
    ):
        rows = [
            row
            for row in rows
            if notification_visible_to_user(
                row,
                user,
                member,
            )
        ]

    return jsonify({
        "success": True,

        "notifications": [
            serialize_classroom_notification(
                row
            )
            for row in rows
        ],

        "count":
            len(
                rows
            ),
    }), 200


# =========================================================
# CREATE CLASSROOM NOTIFICATION
# =========================================================

@classroom_bp.post(
    "/<int:classroom_id>/notifications"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)
def create_classroom_notification(
    classroom_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not can_teach_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    data = request.get_json(
        silent=True
    )

    if data is None:
        data = {}

    if not isinstance(
        data,
        dict,
    ):
        return jsonify({
            "success": False,
            "error":
                "Dữ liệu JSON phải là object.",
        }), 400

    title = normalize_text(
        data.get(
            "title"
        )
    )

    message = normalize_text(
        data.get(
            "message"
        )
        or data.get(
            "content"
        )
    )

    if not title and not message:
        return jsonify({
            "success": False,
            "error":
                "Thông báo không được để trống.",
        }), 400

    recipient_uid = data.get(
        "recipientUid"
    )

    if str(
        recipient_uid
        or ""
    ).isdigit():
        recipient_uid = int(
            recipient_uid
        )
    else:
        recipient_uid = None

    recipient_student_id = data.get(
        "recipientStudentId"
    )

    if str(
        recipient_student_id
        or ""
    ).isdigit():
        recipient_student_id = int(
            recipient_student_id
        )
    else:
        recipient_student_id = None

    source_key = normalize_text(
        data.get(
            "sourceKey"
        )
    )

    # -----------------------------------------------------
    # IDEMPOTENT SYSTEM NOTIFICATION
    # -----------------------------------------------------

    if source_key:
        existing = db.session.scalar(
            db.select(
                ClassroomNotification
            )
            .where(
                ClassroomNotification.classroom_id
                == classroom_id,

                ClassroomNotification.source_key
                == source_key,
            )
        )

        if existing:
            return jsonify({
                "success": True,
                "created":
                    False,

                "notification":
                    serialize_classroom_notification(
                        existing
                    ),
            }), 200

    known = {
        "sourceKey",
        "type",
        "notificationType",
        "severity",
        "title",
        "message",
        "content",
        "contentHtml",
        "kind",
        "notificationKind",
        "systemGenerated",
        "automaticLabel",
        "recipientType",
        "recipientUid",
        "recipientEmail",
        "recipientStudentId",
        "authorId",
        "authorName",
        "attachments",
        "readBy",
        "dismissedBy",
    }

    row = ClassroomNotification(
        classroom_id=
            classroom_id,

        source_key=
            source_key,

        notification_type=
            normalize_text(
                data.get(
                    "type"
                )
                or data.get(
                    "notificationType"
                )
            ),

        severity=
            normalize_text(
                data.get(
                    "severity"
                )
            )
            or "info",

        title=
            title,

        message=
            message,

        content_html=
            normalize_text(
                data.get(
                    "contentHtml"
                )
            ),

        notification_kind=
            normalize_text(
                data.get(
                    "kind"
                )
                or data.get(
                    "notificationKind"
                )
            ),

        system_generated=
            bool(
                data.get(
                    "systemGenerated",
                    False,
                )
            ),

        automatic_label=
            normalize_text(
                data.get(
                    "automaticLabel"
                )
            ),

        recipient_type=
            normalize_text(
                data.get(
                    "recipientType"
                )
            )
            or "all",

        recipient_uid=
            recipient_uid,

        recipient_email=
            normalize_email(
                data.get(
                    "recipientEmail"
                )
            ),

        recipient_student_id=
            recipient_student_id,

        author_id=
            actor.id,

        author_name=
            normalize_text(
                data.get(
                    "authorName"
                )
            )
            or actor.full_name
            or actor.email
            or "",

        attachments=
            list(
                data.get(
                    "attachments"
                )
                or []
            ),

        read_by=
            list(
                data.get(
                    "readBy"
                )
                or []
            ),

        dismissed_by=
            list(
                data.get(
                    "dismissedBy"
                )
                or []
            ),

        notification_data={
            key: value
            for key, value
            in data.items()
            if key not in known
        },
    )

    db.session.add(
        row
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "created":
            True,

        "notification":
            serialize_classroom_notification(
                row
            ),
    }), 201

# =========================================================
# PHASE 6
# CLASSROOM MESSAGES
# =========================================================


def serialize_classroom_message(
    row,
):
    data = dict(
        row.message_data
        or {}
    )

    data.update({
        "id":
            str(
                row.id
            ),

        "legacyId":
            row.legacy_id
            or "",

        "classId":
            str(
                row.classroom_id
            ),

        "conversationId":
            row.conversation_id
            or "",

        "senderId":
            (
                str(
                    row.sender_id
                )
                if row.sender_id
                else ""
            ),

        "senderEmail":
            row.sender_email
            or "",

        "senderName":
            row.sender_name
            or "",

        "senderAvatar":
            row.sender_avatar
            or "",

        "receiverId":
            (
                str(
                    row.receiver_id
                )
                if row.receiver_id
                else ""
            ),

        "receiverEmail":
            row.receiver_email
            or "",

        "receiverName":
            row.receiver_name
            or "",

        "receiverType":
            row.receiver_type
            or "",

        "receiverAvatar":
            row.receiver_avatar
            or "",

        "content":
            row.content
            or "",

        "attachment":
            row.attachment,

        "recalled":
            bool(
                row.recalled
            ),

        "recalledAt":
            (
                row.recalled_at.isoformat()
                if row.recalled_at
                else None
            ),

        "createdAt":
            (
                row.created_at.isoformat()
                if row.created_at
                else None
            ),

        "updatedAt":
            (
                row.updated_at.isoformat()
                if row.updated_at
                else None
            ),
    })

    return data


def get_classroom_message_or_none(
    classroom_id,
    message_id,
):
    row = db.session.get(
        ClassroomMessage,
        message_id,
    )

    if (
        not row
        or int(
            row.classroom_id
        )
        != int(
            classroom_id
        )
    ):
        return None

    return row


def can_access_message(
    classroom,
    user,
    row,
):
    if not user or not row:
        return False

    if (
        is_admin(
            user
        )
        or is_class_owner(
            classroom,
            user,
        )
    ):
        return True

    user_id = int(
        user.id
    )

    return (
        (
            row.sender_id
            and int(
                row.sender_id
            )
            == user_id
        )
        or (
            row.receiver_id
            and int(
                row.receiver_id
            )
            == user_id
        )
    )


# =========================================================
# GET MESSAGES
#
# Optional:
# ?conversationId=...
# ?limit=300
# =========================================================

@classroom_bp.get(
    "/<int:classroom_id>/messages"
)
@auth_required
def get_classroom_messages(
    classroom_id,
):
    user = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    member = find_member_for_user(
        classroom_id,
        user,
    )

    if not (
        is_admin(
            user
        )
        or is_class_owner(
            classroom,
            user,
        )
        or is_active_class_member(member)
    ):
        return jsonify({
            "success": False,
            "error":
                "Bạn không phải thành viên của lớp.",
        }), 403

    try:
        limit_value = int(
            request.args.get(
                "limit"
            )
            or 300
        )

    except (
        TypeError,
        ValueError,
    ):
        limit_value = 300

    limit_value = max(
        1,
        min(
            limit_value,
            500,
        ),
    )

    statement = db.select(
        ClassroomMessage
    ).where(
        ClassroomMessage.classroom_id
        == classroom_id
    )

    conversation_id = normalize_text(
        request.args.get(
            "conversationId"
        )
    )

    if conversation_id:
        statement = statement.where(
            ClassroomMessage.conversation_id
            == conversation_id
        )

    rows = (
        db.session.execute(
            statement
            .order_by(
                ClassroomMessage.created_at.asc(),
                ClassroomMessage.id.asc(),
            )
            .limit(
                limit_value
            )
        )
        .scalars()
        .all()
    )

    if not can_teach_class(
        classroom,
        user,
    ):
        rows = [
            row
            for row in rows
            if can_access_message(
                classroom,
                user,
                row,
            )
        ]

    return jsonify({
        "success": True,
        "messages": [
            serialize_classroom_message(
                row
            )
            for row in rows
        ],
        "count":
            len(
                rows
            ),
    }), 200


# =========================================================
# CREATE MESSAGE
# =========================================================

@classroom_bp.post(
    "/<int:classroom_id>/messages"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)

def create_classroom_message(
    classroom_id,
):
    sender = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    sender_member = find_member_for_user(
      classroom_id,
      sender,
    )

    if not (
      is_admin(
        sender
      )
    or is_class_owner(
        classroom,
        sender,
    )
    or is_active_class_member(
        sender_member
      )
    ):
      return jsonify({
        "success": False,
        "error":
            "Bạn không phải thành viên đang hoạt động của lớp.",
    }), 403

    data = request.get_json(
        silent=True
    )

    if data is None:
        data = {}

    if not isinstance(
        data,
        dict,
    ):
        return jsonify({
            "success": False,
            "error":
                "Dữ liệu JSON phải là object.",
        }), 400

    content = normalize_text(
        data.get(
            "content"
        )
    )

    attachment = (
        data.get(
            "attachment"
        )
    )

    if not content and not attachment:
        return jsonify({
            "success": False,
            "error":
                "Tin nhắn không được để trống.",
        }), 400

    receiver_id_value = data.get(
        "receiverId"
    )

    receiver_id = None

    if (
        receiver_id_value
        is not None
        and receiver_id_value != ""
    ):
        if (
            isinstance(
                receiver_id_value,
                bool,
            )
            or not str(
                receiver_id_value
            ).isdigit()
        ):
            return jsonify({
                "success": False,
                "error":
                    "receiverId không hợp lệ.",
            }), 400

        receiver_id = int(
            receiver_id_value
        )

        if receiver_id <= 0:
            return jsonify({
                "success": False,
                "error":
                    "receiverId không hợp lệ.",
            }), 400

    receiver_email = normalize_email(
        data.get(
            "receiverEmail"
        )
    )

    receiver_user = None

    if receiver_id:
        receiver_user = db.session.get(
            User,
            receiver_id,
        )

    elif receiver_email:
        receiver_user = resolve_user_by_email(
            receiver_email
        )

        if receiver_user:
            receiver_id = (
                receiver_user.id
            )
        else:
            return jsonify({
                "success": False,
                "error":
                    "Người nhận không tồn tại.",
            }), 400

    if receiver_id:
        receiver_member = find_member_for_user(
            classroom_id,
            receiver_user,
        )

        if not (
            is_active_class_member(
                receiver_member
            )
            or is_class_owner(
                classroom,
                receiver_user,
            )
        ):
            return jsonify({
                "success": False,
                "error":
                    "Người nhận không thuộc lớp.",
            }), 400

    conversation_id = normalize_text(
        data.get(
            "conversationId"
        )
    )

    if not conversation_id:
        ids = [
            str(
                sender.id
            ),
            str(
                receiver_id
                or "class"
            ),
        ]

        ids.sort()

        conversation_id = (
            f"class-{classroom_id}:"
            + ":".join(
                ids
            )
        )

    sender_profile = dict(
        sender.profile_data
        or {}
    )

    receiver_profile = dict(
        (
            receiver_user.profile_data
            if receiver_user
            else {}
        )
        or {}
    )

    known = {
        "conversationId",
        "receiverId",
        "receiverEmail",
        "receiverName",
        "receiverType",
        "receiverAvatar",
        "content",
        "attachment",
        "recalled",
        "recalledAt",
        "senderId",
        "senderEmail",
        "senderName",
        "senderAvatar",
    }

    row = ClassroomMessage(
        classroom_id=
            classroom_id,

        conversation_id=
            conversation_id,

        sender_id=
            sender.id,

        sender_email=
            sender.email
            or "",

        sender_name=
            sender.full_name
            or sender.email
            or "",

        sender_avatar=
            normalize_text(
                sender_profile.get(
                    "photoURL"
                )
                or sender_profile.get(
                    "photoUrl"
                )
                or sender_profile.get(
                    "avatarUrl"
                )
                or sender_profile.get(
                    "avatar"
                )
            ),

        receiver_id=
            receiver_id,

        receiver_email=
            (
                receiver_user.email
                if receiver_user
                else receiver_email
            )
            or "",

        receiver_name=
            normalize_text(
                data.get(
                    "receiverName"
                )
            )
            or (
                receiver_user.full_name
                if receiver_user
                else ""
            )
            or "",

        receiver_type=
            normalize_text(
                data.get(
                    "receiverType"
                )
            )
            or (
                "user"
                if receiver_id
                else "class"
            ),

        receiver_avatar=
            normalize_text(
                data.get(
                    "receiverAvatar"
                )
            )
            or normalize_text(
                receiver_profile.get(
                    "photoURL"
                )
                or receiver_profile.get(
                    "photoUrl"
                )
                or receiver_profile.get(
                    "avatarUrl"
                )
                or receiver_profile.get(
                    "avatar"
                )
            ),

        content=
            content,

        attachment=
            attachment,

        recalled=
            False,

        message_data={
            key: value
            for key, value
            in data.items()
            if key not in known
        },
    )

    db.session.add(
        row
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "message":
            serialize_classroom_message(
                row
            ),
    }), 201


# =========================================================
# UPDATE MESSAGE CONTENT
# =========================================================

@classroom_bp.patch(
    "/<int:classroom_id>/messages/<int:message_id>"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)

def update_classroom_message(
    classroom_id,
    message_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    row = get_classroom_message_or_none(
        classroom_id,
        message_id,
    )

    if not classroom or not row:
        return jsonify({
            "success": False,
            "error":
                "Tin nhắn không tồn tại.",
        }), 404

    if not can_access_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    if not (
        is_admin(
            actor
        )
        or (
            row.sender_id
            and int(
                row.sender_id
            )
            == int(
                actor.id
            )
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    if row.recalled:
        return jsonify({
            "success": False,
            "error":
                "Tin nhắn đã được thu hồi.",
        }), 409

    data = request.get_json(
        silent=True
    )

    if data is None:
        data = {}

    if not isinstance(
        data,
        dict,
    ):
        return jsonify({
            "success": False,
            "error":
                "Dữ liệu JSON phải là object.",
        }), 400

    if "content" in data:
        row.content = normalize_text(
            data.get(
                "content"
            )
        )

    if "attachment" in data:
        row.attachment = (
            data.get(
                "attachment"
            )
        )

    known = {
        "content",
        "attachment",
        "id",
        "classId",
        "senderId",
        "receiverId",
        "conversationId",
        "recalled",
        "recalledAt",
    }

    extra = dict(
        row.message_data
        or {}
    )

    for key, value in data.items():
        if key in known:
            continue

        extra[
            key
        ] = value

    row.message_data = (
        extra
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "message":
            serialize_classroom_message(
                row
            ),
    }), 200


# =========================================================
# RECALL MESSAGE
# =========================================================

@classroom_bp.post(
    "/<int:classroom_id>/messages/<int:message_id>/recall"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)

def recall_classroom_message(
    classroom_id,
    message_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    row = get_classroom_message_or_none(
        classroom_id,
        message_id,
    )

    if not classroom or not row:
        return jsonify({
            "success": False,
            "error":
                "Tin nhắn không tồn tại.",
        }), 404

    if not can_access_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    if not (
        is_admin(
            actor
        )
        or (
            row.sender_id
            and int(
                row.sender_id
            )
            == int(
                actor.id
            )
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    row.recalled = True
    row.recalled_at = (
        classroom_utc_now()
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "message":
            serialize_classroom_message(
                row
            ),
    }), 200


# =========================================================
# DELETE MESSAGE
# =========================================================

@classroom_bp.delete(
    "/<int:classroom_id>/messages/<int:message_id>"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)

def delete_classroom_message(
    classroom_id,
    message_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    row = get_classroom_message_or_none(
        classroom_id,
        message_id,
    )

    if not classroom or not row:
        return jsonify({
            "success": False,
            "error":
                "Tin nhắn không tồn tại.",
        }), 404

    if not can_access_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    if not (
        is_admin(
            actor
        )
        or is_class_owner(
            classroom,
            actor,
        )
        or (
            row.sender_id
            and int(
                row.sender_id
            )
            == int(
                actor.id
            )
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
        "messageId":
            str(
                message_id
            ),
    }), 200

# =========================================================
# PHASE 7
# ASSIGNMENTS + SUBMISSIONS
# =========================================================


def serialize_assignment(
    row,
):
    data = dict(
        row.assignment_data
        or {}
    )

    data.update({
        "id":
            str(row.id),

        "legacyId":
            row.legacy_id
            or "",

        "classId":
            str(
                row.classroom_id
            ),

        "teacherId":
            (
                str(row.teacher_id)
                if row.teacher_id
                else ""
            ),

        "title":
            row.title
            or "",

        "description":
            row.description
            or "",

        "instructions":
            row.instructions
            or "",

        "status":
            row.status
            or "active",

        "dueAt":
            (
                row.due_at.isoformat()
                if row.due_at
                else None
            ),

        "dueAtMs":
            row.due_at_ms,

        "attachments":
            list(
                row.attachments
                or []
            ),

        "createdAt":
            (
                row.created_at.isoformat()
                if row.created_at
                else None
            ),

        "updatedAt":
            (
                row.updated_at.isoformat()
                if row.updated_at
                else None
            ),
    })

    return data


def serialize_submission(
    row,
):
    data = dict(
        row.submission_data
        or {}
    )

    data.update({
        "id":
            str(row.id),

        "assignmentId":
            str(
                row.assignment_id
            ),

        "classId":
            str(
                row.classroom_id
            ),

        "memberId":
            (
                str(row.member_id)
                if row.member_id
                else ""
            ),

        "userId":
            (
                str(row.user_id)
                if row.user_id
                else ""
            ),

        "email":
            row.email
            or "",

        "studentName":
            row.student_name
            or "",

        "content":
            row.content
            or "",

        "attachment":
            row.attachment,

        "attachments":
            list(
                row.attachments
                or []
            ),

        "status":
            row.status
            or "submitted",

        "isLate":
            bool(
                row.is_late
            ),

        "score":
            (
                float(row.score)
                if row.score is not None
                else None
            ),

        "feedback":
            row.feedback
            or "",

        "submittedAt":
            (
                row.submitted_at.isoformat()
                if row.submitted_at
                else None
            ),

        "updatedAt":
            (
                row.updated_at.isoformat()
                if row.updated_at
                else None
            ),
    })

    return data


def get_assignment_or_none(
    classroom_id,
    assignment_id,
):
    row = db.session.get(
        ClassroomAssignment,
        assignment_id,
    )

    if (
        not row
        or int(
            row.classroom_id
        )
        != int(
            classroom_id
        )
    ):
        return None

    return row


def get_submission_or_none(
    classroom_id,
    assignment_id,
    submission_id,
):
    row = db.session.get(
        ClassroomSubmission,
        submission_id,
    )

    if (
        not row
        or int(
            row.classroom_id
        )
        != int(
            classroom_id
        )
        or int(
            row.assignment_id
        )
        != int(
            assignment_id
        )
    ):
        return None

    return row


def parse_optional_datetime(
    value,
):
    if not value:
        return None

    try:
        return datetime.fromisoformat(
            str(value)
            .replace(
                "Z",
                "+00:00",
            )
        )

    except (
        TypeError,
        ValueError,
    ):
        return None


# =========================================================
# GET ASSIGNMENTS
# =========================================================

@classroom_bp.get(
    "/<int:classroom_id>/assignments"
)
@auth_required
def get_assignments(
    classroom_id,
):
    user = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    member = find_member_for_user(
        classroom_id,
        user,
    )

    if not (
        is_admin(user)
        or is_class_owner(
            classroom,
            user,
        )
        or is_active_class_member(member)
    ):
        return jsonify({
            "success": False,
            "error":
                "Bạn không phải thành viên của lớp.",
        }), 403

    rows = (
        db.session.execute(
            db.select(
                ClassroomAssignment
            )
            .where(
                ClassroomAssignment.classroom_id
                == classroom_id
            )
            .order_by(
                ClassroomAssignment.created_at.desc(),
                ClassroomAssignment.id.desc(),
            )
        )
        .scalars()
        .all()
    )

    return jsonify({
        "success": True,
        "assignments": [
            serialize_assignment(
                row
            )
            for row in rows
        ],
        "count":
            len(rows),
    }), 200


# =========================================================
# GET ONE ASSIGNMENT
# =========================================================

@classroom_bp.get(
    "/<int:classroom_id>/assignments/<int:assignment_id>"
)
@auth_required
def get_assignment(
    classroom_id,
    assignment_id,
):
    actor = current_user()
    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    row = get_assignment_or_none(
        classroom_id,
        assignment_id,
    )

    if not classroom or not row:
        return jsonify({
            "success": False,
            "error":
                "Bài tập không tồn tại.",
        }), 404

    if not can_access_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    return jsonify({
        "success": True,
        "assignment":
            serialize_assignment(
                row
            ),
    }), 200


# =========================================================
# CREATE ASSIGNMENT
# =========================================================

@classroom_bp.post(
    "/<int:classroom_id>/assignments"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)

def create_assignment(
    classroom_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    if not classroom:
        return jsonify({
            "success": False,
            "error":
                "Lớp học không tồn tại.",
        }), 404

    if not can_teach_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    data = request.get_json(
        silent=True
    )

    if data is None:
        data = {}

    if not isinstance(
        data,
        dict,
    ):
        return jsonify({
            "success": False,
            "error":
                "Dữ liệu JSON phải là object.",
        }), 400

    title = normalize_text(
        data.get("title")
    )

    if not title:
        return jsonify({
            "success": False,
            "error":
                "Tên bài tập không được để trống.",
        }), 400

    due_at_value = data.get(
        "dueAt"
    )

    due_at = parse_optional_datetime(
        due_at_value
    )

    if (
        due_at_value
        not in {None, ""}
        and due_at is None
    ):
        return jsonify({
            "success": False,
            "error":
                "dueAt không hợp lệ.",
        }), 400

    due_at_ms = (
        data.get("dueAtMs")
    )

    if (
        due_at_ms is not None
        and due_at_ms != ""
    ):
        try:
            if isinstance(
                due_at_ms,
                bool,
            ):
                raise ValueError

            due_at_ms = int(
                due_at_ms
            )

            if (
                due_at_ms < 0
                or due_at_ms > 9223372036854775807
            ):
                raise ValueError

        except (
            TypeError,
            ValueError,
        ):
            return jsonify({
                "success": False,
                "error":
                    "dueAtMs không hợp lệ.",
            }), 400

    else:
        due_at_ms = None

    if (
        "attachments" in data
        and data.get("attachments") is not None
        and not isinstance(
            data.get("attachments"),
            list,
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "attachments phải là danh sách.",
        }), 400

    known = {
        "title",
        "description",
        "instructions",
        "status",
        "dueAt",
        "dueAtMs",
        "attachments",
    }

    row = ClassroomAssignment(
        classroom_id=
            classroom_id,

        teacher_id=
            actor.id,

        title=
            title,

        description=
            normalize_text(
                data.get(
                    "description"
                )
            ),

        instructions=
            normalize_text(
                data.get(
                    "instructions"
                )
            ),

        status=
            normalize_text(
                data.get(
                    "status"
                )
            )
            or "active",

        due_at=
            due_at,

        due_at_ms=
            due_at_ms,

        attachments=
            list(
                data.get(
                    "attachments"
                )
                or []
            ),

        assignment_data={
            key: value
            for key, value
            in data.items()
            if key not in known
        },
    )

    db.session.add(
        row
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "assignment":
            serialize_assignment(
                row
            ),
    }), 201


# =========================================================
# UPDATE ASSIGNMENT
# =========================================================

@classroom_bp.patch(
    "/<int:classroom_id>/assignments/<int:assignment_id>"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)

def update_assignment(
    classroom_id,
    assignment_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    row = get_assignment_or_none(
        classroom_id,
        assignment_id,
    )

    if not classroom or not row:
        return jsonify({
            "success": False,
            "error":
                "Bài tập không tồn tại.",
        }), 404

    if not can_teach_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    data = request.get_json(
        silent=True
    )

    if data is None:
        data = {}

    if not isinstance(
        data,
        dict,
    ):
        return jsonify({
            "success": False,
            "error":
                "Dữ liệu JSON phải là object.",
        }), 400

    mapping = {
        "title":
            "title",

        "description":
            "description",

        "instructions":
            "instructions",

        "status":
            "status",
    }

    for key, attr in mapping.items():
        if key in data:
            setattr(
                row,
                attr,
                normalize_text(
                    data.get(
                        key
                    )
                ),
            )

    if "dueAt" in data:
        due_at_value = data.get(
            "dueAt"
        )

        parsed_due_at = parse_optional_datetime(
            due_at_value
        )

        if (
            due_at_value
            not in {None, ""}
            and parsed_due_at is None
        ):
            return jsonify({
                "success": False,
                "error":
                    "dueAt không hợp lệ.",
            }), 400

        row.due_at = parsed_due_at

    if "dueAtMs" in data:
        value = data.get(
            "dueAtMs"
        )

        if (
            value is None
            or value == ""
        ):
            row.due_at_ms = None

        else:
            try:
                if isinstance(
                    value,
                    bool,
                ):
                    raise ValueError

                parsed_due_at_ms = int(
                    value
                )

                if (
                    parsed_due_at_ms < 0
                    or parsed_due_at_ms > 9223372036854775807
                ):
                    raise ValueError

                row.due_at_ms = parsed_due_at_ms

            except (
                TypeError,
                ValueError,
            ):
                return jsonify({
                    "success": False,
                    "error":
                        "dueAtMs không hợp lệ.",
                }), 400

    if (
        "attachments" in data
        and data.get("attachments") is not None
        and not isinstance(
            data.get("attachments"),
            list,
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "attachments phải là danh sách.",
        }), 400

    if "attachments" in data:
        row.attachments = list(
            data.get(
                "attachments"
            )
            or []
        )

    known = {
        *mapping.keys(),
        "dueAt",
        "dueAtMs",
        "attachments",
        "id",
        "classId",
        "teacherId",
    }

    extra = dict(
        row.assignment_data
        or {}
    )

    for key, value in data.items():
        if key in known:
            continue

        extra[key] = value

    row.assignment_data = (
        extra
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "assignment":
            serialize_assignment(
                row
            ),
    }), 200


# =========================================================
# DELETE ASSIGNMENT
# =========================================================

@classroom_bp.delete(
    "/<int:classroom_id>/assignments/<int:assignment_id>"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)

def delete_assignment(
    classroom_id,
    assignment_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    row = get_assignment_or_none(
        classroom_id,
        assignment_id,
    )

    if not classroom or not row:
        return jsonify({
            "success": False,
            "error":
                "Bài tập không tồn tại.",
        }), 404

    if not can_teach_class(
        classroom,
        actor,
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
        "assignmentId":
            str(
                assignment_id
            ),
    }), 200


# =========================================================
# GET SUBMISSIONS
#
# Teacher: all
# Student: own only
# =========================================================

@classroom_bp.get(
    "/<int:classroom_id>/assignments/<int:assignment_id>/submissions"
)
@auth_required
def get_submissions(
    classroom_id,
    assignment_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    assignment = get_assignment_or_none(
        classroom_id,
        assignment_id,
    )

    if not classroom or not assignment:
        return jsonify({
            "success": False,
            "error":
                "Bài tập không tồn tại.",
        }), 404

    statement = db.select(
        ClassroomSubmission
    ).where(
        ClassroomSubmission.classroom_id
        == classroom_id,

        ClassroomSubmission.assignment_id
        == assignment_id,
    )

    if not can_teach_class(
        classroom,
        actor,
    ):
        member = find_member_for_user(
            classroom_id,
            actor,
        )

        if not is_active_class_member(
            member
        ):
            return jsonify({
                "success": False,
                "error":
                    "Bạn không phải thành viên của lớp.",
            }), 403

        statement = statement.where(
            ClassroomSubmission.member_id
            == member.id
        )

    rows = (
        db.session.execute(
            statement.order_by(
                ClassroomSubmission.submitted_at.desc(),
                ClassroomSubmission.id.desc(),
            )
        )
        .scalars()
        .all()
    )

    return jsonify({
        "success": True,
        "submissions": [
            serialize_submission(
                row
            )
            for row in rows
        ],
        "count":
            len(rows),
    }), 200


# =========================================================
# SUBMIT / RESUBMIT ASSIGNMENT
# =========================================================

@classroom_bp.post(
    "/<int:classroom_id>/assignments/<int:assignment_id>/submissions"
)
@auth_required
@rate_limit(limit=60, window=3600, per_user=True)

def submit_assignment(
    classroom_id,
    assignment_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    assignment = get_assignment_or_none(
        classroom_id,
        assignment_id,
    )

    if not classroom or not assignment:
        return jsonify({
            "success": False,
            "error":
                "Bài tập không tồn tại.",
        }), 404

    member = find_member_for_user(
        classroom_id,
        actor,
    )

    if not is_active_class_member(
        member
    ):
        return jsonify({
            "success": False,
            "error":
                "Bạn không phải thành viên của lớp.",
        }), 403

    if can_teach_class(
        classroom,
        actor,
    ):
        return jsonify({
            "success": False,
            "error":
                "Giáo viên không nộp bài như học sinh.",
        }), 403

    data = request.get_json(
        silent=True
    )

    if data is None:
        data = {}

    if not isinstance(
        data,
        dict,
    ):
        return jsonify({
            "success": False,
            "error":
                "Dữ liệu JSON phải là object.",
        }), 400

    if (
        "attachments" in data
        and data.get("attachments") is not None
        and not isinstance(
            data.get("attachments"),
            list,
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "attachments phải là danh sách.",
        }), 400

    content = normalize_text(
        data.get(
            "content"
        )
    )

    attachment = data.get(
        "attachment"
    )

    attachments = list(
        data.get(
            "attachments"
        )
        or []
    )

    if not content and not attachment and not attachments:
        return jsonify({
            "success": False,
            "error":
                "Bài nộp không được để trống.",
        }), 400

    row = db.session.scalar(
        db.select(
            ClassroomSubmission
        )
        .where(
            ClassroomSubmission.assignment_id
            == assignment_id,

            ClassroomSubmission.member_id
            == member.id,
        )
    )

    created = (
        row is None
    )

    now = classroom_utc_now()

    is_late = False

    if assignment.due_at:
        try:
            due_at = (
                assignment.due_at
            )

            if (
                due_at.tzinfo
                is None
            ):
                due_at = (
                    due_at.replace(
                        tzinfo=timezone.utc
                    )
                )

            is_late = (
                now
                > due_at
            )

        except Exception:
            is_late = False

    elif assignment.due_at_ms:
        is_late = (
            int(
                now.timestamp()
                * 1000
            )
            > int(
                assignment.due_at_ms
            )
        )

    known = {
        "content",
        "attachment",
        "attachments",
        "status",
    }

    if not row:
        row = ClassroomSubmission(
            assignment_id=
                assignment_id,

            classroom_id=
                classroom_id,

            member_id=
                member.id,

            user_id=
                actor.id,

            email=
                actor.email
                or member.email
                or "",

            student_name=
                member.name
                or actor.full_name
                or "",

            content=
                content,

            attachment=
                attachment,

            attachments=
                attachments,

            status=
                normalize_text(
                    data.get(
                        "status"
                    )
                )
                or "submitted",

            is_late=
                is_late,

            score=
                None,

            feedback=
                "",

            submission_data={
                key: value
                for key, value
                in data.items()
                if key not in known
            },

            submitted_at=
                now,
        )

        db.session.add(
            row
        )

    else:
        row.content = (
            content
        )

        row.attachment = (
            attachment
        )

        row.attachments = (
            attachments
        )

        row.status = (
            normalize_text(
                data.get(
                    "status"
                )
            )
            or "submitted"
        )

        row.is_late = (
            is_late
        )

        row.submitted_at = (
            now
        )

        extra = dict(
            row.submission_data
            or {}
        )

        for key, value in data.items():
            if key in known:
                continue

            extra[key] = value

        row.submission_data = (
            extra
        )

    db.session.commit()

    return jsonify({
        "success": True,
        "created":
            created,
        "submission":
            serialize_submission(
                row
            ),
    }), (
        201
        if created
        else 200
    )


# =========================================================
# UPDATE / GRADE SUBMISSION
# =========================================================

@classroom_bp.patch(
    "/<int:classroom_id>/assignments/<int:assignment_id>/submissions/<int:submission_id>"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)

def update_submission(
    classroom_id,
    assignment_id,
    submission_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    assignment = get_assignment_or_none(
        classroom_id,
        assignment_id,
    )

    row = get_submission_or_none(
        classroom_id,
        assignment_id,
        submission_id,
    )

    if (
        not classroom
        or not assignment
        or not row
    ):
        return jsonify({
            "success": False,
            "error":
                "Bài nộp không tồn tại.",
        }), 404

    is_teacher_actor = (
        can_teach_class(
            classroom,
            actor,
        )
    )

    own_submission = bool(
        actor
        and row.user_id
        and int(
            actor.id
        )
        == int(
            row.user_id
        )
    )

    if own_submission:
        actor_member = find_member_for_user(
            classroom_id,
            actor,
        )
        own_submission = is_active_class_member(
            actor_member
        )

    if not (
        is_teacher_actor
        or own_submission
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    data = request.get_json(
        silent=True
    )

    if data is None:
        data = {}

    if not isinstance(
        data,
        dict,
    ):
        return jsonify({
            "success": False,
            "error":
                "Dữ liệu JSON phải là object.",
        }), 400

    if (
        "attachments" in data
        and data.get("attachments") is not None
        and not isinstance(
            data.get("attachments"),
            list,
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "attachments phải là danh sách.",
        }), 400

    # Student can edit own content/attachments.
    if own_submission:
        if "content" in data:
            row.content = normalize_text(
                data.get(
                    "content"
                )
            )

        if "attachment" in data:
            row.attachment = (
                data.get(
                    "attachment"
                )
            )

        if "attachments" in data:
            row.attachments = list(
                data.get(
                    "attachments"
                )
                or []
            )

        if "status" in data:
            row.status = normalize_text(
                data.get(
                    "status"
                )
            ) or row.status

    # Teacher controls grading fields.
    if is_teacher_actor:
        if "score" in data:
            value = data.get(
                "score"
            )

            if (
                value is None
                or value == ""
            ):
                row.score = None

            else:
                try:
                    score_value = float(
                        value
                    )

                except (
                    TypeError,
                    ValueError,
                ):
                    return jsonify({
                        "success": False,
                        "error":
                            "Điểm không hợp lệ.",
                    }), 400

                if (
                    score_value < 0
                    or score_value > 10
                ):
                    return jsonify({
                        "success": False,
                        "error":
                            "Điểm phải từ 0 đến 10.",
                    }), 400

                row.score = (
                    score_value
                )

        if "feedback" in data:
            row.feedback = normalize_text(
                data.get(
                    "feedback"
                )
            )

        if "status" in data:
            row.status = normalize_text(
                data.get(
                    "status"
                )
            ) or row.status

    protected = {
        "content",
        "attachment",
        "attachments",
        "score",
        "feedback",
        "status",
        "id",
        "assignmentId",
        "classId",
        "memberId",
        "userId",
    }

    extra = dict(
        row.submission_data
        or {}
    )

    for key, value in data.items():
        if key in protected:
            continue

        extra[key] = value

    row.submission_data = (
        extra
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "submission":
            serialize_submission(
                row
            ),
    }), 200


# =========================================================
# DELETE SUBMISSION
# =========================================================

@classroom_bp.delete(
    "/<int:classroom_id>/assignments/<int:assignment_id>/submissions/<int:submission_id>"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)

def delete_submission(
    classroom_id,
    assignment_id,
    submission_id,
):
    actor = current_user()

    classroom = db.session.get(
        Classroom,
        classroom_id,
    )

    row = get_submission_or_none(
        classroom_id,
        assignment_id,
        submission_id,
    )

    if not classroom or not row:
        return jsonify({
            "success": False,
            "error":
                "Bài nộp không tồn tại.",
        }), 404

    own_submission = bool(
        actor
        and row.user_id
        and int(
            actor.id
        )
        == int(
            row.user_id
        )
    )

    if own_submission:
        actor_member = find_member_for_user(
            classroom_id,
            actor,
        )
        own_submission = is_active_class_member(
            actor_member
        )

    if not (
        can_teach_class(
            classroom,
            actor,
        )
        or own_submission
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
        "submissionId":
            str(
                submission_id
            ),
    }), 200

import os
import uuid

from flask import Blueprint, jsonify, request

from auth import auth_required
from extensions import db
from models import Classroom, ClassroomMember, User
from auth.rate_limiter import rate_limit
from storage import (
    R2StorageError,
    build_public_url,
    delete_file,
    generate_presigned_get_url,
    upload_file_object,
)


storage_bp = Blueprint(
    "storage",
    __name__,
    url_prefix="/api/storage",
)


ALLOWED_IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}


MAX_PROFILE_IMAGE_SIZE = (
    10 * 1024 * 1024
)


def get_current_user():
    user_id = (
        request.current_user.get("user_id")
        or request.current_user.get("uid")
    )

    if not user_id:
        return None

    return db.session.get(
        User,
        user_id,
    )


def get_current_user_for_update():
    user_id = (
        request.current_user.get("user_id")
        or request.current_user.get("uid")
    )

    if not user_id:
        return None

    return db.session.scalar(
        db.select(User)
        .where(User.id == user_id)
        .with_for_update()
    )


def get_classroom_access(user, classroom_id):
    try:
        classroom_pk = int(classroom_id)
    except (TypeError, ValueError):
        return None, None

    classroom = db.session.get(Classroom, classroom_pk)
    if not classroom or not user:
        return classroom, None

    member = db.session.scalar(
        db.select(ClassroomMember).where(
            ClassroomMember.classroom_id == classroom_pk,
            db.or_(
                ClassroomMember.user_id == user.id,
                db.func.lower(ClassroomMember.email) == str(user.email or "").lower(),
            ),
        )
    )
    return classroom, member


def can_manage_classroom(user, classroom, member=None):
    role = str(getattr(user, "role", "") or "").upper()
    class_role = str(getattr(member, "class_role", "") or "").lower()
    return bool(
        user and classroom and (
            role == "ADMIN_DEV"
            or (
                role == "TEACHER"
                and (
                    classroom.teacher_id == user.id
                    or class_role in {"teacher", "intern_teacher", "co_teacher"}
                )
            )
        )
    )


def can_upload_classroom_kind(user, classroom, member, kind):
    if can_manage_classroom(user, classroom, member):
        return True
    if not member:
        return False
    return kind in {"class-message", "class-submission"}


def get_file_size(file_storage):
    stream = file_storage.stream

    current_position = (
        stream.tell()
    )

    stream.seek(
        0,
        os.SEEK_END,
    )

    size = (
        stream.tell()
    )

    stream.seek(
        current_position,
    )

    return size


def get_profile_image_url(
    object_key,
):
    public_url = (
        build_public_url(
            object_key
        )
    )

    if public_url:
        return public_url

    return generate_presigned_get_url(
        object_key,
        expires_in=3600,
    )


@storage_bp.post("/profile/cover")
@auth_required
def upload_profile_cover():
    try:
        user = get_current_user_for_update()

        if not user:
            return jsonify({
                "success": False,
                "error": "Không tìm thấy tài khoản.",
            }), 404

        uploaded_file = (
            request.files.get("file")
        )

        if not uploaded_file:
            return jsonify({
                "success": False,
                "error": (
                    "Không tìm thấy file upload."
                ),
            }), 400

        filename = (
            uploaded_file.filename
            or ""
        ).strip()

        if not filename:
            return jsonify({
                "success": False,
                "error": (
                    "Tên file không hợp lệ."
                ),
            }), 400

        content_type = (
            uploaded_file.mimetype
            or ""
        ).lower()

        if (
            content_type
            not in
            ALLOWED_IMAGE_MIME_TYPES
        ):
            return jsonify({
                "success": False,
                "error": (
                    "Chỉ hỗ trợ ảnh "
                    "JPEG, PNG, WEBP hoặc GIF."
                ),
            }), 400

        file_size = get_file_size(
            uploaded_file
        )

        if (
            file_size <= 0
            or file_size
            > MAX_PROFILE_IMAGE_SIZE
        ):
            return jsonify({
                "success": False,
                "error": (
                    "Ảnh phải nhỏ hơn hoặc bằng 10MB."
                ),
            }), 400

        extension = (
            os.path.splitext(
                filename
            )[1]
            .lower()
            .strip(".")
        )

        if not extension:
            extension = (
                content_type
                .split("/")[-1]
                or "jpg"
            )

        object_key = (
            f"users/{user.id}/"
            f"profile/cover/"
            f"{uuid.uuid4().hex}."
            f"{extension}"
        )

        old_profile_data = (
            dict(
                user.profile_data
            )
            if isinstance(
                user.profile_data,
                dict,
            )
            else {}
        )

        old_cover_key = str(
            old_profile_data.get(
                "coverPhotoKey",
                "",
            )
            or ""
        ).strip()

        upload_result = (
            upload_file_object(
                uploaded_file,
                object_key,
                content_type=content_type,
                metadata={
                    "user_id":
                        user.id,

                    "original_name":
                        filename,

                    "purpose":
                        "profile_cover",
                },
            )
        )

        cover_url = (
            get_profile_image_url(
                object_key
            )
        )

        profile_data = (
            dict(
                old_profile_data
            )
        )

        profile_data.update({
            "coverPhoto":
                cover_url,

            "coverPhotoKey":
                object_key,

            "coverPhotoFileName":
                filename,

            "coverPhotoContentType":
                upload_result.get(
                    "contentType",
                    content_type,
                ),

            "coverPhotoSize":
                file_size,
        })

        user.profile_data = (
            profile_data
        )

        db.session.commit()

        if (
            old_cover_key
            and old_cover_key
            != object_key
        ):
            try:
                delete_file(
                    old_cover_key
                )
            except Exception as error:
                print(
                    "R2 old cover delete error:",
                    error,
                )

        return jsonify({
            "success": True,
            "message": (
                "Đã cập nhật ảnh bìa."
            ),
            "coverPhoto":
                cover_url,
            "coverPhotoKey":
                object_key,
            "user":
                user.to_dict(),
        }), 200

    except R2StorageError as error:
        db.session.rollback()
        print(
            "R2 profile cover error:",
            error,
        )

        return jsonify({
            "success": False,
            "error":
                "Không thể cập nhật ảnh bìa.",
        }), 502

    except Exception as error:
        db.session.rollback()
        print(
            "Profile cover storage error:",
            error,
        )

        return jsonify({
            "success": False,
            "error":
                "Không thể cập nhật ảnh bìa.",
        }), 500


# =========================================================
# PROCTORING EVIDENCE
# =========================================================

ALLOWED_PROCTORING_IMAGE_MIME_TYPES = {
    "image/webp",
    "image/jpeg",
    "image/png",
}


MAX_PROCTORING_IMAGE_SIZE = (
    5 * 1024 * 1024
)


ALLOWED_PROCTORING_SOURCES = {
    "camera",
    "screen",
}


def normalize_storage_identifier(
    value,
    max_length=200,
):
    value = str(
        value or ""
    ).strip()

    if not value:
        return ""

    if (
        len(value)
        > max_length
    ):
        return ""

    allowed_characters = (
        "abcdefghijklmnopqrstuvwxyz"
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "0123456789"
        "-_"
    )

    if any(
        character
        not in allowed_characters
        for character
        in value
    ):
        return ""

    return value


@storage_bp.post(
    "/proctoring/evidence"
)
@auth_required
def upload_proctoring_evidence():
    try:
        user = get_current_user()

        if not user:
            return jsonify({
                "success": False,
                "error":
                    "User not found",
            }), 404

        uploaded_file = (
            request.files.get(
                "file"
            )
        )

        if not uploaded_file:
            return jsonify({
                "success": False,
                "error": (
                    "Không tìm thấy "
                    "file bằng chứng."
                ),
            }), 400

        exam_id = (
            normalize_storage_identifier(
                request.form.get(
                    "examId"
                ),
                max_length=100,
            )
        )

        session_id = (
            normalize_storage_identifier(
                request.form.get(
                    "sessionId"
                ),
                max_length=200,
            )
        )

        event_id = (
            normalize_storage_identifier(
                request.form.get(
                    "eventId"
                ),
                max_length=200,
            )
        )

        source = str(
            request.form.get(
                "source"
            )
            or ""
        ).strip().lower()

        if not exam_id:
            return jsonify({
                "success": False,
                "error":
                    "examId không hợp lệ.",
            }), 400

        if not session_id:
            return jsonify({
                "success": False,
                "error":
                    "sessionId không hợp lệ.",
            }), 400

        if not event_id:
            return jsonify({
                "success": False,
                "error":
                    "eventId không hợp lệ.",
            }), 400

        if (
            source
            not in
            ALLOWED_PROCTORING_SOURCES
        ):
            return jsonify({
                "success": False,
                "error": (
                    "source chỉ được là "
                    "camera hoặc screen."
                ),
            }), 400

        filename = (
            uploaded_file.filename
            or ""
        ).strip()

        if not filename:
            return jsonify({
                "success": False,
                "error": (
                    "Tên file không "
                    "hợp lệ."
                ),
            }), 400

        content_type = (
            uploaded_file.mimetype
            or ""
        ).lower()

        if (
            content_type
            not in
            ALLOWED_PROCTORING_IMAGE_MIME_TYPES
        ):
            return jsonify({
                "success": False,
                "error": (
                    "Ảnh bằng chứng chỉ "
                    "hỗ trợ WEBP, JPEG "
                    "hoặc PNG."
                ),
            }), 400

        file_size = (
            get_file_size(
                uploaded_file
            )
        )

        if (
            file_size <= 0
            or file_size
            > MAX_PROCTORING_IMAGE_SIZE
        ):
            return jsonify({
                "success": False,
                "error": (
                    "Ảnh bằng chứng phải "
                    "nhỏ hơn hoặc bằng 5MB."
                ),
            }), 400

        extension_map = {
            "image/webp":
                "webp",

            "image/jpeg":
                "jpg",

            "image/png":
                "png",
        }

        extension = (
            extension_map.get(
                content_type,
                "webp",
            )
        )

        object_key = (
            f"exam-proctoring/"
            f"{exam_id}/"
            f"{user.id}/"
            f"{session_id}/"
            f"{event_id}-"
            f"{source}."
            f"{extension}"
        )

        upload_result = (
            upload_file_object(
                uploaded_file,
                object_key,
                content_type=
                    content_type,
                metadata={
                    "user_id":
                        user.id,

                    "exam_id":
                        exam_id,

                    "session_id":
                        session_id,

                    "event_id":
                        event_id,

                    "source":
                        source,

                    "purpose":
                        (
                            "exam_"
                            "proctoring_"
                            "evidence"
                        ),
                },
            )
        )

        return jsonify({
            "success": True,

            "message": (
                "Đã lưu ảnh "
                "bằng chứng."
            ),

            "key":
                object_key,

            "path":
                object_key,

            "contentType":
                upload_result.get(
                    "contentType",
                    content_type,
                ),

            "size":
                file_size,

            "source":
                source,

            "examId":
                exam_id,

            "sessionId":
                session_id,

            "eventId":
                event_id,
        }), 200

    except R2StorageError as error:
        print(
            "R2 proctoring evidence error:",
            error,
        )
        return jsonify({
            "success": False,
            "error":
                "Không thể lưu ảnh bằng chứng.",
        }), 502

    except Exception as error:
        print(
            "Proctoring evidence storage error:",
            error,
        )
        return jsonify({
            "success": False,
            "error":
                "Không thể lưu ảnh bằng chứng.",
        }), 500

FORUM_ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/zip",
    "application/x-zip-compressed",
}

MAX_FORUM_ASSET_SIZE = 25 * 1024 * 1024


@storage_bp.post("/forum/asset")
@auth_required
def upload_forum_asset():
    try:
        user = get_current_user()
        if not user:
            return jsonify({"success": False, "error": "User not found"}), 404

        uploaded_file = request.files.get("file")
        if not uploaded_file:
            return jsonify({"success": False, "error": "Không tìm thấy file upload."}), 400

        filename = (uploaded_file.filename or "").strip()
        content_type = (uploaded_file.mimetype or "application/octet-stream").lower()
        kind = str(request.form.get("kind") or "post").strip().lower()

        if not filename:
            return jsonify({"success": False, "error": "Tên file không hợp lệ."}), 400
        if content_type not in FORUM_ALLOWED_MIME_TYPES:
            return jsonify({"success": False, "error": "Forum chỉ hỗ trợ ảnh hoặc file ZIP."}), 400

        file_size = get_file_size(uploaded_file)
        if file_size <= 0 or file_size > MAX_FORUM_ASSET_SIZE:
            return jsonify({"success": False, "error": "File phải nhỏ hơn hoặc bằng 25MB."}), 400

        extension = os.path.splitext(filename)[1].lower().strip(".") or "bin"
        safe_kind = "post-image" if kind == "post-image" else "post-attachment"
        object_key = f"forum/{safe_kind}/{user.id}/{uuid.uuid4().hex}.{extension}"

        upload_result = upload_file_object(
            uploaded_file,
            object_key,
            content_type=content_type,
            metadata={
                "user_id": user.id,
                "original_name": filename,
                "purpose": safe_kind,
            },
        )

        public_url = build_public_url(object_key)
        url = public_url or generate_presigned_get_url(object_key, expires_in=3600)

        return jsonify({
            "success": True,
            "key": object_key,
            "url": url,
            "publicUrl": public_url or "",
            "fileName": filename,
            "contentType": upload_result.get("contentType", content_type),
            "size": file_size,
        }), 200

    except R2StorageError as error:
        print(
            "R2 Forum upload error:",
            error,
        )
        return jsonify({
            "success": False,
            "error":
                "Không thể tải file Forum.",
        }), 502

    except Exception as error:
        print(
            "Forum storage error:",
            error,
        )
        return jsonify({
            "success": False,
            "error":
                "Không thể tải file Forum.",
        }), 500


# =========================================================
# E-LEARNING ASSET UPLOAD
# =========================================================

ELEARNING_ALLOWED_MIME_TYPES = {
    # Images
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",

    # Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",

    # Video
    "video/mp4",
}


MAX_ELEARNING_IMAGE_SIZE = (
    15 * 1024 * 1024
)

MAX_ELEARNING_FILE_SIZE = (
    25 * 1024 * 1024
)

MAX_ELEARNING_VIDEO_SIZE = (
    200 * 1024 * 1024
)


ELEARNING_PUBLIC_IMAGE_KINDS = {
    "course-image",
    "playlist-image",
}


def can_upload_elearning_kind(user, kind):
    user_role = str(
        getattr(
            user,
            "role",
            "",
        )
        or ""
    ).upper()

    if kind == "playlist-image":
        return True

    return user_role in {
        "TEACHER",
        "ADMIN_DEV",
    }


@storage_bp.post(
    "/e-learning/asset"
)
@auth_required
@rate_limit(limit=60, window=3600, per_user=True)
def upload_elearning_asset():
    try:
        user = get_current_user()

        if not user:
            return jsonify({
                "success": False,
                "error":
                    "User not found",
            }), 404

        uploaded_file = request.files.get(
            "file"
        )

        if not uploaded_file:
            return jsonify({
                "success": False,
                "error":
                    "Không tìm thấy file upload.",
            }), 400

        filename = (
            uploaded_file.filename
            or ""
        ).strip()

        content_type = (
            uploaded_file.mimetype
            or "application/octet-stream"
        ).lower()

        kind = str(
            request.form.get(
                "kind"
            )
            or ""
        ).strip().lower()

        folder = str(
            request.form.get(
                "folder"
            )
            or ""
        ).strip()

        if not filename:
            return jsonify({
                "success": False,
                "error":
                    "Tên file không hợp lệ.",
            }), 400

        if (
            content_type
            not in ELEARNING_ALLOWED_MIME_TYPES
        ):
            return jsonify({
                "success": False,
                "error":
                    (
                        "E-learning chỉ hỗ trợ "
                        "ảnh, Word, PDF, TXT "
                        "hoặc MP4."
                    ),
            }), 400

        file_size = get_file_size(
            uploaded_file
        )

        if file_size <= 0:
            return jsonify({
                "success": False,
                "error":
                    "File upload rỗng.",
            }), 400

        # =========================================
        # DETERMINE ASSET KIND
        # =========================================

        if not kind:
            if content_type.startswith(
                "image/"
            ):
                kind = "course-image"

            elif content_type.startswith(
                "video/"
            ):
                kind = "course-video"

            else:
                kind = "course-file"

        allowed_kinds = {
            "course-image",
            "course-file",
            "course-video",
            "playlist-image",
        }

        if kind not in allowed_kinds:
            return jsonify({
                "success": False,
                "error":
                    "Loại asset E-learning không hợp lệ.",
            }), 400

        if not can_upload_elearning_kind(
            user,
            kind,
        ):
            return jsonify({
                "success": False,
                "error":
                    "Bạn không có quyền tải loại asset E-learning này.",
            }), 403

        # =========================================
        # SIZE LIMIT
        # =========================================

        if kind in {
            "course-image",
            "playlist-image",
        }:
            max_size = (
                MAX_ELEARNING_IMAGE_SIZE
            )

        elif kind == "course-video":
            max_size = (
                MAX_ELEARNING_VIDEO_SIZE
            )

        else:
            max_size = (
                MAX_ELEARNING_FILE_SIZE
            )

        if file_size > max_size:
            return jsonify({
                "success": False,
                "error": (
                    "File vượt quá giới hạn "
                    "dung lượng cho phép."
                ),
                "maxSize":
                    max_size,
            }), 400

        # =========================================
        # OBJECT KEY
        # =========================================

        extension = (
            os.path.splitext(
                filename
            )[1]
            .lower()
            .strip(".")
            or "bin"
        )

        object_key = (
            f"learning/"
            f"{kind}/"
            f"{user.id}/"
            f"{uuid.uuid4().hex}."
            f"{extension}"
        )

        # =========================================
        # R2 UPLOAD
        # =========================================

        upload_result = (
            upload_file_object(
                uploaded_file,
                object_key,
                content_type=
                    content_type,
                metadata={
                    "user_id":
                        user.id,

                    "original_name":
                        filename,

                    "purpose":
                        kind,

                    "source_folder":
                        folder,
                },
            )
        )

        # Public E-learning thumbnails need a stable URL.
        # Course files/videos remain private and use a
        # short-lived presigned URL.
        public_url = (
            build_public_url(
                object_key
            )
            if kind in ELEARNING_PUBLIC_IMAGE_KINDS
            else None
        )

        url = (
            public_url
            or generate_presigned_get_url(
                object_key,
                expires_in=3600,
            )
        )

        return jsonify({
            "success": True,

            "key":
                object_key,

            "path":
                object_key,

            "objectKey":
                object_key,

            "url":
                url,

            "fileUrl":
                url,

            "downloadUrl":
                url,

            "publicUrl":
                public_url
                or "",

            "fileName":
                filename,

            "name":
                filename,

            "contentType":
                upload_result.get(
                    "contentType",
                    content_type,
                ),

            "type":
                upload_result.get(
                    "contentType",
                    content_type,
                ),

            "size":
                file_size,

            "kind":
                kind,
        }), 200

    except R2StorageError as error:
        print(
            "R2 E-learning upload error:",
            error,
        )
        return jsonify({
            "success": False,
            "error":
                "Không thể tải file E-learning.",
        }), 502

    except Exception as error:
        print(
            "E-learning storage error:",
            error,
        )
        return jsonify({
            "success": False,
            "error":
                "Không thể tải file E-learning.",
        }), 500

    # =========================================================
# CLASSROOM ASSET STORAGE
# =========================================================


CLASSROOM_ALLOWED_MIME_TYPES = {
    # Images
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",

    # Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    "application/x-zip-compressed",

    # Text / source code
    "text/plain",
    "text/csv",
    "text/x-python",
    "text/javascript",
    "application/javascript",
    "application/json",

    # Video
    "video/mp4",
}


CLASSROOM_ALLOWED_KINDS = {
    "class-message",
    "class-notification",
    "class-assignment",
    "class-submission",
    "class-logo",
    "class-cover",
}


CLASSROOM_IMAGE_KINDS = {
    "class-logo",
    "class-cover",
}


CLASSROOM_MIME_EXTENSIONS = {
    "image/jpeg": {"jpg", "jpeg"},
    "image/png": {"png"},
    "image/webp": {"webp"},
    "image/gif": {"gif"},
    "application/pdf": {"pdf"},
    "application/msword": {"doc"},
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {"docx"},
    "application/vnd.ms-excel": {"xls"},
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {"xlsx"},
    "application/zip": {"zip"},
    "application/x-zip-compressed": {"zip"},
    "text/plain": {"txt"},
    "text/csv": {"csv"},
    "text/x-python": {"py"},
    "text/javascript": {"js", "mjs"},
    "application/javascript": {"js", "mjs"},
    "application/json": {"json"},
    "video/mp4": {"mp4"},
}


MAX_CLASSROOM_IMAGE_SIZE = (
    15 * 1024 * 1024
)

MAX_CLASSROOM_FILE_SIZE = (
    50 * 1024 * 1024
)

MAX_CLASSROOM_VIDEO_SIZE = (
    200 * 1024 * 1024
)

@storage_bp.post(
    "/classroom/asset"
)
@auth_required
@rate_limit(limit=60, window=3600, per_user=True)
def upload_classroom_asset():
    try:
        user = get_current_user()

        if not user:
            return jsonify({
                "success": False,
                "error":
                    "User not found",
            }), 404

        uploaded_file = request.files.get(
            "file"
        )

        if not uploaded_file:
            return jsonify({
                "success": False,
                "error":
                    "Không tìm thấy file upload.",
            }), 400

        filename = (
            uploaded_file.filename
            or ""
        ).strip()

        if not filename:
            return jsonify({
                "success": False,
                "error":
                    "Tên file không hợp lệ.",
            }), 400

        content_type = (
            uploaded_file.mimetype
            or "application/octet-stream"
        ).lower()

        kind = str(
            request.form.get(
                "kind"
            )
            or ""
        ).strip().lower()

        classroom_id = (
            normalize_storage_identifier(
                request.form.get(
                    "classId"
                ),
                max_length=100,
            )
        )

        if (
            kind
            not in
            CLASSROOM_ALLOWED_KINDS
        ):
            return jsonify({
                "success": False,
                "error":
                    "Loại asset Classroom không hợp lệ.",
            }), 400

        if not classroom_id:
            return jsonify({
                "success": False,
                "error":
                    "classId không hợp lệ.",
            }), 400

        classroom, member = get_classroom_access(user, classroom_id)

        if not classroom:
            return jsonify({
                "success": False,
                "error": "Không tìm thấy lớp học.",
            }), 404

        if not can_upload_classroom_kind(user, classroom, member, kind):
            return jsonify({
                "success": False,
                "error": "Bạn không có quyền tải loại tệp này lên lớp học.",
            }), 403

        if (
            content_type
            not in
            CLASSROOM_ALLOWED_MIME_TYPES
        ):
            return jsonify({
                "success": False,
                "error":
                    "Định dạng file Classroom không được hỗ trợ.",
            }), 400

        if (
            kind in CLASSROOM_IMAGE_KINDS
            and not content_type.startswith("image/")
        ):
            return jsonify({
                "success": False,
                "error": "Logo và ảnh bìa lớp phải là tệp hình ảnh.",
            }), 400

        extension = (
            os.path.splitext(filename)[1]
            .lower()
            .strip(".")
        )

        allowed_extensions = CLASSROOM_MIME_EXTENSIONS.get(
            content_type,
            set(),
        )

        if not extension or extension not in allowed_extensions:
            return jsonify({
                "success": False,
                "error": "Phần mở rộng tệp không khớp định dạng nội dung.",
            }), 400

        file_size = get_file_size(
            uploaded_file
        )

        if file_size <= 0:
            return jsonify({
                "success": False,
                "error":
                    "File upload rỗng.",
            }), 400

        if content_type.startswith(
            "image/"
        ):
            max_size = (
                MAX_CLASSROOM_IMAGE_SIZE
            )

        elif content_type.startswith(
            "video/"
        ):
            max_size = (
                MAX_CLASSROOM_VIDEO_SIZE
            )

        else:
            max_size = (
                MAX_CLASSROOM_FILE_SIZE
            )

        if file_size > max_size:
            return jsonify({
                "success": False,
                "error":
                    "File vượt quá giới hạn dung lượng cho phép.",
                "maxSize":
                    max_size,
            }), 400

        object_key = (
            f"classrooms/"
            f"{classroom_id}/"
            f"{kind}/"
            f"{user.id}/"
            f"{uuid.uuid4().hex}."
            f"{extension}"
        )

        upload_result = (
            upload_file_object(
                uploaded_file,
                object_key,
                content_type=
                    content_type,
                metadata={
                    "user_id":
                        user.id,

                    "class_id":
                        classroom_id,

                    "original_name":
                        filename,

                    "purpose":
                        kind,
                },
            )
        )

        public_url = (
            build_public_url(
                object_key
            )
        )

        url = (
            public_url
            or generate_presigned_get_url(
                object_key,
                expires_in=3600,
            )
        )

        return jsonify({
            "success": True,

            "key":
                object_key,

            "path":
                object_key,

            "objectKey":
                object_key,

            "storagePath":
                object_key,

            "url":
                url,

            "fileUrl":
                url,

            "downloadUrl":
                url,

            "publicUrl":
                public_url
                or "",

            "fileName":
                filename,

            "name":
                filename,

            "contentType":
                upload_result.get(
                    "contentType",
                    content_type,
                ),

            "type":
                upload_result.get(
                    "contentType",
                    content_type,
                ),

            "size":
                file_size,

            "kind":
                kind,

            "classId":
                classroom_id,
        }), 200

    except R2StorageError as error:
        print(
            "R2 Classroom upload error:",
            error,
        )
        return jsonify({
            "success": False,
            "error":
                "Không thể tải file Classroom.",
        }), 502

    except Exception as error:
        print(
            "Classroom upload storage error:",
            error,
        )
        return jsonify({
            "success": False,
            "error":
                "Không thể tải file Classroom.",
        }), 500

@storage_bp.delete(
    "/classroom/asset"
)
@auth_required
@rate_limit(limit=120, window=3600, per_user=True)
def delete_classroom_asset():
    try:
        user = get_current_user()

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

        object_key = (
            normalize_storage_identifier(
                data.get(
                    "storagePath"
                )
                or data.get(
                    "objectKey"
                )
                or data.get(
                    "key"
                ),
                max_length=500,
            )
        )

        if not object_key:
            raw_key = str(
                data.get(
                    "storagePath"
                )
                or data.get(
                    "objectKey"
                )
                or data.get(
                    "key"
                )
                or ""
            ).strip()

            # object keys contain "/",
            # so normalize_storage_identifier()
            # is intentionally too strict for this case.
            object_key = (
                raw_key
                .lstrip("/")
            )

        if not object_key:
            return jsonify({
                "success": False,
                "error":
                    "storagePath không hợp lệ.",
            }), 400

        if not object_key.startswith(
            "classrooms/"
        ):
            return jsonify({
                "success": False,
                "error":
                    "Không được phép xóa object ngoài Classroom.",
            }), 403

        key_parts = object_key.split("/")
        if len(key_parts) < 5:
            return jsonify({
                "success": False,
                "error": "Object key Classroom không hợp lệ.",
            }), 400

        classroom_id, kind, owner_id = key_parts[1], key_parts[2], key_parts[3]
        classroom, member = get_classroom_access(user, classroom_id)

        if not classroom:
            return jsonify({
                "success": False,
                "error": "Không tìm thấy lớp học.",
            }), 404

        owns_object = str(owner_id) == str(user.id)
        if not owns_object and not can_manage_classroom(user, classroom, member):
            return jsonify({
                "success": False,
                "error": "Bạn không có quyền xóa tệp này.",
            }), 403

        if not can_upload_classroom_kind(user, classroom, member, kind):
            return jsonify({
                "success": False,
                "error": "Bạn không có quyền quản lý loại tệp này.",
            }), 403

        delete_file(
            object_key
        )

        return jsonify({
            "success": True,
            "storagePath":
                object_key,
        }), 200

    except R2StorageError as error:
        print(
            "R2 Classroom delete error:",
            error,
        )
        return jsonify({
            "success": False,
            "error":
                "Không thể xóa file Classroom.",
        }), 502

    except Exception as error:
        print(
            "Classroom delete storage error:",
            error,
        )
        return jsonify({
            "success": False,
            "error":
                "Không thể xóa file Classroom.",
        }), 500
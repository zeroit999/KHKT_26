import secrets
import string
from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request

from auth import auth_required
from extensions import db
from models import (
    ForumGroup,
    ForumGroupMessage,
    ForumGroupPresence,
    ForumGroupReport,
    ForumGroupWarning,
    ForumNotification,
    ForumPost,
    User,
)


forum_groups_bp = Blueprint(
    "forum_groups_sql",
    __name__,
    url_prefix="/api/forum",
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


def ids(value):
    return [
        str(item)
        for item in value
    ] if isinstance(
        value,
        list,
    ) else []


def random_code(
    length=7,
):
    chars = (
        string.ascii_letters
        + string.digits
    )

    return "".join(
        secrets.choice(chars)
        for _ in range(length)
    )


def random_invite():
    chars = (
        string.ascii_letters
        + string.digits
        + "!@#$%^&*"
    )

    return (
        "".join(
            secrets.choice(chars)
            for _ in range(6)
        )
        + "_"
        + "".join(
            secrets.choice(
                string.digits
            )
            for _ in range(4)
        )
    )


def user_name(user):
    return (
        getattr(
            user,
            "full_name",
            "",
        )
        or getattr(
            user,
            "email",
            "",
        )
        or "Người dùng ZUNY"
    ).strip()


def user_avatar(user):
    profile = (
        user.profile_data
        if user
        and isinstance(
            user.profile_data,
            dict,
        )
        else {}
    )

    return (
        profile.get(
            "photoURL"
        )
        or profile.get(
            "avatarUrl"
        )
        or profile.get(
            "avatarURL"
        )
        or profile.get(
            "avatar"
        )
        or profile.get(
            "profileImage"
        )
        or ""
    )


def serialize_group(group):
    data = dict(
        group.data
        or {}
    )

    data.update({
        "id":
            str(group.id),

        "ownerId":
            str(
                group.owner_id
            ),

        "name":
            group.name,

        "description":
            group.description
            or "",

        "groupType":
            group.group_type
            or "public",

        "isPrivate":
            (
                group.group_type
                or "public"
            )
            == "private",

        "groupCode":
            group.group_code
            or "",

        "inviteCode":
            group.invite_code
            or "",

        "memberIds":
            ids(
                group.member_ids
            ),

        "adminIds":
            ids(
                group.admin_ids
            ),

        "pendingMemberIds":
            ids(
                group.pending_member_ids
            ),

        "adminTemporaryMemberIds":
            ids(
                group.temporary_admin_ids
            ),

        "temporaryAdminIds":
            ids(
                group.temporary_admin_ids
            ),

        "membersCount":
            len(
                ids(
                    group.member_ids
                )
            ),

        "reportCount":
            int(
                group.report_count
                or 0
            ),

        "reportStatus":
            group.report_status
            or "",

        "createdAt":
            (
                group.created_at
                .isoformat()
                if group.created_at
                else None
            ),

        "updatedAt":
            (
                group.updated_at
                .isoformat()
                if group.updated_at
                else None
            ),
    })

    return data


def serialize_report(item):
    snap = dict(
        item.snapshot
        or {}
    )

    snap.update({
        "id":
            str(item.id),

        "groupId":
            str(
                item.group_id
            ),

        "reporterId":
            str(
                item.reporter_id
            ),

        "reason":
            item.reason
            or "",

        "detail":
            item.detail
            or "",

        "status":
            item.status
            or "open",

        "resolvedBy":
            (
                str(
                    item.resolved_by
                )
                if item.resolved_by
                else ""
            ),

        "resolvedAt":
            (
                item.resolved_at
                .isoformat()
                if item.resolved_at
                else None
            ),

        "createdAt":
            (
                item.created_at
                .isoformat()
                if item.created_at
                else None
            ),

        "updatedAt":
            (
                item.updated_at
                .isoformat()
                if item.updated_at
                else None
            ),
    })

    return snap


def serialize_message(
    message,
    author=None,
):
    reactions = (
        message.reactions
        if isinstance(
            message.reactions,
            dict,
        )
        else {}
    )

    return {
        "id":
            str(
                message.id
            ),

        "groupId":
            str(
                message.group_id
            ),

        "channelId":
            message.channel_id
            or "thao-luan",

        "content":
            message.content
            or "",

        "messageType":
            message.message_type
            or "text",

        "type":
            (
                "system"
                if (
                    message.message_type
                    == "system"
                )
                else (
                    message.metadata_json
                    or {}
                ).get(
                    "type",
                    ""
                )
            ),

        "isAnnouncement":
            bool(
                message.is_announcement
            ),

        "isLike":
            bool(
                message.is_like
            ),

        "authorId":
            str(
                message.author_id
            ),

        "authorName":
            user_name(
                author
            ),

        "authorInitials":
            "",

        "authorRole":
            (
                str(
                    getattr(
                        author,
                        "role",
                        "STUDENT",
                    )
                    or "STUDENT"
                )
                .lower()
            ),

        "authorPhotoURL":
            user_avatar(
                author
            ),

        "fileUrl":
            message.attachment_url
            or "",

        "attachmentUrl":
            message.attachment_url
            or "",

        "downloadUrl":
            message.attachment_url
            or "",

        "fileKey":
            message.attachment_key
            or "",

        "fileName":
            message.attachment_name
            or "",

        "fileType":
            message.attachment_type
            or "",

        "fileSize":
            int(
                message.attachment_size
                or 0
            ),

        "replyToId":
            (
                str(
                    message.reply_to_id
                )
                if message.reply_to_id
                else ""
            ),

        "replyToAuthor":
            message.reply_to_author
            or "",

        "replyToContent":
            message.reply_to_content
            or "",

        "reactions":
            reactions,

        "isPinned":
            bool(
                message.is_pinned
            ),

        "edited":
            bool(
                message.edited
            ),

        "editedAt":
            (
                message.edited_at
                .isoformat()
                if message.edited_at
                else None
            ),

        "createdAt":
            (
                message.created_at
                .isoformat()
                if message.created_at
                else None
            ),

        "updatedAt":
            (
                message.updated_at
                .isoformat()
                if message.updated_at
                else None
            ),
    }


def serialize_presence(
    presence,
    user=None,
):
    return {
        "userId":
            str(
                presence.user_id
            ),

        "groupId":
            str(
                presence.group_id
            ),

        "channelId":
            presence.channel_id
            or "",

        "channelLabel":
            presence.channel_label
            or "",

        "online":
            bool(
                presence.online
            ),

        "lastSeen":
            (
                presence.last_seen
                .isoformat()
                if presence.last_seen
                else None
            ),

        "name":
            user_name(
                user
            ),

        "role":
            (
                str(
                    getattr(
                        user,
                        "role",
                        "STUDENT",
                    )
                    or "STUDENT"
                )
                .lower()
            ),

        "avatarUrl":
            user_avatar(
                user
            ),
    }


def can_manage(
    user,
    group,
):
    return bool(
        user
        and (
            role(user)
            == "ADMIN_DEV"
            or int(
                group.owner_id
            )
            == int(
                user.id
            )
            or str(
                user.id
            )
            in ids(
                group.admin_ids
            )
        )
    )


def can_owner_manage(
    user,
    group,
):
    return bool(
        user
        and (
            role(user)
            == "ADMIN_DEV"
            or int(
                group.owner_id
            )
            == int(
                user.id
            )
        )
    )


def is_group_member(
    user,
    group,
):
    return bool(
        user
        and (
            str(
                user.id
            )
            in ids(
                group.member_ids
            )
            or int(
                group.owner_id
            )
            == int(
                user.id
            )
            or role(user)
            == "ADMIN_DEV"
        )
    )


def add_notification(
    to_user_id,
    from_user,
    type_,
    text,
    *,
    category="admin",
    scope="group",
    group_id=None,
    post_id=None,
):
    db.session.add(
        ForumNotification(
            to_user_id=
                int(
                    to_user_id
                ),

            from_user_id=
                int(
                    from_user.id
                ),

            type=
                type_,

            category=
                category,

            scope=
                scope,

            post_id=
                post_id,

            text=
                (
                    (
                        f"[group:{group_id}] "
                        if group_id
                        else ""
                    )
                    + str(
                        text
                        or ""
                    )
                ),

            read=
                False,
        )
    )


@forum_groups_bp.get(
    "/users"
)
@auth_required
def get_forum_users():
    user = current_user()

    if not user:
        return jsonify({
            "success": False,
            "error":
                "User not found",
        }), 404

    limit = max(
        1,
        min(
            request.args.get(
                "limit",
                500,
                type=int,
            )
            or 500,
            1000,
        ),
    )

    rows = (
        db.session.execute(
            db.select(
                User
            )
            .order_by(
                User.id.asc()
            )
            .limit(
                limit
            )
        )
        .scalars()
        .all()
    )

    return jsonify({
        "success": True,
        "users": [
            row.to_dict()
            for row in rows
        ],
        "count":
            len(rows),
    }), 200


@forum_groups_bp.patch(
    "/users/<int:user_id>/restrictions"
)
@auth_required
def update_restrictions(
    user_id,
):
    admin = current_user()

    if (
        not admin
        or role(admin)
        != "ADMIN_DEV"
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

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

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    key = str(
        data.get(
            "key"
        )
        or ""
    )

    if key not in {
        "blockCommunityPosting",
        "blockGroupCreation",
    }:
        return jsonify({
            "success": False,
            "error":
                "Invalid restriction",
        }), 400

    profile = dict(
        target.profile_data
        or {}
    )

    restrictions = dict(
        profile.get(
            "forumRestrictions"
        )
        or {}
    )

    restrictions[key] = bool(
        data.get(
            "blocked"
        )
    )

    restrictions[
        "updatedAt"
    ] = utc_now().isoformat()

    restrictions[
        "updatedBy"
    ] = str(
        admin.id
    )

    profile[
        "forumRestrictions"
    ] = restrictions

    target.profile_data = profile

    db.session.commit()

    return jsonify({
        "success": True,
        "user":
            target.to_dict(),
    }), 200


@forum_groups_bp.patch(
    "/users/me/forum-settings"
)
@auth_required
def update_my_forum_settings():
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

    profile = dict(
        user.profile_data
        or {}
    )

    if "pinnedGroupIds" in data:
        profile[
            "pinnedGroupIds"
        ] = [
            str(item)
            for item in (
                data.get(
                    "pinnedGroupIds"
                )
                or []
            )
            if item
        ]

    user.profile_data = profile
    db.session.commit()

    return jsonify({
        "success": True,
        "user":
            user.to_dict(),
    }), 200


@forum_groups_bp.get(
    "/groups"
)
@auth_required
def get_groups():
    limit = max(
        1,
        min(
            request.args.get(
                "limit",
                160,
                type=int,
            )
            or 160,
            500,
        ),
    )

    rows = (
        db.session.execute(
            db.select(
                ForumGroup
            )
            .order_by(
                ForumGroup.created_at.desc(),
                ForumGroup.id.desc(),
            )
            .limit(
                limit
            )
        )
        .scalars()
        .all()
    )

    return jsonify({
        "success": True,
        "groups": [
            serialize_group(
                row
            )
            for row in rows
        ],
        "count":
            len(rows),
    }), 200


@forum_groups_bp.post(
    "/groups"
)
@auth_required
def create_group():
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

    name = str(
        data.get(
            "name"
        )
        or ""
    ).strip()

    if not name:
        return jsonify({
            "success": False,
            "error":
                "Tên nhóm không được để trống.",
        }), 400

    profile = dict(
        user.profile_data
        or {}
    )

    restrictions = dict(
        profile.get(
            "forumRestrictions"
        )
        or {}
    )

    if restrictions.get(
        "blockGroupCreation"
    ):
        return jsonify({
            "success": False,
            "error":
                "Tài khoản đang bị chặn tạo nhóm.",
        }), 403

    owned = (
        db.session.scalar(
            db.select(
                db.func.count()
            )
            .select_from(
                ForumGroup
            )
            .where(
                ForumGroup.owner_id
                == user.id
            )
        )
        or 0
    )

    if owned >= 3:
        return jsonify({
            "success": False,
            "error":
                "Mỗi người chỉ được tạo tối đa 3 nhóm.",
        }), 409

    group_type = str(
        data.get(
            "groupType"
        )
        or (
            "private"
            if data.get(
                "isPrivate"
            )
            else "public"
        )
    )

    group_code = str(
        data.get(
            "groupCode"
        )
        or ""
    ).strip() or random_code()

    while db.session.scalar(
        db.select(
            ForumGroup.id
        )
        .where(
            ForumGroup.group_code
            == group_code
        )
    ):
        group_code = random_code()

    invite = (
        str(
            data.get(
                "inviteCode"
            )
            or ""
        ).strip()
        if group_type
        == "invite_only"
        else None
    )

    if (
        group_type
        == "invite_only"
        and not invite
    ):
        invite = random_invite()

    stored = dict(
        data
    )

    for key in [
        "id",
        "ownerId",
        "memberIds",
        "adminIds",
        "pendingMemberIds",
        "adminTemporaryMemberIds",
        "temporaryAdminIds",
        "groupCode",
        "inviteCode",
        "name",
        "description",
        "groupType",
    ]:
        stored.pop(
            key,
            None,
        )

    row = ForumGroup(
        owner_id=
            user.id,

        name=
            name,

        description=
            str(
                data.get(
                    "description"
                )
                or ""
            ).strip(),

        group_type=
            group_type,

        group_code=
            group_code,

        invite_code=
            invite,

        member_ids=[
            str(
                user.id
            )
        ],

        admin_ids=[],

        pending_member_ids=[],

        temporary_admin_ids=[],

        data=
            stored,
    )

    db.session.add(
        row
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "group":
            serialize_group(
                row
            ),
    }), 201


@forum_groups_bp.patch(
    "/groups/<int:group_id>"
)
@auth_required
def update_group(
    group_id,
):
    user = current_user()

    row = db.session.get(
        ForumGroup,
        group_id,
    )

    if not row:
        return jsonify({
            "success": False,
            "error":
                "Nhóm không tồn tại.",
        }), 404

    if not can_manage(
        user,
        row,
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

    if "name" in data:
        row.name = (
            str(
                data[
                    "name"
                ]
                or ""
            ).strip()
            or row.name
        )

    if "description" in data:
        row.description = str(
            data[
                "description"
            ]
            or ""
        )

    if "groupType" in data:
        row.group_type = str(
            data[
                "groupType"
            ]
            or row.group_type
        )

    stored = dict(
        row.data
        or {}
    )

    stored.update({
        key:
            value

        for key, value
        in data.items()

        if key
        not in {
            "id",
            "ownerId",
            "memberIds",
            "adminIds",
            "pendingMemberIds",
            "adminTemporaryMemberIds",
            "temporaryAdminIds",
            "name",
            "description",
            "groupType",
        }
    })

    row.data = stored
    row.updated_at = utc_now()

    db.session.commit()

    return jsonify({
        "success": True,
        "group":
            serialize_group(
                row
            ),
    }), 200


@forum_groups_bp.post(
    "/groups/<int:group_id>/rotate-invite"
)
@auth_required
def rotate_invite(
    group_id,
):
    user = current_user()

    row = db.session.get(
        ForumGroup,
        group_id,
    )

    if not row:
        return jsonify({
            "success": False,
            "error":
                "Nhóm không tồn tại.",
        }), 404

    if not can_manage(
        user,
        row,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    row.invite_code = (
        random_invite()
    )

    data = dict(
        row.data
        or {}
    )

    data[
        "inviteCodeIssuedAtMs"
    ] = int(
        utc_now()
        .timestamp()
        * 1000
    )

    row.data = data

    db.session.commit()

    return jsonify({
        "success": True,
        "group":
            serialize_group(
                row
            ),
    }), 200


@forum_groups_bp.post(
    "/groups/<int:group_id>/membership"
)
@auth_required
def membership(
    group_id,
):
    user = current_user()

    row = db.session.get(
        ForumGroup,
        group_id,
    )

    if (
        not user
        or not row
    ):
        return jsonify({
            "success": False,
            "error":
                "Không tìm thấy người dùng hoặc nhóm.",
        }), 404

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    action = str(
        data.get(
            "action"
        )
        or ""
    )

    uid = str(
        user.id
    )

    members = ids(
        row.member_ids
    )

    pending = ids(
        row.pending_member_ids
    )

    admins = ids(
        row.admin_ids
    )

    temp = ids(
        row.temporary_admin_ids
    )

    if action == "request":
        if (
            uid
            not in pending
        ):
            pending.append(
                uid
            )

    elif action == "join":
        if (
            uid
            not in members
        ):
            members.append(
                uid
            )

        pending = [
            item
            for item
            in pending
            if item
            != uid
        ]

    elif action == "leave":
        if (
            int(
                row.owner_id
            )
            == int(
                user.id
            )
            and len(
                members
            )
            > 1
        ):
            return jsonify({
                "success": False,
                "error":
                    "Trưởng nhóm phải chuyển quyền trước khi rời nhóm.",
            }), 409

        members = [
            item
            for item
            in members
            if item
            != uid
        ]

        admins = [
            item
            for item
            in admins
            if item
            != uid
        ]

        pending = [
            item
            for item
            in pending
            if item
            != uid
        ]

        temp = [
            item
            for item
            in temp
            if item
            != uid
        ]

    elif (
        action
        == "remove-temporary-admin"
    ):
        temp = [
            item
            for item
            in temp
            if item
            != uid
        ]

        if (
            int(
                row.owner_id
            )
            != int(
                user.id
            )
        ):
            members = [
                item
                for item
                in members
                if item
                != uid
            ]

    else:
        return jsonify({
            "success": False,
            "error":
                "Action không hợp lệ.",
        }), 400

    row.member_ids = members
    row.pending_member_ids = pending
    row.admin_ids = admins
    row.temporary_admin_ids = temp
    row.updated_at = utc_now()

    db.session.commit()

    return jsonify({
        "success": True,
        "group":
            serialize_group(
                row
            ),
    }), 200


@forum_groups_bp.patch(
    "/groups/<int:group_id>/members/<int:target_user_id>"
)
@auth_required
def manage_group_member(
    group_id,
    target_user_id,
):
    actor = current_user()

    group = db.session.get(
        ForumGroup,
        group_id,
    )

    target = db.session.get(
        User,
        target_user_id,
    )

    if (
        not actor
        or not group
        or not target
    ):
        return jsonify({
            "success": False,
            "error":
                "Không tìm thấy nhóm hoặc người dùng.",
        }), 404

    if not can_manage(
        actor,
        group,
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

    action = str(
        data.get(
            "action"
        )
        or ""
    )

    uid = str(
        target.id
    )

    members = ids(
        group.member_ids
    )

    pending = ids(
        group.pending_member_ids
    )

    admins = ids(
        group.admin_ids
    )

    temp = ids(
        group.temporary_admin_ids
    )

    if (
        uid
        == str(
            group.owner_id
        )
        and action
        in {
            "kick",
            "demote",
            "reject",
        }
    ):
        return jsonify({
            "success": False,
            "error":
                "Không thể thực hiện thao tác này với trưởng nhóm.",
        }), 409

    if action == "approve":
        if uid not in members:
            members.append(
                uid
            )

        pending = [
            item
            for item
            in pending
            if item
            != uid
        ]

    elif action == "reject":
        pending = [
            item
            for item
            in pending
            if item
            != uid
        ]

    elif action == "kick":
        if role(target) in {
            "ADMIN_DEV",
        }:
            return jsonify({
                "success": False,
                "error":
                    "Không thể kick quản trị viên hệ thống.",
            }), 409

        members = [
            item
            for item
            in members
            if item
            != uid
        ]

        admins = [
            item
            for item
            in admins
            if item
            != uid
        ]

        pending = [
            item
            for item
            in pending
            if item
            != uid
        ]

        temp = [
            item
            for item
            in temp
            if item
            != uid
        ]

        add_notification(
            target.id,
            actor,
            "group-member-kicked",
            (
                f'{user_name(actor)} đã kick bạn khỏi nhóm '
                f'"{group.name}".'
            ),
            category="group",
            scope="group",
            group_id=
                group.id,
        )

    elif action == "promote":
        if uid not in members:
            return jsonify({
                "success": False,
                "error":
                    "Người dùng chưa phải thành viên nhóm.",
            }), 409

        if uid not in admins:
            admins.append(
                uid
            )

    elif action == "demote":
        admins = [
            item
            for item
            in admins
            if item
            != uid
        ]

    elif action == "transfer-owner":
        if not can_owner_manage(
            actor,
            group,
        ):
            return jsonify({
                "success": False,
                "error":
                    "Chỉ trưởng nhóm hoặc ADMIN_DEV được chuyển quyền.",
            }), 403

        if uid not in members:
            return jsonify({
                "success": False,
                "error":
                    "Người nhận phải là thành viên của nhóm.",
            }), 409

        old_owner = str(
            group.owner_id
        )

        group.owner_id = (
            target.id
        )

        if (
            old_owner
            not in admins
        ):
            admins.append(
                old_owner
            )

        admins = [
            item
            for item
            in admins
            if item
            != uid
        ]

    else:
        return jsonify({
            "success": False,
            "error":
                "Action không hợp lệ.",
        }), 400

    group.member_ids = members
    group.pending_member_ids = pending
    group.admin_ids = admins
    group.temporary_admin_ids = temp
    group.updated_at = utc_now()

    db.session.commit()

    return jsonify({
        "success": True,
        "group":
            serialize_group(
                group
            ),
    }), 200


@forum_groups_bp.post(
    "/groups/<int:group_id>/admin-join"
)
@auth_required
def admin_join(
    group_id,
):
    user = current_user()

    row = db.session.get(
        ForumGroup,
        group_id,
    )

    if (
        not user
        or role(user)
        != "ADMIN_DEV"
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    if not row:
        return jsonify({
            "success": False,
            "error":
                "Nhóm không tồn tại.",
        }), 404

    has_report = db.session.scalar(
        db.select(
            ForumGroupReport.id
        )
        .where(
            ForumGroupReport.group_id
            == row.id,

            ForumGroupReport.status
            == "open",
        )
    )

    if not has_report:
        return jsonify({
            "success": False,
            "error":
                "Nhóm không có báo cáo đang mở.",
        }), 409

    uid = str(
        user.id
    )

    members = ids(
        row.member_ids
    )

    temp = ids(
        row.temporary_admin_ids
    )

    if uid not in members:
        members.append(
            uid
        )

    if uid not in temp:
        temp.append(
            uid
        )

    row.member_ids = members
    row.temporary_admin_ids = temp

    db.session.commit()

    return jsonify({
        "success": True,
        "group":
            serialize_group(
                row
            ),
    }), 200


@forum_groups_bp.post(
    "/groups/<int:group_id>/reports"
)
@auth_required
def report_group(
    group_id,
):
    user = current_user()

    group = db.session.get(
        ForumGroup,
        group_id,
    )

    if (
        not user
        or not group
    ):
        return jsonify({
            "success": False,
            "error":
                "Không tìm thấy người dùng hoặc nhóm.",
        }), 404

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

    detail = str(
        data.get(
            "detail"
        )
        or ""
    ).strip()

    existing = db.session.scalar(
        db.select(
            ForumGroupReport.id
        )
        .where(
            ForumGroupReport.group_id
            == group.id,

            ForumGroupReport.reporter_id
            == user.id,

            ForumGroupReport.status
            == "open",
        )
    )

    if existing:
        return jsonify({
            "success": False,
            "error":
                "Bạn đã báo cáo nhóm này rồi.",
        }), 409

    snap = {
        "groupName":
            group.name,

        "groupDescription":
            group.description,

        "groupOwnerId":
            str(
                group.owner_id
            ),

        "reporterName":
            user_name(
                user
            ),

        "reporterEmail":
            user.email
            or "",
    }

    report = ForumGroupReport(
        group_id=
            group.id,

        reporter_id=
            user.id,

        reason=
            reason,

        detail=
            detail,

        status=
            "open",

        snapshot=
            snap,
    )

    db.session.add(
        report
    )

    group.report_count = (
        int(
            group.report_count
            or 0
        )
        + 1
    )

    group.report_status = (
        "open"
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "report":
            serialize_report(
                report
            ),
    }), 201


@forum_groups_bp.get(
    "/group-reports"
)
@auth_required
def group_reports():
    user = current_user()

    if (
        not user
        or role(user)
        != "ADMIN_DEV"
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    limit = max(
        1,
        min(
            request.args.get(
                "limit",
                160,
                type=int,
            )
            or 160,
            500,
        ),
    )

    rows = (
        db.session.execute(
            db.select(
                ForumGroupReport
            )
            .order_by(
                ForumGroupReport.created_at
                .desc()
            )
            .limit(
                limit
            )
        )
        .scalars()
        .all()
    )

    items = [
        serialize_report(
            row
        )
        for row in rows
    ]

    return jsonify({
        "success": True,
        "reports":
            items,
        "count":
            len(
                items
            ),
    }), 200


@forum_groups_bp.patch(
    "/group-reports/<int:report_id>"
)
@auth_required
def resolve_group_report(
    report_id,
):
    user = current_user()

    item = db.session.get(
        ForumGroupReport,
        report_id,
    )

    if (
        not user
        or role(user)
        != "ADMIN_DEV"
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    if not item:
        return jsonify({
            "success": False,
            "error":
                "Báo cáo không tồn tại.",
        }), 404

    status = str(
        (
            request.get_json(
                silent=True
            )
            or {}
        )
        .get(
            "status"
        )
        or "resolved"
    )

    item.status = status
    item.resolved_by = (
        user.id
    )
    item.resolved_at = (
        utc_now()
    )
    item.updated_at = (
        utc_now()
    )

    group = db.session.get(
        ForumGroup,
        item.group_id,
    )

    if group:
        remaining = (
            db.session.scalar(
                db.select(
                    db.func.count()
                )
                .select_from(
                    ForumGroupReport
                )
                .where(
                    ForumGroupReport.group_id
                    == group.id,

                    ForumGroupReport.status
                    == "open",

                    ForumGroupReport.id
                    != item.id,
                )
            )
            or 0
        )

        group.report_count = (
            remaining
        )

        group.report_status = (
            "open"
            if remaining
            else status
        )

    db.session.commit()

    return jsonify({
        "success": True,
        "report":
            serialize_report(
                item
            ),
    }), 200


@forum_groups_bp.post(
    "/groups/<int:group_id>/warnings"
)
@auth_required
def warn_group(
    group_id,
):
    admin = current_user()

    group = db.session.get(
        ForumGroup,
        group_id,
    )

    if (
        not admin
        or role(admin)
        != "ADMIN_DEV"
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    if not group:
        return jsonify({
            "success": False,
            "error":
                "Nhóm không tồn tại.",
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
                "Nội dung cảnh báo trống.",
        }), 400

    warning = ForumGroupWarning(
        group_id=
            group.id,

        owner_id=
            group.owner_id,

        admin_id=
            admin.id,

        content=
            content,

        report_id=
            data.get(
                "reportId"
            )
            or None,
    )

    db.session.add(
        warning
    )

    add_notification(
        group.owner_id,
        admin,
        "group-warning",
        content,
        category="admin",
        scope="group",
        group_id=
            group.id,
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "warning": {
            "id":
                str(
                    warning.id
                ),

            "groupId":
                str(
                    warning.group_id
                ),

            "ownerId":
                str(
                    warning.owner_id
                ),

            "adminId":
                str(
                    warning.admin_id
                ),

            "content":
                warning.content,

            "reportId":
                (
                    str(
                        warning.report_id
                    )
                    if warning.report_id
                    else ""
                ),

            "createdAt":
                (
                    warning.created_at
                    .isoformat()
                    if warning.created_at
                    else None
                ),
        },
    }), 201


@forum_groups_bp.get(
    "/groups/<int:group_id>/messages"
)
@auth_required
def get_messages(
    group_id,
):
    user = current_user()

    group = db.session.get(
        ForumGroup,
        group_id,
    )

    if (
        not user
        or not group
    ):
        return jsonify({
            "success": False,
            "error":
                "Not found",
        }), 404

    if not is_group_member(
        user,
        group,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    channel_id = str(
        request.args.get(
            "channelId"
        )
        or ""
    ).strip()

    limit = max(
        1,
        min(
            request.args.get(
                "limit",
                300,
                type=int,
            )
            or 300,
            500,
        ),
    )

    statement = (
        db.select(
            ForumGroupMessage
        )
        .where(
            ForumGroupMessage.group_id
            == group.id
        )
    )

    if channel_id:
        statement = (
            statement.where(
                ForumGroupMessage.channel_id
                == channel_id
            )
        )

    rows = (
        db.session.execute(
            statement
            .order_by(
                ForumGroupMessage.created_at
                .asc()
            )
            .limit(
                limit
            )
        )
        .scalars()
        .all()
    )

    author_ids = {
        row.author_id
        for row in rows
    }

    users = (
        {
            item.id:
                item
            for item
            in (
                db.session.execute(
                    db.select(
                        User
                    )
                    .where(
                        User.id.in_(
                            author_ids
                        )
                    )
                )
                .scalars()
                .all()
            )
        }
        if author_ids
        else {}
    )

    messages = [
        serialize_message(
            row,
            users.get(
                row.author_id
            ),
        )
        for row in rows
    ]

    return jsonify({
        "success": True,
        "messages":
            messages,
        "count":
            len(
                messages
            ),
    }), 200


@forum_groups_bp.post(
    "/groups/<int:group_id>/messages"
)
@auth_required
def send_message(
    group_id,
):
    user = current_user()

    group = db.session.get(
        ForumGroup,
        group_id,
    )

    if (
        not user
        or not group
    ):
        return jsonify({
            "success": False,
            "error":
                "Not found",
        }), 404

    if not is_group_member(
        user,
        group,
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

    content = str(
        data.get(
            "content"
        )
        or ""
    ).strip()

    attachment_url = str(
        data.get(
            "fileUrl"
        )
        or data.get(
            "attachmentUrl"
        )
        or ""
    ).strip()

    if (
        not content
        and not attachment_url
    ):
        return jsonify({
            "success": False,
            "error":
                "Tin nhắn trống.",
        }), 400

    message_type = str(
        data.get(
            "messageType"
        )
        or "text"
    ).strip()

    row = ForumGroupMessage(
        group_id=
            group.id,

        author_id=
            user.id,

        channel_id=
            str(
                data.get(
                    "channelId"
                )
                or "thao-luan"
            ),

        content=
            content,

        message_type=
            message_type,

        is_announcement=
            bool(
                data.get(
                    "isAnnouncement"
                )
                or message_type
                in {
                    "notice",
                    "announcement",
                }
            ),

        is_like=
            bool(
                data.get(
                    "isLike"
                )
            ),

        attachment_url=
            attachment_url
            or None,

        attachment_key=
            str(
                data.get(
                    "fileKey"
                )
                or data.get(
                    "attachmentKey"
                )
                or ""
            )
            or None,

        attachment_name=
            str(
                data.get(
                    "fileName"
                )
                or ""
            )
            or None,

        attachment_type=
            str(
                data.get(
                    "fileType"
                )
                or ""
            )
            or None,

        attachment_size=
            int(
                data.get(
                    "fileSize"
                )
                or 0
            ),

        reply_to_id=
            (
                int(
                    data.get(
                        "replyToId"
                    )
                )
                if str(
                    data.get(
                        "replyToId"
                    )
                    or ""
                ).isdigit()
                else None
            ),

        reply_to_author=
            str(
                data.get(
                    "replyToAuthor"
                )
                or ""
            )
            or None,

        reply_to_content=
            str(
                data.get(
                    "replyToContent"
                )
                or ""
            )
            or None,

        reactions={},

        metadata_json=
            dict(
                data.get(
                    "metadata"
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
        "message":
            serialize_message(
                row,
                user,
            ),
    }), 201


@forum_groups_bp.patch(
    "/groups/<int:group_id>/messages/<int:message_id>"
)
@auth_required
def update_message(
    group_id,
    message_id,
):
    actor = current_user()

    group = db.session.get(
        ForumGroup,
        group_id,
    )

    message = db.session.get(
        ForumGroupMessage,
        message_id,
    )

    if (
        not actor
        or not group
        or not message
        or int(
            message.group_id
        )
        != int(
            group.id
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Tin nhắn không tồn tại.",
        }), 404

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    action = str(
        data.get(
            "action"
        )
        or "edit"
    )

    if action == "edit":
        if (
            int(
                message.author_id
            )
            != int(
                actor.id
            )
        ):
            return jsonify({
                "success": False,
                "error":
                    "Bạn chỉ có thể chỉnh sửa tin nhắn của mình.",
            }), 403

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
                    "Tin nhắn không được để trống.",
            }), 400

        message.content = (
            content
        )

        message.edited = True
        message.edited_at = utc_now()

    elif action == "pin":
        if not can_manage(
            actor,
            group,
        ):
            return jsonify({
                "success": False,
                "error":
                    "Bạn không có quyền ghim tin nhắn.",
            }), 403

        message.is_pinned = bool(
            data.get(
                "pinned",
                not message.is_pinned,
            )
        )

    else:
        return jsonify({
            "success": False,
            "error":
                "Action không hợp lệ.",
        }), 400

    message.updated_at = utc_now()

    db.session.commit()

    author = db.session.get(
        User,
        message.author_id,
    )

    return jsonify({
        "success": True,
        "message":
            serialize_message(
                message,
                author,
            ),
    }), 200


@forum_groups_bp.delete(
    "/groups/<int:group_id>/messages/<int:message_id>"
)
@auth_required
def delete_message(
    group_id,
    message_id,
):
    actor = current_user()

    group = db.session.get(
        ForumGroup,
        group_id,
    )

    message = db.session.get(
        ForumGroupMessage,
        message_id,
    )

    if (
        not actor
        or not group
        or not message
        or int(
            message.group_id
        )
        != int(
            group.id
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Tin nhắn không tồn tại.",
        }), 404

    if (
        int(
            message.author_id
        )
        != int(
            actor.id
        )
        and not can_manage(
            actor,
            group,
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Bạn không có quyền xóa tin nhắn này.",
        }), 403

    db.session.delete(
        message
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "messageId":
            str(
                message_id
            ),
    }), 200


@forum_groups_bp.post(
    "/groups/<int:group_id>/messages/<int:message_id>/reaction"
)
@auth_required
def react_message(
    group_id,
    message_id,
):
    actor = current_user()

    group = db.session.get(
        ForumGroup,
        group_id,
    )

    message = db.session.get(
        ForumGroupMessage,
        message_id,
    )

    if (
        not actor
        or not group
        or not message
        or int(
            message.group_id
        )
        != int(
            group.id
        )
    ):
        return jsonify({
            "success": False,
            "error":
                "Tin nhắn không tồn tại.",
        }), 404

    if not is_group_member(
        actor,
        group,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    emoji = str(
        (
            request.get_json(
                silent=True
            )
            or {}
        )
        .get(
            "emoji"
        )
        or ""
    ).strip()

    reactions = dict(
        message.reactions
        or {}
    )

    uid = str(
        actor.id
    )

    if (
        not emoji
        or reactions.get(
            uid
        )
        == emoji
    ):
        reactions.pop(
            uid,
            None,
        )
        current = ""
    else:
        reactions[
            uid
        ] = emoji
        current = emoji

    message.reactions = reactions
    message.updated_at = utc_now()

    db.session.commit()

    author = db.session.get(
        User,
        message.author_id,
    )

    return jsonify({
        "success": True,
        "reaction":
            current,
        "reactions":
            reactions,
        "message":
            serialize_message(
                message,
                author,
            ),
    }), 200


@forum_groups_bp.delete(
    "/groups/<int:group_id>/channels/<string:channel_id>/messages"
)
@auth_required
def delete_channel_messages(
    group_id,
    channel_id,
):
    actor = current_user()

    group = db.session.get(
        ForumGroup,
        group_id,
    )

    if (
        not actor
        or not group
    ):
        return jsonify({
            "success": False,
            "error":
                "Nhóm không tồn tại.",
        }), 404

    if not can_manage(
        actor,
        group,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    deleted = (
        db.session.query(
            ForumGroupMessage
        )
        .filter(
            ForumGroupMessage.group_id
            == group.id,

            ForumGroupMessage.channel_id
            == channel_id,
        )
        .delete(
            synchronize_session=False
        )
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "deleted":
            deleted,
    }), 200


@forum_groups_bp.get(
    "/groups/<int:group_id>/presence"
)
@auth_required
def get_presence(
    group_id,
):
    actor = current_user()

    group = db.session.get(
        ForumGroup,
        group_id,
    )

    if (
        not actor
        or not group
    ):
        return jsonify({
            "success": False,
            "error":
                "Nhóm không tồn tại.",
        }), 404

    if not is_group_member(
        actor,
        group,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    cutoff = (
        utc_now()
        - timedelta(
            seconds=90
        )
    )

    rows = (
        db.session.execute(
            db.select(
                ForumGroupPresence
            )
            .where(
                ForumGroupPresence.group_id
                == group.id,

                ForumGroupPresence.online
                .is_(True),

                ForumGroupPresence.last_seen
                >= cutoff,
            )
            .order_by(
                ForumGroupPresence.user_id
                .asc()
            )
        )
        .scalars()
        .all()
    )

    user_ids = {
        row.user_id
        for row in rows
    }

    users = (
        {
            item.id:
                item
            for item
            in (
                db.session.execute(
                    db.select(
                        User
                    )
                    .where(
                        User.id.in_(
                            user_ids
                        )
                    )
                )
                .scalars()
                .all()
            )
        }
        if user_ids
        else {}
    )

    items = [
        serialize_presence(
            row,
            users.get(
                row.user_id
            ),
        )
        for row in rows
    ]

    return jsonify({
        "success": True,
        "presence":
            items,
        "onlineUserIds": [
            item[
                "userId"
            ]
            for item in items
        ],
        "count":
            len(
                items
            ),
    }), 200


@forum_groups_bp.post(
    "/groups/<int:group_id>/presence"
)
@auth_required
def update_presence(
    group_id,
):
    actor = current_user()

    group = db.session.get(
        ForumGroup,
        group_id,
    )

    if (
        not actor
        or not group
    ):
        return jsonify({
            "success": False,
            "error":
                "Nhóm không tồn tại.",
        }), 404

    if not is_group_member(
        actor,
        group,
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

    row = db.session.scalar(
        db.select(
            ForumGroupPresence
        )
        .where(
            ForumGroupPresence.group_id
            == group.id,

            ForumGroupPresence.user_id
            == actor.id,
        )
    )

    if not row:
        row = ForumGroupPresence(
            group_id=
                group.id,

            user_id=
                actor.id,
        )

        db.session.add(
            row
        )

    row.channel_id = str(
        data.get(
            "channelId"
        )
        or ""
    )

    row.channel_label = str(
        data.get(
            "channelLabel"
        )
        or ""
    )

    row.online = bool(
        data.get(
            "online",
            True,
        )
    )

    row.last_seen = utc_now()
    row.updated_at = utc_now()

    db.session.commit()

    return jsonify({
        "success": True,
        "presence":
            serialize_presence(
                row,
                actor,
            ),
    }), 200




@forum_groups_bp.delete(
    "/groups/<int:group_id>"
)
@auth_required
def delete_group(
    group_id,
):
    user = current_user()

    group = db.session.get(
        ForumGroup,
        group_id,
    )

    if (
        not user
        or not group
    ):
        return jsonify({
            "success": False,
            "error":
                "Nhóm không tồn tại.",
        }), 404

    if not can_manage(
        user,
        group,
    ):
        return jsonify({
            "success": False,
            "error":
                "Forbidden",
        }), 403

    reason = str(
        (
            request.get_json(
                silent=True
            )
            or {}
        )
        .get(
            "reason"
        )
        or ""
    ).strip()

    member_ids = set(
        ids(
            group.member_ids
        )
        + [
            str(
                group.owner_id
            )
        ]
    )

    if role(
        user
    ) == "ADMIN_DEV":
        for uid in member_ids:
            if (
                uid
                != str(
                    user.id
                )
                and uid.isdigit()
            ):
                add_notification(
                    uid,
                    user,
                    "group-deleted-by-admin",
                    (
                        f'Admin_dev đã xóa nhóm "{group.name}".'
                        + (
                            f" Lý do: {reason}"
                            if reason
                            else ""
                        )
                    ),
                    category="admin",
                    scope="group",
                    group_id=
                        group.id,
                )

    posts = (
        db.session.execute(
            db.select(
                ForumPost
            )
            .where(
                ForumPost.group_id
                == str(
                    group.id
                )
            )
        )
        .scalars()
        .all()
        if hasattr(
            ForumPost,
            "group_id",
        )
        else []
    )

    for post in posts:
        db.session.delete(
            post
        )

    db.session.delete(
        group
    )

    db.session.commit()

    return jsonify({
        "success": True,
        "groupId":
            str(
                group_id
            ),
    }), 200


@forum_groups_bp.post(
    "/notifications/broadcast"
)
@auth_required
def broadcast_notification():
    actor = current_user()

    if not actor:
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

    audience = (
        data.get(
            "audience"
        )
        or "admins"
    )

    if audience == "admins":
        recipients = (
            db.session.execute(
                db.select(
                    User
                )
                .where(
                    User.role
                    == "ADMIN_DEV"
                )
            )
            .scalars()
            .all()
        )

    elif audience == "all":
        if role(
            actor
        ) != "ADMIN_DEV":
            return jsonify({
                "success": False,
                "error":
                    "Forbidden",
            }), 403

        recipients = (
            db.session.execute(
                db.select(
                    User
                )
            )
            .scalars()
            .all()
        )

    elif (
        audience
        == "group-members"
    ):
        group = db.session.get(
            ForumGroup,
            int(
                data.get(
                    "groupId"
                )
                or 0
            ),
        )

        recipients = []

        if group:
            recipient_ids = (
                {
                    int(item)
                    for item in ids(
                        group.member_ids
                    )
                    if str(
                        item
                    ).isdigit()
                }
                | {
                    int(
                        group.owner_id
                    )
                }
            )

            recipients = (
                db.session.execute(
                    db.select(
                        User
                    )
                    .where(
                        User.id.in_(
                            recipient_ids
                        )
                    )
                )
                .scalars()
                .all()
            )

    else:
        recipients = []

    for recipient in recipients:
        if (
            recipient.id
            == actor.id
        ):
            continue

        add_notification(
            recipient.id,
            actor,
            str(
                data.get(
                    "type"
                )
                or "admin-notice"
            ),
            str(
                data.get(
                    "text"
                )
                or data.get(
                    "title"
                )
                or "Thông báo"
            ),
            category=
                str(
                    data.get(
                        "category"
                    )
                    or "admin"
                ),
            scope=
                str(
                    data.get(
                        "scope"
                    )
                    or "hall"
                ),
            group_id=
                data.get(
                    "groupId"
                )
                or None,
            post_id=
                data.get(
                    "postId"
                )
                or None,
        )

    db.session.commit()

    return jsonify({
        "success": True,
        "count":
            len(
                recipients
            ),
    }), 201
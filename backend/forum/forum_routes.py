from collections import Counter
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from auth import auth_required
from extensions import db
from models import (
    ForumComment,
    ForumCommentReaction,
    ForumNotification,
    ForumPost,
    ForumReport,
    User,
)


forum_bp = Blueprint(
    "forum",
    __name__,
    url_prefix="/api/forum",
)


# =========================================================
# HELPERS
# =========================================================


def utc_now():
    return datetime.now(
        timezone.utc
    )


def iso_datetime(value):
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return str(value)


def parse_datetime(value):
    if not value:
        return None

    if isinstance(
        value,
        datetime,
    ):
        return value

    text = str(
        value
    ).strip()

    if not text:
        return None

    try:
        if text.endswith("Z"):
            text = (
                text[:-1]
                + "+00:00"
            )

        return datetime.fromisoformat(
            text
        )

    except (
        TypeError,
        ValueError,
    ):
        return None


def get_current_user_id():
    return (
        request.current_user.get(
            "user_id"
        )
        or request.current_user.get(
            "uid"
        )
    )


def get_current_user():
    user_id = (
        get_current_user_id()
    )

    if not user_id:
        return None

    return db.session.get(
        User,
        user_id,
    )


def normalize_role(value):
    return str(
        value or ""
    ).strip().upper()


def role_key(value):
    value = normalize_role(
        value
    )

    if value == "ADMIN_DEV":
        return "admin_dev"

    if value == "TEACHER":
        return "teacher"

    return "student"


def get_initials(name):
    parts = [
        part
        for part
        in str(
            name or ""
        ).strip().split()
        if part
    ]

    if not parts:
        return "ZU"

    if len(parts) == 1:
        return (
            parts[0][:2]
            .upper()
        )

    return (
        f"{parts[0][0]}"
        f"{parts[-1][0]}"
    ).upper()


def ensure_list(value):
    if isinstance(
        value,
        list,
    ):
        return value

    return []


def ensure_dict(value):
    if isinstance(
        value,
        dict,
    ):
        return value

    return {}


def clean_string(value):
    if value is None:
        return ""

    return str(
        value
    ).strip()


def clean_optional_string(
    value,
):
    text = clean_string(
        value
    )

    return (
        text
        if text
        else None
    )


def get_data_value(
    data,
    *keys,
    default=None,
):
    for key in keys:
        if key in data:
            return data.get(
                key
            )

    return default


def get_boolean_value(
    data,
    *keys,
    default=False,
):
    value = get_data_value(
        data,
        *keys,
        default=default,
    )

    if isinstance(
        value,
        bool,
    ):
        return value

    if isinstance(
        value,
        str,
    ):
        normalized = (
            value
            .strip()
            .lower()
        )

        if normalized in {
            "true",
            "1",
            "yes",
            "on",
        }:
            return True

        if normalized in {
            "false",
            "0",
            "no",
            "off",
            "",
        }:
            return False

    return bool(
        value
    )


def get_integer_value(
    data,
    *keys,
    default=0,
):
    value = get_data_value(
        data,
        *keys,
        default=default,
    )

    try:
        return int(
            value or 0
        )
    except (
        TypeError,
        ValueError,
    ):
        return int(
            default or 0
        )


def build_user_map(
    user_ids,
):
    ids = set()

    for item in user_ids:
        if not item:
            continue

        try:
            ids.add(
                int(item)
            )
        except (
            TypeError,
            ValueError,
        ):
            continue

    if not ids:
        return {}

    users = (
        db.session.execute(
            db.select(
                User
            )
            .where(
                User.id.in_(ids)
            )
        )
        .scalars()
        .all()
    )

    return {
        user.id:
            user
        for user
        in users
    }


def serialize_post(
    post,
    author=None,
):
    stored_author_name = (
        post.author_name_override
        or ""
    )

    actual_author_name = (
        (
            author.full_name
            if author
            else ""
        )
        or ""
    )

    is_anonymous = bool(
        post.is_anonymous
    )

    if is_anonymous:
        author_name = (
            stored_author_name
            or "Ẩn danh"
        )

        author_initials = (
            post.author_initials_override
            or "AD"
        )

        author_role = (
            post.author_role_override
            or "student"
        )

        author_email = (
            post.author_email_override
            or ""
        )

        author_photo_url = (
            post.author_photo_url
            or ""
        )

    else:
        author_name = (
            stored_author_name
            or actual_author_name
        )

        author_initials = (
            post.author_initials_override
            or get_initials(
                author_name
            )
        )

        author_role = (
            post.author_role_override
            or (
                role_key(
                    author.role
                )
                if author
                else "student"
            )
        )

        author_email = (
            post.author_email_override
            or (
                author.email
                if author
                else ""
            )
            or ""
        )

        author_photo_url = (
            post.author_photo_url
            or ""
        )

    tags = ensure_list(
        post.tags
    )

    event_interested_by = (
        ensure_list(
            post.event_interested_by
        )
    )

    event_not_interested_by = (
        ensure_list(
            post.event_not_interested_by
        )
    )

    poll_options = ensure_list(
        post.poll_options
    )

    poll_votes = ensure_dict(
        post.poll_votes
    )

    poll_votes_count = (
        ensure_dict(
            post.poll_votes_count
        )
    )

    reactions = ensure_dict(
        post.reactions
    )

    reaction_counts = (
        ensure_dict(
            post.reaction_counts
        )
    )

    liked_by = ensure_list(
        post.liked_by
    )

    viewed_by = ensure_list(
        post.viewed_by
    )

    saved_by = ensure_list(
        post.saved_by
    )

    reported_by = ensure_list(
        post.reported_by
    )

    return {
        "id":
            post.id,

        "authorId":
            post.author_id,

        "authorName":
            author_name,

        "authorEmail":
            author_email,

        "authorInitials":
            author_initials,

        "authorPhotoURL":
            author_photo_url,

        "authorPhotoUrl":
            author_photo_url,

        "authorRole":
            author_role,

        "title":
            post.title or "",

        "content":
            post.content or "",

        "scope":
            post.scope or "hall",

        "teacherOnly":
            bool(
                post.teacher_only
            ),

        "commentsCount":
            int(
                post.comments_count
                or 0
            ),

        # =================================================
        # TYPE / TAGS
        # =================================================

        "type":
            post.type
            or "discuss",

        "tags":
            tags,

        # =================================================
        # GROUP
        # =================================================

        "groupId":
            post.group_id
            or "",

        "groupName":
            post.group_name
            or "",

        # =================================================
        # ATTACHMENT
        # =================================================

        "attachmentUrl":
            post.attachment_url
            or "",

        "attachmentURL":
            post.attachment_url
            or "",

        "attachmentName":
            post.attachment_name
            or "",

        "imageUrl":
            post.image_url
            or "",

        "imageURL":
            post.image_url
            or "",

        # =================================================
        # EVENT
        # =================================================

        "eventStartAt":
            post.event_start_at
            or "",

        "eventEndAt":
            post.event_end_at
            or "",

        "eventLocation":
            post.event_location
            or "",

        "eventCreatedByAdmin":
            bool(
                post.event_created_by_admin
            ),

        "eventInterestedBy":
            event_interested_by,

        "eventNotInterestedBy":
            event_not_interested_by,

        "eventStartedNotifiedAt":
            iso_datetime(
                post.event_started_notified_at
            ),

        "eventEndedNotifiedAt":
            iso_datetime(
                post.event_ended_notified_at
            ),

        # =================================================
        # POLL
        # =================================================

        "pollOptions":
            poll_options,

        "pollStartAt":
            post.poll_start_at
            or "",

        "pollEndAt":
            post.poll_end_at
            or "",

        "pollVotes":
            poll_votes,

        "pollVotesCount":
            poll_votes_count,

        # =================================================
        # MODERATION
        # =================================================

        "status":
            post.status
            or "approved",

        "moderationStatus":
            post.moderation_status
            or "",

        "approvedBy":
            post.approved_by
            or "",

        "approvedAt":
            iso_datetime(
                post.approved_at
            ),

        "rejectedBy":
            post.rejected_by
            or "",

        "rejectedAt":
            iso_datetime(
                post.rejected_at
            ),

        "rejectionReason":
            post.rejection_reason
            or "",

        # =================================================
        # REACTIONS / LIKES
        # =================================================

        "likesCount":
            int(
                post.likes_count
                or 0
            ),

        "reactionsCount":
            int(
                post.reactions_count
                or 0
            ),

        "reactionCounts":
            reaction_counts,

        "reactions":
            reactions,

        "likedBy":
            liked_by,

        # =================================================
        # VIEWS / SAVES
        # =================================================

        "viewsCount":
            int(
                post.views_count
                or 0
            ),

        "viewedBy":
            viewed_by,

        "savedBy":
            saved_by,

        # =================================================
        # STATE
        # =================================================

        "isPinned":
            bool(
                post.is_pinned
            ),

        "isAnonymous":
            is_anonymous,

        "isAnswered":
            bool(
                post.is_answered
            ),

        # =================================================
        # REPORT
        # =================================================

        "reportCount":
            int(
                post.report_count
                or 0
            ),

        "reportedBy":
            reported_by,

        "reportStatus":
            post.report_status
            or "",

        # =================================================
        # TIME
        # =================================================

        "createdAt":
            iso_datetime(
                post.created_at
            ),

        "updatedAt":
            iso_datetime(
                post.updated_at
            ),
    }


def get_comment_reaction_data(
    comment_ids,
):
    ids = {
        int(item)
        for item
        in comment_ids
        if item
    }

    if not ids:
        return {}, {}

    reactions = (
        db.session.execute(
            db.select(
                ForumCommentReaction
            )
            .where(
                ForumCommentReaction
                .comment_id
                .in_(ids)
            )
        )
        .scalars()
        .all()
    )

    reaction_map = {}
    count_map = {}

    for reaction in reactions:
        comment_reactions = (
            reaction_map.setdefault(
                reaction.comment_id,
                {},
            )
        )

        comment_reactions[
            str(
                reaction.user_id
            )
        ] = (
            reaction.reaction
        )

        comment_counts = (
            count_map.setdefault(
                reaction.comment_id,
                Counter(),
            )
        )

        comment_counts[
            reaction.reaction
        ] += 1

    count_map = {
        comment_id:
            dict(counter)
        for (
            comment_id,
            counter,
        )
        in count_map.items()
    }

    return (
        reaction_map,
        count_map,
    )


def serialize_comment(
    comment,
    author=None,
    reactions=None,
    reaction_counts=None,
):
    author_name = (
        author.full_name
        if author
        else ""
    ) or ""

    reactions = (
        reactions
        if isinstance(
            reactions,
            dict,
        )
        else {}
    )

    reaction_counts = (
        reaction_counts
        if isinstance(
            reaction_counts,
            dict,
        )
        else {}
    )

    total = sum(
        int(value or 0)
        for value
        in reaction_counts.values()
    )

    return {
        "id":
            comment.id,

        "postId":
            comment.post_id,

        "content":
            comment.content or "",

        "authorId":
            comment.author_id,

        "authorName":
            author_name,

        "authorInitials":
            get_initials(
                author_name
            ),

        "authorRole":
            (
                role_key(
                    author.role
                )
                if author
                else "student"
            ),

        "parentId":
            comment.parent_id
            or "",

        "rootCommentId":
            comment.root_comment_id
            or "",

        "depth":
            int(
                comment.depth
                or 1
            ),

        "reactions":
            reactions,

        "reactionCounts":
            reaction_counts,

        "reactionsCount":
            total,

        "createdAt":
            iso_datetime(
                comment.created_at
            ),

        "updatedAt":
            iso_datetime(
                comment.updated_at
            ),
    }


def serialize_notification(
    item,
    from_user=None,
):
    from_name = (
        from_user.full_name
        if from_user
        else ""
    ) or ""

    return {
        "id":
            item.id,

        "toUserId":
            item.to_user_id,

        "fromUserId":
            item.from_user_id,

        "fromName":
            from_name,

        "type":
            item.type or "",

        "category":
            (
                item.category
                or "post-interaction"
            ),

        "scope":
            item.scope or "hall",

        "postId":
            item.post_id
            or "",

        "commentId":
            item.comment_id
            or "",

        "text":
            item.text or "",

        "read":
            bool(
                item.read
            ),

        "createdAt":
            iso_datetime(
                item.created_at
            ),
    }



def serialize_report(
    report,
):
    return {
        "id":
            report.id,

        "postId":
            report.post_id,

        "postTitle":
            report.post_title
            or "",

        "postContent":
            report.post_content
            or "",

        "postAuthorId":
            report.post_author_id
            or "",

        "postAuthorName":
            report.post_author_name
            or "",

        "reporterId":
            report.reporter_id,

        "reporterName":
            report.reporter_name
            or "",

        "reporterEmail":
            report.reporter_email
            or "",

        "reason":
            report.reason
            or "",

        "detail":
            report.detail
            or "",

        "scope":
            report.scope
            or "hall",

        "status":
            report.status
            or "open",

        "resolvedBy":
            report.resolved_by
            or "",

        "resolvedAt":
            iso_datetime(
                report.resolved_at
            ),

        "createdAt":
            iso_datetime(
                report.created_at
            ),

        "updatedAt":
            iso_datetime(
                report.updated_at
            ),
    }


# =========================================================
# POSTS
# =========================================================


@forum_bp.get(
    "/posts"
)
@auth_required
def get_posts():
    try:
        limit_value = (
            request.args.get(
                "limit",
                default=120,
                type=int,
            )
            or 120
        )

        limit_value = max(
            1,
            min(
                limit_value,
                300,
            ),
        )

        statement = (
            db.select(
                ForumPost
            )
        )

        scope = clean_string(
            request.args.get(
                "scope"
            )
        )

        post_type = clean_string(
            request.args.get(
                "type"
            )
        )

        group_id = clean_string(
            request.args.get(
                "groupId"
            )
        )

        status = clean_string(
            request.args.get(
                "status"
            )
        )

        moderation_status = (
            clean_string(
                request.args.get(
                    "moderationStatus"
                )
            )
        )

        if scope:
            statement = (
                statement.where(
                    ForumPost.scope
                    == scope
                )
            )

        if post_type:
            statement = (
                statement.where(
                    ForumPost.type
                    == post_type
                )
            )

        if group_id:
            statement = (
                statement.where(
                    ForumPost.group_id
                    == group_id
                )
            )

        if status:
            statement = (
                statement.where(
                    ForumPost.status
                    == status
                )
            )

        if moderation_status:
            statement = (
                statement.where(
                    ForumPost
                    .moderation_status
                    == moderation_status
                )
            )

        posts = (
            db.session.execute(
                statement
                .order_by(
                    ForumPost
                    .is_pinned
                    .desc(),

                    ForumPost
                    .created_at
                    .desc(),

                    ForumPost
                    .id
                    .desc(),
                )
                .limit(
                    limit_value
                )
            )
            .scalars()
            .all()
        )

        user_map = (
            build_user_map(
                [
                    post.author_id
                    for post
                    in posts
                ]
            )
        )

        items = [
            serialize_post(
                post,
                user_map.get(
                    post.author_id
                ),
            )
            for post
            in posts
        ]

        return jsonify({
            "success": True,
            "posts": items,
            "count": len(
                items
            ),
        }), 200

    except Exception as error:
        return jsonify({
            "success": False,

            "error":
                "Không thể tải danh sách bài viết.",

            "detail":
                str(error),
        }), 500


@forum_bp.get(
    "/posts/<int:post_id>"
)
@auth_required
def get_post(
    post_id,
):
    try:
        post = db.session.get(
            ForumPost,
            post_id,
        )

        if not post:
            return jsonify({
                "success": False,
                "error":
                    "Bài viết không tồn tại.",
            }), 404

        author = db.session.get(
            User,
            post.author_id,
        )

        return jsonify({
            "success": True,

            "post":
                serialize_post(
                    post,
                    author,
                ),
        }), 200

    except Exception as error:
        return jsonify({
            "success": False,

            "error":
                "Không thể tải bài viết.",

            "detail":
                str(error),
        }), 500


@forum_bp.post(
    "/posts"
)
@auth_required
def create_post():
    try:
        user = (
            get_current_user()
        )

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

        title = clean_string(
            get_data_value(
                data,
                "title",
            )
        )

        content = clean_string(
            get_data_value(
                data,
                "content",
            )
        )

        scope = clean_string(
            get_data_value(
                data,
                "scope",
                default="hall",
            )
        ) or "hall"

        post_type = clean_string(
            get_data_value(
                data,
                "type",
                default="discuss",
            )
        ) or "discuss"

        teacher_only = (
            get_boolean_value(
                data,
                "teacherOnly",
                "teacher_only",
                default=False,
            )
        )

        tags = ensure_list(
            get_data_value(
                data,
                "tags",
                default=[],
            )
        )

        group_id = (
            clean_optional_string(
                get_data_value(
                    data,
                    "groupId",
                    "group_id",
                )
            )
        )

        group_name = (
            clean_optional_string(
                get_data_value(
                    data,
                    "groupName",
                    "group_name",
                )
            )
        )

        attachment_url = (
            clean_optional_string(
                get_data_value(
                    data,
                    "attachmentUrl",
                    "attachmentURL",
                    "attachment_url",
                )
            )
        )

        attachment_name = (
            clean_optional_string(
                get_data_value(
                    data,
                    "attachmentName",
                    "attachment_name",
                )
            )
        )

        image_url = (
            clean_optional_string(
                get_data_value(
                    data,
                    "imageUrl",
                    "imageURL",
                    "image_url",
                )
            )
        )

        event_start_at = (
            clean_optional_string(
                get_data_value(
                    data,
                    "eventStartAt",
                    "event_start_at",
                )
            )
        )

        event_end_at = (
            clean_optional_string(
                get_data_value(
                    data,
                    "eventEndAt",
                    "event_end_at",
                )
            )
        )

        event_location = (
            clean_optional_string(
                get_data_value(
                    data,
                    "eventLocation",
                    "event_location",
                )
            )
        )

        event_created_by_admin = (
            get_boolean_value(
                data,
                "eventCreatedByAdmin",
                "event_created_by_admin",
                default=False,
            )
        )

        event_interested_by = (
            ensure_list(
                get_data_value(
                    data,
                    "eventInterestedBy",
                    "event_interested_by",
                    default=[],
                )
            )
        )

        event_not_interested_by = (
            ensure_list(
                get_data_value(
                    data,
                    "eventNotInterestedBy",
                    "event_not_interested_by",
                    default=[],
                )
            )
        )

        poll_options = ensure_list(
            get_data_value(
                data,
                "pollOptions",
                "poll_options",
                default=[],
            )
        )

        poll_start_at = (
            clean_optional_string(
                get_data_value(
                    data,
                    "pollStartAt",
                    "poll_start_at",
                )
            )
        )

        poll_end_at = (
            clean_optional_string(
                get_data_value(
                    data,
                    "pollEndAt",
                    "poll_end_at",
                )
            )
        )

        poll_votes = ensure_dict(
            get_data_value(
                data,
                "pollVotes",
                "poll_votes",
                default={},
            )
        )

        poll_votes_count = (
            ensure_dict(
                get_data_value(
                    data,
                    "pollVotesCount",
                    "poll_votes_count",
                    default={},
                )
            )
        )

        status = clean_string(
            get_data_value(
                data,
                "status",
                default="approved",
            )
        ) or "approved"

        moderation_status = (
            clean_optional_string(
                get_data_value(
                    data,
                    "moderationStatus",
                    "moderation_status",
                )
            )
        )

        approved_by = (
            get_data_value(
                data,
                "approvedBy",
                "approved_by",
            )
        )

        approved_at = (
            parse_datetime(
                get_data_value(
                    data,
                    "approvedAt",
                    "approved_at",
                )
            )
        )

        rejected_by = (
            get_data_value(
                data,
                "rejectedBy",
                "rejected_by",
            )
        )

        rejected_at = (
            parse_datetime(
                get_data_value(
                    data,
                    "rejectedAt",
                    "rejected_at",
                )
            )
        )

        rejection_reason = (
            clean_optional_string(
                get_data_value(
                    data,
                    "rejectionReason",
                    "rejection_reason",
                )
            )
        )

        is_anonymous = (
            get_boolean_value(
                data,
                "isAnonymous",
                "is_anonymous",
                default=False,
            )
        )

        author_name_override = (
            clean_optional_string(
                get_data_value(
                    data,
                    "authorName",
                    "author_name",
                )
            )
        )

        author_email_override = (
            clean_optional_string(
                get_data_value(
                    data,
                    "authorEmail",
                    "author_email",
                )
            )
        )

        author_initials_override = (
            clean_optional_string(
                get_data_value(
                    data,
                    "authorInitials",
                    "author_initials",
                )
            )
        )

        author_photo_url = (
            clean_optional_string(
                get_data_value(
                    data,
                    "authorPhotoURL",
                    "authorPhotoUrl",
                    "author_photo_url",
                )
            )
        )

        author_role_override = (
            clean_optional_string(
                get_data_value(
                    data,
                    "authorRole",
                    "author_role",
                )
            )
        )

        reactions = ensure_dict(
            get_data_value(
                data,
                "reactions",
                default={},
            )
        )

        reaction_counts = (
            ensure_dict(
                get_data_value(
                    data,
                    "reactionCounts",
                    "reaction_counts",
                    default={},
                )
            )
        )

        liked_by = ensure_list(
            get_data_value(
                data,
                "likedBy",
                "liked_by",
                default=[],
            )
        )

        viewed_by = ensure_list(
            get_data_value(
                data,
                "viewedBy",
                "viewed_by",
                default=[],
            )
        )

        saved_by = ensure_list(
            get_data_value(
                data,
                "savedBy",
                "saved_by",
                default=[],
            )
        )

        reported_by = ensure_list(
            get_data_value(
                data,
                "reportedBy",
                "reported_by",
                default=[],
            )
        )

        if (
            not title
            and not content
            and not image_url
            and not attachment_url
            and not poll_options
        ):
            return jsonify({
                "success": False,

                "error":
                    "Nội dung bài viết không được để trống.",
            }), 400

        if (
            post_type == "poll"
            and not poll_options
        ):
            return jsonify({
                "success": False,

                "error":
                    "Bài bình chọn phải có lựa chọn.",
            }), 400

        if (
            is_anonymous
        ):
            author_name_override = (
                author_name_override
                or "Ẩn danh"
            )

            author_initials_override = (
                author_initials_override
                or "AD"
            )

        post = ForumPost(
            author_id=
                user.id,

            title=
                title,

            content=
                content,

            scope=
                scope,

            teacher_only=
                teacher_only,

            comments_count=
                get_integer_value(
                    data,
                    "commentsCount",
                    "comments_count",
                    default=0,
                ),

            type=
                post_type,

            tags=
                tags,

            group_id=
                group_id,

            group_name=
                group_name,

            attachment_url=
                attachment_url,

            attachment_name=
                attachment_name,

            image_url=
                image_url,

            event_start_at=
                event_start_at,

            event_end_at=
                event_end_at,

            event_location=
                event_location,

            event_created_by_admin=
                event_created_by_admin,

            event_interested_by=
                event_interested_by,

            event_not_interested_by=
                event_not_interested_by,

            event_started_notified_at=
                parse_datetime(
                    get_data_value(
                        data,
                        "eventStartedNotifiedAt",
                        "event_started_notified_at",
                    )
                ),

            event_ended_notified_at=
                parse_datetime(
                    get_data_value(
                        data,
                        "eventEndedNotifiedAt",
                        "event_ended_notified_at",
                    )
                ),

            poll_options=
                poll_options,

            poll_start_at=
                poll_start_at,

            poll_end_at=
                poll_end_at,

            poll_votes=
                poll_votes,

            poll_votes_count=
                poll_votes_count,

            status=
                status,

            moderation_status=
                moderation_status,

            approved_by=
                approved_by,

            approved_at=
                approved_at,

            rejected_by=
                rejected_by,

            rejected_at=
                rejected_at,

            rejection_reason=
                rejection_reason,

            author_name_override=
                author_name_override,

            author_email_override=
                author_email_override,

            author_initials_override=
                author_initials_override,

            author_photo_url=
                author_photo_url,

            author_role_override=
                author_role_override,

            likes_count=
                get_integer_value(
                    data,
                    "likesCount",
                    "likes_count",
                    default=0,
                ),

            reactions_count=
                get_integer_value(
                    data,
                    "reactionsCount",
                    "reactions_count",
                    default=0,
                ),

            reaction_counts=
                reaction_counts,

            reactions=
                reactions,

            liked_by=
                liked_by,

            views_count=
                get_integer_value(
                    data,
                    "viewsCount",
                    "views_count",
                    default=0,
                ),

            viewed_by=
                viewed_by,

            saved_by=
                saved_by,

            is_pinned=
                get_boolean_value(
                    data,
                    "isPinned",
                    "is_pinned",
                    default=False,
                ),

            is_anonymous=
                is_anonymous,

            is_answered=
                get_boolean_value(
                    data,
                    "isAnswered",
                    "is_answered",
                    default=False,
                ),

            report_count=
                get_integer_value(
                    data,
                    "reportCount",
                    "report_count",
                    default=0,
                ),

            reported_by=
                reported_by,

            report_status=
                clean_optional_string(
                    get_data_value(
                        data,
                        "reportStatus",
                        "report_status",
                    )
                ),
        )

        db.session.add(
            post
        )

        db.session.commit()

        return jsonify({
            "success": True,

            "message":
                "Đã tạo bài viết.",

            "post":
                serialize_post(
                    post,
                    user,
                ),
        }), 201

    except Exception as error:
        db.session.rollback()

        return jsonify({
            "success": False,

            "error":
                "Không thể tạo bài viết.",

            "detail":
                str(error),
        }), 500




# =========================================================
# POST MODERATION / DELETE
# =========================================================


@forum_bp.patch(
    "/posts/<int:post_id>/moderation"
)
@auth_required
def moderate_post(
    post_id,
):
    try:
        user = get_current_user()

        if not user:
            return jsonify({
                "success": False,
                "error": "User not found",
            }), 404

        if normalize_role(
            user.role
        ) != "ADMIN_DEV":
            return jsonify({
                "success": False,
                "error":
                    "Bạn không có quyền kiểm duyệt bài viết.",
            }), 403

        data = (
            request.get_json(
                silent=True
            )
            or {}
        )

        action = clean_string(
            get_data_value(
                data,
                "action",
                "status",
                "moderationStatus",
                "moderation_status",
            )
        ).lower()

        if action in {
            "approve",
            "approved",
        }:
            action = "approved"

        elif action in {
            "reject",
            "rejected",
        }:
            action = "rejected"

        else:
            return jsonify({
                "success": False,
                "error":
                    "Trạng thái kiểm duyệt không hợp lệ.",
            }), 400

        post = (
            db.session.execute(
                db.select(
                    ForumPost
                )
                .where(
                    ForumPost.id
                    == post_id
                )
                .with_for_update()
            )
            .scalar_one_or_none()
        )

        if not post:
            return jsonify({
                "success": False,
                "error":
                    "Bài viết không tồn tại.",
            }), 404

        now = utc_now()

        if action == "approved":
            post.status = "approved"
            post.moderation_status = "approved"
            post.approved_by = user.id
            post.approved_at = now

            post.rejected_by = None
            post.rejected_at = None
            post.rejection_reason = None

            notification_text = (
                "Bài viết của bạn đã được quản trị viên phê duyệt."
            )

            notification_type = (
                "post-approved"
            )

            message = (
                "Đã phê duyệt bài viết."
            )

        else:
            rejection_reason = (
                clean_optional_string(
                    get_data_value(
                        data,
                        "reason",
                        "rejectionReason",
                        "rejection_reason",
                    )
                )
            )

            post.status = "rejected"
            post.moderation_status = "rejected"

            post.rejected_by = user.id
            post.rejected_at = now
            post.rejection_reason = (
                rejection_reason
            )

            post.approved_by = None
            post.approved_at = None

            notification_text = (
                "Bài viết của bạn đã bị quản trị viên từ chối."
            )

            if rejection_reason:
                notification_text += (
                    f" Lý do: {rejection_reason}"
                )

            notification_type = (
                "post-rejected"
            )

            message = (
                "Đã từ chối bài viết."
            )

        post.updated_at = now

        if (
            post.author_id
            and post.author_id
            != user.id
        ):
            db.session.add(
                ForumNotification(
                    to_user_id=
                        post.author_id,

                    from_user_id=
                        user.id,

                    type=
                        notification_type,

                    category=
                        "admin",

                    scope=
                        post.scope
                        or "hall",

                    post_id=
                        post.id,

                    text=
                        notification_text,

                    read=False,
                )
            )

        db.session.commit()

        author = db.session.get(
            User,
            post.author_id,
        )

        return jsonify({
            "success": True,
            "message":
                message,
            "post":
                serialize_post(
                    post,
                    author,
                ),
        }), 200

    except Exception as error:
        db.session.rollback()

        return jsonify({
            "success": False,
            "error":
                "Không thể kiểm duyệt bài viết.",
            "detail":
                str(error),
        }), 500


@forum_bp.delete(
    "/posts/<int:post_id>"
)
@auth_required
def delete_post(
    post_id,
):
    try:
        user = get_current_user()

        if not user:
            return jsonify({
                "success": False,
                "error": "User not found",
            }), 404

        post = (
            db.session.execute(
                db.select(
                    ForumPost
                )
                .where(
                    ForumPost.id
                    == post_id
                )
                .with_for_update()
            )
            .scalar_one_or_none()
        )

        if not post:
            return jsonify({
                "success": False,
                "error":
                    "Bài viết không tồn tại.",
            }), 404

        is_admin = (
            normalize_role(
                user.role
            )
            == "ADMIN_DEV"
        )

        is_author = (
            post.author_id
            == user.id
        )

        if (
            not is_admin
            and not is_author
        ):
            return jsonify({
                "success": False,
                "error":
                    "Bạn không có quyền xóa bài viết này.",
            }), 403

        data = (
            request.get_json(
                silent=True
            )
            or {}
        )

        reason = (
            clean_optional_string(
                get_data_value(
                    data,
                    "reason",
                    "deleteReason",
                    "delete_reason",
                )
            )
        )

        author_id = post.author_id
        post_scope = (
            post.scope
            or "hall"
        )

        post_title = (
            post.title
            or ""
        )

        admin_deleted_other_post = (
            is_admin
            and author_id
            and author_id
            != user.id
        )

        comment_ids = (
            db.session.execute(
                db.select(
                    ForumComment.id
                )
                .where(
                    ForumComment.post_id
                    == post.id
                )
            )
            .scalars()
            .all()
        )

        if comment_ids:
            db.session.query(
                ForumCommentReaction
            ).filter(
                ForumCommentReaction
                .comment_id
                .in_(comment_ids)
            ).delete(
                synchronize_session=False
            )

        db.session.query(
            ForumNotification
        ).filter(
            ForumNotification.post_id
            == post.id
        ).delete(
            synchronize_session=False
        )

        db.session.query(
            ForumReport
        ).filter(
            ForumReport.post_id
            == post.id
        ).delete(
            synchronize_session=False
        )

        db.session.query(
            ForumComment
        ).filter(
            ForumComment.post_id
            == post.id
        ).delete(
            synchronize_session=False
        )

        db.session.delete(
            post
        )

        db.session.flush()

        if admin_deleted_other_post:
            text = (
                "Bài viết của bạn đã bị quản trị viên xóa."
            )

            if post_title:
                text = (
                    "Bài viết "
                    f"“{post_title}” "
                    "của bạn đã bị quản trị viên xóa."
                )

            if reason:
                text += (
                    f" Lý do: {reason}"
                )

            db.session.add(
                ForumNotification(
                    to_user_id=
                        author_id,

                    from_user_id=
                        user.id,

                    type=
                        "post-deleted",

                    category=
                        "admin",

                    scope=
                        post_scope,

                    post_id=
                        None,

                    text=
                        text,

                    read=False,
                )
            )

        db.session.commit()

        return jsonify({
            "success": True,
            "message":
                "Đã xóa bài viết.",
            "postId":
                post_id,
        }), 200

    except Exception as error:
        db.session.rollback()

        return jsonify({
            "success": False,
            "error":
                "Không thể xóa bài viết.",
            "detail":
                str(error),
        }), 500


# =========================================================
# POST ACTIONS
# =========================================================


@forum_bp.post(
    "/posts/<int:post_id>/view"
)
@auth_required
def view_post(
    post_id,
):
    try:
        user = get_current_user()

        if not user:
            return jsonify({
                "success": False,
                "error": "User not found",
            }), 404

        post = (
            db.session.execute(
                db.select(
                    ForumPost
                )
                .where(
                    ForumPost.id
                    == post_id
                )
                .with_for_update()
            )
            .scalar_one_or_none()
        )

        if not post:
            return jsonify({
                "success": False,
                "error":
                    "Bài viết không tồn tại.",
            }), 404

        user_key = str(
            user.id
        )

        viewed_by = list(
            ensure_list(
                post.viewed_by
            )
        )

        viewed_keys = {
            str(item)
            for item in viewed_by
        }

        if user_key not in viewed_keys:
            viewed_by.append(
                user_key
            )

            post.viewed_by = (
                viewed_by
            )

            post.views_count = (
                len(viewed_by)
            )

            post.updated_at = (
                utc_now()
            )

        db.session.commit()

        return jsonify({
            "success": True,
            "viewsCount":
                int(
                    post.views_count
                    or 0
                ),
            "viewedBy":
                ensure_list(
                    post.viewed_by
                ),
        }), 200

    except Exception as error:
        db.session.rollback()

        return jsonify({
            "success": False,
            "error":
                "Không thể cập nhật lượt xem.",
            "detail":
                str(error),
        }), 500


@forum_bp.post(
    "/posts/<int:post_id>/reaction"
)
@auth_required
def react_to_post(
    post_id,
):
    try:
        user = get_current_user()

        if not user:
            return jsonify({
                "success": False,
                "error": "User not found",
            }), 404

        data = (
            request.get_json(
                silent=True
            )
            or {}
        )

        reaction = clean_string(
            get_data_value(
                data,
                "reaction",
                "reactionValue",
            )
        ).lower()

        allowed = {
            "love",
            "like",
            "haha",
            "wow",
            "sad",
            "angry",
            "care",
        }

        if reaction not in allowed:
            return jsonify({
                "success": False,
                "error":
                    "Cảm xúc không hợp lệ.",
            }), 400

        post = (
            db.session.execute(
                db.select(
                    ForumPost
                )
                .where(
                    ForumPost.id
                    == post_id
                )
                .with_for_update()
            )
            .scalar_one_or_none()
        )

        if not post:
            return jsonify({
                "success": False,
                "error":
                    "Bài viết không tồn tại.",
            }), 404

        user_key = str(
            user.id
        )

        reactions = dict(
            ensure_dict(
                post.reactions
            )
        )

        previous = (
            reactions.get(
                user_key
            )
        )

        if previous == reaction:
            reactions.pop(
                user_key,
                None,
            )

            selected = ""

        else:
            reactions[
                user_key
            ] = reaction

            selected = reaction

        counter = Counter(
            reactions.values()
        )

        reaction_counts = dict(
            counter
        )

        liked_by = list(
            reactions.keys()
        )

        post.reactions = (
            reactions
        )

        post.reaction_counts = (
            reaction_counts
        )

        post.reactions_count = (
            len(reactions)
        )

        post.likes_count = (
            len(reactions)
        )

        post.liked_by = (
            liked_by
        )

        post.updated_at = (
            utc_now()
        )

        should_notify = (
            bool(selected)
            and not previous
            and post.author_id
            != user.id
        )

        if should_notify:
            db.session.add(
                ForumNotification(
                    to_user_id=
                        post.author_id,

                    from_user_id=
                        user.id,

                    type=
                        "reaction",

                    category=
                        "post-interaction",

                    scope=
                        post.scope
                        or "hall",

                    post_id=
                        post.id,

                    text=(
                        f"{user.full_name or 'Người dùng'} "
                        "đã bày tỏ cảm xúc với bài viết của bạn"
                    ),

                    read=False,
                )
            )

        db.session.commit()

        return jsonify({
            "success": True,
            "reaction":
                selected,
            "reactions":
                reactions,
            "reactionCounts":
                reaction_counts,
            "reactionsCount":
                len(reactions),
            "likedBy":
                liked_by,
            "likesCount":
                len(reactions),
        }), 200

    except Exception as error:
        db.session.rollback()

        return jsonify({
            "success": False,
            "error":
                "Không thể cập nhật cảm xúc.",
            "detail":
                str(error),
        }), 500


@forum_bp.post(
    "/posts/<int:post_id>/save"
)
@auth_required
def save_post(
    post_id,
):
    try:
        user = get_current_user()

        if not user:
            return jsonify({
                "success": False,
                "error": "User not found",
            }), 404

        post = (
            db.session.execute(
                db.select(
                    ForumPost
                )
                .where(
                    ForumPost.id
                    == post_id
                )
                .with_for_update()
            )
            .scalar_one_or_none()
        )

        if not post:
            return jsonify({
                "success": False,
                "error":
                    "Bài viết không tồn tại.",
            }), 404

        user_key = str(
            user.id
        )

        saved_by = [
            str(item)
            for item
            in ensure_list(
                post.saved_by
            )
        ]

        if user_key in saved_by:
            saved_by = [
                item
                for item
                in saved_by
                if item
                != user_key
            ]

            saved = False

        else:
            saved_by.append(
                user_key
            )

            saved = True

        post.saved_by = (
            saved_by
        )

        post.updated_at = (
            utc_now()
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "saved":
                saved,
            "savedBy":
                saved_by,
        }), 200

    except Exception as error:
        db.session.rollback()

        return jsonify({
            "success": False,
            "error":
                "Không thể cập nhật bài viết đã lưu.",
            "detail":
                str(error),
        }), 500


@forum_bp.post(
    "/posts/<int:post_id>/event-interest"
)
@auth_required
def update_event_interest(
    post_id,
):
    try:
        user = get_current_user()

        if not user:
            return jsonify({
                "success": False,
                "error": "User not found",
            }), 404

        data = (
            request.get_json(
                silent=True
            )
            or {}
        )

        interest = clean_string(
            get_data_value(
                data,
                "interest",
                "value",
            )
        ).lower()

        if interest not in {
            "interested",
            "not_interested",
            "none",
        }:
            return jsonify({
                "success": False,
                "error":
                    "Trạng thái quan tâm không hợp lệ.",
            }), 400

        post = (
            db.session.execute(
                db.select(
                    ForumPost
                )
                .where(
                    ForumPost.id
                    == post_id
                )
                .with_for_update()
            )
            .scalar_one_or_none()
        )

        if not post:
            return jsonify({
                "success": False,
                "error":
                    "Bài viết không tồn tại.",
            }), 404

        if post.type != "event":
            return jsonify({
                "success": False,
                "error":
                    "Bài viết này không phải sự kiện.",
            }), 400

        if (
            post.event_created_by_admin
            or post.author_role_override
            in {
                "admin",
                "admin_dev",
            }
        ):
            return jsonify({
                "success": False,
                "error":
                    "Sự kiện của quản trị viên luôn được thông báo cho mọi người.",
            }), 400

        user_key = str(
            user.id
        )

        interested = [
            str(item)
            for item
            in ensure_list(
                post.event_interested_by
            )
            if str(item)
            != user_key
        ]

        not_interested = [
            str(item)
            for item
            in ensure_list(
                post.event_not_interested_by
            )
            if str(item)
            != user_key
        ]

        if interest == "interested":
            interested.append(
                user_key
            )

        elif interest == "not_interested":
            not_interested.append(
                user_key
            )

        post.event_interested_by = (
            interested
        )

        post.event_not_interested_by = (
            not_interested
        )

        post.updated_at = (
            utc_now()
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "interest":
                interest,
            "eventInterestedBy":
                interested,
            "eventNotInterestedBy":
                not_interested,
        }), 200

    except Exception as error:
        db.session.rollback()

        return jsonify({
            "success": False,
            "error":
                "Không thể cập nhật trạng thái sự kiện.",
            "detail":
                str(error),
        }), 500


@forum_bp.post(
    "/posts/<int:post_id>/vote"
)
@auth_required
def vote_post(
    post_id,
):
    try:
        user = get_current_user()

        if not user:
            return jsonify({
                "success": False,
                "error": "User not found",
            }), 404

        data = (
            request.get_json(
                silent=True
            )
            or {}
        )

        option_id = clean_string(
            get_data_value(
                data,
                "optionId",
                "option_id",
            )
        )

        if not option_id:
            return jsonify({
                "success": False,
                "error":
                    "Thiếu lựa chọn bình chọn.",
            }), 400

        post = (
            db.session.execute(
                db.select(
                    ForumPost
                )
                .where(
                    ForumPost.id
                    == post_id
                )
                .with_for_update()
            )
            .scalar_one_or_none()
        )

        if not post:
            return jsonify({
                "success": False,
                "error":
                    "Bài viết không tồn tại.",
            }), 404

        if post.type != "poll":
            return jsonify({
                "success": False,
                "error":
                    "Bài viết này không phải bình chọn.",
            }), 400

        poll_options = (
            ensure_list(
                post.poll_options
            )
        )

        valid_ids = {
            str(
                option.get(
                    "id"
                )
            )
            for option
            in poll_options
            if isinstance(
                option,
                dict,
            )
            and option.get(
                "id"
            )
            is not None
        }

        if option_id not in valid_ids:
            return jsonify({
                "success": False,
                "error":
                    "Lựa chọn bình chọn không hợp lệ.",
            }), 400

        user_key = str(
            user.id
        )

        votes = dict(
            ensure_dict(
                post.poll_votes
            )
        )

        old_option_id = (
            votes.get(
                user_key
            )
        )

        if old_option_id == option_id:
            return jsonify({
                "success": False,
                "error":
                    "Bạn đã chọn lựa chọn này rồi.",
            }), 409

        votes[
            user_key
        ] = option_id

        counter = Counter(
            str(value)
            for value
            in votes.values()
        )

        vote_counts = {
            option:
                int(
                    counter.get(
                        option,
                        0,
                    )
                )
            for option
            in valid_ids
        }

        post.poll_votes = (
            votes
        )

        post.poll_votes_count = (
            vote_counts
        )

        post.updated_at = (
            utc_now()
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "optionId":
                option_id,
            "pollVotes":
                votes,
            "pollVotesCount":
                vote_counts,
        }), 200

    except Exception as error:
        db.session.rollback()

        return jsonify({
            "success": False,
            "error":
                "Không thể cập nhật bình chọn.",
            "detail":
                str(error),
        }), 500


# =========================================================
# REPORTS
# =========================================================


@forum_bp.post(
    "/posts/<int:post_id>/reports"
)
@auth_required
def create_report(
    post_id,
):
    try:
        user = get_current_user()

        if not user:
            return jsonify({
                "success": False,
                "error": "User not found",
            }), 404

        post = (
            db.session.execute(
                db.select(
                    ForumPost
                )
                .where(
                    ForumPost.id
                    == post_id
                )
                .with_for_update()
            )
            .scalar_one_or_none()
        )

        if not post:
            return jsonify({
                "success": False,
                "error":
                    "Bài viết không tồn tại.",
            }), 404

        existing = (
            db.session.execute(
                db.select(
                    ForumReport
                )
                .where(
                    ForumReport.post_id
                    == post.id,

                    ForumReport.reporter_id
                    == user.id,
                )
            )
            .scalar_one_or_none()
        )

        if existing:
            return jsonify({
                "success": False,
                "error":
                    "Bạn đã báo cáo bài viết này.",
                "report":
                    serialize_report(
                        existing
                    ),
            }), 409

        data = (
            request.get_json(
                silent=True
            )
            or {}
        )

        reason = clean_string(
            data.get(
                "reason"
            )
        )

        detail = clean_string(
            data.get(
                "detail"
            )
        )

        if not reason:
            return jsonify({
                "success": False,
                "error":
                    "Vui lòng chọn lý do báo cáo.",
            }), 400

        author = db.session.get(
            User,
            post.author_id,
        )

        report = ForumReport(
            post_id=
                post.id,

            post_title=
                post.title,

            post_content=
                post.content,

            post_author_id=
                post.author_id,

            post_author_name=(
                post.author_name_override
                or (
                    author.full_name
                    if author
                    else ""
                )
            ),

            reporter_id=
                user.id,

            reporter_name=
                user.full_name
                or "",

            reporter_email=
                user.email
                or "",

            reason=
                reason,

            detail=
                detail,

            scope=
                post.scope
                or "hall",

            status=
                "open",
        )

        db.session.add(
            report
        )

        reported_by = [
            str(item)
            for item
            in ensure_list(
                post.reported_by
            )
        ]

        user_key = str(
            user.id
        )

        if user_key not in reported_by:
            reported_by.append(
                user_key
            )

        post.reported_by = (
            reported_by
        )

        post.report_count = (
            len(reported_by)
        )

        post.report_status = (
            "open"
        )

        post.updated_at = (
            utc_now()
        )

        admins = (
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

        for admin in admins:
            if admin.id == user.id:
                continue

            db.session.add(
                ForumNotification(
                    to_user_id=
                        admin.id,

                    from_user_id=
                        user.id,

                    type=
                        "post-reported",

                    category=
                        "admin",

                    scope=
                        post.scope
                        or "hall",

                    post_id=
                        post.id,

                    text=(
                        "Bài đăng của "
                        f"{post.author_name_override or (author.full_name if author else 'người dùng')} "
                        f"vừa bị báo cáo vì: {reason}"
                    ),

                    read=False,
                )
            )

        db.session.commit()

        return jsonify({
            "success": True,
            "message":
                "Đã gửi báo cáo tới quản trị viên.",
            "report":
                serialize_report(
                    report
                ),
            "reportCount":
                post.report_count,
            "reportedBy":
                post.reported_by,
            "reportStatus":
                post.report_status,
        }), 201

    except Exception as error:
        db.session.rollback()

        return jsonify({
            "success": False,
            "error":
                "Không thể gửi báo cáo.",
            "detail":
                str(error),
        }), 500


@forum_bp.get(
    "/reports"
)
@auth_required
def get_reports():
    try:
        user = get_current_user()

        if not user:
            return jsonify({
                "success": False,
                "error": "User not found",
            }), 404

        if normalize_role(
            user.role
        ) != "ADMIN_DEV":
            return jsonify({
                "success": False,
                "error":
                    "Bạn không có quyền xem báo cáo.",
            }), 403

        limit_value = (
            request.args.get(
                "limit",
                default=120,
                type=int,
            )
            or 120
        )

        limit_value = max(
            1,
            min(
                limit_value,
                500,
            ),
        )

        statement = db.select(
            ForumReport
        )

        status = clean_string(
            request.args.get(
                "status"
            )
        )

        if status:
            statement = (
                statement.where(
                    ForumReport.status
                    == status
                )
            )

        reports = (
            db.session.execute(
                statement
                .order_by(
                    ForumReport
                    .created_at
                    .desc(),

                    ForumReport
                    .id
                    .desc(),
                )
                .limit(
                    limit_value
                )
            )
            .scalars()
            .all()
        )

        items = [
            serialize_report(
                item
            )
            for item
            in reports
        ]

        return jsonify({
            "success": True,
            "reports":
                items,
            "count":
                len(items),
        }), 200

    except Exception as error:
        return jsonify({
            "success": False,
            "error":
                "Không thể tải báo cáo.",
            "detail":
                str(error),
        }), 500


@forum_bp.delete(
    "/reports/<int:report_id>"
)
@auth_required
def delete_report(
    report_id,
):
    try:
        user = get_current_user()

        if not user:
            return jsonify({
                "success": False,
                "error": "User not found",
            }), 404

        if normalize_role(
            user.role
        ) != "ADMIN_DEV":
            return jsonify({
                "success": False,
                "error":
                    "Bạn không có quyền xử lý báo cáo.",
            }), 403

        report = db.session.get(
            ForumReport,
            report_id,
        )

        if not report:
            return jsonify({
                "success": False,
                "error":
                    "Báo cáo không tồn tại.",
            }), 404

        post = db.session.get(
            ForumPost,
            report.post_id,
        )

        db.session.delete(
            report
        )

        db.session.flush()

        if post:
            remaining = (
                db.session.execute(
                    db.select(
                        ForumReport
                    )
                    .where(
                        ForumReport.post_id
                        == post.id
                    )
                )
                .scalars()
                .all()
            )

            post.reported_by = [
                str(
                    item.reporter_id
                )
                for item
                in remaining
            ]

            post.report_count = (
                len(remaining)
            )

            post.report_status = (
                "open"
                if remaining
                else None
            )

            post.updated_at = (
                utc_now()
            )

        db.session.commit()

        return jsonify({
            "success": True,
            "message":
                "Đã xóa báo cáo.",
        }), 200

    except Exception as error:
        db.session.rollback()

        return jsonify({
            "success": False,
            "error":
                "Không thể xóa báo cáo.",
            "detail":
                str(error),
        }), 500


# =========================================================
# COMMENTS
# =========================================================


@forum_bp.get(
    "/posts/<int:post_id>/comments"
)
@auth_required
def get_comments(
    post_id,
):
    try:
        post = db.session.get(
            ForumPost,
            post_id,
        )

        if not post:
            return jsonify({
                "success": False,
                "error":
                    "Bài viết không tồn tại.",
            }), 404

        limit_value = (
            request.args.get(
                "limit",
                default=300,
                type=int,
            )
            or 300
        )

        limit_value = max(
            1,
            min(
                limit_value,
                500,
            ),
        )

        comments = (
            db.session.execute(
                db.select(
                    ForumComment
                )
                .where(
                    ForumComment
                    .post_id
                    == post_id
                )
                .order_by(
                    ForumComment
                    .created_at
                    .asc(),
                    ForumComment
                    .id
                    .asc(),
                )
                .limit(
                    limit_value
                )
            )
            .scalars()
            .all()
        )

        author_map = (
            build_user_map(
                [
                    comment.author_id
                    for comment
                    in comments
                ]
            )
        )

        (
            reactions,
            reaction_counts,
        ) = (
            get_comment_reaction_data(
                [
                    comment.id
                    for comment
                    in comments
                ]
            )
        )

        items = [
            serialize_comment(
                comment,

                author_map.get(
                    comment.author_id
                ),

                reactions.get(
                    comment.id,
                    {},
                ),

                reaction_counts.get(
                    comment.id,
                    {},
                ),
            )
            for comment
            in comments
        ]

        return jsonify({
            "success": True,

            "comments":
                items,

            "count":
                len(items),
        }), 200

    except Exception as error:
        return jsonify({
            "success": False,

            "error":
                "Không thể tải bình luận.",

            "detail":
                str(error),
        }), 500


@forum_bp.post(
    "/posts/<int:post_id>/comments"
)
@auth_required
def create_comment(
    post_id,
):
    try:
        user = (
            get_current_user()
        )

        if not user:
            return jsonify({
                "success": False,
                "error":
                    "User not found",
            }), 404

        post = db.session.get(
            ForumPost,
            post_id,
        )

        if not post:
            return jsonify({
                "success": False,
                "error":
                    "Bài viết không tồn tại.",
            }), 404

        if (
            post.teacher_only
            and normalize_role(
                user.role
            )
            not in {
                "TEACHER",
                "ADMIN_DEV",
            }
        ):
            return jsonify({
                "success": False,

                "error":
                    "Chỉ giáo viên được trả lời bài viết này.",
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

        if not content:
            return jsonify({
                "success": False,
                "error":
                    "Nội dung bình luận không được để trống.",
            }), 400

        parent_id = (
            data.get(
                "parentId"
            )
            or data.get(
                "parent_id"
            )
        )

        parent = None
        next_depth = 1
        root_comment_id = None

        if parent_id:
            try:
                parent_id = int(
                    parent_id
                )
            except (
                TypeError,
                ValueError,
            ):
                return jsonify({
                    "success": False,

                    "error":
                        "parentId không hợp lệ.",
                }), 400

            parent = db.session.get(
                ForumComment,
                parent_id,
            )

            if (
                not parent
                or parent.post_id
                != post.id
            ):
                return jsonify({
                    "success": False,

                    "error":
                        "Bình luận cha không tồn tại.",
                }), 404

            parent_depth = int(
                parent.depth or 1
            )

            if parent_depth >= 3:
                return jsonify({
                    "success": False,

                    "error":
                        "Đã đạt giới hạn bình luận.",
                }), 400

            next_depth = min(
                parent_depth + 1,
                3,
            )

            root_comment_id = (
                parent.root_comment_id
                or parent.id
            )

        comment = ForumComment(
            post_id=
                post.id,

            author_id=
                user.id,

            content=
                content,

            parent_id=(
                parent.id
                if parent
                else None
            ),

            root_comment_id=
                root_comment_id,

            depth=
                next_depth,

            reactions_count=0,
        )

        db.session.add(
            comment
        )

        db.session.flush()

        post.comments_count = (
            int(
                post.comments_count
                or 0
            )
            + 1
        )

        post.updated_at = (
            utc_now()
        )

        notify_user_id = None

        if (
            parent
            and parent.author_id
            != user.id
        ):
            notify_user_id = (
                parent.author_id
            )

        elif (
            post.author_id
            != user.id
        ):
            notify_user_id = (
                post.author_id
            )

        if notify_user_id:
            notification = (
                ForumNotification(
                    to_user_id=
                        notify_user_id,

                    from_user_id=
                        user.id,

                    type=(
                        "comment-reply"
                        if parent
                        else "comment"
                    ),

                    category=
                        "post-interaction",

                    scope=
                        post.scope
                        or "hall",

                    post_id=
                        post.id,

                    comment_id=
                        comment.id,

                    text=(
                        (
                            f"{user.full_name or 'Người dùng'} "
                            "đã trả lời bình luận của bạn"
                        )
                        if parent
                        else (
                            f"{user.full_name or 'Người dùng'} "
                            "đã bình luận bài viết của bạn"
                        )
                    ),

                    read=False,
                )
            )

            db.session.add(
                notification
            )

        db.session.commit()

        return jsonify({
            "success": True,

            "message":
                "Đã gửi bình luận.",

            "comment":
                serialize_comment(
                    comment,
                    user,
                    {},
                    {},
                ),

            "commentsCount":
                post.comments_count,
        }), 201

    except Exception as error:
        db.session.rollback()

        return jsonify({
            "success": False,

            "error":
                "Không thể gửi bình luận.",

            "detail":
                str(error),
        }), 500


# =========================================================
# COMMENT REACTION
# =========================================================


@forum_bp.post(
    (
        "/posts/<int:post_id>"
        "/comments/<int:comment_id>"
        "/reaction"
    )
)
@auth_required
def react_to_comment(
    post_id,
    comment_id,
):
    try:
        user = (
            get_current_user()
        )

        if not user:
            return jsonify({
                "success": False,
                "error":
                    "User not found",
            }), 404

        comment = db.session.get(
            ForumComment,
            comment_id,
        )

        if (
            not comment
            or comment.post_id
            != post_id
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

        reaction_value = str(
            data.get(
                "reaction"
            )
            or data.get(
                "reactionValue"
            )
            or "love"
        ).strip().lower()

        allowed_reactions = {
            "love",
            "like",
            "haha",
            "wow",
            "sad",
            "angry",
            "care",
        }

        if (
            reaction_value
            not in
            allowed_reactions
        ):
            return jsonify({
                "success": False,

                "error":
                    "Cảm xúc không hợp lệ.",
            }), 400

        existing = (
            db.session.execute(
                db.select(
                    ForumCommentReaction
                )
                .where(
                    ForumCommentReaction
                    .comment_id
                    == comment.id,

                    ForumCommentReaction
                    .user_id
                    == user.id,
                )
                .with_for_update()
            )
            .scalar_one_or_none()
        )

        selected_reaction = (
            reaction_value
        )

        if (
            existing
            and existing.reaction
            == reaction_value
        ):
            db.session.delete(
                existing
            )

            selected_reaction = ""

        elif existing:
            existing.reaction = (
                reaction_value
            )

            existing.updated_at = (
                utc_now()
            )

        else:
            db.session.add(
                ForumCommentReaction(
                    comment_id=
                        comment.id,

                    user_id=
                        user.id,

                    reaction=
                        reaction_value,
                )
            )

        db.session.flush()

        reactions = (
            db.session.execute(
                db.select(
                    ForumCommentReaction
                )
                .where(
                    ForumCommentReaction
                    .comment_id
                    == comment.id
                )
            )
            .scalars()
            .all()
        )

        reaction_map = {
            str(
                item.user_id
            ):
                item.reaction
            for item
            in reactions
        }

        counter = Counter(
            item.reaction
            for item
            in reactions
        )

        reaction_counts = (
            dict(counter)
        )

        reaction_total = (
            len(reactions)
        )

        comment.reactions_count = (
            reaction_total
        )

        comment.updated_at = (
            utc_now()
        )

        db.session.commit()

        return jsonify({
            "success": True,

            "message":
                "Đã cập nhật cảm xúc.",

            "reaction":
                selected_reaction,

            "reactions":
                reaction_map,

            "reactionCounts":
                reaction_counts,

            "reactionsCount":
                reaction_total,
        }), 200

    except Exception as error:
        db.session.rollback()

        return jsonify({
            "success": False,

            "error":
                "Không thể cập nhật cảm xúc bình luận.",

            "detail":
                str(error),
        }), 500


# =========================================================
# NOTIFICATIONS
# =========================================================


@forum_bp.get(
    "/notifications"
)
@auth_required
def get_notifications():
    try:
        user = (
            get_current_user()
        )

        if not user:
            return jsonify({
                "success": False,
                "error":
                    "User not found",
            }), 404

        limit_value = (
            request.args.get(
                "limit",
                default=30,
                type=int,
            )
            or 30
        )

        limit_value = max(
            1,
            min(
                limit_value,
                200,
            ),
        )

        items = (
            db.session.execute(
                db.select(
                    ForumNotification
                )
                .where(
                    ForumNotification
                    .to_user_id
                    == user.id
                )
                .order_by(
                    ForumNotification
                    .created_at
                    .desc(),
                    ForumNotification
                    .id
                    .desc(),
                )
                .limit(
                    limit_value
                )
            )
            .scalars()
            .all()
        )

        user_map = (
            build_user_map(
                [
                    item.from_user_id
                    for item
                    in items
                ]
            )
        )

        notifications = [
            serialize_notification(
                item,
                user_map.get(
                    item.from_user_id
                ),
            )
            for item
            in items
        ]

        return jsonify({
            "success": True,

            "notifications":
                notifications,

            "count":
                len(
                    notifications
                ),

            "unreadCount":
                sum(
                    1
                    for item
                    in items
                    if not item.read
                ),
        }), 200

    except Exception as error:
        return jsonify({
            "success": False,

            "error":
                "Không thể tải thông báo.",

            "detail":
                str(error),
        }), 500


@forum_bp.patch(
    "/notifications/<int:notification_id>/read"
)
@auth_required
def mark_notification_read(
    notification_id,
):
    try:
        user = (
            get_current_user()
        )

        if not user:
            return jsonify({
                "success": False,
                "error":
                    "User not found",
            }), 404

        item = db.session.get(
            ForumNotification,
            notification_id,
        )

        if (
            not item
            or item.to_user_id
            != user.id
        ):
            return jsonify({
                "success": False,

                "error":
                    "Thông báo không tồn tại.",
            }), 404

        item.read = True

        db.session.commit()

        return jsonify({
            "success": True,

            "message":
                "Đã đánh dấu thông báo là đã đọc.",

            "notification":
                serialize_notification(
                    item,
                    db.session.get(
                        User,
                        item.from_user_id,
                    ),
                ),
        }), 200

    except Exception as error:
        db.session.rollback()

        return jsonify({
            "success": False,

            "error":
                "Không thể cập nhật thông báo.",

            "detail":
                str(error),
        }), 500


@forum_bp.delete(
    "/notifications/<int:notification_id>"
)
@auth_required
def delete_notification(
    notification_id,
):
    try:
        user = (
            get_current_user()
        )

        if not user:
            return jsonify({
                "success": False,
                "error":
                    "User not found",
            }), 404

        item = db.session.get(
            ForumNotification,
            notification_id,
        )

        if (
            not item
            or item.to_user_id
            != user.id
        ):
            return jsonify({
                "success": False,

                "error":
                    "Thông báo không tồn tại.",
            }), 404

        db.session.delete(
            item
        )

        db.session.commit()

        return jsonify({
            "success": True,

            "message":
                "Đã xóa thông báo.",
        }), 200

    except Exception as error:
        db.session.rollback()

        return jsonify({
            "success": False,

            "error":
                "Không thể xóa thông báo.",

            "detail":
                str(error),
        }), 500
from datetime import datetime, timezone

from extensions import db
from models import ChatConversation


MAX_STORED_MESSAGES = 40


def _clean_messages(
    messages,
    limit=MAX_STORED_MESSAGES,
):
    cleaned = []

    for item in messages or []:
        if not isinstance(item, dict):
            continue

        role = item.get("role")

        content = str(
            item.get("content") or ""
        ).strip()[:4000]

        if (
            role not in {
                "user",
                "assistant",
            }
            or not content
        ):
            continue

        cleaned.append({
            "role": role,
            "content": content,
            "createdAt": str(
                item.get("createdAt")
                or ""
            ),
        })

    return cleaned[-limit:]


def _normalize_uid(uid):
    try:
        return int(uid)
    except (TypeError, ValueError):
        return None


def load_chat_memory(uid):
    if not uid:
        return []

    user_id = _normalize_uid(uid)

    if user_id is None:
        return []

    try:
        conversation = (
            db.session.scalar(
                db.select(
                    ChatConversation
                ).where(
                    ChatConversation.user_id
                    == user_id
                )
            )
        )

        if not conversation:
            return []

        return _clean_messages(
            conversation.messages
        )

    except Exception as error:
        print(
            "CHATBOT MEMORY LOAD ERROR:",
            error,
        )

        return []


def save_chat_memory(
    uid,
    messages,
):
    if not uid:
        return []

    user_id = _normalize_uid(uid)

    if user_id is None:
        return []

    cleaned = _clean_messages(
        messages
    )

    try:
        conversation = (
            db.session.scalar(
                db.select(
                    ChatConversation
                ).where(
                    ChatConversation.user_id
                    == user_id
                )
            )
        )

        if conversation:
            conversation.messages = (
                cleaned
            )

            conversation.updated_at = (
                datetime.now(
                    timezone.utc
                )
            )

        else:
            conversation = (
                ChatConversation(
                    user_id=user_id,
                    messages=cleaned,
                )
            )

            db.session.add(
                conversation
            )

        db.session.commit()

    except Exception as error:
        db.session.rollback()

        print(
            "CHATBOT MEMORY SAVE ERROR:",
            error,
        )

    return cleaned


def append_chat_turn(
    uid,
    history,
    user_message,
    assistant_message,
):
    timestamp = datetime.now(
        timezone.utc
    ).isoformat()

    return save_chat_memory(
        uid,
        [
            *history,
            {
                "role": "user",
                "content": user_message,
                "createdAt": timestamp,
            },
            {
                "role": "assistant",
                "content": assistant_message,
                "createdAt": timestamp,
            },
        ],
    )


def clear_chat_memory(uid):
    if not uid:
        return

    user_id = _normalize_uid(uid)

    if user_id is None:
        return

    try:
        conversation = (
            db.session.scalar(
                db.select(
                    ChatConversation
                ).where(
                    ChatConversation.user_id
                    == user_id
                )
            )
        )

        if conversation:
            db.session.delete(
                conversation
            )

            db.session.commit()

    except Exception as error:
        db.session.rollback()

        print(
            "CHATBOT MEMORY CLEAR ERROR:",
            error,
        )
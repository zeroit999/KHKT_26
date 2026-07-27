from datetime import datetime, timezone

from auth.auth import db


MAX_STORED_MESSAGES = 40


def _clean_messages(messages, limit=MAX_STORED_MESSAGES):
    cleaned = []
    for item in messages or []:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        content = str(item.get("content") or "").strip()[:4000]
        if role not in {"user", "assistant"} or not content:
            continue
        cleaned.append({
            "role": role,
            "content": content,
            "createdAt": str(item.get("createdAt") or ""),
        })
    return cleaned[-limit:]


def load_chat_memory(uid):
    if not uid:
        return []
    try:
        snapshot = db.collection("chatConversations").document(uid).get()
        if not snapshot.exists:
            return []
        return _clean_messages((snapshot.to_dict() or {}).get("messages"))
    except Exception as error:
        print("CHATBOT MEMORY LOAD ERROR:", error)
        return []


def save_chat_memory(uid, messages):
    if not uid:
        return []
    cleaned = _clean_messages(messages)
    try:
        db.collection("chatConversations").document(uid).set({
            "messages": cleaned,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }, merge=True)
    except Exception as error:
        print("CHATBOT MEMORY SAVE ERROR:", error)
    return cleaned


def append_chat_turn(uid, history, user_message, assistant_message):
    timestamp = datetime.now(timezone.utc).isoformat()
    return save_chat_memory(uid, [
        *history,
        {"role": "user", "content": user_message, "createdAt": timestamp},
        {"role": "assistant", "content": assistant_message, "createdAt": timestamp},
    ])


def clear_chat_memory(uid):
    if not uid:
        return
    try:
        db.collection("chatConversations").document(uid).delete()
    except Exception as error:
        print("CHATBOT MEMORY CLEAR ERROR:", error)

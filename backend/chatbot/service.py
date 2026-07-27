import os

import requests
from google import genai

from chatbot.knowledge import (
    DEFAULT_ACTIONS,
    FEATURES,
    PAGE_PROFILES,
    filter_actions_for_role,
    find_relevant_features,
    get_page_profile,
)
from chatbot.data_context import (
    format_platform_context,
    get_contextual_actions,
)


class ChatbotError(Exception):
    pass


SYSTEM_PROMPT = """Bạn là ZUNY AI Assistant, trợ lý nội bộ của nền tảng học tập ZUNY.
Luôn trả lời bằng tiếng Việt, xưng "Tôi" và gọi người dùng là "Bạn".
Chỉ khẳng định thông tin chức năng khi có trong ngữ cảnh được cung cấp.
Nếu thiếu thông tin, nói rõ giới hạn thay vì bịa ra.
Trả lời ngắn gọn, thực dụng; không hướng dẫn gian lận trong bài thi.
Ưu tiên trả lời về trang hiện tại và dùng đúng dữ liệu giao diện được cung cấp.
Khi có DỮ LIỆU NỀN TẢNG, phải dựa vào đúng tên khóa học, bài giảng, tiến độ và hồ sơ đó.
Nếu người dùng hỏi tiếp, phải sử dụng lịch sử hội thoại để giữ ngữ cảnh, tránh hỏi lại thông tin đã có.
Không yêu cầu mật khẩu, mã xác thực, khóa API hoặc dữ liệu nhạy cảm.
"""


def _resolve_provider():
    configured = os.getenv("CHATBOT_PROVIDER", "").strip().lower()
    if configured:
        return configured
    if os.getenv("LOCAL_DEV_MODE", "0") == "1":
        return "mock"
    if os.getenv("OPENAI_API_KEY", "").strip():
        return "openai"
    if os.getenv("GEMINI_API_KEY", "").strip():
        return "gemini"
    return "unavailable"


def get_capabilities():
    provider = _resolve_provider()
    if provider == "openai":
        model = os.getenv("OPENAI_MODEL", "gpt-5.6-sol")
    elif provider == "gemini":
        model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    else:
        model = "local-mock" if provider == "mock" else "unavailable"

    return {
        "provider": provider,
        "model": model,
        "actions": True,
        "knowledgeItems": len(FEATURES) + len(PAGE_PROFILES),
        "pageAware": True,
        "safePageActions": True,
    }


def _sanitize_history(history):
    cleaned = []
    if not isinstance(history, list):
        return cleaned

    for item in history[-20:]:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        content = str(item.get("content", "")).strip()[:2000]
        if role in {"user", "assistant"} and content:
            cleaned.append({"role": role, "content": content})
    return cleaned


def _sanitize_visible_context(page_context, allow_visible_context=True):
    if not allow_visible_context:
        return {"headings": [], "controls": [], "stats": []}

    visible = (page_context or {}).get("visible", {})
    if not isinstance(visible, dict):
        return {"headings": [], "controls": [], "stats": []}

    cleaned = {}
    for key in ("headings", "controls", "stats"):
        values = visible.get(key, [])
        if not isinstance(values, list):
            values = []
        cleaned[key] = [
            str(value).strip()[:160]
            for value in values[:12]
            if str(value or "").strip()
        ]
    return cleaned


def _build_context(message, page_context, data_context=None):
    relevant = find_relevant_features(message)
    path = str((page_context or {}).get("path", "/"))[:200]
    role = str((page_context or {}).get("role", "guest"))[:40]
    profile = get_page_profile(path)
    visible = _sanitize_visible_context(
        page_context,
        profile.get("allow_visible_context", True),
    )
    knowledge = "\n".join(f"- {item['content']}" for item in relevant)
    signals = "\n".join(
        f"- {key}: {', '.join(values)}"
        for key, values in visible.items()
        if values
    )
    context_text = (
        f"Trang hiện tại: {path}\n"
        f"Khu vực: {profile['title']}\n"
        f"Vai trò: {role}\n"
        f"Mục đích trang: {profile['summary']}\n"
        f"Quy tắc riêng: {profile['instructions']}\n"
        f"Tín hiệu giao diện an toàn:\n{signals or '- Không có'}\n"
        f"Kiến thức liên quan:\n{knowledge or '- Chỉ dùng kiến thức của trang hiện tại'}\n"
        f"DỮ LIỆU NỀN TẢNG ĐÃ KIỂM TRA QUYỀN:\n{format_platform_context(data_context)}"
    )
    return relevant, profile, visible, context_text[:36000]


def _extract_output_text(payload):
    for item in payload.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") == "output_text" and content.get("text"):
                return content["text"].strip()
    return ""


def _openai_reply(message, history, context_text):
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ChatbotError("Thiếu OPENAI_API_KEY. Hãy dùng CHATBOT_PROVIDER=mock khi test local.")

    inputs = [{"role": "developer", "content": f"{SYSTEM_PROMPT}\n\n{context_text}"}]
    inputs.extend(_sanitize_history(history))
    inputs.append({"role": "user", "content": message})

    try:
        response = requests.post(
            "https://api.openai.com/v1/responses",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": os.getenv("OPENAI_MODEL", "gpt-5.6-sol"),
                "reasoning": {"effort": os.getenv("OPENAI_REASONING_EFFORT", "none")},
                "input": inputs,
                "max_output_tokens": 700,
            },
            timeout=45,
        )
        response.raise_for_status()
    except requests.RequestException as error:
        detail = getattr(error.response, "text", "")[:500] if getattr(error, "response", None) else ""
        raise ChatbotError(f"OpenAI API không phản hồi hợp lệ. {detail}".strip()) from error

    reply = _extract_output_text(response.json())
    if not reply:
        raise ChatbotError("OpenAI API không trả về nội dung.")
    return reply


def _gemini_reply(message, history, context_text):
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise ChatbotError("Thiếu GEMINI_API_KEY.")

    conversation = "\n".join(
        f"{item['role']}: {item['content']}" for item in _sanitize_history(history)
    )
    prompt = (
        f"{SYSTEM_PROMPT}\n\n{context_text}\n\n"
        f"Lịch sử hội thoại:\n{conversation or '(chưa có)'}\n\n"
        f"Câu hỏi của người dùng:\n{message}"
    )

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            contents=prompt,
        )
    except Exception as error:
        raise ChatbotError("Gemini API không phản hồi hợp lệ.") from error

    reply = str(getattr(response, "text", "") or "").strip()
    if not reply:
        raise ChatbotError("Gemini API không trả về nội dung.")
    return reply


def _mock_reply(message, relevant, profile, visible, data_context=None):
    normalized = str(message or "").lower()
    page_title = profile["title"]
    courses = (data_context or {}).get("courses") or []

    if profile["id"] == "exam-room":
        return (
            "Tôi đang ở chế độ hỗ trợ Phòng thi. Tôi có thể giúp Bạn xử lý sự cố, "
            "toàn màn hình, đồng hồ và nộp bài; tôi không thể giải hoặc gợi ý đáp án."
        )

    if courses and any(term in normalized for term in ("khóa học", "bài học", "bài giảng", "học gì", "học nào")):
        course = courses[0]
        lesson_names = ", ".join(
            lesson.get("title", "")
            for lesson in course.get("lessons", [])[:3]
            if lesson.get("title")
        )
        return (
            f"Tôi đã đọc dữ liệu học tập của Bạn. Khóa học phù hợp là “{course['title']}”"
            f"{f' với các bài: {lesson_names}' if lesson_names else ''}. "
            f"Tiến độ hiện tại là {course.get('progress', 0)}%. Bạn có thể mở khóa học bằng nút bên dưới."
        )

    if any(term in normalized for term in ("trang này", "làm gì", "chức năng")):
        return f"Bạn đang ở {page_title}. {profile['summary']} {profile['instructions']}"

    if any(term in normalized for term in ("tìm", "search", "ở đâu")):
        return (
            f"Tại {page_title}, tôi đã chuẩn bị hành động phù hợp ngay bên dưới. "
            "Bấm nút để tôi đưa con trỏ tới đúng khu vực thay vì Bạn phải tự tìm."
        )

    if visible.get("headings"):
        visible_items = ", ".join(visible["headings"][:3])
        return (
            f"Tôi đang hỗ trợ riêng cho {page_title} và nhận thấy các mục: {visible_items}. "
            f"{profile['summary']} Bạn muốn tôi hướng dẫn thao tác hay phân tích mục nào?"
        )

    if relevant:
        details = " ".join(item["content"] for item in relevant)
        return f"Từ {page_title}, tôi có thể hỗ trợ yêu cầu này. {details}"

    return f"Tôi đang hỗ trợ riêng cho {page_title}. {profile['summary']}"


def _merge_actions(primary, secondary, limit=4):
    merged = []
    seen = set()
    for action in [*primary, *secondary]:
        action_id = action.get("id")
        if not action_id or action_id in seen:
            continue
        seen.add(action_id)
        merged.append({key: value for key, value in action.items() if key != "roles"})
        if len(merged) >= limit:
            break
    return merged


def create_chat_response(message, history=None, page_context=None, data_context=None):
    provider = _resolve_provider()
    page_context = page_context or {}
    relevant, profile, visible, context_text = _build_context(message, page_context, data_context)

    if provider == "openai":
        reply = _openai_reply(message, history or [], context_text)
    elif provider == "gemini":
        reply = _gemini_reply(message, history or [], context_text)
    elif provider == "mock":
        reply = _mock_reply(message, relevant, profile, visible, data_context)
    elif provider == "unavailable":
        raise ChatbotError("Backend chưa cấu hình OPENAI_API_KEY hoặc GEMINI_API_KEY.")
    else:
        raise ChatbotError(f"CHATBOT_PROVIDER không hợp lệ: {provider}")

    role = page_context.get("role", "")
    page_actions = filter_actions_for_role(profile.get("actions", []), role)
    contextual_actions = get_contextual_actions(message, data_context or {})
    feature_actions = []
    for item in relevant:
        if item["id"] != profile["id"]:
            feature_actions.extend(item.get("actions", []))
    if contextual_actions:
        actions = _merge_actions(contextual_actions, [*feature_actions, *page_actions])
    elif feature_actions:
        actions = _merge_actions(feature_actions, page_actions)
    else:
        actions = _merge_actions(page_actions, [])
    if not actions:
        actions = DEFAULT_ACTIONS[:3]

    return {
        "reply": reply,
        "actions": actions,
        "provider": provider,
        "sources": [{"id": item["id"], "label": item["id"]} for item in relevant],
        "page": {
            "id": profile["id"],
            "title": profile["title"],
            "suggestions": profile["suggestions"],
        },
        "grounding": {
            "authenticated": bool((data_context or {}).get("authenticated")),
            "courseCount": int((data_context or {}).get("courseCount") or 0),
            "lessonCount": int((data_context or {}).get("lessonCount") or 0),
            "restricted": bool((data_context or {}).get("restricted")),
        },
    }

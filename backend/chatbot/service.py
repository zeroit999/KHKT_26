import os

import requests
from google import genai

from chatbot.knowledge import DEFAULT_ACTIONS, FEATURES, find_relevant_features


class ChatbotError(Exception):
    pass


SYSTEM_PROMPT = """Bạn là ZUNY AI Assistant, trợ lý nội bộ của nền tảng học tập ZUNY.
Luôn trả lời bằng tiếng Việt, xưng "Tôi" và gọi người dùng là "Bạn".
Chỉ khẳng định thông tin chức năng khi có trong ngữ cảnh được cung cấp.
Nếu thiếu thông tin, nói rõ giới hạn thay vì bịa ra.
Trả lời ngắn gọn, thực dụng; không hướng dẫn gian lận trong bài thi.
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
        "knowledgeItems": len(FEATURES),
    }


def _sanitize_history(history):
    cleaned = []
    if not isinstance(history, list):
        return cleaned

    for item in history[-8:]:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        content = str(item.get("content", "")).strip()[:2000]
        if role in {"user", "assistant"} and content:
            cleaned.append({"role": role, "content": content})
    return cleaned


def _build_context(message, page_context):
    relevant = find_relevant_features(message)
    if not relevant:
        relevant = FEATURES[:3]

    knowledge = "\n".join(f"- {item['content']}" for item in relevant)
    path = str((page_context or {}).get("path", "/"))[:200]
    return relevant, f"Trang hiện tại: {path}\nKiến thức liên quan:\n{knowledge}"


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


def _mock_reply(message, relevant):
    if relevant:
        details = " ".join(item["content"] for item in relevant)
        return f"Tôi có thể hỗ trợ Bạn về chức năng này. {details} Bạn có thể dùng nút gợi ý bên dưới để mở nhanh trang liên quan."
    return (
        "Tôi đang chạy ở chế độ local mock. Tôi có thể hướng dẫn Bạn về "
        "khóa học, luyện thi, diễn đàn, hồ sơ và bảng xếp hạng."
    )


def create_chat_response(message, history=None, page_context=None):
    provider = _resolve_provider()
    relevant, context_text = _build_context(message, page_context or {})

    if provider == "openai":
        reply = _openai_reply(message, history or [], context_text)
    elif provider == "gemini":
        reply = _gemini_reply(message, history or [], context_text)
    elif provider == "mock":
        reply = _mock_reply(message, relevant)
    elif provider == "unavailable":
        raise ChatbotError("Backend chưa cấu hình OPENAI_API_KEY hoặc GEMINI_API_KEY.")
    else:
        raise ChatbotError(f"CHATBOT_PROVIDER không hợp lệ: {provider}")

    actions = []
    for item in relevant:
        actions.extend(item.get("actions", []))
    if not actions:
        actions = DEFAULT_ACTIONS

    return {
        "reply": reply,
        "actions": actions[:3],
        "provider": provider,
        "sources": [{"id": item["id"], "label": item["id"]} for item in relevant],
    }

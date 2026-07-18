import os
import unittest
from unittest.mock import Mock, patch

os.environ.setdefault("LOCAL_DEV_MODE", "1")
os.environ.setdefault("CHATBOT_PROVIDER", "mock")

from app import create_app
from chatbot.service import ChatbotError, _resolve_provider, create_chat_response


class ChatbotServiceTest(unittest.TestCase):
    def test_auto_provider_preserves_gemini_production(self):
        env = {
            "LOCAL_DEV_MODE": "0",
            "CHATBOT_PROVIDER": "",
            "OPENAI_API_KEY": "",
            "GEMINI_API_KEY": "existing-production-key",
        }
        with patch.dict(os.environ, env, clear=True):
            self.assertEqual(_resolve_provider(), "gemini")

    def test_mock_returns_relevant_action(self):
        with patch.dict(os.environ, {"CHATBOT_PROVIDER": "mock"}, clear=False):
            result = create_chat_response("Tôi muốn làm bài thi")

        self.assertEqual(result["provider"], "mock")
        self.assertTrue(result["reply"])
        self.assertEqual(result["actions"][0]["target"], "/exams")

    def test_openai_requires_key(self):
        env = {"CHATBOT_PROVIDER": "openai", "OPENAI_API_KEY": ""}
        with patch.dict(os.environ, env, clear=False):
            with self.assertRaises(ChatbotError):
                create_chat_response("Xin chào")

    @patch("chatbot.service.requests.post")
    def test_openai_response_contract(self, post):
        fake_response = Mock()
        fake_response.json.return_value = {
            "output": [
                {
                    "type": "message",
                    "content": [{"type": "output_text", "text": "Bạn có thể mở mục Luyện thi."}],
                }
            ]
        }
        fake_response.raise_for_status.return_value = None
        post.return_value = fake_response

        env = {
            "CHATBOT_PROVIDER": "openai",
            "OPENAI_API_KEY": "test-key",
            "OPENAI_MODEL": "gpt-5.6-sol",
        }
        with patch.dict(os.environ, env, clear=False):
            result = create_chat_response("Tôi muốn làm bài thi")

        self.assertEqual(result["provider"], "openai")
        self.assertIn("Luyện thi", result["reply"])
        request_payload = post.call_args.kwargs["json"]
        self.assertEqual(request_payload["model"], "gpt-5.6-sol")
        self.assertEqual(request_payload["reasoning"]["effort"], "none")

    @patch("chatbot.service.genai.Client")
    def test_gemini_fallback_response_contract(self, client_class):
        client = Mock()
        client.models.generate_content.return_value = Mock(text="Bạn có thể mở Diễn đàn.")
        client_class.return_value = client

        env = {
            "LOCAL_DEV_MODE": "0",
            "CHATBOT_PROVIDER": "",
            "OPENAI_API_KEY": "",
            "GEMINI_API_KEY": "existing-production-key",
        }
        with patch.dict(os.environ, env, clear=True):
            result = create_chat_response("Tôi muốn vào diễn đàn")

        self.assertEqual(result["provider"], "gemini")
        self.assertIn("Diễn đàn", result["reply"])
        client.models.generate_content.assert_called_once()


class ChatbotApiTest(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(
            os.environ,
            {"LOCAL_DEV_MODE": "1", "CHATBOT_PROVIDER": "mock"},
            clear=False,
        )
        self.env.start()
        self.client = create_app().test_client()

    def tearDown(self):
        self.env.stop()

    def test_health(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["status"], "ok")

    def test_chat_validation(self):
        response = self.client.post("/api/chat", json={"message": ""})
        self.assertEqual(response.status_code, 400)

    def test_chat_response_contract(self):
        response = self.client.post(
            "/api/chat",
            json={
                "message": "Mở khóa học",
                "history": [{"role": "user", "content": "Xin chào"}],
                "context": {"path": "/"},
            },
        )
        payload = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(payload["success"])
        self.assertEqual(payload["provider"], "mock")
        self.assertEqual(payload["actions"][0]["target"], "/e-learning")


if __name__ == "__main__":
    unittest.main()

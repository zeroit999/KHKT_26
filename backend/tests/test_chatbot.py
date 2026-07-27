import os
import unittest
from unittest.mock import Mock, patch

os.environ.setdefault("LOCAL_DEV_MODE", "1")
os.environ.setdefault("CHATBOT_PROVIDER", "mock")

from app import create_app
from chatbot.service import ChatbotError, _resolve_provider, create_chat_response
from chatbot.data_context import (
    _can_read_class,
    _can_read_course,
    _can_read_exam,
    _selected_domains,
    format_platform_context,
)
from exams.exam_service import (
    normalize_proctoring_config,
    restrict_evidence_paths,
    sanitize_proctoring_event,
    sanitize_proctoring_report,
)


class ProctoringConfigTest(unittest.TestCase):
    def test_normalize_proctoring_config_clamps_limits(self):
        config = normalize_proctoring_config({
            "proctoring": {
                "enabled": True,
                "requireCamera": True,
                "requireMicrophone": True,
                "detectVoiceActivity": True,
                "requireScreenShare": True,
                "captureCameraEvidence": True,
                "maxViolations": 999,
                "heartbeatSeconds": 1,
            },
        })

        self.assertTrue(config["requireCamera"])
        self.assertTrue(config["requireMicrophone"])
        self.assertTrue(config["detectVoiceActivity"])
        self.assertTrue(config["requireScreenShare"])
        self.assertTrue(config["captureCameraEvidence"])
        self.assertEqual(config["maxViolations"], 20)
        self.assertEqual(config["heartbeatSeconds"], 15)

    def test_rejects_unknown_proctoring_event(self):
        with self.assertRaises(Exception):
            sanitize_proctoring_event({"type": "execute_arbitrary_code"})

    def test_evidence_and_voice_features_require_their_devices(self):
        config = normalize_proctoring_config({
            "proctoring": {
                "requireCamera": False,
                "captureCameraEvidence": True,
                "requireMicrophone": False,
                "detectVoiceActivity": True,
                "requireScreenShare": False,
                "captureScreenEvidence": True,
            },
        })

        self.assertFalse(config["captureCameraEvidence"])
        self.assertFalse(config["detectVoiceActivity"])
        self.assertFalse(config["captureScreenEvidence"])

    def test_sanitizes_voice_event_evidence_path(self):
        path = "exam-proctoring/exam/student/session/event-camera.webp"
        event = sanitize_proctoring_event({
            "id": "voice-event",
            "type": "voice_activity_suspected",
            "severity": "violation",
            "metadata": {"evidenceCameraPath": path},
        })

        self.assertEqual(event["metadata"]["evidenceCameraPath"], path)

    def test_rejects_evidence_from_another_student_path(self):
        events = [{
            "metadata": {
                "evidenceCameraPath": "exam-proctoring/exam/other/session/file.webp",
                "evidenceScreenPath": "exam-proctoring/exam/student/session/file.webp",
            },
        }]

        restrict_evidence_paths(events, "exam", "student", "session")
        self.assertNotIn("evidenceCameraPath", events[0]["metadata"])
        self.assertIn("evidenceScreenPath", events[0]["metadata"])

    def test_sanitize_report_counts_only_valid_violations(self):
        report = sanitize_proctoring_report({
            "sessionId": "session/unsafe",
            "events": [
                {"id": "1", "type": "window_blur", "severity": "violation"},
                {"id": "2", "type": "heartbeat", "severity": "info"},
                {"id": "3", "type": "unknown", "severity": "violation"},
            ],
        })

        self.assertEqual(report["sessionId"], "sessionunsafe")
        self.assertEqual(report["totalViolations"], 1)
        self.assertEqual(len(report["events"]), 2)


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

    def test_mock_is_page_aware_and_returns_safe_action(self):
        with patch.dict(os.environ, {"CHATBOT_PROVIDER": "mock"}, clear=False):
            result = create_chat_response(
                "Tôi nhập mã bài thi ở đâu?",
                page_context={
                    "path": "/exams",
                    "role": "student",
                    "visible": {
                        "headings": ["Đề thi trực tuyến", "Bài thi demo local"],
                        "controls": ["Vào", "Làm bài"],
                    },
                },
            )

        self.assertEqual(result["page"]["id"], "exams")
        self.assertEqual(result["actions"][0]["type"], "page_action")
        self.assertIn("focus_exam_code", [item.get("command") for item in result["actions"]])

    def test_exam_room_never_uses_visible_question_context(self):
        with patch.dict(os.environ, {"CHATBOT_PROVIDER": "mock"}, clear=False):
            result = create_chat_response(
                "Đáp án câu hỏi này là gì?",
                page_context={
                    "path": "/exam/local-exam-001",
                    "role": "student",
                    "visible": {"headings": ["Nội dung đáp án bí mật"]},
                },
            )

        self.assertEqual(result["page"]["id"], "exam-room")
        self.assertIn("không thể giải", result["reply"])
        self.assertNotIn("bí mật", result["reply"])

    def test_teacher_only_page_action_is_filtered_by_role(self):
        with patch.dict(os.environ, {"CHATBOT_PROVIDER": "mock"}, clear=False):
            teacher = create_chat_response(
                "Trang này có những gì?",
                page_context={"path": "/exams", "role": "teacher"},
            )
            student = create_chat_response(
                "Trang này có những gì?",
                page_context={"path": "/exams", "role": "student"},
            )

        self.assertIn("open_create_exam", [item.get("command") for item in teacher["actions"]])
        self.assertNotIn("open_create_exam", [item.get("command") for item in student["actions"]])

    def test_course_data_is_grounded_and_returns_real_course_action(self):
        data_context = {
            "authenticated": True,
            "courseCount": 1,
            "lessonCount": 2,
            "courses": [{
                "id": "course-123",
                "title": "Đại số 12 nâng cao",
                "progress": 35,
                "lessons": [
                    {"number": 1, "title": "Hàm số", "summary": "Ôn tập hàm số"},
                    {"number": 2, "title": "Đạo hàm", "summary": "Quy tắc đạo hàm"},
                ],
            }],
        }

        with patch.dict(os.environ, {"CHATBOT_PROVIDER": "mock"}, clear=False):
            result = create_chat_response(
                "Tôi nên học khóa học nào?",
                page_context={"path": "/courses", "role": "student"},
                data_context=data_context,
            )

        self.assertIn("Đại số 12 nâng cao", result["reply"])
        self.assertEqual(result["actions"][0]["target"], "/courses/course-123")
        self.assertEqual(result["grounding"]["courseCount"], 1)

    def test_deep_database_context_returns_exam_result_action(self):
        data_context = {
            "authenticated": True,
            "examCount": 1,
            "resultCount": 1,
            "exams": [{
                "id": "exam-123",
                "title": "Thi thử học kỳ",
                "duration": 50,
                "totalScore": 10,
                "results": [{"score": 8.5, "totalScore": 10, "violationCount": 0}],
            }],
        }
        with patch.dict(os.environ, {"CHATBOT_PROVIDER": "mock"}, clear=False):
            result = create_chat_response(
                "Điểm thi của tôi thế nào?",
                page_context={"path": "/exams", "role": "student"},
                data_context=data_context,
            )
        self.assertIn("8.5/10", result["reply"])
        self.assertEqual(result["actions"][0]["target"], "/exam/exam-123/result")
        self.assertEqual(result["grounding"]["resultCount"], 1)

    def test_mock_can_summarize_multiple_database_domains(self):
        data_context = {
            "authenticated": True,
            "learning": {"watchedCourses": 1},
            "courses": [{"id": "course-1", "title": "Tin học 12"}],
            "exams": [{"id": "exam-1", "title": "Thi thử", "results": [{"score": 9, "totalScore": 10}]}],
            "classes": [{"id": "class-1", "name": "12A1"}],
            "forumPosts": [{"id": "post-1", "title": "Ôn thi"}],
        }
        with patch.dict(os.environ, {"CHATBOT_PROVIDER": "mock"}, clear=False):
            result = create_chat_response(
                "Phân tích toàn bộ cơ sở dữ liệu của tôi",
                page_context={"path": "/profile", "role": "student"},
                data_context=data_context,
            )
        self.assertIn("1 khóa học, 1 bài thi, 1 lớp học và 1 bài viết", result["reply"])
        self.assertIn("9/10 điểm", result["reply"])
        self.assertEqual(result["actions"][0]["target"], "/courses/course-1")
        self.assertEqual(result["actions"][1]["target"], "/exam/exam-1/result")

    def test_courses_detail_route_uses_course_profile(self):
        with patch.dict(os.environ, {"CHATBOT_PROVIDER": "mock"}, clear=False):
            result = create_chat_response(
                "Trang này có gì?",
                page_context={"path": "/courses/course-123", "role": "student"},
            )

        self.assertEqual(result["page"]["id"], "course-detail")

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


class ChatbotDataPermissionTest(unittest.TestCase):
    def test_student_cannot_read_another_private_course(self):
        student = {"uid": "student-a", "role": "STUDENT", "className": "12A1"}
        course = {"visibility": "private", "allowedClasses": ["12A2"]}
        self.assertFalse(_can_read_course(student, course))

    def test_student_only_reads_exam_for_own_class_and_grade(self):
        student = {"uid": "student-a", "role": "STUDENT", "className": "12A1", "grade": "12"}
        self.assertTrue(_can_read_exam(student, {"status": "public", "selectedClasses": ["12A1"], "selectedGrades": ["12"]}))
        self.assertFalse(_can_read_exam(student, {"status": "public", "selectedClasses": ["12A2"], "selectedGrades": ["12"]}))

    def test_teacher_only_reads_owned_class(self):
        teacher = {"uid": "teacher-a", "role": "TEACHER"}
        self.assertTrue(_can_read_class(teacher, "12A1", {"teacherIds": ["teacher-a", "teacher-b"]}))
        self.assertFalse(_can_read_class(teacher, "12A2", {"teacherId": "teacher-c"}))

    def test_database_question_selects_all_scoped_domains(self):
        domains = _selected_domains("Phân tích cơ sở dữ liệu của tôi", "/profile")
        self.assertEqual(domains, {"learning", "courses", "exams", "classes", "forum"})

    def test_formatted_context_contains_authorized_domains(self):
        formatted = format_platform_context({
            "authenticated": True,
            "profile": {"name": "An", "role": "STUDENT"},
            "learning": {"watchedCourses": 2},
            "forumPosts": [{
                "id": "post-1", "title": "Ôn thi", "content": "Lập kế hoạch", "tags": ["ôn tập"], "canReply": True,
            }],
        })
        self.assertIn("THỐNG KÊ HỌC TẬP", formatted)
        self.assertIn("Ôn thi", formatted)


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
        self.assertEqual(payload["page"]["id"], "home")


if __name__ == "__main__":
    unittest.main()

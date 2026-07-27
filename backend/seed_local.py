import os


os.environ.setdefault("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080")
os.environ.setdefault("FIREBASE_AUTH_EMULATOR_HOST", "127.0.0.1:9099")
os.environ.setdefault("FIREBASE_DATABASE_EMULATOR_HOST", "127.0.0.1:9000")

import firebase_admin
from firebase_admin import auth, firestore
from firebase_admin import credentials
from google.auth.credentials import AnonymousCredentials


PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "zuny-local")
PASSWORD = os.environ.get("LOCAL_DEMO_PASSWORD", "Zuny@123")


class EmulatorCredential(credentials.Base):
    def get_credential(self):
        return AnonymousCredentials()


def initialize_firebase():
    if not firebase_admin._apps:
        firebase_admin.initialize_app(EmulatorCredential(), options={
            "projectId": PROJECT_ID,
            "storageBucket": f"{PROJECT_ID}.appspot.com",
            "databaseURL": f"http://127.0.0.1:9000?ns={PROJECT_ID}",
        })


def upsert_auth_user(uid, email, display_name):
    try:
        auth.get_user(uid)
        auth.update_user(
            uid,
            email=email,
            password=PASSWORD,
            display_name=display_name,
            disabled=False,
        )
    except auth.UserNotFoundError:
        auth.create_user(
            uid=uid,
            email=email,
            password=PASSWORD,
            display_name=display_name,
        )


def seed():
    initialize_firebase()
    database = firestore.client()

    users = [
        {
            "uid": "local-student-001",
            "email": "student@zuny.local",
            "displayName": "Học sinh Demo",
            "fullName": "Học sinh Demo",
            "role": "STUDENT",
            "grade": "12",
            "className": "12A1",
            "points": 120,
            "learningStreak": 3,
            "isSetupComplete": True,
            "isLocalDemo": True,
        },
        {
            "uid": "local-teacher-001",
            "email": "teacher@zuny.local",
            "displayName": "Giáo viên Demo",
            "fullName": "Giáo viên Demo",
            "role": "TEACHER",
            "subject": "Toán",
            "classes": ["12A1"],
            "points": 0,
            "learningStreak": 0,
            "isSetupComplete": True,
            "isLocalDemo": True,
        },
    ]

    for user in users:
        upsert_auth_user(user["uid"], user["email"], user["displayName"])
        database.collection("users").document(user["uid"]).set(user, merge=True)

    database.collection("classes").document("12A1").set({
        "name": "12A1",
        "className": "12A1",
        "grade": "12",
        "teacherId": "local-teacher-001",
        "teacherName": "Giáo viên Demo",
        "studentIds": ["local-student-001"],
        "isLocalDemo": True,
    }, merge=True)
    class_ref = database.collection("classes").document("12A1")
    class_ref.collection("students").document("local-student-001").set({
        "studentId": "local-student-001",
        "studentCode": "HS001",
        "name": "Học sinh Demo",
        "status": "active",
        "isLocalDemo": True,
    }, merge=True)
    subject_ref = class_ref.collection("subjects").document("math")
    subject_ref.set({"name": "Toán", "order": 1, "isLocalDemo": True}, merge=True)
    subject_ref.collection("tests").document("test-15m-001").set({
        "name": "Kiểm tra 15 phút số 1",
        "code": "KT15-01",
        "order": 1,
        "isLocalDemo": True,
    }, merge=True)
    subject_ref.collection("scores").document("local-student-001").set({
        "studentId": "local-student-001",
        "scores": {"test-15m-001": 8.5},
        "average": 8.5,
        "isLocalDemo": True,
    }, merge=True)

    database.collection("learningStats").document("local-student-001").set({
        "watchedLessons": 1,
        "watchedCourses": 1,
        "watchedCourseIds": ["local-course-001"],
        "watchedDates": ["2026-07-27"],
        "streak": 1,
        "isLocalDemo": True,
    }, merge=True)
    database.collection("learningStats").document("local-student-001").collection("courses").document("local-course-001").set({
        "courseId": "local-course-001",
        "progress": 50,
        "watchedSeconds": 420,
        "isLocalDemo": True,
    }, merge=True)

    database.collection("courses").document("local-course-001").set({
        "title": "Khóa học demo local",
        "description": "Dữ liệu mẫu chỉ tồn tại trong Firebase Emulator.",
        "subject": "Toán",
        "grade": "12",
        "teacherId": "local-teacher-001",
        "teacherName": "Giáo viên Demo",
        "published": True,
        "lessonCount": 2,
        "lessons": [
            {
                "title": "Ôn tập hàm số",
                "content": "Nhận biết tập xác định, tính đơn điệu và đồ thị hàm số.",
                "attachMode": "document",
            },
            {
                "title": "Quy tắc đạo hàm",
                "content": "Tổng hợp công thức và bài tập vận dụng đạo hàm cơ bản.",
                "attachMode": "document",
            },
        ],
        "isLocalDemo": True,
    }, merge=True)

    exam_ref = database.collection("exams").document("local-exam-001")
    exam_ref.set({
        "title": "Bài thi demo local",
        "description": "Bài thi mẫu dùng kiểm thử môi trường local.",
        "subject": "Toán",
        "subjectCode": "MATH",
        "code": "LOCAL01",
        "grade": "12",
        "selectedGrades": ["12"],
        "selectedClasses": [],
        "teacherId": "local-teacher-001",
        "teacherName": "Giáo viên Demo",
        "status": "public",
        "duration": 15,
        "attemptMode": "multiple",
        "maxAttempts": 3,
        "questionCount": 1,
        "totalScore": 10,
        "shuffleQuestions": False,
        "shuffleAnswers": False,
        "proctoring": {
            "enabled": True,
            "requireFullscreen": True,
            "detectTabSwitch": True,
            "detectWindowBlur": True,
            "blockClipboard": True,
            "blockContextMenu": True,
            "blockShortcuts": True,
            "requireCamera": True,
            "requireMicrophone": True,
            "detectVoiceActivity": True,
            "requireScreenShare": True,
            "requireEntireScreen": True,
            "captureCameraEvidence": True,
            "captureScreenEvidence": True,
            "autoSubmit": True,
            "maxViolations": 3,
            "heartbeatSeconds": 30,
        },
        "maxFullscreenViolations": 3,
        "isLocalDemo": True,
    }, merge=True)
    exam_ref.collection("questions").document("local-q-001").set({
        "type": "multiple",
        "question": "Kết quả của 2 + 2 là bao nhiêu?",
        "content": "Kết quả của 2 + 2 là bao nhiêu?",
        "options": ["3", "4", "5", "6"],
        "answers": ["3", "4", "5", "6"],
        "correctAnswer": 1,
        "score": 10,
        "order": 1,
    }, merge=True)
    exam_ref.collection("results").document("local-result-001").set({
        "studentId": "local-student-001",
        "score": 8,
        "totalScore": 10,
        "correctCount": 1,
        "wrongCount": 0,
        "answeredCount": 1,
        "totalViolations": 1,
        "isLocalDemo": True,
    }, merge=True)
    exam_ref.collection("attempts").document("local-student-001").set({
        "studentId": "local-student-001",
        "attemptCount": 1,
        "isLocalDemo": True,
    }, merge=True)

    database.collection("forumPosts").document("local-forum-post-001").set({
        "title": "Cùng ôn tập trước kỳ thi",
        "content": "Chia sẻ cách hệ thống hóa kiến thức và lên lịch ôn tập hiệu quả.",
        "type": "discussion",
        "tags": ["ôn tập", "lớp 12"],
        "scope": "hall",
        "status": "approved",
        "authorId": "local-teacher-001",
        "authorName": "Giáo viên Demo",
        "commentsCount": 2,
        "isLocalDemo": True,
    }, merge=True)

    print("Local Firebase data seeded successfully.")


if __name__ == "__main__":
    seed()

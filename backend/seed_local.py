from werkzeug.security import generate_password_hash

from app import app
from extensions import db

from models.user import User
from models.classroom import (
    Classroom,
    ClassroomMember,
    ClassroomSubject,
    ClassroomSubjectTest,
    ClassroomScore,
)
from models.course import (
    Course,
    LearningProgress,
)
from models.exam import (
    Exam,
    ExamQuestion,
    ExamResult,
    ExamAttempt,
)
from models.forum import ForumPost


PASSWORD = "Zuny@123"

STUDENT_EMAIL = "student@zuny.local"
TEACHER_EMAIL = "teacher@zuny.local"

STUDENT_LEGACY_ID = "local-student-001"
TEACHER_LEGACY_ID = "local-teacher-001"

CLASS_CODE = "LOCAL12A1"
COURSE_LEGACY_ID = "local-course-001"


def get_or_create_user(
    *,
    email,
    full_name,
    role,
    grade=None,
    class_name=None,
    profile_data=None,
):
    user = User.query.filter_by(
        email=email
    ).first()

    data = dict(profile_data or {})

    if user is None:
        user = User(
            email=email,
            password_hash=generate_password_hash(PASSWORD),
            full_name=full_name,
            role=role,
            grade=grade,
            class_name=class_name,
            auth_provider="local",
            profile_data=data,
        )

        db.session.add(user)
        db.session.flush()

        print(
            f"[CREATE] User {email} id={user.id}"
        )

    else:
        user.full_name = full_name
        user.role = role
        user.grade = grade
        user.class_name = class_name
        user.auth_provider = "local"

        # Seed local phải luôn đăng nhập được bằng PASSWORD.
        user.password_hash = generate_password_hash(
            PASSWORD
        )

        existing = dict(
            user.profile_data or {}
        )
        existing.update(data)
        user.profile_data = existing

        db.session.flush()

        print(
            f"[UPDATE] User {email} id={user.id}"
        )

    return user


def seed_users():
    student = get_or_create_user(
        email=STUDENT_EMAIL,
        full_name="Học sinh Demo",
        role="STUDENT",
        grade="12",
        class_name="12A1",
        profile_data={
            "legacyUid": STUDENT_LEGACY_ID,
            "displayName": "Học sinh Demo",
            "points": 120,
            "learningStreak": 3,
            "isSetupComplete": True,
            "isLocalDemo": True,
        },
    )

    teacher = get_or_create_user(
        email=TEACHER_EMAIL,
        full_name="Giáo viên Demo",
        role="TEACHER",
        profile_data={
            "legacyUid": TEACHER_LEGACY_ID,
            "displayName": "Giáo viên Demo",
            "subject": "Toán",
            "classes": ["12A1"],
            "points": 0,
            "learningStreak": 0,
            "isSetupComplete": True,
            "isLocalDemo": True,
        },
    )

    return student, teacher


def seed_classroom(student, teacher):
    classroom = Classroom.query.filter_by(
        class_code=CLASS_CODE
    ).first()

    if classroom is None:
        classroom = Classroom(
            name="12A1",
            description="Lớp demo local",
            grade="12",
            class_code=CLASS_CODE,
            teacher_id=teacher.id,
            teacher_email=teacher.email,
            teacher_name=teacher.full_name,
            subject="Toán",
            status="active",
            student_count=1,
            member_ids=[student.id],
            class_data={
                "legacyId": "12A1",
                "className": "12A1",
                "isLocalDemo": True,
            },
        )

        db.session.add(classroom)
        db.session.flush()

        print(
            f"[CREATE] Classroom id={classroom.id}"
        )

    else:
        classroom.name = "12A1"
        classroom.grade = "12"
        classroom.teacher_id = teacher.id
        classroom.teacher_email = teacher.email
        classroom.teacher_name = teacher.full_name
        classroom.subject = "Toán"
        classroom.status = "active"
        classroom.student_count = 1
        classroom.member_ids = [student.id]

        data = dict(
            classroom.class_data or {}
        )
        data.update({
            "legacyId": "12A1",
            "className": "12A1",
            "isLocalDemo": True,
        })
        classroom.class_data = data

        db.session.flush()

        print(
            f"[UPDATE] Classroom id={classroom.id}"
        )

    member = ClassroomMember.query.filter_by(
        classroom_id=classroom.id,
        user_id=student.id,
    ).first()

    if member is None:
        member = ClassroomMember(
            legacy_id=STUDENT_LEGACY_ID,
            classroom_id=classroom.id,
            user_id=student.id,
            email=student.email,
            name=student.full_name,
            role="STUDENT",
            student_code="HS001",
            status="active",
            member_data={
                "isLocalDemo": True,
            },
        )

        db.session.add(member)
        db.session.flush()

        print(
            f"[CREATE] ClassroomMember id={member.id}"
        )

    else:
        member.legacy_id = STUDENT_LEGACY_ID
        member.email = student.email
        member.name = student.full_name
        member.role = "STUDENT"
        member.student_code = "HS001"
        member.status = "active"

        data = dict(
            member.member_data or {}
        )
        data["isLocalDemo"] = True
        member.member_data = data

        db.session.flush()

        print(
            f"[UPDATE] ClassroomMember id={member.id}"
        )

    subject = ClassroomSubject.query.filter_by(
        classroom_id=classroom.id,
        legacy_id="math",
    ).first()

    if subject is None:
        subject = ClassroomSubject(
            legacy_id="math",
            classroom_id=classroom.id,
            teacher_id=teacher.id,
            name="Toán",
            display_order=1,
            is_default=True,
            subject_data={
                "isLocalDemo": True,
            },
        )

        db.session.add(subject)
        db.session.flush()

        print(
            f"[CREATE] ClassroomSubject id={subject.id}"
        )

    else:
        subject.teacher_id = teacher.id
        subject.name = "Toán"
        subject.display_order = 1
        subject.is_default = True

        data = dict(
            subject.subject_data or {}
        )
        data["isLocalDemo"] = True
        subject.subject_data = data

        db.session.flush()

        print(
            f"[UPDATE] ClassroomSubject id={subject.id}"
        )

    test = ClassroomSubjectTest.query.filter_by(
        classroom_id=classroom.id,
        subject_id=subject.id,
        legacy_id="test-15m-001",
    ).first()

    if test is None:
        test = ClassroomSubjectTest(
            legacy_id="test-15m-001",
            subject_id=subject.id,
            classroom_id=classroom.id,
            name="Kiểm tra 15 phút số 1",
            code="KT15-01",
            display_order=1,
            max_score=10.0,
            test_data={
                "isLocalDemo": True,
            },
        )

        db.session.add(test)
        db.session.flush()

        print(
            f"[CREATE] ClassroomSubjectTest id={test.id}"
        )

    else:
        test.name = "Kiểm tra 15 phút số 1"
        test.code = "KT15-01"
        test.display_order = 1
        test.max_score = 10.0

        data = dict(
            test.test_data or {}
        )
        data["isLocalDemo"] = True
        test.test_data = data

        db.session.flush()

        print(
            f"[UPDATE] ClassroomSubjectTest id={test.id}"
        )

    score = ClassroomScore.query.filter_by(
        classroom_id=classroom.id,
        subject_id=subject.id,
        member_id=member.id,
    ).first()

    score_key = str(test.id)

    if score is None:
        score = ClassroomScore(
            subject_id=subject.id,
            classroom_id=classroom.id,
            member_id=member.id,
            user_id=student.id,
            scores={
                score_key: 8.5,
            },
            average=8.5,
            score_data={
                "legacyScores": {
                    "test-15m-001": 8.5,
                },
                "isLocalDemo": True,
            },
        )

        db.session.add(score)
        db.session.flush()

        print(
            f"[CREATE] ClassroomScore id={score.id}"
        )

    else:
        scores = dict(
            score.scores or {}
        )
        scores[score_key] = 8.5

        score.user_id = student.id
        score.scores = scores
        score.average = 8.5

        data = dict(
            score.score_data or {}
        )
        data.update({
            "legacyScores": {
                "test-15m-001": 8.5,
            },
            "isLocalDemo": True,
        })
        score.score_data = data

        db.session.flush()

        print(
            f"[UPDATE] ClassroomScore id={score.id}"
        )

    return classroom, member, subject, test


def seed_course(student, teacher):
    course = Course.query.filter_by(
        legacy_id=COURSE_LEGACY_ID
    ).first()

    lessons = [
        {
            "title": "Ôn tập hàm số",
            "content": (
                "Nhận biết tập xác định, tính đơn điệu "
                "và đồ thị hàm số."
            ),
            "attachMode": "document",
        },
        {
            "title": "Quy tắc đạo hàm",
            "content": (
                "Tổng hợp công thức và bài tập vận dụng "
                "đạo hàm cơ bản."
            ),
            "attachMode": "document",
        },
    ]

    if course is None:
        course = Course(
            legacy_id=COURSE_LEGACY_ID,
            teacher_id=teacher.id,
            title="Khóa học demo local",
            description=(
                "Dữ liệu mẫu PostgreSQL dùng cho "
                "môi trường local."
            ),
            category="Toán",
            lessons=lessons,
            lesson_count=2,
            teacher_email=teacher.email,
            teacher_name=teacher.full_name,
            teacher_subject="Toán",
            created_by_role="TEACHER",
            visibility="public",
            publish_confirmed=True,
            status="published",
            moderation_status="approved",
            metadata_json={
                "subject": "Toán",
                "grade": "12",
                "legacyTeacherUid": TEACHER_LEGACY_ID,
                "isLocalDemo": True,
            },
        )

        db.session.add(course)
        db.session.flush()

        print(
            f"[CREATE] Course id={course.id}"
        )

    else:
        course.teacher_id = teacher.id
        course.title = "Khóa học demo local"
        course.description = (
            "Dữ liệu mẫu PostgreSQL dùng cho "
            "môi trường local."
        )
        course.category = "Toán"
        course.lessons = lessons
        course.lesson_count = 2
        course.teacher_email = teacher.email
        course.teacher_name = teacher.full_name
        course.teacher_subject = "Toán"
        course.created_by_role = "TEACHER"
        course.visibility = "public"
        course.publish_confirmed = True
        course.status = "published"
        course.moderation_status = "approved"

        metadata = dict(
            course.metadata_json or {}
        )
        metadata.update({
            "subject": "Toán",
            "grade": "12",
            "legacyTeacherUid": TEACHER_LEGACY_ID,
            "isLocalDemo": True,
        })
        course.metadata_json = metadata

        db.session.flush()

        print(
            f"[UPDATE] Course id={course.id}"
        )

    progress = LearningProgress.query.filter_by(
        user_id=student.id,
        course_id=course.id,
    ).first()

    if progress is None:
        progress = LearningProgress(
            user_id=student.id,
            course_id=course.id,
            progress=50,
            watched_seconds=420,
            watched_date="2026-07-27",
            progress_data={
                "watchedLessons": 1,
                "watchedCourses": 1,
                "watchedDates": [
                    "2026-07-27",
                ],
                "streak": 1,
                "legacyCourseId": COURSE_LEGACY_ID,
                "isLocalDemo": True,
            },
        )

        db.session.add(progress)
        db.session.flush()

        print(
            f"[CREATE] LearningProgress id={progress.id}"
        )

    else:
        progress.progress = 50
        progress.watched_seconds = 420
        progress.watched_date = "2026-07-27"

        data = dict(
            progress.progress_data or {}
        )
        data.update({
            "watchedLessons": 1,
            "watchedCourses": 1,
            "watchedDates": [
                "2026-07-27",
            ],
            "streak": 1,
            "legacyCourseId": COURSE_LEGACY_ID,
            "isLocalDemo": True,
        })
        progress.progress_data = data

        db.session.flush()

        print(
            f"[UPDATE] LearningProgress id={progress.id}"
        )

    return course


def seed_exam(student, teacher):
    exam = Exam.query.filter(
        Exam.teacher_id == teacher.id,
        Exam.metadata_json["legacyId"].as_string()
        == "local-exam-001",
    ).first()

    settings = {
        "attemptMode": "multiple",
        "maxAttempts": 3,
        "shuffleQuestions": False,
        "shuffleAnswers": False,
        "maxFullscreenViolations": 3,
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
    }

    metadata = {
        "legacyId": "local-exam-001",
        "subjectCode": "MATH",
        "code": "LOCAL01",
        "grade": "12",
        "teacherName": teacher.full_name,
        "questionCount": 1,
        "totalScore": 10,
        "legacyTeacherUid": TEACHER_LEGACY_ID,
        "isLocalDemo": True,
    }

    if exam is None:
        exam = Exam(
            teacher_id=teacher.id,
            title="Bài thi demo local",
            description=(
                "Bài thi mẫu dùng kiểm thử "
                "môi trường local."
            ),
            subject="Toán",
            duration=15,
            status="public",
            visibility="public",
            selected_grades=["12"],
            selected_classes=[],
            settings=settings,
            metadata_json=metadata,
        )

        db.session.add(exam)
        db.session.flush()

        print(
            f"[CREATE] Exam id={exam.id}"
        )

    else:
        exam.title = "Bài thi demo local"
        exam.description = (
            "Bài thi mẫu dùng kiểm thử "
            "môi trường local."
        )
        exam.subject = "Toán"
        exam.duration = 15
        exam.status = "public"
        exam.visibility = "public"
        exam.selected_grades = ["12"]
        exam.selected_classes = []
        exam.settings = settings
        exam.metadata_json = metadata

        db.session.flush()

        print(
            f"[UPDATE] Exam id={exam.id}"
        )

    question = ExamQuestion.query.filter_by(
        exam_id=exam.id,
        question_key="local-q-001",
    ).first()

    question_data = {
        "type": "multiple",
        "question": "Kết quả của 2 + 2 là bao nhiêu?",
        "content": "Kết quả của 2 + 2 là bao nhiêu?",
        "options": ["3", "4", "5", "6"],
        "answers": ["3", "4", "5", "6"],
        "correctAnswer": 1,
        "score": 10,
        "order": 1,
    }

    if question is None:
        question = ExamQuestion(
            exam_id=exam.id,
            question_key="local-q-001",
            position=1,
            question_data=question_data,
        )

        db.session.add(question)
        db.session.flush()

        print(
            f"[CREATE] ExamQuestion id={question.id}"
        )

    else:
        question.position = 1
        question.question_data = question_data

        db.session.flush()

        print(
            f"[UPDATE] ExamQuestion id={question.id}"
        )

    result = ExamResult.query.filter_by(
        exam_id=exam.id,
        student_id=student.id,
    ).first()

    result_data = {
        "legacyId": "local-result-001",
        "legacyStudentUid": STUDENT_LEGACY_ID,
        "score": 8,
        "totalScore": 10,
        "correctCount": 1,
        "wrongCount": 0,
        "answeredCount": 1,
        "totalViolations": 1,
        "isLocalDemo": True,
    }

    if result is None:
        result = ExamResult(
            exam_id=exam.id,
            student_id=student.id,
            result_data=result_data,
        )

        db.session.add(result)
        db.session.flush()

        print(
            f"[CREATE] ExamResult id={result.id}"
        )

    else:
        result.result_data = result_data

        db.session.flush()

        print(
            f"[UPDATE] ExamResult id={result.id}"
        )

    attempt = ExamAttempt.query.filter_by(
        exam_id=exam.id,
        student_id=student.id,
    ).first()

    attempt_data = {
        "legacyStudentUid": STUDENT_LEGACY_ID,
        "attemptCount": 1,
        "isLocalDemo": True,
    }

    if attempt is None:
        attempt = ExamAttempt(
            exam_id=exam.id,
            student_id=student.id,
            attempt_data=attempt_data,
        )

        db.session.add(attempt)
        db.session.flush()

        print(
            f"[CREATE] ExamAttempt id={attempt.id}"
        )

    else:
        attempt.attempt_data = attempt_data

        db.session.flush()

        print(
            f"[UPDATE] ExamAttempt id={attempt.id}"
        )

    return exam


def seed_forum(teacher):
    post = ForumPost.query.filter(
        ForumPost.author_id == teacher.id,
        ForumPost.title == "Cùng ôn tập trước kỳ thi",
    ).first()

    if post is None:
        post = ForumPost(
            author_id=teacher.id,
            title="Cùng ôn tập trước kỳ thi",
            content=(
                "Chia sẻ cách hệ thống hóa kiến thức "
                "và lên lịch ôn tập hiệu quả."
            ),
            type="discussion",
            tags=["ôn tập", "lớp 12"],
            scope="hall",
            status="approved",
            comments_count=2,
            author_name_override=teacher.full_name,
            author_email_override=teacher.email,
        )

        db.session.add(post)
        db.session.flush()

        print(
            f"[CREATE] ForumPost id={post.id}"
        )

    else:
        post.content = (
            "Chia sẻ cách hệ thống hóa kiến thức "
            "và lên lịch ôn tập hiệu quả."
        )
        post.type = "discussion"
        post.tags = [
            "ôn tập",
            "lớp 12",
        ]
        post.scope = "hall"
        post.status = "approved"
        post.comments_count = 2
        post.author_name_override = teacher.full_name
        post.author_email_override = teacher.email

        db.session.flush()

        print(
            f"[UPDATE] ForumPost id={post.id}"
        )

    return post


def seed():
    with app.app_context():
        try:
            print("=" * 72)
            print(" ZUNY LOCAL POSTGRESQL SEED")
            print("=" * 72)

            student, teacher = seed_users()

            seed_classroom(
                student,
                teacher,
            )

            seed_course(
                student,
                teacher,
            )

            seed_exam(
                student,
                teacher,
            )

            seed_forum(
                teacher,
            )

            db.session.commit()

            print("=" * 72)
            print(" PostgreSQL local data seeded successfully.")
            print()
            print(f" Student : {STUDENT_EMAIL}")
            print(f" Teacher : {TEACHER_EMAIL}")
            print(f" Password: {PASSWORD}")
            print("=" * 72)

        except Exception:
            db.session.rollback()
            print(
                "[FAIL] Seed rolled back."
            )
            raise

        finally:
            db.session.remove()


if __name__ == "__main__":
    seed()

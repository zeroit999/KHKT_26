FEATURES = [
    {
        "id": "exams",
        "keywords": ["thi", "bài thi", "đề thi", "luyện thi", "exam"],
        "content": (
            "Mục Luyện thi cho phép học sinh xem và làm bài thi. "
            "Giáo viên có thể tạo, sửa và xem kết quả bài thi. "
            "Phòng thi hiện có chế độ toàn màn hình và ghi nhận số lần thoát toàn màn hình."
        ),
        "actions": [{"id": "open_exams", "label": "Mở Luyện thi", "type": "navigate", "target": "/exams"}],
    },
    {
        "id": "courses",
        "keywords": ["khóa học", "bài học", "e-learning", "học tập"],
        "content": "Mục E-learning hiển thị danh sách khóa học, nội dung chi tiết và tiến độ học tập.",
        "actions": [{"id": "open_courses", "label": "Xem khóa học", "type": "navigate", "target": "/e-learning"}],
    },
    {
        "id": "forum",
        "keywords": ["diễn đàn", "forum", "nhóm", "thảo luận", "tin nhắn"],
        "content": "Diễn đàn hỗ trợ bài viết, nhóm học tập, kênh chat, tệp và thông báo.",
        "actions": [{"id": "open_forum", "label": "Mở Diễn đàn", "type": "navigate", "target": "/Forum"}],
    },
    {
        "id": "profile",
        "keywords": ["hồ sơ", "profile", "tài khoản", "thông tin cá nhân"],
        "content": "Hồ sơ dùng để xem và cập nhật thông tin cá nhân, trường, lớp và ảnh đại diện.",
        "actions": [{"id": "open_profile", "label": "Mở Hồ sơ", "type": "navigate", "target": "/profile"}],
    },
    {
        "id": "leaderboard",
        "keywords": ["xếp hạng", "leaderboard", "điểm", "thành tích"],
        "content": "Bảng xếp hạng hiển thị điểm và thành tích học tập của người dùng.",
        "actions": [{"id": "open_leaderboard", "label": "Xem xếp hạng", "type": "navigate", "target": "/leaderboard"}],
    },
]

DEFAULT_ACTIONS = [
    {"id": "open_courses", "label": "Khóa học", "type": "navigate", "target": "/e-learning"},
    {"id": "open_exams", "label": "Luyện thi", "type": "navigate", "target": "/exams"},
    {"id": "open_forum", "label": "Diễn đàn", "type": "navigate", "target": "/Forum"},
]


def find_relevant_features(message, limit=3):
    normalized = str(message or "").lower()
    scored = []

    for feature in FEATURES:
        score = sum(1 for keyword in feature["keywords"] if keyword in normalized)
        if score:
            scored.append((score, feature))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [feature for _, feature in scored[:limit]]

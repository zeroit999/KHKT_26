import re


FEATURES = [
    {
        "id": "exams",
        "keywords": ["thi", "bài thi", "đề thi", "luyện thi", "exam"],
        "content": (
            "Mục Luyện thi cho phép học sinh tìm đề, nhập mã và làm bài. "
            "Giáo viên có thể tạo, sửa, xem trước và kiểm tra kết quả bài thi."
        ),
        "actions": [
            {"id": "open_exams", "label": "Mở Luyện thi", "type": "navigate", "target": "/exams"},
        ],
    },
    {
        "id": "courses",
        "keywords": ["khóa học", "bài học", "e-learning", "học tập"],
        "content": "E-learning có danh sách khóa học, bài học chi tiết và tiến độ học tập.",
        "actions": [
            {"id": "open_courses", "label": "Xem khóa học", "type": "navigate", "target": "/e-learning"},
        ],
    },
    {
        "id": "forum",
        "keywords": ["diễn đàn", "forum", "nhóm", "thảo luận", "tin nhắn"],
        "content": "Diễn đàn hỗ trợ bài viết, hỏi đáp, nhóm học tập và kênh chat.",
        "actions": [
            {"id": "open_forum", "label": "Mở Diễn đàn", "type": "navigate", "target": "/Forum"},
        ],
    },
    {
        "id": "profile",
        "keywords": ["hồ sơ", "profile", "tài khoản", "thông tin cá nhân"],
        "content": "Hồ sơ dùng để xem và cập nhật thông tin cá nhân, trường, lớp và ảnh đại diện.",
        "actions": [
            {"id": "open_profile", "label": "Mở Hồ sơ", "type": "navigate", "target": "/profile"},
        ],
    },
    {
        "id": "leaderboard",
        "keywords": ["xếp hạng", "leaderboard", "điểm", "thành tích"],
        "content": "Bảng xếp hạng hiển thị điểm, thứ hạng và thành tích học tập.",
        "actions": [
            {"id": "open_leaderboard", "label": "Xem xếp hạng", "type": "navigate", "target": "/leaderboard"},
        ],
    },
]


PAGE_PROFILES = [
    {
        "id": "exam-room",
        "pattern": r"^/exam/[^/]+$",
        "title": "Phòng thi",
        "icon": "shield",
        "summary": "Hỗ trợ quy trình làm bài, đồng hồ, nộp bài và xử lý sự cố kỹ thuật.",
        "instructions": (
            "Không giải câu hỏi, gợi ý đáp án hoặc phân tích nội dung đề đang thi. "
            "Chỉ hỗ trợ thao tác, quy chế và sự cố kỹ thuật."
        ),
        "suggestions": [
            "Tôi gặp sự cố khi làm bài",
            "Cách nộp bài an toàn?",
            "Thoát toàn màn hình bị tính thế nào?",
        ],
        "actions": [
            {"id": "exam_help", "label": "Hướng dẫn phòng thi", "type": "prompt", "prompt": "Hướng dẫn nhanh quy trình làm bài và nộp bài an toàn"},
        ],
        "allow_visible_context": False,
    },
    {
        "id": "exam-result",
        "pattern": r"^/exam/[^/]+/result$",
        "title": "Kết quả bài thi",
        "icon": "chart",
        "summary": "Giải thích điểm số, thống kê và cách cải thiện sau bài thi.",
        "instructions": "Giải thích số liệu đang hiển thị và đề xuất kế hoạch ôn tập thực tế.",
        "suggestions": ["Phân tích kết quả của tôi", "Tôi nên ôn phần nào?", "Điểm được tính như thế nào?"],
        "actions": [
            {"id": "back_exams", "label": "Về kho đề", "type": "navigate", "target": "/exams"},
            {"id": "open_courses", "label": "Tìm bài học", "type": "navigate", "target": "/e-learning"},
        ],
    },
    {
        "id": "exams",
        "pattern": r"^/exams/?$",
        "title": "Kho đề thi",
        "icon": "exam",
        "summary": "Tìm đề, nhập mã thi, hiểu trạng thái đề và quản lý bài thi theo vai trò.",
        "instructions": "Ưu tiên hướng dẫn đúng theo vai trò học sinh hoặc giáo viên.",
        "suggestions": ["Tìm đề phù hợp cho tôi", "Giải thích các trạng thái đề", "Tôi nhập mã bài thi ở đâu?"],
        "actions": [
            {"id": "focus_exam_search", "label": "Tìm đề thi", "type": "page_action", "command": "focus_exam_search"},
            {"id": "focus_exam_code", "label": "Nhập mã đề", "type": "page_action", "command": "focus_exam_code", "roles": ["student", "user"]},
            {"id": "create_exam", "label": "Tạo đề mới", "type": "page_action", "command": "open_create_exam", "roles": ["teacher", "admin", "admin_dev"]},
        ],
    },
    {
        "id": "course-detail",
        "pattern": r"^/(e-learning|courses|learn)/[^/]+$",
        "title": "Nội dung bài học",
        "icon": "book",
        "summary": "Tóm tắt cấu trúc bài học, hướng dẫn học và đề xuất bước tiếp theo.",
        "instructions": "Không bịa nội dung không xuất hiện trong tín hiệu trang được cung cấp.",
        "suggestions": ["Tóm tắt trang bài học này", "Tôi nên học theo thứ tự nào?", "Gợi ý cách ghi nhớ nội dung"],
        "actions": [
            {"id": "back_courses", "label": "Danh sách khóa học", "type": "navigate", "target": "/e-learning"},
        ],
    },
    {
        "id": "courses",
        "pattern": r"^/(e-learning|courses)/?$",
        "title": "E-Learning",
        "icon": "book",
        "summary": "Tìm khóa học, hiểu tiến độ và chọn nội dung nên học tiếp.",
        "instructions": "Dựa vào các tên khóa học và trạng thái hiển thị nếu có.",
        "suggestions": ["Tôi nên học khóa nào trước?", "Tìm khóa học Toán", "Giải thích tiến độ học tập"],
        "actions": [
            {"id": "focus_course_search", "label": "Tìm khóa học", "type": "page_action", "command": "focus_course_search"},
            {"id": "open_exams", "label": "Luyện tập ngay", "type": "navigate", "target": "/exams"},
        ],
    },
    {
        "id": "forum",
        "pattern": r"^/forum/?$",
        "title": "Cộng đồng",
        "icon": "forum",
        "summary": "Tìm bài viết, đặt câu hỏi, đăng bài và tham gia thảo luận học tập.",
        "instructions": "Khuyến khích trao đổi tôn trọng, không tạo nội dung quấy rối hoặc gian lận.",
        "suggestions": ["Giúp tôi viết câu hỏi rõ ràng", "Tìm thảo luận liên quan", "Cách đăng một bài mới?"],
        "actions": [
            {"id": "focus_forum_search", "label": "Tìm bài viết", "type": "page_action", "command": "focus_forum_search"},
            {"id": "create_post", "label": "Đăng bài mới", "type": "page_action", "command": "open_create_post"},
        ],
    },
    {
        "id": "leaderboard",
        "pattern": r"^/leaderboard/?$",
        "title": "Bảng xếp hạng",
        "icon": "trophy",
        "summary": "Giải thích thứ hạng, điểm số, bộ lọc và xu hướng thành tích.",
        "instructions": "Không suy đoán dữ liệu không có trong tín hiệu trang.",
        "suggestions": ["Điểm xếp hạng tính thế nào?", "Phân tích vị trí của tôi", "Tìm một học sinh hoặc lớp"],
        "actions": [
            {"id": "focus_leaderboard_search", "label": "Tìm trên BXH", "type": "page_action", "command": "focus_leaderboard_search"},
            {"id": "open_exams", "label": "Cải thiện điểm", "type": "navigate", "target": "/exams"},
        ],
    },
    {
        "id": "classes",
        "pattern": r"^/classes/?$",
        "title": "Quản lý lớp",
        "icon": "users",
        "summary": "Quản lý lớp, học sinh, môn học và bảng điểm.",
        "instructions": "Chỉ đề xuất thao tác phù hợp với quyền hiện tại.",
        "suggestions": ["Cách thêm học sinh vào lớp?", "Tìm học sinh trong lớp", "Giải thích bảng điểm"],
        "actions": [
            {"id": "focus_class_search", "label": "Tìm học sinh", "type": "page_action", "command": "focus_class_search"},
        ],
    },
    {
        "id": "profile",
        "pattern": r"^/profile/?$",
        "title": "Hồ sơ cá nhân",
        "icon": "profile",
        "summary": "Cập nhật hồ sơ, ảnh đại diện, trường và lớp.",
        "instructions": "Không yêu cầu người dùng gửi mật khẩu hoặc dữ liệu nhạy cảm trong chat.",
        "suggestions": ["Hồ sơ còn thiếu gì?", "Cách đổi ảnh đại diện?", "Thông tin nào ảnh hưởng tới bài thi?"],
        "actions": [
            {"id": "open_settings", "label": "Mở cài đặt", "type": "navigate", "target": "/settings"},
        ],
    },
    {
        "id": "settings",
        "pattern": r"^/settings/?$",
        "title": "Cài đặt",
        "icon": "settings",
        "summary": "Giải thích giao diện, tài khoản, quyền riêng tư và bảo mật.",
        "instructions": "Không thu thập mật khẩu, mã xác thực hoặc khóa bí mật.",
        "suggestions": ["Nên bật cài đặt bảo mật nào?", "Cách đổi giao diện?", "Cách cập nhật thông tin tài khoản?"],
        "actions": [
            {"id": "open_profile", "label": "Xem hồ sơ", "type": "navigate", "target": "/profile"},
        ],
    },
    {
        "id": "home",
        "pattern": r"^/(home)?/?$",
        "title": "Trang chủ",
        "icon": "sparkles",
        "summary": "Định hướng nhanh tới chức năng phù hợp với mục tiêu của người dùng.",
        "instructions": "Hỏi mục tiêu học tập khi yêu cầu còn chung chung.",
        "suggestions": ["Hôm nay tôi nên làm gì?", "Dẫn tôi đi luyện thi", "Khám phá các chức năng của ZUNY"],
        "actions": [
            {"id": "open_exams", "label": "Luyện thi", "type": "navigate", "target": "/exams"},
            {"id": "open_courses", "label": "E-Learning", "type": "navigate", "target": "/e-learning"},
            {"id": "open_forum", "label": "Cộng đồng", "type": "navigate", "target": "/Forum"},
        ],
    },
]


FALLBACK_PAGE = {
    "id": "general",
    "title": "ZUNY",
    "summary": "Hướng dẫn sử dụng nền tảng ZUNY.",
    "instructions": "Chỉ khẳng định chức năng có trong kiến thức được cung cấp.",
    "suggestions": ["Trang này dùng để làm gì?", "Tôi có thể làm gì tiếp theo?"],
    "actions": [],
}


DEFAULT_ACTIONS = [
    {"id": "open_courses", "label": "E-Learning", "type": "navigate", "target": "/e-learning"},
    {"id": "open_exams", "label": "Luyện thi", "type": "navigate", "target": "/exams"},
    {"id": "open_forum", "label": "Cộng đồng", "type": "navigate", "target": "/Forum"},
]


def get_page_profile(path):
    normalized_path = str(path or "/").split("?", 1)[0]
    for profile in PAGE_PROFILES:
        if re.match(profile["pattern"], normalized_path, flags=re.IGNORECASE):
            return profile
    return FALLBACK_PAGE


def filter_actions_for_role(actions, role):
    normalized_role = str(role or "").strip().lower().replace("-", "_")
    return [
        action
        for action in actions
        if not action.get("roles") or normalized_role in action["roles"]
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

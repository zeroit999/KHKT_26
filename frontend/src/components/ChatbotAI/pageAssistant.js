const PAGE_PROFILES = [
  {
    id: 'exam-room',
    match: (path) => /^\/exam\/[^/]+$/i.test(path),
    title: 'Trợ lý Phòng thi',
    eyebrow: 'Chế độ an toàn',
    description: 'Hỗ trợ thao tác và sự cố, không gợi ý đáp án.',
    suggestions: [
      'Tôi gặp sự cố khi làm bài',
      'Cách nộp bài an toàn?',
      'Thoát toàn màn hình bị tính thế nào?',
    ],
    allowVisibleContext: false,
  },
  {
    id: 'exam-result',
    match: (path) => /^\/exam\/[^/]+\/result$/i.test(path),
    title: 'AI phân tích kết quả',
    eyebrow: 'Sau bài thi',
    description: 'Hiểu điểm số và xây kế hoạch cải thiện.',
    suggestions: ['Phân tích kết quả của tôi', 'Tôi nên ôn phần nào?', 'Điểm được tính thế nào?'],
  },
  {
    id: 'exams',
    match: (path) => /^\/exams\/?$/i.test(path),
    title: 'AI cho Kho đề thi',
    eyebrow: 'Đúng trang, đúng việc',
    description: 'Tìm đề, nhập mã và hiểu trạng thái bài thi.',
    suggestions: ['Tìm đề phù hợp cho tôi', 'Trang này có những gì?', 'Tôi nhập mã bài thi ở đâu?'],
  },
  {
    id: 'course-detail',
    match: (path) => /^\/(e-learning|courses|learn)\/[^/]+$/i.test(path),
    title: 'AI đồng hành bài học',
    eyebrow: 'Học thông minh',
    description: 'Tóm tắt cấu trúc và đề xuất cách học.',
    suggestions: ['Tóm tắt trang bài học này', 'Tôi nên học theo thứ tự nào?', 'Gợi ý cách ghi nhớ'],
  },
  {
    id: 'courses',
    match: (path) => /^\/(e-learning|courses)\/?$/i.test(path),
    title: 'AI cho E-Learning',
    eyebrow: 'Chọn đúng bài học',
    description: 'Tìm khóa học và chọn nội dung nên học tiếp.',
    suggestions: ['Tôi nên học khóa nào trước?', 'Tìm khóa học Toán', 'Giải thích tiến độ học tập'],
  },
  {
    id: 'forum',
    match: (path) => /^\/forum\/?$/i.test(path),
    title: 'AI cho Cộng đồng',
    eyebrow: 'Hỏi hay, đáp chất',
    description: 'Tìm thảo luận và giúp soạn câu hỏi rõ ràng.',
    suggestions: ['Giúp tôi viết câu hỏi rõ ràng', 'Tìm thảo luận liên quan', 'Cách đăng bài mới?'],
  },
  {
    id: 'classes',
    match: (path) => /^\/classes\/?$/i.test(path),
    title: 'AI quản lý lớp',
    eyebrow: 'Dành cho giáo viên',
    description: 'Hỗ trợ lớp, học sinh, môn học và bảng điểm.',
    suggestions: ['Cách thêm học sinh?', 'Tìm học sinh trong lớp', 'Giải thích bảng điểm'],
  },
  {
    id: 'profile',
    match: (path) => /^\/profile\/?$/i.test(path),
    title: 'AI kiểm tra hồ sơ',
    eyebrow: 'Thông tin cá nhân',
    description: 'Giải thích và hoàn thiện hồ sơ ZUNY.',
    suggestions: ['Hồ sơ còn thiếu gì?', 'Cách đổi ảnh đại diện?', 'Thông tin nào ảnh hưởng bài thi?'],
  },
  {
    id: 'settings',
    match: (path) => /^\/settings\/?$/i.test(path),
    title: 'AI cho Cài đặt',
    eyebrow: 'An toàn & cá nhân hóa',
    description: 'Hỗ trợ giao diện, tài khoản và bảo mật.',
    suggestions: ['Nên bật bảo mật nào?', 'Cách đổi giao diện?', 'Cách cập nhật tài khoản?'],
  },
  {
    id: 'home',
    match: (path) => /^\/(home)?\/?$/i.test(path),
    title: 'ZUNY AI',
    eyebrow: 'Trợ lý toàn nền tảng',
    description: 'Biến mục tiêu của Bạn thành bước tiếp theo.',
    suggestions: ['Hôm nay tôi nên làm gì?', 'Dẫn tôi đi luyện thi', 'Khám phá chức năng ZUNY'],
  },
]

const FALLBACK_PROFILE = {
  id: 'general',
  title: 'ZUNY AI',
  eyebrow: 'Trợ lý theo ngữ cảnh',
  description: 'Tôi hiểu trang hiện tại và hướng dẫn bước tiếp theo.',
  suggestions: ['Trang này dùng để làm gì?', 'Tôi có thể làm gì tiếp theo?'],
}

const ACTION_SELECTORS = {
  focus_exam_search: [
    'input[placeholder="Tìm kiếm đề thi..."]',
    'input[placeholder="Tìm kiếm đề thi theo tên hoặc môn học..."]',
  ],
  focus_exam_code: ['input[placeholder="Mã bài thi"]'],
  focus_course_search: ['input[placeholder="Tìm kiếm bài học, chủ đề, môn học, mã bài..."]'],
  focus_forum_search: ['input[placeholder="Tìm kiếm bài viết, câu hỏi, tài liệu..."]'],
  focus_class_search: ['input[placeholder="Tìm kiếm học sinh..."]'],
  open_create_exam: ['[data-zuny-ai-action="create-exam"]'],
  open_create_post: ['[data-zuny-ai-action="create-post"]'],
}

export function getPageAssistantProfile(pathname) {
  return PAGE_PROFILES.find((profile) => profile.match(pathname)) || FALLBACK_PROFILE
}

export function normalizeAssistantRole(role) {
  return String(role || 'guest').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function collectUniqueText(selector, limit) {
  const values = []
  const seen = new Set()

  for (const element of document.querySelectorAll(selector)) {
    const value = String(element.innerText || element.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 140)

    if (!value || seen.has(value)) continue
    seen.add(value)
    values.push(value)
    if (values.length >= limit) break
  }

  return values
}

export function collectSafePageContext(profile) {
  if (profile.allowVisibleContext === false) {
    return { headings: [], controls: [], stats: [] }
  }

  return {
    headings: collectUniqueText('main h1, main h2, main h3', 10),
    controls: collectUniqueText('main button, main a[href]', 10),
    stats: collectUniqueText('[data-zuny-ai-stat]', 8),
  }
}

function findActionElement(command) {
  const selectors = ACTION_SELECTORS[command] || []
  for (const selector of selectors) {
    const element = document.querySelector(selector)
    if (element) return element
  }
  return null
}

export function executeSafePageAction(command) {
  if (!Object.hasOwn(ACTION_SELECTORS, command)) {
    return { success: false, message: 'Hành động này chưa được cho phép trên trang.' }
  }

  const element = findActionElement(command)
  if (!element) {
    return { success: false, message: 'Tôi chưa tìm thấy khu vực phù hợp trên giao diện hiện tại.' }
  }

  element.scrollIntoView({ behavior: 'smooth', block: 'center' })

  if (element.matches('input, textarea, [contenteditable="true"]')) {
    element.focus()
    element.animate(
      [
        { boxShadow: '0 0 0 0 rgba(6, 182, 212, 0)' },
        { boxShadow: '0 0 0 5px rgba(6, 182, 212, 0.3)' },
        { boxShadow: '0 0 0 0 rgba(6, 182, 212, 0)' },
      ],
      { duration: 1100 },
    )
    return { success: true, message: 'Tôi đã đưa Bạn tới đúng ô cần nhập.' }
  }

  element.click()
  return { success: true, message: 'Tôi đã mở chức năng này cho Bạn.' }
}

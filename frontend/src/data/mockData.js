import {
  Atom,
  BookOpenCheck,
  BrainCircuit,
  Calculator,
  Code2,
  FlaskConical,
  Globe2,
  GraduationCap,
  Landmark,
  Languages,
  PenTool,
  Sigma,
} from 'lucide-react'

export const subjects = [
  {
    name: 'Toán học',
    icon: Calculator,
    exams: 48,
    color: 'from-cyan-400 to-blue-500',
    progress: 72,
  },
  {
    name: 'Vật lý',
    icon: Atom,
    exams: 36,
    color: 'from-sky-400 to-indigo-500',
    progress: 61,
  },
  {
    name: 'Hóa học',
    icon: FlaskConical,
    exams: 31,
    color: 'from-emerald-400 to-cyan-500',
    progress: 58,
  },
  {
    name: 'Sinh học',
    icon: BrainCircuit,
    exams: 28,
    color: 'from-teal-300 to-blue-500',
    progress: 66,
  },
  {
    name: 'Tiếng Anh',
    icon: Languages,
    exams: 42,
    color: 'from-blue-400 to-violet-500',
    progress: 79,
  },
  {
    name: 'Ngữ văn',
    icon: PenTool,
    exams: 24,
    color: 'from-amber-300 to-sky-500',
    progress: 54,
  },
]

export const exams = [
  {
    id: 'toan-12-01',
    title: 'Đề mô phỏng THPT Quốc gia - Toán',
    subject: 'Toán học',
    duration: 90,
    questions: 50,
    level: 'Nâng cao',
    attempts: 12480,
    completion: 68,
    tag: 'CBT chuẩn',
    accent: 'from-cyan-400 to-blue-600',
  },
  {
    id: 'anh-12-02',
    title: 'Luyện thi Tiếng Anh tổng hợp',
    subject: 'Tiếng Anh',
    duration: 60,
    questions: 45,
    level: 'Trung bình',
    attempts: 9320,
    completion: 74,
    tag: 'Reading + Grammar',
    accent: 'from-blue-400 to-indigo-600',
  },
  {
    id: 'ly-12-03',
    title: 'Vật lý 12 - Dao động và sóng',
    subject: 'Vật lý',
    duration: 50,
    questions: 40,
    level: 'Khó',
    attempts: 6870,
    completion: 59,
    tag: 'Tính giờ thật',
    accent: 'from-sky-400 to-cyan-600',
  },
]

export const questions = [
  {
    id: 1,
    subject: 'Toán học',
    question: 'Cho hàm số f(x) = x² - 4x + 3. Giá trị nhỏ nhất của f(x) trên R là bao nhiêu?',
    options: ['-1', '0', '1', '3'],
    answer: 0,
    explanation: 'Hoàn thành bình phương: f(x) = (x - 2)² - 1, nên giá trị nhỏ nhất là -1.',
  },
  {
    id: 2,
    subject: 'Toán học',
    question: 'Nghiệm của phương trình log₂(x - 1) = 3 là:',
    options: ['7', '8', '9', '10'],
    answer: 2,
    explanation: 'x - 1 = 2³ = 8, do đó x = 9.',
  },
  {
    id: 3,
    subject: 'Vật lý',
    question: 'Trong dao động điều hòa, đại lượng nào luôn ngược pha với li độ?',
    options: ['Vận tốc', 'Gia tốc', 'Pha ban đầu', 'Chu kỳ'],
    answer: 1,
    explanation: 'Gia tốc a = -ω²x nên luôn ngược pha với li độ.',
  },
  {
    id: 4,
    subject: 'Hóa học',
    question: 'Dung dịch nào sau đây có pH nhỏ hơn 7?',
    options: ['NaCl', 'HCl', 'NaOH', 'K₂SO₄'],
    answer: 1,
    explanation: 'HCl là axit mạnh nên dung dịch có pH nhỏ hơn 7.',
  },
  {
    id: 5,
    subject: 'Tiếng Anh',
    question: 'Choose the word closest in meaning to "significant".',
    options: ['Minor', 'Important', 'Late', 'Simple'],
    answer: 1,
    explanation: '"Significant" means important or meaningful.',
  },
  {
    id: 6,
    subject: 'Sinh học',
    question: 'Đơn phân cấu tạo nên protein là:',
    options: ['Axit amin', 'Glucose', 'Nucleotide', 'Axit béo'],
    answer: 0,
    explanation: 'Protein được cấu tạo từ các đơn phân là axit amin.',
  },
]

export const dashboardStats = [
  { label: 'Điểm trung bình', value: '8.4', change: '+0.6 tuần này', icon: Sigma },
  { label: 'Learning streak', value: '12 ngày', change: 'Kỷ lục cá nhân', icon: BookOpenCheck },
  { label: 'Bài thi hoàn thành', value: '34', change: '+5 bài mới', icon: GraduationCap },
  { label: 'Xếp hạng hiện tại', value: '#128', change: 'Top 8% toàn hệ thống', icon: Globe2 },
]

export const progressData = [
  { name: 'T2', score: 6.8, time: 42 },
  { name: 'T3', score: 7.2, time: 54 },
  { name: 'T4', score: 7.5, time: 49 },
  { name: 'T5', score: 8.1, time: 68 },
  { name: 'T6', score: 8.4, time: 72 },
  { name: 'T7', score: 8.2, time: 61 },
  { name: 'CN', score: 8.8, time: 79 },
]

export const resultBreakdown = [
  { name: 'Đúng', value: 42, color: '#22d3ee' },
  { name: 'Sai', value: 6, color: '#f97316' },
  { name: 'Bỏ trống', value: 2, color: '#94a3b8' },
]

export const skillRadar = [
  { skill: 'Đại số', value: 82 },
  { skill: 'Hình học', value: 74 },
  { skill: 'Đọc hiểu', value: 88 },
  { skill: 'Tốc độ', value: 79 },
  { skill: 'Tư duy', value: 91 },
]

export const leaderboardRows = [
  { rank: 1, name: 'Nguyễn Minh Anh', school: 'THPT Chuyên Hà Nội', score: 9850, streak: 28 },
  { rank: 2, name: 'Trần Hoàng Nam', school: 'THPT Gia Định', score: 9620, streak: 24 },
  { rank: 3, name: 'Lê Bảo Châu', school: 'THPT Phan Bội Châu', score: 9510, streak: 21 },
  { rank: 4, name: 'Phạm Đức Huy', school: 'THPT Nguyễn Huệ', score: 9360, streak: 19 },
  { rank: 5, name: 'Vũ Khánh Linh', school: 'THPT Lê Hồng Phong', score: 9180, streak: 16 },
]

export const adminQuestions = [
  { id: 'Q-1024', subject: 'Toán học', title: 'Hàm số bậc hai', level: 'Trung bình', status: 'Đã duyệt' },
  { id: 'Q-1025', subject: 'Vật lý', title: 'Dao động cơ', level: 'Khó', status: 'Cần xem' },
  { id: 'Q-1026', subject: 'Hóa học', title: 'Este và chất béo', level: 'Dễ', status: 'Đã duyệt' },
  { id: 'Q-1027', subject: 'Tiếng Anh', title: 'Reading comprehension', level: 'Khó', status: 'Nháp' },
  { id: 'Q-1028', subject: 'Sinh học', title: 'Di truyền học', level: 'Trung bình', status: 'Đã duyệt' },
]

export const featureCards = [
  {
    title: 'Thi CBT mô phỏng thật',
    description: 'Timer, câu hỏi đánh dấu, thanh tiến độ và màn hình nộp bài theo chuẩn phòng thi online.',
    icon: Code2,
  },
  {
    title: 'Phân tích năng lực AI',
    description: 'Bảng phân tích mô phỏng giúp học sinh thấy điểm mạnh, điểm yếu và hướng ôn tập tiếp theo.',
    icon: BrainCircuit,
  },
  {
    title: 'Lộ trình học tập rõ ràng',
    description: 'Dashboard trực quan theo dõi streak, tiến độ, điểm trung bình và hoạt động gần đây.',
    icon: Landmark,
  },
]

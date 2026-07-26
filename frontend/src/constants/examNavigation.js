import {
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  ClipboardCheck,
  FileClock,
  FilePenLine,
  Files,
  GraduationCap,
  LayoutDashboard,
  LibraryBig,
  ListChecks,
  NotebookTabs,
  Save,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';

const item = (id, label, icon, options = {}) => ({
  id,
  label,
  icon,
  path: options.path || null,
  disabled: options.disabled ?? !options.path,
  badge: options.badge || null,
});

export const studentExamNavigation = [
  item('dashboard', 'Tổng quan', LayoutDashboard, { path: '/exams' }),
  item('library', 'Kho đề thi', LibraryBig, { path: '/exams/library' }),
  item('in-progress', 'Đang làm', FileClock),
  item('saved', 'Đề đã lưu', Save),
  item('calendar', 'Lịch thi', CalendarDays),
  item('results', 'Kết quả', ClipboardCheck),
  item('analysis', 'Phân tích học tập', BarChart3),
];

export const teacherExamNavigation = [
  item('dashboard', 'Tổng quan', LayoutDashboard, { path: '/exams' }),
  item('manage', 'Quản lý đề thi', Files, { path: '/exams/library' }),
  item('create', 'Tạo đề thi', FilePenLine, { path: '/exams/create' }),
  item('question-bank', 'Ngân hàng câu hỏi', NotebookTabs, {
    path: '/exams/question-bank',
  }),
  item('submissions', 'Bài làm học sinh', ListChecks, {
    path: '/exams/submissions',
  }),
  item('essay-grading', 'Chấm tự luận', BookOpenCheck, {
    path: '/exams/essay-grading',
  }),
  item('analytics', 'Thống kê', BarChart3),
];

export const adminExamNavigation = [
  item('dashboard', 'Tổng quan', LayoutDashboard, { path: '/exams' }),
  item('manage', 'Quản lý đề thi', Files, { path: '/exams/library' }),
  item('question-bank', 'Ngân hàng câu hỏi', GraduationCap, {
    path: '/exams/question-bank',
  }),
  item('submissions', 'Quản lý bài làm', ListChecks, {
    path: '/exams/submissions',
  }),
  item('users', 'Người dùng', UsersRound),
  item('analytics', 'Thống kê hệ thống', BarChart3),
  item('system', 'Kiểm soát hệ thống', ShieldCheck),
];

export const getExamNavigationByRole = (role = '') => {
  const normalizedRole = String(role)
    .trim()
    .replace(/[\s_-]/g, '')
    .toUpperCase();

  if (normalizedRole === 'ADMINDEV') return adminExamNavigation;
  if (normalizedRole === 'TEACHER') return teacherExamNavigation;
  return studentExamNavigation;
};

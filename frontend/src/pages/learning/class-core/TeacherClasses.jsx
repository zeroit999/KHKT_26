import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import eLearningApi from '../../../services/eLearningApi.js';
import classroomApi from '../../../services/classroomApi.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { getUserAvatar } from '../../../utils/userAvatar.js';
import {
  DataUnavailable,
  OverviewStat,
  ProgressRow,
  StatCard,
} from '../class-ui/ClassWidgets.jsx';
import styles from './classStyles.js';
import useExamsPage from '../../../hooks/exam/useExamsPage.js';
import CreateExamModal from '../../../components/exam/CreateExamModal.jsx';
import { CourseFormModal } from '../../e-learning/e-learning/components/CourseComponents.jsx';
import { courseTextLimits } from '../../e-learning/e-learning/constants/courseConstants.js';
import {
  countWords as countELearningWords,
  formatRelativeDate as formatELearningRelativeDate,
  formatVideoDuration as formatELearningDuration,
  formatViews as formatELearningViews,
  generateLibraryCourseCode as generateELearningCourseCode,
  getCourseFormat as getELearningCourseFormat,
  getCourseFormatLabel as getELearningCourseFormatLabel,
  getEmptyForm as getELearningEmptyForm,
  getMp4DurationFromFile as getELearningMp4DurationFromFile,
  getOpenAtMs as getELearningOpenAtMs,
  getVideoDuration as getELearningVideoDuration,
  normalizeChecklist as normalizeELearningChecklist,
  normalizeQuiz as normalizeELearningQuiz,
  normalizeTextList as normalizeELearningTextList,
  stripHtml as stripELearningHtml,
} from "../../e-learning/e-learning/utils/courseUtils.js";

function getSchoolYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function getSemester(date = new Date()) {
  const month = date.getMonth() + 1;
  return month >= 1 && month <= 5 ? 'II' : 'I';
}

const MAX_CLASS_IMAGE_SIZE = 900 * 1024;

const DEFAULT_SCHEDULE_BREAKS = [
  { id: 'lunch-break', afterPeriod: 4, label: 'Giờ trưa', startTime: '10:15', endTime: '13:00', kind: 'lunch' },
];

const DEFAULT_SCHEDULE_TIME_SLOTS = [
  { id: 'morning-1', session: 'morning', period: 1, startTime: '07:00', endTime: '07:45' },
  { id: 'morning-2', session: 'morning', period: 2, startTime: '07:50', endTime: '08:35' },
  { id: 'morning-3', session: 'morning', period: 3, startTime: '08:40', endTime: '09:25' },
  { id: 'morning-4', session: 'morning', period: 4, startTime: '09:30', endTime: '10:15' },
  { id: 'afternoon-1', session: 'afternoon', period: 5, startTime: '13:00', endTime: '13:45' },
  { id: 'afternoon-2', session: 'afternoon', period: 6, startTime: '13:50', endTime: '14:35' },
  { id: 'afternoon-3', session: 'afternoon', period: 7, startTime: '14:40', endTime: '15:25' },
  { id: 'afternoon-4', session: 'afternoon', period: 8, startTime: '15:30', endTime: '16:15' },
];

const CLASS_WORKSPACE_SECTIONS = [
  {
    id: 'main',
    label: 'Ngăn chính',
    items: [
      { id: 'overview', label: 'Tổng quan', icon: '▦' },
      { id: 'students', label: 'Danh sách lớp', icon: '♟' },
      { id: 'attendance', label: 'Điểm danh', icon: '✓' },
      { id: 'assignments', label: 'Đề thi', icon: '▤' },
      { id: 'resources', label: 'Học liệu', icon: '▱' },
      { id: 'scores', label: 'Đánh giá', icon: '★' },
    ],
  },
  {
    id: 'secondary',
    label: 'Ngăn phụ',
    items: [
      { id: 'schedule', label: 'Lịch dạy', icon: '▦' },
      { id: 'notifications', label: 'Thông báo', icon: '♢' },
      { id: 'messages', label: 'Trao đổi', icon: '☵' },
    ],
  },
];

const CLASS_WORKSPACE_ITEMS = [
  { id: 'home', label: 'Trang chủ', icon: '⌂' },
  ...CLASS_WORKSPACE_SECTIONS.flatMap((section) => section.items),
];

const CLASS_THEME_COLORS = [
  { id: 'blue', value: '#2563eb', label: 'Xanh dương' },
  { id: 'green', value: '#16a34a', label: 'Xanh lá' },
  { id: 'red', value: '#dc2626', label: 'Đỏ' },
  { id: 'orange', value: '#ea580c', label: 'Cam' },
  { id: 'sky', value: '#0ea5e9', label: 'Xanh dương nhạt' },
  { id: 'purple', value: '#7c3aed', label: 'Tím' },
  { id: 'black', value: '#111827', label: 'Đen' },
  { id: 'gold', value: '#ca8a04', label: 'Vàng đậm' },
  { id: 'pink', value: '#ff03f2', label: 'Hồng' },
  { id: 'dark green', value: '#008915', label: 'Lục' },
  { id: 'teal', value: '#0d9488', label: 'Xanh ngọc' },
  { id: 'cyan', value: '#06b6d4', label: 'Xanh Cyan' },
  { id: 'indigo', value: '#4f46e5', label: 'Xanh chàm' },
  { id: 'rose', value: '#e11d48', label: 'Hồng đỏ' },
  { id: 'yellow', value: '#eab308', label: 'Vàng' },
  { id: 'lime', value: '#65a30d', label: 'Xanh chanh' },
  { id: 'brown', value: '#92400e', label: 'Nâu' },
  { id: 'gray', value: '#64748b', label: 'Xám' },
];

const CLASS_COVER_CATEGORY_DEFINITIONS = [
  {
    id: 'animals',
    category: 'Động vật',
    icon: '🐾',
    description: 'Thế giới động vật',
    photos: [
      ['Cáo trong rừng', 'https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=1600&q=82', 'linear-gradient(135deg,rgba(15,23,42,.12),rgba(15,23,42,.06)), url("https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=1200&q=80")'],
      ['Chim giữa thiên nhiên', 'https://images.unsplash.com/photo-1444464666168-49d633b86797?auto=format&fit=crop&w=1600&q=82', 'linear-gradient(135deg,rgba(15,23,42,.10),rgba(15,23,42,.04)), url("https://images.unsplash.com/photo-1444464666168-49d633b86797?auto=format&fit=crop&w=1200&q=80")'],
      ['Mèo thư giãn', 'https://images.unsplash.com/photo-1504208434309-cb69f4fe52b0?auto=format&fit=crop&w=1600&q=82'],
      ['Chó ngoài trời', 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1600&q=82'],
      ['Chó đồng hành', 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?auto=format&fit=crop&w=1600&q=82'],
      ['Cún nhỏ', 'https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=1600&q=82'],
      ['Mèo trong nhà', 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&w=1600&q=82'],
      ['Hươu giữa rừng', 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=crop&w=1600&q=82'],
      ['Sư tử hoang dã', 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?auto=format&fit=crop&w=1600&q=82'],
      ['Động vật hoang dã', 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1600&q=82'],
    ],
  },
  {
    id: 'sports',
    category: 'Thể thao',
    icon: '🏅',
    description: 'Năng lượng và vận động',
    photos: [
      ['Chạy bộ', 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1600&q=82'],
      ['Vận động viên', 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1600&q=82'],
      ['Bóng đá', 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1600&q=82'],
      ['Bóng rổ', 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1600&q=82'],
      ['Tập luyện', 'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=1600&q=82'],
      ['Phòng tập', 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1600&q=82'],
      ['Đường chạy', 'https://images.unsplash.com/photo-1483721310020-03333e577078?auto=format&fit=crop&w=1600&q=82'],
      ['Đạp xe', 'https://images.unsplash.com/photo-1504450758481-7338eba7524a?auto=format&fit=crop&w=1600&q=82'],
      ['Sân vận động', 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1600&q=82'],
      ['Bơi lội', 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1600&q=82'],
    ],
  },
  {
    id: 'nature',
    category: 'Thiên nhiên',
    icon: '🌿',
    description: 'Rừng, núi và cảnh quan',
    photos: [
      ['Rừng xanh', 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1600&q=82', 'linear-gradient(135deg,rgba(22,101,52,.18),rgba(15,23,42,.04)), url("https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80")'],
      ['Núi và hồ', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=82', 'linear-gradient(135deg,rgba(30,64,175,.12),rgba(15,23,42,.04)), url("https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80")'],
      ['Hồ giữa núi', 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1600&q=82'],
      ['Thung lũng xanh', 'https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=1600&q=82'],
      ['Dãy núi', 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=82'],
      ['Rừng sương', 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=82'],
      ['Đồi xanh', 'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1600&q=82'],
      ['Cảnh quan yên bình', 'https://images.unsplash.com/photo-1439853949127-fa647821eba0?auto=format&fit=crop&w=1600&q=82'],
      ['Núi hùng vĩ', 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=82'],
      ['Thiên nhiên rộng lớn', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=82'],
    ],
  },
  {
    id: 'sea',
    category: 'Biển cả',
    icon: '🌊',
    description: 'Đại dương và bờ biển',
    photos: [
      ['Biển xanh', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=82', 'linear-gradient(135deg,rgba(14,165,233,.16),rgba(15,23,42,.04)), url("https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80")'],
      ['Bờ biển', 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=1600&q=82', 'linear-gradient(135deg,rgba(14,116,144,.12),rgba(15,23,42,.04)), url("https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=1200&q=80")'],
      ['Sóng biển', 'https://images.unsplash.com/photo-1484291470158-b8f8d608850d?auto=format&fit=crop&w=1600&q=82'],
      ['Mặt biển trong', 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=1600&q=82'],
      ['Đường bờ biển', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1600&q=82'],
      ['Biển lúc hoàng hôn', 'https://images.unsplash.com/photo-1455729552865-3658a5d39692?auto=format&fit=crop&w=1600&q=82'],
      ['Nước biển xanh ngọc', 'https://images.unsplash.com/photo-1471922694854-ff1b63b20054?auto=format&fit=crop&w=1600&q=82'],
      ['Bãi biển nhiệt đới', 'https://images.unsplash.com/photo-1530053969600-caed2596d242?auto=format&fit=crop&w=1600&q=82'],
      ['Biển và đá', 'https://images.unsplash.com/photo-1498623116890-37e912163d5d?auto=format&fit=crop&w=1600&q=82'],
      ['Đại dương', 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=82'],
    ],
  },
  {
    id: 'sky',
    category: 'Bầu trời',
    icon: '☁️',
    description: 'Mây, bình minh và hoàng hôn',
    photos: [
      ['Mây sáng', 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1600&q=82'],
      ['Bầu trời trong', 'https://images.unsplash.com/photo-1499346030926-9a72daac6c63?auto=format&fit=crop&w=1600&q=82'],
      ['Chân trời', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=82'],
      ['Mây trên núi', 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1600&q=82'],
      ['Bình minh', 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=1600&q=82'],
      ['Trời cao', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=82'],
      ['Mây chiều', 'https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?auto=format&fit=crop&w=1600&q=82'],
      ['Bầu trời dịu', 'https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?auto=format&fit=crop&w=1600&q=82'],
      ['Ánh sáng qua mây', 'https://images.unsplash.com/photo-1494548162494-384bba4ab999?auto=format&fit=crop&w=1600&q=82'],
      ['Hoàng hôn', 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=1600&q=82'],
    ],
  },
  {
    id: 'still',
    category: 'Ảnh tĩnh',
    icon: '🎨',
    description: 'Nền tối giản, nhẹ mắt',
    photos: [
      ['Xanh dịu', '', 'linear-gradient(135deg,#dbeafe,#eff6ff)'],
      ['Tím dịu', '', 'linear-gradient(135deg,#ede9fe,#faf5ff)'],
      ['Cam ấm', '', 'linear-gradient(135deg,#ffedd5 0%,#fff7ed 52%,#fed7aa 100%)'],
      ['Xanh lá nhạt', '', 'linear-gradient(135deg,#dcfce7 0%,#f0fdf4 50%,#bbf7d0 100%)'],
      ['Hồng pastel', '', 'linear-gradient(135deg,#fce7f3 0%,#fff1f2 52%,#fbcfe8 100%)'],
      ['Xanh ngọc', '', 'linear-gradient(135deg,#ccfbf1 0%,#f0fdfa 48%,#99f6e4 100%)'],
      ['Bầu trời pastel', '', 'linear-gradient(135deg,#e0f2fe 0%,#f0f9ff 45%,#bae6fd 100%)'],
      ['Xám hiện đại', '', 'linear-gradient(135deg,#e2e8f0 0%,#f8fafc 52%,#cbd5e1 100%)'],
      ['Đêm xanh', '', 'linear-gradient(135deg,#0f172a 0%,#1e3a8a 52%,#312e81 100%)'],
      ['Hoàng hôn tối giản', '', 'linear-gradient(135deg,#f97316 0%,#fb7185 48%,#7c3aed 100%)'],
    ],
  },
  {
    id: 'study',
    category: 'Học tập',
    icon: '📚',
    description: 'Sách, lớp học và tri thức',
    photos: [
      ['Lớp học', 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1600&q=82'],
      ['Giảng đường', 'https://images.unsplash.com/photo-1703680968885-22659eb00165?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8bGVjdHVyZSUyMGhhbGx8ZW58MHx8MHx8fDA%3D'],
      ['Thư viện', 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1600&q=82'],
      ['Học nhóm', 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1600&q=82'],
      ['Sách và ghi chú', 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1600&q=82'],
      ['Không gian học tập', 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1600&q=82'],
      ['Học cùng máy tính', 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=82'],
      ['Đọc sách', 'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=1600&q=82'],
      ['Bàn học', 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1600&q=82'],
      ['Tri thức', 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1600&q=82'],
    ],
  },
];

const CLASS_COVER_CATEGORIES = CLASS_COVER_CATEGORY_DEFINITIONS.map(({ id, category, icon, description }) => ({
  id,
  category,
  icon,
  description,
}));

const CLASS_COVER_PRESETS = CLASS_COVER_CATEGORY_DEFINITIONS.flatMap((group) =>
  group.photos.map(([label, imageUrl, customValue], index) => ({
    id: `${group.id}-${index + 1}`,
    category: group.category,
    label,
    value: customValue || `linear-gradient(135deg,rgba(15,23,42,.14),rgba(15,23,42,.04)), url("${imageUrl}")`,
  })),
);

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizeUserId(value) {
  return String(
    value ?? ''
  ).trim();
}

function getCurrentSqlUserId(user) {
  return normalizeUserId(
    user?.uid ??
    user?.id ??
    user?.user_id ??
    user?.userId ??
    ''
  );
}

function sameUserId(left, right) {
  const normalizedLeft = normalizeUserId(left);
  const normalizedRight = normalizeUserId(right);
  return Boolean(
    normalizedLeft &&
    normalizedRight &&
    normalizedLeft === normalizedRight
  );
}

function userIdListIncludes(values, userId) {
  if (!Array.isArray(values)) return false;
  return values.some((value) => sameUserId(value, userId));
}

function getR2StoragePath(attachment = {}) {
  const directPath = String(
    attachment?.storagePath ||
    attachment?.objectKey ||
    attachment?.key ||
    attachment?.path ||
    ''
  ).trim();

  if (directPath) return directPath.replace(/^\/+/, '');

  const attachmentUrl = String(attachment?.url || '').trim();
  if (!attachmentUrl || typeof URL === 'undefined') return '';

  try {
    const parsedUrl = new URL(attachmentUrl);
    if (parsedUrl.hostname !== 'storage.zunylearn.com') return '';
    return decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''));
  } catch {
    return '';
  }
}

function resizeChatTextarea(element, maxHeight = 140) {
  if (!element) return;
  element.style.height = 'auto';
  const nextHeight = Math.min(element.scrollHeight, maxHeight);
  element.style.height = `${Math.max(40, nextHeight)}px`;
  element.style.overflowY = element.scrollHeight > maxHeight ? 'auto' : 'hidden';
}

function getInitial(name = '') {
  const words = name.trim().split(/\s+/);
  return (words[words.length - 1] || name || '?').charAt(0).toUpperCase();
}

function getStudentDisplayName(student = {}) {
  return (
    student.name ||
    student.displayName ||
    student.email?.split('@')?.[0] ||
    'Chờ học sinh tham gia'
  );
}

function getStudentAvatar(student = {}) {
  return getUserAvatar(student);
}

function escapeExcelXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseDelimitedText(text) {
  const normalized = String(text || '').replace(/^\uFEFF/, '');
  const delimiter = normalized.split('\n')[0]?.includes(';') ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === '"') {
      if (quoted && next === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim()); cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== '')) rows.push(row);
      row = []; cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

function normalizeExcelHeader(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
}

function getTimeValue(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getMemberRole(member = {}) {
  if (!member || typeof member !== 'object') return '';
  return normalizeText(member.role || member.userRole || member.memberRole || member.accountRole);
}

function isTeacherMember(member = {}) {
  if (!member || typeof member !== 'object') return false;
  const role = getMemberRole(member);
  return ['teacher', 'giáo viên', 'giao vien', 'admin_teacher', 'homeroom_teacher'].includes(role);
}

function createAttendanceQrToken() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 16)}`;
}

function sortStudentsByJoinTime(studentList = []) {
  return [...studentList].sort((a, b) => {
    const timeDiff = getTimeValue(a.createdAt) - getTimeValue(b.createdAt);
    if (timeDiff !== 0) return timeDiff;
    return normalizeText(a.email).localeCompare(normalizeText(b.email));
  });
}

function getAutoStudentCode(index) {
  return `HS${String(index + 1).padStart(3, '0')}`;
}

function getStudentCode(student = {}, index = 0) {
  return student.studentCode || student.code || getAutoStudentCode(index);
}

function toNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatScore(value) {
  const number = toNumber(value);
  return number === null ? '-' : number.toFixed(1);
}

function averageFromScores(scores = []) {
  const validScores = scores.map(toNumber).filter((score) => score !== null);
  if (!validScores.length) return null;
  return (
    validScores.reduce((sum, score) => sum + score, 0) / validScores.length
  );
}

const emptyStudentRow = () => ({
  email: '',
});

function getTeacherSubject(userDetails = {}) {
  return (
    userDetails?.subject ||
    userDetails?.specializedSubject ||
    userDetails?.major ||
    userDetails?.teachingSubject ||
    userDetails?.department ||
    'Môn học'
  );
}

function getClassCover(index = 0) {
  const covers = [
    'linear-gradient(135deg, rgba(114,166,128,.75), rgba(255,255,255,.2)), url("https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=600&q=80")',
    'linear-gradient(135deg, rgba(37,99,235,.35), rgba(255,255,255,.08)), url("https://images.unsplash.com/photo-1517976487492-5750f3195933?auto=format&fit=crop&w=600&q=80")',
    'linear-gradient(135deg, rgba(245,158,11,.28), rgba(255,255,255,.08)), url("https://images.unsplash.com/photo-1539650116574-8efeb43e2750?auto=format&fit=crop&w=600&q=80")',
    'linear-gradient(135deg, rgba(15,23,42,.35), rgba(255,255,255,.08)), url("https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=600&q=80")',
    'linear-gradient(135deg, rgba(234,179,8,.25), rgba(255,255,255,.12)), url("https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=600&q=80")',
  ];

  return covers[index % covers.length];
}

function getClassCoverStyle(classItem, index = 0) {
  const cover =
    classItem?.coverPhotoUrl ||
    classItem?.coverUrl ||
    classItem?.coverPhoto ||
    '';
  if (!cover) return getClassCover(index);
  if (cover.includes('gradient(') || cover.trim().startsWith('url('))
    return cover;
  return `url("${cover}")`;
}

function getTeacherSchool(userDetails = {}) {
  return (
    userDetails?.school ||
    userDetails?.schoolName ||
    userDetails?.organizationName ||
    userDetails?.organization ||
    ''
  );
}


function getRecordDateValue(item = {}) {
  return getTimeValue(
    item.date || item.attendanceDate || item.sessionDate || item.day || item.startAt || item.createdAt
  );
}

function getAttendanceStatus(item = {}) {
  return normalizeText(item.status || item.attendanceStatus || item.state || item.result);
}

function isPresentStatus(status = '') {
  return ['present', 'có mặt', 'co mat', 'late', 'đi muộn', 'di muon'].includes(status);
}

function isAbsentStatus(status = '') {
  return ['absent', 'vắng', 'vang', 'excused', 'vắng có phép', 'vang co phep', 'unexcused', 'vắng không phép', 'vang khong phep'].includes(status);
}

function getAssignmentDueValue(item = {}) {
  return getTimeValue(item.dueAt || item.endAt || item.deadline || item.closeAt);
}

function isAssignmentClosed(item = {}) {
  const status = normalizeText(item.status || item.state);
  return ['closed', 'đã đóng', 'da dong', 'completed', 'archived'].includes(status) || Boolean(item.closedAt);
}

function isAssignmentDraft(item = {}) {
  const status = normalizeText(item.status || item.state);
  return ['draft', 'nháp', 'nhap'].includes(status);
}

function getAssignmentTitle(item = {}) {
  return item.title || item.name || item.lessonName || 'Bài tập';
}

function formatClock(value) {
  if (!value) return '';
  const millis = getTimeValue(value);
  if (millis) return new Date(millis).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return String(value);
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeAttendanceStatus(value = '') {
  const status = normalizeText(value);
  if (['present', 'có mặt', 'co mat'].includes(status)) return 'present';
  if (['late', 'trễ', 'tre', 'đi muộn', 'di muon'].includes(status)) return 'late';
  if (['excused', 'vắng phép', 'vang phep', 'vắng có phép', 'vang co phep'].includes(status)) return 'excused';
  if (['absent', 'vắng', 'vang', 'unexcused', 'vắng kp', 'vang kp', 'vắng không phép', 'vang khong phep'].includes(status)) return 'absent';
  return '';
}

function getAttendanceStatusLabel(value = '') {
  const status = normalizeAttendanceStatus(value);
  if (status === 'present') return 'Có mặt';
  if (status === 'late') return 'Trễ';
  if (status === 'excused') return 'Vắng phép';
  if (status === 'absent') return 'Vắng không phép';
  return 'Chưa đánh dấu';
}


function getMondayStart(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const day = value.getDay();
  value.setDate(value.getDate() + (day === 0 ? -6 : 1 - day));
  return value;
}

function addDays(date, amount) {
  const value = new Date(date);
  value.setDate(value.getDate() + amount);
  return value;
}

function getScheduleWeekKey(date = new Date()) {
  return getLocalDateKey(getMondayStart(date));
}

function getScheduleDateFromItem(item = {}) {
  const direct = item.date || item.sessionDate || item.day;
  if (typeof direct === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;
  const millis = getTimeValue(direct || item.startAt);
  return millis ? getLocalDateKey(new Date(millis)) : '';
}

function normalizeScheduleTime(value = '') {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return text;
  return `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`;
}

function addMinutesToScheduleTime(value = '', minutesToAdd = 0) {
  const normalized = normalizeScheduleTime(value);
  const match = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!match) return '';
  const total = Number(match[1]) * 60 + Number(match[2]) + minutesToAdd;
  const safeTotal = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(safeTotal / 60)).padStart(2, '0')}:${String(safeTotal % 60).padStart(2, '0')}`;
}

function ensureScheduleRoomPrefix(value = '') {
  const text = String(value || '').trim();
  if (!text) return 'Phòng: ';
  return /^phòng\s*:/i.test(text) ? text : `Phòng: ${text}`;
}

function getMinutesFromScheduleTime(value = '') {
  const normalized = normalizeScheduleTime(value);
  const match = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function normalizeScheduleConfig(config = {}) {
  const sourceSlots = Array.isArray(config.slots) && config.slots.length
    ? config.slots
    : Array.isArray(config.scheduleTimeSlots) && config.scheduleTimeSlots.length
      ? config.scheduleTimeSlots
      : DEFAULT_SCHEDULE_TIME_SLOTS;
  const safeSourceSlots = sourceSlots.filter(
    (slot) => slot && typeof slot === 'object'
  );

  const slots = safeSourceSlots.map((slot, index) => ({
    id: slot.id || `slot-${index + 1}`,
    session: slot.session || (index < Math.ceil(safeSourceSlots.length / 2) ? 'morning' : 'afternoon'),
    period: Number(slot.period) || index + 1,
    startTime: normalizeScheduleTime(slot.startTime || ''),
    endTime: normalizeScheduleTime(slot.endTime || ''),
  })).filter((slot) => slot.startTime && slot.endTime);
  const sourceBreaks = Array.isArray(config.breaks) ? config.breaks : DEFAULT_SCHEDULE_BREAKS;
  const safeSourceBreaks = sourceBreaks.filter(
    (item) => item && typeof item === 'object'
  );

  const breaks = safeSourceBreaks.map((item, index) => ({
    id: item.id || `break-${index + 1}`,
    afterPeriod: Number(item.afterPeriod) || 1,
    label: String(item.label || 'Giờ ra chơi').trim() || 'Giờ ra chơi',
    startTime: normalizeScheduleTime(item.startTime || ''),
    endTime: normalizeScheduleTime(item.endTime || ''),
    kind: item.kind || 'break',
  }));
  return { slots, breaks };
}

function getScheduleConfigForWeek(classItem = {}, weekKey = '') {
  const exact = classItem?.scheduleWeekConfigs?.[weekKey];
  if (exact) return normalizeScheduleConfig(exact);
  const rules = classItem?.scheduleTimeRules && typeof classItem.scheduleTimeRules === 'object'
    ? classItem.scheduleTimeRules
    : {};
  const matchedRuleKey = Object.keys(rules).filter((key) => key <= weekKey).sort().pop();
  if (matchedRuleKey) return normalizeScheduleConfig(rules[matchedRuleKey]);
  if (Array.isArray(classItem?.scheduleTimeSlots) && classItem.scheduleTimeSlots.length) {
    return normalizeScheduleConfig({ slots: classItem.scheduleTimeSlots, breaks: classItem.scheduleBreaks });
  }
  return normalizeScheduleConfig({ slots: DEFAULT_SCHEDULE_TIME_SLOTS, breaks: DEFAULT_SCHEDULE_BREAKS });
}

function toIcsDate(dateKey = '', time = '') {
  const normalizedTime = normalizeScheduleTime(time).replace(':', '');
  return `${String(dateKey).replace(/-/g, '')}T${normalizedTime}00`;
}

function escapeIcsText(value = '') {
  return String(value || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function getScheduleStartTime(item = {}) {
  if (item.startTime) return normalizeScheduleTime(item.startTime);
  const millis = getTimeValue(item.startAt);
  return millis ? new Date(millis).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
}

function getScheduleEndTime(item = {}) {
  if (item.endTime) return normalizeScheduleTime(item.endTime);
  const millis = getTimeValue(item.endAt);
  return millis ? new Date(millis).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
}

function stripHtmlText(value = '') {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function getDaysUntilDate(dateKey = '', now = new Date()) {
  if (!dateKey) return null;
  const target = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const current = new Date(now);
  current.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - current.getTime()) / (24 * 60 * 60 * 1000));
}

function makeNotificationDocId(value = '') {
  return `auto-${String(value).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 140)}`;
}

function csvEscape(value = '') {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}


function concatUint8Arrays(parts) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  parts.forEach((part) => {
    merged.set(part, offset);
    offset += part.length;
  });
  return merged;
}

function buildJpegPdf(pages = []) {
  const encoder = new TextEncoder();
  const objectCount = 2 + pages.length * 3;
  const offsets = new Array(objectCount + 1).fill(0);
  const parts = [];
  let byteOffset = 0;
  const pushBytes = (bytes) => {
    parts.push(bytes);
    byteOffset += bytes.length;
  };
  const pushText = (text) => pushBytes(encoder.encode(text));
  const pushObject = (objectNumber, chunks) => {
    offsets[objectNumber] = byteOffset;
    pushText(`${objectNumber} 0 obj\n`);
    chunks.forEach((chunk) => {
      if (typeof chunk === 'string') pushText(chunk);
      else pushBytes(chunk);
    });
    pushText('\nendobj\n');
  };

  pushBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  pushObject(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  const pageRefs = pages.map((_, index) => `${3 + index * 3} 0 R`).join(' ');
  pushObject(2, [`<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`]);

  pages.forEach((page, index) => {
    const pageObject = 3 + index * 3;
    const imageObject = pageObject + 1;
    const contentObject = pageObject + 2;
    pushObject(pageObject, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>`]);
    pushObject(imageObject, [
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`,
      page.bytes,
      '\nendstream',
    ]);
    const content = encoder.encode('q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ');
    pushObject(contentObject, [`<< /Length ${content.length} >>\nstream\n`, content, '\nendstream']);
  });

  const xrefOffset = byteOffset;
  pushText(`xref\n0 ${objectCount + 1}\n`);
  pushText('0000000000 65535 f \n');
  for (let objectNumber = 1; objectNumber <= objectCount; objectNumber += 1) {
    pushText(`${String(offsets[objectNumber]).padStart(10, '0')} 00000 n \n`);
  }
  pushText(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return concatUint8Arrays(parts);
}

function DonutChart({ segments = [], centerValue = '—', centerLabel = '' }) {
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  let offset = 0;
  return (
    <div className="dashboard-donut-wrap chart-tooltip-host" onMouseLeave={() => setHoveredSegment(null)}>
      <svg className="dashboard-donut" viewBox="0 0 120 120" role="img" aria-label={centerLabel}>
        <circle cx="60" cy="60" r="43" fill="none" stroke="currentColor" strokeWidth="15" className="chart-track" />
        {total > 0 ? segments.map((item) => {
          const percent = item.value / total;
          const dash = percent * 270.18;
          const currentOffset = offset;
          offset += dash;
          return (
            <circle
              key={item.label}
              cx="60"
              cy="60"
              r="43"
              fill="none"
              stroke={item.color}
              strokeWidth="15"
              strokeLinecap="butt"
              strokeDasharray={`${dash} ${270.18 - dash}`}
              strokeDashoffset={-currentOffset}
              transform="rotate(-90 60 60)"
              className={hoveredSegment?.label === item.label ? 'chart-hover-active' : 'chart-hover-target'}
              onMouseEnter={() => setHoveredSegment(item)}
            />
          );
        }) : null}
        <text x="60" y="57" textAnchor="middle" className="chart-center-value">{centerValue}</text>
        <text x="60" y="73" textAnchor="middle" className="chart-center-label">{centerLabel}</text>
      </svg>
      {hoveredSegment ? <div className="chart-hover-tooltip donut-tooltip"><strong>{hoveredSegment.label}</strong><span>Số học sinh: <b>{hoveredSegment.value}</b></span>{total > 0 ? <small>{Math.round((hoveredSegment.value / total) * 100)}% tổng số có dữ liệu</small> : null}</div> : null}
      <div className="dashboard-chart-legend">
        {segments.map((item) => <span key={item.label}><i style={{ background: item.color }} />{item.label} <b>{item.value}</b></span>)}
      </div>
    </div>
  );
}

function LineChart({ points = [] }) {
  const valid = points.filter((item) => item.value !== null && item.value !== undefined);
  if (!valid.length) return <div className="chart-empty">Chưa có dữ liệu điểm.</div>;
  const width = 520;
  const height = 190;
  const padX = 28;
  const padY = 22;
  const step = valid.length > 1 ? (width - padX * 2) / (valid.length - 1) : 0;
  const coords = valid.map((item, index) => ({
    ...item,
    x: padX + index * step,
    y: height - padY - (Math.max(0, Math.min(10, item.value)) / 10) * (height - padY * 2),
  }));
  const path = coords.map((item, index) => `${index ? 'L' : 'M'} ${item.x} ${item.y}`).join(' ');
  return (
    <div className="dashboard-line-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="dashboard-line-chart" role="img" aria-label="Điểm trung bình theo bài kiểm tra">
        {[0, 2.5, 5, 7.5, 10].map((tick) => {
          const y = height - padY - (tick / 10) * (height - padY * 2);
          return <line key={tick} x1={padX} y1={y} x2={width - padX} y2={y} className="chart-grid-line" />;
        })}
        <path d={path} pathLength="1" className="line-chart-path" />
        {coords.map((item) => <g key={item.id || item.label}><circle cx={item.x} cy={item.y} r="4" className="line-chart-point" /><text x={item.x} y={height - 4} textAnchor="middle" className="chart-axis-label">{item.label}</text></g>)}
      </svg>
    </div>
  );
}

function BarChart({ points = [] }) {
  const max = Math.max(1, ...points.map((item) => item.value));
  return (
    <div className="dashboard-bar-chart">
      {points.map((item) => (
        <div className="bar-chart-column" key={item.label}>
          <div className="bar-chart-track"><i style={{ height: `${Math.max(item.value ? 8 : 0, (item.value / max) * 100)}%` }}><b>{item.value || ''}</b></i></div>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}


function AttendanceMonthChart({ data = [], monthLabel = '' }) {
  if (!data.some((item) => item.total > 0)) return <div className="chart-empty">Chưa có dữ liệu điểm danh trong {monthLabel}.</div>;
  return (
    <div className="attendance-month-chart">
      <div className="attendance-month-bars">
        {data.map((item) => {
          const rate = item.total ? Math.round((item.present / item.total) * 100) : 0;
          return (
            <div className="attendance-month-day chart-tooltip-host" key={item.key}>
              <div className="attendance-month-track"><i className="chart-hover-target" style={{ height: `${rate}%` }} /></div>
              <span>{item.shortLabel}</span>
              <div className="chart-hover-tooltip attendance-tooltip"><strong>{item.label}</strong><span>Có mặt: <b>{item.present}</b></span><span>Vắng: <b>{item.absent}</b></span><small>Tỷ lệ có mặt {rate}%</small></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AttendanceWeekChart({ data = [] }) {
  if (!data.some((item) => item.total > 0)) return <div className="chart-empty">Chưa có dữ liệu điểm danh trong tuần này.</div>;
  return (
    <div className="attendance-week-chart">
      {data.map((item) => (
        <div className="attendance-week-column chart-tooltip-host" key={item.key}>
          <div className="attendance-week-bars">
            <i className="attendance-present chart-hover-target" style={{ height: `${item.total ? Math.max(8, (item.present / item.total) * 100) : 0}%` }}><b>{item.present || ''}</b></i>
            <i className="attendance-absent chart-hover-target" style={{ height: `${item.total ? Math.max(item.absent ? 8 : 0, (item.absent / item.total) * 100) : 0}%` }}><b>{item.absent || ''}</b></i>
          </div>
          <span>{item.label}</span>
          <div className="chart-hover-tooltip attendance-tooltip"><strong>{item.label}</strong><span>Có mặt: <b>{item.present}</b></span><span>Vắng: <b>{item.absent}</b></span>{item.late ? <span>Trễ: <b>{item.late}</b></span> : null}<small>Tổng lượt: {item.total}</small></div>
        </div>
      ))}
    </div>
  );
}

export function AttendanceQrCheckIn({ classId, date, token }) {
  const { user, userDetails } = useAuth();
  const authUser = user;

  const [classInfo, setClassInfo] = useState(null);
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [checkInChoice, setCheckInChoice] = useState('present');
  const [excusedNote, setExcusedNote] = useState('');
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(
      () => setClock(Date.now()),
      1000
    );

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!classId || !date || !token) {
      setStatus('invalid');
      setError('Mã QR không hợp lệ.');
      setClassInfo(null);
      setSession(null);
      return undefined;
    }

    let cancelled = false;

    const loadQrSession = async () => {
      try {
        const [classResult, qrResult] = await Promise.all([
          classroomApi.getClassroom(classId),
          classroomApi.getAttendanceQr(
            classId,
            date,
            { token }
          ),
        ]);

        if (cancelled) return;

        setClassInfo(
          classResult?.classroom
          || classResult?.class
          || null
        );

        const attendance =
          qrResult?.attendance
          || null;

        setSession(attendance);

        if (!qrResult?.valid) {
          setStatus('expired');
          setError(
            'Mã QR đã hết hiệu lực hoặc đã được thay mới.'
          );
          return;
        }

        if (
          !attendance?.qrExpiresAt
          || Date.now() >= Number(attendance.qrExpiresAt)
        ) {
          setStatus('expired');
          setError(
            'Mã QR đã hết hạn. Vui lòng quét mã mới từ giáo viên.'
          );
          return;
        }

        setStatus((current) =>
          current === 'success'
            ? current
            : 'ready'
        );

        setError('');
      } catch (apiError) {
        if (cancelled) return;

        setSession(null);
        setStatus('invalid');
        setError(
          apiError?.message
          || 'Không thể kiểm tra mã QR.'
        );
      }
    };

    loadQrSession();

    const intervalId = window.setInterval(
      loadQrSession,
      4000
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [classId, date, token]);

  const expiresIn = Math.max(
    0,
    Number(session?.qrExpiresAt || 0) - clock
  );

  const minutes = Math.floor(
    expiresIn / 60000
  );

  const seconds = Math.floor(
    (expiresIn % 60000) / 1000
  );

  const confirmCheckIn = async () => {
    if (
      !authUser?.uid
      || !session
      || session.qrToken !== token
      || Date.now() >= Number(session.qrExpiresAt || 0)
    ) {
      return;
    }

    if (
      normalizeText(userDetails?.role).includes('teacher')
    ) {
      setError(
        'Tài khoản giáo viên không được điểm danh như học sinh.'
      );
      return;
    }

    if (
      checkInChoice === 'excused'
      && !excusedNote.trim()
    ) {
      setError(
        'Vui lòng nhập lý do vắng có phép.'
      );
      return;
    }

    try {
      setConfirming(true);
      setError('');

      const result =
        await classroomApi.attendanceCheckIn(
          classId,
          date,
          {
            token,
            status: checkInChoice,
            note:
              checkInChoice === 'excused'
                ? excusedNote.trim()
                : '',
          }
        );

      if (result?.attendance) {
        setSession(result.attendance);
      }

      setStatus('success');
    } catch (apiError) {
      setError(
        apiError?.message
        || 'Không thể xác nhận điểm danh.'
      );
    } finally {
      setConfirming(false);
    }
  };

  const checkInDisplayName =
    userDetails?.fullName ||
    userDetails?.displayName ||
    userDetails?.name ||
    authUser?.displayName ||
    authUser?.email?.split('@')?.[0] ||
    'Học sinh';

  const checkInAvatar = getUserAvatar({
    ...(authUser || {}),
    ...(userDetails || {}),
  });

  return (
    <main className="qr-student-checkin-page">
      <section className="qr-student-checkin-card">
        <div className="qr-checkin-logo">✓</div>
        <span className="qr-checkin-eyebrow">Điểm danh QR</span>
        <h1>{classInfo?.name || 'Lớp học'}</h1>

        {status === 'loading'
          ? <p>Đang kiểm tra mã điểm danh...</p>
          : null}

        {!authUser
          ? (
            <div className="qr-checkin-message warning">
              <strong>Bạn chưa đăng nhập</strong>
              <span>Vui lòng đăng nhập tài khoản học sinh rồi quét lại mã QR.</span>
            </div>
          )
          : null}

        {status === 'ready' && authUser
          ? (
            <>
              <div className="qr-checkin-student">
                <span className={checkInAvatar ? 'has-image' : ''}>
                  {checkInAvatar
                    ? (
                      <img
                        src={checkInAvatar}
                        alt=""
                        referrerPolicy="no-referrer"
                      />
                    )
                    : getInitial(checkInDisplayName)}
                </span>

                <div>
                  <strong>{checkInDisplayName}</strong>
                  <small>{authUser.email || userDetails?.email || ''}</small>
                </div>
              </div>

              <div className="qr-checkin-time">
                Mã còn hiệu lực{' '}
                <b>
                  {minutes}:{String(seconds).padStart(2, '0')}
                </b>
              </div>

              <div className="qr-checkin-choice">
                <button
                  type="button"
                  className={checkInChoice === 'present' ? 'active' : ''}
                  onClick={() => {
                    setCheckInChoice('present');
                    setError('');
                  }}
                >
                  ✓ Có mặt
                </button>

                <button
                  type="button"
                  className={
                    checkInChoice === 'excused'
                      ? 'active excused'
                      : 'excused'
                  }
                  onClick={() => {
                    setCheckInChoice('excused');
                    setError('');
                  }}
                >
                  ○ Vắng có phép
                </button>
              </div>

              {checkInChoice === 'excused'
                ? (
                  <label className="qr-excused-note">
                    <span>Lý do vắng có phép</span>
                    <textarea
                      rows="3"
                      value={excusedNote}
                      onChange={(event) =>
                        setExcusedNote(event.target.value)}
                      placeholder="Nhập lý do để giáo viên thấy trong ghi chú điểm danh..."
                    />
                  </label>
                )
                : null}

              <button
                type="button"
                className="qr-confirm-btn"
                onClick={confirmCheckIn}
                disabled={confirming}
              >
                {confirming
                  ? 'Đang xác nhận...'
                  : 'Xác nhận điểm danh'}
              </button>
            </>
          )
          : null}

        {status === 'success'
          ? (
            <div className="qr-checkin-success">
              <span>✓</span>
              <strong>Điểm danh thành công</strong>
              <p>
                Giáo viên sẽ thấy trạng thái{' '}
                {checkInChoice === 'excused'
                  ? 'Vắng có phép'
                  : 'Có mặt'}{' '}
                theo thời gian thực.
              </p>
            </div>
          )
          : null}

        {error
          ? <p className="qr-checkin-error">{error}</p>
          : null}
      </section>

      <style>{styles}</style>
    </main>
  );
}


function getClassExamTypeText(exam = {}) {
  const questions = Array.isArray(exam.questions) ? exam.questions : [];
  const hasEssay = questions.some((question) => question.type === 'essay');
  const hasChoice = questions.some((question) => question.type !== 'essay');
  if (hasEssay && hasChoice) return 'Trắc nghiệm + Tự luận';
  if (hasEssay) return 'Tự luận';
  return 'Trắc nghiệm';
}

function getClassExamStatus(exam = {}) {
  if (exam.isActive) return { id: 'active', label: 'Đang mở' };
  if (exam.isUpcoming) return { id: 'draft', label: 'Nháp' };
  return { id: 'ended', label: 'Đã đóng' };
}

function formatClassExamDate(value) {
  if (!value) return 'Chưa đặt hạn';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa đặt hạn';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

async function extractClassELearningDocxHtml(file) {
  const lowerName = String(file?.name || '').toLowerCase();
  if (!lowerName.endsWith('.docx') || typeof DecompressionStream === 'undefined') return '';

  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let eocdOffset = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      eocdOffset = index;
      break;
    }
  }
  if (eocdOffset < 0) return '';

  const centralOffset = view.getUint32(eocdOffset + 16, true);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  let cursor = centralOffset;
  let entry = null;
  const decoder = new TextDecoder();

  for (let index = 0; index < totalEntries && cursor + 46 <= bytes.length; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break;
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const fileNameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const fileName = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + fileNameLength));
    if (fileName === 'word/document.xml') {
      entry = { method, compressedSize, localOffset };
      break;
    }
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }
  if (!entry || view.getUint32(entry.localOffset, true) !== 0x04034b50) return '';

  const localNameLength = view.getUint16(entry.localOffset + 26, true);
  const localExtraLength = view.getUint16(entry.localOffset + 28, true);
  const dataStart = entry.localOffset + 30 + localNameLength + localExtraLength;
  const compressed = bytes.slice(dataStart, dataStart + entry.compressedSize);
  let xmlBytes = compressed;

  if (entry.method === 8) {
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    xmlBytes = new Uint8Array(await new Response(stream).arrayBuffer());
  } else if (entry.method !== 0) {
    return '';
  }

  const xml = decoder.decode(xmlBytes);
  const parsedDocument = new DOMParser().parseFromString(xml, 'application/xml');
  const paragraphs = Array.from(parsedDocument.getElementsByTagNameNS('*', 'p'))
    .map((paragraph) => Array.from(paragraph.getElementsByTagNameNS('*', 't')).map((node) => node.textContent || '').join(''))
    .map((text) => text.trim())
    .filter(Boolean);
  const escapeHtml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`).join('');
}

function ClassExamWorkspace({ selectedClass }) {
  const page = useExamsPage();
  const allExams = Array.isArray(page.exams) ? page.exams : [];
  const visibleExams = Array.isArray(page.visibleExams) ? page.visibleExams : [];
  const examCounts = useMemo(() => ({
    total: allExams.length,
    active: allExams.filter((exam) => exam.isActive).length,
    draft: allExams.filter((exam) => exam.isUpcoming).length,
    ended: allExams.filter((exam) => !exam.isActive && !exam.isUpcoming).length,
  }), [allExams]);

  if (page.roleLoading) {
    return (
      <div className="class-exam-page">
        <section className="class-exam-head"><div><span>Đề thi · đồng bộ module Đề thi</span><h3>Đề thi</h3><p>Đang tải dữ liệu đề thi của giáo viên...</p></div></section>
        <div className="class-exam-skeleton">{Array.from({ length: 5 }, (_, index) => <i key={index} />)}</div>
      </div>
    );
  }

  if (!page.canManage) {
    return <div className="class-exam-page"><DataUnavailable icon="▤" text="Tài khoản hiện tại không có quyền quản lý đề thi." /></div>;
  }

  return (
    <div className="class-exam-page">
      <section className="class-exam-head">
        <div>
          <span>Đề thi · đồng bộ module Đề thi</span>
          <h3>Đề thi</h3>
          <p>Hiển thị trực tiếp các đề thi từ module Đề thi trong workspace lớp {selectedClass?.name || 'hiện tại'}.</p>
        </div>
        <div className="class-exam-head-actions">
          <button type="button" className="class-exam-secondary-btn" onClick={() => window.location.assign('/exams')}>Mở trang Đề thi ↗</button>
          <button type="button" className="class-exam-create-btn" onClick={page.openCreateModal}>＋ Tạo đề thi</button>
        </div>
      </section>

      <section className="class-exam-stat-grid">
        <article><span>▤</span><div><strong>{examCounts.total}</strong><small>Tổng đề thi</small></div></article>
        <article className="active"><span>●</span><div><strong>{examCounts.active}</strong><small>Đang mở</small></div></article>
        <article className="draft"><span>◷</span><div><strong>{examCounts.draft}</strong><small>Nháp / sắp mở</small></div></article>
        <article className="ended"><span>✓</span><div><strong>{examCounts.ended}</strong><small>Đã đóng</small></div></article>
      </section>

      <section className="class-exam-toolbar">
        <div className="class-exam-tabs" role="tablist" aria-label="Trạng thái đề thi">
          {[['all','Tất cả'],['published','Đang mở'],['draft','Nháp'],['ended','Đã đóng']].map(([value, label]) => (
            <button type="button" key={value} className={page.publishFilter === value ? 'active' : ''} onClick={() => page.setPublishFilter(value)}>{label}</button>
          ))}
        </div>
        <div className="class-exam-filters">
          <label className="class-exam-search"><span>⌕</span><input value={page.search || ''} onChange={(event) => page.setSearch(event.target.value)} placeholder="Tìm theo tên, môn học hoặc mã đề..." /></label>
          <select value={page.privacyFilter || 'all'} onChange={(event) => page.setPrivacyFilter(event.target.value)} aria-label="Lọc quyền riêng tư">
            <option value="all">Tất cả đề thi</option>
            <option value="public">Công khai</option>
            <option value="private">Riêng tư</option>
          </select>
        </div>
      </section>

      {visibleExams.length ? (
        <section className="class-exam-table-wrap">
          <div className="class-exam-table">
            <div className="class-exam-row class-exam-row-head"><span>Tên đề thi</span><span>Môn</span><span>Loại</span><span>Thời gian</span><span>Hạn nộp</span><span>Trạng thái</span><span>Thao tác</span></div>
            {visibleExams.map((exam) => {
              const status = getClassExamStatus(exam);
              return (
                <div className="class-exam-row" key={exam.id}>
                  <div className="class-exam-title"><strong>{exam.title || 'Đề thi chưa đặt tên'}</strong><small>{exam.questionCount || exam.questions?.length || 0} câu hỏi{Array.isArray(exam.studentResults) ? ` · ${exam.studentResults.length} học sinh` : ''}</small></div>
                  <span>{exam.subject || '—'}</span>
                  <span>{getClassExamTypeText(exam)}</span>
                  <span>◷ {exam.duration || 45} phút</span>
                  <span>{formatClassExamDate(exam.closeDate)}</span>
                  <span><b className={`class-exam-status ${status.id}`}>{status.label}</b></span>
                  <div className="class-exam-actions">
                    <button type="button" title="Xem trước" aria-label="Xem trước đề thi" onClick={() => page.previewExam?.(exam)}>◉</button>
                    <button type="button" title="Chỉnh sửa" aria-label="Chỉnh sửa đề thi" onClick={() => page.openEditModal?.(exam)}>✎</button>
                    <button type="button" title="Sao chép liên kết" aria-label="Sao chép liên kết đề thi" onClick={() => page.copyExamLink?.(exam)}>⧉</button>
                    <button type="button" className="danger" title="Xóa" aria-label="Xóa đề thi" onClick={() => page.setDeleteConfirmExam?.(exam)}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="class-exam-empty"><span>▤</span><strong>Không tìm thấy đề thi phù hợp</strong><p>Thử đổi trạng thái, quyền riêng tư hoặc từ khóa tìm kiếm.</p></section>
      )}

      <CreateExamModal
        open={Boolean(page.createOpen)}
        onClose={page.closeCreateModal}
        onSave={page.saveExam}
        editingExam={page.editingExam}
        teacherSubject={page.teacherSubject}
        teacherName={page.teacherName}
        availableClasses={page.classes || []}
      />

      {page.deleteConfirmExam ? (
        <div className="modal-backdrop" onMouseDown={page.closeDeleteConfirm}>
          <div className="class-modal class-exam-delete-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head"><div><p>Xác nhận xóa</p><h2>Xóa đề thi?</h2></div><button type="button" className="icon-btn" onClick={page.closeDeleteConfirm}>×</button></div>
            <p className="class-exam-delete-copy">Bạn có chắc muốn xóa đề “{page.deleteConfirmExam.title || 'Chưa có tên'}” khỏi hệ thống Đề thi?</p>
            <div className="modal-actions"><button type="button" className="ghost-btn" onClick={page.closeDeleteConfirm}>Hủy</button><button type="button" className="danger-btn" onClick={page.confirmDeleteExam}>Xóa đề thi</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TeacherClasses() {
  const { user, userDetails } = useAuth();
  const isAdminUser = normalizeText(userDetails?.role) === 'admin_dev';
  const validWorkspaceTabIds = useMemo(
    () =>
      new Set([
        'home',
        ...CLASS_WORKSPACE_ITEMS.map((item) => item.id),
      ]),
    [],
  );

  const getWorkspaceTabFromUrl = () => {
    if (typeof window === 'undefined') return 'home';
    const requestedTab =
      new URLSearchParams(window.location.search).get('tab');

    return requestedTab && validWorkspaceTabIds.has(requestedTab)
      ? requestedTab
      : 'home';
  };

  const [activeTab, setActiveTab] = useState(getWorkspaceTabFromUrl);
  const [queryText, setQueryText] = useState('');
  const [selectedClassId, setSelectedClassId] = useState(() => {
    if (typeof window === 'undefined') return '';
    return String(
      new URLSearchParams(window.location.search).get('classId') || '',
    ).trim();
  });
  const [classView, setClassView] = useState(() => {
    if (typeof window === 'undefined') return 'list';
    return new URLSearchParams(window.location.search).get('classId')
      ? 'workspace'
      : 'list';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);

    if (selectedClassId) {
      url.searchParams.set('classId', String(selectedClassId));

      if (activeTab !== 'home' && validWorkspaceTabIds.has(activeTab)) {
        url.searchParams.set('tab', activeTab);
      } else {
        url.searchParams.delete('tab');
      }
    } else {
      url.searchParams.delete('classId');
      url.searchParams.delete('tab');
    }

    window.history.replaceState(
      {},
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [selectedClassId, activeTab, validWorkspaceTabIds]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncWorkspaceFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const requestedClassId = String(params.get('classId') || '').trim();
      const requestedTab = params.get('tab');
      const safeTab =
        requestedTab && validWorkspaceTabIds.has(requestedTab)
          ? requestedTab
          : 'home';

      setSelectedClassId(requestedClassId);
      setClassView(requestedClassId ? 'workspace' : 'list');
      setActiveTab(safeTab);
    };

    window.addEventListener('popstate', syncWorkspaceFromUrl);
    return () =>
      window.removeEventListener('popstate', syncWorkspaceFromUrl);
  }, [validWorkspaceTabIds]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [scoreTests, setScoreTests] = useState([]);
  const [scoreRows, setScoreRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [classForm, setClassForm] = useState({
    name: '',
    grade: '',
  });
  const [studentOpen, setStudentOpen] = useState(false);
  const [addingStudents, setAddingStudents] = useState(false);
  const [studentError, setStudentError] = useState('');
  const [studentRows, setStudentRows] = useState([emptyStudentRow()]);
  const [studentEditOpen, setStudentEditOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(false);
  const [studentEditError, setStudentEditError] = useState('');
  const [studentToEdit, setStudentToEdit] = useState(null);
  const [studentEditForm, setStudentEditForm] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [studentDeleteOpen, setStudentDeleteOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(false);
  const [studentDeleteError, setStudentDeleteError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteClassId, setDeleteClassId] = useState('');
  const [menuClassId, setMenuClassId] = useState('');
  const [deletingClass, setDeletingClass] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(1);
  const [deleteConfirmSeconds, setDeleteConfirmSeconds] = useState(10);
  const [teacherRowMenuId, setTeacherRowMenuId] = useState('');
  const [teacherDeleteOpen, setTeacherDeleteOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState(null);
  const [deletingTeacher, setDeletingTeacher] = useState(false);
  const [teacherDeleteError, setTeacherDeleteError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsClassId, setSettingsClassId] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    logoUrl: '',
    coverPhotoUrl: '',
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sectionOpen, setSectionOpen] = useState({ main: true, secondary: true });
  const [workspaceMobileMenuOpen, setWorkspaceMobileMenuOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [classSearch, setClassSearch] = useState('');
  const [eLearningCourses, setELearningCourses] = useState([]);
  const [eLearningTeacherProfiles, setELearningTeacherProfiles] = useState({});
  const [eLearningResourcesLoading, setELearningResourcesLoading] = useState(false);
  const [eLearningResourcesError, setELearningResourcesError] = useState('');
  const [eLearningResourceSearch, setELearningResourceSearch] = useState('');
  const [eLearningResourceScope, setELearningResourceScope] = useState('class');
  const [eLearningResourceFormat, setELearningResourceFormat] = useState('all');
  const [eLearningResourceSort, setELearningResourceSort] = useState('newest');
  const [eLearningCreateTypeOpen, setELearningCreateTypeOpen] = useState(false);
  const [eLearningCreateOpen, setELearningCreateOpen] = useState(false);
  const [eLearningCreateType, setELearningCreateType] = useState('video');
  const [eLearningCreateForm, setELearningCreateForm] = useState(() => getELearningEmptyForm());
  const [eLearningCreateUploadingWord, setELearningCreateUploadingWord] = useState(false);
  const [eLearningCreateUploadingVideo, setELearningCreateUploadingVideo] = useState(false);
  const [eLearningCreateUploadingImage, setELearningCreateUploadingImage] = useState(false);
  const [eLearningCreatePublishing, setELearningCreatePublishing] = useState(false);
  const [eLearningCreateNotice, setELearningCreateNotice] = useState('');
  const eLearningCreateLessonsRef = useRef(null);
  const [assignmentsByClass, setAssignmentsByClass] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [homeSettingsOpen, setHomeSettingsOpen] = useState(false);
  const [homeSettingsError, setHomeSettingsError] = useState('');
  const [homeSettingsForm, setHomeSettingsForm] = useState({ name: '', description: '', school: '', grade: '', coverPhotoUrl: '', themeColor: '#2563eb' });
  const [coverLibraryOpen, setCoverLibraryOpen] = useState(false);
  const [coverLibraryCategory, setCoverLibraryCategory] = useState(CLASS_COVER_CATEGORIES[0].category);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementLinks, setAnnouncementLinks] = useState([]);
  const [announcementFile, setAnnouncementFile] = useState(null);
  const [announcementError, setAnnouncementError] = useState('');
  const [publishingAnnouncement, setPublishingAnnouncement] = useState(false);
  const [announcementFormats, setAnnouncementFormats] = useState({ bold: false, italic: false, underline: false, list: false });
  const [announcementLinkDialog, setAnnouncementLinkDialog] = useState({ open: false, type: 'link', url: '' });
  const [notificationToDelete, setNotificationToDelete] = useState(null);
  const [deletingNotification, setDeletingNotification] = useState(false);
  const [notificationDeleteError, setNotificationDeleteError] = useState('');
  const [notificationFilter, setNotificationFilter] = useState('all');
  const [notificationActionError, setNotificationActionError] = useState('');
  const [notificationDeleteAllOpen, setNotificationDeleteAllOpen] = useState(false);
  const [deletingAllNotifications, setDeletingAllNotifications] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageSearch, setMessageSearch] = useState('');
  const [messageMobileChatOpen, setMessageMobileChatOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [messageDrafts, setMessageDrafts] = useState({});
  const [messageSending, setMessageSending] = useState(false);
  const [messageError, setMessageError] = useState('');
  const [messageAttachments, setMessageAttachments] = useState({});
  const [copiedMessageId, setCopiedMessageId] = useState('');
  const [recallingMessageId, setRecallingMessageId] = useState('');
  const [messageRecallConfirm, setMessageRecallConfirm] = useState(null);
  const messageFileInputRef = useRef(null);
  const messageTextareaRef = useRef(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceDate, setAttendanceDate] = useState(() => getLocalDateKey());
  const [attendanceDraft, setAttendanceDraft] = useState({});
  const [attendanceDirty, setAttendanceDirty] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceSaveError, setAttendanceSaveError] = useState('');
  const [attendanceMode, setAttendanceMode] = useState('manual');
  const [attendanceHistoryPage, setAttendanceHistoryPage] = useState(0);
  const [attendanceHistoryEntries, setAttendanceHistoryEntries] = useState([]);
  const [attendanceQrCreating, setAttendanceQrCreating] = useState(false);
  const [attendanceQrError, setAttendanceQrError] = useState('');
  const attendanceImportInputRef = useRef(null);
  const [scheduleItems, setScheduleItems] = useState([]);
  const [scheduleWeekOffset, setScheduleWeekOffset] = useState(0);
  const [scheduleEditorOpen, setScheduleEditorOpen] = useState(false);
  const [scheduleEditorMode, setScheduleEditorMode] = useState('cell');
  const [scheduleEditorSaving, setScheduleEditorSaving] = useState(false);
  const [scheduleEditorError, setScheduleEditorError] = useState('');
  const [scheduleEditorTargetId, setScheduleEditorTargetId] = useState('');
  const [scheduleEditorForm, setScheduleEditorForm] = useState({ date: '', startTime: '', endTime: '', title: '', lessonContent: '', room: 'Phòng: ', note: '', important: false });
  const [scheduleSlotDraft, setScheduleSlotDraft] = useState(DEFAULT_SCHEDULE_TIME_SLOTS);
  const [scheduleBreakDraft, setScheduleBreakDraft] = useState(DEFAULT_SCHEDULE_BREAKS);
  const [scheduleSyncMessage, setScheduleSyncMessage] = useState('');
  const [scheduleGoogleGuideOpen, setScheduleGoogleGuideOpen] = useState(false);
  const [scheduleDragId, setScheduleDragId] = useState('');
  const [scheduleInlineEditor, setScheduleInlineEditor] = useState(null);
  const [scheduleImportantOpen, setScheduleImportantOpen] = useState(false);
  const [scheduleImportantSaving, setScheduleImportantSaving] = useState(false);
  const [scheduleImportantError, setScheduleImportantError] = useState('');
  const [scheduleImportantForm, setScheduleImportantForm] = useState({ title: '', note: '', expiresDate: '', expiresTime: '23:59' });
  const [allSubjectScores, setAllSubjectScores] = useState({});
  const [classCodeCopied, setClassCodeCopied] = useState(false);
  const [studentProfileId, setStudentProfileId] = useState('');
  const [studentProfileTab, setStudentProfileTab] = useState('info');
  const [studentSort, setStudentSort] = useState('rank');
  const [studentSortOpen, setStudentSortOpen] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [studentRowMenuId, setStudentRowMenuId] = useState('');
  const [studentImporting, setStudentImporting] = useState(false);
  const [studentImportError, setStudentImportError] = useState('');
  const [studentImportOpen, setStudentImportOpen] = useState(false);
  const [studentImportText, setStudentImportText] = useState('');
  const [userProfilesByEmail, setUserProfilesByEmail] = useState({});
  const [attendanceQrCopied, setAttendanceQrCopied] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileEditError, setProfileEditError] = useState('');
  const [profileEditForm, setProfileEditForm] = useState({
    name: '', email: '', phone: '', gender: '', birthDate: '',
    parentName: '', parentPhone: '', parentEmail: '', parentRelation: '', medicalNote: '',
  });
  const studentExcelInputRef = useRef(null);
  const announcementEditorRef = useRef(null);
  const capitalizeListNextRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const syncMobileWorkspaceSidebar = () => {
      if (window.matchMedia('(max-width: 760px)').matches) {
        setSidebarCollapsed(false);
        setSectionOpen({ main: true, secondary: true });
      }
    };
    syncMobileWorkspaceSidebar();
    window.addEventListener('resize', syncMobileWorkspaceSidebar);
    return () => window.removeEventListener('resize', syncMobileWorkspaceSidebar);
  }, []);

  useEffect(() => {
    if (!coverLibraryOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setCoverLibraryOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [coverLibraryOpen]);

  useEffect(() => {
    if (!deleteOpen || deleteConfirmStep !== 2 || deleteConfirmSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => setDeleteConfirmSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [deleteConfirmSeconds, deleteConfirmStep, deleteOpen]);

  useEffect(() => {
    if (!menuClassId) return undefined;

    const closeMenuOnOutsideClick = (event) => {
      const isInsideMenu = event.target.closest?.(
        '.tile-menu, .tile-menu-popover'
      );
      if (!isInsideMenu) setMenuClassId('');
    };

    window.addEventListener('mousedown', closeMenuOnOutsideClick);
    return () =>
      window.removeEventListener('mousedown', closeMenuOnOutsideClick);
  }, [menuClassId]);

  useEffect(() => {
    if (!studentSortOpen) return undefined;

    const closeStudentSortOnOutsideClick = (event) => {
      if (!event.target.closest?.('.student-sort-control')) setStudentSortOpen(false);
    };

    window.addEventListener('mousedown', closeStudentSortOnOutsideClick);
    return () => window.removeEventListener('mousedown', closeStudentSortOnOutsideClick);
  }, [studentSortOpen]);

  useEffect(() => {
    if (!studentRowMenuId && !teacherRowMenuId) return undefined;
    const closeStudentMenuOnOutsideClick = (event) => {
      if (!event.target.closest?.('.student-row-menu-wrap')) {
        setStudentRowMenuId('');
        setTeacherRowMenuId('');
      }
    };
    window.addEventListener('mousedown', closeStudentMenuOnOutsideClick);
    return () => window.removeEventListener('mousedown', closeStudentMenuOnOutsideClick);
  }, [studentRowMenuId, teacherRowMenuId]);

  useEffect(() => {
    setCurrentUser(user || null);
  }, [user]);

  useEffect(() => {
    if (typeof document === 'undefined' || classView !== 'detail' || !selectedClassId) {
      return undefined;
    }

    const workspace = document.querySelector('.class-workspace-page');
    if (!workspace) return undefined;

    document.documentElement.classList.add('class-workspace-fullscreen');
    document.body.classList.add('class-workspace-fullscreen');

    const hiddenElements = Array.from(document.querySelectorAll('body footer'))
      .filter((element) => !workspace.contains(element))
      .map((element) => ({ element, display: element.style.display }));
    hiddenElements.forEach(({ element }) => element.style.setProperty('display', 'none', 'important'));

    const mobileHiddenElements = new Map();
    let mobileChromeFrame = 0;
    const isOutsideWorkspace = (element) => element && !workspace.contains(element) && !element.contains(workspace);
    const syncMobileWorkspaceChrome = () => {
      const shouldHideChatbox = window.matchMedia('(max-width: 1024px)').matches;
      const mobileOnlyCandidates = Array.from(document.querySelectorAll(
        '[class*="chatbot" i], [class*="chat-box" i], [class*="chatbox" i], [class*="chat-widget" i], [class*="floating-chat" i], [class*="ai-button" i], [class*="ai-chat" i], [class*="floating-ai" i], [id*="chatbot" i], [id*="zuny-ai" i], [data-testid*="chat" i], [aria-label*="AI" i], [aria-label*="chat" i], [title*="AI" i], [title*="chat" i]'
      )).filter(isOutsideWorkspace);
      const visualProbeCandidates = typeof document.elementsFromPoint === 'function'
        ? [
            ...document.elementsFromPoint(
              Math.max(1, window.innerWidth - 28),
              Math.max(1, window.innerHeight - 28)
            ),
          ]
        : [];
      const visualChromeCandidates = shouldHideChatbox
        ? Array.from(new Set([
            ...document.querySelectorAll(
              '.fixed, [style*="position: fixed"], [style*="position:fixed"]'
            ),
            ...visualProbeCandidates,
          ]))
          .filter(isOutsideWorkspace)
          .filter((element) => {
            const computedStyle = window.getComputedStyle(element);
            if (computedStyle.position !== 'fixed') return false;

            const rect = element.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return false;

            const compactBottomCorner =
              rect.width <= 180 &&
              rect.height <= 180 &&
              rect.right >= window.innerWidth - 40 &&
              rect.bottom >= window.innerHeight - 40;

            return shouldHideChatbox && compactBottomCorner;
          })
        : [];

      const elementsToHide = new Set([
        ...(shouldHideChatbox ? mobileOnlyCandidates : []),
        ...visualChromeCandidates,
      ]);

      mobileHiddenElements.forEach((display, element) => {
        if (elementsToHide.has(element)) return;
        if (display) element.style.display = display;
        else element.style.removeProperty('display');
        mobileHiddenElements.delete(element);
      });

      elementsToHide.forEach((element) => {
        if (!mobileHiddenElements.has(element)) mobileHiddenElements.set(element, element.style.display);
        element.style.setProperty('display', 'none', 'important');
      });
    };
    const scheduleMobileWorkspaceChromeSync = () => {
      if (mobileChromeFrame) window.cancelAnimationFrame(mobileChromeFrame);
      mobileChromeFrame = window.requestAnimationFrame(() => {
        mobileChromeFrame = 0;
        syncMobileWorkspaceChrome();
      });
    };
    syncMobileWorkspaceChrome();
    window.addEventListener('resize', scheduleMobileWorkspaceChromeSync);
    const mobileChromeObserver = typeof MutationObserver !== 'undefined'
      ? new MutationObserver(scheduleMobileWorkspaceChromeSync)
      : null;
    mobileChromeObserver?.observe(document.body, { childList: true, subtree: true });

    const adjustedAncestors = [];
    let ancestor = workspace.parentElement;
    while (ancestor && ancestor !== document.body) {
      adjustedAncestors.push({
        element: ancestor,
        margin: ancestor.style.margin,
        padding: ancestor.style.padding,
        maxWidth: ancestor.style.maxWidth,
        width: ancestor.style.width,
        minHeight: ancestor.style.minHeight,
      });
      ancestor.style.setProperty('margin', '0', 'important');
      ancestor.style.setProperty('padding', '0', 'important');
      ancestor.style.setProperty('max-width', 'none', 'important');
      ancestor.style.setProperty('width', '100%', 'important');
      ancestor.style.setProperty('min-height', '100dvh', 'important');
      ancestor = ancestor.parentElement;
    }

    return () => {
      window.removeEventListener('resize', scheduleMobileWorkspaceChromeSync);
      mobileChromeObserver?.disconnect();
      if (mobileChromeFrame) window.cancelAnimationFrame(mobileChromeFrame);
      mobileHiddenElements.forEach((display, element) => {
        if (display) element.style.display = display;
        else element.style.removeProperty('display');
      });
      mobileHiddenElements.clear();
      document.documentElement.classList.remove('class-workspace-fullscreen');
      document.body.classList.remove('class-workspace-fullscreen');

      hiddenElements.forEach(({ element, display }) => {
        if (display) element.style.display = display;
        else element.style.removeProperty('display');
      });

      adjustedAncestors.forEach(
        ({ element, margin, padding, maxWidth, width, minHeight }) => {
          element.style.margin = margin;
          element.style.padding = padding;
          element.style.maxWidth = maxWidth;
          element.style.width = width;
          element.style.minHeight = minHeight;
        }
      );
    };
  }, [classView, selectedClassId]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleBrowserBackForward = (event) => {
      const historyState = event.state || {};

      if (historyState.classesPage === 'detail' && historyState.classId) {
        setSelectedClassId(historyState.classId);
        setClassView('detail');
        return;
      }

      setClassView('list');
    };

    window.history.replaceState(
      { ...(window.history.state || {}), classesPage: 'list' },
      ''
    );
    window.addEventListener('popstate', handleBrowserBackForward);

    return () =>
      window.removeEventListener('popstate', handleBrowserBackForward);
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) {
      setClasses([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    let firstLoad = true;

    const loadClasses = async () => {
      try {
        if (firstLoad) {
          setLoading(true);
        }

        const result = await classroomApi.listClassrooms(
          isAdminUser
            ? {}
            : { mine: 1 },
        );
        if (cancelled) return;

        const nextClasses = (
          Array.isArray(result?.classrooms)
            ? result.classrooms
            : Array.isArray(result?.classes)
              ? result.classes
              : []
        ).sort(
          (a, b) =>
            getTimeValue(b.createdAt) -
            getTimeValue(a.createdAt)
        );

        setClasses(nextClasses);
        setSelectedClassId((currentId) =>
          nextClasses.some(
            (item) => String(item.id) === String(currentId)
          )
            ? currentId
            : ''
        );
        setClassView((currentView) => nextClasses.length ? currentView : 'list');
      } catch (error) {
        if (!cancelled) console.error('Không thể tải danh sách lớp:', error);
      } finally {
        if (!cancelled && firstLoad) {
          firstLoad = false;
          setLoading(false);
        }
      }
    };

    loadClasses();
    const intervalId = window.setInterval(loadClasses, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [currentUser?.uid, isAdminUser]);

  useEffect(() => {
    if (!classes.length) {
      setAssignmentsByClass({});
      return undefined;
    }

    let cancelled = false;
    const loadAssignments = async () => {
      try {
        const rows = await Promise.all(classes.map(async (classItem) => {
          const result = await classroomApi.listAssignments(classItem.id);
          return [classItem.id, (Array.isArray(result?.assignments) ? result.assignments : []).map((assignment) => ({
            ...assignment,
            classId: classItem.id,
            className: classItem.name,
          }))];
        }));
        if (!cancelled) setAssignmentsByClass(Object.fromEntries(rows));
      } catch (error) {
        if (!cancelled) console.error('Không thể tải bài tập:', error);
      }
    };
    loadAssignments();
    const intervalId = window.setInterval(loadAssignments, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [classes]);

  useEffect(() => {
    if (classView !== 'detail' || activeTab !== 'resources' || !currentUser?.uid || !selectedClassId) {
      setELearningResourcesLoading(false);
      return undefined;
    }

    setELearningResourcesLoading(true);
    setELearningResourcesError('');
    setELearningCourses([]);

    let cancelled = false;
    const loadCourses = async () => {
      try {
        const result = await eLearningApi.courses();
        if (!cancelled) {
          setELearningCourses(Array.isArray(result?.courses) ? result.courses : []);
          setELearningResourcesLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Không thể tải học liệu E-learning:', error);
          setELearningCourses([]);
          setELearningResourcesError(error?.message || 'Không thể tải học liệu E-learning.');
          setELearningResourcesLoading(false);
        }
      }
    };
    loadCourses();
    const intervalId = window.setInterval(loadCourses, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeTab, classView, currentUser?.uid, selectedClassId]);

  useEffect(() => {
    if (classView !== 'detail' || activeTab !== 'resources' || !currentUser?.uid || !eLearningCourses.length) {
      setELearningTeacherProfiles({});
      return undefined;
    }

    let cancelled = false;
    const loadProfiles = async () => {
      try {
        const result = await eLearningApi.users();
        if (cancelled) return;
        const profiles = Array.isArray(result?.users) ? result.users : [];
        const profileMap = {};
        profiles.forEach((profile) => {
          const id = profile.id || profile.uid || profile.userId;
          const email = normalizeText(profile.email);
          if (id) profileMap[`id:${id}`] = profile;
          if (email) profileMap[`email:${email}`] = profile;
        });
        setELearningTeacherProfiles(profileMap);
      } catch (error) {
        if (!cancelled) console.warn('Không thể đồng bộ hồ sơ người đăng E-learning:', error);
      }
    };
    loadProfiles();
    const intervalId = window.setInterval(loadProfiles, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeTab, classView, currentUser?.uid, eLearningCourses]);

  useEffect(() => {
    if (!selectedClassId) {
      setNotifications([]);
      return undefined;
    }

    let cancelled = false;

    const loadNotifications = async () => {
      try {
        const result = await classroomApi.listNotifications(
          selectedClassId,
          {
            all: true,
            limit: 500,
          },
        );

        if (cancelled) return;

        setNotifications(
          Array.isArray(result?.notifications)
            ? result.notifications
            : []
        );
      } catch (error) {
        if (cancelled) return;
        console.error('Không thể tải thông báo:', error);
      }
    };

    loadNotifications();

    const intervalId = window.setInterval(
      loadNotifications,
      10000,
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedClassId) {
      setMessages([]);
      setSelectedConversationId('');
      return undefined;
    }

    let cancelled = false;

    const loadMessages = async () => {
      try {
        const result = await classroomApi.listMessages(
          selectedClassId,
          {
            limit: 500,
          },
        );

        if (cancelled) return;

        setMessages(
          Array.isArray(result?.messages)
            ? result.messages
            : []
        );

        setMessageError('');
      } catch (error) {
        if (cancelled) return;
        console.error('Không thể tải trao đổi:', error);
        setMessageError(error?.message || 'Không thể tải dữ liệu trao đổi.');
      }
    };

    loadMessages();

    const intervalId = window.setInterval(
      loadMessages,
      10000,
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [selectedClassId]);


  useEffect(() => {
    if (!selectedClassId) {
      setAttendanceRecords([]);
      return undefined;
    }

    let cancelled = false;

    const loadAttendance = async () => {
      try {
        const result = await classroomApi.listAttendance(
          selectedClassId
        );

        if (cancelled) return;

        setAttendanceRecords(
          Array.isArray(result?.attendance)
            ? result.attendance
            : Array.isArray(result?.records)
              ? result.records
              : []
        );
      } catch (error) {
        if (cancelled) return;

        console.error(
          'Không thể tải điểm danh:',
          error
        );

        setAttendanceRecords([]);
      }
    };

    loadAttendance();

    const intervalId = window.setInterval(
      loadAttendance,
      30000
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedClassId || !attendanceDate) {
      setAttendanceHistoryEntries([]);
      return undefined;
    }

    let cancelled = false;

    const loadAttendanceHistory = async () => {
      try {
        const result =
          await classroomApi.getAttendanceHistory(
            selectedClassId,
            attendanceDate
          );

        if (cancelled) return;

        setAttendanceHistoryEntries(
          Array.isArray(result?.history)
            ? result.history
            : Array.isArray(result?.records)
              ? result.records
              : []
        );
      } catch (error) {
        if (cancelled) return;

        console.error(
          'Không thể tải lịch sử điểm danh:',
          error
        );

        setAttendanceHistoryEntries([]);
      }
    };

    loadAttendanceHistory();

    const intervalId = window.setInterval(
      loadAttendanceHistory,
      60000
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [attendanceDate, selectedClassId]);

  useEffect(() => {
    if (!selectedClassId) {
      setScheduleItems([]);
      return undefined;
    }
    let cancelled = false;
    const loadSchedule = async () => {
      try {
        const result = await classroomApi.listSchedule(selectedClassId);
        if (!cancelled) setScheduleItems(Array.isArray(result?.schedule) ? result.schedule : []);
      } catch (error) {
        if (!cancelled) {
          console.error('Không thể tải lịch học:', error);
          setScheduleItems([]);
        }
      }
    };
    loadSchedule();
    const intervalId = window.setInterval(loadSchedule, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      setSubjects([]);
      setScoreTests([]);
      setScoreRows([]);
      return undefined;
    }

    let cancelled = false;
    const loadMembers = async () => {
      try {
        const result = await classroomApi.listMembers(selectedClassId);
        if (!cancelled) setStudents(sortStudentsByJoinTime(Array.isArray(result?.members) ? result.members : []));
      } catch (error) {
        if (!cancelled) console.error('Không thể tải thành viên lớp:', error);
      }
    };
    loadMembers();
    const intervalId = window.setInterval(loadMembers, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [selectedClassId]);

  useEffect(() => {
    const selectedTeacherEmail = classes.find((item) => item.id === selectedClassId)?.teacherEmail || '';
    const emails = Array.from(new Set([
      ...students.map((student) => normalizeText(student.email)),
      normalizeText(selectedTeacherEmail),
      normalizeText(currentUser?.email),
    ].filter(Boolean)));
    if (!emails.length) {
      setUserProfilesByEmail({});
      return undefined;
    }

    let cancelled = false;
    const loadProfiles = async () => {
      const results = await Promise.allSettled(emails.map((email) => classroomApi.resolveUser({ email })));
      if (cancelled) return;
      const merged = {};
      results.forEach((result) => {
        const profile = result.status === 'fulfilled' ? result.value?.user : null;
        const email = normalizeText(profile?.email);
        if (email) merged[email] = profile;
      });
      setUserProfilesByEmail(merged);
    };
    loadProfiles().catch((error) => console.error('Không thể đồng bộ hồ sơ người dùng:', error));

    return () => {
      cancelled = true;
    };
  }, [classes, currentUser?.email, selectedClassId, students]);

  useEffect(() => {
    if (!selectedClassId) return undefined;

    let cancelled = false;
    const loadSubjects = async () => {
      try {
        const result = await classroomApi.listSubjects(selectedClassId);
        if (cancelled) return;
        const nextSubjects = Array.isArray(result?.subjects) ? result.subjects : [];
        setSubjects(nextSubjects);
        setSelectedSubjectId((currentId) => nextSubjects.some((item) => item.id === currentId) ? currentId : nextSubjects[0]?.id || '');
      } catch (error) {
        if (!cancelled) console.error('Không thể tải môn học:', error);
      }
    };
    loadSubjects();
    const intervalId = window.setInterval(loadSubjects, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedClassId || !subjects.length) {
      setAllSubjectScores({});
      return undefined;
    }

    let cancelled = false;
    const loadAllScores = async () => {
      const rows = await Promise.all(subjects.map(async (subject) => {
        const [scoresResult, testsResult] = await Promise.all([
          classroomApi.listScores(selectedClassId, subject.id),
          classroomApi.listSubjectTests(selectedClassId, subject.id),
        ]);
        return [subject.id, {
          scores: Array.isArray(scoresResult?.scores) ? scoresResult.scores : [],
          tests: Array.isArray(testsResult?.tests) ? testsResult.tests : [],
        }];
      }));
      if (!cancelled) setAllSubjectScores(Object.fromEntries(rows));
    };
    loadAllScores().catch((error) => console.error('Không thể tải dữ liệu điểm:', error));
    const intervalId = window.setInterval(loadAllScores, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [selectedClassId, subjects]);

  useEffect(() => {
    if (!selectedClassId || !selectedSubjectId) {
      setScoreTests([]);
      setScoreRows([]);
      return undefined;
    }

    let cancelled = false;
    classroomApi.listSubjectTests(selectedClassId, selectedSubjectId)
      .then((result) => {
        if (!cancelled) setScoreTests(Array.isArray(result?.tests) ? result.tests : []);
      })
      .catch((error) => console.error('Không thể tải bài kiểm tra:', error));
    return () => { cancelled = true; };
  }, [selectedClassId, selectedSubjectId]);

  useEffect(() => {
    if (!selectedClassId || !selectedSubjectId) {
      setScoreRows([]);
      return undefined;
    }

    let cancelled = false;
    classroomApi.listScores(selectedClassId, selectedSubjectId)
      .then((result) => {
        if (!cancelled) setScoreRows(Array.isArray(result?.scores) ? result.scores : []);
      })
      .catch((error) => console.error('Không thể tải điểm:', error));
    return () => { cancelled = true; };
  }, [selectedClassId, selectedSubjectId]);

  const schoolYear = getSchoolYear(now);
  const semester = getSemester(now);
  const teacherSubject = getTeacherSubject(userDetails);
  const teacherSchool = getTeacherSchool(userDetails);

  const selectedClass = useMemo(
    () =>
      classes.find(
        (classItem) =>
          String(classItem.id) === String(selectedClassId)
      ) || null,
    [classes, selectedClassId]
  );

  const isClassOwner = Boolean(selectedClass?.teacherId && selectedClass.teacherId === currentUser?.uid);
  const canDeleteClass = isClassOwner || isAdminUser;
  const canManageClassMembers = isClassOwner || isAdminUser;

  const classMembers = useMemo(() => students.map((student) => {
    const profile = userProfilesByEmail[normalizeText(student.email)] || {};
    return {
      ...student,
      uid: student.uid || profile.uid || profile.id || '',
      name: student.name || profile.displayName || profile.name || profile.fullName || '',
      role: profile.role || student.role || student.userRole || student.memberRole || '',
      classRole: student.classRole || '',
      gender: student.gender || student.sex || profile.gender || profile.sex || '',
      photoURL: profile.customAvatar || profile.customAvatarUrl || profile.googlePhotoURL || profile.google_photo_url || profile.photoURL || profile.photoUrl || profile.avatarUrl || profile.avatar || student.customAvatar || student.customAvatarUrl || student.googlePhotoURL || student.google_photo_url || student.photoURL || student.photoUrl || student.avatarUrl || student.avatar || '',
    };
  }), [students, userProfilesByEmail]);

  const currentTeacherMember = useMemo(() => classMembers.find((member) => member.uid === currentUser?.uid || normalizeText(member.email) === normalizeText(currentUser?.email)) || null, [classMembers, currentUser?.email, currentUser?.uid]);
  const isInternTeacher = Boolean(currentTeacherMember && currentTeacherMember.classRole === 'intern_teacher');
  const canTeachClass = isClassOwner || isTeacherMember(currentTeacherMember);

  const attendanceStudents = useMemo(
    () => classMembers.filter((student) => !isTeacherMember(student) && student.uid !== selectedClass?.teacherId && normalizeText(student.email) !== normalizeText(selectedClass?.teacherEmail)),
    [classMembers, selectedClass?.teacherEmail, selectedClass?.teacherId]
  );

  const teacherMembers = useMemo(() => {
    const rows = [];
    if (selectedClass?.teacherId || selectedClass?.teacherEmail) {
      const ownerProfile = userProfilesByEmail[normalizeText(selectedClass.teacherEmail)] || {};
      rows.push({
        id: selectedClass.teacherId || `owner-${selectedClass.id}`,
        uid: selectedClass.teacherId || ownerProfile.uid || ownerProfile.id || '',
        name: selectedClass.teacherName || ownerProfile.displayName || ownerProfile.name || ownerProfile.fullName || (selectedClass.teacherId === currentUser?.uid ? currentUser?.displayName : '') || selectedClass.teacherEmail || 'Giáo viên',
        email: selectedClass.teacherEmail || ownerProfile.email || '',
        gender: selectedClass.teacherGender || ownerProfile.gender || ownerProfile.sex || '',
        role: 'TEACHER',
        photoURL: ownerProfile.customAvatar || ownerProfile.customAvatarUrl || ownerProfile.googlePhotoURL || ownerProfile.google_photo_url || ownerProfile.photoURL || ownerProfile.photoUrl || ownerProfile.avatarUrl || ownerProfile.avatar || selectedClass.teacherPhotoURL || selectedClass.teacherAvatar || (selectedClass.teacherId === currentUser?.uid ? getUserAvatar(currentUser) : '') || '',
        owner: true,
      });
    }
    classMembers.filter(isTeacherMember).forEach((teacher) => {
      const teacherUid = String(
        teacher.uid ||
        teacher.userId ||
        ''
      );

      const teacherEmail = normalizeText(
        teacher.email
      );

      const alreadyExists = rows.some((item) => {
        const itemUid = String(
          item.uid ||
          item.userId ||
          ''
        );

        const itemEmail = normalizeText(
          item.email
        );

        return (
          (teacherUid && itemUid && teacherUid === itemUid) ||
          (teacherEmail && itemEmail && teacherEmail === itemEmail)
        );
      });

      if (!alreadyExists) {
        rows.push(teacher);
      }
    });
    return rows;
  }, [classMembers, currentUser?.displayName, currentUser?.photoURL, currentUser?.uid, selectedClass, userProfilesByEmail]);

  const internTeacherMembers = useMemo(() => teacherMembers.filter((teacher) => !teacher.owner && teacher.classRole === 'intern_teacher'), [teacherMembers]);

  const getInternAttendanceMetrics = (teacher = {}) => {
    let present = 0; let excused = 0; let total = 0;
    attendanceRecords.forEach((record) => {
      const rows = Array.isArray(record.internRecords) ? record.internRecords : [];
      const row = rows.find((item) => item.teacherId === teacher.id || item.uid === teacher.uid || normalizeText(item.email) === normalizeText(teacher.email));
      if (!row) return;
      total += 1;
      if (normalizeAttendanceStatus(row.status) === 'present') present += 1;
      if (normalizeAttendanceStatus(row.status) === 'excused') excused += 1;
    });
    return { present, excused, total, rate: total ? Math.round((present / total) * 100) : null };
  };

  const setInternTeacherRole = async (teacher) => {
    if (!isClassOwner || !selectedClassId || !teacher?.id || teacher.owner) return;
    await classroomApi.updateMember(selectedClassId, teacher.id, { classRole: 'intern_teacher' });
    setTeacherRowMenuId('');
  };

  const removeInternTeacherRole = async (teacher) => {
    if (!isClassOwner || !selectedClassId || !teacher?.id || teacher.owner) return;
    await classroomApi.updateMember(selectedClassId, teacher.id, { classRole: '' });
    setTeacherRowMenuId('');
  };

  const openDeleteTeacher = (teacher) => {
    if (!isClassOwner || !teacher?.id || teacher.owner) return;
    setTeacherRowMenuId('');
    setTeacherToDelete(teacher);
    setTeacherDeleteError('');
    setTeacherDeleteOpen(true);
  };

  const closeDeleteTeacher = () => {
    if (deletingTeacher) return;
    setTeacherDeleteOpen(false);
    setTeacherToDelete(null);
    setTeacherDeleteError('');
  };

  const handleDeleteTeacher = async () => {
    if (!isClassOwner) {
      setTeacherDeleteError('Chỉ giáo viên chủ lớp mới có thể xóa giáo viên khác khỏi lớp.');
      return;
    }
    if (!selectedClassId || !teacherToDelete?.id || teacherToDelete.owner) {
      setTeacherDeleteError('Không tìm thấy giáo viên cần xóa khỏi lớp.');
      return;
    }
    try {
      setDeletingTeacher(true);
      setTeacherDeleteError('');
      await classroomApi.deleteMember(selectedClassId, teacherToDelete.id);
      setTeacherDeleteOpen(false);
      setTeacherToDelete(null);
    } catch (error) {
      console.error('Không thể xóa giáo viên khỏi lớp:', error);
      setTeacherDeleteError(error?.message || 'Không thể xóa giáo viên khỏi lớp. Vui lòng thử lại.');
    } finally {
      setDeletingTeacher(false);
    }
  };

  const saveInternAttendanceStatus = async (teacher, status) => {
    if (!isClassOwner || !selectedClassId || !teacher?.id) return;

    try {
      const result =
        await classroomApi.updateInternAttendance(
          selectedClassId,
          attendanceDate,
          teacher.id,
          {
            status,
          }
        );

      if (result?.attendance) {
        const savedAttendance = result.attendance;

        setAttendanceRecords((current) => {
          const exists = current.some(
            (item) =>
              String(item.id) === String(savedAttendance.id)
              || item.date === savedAttendance.date
              || item.attendanceDate === savedAttendance.attendanceDate
          );

          if (!exists) {
            return [
              savedAttendance,
              ...current,
            ];
          }

          return current.map((item) =>
            (
              String(item.id) === String(savedAttendance.id)
              || item.date === savedAttendance.date
              || item.attendanceDate === savedAttendance.attendanceDate
            )
              ? savedAttendance
              : item
          );
        });
      }
    } catch (error) {
      console.error(
        'Không thể cập nhật điểm danh giáo viên thực tập:',
        error
      );
    }
  };

  const leaveClassAsIntern = async () => {
    if (!isInternTeacher || !selectedClassId || !currentUser?.uid || !currentTeacherMember?.id) return;
    await classroomApi.leaveClassroom(selectedClassId);
    goBackToClassList();
  };

  const classResources = useMemo(() => {
    const rows = [];
    (assignmentsByClass[selectedClassId] || []).forEach((assignment) => (Array.isArray(assignment.attachments) ? assignment.attachments : []).forEach((file, index) => rows.push({ id: `a-${assignment.id}-${index}`, name: file.name || file.title || `Tệp ${index + 1}`, url: file.url || file.href || '', source: getAssignmentTitle(assignment) })));
    notifications.forEach((notification) => (Array.isArray(notification.attachments) ? notification.attachments : []).forEach((file, index) => rows.push({ id: `n-${notification.id}-${index}`, name: file.name || file.title || `Tệp ${index + 1}`, url: file.url || file.href || '', source: notification.title || 'Thông báo' })));
    return rows;
  }, [assignmentsByClass, notifications, selectedClassId]);


  const eLearningResourceCounts = useMemo(() => {
    const className = normalizeText(selectedClass?.name || selectedClass?.className || '');
    const classId = String(selectedClassId || '');
    const currentUid = String(currentUser?.uid || '');
    const rows = eLearningCourses.map((course) => {
      const ownerIds = [course.teacherId, course.createdByUid, course.createdBy, course.ownerId, course.userId, course.uid]
        .filter(Boolean)
        .map(String);
      const visibility = normalizeText(course.visibility || 'public');
      const courseClassName = normalizeText(course.className || course.class || course.lop || '');
      const courseClassId = String(course.classId || '');
      const status = normalizeText(course.status || course.moderationStatus || 'approved');
      const isDirectClassPost = visibility === 'class' && Boolean((courseClassId && courseClassId === classId) || (!courseClassId && className && courseClassName === className));
      const isLegacyDirectClassPost = visibility === 'private' && className && courseClassName === className && !['10', '11', '12'].includes(courseClassName);
      return {
        course,
        isOwner: Boolean(currentUid && ownerIds.includes(currentUid)),
        isForClass: Boolean(isDirectClassPost || isLegacyDirectClassPost),
        isPublicApproved: visibility === 'public' && status === 'approved',
        isApproved: status === 'approved',
      };
    });
    return {
      class: rows.filter((item) => item.isForClass).length,
      mine: rows.filter((item) => item.isOwner).length,
      public: rows.filter((item) => item.isPublicApproved).length,
      approved: rows.filter((item) => item.isApproved).length,
    };
  }, [currentUser?.uid, eLearningCourses, selectedClass?.className, selectedClass?.name, selectedClassId]);

  const visibleELearningResources = useMemo(() => {
    const className = normalizeText(selectedClass?.name || selectedClass?.className || '');
    const currentUid = String(currentUser?.uid || '');
    const keyword = normalizeText(eLearningResourceSearch);

    const filtered = eLearningCourses.filter((course) => {
      const ownerIds = [course.teacherId, course.createdByUid, course.createdBy, course.ownerId, course.userId, course.uid]
        .filter(Boolean)
        .map(String);
      const isOwner = Boolean(currentUid && ownerIds.includes(currentUid));
      const status = normalizeText(course.status || course.moderationStatus || 'approved');
      const visibility = normalizeText(course.visibility || 'public');
      const courseClassName = normalizeText(course.className || course.class || course.lop || '');
      const courseClassId = String(course.classId || '');
      const isDirectClassPost = visibility === 'class' && Boolean((courseClassId && courseClassId === String(selectedClassId || '')) || (!courseClassId && className && courseClassName === className));
      const isLegacyDirectClassPost = visibility === 'private' && className && courseClassName === className && !['10', '11', '12'].includes(courseClassName);
      const isForClass = Boolean(isDirectClassPost || isLegacyDirectClassPost);

      if (eLearningResourceScope === 'class' && !isForClass) return false;
      if (eLearningResourceScope === 'mine' && !isOwner) return false;
      if (eLearningResourceScope === 'public' && (visibility !== 'public' || status !== 'approved')) return false;

      const format = getELearningCourseFormat(course);
      if (eLearningResourceFormat !== 'all' && format !== eLearningResourceFormat) return false;

      if (keyword) {
        const haystack = [
          stripELearningHtml(course.title),
          stripELearningHtml(course.topic),
          stripELearningHtml(course.description),
          course.category,
          course.teacherName,
          course.teacherEmail,
          course.courseCode,
          course.className,
        ].map((value) => normalizeText(value)).join(' ');
        if (!haystack.includes(keyword)) return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (eLearningResourceSort === 'oldest') return getTimeValue(a.createdAt || a.updatedAt) - getTimeValue(b.createdAt || b.updatedAt);
      if (eLearningResourceSort === 'views') return Number(b.views || 0) - Number(a.views || 0) || getTimeValue(b.createdAt || b.updatedAt) - getTimeValue(a.createdAt || a.updatedAt);
      return getTimeValue(b.createdAt || b.updatedAt) - getTimeValue(a.createdAt || a.updatedAt);
    });
  }, [currentUser?.uid, eLearningCourses, eLearningResourceFormat, eLearningResourceScope, eLearningResourceSearch, eLearningResourceSort, selectedClass?.className, selectedClass?.name, selectedClassId]);

  const openELearningResource = (course) => {
    if (!course?.id || typeof window === 'undefined') return;
    window.location.assign(`/e-learning/${encodeURIComponent(course.id)}`);
  };

  const normalizedELearningPublisherRole = String(userDetails?.role || '')
    .trim()
    .replace(/[\s_-]/g, '')
    .toUpperCase();
  const canCreateClassELearning = Boolean(currentUser?.uid) && ['TEACHER', 'ADMIN_DEV'].includes(normalizedELearningPublisherRole);
  const eLearningPublisherName =
    userDetails?.fullName ||
    userDetails?.name ||
    userDetails?.displayName ||
    currentUser?.displayName ||
    currentUser?.email ||
    'Giáo viên ZUNY';

  const buildClassELearningCreateForm = (contentType = 'video') => {
    const rawSubject = selectedClass?.subject || userDetails?.subject || userDetails?.teachingSubject || '';
    const nextForm = getELearningEmptyForm(rawSubject && rawSubject !== 'Môn học' ? rawSubject : '');
    const randomCode = String(Math.floor(1000 + Math.random() * 9000));
    nextForm.attachMode = contentType === 'document' ? 'document' : contentType === 'simulation' ? 'simulation' : 'youtube';
    nextForm.lessons = [];
    nextForm.courseRandomCode = randomCode;
    nextForm.courseCode = generateELearningCourseCode(eLearningPublisherName, nextForm.category, randomCode);
    nextForm.visibility = 'class';
    nextForm.classId = String(selectedClassId || '');
    nextForm.className = selectedClass?.name || selectedClass?.className || '';
    return nextForm;
  };

  const openClassELearningPublisher = () => {
    if (!selectedClassId || !currentUser?.uid) return;
    if (!canCreateClassELearning) {
      window.alert('Tài khoản hiện tại không có quyền đăng bài E-learning.');
      return;
    }
    setELearningCreateNotice('');
    setELearningCreateTypeOpen(true);
  };

  const openClassELearningCreateForm = (contentType = 'video') => {
    if (!selectedClassId || !canCreateClassELearning) return;
    const nextType = ['document', 'simulation'].includes(contentType) ? contentType : 'video';
    setELearningCreateType(nextType);
    setELearningCreateForm(buildClassELearningCreateForm(nextType));
    setELearningCreateTypeOpen(false);
    setELearningCreateOpen(true);
  };

  const resetClassELearningCreateForm = () => {
    setELearningCreateForm(buildClassELearningCreateForm(eLearningCreateType));
  };

  const handleClassELearningWordUpload = async (event) => {
    const input = event?.target;
    const file = input?.files?.[0];
    if (!file || !currentUser?.uid || !canCreateClassELearning) return;
    try {
      setELearningCreateUploadingWord(true);
      const lowerName = String(file.name || '').toLowerCase();
      if (file.size > 20 * 1024 * 1024) {
        window.alert('Tài liệu vượt quá giới hạn 20 MB.');
        return;
      }
      if (!lowerName.endsWith('.pdf') && !lowerName.endsWith('.doc') && !lowerName.endsWith('.docx')) {
        window.alert('Chỉ hỗ trợ file Word (.doc, .docx) hoặc PDF.');
        return;
      }
      const extractedHtml = lowerName.endsWith('.docx') ? await extractClassELearningDocxHtml(file).catch(() => '') : '';
      const uploadResult = await eLearningApi.uploadAsset(
        file,
        'course-file',
        'course-files',
      );
      const fileUrl =
        uploadResult?.url ||
        uploadResult?.publicUrl ||
        uploadResult?.fileUrl ||
        uploadResult?.downloadUrl ||
        '';
      if (!fileUrl) throw new Error('R2 không trả về URL của tài liệu.');
      const documentFileType = lowerName.endsWith('.pdf') ? 'pdf' : lowerName.endsWith('.docx') ? 'docx' : 'doc';
      setELearningCreateForm((current) => ({
        ...current,
        documentMode: 'upload',
        documentFileType,
        wordFileName: file.name,
        wordFileUrl: fileUrl,
        documentFileSize: Number(file.size || 0),
        richDocument: extractedHtml || current.richDocument || '',
      }));
    } catch (uploadError) {
      console.error('Không thể tải tài liệu E-learning từ lớp:', uploadError);
      window.alert('Không thể tải file. Vui lòng thử lại.');
    } finally {
      if (input) input.value = '';
      setELearningCreateUploadingWord(false);
    }
  };

  const handleClassELearningImageUpload = async (event, target = 'thumbnail') => {
    const input = event?.target;
    const file = input?.files?.[0];
    if (!file || !currentUser?.uid || !canCreateClassELearning) return;
    const extension = String(file.name || '').toLowerCase().split('.').pop();
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    if (!allowedMime.includes(file.type) && !allowedExtensions.includes(extension)) {
      window.alert('Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      window.alert('Ảnh vượt quá giới hạn 5 MB.');
      return;
    }
    try {
      setELearningCreateUploadingImage(true);
      const uploadResult = await eLearningApi.uploadAsset(
        file,
        'course-image',
        target === 'document' ? 'document-images' : 'course-images',
      );
      const imageUrl =
        uploadResult?.url ||
        uploadResult?.publicUrl ||
        uploadResult?.fileUrl ||
        uploadResult?.downloadUrl ||
        '';
      if (!imageUrl) throw new Error('R2 không trả về URL của ảnh.');
      setELearningCreateForm((current) => target === 'document'
        ? {
          ...current,
          documentMode: 'image',
          documentImageUrl: imageUrl,
          documentImageName: file.name,
          documentImageSize: Number(file.size || 0),
          wordFileName: '',
          wordFileUrl: '',
          documentFileSize: 0,
          richDocument: '',
        }
        : { ...current, thumbnail: imageUrl, thumbnailFileName: file.name });
    } catch (uploadError) {
      console.error('Không thể tải ảnh E-learning từ lớp:', uploadError);
      window.alert(`Không thể tải ảnh${uploadError?.message ? `: ${uploadError.message}` : '.'}`);
    } finally {
      if (input) input.value = '';
      setELearningCreateUploadingImage(false);
    }
  };

  const handleClassELearningVideoUpload = async (event, lessonIndex = null) => {
    const input = event?.target;
    const file = input?.files?.[0];
    if (!file || !currentUser?.uid || !canCreateClassELearning) return;
    const fileName = String(file.name || '');
    if (file.type !== 'video/mp4' && !fileName.toLowerCase().endsWith('.mp4')) {
      window.alert('Chỉ hỗ trợ file MP4.');
      return;
    }
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      window.alert(file.size <= 0 ? 'File video không hợp lệ hoặc đang rỗng.' : `Video có dung lượng ${(file.size / 1024 / 1024).toFixed(2)} MB, vượt giới hạn 5 MB.`);
      return;
    }
    try {
      setELearningCreateUploadingVideo(true);
      const durationSeconds = await Promise.race([
        getELearningMp4DurationFromFile(file),
        new Promise((resolve) => window.setTimeout(() => resolve(0), 8000)),
      ]);
      const uploadResult = await eLearningApi.uploadAsset(
        file,
        'course-video',
        'course-videos',
      );
      const videoUrl =
        uploadResult?.url ||
        uploadResult?.publicUrl ||
        uploadResult?.fileUrl ||
        uploadResult?.downloadUrl ||
        '';
      if (!videoUrl) throw new Error('R2 không trả về URL của video.');
      const duration = formatELearningDuration(durationSeconds);
      if (lessonIndex === null) {
        setELearningCreateForm((current) => ({
          ...current,
          videoSourceType: 'upload',
          attachMode: 'mp4',
          youtubeUrl: '',
          mp4FileName: fileName,
          mp4FileUrl: videoUrl,
          durationSeconds: Number(durationSeconds || 0),
          duration,
          estimatedMinutes: durationSeconds ? Math.ceil(durationSeconds / 60) : 0,
        }));
      } else {
        setELearningCreateForm((current) => {
          const lessons = Array.isArray(current.lessons) ? [...current.lessons] : [];
          lessons[lessonIndex] = {
            ...(lessons[lessonIndex] || {}),
            videoSourceType: 'upload',
            attachMode: 'mp4',
            youtubeUrl: '',
            mp4FileName: fileName,
            mp4FileUrl: videoUrl,
            durationSeconds: Number(durationSeconds || 0),
            duration,
          };
          return { ...current, lessons };
        });
      }
    } catch (uploadError) {
      console.error('Không thể tải video E-learning từ lớp:', uploadError);
      const status = Number(uploadError?.response?.status || uploadError?.status || 0);
      if (status === 401 || status === 403) window.alert('Hệ thống từ chối quyền tải video. Vui lòng đăng nhập lại hoặc kiểm tra quyền lớp.');
      else if (status === 429) window.alert('Bạn thao tác quá nhanh. Vui lòng chờ rồi thử lại.');
      else window.alert(`Không thể tải video lên hệ thống${uploadError?.message ? `: ${uploadError.message}` : '.'}`);
    } finally {
      if (input) input.value = '';
      setELearningCreateUploadingVideo(false);
    }
  };

  const publishClassELearningCourse = async () => {
    if (!selectedClassId || !currentUser?.uid || !canCreateClassELearning || eLearningCreatePublishing) return;
    if (!stripELearningHtml(eLearningCreateForm.title).trim() || !stripELearningHtml(eLearningCreateForm.topic).trim()) {
      window.alert('Vui lòng nhập tên bài học và chủ đề.');
      return;
    }
    const titleWords = countELearningWords(eLearningCreateForm.title);
    const topicWords = countELearningWords(eLearningCreateForm.topic);
    const descriptionWords = countELearningWords(eLearningCreateForm.description);
    if (titleWords > courseTextLimits.titleWords || topicWords > courseTextLimits.topicWords || descriptionWords > courseTextLimits.descriptionWords) {
      window.alert(`Giới hạn nội dung: tên bài tối đa ${courseTextLimits.titleWords} từ, chủ đề tối đa ${courseTextLimits.topicWords} từ và mô tả tối đa ${courseTextLimits.descriptionWords} từ.`);
      return;
    }
    if (eLearningCreateForm.visibility === 'private' && !eLearningCreateForm.className) {
      window.alert('Vui lòng chọn khối được xem bài học.');
      return;
    }
    if (eLearningCreateForm.visibility === 'class' && !eLearningCreateForm.classId) {
      window.alert('Vui lòng chọn lớp được xem bài học.');
      return;
    }
    if (eLearningCreateType === 'video' && !(Array.isArray(eLearningCreateForm.lessons) && eLearningCreateForm.lessons.some((lesson) => String(lesson.youtubeUrl || lesson.lumiUrl || lesson.mp4FileUrl || '').trim()))) {
      window.alert('Vui lòng thêm ít nhất một video trong tab Danh sách bài trước khi đăng.');
      return;
    }

    try {
      setELearningCreatePublishing(true);
      const lessons = Array.isArray(eLearningCreateForm.lessons) ? eLearningCreateForm.lessons : [];
      const firstLesson = lessons[0] || {};
      const totalDurationSeconds = Number(firstLesson.durationSeconds || eLearningCreateForm.durationSeconds || 0);
      const duration = firstLesson.duration || eLearningCreateForm.duration || formatELearningDuration(totalDurationSeconds);
      const approved =
        normalizedELearningPublisherRole === 'ADMIN_DEV' ||
        eLearningCreateForm.visibility === 'class';
      await eLearningApi.createCourse({
        title: eLearningCreateForm.title,
        topic: eLearningCreateForm.topic,
        description: eLearningCreateForm.description,
        content: eLearningCreateForm.content,
        category: eLearningCreateForm.category,
        thumbnail: eLearningCreateForm.thumbnail,
        thumbnailFileName: eLearningCreateForm.thumbnailFileName || '',
        documentImageUrl: eLearningCreateForm.documentImageUrl || '',
        documentImageName: eLearningCreateForm.documentImageName || '',
        documentImageSize: Number(eLearningCreateForm.documentImageSize || 0),
        documentFileSize: Number(eLearningCreateForm.documentFileSize || 0),
        contentType: eLearningCreateType,
        simulationMode: eLearningCreateForm.simulationMode || '',
        simulationUrl: eLearningCreateForm.simulationUrl || '',
        simulationHtml: eLearningCreateForm.simulationHtml || '',
        simulationLanguage: eLearningCreateForm.simulationLanguage || 'html',
        simulationCode: eLearningCreateForm.simulationCode || '',
        simulationCodes: eLearningCreateForm.simulationCodes || {},
        simulationInstructions: eLearningCreateForm.simulationInstructions || '',
        youtubeUrl: firstLesson.youtubeUrl || '',
        lumiUrl: firstLesson.lumiUrl || '',
        wordFileName: eLearningCreateForm.wordFileName,
        wordFileUrl: eLearningCreateForm.wordFileUrl,
        richDocument: eLearningCreateForm.richDocument,
        documentMode: eLearningCreateForm.documentMode || '',
        documentFileType: eLearningCreateForm.documentFileType || '',
        learningObjectives: normalizeELearningTextList(eLearningCreateForm.learningObjectives),
        prerequisites: normalizeELearningTextList(eLearningCreateForm.prerequisites),
        difficulty: eLearningCreateForm.difficulty || 'medium',
        estimatedMinutes: Number(eLearningCreateForm.estimatedMinutes || 0),
        checklist: normalizeELearningChecklist(eLearningCreateForm.checklist),
        quiz: normalizeELearningQuiz(eLearningCreateForm.quiz),
        teacherCode: '',
        courseCode: eLearningCreateForm.courseCode || generateELearningCourseCode(eLearningPublisherName, eLearningCreateForm.category, eLearningCreateForm.courseRandomCode),
        visibility: eLearningCreateForm.visibility,
        className: ['private', 'class'].includes(eLearningCreateForm.visibility) ? eLearningCreateForm.className : '',
        classId: eLearningCreateForm.visibility === 'class' ? eLearningCreateForm.classId || '' : '',
        openAt: eLearningCreateForm.openAt,
        openAtMs: getELearningOpenAtMs(eLearningCreateForm.openAt),
        attachMode: firstLesson.attachMode || eLearningCreateForm.attachMode,
        codeLanguage: eLearningCreateForm.codeLanguage || 'javascript',
        codeContent: eLearningCreateForm.codeContent,
        lessonTopics: Array.isArray(eLearningCreateForm.lessonTopics) ? eLearningCreateForm.lessonTopics : [],
        lessons,
        lessonCount: lessons.length,
        mp4FileName: firstLesson.mp4FileName || '',
        mp4FileUrl: firstLesson.mp4FileUrl || '',
        videoSourceType: firstLesson.videoSourceType || '',
        durationSeconds: totalDurationSeconds,
        duration: duration || '---',
        youtubeDuration: duration || '---',
        videoSources: Array.isArray(eLearningCreateForm.videoSources) ? eLearningCreateForm.videoSources : [],
        publishConfirmed: Boolean(eLearningCreateForm.publishConfirmed),
        teacherId: currentUser.uid,
        createdByUid: currentUser.uid,
        teacherEmail: currentUser.email || '',
        teacherName: eLearningPublisherName,
        teacherSubject: eLearningCreateForm.category,
        createdByRole: userDetails?.role || 'TEACHER',
        studentCount: 0,
        rating: 0,
        ratingTotal: 0,
        ratingCount: 0,
        views: 0,
        isFeatured: false,
        status: approved ? 'approved' : 'pending',
        moderationStatus: approved ? 'approved' : 'pending',
      });
      setELearningCreateOpen(false);
      setELearningCreateForm(buildClassELearningCreateForm(eLearningCreateType));
      setELearningResourceScope('class');
      setELearningCreateNotice(eLearningCreateForm.visibility === 'class'
        ? 'Đã đăng bài E-learning cho lớp. Bài đang đồng bộ vào danh sách Học liệu.'
        : approved ? 'Đã xuất bản bài E-learning.' : 'Đã gửi bài E-learning vào quy trình kiểm duyệt hiện tại.');
    } catch (error) {
      console.error('Không thể tạo bài E-learning từ workspace lớp:', error);
      window.alert(error?.message || 'Không thể tạo bài học. Vui lòng thử lại.');
    } finally {
      setELearningCreatePublishing(false);
    }
  };

  const joinedClassMemberCount = attendanceStudents.length;

  const classToDelete = useMemo(
    () =>
      classes.find((classItem) => classItem.id === deleteClassId) ||
      selectedClass ||
      null,
    [classes, deleteClassId, selectedClass]
  );

  const classToSettings = useMemo(
    () =>
      classes.find((classItem) => classItem.id === settingsClassId) ||
      selectedClass ||
      null,
    [classes, settingsClassId, selectedClass]
  );

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) || null,
    [subjects, selectedSubjectId]
  );

  const studentProfile = useMemo(
    () => students.find((student) => student.id === studentProfileId) || null,
    [studentProfileId, students]
  );

  const getStudentAttendanceMetrics = (student = {}) => {
    const studentKeys = new Set([student.id, student.studentId, normalizeText(student.email)].filter(Boolean));
    let present = 0;
    let absent = 0;
    let late = 0;
    let total = 0;
    attendanceRecords.forEach((record) => {
      const directStudentId = record.studentId || record.uid || record.userId;
      const directEmail = normalizeText(record.studentEmail || record.email);
      const belongsDirectly = (directStudentId && studentKeys.has(directStudentId)) || (directEmail && studentKeys.has(directEmail));
      const detailRows = Array.isArray(record.students)
        ? record.students
        : Array.isArray(record.records)
          ? record.records
          : Array.isArray(record.attendees)
            ? record.attendees
            : record.records && typeof record.records === 'object'
              ? Object.entries(record.records).map(([studentId, value]) => ({ studentId, ...(typeof value === 'string' ? { status: value } : value) }))
              : [];
      const detail = detailRows.find((item) => studentKeys.has(item?.studentId || item?.id || item?.uid) || studentKeys.has(normalizeText(item?.email)));
      const source = detail || (belongsDirectly ? record : null);
      if (!source) return;
      const status = getAttendanceStatus(source);
      const isLate = ['late', 'trễ', 'tre', 'đi muộn', 'di muon'].includes(status);
      const isPresent = isPresentStatus(status);
      const isAbsent = isAbsentStatus(status);
      present += isPresent ? 1 : 0;
      late += isLate ? 1 : 0;
      absent += isAbsent ? 1 : 0;
      total += 1;
    });
    return { present, absent, late, total, rate: total ? Math.round((present / total) * 100) : null };
  };

  const getStudentAverageAcrossSubjects = (student = {}) => {
    const values = subjects.map((subject) => {
      const source = allSubjectScores[subject.id] || {};
      const row = (source.scores || []).find((item) => (item.studentId || item.id) === student.id);
      if (!row) return null;
      const direct = toNumber(row.average);
      if (direct !== null) return direct;
      return averageFromScores((source.tests || []).map((test) => row.scores?.[test.id]));
    }).filter((value) => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };

  const getStudentAttentionLevel = (student = {}) => normalizeText(student.attentionLevel || student.riskLevel || student.alertLevel || student.statusLevel);

  const studentListRows = useMemo(() => {
    const keyword = normalizeText(queryText);
    const rows = attendanceStudents.map((student, index) => {
      const attendance = getStudentAttendanceMetrics(student);
      const average = getStudentAverageAcrossSubjects(student);
      const level = getStudentAttentionLevel(student);
      const rankSource = average === null ? -1 : average;
      return { student, index, attendance, average, level, rankSource };
    }).filter(({ student, index }) => !keyword || [getStudentDisplayName(student), getStudentCode(student, index), student.email, student.parentName, student.guardianName, student.parentPhone, student.phone].some((value) => normalizeText(value).includes(keyword)));
    rows.sort((a, b) => {
      if (studentSort === 'name') return normalizeText(getStudentDisplayName(a.student)).localeCompare(normalizeText(getStudentDisplayName(b.student)));
      if (studentSort === 'average') return (b.average ?? -1) - (a.average ?? -1);
      return b.rankSource - a.rankSource || getTimeValue(a.student.createdAt) - getTimeValue(b.student.createdAt);
    });
    let rank = 0;
    let lastScore = null;
    return rows.map((row, idx) => {
      if (row.average !== null && row.average !== lastScore) rank = idx + 1;
      if (row.average !== null) lastScore = row.average;
      return { ...row, rank: row.average === null ? null : rank };
    });
  }, [allSubjectScores, attendanceRecords, attendanceStudents, queryText, studentSort, subjects]);

  const studentStatusSummary = useMemo(() => attendanceStudents.reduce((acc, student) => {
    const level = getStudentAttentionLevel(student);
    if (['emergency', 'urgent', 'khẩn cấp', 'khan cap', 'critical'].includes(level)) acc.emergency += 1;
    else if (['watch', 'warning', 'cần theo dõi', 'can theo doi', 'cảnh báo', 'canh bao'].includes(level)) acc.watch += 1;
    else if (['normal', 'bình thường', 'binh thuong', 'ok'].includes(level)) acc.normal += 1;
    else acc.unclassified += 1;
    return acc;
  }, { normal: 0, watch: 0, emergency: 0, unclassified: 0 }), [attendanceStudents]);

  const selectedAttendanceRecord = useMemo(() => {
    const selectedStart = new Date(`${attendanceDate}T00:00:00`).getTime();
    const selectedEnd = selectedStart + 24 * 60 * 60 * 1000;
    return attendanceRecords.find((record) => {
      if (record.id === attendanceDate || record.date === attendanceDate || record.attendanceDate === attendanceDate) return true;
      const time = getRecordDateValue(record);
      return time >= selectedStart && time < selectedEnd;
    }) || null;
  }, [attendanceDate, attendanceRecords]);

  const todayAttendanceSaved = useMemo(() => {
    const todayKey = getLocalDateKey(now);
    const record = attendanceRecords.find((item) => item.id === todayKey || item.date === todayKey || item.attendanceDate === todayKey);
    return Boolean(record && Array.isArray(record.records) && record.records.length > 0);
  }, [attendanceRecords, now]);

  useEffect(() => {
    if (!selectedClassId) return;
    const next = {};
    const record = selectedAttendanceRecord;
    const rows = Array.isArray(record?.records)
      ? record.records
      : Array.isArray(record?.students)
        ? record.students
        : Array.isArray(record?.attendees)
          ? record.attendees
          : record?.records && typeof record.records === 'object'
            ? Object.entries(record.records).map(([studentId, value]) => ({ studentId, ...(typeof value === 'string' ? { status: value } : value) }))
            : [];
    rows.forEach((row) => {
      const studentId = row.studentId || row.id || row.uid;
      if (!studentId) return;
      next[studentId] = { status: normalizeAttendanceStatus(row.status || row.attendanceStatus || row.state), note: row.note || row.notes || '' };
    });
    const pendingQr = record?.qrCheckIns && typeof record.qrCheckIns === 'object' ? record.qrCheckIns : {};
    attendanceStudents.forEach((student) => {
      if (!next[student.id]) next[student.id] = { status: '', note: '' };
      if (pendingQr[student.id]) { const checkIn = pendingQr[student.id]; next[student.id] = { ...next[student.id], status: normalizeAttendanceStatus(checkIn?.status) || 'present', note: checkIn?.note || next[student.id]?.note || '' }; }
    });
    setAttendanceDraft(next);
    setAttendanceDirty(Object.keys(pendingQr).some((studentId) => attendanceStudents.some((student) => student.id === studentId)));
    setAttendanceSaveError('');
  }, [attendanceDate, attendanceStudents, selectedAttendanceRecord, selectedClassId]);

  const attendancePageStats = useMemo(() => {
    const values = attendanceStudents.map((student) => attendanceDraft[student.id]?.status || '');
    const present = values.filter((value) => value === 'present').length;
    const late = values.filter((value) => value === 'late').length;
    const absent = values.filter((value) => value === 'absent').length;
    const excused = values.filter((value) => value === 'excused').length;
    const total = attendanceStudents.length;
    const rate = total ? ((present + late * 0.5) / total) * 100 : 0;
    return { total, present, late, absent, excused, rate };
  }, [attendanceDraft, attendanceStudents]);

  const setAttendanceStudentStatus = (studentId, status) => {
    setAttendanceDraft((current) => ({ ...current, [studentId]: { ...(current[studentId] || {}), status } }));
    setAttendanceDirty(true);
  };

  const setAttendanceStudentNote = (studentId, note) => {
    setAttendanceDraft((current) => ({ ...current, [studentId]: { ...(current[studentId] || {}), note } }));
    setAttendanceDirty(true);
  };

  const markAllAttendance = (status) => {
    setAttendanceDraft((current) => Object.fromEntries(attendanceStudents.map((student) => [student.id, { ...(current[student.id] || {}), status }])));
    setAttendanceDirty(true);
  };

  const saveAttendance = async () => {
    if (
      !selectedClassId
      || !currentUser?.uid
      || attendanceSaving
    ) {
      return;
    }

    try {
      setAttendanceSaving(true);
      setAttendanceSaveError('');

      const records = attendanceStudents.map(
        (student) => ({
          studentId: student.id,
          email: student.email || '',
          status:
            attendanceDraft[student.id]?.status
            || '',
          note:
            attendanceDraft[student.id]
              ?.note
              ?.trim()
            || '',
        })
      );

      const result =
        await classroomApi.saveAttendance(
          selectedClassId,
          attendanceDate,
          {
            records,
            clearQrCheckIns: true,
          }
        );

      const savedAttendance =
        result?.attendance
        || null;

      if (savedAttendance) {
        setAttendanceRecords((current) => {
          const exists = current.some(
            (item) =>
              String(item.id) === String(savedAttendance.id)
              || item.date === savedAttendance.date
              || item.attendanceDate === savedAttendance.attendanceDate
          );

          if (!exists) {
            return [
              savedAttendance,
              ...current,
            ];
          }

          return current.map((item) =>
            (
              String(item.id) === String(savedAttendance.id)
              || item.date === savedAttendance.date
              || item.attendanceDate === savedAttendance.attendanceDate
            )
              ? savedAttendance
              : item
          );
        });
      }

      try {
        const historyResult =
          await classroomApi.getAttendanceHistory(
            selectedClassId,
            attendanceDate
          );

        setAttendanceHistoryEntries(
          Array.isArray(historyResult?.history)
            ? historyResult.history
            : Array.isArray(historyResult?.records)
              ? historyResult.records
              : []
        );
      } catch (historyError) {
        console.error(
          'Không thể tải lại lịch sử điểm danh:',
          historyError
        );
      }

      setAttendanceDirty(false);
    } catch (error) {
      console.error(
        'Không thể lưu điểm danh:',
        error
      );

      setAttendanceSaveError(
        error?.message
        || 'Không thể lưu điểm danh. Vui lòng thử lại.'
      );
    } finally {
      setAttendanceSaving(false);
    }
  };

  const ensureAttendanceQrSession = async (force = false) => {
    if (
      !selectedClassId
      || !attendanceDate
      || !currentUser?.uid
      || attendanceQrCreating
    ) {
      return;
    }

    const currentToken =
      selectedAttendanceRecord?.qrToken
      || '';

    const currentExpiry = Number(
      selectedAttendanceRecord?.qrExpiresAt
      || 0
    );

    if (
      !force
      && currentToken
      && currentExpiry > Date.now() + 3000
    ) {
      return;
    }

    try {
      setAttendanceQrCreating(true);
      setAttendanceQrError('');

      const result =
        await classroomApi.createAttendanceQr(
          selectedClassId,
          attendanceDate,
          {
            ttlSeconds: 600,
          }
        );

      if (result?.attendance) {
        const savedAttendance = result.attendance;

        setAttendanceRecords((current) => {
          const exists = current.some(
            (item) =>
              String(item.id) === String(savedAttendance.id)
              || item.date === savedAttendance.date
              || item.attendanceDate === savedAttendance.attendanceDate
          );

          if (!exists) {
            return [
              savedAttendance,
              ...current,
            ];
          }

          return current.map((item) =>
            (
              String(item.id) === String(savedAttendance.id)
              || item.date === savedAttendance.date
              || item.attendanceDate === savedAttendance.attendanceDate
            )
              ? savedAttendance
              : item
          );
        });
      }
    } catch (error) {
      console.error(
        'Không thể tạo QR điểm danh:',
        error
      );

      setAttendanceQrError(
        error?.message
        || 'Không thể tạo mã QR điểm danh.'
      );
    } finally {
      setAttendanceQrCreating(false);
    }
  };

  useEffect(() => {
    if (attendanceMode !== 'qr' || !selectedClassId || !currentUser?.uid) return undefined;
    ensureAttendanceQrSession();
    const timer = window.setInterval(() => {
      const expiry = Number(selectedAttendanceRecord?.qrExpiresAt || 0);
      if (!expiry || Date.now() >= expiry) ensureAttendanceQrSession(true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [attendanceMode, attendanceDate, currentUser?.uid, selectedClassId, selectedAttendanceRecord?.qrExpiresAt, selectedAttendanceRecord?.qrToken]);

  const attendanceQrUrl = useMemo(() => {
    if (typeof window === 'undefined' || !selectedClassId || !selectedAttendanceRecord?.qrToken) return '';
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('attendanceQr', selectedAttendanceRecord.qrToken);
    url.searchParams.set('classId', selectedClassId);
    url.searchParams.set('date', attendanceDate);
    return url.toString();
  }, [attendanceDate, selectedAttendanceRecord?.qrToken, selectedClassId]);

  const copyAttendanceQrLink = async () => {
    if (!attendanceQrUrl) return;
    try {
      await navigator.clipboard.writeText(attendanceQrUrl);
      setAttendanceQrCopied(true);
      window.setTimeout(() => setAttendanceQrCopied(false), 1600);
    } catch (error) {
      console.error('Không thể sao chép liên kết QR:', error);
    }
  };

  const exportAttendanceFile = () => {
    if (typeof document === 'undefined' || !attendanceStudents.length) return;
    const rows = attendanceStudents.map((student, index) => [
      getStudentCode(student, index), getStudentDisplayName(student), student.email || '',
      getAttendanceStatusLabel(attendanceDraft[student.id]?.status || ''), attendanceDraft[student.id]?.note || '',
    ]);
    const pages = [];
    for (let offset = 0; offset < rows.length; offset += 28) {
      const canvas = document.createElement('canvas'); canvas.width = 1240; canvas.height = 1754; const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#0f172a'; ctx.font = '700 38px Arial, sans-serif'; ctx.fillText('Danh sách điểm danh', 60, 70);
      ctx.fillStyle = '#64748b'; ctx.font = '500 20px Arial, sans-serif'; ctx.fillText(`Lớp ${selectedClass?.name || ''} · ${attendanceDate} · Trang ${pages.length + 1}`, 60, 108);
      const headers = ['Mã HS', 'Họ và tên', 'Email', 'Trạng thái', 'Ghi chú']; const widths = [120, 280, 300, 180, 240]; let y = 150; const rowH = 48; let x = 60;
      ctx.font = '700 15px Arial, sans-serif'; ctx.fillStyle = '#f1f5f9'; ctx.fillRect(60, y, widths.reduce((a,b)=>a+b,0), rowH); ctx.fillStyle = '#334155'; headers.forEach((h,i)=>{ ctx.fillText(h, x+8, y+29); x += widths[i]; }); y += rowH; ctx.font = '500 14px Arial, sans-serif';
      rows.slice(offset, offset + 28).forEach((values,index)=>{ x=60; ctx.fillStyle = index%2 ? '#fff' : '#f8fafc'; ctx.fillRect(60,y,widths.reduce((a,b)=>a+b,0),rowH); ctx.fillStyle='#334155'; values.forEach((value,i)=>{ let text=String(value||''); while(ctx.measureText(text).width>widths[i]-16 && text.length>4) text=`${text.slice(0,-2)}…`; ctx.fillText(text,x+8,y+29); x+=widths[i]; }); y+=rowH; });
      const dataUrl=canvas.toDataURL('image/jpeg',.92); const binary=atob(dataUrl.split(',')[1]); const bytes=new Uint8Array(binary.length); for(let i=0;i<binary.length;i+=1) bytes[i]=binary.charCodeAt(i); pages.push({width:canvas.width,height:canvas.height,bytes});
    }
    const blob=new Blob([buildJpegPdf(pages)],{type:'application/pdf'}); const url=URL.createObjectURL(blob); const anchor=document.createElement('a'); anchor.href=url; anchor.download=`DiemDanh_${String(selectedClass?.name||'Lop').replace(/[^a-zA-Z0-9_-]+/g,'_')}_${attendanceDate}.pdf`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  const importAttendanceFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const rows = parseDelimitedText(await file.text());
      if (rows.length < 2) throw new Error('File không có dữ liệu điểm danh.');
      const headers = rows[0].map(normalizeExcelHeader);
      const emailIndex = headers.findIndex((value) => ['email', 'emailhocsinh'].includes(value));
      const codeIndex = headers.findIndex((value) => ['mahocsinh', 'mahs'].includes(value));
      const statusIndex = headers.findIndex((value) => ['trangthai', 'status'].includes(value));
      const noteIndex = headers.findIndex((value) => ['ghichu', 'note'].includes(value));
      if (statusIndex < 0 || (emailIndex < 0 && codeIndex < 0)) throw new Error('File cần có cột Email hoặc Mã học sinh và cột Trạng thái.');
      const updates = {};
      rows.slice(1).forEach((row) => {
        const student = attendanceStudents.find((item, index) => (emailIndex >= 0 && normalizeText(item.email) === normalizeText(row[emailIndex])) || (codeIndex >= 0 && normalizeText(getStudentCode(item, index)) === normalizeText(row[codeIndex])));
        if (!student) return;
        const status = normalizeAttendanceStatus(row[statusIndex]);
        if (!status) return;
        updates[student.id] = { status, note: noteIndex >= 0 ? String(row[noteIndex] || '').trim() : '' };
      });
      if (!Object.keys(updates).length) throw new Error('Không tìm thấy dòng điểm danh hợp lệ cho học sinh trong lớp.');
      setAttendanceDraft((current) => ({ ...current, ...updates }));
      setAttendanceDirty(true);
      setAttendanceSaveError('');
    } catch (error) {
      setAttendanceSaveError(error?.message || 'Không thể nhập file điểm danh.');
    }
  };

  const attendanceHistory = useMemo(() => {
    if (attendanceHistoryEntries.length) return attendanceHistoryEntries;
    if (selectedAttendanceRecord && Array.isArray(selectedAttendanceRecord.records) && selectedAttendanceRecord.records.length) {
      return [{ ...selectedAttendanceRecord, legacyLatest: true }];
    }
    return [];
  }, [attendanceHistoryEntries, selectedAttendanceRecord]);

  useEffect(() => {
    if (attendanceHistoryPage > Math.max(0, attendanceHistory.length - 1)) setAttendanceHistoryPage(Math.max(0, attendanceHistory.length - 1));
  }, [attendanceHistory.length, attendanceHistoryPage]);

  const copyClassCode = async () => {
    const code = selectedClass?.classCode;
    if (!code || typeof document === 'undefined') return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setClassCodeCopied(true);
      window.setTimeout(() => setClassCodeCopied(false), 1600);
    } catch (error) {
      console.error('Không thể sao chép mã lớp:', error);
    }
  };

  const openStudentProfile = (student) => {
    if (!student?.id) return;
    setStudentProfileId(student.id);
    setStudentProfileTab('info');
    setProfileEditing(false);
    setProfileEditError('');
  };

  const startProfileEdit = (student) => {
    if (!student?.id) return;
    setProfileEditForm({
      name: getStudentDisplayName(student) === 'Chờ học sinh tham gia' ? '' : getStudentDisplayName(student),
      email: student.email || '',
      phone: student.phone || '',
      gender: student.gender || student.sex || '',
      birthDate: student.birthDate || student.dob || '',
      parentName: student.parentName || student.guardianName || student.emergencyContactName || '',
      parentPhone: student.parentPhone || student.guardianPhone || student.emergencyPhone || '',
      parentEmail: student.parentEmail || student.guardianEmail || '',
      parentRelation: student.parentRelation || student.guardianRelation || '',
      medicalNote: student.medicalNote || student.medicalNotes || student.healthNote || '',
    });
    setProfileEditError('');
    setProfileEditing(true);
  };

  const saveProfileEdit = async () => {
    if (!selectedClassId || !studentProfile?.id) return;
    const email = profileEditForm.email.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setProfileEditError('Email học sinh chưa đúng định dạng.');
      return;
    }
    const duplicatedStudent = students.find((student) => student.id !== studentProfile.id && normalizeText(student.email) === email);
    if (duplicatedStudent) {
      setProfileEditError(`Email ${email} đã có trong lớp.`);
      return;
    }
    try {
      setProfileSaving(true);
      setProfileEditError('');
      await classroomApi.updateMember(selectedClassId, studentProfile.id, {
        name: profileEditForm.name.trim(),
        email,
        phone: profileEditForm.phone.trim(),
        gender: profileEditForm.gender.trim(),
        birthDate: profileEditForm.birthDate.trim(),
        parentName: profileEditForm.parentName.trim(),
        parentPhone: profileEditForm.parentPhone.trim(),
        parentEmail: profileEditForm.parentEmail.trim(),
        parentRelation: profileEditForm.parentRelation.trim(),
        medicalNote: profileEditForm.medicalNote.trim(),
      });
      setProfileEditing(false);
    } catch (error) {
      console.error('Không thể cập nhật hồ sơ học sinh:', error);
      setProfileEditError(error?.message || 'Không thể cập nhật hồ sơ học sinh.');
    } finally {
      setProfileSaving(false);
    }
  };

  const filteredStudents = useMemo(() => {
    const keyword = normalizeText(queryText);
    const sortedStudents = sortStudentsByJoinTime(students);
    if (!keyword) return sortedStudents;

    return sortedStudents.filter((student, index) =>
      [
        getStudentCode(student, index),
        getStudentDisplayName(student),
        student.email,
        student.phone,
      ].some((value) => normalizeText(value).includes(keyword))
    );
  }, [queryText, students]);

  const rankedScoreRows = useMemo(() => {
    const keyword = normalizeText(queryText);
    const sortedStudents = sortStudentsByJoinTime(students);
    const studentsById = new Map(
      sortedStudents.map((student) => [student.id, student])
    );
    const scoresByStudentId = new Map(
      scoreRows.map((row) => [row.studentId || row.id, row])
    );

    return sortedStudents
      .map((student, studentIndex) => {
        const scoreRow = scoresByStudentId.get(student.id) || {};
        const scores = scoreTests.map(
          (test) => scoreRow.scores?.[test.id] ?? null
        );
        const average = toNumber(scoreRow.average) ?? averageFromScores(scores);

        return {
          id: student.id,
          student: studentsById.get(student.id),
          studentCode: getStudentCode(student, studentIndex),
          scores,
          average,
        };
      })
      .filter((row) => {
        if (!keyword) return true;
        return [
          row.studentCode,
          getStudentDisplayName(row.student),
          row.student?.email,
        ].some((value) => normalizeText(value).includes(keyword));
      })
      .sort((a, b) => {
        const scoreDiff = (b.average ?? -1) - (a.average ?? -1);
        if (scoreDiff !== 0) return scoreDiff;
        return (
          getTimeValue(a.student?.createdAt) -
          getTimeValue(b.student?.createdAt)
        );
      })
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, [queryText, scoreRows, scoreTests, students]);

  const stats = useMemo(() => {
    const averages = rankedScoreRows
      .map((row) => row.average)
      .filter((average) => average !== null);

    if (!averages.length) {
      return {
        max: '-',
        min: '-',
        classAverage: '-',
        excellent: 0,
        good: 0,
        total: rankedScoreRows.length,
      };
    }

    return {
      max: Math.max(...averages).toFixed(1),
      min: Math.min(...averages).toFixed(1),
      classAverage: (
        averages.reduce((sum, score) => sum + score, 0) / averages.length
      ).toFixed(1),
      excellent: averages.filter((score) => score >= 9).length,
      good: averages.filter((score) => score >= 8).length,
      total: rankedScoreRows.length,
    };
  }, [rankedScoreRows]);

  const overviewData = useMemo(() => {
    const activeStudents = attendanceStudents.filter((student) => {
      const status = normalizeText(student.status);
      return status === 'active' || status === 'đang hoạt động' || status === 'đã tham gia';
    }).length;
    const averages = rankedScoreRows
      .map((row) => row.average)
      .filter((average) => average !== null);
    const classAverage = averages.length
      ? (averages.reduce((sum, score) => sum + score, 0) / averages.length).toFixed(1)
      : null;

    return {
      studentCount: attendanceStudents.length,
      activeStudents,
      testCount: scoreTests.length,
      classAverage,
    };
  }, [attendanceStudents, rankedScoreRows, scoreTests.length]);

  const publishedAssignmentCount = useMemo(() => {
    const classAssignments = assignmentsByClass[selectedClassId] || [];
    return classAssignments.filter((item) => !isAssignmentDraft(item)).length;
  }, [assignmentsByClass, selectedClassId]);

  const scoreDistribution = useMemo(() => {
    const averages = rankedScoreRows.map((row) => row.average).filter((value) => value !== null);
    return [
      { label: 'Giỏi ≥ 8', value: averages.filter((value) => value >= 8).length, color: '#10b981' },
      { label: 'Đạt 6–7.9', value: averages.filter((value) => value >= 6 && value < 8).length, color: '#f59e0b' },
      { label: 'Dưới 6', value: averages.filter((value) => value < 6).length, color: '#ef4444' },
    ];
  }, [rankedScoreRows]);

  const testAverageSeries = useMemo(() => scoreTests.map((test, index) => {
    const values = scoreRows
      .map((row) => toNumber(row.scores?.[test.id]))
      .filter((value) => value !== null);
    return {
      id: test.id,
      label: test.code || `B${index + 1}`,
      value: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    };
  }), [scoreRows, scoreTests]);

  const assignmentDueSeries = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const classAssignments = assignmentsByClass[selectedClassId] || [];
    return Array.from({ length: 7 }, (_, index) => {
      const dayStart = start.getTime() + index * dayMs;
      const dayEnd = dayStart + dayMs;
      const value = classAssignments.filter((item) => {
        const due = getTimeValue(item.dueAt || item.endAt || item.deadline);
        return due >= dayStart && due < dayEnd;
      }).length;
      return { label: new Date(dayStart).toLocaleDateString('vi-VN', { weekday: 'short' }), value };
    });
  }, [assignmentsByClass, now, selectedClassId]);

  const upcomingAssignments = useMemo(() => {
    const nowMs = now.getTime();
    return Object.values(assignmentsByClass)
      .flat()
      .filter((item) => {
        const due = getAssignmentDueValue(item);
        return due && due >= nowMs && !isAssignmentClosed(item) && !isAssignmentDraft(item);
      })
      .sort((a, b) => getAssignmentDueValue(a) - getAssignmentDueValue(b));
  }, [assignmentsByClass, now]);

  const selectedUpcomingAssignments = useMemo(
    () => upcomingAssignments.filter((item) => item.classId === selectedClassId),
    [selectedClassId, upcomingAssignments]
  );


  const attendanceSummary = useMemo(() => {
    const current = new Date(now);
    const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    const day = current.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(current);
    weekStart.setDate(current.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const normalized = attendanceRecords.map((item) => {
      const timestamp = getRecordDateValue(item);
      const status = getAttendanceStatus(item);
      const presentCount = toNumber(item.presentCount ?? item.present) ?? (isPresentStatus(status) ? 1 : 0);
      const absentCount = toNumber(item.absentCount ?? item.absent) ?? (isAbsentStatus(status) ? 1 : 0);
      const lateCount = toNumber(item.lateCount ?? item.late) ?? 0;
      const explicitTotal = toNumber(item.totalCount ?? item.total ?? item.studentCount);
      const total = explicitTotal ?? Math.max(1, presentCount + absentCount + lateCount);
      return { ...item, timestamp, presentCount, absentCount, lateCount, total };
    }).filter((item) => item.timestamp);

    const monthRows = normalized.filter((item) => item.timestamp >= monthStart.getTime() && item.timestamp < monthEnd.getTime());
    const weekRows = normalized.filter((item) => item.timestamp >= weekStart.getTime() && item.timestamp < weekEnd.getTime());
    const aggregate = (rows) => rows.reduce((acc, item) => ({
      present: acc.present + item.presentCount,
      absent: acc.absent + item.absentCount,
      late: acc.late + item.lateCount,
      total: acc.total + item.total,
    }), { present: 0, absent: 0, late: 0, total: 0 });
    const monthTotals = aggregate(monthRows);
    const weekTotals = aggregate(weekRows);

    const monthDays = Array.from({ length: new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate() }, (_, index) => {
      const date = new Date(current.getFullYear(), current.getMonth(), index + 1);
      const next = new Date(current.getFullYear(), current.getMonth(), index + 2);
      const rows = monthRows.filter((item) => item.timestamp >= date.getTime() && item.timestamp < next.getTime());
      const totals = aggregate(rows);
      return { key: date.toISOString(), label: `${index + 1}/${current.getMonth() + 1}`, shortLabel: String(index + 1), ...totals };
    });

    const weekDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      const next = new Date(date);
      next.setDate(date.getDate() + 1);
      const rows = weekRows.filter((item) => item.timestamp >= date.getTime() && item.timestamp < next.getTime());
      return { key: date.toISOString(), label: ['T2','T3','T4','T5','T6','T7','CN'][index], ...aggregate(rows) };
    });

    return {
      monthLabel: `tháng ${current.getMonth() + 1}`,
      monthDays,
      weekDays,
      monthTotals,
      weekTotals,
      monthRate: monthTotals.total ? Math.round((monthTotals.present / monthTotals.total) * 100) : null,
      weekRate: weekTotals.total ? Math.round((weekTotals.present / weekTotals.total) * 100) : null,
    };
  }, [attendanceRecords, now]);

  const subjectProgress = useMemo(() => subjects.map((subject) => {
    const source = allSubjectScores[subject.id] || {};
    const tests = source.tests || [];
    const rows = source.scores || [];
    const averages = rows.map((row) => {
      const direct = toNumber(row.average);
      if (direct !== null) return direct;
      return averageFromScores(tests.map((test) => row.scores?.[test.id]));
    }).filter((value) => value !== null);
    const average = averages.length ? averages.reduce((sum, value) => sum + value, 0) / averages.length : null;
    const subjectAssignments = (assignmentsByClass[selectedClassId] || []).filter((item) => item.subjectId === subject.id || normalizeText(item.subjectName || item.subject) === normalizeText(subject.name));
    const assignmentCompletionRates = subjectAssignments.map((item) => {
      const direct = toNumber(item.completionRate ?? item.completionPercent);
      if (direct !== null) return direct;
      const completed = toNumber(item.completedCount ?? item.submittedCount);
      const total = toNumber(item.totalCount ?? item.studentCount ?? item.assignedCount);
      return completed !== null && total ? (completed / total) * 100 : null;
    }).filter((value) => value !== null);
    const completion = assignmentCompletionRates.length ? assignmentCompletionRates.reduce((sum, value) => sum + value, 0) / assignmentCompletionRates.length : null;
    return { id: subject.id, name: subject.name || 'Môn học', average, completion };
  }), [allSubjectScores, assignmentsByClass, selectedClassId, subjects]);

  const todaySchedule = useMemo(() => {
    const today = new Date(now);
    const start = new Date(today); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(start.getDate() + 1);
    const weekday = today.getDay();
    return scheduleItems.filter((item) => {
      if (item.kind === 'persistentImportant') return false;
      const timestamp = getTimeValue(item.date || item.startAt || item.sessionDate);
      if (timestamp) return timestamp >= start.getTime() && timestamp < end.getTime();
      const itemWeekday = Number(item.weekday ?? item.dayOfWeek);
      return Number.isFinite(itemWeekday) && itemWeekday === weekday;
    }).sort((a, b) => {
      const aTime = getTimeValue(a.startAt);
      const bTime = getTimeValue(b.startAt);
      if (aTime || bTime) return aTime - bTime;
      return String(a.startTime || '').localeCompare(String(b.startTime || ''));
    });
  }, [now, scheduleItems]);

  const isTodayScheduleItemActive = (item = {}) => {
    const dateKey = getScheduleDateFromItem(item);
    if (dateKey && dateKey !== getLocalDateKey(now)) return false;
    const startMinutes = getMinutesFromScheduleTime(getScheduleStartTime(item));
    const endMinutes = getMinutesFromScheduleTime(getScheduleEndTime(item));
    if (startMinutes === null || endMinutes === null) return false;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  };

  const scheduleWeekStart = useMemo(() => addDays(getMondayStart(now), scheduleWeekOffset * 7), [now, scheduleWeekOffset]);
  const scheduleWeekKey = useMemo(() => getScheduleWeekKey(scheduleWeekStart), [scheduleWeekStart]);
  const scheduleWeekDays = useMemo(() => Array.from({ length: 5 }, (_, index) => {
    const date = addDays(scheduleWeekStart, index);
    return {
      index,
      date,
      key: getLocalDateKey(date),
      label: `Thứ ${index + 2}`,
      shortDate: date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
    };
  }), [scheduleWeekStart]);
  const scheduleWeekItems = useMemo(() => {
    const explicitItems = scheduleItems.filter((item) => {
      if (item.kind === 'persistentImportant') return false;
      const itemDate = getScheduleDateFromItem(item);
      if (item.weekKey) return item.weekKey === scheduleWeekKey;
      return scheduleWeekDays.some((day) => day.key === itemDate);
    });
    const rules = selectedClass?.scheduleContentRules && typeof selectedClass.scheduleContentRules === 'object'
      ? selectedClass.scheduleContentRules
      : {};
    const matchedRuleKey = Object.keys(rules).filter((key) => key <= scheduleWeekKey).sort().pop();
    const template = matchedRuleKey && rules[matchedRuleKey]?.items && typeof rules[matchedRuleKey].items === 'object'
      ? rules[matchedRuleKey].items
      : {};
    if (!Object.keys(template).length) return explicitItems;
    const config = getScheduleConfigForWeek(selectedClass || {}, scheduleWeekKey);
    const merged = [...explicitItems];
    scheduleWeekDays.forEach((day, dayIndex) => {
      config.slots.forEach((slot, slotIndex) => {
        const templateItem = template[`${dayIndex}-${slotIndex}`];
        if (!templateItem?.title) return;
        const hasExplicit = explicitItems.some((item) => getScheduleDateFromItem(item) === day.key && getScheduleStartTime(item) === slot.startTime);
        if (hasExplicit) return;
        merged.push({
          id: `template-${matchedRuleKey}-${day.key}-${slot.id}`, virtualTemplate: true, weekKey: scheduleWeekKey, date: day.key, weekday: day.date.getDay(),
          startTime: slot.startTime, endTime: slot.endTime, title: templateItem.title || '', lessonContent: templateItem.lessonContent || '',
          room: templateItem.room || '', note: templateItem.note || '', important: Boolean(templateItem.important), teacherId: templateItem.teacherId || '',
        });
      });
    });
    return merged;
  }, [scheduleItems, scheduleWeekDays, scheduleWeekKey, selectedClass]);
  const scheduleConfig = useMemo(
    () => getScheduleConfigForWeek(selectedClass || {}, scheduleWeekKey),
    [selectedClass, scheduleWeekKey]
  );
  const scheduleTimeSlots = scheduleConfig.slots;
  const scheduleBreaks = scheduleConfig.breaks;

  const scheduleLegacySlots = useMemo(() => {
    const templateStarts = new Set(scheduleTimeSlots.map((slot) => slot.startTime));
    const byStart = new Map();
    scheduleWeekItems.forEach((item) => {
      const startTime = getScheduleStartTime(item);
      if (!startTime || templateStarts.has(startTime)) return;
      const endTime = getScheduleEndTime(item);
      if (!byStart.has(startTime)) byStart.set(startTime, { id: `legacy-${startTime}`, session: 'legacy', period: null, startTime, endTime });
    });
    return [...byStart.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [scheduleTimeSlots, scheduleWeekItems]);

  const visibleScheduleSlots = useMemo(() => [...scheduleTimeSlots, ...scheduleLegacySlots], [scheduleLegacySlots, scheduleTimeSlots]);

  const importantScheduleItems = useMemo(() => scheduleWeekItems
    .filter((item) => Boolean(item.important || item.isImportant || item.pinned))
    .sort((a, b) => {
      const dateDiff = getScheduleDateFromItem(a).localeCompare(getScheduleDateFromItem(b));
      return dateDiff || getScheduleStartTime(a).localeCompare(getScheduleStartTime(b));
    }), [scheduleWeekItems]);

  const persistentImportantItems = useMemo(() => scheduleItems
    .filter((item) => item.kind === 'persistentImportant' && Number(item.expiresAtMillis || 0) > now.getTime())
    .sort((a, b) => Number(a.expiresAtMillis || 0) - Number(b.expiresAtMillis || 0)), [now, scheduleItems]);

  useEffect(() => {
    if (!selectedClassId || !currentUser?.uid) return undefined;
    const expired = scheduleItems.filter((item) => item.kind === 'persistentImportant' && Number(item.expiresAtMillis || 0) > 0 && Number(item.expiresAtMillis) <= now.getTime());
    if (!expired.length) return undefined;
    let cancelled = false;
    const removeExpired = async () => {
      for (const item of expired) {
        if (cancelled) return;
        try { await classroomApi.deleteSchedule(selectedClassId, item.id); }
        catch (error) { console.error('Không thể tự xóa nội dung quan trọng đã hết hạn:', error); }
      }
    };
    removeExpired();
    return () => { cancelled = true; };
  }, [currentUser?.uid, now, scheduleItems, selectedClassId]);

  const openScheduleCellEditor = (dateKey, startTime = '', endTime = '') => {
    const existing = scheduleWeekItems.find((item) => getScheduleDateFromItem(item) === dateKey && getScheduleStartTime(item) === startTime);
    setScheduleEditorTargetId(existing?.virtualTemplate ? '' : existing?.id || '');
    setScheduleEditorMode('cell');
    setScheduleEditorForm({
      date: dateKey,
      startTime: existing ? getScheduleStartTime(existing) : startTime,
      endTime: existing ? getScheduleEndTime(existing) : endTime,
      title: existing?.subjectName || existing?.subject || existing?.title || '',
      lessonContent: existing?.lessonContent || existing?.lessonName || existing?.lesson || existing?.topic || '',
      room: ensureScheduleRoomPrefix(existing?.room || existing?.location || ''),
      note: existing?.note || existing?.description || existing?.lessonName || existing?.lesson || existing?.topic || '',
      important: Boolean(existing?.important || existing?.isImportant || existing?.pinned),
    });
    setScheduleEditorError('');
    setScheduleEditorOpen(true);
  };

  const openScheduleTimeSettings = () => {
    setScheduleEditorTargetId('');
    setScheduleEditorMode('slots');
    setScheduleSlotDraft(scheduleTimeSlots.map((slot) => ({ ...slot })));
    setScheduleBreakDraft(scheduleBreaks.map((item) => ({ ...item })));
    setScheduleEditorError('');
    setScheduleSyncMessage('');
    setScheduleInlineEditor(null);
    setScheduleEditorOpen(true);
  };

  const normalizeDraftScheduleConfig = () => {
    const normalizedSlots = scheduleSlotDraft
      .filter((slot) => slot && typeof slot === 'object')
      .map((slot, index) => ({
        id: slot.id || `slot-${Date.now()}-${index}`,
        session: slot.session || 'morning',
        period: index + 1,
        startTime: normalizeScheduleTime(slot.startTime),
        endTime: normalizeScheduleTime(slot.endTime),
      }));
    const normalizedBreaks = scheduleBreakDraft
      .filter((item) => item && typeof item === 'object')
      .map((item, index) => ({
        id: item.id || `break-${Date.now()}-${index}`,
        afterPeriod: Math.max(1, Math.min(normalizedSlots.length, Number(item.afterPeriod) || 1)),
        label: String(item.label || 'Giờ ra chơi').trim() || 'Giờ ra chơi',
        startTime: normalizeScheduleTime(item.startTime),
        endTime: normalizeScheduleTime(item.endTime),
        kind: item.kind || 'break',
      }));
    if (!normalizedSlots.length) throw new Error('Thời khóa biểu cần có ít nhất 1 tiết học.');
    const invalidSlot = normalizedSlots.find((slot) => !slot.startTime || !slot.endTime || slot.endTime <= slot.startTime);
    if (invalidSlot) throw new Error('Mỗi tiết cần có giờ bắt đầu và giờ kết thúc hợp lệ.');
    const invalidBreak = normalizedBreaks.find((item) => !item.startTime || !item.endTime || item.endTime <= item.startTime);
    if (invalidBreak) throw new Error('Mỗi giờ nghỉ cần có giờ bắt đầu và giờ kết thúc hợp lệ.');
    const orderedSlots = [...normalizedSlots].sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let index = 1; index < orderedSlots.length; index += 1) {
      if (orderedSlots[index].startTime < orderedSlots[index - 1].endTime) throw new Error('Các tiết học không được chồng thời gian lên nhau.');
    }
    return { slots: normalizedSlots, breaks: normalizedBreaks };
  };

  const remapScheduleItemsToConfig = (items, nextConfig) => items.map((item) => {
    const itemWeekKey = item.weekKey || getScheduleWeekKey(new Date(`${getScheduleDateFromItem(item)}T00:00:00`));
    const previousConfig = getScheduleConfigForWeek(selectedClass || {}, itemWeekKey);
    const oldStart = getScheduleStartTime(item);
    const oldIndex = previousConfig.slots.findIndex((slot) => slot.startTime === oldStart);
    const nextSlot = oldIndex >= 0 ? nextConfig.slots[oldIndex] : null;
    if (!nextSlot) return null;
    if (nextSlot.startTime === oldStart && nextSlot.endTime === getScheduleEndTime(item)) return null;
    return { item, nextSlot };
  }).filter(Boolean);

  const saveScheduleTimeConfig = async (nextConfig, scope = 'week', closeEditor = true) => {
    if (!selectedClassId || !currentUser?.uid || scheduleEditorSaving) return;
    try {
      setScheduleEditorSaving(true);
      setScheduleEditorError('');
      let itemsToUpdate = scheduleWeekItems;
      const currentWeekConfigs = selectedClass?.scheduleWeekConfigs && typeof selectedClass.scheduleWeekConfigs === 'object' ? selectedClass.scheduleWeekConfigs : {};
      const currentTimeRules = selectedClass?.scheduleTimeRules && typeof selectedClass.scheduleTimeRules === 'object' ? selectedClass.scheduleTimeRules : {};
      let weekConfigs = { ...currentWeekConfigs };
      let timeRules = { ...currentTimeRules };
      if (scope === 'future') {
        weekConfigs = Object.fromEntries(Object.entries(currentWeekConfigs).filter(([key]) => key < scheduleWeekKey));
        timeRules[scheduleWeekKey] = { ...nextConfig, updatedBy: currentUser.uid, updatedAtMillis: Date.now() };
        itemsToUpdate = scheduleItems.filter((item) => {
          const itemWeekKey = item.weekKey || getScheduleWeekKey(new Date(`${getScheduleDateFromItem(item)}T00:00:00`));
          return itemWeekKey >= scheduleWeekKey;
        });
      } else {
        weekConfigs[scheduleWeekKey] = { ...nextConfig, updatedBy: currentUser.uid, updatedAtMillis: Date.now() };
      }
      const updates = remapScheduleItemsToConfig(itemsToUpdate, nextConfig);
      await classroomApi.batchSchedule(selectedClassId, {
        expectedUpdatedAt: selectedClass?.updatedAt || '',
        config: { weekConfigs, timeRules },
        updates: updates.map(({ item, nextSlot }) => ({
          id: item.id,
          payload: { startTime: nextSlot.startTime, endTime: nextSlot.endTime },
        })),
      });
      setScheduleSyncMessage(scope === 'future' ? 'Đã áp dụng khung giờ từ tuần này cho các tuần sau.' : 'Đã lưu khung giờ riêng cho tuần này.');
      if (closeEditor) setScheduleEditorOpen(false);
    } catch (error) {
      console.error('Không thể lưu khung giờ lịch dạy:', error);
      setScheduleEditorError(error?.message || 'Không thể lưu khung giờ lịch dạy.');
    } finally {
      setScheduleEditorSaving(false);
    }
  };

  const copyScheduleContentToWeek = async (sourceItems, targetWeekStart, targetConfig, clearExisting = true, config = undefined) => {
    if (!selectedClassId) return;
    const targetWeekKey = getScheduleWeekKey(targetWeekStart);
    const targetDays = Array.from({ length: 5 }, (_, index) => getLocalDateKey(addDays(targetWeekStart, index)));
    const existingTarget = scheduleItems.filter((item) => {
      const itemWeekKey = item.weekKey || getScheduleWeekKey(new Date(`${getScheduleDateFromItem(item)}T00:00:00`));
      return itemWeekKey === targetWeekKey;
    });
    const sourceWeekStart = sourceItems.length ? getMondayStart(new Date(`${getScheduleDateFromItem(sourceItems[0])}T00:00:00`)) : null;
    const sourceConfig = sourceWeekStart ? getScheduleConfigForWeek(selectedClass || {}, getScheduleWeekKey(sourceWeekStart)) : targetConfig;
    const creates = [];
    sourceItems.forEach((item) => {
      const sourceDate = getScheduleDateFromItem(item);
      if (!sourceDate) return;
      const sourceDay = new Date(`${sourceDate}T00:00:00`).getDay();
      const dayIndex = sourceDay === 0 ? 6 : sourceDay - 1;
      if (dayIndex < 0 || dayIndex > 4) return;
      const sourceSlotIndex = sourceConfig.slots.findIndex((slot) => slot.startTime === getScheduleStartTime(item));
      const targetSlot = targetConfig.slots[sourceSlotIndex];
      if (!targetSlot) return;
      const targetDate = targetDays[dayIndex];
      creates.push({
        classId: selectedClassId, weekKey: targetWeekKey, date: targetDate, weekday: new Date(`${targetDate}T00:00:00`).getDay(),
        startTime: targetSlot.startTime, endTime: targetSlot.endTime, title: item.subjectName || item.subject || item.title || '',
        lessonContent: item.lessonContent || item.lessonName || item.lesson || item.topic || '', room: ensureScheduleRoomPrefix(item.room || item.location || ''),
        note: item.note || item.description || '', important: Boolean(item.important || item.isImportant || item.pinned), teacherId: currentUser?.uid || item.teacherId || '',
      });
    });
    await classroomApi.batchSchedule(selectedClassId, {
      expectedUpdatedAt: selectedClass?.updatedAt || '',
      deleteIds: clearExisting ? existingTarget.filter((item) => !item.virtualTemplate).map((item) => item.id) : [],
      creates,
      ...(config ? { config } : {}),
    });
  };

  const applyPreviousWeekScheduleTime = async () => {
    if (!selectedClassId || !currentUser?.uid || scheduleEditorSaving) return;
    const previousWeekStart = addDays(scheduleWeekStart, -7);
    const previousWeekKey = getScheduleWeekKey(previousWeekStart);
    const previousConfig = getScheduleConfigForWeek(selectedClass || {}, previousWeekKey);
    const previousExplicit = scheduleItems.filter((item) => {
      const itemWeekKey = item.weekKey || getScheduleWeekKey(new Date(`${getScheduleDateFromItem(item)}T00:00:00`));
      return itemWeekKey === previousWeekKey;
    });
    const contentRules = selectedClass?.scheduleContentRules && typeof selectedClass.scheduleContentRules === 'object' ? selectedClass.scheduleContentRules : {};
    const previousRuleKey = Object.keys(contentRules).filter((key) => key <= previousWeekKey).sort().pop();
    const previousTemplate = previousRuleKey && contentRules[previousRuleKey]?.items ? contentRules[previousRuleKey].items : {};
    const previousItems = [...previousExplicit];
    Array.from({ length: 5 }, (_, dayIndex) => addDays(previousWeekStart, dayIndex)).forEach((date, dayIndex) => {
      previousConfig.slots.forEach((slot, slotIndex) => {
        const templateItem = previousTemplate[`${dayIndex}-${slotIndex}`];
        if (!templateItem?.title) return;
        const dateKey = getLocalDateKey(date);
        if (previousExplicit.some((item) => getScheduleDateFromItem(item) === dateKey && getScheduleStartTime(item) === slot.startTime)) return;
        previousItems.push({ id: `template-${previousRuleKey}-${dateKey}-${slot.id}`, virtualTemplate: true, date: dateKey, weekKey: previousWeekKey, startTime: slot.startTime, endTime: slot.endTime, ...templateItem });
      });
    });
    try {
      setScheduleEditorSaving(true);
      setScheduleSyncMessage('');
      const weekConfigs = { ...(selectedClass?.scheduleWeekConfigs || {}), [scheduleWeekKey]: { ...previousConfig, updatedBy: currentUser.uid, updatedAtMillis: Date.now() } };
      await copyScheduleContentToWeek(
        previousItems,
        scheduleWeekStart,
        previousConfig,
        true,
        { weekConfigs },
      );
      setScheduleSyncMessage('Đã áp dụng thời gian, số tiết và nội dung từ tuần trước vào tuần hiện tại.');
    } catch (error) {
      console.error('Không thể áp dụng lịch tuần trước:', error);
      setScheduleSyncMessage(error?.message || 'Không thể áp dụng lịch tuần trước.');
    } finally {
      setScheduleEditorSaving(false);
    }
  };

  const applyCurrentScheduleFromNow = async () => {
    if (!selectedClassId || !currentUser?.uid || scheduleEditorSaving) return;
    try {
      setScheduleEditorSaving(true);
      setScheduleSyncMessage('');
      const config = getScheduleConfigForWeek(selectedClass || {}, scheduleWeekKey);
      const items = {};
      scheduleWeekDays.forEach((day, dayIndex) => {
        config.slots.forEach((slot, slotIndex) => {
          const item = scheduleWeekItems.find((entry) => getScheduleDateFromItem(entry) === day.key && getScheduleStartTime(entry) === slot.startTime);
          if (!item) return;
          const title = item.subjectName || item.subject || item.title || '';
          if (!title) return;
          items[`${dayIndex}-${slotIndex}`] = { title, lessonContent: item.lessonContent || item.lessonName || item.lesson || item.topic || '', room: ensureScheduleRoomPrefix(item.room || item.location || ''), note: item.note || item.description || '', important: Boolean(item.important || item.isImportant || item.pinned), teacherId: currentUser.uid };
        });
      });
      const currentConfigs = selectedClass?.scheduleWeekConfigs && typeof selectedClass.scheduleWeekConfigs === 'object' ? selectedClass.scheduleWeekConfigs : {};
      await classroomApi.batchSchedule(selectedClassId, {
        expectedUpdatedAt: selectedClass?.updatedAt || '',
        config: {
          weekConfigs: Object.fromEntries(Object.entries(currentConfigs).filter(([key]) => key < scheduleWeekKey)),
          timeRules: { ...(selectedClass?.scheduleTimeRules || {}), [scheduleWeekKey]: { ...config, updatedBy: currentUser.uid, updatedAtMillis: Date.now() } },
          contentRules: { ...(selectedClass?.scheduleContentRules || {}), [scheduleWeekKey]: { items, updatedBy: currentUser.uid, updatedAtMillis: Date.now() } },
        },
      });
      setScheduleSyncMessage('Đã áp dụng thời gian, tiết học và nội dung của tuần này cho tuần hiện tại và các tuần sau.');
    } catch (error) {
      console.error('Không thể áp dụng lịch từ bây giờ:', error);
      setScheduleSyncMessage(error?.message || 'Không thể áp dụng lịch từ bây giờ.');
    } finally {
      setScheduleEditorSaving(false);
    }
  };

  const addSchedulePeriod = (session = 'morning') => {
    setScheduleSlotDraft((current) => {
      const sessionRows = current.filter((item) => item.session === session);
      const previous = sessionRows[sessionRows.length - 1];
      const fallback = session === 'morning' ? '07:00' : '13:00';
      const startTime = previous?.endTime ? addMinutesToScheduleTime(previous.endTime, 5) : fallback;
      const next = [...current, { id: `slot-${Date.now()}-${session}`, session, period: current.length + 1, startTime, endTime: addMinutesToScheduleTime(startTime, 45) }];
      return [...next.filter((item) => item.session === 'morning'), ...next.filter((item) => item.session === 'afternoon')].map((item, index) => ({ ...item, period: index + 1 }));
    });
  };

  const moveScheduleSlot = (dragId, targetId) => {
    if (!dragId || !targetId || dragId === targetId) return;
    setScheduleSlotDraft((current) => {
      const dragged = current.find((item) => item.id === dragId);
      const target = current.find((item) => item.id === targetId);
      if (!dragged || !target || dragged.session !== target.session) return current;
      const sessionRows = current.filter((item) => item.session === dragged.session);
      const from = sessionRows.findIndex((item) => item.id === dragId);
      const to = sessionRows.findIndex((item) => item.id === targetId);
      const reordered = [...sessionRows];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);
      const morning = dragged.session === 'morning' ? reordered : current.filter((item) => item.session === 'morning');
      const afternoon = dragged.session === 'afternoon' ? reordered : current.filter((item) => item.session === 'afternoon');
      return [...morning, ...afternoon].map((item, index) => ({ ...item, period: index + 1 }));
    });
  };

  const addScheduleBreak = () => {
    setScheduleBreakDraft((current) => [...current, {
      id: `break-${Date.now()}`,
      afterPeriod: Math.max(1, scheduleSlotDraft.length),
      label: 'Giờ ra chơi',
      startTime: scheduleSlotDraft[scheduleSlotDraft.length - 1]?.endTime || '09:25',
      endTime: addMinutesToScheduleTime(scheduleSlotDraft[scheduleSlotDraft.length - 1]?.endTime || '09:25', 15),
      kind: 'break',
    }]);
  };

  const openScheduleInlineEditor = (day, slot) => {
    const existing = scheduleWeekItems.find((item) => getScheduleDateFromItem(item) === day.key && getScheduleStartTime(item) === slot.startTime);
    setScheduleInlineEditor({
      targetId: existing?.virtualTemplate ? '' : existing?.id || '', date: day.key, startTime: slot.startTime, endTime: slot.endTime,
      title: existing?.subjectName || existing?.subject || existing?.title || '', lessonContent: existing?.lessonContent || existing?.lessonName || existing?.lesson || existing?.topic || '',
      room: ensureScheduleRoomPrefix(existing?.room || existing?.location || ''), note: existing?.note || existing?.description || '', important: Boolean(existing?.important || existing?.isImportant || existing?.pinned),
    });
  };

  const saveScheduleInlineEditor = async () => {
    if (!scheduleInlineEditor || !selectedClassId || !currentUser?.uid || scheduleEditorSaving) return;
    if (!scheduleInlineEditor.title.trim()) { setScheduleEditorError('Môn học là nội dung bắt buộc.'); return; }
    try {
      setScheduleEditorSaving(true);
      setScheduleEditorError('');
      const payload = {
        classId: selectedClassId, weekKey: scheduleWeekKey, date: scheduleInlineEditor.date, weekday: new Date(`${scheduleInlineEditor.date}T00:00:00`).getDay(),
        startTime: normalizeScheduleTime(scheduleInlineEditor.startTime), endTime: normalizeScheduleTime(scheduleInlineEditor.endTime), title: scheduleInlineEditor.title.trim(),
        lessonContent: scheduleInlineEditor.lessonContent.trim(), room: ensureScheduleRoomPrefix(scheduleInlineEditor.room), note: scheduleInlineEditor.note.trim(),
        important: Boolean(scheduleInlineEditor.important), teacherId: currentUser.uid,
      };
      if (scheduleInlineEditor.targetId) await classroomApi.updateSchedule(selectedClassId, scheduleInlineEditor.targetId, payload);
      else await classroomApi.createSchedule(selectedClassId, payload);
      setScheduleInlineEditor(null);
    } catch (error) {
      console.error('Không thể lưu nội dung lịch:', error);
      setScheduleEditorError(error?.message || 'Không thể lưu nội dung lịch.');
    } finally {
      setScheduleEditorSaving(false);
    }
  };

  const openPersistentImportant = () => {
    const tomorrow = addDays(now, 1);
    setScheduleImportantForm({ title: '', note: '', expiresDate: getLocalDateKey(tomorrow), expiresTime: '23:59' });
    setScheduleImportantError('');
    setScheduleImportantOpen(true);
  };

  const savePersistentImportant = async () => {
    if (!selectedClassId || !currentUser?.uid || scheduleImportantSaving) return;
    const title = scheduleImportantForm.title.trim();
    if (!title) { setScheduleImportantError('Nội dung quan trọng là bắt buộc.'); return; }
    const expiresAt = new Date(`${scheduleImportantForm.expiresDate}T${scheduleImportantForm.expiresTime || '23:59'}:00`);
    if (!scheduleImportantForm.expiresDate || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      setScheduleImportantError('Thời gian kết thúc phải lớn hơn thời gian hiện tại.');
      return;
    }
    try {
      setScheduleImportantSaving(true);
      setScheduleImportantError('');
      await classroomApi.createSchedule(selectedClassId, {
        kind: 'persistentImportant', classId: selectedClassId, title, note: scheduleImportantForm.note.trim(),
        date: scheduleImportantForm.expiresDate, expiresAtMillis: expiresAt.getTime(), teacherId: currentUser.uid,
      });
      setScheduleImportantOpen(false);
    } catch (error) {
      console.error('Không thể lưu nội dung quan trọng:', error);
      setScheduleImportantError(error?.message || 'Không thể lưu nội dung quan trọng.');
    } finally { setScheduleImportantSaving(false); }
  };

  const deletePersistentImportant = async (item) => {
    if (!selectedClassId || !item?.id || item.virtualTemplate) return;
    try { await classroomApi.deleteSchedule(selectedClassId, item.id); }
    catch (error) { setScheduleSyncMessage(error?.message || 'Không thể xóa nội dung quan trọng.'); }
  };

  const exportSchedulePdf = () => {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 1240;
    canvas.height = 1754;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0f172a';
    ctx.font = '700 40px Arial, sans-serif';
    ctx.fillText('Thời khóa biểu', 60, 68);
    ctx.fillStyle = '#64748b';
    ctx.font = '500 21px Arial, sans-serif';
    ctx.fillText(`Lớp ${selectedClass?.name || ''} · Tuần ${scheduleWeekStart.toLocaleDateString('vi-VN')} - ${addDays(scheduleWeekStart, 4).toLocaleDateString('vi-VN')}`, 60, 110);

    const left = 60;
    const top = 155;
    const timeWidth = 150;
    const dayWidth = 194;
    const headerHeight = 64;
    const totalWidth = timeWidth + dayWidth * scheduleWeekDays.length;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(left, top, totalWidth, headerHeight);
    ctx.strokeStyle = '#dbe3ef';
    ctx.strokeRect(left, top, totalWidth, headerHeight);
    ctx.font = '700 17px Arial, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';
    ctx.fillText('Thời gian', left + timeWidth / 2, top + headerHeight / 2);
    scheduleWeekDays.forEach((day, index) => {
      const x = left + timeWidth + index * dayWidth;
      ctx.strokeRect(x, top, dayWidth, headerHeight);
      ctx.fillText(`${day.label} ${day.shortDate}`, x + dayWidth / 2, top + headerHeight / 2);
    });

    let y = top + headerHeight;
    scheduleTimeSlots.forEach((slot, slotIndex) => {
      const rowHeight = 92;
      ctx.fillStyle = slotIndex % 2 ? '#ffffff' : '#fbfdff';
      ctx.fillRect(left, y, totalWidth, rowHeight);
      ctx.strokeStyle = '#e5e7eb';
      ctx.strokeRect(left, y, timeWidth, rowHeight);
      ctx.fillStyle = '#334155';
      ctx.font = '700 17px Arial, sans-serif';
      ctx.fillText(`Tiết ${slot.period}`, left + timeWidth / 2, y + 28);
      ctx.font = '500 15px Arial, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`${slot.startTime} - ${slot.endTime}`, left + timeWidth / 2, y + 57);
      scheduleWeekDays.forEach((day, dayIndex) => {
        const x = left + timeWidth + dayIndex * dayWidth;
        ctx.strokeRect(x, y, dayWidth, rowHeight);
        const item = scheduleWeekItems.find((entry) => getScheduleDateFromItem(entry) === day.key && getScheduleStartTime(entry) === slot.startTime);
        if (!item) return;
        const title = item.subjectName || item.subject || item.title || 'Nội dung lịch';
        const room = item.room || item.location || '';
        ctx.fillStyle = '#1d4ed8';
        ctx.font = '700 16px Arial, sans-serif';
        let displayTitle = String(title);
        while (ctx.measureText(displayTitle).width > dayWidth - 20 && displayTitle.length > 4) displayTitle = `${displayTitle.slice(0, -2)}…`;
        ctx.fillText(displayTitle, x + dayWidth / 2, y + 35);
        ctx.fillStyle = '#64748b';
        ctx.font = '500 14px Arial, sans-serif';
        ctx.fillText(room, x + dayWidth / 2, y + 61);
      });
      y += rowHeight;
      scheduleBreaks.filter((item) => Number(item.afterPeriod) === Number(slot.period)).forEach((item) => {
        const breakHeight = 52;
        ctx.fillStyle = '#fff7ed';
        ctx.fillRect(left, y, totalWidth, breakHeight);
        ctx.strokeStyle = '#fed7aa';
        ctx.strokeRect(left, y, totalWidth, breakHeight);
        ctx.fillStyle = '#c2410c';
        ctx.font = '700 15px Arial, sans-serif';
        ctx.fillText(`${item.label} · ${item.startTime} - ${item.endTime}`, left + totalWidth / 2, y + breakHeight / 2);
        y += breakHeight;
      });
    });
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 15px Arial, sans-serif';
    ctx.fillText('Dữ liệu lịch dạy được lấy từ hệ thống tại thời điểm xuất.', 60, 1690);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const binary = atob(dataUrl.split(',')[1]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const pdfBytes = buildJpegPdf([{ width: canvas.width, height: canvas.height, bytes }]);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ThoiKhoaBieu_${String(selectedClass?.name || 'Lop').replace(/[^a-zA-Z0-9_-]+/g, '_')}_${scheduleWeekKey}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const syncScheduleWithGoogle = () => {
    if (typeof window === 'undefined') return;
    if (!scheduleWeekItems.length) {
      setScheduleSyncMessage('Tuần này chưa có nội dung lịch để đồng bộ Google Calendar.');
      return;
    }
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ZUNY//Lich day//VI', 'CALSCALE:GREGORIAN'];
    scheduleWeekItems.forEach((item) => {
      const dateKey = getScheduleDateFromItem(item);
      const startTime = getScheduleStartTime(item);
      const endTime = getScheduleEndTime(item);
      if (!dateKey || !startTime || !endTime) return;
      const title = item.subjectName || item.subject || item.title || 'Lịch dạy';
      lines.push(
        'BEGIN:VEVENT',
        `UID:zuny-${selectedClassId}-${item.id}@zuny`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
        `DTSTART:${toIcsDate(dateKey, startTime)}`,
        `DTEND:${toIcsDate(dateKey, endTime)}`,
        `SUMMARY:${escapeIcsText(title)}`,
        `LOCATION:${escapeIcsText(item.room || item.location || '')}`,
        `DESCRIPTION:${escapeIcsText(item.note || '')}`,
        'END:VEVENT'
      );
    });
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `LichDay_${String(selectedClass?.name || 'Lop').replace(/[^a-zA-Z0-9_-]+/g, '_')}_${scheduleWeekKey}.ics`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setScheduleSyncMessage('Đã tự động tải file Google Calendar (.ics). Làm theo hướng dẫn để nhập lịch vào Google Calendar.');
    setScheduleGoogleGuideOpen(true);
  };

  const saveScheduleEditor = async () => {
    if (!selectedClassId || !currentUser?.uid || scheduleEditorSaving) return;

    if (scheduleEditorMode === 'slots') {
      try {
        const nextConfig = normalizeDraftScheduleConfig();
        await saveScheduleTimeConfig(nextConfig, 'week');
      } catch (error) {
        setScheduleEditorError(error?.message || 'Khung giờ chưa hợp lệ.');
      }
      return;
    }

    const date = scheduleEditorForm.date;
    const startTime = normalizeScheduleTime(scheduleEditorForm.startTime);
    const endTime = normalizeScheduleTime(scheduleEditorForm.endTime);
    if (!date || !startTime || !endTime) {
      setScheduleEditorError('Khung thời gian của tiết học chưa hợp lệ.');
      return;
    }
    if (!scheduleEditorForm.title.trim()) {
      setScheduleEditorError('Môn học là nội dung bắt buộc.');
      return;
    }
    if (endTime <= startTime) {
      setScheduleEditorError('Giờ kết thúc phải sau giờ bắt đầu.');
      return;
    }
    try {
      setScheduleEditorSaving(true);
      setScheduleEditorError('');
      const payload = {
        classId: selectedClassId, weekKey: scheduleWeekKey, date, weekday: new Date(`${date}T00:00:00`).getDay(),
        startTime, endTime, title: scheduleEditorForm.title.trim(), lessonContent: scheduleEditorForm.lessonContent.trim(), room: ensureScheduleRoomPrefix(scheduleEditorForm.room),
        note: scheduleEditorForm.note.trim(), important: Boolean(scheduleEditorForm.important), teacherId: currentUser.uid,
      };
      if (scheduleEditorTargetId) {
        await classroomApi.updateSchedule(selectedClassId, scheduleEditorTargetId, payload);
      } else {
        await classroomApi.createSchedule(selectedClassId, payload);
      }
      setScheduleEditorOpen(false);
      setScheduleEditorSaving(false);
    } catch (error) {
      console.error('Không thể lưu lịch dạy:', error);
      setScheduleEditorOpen(true);
      setScheduleEditorError(error?.message || 'Không thể lưu lịch dạy.');
    } finally {
      setScheduleEditorSaving(false);
    }
  };


  const topStudents = useMemo(() => rankedScoreRows.filter((row) => row.average !== null).slice(0, 3), [rankedScoreRows]);

  const automaticNotificationCandidates = useMemo(() => {
    if (!selectedClassId || !currentUser?.uid) return [];
    const candidates = [];
    const pushCandidate = (sourceKey, type, severity, title, message, extra = {}) => {
      const scopedSourceKey = `${sourceKey}-recipient-${currentUser.uid}`;
      candidates.push({
        id: makeNotificationDocId(scopedSourceKey), sourceKey: scopedSourceKey, type, severity, title, message, classId: selectedClassId,
        systemGenerated: true, automaticLabel: 'Thông báo tự động', recipientType: 'teacher', recipientUid: currentUser.uid,
        recipientEmail: normalizeText(currentUser.email), ...extra,
      });
    };
    const pushStudentCandidate = (student, sourceKey, type, severity, title, message, extra = {}) => {
      if (!student?.id) return;
      const recipientUid = student.uid || '';
      const recipientEmail = normalizeText(student.email);
      if (!recipientUid && !recipientEmail) return;
      const recipientKey = recipientUid || recipientEmail || student.id;
      const scopedSourceKey = `${sourceKey}-recipient-${recipientKey}`;
      candidates.push({
        id: makeNotificationDocId(scopedSourceKey), sourceKey: scopedSourceKey, type, severity, title, message, classId: selectedClassId,
        systemGenerated: true, automaticLabel: 'Thông báo tự động', recipientType: 'student', recipientUid, recipientEmail,
        recipientStudentId: student.id, ...extra,
      });
    };

    attendanceStudents.forEach((student) => {
      const metrics = getStudentAttendanceMetrics(student);
      if (metrics.absent >= 3) {
        pushCandidate(`absence-${student.id}`, 'attendance', 'critical', 'Cảnh báo nghỉ học', `${getStudentDisplayName(student)} đã vắng ${metrics.absent} buổi. Cần cảnh báo phụ huynh.`, { studentId: student.id });
        pushStudentCandidate(student, `absence-${student.id}`, 'attendance', 'critical', 'Cảnh báo chuyên cần', `Bạn đã vắng không phép ${metrics.absent} buổi trong lớp ${selectedClass?.name || ''}.`, { studentId: student.id });
      }
    });

    (assignmentsByClass[selectedClassId] || []).forEach((assignment) => {
      const due = getAssignmentDueValue(assignment);
      const submissions = assignment.submissions || assignment.studentSubmissions;
      if (!submissions || typeof submissions !== 'object') return;
      Object.entries(submissions).forEach(([studentId, submission]) => {
        const student = attendanceStudents.find((item) => item.id === studentId);
        const submittedAt = getTimeValue(submission?.submittedAt || submission?.createdAt);
        const lateState = ['late', 'nộp trễ', 'nop tre', 'overdue'].includes(normalizeText(submission?.status || submission?.state));
        if ((due && submittedAt && submittedAt > due) || lateState) {
          pushCandidate(`late-assignment-${assignment.id}-${studentId}`, 'assignment', 'medium', 'Bài tập nộp trễ', `${student ? getStudentDisplayName(student) : submission?.studentName || studentId} nộp trễ ${getAssignmentTitle(assignment)}.`, { studentId, assignmentId: assignment.id });
          if (student) pushStudentCandidate(student, `late-assignment-${assignment.id}-${studentId}`, 'assignment', 'medium', 'Bài tập nộp trễ', `Bài “${getAssignmentTitle(assignment)}” của bạn được ghi nhận là nộp trễ.`, { studentId, assignmentId: assignment.id });
        }
      });
    });

    subjects.forEach((subject) => {
      const source = allSubjectScores[subject.id] || {};
      const tests = [...(source.tests || [])].sort((a, b) => (toNumber(a.order) ?? 0) - (toNumber(b.order) ?? 0));
      (source.scores || []).forEach((row) => {
        const student = attendanceStudents.find((item) => item.id === (row.studentId || row.id));
        if (!student) return;
        const values = tests.map((test) => ({ test, value: toNumber(row.scores?.[test.id]) })).filter((entry) => entry.value !== null);
        values.filter((entry) => entry.value < 5).forEach((entry) => {
          pushCandidate(`low-score-${subject.id}-${student.id}-${entry.test.id}`, 'score', 'critical', 'Điểm thấp cảnh báo', `${getStudentDisplayName(student)} đạt ${formatScore(entry.value)} điểm môn ${subject.name || 'Môn học'} ở ${entry.test.name || entry.test.code || 'bài đánh giá'}.`, { studentId: student.id, subjectId: subject.id });
          pushStudentCandidate(student, `low-score-${subject.id}-${student.id}-${entry.test.id}`, 'score', 'critical', 'Điểm thấp cảnh báo', `Bạn đạt ${formatScore(entry.value)} điểm môn ${subject.name || 'Môn học'} ở ${entry.test.name || entry.test.code || 'bài đánh giá'}.`, { studentId: student.id, subjectId: subject.id });
        });
        const subjectAverage = toNumber(row.average) ?? averageFromScores(values.map((entry) => entry.value));
        if (subjectAverage !== null && subjectAverage < 5) {
          pushCandidate(`low-average-${subject.id}-${student.id}`, 'average', 'critical', 'ĐTB dưới 5', `${getStudentDisplayName(student)} có ĐTB môn ${subject.name || 'Môn học'} là ${formatScore(subjectAverage)}.`, { studentId: student.id, subjectId: subject.id });
          pushStudentCandidate(student, `low-average-${subject.id}-${student.id}`, 'average', 'critical', 'ĐTB dưới 5', `Điểm trung bình môn ${subject.name || 'Môn học'} của bạn hiện là ${formatScore(subjectAverage)}.`, { studentId: student.id, subjectId: subject.id });
        }
        const latest = values.slice(-3);
        if (latest.length === 3 && latest[0].value < latest[1].value && latest[1].value < latest[2].value) {
          pushCandidate(`improvement-${subject.id}-${student.id}-${latest.map((entry) => entry.test.id).join('-')}`, 'reward', 'reward', 'Đề xuất khen thưởng', `${getStudentDisplayName(student)} có điểm môn ${subject.name || 'Môn học'} tăng liên tục: ${latest.map((entry) => formatScore(entry.value)).join(' → ')}.`, { studentId: student.id, subjectId: subject.id });
          pushStudentCandidate(student, `improvement-${subject.id}-${student.id}-${latest.map((entry) => entry.test.id).join('-')}`, 'reward', 'reward', 'Khen thưởng tiến bộ', `Điểm môn ${subject.name || 'Môn học'} của bạn tăng liên tục: ${latest.map((entry) => formatScore(entry.value)).join(' → ')}.`, { studentId: student.id, subjectId: subject.id });
        }
      });
    });

    scheduleItems.filter((item) => item.kind !== 'persistentImportant' && Boolean(item.important || item.isImportant || item.pinned)).forEach((item) => {
      const days = getDaysUntilDate(getScheduleDateFromItem(item), now);
      if (days !== null && days >= 0 && days <= 2) {
        const teacherMessage = `${item.title || item.subjectName || item.subject || 'Nội dung quan trọng'} diễn ra ${days === 0 ? 'hôm nay' : `sau ${days} ngày`}.`;
        pushCandidate(`schedule-important-${item.id}`, 'schedule', 'medium', 'Lịch dạy quan trọng sắp tới', teacherMessage, { scheduleId: item.id });
        attendanceStudents.forEach((student) => pushStudentCandidate(student, `schedule-important-${item.id}`, 'schedule', 'medium', 'Lịch học quan trọng sắp tới', teacherMessage, { scheduleId: item.id }));
      }
    });

    persistentImportantItems.forEach((item) => {
      const days = getDaysUntilDate(item.date, now);
      if (days === null || days < 0 || days > 7) return;
      const milestone = days <= 3 ? 3 : days <= 5 ? 5 : 7;
      const message = `${item.title} còn ${days === 0 ? 'hôm nay' : `${days} ngày`} trước khi hết thời gian.`;
      pushCandidate(`persistent-important-${item.id}-${milestone}`, 'schedulePersistent', 'important', 'Nhắc nội dung quan trọng', message, { scheduleId: item.id });
      attendanceStudents.forEach((student) => pushStudentCandidate(student, `persistent-important-${item.id}-${milestone}`, 'schedulePersistent', 'important', 'Nhắc nội dung quan trọng', message, { scheduleId: item.id }));
    });
    return candidates;
  }, [allSubjectScores, assignmentsByClass, attendanceRecords, attendanceStudents, currentUser?.email, currentUser?.uid, now, persistentImportantItems, scheduleItems, selectedClass?.name, selectedClassId, subjects]);

  const teacherNotifications = useMemo(() => {
    const currentSqlUserId = getCurrentSqlUserId(currentUser);

    return notifications.filter((item) => {
      if (
        currentSqlUserId &&
        userIdListIncludes(
          item.dismissedBy,
          currentSqlUserId,
        )
      ) {
        return false;
      }

      const recipientUid = item.recipientUid || item.recipientUserId || item.targetUid || '';
      const recipientEmail = normalizeText(item.recipientEmail || item.targetEmail);
      const recipientType = normalizeText(item.recipientType);
      const hasRecipient = Boolean(recipientUid || recipientEmail || recipientType);

      if (!hasRecipient) {
        return !item.systemGenerated || sameUserId(item.authorId, currentSqlUserId);
      }

      if (recipientType === 'class') return !item.systemGenerated;
      if (recipientType && !['teacher', 'user'].includes(recipientType)) return false;

      return Boolean(
        (recipientUid && sameUserId(recipientUid, currentSqlUserId)) ||
        (recipientEmail && recipientEmail === normalizeText(currentUser?.email))
      );
    });
  }, [currentUser, notifications]);

  const teacherCreatedAnnouncements = useMemo(
    () => teacherNotifications.filter((item) => !item.systemGenerated),
    [teacherNotifications]
  );

  useEffect(() => {
    if (!selectedClassId || !getCurrentSqlUserId(currentUser) || !automaticNotificationCandidates.length) return undefined;

    // Kiểm tra trên toàn bộ notification của lớp, không chỉ notification dành cho giáo viên.
    // Nếu chỉ dùng teacherNotifications thì notification dành cho học sinh luôn bị coi là thiếu
    // và bị ghi lại hàng loạt sau mỗi thay đổi lịch.
    const existing = new Set(
      notifications
        .map((item) => item.sourceKey)
        .filter(Boolean)
    );

    const dismissed = new Set(
      Array.isArray(selectedClass?.dismissedNotificationSourceKeys)
        ? selectedClass.dismissedNotificationSourceKeys
        : []
    );

    const missing = automaticNotificationCandidates.filter(
      (item) =>
        !existing.has(item.sourceKey) &&
        !dismissed.has(item.sourceKey)
    );

    if (!missing.length) return undefined;

    let cancelled = false;

    const syncAutomaticNotifications = async () => {
      try {
        for (let index = 0; index < missing.length; index += 100) {
          if (cancelled) return;

          await Promise.all(
            missing
              .slice(index, index + 100)
              .map((item) => classroomApi.createNotification(
                selectedClassId,
                {
                  ...item,
                  readBy: [],
                  authorName: 'Hệ thống lớp học',
                },
              ))
          );
        }

        if (cancelled) return;

        const result = await classroomApi.listNotifications(
          selectedClassId,
          {
            all: true,
            limit: 500,
          },
        );

        if (!cancelled) {
          setNotifications(
            Array.isArray(result?.notifications)
              ? result.notifications
              : []
          );
        }
      } catch (error) {
        console.error('Không thể tạo thông báo tự động:', error);
      }
    };

    syncAutomaticNotifications();

    return () => {
      cancelled = true;
    };
  }, [automaticNotificationCandidates, currentUser, notifications, selectedClass?.dismissedNotificationSourceKeys, selectedClassId]);

  const unreadNotifications = useMemo(() => {
    const currentSqlUserId = getCurrentSqlUserId(currentUser);

    return teacherNotifications.filter(
      (item) =>
        !currentSqlUserId ||
        !userIdListIncludes(
          item.readBy,
          currentSqlUserId,
        )
    );
  }, [currentUser, teacherNotifications]);

  const visibleNotifications = useMemo(
    () => notificationFilter === 'unread'
      ? unreadNotifications
      : teacherNotifications,
    [notificationFilter, teacherNotifications, unreadNotifications]
  );

  const markNotificationRead = async (item) => {
    if (!selectedClassId || !item?.id || !getCurrentSqlUserId(currentUser)) return;

    try {
      setNotificationActionError('');

      const result = await classroomApi.readNotification(
        selectedClassId,
        item.id,
      );

      if (result?.notification) {
        setNotifications((current) =>
          current.map((currentItem) =>
            String(currentItem.id) === String(item.id)
              ? result.notification
              : currentItem
          )
        );
      }
    } catch (error) {
      setNotificationActionError(error?.message || 'Không thể đánh dấu đã đọc.');
    }
  };

  const markAllNotificationsRead = async () => {
    if (!selectedClassId || !getCurrentSqlUserId(currentUser) || !unreadNotifications.length) return;

    try {
      setNotificationActionError('');

      const results = await Promise.all(
        unreadNotifications.map((item) =>
          classroomApi.readNotification(
            selectedClassId,
            item.id,
          )
        )
      );

      const updatedById = new Map(
        results
          .map((result) => result?.notification)
          .filter(Boolean)
          .map((notification) => [
            String(notification.id),
            notification,
          ])
      );

      setNotifications((current) =>
        current.map((item) =>
          updatedById.get(String(item.id)) || item
        )
      );
    } catch (error) {
      setNotificationActionError(error?.message || 'Không thể đánh dấu tất cả đã đọc.');
    }
  };

  const deleteAllNotifications = async () => {
    if (!selectedClassId || !getCurrentSqlUserId(currentUser) || !teacherNotifications.length || deletingAllNotifications) return;

    if (!canTeachClass) {
      setNotificationActionError('Bạn không có quyền quản lý thông báo của lớp.');
      return;
    }

    try {
      setDeletingAllNotifications(true);
      setNotificationActionError('');

      const attachments = teacherNotifications.flatMap(
        (item) =>
          (item.attachments || []).filter(
            (attachment) =>
              attachment?.type === 'file' &&
              (attachment?.storagePath || attachment?.url)
          )
      );

      await Promise.all(
        attachments.map(async (attachment) => {
          const storagePath = getR2StoragePath(attachment);
          if (!storagePath) return;

          try {
            await classroomApi.deleteAsset(storagePath);
          } catch (error) {
            if (error?.status !== 404 && error?.response?.status !== 404) {
              throw error;
            }
          }
        })
      );

      const results = await Promise.all(
        teacherNotifications.map(async (item) => {
          if (item.sourceKey) {
            return classroomApi.dismissNotification(
              selectedClassId,
              item.id,
            );
          }

          await classroomApi.deleteNotification(
            selectedClassId,
            item.id,
          );

          return {
            deletedId: String(item.id),
          };
        })
      );

      const dismissedById = new Map(
        results
          .map((result) => result?.notification)
          .filter(Boolean)
          .map((notification) => [
            String(notification.id),
            notification,
          ])
      );

      const deletedIds = new Set(
        results
          .map((result) => result?.deletedId)
          .filter(Boolean)
      );

      setNotifications((current) =>
        current
          .filter((item) => !deletedIds.has(String(item.id)))
          .map((item) =>
            dismissedById.get(String(item.id)) || item
          )
      );

      setNotificationDeleteAllOpen(false);
    } catch (error) {
      console.error('Không thể xóa toàn bộ thông báo:', error);
      setNotificationActionError(error?.message || 'Không thể xóa toàn bộ thông báo.');
    } finally {
      setDeletingAllNotifications(false);
    }
  };

  const messageContacts = useMemo(() => {
    const contacts = [];
    attendanceStudents.forEach((student) => {
      const studentName = getStudentDisplayName(student);
      const studentEmail = normalizeText(student.email);
      if (studentEmail) contacts.push({ id: `student:${student.id}`, memberId: student.id, uid: student.uid || '', email: studentEmail, name: studentName, type: 'student', label: 'Học sinh', avatar: getStudentAvatar(student) });
      const parentEmail = normalizeText(student.parentEmail || student.guardianEmail);
      if (parentEmail) contacts.push({ id: `parent:${student.id}:${parentEmail}`, memberId: student.id, uid: '', email: parentEmail, name: student.parentName || student.guardianName || parentEmail, type: 'parent', label: 'Phụ huynh', avatar: '' });
    });
    const seen = new Set();
    return contacts.filter((item) => { const key = `${item.type}:${item.email}`; if (seen.has(key)) return false; seen.add(key); return true; });
  }, [attendanceStudents]);

  const conversationRows = useMemo(() => {
    const rows = messageContacts.map((contact) => {
      const conversationId = `${contact.type}:${contact.email}`;
      const related = messages.filter((item) => item.conversationId === conversationId || normalizeText(item.senderEmail) === contact.email || normalizeText(item.receiverEmail) === contact.email);
      const last = related[related.length - 1] || null;
      return { ...contact, conversationId, messages: related, last };
    });
    return rows.sort((a, b) => getTimeValue(b.last?.createdAt) - getTimeValue(a.last?.createdAt));
  }, [messageContacts, messages]);

  const filteredConversationRows = useMemo(() => {
    const keyword = normalizeText(messageSearch);
    if (!keyword) return conversationRows;
    return conversationRows.filter((item) => [item.name, item.email, item.label, item.last?.content].some((value) => normalizeText(value).includes(keyword)));
  }, [conversationRows, messageSearch]);

  useEffect(() => {
    if (selectedConversationId && conversationRows.some((item) => item.conversationId === selectedConversationId)) return;
    setSelectedConversationId(conversationRows[0]?.conversationId || '');
  }, [conversationRows, selectedConversationId]);

  useEffect(() => {
    if (activeTab !== 'messages') setMessageMobileChatOpen(false);
  }, [activeTab]);

  useEffect(() => {
    setMessageMobileChatOpen(false);
  }, [selectedClassId]);

  const selectedConversation = useMemo(() => conversationRows.find((item) => item.conversationId === selectedConversationId) || null, [conversationRows, selectedConversationId]);


  const currentTeacherProfile = useMemo(
    () => userProfilesByEmail[normalizeText(currentUser?.email)] || {},
    [currentUser?.email, userProfilesByEmail]
  );

  const currentTeacherAvatar = useMemo(() => getUserAvatar({
    ...(currentTeacherProfile || {}),
    ...(currentUser || {}),
    ...(userDetails || {}),
  }), [currentTeacherProfile, currentUser, userDetails]);

  const activeMessageDraft = selectedConversationId ? (messageDrafts[selectedConversationId] || '') : '';
  const activeMessageAttachment = selectedConversationId ? (messageAttachments[selectedConversationId] || null) : null;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const frame = window.requestAnimationFrame(() => resizeChatTextarea(messageTextareaRef.current, 140));
    return () => window.cancelAnimationFrame(frame);
  }, [activeMessageDraft, selectedConversationId]);

  const setActiveMessageDraft = (value) => {
    if (!selectedConversationId) return;
    setMessageDrafts((current) => ({ ...current, [selectedConversationId]: value }));
  };

  const setActiveMessageAttachment = (file) => {
    if (!selectedConversationId) return;
    setMessageAttachments((current) => {
      const next = { ...current };
      if (file) next[selectedConversationId] = file;
      else delete next[selectedConversationId];
      return next;
    });
  };

  const copyMessage = async (item) => {
    const text = item?.recalled
      ? 'Tin nhắn đã thu hồi'
      : (item?.content || item?.attachment?.url || '');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(item.id);
      window.setTimeout(() => setCopiedMessageId((current) => current === item.id ? '' : current), 1400);
    } catch (error) {
      console.error('Không thể sao chép tin nhắn:', error);
      setMessageError('Không thể sao chép tin nhắn.');
    }
  };

  const openRecallMessageConfirm = (item) => {
    if (
      !item?.id ||
      !sameUserId(item.senderId, getCurrentSqlUserId(currentUser)) ||
      item.recalled ||
      recallingMessageId
    ) return;

    setMessageRecallConfirm(item);
  };

  const recallMessage = async (item) => {
    if (
      !selectedClassId ||
      !getCurrentSqlUserId(currentUser) ||
      !item?.id ||
      !sameUserId(item.senderId, getCurrentSqlUserId(currentUser)) ||
      item.recalled ||
      recallingMessageId
    ) return;

    try {
      setRecallingMessageId(item.id);
      setMessageRecallConfirm(null);
      setMessageError('');

      if (item.attachment?.storagePath || item.attachment?.url) {
        try {
          const storagePath = getR2StoragePath(item.attachment);
          if (storagePath) {
            await classroomApi.deleteAsset(storagePath);
          }
        } catch (error) {
          if (error?.status !== 404 && error?.response?.status !== 404) {
            throw error;
          }
        }
      }

      // Giữ nguyên hành vi cũ: xóa nội dung và attachment trước khi đánh dấu recalled.
      await classroomApi.updateMessage(
        selectedClassId,
        item.id,
        {
          content: '',
          attachment: null,
        },
      );

      const result = await classroomApi.recallMessage(
        selectedClassId,
        item.id,
      );

      if (result?.message) {
        setMessages((current) =>
          current.map((currentItem) =>
            String(currentItem.id) === String(item.id)
              ? result.message
              : currentItem
          )
        );
      }
    } catch (error) {
      console.error('Không thể thu hồi tin nhắn:', error);
      setMessageError(error?.message || 'Không thể thu hồi tin nhắn.');
    } finally {
      setRecallingMessageId('');
    }
  };

  const sendMessage = async () => {
    if (!selectedClassId || !currentUser?.uid || !selectedConversation || messageSending) return;
    const conversationId = selectedConversation.conversationId;
    const content = (messageDrafts[conversationId] || '').trim();
    if (content.length > 2000) { setMessageError('Tin nhắn tối đa 2000 ký tự.'); return; }
    const pendingAttachment = messageAttachments[conversationId] || null;
    if (!content && !pendingAttachment) return;
    try {
      setMessageSending(true);
      setMessageError('');
      let attachment = null;
      if (pendingAttachment) {
        const uploadResult = await classroomApi.uploadMessageAsset(
          selectedClassId,
          pendingAttachment,
        );
        const attachmentUrl =
          uploadResult?.url ||
          uploadResult?.publicUrl ||
          uploadResult?.fileUrl ||
          uploadResult?.downloadUrl ||
          '';
        const storagePath =
          uploadResult?.storagePath ||
          uploadResult?.objectKey ||
          uploadResult?.key ||
          uploadResult?.path ||
          '';
        if (!attachmentUrl || !storagePath) {
          throw new Error('R2 không trả về đầy đủ thông tin file tin nhắn.');
        }
        attachment = {
          name: pendingAttachment.name,
          url: attachmentUrl,
          type: pendingAttachment.type || 'file',
          storagePath,
        };
      }
      const result = await classroomApi.createMessage(
        selectedClassId,
        {
          conversationId,
          receiverId: selectedConversation.uid || selectedConversation.memberId || '',
          receiverEmail: selectedConversation.email,
          receiverName: selectedConversation.name,
          receiverType: selectedConversation.type,
          receiverAvatar: selectedConversation.avatar || '',
          content,
          attachment,
        },
      );

      if (result?.message) {
        setMessages((current) => {
          const exists = current.some(
            (item) =>
              String(item.id) === String(result.message.id)
          );

          return exists
            ? current.map((item) =>
                String(item.id) === String(result.message.id)
                  ? result.message
                  : item
              )
            : [...current, result.message];
        });
      }
      setMessageDrafts((current) => ({ ...current, [conversationId]: '' }));
      setMessageAttachments((current) => {
        const next = { ...current };
        delete next[conversationId];
        return next;
      });
      if (messageFileInputRef.current) messageFileInputRef.current.value = '';
    } catch (error) {
      console.error('Không thể gửi tin nhắn:', error);
      setMessageError(error?.message || 'Không thể gửi tin nhắn.');
    } finally {
      setMessageSending(false);
    }
  };

  const recentActivities = useMemo(() => {
    const items = [
      ...notifications.map((item) => ({ id: `notification-${item.id}`, type: 'notification', icon: '🔔', text: 'Thông báo lớp học được đăng', detail: item.authorName || 'Giáo viên', at: getTimeValue(item.updatedAt || item.createdAt) })),
      ...(assignmentsByClass[selectedClassId] || []).map((item) => ({ id: `assignment-${item.id}`, type: 'assignment', icon: '📝', text: getAssignmentTitle(item), detail: 'Bài tập', at: getTimeValue(item.updatedAt || item.createdAt) })),
      ...attendanceRecords.map((item) => ({ id: `attendance-${item.id}`, type: 'attendance', icon: '✓', text: 'Dữ liệu điểm danh được cập nhật', detail: item.note || 'Điểm danh', at: getTimeValue(item.updatedAt || item.createdAt || item.date) })),
    ].filter((item) => item.at).sort((a, b) => b.at - a.at);
    return items.slice(0, 5);
  }, [assignmentsByClass, attendanceRecords, notifications, selectedClassId]);

  const assignmentStatus = useMemo(() => {
    const rows = assignmentsByClass[selectedClassId] || [];
    return rows.reduce((acc, item) => {
      if (isAssignmentDraft(item)) acc.draft += 1;
      else if (isAssignmentClosed(item) || (getAssignmentDueValue(item) && getAssignmentDueValue(item) < now.getTime())) acc.closed += 1;
      else acc.open += 1;
      const ungraded = toNumber(item.ungradedCount);
      if (ungraded !== null && ungraded > 0) acc.needsGrading += 1;
      return acc;
    }, { open: 0, needsGrading: 0, draft: 0, closed: 0 });
  }, [assignmentsByClass, now, selectedClassId]);

  const classHealthMetrics = useMemo(() => {
    const attendance = attendanceSummary.monthRate === null ? null : Math.max(0, Math.min(100, attendanceSummary.monthRate));
    const scores = overviewData.classAverage === null ? null : Math.max(0, Math.min(100, Number(overviewData.classAverage) * 10));
    const classAssignments = assignmentsByClass[selectedClassId] || [];
    const completionRates = classAssignments.map((item) => {
      const direct = toNumber(item.completionRate ?? item.completionPercent);
      if (direct !== null) return direct;
      const completed = toNumber(item.completedCount ?? item.submittedCount);
      const total = toNumber(item.totalCount ?? item.studentCount ?? item.assignedCount);
      return completed !== null && total ? (completed / total) * 100 : null;
    }).filter((value) => value !== null);
    const assignments = completionRates.length
      ? Math.max(0, Math.min(100, completionRates.reduce((sum, value) => sum + value, 0) / completionRates.length))
      : null;
    const components = [attendance, scores, assignments].filter((value) => value !== null);
    return {
      attendance,
      scores,
      assignments,
      overall: components.length ? Math.round(components.reduce((sum, value) => sum + value, 0) / components.length) : null,
    };
  }, [assignmentsByClass, attendanceSummary.monthRate, overviewData.classAverage, selectedClassId]);

  const classHealth = classHealthMetrics.overall;

  const scoreDashboard = useMemo(() => {
    const assessmentGroups = [
      { id: 'assignment', label: 'Bài tập', matches: ['assignment', 'bài tập', 'bai tap', 'exercise'] },
      { id: 'quiz', label: 'Quiz', matches: ['quiz', 'kiểm tra ngắn', 'kiem tra ngan'] },
      { id: 'midterm', label: 'Giữa kỳ', matches: ['midterm', 'giữa kỳ', 'giua ky', 'giữa kì', 'giua ki'] },
      { id: 'final', label: 'Cuối kỳ', matches: ['final', 'cuối kỳ', 'cuoi ky', 'cuối kì', 'cuoi ki'] },
    ];

    const getTestGroup = (test = {}) => {
      const source = normalizeText([test.type, test.category, test.kind, test.name, test.code].filter(Boolean).join(' '));
      return assessmentGroups.find((group) => group.matches.some((match) => source.includes(match)))?.id || '';
    };

    const assessmentGroupsWithWeights = assessmentGroups.map((group) => {
      const weights = subjects.flatMap((subject) => (allSubjectScores[subject.id]?.tests || []))
        .filter((test) => getTestGroup(test) === group.id)
        .map((test) => toNumber(test.weight ?? test.percentage ?? test.percent))
        .filter((value) => value !== null);
      const weight = weights.length ? weights.reduce((sum, value) => sum + value, 0) / weights.length : null;
      return { ...group, weight };
    });

    const subjectCards = subjects.map((subject, index) => {
      const source = allSubjectScores[subject.id] || {};
      const tests = source.tests || [];
      const rows = source.scores || [];
      const values = rows.map((row) => {
        const direct = toNumber(row.average);
        if (direct !== null) return direct;
        return averageFromScores(tests.map((test) => row.scores?.[test.id]));
      }).filter((value) => value !== null);
      return {
        id: subject.id,
        name: subject.name || 'Môn học',
        average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
        tone: index % 6,
      };
    });

    const rows = attendanceStudents.map((student, index) => {
      const groupValues = Object.fromEntries(assessmentGroups.map((group) => [group.id, []]));
      const subjectAverages = [];
      subjects.forEach((subject) => {
        const source = allSubjectScores[subject.id] || {};
        const tests = source.tests || [];
        const scoreRow = (source.scores || []).find((item) => (item.studentId || item.id) === student.id);
        if (!scoreRow) return;
        const directAverage = toNumber(scoreRow.average);
        const fallbackAverage = averageFromScores(tests.map((test) => scoreRow.scores?.[test.id]));
        const subjectAverage = directAverage ?? fallbackAverage;
        if (subjectAverage !== null) subjectAverages.push(subjectAverage);
        tests.forEach((test) => {
          const value = toNumber(scoreRow.scores?.[test.id]);
          const groupId = getTestGroup(test);
          if (value !== null && groupId) groupValues[groupId].push(value);
        });
      });
      const groups = Object.fromEntries(assessmentGroups.map((group) => [
        group.id,
        groupValues[group.id].length ? groupValues[group.id].reduce((sum, value) => sum + value, 0) / groupValues[group.id].length : null,
      ]));
      const overall = subjectAverages.length ? subjectAverages.reduce((sum, value) => sum + value, 0) / subjectAverages.length : null;
      return { student, index, groups, overall };
    });

    rows.sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1) || normalizeText(getStudentDisplayName(a.student)).localeCompare(normalizeText(getStudentDisplayName(b.student))));
    let rank = 0;
    let lastScore = null;
    const rankedRows = rows.map((row, index) => {
      if (row.overall !== null && row.overall !== lastScore) rank = index + 1;
      if (row.overall !== null) lastScore = row.overall;
      return { ...row, rank: row.overall === null ? null : rank };
    });

    const distribution = [
      { id: 'excellent', label: '9–10', title: 'Xuất sắc', min: 9, max: 10, tone: 'excellent' },
      { id: 'good', label: '8–9', title: 'Giỏi', min: 8, max: 9, tone: 'good' },
      { id: 'fair', label: '7–8', title: 'Khá', min: 7, max: 8, tone: 'fair' },
      { id: 'average', label: '5–7', title: 'Trung bình', min: 5, max: 7, tone: 'average' },
      { id: 'weak', label: '<5', title: 'Yếu', min: -Infinity, max: 5, tone: 'weak' },
    ].map((band) => ({
      ...band,
      count: rankedRows.filter((row) => row.overall !== null && row.overall >= band.min && (band.max === 10 ? row.overall <= band.max : row.overall < band.max)).length,
    }));
    const totalWithScores = rankedRows.filter((row) => row.overall !== null).length;
    const maxDistribution = Math.max(1, ...distribution.map((item) => item.count));
    const requiredGroupIds = ['assignment', 'midterm', 'final'];
    const missingByGroup = Object.fromEntries(requiredGroupIds.map((groupId) => [
      groupId,
      rankedRows.filter((row) => row.groups[groupId] === null).length,
    ]));
    const incompleteStudentCount = rankedRows.filter((row) => requiredGroupIds.some((groupId) => row.groups[groupId] === null)).length;

    return { assessmentGroups: assessmentGroupsWithWeights, subjectCards, rankedRows, distribution, totalWithScores, maxDistribution, missingByGroup, incompleteStudentCount };
  }, [allSubjectScores, attendanceStudents, subjects]);

  const visibleClasses = useMemo(() => {
    const keyword = normalizeText(classSearch);
    if (!keyword) return classes;
    return classes.filter((item) => [item.name, item.grade, item.subject, item.teacherName, item.school, item.schoolName].some((value) => normalizeText(value).includes(keyword)));
  }, [classSearch, classes]);

  const formatDateTime = (value) => {
    const millis = getTimeValue(value);
    if (!millis) return 'Chưa có thời gian';
    return new Date(millis).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };


  const exportScorePdf = () => {
    if (typeof document === 'undefined') return;
    const visibleGroups = scoreDashboard.assessmentGroups.filter((group) => group.id !== 'quiz');
    const rowsPerPage = 18;
    const sourceRows = scoreDashboard.rankedRows.length ? scoreDashboard.rankedRows : [null];
    const pageCount = Math.max(1, Math.ceil(sourceRows.length / rowsPerPage));
    const pages = [];

    const classificationOf = (score) => {
      if (score === null || score === undefined) return '—';
      if (score >= 9) return 'Xuất sắc';
      if (score >= 8) return 'Giỏi';
      if (score >= 7) return 'Khá';
      if (score >= 5) return 'Trung bình';
      return 'Yếu';
    };

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = 1240;
      canvas.height = 1754;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 40px Arial, sans-serif';
      ctx.fillText('Đánh giá & Điểm số', 70, 72);
      ctx.font = '500 22px Arial, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`Lớp ${selectedClass?.name || ''} — Năm học ${schoolYear}`, 70, 116);
      ctx.textAlign = 'right';
      ctx.fillText(`Trang ${pageIndex + 1}/${pageCount}`, 1170, 116);
      ctx.textAlign = 'left';

      const cardWidth = 165;
      const cardGap = 18;
      scoreDashboard.subjectCards.slice(0, 6).forEach((subject, index) => {
        const x = 70 + index * (cardWidth + cardGap);
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, 155, cardWidth, 94, 16);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#0f172a';
        ctx.font = '700 25px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(subject.average === null ? '—' : subject.average.toFixed(1), x + cardWidth / 2, 190);
        ctx.fillStyle = '#64748b';
        ctx.font = '500 16px Arial, sans-serif';
        ctx.fillText(subject.name || 'Môn học', x + cardWidth / 2, 225);
      });
      ctx.textAlign = 'left';

      const tableTop = 300;
      const left = 70;
      const widths = [300, 125, 125, 125, 110, 155, 90];
      const headers = ['Học sinh', ...visibleGroups.map((group) => group.label), 'ĐTB', 'Xếp loại', 'Hạng'];
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(left, tableTop, widths.reduce((sum, value) => sum + value, 0), 58);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(left, tableTop, widths.reduce((sum, value) => sum + value, 0), 58);
      let x = left;
      headers.forEach((header, index) => {
        ctx.fillStyle = '#64748b';
        ctx.font = '700 16px Arial, sans-serif';
        ctx.textAlign = index === 0 ? 'left' : 'center';
        ctx.fillText(header, index === 0 ? x + 16 : x + widths[index] / 2, tableTop + 29);
        x += widths[index];
      });

      const pageRows = scoreDashboard.rankedRows.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);
      if (!pageRows.length) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 22px Arial, sans-serif';
        ctx.fillText('Chưa có dữ liệu điểm.', 620, tableTop + 130);
      } else {
        pageRows.forEach((row, rowIndex) => {
          const y = tableTop + 58 + rowIndex * 66;
          ctx.fillStyle = rowIndex % 2 ? '#ffffff' : '#fbfdff';
          ctx.fillRect(left, y, widths.reduce((sum, value) => sum + value, 0), 66);
          ctx.strokeStyle = '#edf2f7';
          ctx.beginPath();
          ctx.moveTo(left, y + 66);
          ctx.lineTo(left + widths.reduce((sum, value) => sum + value, 0), y + 66);
          ctx.stroke();
          const values = [
            getStudentDisplayName(row.student),
            ...visibleGroups.map((group) => formatScore(row.groups[group.id])),
            formatScore(row.overall),
            classificationOf(row.overall),
            row.rank ? `#${row.rank}` : '—',
          ];
          let cellX = left;
          values.forEach((value, index) => {
            ctx.fillStyle = index === values.length - 3 ? '#2563eb' : '#334155';
            ctx.font = index === 0 || index === values.length - 3 ? '700 18px Arial, sans-serif' : '500 17px Arial, sans-serif';
            ctx.textAlign = index === 0 ? 'left' : 'center';
            const text = String(value ?? '—');
            const maxWidth = widths[index] - 22;
            let displayText = text;
            while (ctx.measureText(displayText).width > maxWidth && displayText.length > 4) displayText = `${displayText.slice(0, -2)}…`;
            ctx.fillText(displayText, index === 0 ? cellX + 16 : cellX + widths[index] / 2, y + 33);
            cellX += widths[index];
          });
        });
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 15px Arial, sans-serif';
      ctx.fillText('Dữ liệu được tổng hợp từ hệ thống theo thời gian thực tại thời điểm xuất.', 70, 1690);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const binary = atob(dataUrl.split(',')[1]);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      pages.push({ width: canvas.width, height: canvas.height, bytes });
    }

    const pdfBytes = buildJpegPdf(pages);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `BangDiem_${String(selectedClass?.name || 'Lop').replace(/[^a-zA-Z0-9_-]+/g, '_')}_${schoolYear}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openClassDetail = (classId) => {
    if (!classId) return;
    setSelectedClassId(classId);
    setClassView('detail');

    if (typeof window !== 'undefined') {
      const currentState = window.history.state || {};
      if (
        currentState.classesPage !== 'detail' ||
        currentState.classId !== classId
      ) {
        window.history.pushState({ classesPage: 'detail', classId }, '');
      }
    }
  };

  const goBackToClassList = () => {
    if (
      typeof window !== 'undefined' &&
      window.history.state?.classesPage === 'detail'
    ) {
      window.history.back();
      return;
    }

    setClassView('list');
  };

  const resetClassForm = () => {
    setClassForm({
      name: '',
      grade: '',
    });
    setCreateError('');
  };

  const openCreateClass = () => {
    resetClassForm();
    setCreateOpen(true);
  };

  const closeCreateClass = () => {
    if (creating) return;
    setCreateOpen(false);
    resetClassForm();
  };

  const handleClassFormChange = (event) => {
    const { name, value } = event.target;
    setClassForm((current) => ({ ...current, [name]: value }));
  };

  const handleCreateClass = async (event) => {
    event.preventDefault();

    if (!currentUser?.uid) {
      setCreateError('Bạn cần đăng nhập để tạo lớp học.');
      return;
    }

    const className = classForm.name.trim();
    if (!className) {
      setCreateError('Vui lòng nhập tên lớp học.');
      return;
    }

    const grade = classForm.grade.trim();
    if (!grade) {
      setCreateError('Vui lòng nhập khối lớp để hệ thống sắp xếp sau này.');
      return;
    }

    try {
      setCreating(true);
      setCreateError('');

      const response = await classroomApi.createClassroom({
        name: className,
        grade,
        themeColor: '#2563eb',
        school: teacherSchool,
        description: '',
        subject: teacherSubject,
        schoolYear,
        status: 'active',
      });
      const createdClass = response?.classroom || response;
      if (!createdClass?.id) throw new Error('API không trả về lớp học đã tạo.');
      setSelectedClassId(String(createdClass.id));
      setClassView('detail');
      setCreateOpen(false);
      resetClassForm();
    } catch (error) {
      console.error('Không thể tạo lớp học:', error);
      setCreateError(
        error?.message || 'Không thể tạo lớp học. Vui lòng thử lại.'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleJoinClass = async (event) => {
    event.preventDefault();
    const normalizedCode = joinCode.trim().toUpperCase();
    if (!currentUser?.uid || !normalizedCode) {
      setJoinError('Vui lòng nhập mã lớp.');
      return;
    }
    try {
      setJoining(true);
      setJoinError('');
      const response = await classroomApi.joinClassroom(normalizedCode);
      const joinedClass = response?.classroom || response;
      if (!joinedClass?.id) throw new Error('API không trả về lớp học đã tham gia.');
      setJoinOpen(false);
      setCreateMenuOpen(false);
      setJoinCode('');
      openClassDetail(String(joinedClass.id));
    } catch (error) {
      console.error('Không thể tham gia lớp:', error);
      setJoinError(error?.message || 'Không thể tham gia lớp.');
    } finally {
      setJoining(false);
    }
  };

  const openHomeSettings = () => {
    if (!canTeachClass) return;
    setHomeSettingsForm({
      name: selectedClass?.name || '',
      description: selectedClass?.description || '',
      school: selectedClass?.school || selectedClass?.schoolName || teacherSchool || '',
      grade: selectedClass?.grade || '',
      coverPhotoUrl: selectedClass?.coverPhotoUrl || selectedClass?.coverUrl || selectedClass?.coverPhoto || CLASS_COVER_PRESETS[0].value,
      themeColor: selectedClass?.themeColor || '#2563eb',
    });
    setHomeSettingsError('');
    setCoverLibraryOpen(false);
    setCoverLibraryCategory(CLASS_COVER_CATEGORIES[0].category);
    setHomeSettingsOpen(true);
  };

  const saveHomeSettings = async () => {
    if (!selectedClassId) return;
    if (selectedClass?.teacherId && selectedClass.teacherId !== currentUser?.uid) {
      setHomeSettingsError('Chỉ người tạo lớp mới có thể tùy chỉnh lớp học.');
      return;
    }
    if (!homeSettingsForm.name.trim()) {
      setHomeSettingsError('Tên lớp không được để trống.');
      return;
    }
    if (!homeSettingsForm.grade.trim()) {
      setHomeSettingsError('Vui lòng chọn khối lớp.');
      return;
    }
    try {
      setHomeSettingsError('');
      await classroomApi.updateClassroom(selectedClassId, {
        name: homeSettingsForm.name.trim(),
        description: homeSettingsForm.description.trim(),
        school: homeSettingsForm.school.trim(),
        grade: homeSettingsForm.grade.trim(),
        coverPhotoUrl: homeSettingsForm.coverPhotoUrl,
        themeColor: homeSettingsForm.themeColor,
      });
      setCoverLibraryOpen(false);
      setHomeSettingsOpen(false);
    } catch (error) {
      setHomeSettingsError(error?.message || 'Không thể lưu tùy chỉnh lớp.');
    }
  };

  const syncAnnouncementFormats = () => {
    if (typeof document === 'undefined') return;
    setAnnouncementFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      list: document.queryCommandState('insertUnorderedList'),
    });
  };

  const applyAnnouncementFormat = (command) => {
    if (typeof document === 'undefined') return;
    document.execCommand(command, false);
    syncAnnouncementFormats();
  };

  const applyAnnouncementListFormat = () => {
    if (typeof document === 'undefined') return;
    const editor = announcementEditorRef.current;
    if (!editor) return;
    editor.focus();

    const isListActive = document.queryCommandState('insertUnorderedList');
    if (isListActive) {
      document.execCommand('insertUnorderedList', false);
      capitalizeListNextRef.current = false;
      syncAnnouncementFormats();
      return;
    }

    const selection = window.getSelection();
    if (selection?.rangeCount) {
      let node = selection.anchorNode;
      if (node?.nodeType === Node.TEXT_NODE) node = node.parentNode;
      let block = node;
      while (block && block !== editor && !['DIV', 'P', 'LI'].includes(block.nodeName)) {
        block = block.parentNode;
      }
      if (block && block !== editor) {
        const range = document.createRange();
        range.selectNodeContents(block);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    document.execCommand('insertUnorderedList', false);
    capitalizeListNextRef.current = true;
    syncAnnouncementFormats();
  };

  const openDeleteNotification = (notification) => {
    if (!notification?.id) return;
    setNotificationDeleteError('');
    setNotificationToDelete(notification);
  };

  const closeDeleteNotification = () => {
    if (deletingNotification) return;
    setNotificationToDelete(null);
    setNotificationDeleteError('');
  };

  const handleDeleteNotification = async () => {
    if (
      !selectedClassId ||
      !notificationToDelete?.id ||
      !getCurrentSqlUserId(currentUser)
    ) return;

    const canDelete =
      canTeachClass ||
      sameUserId(
        notificationToDelete.authorId,
        getCurrentSqlUserId(currentUser),
      );

    if (!canDelete) {
      setNotificationDeleteError('B\u1ea1n kh\u00f4ng c\u00f3 quy\u1ec1n x\u00f3a th\u00f4ng b\u00e1o n\u00e0y.');
      return;
    }

    try {
      setDeletingNotification(true);
      setNotificationDeleteError('');

      const fileAttachments = (notificationToDelete.attachments || []).filter(
        (item) =>
          item?.type === 'file' &&
          (item?.storagePath || item?.url)
      );

      await Promise.all(
        fileAttachments.map(async (item) => {
          const storagePath = getR2StoragePath(item);
          if (!storagePath) return;

          try {
            await classroomApi.deleteAsset(storagePath);
          } catch (error) {
            if (error?.status !== 404 && error?.response?.status !== 404) {
              throw error;
            }
          }
        })
      );

      if (notificationToDelete.sourceKey) {
        const result = await classroomApi.dismissNotification(
          selectedClassId,
          notificationToDelete.id,
        );

        if (result?.notification) {
          setNotifications((current) =>
            current.map((item) =>
              String(item.id) === String(notificationToDelete.id)
                ? result.notification
                : item
            )
          );
        }
      } else {
        await classroomApi.deleteNotification(
          selectedClassId,
          notificationToDelete.id,
        );

        setNotifications((current) =>
          current.filter(
            (item) =>
              String(item.id) !== String(notificationToDelete.id)
          )
        );
      }

      setNotificationToDelete(null);
    } catch (error) {
      console.error('Kh\u00f4ng th\u1ec3 x\u00f3a th\u00f4ng b\u00e1o:', error);
      setNotificationDeleteError(error?.message || 'Kh\u00f4ng th\u1ec3 x\u00f3a th\u00f4ng b\u00e1o. Vui l\u00f2ng th\u1eed l\u1ea1i.');
    } finally {
      setDeletingNotification(false);
    }
  };

  const openAnnouncementLinkDialog = (type) => {
    setAnnouncementLinkDialog({ open: true, type, url: '' });
  };

  const confirmAnnouncementLink = () => {
    const url = announcementLinkDialog.url.trim();
    if (!url) return;
    setAnnouncementLinks((current) => [...current, { type: announcementLinkDialog.type, url }]);
    setAnnouncementLinkDialog({ open: false, type: 'link', url: '' });
  };

  const removeAnnouncementLink = (index) => {
    setAnnouncementLinks((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const publishAnnouncement = async (event) => {
    event.preventDefault();
    if (!selectedClassId || !currentUser?.uid) return;
    if (!announcementBody.trim() && !announcementLinks.length && !announcementFile) {
      setAnnouncementError('Vui lòng nhập nội dung hoặc thêm tệp/liên kết.');
      return;
    }
    try {
      setPublishingAnnouncement(true);
      setAnnouncementError('');
      let fileAttachment = null;
      if (announcementFile) {
        const uploadResult = await classroomApi.uploadNotificationAsset(
          selectedClassId,
          announcementFile,
        );
        const attachmentUrl =
          uploadResult?.url ||
          uploadResult?.publicUrl ||
          uploadResult?.fileUrl ||
          uploadResult?.downloadUrl ||
          '';
        const storagePath =
          uploadResult?.storagePath ||
          uploadResult?.objectKey ||
          uploadResult?.key ||
          uploadResult?.path ||
          '';
        if (!attachmentUrl || !storagePath) {
          throw new Error('R2 không trả về đầy đủ thông tin file thông báo.');
        }
        fileAttachment = {
          type: 'file',
          name: announcementFile.name,
          url: attachmentUrl,
          storagePath,
        };
      }
      const result = await classroomApi.createNotification(
        selectedClassId,
        {
          title: 'Thông báo lớp học',
          message: stripHtmlText(announcementBody || ''),
          contentHtml: announcementBody,
          attachments: [...announcementLinks, ...(fileAttachment ? [fileAttachment] : [])],
          systemGenerated: false,
          notificationKind: 'teacherAnnouncement',
          recipientType: 'class',
          authorName: currentUser.displayName || currentUser.email || 'Giáo viên',
        },
      );

      if (result?.notification) {
        setNotifications((current) => {
          const next = [
            result.notification,
            ...current.filter(
              (item) =>
                String(item.id) !== String(result.notification.id)
            ),
          ];

          return next;
        });
      }
      setAnnouncementOpen(false);
      setAnnouncementBody('');
      setAnnouncementLinks([]);
      setAnnouncementFile(null);
      setAnnouncementFormats({ bold: false, italic: false, underline: false, list: false });
    } catch (error) {
      console.error('Không thể đăng thông báo:', error);
      setAnnouncementError(error?.message || 'Không thể đăng thông báo.');
    } finally {
      setPublishingAnnouncement(false);
    }
  };

  const exportStudentsExcel = () => {
    if (typeof document === 'undefined' || !studentListRows.length) return;
    const rows = studentListRows.map(({student,attendance,average,level}) => {
      const displayLevel=['emergency','urgent','khẩn cấp','khan cap','critical'].includes(level)?'Khẩn cấp':['watch','warning','cần theo dõi','can theo doi','cảnh báo','canh bao'].includes(level)?'Cảnh báo':['normal','bình thường','binh thuong','ok'].includes(level)?'Bình thường':'Chưa phân loại';
      return [getStudentDisplayName(student),student.gender||student.sex||'',`${student.parentName||student.guardianName||''} ${student.parentPhone||student.guardianPhone||student.phone||''}`.trim(),attendance.rate===null?'-':`${attendance.rate}%`,average===null?'-':average.toFixed(1),student.conduct||student.behavior||student.hanhKiem||'-',displayLevel,student.email||''];
    });
    const pages=[];
    for(let offset=0;offset<rows.length;offset+=28){
      const canvas=document.createElement('canvas'); canvas.width=1240; canvas.height=1754; const ctx=canvas.getContext('2d'); if(!ctx)return;
      ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#0f172a';ctx.font='700 38px Arial, sans-serif';ctx.fillText('Danh sách học sinh',60,70);ctx.fillStyle='#64748b';ctx.font='500 20px Arial, sans-serif';ctx.fillText(`Lớp ${selectedClass?.name||''} · ${studentListRows.length} học sinh · Trang ${pages.length+1}`,60,108);
      const headers=['Họ và tên','Giới tính','Phụ huynh / SĐT','Điểm danh','ĐTB','Hạnh kiểm','Trạng thái','Email'];const widths=[210,90,210,110,80,120,130,230];let y=150,x=40;const rowH=48;ctx.fillStyle='#f1f5f9';ctx.fillRect(40,y,widths.reduce((a,b)=>a+b,0),rowH);ctx.fillStyle='#334155';ctx.font='700 13px Arial, sans-serif';headers.forEach((h,i)=>{ctx.fillText(h,x+7,y+29);x+=widths[i]});y+=rowH;ctx.font='500 12px Arial, sans-serif';
      rows.slice(offset,offset+28).forEach((values,index)=>{x=40;ctx.fillStyle=index%2?'#fff':'#f8fafc';ctx.fillRect(40,y,widths.reduce((a,b)=>a+b,0),rowH);ctx.fillStyle='#334155';values.forEach((value,i)=>{let text=String(value||'');while(ctx.measureText(text).width>widths[i]-14&&text.length>4)text=`${text.slice(0,-2)}…`;ctx.fillText(text,x+7,y+29);x+=widths[i]});y+=rowH;});
      const dataUrl=canvas.toDataURL('image/jpeg',.92);const binary=atob(dataUrl.split(',')[1]);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i+=1)bytes[i]=binary.charCodeAt(i);pages.push({width:canvas.width,height:canvas.height,bytes});
    }
    const blob=new Blob([buildJpegPdf(pages)],{type:'application/pdf'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`DanhSachHocSinh_${String(selectedClass?.name||'Lop').replace(/[^a-zA-Z0-9_-]+/g,'_')}.pdf`;document.body.appendChild(anchor);anchor.click();anchor.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  const downloadStudentImportTemplate = () => {
    const headers = ['Email', 'Họ và tên', 'Giới tính', 'Ngày sinh', 'Số điện thoại', 'Phụ huynh', 'SĐT phụ huynh'];
    const sample = ['hocsinh@example.com', 'Nguyễn Văn A', 'Nam', '2009-01-01', '0900000000', 'Nguyễn Văn B', '0911111111'];
    const csv = [headers, sample].map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'MauNhapHocSinh.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const resolveSystemUserByEmail = async (email) => {
    const normalizedEmail = normalizeText(email);
    if (!normalizedEmail) return null;
    const response = await classroomApi.resolveUser({ email: normalizedEmail });
    return response?.user || response || null;
  };

  const importStudentsFromText = async () => {
    if (!selectedClassId || studentImporting) return;
    try {
      setStudentImporting(true);
      setStudentImportError('');
      const rows = parseDelimitedText(studentImportText);
      if (rows.length < 2) throw new Error('Vui lòng dán dữ liệu theo đúng mẫu CSV.');
      const headers = rows[0].map(normalizeExcelHeader);
      const findIndex = (...names) => headers.findIndex((header) => names.includes(header));
      const indexes = {
        email: findIndex('email', 'emailhocsinh'), name: findIndex('hovaten', 'hoten'), gender: findIndex('gioitinh'),
        birthDate: findIndex('ngaysinh'), phone: findIndex('sodienthoai', 'sdthocsinh'), parentName: findIndex('phuhuynh', 'tenphuhuynh'), parentPhone: findIndex('sdtphuhuynh', 'sodienthoaiphuhuynh'),
      };
      if (indexes.email < 0) throw new Error('Dòng đầu tiên phải có cột Email như file mẫu.');
      const existingEmails = new Set(attendanceStudents.map((student) => normalizeText(student.email)));
      const seen = new Set();
      const parsed = rows.slice(1).map((row) => ({
        email: normalizeText(row[indexes.email]),
        name: indexes.name >= 0 ? String(row[indexes.name] || '').trim() : '',
        gender: indexes.gender >= 0 ? String(row[indexes.gender] || '').trim() : '',
        birthDate: indexes.birthDate >= 0 ? String(row[indexes.birthDate] || '').trim() : '',
        phone: indexes.phone >= 0 ? String(row[indexes.phone] || '').trim() : '',
        parentName: indexes.parentName >= 0 ? String(row[indexes.parentName] || '').trim() : '',
        parentPhone: indexes.parentPhone >= 0 ? String(row[indexes.parentPhone] || '').trim() : '',
      })).filter((row) => row.email);
      if (!parsed.length) throw new Error('Không có dòng học sinh hợp lệ.');
      const resolved = [];
      for (const row of parsed) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) throw new Error(`Email ${row.email} không đúng định dạng.`);
        if (existingEmails.has(row.email) || seen.has(row.email)) throw new Error(`Email ${row.email} đã có trong lớp hoặc bị trùng.`);
        const profile = await resolveSystemUserByEmail(row.email);
        if (!profile) throw new Error(`Email ${row.email} không tồn tại trong hệ thống.`);
        if (isTeacherMember(profile)) throw new Error(`Email ${row.email} là tài khoản giáo viên, không thể thêm vào bảng học sinh.`);
        seen.add(row.email);
        resolved.push({ row, profile });
      }
      const nextCodeStart = attendanceStudents.length;
      await Promise.all(resolved.map(({ row, profile }, index) =>
        classroomApi.addMember(selectedClassId, {
          userId: profile.uid || profile.id || '',
          studentCode: getAutoStudentCode(nextCodeStart + index),
          email: row.email,
          name: row.name || profile.displayName || profile.name || profile.fullName || '',
          gender: row.gender || profile.gender || profile.sex || '',
          birthDate: row.birthDate || profile.birthDate || profile.dob || '',
          phone: row.phone || profile.phone || profile.phoneNumber || '',
          parentName: row.parentName,
          parentPhone: row.parentPhone,
          role: profile.role || 'STUDENT',
          photoURL: profile.photoURL || profile.photoUrl || profile.avatarUrl || profile.avatar || '',
          status: 'active',
        })
      ));
      setStudentImportOpen(false);
      setStudentImportText('');
    } catch (error) {
      console.error('Không thể nhập danh sách học sinh:', error);
      setStudentImportError(error?.message || 'Không thể nhập danh sách học sinh.');
    } finally {
      setStudentImporting(false);
    }
  };

  const parseStudentExcelFile = async (file) => {
    const text = (await file.text()).replace(/^\uFEFF/, '');
    let rows = [];
    if (/^\s*<\?xml|<Workbook[\s>]/i.test(text)) {
      const xml = new DOMParser().parseFromString(text, 'application/xml');
      if (xml.querySelector('parsererror')) throw new Error('File Excel không hợp lệ.');
      rows = Array.from(xml.getElementsByTagNameNS('*', 'Row')).map((row) =>
        Array.from(row.getElementsByTagNameNS('*', 'Cell')).map((cell) =>
          cell.getElementsByTagNameNS('*', 'Data')[0]?.textContent?.trim() || ''
        )
      );
    } else {
      rows = parseDelimitedText(text);
    }
    if (rows.length < 2) throw new Error('File không có dữ liệu học sinh.');
    const headers = rows[0].map(normalizeExcelHeader);
    const findIndex = (...names) => headers.findIndex((header) => names.includes(header));
    const indexes = {
      code: findIndex('mahocsinh', 'mahs'),
      name: findIndex('hovaten', 'hoten', 'tenhocsinh', 'hocsinh'),
      email: findIndex('email', 'emailhocsinh'),
      gender: findIndex('gioitinh', 'gender'),
      birthDate: findIndex('ngaysinh', 'dateofbirth', 'dob'),
      phone: findIndex('sodienthoai', 'sdthocsinh', 'phone'),
      parentName: findIndex('phuhuynh', 'tenphuhuynh', 'guardian'),
      parentPhone: findIndex('sdtphuhuynh', 'sodienthoaiphuhuynh', 'guardianphone'),
    };
    if (indexes.email < 0) throw new Error('File cần có cột Email.');
    return rows.slice(1).map((row) => ({
      studentCode: indexes.code >= 0 ? row[indexes.code]?.trim() : '',
      name: indexes.name >= 0 ? row[indexes.name]?.trim() : '',
      email: row[indexes.email]?.trim().toLowerCase() || '',
      gender: indexes.gender >= 0 ? row[indexes.gender]?.trim() : '',
      birthDate: indexes.birthDate >= 0 ? row[indexes.birthDate]?.trim() : '',
      phone: indexes.phone >= 0 ? row[indexes.phone]?.trim() : '',
      parentName: indexes.parentName >= 0 ? row[indexes.parentName]?.trim() : '',
      parentPhone: indexes.parentPhone >= 0 ? row[indexes.parentPhone]?.trim() : '',
    })).filter((row) => row.email);
  };

  const handleStudentExcelImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedClassId || studentImporting) return;
    if (/\.xlsx$/i.test(file.name)) {
      setStudentImportError('Hiện tại hệ thống đọc trực tiếp file .csv hoặc .xls. Vui lòng lưu file .xlsx thành .csv hoặc .xls rồi tải lên lại.');
      return;
    }
    try {
      setStudentImporting(true);
      setStudentImportError('');
      const importedRows = await parseStudentExcelFile(file);
      if (!importedRows.length) throw new Error('Không tìm thấy học sinh hợp lệ trong file.');

      const existingEmails = new Set(attendanceStudents.map((student) => normalizeText(student.email)));
      const seenEmails = new Set();
      const resolved = [];
      for (const row of importedRows) {
        const email = normalizeText(row.email);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Email ${row.email || '(trống)'} không đúng định dạng.`);
        if (existingEmails.has(email)) throw new Error(`Email ${email} đã có trong lớp.`);
        if (seenEmails.has(email)) throw new Error(`Email ${email} bị trùng trong file.`);

        const profile = await resolveSystemUserByEmail(email);
        if (!profile) throw new Error(`Email ${email} không tồn tại trong hệ thống.`);
        if (isTeacherMember(profile)) throw new Error(`Email ${email} là tài khoản giáo viên, không thể thêm vào bảng học sinh.`);
        seenEmails.add(email);
        resolved.push({ row: { ...row, email }, profile });
      }

      if (!resolved.length) throw new Error('Không có học sinh đủ điều kiện để thêm vào lớp.');
      const nextCodeStart = attendanceStudents.length;
      await Promise.all(resolved.map(({ row, profile }, index) =>
        classroomApi.addMember(selectedClassId, {
          userId: profile.uid || profile.id || '',
          studentCode: row.studentCode || getAutoStudentCode(nextCodeStart + index),
          email: row.email,
          name: row.name || profile.displayName || profile.name || profile.fullName || '',
          gender: row.gender || profile.gender || profile.sex || '',
          birthDate: row.birthDate || profile.birthDate || profile.dob || '',
          phone: row.phone || profile.phone || profile.phoneNumber || '',
          parentName: row.parentName || '',
          parentPhone: row.parentPhone || '',
          role: profile.role || 'STUDENT',
          photoURL: profile.photoURL || profile.photoUrl || profile.avatarUrl || profile.avatar || '',
          status: 'active',
        })
      ));
      setStudentImportOpen(false);
    } catch (error) {
      console.error('Không thể nhập danh sách học sinh:', error);
      setStudentImportError(error?.message || 'Không thể nhập file học sinh.');
    } finally {
      setStudentImporting(false);
    }
  };

  const resetStudentForm = () => {
    setStudentRows([emptyStudentRow()]);
    setStudentError('');
  };

  const openAddStudents = () => {
    resetStudentForm();
    setStudentOpen(true);
  };

  const closeAddStudents = () => {
    if (addingStudents) return;
    setStudentOpen(false);
    resetStudentForm();
  };

  const handleStudentCellChange = (index, field, value) => {
    setStudentRows((currentRows) =>
      currentRows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      )
    );
  };

  const addStudentRow = () => {
    setStudentRows((currentRows) => [...currentRows, emptyStudentRow()]);
  };

  const removeStudentRow = (index) => {
    setStudentRows((currentRows) =>
      currentRows.length === 1
        ? currentRows
        : currentRows.filter((_, rowIndex) => rowIndex !== index)
    );
  };

  const handleAddStudents = async (event) => {
    event.preventDefault();

    if (!selectedClassId) {
      setStudentError('Vui lòng chọn lớp trước khi thêm học sinh.');
      return;
    }

    const validRows = studentRows
      .map((row) => ({
        email: row.email.trim().toLowerCase(),
      }))
      .filter((row) => row.email);

    if (!validRows.length) {
      setStudentError('Vui lòng nhập ít nhất 1 email học sinh.');
      return;
    }

    const invalidEmail = validRows.some(
      (row) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)
    );
    if (invalidEmail) {
      setStudentError('Email học sinh chưa đúng định dạng.');
      return;
    }

    const duplicatedEmail = validRows.some(
      (row, index) =>
        validRows.findIndex((item) => item.email === row.email) !== index
    );
    if (duplicatedEmail) {
      setStudentError('Có email bị trùng trong danh sách vừa nhập.');
      return;
    }

    const existingEmails = new Set(
      students.map((student) => normalizeText(student.email))
    );
    const alreadyInClass = validRows.find((row) =>
      existingEmails.has(row.email)
    );
    if (alreadyInClass) {
      setStudentError(`Email ${alreadyInClass.email} đã có trong lớp.`);
      return;
    }

    try {
      setAddingStudents(true);
      setStudentError('');

      const resolvedUsers = [];
      for (const row of validRows) {
        const profile = await resolveSystemUserByEmail(row.email);
        if (!profile) throw new Error(`Email ${row.email} không tồn tại trong hệ thống.`);
        if (isTeacherMember(profile)) throw new Error(`Email ${row.email} là tài khoản giáo viên, không thể thêm vào danh sách học sinh.`);
        resolvedUsers.push({ row, profile });
      }

      const nextCodeStart = sortStudentsByJoinTime(attendanceStudents).length;

      await Promise.all(
        resolvedUsers.map(({ row, profile }, index) =>
          classroomApi.addMember(selectedClassId, {
            userId: profile.uid || profile.id || '',
            studentCode: getAutoStudentCode(nextCodeStart + index),
            email: row.email,
            name: profile.displayName || profile.name || profile.fullName || '',
            role: profile.role || 'STUDENT',
            gender: profile.gender || profile.sex || '',
            photoURL: profile.photoURL || profile.photoUrl || profile.avatarUrl || profile.avatar || '',
            status: 'active',
          })
        )
      );


      setStudentOpen(false);
      resetStudentForm();
    } catch (error) {
      console.error('Không thể thêm học sinh:', error);
      setStudentError(
        error?.message || 'Không thể thêm học sinh. Vui lòng thử lại.'
      );
    } finally {
      setAddingStudents(false);
    }
  };

  const openEditStudent = (student) => {
    setStudentToEdit(student);
    setStudentEditForm({
      name:
        getStudentDisplayName(student) === 'Chờ học sinh tham gia'
          ? ''
          : getStudentDisplayName(student),
      email: student.email || '',
      phone: student.phone || '',
    });
    setStudentEditError('');
    setStudentEditOpen(true);
  };

  const closeEditStudent = () => {
    if (editingStudent) return;
    setStudentEditOpen(false);
    setStudentToEdit(null);
    setStudentEditError('');
  };

  const handleStudentEditChange = (event) => {
    const { name, value } = event.target;
    setStudentEditForm((current) => ({ ...current, [name]: value }));
  };

  const handleUpdateStudent = async (event) => {
    event.preventDefault();

    if (!selectedClassId || !studentToEdit?.id) {
      setStudentEditError('Không tìm thấy học sinh cần chỉnh sửa.');
      return;
    }

    const email = studentEditForm.email.trim().toLowerCase();
    if (!email) {
      setStudentEditError('Email học sinh không được để trống.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStudentEditError('Email học sinh chưa đúng định dạng.');
      return;
    }

    const duplicatedStudent = students.find(
      (student) =>
        student.id !== studentToEdit.id &&
        normalizeText(student.email) === email
    );
    if (duplicatedStudent) {
      setStudentEditError(`Email ${email} đã có trong lớp.`);
      return;
    }

    try {
      setEditingStudent(true);
      setStudentEditError('');

      await classroomApi.updateMember(selectedClassId, studentToEdit.id, {
          name: studentEditForm.name.trim(),
          email,
          phone: studentEditForm.phone.trim(),
      });

      setStudentEditOpen(false);
      setStudentToEdit(null);
    } catch (error) {
      console.error('Không thể cập nhật học sinh:', error);
      setStudentEditError(
        error?.message || 'Không thể cập nhật học sinh. Vui lòng thử lại.'
      );
    } finally {
      setEditingStudent(false);
    }
  };

  const openDeleteStudent = (student) => {
    setStudentToDelete(student);
    setStudentDeleteError('');
    setStudentDeleteOpen(true);
  };

  const closeDeleteStudent = () => {
    if (deletingStudent) return;
    setStudentDeleteOpen(false);
    setStudentToDelete(null);
    setStudentDeleteError('');
  };

  const handleDeleteStudent = async () => {
    if (!canManageClassMembers) {
      setStudentDeleteError('Bạn không có quyền xóa thành viên khỏi lớp.');
      return;
    }
    if (!selectedClassId || !studentToDelete?.id) {
      setStudentDeleteError('Không tìm thấy học sinh cần xóa.');
      return;
    }

    try {
      setDeletingStudent(true);
      setStudentDeleteError('');

      await classroomApi.deleteMember(selectedClassId, studentToDelete.id);

      setStudentDeleteOpen(false);
      setStudentToDelete(null);
    } catch (error) {
      console.error('Không thể xóa học sinh:', error);
      setStudentDeleteError(
        error?.message || 'Không thể xóa học sinh. Vui lòng thử lại.'
      );
    } finally {
      setDeletingStudent(false);
    }
  };

  const openClassSettings = (classItem) => {
    const targetClass =
      typeof classItem === 'string'
        ? classes.find((item) => item.id === classItem)
        : classItem;

    if (!targetClass?.id) return;

    setSettingsClassId(targetClass.id);
    setSettingsForm({
      name: targetClass.name || '',
      logoUrl: targetClass.logoUrl || targetClass.logo || '',
      coverPhotoUrl:
        targetClass.coverPhotoUrl ||
        targetClass.coverUrl ||
        targetClass.coverPhoto ||
        '',
    });
    setSettingsError('');
    setMenuClassId('');
    setSettingsOpen(true);
  };

  const closeClassSettings = () => {
    if (savingSettings) return;
    setSettingsOpen(false);
    setSettingsClassId('');
    setSettingsError('');
  };

  const handleSettingsChange = (event) => {
    const { name, value } = event.target;
    setSettingsForm((current) => ({ ...current, [name]: value }));
  };

  const handleSettingsImageChange = (event, fieldName) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSettingsError('Vui lòng chọn đúng file ảnh.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_CLASS_IMAGE_SIZE) {
      setSettingsError(
        'Ảnh quá lớn. Vui lòng chọn ảnh dưới 900KB.'
      );
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSettingsError('');
      setSettingsForm((current) => ({
        ...current,
        [fieldName]: String(reader.result || ''),
      }));
    };
    reader.onerror = () => {
      setSettingsError('Không thể đọc ảnh từ thiết bị. Vui lòng thử ảnh khác.');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async (event) => {
    event.preventDefault();

    if (!settingsClassId) {
      setSettingsError('Không tìm thấy lớp cần cập nhật.');
      return;
    }

    const nextName = settingsForm.name.trim();
    if (!nextName) {
      setSettingsError('Tên lớp không được để trống.');
      return;
    }

    try {
      setSavingSettings(true);
      setSettingsError('');

      await classroomApi.updateClassroom(settingsClassId, {
        name: nextName,
        logoUrl: settingsForm.logoUrl,
        coverPhotoUrl: settingsForm.coverPhotoUrl,
      });

      setSettingsOpen(false);
      setSettingsClassId('');
    } catch (error) {
      console.error('Không thể cập nhật lớp:', error);
      setSettingsError(
        error?.message || 'Không thể cập nhật lớp. Vui lòng thử lại.'
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const openDeleteClass = (classId = selectedClassId) => {
    setDeleteClassId(classId);
    setMenuClassId('');
    setSettingsOpen(false);
    setDeleteError('');
    setDeleteConfirmStep(1);
    setDeleteConfirmSeconds(10);
    setDeleteOpen(true);
  };

  const closeDeleteClass = () => {
    if (deletingClass) return;
    setDeleteOpen(false);
    setDeleteClassId('');
    setDeleteError('');
    setDeleteConfirmStep(1);
    setDeleteConfirmSeconds(10);
  };

  const handleDeleteClass = async () => {
    if (!canDeleteClass) { setDeleteError('Chỉ giáo viên chủ lớp hoặc admin mới có thể xóa lớp.'); return; }
    const targetClassId = deleteClassId || selectedClassId;

    if (!targetClassId) {
      setDeleteError('Không tìm thấy lớp cần xóa.');
      return;
    }

    try {
      setDeletingClass(true);
      setDeleteError('');

      if (selectedClassId === targetClassId) {
        setSelectedClassId('');
      }
      await classroomApi.deleteClassroom(targetClassId);

      setDeleteOpen(false);
      setDeleteClassId('');
    } catch (error) {
      console.error('Không thể xóa lớp học:', error);
      setDeleteError(
        error?.message || 'Không thể xóa lớp học. Vui lòng thử lại.'
      );
    } finally {
      setDeletingClass(false);
    }
  };

  const createClassModal = createOpen ? (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={closeCreateClass}
    >
      <form
        className="class-modal"
        onSubmit={handleCreateClass}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p>Tạo lớp mới</p>
            <h2>Thêm lớp học cho giáo viên</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={closeCreateClass}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <label>
          Tên lớp <span>*</span>
          <input
            name="name"
            value={classForm.name}
            onChange={handleClassFormChange}
            placeholder="Ví dụ: 10A1"
            autoFocus
          />
        </label>

        <label>
          Khối <span>*</span>
          <select
            name="grade"
            value={classForm.grade}
            onChange={handleClassFormChange}
          >
            <option value="">Chọn khối</option>
            <option value="10">Khối 10</option>
            <option value="11">Khối 11</option>
            <option value="12">Khối 12</option>
          </select>
        </label>

        <p className="modal-note">
          Môn học: <strong>{teacherSubject}</strong>. Năm học:{' '}
          <strong>{schoolYear}</strong>.
        </p>
        {createError ? <p className="form-error">{createError}</p> : null}

        <div className="modal-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={closeCreateClass}
            disabled={creating}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="primary-btn modal-submit"
            disabled={creating}
          >
            {creating ? 'ĐANG TẠO...' : 'TẠO LỚP'}
          </button>
        </div>
      </form>
    </div>
  ) : null;

  const joinClassModal = joinOpen ? (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => !joining && setJoinOpen(false)}>
      <form className="class-modal join-class-modal" onSubmit={handleJoinClass} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head"><div><p>Tham gia lớp học</p><h2>Nhập mã lớp</h2></div><button type="button" className="icon-btn" onClick={() => setJoinOpen(false)}>×</button></div>
        <p className="modal-note">Mã lớp gồm 8 ký tự do giáo viên của lớp cung cấp.</p>
        <label>Mã lớp<input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} maxLength={8} placeholder="VD: A7K3M9Q2" autoFocus /></label>
        {joinError ? <p className="form-error">{joinError}</p> : null}
        <div className="modal-actions"><button type="button" className="ghost-btn" onClick={() => setJoinOpen(false)} disabled={joining}>Hủy</button><button type="submit" className="primary-btn modal-submit" disabled={joining}>{joining ? 'ĐANG THAM GIA...' : 'THAM GIA'}</button></div>
      </form>
    </div>
  ) : null;

  const activeCoverCategory = CLASS_COVER_CATEGORIES.find((item) => item.category === coverLibraryCategory) || CLASS_COVER_CATEGORIES[0];
  const activeCoverPresets = CLASS_COVER_PRESETS.filter((cover) => cover.category === activeCoverCategory.category);

  const coverLibraryModal = coverLibraryOpen && typeof document !== 'undefined' ? createPortal(
    <div className="cover-library-modal" role="dialog" aria-modal="true" aria-label="Thư viện hình ảnh tiêu đề" onMouseDown={(event) => event.stopPropagation()}>
      <div className="cover-library-shell">
        <header className="cover-library-header">
          <div className="cover-library-heading">
            <button type="button" className="cover-library-close" onClick={() => setCoverLibraryOpen(false)} aria-label="Đóng thư viện ảnh">×</button>
            <div>
              <span>Thư viện ảnh tiêu đề</span>
              <h2>Chọn hình ảnh cho lớp học</h2>
            </div>
          </div>
          <button type="button" className="cover-library-done" onClick={() => setCoverLibraryOpen(false)}>Xong</button>
        </header>

        <nav className="cover-library-sort" aria-label="Lọc ảnh theo chủ đề">
          {CLASS_COVER_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              className={activeCoverCategory.category === category.category ? 'active' : ''}
              onClick={() => setCoverLibraryCategory(category.category)}
            >
              <span>{category.icon}</span>
              <b>{category.category}</b>
            </button>
          ))}
        </nav>

        <main className="cover-library-content">
          <div className="cover-library-section-head">
            <div>
              <span>{activeCoverCategory.icon}</span>
              <div>
                <h3>{activeCoverCategory.category}</h3>
                <p>{activeCoverCategory.description}</p>
              </div>
            </div>
            <b>{activeCoverPresets.length} ảnh</b>
          </div>

          <div className="cover-library-grid">
            {activeCoverPresets.map((cover, index) => {
              const selected = homeSettingsForm.coverPhotoUrl === cover.value;
              return (
                <button
                  key={cover.id}
                  type="button"
                  className={selected ? 'active' : ''}
                  onClick={() => setHomeSettingsForm((current) => ({ ...current, coverPhotoUrl: cover.value }))}
                  aria-label={`Chọn ${cover.label}`}
                >
                  <span className="cover-library-image" style={{ backgroundImage: cover.value }} />
                  <span className="cover-library-image-shade" />
                  <span className="cover-library-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="cover-library-label">{cover.label}</span>
                  {selected ? <i className="cover-library-check">✓</i> : null}
                </button>
              );
            })}
          </div>
        </main>
      </div>
    </div>,
    document.body,
  ) : null;

  const homeSettingsModal = homeSettingsOpen ? (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => setHomeSettingsOpen(false)}>
      <div className="class-modal home-settings-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head"><div><p>Tùy chỉnh lớp</p><h2>Thông tin & giao diện trang chủ</h2></div><button type="button" className="icon-btn" onClick={() => setHomeSettingsOpen(false)}>×</button></div>
        <div className="home-settings-scroll">
          <div className="current-cover-preview" style={{ backgroundImage: homeSettingsForm.coverPhotoUrl?.includes('gradient(') || homeSettingsForm.coverPhotoUrl?.includes('url(') ? homeSettingsForm.coverPhotoUrl : `url(${homeSettingsForm.coverPhotoUrl})` }}>
            <div className="current-cover-caption"><strong>{homeSettingsForm.name || 'Tên lớp'}</strong><span>{homeSettingsForm.school || 'Chưa có trường'} · {homeSettingsForm.grade ? `Khối ${homeSettingsForm.grade}` : 'Chưa chọn khối'}</span></div>
          </div>
          <div className="home-settings-fields">
            <label>Tên lớp <span>*</span><input value={homeSettingsForm.name} onChange={(event) => setHomeSettingsForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ví dụ: 10A2" /></label>
            <label>Khối <span>*</span><select value={homeSettingsForm.grade} onChange={(event) => setHomeSettingsForm((current) => ({ ...current, grade: event.target.value }))}><option value="">Chọn khối</option><option value="10">Khối 10</option><option value="11">Khối 11</option><option value="12">Khối 12</option></select></label>
            <label className="home-settings-field-wide">Trường<input value={homeSettingsForm.school} onChange={(event) => setHomeSettingsForm((current) => ({ ...current, school: event.target.value }))} placeholder="Tên trường của lớp" /></label>
            <label className="home-settings-field-wide">Mô tả<textarea rows="3" value={homeSettingsForm.description} onChange={(event) => setHomeSettingsForm((current) => ({ ...current, description: event.target.value }))} placeholder="Mô tả ngắn về lớp học" /></label>
          </div>
          <section className="preset-section cover-topic-section">
            <div className="preset-section-head">
              <strong>Chọn hình ảnh tiêu đề</strong>
              <span>Chọn chủ đề để mở thư viện ảnh</span>
            </div>
            <div className="cover-topic-grid">
              {CLASS_COVER_CATEGORIES.map((category) => {
                const previewCover = CLASS_COVER_PRESETS.find((cover) => cover.category === category.category);
                const isSelectedCategory = CLASS_COVER_PRESETS.some(
                  (cover) => cover.category === category.category && cover.value === homeSettingsForm.coverPhotoUrl,
                );
                return (
                  <button
                    key={category.id}
                    type="button"
                    className={isSelectedCategory ? 'active' : ''}
                    onClick={() => {
                      setCoverLibraryCategory(category.category);
                      setCoverLibraryOpen(true);
                    }}
                    aria-label={`Mở ảnh chủ đề ${category.category}`}
                  >
                    <span className="cover-topic-image" style={{ backgroundImage: previewCover?.value || 'none' }} />
                    <span className="cover-topic-overlay" />
                    <span className="cover-topic-copy">
                      <b>{category.icon}</b>
                      <strong>{category.category}</strong>
                      <small>10 ảnh</small>
                    </span>
                    {isSelectedCategory ? <i className="cover-topic-selected">✓</i> : null}
                  </button>
                );
              })}
            </div>
          </section>
          <section className="preset-section"><div className="preset-section-head"><strong>Màu giao diện</strong><span>Màu này dùng cho viền thẻ lớp</span></div><div className="theme-color-grid">{CLASS_THEME_COLORS.map((color) => <button key={color.id} type="button" title={color.label} aria-label={color.label} className={homeSettingsForm.themeColor === color.value ? 'active' : ''} style={{ backgroundColor: color.value }} onClick={() => setHomeSettingsForm((current) => ({ ...current, themeColor: color.value }))} />)}</div></section>
        </div>
        {homeSettingsError ? <p className="form-error">{homeSettingsError}</p> : null}
        <div className="modal-actions sticky-modal-actions"><button type="button" className="ghost-btn" onClick={() => setHomeSettingsOpen(false)}>Hủy</button><button type="button" className="primary-btn modal-submit" onClick={saveHomeSettings}>Lưu tùy chỉnh</button></div>
      </div>
      {coverLibraryModal}
    </div>
  ) : null;

  const announcementModal = announcementOpen ? (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => !publishingAnnouncement && setAnnouncementOpen(false)}>
      <form className="class-modal announcement-modal" onSubmit={publishAnnouncement} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head"><div><p>Thông báo mới</p><h2>Đăng thông báo cho lớp</h2></div><button type="button" className="icon-btn" onClick={() => setAnnouncementOpen(false)}>×</button></div>
        <div className="rich-toolbar" onMouseDown={(event) => event.preventDefault()}>
          <button type="button" className={announcementFormats.bold ? 'active' : ''} onClick={() => applyAnnouncementFormat('bold')} title="In đậm"><b>B</b></button>
          <button type="button" className={announcementFormats.italic ? 'active' : ''} onClick={() => applyAnnouncementFormat('italic')} title="In nghiêng"><i>I</i></button>
          <button type="button" className={announcementFormats.underline ? 'active' : ''} onClick={() => applyAnnouncementFormat('underline')} title="Gạch dưới"><u>U</u></button>
          <button type="button" className={announcementFormats.list ? 'active' : ''} onClick={applyAnnouncementListFormat} title="Danh sách có dấu đầu dòng">•</button>
        </div>
        <div
          ref={announcementEditorRef}
          className="announcement-editor"
          contentEditable
          suppressContentEditableWarning
          onInput={(event) => setAnnouncementBody(event.currentTarget.innerHTML)}
          onBeforeInput={(event) => {
            if (!capitalizeListNextRef.current || event.nativeEvent?.inputType !== 'insertText') return;
            const text = event.nativeEvent?.data || '';
            if (!text) return;
            event.preventDefault();
            document.execCommand('insertText', false, text.charAt(0).toLocaleUpperCase('vi-VN') + text.slice(1));
            capitalizeListNextRef.current = false;
          }}
          onKeyUp={syncAnnouncementFormats}
          onMouseUp={syncAnnouncementFormats}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && typeof document !== 'undefined' && document.queryCommandState('insertUnorderedList')) {
              setTimeout(() => {
                if (document.queryCommandState('insertUnorderedList')) document.execCommand('insertUnorderedList', false);
                capitalizeListNextRef.current = false;
                syncAnnouncementFormats();
              }, 0);
            }
          }}
          data-placeholder="Nhập nội dung thông báo..."
        />
        <div className="announcement-attachments">
          <button type="button" className="round-attach-btn" data-tooltip="Google Drive" aria-label="Google Drive" onClick={() => openAnnouncementLinkDialog('drive')}>◇</button>
          <button type="button" className="round-attach-btn" data-tooltip="YouTube" aria-label="YouTube" onClick={() => openAnnouncementLinkDialog('youtube')}>▶</button>
          <button type="button" className="round-attach-btn" data-tooltip="Thêm liên kết" aria-label="Thêm liên kết" onClick={() => openAnnouncementLinkDialog('link')}>↗</button>
          <label className="round-attach-btn file-attach-btn" data-tooltip="Tải tệp lên" aria-label="Tải tệp lên">↑<input type="file" onChange={(event) => setAnnouncementFile(event.target.files?.[0] || null)} /></label>
        </div>
        {announcementLinks.length || announcementFile ? <div className="attachment-summary">{announcementLinks.map((item, index) => <span className="attachment-chip link-chip" key={`${item.type}-${index}`}><a href={item.url} target="_blank" rel="noreferrer">{item.type === 'drive' ? 'Drive' : item.type === 'youtube' ? 'YouTube' : 'Liên kết'}: {item.url}</a><button type="button" onClick={() => removeAnnouncementLink(index)} aria-label="Xóa liên kết">×</button></span>)}{announcementFile ? <span className="attachment-chip"><b>📎 {announcementFile.name}</b><button type="button" onClick={() => setAnnouncementFile(null)} aria-label="Xóa tệp">×</button></span> : null}</div> : null}
        {announcementError ? <p className="form-error">{announcementError}</p> : null}
        <div className="modal-actions"><button type="button" className="ghost-btn" onClick={() => setAnnouncementOpen(false)} disabled={publishingAnnouncement}>Hủy</button><button type="submit" className="primary-btn modal-submit" disabled={publishingAnnouncement}>{publishingAnnouncement ? 'ĐANG ĐĂNG...' : 'ĐĂNG THÔNG BÁO'}</button></div>
      </form>
    </div>
  ) : null;

  const announcementLinkModal = announcementLinkDialog.open ? (
    <div className="modal-backdrop nested-modal-backdrop" role="presentation" onMouseDown={() => setAnnouncementLinkDialog({ open: false, type: 'link', url: '' })}>
      <div className="class-modal link-entry-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head"><div><p>Đính kèm</p><h2>{announcementLinkDialog.type === 'drive' ? 'Google Drive' : announcementLinkDialog.type === 'youtube' ? 'YouTube' : 'Đường liên kết'}</h2></div><button type="button" className="icon-btn" onClick={() => setAnnouncementLinkDialog({ open: false, type: 'link', url: '' })}>×</button></div>
        {announcementLinkDialog.type === 'drive' ? <div className="drive-helper"><p>Mở Drive của bạn, chọn tệp/thư mục và dán liên kết chia sẻ vào bên dưới.</p><button type="button" className="ghost-btn" onClick={() => window.open('https://drive.google.com/drive/my-drive', '_blank', 'noopener,noreferrer')}>Mở Google Drive ↗</button></div> : null}
        <label>Liên kết<input value={announcementLinkDialog.url} onChange={(event) => setAnnouncementLinkDialog((current) => ({ ...current, url: event.target.value }))} placeholder={announcementLinkDialog.type === 'youtube' ? 'https://youtube.com/...' : 'https://...'} autoFocus /></label>
        <div className="modal-actions"><button type="button" className="ghost-btn" onClick={() => setAnnouncementLinkDialog({ open: false, type: 'link', url: '' })}>Hủy</button><button type="button" className="primary-btn modal-submit" onClick={confirmAnnouncementLink} disabled={!announcementLinkDialog.url.trim()}>Thêm liên kết</button></div>
      </div>
    </div>
  ) : null;

  const notificationDeleteModal = notificationToDelete ? (
    <div className="modal-backdrop nested-modal-backdrop" role="presentation" onMouseDown={closeDeleteNotification}>
      <div className="class-modal delete-modal notification-delete-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div><p>Xóa thông báo</p><h2>Xác nhận xóa vĩnh viễn</h2></div>
          <button type="button" className="icon-btn" onClick={closeDeleteNotification} aria-label="Đóng">×</button>
        </div>
        <p className="delete-warning">Thông báo này sẽ bị xóa vĩnh viễn.</p>
        {notificationDeleteError ? <p className="form-error">{notificationDeleteError}</p> : null}
        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={closeDeleteNotification} disabled={deletingNotification}>Hủy</button>
          <button type="button" className="danger-btn" onClick={handleDeleteNotification} disabled={deletingNotification}>{deletingNotification ? '\u0110ANG X\u00d3A...' : 'X\u00d3A V\u0128NH VI\u1ec4N'}</button>
        </div>
      </div>
    </div>
  ) : null;

  const notificationDeleteAllModal = notificationDeleteAllOpen ? (
    <div className="modal-backdrop nested-modal-backdrop" role="presentation" onMouseDown={() => !deletingAllNotifications && setNotificationDeleteAllOpen(false)}>
      <div className="class-modal delete-modal notification-delete-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head"><div><p>Xóa tất cả thông báo</p><h2>Xác nhận xóa vĩnh viễn</h2></div><button type="button" className="icon-btn" onClick={() => setNotificationDeleteAllOpen(false)} disabled={deletingAllNotifications}>×</button></div>
        <p className="delete-warning">Toàn bộ {teacherNotifications.length} thông báo đang hiển thị cho tài khoản này sẽ bị xóa vĩnh viễn. Thao tác này không thể hoàn tác.</p>
        <div className="modal-actions"><button type="button" className="ghost-btn" onClick={() => setNotificationDeleteAllOpen(false)} disabled={deletingAllNotifications}>Hủy</button><button type="button" className="danger-btn" onClick={deleteAllNotifications} disabled={deletingAllNotifications}>{deletingAllNotifications ? 'ĐANG XÓA...' : 'XÓA TẤT CẢ'}</button></div>
      </div>
    </div>
  ) : null;

  const studentImportModal = studentImportOpen ? (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => !studentImporting && setStudentImportOpen(false)}>
      <div className="class-modal student-import-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head"><div><p>Nhập danh sách</p><h2>Thêm học sinh từ file</h2></div><button type="button" className="icon-btn" onClick={() => setStudentImportOpen(false)} disabled={studentImporting}>×</button></div>
        <div className="student-import-options">
          <section className="student-import-option">
            <span className="student-import-option-icon">⇩</span>
            <div><strong>Tải file mẫu</strong><p>Tải mẫu CSV có sẵn đúng tên cột và cú pháp để điền danh sách học sinh.</p></div>
            <button type="button" className="student-template-btn" onClick={downloadStudentImportTemplate}>Tải file mẫu</button>
          </section>
          <section className="student-import-option student-upload-option">
            <span className="student-import-option-icon">⇧</span>
            <div><strong>Tải file của bạn lên</strong><p>Hệ thống sẽ kiểm tra cú pháp, email tồn tại trong hệ thống, email trùng và vai trò trước khi thêm.</p></div>
            <label className={`student-file-upload ${studentImporting ? 'disabled' : ''}`}>
              <input ref={studentExcelInputRef} type="file" accept=".csv,.xls,text/csv,application/vnd.ms-excel" onChange={handleStudentExcelImport} disabled={studentImporting} />
              <span>{studentImporting ? 'Đang kiểm tra file...' : 'Chọn file CSV / XLS'}</span>
            </label>
          </section>
        </div>
        <p className="modal-note">Chỉ tài khoản học sinh có email tồn tại trong hệ thống hiện tại mới được thêm vào lớp.</p>
        {studentImportError ? <p className="form-error">{studentImportError}</p> : null}
        <div className="modal-actions"><button type="button" className="ghost-btn" onClick={() => setStudentImportOpen(false)} disabled={studentImporting}>Đóng</button></div>
      </div>
    </div>
  ) : null;

  const addStudentModal = studentOpen ? (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={closeAddStudents}
    >
      <form
        className="class-modal student-modal"
        onSubmit={handleAddStudents}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p>Thêm học sinh</p>
            <h2>{selectedClass?.name || 'Lớp học'}</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={closeAddStudents}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <div className="student-add-table">
          <div className="student-add-head email-only-head">
            <span>Email học sinh *</span>
            <span />
          </div>

          {studentRows.map((row, index) => (
            <div className="student-add-row email-only-row" key={index}>
              <input
                type="email"
                value={row.email}
                onChange={(event) =>
                  handleStudentCellChange(index, 'email', event.target.value)
                }
                placeholder="hoc sinh@email.com"
                autoFocus={index === 0}
              />
              <button
                type="button"
                className="row-remove-btn"
                onClick={() => removeStudentRow(index)}
                disabled={studentRows.length === 1}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <p className="modal-note">
          Mã HS sẽ tự tạo dạng <strong>HS001, HS002...</strong> theo thứ tự học
          sinh tham gia trước/sau.
        </p>
        <button
          type="button"
          className="ghost-btn add-row-btn"
          onClick={addStudentRow}
        >
          ＋ Thêm email
        </button>
        {studentError ? <p className="form-error">{studentError}</p> : null}

        <div className="modal-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={closeAddStudents}
            disabled={addingStudents}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="primary-btn modal-submit"
            disabled={addingStudents}
          >
            {addingStudents ? 'ĐANG LƯU...' : 'LƯU HỌC SINH'}
          </button>
        </div>
      </form>
    </div>
  ) : null;

  const editStudentModal = studentEditOpen ? (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={closeEditStudent}
    >
      <form
        className="class-modal"
        onSubmit={handleUpdateStudent}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p>Chỉnh sửa học sinh</p>
            <h2>
              {getStudentCode(
                studentToEdit,
                sortStudentsByJoinTime(students).findIndex(
                  (student) => student.id === studentToEdit?.id
                )
              )}
            </h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={closeEditStudent}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <label>
          Họ và tên
          <input
            name="name"
            value={studentEditForm.name}
            onChange={handleStudentEditChange}
            placeholder="Nguyễn Văn A"
            autoFocus
          />
        </label>

        <label>
          Email <span>*</span>
          <input
            type="email"
            name="email"
            value={studentEditForm.email}
            onChange={handleStudentEditChange}
            placeholder="hocsinh@email.com"
          />
        </label>

        <label>
          Số điện thoại
          <input
            name="phone"
            value={studentEditForm.phone}
            onChange={handleStudentEditChange}
            placeholder="09..."
          />
        </label>

        <p className="modal-note">
          Mã HS giữ nguyên theo thứ tự tham gia. Trạng thái được đồng bộ từ
          hệ thống và tự đổi khi học sinh hoàn tất dữ liệu.
        </p>
        {studentEditError ? (
          <p className="form-error">{studentEditError}</p>
        ) : null}

        <div className="modal-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={closeEditStudent}
            disabled={editingStudent}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="primary-btn modal-submit"
            disabled={editingStudent}
          >
            {editingStudent ? 'ĐANG LƯU...' : 'LƯU THAY ĐỔI'}
          </button>
        </div>
      </form>
    </div>
  ) : null;

  const deleteStudentModal = studentDeleteOpen ? (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={closeDeleteStudent}
    >
      <div
        className="class-modal delete-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p>Xóa học sinh</p>
            <h2>{getStudentDisplayName(studentToDelete || {})}</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={closeDeleteStudent}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <p className="delete-warning">
          Thao tác này sẽ xóa học sinh khỏi lớp và xóa điểm số liên quan của học
          sinh này.
        </p>
        <p className="modal-note">
          Mã HS của các học sinh khác sẽ không tự đổi sau khi xóa.
        </p>
        {studentDeleteError ? (
          <p className="form-error">{studentDeleteError}</p>
        ) : null}

        <div className="modal-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={closeDeleteStudent}
            disabled={deletingStudent}
          >
            Hủy
          </button>
          <button
            type="button"
            className="danger-btn"
            onClick={handleDeleteStudent}
            disabled={deletingStudent}
          >
            {deletingStudent ? 'ĐANG XÓA...' : 'XÓA HỌC SINH'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const deleteClassModal = deleteOpen ? (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={closeDeleteClass}
    >
      <div
        className="class-modal delete-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p>Xóa lớp học</p>
            <h2>{classToDelete?.name || 'Lớp học'}</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={closeDeleteClass}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <p className="delete-warning">
          Thao tác này sẽ xóa lớp đang chọn cùng danh sách học sinh, môn học,
          bài kiểm tra và điểm số liên quan trên hệ thống.
        </p>
        <p className="modal-note">{deleteConfirmStep === 1 ? 'Xác nhận lớp 1/2. Sau khi tiếp tục, bạn phải chờ 10 giây trước xác nhận cuối.' : 'Xác nhận lớp 2/2. Hành động này không thể hoàn tác.'}</p>
        {deleteError ? <p className="form-error">{deleteError}</p> : null}

        <div className="modal-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={closeDeleteClass}
            disabled={deletingClass}
          >
            Hủy
          </button>
          <button type="button" className="danger-btn" onClick={() => { if (deleteConfirmStep === 1) { setDeleteConfirmStep(2); setDeleteConfirmSeconds(10); } else handleDeleteClass(); }} disabled={deletingClass || (deleteConfirmStep === 2 && deleteConfirmSeconds > 0)}>{deletingClass ? 'ĐANG XÓA...' : deleteConfirmStep === 1 ? 'TIẾP TỤC XÁC NHẬN' : deleteConfirmSeconds > 0 ? `CHỜ ${deleteConfirmSeconds}s` : 'XÁC NHẬN XÓA VĨNH VIỄN'}</button>
        </div>
      </div>
    </div>
  ) : null;

  const deleteTeacherModal = teacherDeleteOpen ? (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={closeDeleteTeacher}
    >
      <div
        className="class-modal delete-modal teacher-delete-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p>Xóa giáo viên khỏi lớp</p>
            <h2>{getStudentDisplayName(teacherToDelete || {})}</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={closeDeleteTeacher}
            aria-label="Đóng"
            disabled={deletingTeacher}
          >
            ×
          </button>
        </div>

        <p className="delete-warning">
          Giáo viên này sẽ bị xóa khỏi danh sách thành viên của lớp và không còn thấy lớp qua memberIds.
        </p>
        <p className="modal-note">
          Dữ liệu lịch sử như điểm danh đã lưu trước đó được giữ nguyên. Giáo viên chủ lớp không thể bị xóa tại đây.
        </p>
        {teacherDeleteError ? <p className="form-error">{teacherDeleteError}</p> : null}

        <div className="modal-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={closeDeleteTeacher}
            disabled={deletingTeacher}
          >
            Hủy
          </button>
          <button
            type="button"
            className="danger-btn"
            onClick={handleDeleteTeacher}
            disabled={deletingTeacher}
          >
            {deletingTeacher ? 'ĐANG XÓA...' : 'XÓA KHỎI LỚP'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const classSettingsModal = settingsOpen ? (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={closeClassSettings}
    >
      <form
        className="class-modal settings-modal"
        onSubmit={handleSaveSettings}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <p>Chỉnh sửa lớp</p>
            <h2>{classToSettings?.name || 'Lớp học'}</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={closeClassSettings}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <section className="settings-section">
          <div className="settings-index">1</div>
          <label>
            Tên lớp
            <input
              name="name"
              value={settingsForm.name}
              onChange={handleSettingsChange}
              placeholder="Nhập tên lớp mới"
              autoFocus
            />
          </label>
        </section>

        <section className="settings-section">
          <div className="settings-index">2</div>
          <div className="settings-fields">
            <label>
              Ảnh đại diện lớp
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  handleSettingsImageChange(event, 'logoUrl')
                }
              />
            </label>
            <label>
              Ảnh bìa lớp
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  handleSettingsImageChange(event, 'coverPhotoUrl')
                }
              />
            </label>
            <div className="settings-preview">
              <div
                className="preview-cover"
                style={{
                  backgroundImage: settingsForm.coverPhotoUrl
                    ? `url(${settingsForm.coverPhotoUrl})`
                    : 'linear-gradient(135deg,#dbeafe,#f8fafc)',
                }}
              >
                <div className="preview-logo">
                  {settingsForm.logoUrl ? (
                    <img src={settingsForm.logoUrl} alt="Ảnh đại diện lớp" />
                  ) : (
                    getInitial(settingsForm.name)
                  )}
                </div>
              </div>
              <p>
                Chọn ảnh trực tiếp từ thiết bị. Ảnh sẽ được xem trước trước khi
                lưu.
              </p>
            </div>
          </div>
        </section>

        {settingsError ? <p className="form-error">{settingsError}</p> : null}

        <div className="modal-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={closeClassSettings}
            disabled={savingSettings}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="primary-btn modal-submit"
            disabled={savingSettings}
          >
            {savingSettings ? 'ĐANG LƯU...' : 'LƯU THAY ĐỔI'}
          </button>
        </div>
      </form>
    </div>
  ) : null;

  if (loading) {
    return (
      <main className="classes-page class-hub-page">
        <section className="hub-top class-list-tools"><div className="class-search-box"><span>⌕</span><input placeholder="Tìm kiếm lớp học..." disabled /></div><button className="class-add-menu-btn" type="button" disabled>＋</button></section>
        <section className="class-hub">
          <div className="class-card-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="class-tile skeleton-tile">
                <div className="skeleton-cover" />
                <div className="class-tile-body">
                  <div className="skeleton-line skeleton-title" />
                  <div className="skeleton-line skeleton-sub" />
                </div>
              </div>
            ))}
          </div>
        </section>
        {createClassModal}
        <style>{styles}</style>
      </main>
    );
  }

  if (!classes.length) {
    return (
      <main className="classes-page class-hub-page">
        <section className="hub-top class-list-tools">
          <div className="class-search-box"><span>⌕</span><input value={classSearch} onChange={(event) => setClassSearch(event.target.value)} placeholder="Tìm kiếm lớp học..." /></div>
          <div className="class-create-menu-wrap"><button className="class-add-menu-btn" type="button" onClick={() => setCreateMenuOpen((open) => !open)} aria-label="Tạo hoặc tham gia lớp">＋</button>{createMenuOpen ? <div className="class-create-dropdown"><button type="button" onClick={() => { setCreateMenuOpen(false); openCreateClass(); }}>＋ Tạo lớp học</button><button type="button" onClick={() => { setCreateMenuOpen(false); setJoinError(''); setJoinOpen(true); }}>↪ Tham gia lớp học</button></div> : null}</div>
        </section>
        <section className="hub-due-panel"><div className="hub-due-head"><div><span>Sắp đến hạn</span><strong>Bài tập từ các lớp bạn đang tham gia</strong></div><b>{upcomingAssignments.length}</b></div>{upcomingAssignments.length ? <div className="hub-due-list">{upcomingAssignments.slice(0, 5).map((item) => <button key={`${item.classId}-${item.id}`} type="button" onClick={() => openClassDetail(item.classId)}><span><strong>{item.title || item.name || 'Bài tập'}</strong><small>{item.className}</small></span><time>{formatDateTime(item.startAt || item.createdAt)} → {formatDateTime(item.dueAt || item.endAt || item.deadline)}</time></button>)}</div> : <p className="hub-due-empty">Chưa có bài tập sắp đến hạn.</p>}</section>

        <section className="class-hub">
          <section className="hub-empty-state compact-empty-state">
            <div className="empty-icon">🎓</div>
            <h1>Bạn chưa có lớp</h1>
            <p>
              Nhấn dấu <strong>＋</strong> ở góc phải để tạo hoặc tham gia lớp học.
            </p>
          </section>
        </section>

        {createClassModal}
        {studentImportModal}
      {addStudentModal}
        {deleteClassModal}
        {editStudentModal}
        {deleteStudentModal}
        {classSettingsModal}
        {joinClassModal}
        {homeSettingsModal}
        {announcementModal}
        {announcementLinkModal}
        {notificationDeleteModal}
      {notificationDeleteAllModal}
        <style>{styles}</style>
      </main>
    );
  }

  if (classView === 'list' || !selectedClassId) {
    return (
      <main className="classes-page class-hub-page">
        <section className="hub-top class-list-tools">
          <div className="class-search-box"><span>⌕</span><input value={classSearch} onChange={(event) => setClassSearch(event.target.value)} placeholder="Tìm kiếm lớp học..." /></div>
          <div className="class-create-menu-wrap"><button className="class-add-menu-btn" type="button" onClick={() => setCreateMenuOpen((open) => !open)} aria-label="Tạo hoặc tham gia lớp">＋</button>{createMenuOpen ? <div className="class-create-dropdown"><button type="button" onClick={() => { setCreateMenuOpen(false); openCreateClass(); }}>＋ Tạo lớp học</button><button type="button" onClick={() => { setCreateMenuOpen(false); setJoinError(''); setJoinOpen(true); }}>↪ Tham gia lớp học</button></div> : null}</div>
        </section>
        <section className="hub-due-panel"><div className="hub-due-head"><div><span>Sắp đến hạn</span><strong>Bài tập từ các lớp bạn đang tham gia</strong></div><b>{upcomingAssignments.length}</b></div>{upcomingAssignments.length ? <div className="hub-due-list">{upcomingAssignments.slice(0, 5).map((item) => <button key={`${item.classId}-${item.id}`} type="button" onClick={() => openClassDetail(item.classId)}><span><strong>{item.title || item.name || 'Bài tập'}</strong><small>{item.className}</small></span><time>{formatDateTime(item.startAt || item.createdAt)} → {formatDateTime(item.dueAt || item.endAt || item.deadline)}</time></button>)}</div> : <p className="hub-due-empty">Chưa có bài tập sắp đến hạn.</p>}</section>

        <section className="class-hub">
          <div className="class-card-grid">
            {!loading && !visibleClasses.length ? <section className="hub-empty-state compact-empty-state"><h1>Bạn chưa tham gia một lớp học nào</h1><p>Tạo lớp mới hoặc tham gia lớp bằng mã lớp để bắt đầu.</p></section> : null}
            {visibleClasses.map((classItem, index) => (
              <article
                className="class-tile"
                key={classItem.id}
                style={{ '--class-accent': classItem.themeColor || '#2563eb' }}
                role="button"
                tabIndex={0}
                onClick={() => openClassDetail(classItem.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') openClassDetail(classItem.id);
                }}
              >
                <div
                  className="class-cover"
                  style={{
                    backgroundImage: getClassCoverStyle(classItem, index),
                  }}
                >
                  <div className="class-icon">
                    {classItem.logoUrl || classItem.logo ? (
                      <img
                        src={classItem.logoUrl || classItem.logo}
                        alt="Ảnh đại diện lớp"
                      />
                    ) : (
                      getInitial(classItem.name)
                    )}
                  </div>
                </div>
                <div className="class-tile-body">
                  <h3>{classItem.name}</h3>
                  <p className="class-tile-meta">
                    <span>{classItem.teacherName || classItem.subject || 'Megaedu'}</span>
                    {classItem.grade ? (
                      <span className="class-tile-grade">Khối {classItem.grade}</span>
                    ) : null}
                  </p>
                  <p className="class-tile-school">⌂ {classItem.school || classItem.schoolName || (classItem.teacherId === currentUser?.uid ? teacherSchool : '') || 'Chưa có dữ liệu trường'}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {createClassModal}
        {addStudentModal}
        {deleteClassModal}
        {editStudentModal}
        {deleteStudentModal}
        {classSettingsModal}
        {joinClassModal}
        {homeSettingsModal}
        {announcementModal}
        {announcementLinkModal}
        {notificationDeleteModal}
      {notificationDeleteAllModal}
        <style>{styles}</style>
      </main>
    );
  }

  const activeWorkspaceItem =
    CLASS_WORKSPACE_ITEMS.find((item) => item.id === activeTab) ||
    CLASS_WORKSPACE_ITEMS[0];

  return (
    <main className="classes-page class-workspace-page">
      <div className={`workspace-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
        <aside className={`workspace-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${workspaceMobileMenuOpen ? 'mobile-open' : ''}`} aria-label="Quản lý lớp học">
          <div className="workspace-brand workspace-collapse-row"><button type="button" className="sidebar-collapse-btn" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'} title={sidebarCollapsed ? 'Mở rộng' : 'Thu gọn'}><span>{sidebarCollapsed ? '›' : '‹'}</span>{!sidebarCollapsed ? <b>Thu gọn</b> : null}</button></div>
          <div className="sidebar-class-chip" style={{ '--class-accent': selectedClass?.themeColor || '#2563eb' }}><i />{!sidebarCollapsed ? <div><span>Lớp đang mở</span><strong>{selectedClass?.name || 'Lớp học'} — {overviewData.studentCount} học sinh</strong></div> : null}</div>
          <nav className="workspace-nav">
            <button type="button" className={activeTab === 'home' ? 'active' : ''} onClick={() => { setActiveTab('home'); setWorkspaceMobileMenuOpen(false); }}><span className="workspace-nav-icon">⌂</span>{!sidebarCollapsed ? <span>Trang chủ</span> : null}</button>
            {CLASS_WORKSPACE_SECTIONS.map((section) => <div className="workspace-nav-section" key={section.id}><button type="button" className="workspace-section-toggle" onClick={() => { if (typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches) return; setSectionOpen((current) => ({ ...current, [section.id]: !current[section.id] })); }}><span>{sidebarCollapsed ? '⋯' : section.label}</span>{!sidebarCollapsed ? <b>{sectionOpen[section.id] ? '⌃' : '⌄'}</b> : null}</button>{sectionOpen[section.id] ? <div className="workspace-section-items">{section.items.map((item) => <button key={item.id} type="button" className={activeTab === item.id ? 'active' : ''} onClick={() => { setActiveTab(item.id); setWorkspaceMobileMenuOpen(false); }} title={sidebarCollapsed ? item.label : undefined}><span className="workspace-nav-icon">{item.icon}</span>{!sidebarCollapsed ? <span>{item.label}</span> : null}</button>)}</div> : null}</div>)}
          </nav>
          <div className="workspace-user-card"><div className={`workspace-user-avatar ${currentTeacherAvatar ? 'has-image' : ''}`}>{currentTeacherAvatar ? <img src={currentTeacherAvatar} alt="" referrerPolicy="no-referrer" /> : getInitial(currentUser?.displayName || userDetails?.displayName || currentUser?.email || 'Giáo viên')}</div>{!sidebarCollapsed ? <div><strong>{currentUser?.displayName || userDetails?.displayName || currentUser?.email || 'Giáo viên'}</strong><span>{isInternTeacher ? 'Giáo viên thực tập' : 'Giáo viên'}</span></div> : null}</div>
        </aside>
        {workspaceMobileMenuOpen ? <button type="button" className="workspace-mobile-menu-backdrop" onClick={() => setWorkspaceMobileMenuOpen(false)} aria-label="Đóng menu lớp học" /> : null}

        <section className={`workspace-main ${activeTab === 'attendance' ? 'attendance-workspace-main' : ''}`}>
          <div className="workspace-content-head">
            <div className="workspace-content-title">
              <button type="button" className="workspace-mobile-menu-btn" onClick={() => { setSidebarCollapsed(false); setSectionOpen({ main: true, secondary: true }); setWorkspaceMobileMenuOpen(true); }} aria-label="Mở menu lớp học">☰</button>
              <button
                className="workspace-back-btn"
                type="button"
                onClick={goBackToClassList}
                aria-label="Quay lại danh sách lớp"
              >
                ←
              </button>
              <div>
                <p className="workspace-breadcrumb">
                  {selectedClass?.name || 'Lớp học'} / {activeWorkspaceItem.label}
                </p>
                <h2>{activeWorkspaceItem.label}</h2>
              </div>
            </div>
            <span className="workspace-status">Đang hoạt động</span>
          </div>

          {activeTab === 'home' ? (
            <div className="class-home" style={{ '--class-accent': selectedClass?.themeColor || '#2563eb' }}>
              <section className="class-home-hero" style={{ backgroundImage: getClassCoverStyle(selectedClass || {}, 0) }}><div className="class-home-overlay"><div><span>Lớp học</span><h3>{selectedClass?.name || 'Lớp học'}</h3><p>{selectedClass?.school || selectedClass?.schoolName || 'Chưa có trường'} · {selectedClass?.grade ? `Khối ${selectedClass.grade}` : 'Chưa có khối'}</p>{selectedClass?.description ? <small>{selectedClass.description}</small> : null}</div><div className="class-home-actions">{canTeachClass ? <button type="button" onClick={openHomeSettings}>⚙ Tùy chỉnh</button> : null}{canDeleteClass ? <button type="button" className="danger-home-action" onClick={() => openDeleteClass(selectedClassId)}>🗑 Xóa lớp</button> : null}{isInternTeacher ? <button type="button" className="leave-home-action" onClick={leaveClassAsIntern}>↪ Rời khỏi lớp</button> : null}</div></div></section>
              <section className="home-dashboard-grid">
                <div className="home-left-stack">
                  <article className="home-info-card class-code-card"><div className="class-code-head"><span>Mã lớp</span>{selectedClass?.classCode ? <button type="button" className={classCodeCopied ? 'class-code-copy copied' : 'class-code-copy'} onClick={copyClassCode} aria-label="Sao chép mã lớp" title={classCodeCopied ? 'Đã sao chép' : 'Sao chép mã lớp'}><span>{classCodeCopied ? '✓' : '⧉'}</span></button> : null}</div><strong>{selectedClass?.classCode || 'Chưa có mã lớp'}</strong><p>{classCodeCopied ? 'Đã sao chép mã lớp vào clipboard.' : 'Mã gồm 8 ký tự dùng để tham gia lớp.'}</p></article>
                  <article className="home-info-card due-card"><div className="home-card-head"><div><span>Sắp đến hạn đóng</span><strong>{selectedUpcomingAssignments.length} bài học</strong></div></div>{selectedUpcomingAssignments.length ? <div className="home-simple-list">{selectedUpcomingAssignments.slice(0, 4).map((item) => <div key={item.id}><strong>{getAssignmentTitle(item)}</strong><span>{formatDateTime(item.startAt || item.createdAt)} → {formatDateTime(item.dueAt || item.endAt || item.deadline || item.closeAt)}</span></div>)}</div> : <p>Chưa có bài học sắp tới hạn đóng.</p>}</article>
                </div>
                <section className="home-notification-panel"><div className="home-panel-head"><div><span>Thông báo mới</span></div>{canTeachClass ? <button type="button" onClick={() => setAnnouncementOpen(true)}>＋ Tạo thông báo mới</button> : null}</div>{teacherCreatedAnnouncements.length ? <div className="notification-feed">{teacherCreatedAnnouncements.slice(0, 6).map((item) => <article key={item.id}><div className="notification-item-head"><small>{item.authorName || 'Giáo viên'} · {formatDateTime(item.createdAt)}</small>{(sameUserId(selectedClass?.teacherId, getCurrentSqlUserId(currentUser)) || sameUserId(item.authorId, getCurrentSqlUserId(currentUser))) ? <button type="button" className="notification-delete-btn" onClick={() => openDeleteNotification(item)} title="Xóa thông báo" aria-label="Xóa thông báo">×</button> : null}</div><div className="notification-content" dangerouslySetInnerHTML={{ __html: item.contentHtml || item.content || '' }} />{item.attachments?.length ? <div className="notification-links">{item.attachments.map((attachment, index) => <a key={index} href={attachment.url} target="_blank" rel="noreferrer">{attachment.name || attachment.type || 'Tệp đính kèm'}</a>)}</div> : null}</article>)}</div> : <p className="home-panel-empty">Chưa có thông báo.</p>}</section>
              </section>
            </div>
          ) : activeTab === 'overview' ? (
            <div className="figma-dashboard overview-dashboard">
              <section className="figma-welcome">
                <div>
                  <h3>Tổng quan lớp {selectedClass?.name || 'đang chọn'}</h3>
                </div>
                <button type="button" onClick={() => { setAttendanceDate(getLocalDateKey(now)); setAttendanceMode('manual'); setActiveTab('attendance'); }}>✓ {todayAttendanceSaved ? 'Điểm danh' : 'Điểm danh hôm nay'}</button>
              </section>

              <section className="figma-stat-grid overview-stat-grid">
                <OverviewStat icon="👥" tone="blue" value={joinedClassMemberCount} title="Sĩ số hiện tại" subtitle={`${joinedClassMemberCount} thành viên đã vào lớp`} />
                <OverviewStat icon="📝" tone="amber" value={publishedAssignmentCount} title="Số bài đã đăng" subtitle={publishedAssignmentCount ? `${publishedAssignmentCount} bài tập đã đăng` : 'Chưa có bài tập đã đăng'} />
                <OverviewStat icon="⭐" tone="purple" value={overviewData.classAverage || '—'} title="Điểm trung bình" subtitle={overviewData.classAverage ? 'Điểm trung bình toàn lớp' : 'Chưa có dữ liệu điểm'} />
                <OverviewStat icon="🔔" tone="red" value={teacherNotifications.length} title="Thông báo" subtitle={`${teacherNotifications.length} thông báo dành cho tài khoản hiện tại`} />
              </section>

              {internTeacherMembers.length ? <section className="intern-overview-panel"><div className="figma-panel-head"><div><h4>Giáo viên thực tập</h4><p>Điểm danh thực tập được tính riêng, không ảnh hưởng chuyên cần học sinh.</p></div><span>{internTeacherMembers.length} giáo viên</span></div><div className="intern-overview-grid">{internTeacherMembers.map((teacher) => { const metrics = getInternAttendanceMetrics(teacher); return <article key={teacher.id}><span className="mini-avatar">{getInitial(getStudentDisplayName(teacher))}</span><div><strong>{getStudentDisplayName(teacher)}</strong><small>{metrics.total ? `${metrics.present}/${metrics.total} buổi có mặt` : 'Chưa có dữ liệu điểm danh'}</small><i><b style={{ width: `${metrics.rate ?? 0}%` }} /></i></div><b>{metrics.rate === null ? '—' : `${metrics.rate}%`}</b></article>; })}</div></section> : null}

              <section className="overview-chart-grid">
                <article className="overview-chart-card">
                  <div className="figma-panel-head"><div><h4>Phân bố kết quả học tập</h4><p>Giỏi, đạt và chưa đạt theo điểm trung bình</p></div></div>
                  <DonutChart segments={scoreDistribution} centerValue={rankedScoreRows.filter((row) => row.average !== null).length || '—'} centerLabel="học sinh" />
                </article>
                <article className="overview-chart-card overview-chart-wide">
                  <div className="figma-panel-head"><div><h4>Điểm danh {attendanceSummary.monthLabel}</h4><p>{attendanceSummary.monthRate === null ? 'Chưa có dữ liệu trong tháng hiện tại' : `Tỷ lệ có mặt: ${attendanceSummary.monthRate}%`}</p></div></div>
                  <AttendanceMonthChart data={attendanceSummary.monthDays} monthLabel={attendanceSummary.monthLabel} />
                </article>
                <article className="overview-chart-card">
                  <div className="figma-panel-head"><div><h4>Điểm danh tuần này</h4><p>Thứ hai đến chủ nhật · tự đổi khi sang tuần mới</p></div></div>
                  <AttendanceWeekChart data={attendanceSummary.weekDays} />
                </article>
              </section>

              <section className="overview-info-grid">
                <article className="overview-detail-card subject-progress-card">
                  <div className="figma-panel-head"><div><h4>Tiến độ học tập theo môn</h4><p>Tỷ lệ hoàn thành & điểm trung bình</p></div></div>
                  {subjectProgress.length ? <div className="subject-progress-list">{subjectProgress.map((item, index) => {
                    const progressValue = item.completion !== null ? Math.max(0, Math.min(100, item.completion)) : null;
                    return <div className="subject-progress-row" key={item.id}><div><span><i className={`subject-dot subject-dot-${index % 6}`} />{item.name}</span><b>TB: {item.average === null ? '—' : item.average.toFixed(1)} {progressValue === null ? '' : `HT: ${Math.round(progressValue)}%`}</b></div><div className="subject-progress-track"><i style={{ width: `${progressValue ?? 0}%` }} /></div></div>;
                  })}</div> : <DataUnavailable icon="📘" text="Chưa có dữ liệu môn học." />}
                </article>

                <article className="overview-detail-card today-schedule-card">
                  <div className="figma-panel-head"><div><h4>Lịch hôm nay</h4><p>Lịch học của lớp</p></div></div>
                  {todaySchedule.length ? <div className="today-schedule-list">{todaySchedule.slice(0, 6).map((item) => { const activeNow = isTodayScheduleItemActive(item); return <div className={`schedule-row ${activeNow ? 'active-now' : ''}`} key={item.id}><i /><div><small>{formatClock(item.startAt || item.startTime)}{item.endAt || item.endTime ? ` - ${formatClock(item.endAt || item.endTime)}` : ''}{activeNow ? <b className="schedule-live-badge">Đang diễn ra</b> : null}</small><strong>{item.subjectName || item.subject || item.title || 'Tiết học'}</strong><span>{item.lessonContent || item.lessonName || item.lesson || item.topic || item.room || ''}</span></div></div>; })}</div> : <DataUnavailable icon="📅" text="Chưa có lịch học hôm nay." />}
                </article>

                <article className="overview-detail-card top-students-card">
                  <div className="figma-panel-head"><div><h4>Top học sinh</h4><p>Theo điểm trung bình hiện tại</p></div><button type="button" onClick={() => setActiveTab('scores')}>Xem tất cả →</button></div>
                  {topStudents.length ? <div className="top-student-list overview-top-list">{topStudents.map((row, index) => <div className="top-student-row" key={row.id}><span className={`top-rank top-rank-${index + 1}`}>{index + 1}</span><span className="mini-avatar">{getInitial(getStudentDisplayName(row.student))}</span><div><strong>{getStudentDisplayName(row.student)}</strong><small>{row.studentCode}</small></div><b>{formatScore(row.average)}</b></div>)}</div> : <DataUnavailable icon="🏅" text="Chưa có dữ liệu điểm để xếp hạng." />}
                </article>
              </section>

              <section className="overview-bottom-grid">
                <article className="overview-detail-card recent-activity-card">
                  <div className="figma-panel-head"><div><h4>Hoạt động gần đây</h4><p>Tổng hợp từ bài tập, điểm danh và thông báo</p></div><span className="sync-indicator" /></div>
                  {recentActivities.length ? <div className="recent-activity-list">{recentActivities.map((item) => <div className="recent-activity-row" key={item.id}><span>{item.icon}</span><div><strong>{item.text}</strong><small>{item.detail} · {formatDateTime(item.at)}</small></div></div>)}</div> : <DataUnavailable icon="⚡" text="Chưa có hoạt động có thời gian cập nhật." />}
                </article>

                <div className="overview-right-stack">
                  <article className="overview-detail-card assignment-status-card">
                    <div className="figma-panel-head"><div><h4>Tình trạng bài tập</h4><p>từ bài tập của lớp</p></div></div>
                    <div className="assignment-status-grid"><div className="status-open"><b>{assignmentStatus.open}</b><span>Đang mở</span></div><div className="status-grading"><b>{assignmentStatus.needsGrading}</b><span>Cần chấm</span></div><div className="status-draft"><b>{assignmentStatus.draft}</b><span>Nháp</span></div><div className="status-closed"><b>{assignmentStatus.closed}</b><span>Đã đóng</span></div></div>
                    <button type="button" className="assignment-manage-btn" onClick={() => setActiveTab('assignments')}>Quản lý bài tập →</button>
                  </article>
                  <article className="class-health-card">
                    <span>Sức khỏe lớp học</span><strong>{classHealth === null ? '—' : `${classHealth}%`}</strong>
                    <div className="health-metrics">
                      {[
                        ['Điểm danh', classHealthMetrics.attendance],
                        ['Điểm số', classHealthMetrics.scores],
                        ['Bài tập', classHealthMetrics.assignments],
                      ].map(([label, value]) => {
                        const progress = value === null ? 0 : Math.max(0, Math.min(100, value));
                        const segments = [
                          { id: 'danger', from: 0, to: 33 },
                          { id: 'warning', from: 33, to: 65 },
                          { id: 'good', from: 65, to: 80 },
                          { id: 'excellent', from: 80, to: 100 },
                        ];
                        return <div className="health-metric-row" key={label}><div className="health-metric-head"><span>{label}</span><b>{value === null ? '—' : `${Math.round(progress)}%`}</b></div><div className="health-progress" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress)}>{segments.map((segment) => { const fill = Math.max(0, Math.min(100, ((progress - segment.from) / (segment.to - segment.from)) * 100)); return <span key={segment.id} className={`health-progress-segment ${segment.id}`} style={{ flexBasis: `${segment.to - segment.from}%` }}><i style={{ width: `${fill}%` }} /></span>; })}{value !== null ? <em className="health-progress-marker" style={{ left: `${progress}%` }}><span>{Math.round(progress)}</span></em> : null}</div></div>;
                      })}
                    </div>
                  </article>
                </div>
              </section>
            </div>
          ) : activeTab === 'assignments' ? (
            <ClassExamWorkspace selectedClass={selectedClass} />
          ) : activeTab === 'attendance' ? (
            <div className="attendance-page">
              <section className="attendance-page-head">
                <div className="attendance-title-with-back">
                  <button type="button" className="workspace-mobile-menu-btn attendance-mobile-menu-btn" onClick={() => { setSidebarCollapsed(false); setSectionOpen({ main: true, secondary: true }); setWorkspaceMobileMenuOpen(true); }} aria-label="Mở menu lớp học">☰</button>
                  <button type="button" className="workspace-back-btn attendance-back-btn" onClick={goBackToClassList} aria-label="Quay lại danh sách lớp">←</button>
                  <div>
                  <h3>Điểm danh</h3>
                  <p>Lớp {selectedClass?.name || ''}{selectedSubject?.name || selectedClass?.subject || teacherSubject ? ` · ${selectedSubject?.name || selectedClass?.subject || teacherSubject}` : ''}</p>
                  </div>
                </div>
                <div className="attendance-head-actions">
                  <label className="attendance-date-picker"><input type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} /></label>
                  <button type="button" className={attendanceMode === 'manual' ? 'attendance-mode-btn active' : 'attendance-mode-btn'} onClick={() => setAttendanceMode('manual')}><span>✎</span> Thủ công</button>
                  <button type="button" className={attendanceMode === 'qr' ? 'attendance-mode-btn qr active' : 'attendance-mode-btn qr'} onClick={() => setAttendanceMode('qr')}><span>▣</span> QR Check-in</button>
                  <button type="button" className="attendance-secondary-btn" onClick={exportAttendanceFile} disabled={!attendanceStudents.length}><span>⇩</span> Xuất</button>
                  <button type="button" className="attendance-save-btn" onClick={saveAttendance} disabled={attendanceSaving}>{attendanceSaving ? 'Đang lưu...' : 'Lưu điểm danh'}</button>
                </div>
              </section>

              {attendanceMode === 'manual' ? <>
                <section className="attendance-stat-grid">
                  <article className="attendance-stat neutral"><strong>{attendancePageStats.total}</strong><span>Tổng sĩ số</span></article>
                  <article className="attendance-stat present"><strong>{attendancePageStats.present}</strong><span>Có mặt</span></article>
                  <article className="attendance-stat late"><strong>{attendancePageStats.late}</strong><span>Trễ (×0.5)</span></article>
                  <article className="attendance-stat absent"><strong>{attendancePageStats.absent}</strong><span>Vắng không phép</span></article>
                  <article className="attendance-stat excused"><strong>{attendancePageStats.excused}</strong><span>Vắng phép</span></article>
                </section>
                <section className={`attendance-rate-banner ${attendancePageStats.rate < 70 ? 'danger' : attendancePageStats.rate < 85 ? 'warning' : 'good'}`}>
                  <div><span>Tỷ lệ tham dự hôm nay</span><strong>{attendancePageStats.rate.toFixed(1)}%</strong></div>
                  <p>Công thức: (Có mặt + Trễ × 0.5) / Tổng sĩ số</p>
                  <b>{attendancePageStats.absent ? `${attendancePageStats.absent} học sinh vắng` : 'Không có học sinh vắng không phép'}</b>
                </section>
              </> : null}

              {attendanceMode === 'qr' ? (
                <section className="attendance-qr-panel">
                  <div className="attendance-qr-copy"><span className="attendance-qr-badge">QR CHECK-IN</span><h4>Quét để điểm danh</h4><p>Mã tự hết hạn sau 10 phút. Khi hết hạn hệ thống tự tạo mã mới. Học sinh xác nhận trên thiết bị của mình, sau đó sẽ xuất hiện Có mặt trong bản nháp của giáo viên.</p>{attendanceQrError ? <p className="attendance-error">{attendanceQrError}</p> : null}<div className="attendance-qr-expiry">Còn hiệu lực <strong>{Math.max(0, Math.ceil((Number(selectedAttendanceRecord?.qrExpiresAt || 0) - Date.now()) / 60000))} phút</strong></div><button type="button" className="attendance-regenerate-qr" onClick={() => ensureAttendanceQrSession(true)} disabled={attendanceQrCreating}>{attendanceQrCreating ? 'Đang tạo...' : '↻ Đổi mã QR'}</button></div>
                  <div className="attendance-qr-code-card">{attendanceQrUrl ? <img src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(attendanceQrUrl)}`} alt="QR điểm danh" /> : <div className="attendance-qr-loading">Đang tạo QR...</div>}<small>Chỉ thành viên học sinh của lớp mới xác nhận được.</small></div>
                  <div className="attendance-qr-link-row"><input value={attendanceQrUrl} readOnly aria-label="Liên kết điểm danh QR" /><button type="button" className={attendanceQrCopied ? 'copied' : ''} onClick={copyAttendanceQrLink} disabled={!attendanceQrUrl}>{attendanceQrCopied ? '✓ Đã sao chép' : '⧉ Sao chép'}</button></div>
                </section>
              ) : (
                <>
                  <section className="attendance-bulk-actions"><span>Đánh dấu tất cả:</span><button type="button" className="present" onClick={() => markAllAttendance('present')}>✓ Có mặt</button><button type="button" className="late" onClick={() => markAllAttendance('late')}>◉ Trễ</button><button type="button" className="absent" onClick={() => markAllAttendance('absent')}>× Vắng KP</button><button type="button" className="excused" onClick={() => markAllAttendance('excused')}>▤ Vắng phép</button></section>
                  {attendanceSaveError ? <p className="attendance-error">{attendanceSaveError}</p> : null}
                  <section className="attendance-table-wrap">
                    <table className="attendance-table">
                      <thead><tr><th>#</th><th>Học sinh</th><th>Có mặt ✓</th><th>Trễ ◉</th><th>Vắng KP ×</th><th>Vắng phép ▤</th><th>Ghi chú</th></tr></thead>
                      <tbody>
                        {attendanceStudents.length ? attendanceStudents.map((student, index) => {
                          const currentStatus = attendanceDraft[student.id]?.status || '';
                          const monthMetrics = getStudentAttendanceMetrics(student);
                          const avatarUrl = getStudentAvatar(student);
                          return <tr key={student.id} className={currentStatus ? `has-status status-${currentStatus}` : ''}><td>{index + 1}</td><td><div className="attendance-student-cell"><span className={avatarUrl ? 'has-image' : ''}>{avatarUrl ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer" /> : getInitial(getStudentDisplayName(student))}</span><div><strong>{getStudentDisplayName(student)}</strong><small>DA tháng: {monthMetrics.rate === null ? '—' : `${monthMetrics.rate}%`}</small></div></div></td>{[['present','✓'],['late','◉'],['absent','×'],['excused','▤']].map(([status, icon]) => <td key={status}><button type="button" className={`attendance-choice ${status} ${currentStatus === status ? 'active' : ''}`} onClick={() => setAttendanceStudentStatus(student.id, currentStatus === status ? '' : status)} aria-label={`${status} - ${getStudentDisplayName(student)}`}>{currentStatus === status ? icon : '○'}</button></td>)}<td><input className="attendance-note-input" value={attendanceDraft[student.id]?.note || ''} onChange={(event) => setAttendanceStudentNote(student.id, event.target.value)} placeholder="Ghi chú..." /></td></tr>;
                        }) : <tr><td colSpan="7" className="table-empty">Chưa có học sinh trong lớp.</td></tr>}
                      </tbody>
                    </table>
                  </section>
                </>
              )}

              {attendanceMode === 'manual' ? <section className="attendance-history-section">
                <div className="attendance-history-head"><div><span>Lịch sử điểm danh</span><strong>{attendanceHistory.length ? `${attendanceHistoryPage + 1}/${attendanceHistory.length}` : 'Chưa có lịch sử'}</strong></div>{attendanceHistory.length ? <div><button type="button" onClick={() => setAttendanceHistoryPage((page) => Math.max(0, page - 1))} disabled={attendanceHistoryPage === 0}>‹</button><button type="button" onClick={() => setAttendanceHistoryPage((page) => Math.min(attendanceHistory.length - 1, page + 1))} disabled={attendanceHistoryPage >= attendanceHistory.length - 1}>›</button></div> : null}</div>
                {attendanceHistory.length ? (() => { const record = attendanceHistory[attendanceHistoryPage]; const rows = Array.isArray(record.records) ? record.records : []; const savedTime = record.savedAt || record.updatedAt || record.createdAt; const historyTeacher = teacherMembers.find((teacher) => teacher.uid === record.teacherId || teacher.id === record.teacherId); const historyTeacherName = record.teacherName || historyTeacher?.name || (record.teacherId === selectedClass?.teacherId ? selectedClass?.teacherName : '') || record.teacherEmail || 'Giáo viên'; return <div className="attendance-history-card"><div className="attendance-history-meta"><strong>{record.date || record.attendanceDate || attendanceDate}<small>{record.legacyLatest ? 'Bản lưu gần nhất trước khi có lịch sử nhiều lần' : `Lưu lúc ${formatDateTime(savedTime)}`}</small><small className="attendance-history-teacher">Giáo viên: {historyTeacherName}{savedTime ? ` · ${new Date(getTimeValue(savedTime)).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}</small></strong><span>{record.presentCount || 0} có mặt · {record.lateCount || 0} trễ · {record.absentCount || 0} vắng KP · {record.excusedCount || 0} vắng phép</span></div><div className="attendance-history-students">{rows.map((row) => { const student = attendanceStudents.find((item) => item.id === row.studentId); return <span key={row.studentId || row.email}><b>{student ? getStudentDisplayName(student) : row.email || row.studentId}</b><i className={`history-status ${normalizeAttendanceStatus(row.status)}`}>{getAttendanceStatusLabel(row.status)}</i>{row.note ? <small className="attendance-history-note">Ghi chú: {row.note}</small> : null}</span>; })}</div></div>; })() : <div className="attendance-history-empty">Chưa có lần điểm danh nào được giáo viên lưu.</div>}
              </section> : null}
            </div>
          ) : activeTab === 'students' ? (
            <div className="student-directory-page">
              <section className="student-directory-head">
                <div><h3>Danh sách lớp</h3><p>Lớp {selectedClass?.name || ''} · {attendanceStudents.length} học sinh · {teacherMembers.length} giáo viên{attendanceSummary.weekRate !== null ? ` · ${attendanceSummary.weekRate}% chuyên cần tuần này` : ''}</p></div>
                <div className="student-directory-actions"><button type="button" className="student-secondary-btn" onClick={() => { setStudentImportError(''); setStudentImportText(''); setStudentImportOpen(true); }}>⇧ Nhập</button><button type="button" className="student-secondary-btn" onClick={exportStudentsExcel} disabled={!attendanceStudents.length}>⇩ Xuất</button><button type="button" className="student-add-btn" onClick={openAddStudents}>＋ Thêm học sinh</button></div>
              </section>
              {studentImportError ? <p className="student-import-error">{studentImportError}</p> : null}
              <section className="student-summary-grid">
                <article className="student-summary-card total"><strong>{attendanceStudents.length}</strong><span>Tổng sĩ số</span></article>
                <article className="student-summary-card normal"><strong>{studentStatusSummary.normal}</strong><span>Bình thường</span></article>
                <article className="student-summary-card watch"><strong>{studentStatusSummary.watch}</strong><span>Cần theo dõi</span></article>
                <article className="student-summary-card emergency"><strong>{studentStatusSummary.emergency}</strong><span>Khẩn cấp</span></article>
              </section>
              {studentStatusSummary.unclassified ? <p className="student-summary-note">{studentStatusSummary.unclassified} học sinh chưa có dữ liệu phân loại theo dõi trong hệ thống.</p> : null}
              <section className="student-filter-bar"><label><span>⌕</span><input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Tìm theo tên, mã học sinh, phụ huynh..." /></label><div className={`student-sort-control ${studentSortOpen ? 'open' : ''}`}><button type="button" className="student-sort-trigger" aria-haspopup="listbox" aria-expanded={studentSortOpen} onClick={() => setStudentSortOpen((open) => !open)}><span className="student-sort-icon">⇅</span><span><small>Sắp xếp</small><strong>{studentSort === 'rank' ? 'Xếp hạng' : studentSort === 'average' ? 'Điểm trung bình' : 'Theo thứ tự tên'}</strong></span><b className="student-sort-chevron">⌄</b></button>{studentSortOpen ? <div className="student-sort-dropdown" role="listbox" aria-label="Sắp xếp danh sách học sinh">{[['rank','Xếp hạng'],['average','Điểm trung bình'],['name','Theo thứ tự tên']].map(([value,label]) => <button type="button" role="option" aria-selected={studentSort === value} className={studentSort === value ? 'active' : ''} key={value} onClick={() => { setStudentSort(value); setStudentSortOpen(false); }}><span>{value === 'rank' ? '★' : value === 'average' ? '9.0' : 'A–Z'}</span><strong>{label}</strong>{studentSort === value ? <b>✓</b> : null}</button>)}</div> : null}</div><span>{studentListRows.length} / {attendanceStudents.length} học sinh</span></section>
              <section className="student-directory-table-wrap">
                <table className="student-directory-table"><thead><tr><th className="student-check-col"><input type="checkbox" aria-label="Chọn tất cả học sinh" checked={studentListRows.length > 0 && studentListRows.every(({ student }) => selectedStudentIds.includes(student.id))} onChange={(event) => { const visibleIds = studentListRows.map(({ student }) => student.id); setSelectedStudentIds((current) => event.target.checked ? Array.from(new Set([...current, ...visibleIds])) : current.filter((id) => !visibleIds.includes(id))); }} /></th><th>Học sinh</th><th>Giới tính</th><th>Phụ huynh / SĐT</th><th>Điểm danh</th><th>ĐTB</th><th>Hạnh kiểm</th><th>Trạng thái</th><th className="student-actions-col" aria-label="Thao tác" /></tr></thead><tbody>
                  {studentListRows.length ? studentListRows.map(({ student, index, attendance, average, level, rank }) => {
                    const conduct = student.conduct || student.behavior || student.hanhKiem || 'Chưa có dữ liệu';
                    const parentName = student.parentName || student.guardianName || student.emergencyContactName || 'Chưa có dữ liệu';
                    const parentPhone = student.parentPhone || student.guardianPhone || student.emergencyPhone || student.phone || '';
                    const displayLevel = ['emergency','urgent','khẩn cấp','khan cap','critical'].includes(level) ? 'Khẩn cấp' : ['watch','warning','cần theo dõi','can theo doi','cảnh báo','canh bao'].includes(level) ? 'Cảnh báo' : ['normal','bình thường','binh thuong','ok'].includes(level) ? 'Bình thường' : 'Chưa phân loại';
                    const isSelected = selectedStudentIds.includes(student.id);
                    const avatarUrl = getStudentAvatar(student);
                    return <tr key={student.id} className={isSelected ? 'selected' : ''}><td className="student-check-col"><input type="checkbox" aria-label={`Chọn ${getStudentDisplayName(student)}`} checked={isSelected} onChange={(event) => setSelectedStudentIds((current) => event.target.checked ? Array.from(new Set([...current, student.id])) : current.filter((id) => id !== student.id))} /></td><td><div className="student-name-cell"><span className={`student-list-avatar ${avatarUrl ? 'has-image' : ''}`}>{avatarUrl ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer" /> : getInitial(getStudentDisplayName(student))}</span><div><strong>{getStudentDisplayName(student)}</strong><small>{rank ? `Hạng #${rank} · ` : ''}{student.birthDate || student.dob || getStudentCode(student, index)}</small></div></div></td><td><span className="student-gender">{student.gender || student.sex || '—'}</span></td><td><strong className="student-parent-name">{parentName}</strong>{parentPhone ? <small className="student-parent-phone">{parentPhone}</small> : null}</td><td>{attendance.rate === null ? <span className="student-no-data">—</span> : <div className={`student-attendance-rate ${attendance.rate < 75 ? 'danger' : attendance.rate < 90 ? 'warn' : ''}`}><i><b style={{ width: `${attendance.rate}%` }} /></i><strong>{attendance.rate}%</strong></div>}</td><td><strong className={`student-average ${average !== null && average < 6 ? 'danger' : average !== null && average < 8 ? 'warn' : ''}`}>{average === null ? '—' : average.toFixed(1)}</strong></td><td><span className="student-conduct">{conduct}</span></td><td><span className={`student-status-pill ${displayLevel === 'Khẩn cấp' ? 'emergency' : displayLevel === 'Cảnh báo' ? 'watch' : displayLevel === 'Bình thường' ? 'normal' : 'unknown'}`}><i />{displayLevel}</span></td><td className="student-row-actions" onClick={(event) => event.stopPropagation()}><button type="button" className="student-view-profile-btn" onClick={(event) => { event.stopPropagation(); setStudentRowMenuId(''); openStudentProfile(student); }}>Xem hồ sơ</button><div className="student-row-menu-wrap"><button type="button" className="student-row-menu-btn" aria-label={`Mở thao tác cho ${getStudentDisplayName(student)}`} aria-expanded={studentRowMenuId === student.id} onClick={(event) => { event.stopPropagation(); setTeacherRowMenuId(''); setStudentRowMenuId((current) => current === student.id ? '' : student.id); }}>•••</button>{studentRowMenuId === student.id ? <div className="student-row-menu" onClick={(event) => event.stopPropagation()}><button type="button" className="danger" onClick={() => { setStudentRowMenuId(''); openDeleteStudent(student); }}>Xóa học sinh</button></div> : null}</div></td></tr>;
                  }) : <tr><td colSpan="9" className="table-empty">Chưa có học sinh phù hợp.</td></tr>}
                </tbody></table>
                <div className="student-table-footer"><span>Hiển thị {studentListRows.length} / {attendanceStudents.length} học sinh</span>{selectedStudentIds.length ? <b>Đã chọn {selectedStudentIds.length}</b> : null}</div>
              </section>
              <section className="teacher-directory-section">
                <div className="teacher-directory-head"><div><h4>Giáo viên</h4><p>Thành viên có vai trò giáo viên trong lớp</p></div><span>{teacherMembers.length} giáo viên</span></div>
                <div className="teacher-directory-table-wrap">
                  <table className="teacher-directory-table"><thead><tr><th>Giáo viên</th><th>Giới tính</th><th>Vai trò</th>{internTeacherMembers.length ? <th>Điểm danh thực tập</th> : null}<th /></tr></thead><tbody>
                    {teacherMembers.length ? teacherMembers.map((teacher) => { const avatar = getStudentAvatar(teacher); const metrics = teacher.classRole === 'intern_teacher' ? getInternAttendanceMetrics(teacher) : null; const todayIntern = (Array.isArray(selectedAttendanceRecord?.internRecords) ? selectedAttendanceRecord.internRecords : []).find((item) => item.teacherId === teacher.id || item.uid === teacher.uid || normalizeText(item.email) === normalizeText(teacher.email)); return <tr key={teacher.id}><td><div className="teacher-name-cell"><span className={avatar ? 'has-image' : ''}>{avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : getInitial(getStudentDisplayName(teacher))}</span><strong>{getStudentDisplayName(teacher)}</strong></div></td><td>{teacher.gender || teacher.sex || '—'}</td><td><span className="teacher-role-pill">{teacher.owner ? 'Giáo viên chủ lớp' : teacher.classRole === 'intern_teacher' ? 'Giáo viên thực tập' : 'Giáo viên'}</span></td>{internTeacherMembers.length ? <td>{teacher.classRole === 'intern_teacher' ? <div className="intern-attendance-cell"><div className="student-attendance-rate"><i><b style={{ width: `${metrics?.rate ?? 0}%` }} /></i><strong>{metrics?.rate === null ? '—' : `${metrics.rate}%`}</strong></div>{isClassOwner ? <div className="intern-attendance-actions"><button type="button" className={normalizeAttendanceStatus(todayIntern?.status) === 'present' ? 'active' : ''} onClick={() => saveInternAttendanceStatus(teacher, 'present')}>Có mặt</button><button type="button" className={normalizeAttendanceStatus(todayIntern?.status) === 'excused' ? 'active excused' : 'excused'} onClick={() => saveInternAttendanceStatus(teacher, 'excused')}>Vắng phép</button></div> : null}</div> : <span className="student-no-data">—</span>}</td> : null}<td>{isClassOwner && !teacher.owner ? <div className="student-row-menu-wrap"><button type="button" className="student-row-menu-btn" aria-label={`Mở thao tác cho ${getStudentDisplayName(teacher)}`} aria-expanded={teacherRowMenuId === teacher.id} onClick={() => { setStudentRowMenuId(''); setTeacherRowMenuId((id) => id === teacher.id ? '' : teacher.id); }}>•••</button>{teacherRowMenuId === teacher.id ? <div className="student-row-menu" onClick={(event) => event.stopPropagation()}>{teacher.classRole === 'intern_teacher' ? <button type="button" onClick={() => removeInternTeacherRole(teacher)}>Bỏ chức vụ thực tập</button> : <button type="button" onClick={() => setInternTeacherRole(teacher)}>Làm giáo viên thực tập</button>}<button type="button" className="danger" onClick={() => openDeleteTeacher(teacher)}>Xóa khỏi lớp</button></div> : null}</div> : null}</td></tr>; }) : <tr><td colSpan={internTeacherMembers.length ? 5 : 4} className="table-empty">Chưa có dữ liệu giáo viên trong lớp.</td></tr>}
                  </tbody></table>
                </div>
              </section>
            </div>
          ) : activeTab === 'scores' ? (
            <div className="score-dashboard-page">
              <section className="score-dashboard-head">
                <div><h3>Đánh giá &amp; Điểm số</h3><p>Lớp {selectedClass?.name || ''} — Năm học {schoolYear}</p></div>
                <div className="score-dashboard-actions">
                  <button type="button" className="score-export-btn" onClick={exportScorePdf}><span>⇩</span> Xuất PDF</button>
                </div>
              </section>

              <section className="score-subject-cards">
                {scoreDashboard.subjectCards.length ? scoreDashboard.subjectCards.map((subject) => (
                  <article className={`score-subject-card tone-${subject.tone}`} key={subject.id}>
                    <i />
                    <strong>{subject.average === null ? '—' : subject.average.toFixed(1)}</strong>
                    <span>{subject.name}</span>
                  </article>
                )) : <div className="score-dashboard-empty">Chưa có dữ liệu môn học.</div>}
              </section>

              <section className="score-analysis-grid">
                <article className="score-distribution-card">
                  <h4>Phân phối điểm số lớp</h4>
                  {scoreDashboard.totalWithScores ? <div className="score-distribution-chart">
                    <div className="score-distribution-y-axis"><span>{scoreDashboard.maxDistribution}</span><span>{Math.round(scoreDashboard.maxDistribution * .66)}</span><span>{Math.round(scoreDashboard.maxDistribution * .33)}</span><span>0</span></div>
                    <div className="score-distribution-plot">
                      {scoreDashboard.distribution.map((item) => {
                        const percent = scoreDashboard.totalWithScores ? Math.round((item.count / scoreDashboard.totalWithScores) * 1000) / 10 : 0;
                        return <div className="score-distribution-column chart-tooltip-host" key={item.id}>
                          <div className="score-distribution-track"><i className="chart-hover-target" style={{ height: `${Math.max(item.count ? 12 : 0, (item.count / scoreDashboard.maxDistribution) * 100)}%` }}><b>{item.count || ''}</b></i></div>
                          <span>{item.label}</span>
                          <div className="chart-hover-tooltip score-distribution-tooltip"><strong>{item.title}</strong><span>Khoảng điểm: <b>{item.label}</b></span><span>Học sinh: <b>{item.count}</b></span><small>{percent}% số học sinh có điểm</small></div>
                        </div>;
                      })}
                    </div>
                  </div> : <DataUnavailable icon="▥" text="Chưa có điểm để tạo phân phối kết quả." />}
                </article>

                <article className="score-classification-card">
                  <h4>Xếp loại lớp</h4>
                  <div className="score-classification-list">{scoreDashboard.distribution.map((item) => {
                    const percent = scoreDashboard.totalWithScores ? (item.count / scoreDashboard.totalWithScores) * 100 : 0;
                    return <div key={item.id} className={`score-classification-row ${item.tone}`}><i /><span>{item.title} <small>({item.label})</small></span><b>{item.count} HS</b><strong>{scoreDashboard.totalWithScores ? `${Number(percent.toFixed(1))}%` : '—'}</strong></div>;
                  })}</div>
                </article>
              </section>

              {scoreDashboard.incompleteStudentCount > 0 ? <div className="score-missing-notice" role="status"><span>!</span><p>Có <strong>{scoreDashboard.incompleteStudentCount}</strong> học sinh chưa đủ điểm ở <b>Bài tập ({scoreDashboard.missingByGroup.assignment})</b>, <b>Giữa kỳ ({scoreDashboard.missingByGroup.midterm})</b>, <b>Cuối kỳ ({scoreDashboard.missingByGroup.final})</b>.</p></div> : null}

              <section className="score-table-card">
                <div className="score-table-scroll">
                  <table className="score-dashboard-table">
                    <thead><tr><th>Học sinh</th>{scoreDashboard.assessmentGroups.filter((group) => group.id !== 'quiz').map((group) => <th key={group.id}>{group.label}{group.weight === null ? '' : ` (${Number(group.weight.toFixed(1))}%)`}</th>)}<th>ĐTB</th><th>Xếp loại</th><th>Hạng</th></tr></thead>
                    <tbody>
                      {scoreDashboard.rankedRows.length ? scoreDashboard.rankedRows.map((row) => {
                        const avatar = getStudentAvatar(row.student);
                        const classification = row.overall === null ? null : row.overall >= 9 ? ['Xuất sắc','excellent'] : row.overall >= 8 ? ['Giỏi','good'] : row.overall >= 7 ? ['Khá','fair'] : row.overall >= 5 ? ['Trung bình','average'] : ['Yếu','weak'];
                        return <tr key={row.student.id}>
                          <td><div className="score-student-cell"><span className={avatar ? 'has-image' : ''}>{avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : getInitial(getStudentDisplayName(row.student))}</span><strong>{getStudentDisplayName(row.student)}</strong></div></td>
                          {scoreDashboard.assessmentGroups.filter((group) => group.id !== 'quiz').map((group) => <td key={group.id}>{formatScore(row.groups[group.id])}</td>)}
                          <td><b className={`score-average ${classification?.[1] || ''}`}>{formatScore(row.overall)}</b></td>
                          <td>{classification ? <span className={`score-classification-pill ${classification[1]}`}>{classification[0]}</span> : '—'}</td>
                          <td><b className="score-rank">{row.rank ? `#${row.rank}` : '—'}</b></td>
                        </tr>;
                      }) : <tr><td className="table-empty" colSpan={scoreDashboard.assessmentGroups.filter((group) => group.id !== 'quiz').length + 4}>Chưa có dữ liệu điểm phù hợp trong hệ thống.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          ) : activeTab === 'resources' ? (
            <div className="class-resources-page elearning-resources-page">
              <section className="elearning-resources-head">
                <div>
                  <span className="elearning-resources-kicker">E-learning</span>
                  <h3>Học liệu</h3>
                  <p>Các bài đăng E-learning dành cho lớp {selectedClass?.name || 'hiện tại'}, bài của bạn và thư viện công khai.</p>
                </div>
                <button type="button" className="elearning-open-library-btn" onClick={openClassELearningPublisher} disabled={!canCreateClassELearning}>+ Đăng bài <span>＋</span></button>
              </section>
              {eLearningCreateNotice ? <div className="class-elearning-create-notice"><span>✓</span><p>{eLearningCreateNotice}</p><button type="button" onClick={() => setELearningCreateNotice('')} aria-label="Đóng thông báo">×</button></div> : null}

              <section className="elearning-resource-stats">
                <article><span>▣</span><div><strong>{eLearningResourceCounts.class}</strong><small>Dành cho lớp</small></div></article>
                <article><span>✦</span><div><strong>{eLearningResourceCounts.mine}</strong><small>Bài của tôi</small></div></article>
                <article><span>◎</span><div><strong>{eLearningResourceCounts.public}</strong><small>Công khai</small></div></article>
                <article><span>✓</span><div><strong>{eLearningResourceCounts.approved}</strong><small>Đã duyệt</small></div></article>
              </section>

              <section className="elearning-resource-toolbar">
                <label className="elearning-resource-search"><span>⌕</span><input value={eLearningResourceSearch} onChange={(event) => setELearningResourceSearch(event.target.value)} placeholder="Tìm tên bài, chủ đề, môn học, mã bài..." /></label>
                <div className="elearning-resource-scope" role="tablist" aria-label="Phạm vi học liệu">
                  <button type="button" className={eLearningResourceScope === 'class' ? 'active' : ''} onClick={() => setELearningResourceScope('class')}>Dành cho lớp <b>{eLearningResourceCounts.class}</b></button>
                  <button type="button" className={eLearningResourceScope === 'mine' ? 'active' : ''} onClick={() => setELearningResourceScope('mine')}>Bài của tôi <b>{eLearningResourceCounts.mine}</b></button>
                  <button type="button" className={eLearningResourceScope === 'public' ? 'active' : ''} onClick={() => setELearningResourceScope('public')}>Công khai <b>{eLearningResourceCounts.public}</b></button>
                </div>
                <label className="elearning-resource-scope-mobile">
                  <span className="elearning-resource-scope-mobile-label">Phạm vi học liệu</span>
                  <span className="elearning-resource-scope-mobile-control">
                    <span className="elearning-resource-scope-mobile-icon" aria-hidden="true">▣</span>
                    <select value={eLearningResourceScope} onChange={(event) => setELearningResourceScope(event.target.value)} aria-label="Phạm vi học liệu">
                      <option value="class">Dành cho lớp ({eLearningResourceCounts.class})</option>
                      <option value="mine">Bài của tôi ({eLearningResourceCounts.mine})</option>
                      <option value="public">Công khai ({eLearningResourceCounts.public})</option>
                    </select>
                    <span className="elearning-resource-scope-mobile-arrow" aria-hidden="true">⌄</span>
                  </span>
                </label>
                <div className="elearning-resource-selects">
                  <label><span>Định dạng</span><select value={eLearningResourceFormat} onChange={(event) => setELearningResourceFormat(event.target.value)}><option value="all">Tất cả</option><option value="video">Video</option><option value="document">Tài liệu</option><option value="simulation">Mô phỏng</option><option value="code">Code</option><option value="lesson">Bài học</option></select></label>
                  <label><span>Sắp xếp</span><select value={eLearningResourceSort} onChange={(event) => setELearningResourceSort(event.target.value)}><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option><option value="views">Nhiều lượt xem</option></select></label>
                </div>
              </section>

              {eLearningResourcesError ? <div className="elearning-resource-error">{eLearningResourcesError}</div> : null}
              {eLearningResourcesLoading ? (
                <div className="elearning-resource-grid" aria-label="Đang tải học liệu">{Array.from({ length: 6 }, (_, index) => <article className="elearning-resource-card skeleton" key={index}><div className="elearning-resource-thumb" /><div className="elearning-resource-card-body"><i /><i /><i /></div></article>)}</div>
              ) : visibleELearningResources.length ? (
                <div className="elearning-resource-grid">
                  {visibleELearningResources.map((course) => {
                    const format = getELearningCourseFormat(course);
                    const formatLabel = getELearningCourseFormatLabel(course);
                    const status = normalizeText(course.status || course.moderationStatus || 'approved');
                    const statusLabel = status === 'approved' ? 'Đã duyệt' : status === 'pending' ? 'Chờ duyệt' : status === 'rejected' ? 'Từ chối' : (course.status || course.moderationStatus || 'Đã đăng');
                    const title = stripELearningHtml(course.title) || 'Bài học E-learning';
                    const thumbnail = String(course.thumbnail || course.documentImageUrl || '').trim();
                    const ownerId = String(course.teacherId || course.createdByUid || course.createdBy || course.ownerId || course.userId || course.uid || '');
                    const ownerEmail = normalizeText(course.teacherEmail || course.createdByEmail || course.ownerEmail || '');
                    const teacherProfile = eLearningTeacherProfiles[`id:${ownerId}`] || eLearningTeacherProfiles[`email:${ownerEmail}`] || {};
                    const teacherName = teacherProfile.fullName || teacherProfile.displayName || teacherProfile.name || course.teacherName || course.teacherEmail || 'Giáo viên ZUNY';
                    const teacherAvatar = getUserAvatar(teacherProfile);
                    return <article className={`elearning-resource-card format-${format}`} key={course.id}>
                      <button type="button" className="elearning-resource-card-open" onClick={() => openELearningResource(course)} aria-label={`Mở ${title}`} />
                      <div className="elearning-resource-thumb" style={thumbnail ? { backgroundImage: `url(${JSON.stringify(thumbnail)})` } : undefined}>
                        <span className="elearning-resource-format-badge">{format === 'video' ? '▶' : format === 'document' ? '▤' : format === 'simulation' ? '✦' : format === 'code' ? '</>' : '▱'} {formatLabel}</span>
                        <span className={`elearning-resource-status ${status}`}>{statusLabel}</span>
                        {!thumbnail ? <strong>{format === 'video' ? 'VIDEO' : format === 'document' ? 'TÀI LIỆU' : format === 'simulation' ? 'MÔ PHỎNG' : format === 'code' ? 'CODE' : 'LEARNING'}</strong> : null}
                        <small>{getELearningVideoDuration(course)}</small>
                      </div>
                      <div className="elearning-resource-card-body">
                        <div className="elearning-resource-card-title"><div><span>{course.category || 'Môn học'}</span><h4 title={title}>{title}</h4></div><b>↗</b></div>
                        <p>{stripELearningHtml(course.topic || course.description) || 'Chưa có mô tả cho bài học này.'}</p>
                        <div className="elearning-resource-teacher"><span>{teacherAvatar ? <img src={teacherAvatar} alt={teacherName} referrerPolicy="no-referrer" /> : getInitial(teacherName)}</span><div><strong>{teacherName}</strong><small>{course.courseCode || course.className || 'E-learning ZUNY'}</small></div></div>
                        <footer><span>{formatELearningViews(course.views)} lượt xem</span><span>•</span><span>{formatELearningRelativeDate(course.createdAt || course.updatedAt)}</span><span>•</span><span>{Number(course.lessonCount || 0) || 1} bài</span></footer>
                      </div>
                    </article>;
                  })}
                </div>
              ) : (
                <div className="elearning-resource-empty"><span>▱</span><h4>Chưa có bài E-learning phù hợp</h4><p>{eLearningResourceScope === 'class' ? `Chưa có bài E-learning đặt quyền xem cho lớp ${selectedClass?.name || 'này'}.` : eLearningResourceScope === 'mine' ? 'Tài khoản giáo viên hiện chưa có bài E-learning phù hợp với bộ lọc.' : 'Chưa có bài công khai phù hợp với bộ lọc hiện tại.'}</p><button type="button" onClick={openClassELearningPublisher}>+ Đăng bài cho lớp</button></div>
              )}
            </div>
          ) : activeTab === 'schedule' ? (
            <div className="schedule-page">
              <section className="schedule-page-head">
                <div><h3>Lịch dạy</h3><p>Tuần {scheduleWeekStart.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} — {addDays(scheduleWeekStart, 4).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })} · Lớp {selectedClass?.name || ''}</p></div>
                <div className="schedule-week-actions">
                  <button type="button" className="schedule-time-settings-btn" onClick={openScheduleTimeSettings}>⚙ Điều chỉnh thời gian</button>
                  <button type="button" className="schedule-apply-prev-btn" onClick={applyPreviousWeekScheduleTime} disabled={scheduleEditorSaving}>↶ Áp dụng tuần trước</button>
                  <button type="button" className="schedule-apply-future-btn outside" onClick={applyCurrentScheduleFromNow} disabled={scheduleEditorSaving}>→ Áp dụng từ bây giờ</button>
                  <button type="button" className="schedule-export-btn" onClick={exportSchedulePdf}>⇩ Xuất PDF</button>
                  <button type="button" className="schedule-google-btn" onClick={syncScheduleWithGoogle}>▣ Đồng bộ Google</button>
                  <button type="button" onClick={() => setScheduleWeekOffset((value) => value - 1)}>← Tuần trước</button>
                  <button type="button" className="primary" onClick={() => setScheduleWeekOffset(0)}>Hôm nay</button>
                  <button type="button" onClick={() => setScheduleWeekOffset((value) => value + 1)}>Tuần sau →</button>
                </div>
              </section>
              {scheduleSyncMessage ? <div className="schedule-sync-message">{scheduleSyncMessage}</div> : null}
              <div className="schedule-board-scroll">
                <section className="schedule-board">
                  <div className="schedule-grid-head schedule-time-head">Thời gian</div>
                  {scheduleWeekDays.map((day) => <div className={`schedule-grid-head ${day.key === getLocalDateKey(now) ? 'today' : ''}`} key={day.key}><strong>{day.label}</strong><span>{day.shortDate}</span></div>)}
                  {visibleScheduleSlots.map((slot, rowIndex) => {
                    const breaksAfter = slot.period ? scheduleBreaks.filter((item) => Number(item.afterPeriod) === Number(slot.period)) : [];
                    return <div className="schedule-slot-group" key={`${slot.startTime}-${rowIndex}`}>
                      <div className={`schedule-grid-row ${slot.session === 'afternoon' && rowIndex > 0 && visibleScheduleSlots[rowIndex - 1]?.session !== 'afternoon' ? 'schedule-afternoon-start' : ''}`}>
                        <div className={`schedule-time-cell ${slot.session === 'legacy' ? 'legacy' : ''}`}><b>{slot.period ? `Tiết ${slot.period}` : 'Khác'}</b><strong>{slot.startTime}</strong><span>{slot.endTime}</span><small>{slot.session === 'morning' ? 'Buổi sáng' : slot.session === 'afternoon' ? 'Buổi chiều' : 'Ngoài khung'}</small></div>
                        {scheduleWeekDays.map((day) => {
                          const item = scheduleWeekItems.find((entry) => getScheduleDateFromItem(entry) === day.key && getScheduleStartTime(entry) === slot.startTime);
                          const title = item?.subjectName || item?.subject || item?.title || '';
                          return <button type="button" className={`schedule-cell ${item ? 'filled' : ''} ${item?.important ? 'important' : ''}`} key={day.key} onClick={() => openScheduleCellEditor(day.key, slot.startTime, slot.endTime)}>
                            {item ? <><strong>{title || 'Nội dung lịch'}</strong><span>{item.room || item.location || ''}</span>{item.lessonContent || item.lessonName || item.lesson || item.topic || item.note ? <small>{item.lessonContent || item.lessonName || item.lesson || item.topic || item.note}</small> : null}</> : <span className="schedule-cell-add"><b>+</b> Thêm nội dung</span>}
                          </button>;
                        })}
                      </div>
                      {breaksAfter.map((item) => <div className={`schedule-custom-break ${item.kind === 'lunch' ? 'lunch' : ''}`} key={item.id}><span>{item.label}</span><small>{item.startTime} – {item.endTime}</small></div>)}
                    </div>;
                  })}
                </section>
              </div>
              <section className="schedule-important-section">
                <div className="schedule-important-head"><div><h4>Quan trọng trong tuần</h4><p>Các ô được đánh dấu Quan trọng sẽ xuất hiện tại đây theo thời gian.</p></div><span>{importantScheduleItems.length}</span></div>
                {importantScheduleItems.length ? <div className="schedule-important-grid">{importantScheduleItems.map((item) => <button type="button" key={item.id} onClick={() => openScheduleCellEditor(getScheduleDateFromItem(item), getScheduleStartTime(item), getScheduleEndTime(item))}><i>!</i><div><strong>{item.subjectName || item.subject || item.title || 'Nội dung quan trọng'}</strong><span>{new Date(`${getScheduleDateFromItem(item)}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })} · {getScheduleStartTime(item)}{getScheduleEndTime(item) ? `–${getScheduleEndTime(item)}` : ''}</span>{item.note ? <small>{item.note}</small> : null}</div></button>)}</div> : <p className="schedule-important-empty">Chưa có nội dung quan trọng trong tuần này.</p>}
              </section>
              <section className="schedule-persistent-important">
                <div className="schedule-persistent-head"><div><span>Luôn theo dõi</span><h4>Quan trọng</h4><p>Nội dung tách biệt với lịch tuần và tự xóa khi hết thời gian.</p></div><button type="button" onClick={openPersistentImportant}>+ Thêm nội dung</button></div>
                {persistentImportantItems.length ? <div className="schedule-persistent-list">{persistentImportantItems.map((item) => <article key={item.id}><div><i>!</i><span><strong>{item.title}</strong><small>{item.note || 'Không có ghi chú'}</small><time>Đến {new Date(Number(item.expiresAtMillis)).toLocaleString('vi-VN')}</time></span></div><button type="button" onClick={() => deletePersistentImportant(item)}>Xóa</button></article>)}</div> : <p className="schedule-important-empty">Chưa có nội dung quan trọng dài hạn.</p>}
              </section>
            </div>
          ) : activeTab === 'notifications' ? (
            <div className="notification-center-page">
              <section className="notification-center-head"><div><div className="notification-title-line"><h3>Thông báo</h3>{unreadNotifications.length ? <b>{unreadNotifications.length}</b> : null}{selectedClass?.teacherId === currentUser?.uid ? <button type="button" className="notification-delete-all notification-delete-all-mobile" onClick={() => setNotificationDeleteAllOpen(true)} disabled={!teacherNotifications.length}>⌫ Xóa hết</button> : null}</div></div><div className="notification-center-actions"><div className="notification-filter-tabs"><button type="button" className={notificationFilter === 'all' ? 'active' : ''} onClick={() => setNotificationFilter('all')}>Tất cả</button><button type="button" className={notificationFilter === 'unread' ? 'active' : ''} onClick={() => setNotificationFilter('unread')}>Chưa đọc ({unreadNotifications.length})</button></div>{selectedClass?.teacherId === currentUser?.uid ? <button type="button" className="notification-delete-all notification-delete-all-desktop" onClick={() => setNotificationDeleteAllOpen(true)} disabled={!teacherNotifications.length}>⌫ Xóa hết</button> : null}</div></section>
              {notificationActionError ? <p className="form-error">{notificationActionError}</p> : null}
              <section className="notification-center-list">
                {visibleNotifications.length ? visibleNotifications.map((item) => { const unread = !userIdListIncludes(item.readBy, getCurrentSqlUserId(currentUser)); const severity = item.severity || (item.systemGenerated ? 'medium' : 'normal'); const icon = item.type === 'attendance' ? '!' : item.type === 'assignment' ? '▤' : item.type === 'score' || item.type === 'average' ? '▥' : item.type === 'reward' ? '★' : item.type?.startsWith('schedule') ? '◆' : '●'; const text = item.message || stripHtmlText(item.contentHtml || item.content || item.body || ''); return <article role="button" tabIndex={0} className={`notification-center-card ${unread ? 'unread' : ''} ${severity}`} key={item.id} onClick={() => unread && markNotificationRead(item)} onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && unread) markNotificationRead(item); }}><div className="notification-center-icon">{icon}</div><div className="notification-center-content"><div><strong>{item.title || (item.systemGenerated ? 'Thông báo tự động' : 'Thông báo lớp học')}</strong>{item.systemGenerated ? <em className="automatic">Thông báo tự động</em> : null}{severity === 'critical' ? <em>Khẩn cấp</em> : severity === 'reward' ? <em className="reward">Khen thưởng</em> : severity === 'important' ? <em className="important">Quan trọng</em> : null}{unread ? <i /> : null}</div><p>{text || 'Thông báo từ lớp học.'}</p><small>{formatDateTime(item.createdAt || item.updatedAt)}</small></div><div className="notification-card-actions">{(sameUserId(selectedClass?.teacherId, getCurrentSqlUserId(currentUser)) || sameUserId(item.authorId, getCurrentSqlUserId(currentUser))) ? <button type="button" className="notification-trash-btn" onClick={(event) => { event.stopPropagation(); openDeleteNotification(item); }} title="Xóa thông báo" aria-label="Xóa thông báo">⌫</button> : null}</div></article>; }) : <div className="notification-center-empty">{notificationFilter === 'unread' ? 'Không còn thông báo chưa đọc.' : 'Chưa có thông báo.'}</div>}
              </section>
            </div>
          ) : activeTab === 'messages' ? (
            <div className="class-messages-page">
              <div className="messages-page-head"><div><h3>Trao đổi</h3></div></div>
              <div className={`messages-layout ${messageMobileChatOpen ? 'mobile-chat-open' : ''}`}>
                <aside className="messages-sidebar">
                  <label className="messages-search"><span>⌕</span><input value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} placeholder="Tìm kiếm..." /></label>
                  <div className="conversation-list">{filteredConversationRows.length ? filteredConversationRows.map((item) => <button type="button" key={item.conversationId} className={`conversation-item ${selectedConversationId === item.conversationId ? 'active' : ''}`} onClick={() => { setSelectedConversationId(item.conversationId); setMessageMobileChatOpen(true); }}><span className="conversation-avatar">{item.avatar ? <img src={item.avatar} alt="" referrerPolicy="no-referrer" /> : getInitial(item.name)}</span><span className="conversation-copy"><strong>{item.name}</strong><small>{item.label}</small><em>{item.last?.recalled ? 'Tin nhắn đã thu hồi' : (item.last?.content || (item.last?.attachment ? `Đã gửi tệp: ${item.last.attachment.name}` : 'Chưa có tin nhắn'))}</em></span>{item.last?.createdAt ? <time>{formatClock(item.last.createdAt)}</time> : null}</button>) : <div className="conversation-empty">Chưa có phụ huynh hoặc học sinh có email để trao đổi.</div>}</div>
                </aside>
                <section className="messages-chat">
                  {selectedConversation ? <>
                    <header className="messages-chat-head">
                      <button type="button" className="messages-mobile-back-btn" onClick={() => setMessageMobileChatOpen(false)} aria-label="Quay lại danh sách thành viên">←</button>
                      <div className="message-person">
                        <span>{selectedConversation.avatar ? <img src={selectedConversation.avatar} alt="" referrerPolicy="no-referrer" /> : getInitial(selectedConversation.name)}</span>
                        <div><strong>{selectedConversation.name}</strong><small>{selectedConversation.label} · {selectedConversation.email}</small></div>
                      </div>
                      {selectedConversation.memberId ? <button type="button" onClick={() => { const student = attendanceStudents.find((item) => item.id === selectedConversation.memberId); if (student) openStudentProfile(student); }}>▣ Xem hồ sơ</button> : null}
                    </header>
                    <div className="messages-thread">
                      {selectedConversation.messages.length ? selectedConversation.messages.map((item) => {
                        const mine = sameUserId(item.senderId, getCurrentSqlUserId(currentUser));
                        const avatar = mine ? (item.senderAvatar || currentTeacherAvatar) : (item.senderAvatar || selectedConversation.avatar);
                        return (
                          <div className={`message-bubble-row ${mine ? 'mine' : 'theirs'}`} key={item.id}>
                            <span className="message-mini-avatar">{avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : getInitial(mine ? (currentUser?.displayName || currentUser?.email || 'GV') : selectedConversation.name)}</span>
                            <div className="message-bubble-stack">
                              <div className={`message-bubble ${item.recalled ? 'recalled' : ''}`}>
                                {item.recalled ? <p className="message-recalled-text">Tin nhắn đã thu hồi</p> : <>{item.content ? <p>{item.content}</p> : null}{item.attachment ? <a href={item.attachment.url} target="_blank" rel="noreferrer">📎 {item.attachment.name}</a> : null}</>}
                              </div>
                              <div className="message-meta-row">
                                <small>{formatDateTime(item.recalledAt || item.createdAt)}</small>
                                <div className="message-actions">
                                  <button type="button" className={copiedMessageId === item.id ? 'copied' : ''} onClick={() => copyMessage(item)} title="Sao chép tin nhắn" aria-label="Sao chép tin nhắn">{copiedMessageId === item.id ? '✓' : '⧉'}</button>
                                  {mine && !item.recalled ? <button type="button" className="recall" onClick={() => openRecallMessageConfirm(item)} disabled={recallingMessageId === item.id} title="Thu hồi tin nhắn" aria-label="Thu hồi tin nhắn">{recallingMessageId === item.id ? '…' : '↶'}</button> : null}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }) : <div className="messages-thread-empty">Chưa có tin nhắn. Hãy bắt đầu cuộc trao đổi.</div>}
                    </div>
                    <footer className="messages-composer">
                      <input ref={messageFileInputRef} type="file" hidden onChange={(event) => { const file = event.target.files?.[0] || null; setActiveMessageAttachment(file); event.target.value = ''; }} />
                      <button type="button" className="message-attach-btn" onClick={() => messageFileInputRef.current?.click()} title="Đính kèm tệp" aria-label="Đính kèm tệp">📎</button>
                      <div className="message-input-wrap">
                        {activeMessageAttachment ? <div className="message-attachment-draft"><span>📎</span><strong>{activeMessageAttachment.name}</strong><button type="button" onClick={() => setActiveMessageAttachment(null)} title="Bỏ tệp đính kèm" aria-label="Bỏ tệp đính kèm">×</button></div> : null}
                        <textarea ref={messageTextareaRef} rows={1} maxLength={2000} value={activeMessageDraft} onChange={(event) => { setActiveMessageDraft(event.target.value); resizeChatTextarea(event.currentTarget, 140); }} onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); sendMessage(); } }} placeholder="Nhập tin nhắn..." />
                      </div>
                      <button type="button" className="message-send-btn" onClick={sendMessage} disabled={messageSending || (!activeMessageDraft.trim() && !activeMessageAttachment)}>{messageSending ? 'Đang gửi...' : 'Gửi →'}</button>
                    </footer>
                    {messageError ? <p className="form-error message-error">{messageError}</p> : null}
                  </> : <div className="messages-thread-empty">Chọn một phụ huynh hoặc học sinh để bắt đầu trao đổi.</div>}
                </section>
              </div>
            </div>
          ) : (
            <div className="workspace-empty-state">
              <div className="workspace-empty-icon" aria-hidden="true">
                {activeWorkspaceItem.icon}
              </div>
              <h3>{activeWorkspaceItem.label}</h3>
              <p>
                Khu vực này đang xây dựng
              </p>
            </div>
          )}
        </section>
      </div>

      {createClassModal}
      {studentImportModal}
      {addStudentModal}
      {deleteClassModal}
      {editStudentModal}
      {deleteStudentModal}
      {deleteTeacherModal}
      {classSettingsModal}
      {joinClassModal}
      {homeSettingsModal}
      {announcementModal}
      {announcementLinkModal}
      {notificationDeleteModal}
      {messageRecallConfirm ? (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !recallingMessageId) setMessageRecallConfirm(null); }}>
          <section className="class-modal message-recall-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="message-recall-confirm-title">
            <div className="message-recall-confirm-icon" aria-hidden="true">↶</div>
            <h2 id="message-recall-confirm-title">Thu hồi tin nhắn?</h2>
            <p>Tin nhắn sẽ được thu hồi khỏi cuộc trò chuyện. Nội dung và tệp đính kèm của tin nhắn này sẽ không còn hiển thị.</p>
            <div className="message-recall-preview">
              <span>Tin nhắn</span>
              <strong>{messageRecallConfirm.content || (messageRecallConfirm.attachment ? `Tệp: ${messageRecallConfirm.attachment.name}` : 'Tin nhắn này')}</strong>
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setMessageRecallConfirm(null)} disabled={Boolean(recallingMessageId)}>Hủy</button>
              <button type="button" className="danger-btn message-recall-confirm-btn" onClick={() => recallMessage(messageRecallConfirm)} disabled={Boolean(recallingMessageId)}>{recallingMessageId ? 'Đang thu hồi...' : 'Thu hồi'}</button>
            </div>
          </section>
        </div>
      ) : null}
        {studentProfile ? (() => {
          const profileIndex = sortStudentsByJoinTime(students).findIndex((item) => item.id === studentProfile.id);
          const attendance = getStudentAttendanceMetrics(studentProfile);
          const average = getStudentAverageAcrossSubjects(studentProfile);
          const parentName = studentProfile.parentName || studentProfile.guardianName || studentProfile.emergencyContactName || '';
          const parentPhone = studentProfile.parentPhone || studentProfile.guardianPhone || studentProfile.emergencyPhone || '';
          const parentEmail = studentProfile.parentEmail || studentProfile.guardianEmail || '';
          const conduct = studentProfile.conduct || studentProfile.behavior || studentProfile.hanhKiem || 'Chưa có dữ liệu';
          const profileUser = userProfilesByEmail[normalizeText(studentProfile.email)] || {};
          const studentUid = studentProfile.uid || profileUser.uid || profileUser.id || '';
          const studentKeys = new Set([studentProfile.id, studentProfile.studentId, studentUid, normalizeText(studentProfile.email)].filter(Boolean));
          const subjectRows = subjects.map((subject) => {
            const source = allSubjectScores[subject.id] || {};
            const tests = source.tests || [];
            const scoreRow = (source.scores || []).find((item) => {
              const rowId = item.studentId || item.id || item.uid;
              return studentKeys.has(rowId) || studentKeys.has(normalizeText(item.email));
            });
            const scoredTests = scoreRow ? tests.map((test) => ({ test, value: toNumber(scoreRow.scores?.[test.id]) })).filter((item) => item.value !== null) : [];
            const avg = scoreRow ? (toNumber(scoreRow.average) ?? averageFromScores(scoredTests.map((item) => item.value))) : null;
            return { subject, avg, scoreRow, tests, scoredTests };
          }).filter((row) => row.scoredTests.length);
          const attendanceHistory = attendanceRecords.filter((record) => { const directId = record.studentId || record.uid || record.userId; const rows = Array.isArray(record.students) ? record.students : Array.isArray(record.records) ? record.records : []; return studentKeys.has(directId) || rows.some((item) => studentKeys.has(item.studentId || item.id || item.uid) || studentKeys.has(normalizeText(item.email))); }).sort((a,b) => getRecordDateValue(b)-getRecordDateValue(a));
          const findStudentSubmission = (assignment) => {
            const submissions = assignment.submissions || assignment.studentSubmissions || {};
            if (submissions?.[studentProfile.id]) return submissions[studentProfile.id];
            if (!submissions || typeof submissions !== 'object') return null;
            return Object.values(submissions).find((submission) => submission && typeof submission === 'object' && (studentKeys.has(submission.studentId || submission.uid || submission.id) || studentKeys.has(normalizeText(submission.email)))) || null;
          };
          const studentAssignments = (assignmentsByClass[selectedClassId] || []).filter((assignment) => {
            if (isAssignmentDraft(assignment)) return false;
            const ids = assignment.studentIds || assignment.assigneeIds || assignment.assignedStudentIds;
            if (!Array.isArray(ids) || !ids.length) return true;
            return ids.some((value) => studentKeys.has(value));
          }).sort((a, b) => (getAssignmentDueValue(a) || Number.MAX_SAFE_INTEGER) - (getAssignmentDueValue(b) || Number.MAX_SAFE_INTEGER));
          const assignmentRows = studentAssignments.map((assignment) => {
            const submission = findStudentSubmission(assignment);
            const due = getAssignmentDueValue(assignment);
            const submittedAt = getTimeValue(submission?.submittedAt);
            const normalizedSubmissionStatus = normalizeText(submission?.status || submission?.state);
            const submitted = Boolean(submittedAt || ['submitted', 'graded', 'đã nộp', 'đã chấm', 'late'].includes(normalizedSubmissionStatus));
            const late = submitted && Boolean(submission?.isLate || normalizedSubmissionStatus === 'late' || (due && submittedAt && submittedAt > due));
            const soon = Boolean(due && due >= now.getTime() && due - now.getTime() <= 3 * 24 * 60 * 60 * 1000);
            let label = 'Chưa nộp';
            let tone = 'neutral';
            if (submitted) {
              if (late) { label = 'Nộp trễ'; tone = 'late'; }
              else if (due && submittedAt) { label = 'Đúng hạn'; tone = 'ontime'; }
              else { label = 'Đã nộp'; tone = 'submitted'; }
            } else if (due && due < now.getTime()) { label = 'Quá hạn'; tone = 'overdue'; }
            else if (soon) { label = 'Sắp tới hạn'; tone = 'warning'; }
            return { assignment, submission, due, submittedAt, label, tone };
          });
          const profileEvents = Array.isArray(studentProfile.profileEvents) ? studentProfile.profileEvents : Array.isArray(studentProfile.behaviorRecords) ? studentProfile.behaviorRecords : [];
          const autoRewards = [];
          if (average !== null && average >= 9) autoRewards.push({ icon: '★', title: 'Thành tích học tập xuất sắc', note: `Điểm trung bình hiện tại ${average.toFixed(1)}. Kết quả nổi bật, nên tiếp tục duy trì phong độ học tập.` });
          else if (average !== null && average >= 8) autoRewards.push({ icon: '✓', title: 'Kết quả học tập tốt', note: `Điểm trung bình hiện tại ${average.toFixed(1)}. Học sinh đang có kết quả tốt và xứng đáng được ghi nhận.` });
          return <div className="student-profile-backdrop" onMouseDown={() => setStudentProfileId('')}><aside className="student-profile-drawer" onMouseDown={(event) => event.stopPropagation()}>
            <header className="student-profile-header"><span className={`student-profile-avatar ${getStudentAvatar(studentProfile) ? 'has-image' : ''}`}>{getStudentAvatar(studentProfile) ? <img src={getStudentAvatar(studentProfile)} alt="" referrerPolicy="no-referrer" /> : getInitial(getStudentDisplayName(studentProfile))}</span><div><h3>{getStudentDisplayName(studentProfile)}</h3><p>{studentProfile.gender || studentProfile.sex || 'Chưa có giới tính'}{studentProfile.birthDate || studentProfile.dob ? ` · Sinh ${studentProfile.birthDate || studentProfile.dob}` : ''}{average !== null ? ` · Hạng theo điểm` : ''}</p></div>{profileEditing ? <div className="student-profile-edit-actions"><button type="button" className="student-profile-cancel" onClick={() => { setProfileEditing(false); setProfileEditError(''); }} disabled={profileSaving}>Hủy</button><button type="button" className="student-profile-save" onClick={saveProfileEdit} disabled={profileSaving}>{profileSaving ? 'Đang lưu...' : 'Lưu'}</button></div> : <button type="button" className="student-profile-edit" onClick={() => startProfileEdit(studentProfile)}>✎ Chỉnh sửa</button>}<button type="button" className="student-profile-close" onClick={() => { setStudentProfileId(''); setProfileEditing(false); }}>×</button></header>
            <div className="student-profile-strip"><span>Điểm danh: <b>{attendance.rate === null ? '—' : `${attendance.rate}%`}</b></span><span>ĐTB: <b>{average === null ? '—' : average.toFixed(1)}</b></span><span>Hạnh kiểm: <b>{conduct}</b></span></div>
            <nav className="student-profile-tabs">{[['info','Thông tin'],['attendance','Điểm danh'],['scores','Điểm số'],['assignments','Bài tập'],['profile','Hồ sơ']].map(([id,label]) => <button type="button" key={id} className={studentProfileTab === id ? 'active' : ''} onClick={() => setStudentProfileTab(id)}>{label}</button>)}</nav>
            <div className="student-profile-body">
              {studentProfileTab === 'info' ? <>{profileEditError ? <p className="profile-edit-error">{profileEditError}</p> : null}<section><h4>Thông tin cơ bản</h4>{profileEditing ? <div className="student-profile-edit-grid"><label><small>Họ và tên</small><input value={profileEditForm.name} onChange={(event) => setProfileEditForm((current) => ({ ...current, name: event.target.value }))} /></label><label><small>Giới tính</small><select value={profileEditForm.gender} onChange={(event) => setProfileEditForm((current) => ({ ...current, gender: event.target.value }))}><option value="">Chưa chọn</option><option value="Nam">Nam</option><option value="Nữ">Nữ</option><option value="Khác">Khác</option></select></label><label><small>Ngày sinh</small><input type="date" value={profileEditForm.birthDate} onChange={(event) => setProfileEditForm((current) => ({ ...current, birthDate: event.target.value }))} /></label><label><small>Email</small><input type="email" value={profileEditForm.email} onChange={(event) => setProfileEditForm((current) => ({ ...current, email: event.target.value }))} /></label><label><small>Số điện thoại</small><input value={profileEditForm.phone} onChange={(event) => setProfileEditForm((current) => ({ ...current, phone: event.target.value }))} /></label><div className="profile-readonly-field"><small>Mã học sinh</small><strong>{getStudentCode(studentProfile, profileIndex)}</strong></div><div className="profile-readonly-field"><small>Lớp</small><strong>{selectedClass?.name || '—'}</strong></div></div> : <div className="student-profile-info-grid"><div><small>Họ và tên</small><strong>{getStudentDisplayName(studentProfile)}</strong></div><div><small>Giới tính</small><strong>{studentProfile.gender || studentProfile.sex || 'Chưa có dữ liệu'}</strong></div><div><small>Ngày sinh</small><strong>{studentProfile.birthDate || studentProfile.dob || 'Chưa có dữ liệu'}</strong></div><div><small>Lớp</small><strong>{selectedClass?.name || '—'}</strong></div><div><small>Mã học sinh</small><strong>{getStudentCode(studentProfile, profileIndex)}</strong></div><div><small>Email</small><strong>{studentProfile.email || 'Chưa có dữ liệu'}</strong></div></div>}</section><section><h4>Phụ huynh / Liên hệ khẩn cấp</h4>{profileEditing ? <div className="student-profile-edit-grid student-contact-edit-grid"><label><small>Tên phụ huynh</small><input value={profileEditForm.parentName} onChange={(event) => setProfileEditForm((current) => ({ ...current, parentName: event.target.value }))} /></label><label><small>Số điện thoại</small><input value={profileEditForm.parentPhone} onChange={(event) => setProfileEditForm((current) => ({ ...current, parentPhone: event.target.value }))} /></label><label><small>Email</small><input type="email" value={profileEditForm.parentEmail} onChange={(event) => setProfileEditForm((current) => ({ ...current, parentEmail: event.target.value }))} /></label><label><small>Quan hệ</small><input value={profileEditForm.parentRelation} onChange={(event) => setProfileEditForm((current) => ({ ...current, parentRelation: event.target.value }))} /></label></div> : <div className="student-contact-card"><div><small>Tên phụ huynh</small><strong>{parentName || 'Chưa có dữ liệu'}</strong></div><div><small>Số điện thoại</small><strong>{parentPhone || 'Chưa có dữ liệu'}</strong></div><div><small>Email</small><strong>{parentEmail || 'Chưa có dữ liệu'}</strong></div><div><small>Quan hệ</small><strong>{studentProfile.parentRelation || studentProfile.guardianRelation || 'Chưa có dữ liệu'}</strong></div></div>}</section><section><h4>Ghi chú y tế</h4>{profileEditing ? <textarea className="student-medical-edit" rows="4" value={profileEditForm.medicalNote} onChange={(event) => setProfileEditForm((current) => ({ ...current, medicalNote: event.target.value }))} placeholder="Ghi chú y tế..." /> : <div className="student-medical-note">{studentProfile.medicalNote || studentProfile.medicalNotes || studentProfile.healthNote || 'Chưa có ghi chú y tế.'}</div>}</section></> : null}
              {studentProfileTab === 'attendance' ? <section><h4>Lịch sử điểm danh</h4><div className="student-profile-stat-grid"><div><b>{attendance.present}</b><span>Có mặt</span></div><div><b>{attendance.late}</b><span>Trễ</span></div><div><b>{attendance.absent}</b><span>Vắng</span></div><div><b>{attendance.total}</b><span>Tổng lượt</span></div></div>{attendanceHistory.length ? <div className="student-profile-list">{attendanceHistory.slice(0,20).map((record) => <div key={record.id}><time>{formatDateTime(record.date || record.attendanceDate || record.createdAt)}</time><strong>{record.status || record.attendanceStatus || 'Đã ghi nhận'}</strong><span>{record.note || record.subjectName || record.subject || ''}</span></div>)}</div> : <DataUnavailable icon="✓" text="Chưa có lịch sử điểm danh riêng của học sinh." />}</section> : null}
              {studentProfileTab === 'scores' ? <section><h4>Điểm số các bài thi đã làm</h4>{subjectRows.length ? <div className="student-profile-score-groups">{subjectRows.map(({subject,avg,scoredTests}) => <article key={subject.id}><header><div><strong>{subject.name || 'Môn học'}</strong><small>{scoredTests.length} bài có điểm</small></div><b>{avg === null ? '—' : avg.toFixed(1)}</b></header>{scoredTests.length ? <div className="student-profile-test-scores">{scoredTests.map(({test,value}) => <div key={test.id}><span><strong>{test.name || test.title || test.code || 'Bài kiểm tra'}</strong><small>{test.type || test.category || 'Bài thi'}{test.date || test.testDate || test.createdAt ? ` · ${formatDateTime(test.date || test.testDate || test.createdAt)}` : ''}</small></span><b>{formatScore(value)}</b></div>)}</div> : <p className="student-profile-score-empty">Môn này chưa có bài thi nào được nhập điểm cho học sinh.</p>}</article>)}</div> : <DataUnavailable icon="★" text="Chưa có điểm bài thi nào của học sinh trong dữ liệu hiện tại." />}</section> : null}
              {studentProfileTab === 'assignments' ? <section><h4>Bài tập & trạng thái</h4>{assignmentRows.length ? <div className="student-profile-assignment-list">{assignmentRows.map(({assignment,submission,due,submittedAt,label,tone}) => <article key={assignment.id}><div><strong>{getAssignmentTitle(assignment)}</strong><small>{assignment.subjectName || assignment.subject || selectedClass?.subject || 'Bài tập'}{due ? ` · Hạn ${formatDateTime(due)}` : ' · Chưa có hạn nộp'}</small></div><span className={`student-profile-assignment-status ${tone}`}>{label}</span><time>{submittedAt ? `Nộp ${formatDateTime(submittedAt)}` : submission?.updatedAt ? `Cập nhật ${formatDateTime(submission.updatedAt)}` : 'Chưa có bài nộp'}</time></article>)}</div> : <DataUnavailable icon="▤" text="Lớp hiện chưa có bài tập phù hợp cho học sinh này." />}</section> : null}
              {studentProfileTab === 'profile' ? <section><h4>Khen thưởng & nhận xét</h4><div className="student-auto-reward-note">Đánh giá tự động bên dưới chỉ được suy ra từ điểm trung bình hiện có.</div>{autoRewards.length ? <div className="student-auto-reward-list">{autoRewards.map((reward,index) => <article key={`${reward.title}-${index}`}><span>{reward.icon}</span><div><strong>{reward.title}</strong><p>{reward.note}</p></div></article>)}</div> : <div className="student-auto-reward-empty">{average === null ? 'Chưa có đủ dữ liệu điểm để tạo khen thưởng tự động.' : 'Điểm trung bình hiện tại chưa đạt ngưỡng khen thưởng tự động từ 8.0 trở lên.'}</div>}{profileEvents.length ? <><h4 className="student-profile-record-title">Ghi nhận đã lưu trong hồ sơ</h4><div className="student-profile-timeline">{profileEvents.map((event,index) => <div key={event.id || index}><span>•</span><div><time>{formatDateTime(event.date || event.createdAt)}</time><strong>{event.title || event.type || 'Ghi nhận'}</strong><p>{event.note || event.description || ''}</p></div></div>)}</div></> : null}</section> : null}
            </div>
          </aside></div>;
        })() : null}

      {scheduleEditorOpen ? <div className={`modal-backdrop schedule-modal-backdrop ${scheduleEditorMode === 'slots' ? 'fullscreen' : ''}`} onMouseDown={(event) => { if (event.target === event.currentTarget && !scheduleEditorSaving) setScheduleEditorOpen(false); }}><section className={`class-modal schedule-editor-modal ${scheduleEditorMode === 'slots' ? 'schedule-slots-fullscreen' : ''}`}><div className="modal-head schedule-modal-head"><div><p>Lịch dạy</p><h2>{scheduleEditorMode === 'slots' ? 'Điều chỉnh thời gian & nội dung tuần' : scheduleEditorTargetId ? 'Chỉnh nội dung lịch' : 'Thêm nội dung lịch'}</h2></div><button type="button" className="icon-btn" onClick={() => setScheduleEditorOpen(false)} disabled={scheduleEditorSaving}>×</button></div>
        <div className="schedule-modal-body">
          {scheduleEditorMode === 'slots' ? <div className={`schedule-fullscreen-layout ${scheduleInlineEditor ? 'has-inline-editor' : ''}`}><div className="schedule-config-main">
            <p className="schedule-slot-help">Kéo thả các tiết trong cùng buổi để đổi thứ tự. Buổi sáng và buổi chiều có nút thêm tiết riêng. Bạn cũng có thể thêm nội dung cho từng ngày ngay trong màn hình này.</p>
            {['morning','afternoon'].map((session) => { const sessionLabel = session === 'morning' ? 'Buổi sáng' : 'Buổi chiều'; const sessionSlots = scheduleSlotDraft.filter((slot) => slot.session === session); return <section className={`schedule-session-editor ${session}`} key={session}><div className="schedule-session-editor-head"><div><span>{session === 'morning' ? '☀' : '◐'}</span><div><strong>{sessionLabel}</strong><small>{sessionSlots.length} tiết</small></div></div><button type="button" onClick={() => addSchedulePeriod(session)}>+ Thêm tiết {session === 'morning' ? 'sáng' : 'chiều'}</button></div><div className="schedule-slot-editor dynamic">
              {sessionSlots.map((slot) => { const globalIndex = scheduleSlotDraft.findIndex((item) => item.id === slot.id); return <article className={`schedule-slot-editor-row dynamic draggable ${scheduleDragId === slot.id ? 'dragging' : ''}`} key={slot.id} draggable onDragStart={() => setScheduleDragId(slot.id)} onDragEnd={() => setScheduleDragId('')} onDragOver={(event) => event.preventDefault()} onDrop={() => { moveScheduleSlot(scheduleDragId, slot.id); setScheduleDragId(''); }}>
                <div className="schedule-drag-handle" title="Kéo để đổi thứ tự">⋮⋮</div><div className="schedule-slot-label"><b>Tiết {globalIndex + 1}</b><span>{sessionLabel}</span></div>
                <label><small>Bắt đầu</small><input type="time" value={slot.startTime} onChange={(event) => setScheduleSlotDraft((current) => current.map((item) => item.id === slot.id ? { ...item, startTime: event.target.value } : item))} /></label>
                <label><small>Kết thúc</small><input type="time" value={slot.endTime} onChange={(event) => setScheduleSlotDraft((current) => current.map((item) => item.id === slot.id ? { ...item, endTime: event.target.value } : item))} /></label>
                <button type="button" className="schedule-remove-slot-btn" onClick={() => setScheduleSlotDraft((current) => current.filter((item) => item.id !== slot.id).map((item, itemIndex) => ({ ...item, period: itemIndex + 1 })))} disabled={scheduleSlotDraft.length <= 1} title="Xóa tiết">×</button>
                <div className="schedule-slot-week-content"><span>Nội dung trong tuần</span><div>{scheduleWeekDays.map((day) => { const item = scheduleWeekItems.find((entry) => getScheduleDateFromItem(entry) === day.key && getScheduleStartTime(entry) === slot.startTime); return <button type="button" key={day.key} className={item ? 'has-content' : ''} onClick={() => openScheduleInlineEditor(day, slot)}><small>{day.label}</small><strong>{item?.title || item?.subjectName || item?.subject || '+ Thêm nội dung'}</strong></button>; })}</div></div>
              </article>; })}
            </div></section>; })}
            <div className="schedule-slot-editor-head breaks"><strong>Giờ nghỉ / ra chơi</strong><button type="button" onClick={addScheduleBreak}>+ Thêm giờ nghỉ</button></div>
            <div className="schedule-break-editor">{scheduleBreakDraft.length ? scheduleBreakDraft.map((item, index) => <div className="schedule-break-editor-row" key={item.id}><label><small>Tên</small><input value={item.label} onChange={(event) => setScheduleBreakDraft((current) => current.map((breakItem, breakIndex) => breakIndex === index ? { ...breakItem, label: event.target.value } : breakItem))} /></label><label><small>Sau tiết</small><select value={item.afterPeriod} onChange={(event) => setScheduleBreakDraft((current) => current.map((breakItem, breakIndex) => breakIndex === index ? { ...breakItem, afterPeriod: Number(event.target.value) } : breakItem))}>{scheduleSlotDraft.map((slot, slotIndex) => <option key={slot.id} value={slotIndex + 1}>Tiết {slotIndex + 1}</option>)}</select></label><label><small>Bắt đầu</small><input type="time" value={item.startTime} onChange={(event) => setScheduleBreakDraft((current) => current.map((breakItem, breakIndex) => breakIndex === index ? { ...breakItem, startTime: event.target.value } : breakItem))} /></label><label><small>Kết thúc</small><input type="time" value={item.endTime} onChange={(event) => setScheduleBreakDraft((current) => current.map((breakItem, breakIndex) => breakIndex === index ? { ...breakItem, endTime: event.target.value } : breakItem))} /></label><button type="button" className="schedule-remove-slot-btn" onClick={() => setScheduleBreakDraft((current) => current.filter((_, breakIndex) => breakIndex !== index))}>×</button></div>) : <p className="schedule-break-empty">Chưa có giờ nghỉ.</p>}</div>
          </div>{scheduleInlineEditor ? <aside className="schedule-inline-editor"><div className="schedule-inline-head"><div><span>Nội dung tiết học</span><strong>{scheduleInlineEditor.startTime} – {scheduleInlineEditor.endTime}</strong></div><button type="button" onClick={() => setScheduleInlineEditor(null)}>×</button></div><label>Môn học <span>*</span><input value={scheduleInlineEditor.title} onChange={(event) => setScheduleInlineEditor((current) => ({ ...current, title: event.target.value }))} placeholder="Nhập môn học" /></label><label>Nội dung bài học<input value={scheduleInlineEditor.lessonContent} onChange={(event) => setScheduleInlineEditor((current) => ({ ...current, lessonContent: event.target.value }))} placeholder="Không bắt buộc" /></label><label>Phòng học<input value={scheduleInlineEditor.room} onChange={(event) => setScheduleInlineEditor((current) => ({ ...current, room: ensureScheduleRoomPrefix(event.target.value.replace(/^phòng\s*:\s*/i, '')) }))} /></label><label>Thông báo<textarea rows="5" value={scheduleInlineEditor.note} onChange={(event) => setScheduleInlineEditor((current) => ({ ...current, note: event.target.value }))} placeholder="Ghi chú hoặc thông báo" /></label><label className="schedule-important-toggle"><input type="checkbox" checked={scheduleInlineEditor.important} onChange={(event) => setScheduleInlineEditor((current) => ({ ...current, important: event.target.checked }))} /><span><strong>Quan trọng</strong><small>Hiển thị bên dưới lịch.</small></span></label><button type="button" className="primary-btn schedule-inline-save" onClick={saveScheduleInlineEditor} disabled={scheduleEditorSaving}>{scheduleEditorSaving ? 'Đang lưu...' : 'Lưu nội dung'}</button></aside> : null}</div> : <><div className="schedule-editor-time-pair schedule-editor-time-only"><label>Giờ bắt đầu<input type="time" value={scheduleEditorForm.startTime} readOnly /></label><label>Giờ kết thúc<input type="time" value={scheduleEditorForm.endTime} readOnly /></label></div><label>Môn học <span>*</span><input value={scheduleEditorForm.title} onChange={(event) => setScheduleEditorForm((current) => ({ ...current, title: event.target.value }))} placeholder="Nhập môn học" required /></label><label>Nội dung bài học<input value={scheduleEditorForm.lessonContent} onChange={(event) => setScheduleEditorForm((current) => ({ ...current, lessonContent: event.target.value }))} placeholder="Không bắt buộc" /></label><label>Phòng học<input value={scheduleEditorForm.room} onChange={(event) => setScheduleEditorForm((current) => ({ ...current, room: ensureScheduleRoomPrefix(event.target.value.replace(/^phòng\s*:\s*/i, '')) }))} /></label><label>Thông báo<textarea rows="4" value={scheduleEditorForm.note} onChange={(event) => setScheduleEditorForm((current) => ({ ...current, note: event.target.value }))} placeholder="Ghi chú hoặc thông báo cho thời điểm này" /></label><label className="schedule-important-toggle"><input type="checkbox" checked={scheduleEditorForm.important} onChange={(event) => setScheduleEditorForm((current) => ({ ...current, important: event.target.checked }))} /><span><strong>Quan trọng</strong><small>Hiển thị nội dung này ở khu vực Quan trọng bên dưới lịch.</small></span></label></>}
          {scheduleEditorError ? <p className="form-error">{scheduleEditorError}</p> : null}
        </div><div className="modal-actions schedule-modal-actions"><button type="button" className="ghost-btn" onClick={() => setScheduleEditorOpen(false)} disabled={scheduleEditorSaving}>Hủy</button><button type="button" className="primary-btn modal-submit" onClick={saveScheduleEditor} disabled={scheduleEditorSaving}>{scheduleEditorSaving ? 'Đang lưu...' : scheduleEditorMode === 'slots' ? 'Lưu khung giờ tuần này' : 'Lưu lịch'}</button></div></section></div> : null}

      {scheduleImportantOpen ? <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setScheduleImportantOpen(false); }}><section className="class-modal schedule-important-modal"><div className="modal-head"><div><p>Lịch dạy</p><h2>Thêm nội dung quan trọng</h2></div><button type="button" className="icon-btn" onClick={() => setScheduleImportantOpen(false)}>×</button></div><label>Nội dung <span>*</span><input value={scheduleImportantForm.title} onChange={(event) => setScheduleImportantForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ví dụ: Họp phụ huynh toàn lớp" /></label><label>Ghi chú<textarea rows="4" value={scheduleImportantForm.note} onChange={(event) => setScheduleImportantForm((current) => ({ ...current, note: event.target.value }))} placeholder="Thông tin chi tiết, địa điểm, yêu cầu chuẩn bị..." /></label><div className="modal-grid"><label>Ngày hết hạn <span>*</span><input type="date" value={scheduleImportantForm.expiresDate} onChange={(event) => setScheduleImportantForm((current) => ({ ...current, expiresDate: event.target.value }))} /></label><label>Giờ hết hạn<input type="time" value={scheduleImportantForm.expiresTime} onChange={(event) => setScheduleImportantForm((current) => ({ ...current, expiresTime: event.target.value }))} /></label></div>{scheduleImportantError ? <p className="form-error">{scheduleImportantError}</p> : null}<div className="modal-actions"><button type="button" className="ghost-btn" onClick={() => setScheduleImportantOpen(false)}>Hủy</button><button type="button" className="primary-btn modal-submit" onClick={savePersistentImportant} disabled={scheduleImportantSaving}>{scheduleImportantSaving ? 'Đang lưu...' : 'Lưu quan trọng'}</button></div></section></div> : null}

      {scheduleGoogleGuideOpen ? <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setScheduleGoogleGuideOpen(false); }}><section className="class-modal google-calendar-guide-modal"><div className="modal-head"><div><p>Google Calendar</p><h2>Nhập thời khóa biểu vào Google</h2></div><button type="button" className="icon-btn" onClick={() => setScheduleGoogleGuideOpen(false)}>×</button></div><div className="google-calendar-guide"><div className="google-guide-success">✓ File <b>.ics</b> đã được tải tự động xuống thiết bị.</div><ol><li>Mở trang cài đặt Google Calendar bằng đường dẫn bên dưới.</li><li>Trong menu bên trái chọn <b>Nhập và xuất</b>.</li><li>Ở phần <b>Nhập</b>, chọn file <b>LichDay_...ics</b> vừa tải xuống.</li><li>Chọn lịch Google muốn lưu rồi bấm <b>Nhập</b>.</li><li>Kiểm tra lại các tiết học trong tuần trước khi đóng trang Google Calendar.</li></ol><a href="https://calendar.google.com/calendar/u/0/r/settings/export" target="_blank" rel="noreferrer">Mở trang Nhập và xuất của Google Calendar ↗</a><small>Hệ thống không tự chuyển trang. Bạn chủ động mở đường dẫn khi sẵn sàng.</small></div><div className="modal-actions"><button type="button" className="primary-btn modal-submit" onClick={() => setScheduleGoogleGuideOpen(false)}>Đã hiểu</button></div></section></div> : null}

      {eLearningCreateTypeOpen ? <div className="modal-backdrop class-elearning-create-type-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setELearningCreateTypeOpen(false); }}><section className="class-elearning-create-type-modal"><header><div><span>E-learning</span><h2>Chọn loại bài đăng</h2><p>Bài mới được preset quyền truy cập cho lớp {selectedClass?.name || 'hiện tại'}.</p></div><button type="button" onClick={() => setELearningCreateTypeOpen(false)} aria-label="Đóng">×</button></header><div className="class-elearning-create-type-grid"><button type="button" onClick={() => openClassELearningCreateForm('video')}><i>▶</i><strong>Video bài học</strong><span>YouTube, Lumi hoặc MP4 và danh sách bài.</span></button><button type="button" onClick={() => openClassELearningCreateForm('document')}><i>▤</i><strong>Tài liệu</strong><span>Soạn trực tiếp, Word/PDF hoặc ảnh tài liệu.</span></button><button type="button" onClick={() => openClassELearningCreateForm('simulation')}><i>✦</i><strong>Mô phỏng</strong><span>Nhúng mô phỏng hoặc tạo nội dung tương tác bằng code.</span></button></div></section></div> : null}

      {eLearningCreateOpen ? <CourseFormModal form={eLearningCreateForm} setForm={setELearningCreateForm} editingCourse={null} contentType={eLearningCreateType} teacherClasses={classes.map((item) => item.name || item.className || '').filter(Boolean)} participatingClasses={classes} uploadingWord={eLearningCreateUploadingWord} uploadingVideo={eLearningCreateUploadingVideo} uploadingImage={eLearningCreateUploadingImage} lessonsRef={eLearningCreateLessonsRef} publisherName={eLearningPublisherName} onClose={() => { if (!eLearningCreatePublishing) setELearningCreateOpen(false); }} onReset={resetClassELearningCreateForm} onSubmit={publishClassELearningCourse} onWordUpload={handleClassELearningWordUpload} onVideoUpload={handleClassELearningVideoUpload} onImageUpload={handleClassELearningImageUpload} /> : null}
      <style>{styles}</style>
    </main>
  );
}

export default TeacherClasses;

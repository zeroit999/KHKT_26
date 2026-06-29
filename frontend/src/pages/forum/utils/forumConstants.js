import {
  Bell,
  BarChart3,
  Home,
  Megaphone,
  MessageSquare,
  TrendingUp,
  Zap,
} from 'lucide-react'

export const SECTIONS = {
  HALL: 'hall',
  CLASSES: 'classes',
  GROUPS: 'groups',
  MY_POSTS: 'my-posts',
  SAVED: 'saved',
  NOTIFICATIONS: 'notifications',
  ADMIN_REVIEW: 'admin-review',
}

export const POST_TYPES = [
  { value: 'question', label: 'Hỏi đáp', icon: MessageSquare, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200' },
  { value: 'discuss', label: 'Thảo luận', icon: TrendingUp, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' },
  { value: 'announce', label: 'Thông báo', icon: Megaphone, color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200' },
  { value: 'event', label: 'Sự kiện', icon: Bell, color: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200' },
  { value: 'poll', label: 'Bình chọn', icon: BarChart3, color: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-200' },
]

export const FILTER_TABS = [
  { value: 'all', label: 'Tất cả', icon: Home },
  { value: 'hot', label: 'Nổi bật', icon: Zap },
  { value: 'question', label: 'Hỏi đáp', icon: MessageSquare },
  { value: 'discuss', label: 'Thảo luận', icon: TrendingUp },
  { value: 'announce', label: 'Thông báo', icon: Megaphone },
  { value: 'event', label: 'Sự kiện', icon: Bell },
  { value: 'poll', label: 'Bình chọn', icon: BarChart3 },
]

export const DEFAULT_GROUPS = []

export const MAX_GROUPS_PER_USER = 3

export const REACTIONS = [
  { value: 'like', label: 'Thích', emoji: '👍', color: 'text-sky-500' },
  { value: 'love', label: 'Yêu thích', emoji: '❤️', color: 'text-rose-500' },
  { value: 'haha', label: 'Haha', emoji: '😆', color: 'text-amber-500' },
  { value: 'wow', label: 'Wow', emoji: '😮', color: 'text-yellow-500' },
  { value: 'sad', label: 'Buồn', emoji: '😢', color: 'text-blue-400' },
  { value: 'angry', label: 'Phẫn nộ', emoji: '😡', color: 'text-orange-600' },
]

export const VISIBLE_REACTIONS = REACTIONS.slice(0, 5)

export const REPORT_REASONS = [
  'Nội dung quấy rối hoặc xúc phạm',
  'Spam, quảng cáo hoặc lừa đảo',
  'Thông tin sai lệch',
  'Nội dung bạo lực hoặc gây hại',
  'Nội dung không phù hợp với cộng đồng học tập',
  'Khác',
]

export const roleText = {
  admin_dev: 'Quản trị viên',
  admin: 'Admin',
  teacher: 'Giáo viên',
  student: 'Học sinh',
}

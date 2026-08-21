import GroupModal from './components/GroupModal'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import {
  Bell,
  BarChart3,
  CheckCircle2,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  Eye,
  FileText,
  Flag,
  Globe2,
  Heart,
  Home,
  ImagePlus,
  Loader2,
  LockKeyhole,
  Megaphone,
  Menu,
  MessageCircle,
  MessageSquare,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelRightOpen,
  Plus,
  Search,
  Send,
  Share2,
  Settings,
  ShieldCheck,
  Star,
  Sun,
  Trash2,
  TrendingUp,
  Users,
  UserX,
  ShieldBan,
  X,
  Zap,
  ChevronDown,
  Bold,
  Italic,
  Underline,
  Link2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  UploadCloud,
  UserRoundX,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

import { auth, db } from '../../components/firebase'
import useSyncedDarkMode from '../../hooks/common/useSyncedDarkMode'
import DiscordGroupsLayout from './groups/DiscordGroupsLayout'

const SECTIONS = {
  HALL: 'hall',
  GROUPS: 'groups',
  MY_POSTS: 'my-posts',
  SAVED: 'saved',
  NOTIFICATIONS: 'notifications',
  ACCOUNT: 'account',
  ADMIN_REVIEW: 'admin-review',
}
const POST_TYPES = [
  { value: 'question', label: 'Hỏi đáp', icon: MessageSquare, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200' },
  { value: 'discuss', label: 'Thảo luận', icon: TrendingUp, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' },
  { value: 'announce', label: 'Thông báo', icon: Megaphone, color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200' },
  { value: 'event', label: 'Sự kiện', icon: Bell, color: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200' },
  { value: 'poll', label: 'Bình chọn', icon: BarChart3, color: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-blue-500/15 dark:text-fuchsia-200' },
]

const FILTER_TABS = [
  { value: 'all', label: 'Tất cả', icon: Home },
  { value: 'hot', label: 'Nổi bật', icon: Zap },
  { value: 'question', label: 'Hỏi đáp', icon: MessageSquare },
  { value: 'discuss', label: 'Thảo luận', icon: TrendingUp },
  { value: 'announce', label: 'Thông báo', icon: Megaphone },
  { value: 'event', label: 'Sự kiện', icon: Bell },
  { value: 'poll', label: 'Bình chọn', icon: BarChart3 },
]

const DEFAULT_GROUPS = []

const MAX_GROUPS_PER_USER = 3

const generateGroupCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let code = ''
  for (let index = 0; index < 7; index += 1) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

const generateInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let prefix = ''
  for (let index = 0; index < 6; index += 1) {
    prefix += chars[Math.floor(Math.random() * chars.length)]
  }
  let suffix = ''
  for (let index = 0; index < 4; index += 1) {
    suffix += Math.floor(Math.random() * 10)
  }
  return `${prefix}_${suffix}`
}

const normalizeGroupCode = (value = '') => String(value || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 7)

const REACTIONS = [
  { value: 'like', label: 'Thích', emoji: '👍', color: 'text-sky-500' },
  { value: 'love', label: 'Yêu thích', emoji: '❤️', color: 'text-rose-500' },
  { value: 'haha', label: 'Haha', emoji: '😆', color: 'text-amber-500' },
  { value: 'wow', label: 'Wow', emoji: '😮', color: 'text-yellow-500' },
  { value: 'sad', label: 'Buồn', emoji: '😢', color: 'text-blue-400' },
  { value: 'angry', label: 'Phẫn nộ', emoji: '😡', color: 'text-orange-600' },
]

// Chỉ hiện 5 emotion theo yêu cầu. Dữ liệu cũ vẫn giữ đủ 6 loại nếu đã từng có angry.
const VISIBLE_REACTIONS = REACTIONS.slice(0, 5)

const REPORT_REASONS = [
  'Nội dung quấy rối hoặc xúc phạm',
  'Spam, quảng cáo hoặc lừa đảo',
  'Thông tin sai lệch',
  'Nội dung bạo lực hoặc gây hại',
  'Nội dung không phù hợp với cộng đồng học tập',
  'Khác',
]

const GROUP_REPORT_REASONS = [
  'Nội dung không phù hợp',
  'Spam hoặc quảng cáo',
  'Lừa đảo hoặc giả mạo',
  'Ngôn từ xúc phạm / quấy rối',
  'Chia sẻ tài liệu vi phạm',
  'Nhóm hoạt động sai mục đích',
  'Khác',
]

const GROUP_DELETE_REASONS = [
  'Nhóm vi phạm tiêu chuẩn cộng đồng',
  'Spam hoặc quảng cáo',
  'Nội dung không phù hợp',
  'Lừa đảo hoặc giả mạo',
  'Nhóm hoạt động sai mục đích',
  'Vi phạm quy định học tập',
  'Khác',
]

const GROUP_WARNING_TEMPLATES = [
  'Nhóm của bạn đã bị báo cáo vì nội dung không phù hợp. Vui lòng kiểm tra và điều chỉnh hoạt động nhóm.',
  'Nhóm có dấu hiệu spam hoặc quảng cáo. Vui lòng xử lý để tránh bị xóa.',
  'Nhóm hoạt động sai mục đích so với mô tả ban đầu. Vui lòng cập nhật hoặc điều chỉnh nội dung.',
]

const getReactionSummary = (reactions = {}, reactionCounts = {}) => {
  const counts = { ...(reactionCounts || {}) }

  Object.values(reactions || {}).forEach((value) => {
    if (!value) return
    if (!counts[value]) counts[value] = 0
  })

  const items = REACTIONS
    .map((reaction) => ({ ...reaction, count: Number(counts[reaction.value] || 0) }))
    .filter((reaction) => reaction.count > 0)

  const total = items.reduce((sum, item) => sum + item.count, 0)

  return { items, total }
}

const getUserReaction = (target = {}, userId = '') => {
  if (!userId) return ''
  const reactions = target.reactions || {}
  if (reactions[userId]) return reactions[userId]
  if ((target.likedBy || []).includes(userId)) return 'love'
  return ''
}

const buildReactionCounts = (reactions = {}) => {
  const counts = {}
  Object.values(reactions || {}).forEach((value) => {
    if (!value) return
    counts[value] = Number(counts[value] || 0) + 1
  })
  return counts
}

const isDeletedPostNotification = (type = '') => ['post-deleted', 'admin-delete-post', 'post-deleted-by-admin'].includes(type)

const getChatMembersText = (item = {}) => {
  const safeItem = item && typeof item === 'object' ? item : {}
  const count = Number(safeItem.membersCount || safeItem.members?.length || safeItem.memberIds?.length || safeItem.students?.length || 0)
  return count > 0 ? `${count} thành viên` : 'Kênh trò chuyện'
}



const roleText = {
  teacher: 'Giáo viên',
  admin: 'Quản trị',
  admin_dev: 'Quản trị viên',
  student: 'Học sinh',
}

const getRoleKey = (role = '') => {
  const raw = String(role || '').trim().toLowerCase()
  const value = raw.replace(/[\s_-]/g, '')
  if (raw.includes('admin_dev') || raw.includes('admin-dev') || value.includes('admindev')) return 'admin_dev'
  if (value.includes('admin')) return 'admin'
  if (value.includes('teacher') || value.includes('giaovien') || value.includes('giáoviên')) return 'teacher'
  return 'student'
}

const getInitials = (name = '', email = '') => {
  const source = String(name || email || 'User').trim()
  const clean = source.includes('@') ? source.split('@')[0] : source
  const parts = clean.split(/\s+/).filter(Boolean)
  if (!parts.length) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

const timestampToMs = (value) => {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

const formatRelativeTime = (value) => {
  const ms = timestampToMs(value)
  if (!ms) return 'Vừa xong'
  const diff = Date.now() - ms
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return 'Vừa xong'
  if (diff < hour) return `${Math.floor(diff / minute)} phút trước`
  if (diff < day) return `${Math.floor(diff / hour)} giờ trước`
  if (diff < day * 7) return `${Math.floor(diff / day)} ngày trước`
  return new Date(ms).toLocaleDateString('vi-VN')
}

const formatEventDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const formatEventDateTime = (value) => {
  const ms = timestampToMs(value)
  if (!ms) return ''
  return new Date(ms).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

const isAdminAuthor = (value = '') => ['admin', 'admin_dev'].includes(String(value || '').trim())

const getEventStartMs = (post = {}) => {
  return timestampToMs(post?.eventStartAt || post?.eventDate)
}

const getEventEndMs = (post = {}) => {
  return timestampToMs(post?.eventEndAt || post?.eventCloseAt || post?.eventDate)
}

const hasEventStarted = (post = {}) => {
  const startMs = getEventStartMs(post)
  return Boolean(startMs && startMs <= Date.now())
}

const hasEventEnded = (post = {}) => {
  const endMs = timestampToMs(post?.eventEndAt || post?.eventCloseAt)
  return Boolean(endMs && endMs <= Date.now())
}

const getPollStartMs = (post = {}) => timestampToMs(post?.pollStartAt)
const getPollEndMs = (post = {}) => timestampToMs(post?.pollEndAt)

const getPollStatus = (post = {}, nowMs = Date.now()) => {
  const startMs = getPollStartMs(post)
  const endMs = getPollEndMs(post)

  if (startMs && nowMs < startMs) return 'not-started'
  if (endMs && nowMs > endMs) return 'ended'
  return 'open'
}

const getPollStatusText = (status = 'open') => {
  if (status === 'not-started') return 'Chưa mở'
  if (status === 'ended') return 'Đã kết thúc'
  return 'Đang mở'
}

const showConfirmPopup = ({ title, message, confirmText = 'Xác nhận', danger = false, onConfirm }) => {
  toast.dismiss('forum-confirm-popup')
  toast.custom((t) => (
    <div className="fixed inset-0 z-[9999] flex cursor-pointer items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onMouseDown={() => toast.dismiss(t.id)}>
      <div className="w-[min(92vw,430px)] cursor-default rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-950 dark:text-white">{title}</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">{message}</p>
          </div>
          <button type="button" onClick={() => toast.dismiss(t.id)} className="cursor-pointer rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Đóng">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => toast.dismiss(t.id)} className="cursor-pointer rounded-xl px-4 py-2 text-sm font-black text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">Hủy</button>
          <button type="button" onClick={() => { toast.dismiss(t.id); onConfirm?.() }} className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-black text-white transition ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{confirmText}</button>
        </div>
      </div>
    </div>
  ), { id: 'forum-confirm-popup', duration: Infinity })
}

const showSharePopup = (link) => {
  toast.dismiss('forum-share-popup')
  toast.custom((t) => (
    <div className="fixed inset-0 z-[9999] flex cursor-pointer items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onMouseDown={() => toast.dismiss(t.id)}>
      <div className="w-[min(92vw,460px)] cursor-default rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-950 dark:text-white">Chia sẻ bài viết</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-300">Sao chép liên kết bên dưới để gửi cho người khác.</p>
          </div>
          <button type="button" onClick={() => toast.dismiss(t.id)} className="cursor-pointer rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Đóng">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5">
          <input readOnly value={link} className="min-w-0 flex-1 bg-transparent px-2 text-sm font-semibold text-slate-700 outline-none dark:text-slate-200" />
          <button type="button" onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success('Người dùng đã được copy link đó'))} className="cursor-pointer rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-700">Copy</button>
        </div>
        <button type="button" onClick={() => toast.dismiss(t.id)} className="mt-4 w-full cursor-pointer rounded-xl px-4 py-2 text-sm font-black text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">Đóng</button>
      </div>
    </div>
  ), { id: 'forum-share-popup', duration: Infinity })
}



const sanitizeRichHtml = (value = '') => {
  const source = String(value || '')
  if (typeof window === 'undefined' || !source.includes('<')) return source
  const doc = new DOMParser().parseFromString(source, 'text/html')
  const allowedTags = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'A', 'P', 'DIV', 'BR', 'SPAN'])
  doc.body.querySelectorAll('*').forEach((node) => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...node.childNodes)
      return
    }
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      if (node.tagName === 'A' && ['href', 'target', 'rel'].includes(name)) return
      if (name === 'style') {
        const textAlign = node.style.textAlign
        node.removeAttribute('style')
        if (['left', 'center', 'right'].includes(textAlign)) node.style.textAlign = textAlign
        return
      }
      node.removeAttribute(attribute.name)
    })
    if (node.tagName === 'A') {
      const href = String(node.getAttribute('href') || '').trim()
      if (!/^(https?:\/\/|\/|#)/i.test(href)) node.removeAttribute('href')
      node.setAttribute('rel', 'noopener noreferrer')
    }
  })
  return doc.body.innerHTML
}

const stripRichHtml = (value = '') => {
  const source = String(value || '')
  if (typeof window === 'undefined') return source.replace(/<[^>]*>/g, ' ')
  const doc = new DOMParser().parseFromString(source, 'text/html')
  return doc.body.textContent || ''
}

const isInternalForumLink = (href = '') => {
  try {
    const url = new URL(href, window.location.origin)
    return url.origin === window.location.origin
  } catch {
    return false
  }
}

function ExternalLinkWarning({ href, onClose }) {
  if (!href || typeof document === 'undefined') return null

  const continueToExternalSite = () => {
    const target = href
    onClose()
    window.open(target, '_blank', 'noopener,noreferrer')
  }

  return createPortal(
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md" onMouseDown={onClose}>
      <div className="w-full max-w-md rounded-3xl border border-amber-300/40 bg-white p-6 shadow-2xl dark:border-amber-300/20 dark:bg-slate-900" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-200"><AlertTriangle className="h-6 w-6" /></div>
        <h3 className="mt-4 text-xl font-black text-slate-950 dark:text-white">Bạn đang rời khỏi ZUNY</h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">Liên kết này dẫn tới một website bên ngoài. Hãy đề phòng các đường dẫn nguy hiểm trước khi tiếp tục.</p>
        <p className="mt-3 break-all rounded-2xl bg-slate-100 px-4 py-3 text-xs font-bold text-blue-600 dark:bg-white/5 dark:text-blue-300">{href}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-black text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">Hủy</button>
          <button type="button" onClick={continueToExternalSite} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700">Tiếp tục <ExternalLink className="h-4 w-4" /></button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function RichPostContent({ content = '', clamp = false }) {
  const [externalHref, setExternalHref] = useState('')
  const html = sanitizeRichHtml(content)
  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(html)
  if (!hasHtml) return <p className={`${clamp ? 'line-clamp-3' : ''} mt-3 whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300`}>{content}</p>
  return (
    <>
      <div
        className={`${clamp ? 'line-clamp-3' : ''} mt-3 break-words text-sm font-semibold leading-7 text-slate-600 [overflow-wrap:anywhere] dark:text-slate-300 [&_a]:font-black [&_a]:text-blue-600 [&_a]:underline [&_a]:decoration-blue-400/50 [&_a]:underline-offset-2 dark:[&_a]:text-cyan-300`}
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={(event) => {
          const anchor = event.target.closest?.('a')
          if (!anchor) return
          event.preventDefault()
          event.stopPropagation()
          const href = anchor.getAttribute('href') || ''
          if (!href) return
          if (isInternalForumLink(href)) window.location.href = new URL(href, window.location.origin).href
          else setExternalHref(new URL(href, window.location.origin).href)
        }}
      />
      <ExternalLinkWarning href={externalHref} onClose={() => setExternalHref('')} />
    </>
  )
}

function RestrictionNoticeModal({ modal, onClose }) {
  if (!modal) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="relative w-[min(92vw,440px)] rounded-3xl border border-rose-200 bg-white p-6 shadow-2xl dark:border-rose-400/20 dark:bg-slate-900" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Đóng">
          <X className="h-5 w-5" />
        </button>

        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-200">
          <ShieldBan className="h-7 w-7" />
        </div>
        <h3 className="mt-5 pr-10 text-xl font-black text-slate-950 dark:text-white">{modal.title || 'Tài khoản đã bị giới hạn'}</h3>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{modal.message}</p>
        {modal.reason && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-400/20 dark:bg-rose-500/10">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-rose-500 dark:text-rose-300">Lý do</p>
            <p className="mt-1 text-sm font-bold leading-6 text-rose-700 dark:text-rose-100">{modal.reason}</p>
          </div>
        )}
        <button type="button" onClick={onClose} className="mt-6 w-full rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white transition hover:bg-rose-700">
          Tôi đã hiểu
        </button>
      </div>
    </div>
  )
}

function CenterConfirmModal({ modal, onClose }) {
  if (!modal) return null

  const runConfirm = () => {
    onClose()
    modal.onConfirm?.()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex cursor-pointer items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="relative w-[min(92vw,430px)] cursor-default rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute right-4 top-4 cursor-pointer rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Đóng">
          <X className="h-5 w-5" />
        </button>

        <h3 className="pr-10 text-xl font-black text-slate-950 dark:text-white">{modal.title}</h3>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">{modal.message}</p>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-xl px-4 py-2 text-sm font-black text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
            Hủy
          </button>
          <button type="button" onClick={runConfirm} className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-black text-white transition ${modal.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {modal.confirmText || 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AdminReasonConfirmModal({ modal, onClose }) {
  const [reason, setReason] = useState('')
  const [selectedOption, setSelectedOption] = useState('')

  useEffect(() => {
    if (modal) {
      setReason('')
      setSelectedOption('')
    }
  }, [modal])

  if (!modal) return null

  const runConfirm = () => {
    const safeReason = [selectedOption, reason.trim()].filter(Boolean).join(selectedOption && reason.trim() ? ' - ' : '')

    if (modal.requireReason && !safeReason) {
      toast.error('Vui lòng chọn hoặc nhập lý do trước khi xác nhận')
      return
    }

    onClose()
    modal.onConfirm?.(safeReason)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex cursor-pointer items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="relative w-[min(92vw,470px)] cursor-default rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute right-4 top-4 cursor-pointer rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Đóng">
          <X className="h-5 w-5" />
        </button>

        <h3 className="pr-10 text-xl font-black text-slate-950 dark:text-white">{modal.title}</h3>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">{modal.message}</p>

        {Array.isArray(modal.options) && modal.options.length > 0 && (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {modal.options.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSelectedOption(item)}
                className={`rounded-2xl border px-3 py-2 text-left text-xs font-black transition ${selectedOption === item ? 'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200' : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'}`}
              >
                {item}
              </button>
            ))}
          </div>
        )}

        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          placeholder={modal.placeholder || 'Nhập lời giải thích...'}
          className="mt-5 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
        />

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-xl px-4 py-2 text-sm font-black text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
            Hủy
          </button>
          <button type="button" onClick={runConfirm} className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-black text-white transition ${modal.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {modal.confirmText || 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CenterShareModal({ link, onClose }) {
  if (!link) return null

  const copyLink = async () => {
    try {
      await navigator.clipboard?.writeText(link)
      toast.success('Người dùng đã được copy link đó')
    } catch (error) {
      toast.error('Không thể copy link')
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex cursor-pointer items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="relative w-[min(92vw,460px)] cursor-default rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute right-4 top-4 cursor-pointer rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Đóng">
          <X className="h-5 w-5" />
        </button>

        <h3 className="pr-10 text-xl font-black text-slate-950 dark:text-white">Chia sẻ bài viết</h3>
        <p className="mt-3 text-sm font-semibold text-slate-500 dark:text-slate-300">Sao chép liên kết bên dưới để gửi cho người khác.</p>

        <div className="mt-5 flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5">
          <input readOnly value={link} className="min-w-0 flex-1 bg-transparent px-2 text-sm font-semibold text-slate-700 outline-none dark:text-slate-200" />
          <button type="button" onClick={copyLink} className="cursor-pointer rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-700">
            Copy
          </button>
        </div>

        <button type="button" onClick={onClose} className="mt-4 w-full cursor-pointer rounded-xl px-4 py-2 text-sm font-black text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
          Đóng
        </button>
      </div>
    </div>
  )
}


const normalizeText = (value = '') => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const gradeRank = (value = '') => {
  const text = normalizeText(value)
  if (!text || text === 'none' || text === 'khong' || text === 'khong gioi han') return 999
  if (text.includes('teacher') || text.includes('giao vien')) return 40
  if (text.includes('12')) return 30
  if (text.includes('11')) return 20
  if (text.includes('10')) return 10
  return 0
}

const getInviteExpiryMs = (value = 'unlimited') => {
  if (value === '1d') return 24 * 60 * 60 * 1000
  if (value === '7d') return 7 * 24 * 60 * 60 * 1000
  if (value === '30d') return 30 * 24 * 60 * 60 * 1000
  return 0
}

const showGroupCreatedPopup = ({ groupCode = '', inviteCode = '', onEnter = () => {} }) => {
  toast.dismiss('forum-group-created')
  const copyText = async (value, label) => {
    try {
      await navigator.clipboard?.writeText(value)
      toast.success(`Đã copy ${label}`)
    } catch {
      toast.error('Không thể copy')
    }
  }
  toast.custom((t) => (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" onMouseDown={() => toast.dismiss(t.id)}>
      <div className="w-[min(92vw,440px)] rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900" onMouseDown={(event) => event.stopPropagation()}>
        <h3 className="text-2xl font-black text-slate-950 dark:text-white">Tạo thành công</h3>
        <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-300">Bạn có thể copy mã hoặc vào nhóm ngay.</p>
        <div className="mt-5 grid gap-2">
          <button type="button" onClick={() => copyText(groupCode, 'mã nhóm')} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">Copy mã nhóm</button>
          <button type="button" disabled={!inviteCode} onClick={() => copyText(inviteCode, 'mã mời')} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">Copy mã mời</button>
          <button type="button" onClick={() => { toast.dismiss(t.id); onEnter() }} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700">Vào nhóm ngay</button>
        </div>
      </div>
    </div>
  ), { id: 'forum-group-created', duration: Infinity })
}

function Forum({ onChannelViewChange = () => {} }) {
  const navigate = useNavigate()
  const syncedDark = useSyncedDarkMode()
  const [manualDark, setManualDark] = useState(null)
  const dark = manualDark ?? syncedDark
  const [currentUser, setCurrentUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [userProfiles, setUserProfiles] = useState({})
  const [profilePopup, setProfilePopup] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [posts, setPosts] = useState([])
  const [savedPosts, setSavedPosts] = useState([])
  const [groups, setGroups] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [activeSection, setActiveSection] = useState(SECTIONS.HALL)
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [myPostStatusFilter, setMyPostStatusFilter] = useState('all')
  const [notificationFilter, setNotificationFilter] = useState('all')
  const [accountTab, setAccountTab] = useState('my-posts')
  const [search, setSearch] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [selectedPost, setSelectedPost] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [groupChannelOpen, setGroupChannelOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [confirmModal, setConfirmModal] = useState(null)
  const [shareModal, setShareModal] = useState(null)
  const [createdGroupPopup, setCreatedGroupPopup] = useState(null)
  const [notificationModal, setNotificationModal] = useState(null)
  const [adminReasonModal, setAdminReasonModal] = useState(null)
  const [restrictionModal, setRestrictionModal] = useState(null)
  const [likingPostIds, setLikingPostIds] = useState([])
  const [viewingPostIds, setViewingPostIds] = useState([])
  const [reports, setReports] = useState([])
  const [groupReports, setGroupReports] = useState([])
  const [adminMainMode, setAdminMainMode] = useState('posts')
  const [adminReviewMode, setAdminReviewMode] = useState('pending')
  const [personalAdminSearch, setPersonalAdminSearch] = useState('')
  const [groupAdminMode, setGroupAdminMode] = useState('stats')
  const [reportModal, setReportModal] = useState(null)
  const [highlightedCommentId, setHighlightedCommentId] = useState('')
  const [selectedGroupChat, setSelectedGroupChat] = useState(null)
  const [openCreatedGroupId, setOpenCreatedGroupId] = useState('')
  const rotatedInviteGroupIdsRef = useRef(new Set())

  const roleKey = getRoleKey(profile?.role || profile?.userRole || profile?.type)
  const displayName = profile?.fullName || profile?.displayName || profile?.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Người dùng ZUNY'
  const initials = getInitials(displayName, currentUser?.email)
  const liveCurrentUserProfile = userProfiles[currentUser?.uid] || profile || {}
  const avatarUrl = liveCurrentUserProfile.photoURL || liveCurrentUserProfile.avatarUrl || liveCurrentUserProfile.avatarURL || liveCurrentUserProfile.avatar || liveCurrentUserProfile.profileImage || currentUser?.photoURL || ''
  const userClass = profile?.className || profile?.class || profile?.lop || profile?.studentClass || ''
  const currentForumRestrictions = userProfiles[currentUser?.uid]?.forumRestrictions || profile?.forumRestrictions || {}

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      setProfileLoading(true)
      if (!user) {
        setProfile(null)
        setProfileLoading(false)
        return
      }

      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        setProfile(userSnap.exists() ? userSnap.data() : null)
      } catch (error) {
        console.error('Không thể tải thông tin người dùng:', error)
        setProfile(null)
      } finally {
        setProfileLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const usersQuery = query(collection(db, 'users'), limit(500))
    const unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        const nextProfiles = {}
        snapshot.docs.forEach((item) => {
          nextProfiles[item.id] = { id: item.id, ...item.data() }
        })
        setUserProfiles(nextProfiles)
      },
      (error) => console.warn('Không thể đồng bộ avatar người dùng:', error),
    )
    return () => unsubscribe()
  }, [])

  const openUserProfile = (user = {}) => {
    if (!user?.uid || user.isAnonymous) return
    const firebaseProfile = userProfiles[user.uid] || {}
    setProfilePopup({
      uid: user.uid,
      name: firebaseProfile.fullName || firebaseProfile.displayName || firebaseProfile.name || user.name || 'Người dùng ZUNY',
      role: getRoleKey(firebaseProfile.role || firebaseProfile.userRole || user.role),
      className: firebaseProfile.className || firebaseProfile.class || firebaseProfile.lop || '',
      avatarUrl: firebaseProfile.photoURL || firebaseProfile.avatarUrl || firebaseProfile.avatarURL || firebaseProfile.avatar || firebaseProfile.profileImage || user.avatarUrl || '',
      initials: getInitials(firebaseProfile.fullName || firebaseProfile.displayName || firebaseProfile.name || user.name),
    })
  }

  useEffect(() => {
    const postsQuery = query(collection(db, 'forumPosts'), orderBy('createdAt', 'desc'), limit(120))
    const unsubscribe = onSnapshot(
      postsQuery,
      (snapshot) => {
        setPosts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
        setLoadingPosts(false)
      },
      (error) => {
        console.error('Không thể tải bài viết cộng đồng:', error)
        toast.error('Không thể tải bài viết cộng đồng')
        setLoadingPosts(false)
      },
    )

    return () => unsubscribe()
  }, [])

  // Đồng bộ realtime riêng cho mục Đã lưu. Listener này không phụ thuộc giới hạn
  // của bảng tin chung, nên bài cũ đã lưu vẫn xuất hiện và cập nhật ngay.
  useEffect(() => {
    if (!currentUser?.uid) {
      setSavedPosts([])
      return undefined
    }

    const savedPostsQuery = query(
      collection(db, 'forumPosts'),
      where('savedBy', 'array-contains', currentUser.uid),
      limit(300),
    )

    const unsubscribe = onSnapshot(
      savedPostsQuery,
      (snapshot) => {
        const nextSavedPosts = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .sort((a, b) => timestampToMs(b.createdAt) - timestampToMs(a.createdAt))
        setSavedPosts(nextSavedPosts)
      },
      (error) => console.warn('Không thể đồng bộ bài đã lưu:', error),
    )

    return () => unsubscribe()
  }, [currentUser?.uid])

  useEffect(() => {
    const groupsQuery = query(collection(db, 'forumGroups'), orderBy('createdAt', 'desc'), limit(80))
    const unsubscribe = onSnapshot(
      groupsQuery,
      (snapshot) => setGroups(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (error) => console.warn('Không thể tải nhóm:', error),
    )

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const now = Date.now()
    groups.forEach((group) => {
      const groupType = group.groupType || (group.isPrivate ? 'private' : 'public')
      const expiresAt = Number(group.inviteCodeExpiresAtMs || 0)
      if (groupType !== 'invite_only' || !expiresAt || expiresAt > now || rotatedInviteGroupIdsRef.current.has(group.id)) return
      rotatedInviteGroupIdsRef.current.add(group.id)
      const expiryMs = getInviteExpiryMs(group.inviteExpiry || 'unlimited')
      updateDoc(doc(db, 'forumGroups', group.id), {
        inviteCode: generateInviteCode(),
        inviteCodeIssuedAtMs: now,
        inviteCodeExpiresAtMs: expiryMs ? now + expiryMs : 0,
        updatedAt: serverTimestamp(),
      }).catch((error) => console.warn('Không thể tự đổi mã mời đã hết hạn:', error))
    })
  }, [groups])


  useEffect(() => {
    if (!currentUser?.uid) {
      setNotifications([])
      return undefined
    }

    const notificationsQuery = query(
      collection(db, 'forumNotifications'),
      where('toUserId', '==', currentUser.uid),
      limit(30),
    )

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const joinedGroupIds = new Set(
          groups
            .filter((group) => {
              const membershipLists = [
                group?.memberIds,
                group?.members,
                group?.userIds,
                group?.joinedUsers,
                group?.participants,
                group?.studentIds,
                group?.students,
                group?.adminIds,
                group?.admins,
              ]

              const matchesCurrentUser = (value) => {
                if (typeof value === 'string') return value === currentUser.uid
                if (!value || typeof value !== 'object') return false
                return value.uid === currentUser.uid || value.id === currentUser.uid || value.userId === currentUser.uid
              }

              return (
                group?.ownerId === currentUser.uid ||
                group?.createdBy === currentUser.uid ||
                membershipLists.some((list) => Array.isArray(list) && list.some(matchesCurrentUser))
              )
            })
            .map((group) => group.id),
        )

        const notificationsForCurrentMemberships = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .filter((item) => {
            const hiddenGroupTypes = new Set(['member-left', 'group-left', 'left-group', 'user-left-group'])
            if (hiddenGroupTypes.has(String(item.type || '').toLowerCase())) return false
            if (item.scope !== 'group' || !item.groupId) return true

            // Chỉ giữ thông báo nhóm bị xóa; mọi thông báo khác của nhóm đã rời đều bị loại ngay.
            if (item.type === 'group-deleted-by-admin') return true

            return joinedGroupIds.has(item.groupId)
          })
          .sort((a, b) => timestampToMs(b.createdAt) - timestampToMs(a.createdAt))

        setNotifications(notificationsForCurrentMemberships)
      },
      (error) => console.warn('Không thể tải thông báo:', error),
    )

    return () => unsubscribe()
  }, [currentUser?.uid, groups])

  useEffect(() => {
    if (!posts.length) return

    let cancelled = false

    const getEventTargetUserIds = async (post = {}) => {
      const isAdminEvent = Boolean(post.eventCreatedByAdmin || post.authorRole === 'admin_dev')

      if (isAdminEvent) {
        const usersSnapshot = await getDocs(collection(db, 'users'))
        return usersSnapshot.docs.map((userDoc) => userDoc.id)
      }

      const interestedIds = Array.isArray(post.eventInterestedBy) ? post.eventInterestedBy : []
      const notInterestedIds = new Set(post.eventNotInterestedBy || [])
      return interestedIds.filter((uid) => uid && !notInterestedIds.has(uid))
    }

    const sendEventNotifications = async ({ post, kind }) => {
      const targetUserIds = await getEventTargetUserIds(post)
      const uniqueTargetUserIds = [...new Set(targetUserIds)].filter(Boolean)
      if (!uniqueTargetUserIds.length || cancelled) return

      const isAdminEvent = Boolean(post.eventCreatedByAdmin || post.authorRole === 'admin_dev')
      const isStart = kind === 'start'

      await Promise.all(
        uniqueTargetUserIds.map((uid) =>
          addDoc(collection(db, 'forumNotifications'), {
            toUserId: uid,
            fromUserId: post.authorId || '',
            fromName: post.authorName || 'ZUNY Community',
            type: isStart ? (isAdminEvent ? 'admin-event-started' : 'event-started') : (isAdminEvent ? 'admin-event-ended' : 'event-ended'),
            category: isAdminEvent ? 'admin' : 'event',
            scope: post.scope || 'hall',
            postId: post.id,
            title: isStart ? 'Sự kiện đã mở' : 'Sự kiện đã kết thúc',
            text: isStart
              ? `Sự kiện "${post.title}" đã mở lúc ${formatEventDateTime(post.eventStartAt || post.eventDate) || 'thời gian đã đặt'}.${post.eventEndAt ? ` Thời gian đóng: ${formatEventDateTime(post.eventEndAt)}.` : ''}${post.eventLocation ? ` Địa điểm/link: ${post.eventLocation}.` : ''}`
              : `Sự kiện "${post.title}" đã kết thúc lúc ${formatEventDateTime(post.eventEndAt || post.eventCloseAt) || 'thời gian đã đặt'}.${post.eventLocation ? ` Địa điểm/link: ${post.eventLocation}.` : ''}`,
            isAdminNotice: isAdminEvent,
            read: false,
            createdAt: serverTimestamp(),
          }),
        ),
      )
    }

    const notifyEventTimeChanges = async () => {
      const dueStartedEvents = posts.filter((post) => {
        if (post.type !== 'event') return false
        if ((post.status || 'approved') !== 'approved') return false
        if (!(post.eventStartAt || post.eventDate) || post.eventStartedNotifiedAt) return false
        return hasEventStarted(post)
      })

      const dueEndedEvents = posts.filter((post) => {
        if (post.type !== 'event') return false
        if ((post.status || 'approved') !== 'approved') return false
        if (!(post.eventEndAt || post.eventCloseAt) || post.eventEndedNotifiedAt) return false
        return hasEventEnded(post)
      })

      for (const post of dueStartedEvents) {
        try {
          const postRef = doc(db, 'forumPosts', post.id)
          const shouldSend = await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(postRef)
            if (!snap.exists()) return false
            const fresh = snap.data()
            if (fresh.eventStartedNotifiedAt) return false
            if (fresh.type !== 'event' || (fresh.status || 'approved') !== 'approved') return false
            if (!hasEventStarted(fresh)) return false

            transaction.update(postRef, {
              eventStartedNotifiedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })

            return true
          })

          if (shouldSend) await sendEventNotifications({ post, kind: 'start' })
        } catch (error) {
          console.warn('Không thể gửi thông báo mở sự kiện:', error)
        }
      }

      for (const post of dueEndedEvents) {
        try {
          const postRef = doc(db, 'forumPosts', post.id)
          const shouldSend = await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(postRef)
            if (!snap.exists()) return false
            const fresh = snap.data()
            if (fresh.eventEndedNotifiedAt) return false
            if (fresh.type !== 'event' || (fresh.status || 'approved') !== 'approved') return false
            if (!hasEventEnded(fresh)) return false

            transaction.update(postRef, {
              eventEndedNotifiedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })

            return true
          })

          if (shouldSend) await sendEventNotifications({ post, kind: 'end' })
        } catch (error) {
          console.warn('Không thể gửi thông báo kết thúc sự kiện:', error)
        }
      }
    }

    notifyEventTimeChanges()

    const interval = window.setInterval(notifyEventTimeChanges, 1000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [posts])

  useEffect(() => {
    if (roleKey !== 'admin_dev') {
      setReports([])
      return undefined
    }

    const reportsQuery = query(collection(db, 'forumReports'), orderBy('createdAt', 'desc'), limit(120))
    const unsubscribe = onSnapshot(
      reportsQuery,
      (snapshot) => setReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (error) => console.warn('Không thể tải bài bị báo cáo:', error),
    )

    return () => unsubscribe()
  }, [roleKey])


  useEffect(() => {
    if (roleKey !== 'admin_dev') {
      setGroupReports([])
      return undefined
    }

    const groupReportsQuery = query(collection(db, 'forumGroupReports'), orderBy('createdAt', 'desc'), limit(160))
    const unsubscribe = onSnapshot(
      groupReportsQuery,
      (snapshot) => setGroupReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (error) => console.warn('Không thể tải nhóm bị báo cáo:', error),
    )

    return () => unsubscribe()
  }, [roleKey])

  useEffect(() => {
    if (!selectedPost?.id) return
    const freshPost = posts.find((post) => post.id === selectedPost.id)
    if (freshPost) setSelectedPost(freshPost)
  }, [posts, selectedPost?.id])

  const joinedGroupIds = useMemo(() => new Set(groups.filter((group) => (group.memberIds || []).includes(currentUser?.uid)).map((group) => group.id)), [groups, currentUser?.uid])


  const filteredPosts = useMemo(() => {
    const keyword = normalizeText(search.trim())
    const accountMode = activeSection === SECTIONS.ACCOUNT ? accountTab : ''
    const realtimeSourcePosts = accountMode === 'saved' || activeSection === SECTIONS.SAVED ? savedPosts : posts

    const nextPosts = realtimeSourcePosts.filter((post) => {

      if (activeSection === SECTIONS.GROUPS) {
        if (post.scope !== 'group') return false
        if (roleKey === 'student' && post.groupId && !joinedGroupIds.has(post.groupId)) return false
      }

if (activeSection === SECTIONS.MY_POSTS || (activeSection === SECTIONS.ACCOUNT && accountTab === 'my-posts')) {
  if (post.authorId !== currentUser?.uid) return false

  const status = post.status || 'approved'

  if (myPostStatusFilter === 'approved' && status !== 'approved') return false
  if (myPostStatusFilter === 'rejected' && status !== 'rejected') return false
}
      if ((activeSection === SECTIONS.SAVED || (activeSection === SECTIONS.ACCOUNT && accountTab === 'saved')) && !(post.savedBy || []).includes(currentUser?.uid)) return false
      if (activeSection === SECTIONS.ADMIN_REVIEW) {
        if (roleKey !== 'admin_dev') return false
        if (adminReviewMode !== 'pending') return false
        if ((post.status || 'approved') !== 'pending') return false
      }

      if ([SECTIONS.HALL, SECTIONS.NOTIFICATIONS].includes(activeSection) && post.scope && post.scope !== 'hall') return false
      if (activeSection === SECTIONS.HALL && (post.status || 'approved') !== 'approved') return false
      if (![SECTIONS.MY_POSTS, SECTIONS.ACCOUNT, SECTIONS.ADMIN_REVIEW].includes(activeSection) && (post.status || 'approved') !== 'approved') return false

if (filter === 'hot') {
  const isAdminPost = ['admin', 'admin_dev'].includes(post.authorRole)
  const hasEnoughLikes = Number(post.likesCount || 0) > 10

  if (!isAdminPost && !hasEnoughLikes) return false
}
      if (!['all', 'hot'].includes(filter) && post.type !== filter) return false

      if (!keyword) return true
      return (
        normalizeText(post.title).includes(keyword) ||
        normalizeText(post.content).includes(keyword) ||
        (post.tags || []).some((tag) => normalizeText(tag).includes(keyword)) ||
        normalizeText(post.authorName).includes(keyword)
      )
    })

    return nextPosts.sort((a, b) => {
      if (sortBy === 'popular') {
        return Number(b.likesCount || 0) + Number(b.commentsCount || 0) * 2 + Number(b.viewsCount || 0) * 0.05 - (Number(a.likesCount || 0) + Number(a.commentsCount || 0) * 2 + Number(a.viewsCount || 0) * 0.05)
      }
      return timestampToMs(b.createdAt) - timestampToMs(a.createdAt)
    })
}, [posts, savedPosts, activeSection, accountTab, currentUser?.uid, filter, search, sortBy, joinedGroupIds, roleKey, userClass, myPostStatusFilter, adminReviewMode])
const filteredNotifications = useMemo(() => {
  return notifications.filter((item) => {
    if (notificationFilter === 'all') return true
    if (notificationFilter === 'hall') return (item.scope || 'hall') === 'hall'
    if (notificationFilter === 'group') return item.scope === 'group'
    if (notificationFilter === 'mine') {
      return ['moderation-approved', 'moderation-rejected', 'comment', 'like', 'reaction', 'event-started', 'admin-event-started', 'event-created'].includes(item.type)
    }
    return true
  })
}, [notifications, notificationFilter])

  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter((item) => !item.read).length
  }, [notifications])

  const pendingReviewCount = useMemo(() => {
    if (roleKey !== 'admin_dev') return 0
    const pendingPosts = posts.filter((post) => (post.status || 'approved') === 'pending').length
    const openReports = reports.filter((report) => (report.status || 'open') === 'open').length
    const openGroupReports = groupReports.filter((report) => (report.status || 'open') === 'open').length
    return pendingPosts + openReports + openGroupReports
  }, [posts, reports, groupReports, roleKey])

  const openNotification = async (item) => {
    setNotificationModal(item)

    if (!item.read) {
      try {
        await updateDoc(doc(db, 'forumNotifications', item.id), {
          read: true,
          readAt: serverTimestamp(),
        })
      } catch (error) {
        console.warn('Không thể đánh dấu thông báo đã đọc:', error)
      }
    }
  }


  const goToNotificationPost = async (item) => {
    if (!item?.postId) {
      toast.error('Thông báo này không liên kết tới bài viết')
      return
    }

    try {
      const existingPost = posts.find((post) => post.id === item.postId)
      if (existingPost) {
        setNotificationModal(null)
        await openPost(existingPost)
        return
      }

      const postSnap = await getDoc(doc(db, 'forumPosts', item.postId))
      if (!postSnap.exists()) {
        toast.error('Bài viết không còn tồn tại')
        return
      }

      setNotificationModal(null)
      await openPost({ id: postSnap.id, ...postSnap.data() })
    } catch (error) {
      console.error('Không thể chuyển hướng tới bài viết:', error)
      toast.error('Không thể mở bài viết từ thông báo')
    }
  }

  const deleteNotification = async (item, reason = '') => {
    try {
      await deleteDoc(doc(db, 'forumNotifications', item.id))
      if (notificationModal?.id === item.id) setNotificationModal(null)
      toast.success('Đã xóa thông báo')
    } catch (error) {
      console.error('Không thể xóa thông báo:', error)
      toast.error('Không thể xóa thông báo')
    }
  }

  const requestDeleteNotification = (item) => {
    if (['admin', 'admin_dev'].includes(roleKey)) {
      setAdminReasonModal({
        title: 'Xóa thông báo?',
        message: 'Bạn đang xóa thông báo với quyền quản trị viên. Vui lòng nhập lý do để dễ kiểm soát thao tác.',
        confirmText: 'Xóa thông báo',
        placeholder: 'Nhập lý do xóa thông báo...',
        danger: true,
        onConfirm: (reason) => deleteNotification(item, reason),
      })
      return
    }

    setConfirmModal({
      title: 'Xóa thông báo?',
      message: 'Bạn có chắc chắn muốn xóa thông báo này không?',
      confirmText: 'Xóa',
      danger: true,
      onConfirm: () => deleteNotification(item),
    })
  }

  const markAllNotificationsRead = async () => {
    const unreadItems = filteredNotifications.filter((item) => !item.read)
    if (!unreadItems.length) {
      toast.success('Không có thông báo chưa đọc')
      return
    }

    try {
      await Promise.all(
        unreadItems.map((item) =>
          updateDoc(doc(db, 'forumNotifications', item.id), {
            read: true,
            readAt: serverTimestamp(),
          }),
        ),
      )
      toast.success('Đã đánh dấu tất cả là đã đọc')
    } catch (error) {
      console.error('Không thể đánh dấu tất cả thông báo:', error)
      toast.error('Không thể đánh dấu tất cả thông báo')
    }
  }

  const confirmDeleteAllNotifications = () => {
    if (!filteredNotifications.length) {
      toast.error('Không có thông báo để xóa')
      return
    }

    setConfirmModal({
      title: 'Xóa tất cả thông báo?',
      message: 'Bạn có chắc chắn muốn xóa tất cả thông báo đang hiển thị không? Hành động này không thể hoàn tác.',
      confirmText: 'Xóa hết',
      danger: true,
      onConfirm: async () => {
        try {
          await Promise.all(
            filteredNotifications.map((item) =>
              deleteDoc(doc(db, 'forumNotifications', item.id)),
            ),
          )
          setNotificationModal(null)
          toast.success('Đã xóa tất cả thông báo')
        } catch (error) {
          console.error('Không thể xóa tất cả thông báo:', error)
          toast.error('Không thể xóa tất cả thông báo')
        }
      },
    })
  }

  const stats = useMemo(() => {
    const approvedPosts = posts.filter((post) => (post.status || 'approved') === 'approved')

    return {
      postCount: approvedPosts.length,
      todayCount: approvedPosts.filter((post) => new Date(timestampToMs(post.createdAt)).toDateString() === new Date().toDateString()).length,
      memberCount: Object.keys(userProfiles).length,
      groupCount: groups.filter((group) => !group.isSample).length,
      hotCount: approvedPosts.filter((post) => ['admin', 'admin_dev'].includes(post.authorRole) || Number(post.likesCount || 0) > 10).length,
    }
  }, [posts, userProfiles, groups])

  const openPost = async (post) => {
    setSelectedPost(post)

    if (!currentUser?.uid || !post?.id) return
    if (viewingPostIds.includes(post.id)) return

    setViewingPostIds((prev) => [...prev, post.id])

    try {
      const postRef = doc(db, 'forumPosts', post.id)

      await runTransaction(db, async (transaction) => {
        const postSnap = await transaction.get(postRef)
        if (!postSnap.exists()) return

        const data = postSnap.data()
        const viewedBy = Array.isArray(data.viewedBy) ? data.viewedBy : []

        if (viewedBy.includes(currentUser.uid)) return

        const nextViewedBy = [...viewedBy, currentUser.uid]

        transaction.update(postRef, {
          viewedBy: nextViewedBy,
          viewsCount: nextViewedBy.length,
          updatedAt: serverTimestamp(),
        })
      })
    } catch (error) {
      console.warn('Không thể tăng lượt xem:', error)
    } finally {
      setViewingPostIds((prev) => prev.filter((id) => id !== post.id))
    }
  }


  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const postId = params.get('post')
    const commentId = params.get('comment') || ''

    if (!postId) return undefined

    let cancelled = false
    setHighlightedCommentId(commentId)

    async function openPostFromUrl() {
      try {
        const existingPost = posts.find((item) => item.id === postId)
        if (existingPost) {
          if (!cancelled && selectedPost?.id !== postId) {
            await openPost(existingPost)
          }
          return
        }

        const postSnap = await getDoc(doc(db, 'forumPosts', postId))
        if (!postSnap.exists()) return

        if (!cancelled) {
          await openPost({ id: postSnap.id, ...postSnap.data() })
        }
      } catch (error) {
        console.warn('Không thể mở bài viết từ liên kết:', error)
      }
    }

    openPostFromUrl()
    return () => { cancelled = true }
  }, [posts, selectedPost?.id])

  const clearPostUrlParams = () => {
    if (typeof window === 'undefined') return

    const url = new URL(window.location.href)
    const hadPostParams = url.searchParams.has('post') || url.searchParams.has('comment')

    url.searchParams.delete('post')
    url.searchParams.delete('comment')

    if (hadPostParams) {
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }

  const closeSelectedPost = () => {
    setSelectedPost(null)
    setHighlightedCommentId('')
    clearPostUrlParams()
  }

  const requireLogin = () => {
    if (currentUser?.uid) return true
    toast.error('Bạn cần đăng nhập để dùng cộng đồng')
    return false
  }

  const showRestrictionPopup = (type) => {
    const isPost = type === 'post'
    const blocked = isPost
      ? currentForumRestrictions.blockCommunityPosting
      : currentForumRestrictions.blockGroupCreation

    if (!blocked) return false

    setRestrictionModal({
      title: isPost ? 'Bạn đã bị chặn đăng bài' : 'Bạn đã bị chặn tạo nhóm',
      message: isPost
        ? 'Tài khoản của bạn hiện không được phép tạo bài đăng mới trong cộng đồng ZUNY.'
        : 'Tài khoản của bạn hiện không được phép tạo nhóm học mới trong cộng đồng ZUNY.',
      reason: isPost
        ? currentForumRestrictions.postBlockReason
        : currentForumRestrictions.groupBlockReason,
    })
    return true
  }

  const openComposer = () => {
    if (!requireLogin()) return
    if (showRestrictionPopup('post')) return
    setComposerOpen(true)
  }

  const openGroupCreator = () => {
    if (!requireLogin()) return
    if (showRestrictionPopup('group')) return
    setGroupOpen(true)
  }

  const createPost = async (form) => {
    if (!requireLogin()) return

    if (showRestrictionPopup('post')) {
      setComposerOpen(false)
      return
    }

    if (form.scope === 'group' && form.groupId) {
      const targetGroup = groups.find((item) => item.id === form.groupId)
      const canManageTargetGroup = targetGroup && (targetGroup.ownerId === currentUser.uid || ['admin', 'admin_dev'].includes(roleKey))
      if (!canManageTargetGroup && targetGroup?.permissions?.createPost === false) {
        toast.error('Nhóm này đã tắt quyền tạo bài viết của thành viên')
        return
      }
    }

    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        type: form.type,
        tags: Array.isArray(form.tags) ? form.tags.slice(0, 8) : String(form.tags || '').split(',').map((tag) => tag.trim().replace(/^#+/, '')).filter(Boolean).slice(0, 8),
        scope: form.scope,
        groupId: form.scope === 'group' ? form.groupId : '',
        groupName: form.scope === 'group' ? groups.find((item) => item.id === form.groupId)?.name || '' : '',
        attachmentUrl: String(form.attachmentUrl || '').trim(),
        attachmentName: form.attachmentName || '',
        imageUrl: String(form.imageUrl || '').trim(),
        eventStartAt: form.type === 'event' ? form.eventStartAt || '' : '',
        eventEndAt: form.type === 'event' ? form.eventEndAt || '' : '',
        eventDate: form.type === 'event' ? form.eventStartAt || '' : '',
        eventLocation: form.type === 'event' ? String(form.eventLocation || '').trim() : '',
        eventCreatedByAdmin: form.type === 'event' && roleKey === 'admin_dev',
        eventInterestedBy: [],
        eventNotInterestedBy: [],
        eventStartedNotifiedAt: null,
        eventEndedNotifiedAt: null,
        pollOptions: form.type === 'poll' ? (form.pollOptions || []).map((option, index) => ({ id: `option-${index + 1}`, text: String(option || '').trim() })).filter((option) => option.text).slice(0, 8) : [],
        pollStartAt: form.type === 'poll' ? form.pollStartAt || '' : '',
        pollEndAt: form.type === 'poll' ? form.pollEndAt || '' : '',
        pollVotes: {},
        pollVotesCount: {},
        status: form.scope === 'hall' && roleKey !== 'admin_dev' ? 'pending' : 'approved',
        approvedAt: form.scope === 'hall' && roleKey !== 'admin_dev' ? null : serverTimestamp(),
        approvedBy: form.scope === 'hall' && roleKey !== 'admin_dev' ? '' : currentUser.uid,
        authorId: currentUser.uid,
        authorName: form.isAnonymous ? 'Ẩn danh' : displayName,
        authorEmail: form.isAnonymous ? '' : currentUser.email || '',
        authorInitials: form.isAnonymous ? 'AD' : initials,
        authorPhotoURL: form.isAnonymous ? '' : avatarUrl,
        authorRole: roleKey,
        likesCount: 0,
        reactionsCount: 0,
        reactionCounts: {},
        reactions: {},
        commentsCount: 0,
        viewsCount: 0,
        viewedBy: [],
        likedBy: [],
        savedBy: [],
        isPinned: false,
        isAnonymous: Boolean(form.isAnonymous),
        teacherOnly: Boolean(form.teacherOnly),
        isAnswered: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

const postRef = await addDoc(collection(db, 'forumPosts'), payload)

if (
  payload.scope === 'hall' &&
  payload.status === 'approved' &&
  payload.type === 'announce' &&
  ['admin', 'admin_dev'].includes(roleKey)
) {
  const usersSnapshot = await getDocs(collection(db, 'users'))

  await Promise.all(
    usersSnapshot.docs
      .filter((userDoc) => userDoc.id !== currentUser.uid)
      .map((userDoc) =>
        addDoc(collection(db, 'forumNotifications'), {
          toUserId: userDoc.id,
          fromUserId: currentUser.uid,
          fromName: displayName,
          type: 'admin-announcement',
          category: 'admin',
          scope: 'hall',
          postId: postRef.id,
          title: 'Thông báo từ quản trị viên',
          text: `Quản trị viên vừa đăng thông báo mới: "${payload.title}".`,
          read: false,
          createdAt: serverTimestamp(),
        }),
      ),
  )
}
if (
  payload.scope === 'hall' &&
  payload.status === 'approved' &&
  payload.type === 'event' &&
  roleKey === 'admin_dev'
) {
  const usersSnapshot = await getDocs(collection(db, 'users'))

  await Promise.all(
    usersSnapshot.docs
      .filter((userDoc) => userDoc.id !== currentUser.uid)
      .map((userDoc) =>
        addDoc(collection(db, 'forumNotifications'), {
          toUserId: userDoc.id,
          fromUserId: currentUser.uid,
          fromName: displayName,
          type: 'event-created',
          category: 'admin',
          scope: 'hall',
          isAdminNotice: true,
          postId: postRef.id,
          title: 'Sự kiện nổi bật từ quản trị viên',
          text: `Admin_dev vừa tạo sự kiện mới: "${payload.title}". Sự kiện này đã được ghim nổi bật ở mục Sự kiện sắp tới.`,
          read: false,
          createdAt: serverTimestamp(),
        }),
      ),
  )
}
      setComposerOpen(false)
if (form.scope === 'hall' && roleKey !== 'admin_dev') {
  toast.custom(
    (t) => (
      <button
        type="button"
        onClick={() => toast.dismiss(t.id)}
        className="
          flex w-[360px] items-start gap-3 rounded-3xl border border-amber-200
          bg-white p-4 text-left shadow-2xl transition hover:-translate-y-0.5
          dark:border-amber-400/20 dark:bg-slate-900
        "
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-xl dark:bg-amber-500/15">
          ⏳
        </div>

        <div>
          <p className="font-black text-slate-950 dark:text-white">
            Bài viết đã gửi thành công
          </p>
          <p className="mt-1 text-sm font-semibold leading-5 text-slate-500 dark:text-slate-300">
            Bài của bạn đang trong quá trình quản trị viên duyệt trước khi hiển thị ở cộng đồng ZUNY.
          </p>
        </div>
      </button>
    ),
    {
      duration: 5000,
      position: 'top-center',
    },
  )
} else {
  toast.success('Đã đăng bài lên cộng đồng', {
    duration: 5000,
    position: 'top-center',
  })
}    } catch (error) {
      console.error('Không thể đăng bài:', error)
      toast.error('Không thể đăng bài. Vui lòng thử lại')
    }
  }

  const toggleEventInterest = async (post, interested) => {
    if (!requireLogin()) return
    if (!post?.id || post.type !== 'event') return

    if (isAdminAuthor(post.authorRole) || post.eventCreatedByAdmin) {
      toast.error('Sự kiện của quản trị viên luôn được thông báo cho mọi người')
      return
    }

    try {
      await updateDoc(doc(db, 'forumPosts', post.id), {
        eventInterestedBy: interested ? arrayUnion(currentUser.uid) : arrayRemove(currentUser.uid),
        eventNotInterestedBy: interested ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
        updatedAt: serverTimestamp(),
      })

      toast.success(interested ? 'Đã bật quan tâm sự kiện' : 'Đã tắt quan tâm sự kiện')
    } catch (error) {
      console.error('Không thể cập nhật quan tâm sự kiện:', error)
      toast.error('Không thể cập nhật quan tâm sự kiện')
    }
  }

  const toggleLike = async (post, reactionValue = 'love') => {
    if (!requireLogin()) return
    if (!post?.id) return
    if (likingPostIds.includes(post.id)) return

    setLikingPostIds((prev) => [...prev, post.id])

    try {
      const postRef = doc(db, 'forumPosts', post.id)
      let shouldNotify = false
      let selectedReaction = reactionValue || 'love'

      await runTransaction(db, async (transaction) => {
        const postSnap = await transaction.get(postRef)
        if (!postSnap.exists()) return

        const data = postSnap.data()
        const currentReactions = data.reactions && typeof data.reactions === 'object' ? data.reactions : {}
        const oldReaction = currentReactions[currentUser.uid] || ((data.likedBy || []).includes(currentUser.uid) ? 'love' : '')
        const nextReactions = { ...currentReactions }

        if (oldReaction === selectedReaction) {
          delete nextReactions[currentUser.uid]
          selectedReaction = ''
        } else {
          nextReactions[currentUser.uid] = selectedReaction
        }

        const nextCounts = buildReactionCounts(nextReactions)
        const nextTotal = Object.values(nextCounts).reduce((sum, value) => sum + Number(value || 0), 0)

        shouldNotify = Boolean(selectedReaction) && !oldReaction

        transaction.update(postRef, {
          reactions: nextReactions,
          reactionCounts: nextCounts,
          reactionsCount: nextTotal,
          likesCount: nextTotal,
          likedBy: Object.keys(nextReactions),
          updatedAt: serverTimestamp(),
        })
      })

      if (shouldNotify && post.authorId && post.authorId !== currentUser.uid) {
        const reaction = REACTIONS.find((item) => item.value === selectedReaction)
        await addDoc(collection(db, 'forumNotifications'), {
          toUserId: post.authorId,
          fromUserId: currentUser.uid,
          fromName: displayName,
          type: 'reaction',
          category: 'post-interaction',
          scope: post.scope || 'hall',
          postId: post.id,
          text: `${displayName} đã thả ${reaction?.emoji || '❤️'} vào bài viết của bạn`,
          read: false,
          createdAt: serverTimestamp(),
        })
      }
    } catch (error) {
      console.error('Không thể cập nhật reaction:', error)
      toast.error('Không thể cập nhật cảm xúc')
    } finally {
      setLikingPostIds((prev) => prev.filter((id) => id !== post.id))
    }
  }

  const toggleSave = async (post) => {
    if (!requireLogin()) return
    const saved = (post.savedBy || []).includes(currentUser.uid)
    try {
      await updateDoc(doc(db, 'forumPosts', post.id), {
        savedBy: saved ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
        updatedAt: serverTimestamp(),
      })
      toast.success(saved ? 'Đã bỏ lưu bài viết' : 'Đã lưu bài viết')
    } catch (error) {
      console.error('Không thể lưu bài viết:', error)
      toast.error('Không thể lưu bài viết')
    }
  }

  const votePoll = async (post, optionId) => {
    if (!requireLogin()) return
    if (post.type !== 'poll') return

    const pollStatus = getPollStatus(post)
    if (pollStatus === 'not-started') {
      toast.error('Bình chọn chưa tới thời gian mở')
      return
    }
    if (pollStatus === 'ended') {
      toast.error('Bình chọn đã kết thúc')
      return
    }

    const previousVotes = post.pollVotes || {}
    const previousCounts = post.pollVotesCount || {}
    const oldOptionId = previousVotes[currentUser.uid]

    if (oldOptionId === optionId) {
      toast.error('Bạn đã chọn lựa chọn này rồi')
      return
    }

    const nextVotes = { ...previousVotes, [currentUser.uid]: optionId }
    const nextCounts = { ...previousCounts }

    if (oldOptionId) nextCounts[oldOptionId] = Math.max(0, Number(nextCounts[oldOptionId] || 0) - 1)
    nextCounts[optionId] = Number(nextCounts[optionId] || 0) + 1

    try {
      await updateDoc(doc(db, 'forumPosts', post.id), {
        pollVotes: nextVotes,
        pollVotesCount: nextCounts,
        updatedAt: serverTimestamp(),
      })
      toast.success('Đã ghi nhận bình chọn')
    } catch (error) {
      console.error('Không thể bình chọn:', error)
      toast.error('Không thể bình chọn')
    }
  }


  const notifyAdmins = async ({ type = 'admin-notice', title = '', text = '', payload = {} }) => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const adminDocs = usersSnapshot.docs.filter((userDoc) => {
        const data = userDoc.data() || {}
        const userRole = getRoleKey(data.role || data.userRole || data.type)
        return ['admin', 'admin_dev'].includes(userRole)
      })

      await Promise.all(
        adminDocs.map((userDoc) =>
          addDoc(collection(db, 'forumNotifications'), {
            toUserId: userDoc.id,
            fromUserId: currentUser?.uid || '',
            fromName: displayName || 'ZUNY Community',
            type,
            category: 'admin',
            title,
            text,
            read: false,
            createdAt: serverTimestamp(),
            ...payload,
          }),
        ),
      )
    } catch (error) {
      console.warn('Không thể gửi thông báo cho admin:', error)
    }
  }

  const submitReport = async ({ post, reason, detail }) => {
    if (!requireLogin()) return
    if (!post?.id) return

    try {
      const existing = await getDocs(
        query(
          collection(db, 'forumReports'),
          where('postId', '==', post.id),
          where('reporterId', '==', currentUser.uid),
          limit(1),
        ),
      )

      if (!existing.empty) {
        toast.error('Bạn đã báo cáo bài viết này rồi')
        setReportModal(null)
        return
      }

      await addDoc(collection(db, 'forumReports'), {
        postId: post.id,
        postTitle: post.title || '',
        postContent: post.content || '',
        postAuthorId: post.authorId || '',
        postAuthorName: post.authorName || '',
        reporterId: currentUser.uid,
        reporterName: displayName,
        reporterEmail: currentUser.email || '',
        reason,
        detail: String(detail || '').trim(),
        scope: post.scope || 'hall',
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      await updateDoc(doc(db, 'forumPosts', post.id), {
        reportCount: increment(1),
        reportedBy: arrayUnion(currentUser.uid),
        reportStatus: 'open',
        updatedAt: serverTimestamp(),
      })

      await notifyAdmins({
        type: 'post-reported',
        title: 'Bài đăng bị báo cáo',
        text: `Bài đăng của ${post.authorName || 'người dùng'} vừa bị báo cáo vì: ${reason}`,
        payload: {
          scope: post.scope || 'hall',
          postId: post.id,
          reportReason: reason,
        },
      })

      setReportModal(null)
      toast.success('Đã gửi báo cáo tới quản trị viên')
    } catch (error) {
      console.error('Không thể gửi báo cáo:', error)
      toast.error('Không thể gửi báo cáo')
    }
  }


  const submitGroupReport = async ({ group, reason, detail }) => {
    if (!requireLogin()) return
    if (!group?.id) return

    const safeReason = String(reason || '').trim()
    const safeDetail = String(detail || '').trim()
    if (!safeReason && !safeDetail) {
      toast.error('Vui lòng chọn hoặc nhập lý do báo cáo nhóm')
      return
    }

    try {
      const existing = await getDocs(
        query(
          collection(db, 'forumGroupReports'),
          where('groupId', '==', group.id),
          where('reporterId', '==', currentUser.uid),
          where('status', '==', 'open'),
          limit(1),
        ),
      )

      if (!existing.empty) {
        toast.error('Bạn đã báo cáo nhóm này rồi')
        return
      }

      await addDoc(collection(db, 'forumGroupReports'), {
        groupId: group.id,
        groupName: group.name || 'Nhóm học',
        groupDescription: group.description || '',
        groupOwnerId: group.ownerId || '',
        groupOwnerName: group.ownerName || group.createdByName || '',
        reporterId: currentUser.uid,
        reporterName: displayName,
        reporterEmail: currentUser.email || '',
        reason: safeReason,
        detail: safeDetail,
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      await updateDoc(doc(db, 'forumGroups', group.id), {
        reportCount: increment(1),
        reportedBy: arrayUnion(currentUser.uid),
        reportStatus: 'open',
        updatedAt: serverTimestamp(),
      })

      await notifyAdmins({
        type: 'group-reported',
        title: 'Nhóm học bị báo cáo',
        text: `Nhóm "${group.name || 'Nhóm học'}" vừa bị báo cáo vì: ${safeReason || safeDetail}`,
        payload: {
          scope: 'group',
          groupId: group.id,
          groupName: group.name || 'Nhóm học',
          reportReason: safeReason || safeDetail,
        },
      })

      toast.success('Đã gửi báo cáo nhóm tới quản trị viên')
    } catch (error) {
      console.error('Không thể gửi báo cáo nhóm:', error)
      toast.error('Không thể gửi báo cáo nhóm')
    }
  }

  const removeTemporaryAdminFromGroup = async (groupId) => {
    if (!currentUser?.uid || !groupId) return

    const group = groups.find((item) => item.id === groupId)
    const temporaryAdminIds = Array.isArray(group?.adminTemporaryMemberIds) ? group.adminTemporaryMemberIds : []
    const shouldRemove = temporaryAdminIds.includes(currentUser.uid)

    if (!shouldRemove) return

    try {
      await updateDoc(doc(db, 'forumGroups', groupId), {
        memberIds: arrayRemove(currentUser.uid),
        adminTemporaryMemberIds: arrayRemove(currentUser.uid),
        membersCount: increment(-1),
        updatedAt: serverTimestamp(),
      })

      if (openCreatedGroupId === groupId) setOpenCreatedGroupId('')
      toast.success('Admin đã được đưa ra khỏi nhóm sau khi xử lý')
    } catch (error) {
      console.warn('Không thể đưa admin tạm thời ra khỏi nhóm:', error)
    }
  }

  const adminJoinReportedGroup = async (group) => {
    if (!requireLogin()) return
    if (!['admin', 'admin_dev'].includes(roleKey)) return toast.error('Chỉ quản trị viên mới có quyền này')

    const hasOpenReport = groupReports.some((report) => report.groupId === group?.id && (report.status || 'open') === 'open')
    if (!hasOpenReport) return toast.error('Admin chỉ được vào nhóm khi đang có báo cáo/cảnh báo cần xử lý')

    try {
      const alreadyJoined = (group.memberIds || []).includes(currentUser.uid)
      const alreadyTemporary = (group.adminTemporaryMemberIds || []).includes(currentUser.uid)
      await updateDoc(doc(db, 'forumGroups', group.id), {
        memberIds: arrayUnion(currentUser.uid),
        adminTemporaryMemberIds: alreadyJoined && !alreadyTemporary ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
        membersCount: alreadyJoined ? Number(group.membersCount || group.memberIds?.length || 1) : increment(1),
        updatedAt: serverTimestamp(),
      })
      setActiveSection(SECTIONS.GROUPS)
      setOpenCreatedGroupId(group.id)
      toast.success(alreadyJoined && !alreadyTemporary ? 'Bạn đã ở trong nhóm này' : 'Admin đã tham gia tạm thời để xử lý báo cáo')
    } catch (error) {
      console.error('Không thể tham gia nhóm bị báo cáo:', error)
      toast.error('Không thể tham gia nhóm')
    }
  }

  const resolveGroupReports = async (groupId, status = 'resolved', reportIds = []) => {
    const targetIds = new Set((reportIds || []).filter(Boolean))
    const openReports = groupReports.filter((report) => {
      if (report.groupId !== groupId) return false
      if ((report.status || 'open') !== 'open') return false
      return !targetIds.size || targetIds.has(report.id)
    })

    await Promise.all(
      openReports.map((report) => updateDoc(doc(db, 'forumGroupReports', report.id), { status, resolvedAt: serverTimestamp(), resolvedBy: currentUser?.uid || '', updatedAt: serverTimestamp() })),
    )

    const remainingOpenReports = groupReports.filter((report) => {
      if (report.groupId !== groupId) return false
      if ((report.status || 'open') !== 'open') return false
      return !openReports.some((item) => item.id === report.id)
    })

    if (!remainingOpenReports.length) {
      await updateDoc(doc(db, 'forumGroups', groupId), {
        reportStatus: status === 'deleted' ? 'deleted' : 'resolved',
        reportCount: 0,
        updatedAt: serverTimestamp(),
      }).catch((error) => console.warn('Không thể cập nhật trạng thái báo cáo nhóm:', error))
      await removeTemporaryAdminFromGroup(groupId)
    }
  }

  const markGroupReportResolved = async (group, reportIds = []) => {
    if (roleKey !== 'admin_dev') return toast.error('Chỉ admin_dev mới xử lý báo cáo nhóm')
    if (!group?.id) return

    try {
      await resolveGroupReports(group.id, 'resolved', reportIds)
      toast.success('Đã đánh dấu báo cáo nhóm là đã giải quyết')
    } catch (error) {
      console.error('Không thể đánh dấu báo cáo nhóm:', error)
      toast.error('Không thể đánh dấu đã giải quyết')
    }
  }

  const warnGroupOwner = (group, report = null) => {
    if (roleKey !== 'admin_dev') return toast.error('Chỉ admin_dev mới gửi cảnh báo')
    const ownerId = group?.ownerId || report?.groupOwnerId || ''
    if (!ownerId) return toast.error('Không tìm thấy trưởng nhóm để gửi cảnh báo')

    setAdminReasonModal({
      title: 'Viết cảnh báo cho nhóm trưởng',
      message: `Gửi cảnh báo tới trưởng nhóm "${group?.name || report?.groupName || 'Nhóm học'}".`,
      confirmText: 'Gửi cảnh báo',
      placeholder: 'Nhập nội dung cảnh báo...',
      options: GROUP_WARNING_TEMPLATES,
      requireReason: true,
      onConfirm: async (warningText) => {
        try {
          await addDoc(collection(db, 'forumGroupWarnings'), {
            groupId: group?.id || report?.groupId || '',
            groupName: group?.name || report?.groupName || 'Nhóm học',
            ownerId,
            adminId: currentUser.uid,
            adminName: displayName,
            content: warningText,
            reportId: report?.id || '',
            createdAt: serverTimestamp(),
          })

          await addDoc(collection(db, 'forumNotifications'), {
            toUserId: ownerId,
            fromUserId: currentUser.uid,
            fromName: displayName,
            type: 'group-warning',
            category: 'admin',
            scope: 'group',
            groupId: group?.id || report?.groupId || '',
            groupName: group?.name || report?.groupName || 'Nhóm học',
            title: 'Cảnh báo nhóm học',
            text: warningText,
            read: false,
            createdAt: serverTimestamp(),
          })

          if (report?.groupId) await resolveGroupReports(report.groupId, 'warned')
          await removeTemporaryAdminFromGroup(group?.id || report?.groupId || '')
          toast.success('Đã gửi cảnh báo cho nhóm trưởng')
        } catch (error) {
          console.error('Không thể gửi cảnh báo nhóm:', error)
          toast.error('Không thể gửi cảnh báo')
        }
      },
    })
  }

  const resolveReport = async (report) => {
    if (roleKey !== 'admin_dev') return

    try {
      await deleteDoc(doc(db, 'forumReports', report.id))
      toast.success('Đã xóa báo cáo')
    } catch (error) {
      console.error('Không thể xử lý báo cáo:', error)
      toast.error('Không thể xử lý báo cáo')
    }
  }

  const openShareModal = (post, commentId = '') => {
    if (!post?.id) return

    const url = new URL(window.location.href)
    url.searchParams.set('post', post.id)

    if (commentId) {
      url.searchParams.set('comment', commentId)
    } else {
      url.searchParams.delete('comment')
    }

    setShareModal(url.toString())
  }

  const runDeletePost = async (post, reason = '') => {
    try {
      const deletedByAdmin = ['admin', 'admin_dev'].includes(roleKey)
      await hardDeletePostData(post.id)

      if (deletedByAdmin && post.authorId) {
        await addDoc(collection(db, 'forumNotifications'), {
          toUserId: post.authorId,
          fromUserId: currentUser.uid,
          fromName: displayName,
          type: 'post-deleted',
          category: 'admin',
          scope: post.scope || 'hall',
          postId: post.id,
          title: 'Bài viết đã bị xóa',
          text: reason
            ? `Quản trị viên đã xóa bài viết "${post.title}". Lý do: ${reason}`
            : `Quản trị viên đã xóa bài viết "${post.title}".`,
          read: false,
          createdAt: serverTimestamp(),
        })
      }

      if (selectedPost?.id === post.id) setSelectedPost(null)
      toast.success('Đã xóa bài viết')
    } catch (error) {
      console.error('Không thể xóa bài viết:', error)
      toast.error('Không thể xóa bài viết')
    }
  }

  const deletePost = async (post) => {
    if (!currentUser?.uid) return
    if (post.authorId !== currentUser.uid && !['admin', 'admin_dev'].includes(roleKey)) {
      toast.error('Bạn chỉ có thể xóa bài của mình')
      return
    }

    if (['admin', 'admin_dev'].includes(roleKey)) {
      setAdminReasonModal({
        title: 'Xóa bài đăng?',
        message: 'Bạn đang xóa bài viết với quyền quản trị viên. Hãy nhập lý do để người đăng nhận được thông báo rõ ràng.',
        confirmText: 'Xóa bài',
        placeholder: 'Nhập lý do xóa bài viết...',
        danger: true,
        onConfirm: (reason) => runDeletePost(post, reason),
      })
      return
    }

    setConfirmModal({
      title: 'Xóa bài đăng?',
      message: 'Bạn có chắc chắn muốn xóa bài đăng này không? Hành động này không thể hoàn tác.',
      confirmText: 'Xóa bài',
      danger: true,
      onConfirm: () => runDeletePost(post),
    })
  }


  const approvePost = async (post) => {
    if (roleKey !== 'admin_dev') return toast.error('Bạn không có quyền duyệt bài')
    try {
await updateDoc(doc(db, 'forumPosts', post.id), {
  status: 'approved',
  moderationStatus: 'approved',
  approvedBy: currentUser.uid,
  approvedAt: serverTimestamp(),
  rejectedAt: null,
  rejectedBy: '',
  updatedAt: serverTimestamp(),
})

if (post.authorId) {
  await addDoc(collection(db, 'forumNotifications'), {
    toUserId: post.authorId,
    fromUserId: currentUser.uid,
    fromName: displayName,
    type: 'moderation-approved',
    category: 'post-moderation',
    scope: post.scope || 'hall',
    postId: post.id,
    text: `Bài viết "${post.title}" của bạn đã được duyệt và hiển thị ở cộng đồng ZUNY.`,
    read: false,
    createdAt: serverTimestamp(),
  })
}

toast.success('Đã duyệt bài viết')
    } catch (error) {
      console.error('Không thể duyệt bài:', error)
      toast.error('Không thể duyệt bài')
    }
  }

  const rejectPost = async (post) => {
    if (roleKey !== 'admin_dev') return toast.error('Bạn không có quyền từ chối bài')

    setAdminReasonModal({
      title: 'Từ chối bài viết?',
      message: 'Vui lòng nhập lý do từ chối để người đăng biết cần chỉnh sửa điều gì.',
      confirmText: 'Từ chối',
      placeholder: 'Nhập lý do từ chối bài viết...',
      danger: true,
      onConfirm: async (reason) => {
        try {
          await updateDoc(doc(db, 'forumPosts', post.id), {
            status: 'rejected',
            moderationStatus: 'rejected',
            rejectionReason: reason || '',
            rejectedBy: currentUser.uid,
            rejectedAt: serverTimestamp(),
            approvedBy: '',
            approvedAt: null,
            updatedAt: serverTimestamp(),
          })

          if (post.authorId) {
            await addDoc(collection(db, 'forumNotifications'), {
              toUserId: post.authorId,
              fromUserId: currentUser.uid,
              fromName: displayName,
              type: 'moderation-rejected',
              category: 'post-moderation',
              scope: post.scope || 'hall',
              postId: post.id,
              title: 'Bài viết bị từ chối',
              text: reason
                ? `Bài viết "${post.title}" của bạn đã bị từ chối. Lý do: ${reason}`
                : `Bài viết "${post.title}" của bạn đã bị từ chối.`,
              read: false,
              createdAt: serverTimestamp(),
            })
          }

          toast.success('Đã từ chối bài viết')
        } catch (error) {
          console.error('Không thể từ chối bài:', error)
          toast.error('Không thể từ chối bài')
        }
      },
    })
  }

  const updateUserForumRestriction = async (targetUser, key, blocked) => {
    if (roleKey !== 'admin_dev' || !targetUser?.id) return
    if (targetUser.id === currentUser?.uid) {
      toast.error('Không thể tự chặn tài khoản quản trị hiện tại')
      return
    }

    const targetRole = getRoleKey(targetUser.role || targetUser.userRole || targetUser.type)
    if (targetRole === 'admin_dev') {
      toast.error('Không thể chặn tài khoản Admin_dev khác')
      return
    }

    const fieldLabel = key === 'blockCommunityPosting' ? 'đăng bài ở cộng đồng' : 'tạo nhóm học'
    const reasonField = key === 'blockCommunityPosting' ? 'postBlockReason' : 'groupBlockReason'

    try {
      await setDoc(doc(db, 'users', targetUser.id), {
        forumRestrictions: {
          ...(targetUser.forumRestrictions || {}),
          [key]: blocked,
          [reasonField]: blocked ? `Quản trị viên đã chặn quyền ${fieldLabel}` : '',
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.uid,
        },
      }, { merge: true })

      await addDoc(collection(db, 'forumNotifications'), {
        toUserId: targetUser.id,
        fromUserId: currentUser.uid,
        fromName: displayName,
        type: blocked ? 'forum-user-restricted' : 'forum-user-restored',
        category: 'admin',
        scope: 'hall',
        title: blocked ? 'Quyền cộng đồng đã bị giới hạn' : 'Quyền cộng đồng đã được khôi phục',
        text: blocked
          ? `Quản trị viên đã chặn quyền ${fieldLabel} của tài khoản bạn.`
          : `Quản trị viên đã khôi phục quyền ${fieldLabel} của tài khoản bạn.`,
        read: false,
        createdAt: serverTimestamp(),
      })

      toast.success(blocked ? `Đã chặn quyền ${fieldLabel}` : `Đã mở lại quyền ${fieldLabel}`)
    } catch (error) {
      console.error('Không thể cập nhật quyền cộng đồng:', error)
      toast.error('Không thể cập nhật quyền người dùng')
    }
  }

  const createGroup = async (form) => {
    if (!requireLogin()) return

    if (showRestrictionPopup('group')) {
      setGroupOpen(false)
      return
    }

    const ownedGroupsCount = groups.filter((group) => !group.isSample && group.ownerId === currentUser.uid).length
    if (ownedGroupsCount >= MAX_GROUPS_PER_USER) {
      toast.error(`Mỗi người chỉ được tạo tối đa ${MAX_GROUPS_PER_USER} nhóm`)
      return
    }

    try {
      const inviteExpiryMs = getInviteExpiryMs(form.inviteExpiry)
      const nowMs = Date.now()
      const groupRef = await addDoc(collection(db, 'forumGroups'), {
        name: form.name.trim(),
        description: String(form.description || '').trim(),
        emoji: form.emoji.trim() || '👥',
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 6),
        groupType: form.groupType || (form.isPrivate ? 'private' : 'public'),
        isPrivate: form.groupType === 'private',
        isHidden: Boolean(form.isHidden || form.groupType === 'hidden'),
        requireApproval: Boolean(form.requireApproval),
        pendingMemberIds: [],
        adminIds: [],
        minGrade: form.minGrade || '',
        password: form.groupType === 'private' ? String(form.password || '').trim() : '',
        themeColor: form.themeColor || '#8b5cf6',
        coverImage: String(form.coverImage || '').trim(),
        coverUrl: String(form.coverImage || '').trim(),
        groupCode: normalizeGroupCode(form.groupCode) || generateGroupCode(),
        inviteCode: form.groupType === 'invite_only' ? String(form.inviteCode || '').trim() : '',
        inviteExpiry: form.groupType === 'invite_only' ? (form.inviteExpiry || 'unlimited') : 'unlimited',
        inviteCodeIssuedAtMs: form.groupType === 'invite_only' ? nowMs : 0,
        inviteCodeExpiresAtMs: form.groupType === 'invite_only' && inviteExpiryMs ? nowMs + inviteExpiryMs : 0,
        channels: Array.isArray(form.channels) && form.channels.length ? form.channels : [
          { id: 'thong-bao', label: 'thông-báo', icon: '📢', type: 'announce' },
          { id: 'thao-luan', label: 'thảo-luận', icon: '💬', type: 'chat' },
        ],
        createDefaultChannels: false,
        defaultChannels: Array.isArray(form.defaultChannels) && form.defaultChannels.length ? form.defaultChannels : [
          { id: 'thong-bao', label: 'thông-báo', icon: '📢', type: 'announce' },
          { id: 'thao-luan', label: 'thảo-luận', icon: '💬', type: 'chat' },
        ],
        permissions: form.permissions || {
          sendMessage: true,
          sendImage: true,
          sendFile: true,
          invite: true,
          createPost: true,
        },
        memberLimit: Number(form.memberLimit || 1000),
        ownerId: currentUser.uid,
ownerName: displayName,
ownerEmail: currentUser.email || '',
createdByName: displayName,
createdByEmail: currentUser.email || '',
        memberIds: [currentUser.uid],
        membersCount: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setGroupOpen(false)
setCreatedGroupPopup({
  groupId: groupRef.id,
  groupCode: normalizeGroupCode(form.groupCode) || generateGroupCode(),
  inviteCode: form.groupType === 'invite_only' ? String(form.inviteCode || '').trim() : '',
})
    } catch (error) {
      console.error('Không thể tạo nhóm:', error)
      toast.error('Không thể tạo nhóm')
    }
  }

  const toggleJoinGroup = async (group) => {
    if (!requireLogin()) return
    const joined = (group.memberIds || []).includes(currentUser.uid)
    try {
      if (group.isSample) {
        const ownedGroupsCount = groups.filter((item) => !item.isSample && item.ownerId === currentUser.uid).length
        if (ownedGroupsCount >= MAX_GROUPS_PER_USER) {
          toast.error(`Mỗi người chỉ được tạo tối đa ${MAX_GROUPS_PER_USER} nhóm`)
          return
        }

        await addDoc(collection(db, 'forumGroups'), {
          name: group.name,
          description: group.description,
          emoji: group.emoji || '👥',
          tags: group.tags || [],
          isPrivate: false,
          password: '',
          themeColor: group.themeColor || '#8b5cf6',
          groupCode: normalizeGroupCode(group.groupCode) || generateGroupCode(),
          createDefaultChannels: true,
          defaultChannels: ['thong-bao', 'thao-luan', 'hoi-bai', 'tai-lieu'],
          ownerId: currentUser.uid,
          ownerName: displayName,
          ownerEmail: currentUser.email || '',
          createdByName: displayName,
          createdByEmail: currentUser.email || '',
          memberIds: [currentUser.uid],
          membersCount: 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        toast.success('Đã tạo và tham gia nhóm mẫu')
        return
      }

      const adminBypassReportedGroup = ['admin', 'admin_dev'].includes(roleKey) && (
        Number(group.reportCount || 0) > 0 || groupReports.some((report) => report.groupId === group.id && (report.status || 'open') === 'open')
      )

      const memberLimit = Number(group.memberLimit || 1000)
      const currentMemberCount = Number(group.membersCount || group.memberIds?.length || 0)
      if (!joined && !adminBypassReportedGroup && currentMemberCount >= memberLimit) {
        toast.error('Nhóm đã vượt quá giới hạn thành viên nên bạn không thể tham gia')
        return
      }

      if (!joined && !adminBypassReportedGroup && group.minGrade) {
        const requiredRank = gradeRank(group.minGrade)
        const userRank = roleKey === 'admin_dev' ? 999 : ['teacher', 'admin'].includes(roleKey) ? 40 : gradeRank(userClass)
        if (userRank < requiredRank) {
          toast.error('Bạn chưa đủ lớp học tối thiểu để tham gia nhóm này')
          return
        }
      }

      if (joined && group.ownerId === currentUser.uid && (group.memberIds || []).length > 1) {
        setConfirmModal({
    title: "Không thể rời nhóm",
    message:
        "Bạn đang là trưởng nhóm. Hãy chuyển quyền trưởng nhóm cho một thành viên khác trước khi rời nhóm.",
    confirmText: "Đã hiểu",
})
        return
      }

      if (!joined && !adminBypassReportedGroup && group.requireApproval) {
        const pendingIds = group.pendingMemberIds || []
        if (pendingIds.includes(currentUser.uid)) {
          toast.error('Yêu cầu tham gia của bạn đang chờ duyệt')
          return
        }
        await updateDoc(doc(db, 'forumGroups', group.id), {
          pendingMemberIds: arrayUnion(currentUser.uid),
          updatedAt: serverTimestamp(),
        })
        toast.success('Đã gửi yêu cầu tham gia, vui lòng chờ duyệt')
        return
      }

      const groupMembershipUpdate = {
        memberIds: joined ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
        membersCount: increment(joined ? -1 : 1),
        updatedAt: serverTimestamp(),
      }

      if (joined) {
        groupMembershipUpdate.adminIds = arrayRemove(currentUser.uid)
        groupMembershipUpdate.pendingMemberIds = arrayRemove(currentUser.uid)
      }

      await updateDoc(doc(db, 'forumGroups', group.id), groupMembershipUpdate)

      if (joined) {
        // Ẩn ngay tại giao diện trước khi Firestore hoàn tất xóa để không còn nhấp nháy thông báo cũ.
        setNotifications((previous) => previous.filter((item) => item.groupId !== group.id))
        setNotificationModal((previous) => previous?.groupId === group.id ? null : previous)

        // Xóa các thông báo cũ của chính nhóm vừa rời để chúng không còn nằm trong hộp thư.
        const userNotificationsSnapshot = await getDocs(
          query(
            collection(db, 'forumNotifications'),
            where('toUserId', '==', currentUser.uid),
            limit(200),
          ),
        )

        const staleGroupNotifications = userNotificationsSnapshot.docs.filter((item) => {
          const data = item.data() || {}
          return data.scope === 'group' && data.groupId === group.id
        })

        await Promise.all(staleGroupNotifications.map((item) => deleteDoc(item.ref)))
      }

      toast.success(joined ? 'Đã rời nhóm' : 'Đã tham gia nhóm')
    } catch (error) {
      console.error('Không thể cập nhật nhóm:', error)
      toast.error('Không thể cập nhật nhóm')
    }
  }

  const deleteQueryDocs = async (targetQuery) => {
    const snapshot = await getDocs(targetQuery)
    await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)))
  }

  const hardDeletePostData = async (postId) => {
    if (!postId) return

    await deleteQueryDocs(query(collection(db, 'forumPosts', postId, 'comments'), limit(500)))
    await deleteQueryDocs(query(collection(db, 'forumReports'), where('postId', '==', postId), limit(500)))
    await deleteQueryDocs(query(collection(db, 'forumNotifications'), where('postId', '==', postId), limit(500)))
    await deleteDoc(doc(db, 'forumPosts', postId))
  }

  const createGroupDeleteNotifications = async (group, reason = '') => {
    const memberIds = [...new Set([...(group.memberIds || []), group.ownerId].filter(Boolean))]
    const safeReason = String(reason || '').trim()

    if (!memberIds.length) return

    await Promise.all(
      memberIds.map((uid) =>
        addDoc(collection(db, 'forumNotifications'), {
          toUserId: uid,
          fromUserId: currentUser.uid,
          fromName: displayName,
          type: 'group-deleted-by-admin',
          category: 'admin',
          scope: 'group',
          groupId: group.id,
          groupName: group.name || 'Nhóm học',
          title: 'Nhóm học đã bị xóa',
          text: safeReason
            ? `Admin_dev đã xóa nhóm "${group.name || 'Nhóm học'}". Lý do: ${safeReason}`
            : `Admin_dev đã xóa nhóm "${group.name || 'Nhóm học'}".`,
          read: false,
          createdAt: serverTimestamp(),
        }),
      ),
    )
  }

  const deleteGroup = async (group) => {
    if (!requireLogin()) return
    if (group.isSample) return toast.error('Nhóm mẫu chưa có dữ liệu để xóa')
    const canDeleteGroup = group.ownerId === currentUser.uid || ['admin', 'admin_dev'].includes(roleKey)
    if (!canDeleteGroup) return toast.error('Bạn chỉ có thể xóa nhóm của mình')

    const runDeleteGroup = async (reason = '') => {
      try {
        if (roleKey === 'admin_dev') {
          await createGroupDeleteNotifications(group, reason)
          await resolveGroupReports(group.id, 'deleted')
        }

        const groupPosts = await getDocs(query(collection(db, 'forumPosts'), where('groupId', '==', group.id), limit(500)))
        await Promise.all(groupPosts.docs.map((item) => hardDeletePostData(item.id)))
        await deleteQueryDocs(query(collection(db, 'forumGroupChats', String(group.id), 'messages'), limit(500)))
        await deleteDoc(doc(db, 'forumGroups', group.id))
        if (selectedGroupChat?.id === group.id) setSelectedGroupChat(null)
        toast.success('Đã xóa nhóm')
      } catch (error) {
        console.error('Không thể xóa nhóm:', error)
        toast.error('Không thể xóa nhóm')
      }
    }

    if (roleKey === 'admin_dev') {
      setAdminReasonModal({
        title: 'Admin_dev xóa nhóm học?',
        message: 'Bạn đang xóa nhóm với quyền admin_dev. Người dùng trong nhóm sẽ nhận được thông báo kèm lý do này.',
        confirmText: 'Xóa nhóm',
        placeholder: 'Nhập lý do xóa nhóm...',
        options: GROUP_DELETE_REASONS,
        danger: true,
        requireReason: true,
        onConfirm: (reason) => runDeleteGroup(reason),
      })
      return
    }

    setConfirmModal({
      title: 'Xóa nhóm học?',
      message: 'Nhóm, tin nhắn chat và bài viết thuộc nhóm này sẽ bị xóa vĩnh viễn. Chỉ dữ liệu của nhóm này bị xóa.',
      confirmText: 'Xóa nhóm',
      danger: true,
      onConfirm: () => runDeleteGroup(),
    })
  }

  return (
    <div className={`${dark ? 'dark' : ''} min-h-full [&_button]:cursor-pointer [&_select]:cursor-pointer [&_label]:cursor-pointer`}>
<main className="min-h-full bg-slate-50 text-slate-950 transition dark:bg-[#020617] dark:text-white">
    <div className="relative flex min-h-full">
              <Sidebar activeSection={activeSection} roleKey={roleKey} unreadNotificationsCount={unreadNotificationsCount} pendingReviewCount={pendingReviewCount} collapsed={activeSection === SECTIONS.GROUPS ? true : sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((value) => !value)} onChange={(section) => { setActiveSection(section); setFilter('all'); setMobileMenuOpen(false) }} dark={dark} onToggleDark={() => setManualDark((value) => !(value ?? syncedDark))} mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

        <div className={`min-h-full min-w-0 flex-1 transition-[margin] duration-300 ${activeSection === SECTIONS.GROUPS || sidebarCollapsed ? 'lg:ml-24' : 'lg:ml-72'}`}>
        {activeSection === SECTIONS.GROUPS ? (
<DiscordGroupsLayout
  groups={groups}
  currentUser={currentUser}
  initialActiveGroupId={openCreatedGroupId}
  displayName={displayName}
  initials={initials}
  avatarUrl={avatarUrl}
  roleKey={roleKey}
  userClass={userClass}
  onJoin={toggleJoinGroup}
  onDelete={deleteGroup}
  onCreate={openGroupCreator}
  groupReports={groupReports}
  onReportGroup={submitGroupReport}
  onAdminJoinReportedGroup={adminJoinReportedGroup}
  onChannelViewChange={(open) => {
    setGroupChannelOpen(open)
    onChannelViewChange(open)

    if (typeof window !== 'undefined') {
      const mobileChannelOpen = Boolean(
        open && window.matchMedia('(max-width: 1023px)').matches,
      )

      window.dispatchEvent(
        new CustomEvent('zuny:forum-channel-view', {
          detail: { open: mobileChannelOpen },
        }),
      )
    }
  }}
/>
              ) : (
<section className="min-h-full min-w-0 flex-1 overflow-visible pb-24 lg:pb-8">            

            <div className={`mx-auto grid w-full max-w-7xl gap-4 px-3 py-3 sm:px-4 sm:py-4 lg:px-6 ${activeSection === SECTIONS.HALL ? "xl:grid-cols-[minmax(0,1fr)_300px]" : "grid-cols-1"}`}>
              <div className="min-w-0">
                {activeSection === SECTIONS.HALL && <HallHero stats={stats} onCompose={openComposer} onExploreGroups={() => setActiveSection(SECTIONS.GROUPS)} />}
                {activeSection === SECTIONS.GROUPS && null}
                {activeSection === SECTIONS.ACCOUNT && (
                  <AccountHero
                    displayName={displayName}
                    avatarUrl={avatarUrl}
                    initials={initials}
                    accountTab={accountTab}
                    onChange={setAccountTab}
                    myPostsCount={posts.filter((post) => post.authorId === currentUser?.uid).length}
                    savedCount={savedPosts.length}
                    unreadCount={unreadNotificationsCount}
                  />
                )}
                {activeSection === SECTIONS.ACCOUNT && accountTab === 'my-posts' && (
                  <StatusFilterBar
                    value={myPostStatusFilter}
                    onChange={setMyPostStatusFilter}
                    options={[
                      { value: 'all', label: 'Tất cả' },
                      { value: 'approved', label: 'Bài đăng thành công' },
                      { value: 'rejected', label: 'Bài đăng thất bại' },
                    ]}
                  />
                )}
                {activeSection === SECTIONS.ADMIN_REVIEW && <SimpleHero icon="🛡️" title="Quản lý" subtitle="Quản trị bài viết, báo cáo và nhóm học trong cộng đồng ZUNY." />}

                {activeSection === SECTIONS.HALL && <ComposerBar onOpen={openComposer} onAvatarClick={() => openUserProfile({ uid: currentUser?.uid, name: displayName, role: roleKey, avatarUrl })} initials={initials} avatarUrl={avatarUrl} name={displayName} />}

                {activeSection === SECTIONS.ADMIN_REVIEW ? (
                  <>
                    <StatusFilterBar
                      value={adminMainMode}
                      onChange={setAdminMainMode}
                      options={[
                        { value: 'posts', label: 'Quản lý bài đăng' },
                        { value: 'groups', label: 'Quản lý nhóm' },
                        { value: 'personal', label: 'Quản lý cá nhân' },
                      ]}
                    />

                    {adminMainMode === 'posts' ? (
                      <>
                        <StatusFilterBar
                          value={adminReviewMode}
                          onChange={setAdminReviewMode}
                          options={[
                            { value: 'pending', label: 'Duyệt bài đăng' },
                            { value: 'reported', label: 'Bài đăng báo cáo' },
                          ]}
                        />
                        <AdminReviewList
                          mode={adminReviewMode}
                          posts={filteredPosts}
                          reports={reports.filter((report) => (report.status || 'open') === 'open')}
                          onApprove={approvePost}
                          onReject={rejectPost}
                          onOpen={openPost}
                          onResolveReport={resolveReport}
                          onDeleteReportedPost={async (report) => {
                            const targetPost = posts.find((item) => item.id === report.postId)
                            if (targetPost) {
                              await runDeletePost(targetPost, `Bài viết bị báo cáo: ${report.reason}${report.detail ? ` - ${report.detail}` : ''}`)
                              await resolveReport(report)
                            } else {
                              await resolveReport(report)
                            }
                          }}
                        />
                      </>
                    ) : adminMainMode === 'groups' ? (
                      <>
                        <StatusFilterBar
                          value={groupAdminMode}
                          onChange={setGroupAdminMode}
                          options={[
                            { value: 'stats', label: 'Thống kê nhóm' },
                            { value: 'reports', label: 'Báo cáo nhóm' },
                          ]}
                        />
                        <GroupAdminPanel
                          mode={groupAdminMode}
                          groups={groups}
                          reports={groupReports.filter((report) => (report.status || 'open') === 'open')}
                          onJoinReportedGroup={adminJoinReportedGroup}
                          onDeleteGroup={(group) => deleteGroup(group)}
                          onWarnOwner={warnGroupOwner}
                          onResolveGroupReport={markGroupReportResolved}
                        />
                      </>
                    ) : (
                      <PersonalAdminPanel
                        users={Object.values(userProfiles)}
                        currentUserId={currentUser?.uid}
                        search={personalAdminSearch}
                        onSearchChange={setPersonalAdminSearch}
                        onToggleRestriction={updateUserForumRestriction}
                      />
                    )}
                  </>
                ) : activeSection === SECTIONS.NOTIFICATIONS || (activeSection === SECTIONS.ACCOUNT && accountTab === 'notifications') ? (
                  <>
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <StatusFilterBar
                        value={notificationFilter}
                        onChange={setNotificationFilter}
                        options={[
                          { value: 'all', label: 'Tất cả' },
                          { value: 'hall', label: 'Cộng đồng ZUNY' },
                          { value: 'group', label: 'Nhóm học' },
                          { value: 'mine', label: 'Của tôi' },
                        ]}
                      />

                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={markAllNotificationsRead}
                          className="rounded-2xl bg-cyan-500 px-4 py-2 text-xs font-black text-white shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-600"
                        >
                          Đọc hết
                        </button>
                        <button
                          type="button"
                          onClick={confirmDeleteAllNotifications}
                          className="rounded-2xl bg-rose-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-700"
                        >
                          Xóa hết
                        </button>
                      </div>
                    </div>

                    <NotificationList notifications={filteredNotifications} onRead={openNotification} onDelete={requestDeleteNotification} />
                  </>
                ) : (
                  <>
                    <FilterBar filter={filter} setFilter={setFilter} sortBy={sortBy} setSortBy={setSortBy} search={search} setSearch={setSearch} />
<PostList
  loading={loadingPosts}
  posts={filteredPosts}
  currentUserId={currentUser?.uid}
  roleKey={roleKey}
  userProfiles={userProfiles}
  onOpenUserProfile={openUserProfile}
  likingPostIds={likingPostIds}
  showStatusBadge={activeSection === SECTIONS.MY_POSTS || (activeSection === SECTIONS.ACCOUNT && accountTab === 'my-posts')}
  onOpen={openPost}
  onLike={toggleLike}
  onReport={setReportModal}
  onSave={toggleSave}
  onDelete={deletePost}
  onShare={openShareModal}
  onVote={votePoll}
  onEventInterest={toggleEventInterest}
  onClear={() => { setSearch(''); setFilter('all') }}
/>
                  </>
                )}
              </div>

              {activeSection === SECTIONS.HALL && (
                <RightSidebar
                  posts={posts.filter((post) => (post.status || 'approved') === 'approved')}
                  groups={groups}
                  profile={{ displayName, initials, roleKey, userClass }}
                  currentUserId={currentUser?.uid}
                  onOpenPost={openPost}
                />
              )}
            </div>
          </section>
              )}
        </div>
        </div>

        {!groupChannelOpen && (
          <MobileNav activeSection={activeSection} unreadNotificationsCount={unreadNotificationsCount} onChange={(section) => { setActiveSection(section); setFilter('all') }} onCompose={openComposer} />
        )}
      </main>

      <UserProfilePopup
        user={profilePopup}
        onClose={() => setProfilePopup(null)}
        onOpenLibrary={(uid) => navigate(`/e-learning?section=account&user=${encodeURIComponent(uid)}`)}
        onOpenLeaderboard={(uid) => navigate(`/leaderboard?user=${encodeURIComponent(uid)}&highlight=1`)}
      />
      <PostModal open={composerOpen} onClose={() => setComposerOpen(false)} onSubmit={createPost} groups={groups} roleKey={roleKey} displayName={displayName} initials={initials} avatarUrl={avatarUrl} />
      <GroupModal open={groupOpen} onClose={() => setGroupOpen(false)} onSubmit={createGroup} existingGroups={groups} />
      <PostDetailModal post={selectedPost} highlightedCommentId={highlightedCommentId} currentUser={currentUser} displayName={displayName} initials={initials} roleKey={roleKey} likingPostIds={likingPostIds} onClose={closeSelectedPost} onLike={toggleLike} onReport={setReportModal} onSave={toggleSave} onDelete={deletePost} onShare={openShareModal} onVote={votePoll} onEventInterest={toggleEventInterest} />
      <RestrictionNoticeModal modal={restrictionModal} onClose={() => setRestrictionModal(null)} />
      <CenterConfirmModal modal={confirmModal} onClose={() => setConfirmModal(null)} />
      <AdminReasonConfirmModal modal={adminReasonModal} onClose={() => setAdminReasonModal(null)} />
      <CenterShareModal link={shareModal} onClose={() => setShareModal(null)} />
      {createdGroupPopup && (
  <div
    className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
    onMouseDown={() => setCreatedGroupPopup(null)}
  >
    <div
      className="w-[min(92vw,500px)] rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-950 dark:text-white">
            Tạo thành công
          </h3>
          <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-300">
            Bạn có thể copy mã hoặc vào nhóm ngay.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreatedGroupPopup(null)}
          className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-5 space-y-3">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5">
          <div className="min-w-0 flex-1 px-3">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
              Mã nhóm
            </p>
            <p className="truncate text-sm font-black text-slate-950 dark:text-white">
              {createdGroupPopup.groupCode || 'Không có'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(createdGroupPopup.groupCode || '')
              toast.success('Đã copy mã nhóm')
            }}
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white transition hover:bg-blue-700"
          >
            Copy
          </button>
        </div>

        {createdGroupPopup.inviteCode && (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5">
            <div className="min-w-0 flex-1 px-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                Mã mời
              </p>
              <p className="truncate text-sm font-black text-slate-950 dark:text-white">
                {createdGroupPopup.inviteCode}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(createdGroupPopup.inviteCode)
                toast.success('Đã copy mã mời')
              }}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white transition hover:bg-blue-700"
            >
              Copy
            </button>
          </div>
        )}

<button
  type="button"
  onClick={() => {
    const targetGroupId = createdGroupPopup.groupId

    setCreatedGroupPopup(null)
    setSelectedGroupChat(null)
    setActiveSection(SECTIONS.GROUPS)
    setOpenCreatedGroupId(targetGroupId)
  }}
  className="mt-2 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700"
>
  Vào nhóm ngay
</button>
      </div>
    </div>
  </div>
)}
      <ReportModal reportPost={reportModal} onClose={() => setReportModal(null)} onSubmit={submitReport} />
      <CommunityChatModal chat={selectedGroupChat} type="group" currentUser={currentUser} displayName={displayName} initials={initials} onClose={() => setSelectedGroupChat(null)} />
      <NotificationPopup notification={notificationModal} onClose={() => setNotificationModal(null)} onGoToPost={() => goToNotificationPost(notificationModal)} />
    </div>
  )
}

function Sidebar({
  activeSection,
  onChange,
  dark,
  onToggleDark,
  mobileOpen,
  onClose,
  roleKey,
  unreadNotificationsCount = 0,
  pendingReviewCount = 0,
  collapsed = false,
  onToggleCollapsed,
}) {
  const items = [
    { id: SECTIONS.HALL, label: 'Cộng đồng ZUNY', icon: Globe2 },
    { id: SECTIONS.GROUPS, label: 'Nhóm học', icon: Users },
    { id: SECTIONS.ACCOUNT, label: 'Tài khoản', icon: FileText, badge: unreadNotificationsCount },
    ...(roleKey === 'admin_dev'
      ? [{ id: SECTIONS.ADMIN_REVIEW, label: 'Quản lý', icon: ShieldCheck, badge: pendingReviewCount }]
      : []),
  ]

  const content = (
    <aside
      className={`flex h-full max-h-full shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white px-3 pb-4 pt-1 shadow-xl shadow-slate-200/60 transition-all duration-300 dark:border-blue-950/80 dark:bg-[#030b1d] dark:shadow-black/30 ${
        collapsed ? 'w-24' : 'w-72'
      }`}
    >
      <div className={`flex shrink-0 items-center gap-3 px-2 pb-5 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        <div className={`flex min-w-0 items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-300/50 bg-gradient-to-br from-cyan-400 via-blue-500 to-blue-700 text-white shadow-[0_0_24px_rgba(37,99,235,0.55)] dark:border-blue-400/40">
            <Globe2 className="h-5 w-5" />
            <span className="absolute inset-1 rounded-xl border border-white/15" />
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-black uppercase tracking-[0.02em] text-slate-950 dark:text-white">Cộng đồng ZUNY</h1>
              <p className="mt-0.5 truncate text-[10px] font-bold text-slate-400 dark:text-blue-200/55">Học tập · Chia sẻ · Kết nối</p>
            </div>
          )}
        </div>

        <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10 lg:hidden">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mx-2 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-blue-900/70" />

      <nav className="mt-4 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {items.map((item) => {
          const Icon = item.icon
          const active = activeSection === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              title={collapsed ? item.label : undefined}
              className={`group flex w-full items-center rounded-xl border px-3 py-2.5 text-sm font-black transition-all duration-200 ${
                collapsed ? 'justify-center' : 'gap-3'
              } ${
                active
                  ? 'border-blue-400/50 bg-gradient-to-r from-blue-600/20 via-blue-500/15 to-cyan-400/10 text-blue-700 shadow-[inset_0_0_18px_rgba(37,99,235,0.08),0_0_20px_rgba(37,99,235,0.12)] dark:border-blue-500/60 dark:text-white dark:shadow-[inset_0_0_20px_rgba(37,99,235,0.14),0_0_22px_rgba(37,99,235,0.18)]'
                  : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:border-blue-900/60 dark:hover:bg-blue-950/35 dark:hover:text-white'
              }`}
            >
              <span className={`relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${
                active
                  ? 'bg-blue-600 text-white shadow-[0_0_18px_rgba(37,99,235,0.75)]'
                  : 'text-slate-400 group-hover:text-blue-500 dark:text-slate-400 dark:group-hover:text-blue-300'
              }`}>
                <Icon className={`h-4.5 w-4.5 ${active ? 'drop-shadow-[0_0_7px_rgba(255,255,255,0.8)]' : ''}`} />
                {item.badge > 0 && (
                  <span className="absolute -right-2.5 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-blue-500 px-1 text-[9px] font-black text-white shadow-lg dark:border-[#030b1d]">
                    {item.badge > 999 ? '999+' : item.badge}
                  </span>
                )}
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto shrink-0 pt-4">
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
          className={`group hidden w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-blue-950/80 dark:bg-blue-950/25 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-200 lg:flex ${collapsed ? 'h-12 px-0' : ''}`}
        >
          {collapsed ? <PanelRightOpen className="h-5 w-5" /> : <><PanelLeftClose className="h-5 w-5" /><span>Thu gọn menu</span></>}
        </button>
      </div>
    </aside>
  )

  return (
    <>
      <div className="fixed left-0 top-[4%] z-40 hidden h-[calc(100vh-80px)] lg:block">{content}</div>
      {mobileOpen && <div className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm lg:hidden" onMouseDown={onClose}><div className="h-full" onMouseDown={(event) => event.stopPropagation()}>{content}</div></div>}
    </>
  )
}

function TopBar({ search, setSearch, onCompose, onMenu, initials, unread, profileLoading }) {
  return (
<header className="sticky top-0 z-40 bg-white/85 px-4 py-3 backdrop-blur-xl dark:bg-slate-950/80 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <button type="button" onClick={onMenu} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 lg:hidden">
          <Menu className="h-5 w-5" />
        </button>
        <div className="relative min-w-0 flex-1 lg:max-w-2xl">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm bài viết, câu hỏi, tài liệu..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-11 py-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-slate-900" />
        </div>
        <button type="button" onClick={onCompose} className="hidden items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-sky-500/25 transition hover:-translate-y-0.5 sm:flex">
          <Plus className="h-4 w-4" />
          Đăng bài
        </button>
        <button type="button" className="relative rounded-2xl p-3 text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">{unread > 9 ? '9+' : unread}</span>}
        </button>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 text-sm font-black text-white shadow-lg shadow-cyan-500/20">
          {profileLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : initials}
        </div>
      </div>
    </header>
  )
}

function HallHero({ stats, onCompose, onExploreGroups }) {
  const metricItems = [
    { value: Number(stats.memberCount || 0).toLocaleString('vi-VN'), label: 'Thành viên', icon: Users },
    { value: Number(stats.todayCount || 0).toLocaleString('vi-VN'), label: 'Bài đăng hôm nay', icon: MessageSquare },
  ]

  return (
    <section className="relative mb-5 overflow-hidden rounded-[1.5rem] border border-blue-200 bg-white text-slate-950 shadow-[0_20px_70px_-30px_rgba(37,99,235,0.35)] dark:border-blue-400/25 dark:bg-[#041025] dark:text-white dark:shadow-[0_20px_70px_-30px_rgba(37,99,235,0.75)]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(37,99,235,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,0.07)_1px,transparent_1px)] bg-[size:30px_30px] opacity-70 dark:bg-[linear-gradient(rgba(56,189,248,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.09)_1px,transparent_1px)] dark:opacity-50" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(59,130,246,0.16),transparent_33%),radial-gradient(circle_at_10%_100%,rgba(14,165,233,0.10),transparent_36%)] dark:bg-[radial-gradient(circle_at_82%_18%,rgba(37,99,235,0.42),transparent_33%),radial-gradient(circle_at_10%_100%,rgba(14,165,233,0.18),transparent_36%)]" />
      <div className="pointer-events-none absolute -right-14 -top-24 hidden h-80 w-80 rounded-full border border-cyan-300/20 bg-[radial-gradient(circle_at_35%_30%,rgba(56,189,248,0.75),rgba(30,64,175,0.45)_38%,rgba(2,6,23,0.08)_70%)] shadow-[0_0_90px_rgba(37,99,235,0.45)] md:block">
        <div className="absolute inset-[14%] rounded-full border border-blue-200/20" />
        <div className="absolute inset-x-[7%] top-1/2 h-px bg-cyan-200/25" />
        <div className="absolute bottom-[8%] left-1/2 top-[8%] w-px bg-blue-200/20" />
      </div>

      <div className="relative grid min-h-[235px] gap-6 p-5 sm:p-7 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-end">
        <div className="relative z-10 flex flex-col justify-center">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-400/25 bg-blue-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700 dark:text-blue-100">
            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.95)]" /> Cộng đồng ZUNY
          </div>
          <h2 className="mt-5 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-[2.55rem]">
            Không gian học tập,
            <span className="block bg-gradient-to-r from-blue-400 via-sky-400 to-cyan-300 bg-clip-text text-transparent">trao đổi và phát triển cùng nhau</span>
          </h2>
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-600 dark:text-blue-100/65">Chia sẻ kiến thức, đặt câu hỏi và kết nối trong một cộng đồng học thuật hiện đại.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={onCompose} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/35 bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2.5 text-xs font-black text-white shadow-[0_0_24px_rgba(37,99,235,0.55)] transition hover:-translate-y-0.5 hover:brightness-110"><Plus className="h-4 w-4" />Đăng bài mới</button>
            <button type="button" onClick={onExploreGroups} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white/90 px-4 py-2.5 text-xs font-black text-blue-700 shadow-sm transition dark:border-blue-300/25 dark:bg-slate-950/35 dark:text-blue-50 hover:-translate-y-0.5 hover:bg-blue-950/55"><Users className="h-4 w-4" />Khám phá nhóm học</button>
          </div>
        </div>
        <div className="relative z-10 grid grid-cols-2 gap-3">
          {metricItems.map(({ value, label, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-blue-200 bg-white/90 p-4 shadow-sm backdrop-blur-md dark:border-blue-300/20 dark:bg-slate-950/45 dark:shadow-none transition hover:-translate-y-0.5 hover:border-cyan-300/35">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-400/25 bg-blue-500/15 text-cyan-300"><Icon className="h-4 w-4" /></div>
              <p className="mt-4 text-2xl font-black tabular-nums">{value}</p>
              <p className="mt-1 text-[11px] font-bold text-slate-500 dark:text-blue-100/55">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function AccountHero({ displayName, avatarUrl, initials, accountTab, onChange, myPostsCount, savedCount, unreadCount }) {
  const tabs = [
    { id: 'my-posts', label: 'Bài của tôi', icon: FileText, count: myPostsCount },
    { id: 'saved', label: 'Đã lưu', icon: Bookmark, count: savedCount },
    { id: 'notifications', label: 'Thông báo', icon: Bell, count: unreadCount },
  ]
  return (
    <section className="relative mb-5 overflow-hidden rounded-[1.5rem] border border-blue-200 bg-white p-5 text-slate-950 shadow-[0_18px_55px_-28px_rgba(37,99,235,0.25)] dark:border-blue-400/20 dark:bg-[#061126] dark:text-white dark:shadow-[0_18px_55px_-28px_rgba(37,99,235,0.7)] sm:p-6">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(37,99,235,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,0.09)_1px,transparent_1px)] bg-[size:28px_28px] opacity-50" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <ProfileAvatar src={avatarUrl} initials={initials} className="h-20 w-16 rounded-2xl ring-1 ring-cyan-300/30" />
          <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Trung tâm tài khoản</p><h2 className="mt-1 truncate text-2xl font-black">{displayName}</h2><p className="mt-1 text-xs font-semibold text-slate-500 dark:text-blue-100/55">Quản lý nội dung, mục đã lưu và thông báo tại một nơi.</p></div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {tabs.map(({ id, label, icon: Icon, count }) => {
            const active = accountTab === id
            return <button key={id} type="button" onClick={() => onChange(id)} className={`group rounded-2xl border px-3 py-3 text-left transition ${active ? 'border-blue-400 bg-blue-50 text-blue-700 shadow-[0_0_24px_rgba(37,99,235,0.18)] dark:border-cyan-300/45 dark:bg-blue-600/25 dark:text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50 dark:border-blue-300/15 dark:bg-slate-950/30 dark:text-white dark:hover:border-blue-300/30 dark:hover:bg-blue-950/45'}`}><div className="flex items-center justify-between gap-2"><span className={`grid h-8 w-8 place-items-center rounded-xl ${active ? 'bg-blue-500 text-white shadow-[0_0_16px_rgba(59,130,246,0.7)]' : 'bg-white text-blue-500 shadow-sm dark:bg-white/5 dark:text-blue-200'}`}><Icon className="h-4 w-4" /></span><span className="text-sm font-black tabular-nums">{Number(count || 0).toLocaleString('vi-VN')}</span></div><p className="mt-2 text-[11px] font-bold text-slate-500 dark:text-blue-100/70">{label}</p></button>
          })}
        </div>
      </div>
    </section>
  )
}

function GroupsHero({ onCreate }) {
  return null
}

function SimpleHero({ icon, title, subtitle }) {
  return (
    <section className="relative mb-5 overflow-hidden rounded-[1.5rem] border border-blue-200 bg-white p-6 text-slate-950 shadow-[0_18px_55px_-28px_rgba(37,99,235,0.28)] dark:border-blue-400/20 dark:bg-[#061126] dark:text-white dark:shadow-[0_18px_55px_-28px_rgba(37,99,235,0.7)] sm:p-7">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(37,99,235,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,0.07)_1px,transparent_1px)] bg-[size:28px_28px] dark:bg-[linear-gradient(rgba(56,189,248,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.08)_1px,transparent_1px)]" />
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-500/20" />
      <div className="relative flex items-center gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-blue-200 bg-blue-50 text-2xl shadow-sm dark:border-blue-400/20 dark:bg-blue-500/15">{icon}</div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600 dark:text-cyan-300">Trung tâm điều hành</p>
          <h2 className="mt-1 text-2xl font-black sm:text-3xl">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600 dark:text-blue-100/60">{subtitle}</p>
        </div>
      </div>
    </section>
  )
}

function ComposerBar({ onOpen, onAvatarClick, initials, avatarUrl, name }) {
  return (
    <div className="mb-4 flex w-full items-center gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-300 hover:shadow-lg dark:border-white/10 dark:bg-white/5 dark:hover:border-blue-400/50 sm:p-4">
      <button type="button" onClick={onAvatarClick} className="shrink-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400" aria-label="Mở hồ sơ người dùng">
        <ProfileAvatar src={avatarUrl} initials={initials} className="h-10 w-10 sm:h-11 sm:w-11" />
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 rounded-2xl bg-slate-100 px-3 py-3 text-left text-xs font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-300 sm:px-4 sm:text-sm">{name ? `${name} ơi, bạn muốn chia sẻ gì?` : 'Bạn muốn chia sẻ gì?'}</button>
      <ImagePlus className="hidden h-5 w-5 text-slate-400 sm:block" />
    </div>
  )
}

function StatusFilterBar({ value, onChange, options }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {options.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={`rounded-2xl px-4 py-2 text-xs font-black transition ${
            value === item.value
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-white text-slate-500 hover:bg-slate-100 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function FilterBar({
  filter,
  setFilter,
  sortBy,
  setSortBy,
  search = '',
  setSearch = () => {},
}) {
  const [sortOpen, setSortOpen] = useState(false)

  return (
    <div className="relative z-50 mb-4 flex items-center gap-3 overflow-visible pb-1">

      {/* FILTERS */}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pr-2">
        {FILTER_TABS.map((tab) => {
          const Icon = tab.icon
          const active = filter === tab.value

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilter(tab.value)}
              title={tab.label}
              className={`group flex h-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-xs font-black transition-all duration-300 ${
                active ? 'w-auto gap-1.5 px-3' : 'w-10 px-0'
              } ${
                active
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-white text-slate-500 hover:bg-slate-100 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />

              <span
                className={`whitespace-nowrap transition-all duration-300 ${
                  active ? 'max-w-24 opacity-100' : 'max-w-0 opacity-0'
                }`}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* SEARCH */}
      <div className="relative hidden w-[180px] shrink-0 lg:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm tên tác giả..."
          className="
            w-full rounded-2xl border border-slate-200
            bg-white px-9 py-2.5 text-xs font-bold
            text-slate-700 outline-none transition
            placeholder:text-slate-400
            focus:border-blue-400
            dark:border-white/10
            dark:bg-white/5
            dark:text-white
            dark:placeholder:text-slate-500
          "
        />
      </div>

      {/* SORT */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setSortOpen(!sortOpen)}
          className="
            flex min-w-[132px] items-center justify-between gap-3 rounded-2xl border
            border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700
            shadow-sm transition
            hover:border-blue-300
            hover:bg-blue-50
            hover:text-blue-700
            dark:border-white/10
            dark:bg-slate-900
            dark:text-white
            dark:hover:bg-white/10
          "
        >
          <span>
            {sortBy === 'newest' ? 'Mới nhất' : 'Phổ biến'}
          </span>

          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/10">
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ${
                sortOpen ? 'rotate-180' : ''
              }`}
            />
          </span>
        </button>

        {sortOpen && (
          <div
            className="
              absolute right-0 top-full z-[999]
              mt-2 w-40 overflow-hidden rounded-2xl border
              border-slate-200 bg-white p-1 shadow-2xl
              dark:border-white/10 dark:bg-slate-900
            "
          >
            {[
              ['newest', 'Mới nhất'],
              ['popular', 'Phổ biến'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setSortBy(value)
                  setSortOpen(false)
                }}
                className={`block w-full rounded-xl px-3 py-2.5 text-left text-xs font-black transition ${
                  sortBy === value
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PostList({
  loading,
  posts,
  currentUserId,
  roleKey,
  userProfiles = {},
  onOpenUserProfile = () => {},
  likingPostIds = [],
  showStatusBadge = false,
  onOpen,
  onLike,
  onReport,
  onSave,
  onDelete,
  onShare,
  onVote,
  onEventInterest = () => {},
  onClear,
}) {
    if (loading) return <div className="space-y-4">{[1, 2, 3].map((item) => <div key={item} className="h-52 animate-pulse rounded-3xl bg-white dark:bg-white/5" />)}</div>
  if (!posts.length) return <EmptyState icon="🔍" title="Không tìm thấy bài viết" description="Thử đổi bộ lọc hoặc từ khóa tìm kiếm." actionLabel="Khởi động lại" onAction={onClear} />
  return <div className="space-y-4">{posts.map((post) => <PostCard key={post.id} post={post} currentUserId={currentUserId} roleKey={roleKey} authorProfile={userProfiles[post.authorId] || {}} onOpenUserProfile={onOpenUserProfile} liking={likingPostIds.includes(post.id)} showStatusBadge={showStatusBadge} onOpen={onOpen} onLike={onLike} onReport={onReport} onSave={onSave} onDelete={onDelete} onShare={onShare} onVote={onVote} onEventInterest={onEventInterest} />)}</div>
}

function PostCard({
  post,
  currentUserId,
  roleKey,
  authorProfile = {},
  onOpenUserProfile = () => {},
  liking = false,
  showStatusBadge = false,
  onOpen,
  onLike,
  onReport,
  onSave,
  onDelete,
  onShare = () => {},
  onVote = () => {},
  onEventInterest = () => {},
}) {  
  const type = POST_TYPES.find((item) => item.value === post.type) || POST_TYPES[2]
  const TypeIcon = type.icon
  const userReaction = getUserReaction(post, currentUserId)
  const reactionSummary = getReactionSummary(post.reactions || {}, post.reactionCounts || {})
  const saved = (post.savedBy || []).includes(currentUserId)
  const saveCount = Array.isArray(post.savedBy) ? post.savedBy.length : 0
  const canDelete = post.authorId === currentUserId || ['admin', 'admin_dev'].includes(roleKey)
  const adminPost = isAdminAuthor(post.authorRole)
  const isEventPost = post.type === 'event'
  const eventInterested = (post.eventInterestedBy || []).includes(currentUserId)
  const eventNotInterested = (post.eventNotInterestedBy || []).includes(currentUserId)
  const showEventInterestToggle = isEventPost && !adminPost && currentUserId

  return (
    <article className={`cursor-pointer overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl dark:bg-white/5 ${
      adminPost
        ? 'border-amber-300 shadow-amber-200/40 dark:border-amber-400/40 dark:bg-amber-500/5 dark:shadow-amber-500/10'
        : 'border-slate-200 dark:border-white/10'
    }`}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(post)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpen(post)
          }
        }}
        className="block w-full p-5 text-left"
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={(event) => { event.stopPropagation(); onOpenUserProfile({ uid: post.authorId, name: post.authorName, role: post.authorRole, avatarUrl: post.authorPhotoURL, isAnonymous: post.isAnonymous }) }} disabled={post.isAnonymous || !post.authorId} className="shrink-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-default" aria-label="Mở hồ sơ tác giả">{post.isAnonymous ? <span className="grid h-11 w-11 place-items-center rounded-2xl border border-blue-400/25 bg-slate-900 text-cyan-300 shadow-lg shadow-blue-500/15 sm:h-12 sm:w-12"><UserRoundX className="h-6 w-6" /></span> : <ProfileAvatar src={authorProfile.photoURL || authorProfile.avatarUrl || authorProfile.avatarURL || authorProfile.avatar || authorProfile.profileImage || post.authorPhotoURL} initials={post.authorInitials || getInitials(post.authorName)} className="h-11 w-11 sm:h-12 sm:w-12" />}</button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black text-slate-950 dark:text-white">{post.authorName || 'Người dùng ZUNY'}</h3>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black ${
                  adminPost
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                }`}><ShieldCheck className="h-3 w-3" />{roleText[post.authorRole] || 'Thành viên'}</span>
                {adminPost && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[11px] font-black text-white shadow-lg shadow-amber-500/20">
                    ⭐ Nổi bật
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs font-semibold text-slate-400">{formatRelativeTime(post.createdAt)}{post.groupName || post.className ? ` • ${post.groupName || post.className}` : ''}</p>
            </div>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${type.color}`}><TypeIcon className="h-3.5 w-3.5" />{type.label}</span>
        </div>

        {adminPost && (
          <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-black text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
            ✨ Bài đăng quản trị viên.
          </div>
        )}

        {post.isPinned && <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"><Star className="h-3.5 w-3.5 fill-current" />Bài ghim</div>}
        <h2 className="text-xl font-black leading-snug text-slate-950 dark:text-white">{post.title}</h2>
        <RichPostContent content={post.content} clamp />

        {(post.status || 'approved') === 'pending' && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
            ⏳ Đang chờ admin duyệt
          </div>
        )}

{showStatusBadge &&
  post.status === 'approved' && (
    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
      ✅ Bài đăng thành công
    </div>
)}

        {post.status === 'rejected' && post.authorId === currentUserId && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
            ❌ Bài đăng bị từ chối
          </div>
        )}

        {post.type === 'question' && (
          <div className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ${post.isAnswered ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200'}`}>
            {post.isAnswered ? '✅ Đã trả lời' : '❓ Chưa trả lời'}
          </div>
        )}

        {post.teacherOnly && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-blue-700 dark:bg-sky-500/15 dark:text-sky-200">
            🎓 Chỉ giáo viên được trả lời
          </div>
        )}

        {post.type === 'poll' && post.pollOptions?.length > 0 && (
          <PollBlock post={post} currentUserId={currentUserId} onVote={onVote} />
        )}

        {post.imageUrl && <img src={post.imageUrl} alt="Minh họa bài viết" className="mt-4 max-h-80 w-full rounded-2xl object-cover" />}
        {post.type === 'event' && (post.eventStartAt || post.eventDate || post.eventEndAt || post.eventLocation) && (
          <div className={`mt-4 rounded-2xl px-4 py-3 text-sm font-black ${
            adminPost
              ? 'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200'
              : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-200'
          }`}>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/70 px-3 py-2 dark:bg-white/10">
                <p className="text-[10px] uppercase tracking-[0.14em] opacity-70">Thời gian mở</p>
                <p className="mt-1 text-slate-950 dark:text-white">🟢 {formatEventDateTime(post.eventStartAt || post.eventDate) || 'Chưa cập nhật'}</p>
              </div>

              <div className="rounded-2xl bg-white/70 px-3 py-2 dark:bg-white/10">
                <p className="text-[10px] uppercase tracking-[0.14em] opacity-70">Thời gian đóng</p>
                <p className="mt-1 text-slate-950 dark:text-white">🔴 {formatEventDateTime(post.eventEndAt) || 'Chưa cập nhật'}</p>
              </div>

              <div className="rounded-2xl bg-white/70 px-3 py-2 dark:bg-white/10 sm:col-span-2">
                <p className="text-[10px] uppercase tracking-[0.14em] opacity-70">Địa điểm / link tham gia</p>
                <p className="mt-1 break-words text-slate-950 dark:text-white">📍 {post.eventLocation || 'Chưa cập nhật'}</p>
              </div>

              {adminPost && (
                <div className="rounded-2xl bg-white/70 px-3 py-2 dark:bg-white/10 sm:col-span-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] opacity-70">Loại sự kiện</p>
                  <p className="mt-1 text-slate-950 dark:text-white">⭐ Sự kiện quản trị viên</p>
                </div>
              )}
            </div>
          </div>
        )}
        {showEventInterestToggle && (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5" onClick={(event) => event.stopPropagation()}>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onEventInterest(post, true)}
                className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                  eventInterested
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'bg-white text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200'
                }`}
              >
                Quan tâm
              </button>
              <button
                type="button"
                onClick={() => onEventInterest(post, false)}
                className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                  eventNotInterested
                    ? 'bg-slate-700 text-white dark:bg-slate-600'
                    : 'bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
                }`}
              >
                Không quan tâm
              </button>
            </div>
          </div>
        )}
        {post.attachmentUrl && <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-600 dark:bg-white/10 dark:text-slate-200">🔗 {post.attachmentName || post.attachmentUrl}</div>}
        {post.tags?.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{post.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 dark:bg-white/10 dark:text-slate-300">#{tag}</span>)}</div>}
      </div>

      <div className="flex flex-wrap items-center gap-1 border-t border-slate-200 px-3 py-3 sm:px-4 dark:border-white/10">
        <ReactionButton reaction={userReaction} summary={reactionSummary} disabled={liking} onReact={(reaction) => onLike(post, reaction)} />
        <ActionButton onClick={() => onOpen(post)} icon={MessageCircle} label={Number(post.commentsCount || 0)} />
        <ActionButton icon={Eye} label={Number(post.viewsCount || 0)} />
        <ActionButton active={saved} onClick={() => onSave(post)} icon={saved ? BookmarkCheck : Bookmark} label={saved ? 'Đã lưu' : 'Lưu'} count={saveCount} />
        <PostMoreMenu onReport={() => onReport(post)} />
        <button type="button" onClick={() => onShare(post)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"><Share2 className="h-5 w-5" /></button>
        {canDelete && <button type="button" onClick={() => onDelete(post)} className="rounded-xl p-2 text-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"><Trash2 className="h-5 w-5" /></button>}
      </div>
    </article>
  )
}


function PollBlock({ post, currentUserId, onVote }) {
  const [nowMs, setNowMs] = useState(Date.now())
  const pollVotes = post.pollVotes || {}
  const pollCounts = post.pollVotesCount || {}
  const selectedOptionId = currentUserId ? pollVotes[currentUserId] : ''
  const totalVotes = Object.values(pollCounts).reduce((sum, value) => sum + Number(value || 0), 0)
  const pollStatus = getPollStatus(post, nowMs)
  const pollClosed = pollStatus !== 'open'
  const statusClass = pollStatus === 'open'
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
    : pollStatus === 'not-started'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'
      : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="mt-4 rounded-3xl border border-fuchsia-100 bg-fuchsia-50 p-4 dark:border-fuchsia-400/20 dark:bg-blue-500/10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-black text-fuchsia-700 dark:text-fuchsia-200">📊 Bình chọn</p>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${statusClass}`}>
            {getPollStatusText(pollStatus)}
          </span>
          <p className="text-xs font-bold text-slate-400">{totalVotes} lượt</p>
        </div>
      </div>

      {(post.pollStartAt || post.pollEndAt) && (
        <div className="mb-3 grid gap-2 text-xs font-black sm:grid-cols-2">
          <div className="rounded-2xl bg-white/80 px-3 py-2 dark:bg-white/10">
            <p className="text-[10px] uppercase tracking-[0.14em] text-blue-500/75 dark:text-fuchsia-200/80">Thời gian mở</p>
            <p className="mt-1 text-slate-900 dark:text-white">🟢 {formatEventDateTime(post.pollStartAt) || 'Chưa cập nhật'}</p>
          </div>
          <div className="rounded-2xl bg-white/80 px-3 py-2 dark:bg-white/10">
            <p className="text-[10px] uppercase tracking-[0.14em] text-blue-500/75 dark:text-fuchsia-200/80">Thời gian đóng</p>
            <p className="mt-1 text-slate-900 dark:text-white">🔴 {formatEventDateTime(post.pollEndAt) || 'Chưa cập nhật'}</p>
          </div>
        </div>
      )}

      {pollStatus === 'not-started' && (
        <p className="mb-3 rounded-2xl bg-amber-100 px-3 py-2 text-xs font-black text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
          Bình chọn chưa mở, bạn chưa thể vote.
        </p>
      )}

      {pollStatus === 'ended' && (
        <p className="mb-3 rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 dark:bg-white/10 dark:text-slate-300">
          Bình chọn đã kết thúc, kết quả hiện ở bên dưới.
        </p>
      )}

      <div className="space-y-2">
        {(post.pollOptions || []).map((option) => {
          const count = Number(pollCounts[option.id] || 0)
          const percent = totalVotes ? Math.round((count / totalVotes) * 100) : 0
          const selected = selectedOptionId === option.id

          return (
            <button
              key={option.id}
              type="button"
              disabled={pollClosed}
              onClick={(event) => {
                event.stopPropagation()
                if (pollClosed) return
                onVote(post, option.id)
              }}
              className={`relative w-full overflow-hidden rounded-2xl border px-4 py-3 text-left transition ${
                pollClosed
                  ? 'cursor-not-allowed border-slate-200 bg-white/70 opacity-80 dark:border-white/10 dark:bg-slate-900/50'
                  : selected
                    ? 'border-fuchsia-400 bg-white dark:bg-slate-900'
                    : 'border-slate-200 bg-white hover:border-fuchsia-300 dark:border-white/10 dark:bg-slate-900/70 dark:hover:border-fuchsia-400/50'
              }`}
            >
              <span className="absolute inset-y-0 left-0 bg-blue-500/15 transition-all" style={{ width: `${percent}%` }} />
              <span className="relative flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-black text-slate-800 dark:text-white">
                  {selected ? '✓ ' : ''}{option.text}
                </span>
                <span className="shrink-0 text-xs font-black text-fuchsia-600 dark:text-fuchsia-200">
                  {percent}% · {count}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ReactionButton({ reaction, summary, disabled = false, onReact = () => {} }) {
  const [open, setOpen] = useState(false)
  const closeTimerRef = useRef(null)
  const holdTimerRef = useRef(null)
  const longPressedRef = useRef(false)
  const selected = REACTIONS.find((item) => item.value === reaction)
  const displayItems = summary.items.slice(0, 5)

  const openPicker = () => {
    window.clearTimeout(closeTimerRef.current)
    setOpen(true)
  }

  const closePickerSoon = () => {
    window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 180)
  }

  const clearHoldTimer = () => {
    window.clearTimeout(holdTimerRef.current)
    holdTimerRef.current = null
  }

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse') return
    longPressedRef.current = false
    clearHoldTimer()
    holdTimerRef.current = window.setTimeout(() => {
      longPressedRef.current = true
      setOpen(true)
    }, 450)
  }

  const handlePointerUp = (event) => {
    if (event.pointerType === 'mouse') return
    clearHoldTimer()
  }

  useEffect(() => {
    return () => {
      window.clearTimeout(closeTimerRef.current)
      window.clearTimeout(holdTimerRef.current)
    }
  }, [])

  return (
    <div className="relative" onMouseEnter={openPicker} onMouseLeave={closePickerSoon}>
      {open && (
        <div className="absolute bottom-[calc(100%-2px)] left-0 z-30 flex gap-1 rounded-full border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-white/10 dark:bg-slate-900">
          {VISIBLE_REACTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              title={item.label}
              onClick={(event) => {
                event.stopPropagation()
                onReact(item.value)
                setOpen(false)
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition hover:-translate-y-1 hover:scale-125 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              {item.emoji}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={disabled}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={clearHoldTimer}
        onClick={(event) => {
          event.stopPropagation()
          if (longPressedRef.current) {
            longPressedRef.current = false
            return
          }
          onReact(reaction || 'love')
        }}
        className={`inline-flex touch-manipulation items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
          reaction
            ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-200'
            : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'
        }`}
      >
        <span className="flex -space-x-1">
          {displayItems.length ? displayItems.map((item) => <span key={item.value}>{item.emoji}</span>) : <span>{selected?.emoji || '❤️'}</span>}
        </span>
        <span>{summary.total || 0}</span>
      </button>
    </div>
  )
}

function MiniReactionButton({ reaction, summary, onReact = () => {} }) {
  const [open, setOpen] = useState(false)
  const closeTimerRef = useRef(null)
  const holdTimerRef = useRef(null)
  const longPressedRef = useRef(false)
  const selected = REACTIONS.find((item) => item.value === reaction)
  const displayItems = summary.items.slice(0, 5)

  const openPicker = () => {
    window.clearTimeout(closeTimerRef.current)
    setOpen(true)
  }

  const closePickerSoon = () => {
    window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 180)
  }

  const clearHoldTimer = () => {
    window.clearTimeout(holdTimerRef.current)
    holdTimerRef.current = null
  }

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse') return
    longPressedRef.current = false
    clearHoldTimer()
    holdTimerRef.current = window.setTimeout(() => {
      longPressedRef.current = true
      setOpen(true)
    }, 450)
  }

  const handlePointerUp = (event) => {
    if (event.pointerType === 'mouse') return
    clearHoldTimer()
  }

  useEffect(() => {
    return () => {
      window.clearTimeout(closeTimerRef.current)
      window.clearTimeout(holdTimerRef.current)
    }
  }, [])

  return (
    <div className="relative" onMouseEnter={openPicker} onMouseLeave={closePickerSoon}>
      {open && (
        <div className="absolute bottom-[calc(100%-2px)] left-0 z-30 flex gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-slate-900">
          {VISIBLE_REACTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              title={item.label}
              onClick={(event) => {
                event.stopPropagation()
                onReact(item.value)
                setOpen(false)
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition hover:-translate-y-1 hover:scale-125 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              {item.emoji}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={clearHoldTimer}
        onClick={(event) => {
          event.stopPropagation()
          if (longPressedRef.current) {
            longPressedRef.current = false
            return
          }
          onReact(reaction || 'love')
        }}
        className={`inline-flex touch-manipulation items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black transition ${
          reaction
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200'
            : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
        }`}
      >
        <span className="flex -space-x-1">
          {displayItems.length ? displayItems.map((item) => <span key={item.value}>{item.emoji}</span>) : <span>{selected?.emoji || '♡'}</span>}
        </span>
        {summary.total ? <span>{summary.total}</span> : null}
      </button>
    </div>
  )
}

function PostMoreMenu({ onReport }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onReport?.()
      }}
      className="relative ml-auto rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-white/10 dark:hover:text-rose-300"
      title="Báo cáo bài viết"
      aria-label="Báo cáo bài viết"
    >
      <Flag className="h-5 w-5" />
    </button>
  )
}

function ActionButton({ icon: Icon, label, count, active, disabled = false, onClick = () => {} }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-200'
          : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'
      }`}
    >
      <Icon className={`h-4 w-4 ${active ? 'fill-current' : ''}`} />
      <span>{label}</span>
      {count !== undefined && (
        <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums ${active ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-100' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'}`}>
          {Number(count || 0).toLocaleString('vi-VN')}
        </span>
      )}
    </button>
  )
}

function EmptyState({ icon, title, description, actionLabel, onAction }) {
  return <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center dark:border-white/10 dark:bg-white/5"><div className="text-5xl">{icon}</div><h3 className="mt-4 text-xl font-black text-slate-950 dark:text-white">{title}</h3><p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{description}</p>{actionLabel && <button type="button" onClick={onAction} className="mt-5 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white">{actionLabel}</button>}</div>
}

function GroupsGrid({ groups, currentUserId, roleKey, onJoin, onOpenChat, onDelete }) {
  // Kept for compatibility - not used when DiscordGroupsLayout is active
  return null
}

function GroupCard({ group, joined, canDelete = false, onJoin, onOpenChat, onDelete }) {
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// DISCORD-STYLE GROUPS LAYOUT
// ─────────────────────────────────────────────────────────────────────────────

function getGroupTypeKey(group = {}) {
  const groupType = group.groupType || group.type || group.privacy || group.visibility || (group.isPrivate ? 'private' : 'public')
  if (group.isHidden || ['hidden', 'not_public', 'non_public', 'khong_cong_khai'].includes(String(groupType))) return 'hidden'
  if (groupType === 'invite_only' || groupType === 'invite') return 'invite_only'
  if (groupType === 'private' || group.isPrivate) return 'private'
  return 'public'
}

function PersonalAdminPanel({ users = [], currentUserId = '', search = '', onSearchChange = () => {}, onToggleRestriction = () => {} }) {
  const keyword = normalizeText(search.trim())
  const visibleUsers = users
    .filter((user) => user.id !== currentUserId)
    .filter((user) => {
      if (!keyword) return true
      return [user.fullName, user.displayName, user.name, user.email, user.className, user.class, user.lop]
        .some((value) => normalizeText(value).includes(keyword))
    })
    .sort((a, b) => normalizeText(a.fullName || a.displayName || a.name || a.email).localeCompare(normalizeText(b.fullName || b.displayName || b.name || b.email)))

  const blockedPostingCount = users.filter((user) => user.forumRestrictions?.blockCommunityPosting).length
  const blockedGroupCount = users.filter((user) => user.forumRestrictions?.blockGroupCreation).length

  return (
    <div className="space-y-4 text-slate-950 dark:text-white">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/20">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Tổng tài khoản</p>
          <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{users.length}</p>
        </div>
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 shadow-sm transition-colors dark:border-rose-400/25 dark:bg-rose-500/10 dark:shadow-black/20">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-400">Chặn đăng bài</p>
          <p className="mt-2 text-3xl font-black text-rose-600 dark:text-rose-200">{blockedPostingCount}</p>
        </div>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm transition-colors dark:border-amber-400/25 dark:bg-amber-500/10 dark:shadow-black/20">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-500">Chặn tạo nhóm</p>
          <p className="mt-2 text-3xl font-black text-amber-600 dark:text-amber-200">{blockedGroupCount}</p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/20">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
              <UserX className="h-4 w-4" /> Quản lý cá nhân
            </div>
            <h3 className="mt-2 text-xl font-black text-slate-950 dark:text-white">Quyền hoạt động cộng đồng</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">Danh sách được đồng bộ trực tiếp từ Firebase.</p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Tìm tên, email, lớp..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white dark:border-white/10 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400/70 dark:focus:bg-slate-950" />
          </div>
        </div>

        <div className="space-y-3">
          {visibleUsers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-bold text-slate-400 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-500">Không tìm thấy người dùng phù hợp.</div>
          ) : visibleUsers.map((user) => {
            const name = user.fullName || user.displayName || user.name || user.email?.split('@')[0] || 'Người dùng ZUNY'
            const role = getRoleKey(user.role || user.userRole || user.type)
            const restrictions = user.forumRestrictions || {}
            const avatar = user.photoURL || user.avatarUrl || user.avatarURL || user.avatar || user.profileImage || ''
            const protectedAdmin = role === 'admin_dev'
            return (
              <div key={user.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-blue-200 hover:bg-white dark:border-white/10 dark:bg-slate-950/50 dark:hover:border-blue-400/30 dark:hover:bg-slate-900/90">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 to-blue-500 text-sm font-black text-white">
                      {avatar ? <img src={avatar} alt={name} className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center">{getInitials(name, user.email)}</span>}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-black text-slate-950 dark:text-white">{name}</p>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-600 dark:bg-white/10 dark:text-slate-300">{roleText[role] || 'Thành viên'}</span>
                      </div>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-400">{user.email || 'Không có email'}{user.className || user.class || user.lop ? ` • ${user.className || user.class || user.lop}` : ''}</p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:w-[520px]">
                    <RestrictionToggle icon={ShieldBan} label="Chặn đăng ở cộng đồng" description="Không thể tạo bài viết mới" active={Boolean(restrictions.blockCommunityPosting)} disabled={protectedAdmin} onChange={(blocked) => onToggleRestriction(user, 'blockCommunityPosting', blocked)} />
                    <RestrictionToggle icon={Users} label="Chặn tạo nhóm" description="Không thể tạo nhóm học mới" active={Boolean(restrictions.blockGroupCreation)} disabled={protectedAdmin} onChange={(blocked) => onToggleRestriction(user, 'blockGroupCreation', blocked)} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function RestrictionToggle({ icon: Icon, label, description, active, disabled, onChange }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!active)} className={`flex items-center justify-between gap-3 rounded-2xl border p-3 text-left transition-colors ${active ? 'border-rose-300 bg-rose-50 text-rose-950 hover:bg-rose-100 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-white dark:hover:bg-rose-500/15' : 'border-slate-200 bg-white text-slate-900 hover:border-blue-300 hover:bg-blue-50 dark:border-white/10 dark:bg-slate-900/80 dark:text-white dark:hover:border-blue-400/30 dark:hover:bg-white/10'} disabled:cursor-not-allowed disabled:opacity-50`}>
      <div className="flex min-w-0 items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${active ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}><Icon className="h-4 w-4" /></span>
        <span className="min-w-0"><span className="block text-xs font-black text-slate-800 dark:text-white">{label}</span><span className="mt-0.5 block text-[10px] font-bold text-slate-400">{disabled ? 'Tài khoản được bảo vệ' : description}</span></span>
      </div>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${active ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-700'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${active ? 'left-6' : 'left-1'}`} /></span>
    </button>
  )
}

function GroupAdminPanel({ mode = 'stats', groups = [], reports = [], onJoinReportedGroup, onDeleteGroup, onWarnOwner, onResolveGroupReport }) {
  const activeGroups = groups.filter((group) => !group.isSample && !group.deleted && !group.isDeleted && group.status !== 'deleted')
  const stats = activeGroups.reduce(
    (acc, group) => {
      const key = getGroupTypeKey(group)
      acc.total += 1
      acc[key] = Number(acc[key] || 0) + 1
      return acc
    },
    { total: 0, public: 0, private: 0, invite_only: 0, hidden: 0 },
  )

  const reportGroups = reports.reduce((acc, report) => {
    const key = report.groupId || report.id
    if (!acc[key]) acc[key] = { groupId: report.groupId, groupName: report.groupName, groupDescription: report.groupDescription, groupOwnerId: report.groupOwnerId, groupOwnerName: report.groupOwnerName, reports: [] }
    acc[key].reports.push(report)
    return acc
  }, {})

  if (mode === 'reports') {
    const items = Object.values(reportGroups)
    if (!items.length) return <EmptyState icon="🚩" title="Chưa có nhóm bị báo cáo" description="Khi người dùng báo cáo nhóm học, báo cáo sẽ xuất hiện tại đây." />

    return (
      <div className="space-y-4">
        {items.map((item) => {
          const group = groups.find((entry) => entry.id === item.groupId) || { id: item.groupId, name: item.groupName, description: item.groupDescription, ownerId: item.groupOwnerId }
          const latest = item.reports[0] || {}
          return (
            <article key={item.groupId} className="rounded-3xl border border-rose-200 bg-white p-5 shadow-sm dark:border-rose-400/20 dark:bg-white/5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">🚩 Nhóm bị báo cáo · {item.reports.length}</div>
                  <h3 className="text-xl font-black text-slate-950 dark:text-white">{item.groupName || group.name || 'Nhóm học'}</h3>
                  <p className="mt-1 text-xs font-bold text-slate-400">Báo cáo mới nhất: {latest.reporterName || 'Người dùng'} · {formatRelativeTime(latest.createdAt)}</p>
                </div>
                <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">{latest.reason || 'Không rõ lý do'}</span>
              </div>

              <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-7 text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">{item.groupDescription || group.description || 'Nhóm chưa có mô tả.'}</p>

              <div className="mt-4 grid gap-2">
                {item.reports.slice(0, 4).map((report) => (
                  <div key={report.id} className="rounded-2xl border border-rose-100 bg-rose-50/70 p-3 text-sm font-bold text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-100">
                    <p>{report.reporterName || 'Người dùng'}: {report.reason || 'Không rõ lý do'}</p>
                    {report.detail && <p className="mt-1 text-xs opacity-80">{report.detail}</p>}
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => onJoinReportedGroup(group)} className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-700">Tham gia nhóm</button>
                <button type="button" onClick={() => onWarnOwner(group, latest)} className="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-black text-white transition hover:bg-amber-600">Viết cảnh báo</button>
                <button type="button" onClick={() => onResolveGroupReport(group, item.reports.map((report) => report.id))} className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700">Đã giải quyết</button>
                <button type="button" onClick={() => onDeleteGroup(group)} className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-black text-white transition hover:bg-rose-700">Xóa nhóm</button>
              </div>
            </article>
          )
        })}
      </div>
    )
  }

  const pieStyle = {
    background: `conic-gradient(#8b5cf6 0 ${stats.total ? (stats.public / stats.total) * 100 : 0}%, #06b6d4 0 ${stats.total ? ((stats.public + stats.private) / stats.total) * 100 : 0}%, #f59e0b 0 ${stats.total ? ((stats.public + stats.private + stats.invite_only) / stats.total) * 100 : 0}%, #ef4444 0 100%)`,
  }

  const cards = [
    ['Tổng số nhóm', stats.total, '👥'],
    ['Nhóm công khai', stats.public, '🌍'],
    ['Nhóm riêng tư', stats.private, '🔒'],
    ['Nhóm mời qua mã', stats.invite_only, '✉️'],
    ['Nhóm không công khai', stats.hidden, '🕶️'],
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value, icon]) => (
          <div key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
            <p className="text-2xl">{icon}</p>
            <p className="mt-3 text-sm font-black text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{Number(value).toLocaleString('vi-VN')}</p>
          </div>
        ))}
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
        <h3 className="text-lg font-black text-slate-950 dark:text-white">Biểu đồ loại nhóm</h3>
        <div className="mx-auto mt-6 h-48 w-48 rounded-full shadow-inner" style={pieStyle} />
        <div className="mt-5 grid gap-2 text-xs font-bold text-slate-500 dark:text-slate-300">
          <span>🟣 Công khai</span><span>🔵 Riêng tư</span><span>🟠 Mời qua mã</span><span>🔴 Không công khai</span>
        </div>
      </div>
    </div>
  )
}

function AdminReviewList({ mode = 'pending', posts, reports = [], onApprove, onReject, onOpen, onResolveReport, onDeleteReportedPost }) {
  if (mode === 'reported') {
    if (!reports.length) {
      return (
        <EmptyState
          icon="🚩"
          title="Không có bài bị báo cáo"
          description="Khi người dùng báo cáo bài viết, báo cáo sẽ xuất hiện tại đây."
        />
      )
    }

    return (
      <div className="space-y-4">
        {reports.map((report) => (
          <article key={report.id} className="rounded-3xl border border-rose-200 bg-white p-5 shadow-sm dark:border-rose-400/20 dark:bg-white/5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
                  🚩 Bài bị báo cáo
                </div>
                <h3 className="text-xl font-black text-slate-950 dark:text-white">{report.postTitle || 'Bài viết'}</h3>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  Người báo cáo: {report.reporterName || 'Người dùng'} · {formatRelativeTime(report.createdAt)}
                </p>
              </div>
              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
                {report.reason || 'Không rõ lý do'}
              </span>
            </div>

            <p className="mt-4 line-clamp-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-7 text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
              {report.postContent || 'Không có nội dung xem trước.'}
            </p>

            {report.detail && (
              <div className="mt-3 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
                Ghi chú báo cáo: {report.detail}
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => onOpen({ id: report.postId, title: report.postTitle, content: report.postContent, scope: report.scope })} className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-600 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15">
                Xem bài
              </button>
              <button type="button" onClick={() => onResolveReport(report)} className="rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-black text-white transition hover:bg-cyan-700">
                Đánh dấu đã xử lý
              </button>
              <button type="button" onClick={() => onDeleteReportedPost(report)} className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-black text-white transition hover:bg-rose-700">
                Xóa bài
              </button>
            </div>
          </article>
        ))}
      </div>
    )
  }

  if (!posts.length) {
    return (
      <EmptyState
        icon="🛡️"
        title="Không có bài chờ duyệt"
        description="Khi người dùng đăng bài vào cộng đồng ZUNY, bài sẽ xuất hiện tại đây để admin_dev duyệt."
      />
    )
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => {
        const type = POST_TYPES.find((item) => item.value === post.type) || POST_TYPES[2]
        const TypeIcon = type.icon

        return (
          <article key={post.id} className="rounded-3xl border border-amber-200 bg-white p-5 shadow-sm dark:border-amber-400/20 dark:bg-white/5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                  ⏳ Chờ duyệt
                </div>
                <h3 className="text-xl font-black text-slate-950 dark:text-white">{post.title}</h3>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  {post.authorName || 'Người dùng ZUNY'} · {formatRelativeTime(post.createdAt)}
                </p>
              </div>
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${type.color}`}>
                <TypeIcon className="h-3.5 w-3.5" />
                {type.label}
              </span>
            </div>

            <p className="mt-4 line-clamp-3 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">{post.content}</p>

            {post.tags?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 dark:bg-white/10 dark:text-slate-300">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => onOpen(post)} className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-600 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15">
                Xem trước
              </button>
              <button type="button" onClick={() => onReject(post)} className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-black text-white transition hover:bg-rose-700">
                Từ chối
              </button>
              <button type="button" onClick={() => onApprove(post)} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Duyệt bài
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function NotificationList({ notifications, onRead = () => {}, onDelete = () => {} }) {
  if (!notifications.length) {
    return (
      <EmptyState
        icon="🔔"
        title="Chưa có thông báo"
        description="Khi có thông báo duyệt bài, quản trị viên hoặc sự kiện, thông báo sẽ hiện ở đây."
      />
    )
  }

  return (
    <div className="space-y-3">
      {notifications.map((item) => (
        <div
          key={item.id}
          className={`flex w-full items-start gap-3 rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
            item.category === 'admin' || item.isAdminNotice
              ? item.read
                ? 'border-amber-200 bg-amber-50/70 shadow-amber-100/50 dark:border-amber-400/20 dark:bg-amber-500/10 dark:shadow-amber-500/10'
                : 'border-amber-300 bg-amber-50 shadow-lg shadow-amber-200/50 dark:border-amber-400/40 dark:bg-amber-500/15 dark:shadow-amber-500/10'
              : item.read
                ? 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/5'
                : 'border-blue-300 bg-blue-50 dark:border-blue-400/30 dark:bg-blue-500/10'
          }`}
        >
          {!item.read ? (
            <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
          ) : (
            <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-transparent" />
          )}

          <button type="button" onClick={() => onRead(item)} className="min-w-0 flex-1 text-left">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                item.category === 'event' || item.type === 'event'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200'
                  : item.category === 'admin' || item.type === 'admin'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200'
              }`}>
                {item.category === 'event' || item.type === 'event'
                  ? 'Sự kiện'
                  : item.category === 'admin' || item.type === 'admin'
                    ? 'Quản trị viên'
                    : 'Bài viết'}
              </span>
              {!item.read && <span className="text-[10px] font-black text-cyan-500">Chưa đọc</span>}
            </div>

            <p className="text-sm font-bold text-slate-800 dark:text-white">{item.text}</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">{formatRelativeTime(item.createdAt)}</p>
          </button>

          <button
            type="button"
            onClick={() => onDelete(item)}
            title="Xóa thông báo"
            className="shrink-0 rounded-xl p-2 text-rose-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}


function NotificationPopup({ notification, onClose, onGoToPost = () => {} }) {
  if (!notification) return null

  const isEvent = notification.category === 'event' || notification.type === 'event'
  const isAdmin = notification.category === 'admin' || notification.type === 'admin'

  return (
    <div
      className="fixed inset-0 z-[9999] flex cursor-pointer items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="relative w-[min(92vw,430px)] cursor-default rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label="Đóng"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="pr-10">
          <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-xl ${
            isEvent
              ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-200'
              : isAdmin
                ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-200'
                : 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-200'
          }`}>
            {isEvent ? '🗓️' : isAdmin ? '🛡️' : '🔔'}
          </div>

          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-cyan-300">
            {isEvent ? 'Thông báo sự kiện' : isAdmin ? 'Thông báo quản trị viên' : 'Thông báo bài viết'}
          </p>

          <h3 className="mt-2 text-xl font-black text-slate-950 dark:text-white">
            {notification.title || 'Thông báo mới'}
          </h3>
        </div>

        <p className="mt-4 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
          {notification.text}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-slate-400">
            {formatRelativeTime(notification.createdAt)}
          </p>

          {notification.postId && !['post-deleted', 'admin-delete-post', 'post-deleted-by-admin'].includes(notification.type) && (
            <button
              type="button"
              onClick={onGoToPost}
              className="rounded-2xl bg-blue-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
            >
              Chuyển hướng
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function RightSidebar({ posts, groups, profile, currentUserId = '', onOpenPost }) {
  const [hotVisible, setHotVisible] = useState(6)
  const [nowMs, setNowMs] = useState(Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const [eventsVisible, setEventsVisible] = useState(4)


  const listScrollClass = 'pr-2 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(139,92,246,0.65)_rgba(15,23,42,0.35)] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-800/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-blue-500/70 [&::-webkit-scrollbar-thumb:hover]:bg-blue-400'

  const hotTopics = useMemo(() => {
    const counts = new Map()

    posts.forEach((post) => {
      ;(post.tags || []).forEach((tag) => {
        const name = String(tag).trim()
        if (!name) return
        counts.set(name, (counts.get(name) || 0) + 1)
      })
    })

    return Array.from(counts.entries())
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score)
  }, [posts])


  const upcomingEvents = useMemo(() => posts
    .filter((post) => post.type === 'event' && (post.eventStartAt || post.eventDate))
    .filter((post) => {
      if ((post.status || 'approved') !== 'approved') return false

      const endMs = getEventEndMs(post)
      const isAdminPost = post.eventCreatedByAdmin || post.authorRole === 'admin_dev'
      const interested = (post.eventInterestedBy || []).includes(currentUserId)
      const notInterested = (post.eventNotInterestedBy || []).includes(currentUserId)

      return Boolean(endMs && endMs > nowMs && (isAdminPost || (interested && !notInterested)))
    })
    .sort((a, b) => {
      const aAdmin = Number(Boolean(a.eventCreatedByAdmin || a.authorRole === 'admin_dev'))
      const bAdmin = Number(Boolean(b.eventCreatedByAdmin || b.authorRole === 'admin_dev'))
      if (aAdmin !== bAdmin) return bAdmin - aAdmin

      const aInterested = Number((a.eventInterestedBy || []).includes(currentUserId))
      const bInterested = Number((b.eventInterestedBy || []).includes(currentUserId))
      if (aInterested !== bInterested) return bInterested - aInterested

      return getEventStartMs(a) - getEventStartMs(b)
    })
    .map((post, index) => {
      const adminEvent = Boolean(post.eventCreatedByAdmin || post.authorRole === 'admin_dev')
      const interested = (post.eventInterestedBy || []).includes(currentUserId)
      return {
        id: post.id,
        title: post.title,
        time: `${formatEventDateTime(post.eventStartAt || post.eventDate)}${post.eventEndAt ? ` → ${formatEventDateTime(post.eventEndAt)}` : ''}`,
        color: adminEvent ? 'bg-amber-400' : interested ? 'bg-emerald-400' : ['bg-rose-500', 'bg-sky-500', 'bg-amber-500', 'bg-cyan-500'][index % 4],
        adminEvent,
        interested,
        post,
      }
    }), [posts, currentUserId, nowMs])

  const visibleHotTopics = hotTopics.slice(0, hotVisible)
  const visibleEvents = upcomingEvents.slice(0, eventsVisible)

  return (
    <aside className="hidden w-[300px] space-y-4 xl:block">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
        <h3 className="mb-4 flex items-center gap-2 font-black text-slate-950 dark:text-white">
          <span>🔥</span>
          Chủ đề nóng
        </h3>

<div
  className={`${listScrollClass} space-y-3`}
  style={{
    maxHeight: hotTopics.length > 6 ? '240px' : 'auto',
  }}
>          {visibleHotTopics.length ? visibleHotTopics.map((topic, index) => (
            <div key={topic.name} className="flex items-center gap-3">
              <span className="w-4 text-center text-xs font-black text-slate-400">{index + 1}</span>
              <span className="max-w-[130px] truncate rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
                {topic.name}
              </span>
<span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-slate-400">
  <TrendingUp className="h-3 w-3" />
  {Math.round(topic.score)}
</span>            </div>
          )) : (
            <p className="text-sm font-semibold text-slate-400">Chưa có chủ đề nóng.</p>
          )}
        </div>

        {hotTopics.length > hotVisible && (
          <button type="button" onClick={() => setHotVisible((value) => value + 6)} className="mt-4 text-sm font-bold text-blue-500 hover:text-blue-400">
            Xem thêm ›
          </button>
        )}
      </div>


      <div className="cursor-pointer rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
        <h3 className="mb-4 flex items-center gap-2 font-black text-slate-950 dark:text-white">
          <span>🗓️</span>
          Sự kiện sắp tới
        </h3>

<div
  className={`${listScrollClass} space-y-4`}
  style={{
    maxHeight: upcomingEvents.length > 4 ? '220px' : 'auto',
  }}
>          {visibleEvents.length ? visibleEvents.map((event) => (
            <button key={event.id} type="button" onClick={() => onOpenPost(event.post)} className={`flex w-full gap-3 rounded-2xl p-2 text-left transition hover:bg-slate-100 dark:hover:bg-white/10 ${
              event.adminEvent
                ? 'border border-amber-300 bg-amber-50 shadow-lg shadow-amber-200/40 dark:border-amber-400/30 dark:bg-amber-500/10 dark:shadow-amber-500/10'
                : event.interested
                  ? 'border border-emerald-300 bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-500/10'
                  : ''
            }`}>
              <div className={`w-1 shrink-0 rounded-full ${event.color}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-900 dark:text-white">{event.title}</p>
                <p className="text-xs font-semibold text-slate-400">{event.time}</p>
                {event.adminEvent && <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-500">Ghim bởi admin_dev</p>}
                {!event.adminEvent && event.interested && <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-500">Bạn quan tâm</p>}
              </div>
            </button>
          )) : <p className="text-sm font-semibold text-slate-400">Chưa có sự kiện sắp tới.</p>}
        </div>

        {upcomingEvents.length > eventsVisible && (
          <button type="button" onClick={() => setEventsVisible((value) => value + 6)} className="mt-4 text-sm font-bold text-blue-500 hover:text-blue-400">
            Xem thêm ›
          </button>
        )}
      </div>

    </aside>
  )
}

function ProfileAvatar({ src, initials, className = 'h-12 w-12' }) {
  const [failed, setFailed] = useState(false)
  if (src && !failed) {
    return <img src={src} alt="Ảnh đại diện" onError={() => setFailed(true)} className={`${className} rounded-2xl object-cover ring-1 ring-slate-200 dark:ring-white/10`} />
  }
  return <span className={`${className} flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-500 text-sm font-black text-white`}>{initials || 'U'}</span>
}

function UserProfilePopup({ user, onClose, onOpenLibrary, onOpenLeaderboard }) {
  if (!user) return null
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-sm rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900 sm:p-6" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <ProfileAvatar src={user.avatarUrl} initials={user.initials} className="h-16 w-16" />
            <div className="min-w-0"><h3 className="truncate text-xl font-black text-slate-950 dark:text-white">{user.name}</h3><p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">{roleText[user.role] || 'Thành viên'}{user.className ? ` • ${user.className}` : ''}</p></div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-6 grid gap-3">
          <button type="button" onClick={() => onOpenLibrary(user.uid)} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700">Tài khoản trong Thư viện</button>
        </div>
      </div>
    </div>
  )
}

function MobileNav({ activeSection, unreadNotificationsCount = 0, onChange, onCompose }) {
  const items = [
    { id: SECTIONS.HALL, icon: Globe2, label: 'Sảnh' },
    { id: SECTIONS.GROUPS, icon: Users, label: 'Nhóm' },
    { id: SECTIONS.ACCOUNT, icon: FileText, label: 'Tài khoản', badge: unreadNotificationsCount },
  ]

  return <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 lg:hidden">{items.map((item) => { const Icon = item.icon; const active = activeSection === item.id; return <button key={item.id} type="button" onClick={() => onChange(item.id)} className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-black ${active ? 'text-blue-600 dark:text-blue-200' : 'text-slate-400'}`}><span className="relative"><Icon className="h-5 w-5" />{item.badge > 0 && <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-400 px-1 text-[9px] font-black text-white">{item.badge > 999 ? '999+' : item.badge}</span>}</span>{item.label}</button> })}<button type="button" onClick={onCompose} className="flex flex-col items-center gap-1 rounded-2xl bg-blue-600 px-3 py-2 text-[11px] font-black text-white"><Plus className="h-5 w-5" />Đăng</button></div>
}

function PostModal({ open, onClose, onSubmit, groups, roleKey, displayName, initials, avatarUrl = '' }) {
  const initialForm = {
    title: '', content: '', type: 'discuss', tags: [], tagDraft: '#', scope: 'hall', groupId: '',
    attachmentUrl: '', attachmentName: '', imageUrl: '', imageFileName: '', showImageInput: false,
    isAnonymous: false, teacherOnly: false, eventStartAt: '', eventEndAt: '', eventDate: '', eventLocation: '',
    pollStartAt: '', pollEndAt: '', pollOptions: ['', ''],
  }
  const [form, setForm] = useState(initialForm)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkForm, setLinkForm] = useState({ url: '', label: '' })
  const [activeEditorTools, setActiveEditorTools] = useState(['align-left'])
  const [assetUrl, setAssetUrl] = useState('')
  const editorRef = useRef(null)
  const uploadInputRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const updateToolbarFromSelection = () => {
      const editor = editorRef.current
      const selection = window.getSelection?.()
      if (!editor || !selection || selection.rangeCount === 0) return

      const anchorNode = selection.anchorNode
      const focusNode = selection.focusNode
      if (!editor.contains(anchorNode) && !editor.contains(focusNode)) return

      const next = []
      if (document.queryCommandState('bold')) next.push('bold')
      if (document.queryCommandState('italic')) next.push('italic')
      if (document.queryCommandState('underline')) next.push('underline')

      if (document.queryCommandState('justifyCenter')) next.push('align-center')
      else if (document.queryCommandState('justifyRight')) next.push('align-right')
      else next.push('align-left')

      setActiveEditorTools((current) => {
        if (linkOpen) next.push('link')
        return current.length === next.length && current.every((item, index) => item === next[index]) ? current : next
      })
    }

    document.addEventListener('selectionchange', updateToolbarFromSelection)
    return () => document.removeEventListener('selectionchange', updateToolbarFromSelection)
  }, [open, linkOpen])

  useEffect(() => {
    if (!open) return
    setActiveEditorTools(['align-left'])
    window.setTimeout(() => {
      if (!editorRef.current || editorRef.current.innerHTML.trim()) return
      editorRef.current.focus()
      document.execCommand('removeFormat', false)
      document.execCommand('justifyLeft', false)
      editorRef.current.blur()
    }, 0)
  }, [open])

  if (!open) return null
  const resetForm = () => { setForm({ ...initialForm }); setLinkOpen(false); setLinkForm({ url: '', label: '' }); setActiveEditorTools(['align-left']); setAssetUrl('') }
  const typeButtons = [
    { value: 'discuss', label: 'Thảo luận', icon: '💬', short: 'Trao đổi, chia sẻ', helper: 'Trao đổi mở, chia sẻ quan điểm và cùng nhau phân tích vấn đề.' },
    { value: 'question', label: 'Hỏi đáp', icon: '❓', short: 'Đặt câu hỏi', helper: 'Đặt câu hỏi rõ ràng để giáo viên hoặc bạn học hỗ trợ nhanh hơn.' },
    { value: 'announce', label: 'Thông báo', icon: '📢', short: 'Thông tin quan trọng', helper: 'Thông tin quan trọng, ngắn gọn, dễ đọc và có hành động rõ ràng.' },
    { value: 'event', label: 'Sự kiện', icon: '🗓️', short: 'Khởi tạo sự kiện', helper: 'Tạo sự kiện có thời gian mở, đóng và địa điểm tham gia.' },
    { value: 'poll', label: 'Bình chọn', icon: '📊', short: 'Tạo bình chọn', helper: 'Tạo câu hỏi bình chọn với ít nhất hai lựa chọn.' },
  ]
  const currentType = typeButtons.find((item) => item.value === form.type) || typeButtons[0]
  const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 dark:border-blue-300/15 dark:bg-[#08162d] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400/70 dark:focus:bg-[#0a1a35]'
  const panelClass = 'rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm dark:border-blue-300/15 dark:bg-[#07142a]/80 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]'

  const syncEditor = () => setForm((prev) => ({ ...prev, content: editorRef.current?.innerHTML || '' }))
  const updateToolbarFromCurrentSelection = () => {
    const next = []
    if (document.queryCommandState('bold')) next.push('bold')
    if (document.queryCommandState('italic')) next.push('italic')
    if (document.queryCommandState('underline')) next.push('underline')
    if (document.queryCommandState('justifyCenter')) next.push('align-center')
    else if (document.queryCommandState('justifyRight')) next.push('align-right')
    else next.push('align-left')
    if (linkOpen) next.push('link')
    setActiveEditorTools(next)
  }
  const toggleEditorTool = (key, command) => {
    const editor = editorRef.current
    if (!editor) return

    editor.focus()
    const isActive = activeEditorTools.includes(key)
    const isAlignment = key.startsWith('align-')

    if (isAlignment) {
      if (isActive && key !== 'align-left') document.execCommand('justifyLeft', false)
      else if (key === 'align-left') document.execCommand('justifyLeft', false)
      else if (key === 'align-center') document.execCommand('justifyCenter', false)
      else document.execCommand('justifyRight', false)
    } else {
      document.execCommand(command, false)
    }

    syncEditor()
    window.setTimeout(updateToolbarFromCurrentSelection, 0)
  }
  const insertLink = () => {
    const url = String(linkForm.url || '').trim()
    const label = String(linkForm.label || '').trim()
    if (!url || !label) return toast.error('Vui lòng nhập tên và đường dẫn liên kết')
    if (!/^https:\/\/[^\s]+$/i.test(url)) return toast.error('Liên kết phải bắt đầu đúng bằng https://')
    try {
      const parsedUrl = new URL(url)
      if (parsedUrl.protocol !== 'https:') throw new Error('INVALID_PROTOCOL')
    } catch {
      return toast.error('Đường dẫn liên kết không hợp lệ')
    }
    editorRef.current?.focus()
    document.execCommand('insertHTML', false, `<a href="${url.replace(/"/g, '&quot;')}" rel="noopener noreferrer">${label.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</a>&nbsp;`)
    syncEditor()
    setLinkOpen(false)
    setActiveEditorTools((current) => current.filter((item) => item !== 'link'))
    setLinkForm({ url: '', label: '' })
  }
  const addTag = () => {
    const tag = form.tagDraft.replace(/^#+/, '').trim()
    if (!tag || form.tags.includes(tag)) return setForm({ ...form, tagDraft: '#' })
    setForm({ ...form, tags: [...form.tags, tag].slice(0, 8), tagDraft: '#' })
  }
  const updatePollOption = (index, value) => {
    const nextOptions = [...form.pollOptions]; nextOptions[index] = value; setForm({ ...form, pollOptions: nextOptions })
  }
  const handleUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const isImage = file.type?.startsWith('image/')
    const isZip = file.type === 'application/zip' || file.type === 'application/x-zip-compressed' || file.name.toLowerCase().endsWith('.zip')
    if (!isImage && !isZip) { toast.error('Chỉ hỗ trợ hình ảnh hoặc file ZIP'); event.target.value = ''; return }
    const reader = new FileReader()
    reader.onload = () => {
      if (isImage) setForm((prev) => ({ ...prev, imageUrl: String(reader.result || ''), imageFileName: file.name, showImageInput: true }))
      else setForm((prev) => ({ ...prev, attachmentUrl: String(reader.result || ''), attachmentName: file.name }))
      toast.success(`Đã tải lên: ${file.name}`)
    }
    reader.onerror = () => toast.error('Không thể đọc tệp đã chọn')
    reader.readAsDataURL(file)
  }
  const addAssetFromUrl = () => {
    const url = String(assetUrl || '').trim()
    if (!/^https:\/\/[^\s]+$/i.test(url)) return toast.error('Đường dẫn phải bắt đầu đúng bằng https://')
    try { new URL(url) } catch { return toast.error('Đường dẫn không hợp lệ') }
    const cleanUrl = url.split('?')[0].toLowerCase()
    const isImageUrl = /\.(png|jpe?g|webp|gif|avif|svg)$/.test(cleanUrl)
    const isZipUrl = cleanUrl.endsWith('.zip')
    if (!isImageUrl && !isZipUrl) return toast.error('Chỉ hỗ trợ đường dẫn ảnh hoặc file ZIP')
    if (isImageUrl) setForm((prev) => ({ ...prev, imageUrl: url, imageFileName: url.split('/').pop() || 'Hình ảnh', showImageInput: true }))
    else setForm((prev) => ({ ...prev, attachmentUrl: url, attachmentName: url.split('/').pop() || 'Tài liệu ZIP' }))
    setAssetUrl('')
  }
  const removeImageAsset = () => setForm((prev) => ({ ...prev, imageUrl: '', imageFileName: '', showImageInput: false }))
  const removeZipAsset = () => setForm((prev) => ({ ...prev, attachmentUrl: '', attachmentName: '' }))
  const submit = (event) => {
    event.preventDefault()
    const plainContent = stripRichHtml(form.content).trim()
    if (!form.title.trim() || !plainContent) return toast.error('Vui lòng nhập tiêu đề và nội dung')
    if (form.type === 'event') {
      const startMs = new Date(form.eventStartAt).getTime(), endMs = new Date(form.eventEndAt).getTime()
      if (!form.eventStartAt || Number.isNaN(startMs)) return toast.error('Vui lòng chọn thời gian mở sự kiện')
      if (!form.eventEndAt || Number.isNaN(endMs)) return toast.error('Vui lòng chọn thời gian đóng sự kiện')
      if (endMs <= startMs) return toast.error('Thời gian đóng phải sau thời gian mở')
    }
    if (form.type === 'poll') {
      const startMs = new Date(form.pollStartAt).getTime(), endMs = new Date(form.pollEndAt).getTime()
      if (!form.pollStartAt || Number.isNaN(startMs)) return toast.error('Vui lòng chọn thời gian mở bình chọn')
      if (!form.pollEndAt || Number.isNaN(endMs)) return toast.error('Vui lòng chọn thời gian đóng bình chọn')
      if (endMs <= startMs) return toast.error('Thời gian đóng bình chọn phải sau thời gian mở')
      if (form.pollOptions.filter((option) => option.trim()).length < 2) return toast.error('Bình chọn cần ít nhất 2 lựa chọn')
    }
    onSubmit({ ...form, content: sanitizeRichHtml(form.content), scope: 'hall', groupId: '' })
    resetForm()
  }
  const editorButtons = [
    { key: 'bold', title: 'In đậm', icon: Bold, action: () => toggleEditorTool('bold', 'bold') },
    { key: 'italic', title: 'In nghiêng', icon: Italic, action: () => toggleEditorTool('italic', 'italic') },
    { key: 'underline', title: 'Gạch dưới', icon: Underline, action: () => toggleEditorTool('underline', 'underline') },
    { key: 'link', title: 'Nhúng liên kết', icon: Link2, action: () => setLinkOpen((value) => !value) },
    { key: 'align-left', title: 'Căn trái', icon: AlignLeft, action: () => toggleEditorTool('align-left', 'justifyLeft') },
    { key: 'align-center', title: 'Căn giữa', icon: AlignCenter, action: () => toggleEditorTool('align-center', 'justifyCenter') },
    { key: 'align-right', title: 'Căn phải', icon: AlignRight, action: () => toggleEditorTool('align-right', 'justifyRight') },
  ]

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-xl dark:bg-[#010611]/90 sm:p-4" onMouseDown={onClose}>
      <form onSubmit={submit} onMouseDown={(event) => event.stopPropagation()} className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-blue-400/25 dark:bg-[#061126] dark:text-white dark:shadow-[0_0_70px_rgba(37,99,235,0.28)]">
        <header className="relative border-b border-blue-400/15 px-5 py-5 sm:px-7"><div className="absolute inset-0 bg-[linear-gradient(rgba(37,99,235,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,0.055)_1px,transparent_1px)] bg-[size:24px_24px]" /><div className="relative flex items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-cyan-300"><Globe2 className="h-3.5 w-3.5" />Cộng đồng ZUNY</p><h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">Đăng bài mới ✍️</h2><p className="mt-2 text-sm font-semibold text-slate-500 dark:text-blue-100/55">Chia sẻ kiến thức, đặt câu hỏi và kết nối cùng nhau.</p></div><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white p-3 text-slate-500 shadow-sm hover:bg-slate-100 hover:text-slate-800 dark:border-blue-300/20 dark:bg-blue-950/35 dark:text-slate-300 dark:hover:text-white"><X className="h-5 w-5" /></button></div></header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-6">
          <section className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-blue-300/15 dark:bg-[#07142a]/80">
            {form.isAnonymous ? <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-cyan-400/25 bg-slate-950 text-cyan-300"><UserRoundX className="h-7 w-7" /></div> : <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-sm font-black text-white">{avatarUrl ? <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center">{initials}</span>}</div>}
            <div><div className="flex flex-wrap items-center gap-2"><p className="font-black uppercase text-slate-950 dark:text-white">{form.isAnonymous ? 'Anonymous' : displayName}</p><span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-2 py-1 text-[10px] font-black text-blue-200">{form.isAnonymous ? 'Ẩn danh' : roleText[roleKey] || 'Thành viên'}</span></div><p className="mt-1 text-xs font-semibold text-slate-500 dark:text-blue-100/50">Bài viết sẽ được đăng trong Cộng đồng ZUNY.</p></div>
          </section>
          <section className={panelClass}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">1. Chọn chủ đề bài đăng</h3><p className="mt-1 text-xs font-semibold text-slate-500 dark:text-blue-100/50">Chọn định dạng phù hợp với nội dung.</p></div><span className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 dark:border-blue-300/15 dark:bg-blue-950/35 dark:text-blue-100">{currentType.icon} {currentType.label}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{typeButtons.map((item) => <button key={item.value} type="button" onClick={() => setForm({ ...form, type: item.value, teacherOnly: item.value === 'question' ? form.teacherOnly : false })} className={`rounded-2xl border p-4 text-center transition ${form.type === item.value ? 'border-blue-500 bg-blue-50 shadow-[0_0_22px_rgba(37,99,235,0.12)] dark:bg-blue-500/15 dark:shadow-[0_0_22px_rgba(37,99,235,0.18)]' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 dark:border-blue-300/15 dark:bg-[#08162d] dark:hover:border-blue-400/35'}`}><span className="text-2xl">{item.icon}</span><p className="mt-2 text-sm font-black text-slate-900 dark:text-white">{item.label}</p><p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-blue-100/45">{item.short}</p></button>)}</div></section>
          <section className={`${panelClass} mt-5`}><h3 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">2. Nội dung chính</h3><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Tiêu đề bài viết" className="mt-4 w-full border-0 border-b border-blue-300/15 bg-transparent px-1 py-3 text-2xl font-black text-slate-950 outline-none dark:text-white placeholder:text-slate-500 focus:border-blue-400" />
            <div className="relative mt-4 overflow-visible rounded-2xl border border-slate-200 bg-white dark:border-blue-300/15 dark:bg-[#08162d]">
              <div className="flex flex-wrap items-center gap-1 border-b border-blue-300/15 p-2">{editorButtons.map(({ key, title, icon: Icon, action }) => { const active = key === 'link' ? linkOpen : activeEditorTools.includes(key); return <button key={key} type="button" title={title} aria-pressed={active} onMouseDown={(event) => event.preventDefault()} onClick={action} className={`grid h-9 w-9 place-items-center rounded-xl transition ${active ? 'bg-blue-600 text-white shadow-[0_0_16px_rgba(37,99,235,0.45)]' : 'text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-blue-500/15 dark:hover:text-cyan-300'}`}><Icon className="h-4 w-4" /></button> })}</div>
              {linkOpen && <div className="absolute left-3 top-14 z-30 w-[min(92vw,420px)] rounded-2xl border border-blue-400/30 bg-white p-4 shadow-2xl dark:bg-[#061126]"><p className="text-xs font-black uppercase tracking-wide text-cyan-300">Nhúng liên kết</p><div className="mt-3 grid gap-3"><input value={linkForm.url} onChange={(event) => setLinkForm({ ...linkForm, url: event.target.value })} placeholder="https://..." className={inputClass} /><input value={linkForm.label} onChange={(event) => setLinkForm({ ...linkForm, label: event.target.value })} placeholder="Tên hiển thị của liên kết" className={inputClass} /></div><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setLinkOpen(false)} className="rounded-xl px-3 py-2 text-xs font-black text-slate-400">Hủy</button><button type="button" onClick={insertLink} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white">Chèn link</button></div></div>}
              <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={syncEditor} data-placeholder="Chia sẻ nội dung của bạn tại đây..." className="min-h-52 px-4 py-4 text-sm font-normal leading-7 text-slate-900 outline-none dark:text-white empty:before:pointer-events-none empty:before:text-slate-500 empty:before:content-[attr(data-placeholder)] [&_a]:font-black [&_a]:text-blue-600 dark:[&_a]:text-cyan-300 [&_a]:underline [&_a]:underline-offset-2" />
              <p className="px-4 pb-3 text-right text-[11px] font-bold text-blue-100/40">{stripRichHtml(form.content).length}/10.000</p>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"><div><p className="text-xs font-black uppercase text-slate-600 dark:text-blue-100/70">Tags</p><div className="mt-2 flex flex-wrap gap-2">{form.tags.map((tag) => <button key={tag} type="button" onClick={() => setForm({ ...form, tags: form.tags.filter((item) => item !== tag) })} className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700 dark:bg-blue-500/15 dark:text-cyan-200">#{tag} ×</button>)}</div><input value={form.tagDraft} onChange={(event) => setForm({ ...form, tagDraft: event.target.value.startsWith('#') ? event.target.value : `#${event.target.value}` })} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag() } }} placeholder="#Nhập tag và nhấn Enter" className={`${inputClass} mt-3`} /></div><ToggleSwitch checked={form.isAnonymous} onChange={(checked) => setForm({ ...form, isAnonymous: checked })} icon="◎" label="Đăng ẩn danh" /></div>
          </section>
          <section className={`${panelClass} mt-5`}><h3 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">3. Chức năng {currentType.label}</h3><p className="mt-2 text-xs font-semibold text-slate-500 dark:text-blue-100/50">{currentType.helper}</p>{form.type === 'question' && <div className="mt-4"><ToggleSwitch checked={form.teacherOnly} onChange={(checked) => setForm({ ...form, teacherOnly: checked })} icon="🎓" label="Chỉ giáo viên được trả lời" /></div>}{form.type === 'event' && <div className="mt-4 grid gap-3 sm:grid-cols-2"><input type="datetime-local" step="1" value={form.eventStartAt} onChange={(event) => setForm({ ...form, eventStartAt: event.target.value, eventDate: event.target.value })} className={inputClass} style={{ colorScheme: 'light dark' }} /><input type="datetime-local" step="1" value={form.eventEndAt} onChange={(event) => setForm({ ...form, eventEndAt: event.target.value })} className={inputClass} style={{ colorScheme: 'light dark' }} /><input value={form.eventLocation} onChange={(event) => setForm({ ...form, eventLocation: event.target.value })} placeholder="Địa điểm hoặc link tham gia" className={`${inputClass} sm:col-span-2`} /></div>}{form.type === 'poll' && <div className="mt-4 space-y-3"><div className="grid gap-3 sm:grid-cols-2"><input type="datetime-local" step="1" value={form.pollStartAt} onChange={(event) => setForm({ ...form, pollStartAt: event.target.value })} className={inputClass} style={{ colorScheme: 'light dark' }} /><input type="datetime-local" step="1" value={form.pollEndAt} onChange={(event) => setForm({ ...form, pollEndAt: event.target.value })} className={inputClass} style={{ colorScheme: 'light dark' }} /></div>{form.pollOptions.map((option, index) => <input key={index} value={option} onChange={(event) => updatePollOption(index, event.target.value)} placeholder={`Lựa chọn ${index + 1}`} className={inputClass} />)}<button type="button" onClick={() => setForm({ ...form, pollOptions: [...form.pollOptions, ''].slice(0, 8) })} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 dark:border-blue-400/25 dark:bg-blue-500/10 dark:text-blue-200">+ Thêm lựa chọn</button></div>}</section>
          <section className={`${panelClass} mt-5`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">4. Hình ảnh & tài liệu</h3><p className="mt-1 text-xs font-semibold text-slate-500 dark:text-blue-100/50">Chỉ hỗ trợ hình ảnh hoặc file ZIP.</p></div>
              <button type="button" onClick={() => uploadInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-xs font-black text-blue-700 hover:border-blue-400 dark:border-blue-300/20 dark:bg-blue-950/35 dark:text-blue-100 dark:hover:border-blue-300/40"><UploadCloud className="h-4 w-4" />Tải lên</button>
            </div>
            <input ref={uploadInputRef} type="file" accept="image/*,.zip,application/zip,application/x-zip-compressed" className="hidden" onChange={handleUpload} />
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input value={assetUrl} onChange={(event) => setAssetUrl(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addAssetFromUrl() } }} placeholder="https://.../hinhanh.png hoặc https://.../tailieu.zip" className={inputClass} />
              <button type="button" onClick={addAssetFromUrl} className="shrink-0 rounded-xl bg-blue-600 px-4 py-3 text-xs font-black text-white hover:bg-blue-700">Thêm đường dẫn</button>
            </div>
            {form.imageFileName && <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-black text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-cyan-200"><span className="min-w-0 truncate">Ảnh: {form.imageFileName}</span><button type="button" onClick={removeImageAsset} className="shrink-0 rounded-lg p-1.5 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/15" aria-label="Xóa ảnh"><X className="h-4 w-4" /></button></div>}
            {form.attachmentName && <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-black text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-cyan-200"><span className="min-w-0 truncate">ZIP: {form.attachmentName}</span><button type="button" onClick={removeZipAsset} className="shrink-0 rounded-lg p-1.5 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/15" aria-label="Xóa tài liệu ZIP"><X className="h-4 w-4" /></button></div>}
            {form.imageUrl && <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-blue-300/15"><img src={form.imageUrl} alt="Xem trước" className="max-h-72 w-full object-cover" /></div>}
          </section>
        </div>
        <footer className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 dark:border-blue-400/15 dark:bg-[#051025] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7"><p className="text-xs font-bold text-slate-500 dark:text-blue-100/45">Tối đa 10.000 ký tự</p><div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-100 dark:border-blue-300/15 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/5">Hủy</button><button type="submit" className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3 text-sm font-black text-white shadow-[0_0_24px_rgba(37,99,235,0.45)]">Đăng bài →</button></div></footer>
      </form>
    </div>
  )
}

function ToggleSwitch({ checked, onChange, icon, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition ${
        checked
          ? 'border-blue-400 bg-blue-50 dark:border-blue-400/60 dark:bg-blue-500/15'
          : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
      }`}
    >
      <span className="flex items-center gap-3 text-sm font-black text-slate-700 dark:text-slate-200"><span>{icon}</span>{label}</span>
      <span className={`flex h-7 w-12 items-center rounded-full p-1 transition ${checked ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
        <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  )
}


function buildCommentTree(comments = []) {
  const itemsById = new Map()
  const roots = []

  comments.forEach((comment) => {
    itemsById.set(comment.id, { ...comment, replies: [] })
  })

  comments.forEach((comment) => {
    const item = itemsById.get(comment.id)
    const parent = comment.parentId ? itemsById.get(comment.parentId) : null

    if (parent && Number(comment.depth || 1) > 1) {
      parent.replies.push(item)
    } else {
      roots.push(item)
    }
  })

  const sortByCreatedAt = (list) => {
    list.sort((a, b) => timestampToMs(a.createdAt) - timestampToMs(b.createdAt))
    list.forEach((item) => sortByCreatedAt(item.replies))
  }

  sortByCreatedAt(roots)
  return roots
}

function PostDetailModal({ post, highlightedCommentId = '', currentUser, displayName, initials, roleKey, likingPostIds = [], onClose, onLike, onReport, onSave, onDelete, onShare, onVote, onEventInterest = () => {} }) {
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [replyTarget, setReplyTarget] = useState(null)
  const [replyText, setReplyText] = useState('')
  const inputRef = useRef(null)
  const replyInputRef = useRef(null)

  const commentTree = useMemo(() => buildCommentTree(comments), [comments])

  useEffect(() => {
    if (!post?.id) return undefined
    const commentsQuery = query(collection(db, 'forumPosts', post.id, 'comments'), orderBy('createdAt', 'asc'), limit(300))
    const unsubscribe = onSnapshot(
      commentsQuery,
      (snapshot) => setComments(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (error) => console.warn('Không thể tải bình luận:', error),
    )
    return () => unsubscribe()
  }, [post?.id])

  useEffect(() => {
    if (!highlightedCommentId || !comments.length) return

    const target = document.getElementById(`forum-comment-${highlightedCommentId}`)
    if (!target) return

    window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
  }, [highlightedCommentId, comments.length])

  useEffect(() => {
    if (!replyTarget) return
    window.setTimeout(() => replyInputRef.current?.focus(), 80)
  }, [replyTarget?.id])

  if (!post) return null

  const canComment = !post.teacherOnly || ['teacher', 'admin_dev'].includes(roleKey)
  const adminPost = isAdminAuthor(post.authorRole)
  const eventInterested = (post.eventInterestedBy || []).includes(currentUser?.uid)
  const eventNotInterested = (post.eventNotInterestedBy || []).includes(currentUser?.uid)
  const showEventInterestToggle = post.type === 'event' && !adminPost && currentUser?.uid

  const createComment = async ({ content, parent = null }) => {
    if (!currentUser?.uid) return toast.error('Bạn cần đăng nhập để bình luận')
    if (!canComment) return toast.error('Chỉ giáo viên được trả lời bài viết này')

    const text = String(content || '').trim()
    if (!text) return

    const parentDepth = Number(parent?.depth || 1)
    const nextDepth = parent ? Math.min(parentDepth + 1, 3) : 1
    const parentId = parent ? parent.id : ''
    const rootCommentId = parent ? (parent.rootCommentId || parent.id) : ''

    try {
      const commentRef = await addDoc(collection(db, 'forumPosts', post.id, 'comments'), {
        content: text,
        authorId: currentUser.uid,
        authorName: displayName,
        authorInitials: initials,
        authorRole: roleKey,
        parentId,
        rootCommentId,
        depth: nextDepth,
        reactions: {},
        reactionCounts: {},
        reactionsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      await updateDoc(doc(db, 'forumPosts', post.id), { commentsCount: increment(1), updatedAt: serverTimestamp() })

      const notifyUserId = parent?.authorId && parent.authorId !== currentUser.uid ? parent.authorId : post.authorId
      if (notifyUserId && notifyUserId !== currentUser.uid) {
        await addDoc(collection(db, 'forumNotifications'), {
          toUserId: notifyUserId,
          fromUserId: currentUser.uid,
          fromName: displayName,
          type: parent ? 'comment-reply' : 'comment',
          category: 'post-interaction',
          scope: post.scope || 'hall',
          postId: post.id,
          commentId: commentRef.id,
          text: parent ? `${displayName} đã trả lời bình luận của bạn` : `${displayName} đã bình luận bài viết của bạn`,
          read: false,
          createdAt: serverTimestamp(),
        })
      }

      setCommentText('')
      setReplyText('')
      setReplyTarget(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    } catch (error) {
      console.error('Không thể gửi bình luận:', error)
      toast.error('Không thể gửi bình luận')
    }
  }

  const addComment = async (event) => {
    event.preventDefault()
    await createComment({ content: commentText })
  }

  const submitReply = async (event) => {
    event.preventDefault()
    if (!replyTarget) return
    await createComment({ content: replyText, parent: replyTarget })
  }

  const reactToComment = async (comment, reactionValue = 'love') => {
    if (!currentUser?.uid) return toast.error('Bạn cần đăng nhập để thả cảm xúc')
    if (!post?.id || !comment?.id) return

    try {
      const commentRef = doc(db, 'forumPosts', post.id, 'comments', comment.id)

      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(commentRef)
        if (!snap.exists()) return

        const data = snap.data()
        const currentReactions = data.reactions && typeof data.reactions === 'object' ? data.reactions : {}
        const oldReaction = currentReactions[currentUser.uid]
        const nextReactions = { ...currentReactions }

        if (oldReaction === reactionValue) {
          delete nextReactions[currentUser.uid]
        } else {
          nextReactions[currentUser.uid] = reactionValue
        }

        const nextCounts = buildReactionCounts(nextReactions)
        const nextTotal = Object.values(nextCounts).reduce((sum, value) => sum + Number(value || 0), 0)

        transaction.update(commentRef, {
          reactions: nextReactions,
          reactionCounts: nextCounts,
          reactionsCount: nextTotal,
          updatedAt: serverTimestamp(),
        })
      })
    } catch (error) {
      console.error('Không thể thả cảm xúc bình luận:', error)
      toast.error('Không thể cập nhật cảm xúc bình luận')
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-white/10">
          <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><ChevronLeft className="h-4 w-4" />Đóng</button>
          <button type="button" onClick={() => onReport(post)} className="rounded-xl p-2 text-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-200" title="Báo cáo bài viết" aria-label="Báo cáo bài viết"><Flag className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto p-5">
          <PostCard
            post={post}
            currentUserId={currentUser?.uid}
            roleKey={roleKey}
            liking={likingPostIds.includes(post.id)}
            onOpen={() => {}}
            onLike={onLike}
            onReport={onReport}
            onSave={onSave}
            onDelete={onDelete}
            onShare={onShare}
            onVote={onVote}
            onEventInterest={onEventInterest}
          />
          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <h3 className="mb-4 text-lg font-black text-slate-950 dark:text-white">Bình luận</h3>
            <div className="space-y-3">
              {commentTree.length ? commentTree.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  level={1}
                  highlightedCommentId={highlightedCommentId}
                  currentUserId={currentUser?.uid}
                  replyTargetId={replyTarget?.id || ''}
                  replyText={replyText}
                  replyInputRef={replyInputRef}
                  canComment={canComment}
                  onReply={(target) => {
                    if (Number(target.depth || 1) >= 3) return toast.error('Đã đạt giới hạn bình luận')
                    setReplyTarget(target)
                    setReplyText('')
                  }}
                  onCancelReply={() => { setReplyTarget(null); setReplyText('') }}
                  onChangeReplyText={setReplyText}
                  onSubmitReply={submitReply}
                  onReact={reactToComment}
                  onShare={(commentId) => onShare(post, commentId)}
                />
              )) : <p className="rounded-2xl bg-white p-4 text-sm font-semibold text-slate-400 dark:bg-slate-900">Chưa có bình luận. Hãy là người đầu tiên trao đổi!</p>}
            </div>
          </div>
        </div>
        <form onSubmit={addComment} className="flex items-center gap-3 border-t border-slate-200 p-4 dark:border-white/10">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-500 text-xs font-black text-white">{initials}</div>
          <input ref={inputRef} value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder={!canComment ? 'Chỉ giáo viên được trả lời bài này' : 'Nhập bình luận...'} disabled={!canComment} className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/5 dark:text-white" />
          <button type="submit" disabled={!canComment} className="rounded-2xl bg-blue-600 p-3 text-white disabled:opacity-50"><Send className="h-5 w-5" /></button>
        </form>
      </div>
    </div>
  )
}

function CommentItem({ comment, level = 1, highlightedCommentId = '', currentUserId, replyTargetId = '', replyText = '', replyInputRef, canComment = true, onReply, onCancelReply, onChangeReplyText, onSubmitReply, onReact, onShare = () => {} }) {
  const userReaction = getUserReaction(comment, currentUserId)
  const summary = getReactionSummary(comment.reactions || {}, comment.reactionCounts || {})
  const canReply = Number(comment.depth || level) < 3
  const highlighted = highlightedCommentId === comment.id

  return (
    <div id={`forum-comment-${comment.id}`} className={`rounded-3xl transition ${highlighted ? 'bg-amber-100 p-2 ring-2 ring-amber-300 dark:bg-amber-500/15 dark:ring-amber-400/40' : ''}`}>
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 text-xs font-black text-white">
          {comment.authorInitials || getInitials(comment.authorName)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="rounded-2xl bg-white p-3 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-black text-slate-950 dark:text-white">{comment.authorName}</span>
              <span className="text-[11px] font-bold text-slate-400">{formatRelativeTime(comment.createdAt)}</span>
              {Number(comment.depth || level) > 1 && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-600 dark:bg-blue-500/15 dark:text-blue-200">Trả lời</span>}
            </div>
            <p className="mt-1 whitespace-pre-line text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{comment.content}</p>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 pl-2">
            <MiniReactionButton
              reaction={userReaction}
              summary={summary}
              onReact={(reaction) => onReact(comment, reaction)}
            />
            {canReply && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  if (!canComment) return toast.error('Bạn không có quyền trả lời bình luận này')
                  onReply(comment)
                }}
                className="rounded-full px-2 py-1 text-[11px] font-black text-blue-500 transition hover:bg-blue-50 dark:hover:bg-blue-500/10"
              >
                Trả lời
              </button>
            )}
            {!canReply && <span className="rounded-full px-0 py-0 text-[1px] font-black text-slate-400"> </span>}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onShare(comment.id)
              }}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <Share2 className="h-3.5 w-3.5" />
              Link
            </button>
          </div>

          {replyTargetId === comment.id && (
            <form onSubmit={onSubmitReply} className="mt-3 flex items-center gap-2 rounded-2xl bg-white p-2 dark:bg-slate-900">
              <input
                ref={replyInputRef}
                value={replyText}
                onChange={(event) => onChangeReplyText(event.target.value)}
                placeholder={`Trả lời ${comment.authorName || 'bình luận'}...`}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
              <button type="button" onClick={onCancelReply} className="rounded-xl px-3 py-2 text-xs font-black text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">Hủy</button>
              <button type="submit" className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white">Gửi</button>
            </form>
          )}

          {comment.replies?.length > 0 && (
            <div className="mt-3 space-y-3 border-l-2 border-blue-100 pl-3 dark:border-blue-500/20">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  level={Math.min(level + 1, 3)}
                  highlightedCommentId={highlightedCommentId}
                  currentUserId={currentUserId}
                  replyTargetId={replyTargetId}
                  replyText={replyText}
                  replyInputRef={replyInputRef}
                  canComment={canComment}
                  onReply={onReply}
                  onCancelReply={onCancelReply}
                  onChangeReplyText={onChangeReplyText}
                  onSubmitReply={onSubmitReply}
                  onReact={onReact}
                  onShare={onShare}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ReportModal({ reportPost, onClose, onSubmit }) {
  const [reason, setReason] = useState(REPORT_REASONS[0])
  const [detail, setDetail] = useState('')

  useEffect(() => {
    if (reportPost) {
      setReason(REPORT_REASONS[0])
      setDetail('')
    }
  }, [reportPost])

  if (!reportPost) return null

  const submit = (event) => {
    event.preventDefault()
    onSubmit({ post: reportPost, reason, detail })
  }

  return (
    <div className="fixed inset-0 z-[9999] flex cursor-pointer items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <form onSubmit={submit} className="w-[min(92vw,500px)] cursor-default rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-500">Báo cáo bài viết</p>
            <h3 className="mt-2 text-xl font-black text-slate-950 dark:text-white">{reportPost.title || 'Bài viết'}</h3>
            <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-500 dark:text-slate-300">Hãy chọn lý do phù hợp để quản trị viên xem xét bài viết này.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {REPORT_REASONS.map((item) => (
            <label key={item} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-black transition ${
              reason === item
                ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
            }`}>
              <input type="radio" name="report-reason" checked={reason === item} onChange={() => setReason(item)} />
              {item}
            </label>
          ))}
        </div>

        <textarea
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          rows={4}
          placeholder="Mô tả thêm để quản trị viên hiểu rõ vấn đề..."
          className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-rose-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-2xl px-4 py-2 text-sm font-black text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">Hủy</button>
          <button type="submit" className="rounded-2xl bg-rose-600 px-5 py-2 text-sm font-black text-white transition hover:bg-rose-700">Gửi báo cáo</button>
        </div>
      </form>
    </div>
  )
}

function CommunityChatModal({ chat, type, currentUser, displayName, initials, onClose }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const inputRef = useRef(null)

  const safeChat = chat && typeof chat === 'object' ? chat : {}
  const collectionName = 'forumGroupChats'
  const chatId = safeChat.id || safeChat.code || safeChat.groupCode || ''
  const chatName = safeChat.name || safeChat.title || safeChat.id || ''

  useEffect(() => {
    if (!chatId) return undefined

    const messagesQuery = query(
      collection(db, collectionName, String(chatId), 'messages'),
      orderBy('createdAt', 'asc'),
      limit(300),
    )

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => setMessages(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (error) => console.warn('Không thể tải chat:', error),
    )

    return () => unsubscribe()
  }, [chatId, collectionName])

  if (!chat) return null

  const sendMessage = async (event) => {
    event.preventDefault()
    if (!currentUser?.uid) return toast.error('Bạn cần đăng nhập để gửi tin nhắn')
    const content = text.trim()
    if (!content) return

    try {
      await addDoc(collection(db, collectionName, String(chatId), 'messages'), {
        content,
        authorId: currentUser.uid,
        authorName: displayName,
        authorInitials: initials,
        createdAt: serverTimestamp(),
      })
      setText('')
      setTimeout(() => inputRef.current?.focus(), 50)
    } catch (error) {
      console.error('Không thể gửi tin nhắn:', error)
      toast.error('Không thể gửi tin nhắn')
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="flex h-[min(88vh,760px)] w-[min(96vw,1100px)] overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950" onMouseDown={(event) => event.stopPropagation()}>
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-slate-100 p-4 dark:border-white/10 dark:bg-slate-900/80 md:block">
          <div className="rounded-3xl bg-gradient-to-br from-blue-600 to-blue-600 p-4 text-white">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">Nhóm học</p>
            <h3 className="mt-2 text-xl font-black">{chatName || 'Kênh trò chuyện'}</h3>
            <p className="mt-2 text-xs font-bold text-white/70">{getChatMembersText(safeChat)}</p>
          </div>

          <div className="mt-4 space-y-2">
            <div className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-blue-600 shadow-sm dark:bg-white/10 dark:text-blue-200"># chat-chung</div>
            <div className="rounded-2xl px-4 py-3 text-sm font-bold text-slate-500 dark:text-slate-400"># tài-liệu</div>
            <div className="rounded-2xl px-4 py-3 text-sm font-bold text-slate-500 dark:text-slate-400"># hỏi-đáp</div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
            <div>
              <h3 className="text-lg font-black text-slate-950 dark:text-white"># chat-chung</h3>
              <p className="text-xs font-bold text-slate-400">Chat {chatName || 'kênh này'}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length ? messages.map((message) => (
              <div key={message.id} className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 text-xs font-black text-white">
                  {message.authorInitials || getInitials(message.authorName)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-slate-950 dark:text-white">{message.authorName}</span>
                    <span className="text-xs font-bold text-slate-400">{formatRelativeTime(message.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{message.content}</p>
                </div>
              </div>
            )) : (
              <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center dark:border-white/10">
                <div className="text-5xl">💬</div>
                <h4 className="mt-4 text-xl font-black text-slate-950 dark:text-white">Chưa có tin nhắn</h4>
                <p className="mt-2 text-sm font-semibold text-slate-400">Hãy bắt đầu cuộc trò chuyện đầu tiên.</p>
              </div>
            )}
          </div>

          <form onSubmit={sendMessage} className="flex items-center gap-3 border-t border-slate-200 p-4 dark:border-white/10">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-500 text-xs font-black text-white">{initials}</div>
            <input
              ref={inputRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={`Nhắn vào ${chatName}...`}
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
            <button type="submit" className="rounded-2xl bg-blue-600 p-3 text-white">
              <Send className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function ModalShell({ title, onClose, children }) {
  const reactToComment = async (comment, reactionValue = 'love') => {
    if (!currentUser?.uid) return toast.error('Bạn cần đăng nhập để thả cảm xúc')
    if (!post?.id || !comment?.id) return

    try {
      const commentRef = doc(db, 'forumPosts', post.id, 'comments', comment.id)

      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(commentRef)
        if (!snap.exists()) return

        const data = snap.data()
        const currentReactions = data.reactions && typeof data.reactions === 'object' ? data.reactions : {}
        const oldReaction = currentReactions[currentUser.uid]
        const nextReactions = { ...currentReactions }

        if (oldReaction === reactionValue) {
          delete nextReactions[currentUser.uid]
        } else {
          nextReactions[currentUser.uid] = reactionValue
        }

        const nextCounts = buildReactionCounts(nextReactions)
        const nextTotal = Object.values(nextCounts).reduce((sum, value) => sum + Number(value || 0), 0)

        transaction.update(commentRef, {
          reactions: nextReactions,
          reactionCounts: nextCounts,
          reactionsCount: nextTotal,
          updatedAt: serverTimestamp(),
        })
      })
    } catch (error) {
      console.error('Không thể thả cảm xúc bình luận:', error)
      toast.error('Không thể cập nhật cảm xúc bình luận')
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-2xl font-black text-slate-950 dark:text-white">{title}</h2><button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-5 w-5" /></button></div>
        {children}
      </div>
    </div>
  )
}

const fieldClass = 'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-slate-900'

export default Forum

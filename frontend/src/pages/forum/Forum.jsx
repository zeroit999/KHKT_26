import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
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
  BookOpen,
  ChevronLeft,
  Eye,
  FileText,
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
  ShieldCheck,
  Star,
  Sun,
  Trash2,
  TrendingUp,
  Users,
  X,
  Zap,
  ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { auth, db } from '../../components/firebase'
import useSyncedDarkMode from '../../hooks/common/useSyncedDarkMode'

const SECTIONS = {
  HALL: 'hall',
  CLASSES: 'classes',
  GROUPS: 'groups',
  MY_POSTS: 'my-posts',
  SAVED: 'saved',
  NOTIFICATIONS: 'notifications',
  ADMIN_REVIEW: 'admin-review',
}
const POST_TYPES = [
  { value: 'question', label: 'Hỏi đáp', icon: MessageSquare, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200' },
  { value: 'share', label: 'Tài liệu', icon: FileText, color: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200' },
  { value: 'discuss', label: 'Thảo luận', icon: TrendingUp, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' },
  { value: 'announce', label: 'Thông báo', icon: Megaphone, color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200' },
  { value: 'event', label: 'Sự kiện', icon: Bell, color: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200' },
  { value: 'poll', label: 'Bình chọn', icon: BarChart3, color: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-200' },
]

const FILTER_TABS = [
  { value: 'all', label: 'Tất cả', icon: Home },
  { value: 'hot', label: 'Nổi bật', icon: Zap },
  { value: 'question', label: 'Hỏi đáp', icon: MessageSquare },
  { value: 'share', label: 'Tài liệu', icon: FileText },
  { value: 'discuss', label: 'Thảo luận', icon: TrendingUp },
  { value: 'announce', label: 'Thông báo', icon: Megaphone },
  { value: 'event', label: 'Sự kiện', icon: Bell },
  { value: 'poll', label: 'Bình chọn', icon: BarChart3 },
]

const REACTIONS = [
  { value: 'like', label: 'Thích', emoji: '👍', color: 'text-sky-500' },
  { value: 'love', label: 'Yêu thích', emoji: '❤️', color: 'text-rose-500' },
  { value: 'haha', label: 'Haha', emoji: '😆', color: 'text-amber-500' },
  { value: 'wow', label: 'Wow', emoji: '😮', color: 'text-yellow-500' },
  { value: 'sad', label: 'Buồn', emoji: '😢', color: 'text-blue-400' },
  { value: 'angry', label: 'Phẫn nộ', emoji: '😡', color: 'text-orange-600' },
]

const REPORT_REASONS = [
  'Nội dung không phù hợp',
  'Spam hoặc quảng cáo',
  'Ngôn từ xúc phạm',
  'Thông tin sai lệch',
  'Khác',
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


const DEFAULT_GROUPS = [
  { id: 'math', isSample: true, name: 'Toán nâng cao & HSG', emoji: '🏆', tags: ['Toán', 'HSG'], description: 'Giải bài nâng cao, chia sẻ tài liệu và luyện đề HSG.', color: 'from-cyan-500 to-blue-600' },
  { id: 'python-ai', isSample: true, name: 'Python & AI', emoji: '💻', tags: ['Tin học', 'AI'], description: 'Học lập trình, machine learning và xây dựng dự án nhỏ.', color: 'from-indigo-500 to-violet-600' },
  { id: 'physics', isSample: true, name: 'Vật lí vui', emoji: '⚡', tags: ['Vật lí'], description: 'Thí nghiệm, hiện tượng thực tế và bài tập vật lí.', color: 'from-amber-500 to-orange-600' },
]

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
          <button type="button" onClick={() => { toast.dismiss(t.id); onConfirm?.() }} className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-black text-white transition ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-violet-600 hover:bg-violet-700'}`}>{confirmText}</button>
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
          <button type="button" onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success('Người dùng đã được copy link đó'))} className="cursor-pointer rounded-xl bg-violet-600 px-4 py-2 text-sm font-black text-white transition hover:bg-violet-700">Copy</button>
        </div>
        <button type="button" onClick={() => toast.dismiss(t.id)} className="mt-4 w-full cursor-pointer rounded-xl px-4 py-2 text-sm font-black text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">Đóng</button>
      </div>
    </div>
  ), { id: 'forum-share-popup', duration: Infinity })
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
          <button type="button" onClick={runConfirm} className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-black text-white transition ${modal.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-violet-600 hover:bg-violet-700'}`}>
            {modal.confirmText || 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AdminReasonConfirmModal({ modal, onClose }) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (modal) setReason('')
  }, [modal])

  if (!modal) return null

  const runConfirm = () => {
    onClose()
    modal.onConfirm?.(reason.trim())
  }

  return (
    <div className="fixed inset-0 z-[9999] flex cursor-pointer items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="relative w-[min(92vw,470px)] cursor-default rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute right-4 top-4 cursor-pointer rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Đóng">
          <X className="h-5 w-5" />
        </button>

        <h3 className="pr-10 text-xl font-black text-slate-950 dark:text-white">{modal.title}</h3>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">{modal.message}</p>

        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          placeholder={modal.placeholder || 'Nhập lời giải thích...'}
          className="mt-5 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
        />

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-xl px-4 py-2 text-sm font-black text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
            Hủy
          </button>
          <button type="button" onClick={runConfirm} className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-black text-white transition ${modal.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-violet-600 hover:bg-violet-700'}`}>
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
          <button type="button" onClick={copyLink} className="cursor-pointer rounded-xl bg-violet-600 px-4 py-2 text-sm font-black text-white transition hover:bg-violet-700">
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

const getClassDisplayName = (item = {}) => {
  if (!item) return ''
  if (typeof item === 'string') return item
  if (typeof item !== 'object') return ''
  return item.name || item.className || item.title || item.code || item.id || ''
}
const valueMatchesUser = (value, currentUser, userClass) => {
  if (!value) return false
  if (typeof value === 'string') {
    return (
      value === currentUser?.uid ||
      normalizeText(value) === normalizeText(currentUser?.email) ||
      normalizeText(value) === normalizeText(userClass)
    )
  }

  if (typeof value === 'object') {
    return (
      value.uid === currentUser?.uid ||
      value.id === currentUser?.uid ||
      normalizeText(value.email) === normalizeText(currentUser?.email) ||
      normalizeText(value.className || value.class || value.lop || value.name) === normalizeText(userClass)
    )
  }

  return false
}

const userBelongsToClass = (item = {}, currentUser, userClass) => {
  const className = getClassDisplayName(item)
  if (userClass && normalizeText(className) === normalizeText(userClass)) return true

  const ownerValues = [
    item.teacherId,
    item.teacherUid,
    item.ownerId,
    item.createdBy,
    item.creatorId,
    item.createdById,
    item.adminId,
    item.userId,
  ]

  if (ownerValues.some((value) => valueMatchesUser(value, currentUser, userClass))) {
    return true
  }

  const ownerObjects = [
    item.teacher,
    item.owner,
    item.creator,
    item.createdByUser,
    item.admin,
  ]

  if (ownerObjects.some((value) => valueMatchesUser(value, currentUser, userClass))) {
    return true
  }

  const ownerEmails = [
    item.teacherEmail,
    item.ownerEmail,
    item.creatorEmail,
    item.createdByEmail,
  ]

  if (
    currentUser?.email &&
    ownerEmails.some((value) => normalizeText(value) === normalizeText(currentUser.email))
  ) {
    return true
  }

  const possibleLists = [
    item.memberIds,
    item.members,
    item.studentIds,
    item.students,
    item.userIds,
    item.joinedUsers,
    item.participants,
    item.teacherIds,
    item.teachers,
    item.teacherEmails,
    item.ownerIds,
    item.adminIds,
    item.admins,
  ]

  return possibleLists.some(
    (list) =>
      Array.isArray(list) &&
      list.some((value) => valueMatchesUser(value, currentUser, userClass)),
  )
}

function Forum() {
  const syncedDark = useSyncedDarkMode()
  const [manualDark, setManualDark] = useState(null)
  const dark = manualDark ?? syncedDark
  const [currentUser, setCurrentUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [posts, setPosts] = useState([])
  const [groups, setGroups] = useState([])
  const [classes, setClasses] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [activeSection, setActiveSection] = useState(SECTIONS.HALL)
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [myPostStatusFilter, setMyPostStatusFilter] = useState('all')
  const [notificationFilter, setNotificationFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [selectedPost, setSelectedPost] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [confirmModal, setConfirmModal] = useState(null)
  const [shareModal, setShareModal] = useState(null)
  const [notificationModal, setNotificationModal] = useState(null)
  const [adminReasonModal, setAdminReasonModal] = useState(null)
  const [likingPostIds, setLikingPostIds] = useState([])
  const [viewingPostIds, setViewingPostIds] = useState([])
  const [reports, setReports] = useState([])
  const [adminReviewMode, setAdminReviewMode] = useState('pending')
  const [reportModal, setReportModal] = useState(null)
  const [selectedGroupChat, setSelectedGroupChat] = useState(null)
  const [selectedClassChat, setSelectedClassChat] = useState(null)

  const roleKey = getRoleKey(profile?.role || profile?.userRole || profile?.type)
  const displayName = profile?.fullName || profile?.displayName || profile?.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Người dùng ZUNY'
  const initials = getInitials(displayName, currentUser?.email)
  const userClass = profile?.className || profile?.class || profile?.lop || profile?.studentClass || ''

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
    let cancelled = false

    async function fetchClasses() {
      try {
        const snapshot = await getDocs(collection(db, 'classes'))
        if (cancelled) return
        setClasses(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
      } catch (error) {
        console.warn('Không thể tải lớp học:', error)
        setClasses([])
      }
    }

    fetchClasses()
    return () => { cancelled = true }
  }, [])

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
      (snapshot) => setNotifications(
        snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .sort((a, b) => timestampToMs(b.createdAt) - timestampToMs(a.createdAt)),
      ),
      (error) => console.warn('Không thể tải thông báo:', error),
    )

    return () => unsubscribe()
  }, [currentUser?.uid])

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
    if (!selectedPost?.id) return
    const freshPost = posts.find((post) => post.id === selectedPost.id)
    if (freshPost) setSelectedPost(freshPost)
  }, [posts, selectedPost?.id])

  const joinedGroupIds = useMemo(() => new Set(groups.filter((group) => (group.memberIds || []).includes(currentUser?.uid)).map((group) => group.id)), [groups, currentUser?.uid])

  const joinedClasses = useMemo(() => {
    if (!currentUser?.uid && !userClass) return []
    return classes.filter((item) => userBelongsToClass(item, currentUser, userClass))
  }, [classes, currentUser?.uid, currentUser?.email, userClass])

  const filteredPosts = useMemo(() => {
    const keyword = normalizeText(search.trim())

    const nextPosts = posts.filter((post) => {
      if (activeSection === SECTIONS.CLASSES) {
        const sameClass = post.scope === 'class' && (!userClass || normalizeText(post.className) === normalizeText(userClass))
        if (!sameClass && roleKey === 'student') return false
        if (post.scope !== 'class') return false
      }

      if (activeSection === SECTIONS.GROUPS) {
        if (post.scope !== 'group') return false
        if (roleKey === 'student' && post.groupId && !joinedGroupIds.has(post.groupId)) return false
      }

if (activeSection === SECTIONS.MY_POSTS) {
  if (post.authorId !== currentUser?.uid) return false

  const status = post.status || 'approved'

  if (myPostStatusFilter === 'approved' && status !== 'approved') return false
  if (myPostStatusFilter === 'rejected' && status !== 'rejected') return false
}
      if (activeSection === SECTIONS.SAVED && !(post.savedBy || []).includes(currentUser?.uid)) return false
      if (activeSection === SECTIONS.ADMIN_REVIEW) {
        if (roleKey !== 'admin_dev') return false
        if (adminReviewMode !== 'pending') return false
        if ((post.status || 'approved') !== 'pending') return false
      }

      if ([SECTIONS.HALL, SECTIONS.NOTIFICATIONS].includes(activeSection) && post.scope && post.scope !== 'hall') return false
      if (activeSection === SECTIONS.HALL && (post.status || 'approved') !== 'approved') return false
      if (![SECTIONS.MY_POSTS, SECTIONS.ADMIN_REVIEW].includes(activeSection) && (post.status || 'approved') !== 'approved') return false

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
}, [posts, activeSection, currentUser?.uid, filter, search, sortBy, joinedGroupIds, roleKey, userClass, myPostStatusFilter, adminReviewMode])
const filteredNotifications = useMemo(() => {
  return notifications.filter((item) => {
    if (notificationFilter === 'all') return true
    if (notificationFilter === 'hall') return (item.scope || 'hall') === 'hall'
    if (notificationFilter === 'class') return item.scope === 'class'
    if (notificationFilter === 'group') return item.scope === 'group'
    if (notificationFilter === 'mine') {
      return ['moderation-approved', 'moderation-rejected', 'comment', 'like', 'reaction'].includes(item.type)
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
    return pendingPosts + openReports
  }, [posts, reports, roleKey])

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

  const stats = useMemo(() => ({
    postCount: posts.filter((post) => (post.status || 'approved') === 'approved').length,
    todayCount: posts.filter((post) => (post.status || 'approved') === 'approved' && new Date(timestampToMs(post.createdAt)).toDateString() === new Date().toDateString()).length,
  }), [posts])

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

  const requireLogin = () => {
    if (currentUser?.uid) return true
    toast.error('Bạn cần đăng nhập để dùng cộng đồng')
    return false
  }

  const createPost = async (form) => {
    if (!requireLogin()) return

    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        type: form.type,
        tags: Array.isArray(form.tags) ? form.tags.slice(0, 8) : String(form.tags || '').split(',').map((tag) => tag.trim().replace(/^#+/, '')).filter(Boolean).slice(0, 8),
        scope: form.scope,
        className: form.scope === 'class' ? form.className || userClass : '',
        groupId: form.scope === 'group' ? form.groupId : '',
        groupName: form.scope === 'group' ? groups.find((item) => item.id === form.groupId)?.name || '' : '',
        attachmentUrl: String(form.attachmentUrl || '').trim(),
        attachmentName: form.attachmentName || '',
        imageUrl: String(form.imageUrl || '').trim(),
        eventDate: form.type === 'event' ? form.eventDate || '' : '',
        eventLocation: form.type === 'event' ? String(form.eventLocation || '').trim() : '',
        pollOptions: form.type === 'poll' ? (form.pollOptions || []).map((option, index) => ({ id: `option-${index + 1}`, text: String(option || '').trim() })).filter((option) => option.text).slice(0, 8) : [],
        pollVotes: {},
        pollVotesCount: {},
        status: form.scope === 'hall' && roleKey !== 'admin_dev' ? 'pending' : 'approved',
        approvedAt: form.scope === 'hall' && roleKey !== 'admin_dev' ? null : serverTimestamp(),
        approvedBy: form.scope === 'hall' && roleKey !== 'admin_dev' ? '' : currentUser.uid,
        authorId: currentUser.uid,
        authorName: form.isAnonymous ? 'Ẩn danh' : displayName,
        authorEmail: form.isAnonymous ? '' : currentUser.email || '',
        authorInitials: form.isAnonymous ? 'AD' : initials,
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
  payload.type === 'event'
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
          category: 'event',
          scope: 'hall',
          postId: postRef.id,
          title: 'Sự kiện mới ở cộng đồng ZUNY',
          text: `${displayName} vừa tạo sự kiện mới: "${payload.title}".`,
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

      setReportModal(null)
      toast.success('Đã gửi báo cáo tới quản trị viên')
    } catch (error) {
      console.error('Không thể gửi báo cáo:', error)
      toast.error('Không thể gửi báo cáo')
    }
  }

  const resolveReport = async (report) => {
    if (roleKey !== 'admin_dev') return

    try {
      await updateDoc(doc(db, 'forumReports', report.id), {
        status: 'resolved',
        resolvedBy: currentUser.uid,
        resolvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      toast.success('Đã xử lý báo cáo')
    } catch (error) {
      console.error('Không thể xử lý báo cáo:', error)
      toast.error('Không thể xử lý báo cáo')
    }
  }

  const openShareModal = (post) => {
    setShareModal(`${window.location.origin}${window.location.pathname}?post=${post.id}`)
  }

  const runDeletePost = async (post, reason = '') => {
    try {
      const deletedByAdmin = ['admin', 'admin_dev'].includes(roleKey)
      await deleteDoc(doc(db, 'forumPosts', post.id))

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

  const createGroup = async (form) => {
    if (!requireLogin()) return

    try {
      await addDoc(collection(db, 'forumGroups'), {
        name: form.name.trim(),
        description: form.description.trim(),
        emoji: form.emoji.trim() || '👥',
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 6),
        isPrivate: form.isPrivate,
        ownerId: currentUser.uid,
        ownerName: displayName,
        memberIds: [currentUser.uid],
        membersCount: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setGroupOpen(false)
      toast.success('Đã tạo nhóm học tập')
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
        await addDoc(collection(db, 'forumGroups'), {
          name: group.name,
          description: group.description,
          emoji: group.emoji || '👥',
          tags: group.tags || [],
          isPrivate: false,
          ownerId: currentUser.uid,
          ownerName: displayName,
          memberIds: [currentUser.uid],
          membersCount: 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        toast.success('Đã tạo và tham gia nhóm mẫu')
        return
      }

      await updateDoc(doc(db, 'forumGroups', group.id), {
        memberIds: joined ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
        membersCount: increment(joined ? -1 : 1),
        updatedAt: serverTimestamp(),
      })
      toast.success(joined ? 'Đã rời nhóm' : 'Đã tham gia nhóm')
    } catch (error) {
      console.error('Không thể cập nhật nhóm:', error)
      toast.error('Không thể cập nhật nhóm')
    }
  }

  return (
    <div className={`${dark ? 'dark ' : ''}[&_button]:cursor-pointer [&_select]:cursor-pointer [&_label]:cursor-pointer`}>
<main className="h-[calc(100vh-64px)] overflow-hidden bg-slate-50 text-slate-950 transition dark:bg-[#020617] dark:text-white">
<div className="flex h-full overflow-hidden">
              <Sidebar activeSection={activeSection} roleKey={roleKey} unreadNotificationsCount={unreadNotificationsCount} pendingReviewCount={pendingReviewCount} collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((value) => !value)} onChange={(section) => { setActiveSection(section); setFilter('all'); setMobileMenuOpen(false) }} dark={dark} onToggleDark={() => setManualDark((value) => !(value ?? syncedDark))} mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

<section className="min-w-0 flex-1 overflow-y-auto">            

            <div className={`mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:px-6 ${activeSection === SECTIONS.HALL ? "lg:grid-cols-[minmax(0,1fr)_320px]" : "lg:grid-cols-1"}`}>
              <div className="min-w-0">
                {activeSection === SECTIONS.HALL && <HallHero stats={stats} onCompose={() => setComposerOpen(true)} />}
                {activeSection === SECTIONS.CLASSES && <ClassesHero classes={joinedClasses} userClass={userClass} />}
                {activeSection === SECTIONS.GROUPS && <GroupsHero onCreate={() => setGroupOpen(true)} />}
                {activeSection === SECTIONS.MY_POSTS && <SimpleHero icon="📝" title="Bài viết của tôi" subtitle="Quản lý các bài bạn đã đăng trong cộng đồng." />}
                {activeSection === SECTIONS.MY_POSTS && (
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
                {activeSection === SECTIONS.SAVED && <SimpleHero icon="🔖" title="Bài đã lưu" subtitle="Tài liệu, câu hỏi và thảo luận bạn muốn xem lại." />}
                {activeSection === SECTIONS.NOTIFICATIONS && <SimpleHero icon="🔔" title="Thông báo" subtitle="Tương tác mới từ bạn bè, giáo viên và nhóm học tập." />}
                {activeSection === SECTIONS.ADMIN_REVIEW && <SimpleHero icon="🛡️" title="Quản lý bài viết cộng đồng" subtitle="Duyệt bài đang chờ trước khi hiển thị ở cộng đồng ZUNY." />}

                {activeSection === SECTIONS.HALL && <ComposerBar onOpen={() => setComposerOpen(true)} initials={initials} name={displayName} />}

                {activeSection === SECTIONS.GROUPS ? (
                  <GroupsGrid groups={groups.length ? groups : DEFAULT_GROUPS} currentUserId={currentUser?.uid} onJoin={toggleJoinGroup} onOpenChat={setSelectedGroupChat} />
                ) : activeSection === SECTIONS.CLASSES ? (
                  <ClassesGrid classes={joinedClasses} userClass={userClass} onOpenClass={(item) => setSelectedClassChat(item)} />
                ) : activeSection === SECTIONS.ADMIN_REVIEW ? (
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
                ) : activeSection === SECTIONS.NOTIFICATIONS ? (
                  <>
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <StatusFilterBar
                        value={notificationFilter}
                        onChange={setNotificationFilter}
                        options={[
                          { value: 'all', label: 'Tất cả' },
                          { value: 'hall', label: 'Cộng đồng ZUNY' },
                          { value: 'class', label: 'Lớp học' },
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
  likingPostIds={likingPostIds}
  showStatusBadge={activeSection === SECTIONS.MY_POSTS}
  onOpen={openPost}
  onLike={toggleLike}
  onReport={setReportModal}
  onSave={toggleSave}
  onDelete={deletePost}
  onShare={openShareModal}
  onVote={votePoll}
  onClear={() => { setSearch(''); setFilter('all') }}
/>
                  </>
                )}
              </div>

              {activeSection === SECTIONS.HALL && (
                <RightSidebar
                  posts={posts.filter((post) => (post.status || 'approved') === 'approved')}
                  groups={groups.length ? groups : DEFAULT_GROUPS}
                  profile={{ displayName, initials, roleKey, userClass }}
                  onOpenPost={openPost}
                />
              )}
            </div>
          </section>
        </div>

        <MobileNav activeSection={activeSection} unreadNotificationsCount={unreadNotificationsCount} onChange={(section) => { setActiveSection(section); setFilter('all') }} onCompose={() => setComposerOpen(true)} />
      </main>

      <PostModal open={composerOpen} onClose={() => setComposerOpen(false)} onSubmit={createPost} groups={groups} classes={classes} userClass={userClass} roleKey={roleKey} displayName={displayName} initials={initials} />
      <GroupModal open={groupOpen} onClose={() => setGroupOpen(false)} onSubmit={createGroup} />
      <PostDetailModal post={selectedPost} currentUser={currentUser} displayName={displayName} initials={initials} roleKey={roleKey} likingPostIds={likingPostIds} onClose={() => setSelectedPost(null)} onLike={toggleLike} onReport={setReportModal} onSave={toggleSave} onDelete={deletePost} onShare={openShareModal} onVote={votePoll} />
      <CenterConfirmModal modal={confirmModal} onClose={() => setConfirmModal(null)} />
      <AdminReasonConfirmModal modal={adminReasonModal} onClose={() => setAdminReasonModal(null)} />
      <CenterShareModal link={shareModal} onClose={() => setShareModal(null)} />
      <ReportModal reportPost={reportModal} onClose={() => setReportModal(null)} onSubmit={submitReport} />
      <CommunityChatModal chat={selectedGroupChat} type="group" currentUser={currentUser} displayName={displayName} initials={initials} onClose={() => setSelectedGroupChat(null)} />
      <CommunityChatModal chat={selectedClassChat} type="class" currentUser={currentUser} displayName={displayName} initials={initials} onClose={() => setSelectedClassChat(null)} />
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
    { id: SECTIONS.CLASSES, label: 'Lớp học', icon: BookOpen },
    { id: SECTIONS.GROUPS, label: 'Nhóm học', icon: Users },
    { id: SECTIONS.MY_POSTS, label: 'Bài của tôi', icon: FileText },
    { id: SECTIONS.SAVED, label: 'Đã lưu', icon: Bookmark },
    { id: SECTIONS.NOTIFICATIONS, label: 'Thông báo', icon: Bell, badge: unreadNotificationsCount },
    ...(roleKey === 'admin_dev'
      ? [{ id: SECTIONS.ADMIN_REVIEW, label: 'Quản lý bài viết', icon: ShieldCheck, badge: pendingReviewCount }]
      : []),
  ]

  const content = (
    <aside
      className={`flex h-full shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white/95 p-4 shadow-xl shadow-slate-200/70 backdrop-blur transition-all duration-300 dark:border-white/10 dark:bg-slate-950/95 dark:shadow-black/20 ${
        collapsed ? 'w-24' : 'w-72'
      }`}
    >
      <div className={`flex items-center gap-3 px-2 py-2 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/25">
            <Globe2 className="h-6 w-6" />
          </div>

          {!collapsed && (
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">ZUNY Community</h1>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Cộng đồng học tập</p>
            </div>
          )}
        </div>

        <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 lg:hidden">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="mt-8 space-y-2">
        {items.map((item) => {
          const Icon = item.icon
          const active = activeSection === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              title={collapsed ? item.label : undefined}
              className={`flex w-full items-center rounded-2xl px-4 py-3 text-sm font-black transition ${
                collapsed ? 'justify-center' : 'gap-3'
              } ${
                active
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'
              }`}
            >
              <span className="relative inline-flex">
                <Icon className="h-5 w-5 shrink-0" />
                {item.badge > 0 && (
                  <span className="absolute -right-2.5 -top-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-400 px-1 text-[10px] font-black text-white shadow-lg shadow-cyan-400/40">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto pt-4">
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
          className={`group hidden w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-500 shadow-sm transition-all duration-300 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600 hover:shadow-lg dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-violet-500/10 dark:hover:text-violet-200 lg:flex ${
            collapsed ? 'h-12 px-0' : ''
          }`}
        >
          {collapsed ? (
            <PanelRightOpen className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
          ) : (
            <>
              <PanelLeftClose className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
              <span className="whitespace-nowrap">Thu gọn menu</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )

  return (
    <>
      <div className="hidden lg:block">{content}</div>
      {mobileOpen && <div className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm lg:hidden" onMouseDown={onClose}><div onMouseDown={(event) => event.stopPropagation()}>{content}</div></div>}
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
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm bài viết, câu hỏi, tài liệu..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-11 py-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-slate-900" />
        </div>
        <button type="button" onClick={onCompose} className="hidden items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 sm:flex">
          <Plus className="h-4 w-4" />
          Đăng bài
        </button>
        <button type="button" className="relative rounded-2xl p-3 text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">{unread > 9 ? '9+' : unread}</span>}
        </button>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 text-sm font-black text-white shadow-lg shadow-cyan-500/20">
          {profileLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : initials}
        </div>
      </div>
    </header>
  )
}

function HallHero({ stats, onCompose }) {
  return (
    <section className="relative mb-5 overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-600 p-7 text-white shadow-2xl shadow-indigo-500/20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_50%,rgba(255,255,255,0.20),transparent_35%),radial-gradient(circle_at_85%_10%,rgba(255,255,255,0.14),transparent_34%)]" />
      <GlobeWatermark />
      <div className="relative z-10 max-w-xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white/80 backdrop-blur">
          <Globe2 className="h-4 w-4" />
          ZUNY Community
        </div>
        <h2 className="text-3xl font-black tracking-tight md:text-5xl">Cộng đồng ZUNY 🌍</h2>
        <p className="mt-4 max-w-lg text-sm font-semibold leading-7 text-white/75">Nơi học sinh và giáo viên cùng chia sẻ, hỏi đáp, đăng tài liệu và trò chuyện theo thời gian thực.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={onCompose} className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-indigo-700 shadow-lg transition hover:-translate-y-0.5">
            <Plus className="h-4 w-4" />
            Đăng bài mới
          </button>
        </div>
      </div>
<div className="relative z-10 mt-7 flex gap-3 sm:absolute sm:bottom-6 sm:right-6 sm:mt-0">
  <HeroStat value={stats.postCount} label="Bài viết" />
  <HeroStat value={`+${stats.todayCount}`} label="Hôm nay" />
</div>
    </section>
  )
}

function GlobeWatermark() {
  return (
    <svg className="absolute right-4 top-4 h-44 w-44 opacity-10" viewBox="0 0 160 160" fill="none">
      <circle cx="80" cy="80" r="72" stroke="white" strokeWidth="2" />
      <ellipse cx="80" cy="80" rx="36" ry="72" stroke="white" strokeWidth="1.4" />
      <line x1="8" y1="80" x2="152" y2="80" stroke="white" strokeWidth="1.4" />
      <path d="M80 8 Q112 38 112 80 Q112 122 80 152" stroke="white" strokeWidth="1.2" />
      <path d="M80 8 Q48 38 48 80 Q48 122 80 152" stroke="white" strokeWidth="1.2" />
      <line x1="15" y1="48" x2="145" y2="48" stroke="white" strokeWidth="1" />
      <line x1="15" y1="112" x2="145" y2="112" stroke="white" strokeWidth="1" />
    </svg>
  )
}

function HeroStat({ value, label }) {
  return (
    <div className="min-w-[58px] text-center">
      <div className="text-lg font-black leading-none text-white md:text-xl">
        {value}
      </div>
      <div className="mt-1 text-[11px] font-bold text-white/65">
        {label}
      </div>
    </div>
  )
}

function ClassesHero({ classes, userClass }) {
  return <SimpleHero icon="🏫" title="Lớp học của tôi" subtitle={`Không gian riêng tư cho lớp ${userClass || 'của bạn'}. Hiện bạn đang tham gia ${classes.length || 0} lớp.`} gradient="from-violet-600 via-indigo-600 to-purple-700" />
}

function GroupsHero({ onCreate }) {
  return (
    <section className="mb-5 rounded-[2rem] bg-gradient-to-br from-emerald-600 via-cyan-600 to-teal-600 p-7 text-white shadow-2xl shadow-emerald-500/20">
      <h2 className="text-3xl font-black">Nhóm học tập 👥</h2>
      <p className="mt-3 max-w-xl text-sm font-semibold leading-7 text-white/75">Tham gia nhóm theo môn học, sở thích hoặc mục tiêu ôn thi. Mỗi nhóm có bài viết và luồng trao đổi riêng.</p>
      <button type="button" onClick={onCreate} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-emerald-700 shadow-lg transition hover:-translate-y-0.5"><Plus className="h-4 w-4" /> Tạo nhóm mới</button>
    </section>
  )
}

function SimpleHero({ icon, title, subtitle, gradient = 'from-slate-900 via-indigo-700 to-violet-700' }) {
  return <section className={`mb-5 rounded-[2rem] bg-gradient-to-br ${gradient} p-7 text-white shadow-xl`}><div className="text-4xl">{icon}</div><h2 className="mt-3 text-3xl font-black">{title}</h2><p className="mt-3 max-w-xl text-sm font-semibold leading-7 text-white/75">{subtitle}</p></section>
}

function ComposerBar({ onOpen, initials, name }) {
  return (
    <button type="button" onClick={onOpen} className="mb-4 flex w-full items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-violet-300 hover:shadow-lg dark:border-white/10 dark:bg-white/5 dark:hover:border-violet-400/50">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-black text-white">{initials}</div>
      <div className="min-w-0 flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-300">{name ? `${name} ơi, bạn muốn chia sẻ gì?` : 'Bạn muốn chia sẻ gì?'}</div>
      <ImagePlus className="hidden h-5 w-5 text-slate-400 sm:block" />
    </button>
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
              ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
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
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
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
      <div className="relative hidden w-[260px] shrink-0 lg:block">
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
            focus:border-violet-400
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
            hover:border-violet-300
            hover:bg-violet-50
            hover:text-violet-700
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
                    ? 'bg-violet-600 text-white'
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
  likingPostIds = [],
  showStatusBadge = false,
  onOpen,
  onLike,
  onReport,
  onSave,
  onDelete,
  onShare,
  onVote,
  onClear,
}) {
    if (loading) return <div className="space-y-4">{[1, 2, 3].map((item) => <div key={item} className="h-52 animate-pulse rounded-3xl bg-white dark:bg-white/5" />)}</div>
  if (!posts.length) return <EmptyState icon="🔍" title="Không tìm thấy bài viết" description="Thử đổi bộ lọc hoặc từ khóa tìm kiếm." actionLabel="Xóa bộ lọc" onAction={onClear} />
  return <div className="space-y-4">{posts.map((post) => <PostCard key={post.id} post={post} currentUserId={currentUserId} roleKey={roleKey} liking={likingPostIds.includes(post.id)} showStatusBadge={showStatusBadge} onOpen={onOpen} onLike={onLike} onReport={onReport} onSave={onSave} onDelete={onDelete} onShare={onShare} onVote={onVote} />)}</div>
}

function PostCard({
  post,
  currentUserId,
  roleKey,
  liking = false,
  showStatusBadge = false,
  onOpen,
  onLike,
  onReport,
  onSave,
  onDelete,
  onShare = () => {},
  onVote = () => {},
}) {  
  const type = POST_TYPES.find((item) => item.value === post.type) || POST_TYPES[2]
  const TypeIcon = type.icon
  const userReaction = getUserReaction(post, currentUserId)
  const reactionSummary = getReactionSummary(post.reactions || {}, post.reactionCounts || {})
  const saved = (post.savedBy || []).includes(currentUserId)
  const canDelete = post.authorId === currentUserId || ['admin', 'admin_dev'].includes(roleKey)

  return (
    <article className="cursor-pointer overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl dark:border-white/10 dark:bg-white/5">
      <button type="button" onClick={() => onOpen(post)} className="block w-full p-5 text-left">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-black text-white">{post.authorInitials || getInitials(post.authorName)}</div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black text-slate-950 dark:text-white">{post.authorName || 'Người dùng ZUNY'}</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500 dark:bg-white/10 dark:text-slate-300"><ShieldCheck className="h-3 w-3" />{roleText[post.authorRole] || 'Thành viên'}</span>
              </div>
              <p className="mt-0.5 text-xs font-semibold text-slate-400">{formatRelativeTime(post.createdAt)}{post.groupName || post.className ? ` • ${post.groupName || post.className}` : ''}</p>
            </div>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${type.color}`}><TypeIcon className="h-3.5 w-3.5" />{type.label}</span>
        </div>

        {post.isPinned && <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"><Star className="h-3.5 w-3.5 fill-current" />Bài ghim</div>}
        <h2 className="text-xl font-black leading-snug text-slate-950 dark:text-white">{post.title}</h2>
        <p className="mt-3 line-clamp-3 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">{post.content}</p>

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
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-black text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">
            🎓 Chỉ giáo viên được trả lời
          </div>
        )}

        {post.type === 'poll' && post.pollOptions?.length > 0 && (
          <PollBlock post={post} currentUserId={currentUserId} onVote={onVote} />
        )}

        {post.imageUrl && <img src={post.imageUrl} alt="Minh họa bài viết" className="mt-4 max-h-80 w-full rounded-2xl object-cover" />}
        {post.type === 'event' && post.eventDate && <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-600 dark:bg-rose-500/10 dark:text-rose-200">🗓️ Bắt đầu: {formatEventDate(post.eventDate)}</div>}
        {post.attachmentUrl && <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-600 dark:bg-white/10 dark:text-slate-200">🔗 {post.attachmentName || post.attachmentUrl}</div>}
        {post.tags?.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{post.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 dark:bg-white/10 dark:text-slate-300">#{tag}</span>)}</div>}
      </button>

      <div className="flex items-center gap-1 border-t border-slate-200 px-4 py-3 dark:border-white/10">
        <ReactionButton reaction={userReaction} summary={reactionSummary} disabled={liking} onReact={(reaction) => onLike(post, reaction)} />
        <ActionButton onClick={() => onOpen(post)} icon={MessageCircle} label={Number(post.commentsCount || 0)} />
        <ActionButton icon={Eye} label={Number(post.viewsCount || 0)} />
        <ActionButton active={saved} onClick={() => onSave(post)} icon={saved ? BookmarkCheck : Bookmark} label={saved ? 'Đã lưu' : 'Lưu'} />
        <PostMoreMenu onReport={() => onReport(post)} />
        <button type="button" onClick={() => onShare(post)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"><Share2 className="h-5 w-5" /></button>
        {canDelete && <button type="button" onClick={() => onDelete(post)} className="rounded-xl p-2 text-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"><Trash2 className="h-5 w-5" /></button>}
      </div>
    </article>
  )
}


function PollBlock({ post, currentUserId, onVote }) {
  const pollVotes = post.pollVotes || {}
  const pollCounts = post.pollVotesCount || {}
  const selectedOptionId = currentUserId ? pollVotes[currentUserId] : ''
  const totalVotes = Object.values(pollCounts).reduce((sum, value) => sum + Number(value || 0), 0)

  return (
    <div className="mt-4 rounded-3xl border border-fuchsia-100 bg-fuchsia-50 p-4 dark:border-fuchsia-400/20 dark:bg-fuchsia-500/10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-black text-fuchsia-700 dark:text-fuchsia-200">📊 Bình chọn</p>
        <p className="text-xs font-bold text-slate-400">{totalVotes} lượt</p>
      </div>

      <div className="space-y-2">
        {(post.pollOptions || []).map((option) => {
          const count = Number(pollCounts[option.id] || 0)
          const percent = totalVotes ? Math.round((count / totalVotes) * 100) : 0
          const selected = selectedOptionId === option.id

          return (
            <button
              key={option.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onVote(post, option.id)
              }}
              className={`relative w-full overflow-hidden rounded-2xl border px-4 py-3 text-left transition ${
                selected
                  ? 'border-fuchsia-400 bg-white dark:bg-slate-900'
                  : 'border-slate-200 bg-white hover:border-fuchsia-300 dark:border-white/10 dark:bg-slate-900/70 dark:hover:border-fuchsia-400/50'
              }`}
            >
              <span className="absolute inset-y-0 left-0 bg-fuchsia-500/15 transition-all" style={{ width: `${percent}%` }} />
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
  const selected = REACTIONS.find((item) => item.value === reaction)
  const displayItems = summary.items.slice(0, 3)

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-2 flex gap-1 rounded-full border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-white/10 dark:bg-slate-900">
          {REACTIONS.map((item) => (
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
        onClick={(event) => {
          event.stopPropagation()
          onReact(reaction || 'love')
        }}
        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
          reaction
            ? 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-200'
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
  const selected = REACTIONS.find((item) => item.value === reaction)

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-2 flex gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-slate-900">
          {REACTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              title={item.label}
              onClick={() => {
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
        onClick={() => onReact(reaction || 'love')}
        className={`rounded-full px-2 py-1 text-[11px] font-black transition ${
          reaction
            ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200'
            : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
        }`}
      >
        {selected?.emoji || '♡'} {summary.total || ''}
      </button>
    </div>
  )
}

function PostMoreMenu({ onReport }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative ml-auto">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((value) => !value)
        }}
        className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-36 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-2xl dark:border-white/10 dark:bg-slate-900">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setOpen(false)
              onReport()
            }}
            className="block w-full rounded-xl px-3 py-2.5 text-left text-xs font-black text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-500/10"
          >
            🚩 Báo cáo
          </button>
        </div>
      )}
    </div>
  )
}

function ActionButton({ icon: Icon, label, active, disabled = false, onClick = () => {} }) {
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
      {label}
    </button>
  )
}

function EmptyState({ icon, title, description, actionLabel, onAction }) {
  return <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center dark:border-white/10 dark:bg-white/5"><div className="text-5xl">{icon}</div><h3 className="mt-4 text-xl font-black text-slate-950 dark:text-white">{title}</h3><p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{description}</p>{actionLabel && <button type="button" onClick={onAction} className="mt-5 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white">{actionLabel}</button>}</div>
}

function GroupsGrid({ groups, currentUserId, onJoin, onOpenChat }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {groups.map((group) => (
        <GroupCard
          key={group.id}
          group={group}
          joined={(group.memberIds || []).includes(currentUserId)}
          onJoin={onJoin}
          onOpenChat={onOpenChat}
        />
      ))}
    </div>
  )
}

function GroupCard({ group, joined, onJoin, onOpenChat }) {
  const color = group.color?.includes('from-') ? group.color : 'from-indigo-500 to-violet-600'

  return (
    <div className="cursor-pointer rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-white/5">
      <button type="button" onClick={() => joined ? onOpenChat(group) : onJoin(group)} className="block w-full text-left">
        <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br ${color} text-3xl shadow-lg`}>{group.emoji || '👥'}</div>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-black text-slate-950 dark:text-white">{group.name}</h3>
          {group.isPrivate && <LockKeyhole className="h-4 w-4 text-slate-400" />}
        </div>
        <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">{group.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">{(group.tags || []).map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 dark:bg-white/10 dark:text-slate-300">{tag}</span>)}</div>
      </button>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1 text-sm font-black text-slate-500 dark:text-slate-300"><Users className="h-4 w-4" />{getChatMembersText(group)}</span>
        <button type="button" onClick={() => joined ? onOpenChat(group) : onJoin(group)} className={`rounded-2xl px-4 py-2 text-sm font-black transition ${joined ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200'}`}>
          {joined ? 'Vào chat' : 'Tham gia'}
        </button>
      </div>
    </div>
  )
}

function ClassesGrid({ classes, userClass, onOpenClass }) {
  if (!classes.length) return <EmptyState icon="🏫" title="Bạn chưa tham gia lớp nào" description="Khi bạn được thêm vào lớp hoặc có lớp trùng thông tin lớp của bạn, lớp đó sẽ xuất hiện tại đây." />

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {classes.map((item) => {
        const name = getClassDisplayName(item)
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpenClass(item)}
            className={`rounded-3xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
              normalizeText(name) === normalizeText(userClass)
                ? 'border-violet-300 bg-violet-50 dark:border-violet-400/40 dark:bg-violet-500/10'
                : 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/5'
            }`}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-2xl">🏫</div>
            <h3 className="mt-4 text-lg font-black text-slate-950 dark:text-white">{name}</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-300">{item.description || item.subject || 'Không gian trao đổi riêng của lớp.'}</p>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs font-black text-violet-600 dark:text-violet-200">Vào chat lớp</p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500 dark:bg-white/10 dark:text-slate-300">{getChatMembersText(item)}</span>
            </div>
          </button>
        )
      })}
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
            item.read
              ? 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/5'
              : 'border-violet-300 bg-violet-50 dark:border-violet-400/30 dark:bg-violet-500/10'
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
                    : 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200'
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
                : 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200'
          }`}>
            {isEvent ? '🗓️' : isAdmin ? '🛡️' : '🔔'}
          </div>

          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-500">
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
              className="rounded-2xl bg-violet-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-700"
            >
              Chuyển hướng
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function RightSidebar({ posts, groups, profile, onOpenPost }) {
  const [hotVisible, setHotVisible] = useState(6)
  const [contributorsVisible, setContributorsVisible] = useState(4)
  const [eventsVisible, setEventsVisible] = useState(4)

  const formatCompactScore = (score = 0) => {
    const value = Number(score || 0)
    if (value >= 100000) return '100K+'
    if (value >= 1000) return `${Math.floor(value / 1000)}K`
    return value.toString()
  }

  const listScrollClass = 'pr-2 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(139,92,246,0.65)_rgba(15,23,42,0.35)] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-800/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-violet-500/70 [&::-webkit-scrollbar-thumb:hover]:bg-violet-400'

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

  const topContributors = useMemo(() => {
    const users = new Map()

    posts.forEach((post) => {
      const id = post.authorId || post.authorName
      if (!id) return

      const current = users.get(id) || {
        id,
        name: post.authorName || 'Người dùng ZUNY',
        initials: post.authorInitials || getInitials(post.authorName),
        role: roleText[post.authorRole] || 'Học sinh',
        score: 0,
        postsCount: 0,
        repliesCount: 0,
      }

      const replies = Number(post.commentsCount || 0)
      current.postsCount += 1
      current.repliesCount += replies
      current.score += 0 + replies * 5
      users.set(id, current)
    })

    return Array.from(users.values()).sort((a, b) => b.score - a.score)
  }, [posts])

  const upcomingEvents = useMemo(() => posts
    .filter((post) => post.type === 'event' && post.eventDate)
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
    .map((post, index) => ({
      id: post.id,
      title: post.title,
      time: formatEventDate(post.eventDate),
      color: ['bg-rose-500', 'bg-indigo-500', 'bg-amber-500', 'bg-cyan-500'][index % 4],
      post,
    })), [posts])

  const visibleHotTopics = hotTopics.slice(0, hotVisible)
  const visibleContributors = topContributors.slice(0, contributorsVisible)
  const visibleEvents = upcomingEvents.slice(0, eventsVisible)

  return (
    <aside className="hidden w-[280px] space-y-4 lg:block">
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
              <span className="max-w-[130px] truncate rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
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
          <button type="button" onClick={() => setHotVisible((value) => value + 6)} className="mt-4 text-sm font-bold text-violet-500 hover:text-violet-400">
            Xem thêm ›
          </button>
        )}
      </div>

      <div className=" rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
        <h3 className="mb-4 flex items-center gap-2 font-black text-slate-950 dark:text-white">
          <span>🏆</span>
          Đóng góp nổi bật
        </h3>

<div
  className={`${listScrollClass} space-y-4`}
  style={{
    maxHeight: topContributors.length > 4 ? '260px' : 'auto',
  }}
>          {visibleContributors.length ? visibleContributors.map((user, index) => (
            <div key={user.id || user.name} className="flex items-center gap-3">
              <div className="relative mb-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 text-xs font-black text-white">
                {user.initials}
                {index < 3 && (
<span
  className="
    absolute
    -bottom-1
    left-1/2
    -translate-x-1/2
    rounded-full
    bg-amber-400
    px-2
    py-[2px]
    text-[9px]
    font-black
    text-slate-950
    shadow-lg
    whitespace-nowrap
  "
>
  TOP {index + 1}
</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-900 dark:text-white">{user.name}</p>
                <p className="text-xs font-semibold text-slate-400">{user.role}</p>
              </div>
              <span className="text-sm font-black text-violet-500">{formatCompactScore(user.score)}</span>
            </div>
          )) : (
            <p className="text-sm font-semibold text-slate-400">Chưa có đóng góp nổi bật.</p>
          )}
        </div>

        {topContributors.length > contributorsVisible && (
          <button type="button" onClick={() => setContributorsVisible((value) => value + 6)} className="mt-4 text-sm font-bold text-violet-500 hover:text-violet-400">
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
            <button key={event.id} type="button" onClick={() => onOpenPost(event.post)} className="flex w-full gap-3 text-left">
              <div className={`w-1 shrink-0 rounded-full ${event.color}`} />
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900 dark:text-white">{event.title}</p>
                <p className="text-xs font-semibold text-slate-400">{event.time}</p>
              </div>
            </button>
          )) : <p className="text-sm font-semibold text-slate-400">Chưa có sự kiện sắp tới.</p>}
        </div>

        {upcomingEvents.length > eventsVisible && (
          <button type="button" onClick={() => setEventsVisible((value) => value + 6)} className="mt-4 text-sm font-bold text-violet-500 hover:text-violet-400">
            Xem thêm ›
          </button>
        )}
      </div>

      <div className="cursor-pointer rounded-3xl border border-violet-200 bg-white p-5 text-slate-900 shadow-sm transition hover:border-violet-300 hover:shadow-lg dark:border-violet-500/30 dark:bg-gradient-to-br dark:from-violet-950/90 dark:to-slate-900 dark:text-white">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-xl dark:bg-violet-500/15">💡</div>
        <h3 className="mt-4 font-black text-slate-950 dark:text-white">Mẹo học hôm nay</h3>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
          "Chia nhỏ bài toán khó thành các bước nhỏ hơn — mỗi bước giải quyết được là một chiến thắng nhỏ."
        </p>
      </div>
    </aside>
  )
}

function MobileNav({ activeSection, unreadNotificationsCount = 0, onChange, onCompose }) {
  const items = [
    { id: SECTIONS.HALL, icon: Globe2, label: 'Sảnh' },
    { id: SECTIONS.CLASSES, icon: BookOpen, label: 'Lớp' },
    { id: SECTIONS.GROUPS, icon: Users, label: 'Nhóm' },
    { id: SECTIONS.NOTIFICATIONS, icon: Bell, label: 'Tin', badge: unreadNotificationsCount },
  ]

  return <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 lg:hidden">{items.map((item) => { const Icon = item.icon; const active = activeSection === item.id; return <button key={item.id} type="button" onClick={() => onChange(item.id)} className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-black ${active ? 'text-violet-600 dark:text-violet-200' : 'text-slate-400'}`}><span className="relative"><Icon className="h-5 w-5" />{item.badge > 0 && <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-400 px-1 text-[9px] font-black text-white">{item.badge > 9 ? '9+' : item.badge}</span>}</span>{item.label}</button> })}<button type="button" onClick={onCompose} className="flex flex-col items-center gap-1 rounded-2xl bg-violet-600 px-3 py-2 text-[11px] font-black text-white"><Plus className="h-5 w-5" />Đăng</button></div>
}

function PostModal({ open, onClose, onSubmit, groups, classes, userClass, roleKey, displayName, initials }) {
  const initialForm = {
    title: '',
    content: '',
    type: 'discuss',
    tags: [],
    tagDraft: '#',
    scope: 'hall',
    className: userClass || '',
    groupId: '',
    attachmentUrl: '',
    attachmentName: '',
    imageUrl: '',
    showImageInput: false,
    isAnonymous: false,
    teacherOnly: false,
    eventDate: '',
    eventLocation: '',
    pollOptions: ['', ''],
  }
  const [form, setForm] = useState(initialForm)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (open) setForm((prev) => ({ ...prev, className: userClass || prev.className || '' }))
  }, [open, userClass])

  if (!open) return null

  const resetForm = () => setForm({ ...initialForm, className: userClass || '' })

  const typeButtons = [
    {
      value: 'discuss',
      label: 'Thảo luận',
      icon: '💬',
      helper: 'Trao đổi mở, chia sẻ quan điểm và cùng nhau phân tích vấn đề.',
      activeClass: 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25',
      panelClass: 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-500/10',
    },
    {
      value: 'question',
      label: 'Hỏi đáp',
      icon: '❓',
      helper: 'Đặt câu hỏi rõ ràng để giáo viên hoặc bạn học hỗ trợ nhanh hơn.',
      activeClass: 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/25',
      panelClass: 'border-cyan-200 bg-cyan-50 dark:border-cyan-400/20 dark:bg-cyan-500/10',
    },
    {
      value: 'share',
      label: 'Tài liệu',
      icon: '📄',
      helper: 'Chia sẻ tài liệu, link học tập hoặc ảnh minh họa kèm mô tả ngắn.',
      activeClass: 'bg-violet-600 text-white shadow-lg shadow-violet-500/25',
      panelClass: 'border-violet-200 bg-violet-50 dark:border-violet-400/20 dark:bg-violet-500/10',
    },
    {
      value: 'announce',
      label: 'Thông báo',
      icon: '📢',
      helper: 'Thông tin quan trọng, ngắn gọn, dễ đọc và có hành động rõ ràng.',
      activeClass: 'bg-amber-500 text-white shadow-lg shadow-amber-500/25',
      panelClass: 'border-amber-200 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-500/10',
    },
    {
      value: 'event',
      label: 'Sự kiện',
      icon: '🗓️',
      helper: 'Tạo sự kiện có ngày bắt đầu để hiển thị trong Sự kiện sắp tới.',
      activeClass: 'bg-rose-600 text-white shadow-lg shadow-rose-500/25',
      panelClass: 'border-rose-200 bg-rose-50 dark:border-rose-400/20 dark:bg-rose-500/10',
    },
    {
      value: 'poll',
      label: 'Bình chọn',
      icon: '📊',
      helper: 'Tạo câu hỏi bình chọn với ít nhất hai lựa chọn.',
      activeClass: 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-500/25',
      panelClass: 'border-fuchsia-200 bg-fuchsia-50 dark:border-fuchsia-400/20 dark:bg-fuchsia-500/10',
    },
  ]

  const currentType = typeButtons.find((item) => item.value === form.type) || typeButtons[0]
  const canPostClass = Boolean(userClass) || roleKey !== 'student'
  const availableGroups = groups || []
  const availableClasses = classes || []

  const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-violet-400/60'
  const sectionClass = 'rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5'

  const addTag = () => {
    const tag = form.tagDraft.replace(/^#+/, '').trim()
    if (!tag) return setForm({ ...form, tagDraft: '#' })
    if (form.tags.includes(tag)) return setForm({ ...form, tagDraft: '#' })
    setForm({ ...form, tags: [...form.tags, tag].slice(0, 8), tagDraft: '#' })
  }

  const updatePollOption = (index, value) => {
    const nextOptions = [...(form.pollOptions || [])]
    nextOptions[index] = value
    setForm({ ...form, pollOptions: nextOptions })
  }

  const submit = (event) => {
    event.preventDefault()
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Vui lòng nhập tiêu đề và nội dung')
      return
    }
    if (form.type === 'event' && !form.eventDate) {
      toast.error('Vui lòng chọn ngày bắt đầu sự kiện')
      return
    }
    if (form.type === 'share' && !form.attachmentName && !form.attachmentUrl && !form.imageUrl) {
      toast.error('Vui lòng đính kèm tài liệu, tệp hoặc link ảnh')
      return
    }
    if (form.type === 'poll' && (form.pollOptions || []).filter((option) => option.trim()).length < 2) {
      toast.error('Bình chọn cần ít nhất 2 lựa chọn')
      return
    }

    onSubmit(form)
    resetForm()
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
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm dark:bg-slate-950/70" onMouseDown={onClose}>
      <form
        onSubmit={submit}
        className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-2xl shadow-violet-500/15 dark:border-white/10 dark:bg-slate-900 dark:shadow-[0_0_60px_rgba(124,58,237,0.35)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-white/10">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-500">ZUNY Community</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Đăng bài mới ✍️</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Đóng">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[68vh] overflow-y-auto px-6 py-6">
          <div className="mb-5 flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-black text-white">{initials}</div>
            <div className="min-w-0">
              <p className="font-black text-slate-950 dark:text-white">{displayName || 'Người dùng ZUNY'}</p>
              <p className="text-xs font-bold text-slate-400">Chọn loại bài, nhập nội dung và thiết lập phần riêng bên dưới.</p>
            </div>
          </div>

          <div className={sectionClass}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">1. Chọn chủ đề bài đăng</h3>
                <p className="mt-1 text-xs font-bold text-slate-400">Mỗi chủ đề có phần nhập riêng để bài đăng dễ hiểu hơn.</p>
              </div>
              <span className="hidden rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-500 dark:bg-white/10 dark:text-slate-300 sm:inline-flex">
                {currentType.icon} {currentType.label}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {typeButtons.map((item) => {
                const active = form.type === item.value
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setForm({ ...form, type: item.value, teacherOnly: item.value === 'question' ? form.teacherOnly : false })}
                    className={`rounded-2xl px-4 py-3 text-left text-sm font-black transition ${
                      active
                        ? item.activeClass
                        : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-5">
              <div className={sectionClass}>
                <h3 className="mb-3 text-sm font-black text-slate-800 dark:text-white">2. Nội dung chính</h3>
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder={form.type === 'event' ? 'Tiêu đề sự kiện...' : form.type === 'poll' ? 'Câu hỏi bình chọn...' : 'Tiêu đề bài viết...'}
                  className="w-full border-0 border-b border-slate-200 bg-transparent px-0 py-3 text-2xl font-black text-slate-950 outline-none placeholder:text-slate-400 focus:border-violet-400 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
                />

                <textarea
                  value={form.content}
                  onChange={(event) => setForm({ ...form, content: event.target.value })}
                  rows={6}
                  placeholder={
                    form.type === 'event'
                      ? 'Mô tả sự kiện, đối tượng tham gia, nội dung chính...'
                      : form.type === 'question'
                        ? 'Mô tả câu hỏi, phần bạn chưa hiểu, dữ kiện bài toán...'
                        : 'Nội dung bài viết...'
                  }
                  className="mt-4 w-full resize-none rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-400 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-violet-400/60"
                />
              </div>

              <div className={`${sectionClass} ${currentType.panelClass}`}>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">3. Phần riêng của {currentType.label}</h3>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-600 dark:text-slate-300">{currentType.helper}</p>

                {form.type === 'question' && (
                  <div className="mt-4 space-y-3">
                    <ToggleSwitch checked={form.teacherOnly} onChange={(checked) => setForm({ ...form, teacherOnly: checked })} icon="🎓" label="Chỉ giáo viên được trả lời" />
                    <div className="rounded-2xl bg-white/70 p-3 text-xs font-bold text-cyan-700 dark:bg-white/5 dark:text-cyan-200">
                      Gợi ý: ghi rõ bạn đã thử cách nào và đang vướng ở bước nào.
                    </div>
                  </div>
                )}

                {form.type === 'share' && (
                  <div className="mt-4 space-y-3">
                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-700">
                        📎 Chọn tệp tài liệu
                      </button>
                      <button type="button" onClick={() => setForm({ ...form, showImageInput: !form.showImageInput })} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-violet-700 transition hover:bg-violet-100 dark:bg-white/10 dark:text-violet-200 dark:hover:bg-white/15">
                        🖼️ Thêm ảnh/link
                      </button>
                    </div>
                  </div>
                )}



                {form.type === 'event' && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-black text-rose-600 dark:text-rose-200">Ngày bắt đầu</label>
                      <input
                        type="date"
                        value={form.eventDate}
                        onChange={(event) => setForm({ ...form, eventDate: event.target.value })}
                        className={`${inputClass} mt-2 focus:border-rose-300`}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-black text-rose-600 dark:text-rose-200">Địa điểm hoặc link tham gia</label>
                      <input
                        value={form.eventLocation}
                        onChange={(event) => setForm({ ...form, eventLocation: event.target.value })}
                        placeholder="VD: Phòng A1 / Google Meet..."
                        className={`${inputClass} mt-2 focus:border-rose-300`}
                      />
                    </div>
                  </div>
                )}

                {form.type === 'poll' && (
                  <div className="mt-4 space-y-3">
                    {(form.pollOptions || []).map((option, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          value={option}
                          onChange={(event) => updatePollOption(index, event.target.value)}
                          placeholder={`Lựa chọn ${index + 1}`}
                          className={inputClass}
                        />
                        {(form.pollOptions || []).length > 2 && (
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, pollOptions: form.pollOptions.filter((_, optionIndex) => optionIndex !== index) })}
                            className="rounded-2xl px-3 text-sm font-black text-rose-500 transition hover:bg-rose-100 dark:hover:bg-rose-500/10"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, pollOptions: [...(form.pollOptions || []), ''].slice(0, 8) })}
                      className="rounded-2xl bg-fuchsia-600 px-4 py-3 text-sm font-black text-white transition hover:bg-fuchsia-700"
                    >
                      + Thêm lựa chọn
                    </button>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  setForm({ ...form, attachmentName: file.name, attachmentUrl: file.name })
                  toast.success(`Đã chọn tệp: ${file.name}`)
                }}
              />

              {(form.showImageInput || form.attachmentName) && (
                <div className={sectionClass}>
                  {form.showImageInput && (
                    <div className="flex gap-2">
                      <input
                        value={form.imageUrl}
                        onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
                        placeholder="Dán link ảnh hoặc tài liệu vào đây..."
                        className={inputClass}
                      />
                      <button type="button" onClick={() => form.imageUrl.trim() ? toast.success('Đã tải ảnh từ link') : toast.error('Vui lòng nhập link ảnh')} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-700">
                        Tải
                      </button>
                    </div>
                  )}
                  {form.attachmentName && <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300">Tệp đã chọn: {form.attachmentName}</p>}
                </div>
              )}
            </div>

            <aside className="space-y-5">
              <div className={sectionClass}>
                <h3 className="mb-3 text-sm font-black text-slate-800 dark:text-white">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {form.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setForm({ ...form, tags: form.tags.filter((item) => item !== tag) })}
                      className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700 dark:bg-violet-500/20 dark:text-violet-200"
                    >
                      #{tag} ×
                    </button>
                  ))}
                </div>
                <input
                  value={form.tagDraft}
                  onChange={(event) => {
                    const value = event.target.value
                    setForm({ ...form, tagDraft: value.startsWith('#') ? value : `#${value}` })
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addTag()
                    }
                  }}
                  placeholder="#Nhập tag rồi bấm Enter"
                  className={`${inputClass} mt-3`}
                />
              </div>

              <ToggleSwitch checked={form.isAnonymous} onChange={(checked) => setForm({ ...form, isAnonymous: checked })} icon="⌘" label="Đăng ẩn danh" />
            </aside>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-white/10">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Tối đa 10,000 ký tự</p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="rounded-2xl px-5 py-3 text-sm font-black text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10">
              Hủy
            </button>
            <button type="submit" className="rounded-2xl bg-violet-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-700 disabled:opacity-50">
              Đăng bài 🚀
            </button>
          </div>
        </div>
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
          ? 'border-violet-400 bg-violet-50 dark:border-violet-400/60 dark:bg-violet-500/15'
          : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
      }`}
    >
      <span className="flex items-center gap-3 text-sm font-black text-slate-700 dark:text-slate-200"><span>{icon}</span>{label}</span>
      <span className={`flex h-7 w-12 items-center rounded-full p-1 transition ${checked ? 'bg-violet-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
        <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  )
}
function GroupModal({ open, onClose, onSubmit }) {
  const [form, setForm] = useState({ name: '', description: '', emoji: '👥', tags: '', isPrivate: false })
  if (!open) return null
  const submit = (event) => {
    event.preventDefault()
    if (!form.name.trim() || !form.description.trim()) return toast.error('Vui lòng nhập tên và mô tả nhóm')
    onSubmit(form)
    setForm({ name: '', description: '', emoji: '👥', tags: '', isPrivate: false })
  }
  return <ModalShell onClose={onClose} title="Tạo nhóm học tập"><form onSubmit={submit} className="space-y-4"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Tên nhóm" className={fieldClass} /><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} placeholder="Mô tả nhóm" className={`${fieldClass} resize-none`} /><div className="grid gap-3 sm:grid-cols-2"><input value={form.emoji} onChange={(event) => setForm({ ...form, emoji: event.target.value })} placeholder="Emoji" className={fieldClass} /><input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="Tags: Toán, HSG" className={fieldClass} /></div><label className="flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-300"><input type="checkbox" checked={form.isPrivate} onChange={(event) => setForm({ ...form, isPrivate: event.target.checked })} /> Nhóm riêng tư</label><div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-600 dark:bg-white/10 dark:text-slate-200">Hủy</button><button type="submit" className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white">Tạo nhóm</button></div></form></ModalShell>
}

function PostDetailModal({ post, currentUser, displayName, initials, roleKey, likingPostIds = [], onClose, onLike, onReport, onSave, onDelete, onShare, onVote }) {
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (!post?.id) return undefined
    const commentsQuery = query(collection(db, 'forumPosts', post.id, 'comments'), orderBy('createdAt', 'asc'), limit(200))
    const unsubscribe = onSnapshot(
      commentsQuery,
      (snapshot) => setComments(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (error) => console.warn('Không thể tải bình luận:', error),
    )
    return () => unsubscribe()
  }, [post?.id])

  if (!post) return null

  const addComment = async (event) => {
    event.preventDefault()
    if (!currentUser?.uid) return toast.error('Bạn cần đăng nhập để bình luận')
    if (post.teacherOnly && !['teacher', 'admin_dev'].includes(roleKey)) {
      toast.error('Chỉ giáo viên được trả lời bài viết này')
      return
    }
    const text = commentText.trim()
    if (!text) return
    try {
      await addDoc(collection(db, 'forumPosts', post.id, 'comments'), {
        content: text,
        authorId: currentUser.uid,
        authorName: displayName,
        authorInitials: initials,
        authorRole: roleKey,
        createdAt: serverTimestamp(),
      })
      await updateDoc(doc(db, 'forumPosts', post.id), { commentsCount: increment(1), updatedAt: serverTimestamp() })
      if (post.authorId && post.authorId !== currentUser.uid) {
        await addDoc(collection(db, 'forumNotifications'), {
          toUserId: post.authorId,
          fromUserId: currentUser.uid,
          fromName: displayName,
          type: 'comment',
          category: 'post-interaction',
          scope: post.scope || 'hall',
          postId: post.id,
          text: `${displayName} đã bình luận bài viết của bạn`,
          read: false,
          createdAt: serverTimestamp(),
        })
      }
      setCommentText('')
      setTimeout(() => inputRef.current?.focus(), 50)
    } catch (error) {
      console.error('Không thể gửi bình luận:', error)
      toast.error('Không thể gửi bình luận')
    }
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
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-white/10"><button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><ChevronLeft className="h-4 w-4" />Đóng</button><button type="button" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"><MoreHorizontal className="h-5 w-5" /></button></div>
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
          />          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <h3 className="mb-4 text-lg font-black text-slate-950 dark:text-white">Trò chuyện / Bình luận realtime</h3>
            <div className="space-y-3">
              {comments.length ? comments.map((comment) => <CommentItem key={comment.id} comment={comment} currentUserId={currentUser?.uid} onReact={reactToComment} />) : <p className="rounded-2xl bg-white p-4 text-sm font-semibold text-slate-400 dark:bg-slate-900">Chưa có bình luận. Hãy là người đầu tiên trao đổi!</p>}
            </div>
          </div>
        </div>
        <form onSubmit={addComment} className="flex items-center gap-3 border-t border-slate-200 p-4 dark:border-white/10">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-black text-white">{initials}</div>
          <input ref={inputRef} value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder={post.teacherOnly && !['teacher', 'admin_dev'].includes(roleKey) ? 'Chỉ giáo viên được trả lời bài này' : 'Nhập tin nhắn/bình luận...'} disabled={post.teacherOnly && !['teacher', 'admin_dev'].includes(roleKey)} className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5 dark:text-white" />
          <button type="submit" className="rounded-2xl bg-violet-600 p-3 text-white"><Send className="h-5 w-5" /></button>
        </form>
      </div>
    </div>
  )
}

function CommentItem({ comment, currentUserId, onReact }) {
  const userReaction = getUserReaction(comment, currentUserId)
  const summary = getReactionSummary(comment.reactions || {}, comment.reactionCounts || {})

  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-xs font-black text-white">
        {comment.authorInitials || getInitials(comment.authorName)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-white p-3 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-black text-slate-950 dark:text-white">{comment.authorName}</span>
            <span className="text-[11px] font-bold text-slate-400">{formatRelativeTime(comment.createdAt)}</span>
          </div>
          <p className="mt-1 whitespace-pre-line text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{comment.content}</p>
        </div>

        <div className="mt-1 flex items-center gap-2 pl-2">
          <MiniReactionButton
            reaction={userReaction}
            summary={summary}
            onReact={(reaction) => onReact(comment, reaction)}
          />
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
            <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-500 dark:text-slate-300">{reportPost.content}</p>
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
  const collectionName = type === 'class' ? 'forumClassChats' : 'forumGroupChats'
  const chatId = safeChat.id || safeChat.code || getClassDisplayName(safeChat)
  const chatName = type === 'class' ? getClassDisplayName(safeChat) : (safeChat.name || safeChat.title || safeChat.id || '')

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
          <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 p-4 text-white">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">{type === 'class' ? 'Lớp học' : 'Nhóm học'}</p>
            <h3 className="mt-2 text-xl font-black">{chatName || 'Kênh trò chuyện'}</h3>
            <p className="mt-2 text-xs font-bold text-white/70">{getChatMembersText(safeChat)}</p>
          </div>

          <div className="mt-4 space-y-2">
            <div className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-violet-600 shadow-sm dark:bg-white/10 dark:text-violet-200"># chat-chung</div>
            <div className="rounded-2xl px-4 py-3 text-sm font-bold text-slate-500 dark:text-slate-400"># tài-liệu</div>
            <div className="rounded-2xl px-4 py-3 text-sm font-bold text-slate-500 dark:text-slate-400"># hỏi-đáp</div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
            <div>
              <h3 className="text-lg font-black text-slate-950 dark:text-white"># chat-chung</h3>
              <p className="text-xs font-bold text-slate-400">Chat realtime kiểu Discord cho {chatName || 'kênh này'}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length ? messages.map((message) => (
              <div key={message.id} className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 text-xs font-black text-white">
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
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-black text-white">{initials}</div>
            <input
              ref={inputRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={`Nhắn vào ${chatName}...`}
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
            <button type="submit" className="rounded-2xl bg-violet-600 p-3 text-white">
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

const fieldClass = 'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-slate-900'

export default Forum

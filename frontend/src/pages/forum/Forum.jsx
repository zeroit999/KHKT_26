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
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import {
  Bell,
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
}

const POST_TYPES = [
  { value: 'question', label: 'Hỏi đáp', icon: MessageSquare, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200' },
  { value: 'share', label: 'Tài liệu', icon: FileText, color: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200' },
  { value: 'discuss', label: 'Thảo luận', icon: TrendingUp, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' },
  { value: 'announce', label: 'Thông báo', icon: Megaphone, color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200' },
  { value: 'event', label: 'Sự kiện', icon: Bell, color: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200' },
]

const FILTER_TABS = [
  { value: 'all', label: 'Tất cả', icon: Home },
  { value: 'hot', label: 'Nổi bật', icon: Zap },
  { value: 'question', label: 'Hỏi đáp', icon: MessageSquare },
  { value: 'share', label: 'Tài liệu', icon: FileText },
  { value: 'discuss', label: 'Thảo luận', icon: TrendingUp },
  { value: 'announce', label: 'Thông báo', icon: Megaphone },
  { value: 'event', label: 'Sự kiện', icon: Bell },
]

const DEFAULT_GROUPS = [
  { id: 'math', isSample: true, name: 'Toán nâng cao & HSG', emoji: '🏆', tags: ['Toán', 'HSG'], description: 'Giải bài nâng cao, chia sẻ tài liệu và luyện đề HSG.', color: 'from-cyan-500 to-blue-600' },
  { id: 'python-ai', isSample: true, name: 'Python & AI', emoji: '💻', tags: ['Tin học', 'AI'], description: 'Học lập trình, machine learning và xây dựng dự án nhỏ.', color: 'from-indigo-500 to-violet-600' },
  { id: 'physics', isSample: true, name: 'Vật lí vui', emoji: '⚡', tags: ['Vật lí'], description: 'Thí nghiệm, hiện tượng thực tế và bài tập vật lí.', color: 'from-amber-500 to-orange-600' },
]

const roleText = {
  teacher: 'Giáo viên',
  admin: 'Quản trị',
  student: 'Học sinh',
}

const getRoleKey = (role = '') => {
  const value = String(role || '').trim().replace(/[\s_-]/g, '').toLowerCase()
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
  const [search, setSearch] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [selectedPost, setSelectedPost] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [confirmModal, setConfirmModal] = useState(null)
  const [shareModal, setShareModal] = useState(null)

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

  const joinedGroupIds = useMemo(() => new Set(groups.filter((group) => (group.memberIds || []).includes(currentUser?.uid)).map((group) => group.id)), [groups, currentUser?.uid])

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

      if (activeSection === SECTIONS.MY_POSTS && post.authorId !== currentUser?.uid) return false
      if (activeSection === SECTIONS.SAVED && !(post.savedBy || []).includes(currentUser?.uid)) return false
      if ([SECTIONS.HALL, SECTIONS.NOTIFICATIONS].includes(activeSection) && post.scope && post.scope !== 'hall') return false

      if (filter === 'hot' && Number(post.likesCount || 0) < 5 && Number(post.commentsCount || 0) < 3) return false
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
  }, [posts, activeSection, currentUser?.uid, filter, search, sortBy, joinedGroupIds, roleKey, userClass])

  const stats = useMemo(() => ({
    postCount: posts.length,
    todayCount: posts.filter((post) => new Date(timestampToMs(post.createdAt)).toDateString() === new Date().toDateString()).length,
  }), [posts])

  const openPost = async (post) => {
    setSelectedPost(post)
    try {
      await updateDoc(doc(db, 'forumPosts', post.id), { viewsCount: increment(1) })
    } catch (error) {
      console.warn('Không thể tăng lượt xem:', error)
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
        authorId: currentUser.uid,
        authorName: form.isAnonymous ? 'Ẩn danh' : displayName,
        authorEmail: form.isAnonymous ? '' : currentUser.email || '',
        authorInitials: form.isAnonymous ? 'AD' : initials,
        authorRole: roleKey,
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        likedBy: [],
        savedBy: [],
        isPinned: false,
        isAnonymous: Boolean(form.isAnonymous),
        teacherOnly: Boolean(form.teacherOnly),
        isAnswered: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      await addDoc(collection(db, 'forumPosts'), payload)
      setComposerOpen(false)
      toast.success('Đã đăng bài lên cộng đồng')
    } catch (error) {
      console.error('Không thể đăng bài:', error)
      toast.error('Không thể đăng bài. Vui lòng thử lại')
    }
  }

  const toggleLike = async (post) => {
    if (!requireLogin()) return
    const liked = (post.likedBy || []).includes(currentUser.uid)
    try {
      await updateDoc(doc(db, 'forumPosts', post.id), {
        likedBy: liked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
        likesCount: increment(liked ? -1 : 1),
        updatedAt: serverTimestamp(),
      })

      if (!liked && post.authorId && post.authorId !== currentUser.uid) {
        await addDoc(collection(db, 'forumNotifications'), {
          toUserId: post.authorId,
          fromUserId: currentUser.uid,
          fromName: displayName,
          type: 'like',
          postId: post.id,
          text: `${displayName} đã thích bài viết của bạn`,
          read: false,
          createdAt: serverTimestamp(),
        })
      }
    } catch (error) {
      console.error('Không thể thích bài viết:', error)
      toast.error('Không thể cập nhật lượt thích')
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

  const openShareModal = (post) => {
    setShareModal(`${window.location.origin}${window.location.pathname}?post=${post.id}`)
  }

  const deletePost = async (post) => {
    if (!currentUser?.uid) return
    if (post.authorId !== currentUser.uid && roleKey !== 'admin') {
      toast.error('Bạn chỉ có thể xóa bài của mình')
      return
    }

    setConfirmModal({
      title: 'Xóa bài đăng?',
      message: 'Bạn có chắc chắn muốn xóa bài đăng này không? Hành động này không thể hoàn tác.',
      confirmText: 'Xóa bài',
      danger: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'forumPosts', post.id))
          if (selectedPost?.id === post.id) setSelectedPost(null)
          toast.success('Đã xóa bài viết')
        } catch (error) {
          console.error('Không thể xóa bài viết:', error)
          toast.error('Không thể xóa bài viết')
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
      <main className="min-h-screen bg-slate-50 text-slate-950 transition dark:bg-[#020617] dark:text-white">
<div className="flex min-h-screen">
            <Sidebar activeSection={activeSection} onChange={(section) => { setActiveSection(section); setFilter('all'); setMobileMenuOpen(false) }} dark={dark} onToggleDark={() => setManualDark((value) => !(value ?? syncedDark))} mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

          <section className="min-w-0 flex-1">
            

            <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
              <div className="min-w-0">
                {activeSection === SECTIONS.HALL && <HallHero stats={stats} onCompose={() => setComposerOpen(true)} />}
                {activeSection === SECTIONS.CLASSES && <ClassesHero classes={classes} userClass={userClass} />}
                {activeSection === SECTIONS.GROUPS && <GroupsHero onCreate={() => setGroupOpen(true)} />}
                {activeSection === SECTIONS.MY_POSTS && <SimpleHero icon="📝" title="Bài viết của tôi" subtitle="Quản lý các bài bạn đã đăng trong cộng đồng." />}
                {activeSection === SECTIONS.SAVED && <SimpleHero icon="🔖" title="Bài đã lưu" subtitle="Tài liệu, câu hỏi và thảo luận bạn muốn xem lại." />}
                {activeSection === SECTIONS.NOTIFICATIONS && <SimpleHero icon="🔔" title="Thông báo" subtitle="Tương tác mới từ bạn bè, giáo viên và nhóm học tập." />}

                {activeSection === SECTIONS.HALL && <ComposerBar onOpen={() => setComposerOpen(true)} initials={initials} name={displayName} />}

                {activeSection === SECTIONS.GROUPS ? (
                  <GroupsGrid groups={groups.length ? groups : DEFAULT_GROUPS} currentUserId={currentUser?.uid} onJoin={toggleJoinGroup} />
                ) : activeSection === SECTIONS.CLASSES ? (
                  <ClassesGrid classes={classes} userClass={userClass} onOpenClass={(className) => { setActiveSection(SECTIONS.CLASSES); setSearch(className) }} />
                ) : activeSection === SECTIONS.NOTIFICATIONS ? (
                  <NotificationList notifications={notifications} />
                ) : (
                  <>
                    <FilterBar filter={filter} setFilter={setFilter} sortBy={sortBy} setSortBy={setSortBy} />
                    <PostList
                      loading={loadingPosts}
                      posts={filteredPosts}
                      currentUserId={currentUser?.uid}
                      roleKey={roleKey}
                      onOpen={openPost}
                      onLike={toggleLike}
                      onSave={toggleSave}
                      onDelete={deletePost}
                      onShare={openShareModal}
                      onClear={() => { setSearch(''); setFilter('all') }}
                    />
                  </>
                )}
              </div>

              <RightSidebar
                posts={posts}
                groups={groups.length ? groups : DEFAULT_GROUPS}
                profile={{ displayName, initials, roleKey, userClass }}
                onOpenPost={openPost}
              />
            </div>
          </section>
        </div>

        <MobileNav activeSection={activeSection} onChange={(section) => { setActiveSection(section); setFilter('all') }} onCompose={() => setComposerOpen(true)} />
      </main>

      <PostModal open={composerOpen} onClose={() => setComposerOpen(false)} onSubmit={createPost} groups={groups} classes={classes} userClass={userClass} roleKey={roleKey} />
      <GroupModal open={groupOpen} onClose={() => setGroupOpen(false)} onSubmit={createGroup} />
      <PostDetailModal post={selectedPost} currentUser={currentUser} displayName={displayName} initials={initials} roleKey={roleKey} onClose={() => setSelectedPost(null)} onLike={toggleLike} onSave={toggleSave} onDelete={deletePost} onShare={openShareModal} />
      <CenterConfirmModal modal={confirmModal} onClose={() => setConfirmModal(null)} />
      <CenterShareModal link={shareModal} onClose={() => setShareModal(null)} />
    </div>
  )
}

function Sidebar({ activeSection, onChange, dark, onToggleDark, mobileOpen, onClose }) {
  const items = [
    { id: SECTIONS.HALL, label: 'Đại sảnh', icon: Globe2 },
    { id: SECTIONS.CLASSES, label: 'Lớp học', icon: BookOpen },
    { id: SECTIONS.GROUPS, label: 'Nhóm học', icon: Users },
    { id: SECTIONS.MY_POSTS, label: 'Bài của tôi', icon: FileText },
    { id: SECTIONS.SAVED, label: 'Đã lưu', icon: Bookmark },
    { id: SECTIONS.NOTIFICATIONS, label: 'Thông báo', icon: Bell },
  ]

  const content = (
    <aside className="sticky top-0 flex h-screen w-72 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white/95 p-4 shadow-xl shadow-slate-200/70 backdrop-blur dark:border-white/10 dark:bg-slate-950/95 dark:shadow-black/20">
      <div className="flex items-center justify-between gap-3 px-2 py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/25">
            <Globe2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">ZUNY Forum</h1>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Cộng đồng học tập</p>
          </div>
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
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black transition ${active ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'}`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          )
        })}
      </nav>


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
        <h2 className="text-3xl font-black tracking-tight md:text-5xl">Đại sảnh cộng đồng 🌍</h2>
        <p className="mt-4 max-w-lg text-sm font-semibold leading-7 text-white/75">Nơi học sinh và giáo viên cùng chia sẻ, hỏi đáp, đăng tài liệu và trò chuyện theo thời gian thực.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={onCompose} className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-indigo-700 shadow-lg transition hover:-translate-y-0.5">
            <Plus className="h-4 w-4" />
            Đăng bài mới
          </button>
          <span className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold backdrop-blur">Khám phá chủ đề ✨</span>
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
  return <SimpleHero icon="🏫" title="Lớp học của tôi" subtitle={`Không gian riêng tư cho lớp ${userClass || 'của bạn'}. Hiện có ${classes.length || 0} lớp trong Firebase.`} gradient="from-violet-600 via-indigo-600 to-purple-700" />
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

function FilterBar({ filter, setFilter, sortBy, setSortBy }) {
  const [sortOpen, setSortOpen] = useState(false)
  return (
<div className="relative z-50 mb-4 flex items-center gap-2 overflow-visible pb-1">
        {FILTER_TABS.map((tab) => {
        const Icon = tab.icon
        return <button key={tab.value} type="button" onClick={() => setFilter(tab.value)} className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition ${filter === tab.value ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20' : 'bg-white text-slate-500 hover:bg-slate-100 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'}`}><Icon className="h-3.5 w-3.5" />{tab.label}</button>
      })}
<div className="relative ml-auto shrink-0">
<button
  type="button"
  onClick={() => setSortOpen(!sortOpen)}
  className="flex min-w-[120px] items-center justify-between rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-slate-800"
>
  <span>
    {sortBy === 'newest' ? 'Mới nhất' : 'Phổ biến'}
  </span>

  <ChevronDown
    className={`h-5 w-5 shrink-0 transition-all duration-300 ${
      sortOpen ? 'rotate-180' : 'rotate-0'
    }`}
  />
</button>

  {sortOpen && (
    <div className="absolute right-0 top-full z-[999] mt-2 w-36 overflow-hidden rounded-xl border border-white/10 bg-slate-900 p-1 shadow-2xl">
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
          className={`block w-full rounded-lg px-3 py-2 text-left text-xs font-black transition ${
            sortBy === value
              ? 'bg-violet-600 text-white'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
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

function PostList({ loading, posts, currentUserId, roleKey, onOpen, onLike, onSave, onDelete, onShare, onClear }) {
  if (loading) return <div className="space-y-4">{[1, 2, 3].map((item) => <div key={item} className="h-52 animate-pulse rounded-3xl bg-white dark:bg-white/5" />)}</div>
  if (!posts.length) return <EmptyState icon="🔍" title="Không tìm thấy bài viết" description="Thử đổi bộ lọc hoặc từ khóa tìm kiếm." actionLabel="Xóa bộ lọc" onAction={onClear} />
  return <div className="space-y-4">{posts.map((post) => <PostCard key={post.id} post={post} currentUserId={currentUserId} roleKey={roleKey} onOpen={onOpen} onLike={onLike} onSave={onSave} onDelete={onDelete} onShare={onShare} />)}</div>
}

function PostCard({ post, currentUserId, roleKey, onOpen, onLike, onSave, onDelete, onShare = () => {} }) {
  const type = POST_TYPES.find((item) => item.value === post.type) || POST_TYPES[2]
  const TypeIcon = type.icon
  const liked = (post.likedBy || []).includes(currentUserId)
  const saved = (post.savedBy || []).includes(currentUserId)
  const canDelete = post.authorId === currentUserId || roleKey === 'admin'

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
        {post.imageUrl && <img src={post.imageUrl} alt="Minh họa bài viết" className="mt-4 max-h-80 w-full rounded-2xl object-cover" />}
        {post.type === 'event' && post.eventDate && <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-600 dark:bg-rose-500/10 dark:text-rose-200">🗓️ Bắt đầu: {formatEventDate(post.eventDate)}</div>}
        {post.attachmentUrl && <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-600 dark:bg-white/10 dark:text-slate-200">🔗 {post.attachmentName || post.attachmentUrl}</div>}
        {post.tags?.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{post.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 dark:bg-white/10 dark:text-slate-300">#{tag}</span>)}</div>}
      </button>

      <div className="flex items-center gap-1 border-t border-slate-200 px-4 py-3 dark:border-white/10">
        <ActionButton active={liked} onClick={() => onLike(post)} icon={Heart} label={Number(post.likesCount || 0)} />
        <ActionButton onClick={() => onOpen(post)} icon={MessageCircle} label={Number(post.commentsCount || 0)} />
        <ActionButton icon={Eye} label={Number(post.viewsCount || 0)} />
        <ActionButton active={saved} onClick={() => onSave(post)} icon={saved ? BookmarkCheck : Bookmark} label={saved ? 'Đã lưu' : 'Lưu'} />
        <button type="button" onClick={() => onShare(post)} className="ml-auto rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"><Share2 className="h-5 w-5" /></button>
        {canDelete && <button type="button" onClick={() => onDelete(post)} className="rounded-xl p-2 text-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"><Trash2 className="h-5 w-5" /></button>}
      </div>
    </article>
  )
}

function ActionButton({ icon: Icon, label, active, onClick = () => {} }) {
  return <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-black transition ${active ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-200' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'}`}><Icon className={`h-4 w-4 ${active ? 'fill-current' : ''}`} />{label}</button>
}

function EmptyState({ icon, title, description, actionLabel, onAction }) {
  return <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center dark:border-white/10 dark:bg-white/5"><div className="text-5xl">{icon}</div><h3 className="mt-4 text-xl font-black text-slate-950 dark:text-white">{title}</h3><p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{description}</p>{actionLabel && <button type="button" onClick={onAction} className="mt-5 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white">{actionLabel}</button>}</div>
}

function GroupsGrid({ groups, currentUserId, onJoin }) {
  return <div className="grid gap-4 sm:grid-cols-2">{groups.map((group) => <GroupCard key={group.id} group={group} joined={(group.memberIds || []).includes(currentUserId)} onJoin={onJoin} />)}</div>
}

function GroupCard({ group, joined, onJoin }) {
  const color = group.color?.includes('from-') ? group.color : 'from-indigo-500 to-violet-600'
  return (
    <div className="cursor-pointer rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br ${color} text-3xl shadow-lg`}>{group.emoji || '👥'}</div>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-black text-slate-950 dark:text-white">{group.name}</h3>
        {group.isPrivate && <LockKeyhole className="h-4 w-4 text-slate-400" />}
      </div>
      <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">{group.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">{(group.tags || []).map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 dark:bg-white/10 dark:text-slate-300">{tag}</span>)}</div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1 text-sm font-black text-slate-500 dark:text-slate-300"><Users className="h-4 w-4" />{Number(group.membersCount || group.members || 0)} thành viên</span>
        <button type="button" onClick={() => onJoin(group)} className={`rounded-2xl px-4 py-2 text-sm font-black transition ${joined ? 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200' : 'bg-violet-600 text-white'}`}>{joined ? 'Đã tham gia' : 'Tham gia'}</button>
      </div>
    </div>
  )
}

function ClassesGrid({ classes, userClass, onOpenClass }) {
  if (!classes.length) return <EmptyState icon="🏫" title="Chưa có dữ liệu lớp" description="Hãy tạo collection classes trong Firebase hoặc thêm lớp cho học sinh." />
  return <div className="grid gap-4 sm:grid-cols-2">{classes.map((item) => { const name = item.name || item.className || item.title || item.code || item.id; return <button key={item.id} type="button" onClick={() => onOpenClass(name)} className={`rounded-3xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${normalizeText(name) === normalizeText(userClass) ? 'border-violet-300 bg-violet-50 dark:border-violet-400/40 dark:bg-violet-500/10' : 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/5'}`}><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-2xl">🏫</div><h3 className="mt-4 text-lg font-black text-slate-950 dark:text-white">{name}</h3><p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-300">{item.description || item.subject || 'Không gian trao đổi riêng của lớp.'}</p><p className="mt-4 text-xs font-black text-violet-600 dark:text-violet-200">Xem bài viết lớp</p></button> })}</div>
}

function NotificationList({ notifications }) {
  if (!notifications.length) return <EmptyState icon="🔔" title="Chưa có thông báo" description="Khi có người thích, bình luận hoặc nhắc đến bạn, thông báo sẽ hiện ở đây." />
  return <div className="space-y-3">{notifications.map((item) => <div key={item.id} className={`cursor-pointer rounded-3xl border p-4 ${item.read ? 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/5' : 'border-violet-300 bg-violet-50 dark:border-violet-400/30 dark:bg-violet-500/10'}`}><p className="text-sm font-bold text-slate-800 dark:text-white">{item.text}</p><p className="mt-1 text-xs font-semibold text-slate-400">{formatRelativeTime(item.createdAt)}</p></div>)}</div>
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

      <div className="cursor-pointer rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-950/90 to-slate-900 p-5 text-white shadow-sm">
        <div className="text-xl">💡</div>
        <h3 className="mt-4 font-black">Mẹo học hôm nay</h3>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">
          "Chia nhỏ bài toán khó thành các bước nhỏ hơn — mỗi bước giải quyết được là một chiến thắng nhỏ."
        </p>
      </div>
    </aside>
  )
}

function MobileNav({ activeSection, onChange, onCompose }) {
  const items = [
    { id: SECTIONS.HALL, icon: Globe2, label: 'Sảnh' },
    { id: SECTIONS.CLASSES, icon: BookOpen, label: 'Lớp' },
    { id: SECTIONS.GROUPS, icon: Users, label: 'Nhóm' },
    { id: SECTIONS.NOTIFICATIONS, icon: Bell, label: 'Tin' },
  ]

  return <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 lg:hidden">{items.map((item) => { const Icon = item.icon; const active = activeSection === item.id; return <button key={item.id} type="button" onClick={() => onChange(item.id)} className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-black ${active ? 'text-violet-600 dark:text-violet-200' : 'text-slate-400'}`}><Icon className="h-5 w-5" />{item.label}</button> })}<button type="button" onClick={onCompose} className="flex flex-col items-center gap-1 rounded-2xl bg-violet-600 px-3 py-2 text-[11px] font-black text-white"><Plus className="h-5 w-5" />Đăng</button></div>
}

function PostModal({ open, onClose, onSubmit, groups, classes, userClass, roleKey }) {
  const initialForm = {
    title: '',
    content: '',
    type: 'announce',
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
  }
  const [form, setForm] = useState(initialForm)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (open) setForm((prev) => ({ ...prev, className: userClass || prev.className || '' }))
  }, [open, userClass])

  if (!open) return null

  const resetForm = () => setForm({ ...initialForm, className: userClass || '' })

  const addTag = () => {
    const tag = form.tagDraft.replace(/^#+/, '').trim()
    if (!tag) return setForm({ ...form, tagDraft: '#' })
    if (form.tags.includes(tag)) return setForm({ ...form, tagDraft: '#' })
    setForm({ ...form, tags: [...form.tags, tag].slice(0, 8), tagDraft: '#' })
  }

  const submit = (event) => {
    event.preventDefault()
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Vui lòng nhập tiêu đề và nội dung')
      return
    }
    if (form.scope === 'class' && !form.className) {
      toast.error('Vui lòng chọn lớp')
      return
    }
    if (form.scope === 'group' && !form.groupId) {
      toast.error('Vui lòng chọn nhóm')
      return
    }
    if (form.type === 'event' && !form.eventDate) {
      toast.error('Vui lòng chọn ngày bắt đầu sự kiện')
      return
    }
    onSubmit(form)
    resetForm()
  }

  const canPostClass = Boolean(userClass) || roleKey !== 'student'
  const typeButtons = [
    { value: 'discuss', label: 'Thảo luận', icon: '💬' },
    { value: 'question', label: 'Hỏi đáp', icon: '❓' },
    { value: 'share', label: 'Chia sẻ tài liệu', icon: '📄' },
    { value: 'announce', label: 'Thông báo', icon: '📢' },
    { value: 'event', label: 'Sự kiện', icon: '🗓️' },
  ]

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-900 shadow-[0_0_60px_rgba(124,58,237,0.35)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <h2 className="text-2xl font-black text-white">Đăng bài mới ✍️</h2>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="max-h-[68vh] overflow-y-auto px-6 py-6">
          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-sm font-black text-white">TN</div>
            <div>
              <p className="font-black text-white">{roleKey === 'teacher' ? 'Giáo viên' : 'Trần Nguyên'}</p>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {typeButtons.map((item) => <button key={item.value} type="button" onClick={() => setForm({ ...form, type: item.value })} className={`rounded-full px-4 py-2 text-sm font-black transition ${form.type === item.value ? 'bg-indigo-400 text-slate-950' : 'bg-white/10 text-slate-300 hover:bg-white/15'}`}>{item.icon} {item.label}</button>)}
          </div>

          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={form.type === 'event' ? 'Tiêu đề sự kiện...' : 'Tiêu đề bài viết...'} className="w-full border-0 border-b border-white/10 bg-transparent px-0 py-3 text-2xl font-black text-white outline-none placeholder:text-slate-500" />
          <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} rows={5} placeholder={form.type === 'event' ? 'Nội dung / mô tả sự kiện...' : 'Nội dung bài viết... (Hỗ trợ Markdown)'} className="mt-4 w-full resize-none rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-semibold leading-7 text-white outline-none placeholder:text-slate-500 focus:border-violet-400/60" />

          {form.type === 'event' && (
            <div className="mt-5 rounded-3xl border border-rose-400/20 bg-rose-500/10 p-4">
              <label className="text-sm font-black text-rose-200">Ngày bắt đầu sự kiện</label>
              <input type="date" value={form.eventDate} onChange={(event) => setForm({ ...form, eventDate: event.target.value })} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm font-bold text-white outline-none focus:border-rose-300" />
            </div>
          )}

          <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
            <label className="text-sm font-black text-slate-200">Tags</label>
            <div className="mt-3 flex flex-wrap gap-2">
              {form.tags.map((tag) => (
                <button key={tag} type="button" onClick={() => setForm({ ...form, tags: form.tags.filter((item) => item !== tag) })} className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-black text-violet-200">
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
              className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-violet-400/60"
            />
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setForm({ ...form, showImageInput: !form.showImageInput })} className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-slate-300 hover:bg-white/15">▧ Thêm ảnh</button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-slate-300 hover:bg-white/15">🔗 Đính kèm tệp</button>
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
            </div>

            {form.showImageInput && (
              <div className="flex gap-2 rounded-3xl border border-white/10 bg-white/5 p-2">
                <input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="Dán link ảnh vào đây..." className="min-w-0 flex-1 rounded-2xl bg-slate-800 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500" />
                <button type="button" onClick={() => form.imageUrl.trim() ? toast.success('Đã tải ảnh từ link') : toast.error('Vui lòng nhập link ảnh')} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white">Tải ảnh</button>
              </div>
            )}

            {form.attachmentName && <p className="rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-slate-300">Tệp đã chọn: {form.attachmentName}</p>}
          </div>

          <div className="mt-5 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
            <ToggleSwitch checked={form.isAnonymous} onChange={(checked) => setForm({ ...form, isAnonymous: checked })} icon="⌘" label="Đăng ẩn danh" />
            <ToggleSwitch checked={form.teacherOnly} onChange={(checked) => setForm({ ...form, teacherOnly: checked })} icon="🎓" label="Chỉ giáo viên được trả lời" />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
          <p className="text-sm font-bold text-slate-400">Tối đa 10,000 ký tự</p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="rounded-2xl px-5 py-3 text-sm font-black text-slate-400 hover:bg-white/10">Hủy</button>
            <button type="submit" className="rounded-2xl bg-violet-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-violet-500/20 disabled:opacity-50">Đăng bài 🚀</button>
          </div>
        </div>
      </form>
    </div>
  )
}

function ToggleSwitch({ checked, onChange, icon, label }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition ${checked ? 'border-violet-400/60 bg-violet-500/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
      <span className="flex items-center gap-3 text-sm font-black text-slate-200"><span>{icon}</span>{label}</span>
      <span className={`flex h-7 w-12 items-center rounded-full p-1 transition ${checked ? 'bg-violet-500' : 'bg-slate-700'}`}>
        <span className={`h-5 w-5 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} />
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

function PostDetailModal({ post, currentUser, displayName, initials, roleKey, onClose, onLike, onSave, onDelete, onShare }) {
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

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-white/10"><button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><ChevronLeft className="h-4 w-4" />Đóng</button><button type="button" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"><MoreHorizontal className="h-5 w-5" /></button></div>
        <div className="overflow-y-auto p-5">
          <PostCard post={post} currentUserId={currentUser?.uid} roleKey={roleKey} onOpen={() => {}} onLike={onLike} onSave={onSave} onDelete={onDelete} onShare={onShare} />
          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <h3 className="mb-4 text-lg font-black text-slate-950 dark:text-white">Trò chuyện / Bình luận realtime</h3>
            <div className="space-y-3">
              {comments.length ? comments.map((comment) => <CommentItem key={comment.id} comment={comment} />) : <p className="rounded-2xl bg-white p-4 text-sm font-semibold text-slate-400 dark:bg-slate-900">Chưa có bình luận. Hãy là người đầu tiên trao đổi!</p>}
            </div>
          </div>
        </div>
        <form onSubmit={addComment} className="flex items-center gap-3 border-t border-slate-200 p-4 dark:border-white/10">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-black text-white">{initials}</div>
          <input ref={inputRef} value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Nhập tin nhắn/bình luận..." className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5 dark:text-white" />
          <button type="submit" className="rounded-2xl bg-violet-600 p-3 text-white"><Send className="h-5 w-5" /></button>
        </form>
      </div>
    </div>
  )
}

function CommentItem({ comment }) {
  return <div className="flex gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-xs font-black text-white">{comment.authorInitials || getInitials(comment.authorName)}</div><div className="min-w-0 flex-1 rounded-2xl bg-white p-3 dark:bg-slate-900"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-black text-slate-950 dark:text-white">{comment.authorName}</span><span className="text-[11px] font-bold text-slate-400">{formatRelativeTime(comment.createdAt)}</span></div><p className="mt-1 whitespace-pre-line text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{comment.content}</p></div></div>
}

function ModalShell({ title, onClose, children }) {
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

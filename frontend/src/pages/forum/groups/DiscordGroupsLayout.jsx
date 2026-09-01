import { roleText } from '../utils/forumConstants'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  db,
  deleteDoc,
  doc,
  documentId,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from './forumSqlAdapter'
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Flag,
  Globe2,
  Hash,
  Image,
  LockKeyhole,
  Menu,
  Paperclip,
  Pencil,
  Pin,
  Plus,
  Search,
  Send,
  Settings,
  Share2,
  ThumbsUp,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'

import {
  formatRelativeTime,
  getInitials,
  getRoleKey,
  normalizeGroupCode,
  generateInviteCode,
  normalizeText,
  timestampToMs,
} from '../utils/forumUtils'

// Default channels when creating a new group
const DEFAULT_CHANNEL_IDS = ['thong-bao', 'thao-luan']
const MAX_TEXT_CHANNELS = 10
const SUPPORTED_CHANNEL_TYPES = new Set(['announce', 'info', 'chat', 'files'])
const DEPRECATED_CHANNEL_IDS = new Set(['phong-hoc-thoai'])

const normalizeInviteCode = (value = '') => {
  const cleaned = String(value || '').replace(/[^a-zA-Z0-9!@#$%^&*_]/g, '')
  const [prefix = '', suffix = ''] = cleaned.split('_')
  const safePrefix = prefix.replace(/[^a-zA-Z0-9!@#$%^&*]/g, '').slice(0, 6)
  const safeSuffix = suffix.replace(/[^0-9]/g, '').slice(0, 4)
  return cleaned.includes('_') ? `${safePrefix}_${safeSuffix}` : safePrefix
}

const ALL_POSSIBLE_CHANNELS = [
  { id: 'thong-bao', label: 'thông-báo', icon: '📢', type: 'announce' },
  { id: 'noi-quy', label: 'nội-quy', icon: '📌', type: 'info' },
  { id: 'thao-luan', label: 'thảo-luận', icon: '💬', type: 'chat' },
  { id: 'hoi-bai', label: 'hỏi-bài', icon: '❓', type: 'chat' },
  { id: 'on-thi', label: 'ôn-thi', icon: '🎯', type: 'chat' },
  { id: 'meo-hoc', label: 'mẹo-học', icon: '💡', type: 'chat' },
  { id: 'tai-lieu', label: 'tài-liệu', icon: '📚', type: 'files' },
  { id: 'thanh-tich', label: 'thành-tích', icon: '🏆', type: 'info' },
  { id: 'ai-hoc-tap', label: 'AI-học-tập', icon: '🧠', type: 'chat' },
]

const DEFAULT_CHANNELS = DEFAULT_CHANNEL_IDS
  .map((id) => ALL_POSSIBLE_CHANNELS.find((ch) => ch.id === id))
  .filter(Boolean)

const ROLE_BADGES = {
  admin_dev: { label: 'Admin', bg: 'bg-sky-100 text-blue-700 dark:bg-sky-500/20 dark:text-sky-300', dot: 'bg-sky-400' },
  admin: { label: 'Admin', bg: 'bg-sky-100 text-blue-700 dark:bg-sky-500/20 dark:text-sky-300', dot: 'bg-sky-400' },
  teacher: { label: 'GV', bg: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300', dot: 'bg-amber-400' },
  student: { label: 'HS', bg: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300', dot: 'bg-emerald-400' },
}

const EMOJI_LIST = ['😀','😂','😍','🥰','😎','🤔','😮','😢','😡','👍','👎','❤️','🔥','🎉','✅','❌','💯','🙏','👏','🤣']

// Check if a message content is emoji-only (for large rendering)
const EMOJI_REGEX = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\uFE0F|\u200D|\u20E3)+$/u
const isEmojiOnly = (text = '') => {
  const cleaned = text.replace(/\s/g, '')
  return cleaned.length > 0 && EMOJI_REGEX.test(cleaned) && cleaned.length <= 14
}

const GROUPS_PER_PAGE = 12
const MEMBERS_PER_PAGE = 10

const GROUP_REPORT_REASONS = [
  'Nội dung không phù hợp',
  'Spam hoặc quảng cáo',
  'Lừa đảo hoặc giả mạo',
  'Ngôn từ xúc phạm / quấy rối',
  'Chia sẻ tài liệu vi phạm',
  'Nhóm hoạt động sai mục đích',
  'Khác',
]

const gradeRank = (value = '') => {
  const text = normalizeText(value)

  if (!text || text === 'none' || text === 'khong' || text === 'khong gioi han') return 0
  if (text.includes('10')) return 10
  if (text.includes('11')) return 20
  if (text.includes('12')) return 30
  if (text.includes('teacher') || text.includes('giao vien')) return 40

  return 0
}

const getInviteExpiryMs = (value = 'unlimited') => {
  if (value === '1d') return 24 * 60 * 60 * 1000
  if (value === '7d') return 7 * 24 * 60 * 60 * 1000
  if (value === '30d') return 30 * 24 * 60 * 60 * 1000
  return 0
}


const GROUP_THEME_COLORS = [
  { name: 'Tím', value: '#8b5cf6' },
  { name: 'Xanh tím', value: '#5865f2' },
  { name: 'Lục', value: '#10b981' },
  { name: 'Ngọc', value: '#14b8a6' },
  { name: 'Vàng', value: '#f59e0b' },
  { name: 'Đỏ', value: '#ef4444' },
  { name: 'Hồng', value: '#ec4899' },
  { name: 'Lam', value: '#06b6d4' },
]

const GROUP_THEME_GRADIENTS = [
  { name: 'Tím hồng', value: 'linear-gradient(135deg, #8b5cf6, #ec4899)' },
  { name: 'Xanh tím', value: 'linear-gradient(135deg, #6366f1, #06b6d4)' },
  { name: 'Cam đỏ', value: 'linear-gradient(135deg, #f97316, #ef4444)' },
  { name: 'Xanh lá', value: 'linear-gradient(135deg, #22c55e, #06b6d4)' },
  { name: 'Vàng cam', value: 'linear-gradient(135deg, #eab308, #f97316)' },
  { name: 'Tím xanh', value: 'linear-gradient(135deg, #8b5cf6, #6366f1)' },
]

const isGradientTheme = (theme = '') => String(theme || '').includes('gradient')

const getGroupThemeStyle = (theme = '', cover = '') => {
  if (cover) return { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  if (!theme) return undefined
  return { background: theme }
}

const getGroupAvatarStyle = (theme = '') => {
  if (!theme) return undefined
  return { background: theme }
}

const ForumUserAvatar = ({
  avatarUrl = '',
  name = 'Thành viên',
  initials = '',
  sizeClass = 'h-10 w-10',
  roundedClass = 'rounded-full',
  className = '',
  children = null,
}) => (
  <div className={`relative shrink-0 overflow-visible ${sizeClass} ${className}`}>
    <div className={`h-full w-full overflow-hidden bg-gradient-to-br from-sky-500 to-blue-500 text-xs font-black text-white ${roundedClass}`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name || 'Thành viên'}
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="grid h-full w-full place-items-center">{initials || getInitials(name)}</span>
      )}
    </div>
    {children}
  </div>
)

// ── PAGINATION ────────────────────────────────────────────────────────────────
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  return (
    <div className="flex items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-xs font-black transition ${
            p === page
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
              : 'border border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
          }`}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── EMOJI PICKER ─────────────────────────────────────────────────────────────
function EmojiPicker({ onSelect, onClose }) {
  return (
    <div className="absolute bottom-full right-0 z-50 mb-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-white/10 dark:bg-slate-900">
      <div className="grid grid-cols-5 gap-1">
        {EMOJI_LIST.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => { onSelect(emoji); onClose() }}
            className="flex h-10 w-full items-center justify-center rounded-xl text-xl transition hover:bg-slate-100 dark:hover:bg-white/10"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── REACTION PICKER ───────────────────────────────────────────────────────────
function ReactionPicker({ onSelect, onClose }) {
  return (
    <div className="absolute bottom-full right-0 z-50 mb-1 flex gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-slate-900">
      {EMOJI_LIST.slice(0, 8).map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => { onSelect(emoji); onClose() }}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-base transition hover:scale-125 hover:bg-slate-100 dark:hover:bg-white/10"
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

// ── PINNED MESSAGES POPUP ─────────────────────────────────────────────────────
function PinnedMessagesPopup({ pinnedMessages, resolveUser = () => ({}), onClose }) {
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-white/10 dark:bg-slate-950/40">
          <div className="flex items-center gap-2">
            <Pin className="h-5 w-5 text-amber-500" />
            <h3 className="text-lg font-black text-slate-950 dark:text-white">Tin nhắn đã ghim</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
          {pinnedMessages.length === 0 ? (
            <p className="py-8 text-center text-sm font-bold text-slate-400 dark:text-slate-500">Chưa có tin nhắn nào được ghim.</p>
          ) : pinnedMessages.map((msg) => {
            const syncedAuthor = resolveUser(msg.authorId, {
              name: msg.authorName,
              initials: msg.authorInitials,
              avatarUrl: msg.authorPhotoURL || msg.avatarUrl || '',
            })

            return (
            <div key={msg.id} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-400/20 dark:bg-white/5">
              <div className="mb-2 flex items-center gap-2">
                <ForumUserAvatar
                  avatarUrl={syncedAuthor.avatarUrl}
                  name={syncedAuthor.name}
                  initials={syncedAuthor.initials}
                  sizeClass="h-7 w-7"
                />
                <span className="text-sm font-black text-slate-950 dark:text-white">{syncedAuthor.name}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{formatRelativeTime(msg.createdAt)}</span>
              </div>
              <p className="text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{msg.content}</p>
            </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── MEMBER LIST POPUP (full roster, paginated) ───────────────────────────────
function MemberListPopup({
  members = [],
  onlineIds = [],
  ownerId = '',
  adminIds = [],
  currentUserId = '',
  canManage = false,
  canKick = false,
  deputyPermissions = {},
  onKick = () => {},
  onPromote = () => {},
  onRemoveDeputy = () => {},
  onTransferOwner = () => {},
  onUpdateDeputyPermission = () => {},
  onClose,
}) {
  const [page, setPage] = useState(1)

  const managers = members.filter((member) => member.id === ownerId || adminIds.includes(member.id))
  const normalMembers = members.filter((member) => member.id !== ownerId && !adminIds.includes(member.id))
  const orderedMembers = [...managers, ...normalMembers]
  const totalPages = Math.max(1, Math.ceil(orderedMembers.length / MEMBERS_PER_PAGE))
  const pageMembers = orderedMembers.slice((page - 1) * MEMBERS_PER_PAGE, page * MEMBERS_PER_PAGE)
  const pageManagers = pageMembers.filter((member) => member.id === ownerId || adminIds.includes(member.id))
  const pageNormalMembers = pageMembers.filter((member) => member.id !== ownerId && !adminIds.includes(member.id))

  const deputyKickEnabled = deputyPermissions.kickMember !== false
  const deputyApproveEnabled = deputyPermissions.approveMember !== false

  const renderMemberCard = (member) => {
    const online = onlineIds.includes(member.id)
    const isOwner = member.id === ownerId
    const isDeputy = !isOwner && adminIds.includes(member.id)
    const isNormalMember = !isOwner && !isDeputy

    return (
      <div key={member.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-blue-200 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:border-blue-400/30 dark:hover:bg-white/[0.075]">
        <div className="flex items-center gap-3">
          <div className="relative h-11 w-11 shrink-0 overflow-visible rounded-2xl bg-gradient-to-br from-sky-500 to-blue-500 text-xs font-black text-white shadow-lg shadow-blue-500/20">
            <div className="h-full w-full overflow-hidden rounded-2xl">
              {member.avatarUrl ? (
                <img
                  src={member.avatarUrl}
                  alt={member.name || 'Thành viên'}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="grid h-full w-full place-items-center">{member.initials || getInitials(member.name)}</span>
              )}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-50 dark:border-slate-900 ${online ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-slate-950 dark:text-white">{member.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${
                isOwner
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200'
                  : isDeputy
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200'
                    : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
              }`}>
                {isOwner ? 'Trưởng nhóm' : isDeputy ? 'Phó nhóm' : 'Thành viên'}
              </span>
              <span className={`text-[11px] font-bold ${online ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`}>
                {online ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {member.id !== currentUserId && (
            <div className="flex shrink-0 flex-col gap-1">
              {canManage && isNormalMember && (
                <button type="button" onClick={() => onPromote(member)} className="rounded-lg bg-blue-100 px-2.5 py-1 text-[10px] font-black text-blue-700 transition hover:bg-blue-200 dark:bg-blue-500/15 dark:text-blue-200 dark:hover:bg-blue-500/25">
                  Làm phó nhóm
                </button>
              )}

              {canManage && !isOwner && (
                <button type="button" onClick={() => onTransferOwner(member)} className="rounded-lg bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-700 transition hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/25">
                  Chuyển trưởng
                </button>
              )}

              {canKick && !isOwner && (
                <button type="button" onClick={() => onKick(member)} className="rounded-lg bg-rose-100 px-2.5 py-1 text-[10px] font-black text-rose-700 transition hover:bg-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25">
                  Kick
                </button>
              )}
            </div>
          )}
        </div>

        {canManage && isDeputy && (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950/40">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-slate-700 dark:text-slate-200">Quyền phó nhóm</p>
                <p className="mt-0.5 text-[11px] font-bold text-slate-400 dark:text-slate-500">Trưởng nhóm vẫn có toàn quyền cao hơn phó nhóm.</p>
              </div>
              <button type="button" onClick={() => onRemoveDeputy(member)} className="shrink-0 rounded-xl bg-rose-500 px-3 py-1.5 text-[10px] font-black text-white transition hover:bg-rose-600">
                Xóa phó nhóm
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/5">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Kick thành viên</span>
                <input type="checkbox" checked={deputyKickEnabled} onChange={(event) => onUpdateDeputyPermission('kickMember', event.target.checked)} className="h-4 w-4 accent-blue-600" />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/5">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Duyệt thành viên</span>
                <input type="checkbox" checked={deputyApproveEnabled} onChange={(event) => onUpdateDeputyPermission('approveMember', event.target.checked)} className="h-4 w-4 accent-blue-600" />
              </label>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-white/10 dark:bg-slate-950/40">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-black text-slate-950 dark:text-white">Thành viên nhóm</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-500 dark:bg-white/10 dark:text-slate-300">{members.length}</span>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[64vh] overflow-y-auto p-4">
          {pageMembers.length === 0 ? (
            <p className="py-8 text-center text-sm font-bold text-slate-400 dark:text-slate-500">Chưa có thành viên nào.</p>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-400">Quản trị viên</p>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-600 dark:bg-blue-500/15 dark:text-blue-200">{managers.length}</span>
                </div>
                {pageManagers.length > 0 ? (
                  pageManagers.map(renderMemberCard)
                ) : (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-400 dark:bg-white/5">Không có quản trị viên ở trang này.</div>
                )}
              </div>

              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Thành viên</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500 dark:bg-white/10 dark:text-slate-300">{normalMembers.length}</span>
                </div>
                {pageNormalMembers.length > 0 ? (
                  pageNormalMembers.map(renderMemberCard)
                ) : (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-400 dark:bg-white/5">Không có thành viên.</div>
                )}
              </div>
            </>
          )}
        </div>

        {totalPages > 1 && (
          <div className="border-t border-slate-200 px-4 py-3 dark:border-white/10">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── SEARCH POPUP ──────────────────────────────────────────────────────────────
function SearchPopup({ messages, onClose }) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => {
    const kw = normalizeText(query.trim())
    if (!kw) return []
    return messages.filter((m) => normalizeText(m.content || '').includes(kw) || normalizeText(m.authorName || '').includes(kw))
  }, [query, messages])

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center bg-slate-950/60 pt-20 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900" onMouseDown={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <Search className="h-5 w-5 text-slate-400 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm tin nhắn, người dùng..."
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
            />
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          {query && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="rounded-lg bg-white px-2 py-1 dark:bg-white/5">from: <span className="text-slate-800 dark:text-white">tác giả</span></span>
              <span className="rounded-lg bg-white px-2 py-1 dark:bg-white/5">has: <span className="text-slate-800 dark:text-white">link, file, hình ảnh</span></span>
            </div>
          )}
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-3 space-y-2">
          {!query && (
            <div className="py-6 text-center text-sm font-bold text-slate-400 dark:text-slate-500">Nhập từ khóa để tìm kiếm tin nhắn</div>
          )}
          {query && results.length === 0 && (
            <div className="py-6 text-center text-sm font-bold text-slate-400 dark:text-slate-500">Không tìm thấy kết quả</div>
          )}
          {results.map((msg) => (
            <div key={msg.id} className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-black text-slate-950 dark:text-white">{msg.authorName}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{formatRelativeTime(msg.createdAt)}</span>
              </div>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const HISTORY_PAGE_SIZE = 5

const isAnnouncementMessage = (msg = {}) => {
  const messageType = String(msg.messageType || msg.type || '').toLowerCase()
  return Boolean(msg.isAnnouncement || messageType === 'notice' || messageType === 'announcement')
}

const isFileMessage = (msg = {}) => {
  const messageType = String(msg.messageType || '').toLowerCase()
  const hasFile = Boolean(msg.fileUrl || msg.attachmentUrl || msg.downloadUrl)
  return hasFile && messageType !== 'image'
}

const getFileUrl = (msg = {}) => msg.fileUrl || msg.attachmentUrl || msg.downloadUrl || msg.imageUrl || ''

const formatFileSize = (bytes = 0) => {
  const size = Number(bytes || 0)
  if (!size) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

const downloadFileFromUrl = async (url = '', filename = 'download') => {
  if (!url) return toast.error('Không tìm thấy file để tải')
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename || 'download'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  } catch (error) {
    try {
      const link = document.createElement('a')
      link.href = url
      link.download = filename || 'download'
      link.target = '_blank'
      link.rel = 'noreferrer'
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch {
      toast.error('Không thể tải file')
    }
  }
}

function HistoryPopup({ title, icon, items = [], type = 'announcement', onClose }) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / HISTORY_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = items.slice((safePage - 1) * HISTORY_PAGE_SIZE, safePage * HISTORY_PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [items.length, type])

  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-white/10 dark:bg-slate-950/40">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
              <span>{icon}</span>
              Lịch sử nhóm
            </div>
            <h3 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {pageItems.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-8 text-center text-sm font-bold text-slate-400 dark:bg-white/5 dark:text-slate-500">
              {type === 'file' ? 'Chưa có tài liệu nào được gửi trong nhóm.' : 'Chưa có thông báo nào trong nhóm.'}
            </p>
          ) : (
            <div className="space-y-3">
              {pageItems.map((item) => {
                const fileUrl = getFileUrl(item)
                return (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-950/40 dark:text-slate-300">
                        {type === 'file' ? 'Tài liệu' : 'Thông báo'}
                      </span>
                      <span className="text-sm font-black text-slate-950 dark:text-white">{item.authorName || 'Thành viên'}</span>
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{formatRelativeTime(item.createdAt)}</span>
                    </div>

                    {type === 'file' ? (
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-200">
                          <Paperclip className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-slate-800 dark:text-white">{item.fileName || item.content || 'Tệp đính kèm'}</p>
                          <p className="mt-1 text-xs font-bold text-slate-400 dark:text-slate-500">{[item.fileType, formatFileSize(item.fileSize)].filter(Boolean).join(' • ') || 'Tệp đã gửi trong nhóm'}</p>
                        </div>
                        <a href={fileUrl} download={item.fileName || true} target="_blank" rel="noreferrer" className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-700">
                          Mở/Tải
                        </a>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words text-sm font-semibold leading-7 text-slate-600 dark:text-slate-200">{item.content}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 dark:border-white/10">
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage <= 1} className="rounded-2xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15">
            Trang trước
          </button>
          <span className="text-xs font-black text-slate-400 dark:text-slate-500">Trang {safePage}/{totalPages}</span>
          <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={safePage >= totalPages} className="rounded-2xl bg-blue-600 px-4 py-2 text-xs font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">
            Trang sau
          </button>
        </div>
      </div>
    </div>
  )
}

function ImageLightbox({ image, onClose }) {
  if (!image?.url) return null
  return (
    <div className="fixed inset-0 z-[98] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="relative max-h-[92vh] max-w-[94vw]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="absolute right-0 top-0 z-10 flex -translate-y-full items-center gap-2 pb-3">
          <button type="button" onClick={() => downloadFileFromUrl(image.url, image.fileName || 'image')} className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2 text-xs font-black text-white backdrop-blur transition hover:bg-white/25">
            <Download className="h-4 w-4" /> Tải ảnh
          </button>
          <button type="button" onClick={onClose} className="rounded-2xl bg-white/15 p-2 text-white backdrop-blur transition hover:bg-white/25" aria-label="Đóng ảnh">
            <X className="h-5 w-5" />
          </button>
        </div>
        <img src={image.url} alt={image.fileName || 'Hình ảnh'} className="max-h-[85vh] max-w-[90vw] rounded-3xl object-contain shadow-2xl" />
      </div>
    </div>
  )
}


export default function DiscordGroupsLayout({ groups, currentUser, displayName, initials, avatarUrl = '', roleKey, userClass = '', initialActiveGroupId = '', onJoin, onDelete, onCreate, groupReports = [], onReportGroup = () => {}, onAdminJoinReportedGroup = () => {}, onChannelViewChange = () => {} }) {  const [activeGroupId, setActiveGroupId] = useState(null)

  useEffect(() => {
    onChannelViewChange(Boolean(activeGroupId))
    return () => onChannelViewChange(false)
  }, [activeGroupId, onChannelViewChange])
  const [optimisticJoinedGroupIds, setOptimisticJoinedGroupIds] = useState([])

useEffect(() => {
  if (!initialActiveGroupId) return

  const targetGroup = groups.find((group) => group.id === initialActiveGroupId)
  if (!targetGroup) return

  const rawChannels = Array.isArray(targetGroup.channels) && targetGroup.channels.length
    ? targetGroup.channels
    : DEFAULT_CHANNELS

  const firstChannel = rawChannels
    .map(normalizeChannel)
    .filter(Boolean)[0]

  setActiveGroupId(targetGroup.id)
  setActiveChannelId(firstChannel?.id || 'thao-luan')
}, [initialActiveGroupId, groups])
  const [activeChannelId, setActiveChannelId] = useState('thao-luan')
  const [textChannelsCollapsed, setTextChannelsCollapsed] = useState(false)
  const [settingsTextChannelsCollapsed, setSettingsTextChannelsCollapsed] = useState(false)
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [search, setSearch] = useState('')
  const [groupsPage, setGroupsPage] = useState(1)
  const [groupListFilter, setGroupListFilter] = useState('all')
  const [pinnedGroupIds, setPinnedGroupIds] = useState([])
  const [groupCodeInput, setGroupCodeInput] = useState('')
  const [joinPasswordModal, setJoinPasswordModal] = useState(null)
  const [joinPassword, setJoinPassword] = useState('')
  const [onlineCounts, setOnlineCounts] = useState({})
  const [groupMenuOpen, setGroupMenuOpen] = useState(false)
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false)
  const [groupSettingsTab, setGroupSettingsTab] = useState('overview')
  const [savingGroupSettings, setSavingGroupSettings] = useState(false)
  const [groupSettingsForm, setGroupSettingsForm] = useState({
    name: '',
    description: '',
    groupType: 'public',
    isPrivate: false,
    isHidden: false,
    password: '',
    themeColor: '#8b5cf6',
    coverImage: '',
    emoji: '👥',
    memberLimit: 1000,
    minGrade: '',
    requireApproval: false,
    adminIds: [],
    pendingMemberIds: [],
    inviteExpiry: 'unlimited',
    inviteCodePrefix: '',
    inviteCodeSuffix: '',
    permissions: {
      sendMessage: true,
      sendImage: true,
      sendFile: true,
      invite: true,
      createPost: true,
    },
    deputyPermissions: {
      kickMember: true,
      approveMember: true,
    },
  })
  // New states
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showPlusMenu, setShowPlusMenu] = useState(false)
  const [showPinnedPopup, setShowPinnedPopup] = useState(false)
  const [showMemberList, setShowMemberList] = useState(false)
  const [showSearchPopup, setShowSearchPopup] = useState(false)
  const [showAnnouncementsPopup, setShowAnnouncementsPopup] = useState(false)
  const [showFilesPopup, setShowFilesPopup] = useState(false)
  const [zoomedImage, setZoomedImage] = useState(null)
  const [invitePopupOpen, setInvitePopupOpen] = useState(false)
  const [groupReportModal, setGroupReportModal] = useState(null)
  const [messageMode, setMessageMode] = useState('text')
  const imageFileInputRef = useRef(null)
  const groupFileInputRef = useRef(null)
  const plusMenuRef = useRef(null)
  // Channels managed per group (array of { id, label, icon, type })
  const [groupChannels, setGroupChannels] = useState({})
  // Channel management (inline inside settings now)
  const [newChannelName, setNewChannelName] = useState('')
  const [editingChannelId, setEditingChannelId] = useState(null)
  const [editingChannelLabel, setEditingChannelLabel] = useState('')
  // Message reactions: { [msgId]: { [userId]: emoji } }
  const [msgReactions, setMsgReactions] = useState({})
  // Inline reply (Hall-style): { msgId, authorName, content }
  const [replyTo, setReplyTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  // Pinned message ids per docId
  const [pinnedMsgIds, setPinnedMsgIds] = useState({})
  // Per-message reaction picker
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState(null)
  const [messageMoreMenuId, setMessageMoreMenuId] = useState(null)
  // Message editing: { msgId, content } | null
  const [editingMsg, setEditingMsg] = useState(null)
  const [editingContent, setEditingContent] = useState('')
  // Unread counts per channel docId
  const [unreadCounts, setUnreadCounts] = useState({})
  const [lastReadMs, setLastReadMs] = useState({})
  // Real presence for the active group only (used to mark members online/offline)
  const [activeGroupOnlineIds, setActiveGroupOnlineIds] = useState([])
  // Realtime presence detail per user: channel currently being viewed.
  const [activeGroupPresence, setActiveGroupPresence] = useState({})
  // Full member profiles for the active group's roster (uid -> { id, name, initials, role })
  const [memberProfiles, setMemberProfiles] = useState({})
  // SQL user profiles for group owners, shown only to admin_dev on group cards
  const [ownerProfiles, setOwnerProfiles] = useState({})
  // Right sidebar collapsed state
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false)
  // Delete channel confirmation: { channelId, channelLabel } | null
  const [deleteChannelConfirm, setDeleteChannelConfirm] = useState(null)
  const [leaveGroupConfirm, setLeaveGroupConfirm] = useState(false)
  const [mobileChannelSidebarOpen, setMobileChannelSidebarOpen] = useState(false)
  // Member tooltip: { memberId, memberName, channelLabel } | null
  const [memberTooltip, setMemberTooltip] = useState(null)
  const memberTooltipTimeout = useRef(null)
  const leaveMessageSendingRef = useRef(new Set())
  const voluntaryLeavingGroupIdsRef = useRef(new Set())

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const replyInputRef = useRef(null)

  const getReadStorageKey = () => `forumGroupChatRead:${currentUser?.uid || 'guest'}`

  const loadStoredReadMs = () => {
    if (typeof window === 'undefined' || !currentUser?.uid) return {}
    try {
      const parsed = JSON.parse(window.localStorage.getItem(getReadStorageKey()) || '{}')
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  const saveStoredReadMs = (nextReadMs) => {
    if (typeof window === 'undefined' || !currentUser?.uid) return
    try {
      window.localStorage.setItem(getReadStorageKey(), JSON.stringify(nextReadMs || {}))
    } catch {
      // Không chặn UI nếu trình duyệt không cho ghi localStorage.
    }
  }

  useEffect(() => {
    if (!showPlusMenu) return undefined

    const handlePointerDown = (event) => {
      if (!plusMenuRef.current || plusMenuRef.current.contains(event.target)) return
      setShowPlusMenu(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [showPlusMenu])

  useEffect(() => {
    if (!currentUser?.uid) {
      setPinnedGroupIds([])
      return undefined
    }

    const userRef = doc(db, 'users', currentUser.uid)
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : {}
        setPinnedGroupIds(Array.isArray(data.pinnedGroupIds) ? data.pinnedGroupIds.filter(Boolean) : [])
      },
      (error) => console.warn('Không thể tải danh sách nhóm đã ghim:', error),
    )

    return () => unsubscribe()
  }, [currentUser?.uid])

  const currentUserMatchesGroupValue = (value) => {
    if (!currentUser?.uid || !value) return false

    if (typeof value === 'string') {
      return value === currentUser.uid || normalizeText(value) === normalizeText(currentUser.email)
    }

    if (typeof value === 'object') {
      return (
        value.uid === currentUser.uid ||
        value.id === currentUser.uid ||
        value.userId === currentUser.uid ||
        normalizeText(value.email) === normalizeText(currentUser.email)
      )
    }

    return false
  }

  const isCurrentUserGroupOwner = (group = {}) => {
    const ownerValues = [
      group.ownerId,
      group.createdBy,
      group.creatorId,
      group.createdById,
      group.adminId,
    ]

    return ownerValues.some(currentUserMatchesGroupValue)
  }

  const isCurrentUserGroupMember = (group = {}) => {
    if (!currentUser?.uid) return false
    if (isCurrentUserGroupOwner(group)) return true
    if (group.id && optimisticJoinedGroupIds.includes(group.id)) return true

    const possibleMemberLists = [
      group.memberIds,
      group.members,
      group.userIds,
      group.joinedUsers,
      group.participants,
      group.studentIds,
      group.students,
      group.adminIds,
      group.admins,
    ]

    return possibleMemberLists.some(
      (list) => Array.isArray(list) && list.some(currentUserMatchesGroupValue),
    )
  }

  const canCurrentUserSeeHiddenGroup = (group = {}) => {
    if (roleKey === 'admin_dev') return true
    return isCurrentUserGroupMember(group)
  }


  const isAdminRole = ['admin', 'admin_dev'].includes(roleKey)
  const getOpenReportsForGroup = (groupId = '') => (groupReports || []).filter((report) => report.groupId === groupId && (report.status || 'open') === 'open')
  const isGroupReported = (group = {}) => getOpenReportsForGroup(group.id).length > 0 || group.reportStatus === 'open'

  const getPinnedOrder = (groupId = '') => {
    const index = pinnedGroupIds.indexOf(groupId)
    return index === -1 ? Number.MAX_SAFE_INTEGER : index
  }

  const sortPinnedGroupsFirst = (items = []) =>
    [...items].sort((first, second) => {
      const firstPinned = pinnedGroupIds.includes(first.id)
      const secondPinned = pinnedGroupIds.includes(second.id)

      if (firstPinned !== secondPinned) return firstPinned ? -1 : 1
      if (firstPinned && secondPinned) return getPinnedOrder(first.id) - getPinnedOrder(second.id)
      return 0
    })

  const activeGroup = groups.find((g) => g.id === activeGroupId) || null
  const joinedGroups = groups.filter((g) => isCurrentUserGroupMember(g))
  const orderedJoinedGroups = sortPinnedGroupsFirst(joinedGroups)
  const totalGroups = groups.filter((group) => !group.isSample).length
  const publicGroupsCount = groups.filter((group) => !group.isSample && (group.groupType || (group.isPrivate ? 'private' : 'public')) === 'public' && !group.isHidden).length
  const getGroupOnlineCount = (group = {}) => Number(onlineCounts[group.id] ?? group.onlineCount ?? group.onlineMembersCount ?? 0)
  const totalOnline = groups.reduce((sum, group) => sum + getGroupOnlineCount(group), 0)

  useEffect(() => {
    if (!currentUser?.uid || !optimisticJoinedGroupIds.length) return
    setOptimisticJoinedGroupIds((prev) => prev.filter((groupId) => {
      const group = groups.find((item) => item.id === groupId)
      if (!group) return true
      const possibleMemberLists = [group.memberIds, group.members, group.userIds, group.joinedUsers, group.participants, group.studentIds, group.students, group.adminIds, group.admins]
      const confirmed = isCurrentUserGroupOwner(group) || possibleMemberLists.some((list) => Array.isArray(list) && list.some(currentUserMatchesGroupValue))
      return !confirmed
    }))
  }, [groups, currentUser?.uid, optimisticJoinedGroupIds.length])

  useEffect(() => {
    if (!activeGroup || !currentUser?.uid) return
    const stillMember = isCurrentUserGroupMember(activeGroup)
    const isOwner = isCurrentUserGroupOwner(activeGroup)
    const canViewWithoutMembership = roleKey === 'admin_dev'
    if (stillMember || isOwner || canViewWithoutMembership) return
    const voluntarilyLeft = voluntaryLeavingGroupIdsRef.current.has(activeGroup.id)
    if (voluntarilyLeft) voluntaryLeavingGroupIdsRef.current.delete(activeGroup.id)
    setShowMemberList(false)
    setGroupSettingsOpen(false)
    setGroupMenuOpen(false)
    setActiveGroupId(null)
    setActiveChannelId('thao-luan')
    if (!voluntarilyLeft) {
      toast.error(`Bạn đã bị đưa ra khỏi nhóm "${activeGroup.name || 'Nhóm học'}"`, { id: 'forum-kicked-out-notice' })
    }
  }, [activeGroup?.id, activeGroup?.memberIds?.join(','), activeGroup?.members?.length, activeGroup?.joinedUsers?.length, activeGroup?.ownerId, optimisticJoinedGroupIds.join(','), currentUser?.uid, roleKey])

  // Normalize a raw channel entry (supports legacy string ids and full objects)
  const normalizeChannel = (raw) => {
    if (!raw) return null
    if (typeof raw === 'string') {
      if (DEPRECATED_CHANNEL_IDS.has(raw)) return null
      const preset = ALL_POSSIBLE_CHANNELS.find((ch) => ch.id === raw)
      return preset ? { ...preset } : { id: raw, label: raw, icon: '#️⃣', type: 'chat' }
    }
    if (typeof raw === 'object') {
      if (!raw.id || DEPRECATED_CHANNEL_IDS.has(raw.id)) return null
      const type = raw.type || 'chat'
      if (!SUPPORTED_CHANNEL_TYPES.has(type)) return null
      return { id: raw.id, label: raw.label || raw.id, icon: Object.prototype.hasOwnProperty.call(raw, 'icon') ? raw.icon : '#️⃣', type }
    }
    return null
  }

  const slugifyChannelId = (label) => {
    const base = normalizeText(label).trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    return `${base || 'kenh'}-${Math.random().toString(36).slice(2, 6)}`
  }

  // Channels for the active group (full objects, custom names allowed)
  const DISCORD_CHANNELS = useMemo(() => {
    const raw = activeGroupId ? groupChannels[activeGroupId] : null
    const list = Array.isArray(raw) && raw.length ? raw : DEFAULT_CHANNELS
    const normalizedChannels = list.map(normalizeChannel).filter(Boolean)
    return normalizedChannels.length ? normalizedChannels : DEFAULT_CHANNELS
  }, [activeGroupId, groupChannels])

  useEffect(() => {
    if (!activeGroupId || !DISCORD_CHANNELS.length) return
    if (DISCORD_CHANNELS.some((channel) => channel.id === activeChannelId)) return
    setActiveChannelId(DISCORD_CHANNELS[0].id)
  }, [activeGroupId, activeChannelId, DISCORD_CHANNELS])

  const activeChannel = DISCORD_CHANNELS.find((c) => c.id === activeChannelId) || DISCORD_CHANNELS[0]
  const textChannels = DISCORD_CHANNELS
  const activeGroupAdminIds = activeGroup?.adminIds || []
  const isActiveGroupOwner = Boolean(activeGroup && activeGroup.ownerId === currentUser?.uid)
  const isActiveGroupDeputy = Boolean(activeGroup && activeGroupAdminIds.includes(currentUser?.uid))
  const canManageActiveGroup = Boolean(activeGroup && !activeGroup.isSample && (isActiveGroupOwner || ['admin', 'admin_dev'].includes(roleKey)))
  const canSeeAdvancedGroupSettings = canManageActiveGroup
  const deputyPermissions = {
    kickMember: true,
    approveMember: true,
    ...(activeGroup?.deputyPermissions || {}),
  }
  const canKickInActiveGroup = Boolean(
    activeGroup &&
    !activeGroup.isSample &&
    (isActiveGroupOwner || ['admin', 'admin_dev'].includes(roleKey) || (isActiveGroupDeputy && deputyPermissions.kickMember !== false)),
  )
  const canApproveInActiveGroup = Boolean(
    activeGroup &&
    !activeGroup.isSample &&
    (isActiveGroupOwner || ['admin', 'admin_dev'].includes(roleKey) || (isActiveGroupDeputy && deputyPermissions.approveMember !== false)),
  )
  const canModerateActiveGroup = canKickInActiveGroup || canApproveInActiveGroup
  const activeGroupPermissions = {
    sendMessage: true,
    sendImage: true,
    sendFile: true,
    invite: true,
    createPost: true,
    ...(activeGroup?.permissions || {}),
  }
  const canSendGroupMessage = canManageActiveGroup || activeGroupPermissions.sendMessage !== false
  const canSendGroupImage = canManageActiveGroup || activeGroupPermissions.sendImage !== false
  const canSendGroupFile = canManageActiveGroup || activeGroupPermissions.sendFile !== false
  const canInviteToActiveGroup = canManageActiveGroup || activeGroupPermissions.invite !== false

  const getUserGradeValue = () => {
    if (['admin_dev', 'admin'].includes(roleKey)) return 'none'
    if (roleKey === 'teacher') return 'teacher'

    const candidates = [
      userClass,
      currentUser?.className,
      currentUser?.class,
      currentUser?.lop,
      currentUser?.studentClass,
      currentUser?.grade,
    ]

    const text = normalizeText(candidates.filter(Boolean).join(' '))
    if (text.includes('12')) return 'grade12'
    if (text.includes('11')) return 'grade11'
    if (text.includes('10')) return 'grade10'
    return ''
  }

  const canJoinByMinGrade = (group = {}) => {
    const minGrade = group.minGrade || ''
    if (!minGrade || minGrade === 'none') return true
    return gradeRank(getUserGradeValue()) >= gradeRank(minGrade)
  }

  const generateUniqueInviteCode = () => {
    const usedCodes = new Set(groups.filter((group) => group.id !== activeGroup?.id).map((group) => normalizeInviteCode(group.inviteCode)).filter(Boolean))

    for (let index = 0; index < 120; index += 1) {
      const code = generateInviteCode()
      if (!usedCodes.has(normalizeInviteCode(code))) return code
    }

    return generateInviteCode()
  }

  const togglePinGroup = async (group = {}, event) => {
    event?.stopPropagation?.()

    if (!currentUser?.uid) {
      toast.error('Bạn cần đăng nhập để ghim nhóm')
      return
    }

    if (!group?.id) return

    const alreadyPinned = pinnedGroupIds.includes(group.id)
    setPinnedGroupIds((prev) =>
      alreadyPinned ? prev.filter((id) => id !== group.id) : [...prev, group.id],
    )

    try {
      await setDoc(
        doc(db, 'users', currentUser.uid),
        {
          pinnedGroupIds: alreadyPinned ? arrayRemove(group.id) : arrayUnion(group.id),
        },
        { merge: true },
      )
    } catch (error) {
      setPinnedGroupIds((prev) =>
        alreadyPinned ? [...prev, group.id] : prev.filter((id) => id !== group.id),
      )
      toast.error(alreadyPinned ? 'Không thể bỏ ghim nhóm' : 'Không thể ghim nhóm')
    }
  }

  const activeDocId = activeGroupId && activeChannelId ? `${activeGroupId}_${activeChannelId}` : null

  // Pinned messages for current channel
  const pinnedMessages = useMemo(() => {
    if (!activeDocId) return []
    const ids = new Set(pinnedMsgIds[activeDocId] || [])
    return messages.filter((m) => ids.has(m.id))
  }, [messages, pinnedMsgIds, activeDocId])

  // Full member roster for the active group (uses real profiles when loaded)
  const rosterMembers = useMemo(() => {
    if (!activeGroup) return []
    const ids = activeGroup.memberIds || []
    return ids.map((uid) => {
      if (uid === currentUser?.uid) {
        return { id: uid, name: displayName, initials, role: roleKey, avatarUrl }
      }
      return memberProfiles[uid] || { id: uid, name: 'Thành viên', initials: 'TV', role: 'student' }
    })
  }, [activeGroup, memberProfiles, currentUser?.uid, displayName, initials, avatarUrl, roleKey])

  // Only members who are genuinely online right now (joined + currently present)
  const onlineRosterMembers = useMemo(
    () => rosterMembers.filter((member) => activeGroupOnlineIds.includes(member.id)),
    [rosterMembers, activeGroupOnlineIds],
  )


  const resolveSyncedUser = (userId = '', fallback = {}) => {
    const sqlProfile = userId === currentUser?.uid
      ? { id: currentUser.uid, name: displayName, initials, role: roleKey, avatarUrl }
      : memberProfiles[userId] || ownerProfiles[userId] || {}

    const name = sqlProfile.name || fallback.name || fallback.authorName || 'Thành viên'
    return {
      id: userId || sqlProfile.id || fallback.id || '',
      name,
      initials: sqlProfile.initials || fallback.initials || fallback.authorInitials || getInitials(name),
      role: sqlProfile.role || fallback.role || fallback.authorRole || 'student',
      avatarUrl:
        sqlProfile.avatarUrl ||
        fallback.avatarUrl ||
        fallback.authorPhotoURL ||
        fallback.photoURL ||
        '',
    }
  }

  const filteredGroups = useMemo(() => {
    const keyword = normalizeText(search.trim())
    const codeKeyword = normalizeGroupCode(search)

    const visibleGroups = groups.filter((group) => {
      const groupCode = normalizeGroupCode(group.groupCode)
      const isHidden = Boolean(group.isHidden || group.groupType === 'hidden')
      const openedByExactCode = Boolean(codeKeyword && groupCode === codeKeyword)
      const isJoinedByCurrentUser = isCurrentUserGroupMember(group)

      if (groupListFilter === 'joined' && !isJoinedByCurrentUser) return false
      if (isHidden && !openedByExactCode && !canCurrentUserSeeHiddenGroup(group)) return false

      if (!keyword && !codeKeyword) return true

      const groupName = normalizeText(group.name)
      const groupTags = Array.isArray(group.tags) ? group.tags : []

      return (
        groupName.includes(keyword) ||
        (codeKeyword && groupCode.includes(codeKeyword)) ||
        groupTags.some((tag) => normalizeText(tag).includes(keyword))
      )
    })

    return sortPinnedGroupsFirst(visibleGroups)
  }, [groups, search, groupListFilter, pinnedGroupIds, roleKey, currentUser?.uid, currentUser?.email])


  useEffect(() => {
    setGroupsPage(1)
  }, [search, groupListFilter])

  // Pagination for the groups hall: max 4 rows x 3 columns (12) per page
  const totalGroupPages = Math.max(1, Math.ceil(filteredGroups.length / GROUPS_PER_PAGE))
  const pagedGroups = filteredGroups.slice((groupsPage - 1) * GROUPS_PER_PAGE, groupsPage * GROUPS_PER_PAGE)

  // Đồng bộ realtime hồ sơ người tạo nhóm đang hiển thị cho admin_dev.
  useEffect(() => {
    if (roleKey !== 'admin_dev') {
      setOwnerProfiles({})
      return undefined
    }

    const ownerIds = [...new Set(pagedGroups.map((group) => group.ownerId).filter(Boolean))]
    if (!ownerIds.length) {
      setOwnerProfiles({})
      return undefined
    }

    const chunks = []
    for (let index = 0; index < ownerIds.length; index += 10) {
      chunks.push(ownerIds.slice(index, index + 10))
    }

    const chunkProfiles = chunks.map(() => ({}))
    const publishProfiles = () => setOwnerProfiles(Object.assign({}, ...chunkProfiles))

    const unsubscribes = chunks.map((chunk, chunkIndex) => {
      const ownersQuery = query(
        collection(db, 'users'),
        where(documentId(), 'in', chunk),
      )

      return onSnapshot(
        ownersQuery,
        (snapshot) => {
          const nextChunkProfiles = {}
          snapshot.docs.forEach((item) => {
            const data = item.data() || {}
            const name = data.fullName || data.displayName || data.name || data.email || 'Chưa rõ tên'
            nextChunkProfiles[item.id] = {
              id: item.id,
              name,
              email: data.email || '',
              initials: getInitials(name, data.email),
              role: getRoleKey(data.role || data.userRole || data.type),
              avatarUrl:
                data.photoURL ||
                data.avatarUrl ||
                data.avatarURL ||
                data.avatar ||
                data.profileImage ||
                '',
            }
          })
          chunkProfiles[chunkIndex] = nextChunkProfiles
          publishProfiles()
        },
        (error) => console.warn('Không thể đồng bộ người tạo nhóm:', error),
      )
    })

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
  }, [roleKey, pagedGroups.map((group) => group.ownerId || '').join('|')])

  useEffect(() => { setGroupsPage(1) }, [search])
  useEffect(() => { if (groupsPage > totalGroupPages) setGroupsPage(totalGroupPages) }, [totalGroupPages, groupsPage])

  // Load group channels from SQL API
  useEffect(() => {
    if (!activeGroupId) return undefined
    const groupRef = doc(db, 'forumGroups', activeGroupId)
    const unsub = onSnapshot(groupRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        const channels = data.channels || DEFAULT_CHANNELS
        setGroupChannels((prev) => ({ ...prev, [activeGroupId]: channels }))
      }
    }, (err) => console.warn('channels error', err))
    return () => unsub()
  }, [activeGroupId])

  // Load read markers for the signed-in user. They are kept per user so badges do not
  // reappear after a refresh once that user has opened a channel.
  useEffect(() => {
    setLastReadMs(loadStoredReadMs())
  }, [currentUser?.uid])

  // Mark the currently opened channel as read.
  useEffect(() => {
    if (!activeGroupId || !activeChannelId || !currentUser?.uid) return
    const docId = `${activeGroupId}_${activeChannelId}`
    const readAt = Date.now()
    setLastReadMs((prev) => {
      const next = { ...prev, [docId]: readAt }
      saveStoredReadMs(next)
      return next
    })
    setUnreadCounts((prev) => ({ ...prev, [docId]: 0 }))
  }, [activeGroupId, activeChannelId, currentUser?.uid])

  // Track unread messages in every joined group's channel, even while the user is not
  // inside the Nhóm học screen. Messages sent by the current user are not counted.
  useEffect(() => {
    if (!currentUser?.uid || !joinedGroups.length) {
      setUnreadCounts({})
      return undefined
    }

    const unsubs = []
    joinedGroups.forEach((group) => {
      const rawChannels = Array.isArray(group.channels) && group.channels.length ? group.channels : DEFAULT_CHANNELS
      rawChannels.map(normalizeChannel).filter(Boolean).forEach((ch) => {
        const docId = `${group.id}_${ch.id}`
        const q = query(
          collection(db, 'forumGroupChats', docId, 'messages'),
          orderBy('createdAt', 'asc'),
          limit(200),
        )

        unsubs.push(onSnapshot(q, (snap) => {
          const isActiveChannel = activeGroupId === group.id && activeChannelId === ch.id
          if (isActiveChannel) {
            setUnreadCounts((prev) => ({ ...prev, [docId]: 0 }))
            return
          }

          const readMs = lastReadMs[docId] || 0
          const unread = snap.docs.filter((d) => {
            const data = d.data() || {}
            if (data.authorId === currentUser.uid) return false
            const msgMs = timestampToMs(data.createdAt)
            return msgMs > readMs
          }).length

          setUnreadCounts((prev) => {
            if (prev[docId] === unread) return prev
            return { ...prev, [docId]: unread }
          })
        }, () => {}))
      })
    })

    return () => unsubs.forEach((unsubscribe) => unsubscribe())
  }, [currentUser?.uid, joinedGroups.map((group) => `${group.id}:${(group.channels || []).map((ch) => (typeof ch === 'string' ? ch : ch.id)).join(',')}`).join('|'), activeGroupId, activeChannelId, lastReadMs])

  useEffect(() => {
    const presenceQuery = query(collectionGroup(db, 'presence'), where('online', '==', true))
    const unsubscribe = onSnapshot(
      presenceQuery,
      (snapshot) => {
        const nextCounts = {}
        const now = Date.now()
        snapshot.docs.forEach((item) => {
          const data = item.data()
          const groupId = data.groupId || item.ref.parent.parent?.id || ''
          const lastSeenMs = timestampToMs(data.lastSeen)
          if (!groupId) return
          if (lastSeenMs && now - lastSeenMs > 90 * 1000) return
          nextCounts[groupId] = Number(nextCounts[groupId] || 0) + 1
        })
        setOnlineCounts(nextCounts)
      },
      (error) => console.warn('Không thể tải trạng thái online nhóm:', error),
    )
    return () => unsubscribe()
  }, [])

  // Real presence list (member ids actually online) for the active group only
  useEffect(() => {
    if (!activeGroupId) {
      setActiveGroupOnlineIds([])
      setActiveGroupPresence({})
      return undefined
    }

    const presenceQuery = query(
      collection(db, 'forumGroups', activeGroupId, 'presence'),
      where('online', '==', true),
    )

    const unsubscribe = onSnapshot(
      presenceQuery,
      (snapshot) => {
        const now = Date.now()
        const nextPresence = {}

        snapshot.docs.forEach((item) => {
          const data = item.data() || {}
          const lastSeenMs = timestampToMs(data.lastSeen)
          if (lastSeenMs && now - lastSeenMs > 90 * 1000) return

          nextPresence[item.id] = {
            userId: item.id,
            channelId: data.channelId || '',
            channelLabel: data.channelLabel || '',
            lastSeen: data.lastSeen || null,
          }
        })

        setActiveGroupPresence(nextPresence)
        setActiveGroupOnlineIds(Object.keys(nextPresence))
      },
      (error) => console.warn('Không thể tải trạng thái online thành viên:', error),
    )

    return () => unsubscribe()
  }, [activeGroupId])

  // Đồng bộ realtime hồ sơ SQL của toàn bộ thành viên trong nhóm.
  // Avatar luôn lấy từ collection users, vì vậy khi người dùng đổi ảnh đại diện,
  // danh sách thành viên và tin nhắn đang mở sẽ cập nhật ngay mà không cần tải lại trang.
  useEffect(() => {
    const ids = [...new Set([
      ...(activeGroup?.memberIds || []),
      ...(activeGroup?.pendingMemberIds || []),
    ])].filter((uid) => uid && uid !== currentUser?.uid)

    if (!activeGroupId || !ids.length) {
      setMemberProfiles({})
      return undefined
    }

    const chunks = []
    for (let index = 0; index < ids.length; index += 10) {
      chunks.push(ids.slice(index, index + 10))
    }

    const chunkProfiles = chunks.map(() => ({}))
    const publishProfiles = () => {
      setMemberProfiles(Object.assign({}, ...chunkProfiles))
    }

    const unsubscribes = chunks.map((chunk, chunkIndex) => {
      const usersQuery = query(
        collection(db, 'users'),
        where(documentId(), 'in', chunk),
      )

      return onSnapshot(
        usersQuery,
        (snapshot) => {
          const nextChunkProfiles = {}

          snapshot.docs.forEach((item) => {
            const data = item.data() || {}
            const name = data.fullName || data.displayName || data.name || data.email || 'Thành viên'

            nextChunkProfiles[item.id] = {
              id: item.id,
              name,
              initials: getInitials(name, data.email),
              role: getRoleKey(data.role || data.userRole || data.type),
              avatarUrl:
                data.photoURL ||
                data.avatarUrl ||
                data.avatarURL ||
                data.avatar ||
                data.profileImage ||
                '',
            }
          })

          chunkProfiles[chunkIndex] = nextChunkProfiles
          publishProfiles()
        },
        (error) => console.warn('Không thể đồng bộ hồ sơ thành viên:', error),
      )
    })

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
  }, [activeGroupId, activeGroup?.memberIds?.join(','), activeGroup?.pendingMemberIds?.join(','), currentUser?.uid])

  useEffect(() => {
    if (!currentUser?.uid || !activeGroupId || !activeChannelId) return undefined

    const presenceRef = doc(db, 'forumGroups', activeGroupId, 'presence', currentUser.uid)
    const currentChannelLabel = activeChannel?.label || activeChannelId

    const writeOnline = async () => {
      try {
        await setDoc(
          presenceRef,
          {
            groupId: activeGroupId,
            userId: currentUser.uid,
            displayName,
            initials,
            roleKey,
            online: true,
            channelId: activeChannelId,
            channelLabel: currentChannelLabel,
            lastSeen: serverTimestamp(),
          },
          { merge: true },
        )
      } catch (error) {
        console.warn('Không thể cập nhật trạng thái online:', error)
      }
    }

    const writeOffline = () => {
      updateDoc(presenceRef, { online: false, lastSeen: serverTimestamp() }).catch(() => {})
    }

    writeOnline()
    const interval = window.setInterval(writeOnline, 30000)
    window.addEventListener('beforeunload', writeOffline)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('beforeunload', writeOffline)
      writeOffline()
    }
  }, [
    currentUser?.uid,
    activeGroupId,
    activeChannelId,
    activeChannel?.label,
    displayName,
    initials,
    roleKey,
  ])

  useEffect(() => {
    if (!activeGroupId || !activeChannelId) { setMessages([]); return undefined }
    const collId = 'forumGroupChats'
    const docId = `${activeGroupId}_${activeChannelId}`
    const q = query(collection(db, collId, docId, 'messages'), orderBy('createdAt', 'asc'), limit(200))
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    }, (err) => console.warn('chat error', err))
    return () => unsub()
  }, [activeGroupId, activeChannelId])

  // Load pinned message ids
  useEffect(() => {
    if (!activeDocId) return undefined
    const pinRef = doc(db, 'forumGroupChats', activeDocId)
    const unsub = onSnapshot(pinRef, (snap) => {
      if (snap.exists()) {
        setPinnedMsgIds((prev) => ({ ...prev, [activeDocId]: snap.data().pinnedIds || [] }))
      }
    }, (err) => console.warn('pin error', err))
    return () => unsub()
  }, [activeDocId])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (!activeGroup) return
    setGroupSettingsForm({
      name: activeGroup.name || '',
      description: activeGroup.description || '',
      groupType: activeGroup.groupType || (activeGroup.isPrivate ? 'private' : 'public'),
      isPrivate: Boolean(activeGroup.isPrivate),
      isHidden: Boolean(activeGroup.isHidden || activeGroup.groupType === 'hidden'),
      password: activeGroup.password || '',
      themeColor: activeGroup.themeColor || '#8b5cf6',
      coverImage: activeGroup.coverImage || activeGroup.coverUrl || activeGroup.bannerUrl || activeGroup.imageUrl || '',
      emoji: activeGroup.emoji || '👥',
      memberLimit: Number(activeGroup.memberLimit || 1000),
      minGrade: activeGroup.minGrade || '',
      requireApproval: Boolean(activeGroup.requireApproval),
      adminIds: activeGroup.adminIds || [],
      pendingMemberIds: activeGroup.pendingMemberIds || [],
      inviteExpiry: activeGroup.inviteExpiry || 'unlimited',
      inviteCode: activeGroup.inviteCode || '',
      permissions: {
        sendMessage: true,
        sendImage: true,
        sendFile: true,
        invite: true,
        createPost: true,
        ...(activeGroup.permissions || {}),
      },
      deputyPermissions: {
        kickMember: true,
        approveMember: true,
        ...(activeGroup.deputyPermissions || {}),
      },
    })
    setGroupMenuOpen(false)
  }, [activeGroupId, activeGroup?.name, activeGroup?.description, activeGroup?.groupType, activeGroup?.isPrivate, activeGroup?.isHidden, activeGroup?.password, activeGroup?.themeColor, activeGroup?.coverImage, activeGroup?.coverUrl, activeGroup?.emoji, activeGroup?.memberLimit, activeGroup?.permissions, activeGroup?.inviteCode, activeGroup?.minGrade, activeGroup?.requireApproval, activeGroup?.adminIds, activeGroup?.pendingMemberIds, activeGroup?.inviteExpiry, activeGroup?.deputyPermissions])

  useEffect(() => {
    if (!replyTo) return
    window.setTimeout(() => replyInputRef.current?.focus(), 60)
  }, [replyTo?.msgId])

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!currentUser?.uid) return toast.error('Bạn cần đăng nhập')
    if (!canSendGroupMessage) return toast.error('Nhóm này đã tắt quyền nhắn tin của thành viên')
    const text = inputText.trim()
    if (!text) return
    try {
      const collId = 'forumGroupChats'
      const docId = `${activeGroupId}_${activeChannelId}`
      await addDoc(collection(db, collId, docId, 'messages'), {
        content: text,
        messageType: messageMode === 'notice' ? 'notice' : 'text',
        isAnnouncement: messageMode === 'notice',
        authorId: currentUser.uid,
        authorName: displayName,
        authorInitials: initials,
        authorRole: roleKey,
        authorPhotoURL: avatarUrl,
        createdAt: serverTimestamp(),
      })
      setInputText('')
      setMessageMode('text')
      setTimeout(() => inputRef.current?.focus(), 50)
    } catch (err) {
      toast.error('Không thể gửi tin nhắn')
    }
  }

  const sendAttachmentMessage = async (file, messageType = 'file') => {
    if (!currentUser?.uid) return toast.error('Bạn cần đăng nhập')
    if (!file) return

    const isImage = messageType === 'image'
    if (isImage && !canSendGroupImage) return toast.error('Nhóm này đã tắt quyền gửi ảnh của thành viên')
    if (!isImage && !canSendGroupFile) return toast.error('Nhóm này đã tắt quyền gửi file của thành viên')

    try {
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const collId = 'forumGroupChats'
          const docId = `${activeGroupId}_${activeChannelId}`
          await addDoc(collection(db, collId, docId, 'messages'), {
            content: isImage ? `Đã gửi hình ảnh: ${file.name}` : `Đã gửi file: ${file.name}`,
            messageType,
            fileName: file.name,
            fileSize: file.size || 0,
            fileType: file.type || '',
            fileUrl: String(reader.result || ''),
            authorId: currentUser.uid,
            authorName: displayName,
            authorInitials: initials,
            authorRole: roleKey,
            authorPhotoURL: avatarUrl,
            createdAt: serverTimestamp(),
          })
          toast.success(isImage ? 'Đã gửi hình ảnh' : 'Đã gửi file')
        } catch (error) {
          console.error('Không thể gửi tệp:', error)
          toast.error('Không thể gửi tệp')
        }
      }
      reader.onerror = () => toast.error('Không thể đọc tệp')
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Không thể gửi tệp:', error)
      toast.error('Không thể gửi tệp')
    }
  }

  const handleAttachmentInput = (event, messageType = 'file') => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setShowPlusMenu(false)
    if (!file) return
    if (messageType === 'image' && !file.type?.startsWith('image/')) {
      toast.error('Vui lòng chọn đúng file hình ảnh')
      return
    }
    sendAttachmentMessage(file, messageType)
  }

  const enableNoticeMessage = () => {
    if (!canSendGroupMessage) return toast.error('Nhóm này đã tắt quyền nhắn tin của thành viên')
    setMessageMode('notice')
    setShowPlusMenu(false)
    window.setTimeout(() => inputRef.current?.focus(), 50)
    toast.success('Tin nhắn tiếp theo sẽ được gửi dưới dạng thông báo')
  }

  // Hall-style inline reply: posted directly from underneath the message being replied to
  const submitReply = async (e) => {
    e.preventDefault()
    if (!currentUser?.uid) return toast.error('Bạn cần đăng nhập')
    if (!canSendGroupMessage) return toast.error('Nhóm này đã tắt quyền nhắn tin của thành viên')
    if (!replyTo) return
    const text = replyText.trim()
    if (!text) return
    try {
      const collId = 'forumGroupChats'
      const docId = `${activeGroupId}_${activeChannelId}`
      await addDoc(collection(db, collId, docId, 'messages'), {
        content: text,
        authorId: currentUser.uid,
        authorName: displayName,
        authorInitials: initials,
        authorRole: roleKey,
        authorPhotoURL: avatarUrl,
        createdAt: serverTimestamp(),
        replyToId: replyTo.msgId,
        replyToAuthor: replyTo.authorName,
        replyToContent: replyTo.content,
      })
      setReplyTo(null)
      setReplyText('')
    } catch (err) {
      toast.error('Không thể gửi trả lời')
    }
  }


  const openGroupReportModal = (group) => {
    if (!currentUser?.uid) return toast.error('Bạn cần đăng nhập để báo cáo nhóm')
    setGroupReportModal({ group, reason: GROUP_REPORT_REASONS[0], detail: '' })
  }

  const submitGroupReport = async () => {
    const group = groupReportModal?.group
    const reason = String(groupReportModal?.reason || '').trim()
    const detail = String(groupReportModal?.detail || '').trim()
    if (!group?.id) return
    if (!reason && !detail) return toast.error('Vui lòng chọn hoặc nhập lý do báo cáo nhóm')

    await onReportGroup({ group, reason, detail })
    setGroupReportModal(null)
  }

  const handleJoinGroup = async (group) => {
    const joined = isCurrentUserGroupMember(group)
    const groupType = group.groupType || (group.isPrivate ? 'private' : 'public')
    const adminBypassReportedGroup = isAdminRole && getOpenReportsForGroup(group.id).length > 0

    if (groupType === 'invite_only' && !joined && !adminBypassReportedGroup && !group.openedByGroupCode && !group.openedByInviteCode) {
      toast.error('Nhóm này chỉ có thể tham gia bằng mã mời')
      return
    }

    const memberLimit = Number(group.memberLimit || 1000)
    const currentMemberCount = Number(group.membersCount || group.memberIds?.length || 0)
    if (!joined && !adminBypassReportedGroup && currentMemberCount >= memberLimit) {
      toast.error('Nhóm đã vượt quá giới hạn thành viên nên bạn không thể tham gia')
      return
    }

    if (!joined && !adminBypassReportedGroup && group.minGrade && group.minGrade !== 'none') {
  const requiredRank = gradeRank(group.minGrade)
  const userRank = ['teacher', 'admin', 'admin_dev'].includes(roleKey)
    ? 40
    : gradeRank(userClass)

  if (requiredRank > 0 && userRank < requiredRank) {
    toast.error('Bạn chưa đủ lớp học tối thiểu để tham gia nhóm này')
    return
  }
}

    if (!joined && !adminBypassReportedGroup && group.requireApproval) {
      await onJoin(group)
      return
    }

    if (group.isPrivate && !joined && !adminBypassReportedGroup) {
      setJoinPassword('')
      setJoinPasswordModal(group)
      return
    }

    if (!joined && group.id) {
      setOptimisticJoinedGroupIds((prev) => prev.includes(group.id) ? prev : [...prev, group.id])
    }

    if (!group.isSample) {
      setActiveGroupId(group.id)
      const rawChannels = Array.isArray(group.channels) && group.channels.length ? group.channels : DEFAULT_CHANNELS
      const firstChannel = rawChannels.map(normalizeChannel).filter(Boolean)[0]
      setActiveChannelId(firstChannel?.id || 'thao-luan')
    }

    await onJoin(group)
  }

  // Leaving a group while inside it immediately returns to the groups hall
const handleLeaveGroup = async () => {
  if (activeGroup?.id) voluntaryLeavingGroupIdsRef.current.add(activeGroup.id)
  if (!activeGroup) return

  if (activeGroup.ownerId === currentUser?.uid) {
    toast.error('Bạn không thể rời nhóm khi bạn là trưởng nhóm. Hãy chuyển nhượng chức trưởng nhóm cho thành viên khác trước.')
    return
  }

  if (leaveMessageSendingRef.current.has(activeGroup.id)) return
  leaveMessageSendingRef.current.add(activeGroup.id)
  leaveMessageSendingRef.current.delete(activeGroup.id)

  setOptimisticJoinedGroupIds((prev) => prev.filter((groupId) => groupId !== activeGroup.id))

  try {
    const notificationSnapshot = await getDocs(
      query(
        collection(db, 'forumNotifications'),
        where('toUserId', '==', currentUser?.uid || ''),
        limit(300),
      ),
    )

    const staleGroupNotifications = notificationSnapshot.docs.filter(
      (notificationDoc) => notificationDoc.data()?.scope === 'group' && notificationDoc.data()?.groupId === activeGroup.id,
    )

    await Promise.all(staleGroupNotifications.map((notificationDoc) => deleteDoc(notificationDoc.ref)))
  } catch (error) {
    console.warn('Không thể dọn thông báo của nhóm đã rời:', error)
  }

  await onJoin(activeGroup)
  setGroupMenuOpen(false)
  setActiveGroupId(null)
  setActiveChannelId('thao-luan')
}

  const confirmPrivateJoin = () => {
    if (!joinPasswordModal) return
    const joined = (joinPasswordModal.memberIds || []).includes(currentUser?.uid)
    const expectedPassword = String(joinPasswordModal.password || '').trim()
    const inputPassword = joinPassword.trim()
    const needsPassword = Boolean(joinPasswordModal.isPrivate && !joined)
    if (needsPassword) {
      if (!expectedPassword) { toast.error('Nhóm riêng tư này chưa có mật khẩu hợp lệ'); return }
      if (inputPassword !== expectedPassword) { toast.error('Sai mật khẩu nhóm'); return }
    }
    if (!joined) {
      setOptimisticJoinedGroupIds((prev) => prev.includes(joinPasswordModal.id) ? prev : [...prev, joinPasswordModal.id])
      onJoin(joinPasswordModal)
    }
    setActiveGroupId(joinPasswordModal.id)
    const rawChannels = Array.isArray(joinPasswordModal.channels) && joinPasswordModal.channels.length ? joinPasswordModal.channels : DEFAULT_CHANNELS
    const firstChannel = rawChannels.map(normalizeChannel).filter(Boolean)[0]
    setActiveChannelId(firstChannel?.id || 'thao-luan')
    setJoinPasswordModal(null)
    setJoinPassword('')
    setGroupCodeInput('')
  }

  const openGroupCodePopup = () => {
    const rawInput = String(groupCodeInput || '').trim()
    const safeGroupCode = normalizeGroupCode(rawInput)
    const targetByGroupCode = safeGroupCode.length === 7 ? groups.find((group) => normalizeGroupCode(group.groupCode) === safeGroupCode) : null
    if (targetByGroupCode) {
      setJoinPassword('')
      setJoinPasswordModal({ ...targetByGroupCode, openedByGroupCode: true })
      return
    }

    const code = normalizeInviteCode(rawInput)
    if (!/^[a-zA-Z0-9!@#$%^&*]{6}_[0-9]{4}$/.test(code)) {
      toast.error('Vui lòng nhập đúng mã nhóm hoặc mã mời')
      return
    }

    const targetGroup = groups.find((group) => normalizeInviteCode(group.inviteCode) === code)
    if (!targetGroup) {
      toast.error('Mã mời không đúng hoặc không tồn tại')
      return
    }

    if ((targetGroup.groupType || (targetGroup.isPrivate ? 'private' : 'public')) !== 'invite_only') {
      toast.error('Mã này không phải mã mời hợp lệ')
      return
    }

    if (targetGroup.inviteCodeExpiresAtMs && Date.now() > Number(targetGroup.inviteCodeExpiresAtMs)) {
      const now = Date.now()
      const expiryMs = getInviteExpiryMs(targetGroup.inviteExpiry || 'unlimited')
      const nextInviteCode = generateUniqueInviteCode()
      updateDoc(doc(db, 'forumGroups', targetGroup.id), {
        inviteCode: nextInviteCode,
        inviteCodeIssuedAtMs: now,
        inviteCodeExpiresAtMs: expiryMs ? now + expiryMs : 0,
        updatedAt: serverTimestamp(),
      }).catch((error) => console.warn('Không thể tự đổi mã mời đã hết hạn:', error))
      toast.error('Mã mời đã hết hạn và đã được hệ thống đổi sang mã mới')
      return
    }

    setJoinPassword('')
    setJoinPasswordModal({ ...targetGroup, openedByInviteCode: true })
  }

  const copyGroupCode = async () => {
    if (!canInviteToActiveGroup) return toast.error('Nhóm này đã tắt quyền mời người khác của thành viên')
    if ((activeGroup?.groupType || (activeGroup?.isPrivate ? 'private' : 'public')) !== 'invite_only') {
      return toast.error('Nhóm công khai/riêng tư không dùng mã mời')
    }
    if (!activeGroup?.inviteCode) return toast.error('Nhóm này chưa có mã mời')

    try {
      await navigator.clipboard?.writeText(activeGroup.inviteCode)
      toast.success('Đã copy mã mời')
    } catch {
      toast.error('Không thể copy')
    }
  }

  const saveGroupSettings = async () => {
    if (!activeGroup?.id) return
    if (!canManageActiveGroup) { toast.error('Bạn không có quyền chỉnh sửa cài đặt nhóm'); return }
    const nextName = groupSettingsForm.name.trim()
    if (nextName.length < 4) { toast.error('Tên nhóm nên có ít nhất 4 ký tự'); return }
    if (groupSettingsForm.groupType === 'private' && groupSettingsForm.password.trim().length < 6) { toast.error('Mật khẩu nhóm riêng tư cần ít nhất 6 ký tự'); return }
    let nextInviteCode = ''
    if (groupSettingsForm.groupType === 'invite_only') {
      nextInviteCode = normalizeInviteCode(groupSettingsForm.inviteCode || activeGroup.inviteCode || '')
      if (!nextInviteCode || nextInviteCode.length !== 11) nextInviteCode = generateUniqueInviteCode()
      const duplicatedInvite = groups.some((group) => group.id !== activeGroup.id && normalizeInviteCode(group.inviteCode) === nextInviteCode)
      if (duplicatedInvite) nextInviteCode = generateUniqueInviteCode()
    }
    const nextMemberLimit = Number(groupSettingsForm.memberLimit || 1000)
    if (!Number.isFinite(nextMemberLimit) || nextMemberLimit < 1) { toast.error('Giới hạn thành viên phải là số lớn hơn 0'); return }
    const nextInviteExpiryMs = getInviteExpiryMs(groupSettingsForm.inviteExpiry || 'unlimited')
    const nextInviteIssuedAtMs = groupSettingsForm.groupType === 'invite_only' ? Date.now() : 0
    setSavingGroupSettings(true)
    try {
      await updateDoc(doc(db, 'forumGroups', activeGroup.id), {
        name: nextName,
        description: groupSettingsForm.description.trim(),
        groupType: groupSettingsForm.groupType || (groupSettingsForm.isPrivate ? 'private' : 'public'),
        isPrivate: groupSettingsForm.groupType === 'private',
        isHidden: Boolean(groupSettingsForm.isHidden),
        password: groupSettingsForm.groupType === 'private' ? groupSettingsForm.password.trim() : '',
        inviteCode: groupSettingsForm.groupType === 'invite_only' ? nextInviteCode : '',
        themeColor: groupSettingsForm.themeColor || '#8b5cf6',
        coverImage: String(groupSettingsForm.coverImage || '').trim(),
        coverUrl: String(groupSettingsForm.coverImage || '').trim(),
        emoji: groupSettingsForm.emoji || '👥',
        memberLimit: nextMemberLimit,
        minGrade: groupSettingsForm.minGrade || '',
        requireApproval: Boolean(groupSettingsForm.requireApproval),
        adminIds: groupSettingsForm.adminIds || activeGroup.adminIds || [],
        pendingMemberIds: groupSettingsForm.pendingMemberIds || activeGroup.pendingMemberIds || [],
        inviteExpiry: groupSettingsForm.groupType === 'invite_only' ? (groupSettingsForm.inviteExpiry || 'unlimited') : 'unlimited',
        inviteCodeIssuedAtMs: nextInviteIssuedAtMs,
        inviteCodeExpiresAtMs: groupSettingsForm.groupType === 'invite_only' && nextInviteExpiryMs ? nextInviteIssuedAtMs + nextInviteExpiryMs : 0,
        permissions: groupSettingsForm.permissions || activeGroupPermissions,
        deputyPermissions: {
          kickMember: true,
          approveMember: true,
          ...(groupSettingsForm.deputyPermissions || deputyPermissions),
        },
        updatedAt: serverTimestamp(),
      })
      toast.success('Đã lưu cài đặt nhóm')
      setGroupSettingsOpen(false)
    } catch (error) {
      console.error('Không thể lưu cài đặt nhóm:', error)
      toast.error('Không thể lưu cài đặt nhóm')
    } finally {
      setSavingGroupSettings(false)
    }
  }

  const kickMember = async (member) => {
    if (!activeGroup?.id || !canKickInActiveGroup) return toast.error('Bạn không có quyền kick thành viên')
    if (member.id === activeGroup.ownerId) return toast.error('Không thể kick trưởng nhóm')

    const targetRole = getRoleKey(
      member.role ||
      member.userRole ||
      member.type ||
      memberProfiles[member.id]?.role ||
      memberProfiles[member.id]?.userRole ||
      memberProfiles[member.id]?.type,
    )

    if (['admin', 'admin_dev'].includes(targetRole)) {
      toast.error('Không thể kick quản trị viên khỏi nhóm')
      return
    }

    await updateDoc(doc(db, 'forumGroups', activeGroup.id), {
      memberIds: arrayRemove(member.id),
      adminIds: arrayRemove(member.id),
      pendingMemberIds: arrayRemove(member.id),
      membersCount: Math.max(0, Number(activeGroup.membersCount || activeGroup.memberIds?.length || 1) - 1),
      updatedAt: serverTimestamp(),
    })

    await addDoc(collection(db, 'forumNotifications'), {
      toUserId: member.id,
      fromUserId: currentUser.uid,
      fromName: displayName,
      type: 'group-member-kicked',
      category: 'group',
      scope: 'group',
      groupId: activeGroup.id,
      groupName: activeGroup.name || 'Nhóm học',
      title: 'Bạn đã bị kick khỏi nhóm',
      text: `${displayName} đã kick bạn khỏi nhóm "${activeGroup.name || 'Nhóm học'}".`,
      read: false,
      createdAt: serverTimestamp(),
    })

    toast.success('Đã kick thành viên')
  }

  const promoteDeputy = async (member) => {
    if (!activeGroup?.id || !canManageActiveGroup) return toast.error('Chỉ trưởng nhóm mới được thêm phó nhóm')
    if (member.id === activeGroup.ownerId) return
    await updateDoc(doc(db, 'forumGroups', activeGroup.id), {
      adminIds: arrayUnion(member.id),
      updatedAt: serverTimestamp(),
    })
    toast.success('Đã thêm phó nhóm')
  }

  const removeDeputy = async (member) => {
    if (!activeGroup?.id || !canManageActiveGroup) return toast.error('Chỉ trưởng nhóm mới được xóa phó nhóm')
    if (member.id === activeGroup.ownerId) return toast.error('Không thể xóa quyền trưởng nhóm')
    await updateDoc(doc(db, 'forumGroups', activeGroup.id), {
      adminIds: arrayRemove(member.id),
      updatedAt: serverTimestamp(),
    })
    toast.success('Đã xóa phó nhóm')
  }

  const updateDeputyPermission = async (key, value) => {
    if (!activeGroup?.id || !canManageActiveGroup) return toast.error('Chỉ trưởng nhóm mới được chỉnh quyền phó nhóm')
    if (!['kickMember', 'approveMember'].includes(key)) return

    const nextDeputyPermissions = {
      kickMember: true,
      approveMember: true,
      ...(activeGroup.deputyPermissions || {}),
      [key]: Boolean(value),
    }

    await updateDoc(doc(db, 'forumGroups', activeGroup.id), {
      [`deputyPermissions.${key}`]: Boolean(value),
      updatedAt: serverTimestamp(),
    })

    setGroupSettingsForm((prev) => ({
      ...prev,
      deputyPermissions: nextDeputyPermissions,
    }))
    toast.success('Đã cập nhật quyền phó nhóm')
  }

  const transferOwner = async (member) => {
    if (!activeGroup?.id || !isActiveGroupOwner) return toast.error('Chỉ trưởng nhóm hiện tại mới được chuyển nhượng')
    if (!(activeGroup.memberIds || []).includes(member.id)) return toast.error('Người nhận phải là thành viên trong nhóm')
    await updateDoc(doc(db, 'forumGroups', activeGroup.id), {
      ownerId: member.id,
      ownerName: member.name,
      adminIds: arrayUnion(currentUser.uid),
      updatedAt: serverTimestamp(),
    })
    toast.success('Đã chuyển nhượng trưởng nhóm')
  }

  const approvePendingMember = async (uid) => {
    if (!activeGroup?.id || !canApproveInActiveGroup) return toast.error('Bạn không có quyền duyệt thành viên')
    const memberLimit = Number(activeGroup.memberLimit || 1000)
    const currentMemberCount = Number(activeGroup.membersCount || activeGroup.memberIds?.length || 0)
    if (currentMemberCount >= memberLimit) return toast.error('Nhóm đã vượt quá giới hạn thành viên')
    await updateDoc(doc(db, 'forumGroups', activeGroup.id), {
      pendingMemberIds: arrayRemove(uid),
      memberIds: arrayUnion(uid),
      membersCount: currentMemberCount + 1,
      updatedAt: serverTimestamp(),
    })
    toast.success('Đã duyệt thành viên')
  }

  const rejectPendingMember = async (uid) => {
    if (!activeGroup?.id || !canApproveInActiveGroup) return toast.error('Bạn không có quyền duyệt thành viên')
    await updateDoc(doc(db, 'forumGroups', activeGroup.id), {
      pendingMemberIds: arrayRemove(uid),
      updatedAt: serverTimestamp(),
    })
    toast.success('Đã từ chối yêu cầu')
  }

  const saveChannels = async (newChannels) => {
    if (!activeGroup?.id || !canManageActiveGroup) return false

    const safeChannels = Array.isArray(newChannels)
      ? newChannels.map(normalizeChannel).filter(Boolean)
      : []

    if (!Array.isArray(newChannels) || safeChannels.length > MAX_TEXT_CHANNELS) {
      toast.error(`Mỗi nhóm chỉ được tạo tối đa ${MAX_TEXT_CHANNELS} kênh văn bản`)
      return false
    }

    try {
      await updateDoc(doc(db, 'forumGroups', activeGroup.id), {
        channels: safeChannels,
        updatedAt: serverTimestamp(),
      })
      setGroupChannels((prev) => ({ ...prev, [activeGroup.id]: safeChannels }))
      return true
    } catch {
      toast.error('Không thể cập nhật kênh')
      return false
    }
  }

  // Add a channel with a custom, free-form name typed by the group manager
  const addCustomChannel = async () => {
    const label = newChannelName.trim()
    if (!label) {
      toast.error('Nhập tên kênh trước khi thêm')
      return
    }

    if (textChannels.length >= MAX_TEXT_CHANNELS) {
      toast.error(`Chỉ được tạo tối đa ${MAX_TEXT_CHANNELS} kênh văn bản`)
      return
    }

    const duplicated = DISCORD_CHANNELS.some(
      (channel) => normalizeText(channel.label || '') === normalizeText(label),
    )
    if (duplicated) {
      toast.error('Tên kênh này đã tồn tại')
      return
    }

    const id = slugifyChannelId(label)
    const nextChannels = [...DISCORD_CHANNELS, { id, label, icon: '#️⃣', type: 'chat' }]
    const saved = await saveChannels(nextChannels)
    if (!saved) return

    setNewChannelName('')
    toast.success('Đã thêm kênh mới')
  }

  // Quick-add from a preset suggestion (still optional, not required)
  const addPresetChannel = async (preset) => {
    if (DISCORD_CHANNELS.some((ch) => ch.id === preset.id)) return
    if (textChannels.length >= MAX_TEXT_CHANNELS) {
      toast.error(`Chỉ được tạo tối đa ${MAX_TEXT_CHANNELS} kênh văn bản`)
      return
    }

    const saved = await saveChannels([...DISCORD_CHANNELS, preset])
    if (saved) toast.success('Đã thêm kênh mới')
  }

  const removeChannel = (channelId) => {
    if (DISCORD_CHANNELS.length <= 1) { toast.error('Nhóm phải có ít nhất 1 kênh'); return }
    const ch = DISCORD_CHANNELS.find((c) => c.id === channelId)
    setDeleteChannelConfirm({ channelId, channelLabel: ch?.label || channelId })
  }

  const confirmRemoveChannel = async () => {
    if (!deleteChannelConfirm || !activeGroup?.id) return
    const { channelId } = deleteChannelConfirm
    const deletedDocId = `${activeGroup.id}_${channelId}`
    const nextChannels = DISCORD_CHANNELS.filter((ch) => ch.id !== channelId)

    try {
      const messagesSnapshot = await getDocs(collection(db, 'forumGroupChats', deletedDocId, 'messages'))
      await Promise.all(messagesSnapshot.docs.map((messageDoc) => deleteDoc(messageDoc.ref)))
      await deleteDoc(doc(db, 'forumGroupChats', deletedDocId)).catch(() => {})
      await saveChannels(nextChannels)

      setUnreadCounts((prev) => {
        const next = { ...prev }
        delete next[deletedDocId]
        return next
      })
      setLastReadMs((prev) => {
        const next = { ...prev }
        delete next[deletedDocId]
        saveStoredReadMs(next)
        return next
      })
      if (activeChannelId === channelId) setActiveChannelId(nextChannels[0]?.id || '')
      toast.success('Đã xoá kênh và toàn bộ dữ liệu trong kênh')
    } catch (error) {
      console.error('Không thể xoá kênh:', error)
      toast.error('Không thể xoá kênh')
    } finally {
      setDeleteChannelConfirm(null)
    }
  }

  const startRenameChannel = (channel) => {
    setEditingChannelId(channel.id)
    setEditingChannelLabel(channel.label)
  }

  const commitRenameChannel = () => {
    const label = editingChannelLabel.trim()
    if (!label || !editingChannelId) { setEditingChannelId(null); return }
    const nextChannels = DISCORD_CHANNELS.map((ch) => (ch.id === editingChannelId ? { ...ch, label } : ch))
    saveChannels(nextChannels)
    setEditingChannelId(null)
    setEditingChannelLabel('')
  }

  const pinMessage = async (msg) => {
    if (!activeDocId) return
    const currentPins = pinnedMsgIds[activeDocId] || []
    const alreadyPinned = currentPins.includes(msg.id)
    const nextPins = alreadyPinned ? currentPins.filter((id) => id !== msg.id) : [...currentPins, msg.id]
    try {
      await setDoc(doc(db, 'forumGroupChats', activeDocId), { pinnedIds: nextPins }, { merge: true })
      setPinnedMsgIds((prev) => ({ ...prev, [activeDocId]: nextPins }))
      toast.success(alreadyPinned ? 'Đã bỏ ghim' : 'Đã ghim tin nhắn')
    } catch {
      toast.error('Không thể ghim tin nhắn')
    }
  }

  const reactToMessage = async (msg, emoji) => {
    if (!currentUser?.uid) return toast.error('Bạn cần đăng nhập')
    const docId = `${activeGroupId}_${activeChannelId}`
    const msgRef = doc(db, 'forumGroupChats', docId, 'messages', msg.id)
    const uid = currentUser.uid
    const currentReactions = msg.reactions || {}
    const oldReaction = currentReactions[uid]
    const nextReactions = { ...currentReactions }
    if (oldReaction === emoji) {
      delete nextReactions[uid]
    } else {
      nextReactions[uid] = emoji
    }
    try {
      await updateDoc(msgRef, { reactions: nextReactions })
    } catch {
      toast.error('Không thể thả cảm xúc')
    }
  }

  const deleteMessage = async (msg) => {
    if (!currentUser?.uid) return toast.error('Bạn cần đăng nhập')
    const isOwner = msg.authorId === currentUser.uid
    if (!isOwner && !canManageActiveGroup) return toast.error('Bạn không có quyền xóa tin nhắn này')
    const docId = `${activeGroupId}_${activeChannelId}`
    const msgRef = doc(db, 'forumGroupChats', docId, 'messages', msg.id)
    try {
      await deleteDoc(msgRef)
      toast.success('Đã xóa tin nhắn')
    } catch {
      toast.error('Không thể xóa tin nhắn')
    }
  }

  const startEditMessage = (msg) => {
    if (msg.authorId !== currentUser?.uid) return toast.error('Bạn chỉ có thể chỉnh sửa tin nhắn của mình')
    setEditingMsg({ msgId: msg.id })
    setEditingContent(msg.content)
  }

  const commitEditMessage = async (msg) => {
    const text = editingContent.trim()
    if (!text) { toast.error('Tin nhắn không được để trống'); return }
    if (text === msg.content) { setEditingMsg(null); setEditingContent(''); return }
    const docId = `${activeGroupId}_${activeChannelId}`
    const msgRef = doc(db, 'forumGroupChats', docId, 'messages', msg.id)
    try {
      await updateDoc(msgRef, { content: text, edited: true, editedAt: serverTimestamp() })
      setEditingMsg(null)
      setEditingContent('')
      toast.success('Đã chỉnh sửa tin nhắn')
    } catch {
      toast.error('Không thể chỉnh sửa tin nhắn')
    }
  }


  const sendQuickLike = async () => {
    if (!currentUser?.uid) return toast.error('Bạn cần đăng nhập')
    if (!canSendGroupMessage) return toast.error('Nhóm này đã tắt quyền nhắn tin của thành viên')
    const text = '👍'
    try {
      const collId = 'forumGroupChats'
      const docId = `${activeGroupId}_${activeChannelId}`
      await addDoc(collection(db, collId, docId, 'messages'), {
        content: text,
        authorId: currentUser.uid,
        authorName: displayName,
        authorInitials: initials,
        authorRole: roleKey,
        createdAt: serverTimestamp(),
        isLike: true,
      })
    } catch {
      toast.error('Không thể gửi')
    }
  }

  const groupColors = ['from-sky-500 to-blue-600', 'from-emerald-500 to-teal-600', 'from-amber-500 to-orange-600', 'from-rose-500 to-pink-600', 'from-cyan-500 to-blue-600', 'from-blue-500 to-blue-700']

  const activeGroupCover = activeGroup?.coverImage || activeGroup?.coverUrl || activeGroup?.bannerUrl || activeGroup?.imageUrl || ''
  const activeGroupOnline = onlineRosterMembers.length
  const memberCount = activeGroup ? Number(activeGroup.membersCount || activeGroup.memberIds?.length || 0) : 0
  const announcementMessages = [...messages]
    .filter(isAnnouncementMessage)
    .sort((first, second) => timestampToMs(second.createdAt) - timestampToMs(first.createdAt))
  const fileMessages = [...messages]
    .filter(isFileMessage)
    .sort((first, second) => timestampToMs(second.createdAt) - timestampToMs(first.createdAt))
  const messageCount = messages.length
  const fileCount = fileMessages.length
  const announcementCount = announcementMessages.length

  // ── EXPLORE VIEW ─────────────────────────────────────────────────────────────
  if (!activeGroup) {
    return (
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="hidden w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-slate-200 bg-slate-50 py-3 dark:border-white/10 dark:bg-slate-950 sm:flex">
          <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-xl text-white shadow-lg shadow-blue-500/25">🌍</div>
          <div className="my-1 h-px w-8 bg-slate-200 dark:bg-white/15" />
          {orderedJoinedGroups.map((g, i) => {
            const color = g.color?.includes('from-') ? g.color : groupColors[i % groupColors.length]
            return (
              <button key={g.id} type="button" title={g.name} onClick={() => { setActiveGroupId(g.id); setActiveChannelId('thao-luan') }}
                className={`group relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${color} text-xl shadow-md transition-all duration-150 hover:rounded-[14px] hover:shadow-lg`}
                style={getGroupAvatarStyle(g.themeColor)}
              >
                {g.emoji || '👥'}
                <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-slate-50 bg-emerald-400 dark:border-slate-950" />
              </button>
            )
          })}
          <button type="button" title="Tạo hoặc tìm nhóm mới" onClick={onCreate} className="mt-1 flex h-11 w-11 items-center justify-center rounded-full bg-white text-emerald-500 shadow-sm transition hover:rounded-2xl hover:bg-emerald-500 hover:text-white dark:bg-white/10 dark:text-emerald-400">
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-slate-50 pb-28 dark:bg-slate-950 lg:pb-0">
          <section className="relative min-h-[210px] overflow-hidden border-b border-blue-200 bg-white px-4 py-7 text-slate-950 shadow-[0_18px_50px_rgba(37,99,235,0.12)] dark:border-blue-400/15 dark:bg-[#061126] dark:text-white dark:shadow-[0_18px_50px_rgba(2,6,23,0.28)] sm:min-h-[220px] sm:px-6 sm:py-8">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(56,189,248,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.055)_1px,transparent_1px)] bg-[size:26px_26px]" />
            <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="relative">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-blue-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300"><span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)]" />Không gian nhóm học</div>
                  <h2 className="mt-0 text-2xl font-black tracking-tight sm:text-3xl">Học cùng nhau, kết nối hiệu quả</h2>
                  <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-500 dark:text-blue-100/55">Tìm nhóm phù hợp, nhập mã mời hoặc tạo không gian học tập riêng của bạn.</p>
                </div>
                <button type="button" onClick={onCreate} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 text-sm font-black text-white shadow-[0_0_28px_rgba(37,99,235,0.42)] transition hover:-translate-y-0.5 hover:brightness-110"><Plus className="h-4 w-4" />Tạo nhóm mới</button>
              </div>

              <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)_auto]">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300/70" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên nhóm, mã nhóm hoặc #tag..." className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:border-blue-300/20 dark:bg-[#08162d]/90 dark:text-white dark:placeholder:text-slate-500 focus:border-cyan-300/60 focus:shadow-[0_0_18px_rgba(56,189,248,0.12)]" />
                </div>
                <div className="flex min-w-0 gap-2">
                  <input value={groupCodeInput} onChange={(e) => setGroupCodeInput(normalizeInviteCode(e.target.value))} onKeyDown={(e) => { if (e.key === 'Enter') openGroupCodePopup() }} maxLength={11} placeholder="Nhập mã mời" className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm font-black uppercase tracking-[0.16em] text-slate-900 outline-none dark:border-blue-300/20 dark:bg-[#08162d]/90 dark:text-white placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-500 focus:border-cyan-300/60" />
                  <button type="button" onClick={openGroupCodePopup} className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-black text-blue-700 transition hover:bg-blue-100 dark:border-cyan-300/20 dark:bg-cyan-400/10 dark:text-cyan-200 dark:hover:bg-cyan-400/20">Tham gia</button>
                </div>
                <div className="flex rounded-2xl border border-slate-200 bg-slate-100 p-1 dark:border-blue-300/20 dark:bg-[#08162d]/90">
                  {[{ value: 'all', label: 'Tất cả' }, { value: 'joined', label: 'Đã tham gia' }].map((item) => {
                    const active = groupListFilter === item.value
                    return <button key={item.value} type="button" onClick={() => setGroupListFilter(item.value)} className={`rounded-xl px-4 py-2 text-xs font-black transition ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' : 'text-slate-500 hover:bg-white hover:text-blue-700 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'}`}>{item.label}</button>
                  })}
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-4 p-3 sm:grid-cols-2 sm:p-5 lg:grid-cols-3 lg:p-6">
            {pagedGroups.map((group, i) => {
              const joined = (group.memberIds || []).includes(currentUser?.uid)
              const canDeleteGroup = !group.isSample && (group.ownerId === currentUser?.uid || ['admin', 'admin_dev'].includes(roleKey))
              const color = group.color?.includes('from-') ? group.color : groupColors[i % groupColors.length]
              const memberCount2 = Number(group.membersCount || group.memberIds?.length || 0)
              const onlineCount = getGroupOnlineCount(group)
              const groupType = group.groupType || (group.isPrivate ? 'private' : 'public')
              const visibilityText = groupType === 'hidden' || group.isHidden ? 'Không công khai' : groupType === 'invite_only' ? 'Chỉ qua mã mời' : group.isPrivate ? 'Riêng tư' : 'Công khai'
              const coverImage = group.coverImage || group.coverUrl || group.bannerUrl || group.imageUrl || ''
              const tagColor = group.themeColor || '#6366f1'
              const pinned = pinnedGroupIds.includes(group.id)
              const activeReportCount = getOpenReportsForGroup(group.id).length
              const hasActiveReport = activeReportCount > 0 || group.reportStatus === 'open'
              const showAdminJoinButton = isAdminRole && hasActiveReport && !joined
              const showNormalJoinButton = joined || (!showAdminJoinButton && groupType !== 'invite_only')
              const groupUnreadCard = Object.entries(unreadCounts).reduce((sum, [docId, count]) => {
                if (docId.startsWith(`${group.id}_`)) return sum + Number(count || 0)
                return sum
              }, 0)
              return (
                <div key={group.id} className="group relative flex min-h-[420px] flex-col sm:min-h-[470px] overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-300 hover:shadow-2xl hover:shadow-blue-500/15 dark:border-white/10 dark:bg-white/5 dark:hover:border-blue-400/40">
                  <div className="relative h-40 overflow-hidden">
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${color} transition-transform duration-500 group-hover:scale-110`}
                      style={getGroupThemeStyle(group.themeColor, coverImage)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/0 to-black/10" />
                    {/* Visibility badge */}
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(event) => togglePinGroup(group, event)}
                        title={pinned ? 'Bỏ ghim nhóm' : 'Ghim nhóm'}
                        className={`flex h-7 w-7 items-center justify-center rounded-full backdrop-blur transition ${
                          pinned
                            ? 'bg-amber-300 text-amber-950 shadow-lg shadow-amber-400/30'
                            : 'bg-white/15 text-white hover:bg-white/25'
                        }`}
                      >
                        <Pin className={`h-3.5 w-3.5 ${pinned ? 'fill-current' : ''}`} />
                      </button>
                      {groupUnreadCard > 0 && (
                        <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-rose-500 px-2 text-xs font-black text-white shadow-lg shadow-rose-500/40">
                          {groupUnreadCard > 99 ? '99+' : groupUnreadCard}
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black backdrop-blur ${groupType === 'invite_only' ? 'bg-blue-400/25 text-blue-100' : group.isPrivate ? 'bg-amber-400/25 text-amber-100' : 'bg-emerald-400/25 text-emerald-100'}`}>
                        {groupType === 'invite_only' ? <Share2 className="h-3 w-3" /> : group.isPrivate ? <LockKeyhole className="h-3 w-3" /> : <Globe2 className="h-3 w-3" />}
                        {visibilityText}
                      </span>
                      {isAdminRole && isGroupReported(group) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-3 py-1 text-xs font-black text-white shadow-lg shadow-rose-500/30">
                          <AlertTriangle className="h-3.5 w-3.5" /> Báo cáo ({Math.max(Number(group.reportCount || 0), getOpenReportsForGroup(group.id).length)})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="relative flex flex-1 flex-col px-6 pb-6">
                    <div className="absolute -top-10 left-6 flex h-20 w-20 items-center justify-center rounded-2xl border-[5px] border-white text-4xl shadow-xl transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-3 dark:border-slate-900" style={getGroupAvatarStyle(group.themeColor)}>
                      {group.emoji || '👥'}
                    </div>
                    <div className="mt-6 pl-24"><h3 className="line-clamp-1 text-2xl font-black text-slate-950 dark:text-white">{group.name}</h3></div>
                    <p className="mt-6 font-mono text-xs font-bold text-slate-400 dark:text-slate-500">Mã nhóm: {group.groupCode || 'Chưa có mã'}</p>
                    {roleKey === 'admin_dev' && (() => {
                      const ownerProfile = ownerProfiles[group.ownerId] || {}
                      const ownerNameFromSQL = ownerProfile.name || group.ownerName || group.createdByName || 'Chưa rõ tên'
                      const ownerEmailFromSQL = ownerProfile.email || group.ownerEmail || group.createdByEmail || 'Chưa rõ email'

                      return (
                        <div className="mt-2 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-3 py-2">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-sky-300">
                            Người tạo nhóm
                          </p>
                          <p className="mt-1 truncate text-xs font-black text-slate-200">
                            {ownerNameFromSQL}
                          </p>
                          <p className="mt-0.5 truncate text-xs font-bold text-slate-400">
                            {ownerEmailFromSQL}
                          </p>
                        </div>
                      )
                    })()}

                    <p className="mt-4 line-clamp-2 text-lg font-semibold leading-8 text-slate-500 dark:text-slate-400">{group.description || 'Nhóm học chưa có mô tả.'}</p>
                    <div className="mt-5 flex items-center gap-4 text-base font-bold">
                      <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-100"><Users className="h-5 w-5 text-slate-400" />{memberCount2.toLocaleString('vi-VN')}</span>
                      <span className="inline-flex items-center gap-2 text-emerald-500 dark:text-emerald-400"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />{onlineCount} online</span>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {(group.tags || []).slice(0, 4).map((tag) => (
                        <span key={tag} className="rounded-full px-3 py-1.5 text-sm font-bold" style={{ backgroundColor: `${tagColor}1f`, color: tagColor }}>{tag}</span>
                      ))}
                    </div>
                    <div className="mt-auto pt-8">
                      <div className="flex items-center gap-3">
                        {canDeleteGroup && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(group) }} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 transition hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20">
                            <Trash2 className="h-5 w-5" />
                          </button>
                        )}
                        {showAdminJoinButton ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onAdminJoinReportedGroup(group)
                            }}
                            className="flex-1 rounded-2xl bg-rose-600 px-5 py-4 text-lg font-black text-white shadow-lg shadow-rose-500/20 transition hover:-translate-y-0.5 hover:bg-rose-700 hover:shadow-xl"
                          >
                            Admin vào
                          </button>
                        ) : showNormalJoinButton ? (
                          <button
                            type="button"
                            onClick={() => joined ? (setActiveGroupId(group.id), setActiveChannelId('thao-luan')) : handleJoinGroup(group)}
                            className="flex-1 rounded-2xl bg-blue-600 px-5 py-4 text-lg font-black text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl"
                          >
                            {joined ? 'Vào nhóm' : 'Tham gia nhóm'}
                          </button>
                        ) : (
                          <div className="flex-1 rounded-2xl border border-blue-400/30 bg-blue-500/10 px-5 py-4 text-center text-sm font-black text-blue-200">
                            Nhập mã để tham gia
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {filteredGroups.length === 0 && (
            <div className="px-6 pb-10 text-center text-sm font-bold text-slate-400 dark:text-slate-500">Không tìm thấy nhóm phù hợp.</div>
          )}

          {totalGroupPages > 1 && (
            <div className="px-6 pb-10">
              <Pagination page={groupsPage} totalPages={totalGroupPages} onChange={setGroupsPage} />
            </div>
          )}
        </div>

        {joinPasswordModal && (
          <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md" onMouseDown={() => setJoinPasswordModal(null)}>
            <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-amber-400/30 bg-white shadow-2xl shadow-amber-950/10 dark:bg-slate-950 dark:shadow-amber-950/30" onMouseDown={(e) => e.stopPropagation()}>
              <div className="border-b border-slate-200 bg-amber-50 px-6 py-5 dark:border-white/10 dark:bg-amber-500/10">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-amber-700 dark:bg-amber-400/10 dark:text-amber-200"><LockKeyhole className="h-3.5 w-3.5" />{joinPasswordModal.isPrivate ? 'Nhóm riêng tư' : 'Xác nhận vào nhóm'}</div>
                <h3 className="text-2xl font-black text-slate-950 dark:text-white">{joinPasswordModal.name}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">{joinPasswordModal.isPrivate ? 'Nhập đúng mật khẩu do chủ nhóm đặt để tham gia nhóm học này.' : joinPasswordModal.openedByInviteCode ? 'Mã mời hợp lệ. Bấm xác nhận để tham gia hoặc mở nhóm này.' : 'Bấm xác nhận để tham gia hoặc mở nhóm này.'}</p>
              </div>
              <div className="space-y-4 p-6">
                {joinPasswordModal.isPrivate && !(joinPasswordModal.memberIds || []).includes(currentUser?.uid) && (
                  <input type="password" value={joinPassword} onChange={(e) => setJoinPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirmPrivateJoin() }} placeholder="Nhập mật khẩu nhóm" className="w-full rounded-2xl border border-amber-300 bg-amber-50/50 px-4 py-3 text-sm font-bold text-slate-900 outline-none placeholder:text-slate-400 focus:border-amber-400 dark:border-amber-400/20 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500" autoFocus />
                )}
                {joinPasswordModal.groupCode && !joinPasswordModal.openedByInviteCode && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Mã nhóm</p>
                    <p className="mt-1 font-mono text-lg font-black tracking-[0.25em] text-slate-950 dark:text-white">{joinPasswordModal.groupCode}</p>
                  </div>
                )}
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setJoinPasswordModal(null)} className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15">Hủy</button>
                  <button type="button" onClick={confirmPrivateJoin} className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-white transition hover:bg-amber-400">{joinPasswordModal.isPrivate && !(joinPasswordModal.memberIds || []).includes(currentUser?.uid) ? 'Vào nhóm' : 'Xác nhận'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── INSIDE GROUP - DISCORD LAYOUT ───────────────────────────────────────────
  const joined = (activeGroup.memberIds || []).includes(currentUser?.uid)
  const canDeleteGroup = canManageActiveGroup
  const groupSettingsTabs = ([
    ['overview','Tổng quan','👥'],
    ['privacy','Cấu hình nhóm', groupSettingsForm.groupType === 'invite_only' ? '✉️' : groupSettingsForm.groupType === 'private' ? '🔒' : '🌍'],
    ['channels','Kênh','#️⃣'],
    ...(canApproveInActiveGroup ? [['approval',`Duyệt (${(activeGroup?.pendingMemberIds || []).length})`,'✅']] : []),
    ['members','Thành viên','👥'],
    ['invite','Mời bạn bè','✉️'],
    ...(canSeeAdvancedGroupSettings ? [['appearance','Giao diện','🎨'],['system','Dữ liệu hệ thống','🧩']] : []),
  ])

  const groupColor = activeGroup.color?.includes('from-') ? activeGroup.color : 'from-sky-500 to-blue-600'

  // Deduplicate messages for display grouping
  const msgGroups = []
  messages.forEach((msg, i) => {
    if (msg.type === 'system') {
      msgGroups.push({ system: true, author: msg, msgs: [msg] })
      return
    }

    const prev = messages[i - 1]
    const sameAuthor = prev && prev.type !== 'system' && prev.authorId === msg.authorId && !msg.replyToId
    const timeDiff = prev ? (timestampToMs(msg.createdAt) - timestampToMs(prev.createdAt)) : Infinity
    if (sameAuthor && timeDiff < 5 * 60 * 1000 && !prev.replyToId) {
      msgGroups[msgGroups.length - 1].msgs.push(msg)
    } else {
      msgGroups.push({ author: msg, msgs: [msg] })
    }
  })

  const roleBadge = ROLE_BADGES[roleKey] || ROLE_BADGES.student

  const copyMessage = async (text = '') => {
    try { await navigator.clipboard?.writeText(text); toast.success('Đã copy tin nhắn') } catch { toast.error('Không thể copy') }
  }

  const replyToMember = (msg) => {
    setReplyTo({ msgId: msg.id, authorName: msg.authorName, content: msg.content })
    setReplyText('')
  }

  const channelDescription =
    activeChannel?.type === 'chat' ? 'Đặt câu hỏi, trao đổi bài tập và cùng nhau giải quyết vấn đề học tập.'
    : activeChannel?.type === 'files' ? 'Chia sẻ tài liệu, link học tập, đề ôn thi và ghi chú quan trọng.'
    : activeChannel?.type === 'announce' ? 'Nơi đăng thông báo quan trọng để mọi thành viên không bỏ lỡ.'
    : 'Thông tin nền tảng giúp nhóm học hoạt động rõ ràng và có tổ chức.'

  const availablePresetChannels = ALL_POSSIBLE_CHANNELS.filter((preset) => !DISCORD_CHANNELS.some((ch) => ch.id === preset.id))

  const openChannel = (channel) => {
    if (!channel) return
    setActiveChannelId(channel.id)
  }

  return (
    <div className="relative flex h-[100dvh] max-h-[100dvh] min-h-0 flex-1 overflow-hidden bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      {/* Group avatar sidebar */}
      <div className="hidden w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-slate-200 bg-white py-3 dark:border-white/10 dark:bg-slate-950 lg:flex">
        <button type="button" title="Khám phá nhóm" onClick={() => { setGroupMenuOpen(false); setGroupSettingsOpen(false); setActiveGroupId(null); setActiveChannelId('thao-luan') }} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-xl text-white shadow-lg transition hover:rounded-[14px]">🌍</button>
        <div className="my-1 h-px w-8 bg-slate-200 dark:bg-white/15" />
        {orderedJoinedGroups.map((g, i) => {
          const color = g.color?.includes('from-') ? g.color : groupColors[i % groupColors.length]
          const isActive = g.id === activeGroupId
          // Count total unread for this group across all its channels
          const groupUnread = Object.entries(unreadCounts).reduce((sum, [docId, count]) => {
            if (docId.startsWith(`${g.id}_`)) return sum + (count || 0)
            return sum
          }, 0)
          return (
            <div key={g.id} className="relative">
              {isActive && <span className="absolute -left-3 top-1/2 h-8 w-1.5 -translate-y-1/2 rounded-r-full bg-blue-600" />}
              <button type="button" title={g.name} onClick={() => { setActiveGroupId(g.id); setActiveChannelId('thao-luan') }}
                className={`relative flex h-11 w-11 items-center justify-center bg-gradient-to-br ${color} text-xl shadow-md transition-all duration-150 ${isActive ? 'rounded-2xl shadow-lg' : 'rounded-full hover:rounded-2xl'}`}
                style={getGroupAvatarStyle(g.themeColor)}
              >
                {g.emoji || '👥'}
                <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-950" />
                {!isActive && groupUnread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white shadow-lg">
                    {groupUnread > 9 ? '9+' : groupUnread}
                  </span>
                )}
              </button>
            </div>
          )
        })}
        <button type="button" title="Tạo nhóm mới" onClick={onCreate} className="mt-1 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-emerald-500 transition hover:rounded-2xl hover:bg-emerald-500 hover:text-white dark:bg-white/10 dark:text-emerald-400">
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {mobileChannelSidebarOpen && (
        <button
          type="button"
          aria-label="Đóng danh sách kênh"
          onClick={() => setMobileChannelSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Channel sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 flex w-[min(88vw,350px)] shrink-0 flex-col border-r border-slate-200 bg-white shadow-2xl transition-transform duration-300 dark:border-white/10 dark:bg-slate-900 lg:static lg:z-auto lg:w-[320px] lg:translate-x-0 lg:shadow-none xl:w-[350px] ${mobileChannelSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="border-b border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
          <div className="relative flex h-[88px] items-center gap-3 px-4">
            <div className="text-3xl">{activeGroup.emoji || '🏆'}</div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-xl font-black text-slate-950 dark:text-white">{activeGroup.name}</h3>
              <p className="mt-1 font-mono text-[11px] font-black tracking-wider text-slate-400 dark:text-slate-500">{activeGroup.groupCode || 'NO-CODE'}</p>
            </div>
            <button type="button" onClick={() => openGroupReportModal(activeGroup)} className="rounded-xl p-2 text-slate-400 transition hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10 dark:hover:text-amber-300" aria-label="Báo cáo nhóm">
              <Flag className="h-5 w-5" />
            </button>
            {isAdminRole && isGroupReported(activeGroup) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-black text-white">
                <AlertTriangle className="h-3.5 w-3.5" /> Bị báo cáo
              </span>
            )}
            <button type="button" onClick={() => setGroupMenuOpen((v) => !v)} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Mở menu nhóm">
              <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${groupMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {groupMenuOpen && (
              <div className="absolute right-3 top-[72px] z-40 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-slate-900 dark:shadow-black/40">
                <button type="button" onClick={() => { setGroupSettingsTab('overview'); setGroupSettingsOpen(true); setGroupMenuOpen(false) }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"><Settings className="h-4 w-4" />Cài đặt nhóm</button>
                <button type="button" onClick={() => { if (!canInviteToActiveGroup) return toast.error('Nhóm này đã tắt quyền mời người khác của thành viên'); setInvitePopupOpen(true); setGroupMenuOpen(false) }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"><Share2 className="h-4 w-4" />Mời bạn bè</button>
                {canModerateActiveGroup && (
                  <button type="button" onClick={() => { setGroupSettingsOpen(true); setGroupSettingsTab('approval'); setGroupMenuOpen(false) }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"><Users className="h-4 w-4" />Duyệt thành viên</button>
                )}
                {/* Chỉ phó nhóm và thành viên mới được rời nhóm */}
{joined && !isActiveGroupOwner && (
  <button
    type="button"
    onClick={() => { setLeaveGroupConfirm(true); setGroupMenuOpen(false) }}
    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
  >
    <X className="h-4 w-4" />
    Rời nhóm
  </button>
)}

{/* Chỉ trưởng nhóm (và admin nếu logic canDeleteGroup của bạn có bao gồm) mới thấy nút xóa */}
{canDeleteGroup && (
  <button
    type="button"
    onClick={() => {
      onDelete(activeGroup)
      setGroupMenuOpen(false)
    }}
    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black text-rose-500 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
  >
    <Trash2 className="h-4 w-4" />
    Xóa nhóm
  </button>
)}
              </div>
            )}
          </div>

          <div className={`relative h-[120px] overflow-hidden bg-gradient-to-br ${groupColor}`} style={getGroupThemeStyle(activeGroup.themeColor, activeGroupCover)}>
            <div className="absolute inset-0 bg-black/35" />
            <div className="absolute bottom-4 left-4">
              <p className="text-xl font-black text-white">{memberCount.toLocaleString('vi-VN')} thành viên</p>
              <p className="text-sm font-black text-emerald-300">{activeGroupOnline} online</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-2 mt-3 space-y-3">
            <div>
              <button type="button" onClick={() => setTextChannelsCollapsed((value) => !value)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-black uppercase tracking-[0.14em] text-slate-400 transition hover:bg-slate-50 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-slate-200">
                <span className="flex items-center gap-2"><Hash className="h-4 w-4" />Kênh văn bản <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] dark:bg-white/10">{textChannels.length}</span></span>
                <ChevronDown className={`h-4 w-4 transition-transform ${textChannelsCollapsed ? '-rotate-90' : ''}`} />
              </button>
              {!textChannelsCollapsed && (
                <div className="mt-1 space-y-1">
                  {textChannels.map((ch) => {
                    const docId = `${activeGroupId}_${ch.id}`
                    const unread = unreadCounts[docId] || 0
                    return (
                      <button key={ch.id} type="button" onClick={() => { setActiveChannelId(ch.id); setMobileChannelSidebarOpen(false) }} className={`relative flex w-full items-center gap-3 rounded-xl px-4 py-3 pr-10 text-lg transition ${activeChannelId === ch.id ? 'bg-blue-50 text-blue-700 dark:bg-white/10 dark:text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'}`}>
                        {ch.icon ? <span className="text-xl">{ch.icon}</span> : null}
                        <span className="text-lg font-black text-slate-400 dark:text-slate-500">#</span>
                        <span className="truncate font-black">{ch.label}</span>
                        {unread > 0 && activeChannelId !== ch.id && <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white shadow-lg shadow-rose-500/30">{unread > 99 ? '99+' : unread}</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

          </div>

          {canManageActiveGroup && (
            <button type="button" onClick={() => { setGroupSettingsTab('overview'); setGroupSettingsOpen(true) }} className="mt-3 flex w-full items-center gap-2 rounded-xl px-4 py-2 text-xs font-black text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-slate-300">
              <Hash className="h-4 w-4" />Quản lý kênh trong cài đặt
            </button>
          )}

          <div className="mt-6 space-y-1 border-t border-slate-200 pt-4 dark:border-white/10">
            <p className="mb-2 px-3 text-sm font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Nhóm</p>
            {joined && !isActiveGroupOwner && (
              <button type="button" onClick={() => setLeaveGroupConfirm(true)} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-black text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"><X className="h-4 w-4" />Rời nhóm</button>
            )}
            {canDeleteGroup && (
              <button type="button" onClick={() => onDelete(activeGroup)} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-black text-rose-500 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"><Trash2 className="h-4 w-4" />Xóa nhóm</button>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <ForumUserAvatar avatarUrl={avatarUrl} name={displayName} initials={initials} sizeClass="h-12 w-12">
              <span className="absolute -bottom-0.5 -right-0.5 z-10 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400 shadow-sm dark:border-slate-900" />
            </ForumUserAvatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-slate-950 dark:text-white">{displayName}</p>
              <p className="text-xs font-bold text-emerald-500 dark:text-emerald-400">{roleText[roleKey] || 'Thành viên'}</p>
            </div>
            <button type="button" onClick={() => { setGroupSettingsTab('overview'); setGroupSettingsOpen(true) }} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Cài đặt nhóm"><Settings className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {/* Main chat */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-slate-950">
        {/* Channel header */}
        <div className="flex h-[64px] shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 dark:border-white/10 dark:bg-slate-950 sm:h-[72px] sm:gap-4 sm:px-5 lg:px-6">
          <button type="button" onClick={() => setMobileChannelSidebarOpen(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-blue-50 hover:text-blue-600 dark:bg-white/10 dark:text-slate-200 lg:hidden" aria-label="Mở danh sách kênh"><Menu className="h-5 w-5" /></button>
          <span className="hidden text-xl sm:inline sm:text-2xl">{activeChannel?.icon}</span>
          <span className="text-xl font-black text-slate-400 dark:text-slate-500 sm:text-2xl">#</span>
          <h2 className="min-w-0 truncate text-base font-black text-slate-950 dark:text-white sm:text-xl lg:text-2xl">{activeChannel?.label}</h2>
          <div className="hidden h-8 w-px bg-slate-200 dark:bg-white/10 md:block" />
          <p className="hidden min-w-0 truncate text-sm font-semibold text-slate-400 dark:text-slate-400 md:block">
            {activeChannel?.type === 'chat' ? 'Nơi trò chuyện và đặt câu hỏi' : activeChannel?.type === 'files' ? 'Chia sẻ tài liệu học tập' : 'Thông tin quan trọng của nhóm'}
          </p>
          <div className="ml-auto flex shrink-0 items-center gap-2 text-slate-400 dark:text-slate-400 sm:gap-3">
            <span className="hidden items-center gap-2 text-lg font-semibold xl:flex">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />{activeGroupOnline} online
            </span>
            {/* Search button */}
            <button type="button" title="Tìm kiếm" onClick={() => setShowSearchPopup(true)} className="transition hover:text-slate-900 dark:hover:text-white"><Search className="h-5 w-5 sm:h-6 sm:w-6" /></button>
            {/* Pin button */}
            <button type="button" title="Tin nhắn đã ghim" onClick={() => setShowPinnedPopup(true)} className="relative transition hover:text-slate-900 dark:hover:text-white">
              <Pin className="h-5 w-5 sm:h-6 sm:w-6" />
              {pinnedMessages.length > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-0.5 text-[9px] font-black text-black">{pinnedMessages.length}</span>}
            </button>
            {/* Member list button */}
            <button type="button" title="Danh sách thành viên" onClick={() => setShowMemberList(true)} className="transition hover:text-slate-900 dark:hover:text-white"><Users className="h-5 w-5 sm:h-6 sm:w-6" /></button>
            {/* Mobile: return to group lobby without leaving the group */}
            <button
              type="button"
              title="Ra ngoài"
              aria-label="Ra ngoài"
              onClick={() => {
                setGroupMenuOpen(false)
                setGroupSettingsOpen(false)
                setMobileChannelSidebarOpen(false)
                setActiveGroupId(null)
                setActiveChannelId('thao-luan')
              }}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-300 bg-white text-slate-600 shadow-sm transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 dark:border-white/20 dark:bg-white/5 dark:text-slate-200 dark:hover:border-blue-400/60 dark:hover:bg-blue-500/10 dark:hover:text-blue-200 md:hidden"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" title="Cảnh báo / báo cáo nhóm" onClick={() => openGroupReportModal(activeGroup)} className="transition hover:text-amber-600 dark:hover:text-amber-300"><Flag className="hidden h-5 w-5 sm:block sm:h-6 sm:w-6" /></button>
            <button type="button" title="Cài đặt nhóm" onClick={() => { setGroupSettingsTab('overview'); setGroupSettingsOpen(true) }} className="transition hover:text-slate-900 dark:hover:text-white"><Settings className="hidden h-5 w-5 sm:block sm:h-6 sm:w-6" /></button>
            
          </div>
        </div>

        <>
        {/* Messages */}
        <div className="min-h-0 flex-1 overflow-y-auto" style={{ height: 0 }}>
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center sm:px-8">
              <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-slate-50 text-5xl shadow-sm dark:bg-white/5 dark:shadow-black/20">{activeChannel?.icon}</div>
              <h1 className="text-2xl font-black text-slate-950 dark:text-white sm:text-4xl">Chào mừng đến #{activeChannel?.label}</h1>
              <p className="mt-4 max-w-2xl text-sm font-bold leading-7 text-slate-500 dark:text-slate-400 sm:text-base">{channelDescription}</p>
            </div>
          ) : (
            <div className="px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
              <div className="space-y-5">
                {msgGroups.map((group) => {
                  if (group.system) {
                    const systemMsg = group.msgs[0]
                    return (
                      <div key={systemMsg.id} className="flex justify-center px-3 py-1">
                        <span className="rounded-full border border-slate-200 bg-slate-100 px-4 py-1.5 text-xs font-black text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                          {systemMsg.content}
                        </span>
                      </div>
                    )
                  }

                  const AuthorRoleBadge = ROLE_BADGES[group.author.authorRole] || ROLE_BADGES.student
                  return (
                    <div key={group.author.id} className="group/message flex gap-4 rounded-2xl px-3 py-2 transition hover:bg-slate-50 dark:hover:bg-white/[0.025]">
                      {(() => {
                        const syncedAuthorProfile = group.author.authorId === currentUser?.uid
                          ? { avatarUrl, name: displayName, initials }
                          : memberProfiles[group.author.authorId]
                        const syncedAvatarUrl =
                          syncedAuthorProfile?.avatarUrl ||
                          group.author.authorPhotoURL ||
                          group.author.avatarUrl ||
                          ''
                        const syncedAuthorName = syncedAuthorProfile?.name || group.author.authorName || 'Thành viên'
                        const syncedInitials = syncedAuthorProfile?.initials || group.author.authorInitials || getInitials(syncedAuthorName)

                        return (
                          <ForumUserAvatar
                            avatarUrl={syncedAvatarUrl}
                            name={syncedAuthorName}
                            initials={syncedInitials}
                            sizeClass="h-12 w-12"
                            className="shadow-lg shadow-blue-500/10"
                          />
                        )
                      })()}
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="text-base font-black text-slate-950 dark:text-white">{(group.author.authorId === currentUser?.uid ? displayName : memberProfiles[group.author.authorId]?.name) || group.author.authorName || 'Thành viên'}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${AuthorRoleBadge.bg}`}>{AuthorRoleBadge.label}</span>
                          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">{formatRelativeTime(group.author.createdAt)}</span>
                        </div>
                        <div className="space-y-1">
                          {group.msgs.map((msg) => {
                            const isPinned = (pinnedMsgIds[activeDocId] || []).includes(msg.id)
                            const msgReactionMap = msg.reactions || {}
                            const reactionSummary = Object.entries(
                              Object.values(msgReactionMap).reduce((acc, emoji) => { acc[emoji] = (acc[emoji] || 0) + 1; return acc }, {})
                            )
                            return (
                              <div key={msg.id} className="group/item relative rounded-xl px-0 py-0.5" onMouseLeave={() => { if (reactionPickerMsgId === msg.id) setReactionPickerMsgId(null) }}>
                                {/* Reply context — styled like the Hall's threaded replies */}
                                {msg.replyToId && (
                                  <div className="mb-1 flex items-center gap-2 border-l-2 border-blue-300 pl-3 dark:border-blue-500/40">
                                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-600 dark:bg-blue-500/15 dark:text-blue-200">Trả lời</span>
                                    <span className="text-xs font-bold text-blue-600 dark:text-blue-300">{msg.replyToAuthor}</span>
                                    <span className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{msg.replyToContent}</span>
                                  </div>
                                )}
                                {isPinned && (
                                  <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:bg-amber-400/15 dark:text-amber-300"><Pin className="h-3 w-3" />Đã ghim</span>
                                )}
                                {/* Message content: large if emoji-only, otherwise normal */}
                                {editingMsg?.msgId === msg.id ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      autoFocus
                                      value={editingContent}
                                      onChange={(e) => setEditingContent(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEditMessage(msg) }
                                        if (e.key === 'Escape') { setEditingMsg(null); setEditingContent('') }
                                      }}
                                      className="min-w-0 flex-1 rounded-xl border border-blue-300 bg-blue-50/40 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-white"
                                    />
                                    <button type="button" onClick={() => commitEditMessage(msg)} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-700">Lưu</button>
                                    <button type="button" onClick={() => { setEditingMsg(null); setEditingContent('') }} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200">Hủy</button>
                                  </div>
                                ) : isAnnouncementMessage(msg) ? (
                                  <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800 shadow-sm dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
                                    <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em]">
                                      <Bell className="h-4 w-4" />
                                      Thông báo nhóm
                                    </div>
                                    <p className="whitespace-pre-wrap break-words text-[15px] font-black leading-7">
                                      {msg.content}
                                      {msg.edited && <span className="ml-1 text-[10px] font-bold opacity-70">(đã sửa)</span>}
                                    </p>
                                  </div>
                                ) : msg.messageType === 'image' && msg.fileUrl ? (
                                  <div className="space-y-2">
                                    <button
                                      type="button"
                                      onClick={() => setZoomedImage({ url: msg.fileUrl, fileName: msg.fileName || 'image' })}
                                      className="group/image relative inline-block max-w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10"
                                    >
                                      <img src={msg.fileUrl} alt={msg.fileName || 'Hình ảnh'} className="max-h-80 max-w-full object-contain transition group-hover/image:brightness-90" />
                                      <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          downloadFileFromUrl(msg.fileUrl, msg.fileName || 'image')
                                        }}
                                        onKeyDown={(event) => {
                                          if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault()
                                            event.stopPropagation()
                                            downloadFileFromUrl(msg.fileUrl, msg.fileName || 'image')
                                          }
                                        }}
                                        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/55 text-white opacity-80 shadow-lg backdrop-blur transition hover:bg-slate-950/75 md:opacity-0 md:group-hover/image:opacity-100"
                                        title="Tải ảnh"
                                      >
                                        <Download className="h-4 w-4" />
                                      </span>
                                    </button>
                                    <p className="text-xs font-bold text-slate-400">{msg.fileName || msg.content}</p>
                                  </div>
                                ) : msg.messageType === 'file' && msg.fileUrl ? (
                                  <a href={msg.fileUrl} download={msg.fileName || true} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-blue-400/50 dark:hover:text-blue-200">
                                    <Paperclip className="h-5 w-5 shrink-0 text-emerald-500" />
                                    <span className="truncate">{msg.fileName || msg.content || 'Tệp đính kèm'}</span>
                                  </a>
                                ) : isEmojiOnly(msg.content) ? (
                                  <p className="select-text text-5xl leading-tight">
                                    {msg.content}
                                    {msg.edited && <span className="ml-2 align-middle text-[10px] font-bold text-slate-400 dark:text-slate-500">(đã sửa)</span>}
                                  </p>
                                ) : (
                                  <p className="whitespace-pre-wrap break-words text-[15px] font-medium leading-7 text-slate-700 dark:text-slate-200">
                                    {msg.content}
                                    {msg.edited && <span className="ml-1 text-[10px] font-bold text-slate-400 dark:text-slate-500">(đã sửa)</span>}
                                  </p>
                                )}
                                {/* Reactions display */}
                                {reactionSummary.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {reactionSummary.map(([emoji, count]) => {
                                      const myReaction = msgReactionMap[currentUser?.uid]
                                      return (
                                        <button key={emoji} type="button" onClick={() => reactToMessage(msg, emoji)}
                                          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold transition ${myReaction === emoji ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-sky-400 dark:bg-sky-500/20 dark:text-sky-200' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-white/20'}`}
                                        >
                                          {emoji} <span>{count}</span>
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                                {/* Inline reply form — appears directly under the message, like the Hall */}
                                {replyTo?.msgId === msg.id && (
                                  <form onSubmit={submitReply} className="mt-2 flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50/60 p-2 dark:border-blue-500/20 dark:bg-blue-500/10">
                                    <input
                                      ref={replyInputRef}
                                      value={replyText}
                                      onChange={(e) => setReplyText(e.target.value)}
                                      placeholder={`Trả lời ${msg.authorName || 'thành viên'}...`}
                                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                                    />
                                    <button type="button" onClick={() => { setReplyTo(null); setReplyText('') }} className="rounded-xl px-3 py-2 text-xs font-black text-slate-400 hover:bg-white dark:hover:bg-white/10">Hủy</button>
                                    <button type="submit" className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-700">Gửi</button>
                                  </form>
                                )}
                                {/* Hover toolbar */}
                                <div className="absolute -right-1 -top-1 hidden items-center overflow-visible rounded-xl border border-slate-200 bg-white shadow-xl group-hover/item:flex dark:border-white/10 dark:bg-slate-900">
                                  <button type="button" onClick={() => reactToMessage(msg, '👍')} className="px-2 py-1.5 text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white" title="Thích">👍</button>

                                  <div className="relative">
                                    <button type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setMessageMoreMenuId(null)
                                        setReactionPickerMsgId(msg.id)
                                      }}
                                      className="px-2 py-1.5 text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white" title="Cảm xúc">🙂</button>
                                    {reactionPickerMsgId === msg.id && (
                                      <ReactionPicker onSelect={(emoji) => reactToMessage(msg, emoji)} onClose={() => setReactionPickerMsgId(null)} />
                                    )}
                                  </div>

                                  {!msg.replyToId && (
                                    <button type="button" onClick={() => replyToMember(msg)} className="px-2 py-1.5 text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white" title="Trả lời">↩</button>
                                  )}

                                  {msg.authorId === currentUser?.uid && (
                                    <button type="button" onClick={() => startEditMessage(msg)} className="px-2 py-1.5 text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white" title="Chỉnh sửa">✏️</button>
                                  )}

                                  {(msg.messageType === 'image' || msg.messageType === 'file') && msg.fileUrl && (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        downloadFileFromUrl(msg.fileUrl, msg.fileName || (msg.messageType === 'image' ? 'image' : 'download'))
                                      }}
                                      className="px-2 py-1.5 text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                                      title={msg.messageType === 'image' ? 'Tải ảnh' : 'Tải file'}
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                    </button>
                                  )}

                                  <button type="button" onClick={() => pinMessage(msg)} className={`px-2 py-1.5 text-xs font-black transition hover:bg-slate-100 dark:hover:bg-white/10 ${isPinned ? 'text-amber-500' : 'text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`} title={isPinned ? 'Bỏ ghim' : 'Ghim'}>
                                    <Pin className="h-3.5 w-3.5" />
                                  </button>

                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        setReactionPickerMsgId(null)
                                        setMessageMoreMenuId((value) => (value === msg.id ? null : msg.id))
                                      }}
                                      className="px-2 py-1.5 text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                                      title="Thêm"
                                    >
                                      ⋯
                                    </button>

                                    {messageMoreMenuId === msg.id && (
                                      <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-2xl dark:border-white/10 dark:bg-slate-900">
                                        <button type="button" onClick={() => { reactToMessage(msg, '👎'); setMessageMoreMenuId(null) }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-black text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/10">
                                          👎 Không thích
                                        </button>
                                        <button type="button" onClick={() => { copyMessage(msg.content || msg.fileUrl || ''); setMessageMoreMenuId(null) }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-black text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/10">
                                          ⧉ Sao chép
                                        </button>
                                        {(msg.messageType === 'image' || msg.messageType === 'file') && msg.fileUrl && (
                                          <button type="button" onClick={() => { downloadFileFromUrl(msg.fileUrl, msg.fileName || (msg.messageType === 'image' ? 'image' : 'download')); setMessageMoreMenuId(null) }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-black text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/10">
                                            📥 Tải xuống
                                          </button>
                                        )}
                                        {(msg.authorId === currentUser?.uid || canManageActiveGroup) && (
                                          <button type="button" onClick={() => { deleteMessage(msg); setMessageMoreMenuId(null) }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-black text-rose-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-300">
                                            🗑️ Xóa tin nhắn
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t border-slate-200 bg-white p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] dark:border-white/10 dark:bg-slate-950 sm:p-5">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 shadow-inner shadow-black/5 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-500/30 dark:border-white/10 dark:bg-white/5 dark:shadow-black/10 dark:focus-within:ring-sky-500/50">
            {/* Plus button with dropdown */}
            <div ref={plusMenuRef} className="relative">
              <input ref={imageFileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleAttachmentInput(event, 'image')} />
              <input ref={groupFileInputRef} type="file" className="hidden" onChange={(event) => handleAttachmentInput(event, 'file')} />
              <button type="button" onClick={() => setShowPlusMenu((v) => !v)} className="text-slate-400 transition hover:text-slate-900 dark:hover:text-white" title="Đính kèm">
                <Plus className={`h-6 w-6 transition-transform duration-200 ${showPlusMenu ? 'rotate-45' : ''}`} />
              </button>
              {showPlusMenu && (
                <div className="absolute bottom-full left-0 z-50 mb-2 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-2xl dark:border-white/10 dark:bg-slate-900">
                  <button type="button" disabled={!canSendGroupImage} onClick={() => { if (!canSendGroupImage) return toast.error('Nhóm này đã tắt quyền gửi ảnh của thành viên'); imageFileInputRef.current?.click() }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-45 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white">
                    <Image className="h-4 w-4 text-blue-500" />Hình ảnh
                  </button>
                  <button type="button" disabled={!canSendGroupFile} onClick={() => { if (!canSendGroupFile) return toast.error('Nhóm này đã tắt quyền gửi file của thành viên'); groupFileInputRef.current?.click() }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-45 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white">
                    <Paperclip className="h-4 w-4 text-emerald-500" />File
                  </button>
                  <button type="button" disabled={!canSendGroupMessage} onClick={enableNoticeMessage}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-45 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white">
                    <Bell className="h-4 w-4 text-amber-500" />Thông báo
                  </button>
                </div>
              )}
            </div>

            {messageMode === 'notice' && (
              <span className="hidden shrink-0 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-700 dark:bg-amber-400/15 dark:text-amber-200 sm:inline-flex">
                Thông báo
              </span>
            )}

            <input ref={inputRef} value={inputText} disabled={!canSendGroupMessage} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e) } }}
              placeholder={canSendGroupMessage ? (messageMode === 'notice' ? `Viết thông báo tại #${activeChannel?.label}` : `Nhắn tin tại #${activeChannel?.label}`) : 'Nhóm này đã tắt quyền nhắn tin của thành viên'}
              className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-400"
            />

            {/* Emoji picker button */}
            <div className="relative">
              <button type="button" onClick={() => setShowEmojiPicker((v) => !v)} className="hidden rounded-xl px-2 py-2 text-lg transition hover:bg-slate-200 dark:hover:bg-white/10 sm:block" title="Emoji">🙂</button>
              {showEmojiPicker && <EmojiPicker onSelect={(emoji) => setInputText((prev) => prev + emoji)} onClose={() => setShowEmojiPicker(false)} />}
            </div>

            {/* Like button */}
            <button type="button" onClick={sendQuickLike} disabled={!canSendGroupMessage} className="hidden rounded-xl disabled:cursor-not-allowed disabled:opacity-40 px-2 py-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white sm:flex items-center" title="Gửi like">
              <ThumbsUp className="h-5 w-5" />
            </button>

            <button type="button" onClick={sendMessage} disabled={!inputText.trim() || !canSendGroupMessage} className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
        </>
      </div>

      {/* Right sidebar collapse toggle button (always visible) */}
      <button
        type="button"
        onClick={() => setRightSidebarCollapsed((v) => !v)}
        title={rightSidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        className="absolute right-0 top-[84px] z-30 hidden -translate-x-1 translate-y-0 items-center justify-center rounded-l-xl border border-r-0 border-slate-200 bg-white py-3 pl-1.5 pr-2 text-slate-400 shadow-md transition hover:bg-slate-50 hover:text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:hover:bg-white/10 dark:hover:text-white xl:flex"
        style={{ right: rightSidebarCollapsed ? 0 : 320 }}
      >
        {rightSidebarCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {/* Right sidebar */}
      {!rightSidebarCollapsed && (
        <aside className="hidden w-[320px] shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900 xl:block">
          {/* Collapse button inside sidebar */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-400">Online — {activeGroupOnline}</h3>
            <button
              type="button"
              onClick={() => setRightSidebarCollapsed(true)}
              title="Thu gọn"
              className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <section>
            <div className="space-y-3">
              {onlineRosterMembers.length ? onlineRosterMembers.map((member) => {
                const badge = ROLE_BADGES[member.role] || ROLE_BADGES.student
                return (
                  <div key={member.id} className="relative">
                    <button
                      type="button"
                      onClick={() => { setInputText((prev) => prev || `@${member.name} `); inputRef.current?.focus() }}
                      onMouseEnter={() => {
                        clearTimeout(memberTooltipTimeout.current)
                        const presence = activeGroupPresence[member.id] || {}
                        setMemberTooltip({
                          memberId: member.id,
                          memberName: member.name,
                          channelLabel: presence.channelLabel || presence.channelId || 'Không xác định',
                        })
                      }}
                      onMouseLeave={() => {
                        memberTooltipTimeout.current = setTimeout(() => setMemberTooltip(null), 150)
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                    >
                      <ForumUserAvatar avatarUrl={member.avatarUrl} name={member.name} initials={member.initials} sizeClass="h-10 w-10">
                        <span className="absolute -bottom-0.5 -right-0.5 z-10 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400 shadow-sm dark:border-slate-900" />
                      </ForumUserAvatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-slate-950 dark:text-white">{member.name}</p>
                        <p className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${badge.bg}`}>{badge.label}</p>
                      </div>
                    </button>
                    {memberTooltip?.memberId === member.id && (
                      <div className="absolute right-0 top-full z-50 mt-1 max-w-[calc(100vw-2rem)] whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xl dark:border-white/10 dark:bg-slate-800 dark:text-slate-200">
                        <span className="text-slate-400 dark:text-slate-400">Đang ở kênh </span>
                        <span className="font-black text-blue-600 dark:text-blue-300">#{memberTooltip.channelLabel}</span>
                      </div>
                    )}
                  </div>
                )
              }) : <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-400 dark:bg-white/5 dark:text-slate-500">Chưa có ai đang online trong nhóm.</p>}
            </div>
          </section>

          <section className="mt-7 border-t border-slate-200 pt-6 dark:border-white/10">
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-400">Hoạt động hôm nay</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                ['💬', messageCount, 'Tin nhắn', null],
                ['🟢', activeGroupOnline, 'Online', null],
                ['📚', fileCount, 'Tài liệu', () => setShowFilesPopup(true)],
                ['📢', announcementCount, 'Thông báo', () => setShowAnnouncementsPopup(true)],
              ].map(([icon, value, label, onClick]) => {
                const clickable = typeof onClick === 'function'
                const CardTag = clickable ? 'button' : 'div'
                return (
                  <CardTag
                    key={label}
                    type={clickable ? 'button' : undefined}
                    onClick={clickable ? onClick : undefined}
                    className={`rounded-2xl bg-slate-50 p-4 text-center dark:bg-white/5 ${clickable ? 'w-full transition hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-lg dark:hover:bg-white/10' : ''}`}
                  >
                    <div className="text-2xl">{icon}</div>
                    <p className="mt-2 text-xl font-black text-slate-950 dark:text-white">{value}</p>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
                  </CardTag>
                )
              })}
            </div>
          </section>
        </aside>
      )}

      {/* Group settings modal (channel management now lives inside here) */}
      {groupSettingsOpen && activeGroup && (
        <div className="fixed inset-0 z-[90] bg-slate-950/75 p-2 backdrop-blur-md sm:p-3" onMouseDown={() => setGroupSettingsOpen(false)}>
          <style>{`
            @keyframes zunySettingsOpen {
              from { opacity: 0; transform: translateY(18px) scale(.975); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
          <div className="flex h-full w-full animate-[zunySettingsOpen_260ms_ease-out] flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-2xl shadow-blue-950/30 dark:border-white/10 dark:bg-slate-950 dark:shadow-black/70" onMouseDown={(e) => e.stopPropagation()}>
            <div className="relative flex shrink-0 items-center justify-center border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur dark:border-white/10 dark:bg-slate-950/95">
              <div className="text-center">
                <div className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"><Settings className="h-3.5 w-3.5" />ZUNY Group Settings</div>
                <h3 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">Cài đặt nhóm</h3>
                <p className="mt-1 hidden text-sm font-semibold text-slate-500 dark:text-slate-400 sm:block">Thiết lập và quản lý <span className="font-black text-slate-950 dark:text-white">{activeGroup.name}</span></p>
              </div>
              <button type="button" onClick={() => setGroupSettingsOpen(false)} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-2xl p-3 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white sm:right-6" aria-label="Đóng cài đặt nhóm"><X className="h-6 w-6" /></button>
            </div>

            <div className="grid min-h-0 flex-1 md:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_330px]">
              <aside className="min-h-0 overflow-y-auto border-b border-slate-200 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-slate-900/55 md:border-b-0 md:border-r sm:p-5">
                <div className="mb-5 rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-lg" style={getGroupAvatarStyle(activeGroup.themeColor || groupSettingsForm.themeColor || '#8b5cf6')}>{activeGroup.emoji || '👥'}</div>
                  <h4 className="mt-3 truncate text-lg font-black text-slate-950 dark:text-white">{activeGroup.name}</h4>
                  <p className="mt-1 font-mono text-xs font-black tracking-[0.2em] text-slate-400 dark:text-slate-500">{activeGroup.groupCode || 'NO-CODE'}</p>
                </div>
                <div className="space-y-1">
                  {groupSettingsTabs.map(([id, label, icon]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setGroupSettingsTab(id)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black transition ${groupSettingsTab === id ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'}`}
                    >
                      <span className="w-5 text-center">{icon}</span><span>{label}</span>
                    </button>
                  ))}
                </div>
              </aside>

              <div className="min-h-0 overflow-y-auto bg-white p-5 dark:bg-slate-950 sm:p-7 lg:p-8">

                {/* TAB: Tổng quan */}
                {groupSettingsTab === 'overview' && (
                  <section>
                    <h4 className="mb-5 text-2xl font-black text-slate-950 dark:text-white">Tổng quan</h4>
                    <div className="grid gap-4 lg:grid-cols-4">
                      <div className="rounded-3xl bg-slate-50 p-5 dark:bg-white/5"><p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Mã nhóm</p><p className="mt-3 font-mono text-2xl font-black tracking-[0.24em] text-slate-950 dark:text-white">{activeGroup.groupCode || 'NO-CODE'}</p></div>
                      <div className="rounded-3xl bg-slate-50 p-5 dark:bg-white/5"><p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Thành viên</p><p className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{memberCount.toLocaleString('vi-VN')}</p><p className="mt-1 text-xs font-bold text-slate-400 dark:text-slate-500">Tổng thành viên nhóm</p></div>
                      <div className="rounded-3xl bg-slate-50 p-5 dark:bg-white/5"><p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Online</p><p className="mt-3 text-2xl font-black text-emerald-500 dark:text-emerald-300">{activeGroupOnline}</p><p className="mt-1 text-xs font-bold text-slate-400 dark:text-slate-500">Đang hoạt động</p></div>
                      <div className="rounded-3xl bg-slate-50 p-5 dark:bg-white/5"><p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Quyền sở hữu</p><p className="mt-3 truncate text-lg font-black text-slate-950 dark:text-white">{activeGroup.ownerName || 'Chưa rõ'}</p><p className="mt-1 text-xs font-bold text-slate-400 dark:text-slate-500">Chủ nhóm</p></div>
                    </div>
                    <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div><p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Trạng thái chỉnh sửa</p><p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">{canManageActiveGroup ? 'Bạn có quyền chỉnh sửa nhóm này.' : 'Bạn chỉ có thể xem thông tin nhóm này.'}</p></div>
                        <span className={`rounded-full px-4 py-2 text-xs font-black ${canManageActiveGroup ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-400/10 dark:text-slate-300'}`}>{canManageActiveGroup ? 'Có quyền quản lý' : 'Chế độ xem'}</span>
                      </div>
                    </div>
                    <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
                      <h5 className="mb-4 text-xl font-black text-slate-950 dark:text-white">Thông tin cơ bản</h5>
                      <div className="space-y-4">
                        <div><label className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Tên nhóm</label><input value={groupSettingsForm.name} onChange={(e) => setGroupSettingsForm({ ...groupSettingsForm, name: e.target.value })} disabled={!canManageActiveGroup} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/40 dark:text-white dark:placeholder:text-slate-500" /></div>
                        <div><label className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Mô tả</label><textarea value={groupSettingsForm.description} onChange={(e) => setGroupSettingsForm({ ...groupSettingsForm, description: e.target.value })} disabled={!canManageActiveGroup} rows={4} placeholder="Chưa có mô tả." className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/40 dark:text-white dark:placeholder:text-slate-500" /></div>
                      </div>
                    </div>
                  </section>
                )}

                {/* TAB: Quyền riêng tư */}
                {groupSettingsTab === 'privacy' && (
                  <section>
                    <h4 className="mb-5 text-2xl font-black text-slate-950 dark:text-white">Quyền riêng tư</h4>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
                      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Chọn cách thành viên tham gia nhóm. Nếu riêng tư, mật khẩu tối thiểu 6 ký tự.</p>
                      <div className="mt-5 grid gap-3 lg:grid-cols-3">
                        {[
                          ['public', '🌍', 'Công khai', 'Mọi người có thể tìm thấy và bấm nút tham gia.'],
                          ['private', '🔒', 'Riêng tư', 'Mọi người thấy nhóm nhưng cần mật khẩu khi tham gia.'],
                          ['invite_only', '✉️', 'Chỉ qua mã mời', 'Không hiện nút tham gia, chỉ vào bằng mã mời.'],
                        ].map(([value, icon, label, helper]) => {
                          const active = groupSettingsForm.groupType === value
                          return (
                            <button key={value} type="button" disabled={!canManageActiveGroup} onClick={() => setGroupSettingsForm({ ...groupSettingsForm, groupType: value, isPrivate: value === 'private', password: value === 'private' ? groupSettingsForm.password : '' })} className={`rounded-3xl border px-5 py-5 text-left transition disabled:opacity-60 ${active ? 'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-200' : 'border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300'}`}><p className="text-lg font-black">{icon} {label}</p><p className="mt-2 text-sm font-semibold opacity-75">{helper}</p></button>
                          )
                        })}
                      </div>
                      {['private', 'invite_only'].includes(groupSettingsForm.groupType) && (
                        <button
                          type="button"
                          disabled={!canManageActiveGroup}
                          onClick={() => setGroupSettingsForm({ ...groupSettingsForm, isHidden: !groupSettingsForm.isHidden })}
                          className={`mt-4 w-full rounded-3xl border px-5 py-5 text-left transition disabled:opacity-60 ${groupSettingsForm.isHidden ? 'border-cyan-400 bg-cyan-50 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-200' : 'border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300'}`}
                        >
                          <p className="text-lg font-black">🔍 Không công khai</p>
                          <p className="mt-2 text-sm font-semibold opacity-75">Option con của riêng tư/chỉ qua mã mời. Khi bật, nhóm không hiển thị ở đại sảnh, chỉ hiện khi nhập đúng mã nhóm. Admin_dev và trưởng nhóm vẫn nhìn thấy.</p>
                        </button>
                      )}
                      {groupSettingsForm.isHidden && (
                        <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-xs font-bold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-200">
                          Panel Không công khai đang bật cho nhóm này.
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={!canManageActiveGroup}
                        onClick={() => setGroupSettingsForm({ ...groupSettingsForm, requireApproval: !groupSettingsForm.requireApproval })}
                        className={`mt-4 w-full rounded-3xl border px-5 py-5 text-left transition disabled:opacity-60 ${groupSettingsForm.requireApproval ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200' : 'border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300'}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-lg font-black">✅ Duyệt thành viên</p>
                            <p className="mt-2 text-sm font-semibold opacity-75">Khi bật, thành viên mới phải chờ trưởng nhóm/phó nhóm được cấp quyền duyệt trước khi vào nhóm.</p>
                          </div>
                          <span className={`mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${groupSettingsForm.requireApproval ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                            <span className={`h-5 w-5 rounded-full bg-white shadow transition ${groupSettingsForm.requireApproval ? 'translate-x-5' : 'translate-x-0'}`} />
                          </span>
                        </div>
                      </button>
                      {groupSettingsForm.requireApproval && (
                        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                          Chế độ duyệt thành viên đang bật. Yêu cầu tham gia mới sẽ nằm ở tab Duyệt thành viên.
                        </div>
                      )}
                      {groupSettingsForm.groupType === 'private' && (
                        <div className="mt-4"><label className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Mật khẩu nhóm</label><input type="password" value={groupSettingsForm.password} onChange={(e) => setGroupSettingsForm({ ...groupSettingsForm, password: e.target.value })} disabled={!canManageActiveGroup} placeholder="Tối thiểu 6 ký tự" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-400 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/40 dark:text-white dark:placeholder:text-slate-500" /></div>
                      )}
                      {groupSettingsForm.groupType === 'invite_only' && (
                        <div className="mt-4">
                          <label className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Mã mời tự động</label>
                          <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 dark:border-white/10 dark:bg-slate-950/40">
                            <span className="font-mono text-lg font-black tracking-[0.25em] text-slate-950 dark:text-white">{groupSettingsForm.inviteCode || activeGroup.inviteCode || 'Sẽ tự tạo khi lưu'}</span>
                          </div>
                          <p className="mt-2 text-xs font-bold text-slate-400">Mã mời được hệ thống tự random, không cho nhập hoặc đổi thủ công và không hiện trên thẻ nhóm.</p>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* TAB: Kênh */}
                {groupSettingsTab === 'channels' && (
                  <section>
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-2xl font-black text-slate-950 dark:text-white">Quản lý kênh</h4>
                        <p className="mt-1 text-sm font-bold text-slate-400">Quản lý các kênh văn bản của nhóm.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${textChannels.length >= MAX_TEXT_CHANNELS ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-200' : 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-200'}`}># {textChannels.length}/{MAX_TEXT_CHANNELS}</span>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
                      {canManageActiveGroup && (
                        <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/40">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Thêm kênh tùy chỉnh</p>
                          <div className="mt-3 flex items-center gap-2">
                            <input value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomChannel() } }} placeholder="Tên kênh văn bản..." className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 dark:border-white/10 dark:bg-slate-950/40 dark:text-white dark:placeholder:text-slate-500" />
                            <button type="button" onClick={addCustomChannel} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700"><Plus className="h-4 w-4" />Thêm</button>
                          </div>
                          {availablePresetChannels.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {availablePresetChannels.map((preset) => (
                                <button key={preset.id} type="button" onClick={() => addPresetChannel(preset)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-500 transition hover:border-blue-300 hover:text-blue-600 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300"><span>{preset.icon}</span>{preset.label}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-5 space-y-4">
                        {[
                          { key: 'text', label: 'Kênh văn bản', icon: '#', channels: textChannels, collapsed: settingsTextChannelsCollapsed, toggle: () => setSettingsTextChannelsCollapsed((value) => !value) },
                        ].map((section) => (
                          <div key={section.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/40">
                            <button type="button" onClick={section.toggle} className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-white/5">
                              <span className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-200"><span>{section.icon}</span>{section.label}<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-white/10 dark:text-slate-300">{section.channels.length}</span></span>
                              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${section.collapsed ? '-rotate-90' : ''}`} />
                            </button>
                            {!section.collapsed && (
                              <div className="space-y-2 border-t border-slate-200 p-3 dark:border-white/10">
                                {section.channels.map((ch) => (
                                  <div key={ch.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                                    {ch.icon ? <span className="text-xl">{ch.icon}</span> : null}
                                    <span className="text-sm font-black text-slate-400 dark:text-slate-500">#</span>
                                    {editingChannelId === ch.id ? (
                                      <input autoFocus value={editingChannelLabel} onChange={(e) => setEditingChannelLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commitRenameChannel(); if (e.key === 'Escape') setEditingChannelId(null) }} className="min-w-0 flex-1 rounded-xl border border-blue-300 bg-blue-50/50 px-3 py-1.5 text-sm font-black text-slate-900 outline-none dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-white" />
                                    ) : (
                                      <span className="min-w-0 flex-1 truncate text-sm font-black text-slate-700 dark:text-slate-200">{ch.label}</span>
                                    )}
                                    <div className="flex items-center gap-1">
                                      {editingChannelId === ch.id ? <button type="button" disabled={!canManageActiveGroup} onClick={commitRenameChannel} className="rounded-xl p-2 text-emerald-500 transition hover:bg-emerald-50 disabled:opacity-50 dark:hover:bg-emerald-500/10"><Check className="h-4 w-4" /></button> : <button type="button" disabled={!canManageActiveGroup} onClick={() => startRenameChannel(ch)} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-white"><Pencil className="h-4 w-4" /></button>}
                                      <button type="button" disabled={!canManageActiveGroup || DISCORD_CHANNELS.length <= 1} onClick={() => removeChannel(ch.id)} className="rounded-xl p-2 text-rose-400 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                                    </div>
                                  </div>
                                ))}
                                {section.channels.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-7 text-center text-sm font-bold text-slate-400 dark:border-white/10">Chưa có {section.label.toLowerCase()}.</div>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                {/* TAB: Duyệt thành viên */}
                {groupSettingsTab === 'approval' && (
                  <section>
                    <div className="mb-5">
                      <h4 className="text-2xl font-black text-slate-950 dark:text-white">Duyệt thành viên</h4>
                      <p className="mt-1 text-sm font-bold text-slate-400 dark:text-slate-500">Những người đang chờ trưởng nhóm hoặc phó nhóm duyệt sẽ hiện ở đây.</p>
                    </div>
                    {(activeGroup.pendingMemberIds || []).length === 0 ? (
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm font-bold text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-500">
                        Chưa có yêu cầu tham gia nào.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(activeGroup.pendingMemberIds || []).map((uid) => {
                          const member = memberProfiles[uid] || {
                            id: uid,
                            name: 'Thành viên chờ duyệt',
                            initials: 'TV',
                          }

                          return (
                            <div key={uid} className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                              <div className="flex min-w-0 items-center gap-3">
                                <ForumUserAvatar
                                  avatarUrl={member.avatarUrl}
                                  name={member.name}
                                  initials={member.initials}
                                  sizeClass="h-11 w-11"
                                  roundedClass="rounded-2xl"
                                />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black text-slate-950 dark:text-white">{member.name}</p>
                                  <p className="truncate text-xs font-bold text-slate-400 dark:text-slate-500">{uid}</p>
                                </div>
                              </div>
                              <div className="flex shrink-0 gap-2">
                                <button type="button" disabled={!canApproveInActiveGroup} onClick={() => rejectPendingMember(uid)} className="rounded-2xl bg-rose-500 px-4 py-2 text-xs font-black text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50">Từ chối</button>
                                <button type="button" disabled={!canApproveInActiveGroup} onClick={() => approvePendingMember(uid)} className="rounded-2xl bg-emerald-500 px-4 py-2 text-xs font-black text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">Duyệt</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </section>
                )}

                {/* TAB: Quyền thành viên */}
                {groupSettingsTab === 'members' && (
                  <section>
                    <h4 className="mb-5 text-2xl font-black text-slate-950 dark:text-white">Quyền thành viên</h4>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
                      <p className="text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">Khi tắt quyền nào, thành viên thường sẽ không dùng được hành động đó trong nhóm. Chủ nhóm/admin vẫn có quyền quản lý.</p>
                      <div className="mt-5 grid gap-3">
                        {[
                          ['sendMessage', 'Gửi tin nhắn', 'Cho phép thành viên nhắn tin, trả lời và gửi like nhanh trong chat.'],
                          ['sendImage', 'Gửi ảnh', 'Cho phép thành viên chọn mục Ảnh trong nút cộng.'],
                          ['sendFile', 'Gửi file', 'Cho phép thành viên chọn mục File trong nút cộng.'],
                          ['createPost', 'Tạo bài viết', 'Cho phép thành viên đăng bài viết thuộc nhóm.'],
                          ['invite', 'Mời người khác', 'Cho phép thành viên copy/chia sẻ mã mời nhóm.'],
                        ].map(([key, label, helper]) => {
                          const active = groupSettingsForm.permissions?.[key] !== false
                          return (
                            <button key={key} type="button" disabled={!canManageActiveGroup} onClick={() => setGroupSettingsForm({ ...groupSettingsForm, permissions: { ...(groupSettingsForm.permissions || {}), [key]: !active } })} className={`rounded-2xl border p-4 text-left transition disabled:opacity-60 ${active ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200' : 'border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-400'}`}>
                              <div className="flex items-start justify-between gap-4">
                                <div><p className="text-sm font-black">{label}</p><p className="mt-1 text-xs font-semibold leading-5 opacity-75">{helper}</p></div>
                                <span className={`mt-1 inline-flex h-6 w-11 items-center rounded-full p-1 transition ${active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/10'}`}><span className={`h-4 w-4 rounded-full bg-white transition ${active ? 'translate-x-5' : ''}`} /></span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </section>
                )}

                {/* TAB: Giới hạn thành viên */}
                {groupSettingsTab === 'members' && (
                  <section>
                    <h4 className="mb-5 text-2xl font-black text-slate-950 dark:text-white">Giới hạn thành viên</h4>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
                      <p className="text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">Nếu bỏ trống hoặc không hợp lệ, hệ thống dùng mặc định 1000 thành viên.</p>
                      <label className="mt-5 block text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Số thành viên tối đa</label>
                      <input type="number" min="1" value={groupSettingsForm.memberLimit || ''} onChange={(e) => setGroupSettingsForm({ ...groupSettingsForm, memberLimit: e.target.value })} disabled={!canManageActiveGroup} placeholder="1000" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/40 dark:text-white dark:placeholder:text-slate-500" />
                    </div>
                  </section>
                )}

                {/* TAB: Mời bạn bè */}
                {groupSettingsTab === 'invite' && (
                  <section>
                    <h4 className="mb-5 text-2xl font-black text-slate-950 dark:text-white">Mời bạn bè</h4>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
                      {(activeGroup?.groupType || (activeGroup?.isPrivate ? 'private' : 'public')) !== 'invite_only' ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
                          Nhóm công khai hoặc riêng tư không có mã mời. Người dùng tham gia bằng nút tham gia trên thẻ nhóm.
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">Mã mời chỉ hiện trong phần cài đặt nhóm và không xuất hiện công khai trên thẻ nhóm.</p>
                          <div className="mt-4 flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/40">
                            <div className="flex-1 text-center">
                              <p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Mã mời</p>
                              <p className="mt-2 font-mono text-3xl font-black tracking-[0.28em] text-slate-950 dark:text-white">{activeGroup.inviteCode || 'NO-INVITE'}</p>
                            </div>
                            <button type="button" onClick={copyGroupCode} disabled={!canInviteToActiveGroup || !activeGroup.inviteCode} title="Copy mã mời" className="flex h-12 disabled:cursor-not-allowed disabled:opacity-45 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 transition hover:bg-blue-200 dark:bg-sky-500/20 dark:text-sky-300 dark:hover:bg-sky-500/30 dark:hover:text-sky-200"><Copy className="h-5 w-5" /></button>
                          </div>
                          <button type="button" onClick={copyGroupCode} disabled={!canInviteToActiveGroup || !activeGroup.inviteCode} className="mt-4 w-full rounded-2xl disabled:cursor-not-allowed disabled:opacity-45 bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700">Copy mã mời</button>
                        </>
                      )}
                    </div>
                  </section>
                )}

                {/* TAB: Giao diện */}
                {groupSettingsTab === 'appearance' && (
                  <section>
                    <h4 className="mb-5 text-2xl font-black text-slate-950 dark:text-white">Giao diện nhóm</h4>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
                      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Ảnh bìa, icon và màu chủ đề sẽ dùng cho card nhóm và các điểm nhấn giao diện.</p>
                      <div className="mt-5 grid gap-4 lg:grid-cols-[120px_minmax(0,1fr)]">
                        <div>
                          <label className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Icon nhóm</label>
                          <input value={groupSettingsForm.emoji} onChange={(e) => setGroupSettingsForm({ ...groupSettingsForm, emoji: e.target.value.slice(0, 4) })} disabled={!canManageActiveGroup} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-center text-3xl font-black text-slate-900 outline-none transition focus:border-blue-400 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/40 dark:text-white" />
                        </div>
                        <div>
                          <label className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Ảnh bìa</label>
                          <input value={groupSettingsForm.coverImage} onChange={(e) => setGroupSettingsForm({ ...groupSettingsForm, coverImage: e.target.value })} disabled={!canManageActiveGroup} placeholder="Dán URL ảnh bìa..." className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/40 dark:text-white dark:placeholder:text-slate-500" />
                        </div>
                      </div>
                      <div className="mt-5 h-36 overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 dark:border-white/10" style={getGroupThemeStyle(groupSettingsForm.themeColor || '#8b5cf6', groupSettingsForm.coverImage)} />

                      <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/40">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-11 w-11 items-center justify-center rounded-2xl text-xl shadow-lg"
                              style={getGroupAvatarStyle(groupSettingsForm.themeColor || '#8b5cf6')}
                            >
                              🖌️
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-800 dark:text-white">Màu chủ đề</p>
                              <p className="text-xs font-bold text-slate-400 dark:text-slate-500">Chọn màu đơn hoặc gradient cho nhóm.</p>
                            </div>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500 dark:bg-white/10 dark:text-slate-300">
                            {isGradientTheme(groupSettingsForm.themeColor) ? 'Gradient' : 'Màu đơn'}
                          </span>
                        </div>

                        <div>
                          <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Màu solid</p>
                          <div className="grid grid-cols-6 gap-3 sm:grid-cols-8">
                            {GROUP_THEME_COLORS.map((color) => (
                              <button
                                key={color.value}
                                type="button"
                                disabled={!canManageActiveGroup}
                                onClick={() => setGroupSettingsForm({ ...groupSettingsForm, themeColor: color.value })}
                                className={`h-12 rounded-2xl border transition disabled:opacity-60 ${groupSettingsForm.themeColor === color.value ? 'scale-105 border-slate-950 ring-4 ring-blue-200 dark:border-white dark:ring-white/10' : 'border-slate-200 dark:border-white/10'}`}
                                style={{ background: color.value }}
                                title={color.name}
                                aria-label={`Chọn màu ${color.name}`}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="mt-5">
                          <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Gradient</p>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {GROUP_THEME_GRADIENTS.map((gradient) => (
                              <button
                                key={gradient.value}
                                type="button"
                                disabled={!canManageActiveGroup}
                                onClick={() => setGroupSettingsForm({ ...groupSettingsForm, themeColor: gradient.value })}
                                className={`relative h-14 overflow-hidden rounded-2xl border-2 transition disabled:opacity-60 ${groupSettingsForm.themeColor === gradient.value ? 'border-white ring-4 ring-blue-200 dark:ring-white/10' : 'border-slate-200 dark:border-white/10'}`}
                                style={{ background: gradient.value }}
                                aria-label={`Chọn gradient ${gradient.name}`}
                              >
                                <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-white drop-shadow">{gradient.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* TAB: Dữ liệu hệ thống */}
                {groupSettingsTab === 'system' && (
                  <section>
                    <h4 className="mb-5 text-2xl font-black text-slate-950 dark:text-white">Dữ liệu hệ thống</h4>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
                      <div className="space-y-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between gap-3 rounded-2xl bg-white px-4 py-3 dark:bg-slate-950/40"><span className="text-slate-400 dark:text-slate-500">ID</span><span className="max-w-[180px] truncate font-mono text-slate-950 dark:text-white">{activeGroup.id}</span></div>
                        <div className="flex justify-between gap-3 rounded-2xl bg-white px-4 py-3 dark:bg-slate-950/40"><span className="text-slate-400 dark:text-slate-500">Ngày tạo</span><span className="text-slate-950 dark:text-white">{timestampToMs(activeGroup.createdAt) ? new Date(timestampToMs(activeGroup.createdAt)).toLocaleDateString('vi-VN') : 'Chưa có'}</span></div>
                        <div className="flex justify-between gap-3 rounded-2xl bg-white px-4 py-3 dark:bg-slate-950/40"><span className="text-slate-400 dark:text-slate-500">Cập nhật</span><span className="text-slate-950 dark:text-white">{timestampToMs(activeGroup.updatedAt) ? formatRelativeTime(activeGroup.updatedAt) : 'Chưa có'}</span></div>
                        <div className="flex justify-between gap-3 rounded-2xl bg-white px-4 py-3 dark:bg-slate-950/40"><span className="text-slate-400 dark:text-slate-500">Số kênh</span><span className="text-slate-950 dark:text-white">{DISCORD_CHANNELS.length}</span></div>
                      </div>
                    </div>
                  </section>
                )}

                <div className="sticky bottom-0 -mx-5 -mb-5 mt-8 flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-white/10 dark:bg-slate-950/95 sm:-mx-7 sm:-mb-7 sm:px-7 lg:-mx-8 lg:-mb-8 lg:px-8">
                  <button type="button" onClick={() => setGroupSettingsOpen(false)} className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15">Đóng</button>
                  {canManageActiveGroup && groupSettingsTab !== 'system' && groupSettingsTab !== 'invite' && groupSettingsTab !== 'channels' && (
                    <button type="button" onClick={saveGroupSettings} disabled={savingGroupSettings} className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-60">{savingGroupSettings ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
                  )}
                </div>
              </div>

              <aside className="hidden min-h-0 overflow-y-auto border-l border-slate-200 bg-slate-50/90 p-5 dark:border-white/10 dark:bg-slate-900/55 xl:block">
                <div className="sticky top-0">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-500">Xem trước</p>
                      <h4 className="mt-1 text-lg font-black text-slate-950 dark:text-white">Không gian nhóm</h4>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">Realtime</span>
                  </div>

                  <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60 dark:border-white/10 dark:bg-slate-950 dark:shadow-black/30">
                    <div className="h-32 bg-slate-900" style={getGroupThemeStyle(groupSettingsForm.themeColor || activeGroup.themeColor || '#2563eb', groupSettingsForm.coverImage || activeGroup.coverImage || activeGroup.coverUrl || '')} />
                    <div className="relative px-5 pb-5 pt-12">
                      <div className="absolute -top-9 left-5 flex h-20 w-20 items-center justify-center rounded-[1.35rem] border-4 border-white text-3xl shadow-xl dark:border-slate-950" style={getGroupAvatarStyle(groupSettingsForm.themeColor || activeGroup.themeColor || '#2563eb')}>
                        {groupSettingsForm.emoji || activeGroup.emoji || '👥'}
                      </div>
                      <h5 className="truncate text-xl font-black text-slate-950 dark:text-white">{groupSettingsForm.name || activeGroup.name || 'Nhóm học ZUNY'}</h5>
                      <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">{groupSettingsForm.description || activeGroup.description || 'Không gian học tập và trao đổi kiến thức của nhóm.'}</p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-[11px] font-black text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">{groupSettingsForm.groupType === 'private' ? '🔒 Riêng tư' : groupSettingsForm.groupType === 'invite_only' ? '✉️ Mã mời' : '🌍 Công khai'}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600 dark:bg-white/10 dark:text-slate-300">👥 {memberCount.toLocaleString('vi-VN')}</span>
                      </div>

                      <div className="mt-5 border-t border-slate-200 pt-4 dark:border-white/10">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Kênh hiện có</p>
                        <div className="mt-3 space-y-2">
                          {DISCORD_CHANNELS.slice(0, 5).map((channel) => (
                            <div key={channel.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300">
                              <span>#</span>
                              <span className="truncate">{channel.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-3xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-400/20 dark:bg-blue-500/10">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-600 dark:text-blue-300">Trạng thái</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-blue-700 dark:text-blue-100">{canManageActiveGroup ? 'Các thay đổi chỉ được ghi vào PostgreSQL sau khi bạn nhấn “Lưu thay đổi”.' : 'Bạn đang xem cài đặt nhóm ở chế độ chỉ đọc.'}</p>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}

      {leaveGroupConfirm && activeGroup && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md" onMouseDown={() => setLeaveGroupConfirm(false)}>
          <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-rose-200 bg-white shadow-2xl dark:border-rose-500/20 dark:bg-slate-900" onMouseDown={(event) => event.stopPropagation()}>
            <div className="border-b border-rose-100 bg-rose-50 px-6 py-5 dark:border-rose-500/10 dark:bg-rose-500/5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-rose-600 dark:text-rose-300">Xác nhận rời nhóm</p>
              <h3 className="mt-2 text-xl font-black text-slate-950 dark:text-white">Rời khỏi {activeGroup.name || 'nhóm học'}?</h3>
            </div>
            <div className="p-6">
              <p className="text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">Bạn sẽ không còn truy cập kênh chat và thông báo của nhóm này. Bạn có chắc chắn muốn tiếp tục?</p>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setLeaveGroupConfirm(false)} className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15">Hủy</button>
                <button type="button" onClick={async () => { setLeaveGroupConfirm(false); await handleLeaveGroup() }} className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-black text-white transition hover:bg-rose-700">Rời nhóm</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete channel confirmation popup */}
      {deleteChannelConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md" onMouseDown={() => setDeleteChannelConfirm(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-rose-200 bg-white shadow-2xl dark:border-rose-500/20 dark:bg-slate-900" onMouseDown={(e) => e.stopPropagation()}>
            <div className="border-b border-rose-100 bg-rose-50 px-6 py-5 dark:border-rose-500/10 dark:bg-rose-500/5">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><Trash2 className="h-3.5 w-3.5" />Xoá kênh</div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">Xoá kênh #{deleteChannelConfirm.channelLabel}?</h3>
            </div>
            <div className="p-6">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/5">
                <p className="text-sm font-bold text-rose-700 dark:text-rose-300">⚠️ Toàn bộ tin nhắn và dữ liệu trong kênh này sẽ bị xoá vĩnh viễn và không thể khôi phục.</p>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-500 dark:text-slate-400">Bạn có chắc chắn muốn xoá kênh <span className="font-black text-slate-950 dark:text-white">#{deleteChannelConfirm.channelLabel}</span>?</p>
              <div className="mt-5 flex justify-end gap-3">
                <button type="button" onClick={() => setDeleteChannelConfirm(null)} className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15">Huỷ</button>
                <button type="button" onClick={confirmRemoveChannel} className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-black text-white transition hover:bg-rose-700">Xoá kênh</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite popup */}
      {invitePopupOpen && activeGroup && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md" onMouseDown={() => setInvitePopupOpen(false)}>
          <div className="w-full max-w-sm overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-white/10 dark:bg-slate-950/40">
              <h3 className="text-lg font-black text-slate-950 dark:text-white">Mời bạn bè</h3>
              <button type="button" onClick={() => setInvitePopupOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6">
              <p className="mb-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Chia sẻ mã mời này để mời bạn bè tham gia.</p>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                <p className="flex-1 font-mono text-2xl font-black tracking-[0.28em] text-slate-950 dark:text-white">{activeGroup.inviteCode || 'NO-INVITE'}</p>
                <button type="button" onClick={copyGroupCode} disabled={!canInviteToActiveGroup} className="flex h-10 disabled:cursor-not-allowed disabled:opacity-45 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 transition hover:bg-blue-200 dark:bg-sky-500/20 dark:text-sky-300 dark:hover:bg-sky-500/30 dark:hover:text-sky-200" title="Copy mã mời"><Copy className="h-5 w-5" /></button>
              </div>
              <button type="button" onClick={copyGroupCode} disabled={!canInviteToActiveGroup} className="mt-4 w-full rounded-2xl disabled:cursor-not-allowed disabled:opacity-45 bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700">Copy mã mời</button>
            </div>
          </div>
        </div>
      )}

      {/* Pinned messages popup */}
      {showPinnedPopup && <PinnedMessagesPopup pinnedMessages={pinnedMessages} resolveUser={resolveSyncedUser} onClose={() => setShowPinnedPopup(false)} />}

      {/* Member list popup — full roster, paginated 10 per page */}
      {groupReportModal?.group && (
        <div className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onMouseDown={() => setGroupReportModal(null)}>
          <div className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-500">Báo cáo nhóm</p>
                <h3 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{groupReportModal.group.name || 'Nhóm học'}</h3>
                <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-300">Chọn lý do và mô tả thêm để admin kiểm tra nhóm này.</p>
              </div>
              <button type="button" onClick={() => setGroupReportModal(null)} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {GROUP_REPORT_REASONS.map((item) => (
                <button key={item} type="button" onClick={() => setGroupReportModal((prev) => ({ ...prev, reason: item }))} className={`rounded-2xl border px-3 py-2 text-left text-xs font-black transition ${groupReportModal.reason === item ? 'border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200' : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'}`}>{item}</button>
              ))}
            </div>

            <textarea value={groupReportModal.detail} onChange={(event) => setGroupReportModal((prev) => ({ ...prev, detail: event.target.value }))} rows={4} placeholder="Nhập mô tả chi tiết hoặc lý do khác..." className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-rose-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500" />

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setGroupReportModal(null)} className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-600 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15">Hủy</button>
              <button type="button" onClick={submitGroupReport} className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-black text-white transition hover:bg-rose-700">Gửi báo cáo</button>
            </div>
          </div>
        </div>
      )}
      {showMemberList && <MemberListPopup members={rosterMembers} onlineIds={activeGroupOnlineIds} ownerId={activeGroup?.ownerId} adminIds={activeGroupAdminIds} currentUserId={currentUser?.uid} canManage={canManageActiveGroup} canKick={canKickInActiveGroup} deputyPermissions={deputyPermissions} onKick={kickMember} onPromote={promoteDeputy} onRemoveDeputy={removeDeputy} onTransferOwner={transferOwner} onUpdateDeputyPermission={updateDeputyPermission} onClose={() => setShowMemberList(false)} />}

      {/* Search popup */}
      {showSearchPopup && <SearchPopup messages={messages} onClose={() => setShowSearchPopup(false)} />}
      {showAnnouncementsPopup && <HistoryPopup title="Lịch sử thông báo" icon="📢" items={announcementMessages} type="announcement" onClose={() => setShowAnnouncementsPopup(false)} />}
      {showFilesPopup && <HistoryPopup title="Lịch sử tài liệu" icon="📚" items={fileMessages} type="file" onClose={() => setShowFilesPopup(false)} />}
      {zoomedImage && <ImageLightbox image={zoomedImage} onClose={() => setZoomedImage(null)} />}
    </div>
  )
}
import { useEffect, useRef, useState } from 'react'
import {
  Bookmark,
  BookmarkCheck,
  Eye,
  Flag,
  MessageCircle,
  Share2,
  ShieldCheck,
  Star,
  Trash2,
} from 'lucide-react'
import {
  POST_TYPES,
  REACTIONS,
  VISIBLE_REACTIONS,
  roleText,
} from '../utils/forumConstants'
import {
  formatEventDate,
  formatRelativeTime,
  getInitials,
  getReactionSummary,
  getUserReaction,
} from '../utils/forumUtils'

const formatEventDateTime = (value) => {
  if (!value) return ''

  const date =
    value && typeof value.toDate === 'function'
      ? value.toDate()
      : value && typeof value.toMillis === 'function'
        ? new Date(value.toMillis())
        : new Date(value)

  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
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
  if (!posts.length) return <EmptyState icon="🔍" title="Không tìm thấy bài viết" description="Thử đổi bộ lọc hoặc từ khóa tìm kiếm." actionLabel="Khởi động lại" onAction={onClear} />
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
        {post.type === 'event' && (post.eventStartAt || post.eventDate || post.eventEndAt || post.eventLocation) && (
          <div className="mt-4 rounded-3xl border border-rose-200 bg-rose-50/80 p-4 text-sm font-black text-rose-600 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-100">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl bg-white px-3 py-2 dark:bg-white/10">
                <p className="text-[10px] uppercase tracking-[0.14em] text-rose-400 dark:text-rose-200/80">Thời gian mở</p>
                <p className="mt-1 text-slate-900 dark:text-white">🟢 {formatEventDateTime(post.eventStartAt || post.eventDate) || 'Chưa cập nhật'}</p>
              </div>

              <div className="rounded-2xl bg-white px-3 py-2 dark:bg-white/10">
                <p className="text-[10px] uppercase tracking-[0.14em] text-rose-400 dark:text-rose-200/80">Thời gian đóng</p>
                <p className="mt-1 text-slate-900 dark:text-white">🔴 {formatEventDateTime(post.eventEndAt) || 'Chưa cập nhật'}</p>
              </div>

              <div className="rounded-2xl bg-white px-3 py-2 dark:bg-white/10 sm:col-span-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-rose-400 dark:text-rose-200/80">Địa điểm / link tham gia</p>
                <p className="mt-1 break-words text-slate-900 dark:text-white">📍 {post.eventLocation || 'Chưa cập nhật'}</p>
              </div>
            </div>
          </div>
        )}
        {post.attachmentUrl && <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-600 dark:bg-white/10 dark:text-slate-200">🔗 {post.attachmentName || post.attachmentUrl}</div>}
        {post.tags?.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{post.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 dark:bg-white/10 dark:text-slate-300">#{tag}</span>)}</div>}
      </div>

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
            ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200'
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

export { PostList, PostCard, MiniReactionButton, ReactionButton }
export default PostCard

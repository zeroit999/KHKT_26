import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { Send, Share2, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'

import { db } from '../../../components/firebase'
import { REACTIONS, VISIBLE_REACTIONS } from '../utils/forumConstants'
import {
  buildReactionCounts,
  formatRelativeTime,
  getReactionSummary,
  getUserReaction,
  timestampToMs,
} from '../utils/forumUtils'

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


function PostDetailModal({ post, highlightedCommentId = '', currentUser, displayName, initials, roleKey, likingPostIds = [], onClose, onLike, onReport, onSave, onDelete, onShare, onVote }) {
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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-black text-white">{initials}</div>
          <input ref={inputRef} value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder={!canComment ? 'Chỉ giáo viên được trả lời bài này' : 'Nhập bình luận...'} disabled={!canComment} className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5 dark:text-white" />
          <button type="submit" disabled={!canComment} className="rounded-2xl bg-violet-600 p-3 text-white disabled:opacity-50"><Send className="h-5 w-5" /></button>
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
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-xs font-black text-white">
          {comment.authorInitials || getInitials(comment.authorName)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="rounded-2xl bg-white p-3 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-black text-slate-950 dark:text-white">{comment.authorName}</span>
              <span className="text-[11px] font-bold text-slate-400">{formatRelativeTime(comment.createdAt)}</span>
              {Number(comment.depth || level) > 1 && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black text-violet-600 dark:bg-violet-500/15 dark:text-violet-200">Trả lời</span>}
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
                className="rounded-full px-2 py-1 text-[11px] font-black text-violet-500 transition hover:bg-violet-50 dark:hover:bg-violet-500/10"
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
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
              <button type="button" onClick={onCancelReply} className="rounded-xl px-3 py-2 text-xs font-black text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">Hủy</button>
              <button type="submit" className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-black text-white">Gửi</button>
            </form>
          )}

          {comment.replies?.length > 0 && (
            <div className="mt-3 space-y-3 border-l-2 border-violet-100 pl-3 dark:border-violet-500/20">
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


export default PostDetailModal

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc, increment, updateDoc } from 'firebase/firestore'

import useSyncedDarkMode from '../../hooks/common/useSyncedDarkMode'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { db } from '../../components/firebase'

import { isTeacherLike, resolveDisplayRole } from '../../utils/eLearningUiUtils'
import { GlassPanel, ProgressBar, StatPill } from '../../components/e-learning/ELearningUI'

const DEFAULT_THUMBNAIL =
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop'

const FIRESTORE_COLLECTIONS = ['eLearnings', 'courses']

function ELearningDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isDarkMode = useSyncedDarkMode()
  const { userDetails } = useAuth()

  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const role = resolveDisplayRole(
    userDetails?.role ||
      userDetails?.Role ||
      userDetails?.accountType ||
      userDetails?.userRole ||
      userDetails?.type ||
      'STUDENT',
  )

  const canManage = isTeacherLike(role)

  useEffect(() => {
    let cancelled = false

    async function fetchDetail() {
      try {
        setLoading(true)
        setError('')

        const result = await findELearningById(id)

        if (cancelled) return

        if (!result) {
          setItem(null)
          setError('Không tìm thấy bài E-learning trong Firestore.')
          return
        }

        const normalized = normalizeELearningDoc(result.id, result.data, result.collectionName)
        setItem(normalized)

        updateDoc(doc(db, result.collectionName, result.id), {
          views: increment(1),
        }).catch((viewError) => {
          console.warn('Không thể cập nhật lượt xem E-learning:', viewError)
        })
      } catch (fetchError) {
        if (!cancelled) {
          console.error('Không thể lấy chi tiết E-learning:', fetchError)
          setError('Không thể tải chi tiết E-learning từ Firebase Firestore.')
          setItem(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchDetail()

    return () => {
      cancelled = true
    }
  }, [id])

  const progress = useMemo(
    () => Math.max(0, Math.min(100, Number(item?.progress || 0))),
    [item],
  )

  if (loading) {
    return (
      <main className={`${isDarkMode ? 'dark ' : ''}min-h-screen bg-slate-50 px-4 py-8 text-slate-950 transition-colors dark:bg-[#020617] dark:text-white sm:px-6 lg:px-8`}>
        <div className="mx-auto max-w-7xl">
          <div className="h-[520px] animate-pulse rounded-[2rem] bg-slate-200 dark:bg-white/[0.06]" />
        </div>
      </main>
    )
  }

  if (!item) {
    return (
      <main className={`${isDarkMode ? 'dark ' : ''}min-h-screen bg-slate-50 px-4 py-8 text-slate-950 transition-colors dark:bg-[#020617] dark:text-white sm:px-6 lg:px-8`}>
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-xl shadow-slate-200/60 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-slate-950/30">
          <div className="text-5xl">🔎</div>
          <h1 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">
            Không tìm thấy E-learning
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {error || 'Bài học có thể đã bị xóa hoặc đường dẫn không đúng.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/e-learning')}
            className="mt-6 rounded-2xl bg-sky-400 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-sky-300"
          >
            Quay lại E-learning
          </button>
        </div>
      </main>
    )
  }

  const locked = !canManage && isFutureOpen(item.openAt || item.openAtMs)
  const lessonList = Array.isArray(item.lessonList) ? item.lessonList : []

  return (
    <main className={`${isDarkMode ? 'dark ' : ''}min-h-screen bg-slate-50 px-4 py-8 text-slate-950 transition-colors dark:bg-[#020617] dark:text-white sm:px-6 lg:px-8`}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/e-learning')}
            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
          >
            ← Quay lại E-learning
          </button>

          {locked && (
            <span className="rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-slate-950">
              🔒 Chưa mở
            </span>
          )}
        </div>

        <GlassPanel className="overflow-hidden">
          <div className="relative h-[420px] overflow-hidden">
            <img
              src={item.thumbnail || DEFAULT_THUMBNAIL}
              alt={item.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent" />
            <div className="absolute bottom-8 left-6 right-6 md:left-8 md:right-8">
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-sky-400 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-950">
                  {item.subject}
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white backdrop-blur">
                  {item.visibility === 'private' ? item.className || 'Riêng tư' : 'Công khai'}
                </span>
                {item.courseCode && (
                  <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white backdrop-blur">
                    {item.courseCode}
                  </span>
                )}
              </div>
              <h1 className="max-w-5xl text-4xl font-black tracking-tight text-white md:text-6xl">
                {item.title}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-200">
                {item.description}
              </p>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="grid gap-4 md:grid-cols-4">
              <StatPill icon="👨‍🏫" label="Giáo viên" value={item.teacherName} />
              <StatPill icon="📘" label="Bài nhỏ" value={lessonList.length || item.lessonCount || 1} />
              <StatPill icon="👁️" label="Lượt xem" value={Number(item.views || 0) + 1} />
              <StatPill icon="⭐" label="Đánh giá" value={`★ ${item.rating}`} />
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="mb-2 flex items-center justify-between text-sm font-black text-slate-600 dark:text-slate-300">
                <span>Tiến độ học tập</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <ProgressBar value={progress} />
            </div>

            {locked ? (
              <div className="mt-8 rounded-[1.5rem] border border-amber-300 bg-amber-50 p-6 text-center dark:border-amber-400/30 dark:bg-amber-400/10">
                <div className="text-4xl">🔒</div>
                <h2 className="mt-3 text-2xl font-black text-slate-950 dark:text-white">
                  Bài học chưa mở
                </h2>
                <p className="mt-2 text-sm font-bold text-amber-700 dark:text-amber-200">
                  Thời gian mở: {formatFullDateTime(item.openAt || item.openAtMs)}
                </p>
              </div>
            ) : (
              <>
                <MainResourceBlock item={item} />

                <section className="mt-8 rounded-[1.5rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="text-sm font-black uppercase tracking-[0.3em] text-sky-600 dark:text-sky-300">
                    Danh sách bài nhỏ
                  </div>
                  <div className="mt-5 grid gap-4">
                    {lessonList.length > 0 ? (
                      lessonList.map((lesson, index) => (
                        <LessonBlock key={lesson.id || index} lesson={lesson} index={index} />
                      ))
                    ) : (
                      <LessonBlock lesson={item} index={0} />
                    )}
                  </div>
                </section>
              </>
            )}
          </div>
        </GlassPanel>
      </div>
    </main>
  )
}

function MainResourceBlock({ item }) {
  return (
    <section className="mt-8 rounded-[1.5rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="text-sm font-black uppercase tracking-[0.3em] text-violet-500 dark:text-violet-300">
        Học liệu chính
      </div>
      <h2 className="mt-3 text-2xl font-black text-slate-950 dark:text-white">
        Bắt đầu học
      </h2>
      <ResourceContent item={item} />
    </section>
  )
}

function LessonBlock({ lesson, index }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-slate-950/50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-950 dark:text-white">
            Bài {index + 1}: {lesson.title || 'Bài học'}
          </h3>
          {lesson.content && (
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {lesson.content}
            </p>
          )}
        </div>
        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-700 dark:bg-sky-400/10 dark:text-sky-200">
          {getAttachModeLabel(lesson.attachMode)}
        </span>
      </div>
      <ResourceContent item={lesson} compact />
    </article>
  )
}

function ResourceContent({ item, compact = false }) {
  const mode = item.attachMode || (item.youtubeUrl ? 'youtube' : item.fileUrl ? 'file' : 'document')
  const youtubeVideoId = getYoutubeVideoId(item.youtubeUrl)
  const fileUrl = item.fileUrl || item.wordFileUrl || item.documentFileUrl || ''
  const fileName = item.fileName || item.wordFileName || item.documentFileName || 'Tài liệu'
  const documentContent = item.documentContent || item.richDocument || ''

  return (
    <div className={compact ? 'mt-4' : 'mt-5'}>
      {mode === 'youtube' && youtubeVideoId && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black dark:border-white/10">
          <iframe
            title={item.title || 'Video E-learning'}
            src={`https://www.youtube.com/embed/${youtubeVideoId}`}
            className="aspect-video w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      )}

      {mode === 'code' && item.codeContent && (
        <pre className="min-h-72 overflow-auto rounded-2xl border border-emerald-400/20 bg-black p-5 font-mono text-sm leading-7 text-emerald-300">
          {item.codeContent}
        </pre>
      )}

      {(mode === 'file' || fileUrl) && fileUrl && (
        <div className="grid gap-4">
          {isPdfFile(fileName, fileUrl) && (
            <iframe
              src={fileUrl}
              title={fileName}
              className="h-[520px] w-full rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950"
            />
          )}
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-2xl bg-sky-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-sky-300"
          >
            📄 Mở {fileName}
          </a>
        </div>
      )}

      {(mode === 'document' || documentContent) && documentContent && (
        <div
          className="prose mt-4 max-w-none rounded-2xl bg-slate-50 p-5 text-base leading-8 text-slate-700 dark:prose-invert dark:bg-slate-950/60 dark:text-slate-200 [&_ol]:ml-6 [&_ol]:list-decimal [&_ul]:ml-6 [&_ul]:list-disc"
          dangerouslySetInnerHTML={{ __html: documentContent }}
        />
      )}

      {!youtubeVideoId && !fileUrl && !item.codeContent && !documentContent && (
        <div className="rounded-2xl bg-slate-50 p-5 text-sm leading-7 text-slate-600 dark:bg-slate-950/60 dark:text-slate-300">
          {item.content || item.description || 'Giáo viên chưa thêm học liệu cho phần này.'}
        </div>
      )}
    </div>
  )
}

async function findELearningById(id) {
  for (const collectionName of FIRESTORE_COLLECTIONS) {
    const snapshot = await getDoc(doc(db, collectionName, id))

    if (snapshot.exists()) {
      return {
        id: snapshot.id,
        collectionName,
        data: snapshot.data(),
      }
    }
  }

  return null
}

function normalizeELearningDoc(id, data = {}, sourceCollection = 'eLearnings') {
  const lessonList = Array.isArray(data.lessons)
    ? data.lessons.map((lesson, index) => ({
        id: lesson.id || `${id}-lesson-${index}`,
        title: lesson.title || `Bài ${index + 1}`,
        content: lesson.content || '',
        attachMode: lesson.attachMode || 'youtube',
        youtubeUrl: lesson.youtubeUrl || '',
        fileName: lesson.fileName || lesson.wordFileName || '',
        fileUrl: lesson.fileUrl || lesson.wordFileUrl || '',
        fileType: lesson.fileType || '',
        documentFileName: lesson.documentFileName || '',
        documentFileUrl: lesson.documentFileUrl || '',
        documentFileType: lesson.documentFileType || '',
        codeLanguage: lesson.codeLanguage || 'javascript',
        codeContent: lesson.codeContent || '',
        documentContent: lesson.documentContent || lesson.richDocument || '',
      }))
    : []

  const subject = data.subject || data.category || data.teacherSubject || 'E-learning'

  return {
    id,
    sourceCollection,
    title: data.title || data.name || 'Bài E-learning chưa đặt tên',
    topic: data.topic || data.chapter || '',
    description: data.description || data.summary || data.content || '',
    subject,
    category: data.category || subject,
    teacherName:
      data.teacherName ||
      data.teacherDisplayName ||
      data.createdByName ||
      data.ownerName ||
      data.teacherEmail ||
      'Giáo viên',
    className: data.className || '',
    classNames: Array.isArray(data.classNames) ? data.classNames : [],
    allowedClasses: Array.isArray(data.allowedClasses) ? data.allowedClasses : [],
    visibility: data.visibility || (data.className ? 'private' : 'public'),
    openAt: data.openAt || data.openTime || data.availableAt || '',
    openAtMs: getAnyTime(data.openAtMs || data.openAt || data.openTime || data.availableAt),
    thumbnail: data.thumbnail || data.thumbnailUrl || data.imageUrl || DEFAULT_THUMBNAIL,
    attachMode: data.attachMode || 'youtube',
    youtubeUrl: data.youtubeUrl || data.videoUrl || '',
    fileName: data.fileName || data.wordFileName || '',
    fileUrl: data.fileUrl || data.wordFileUrl || '',
    fileType: data.fileType || '',
    documentFileName: data.documentFileName || '',
    documentFileUrl: data.documentFileUrl || '',
    documentFileType: data.documentFileType || '',
    codeLanguage: data.codeLanguage || 'javascript',
    codeContent: data.codeContent || '',
    documentContent: data.documentContent || data.richDocument || '',
    lessonList,
    lessonCount: lessonList.length || Number(data.lessonCount || 1),
    views: Number(data.views || 0),
    rating: getRatingAverage(data),
    progress: Number(data.progress || data.percent || data.completion || 0),
    courseCode: data.courseCode || data.eLearningCode || data.code || '',
  }
}

function getRatingAverage(data) {
  const ratingCount = Number(data.ratingCount || 0)
  const ratingTotal = Number(data.ratingTotal || 0)

  if (ratingCount > 0 && ratingTotal > 0) {
    return (ratingTotal / ratingCount).toFixed(1)
  }

  return Number(data.rating || 0).toFixed(1)
}

function getAnyTime(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value.seconds) return value.seconds * 1000

  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function isFutureOpen(value) {
  const time = getAnyTime(value)
  return Boolean(time && time > Date.now())
}

function formatFullDateTime(value) {
  const time = getAnyTime(value)
  if (!time) return 'Chưa đặt thời gian'

  return new Date(time).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function getYoutubeVideoId(url) {
  const value = String(url || '').trim()
  if (!value) return ''

  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/,
  ]

  for (const pattern of patterns) {
    const match = value.match(pattern)
    if (match?.[1]) return match[1]
  }

  try {
    const urlObject = new URL(value)
    return urlObject.searchParams.get('v') || ''
  } catch {
    return ''
  }
}

function isPdfFile(name, url) {
  return `${name || ''} ${url || ''}`.toLowerCase().includes('.pdf')
}

function getAttachModeLabel(mode) {
  if (mode === 'file') return 'Word/PDF'
  if (mode === 'code') return 'Code'
  if (mode === 'document') return 'Tài liệu'
  return 'YouTube'
}

export default ELearningDetail

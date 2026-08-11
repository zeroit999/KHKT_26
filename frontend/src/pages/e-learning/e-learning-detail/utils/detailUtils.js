import { useEffect, useState } from 'react'

export const defaultLearningChecklist = [
  { id: 'watch_video', label: 'Xem video' },
  { id: 'read_document', label: 'Đọc tài liệu' },
  { id: 'practice', label: 'Thực hành' },
  { id: 'quiz', label: 'Làm quiz' },
]

export function getCurrentCourseTeacherName(course, teacherProfile) {
  const currentName = getProfileDisplayName(teacherProfile)
  return currentName || course?.teacherName || course?.teacherEmail || 'Đang cập nhật'
}
export function getProfileDisplayName(profile) {
  return (
    profile?.fullName ||
    profile?.name ||
    profile?.displayName ||
    profile?.teacherName ||
    profile?.userName ||
    ''
  )
}
export function stripHtml(value) { return String(value || '').replace(/<[^>]*>/g, '') }
export function getInitials(value) { const clean = stripHtml(value).trim(); if (!clean) return 'Z'; return clean.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() }
export function getLocalDateKey(date = new Date()) {
  const safeDate = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(safeDate.getTime())) return ''

  const year = safeDate.getFullYear()
  const month = String(safeDate.getMonth() + 1).padStart(2, '0')
  const day = String(safeDate.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
export function formatFullDateTime(value) {
  const time = getOpenAtMs(value)
  if (!time) return 'Chưa có thời gian'
  return new Date(time).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
export function formatOpenAt(value) { if (!value) return '---'; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return date.toLocaleString('vi-VN') }
export function isPdfFile(name, url) { return `${name || ''} ${url || ''}`.toLowerCase().includes('.pdf') }
export function getRatingAverage(course) { if (course.ratingCount && course.ratingTotal) return (course.ratingTotal / course.ratingCount).toFixed(1); return Number(course.rating || 0).toFixed(1) }
export function getYoutubeEmbedUrl(url, options = {}) {
  const videoId = getYoutubeVideoId(url)
  if (!videoId) return ''

  const host = options.privacyEnhanced === false
    ? 'https://www.youtube.com'
    : 'https://www.youtube-nocookie.com'
  const params = new URLSearchParams({
    rel: '0',
    playsinline: '1',
    controls: '1',
    iv_load_policy: '3',
    cc_load_policy: '0',
    fs: '1',
    enablejsapi: '1',
  })

  return `${host}/embed/${videoId}?${params.toString()}`
}
export function normalizeYoutubeUrl(url) {
  const videoId = getYoutubeVideoId(url)
  return videoId ? `https://www.youtube.com/embed/${videoId}` : String(url || '').trim()
}
export function getYoutubeVideoId(url) {
  if (!url) return ''

  try {
    const parsedUrl = new URL(url)
    const hostname = parsedUrl.hostname.replace('www.', '')

    if (hostname.includes('youtu.be')) {
      return parsedUrl.pathname.replace('/', '').split('?')[0]
    }

    if (hostname.includes('youtube.com')) {
      const videoId = parsedUrl.searchParams.get('v')
      if (videoId) return videoId

      if (parsedUrl.pathname.includes('/embed/')) {
        return parsedUrl.pathname.split('/embed/')[1]?.split('/')[0] || ''
      }

      if (parsedUrl.pathname.includes('/shorts/')) {
        return parsedUrl.pathname.split('/shorts/')[1]?.split('/')[0] || ''
      }
    }

    return ''
  } catch {
    return ''
  }
}
export function loadYoutubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve()

  if (window.youtubeIframeApiPromise) return window.youtubeIframeApiPromise

  window.youtubeIframeApiPromise = new Promise((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady

    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousCallback === 'function') previousCallback()
      resolve()
    }

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      document.body.appendChild(script)
    }
  })

  return window.youtubeIframeApiPromise
}
export function formatSeconds(value) {
  const total = Math.max(0, Math.floor(Number(value || 0)))
  const minutes = Math.floor(total / 60)
  const seconds = String(total % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}
export function normalizeTextList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
  if (typeof value === 'string') return value.split('\n').map((item) => item.trim()).filter(Boolean)
  return []
}
export function normalizeChecklist(value) {
  const source = Array.isArray(value) && value.length ? value : defaultLearningChecklist
  return source
    .map((item, index) => ({ id: String(item?.id || `step_${index + 1}`).trim(), label: String(item?.label || item?.title || item?.id || '').trim() }))
    .filter((item) => item.id && item.label)
}
export function normalizeQuiz(value) {
  if (!Array.isArray(value)) return []

  const normalized = []

  value.forEach((item, sourceIndex) => {
    const type = String(item?.type || 'abcd').trim().toLowerCase()

    if (type === 'true_false') {
      const question = String(item?.question || `Câu đúng/sai ${sourceIndex + 1}`).trim()
      const statements = (Array.isArray(item?.trueFalseItems) ? item.trueFalseItems : [])
        .map((statement, statementIndex) => ({
          id: String(statement?.id || `statement_${statementIndex + 1}`),
          text: String(statement?.text || '').trim(),
          correct: statement?.correct !== false,
          explanation: String(statement?.explanation || '').trim(),
        }))
        .filter((statement) => statement.text)

      if (question && statements.length) {
        normalized.push({
          question,
          statements,
          explanation: String(item?.explanation || '').trim(),
          sourceType: 'true_false',
        })
      }
      return
    }

    if (type === 'passage') {
      const passage = String(item?.passage || '').trim()
      const passageQuestions = Array.isArray(item?.passageQuestions) ? item.passageQuestions : []
      passageQuestions.forEach((questionItem) => {
        const question = String(questionItem?.question || '').trim()
        const options = Array.from({ length: 4 }).map((_, index) => String(questionItem?.options?.[index] || '').trim())
        if (!question || !options.some(Boolean)) return
        normalized.push({
          question,
          options,
          correctAnswer: Math.max(0, Math.min(3, Number(questionItem?.correctAnswer || 0))),
          explanation: String(questionItem?.explanation || item?.explanation || '').trim(),
          passage,
          sourceType: 'passage',
        })
      })
      return
    }

    const question = String(item?.question || '').trim()
    const options = Array.from({ length: 4 }).map((_, index) => String(item?.options?.[index] || '').trim())
    if (!question || !options.some(Boolean)) return
    normalized.push({
      question,
      options,
      correctAnswer: Math.max(0, Math.min(3, Number(item?.correctAnswer || 0))),
      explanation: String(item?.explanation || '').trim(),
      sourceType: 'abcd',
    })
  })

  return normalized
}
export function markAllChecklistDone(value) {
  return normalizeChecklist(value).reduce((map, item) => ({ ...map, [item.id]: true }), {})
}
export function getDifficultyLabel(value) {
  if (value === 'easy') return 'Dễ'
  if (value === 'hard') return 'Khó'
  return 'Trung bình'
}
export function formatEstimatedMinutes(value) {
  const minutes = Number(value || 0)
  return minutes > 0 ? `${minutes} phút` : ''
}
export function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}
export function getCourseMinutes(duration) { if (!duration) return 0; const text = String(duration).toLowerCase(); const hourMatch = text.match(/(\d+)\s*h/); const minuteMatch = text.match(/(\d+)\s*m/); const hours = hourMatch ? Number(hourMatch[1]) : 0; const minutes = minuteMatch ? Number(minuteMatch[1]) : 0; if (hours || minutes) return hours * 60 + minutes; const numberOnly = Number(text.replace(/\D/g, '')); return Number.isFinite(numberOnly) ? numberOnly : 0 }
export function isTeacherRole(role) {
  const normalizedRole = String(role || '').trim().replace(/[\s_-]/g, '').toUpperCase()
  return ['TEACHER', 'ADMINDEV', 'ADMIN', 'GIAOVIEN', 'GIÁOVIÊN'].includes(normalizedRole)
}
export function canTrackLearningProgress(role) {
  return isStudentRole(role) || isTeacherRole(role)
}
export function getOpenAtMs(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value.seconds) return value.seconds * 1000
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}
export function isCourseLocked(course) {
  const openTime = getOpenAtMs(course?.openAtMs || course?.openAt)
  return Boolean(openTime && Date.now() < openTime)
}
export function getUserClassName(userData) {
  const rawClass =
    userData?.className ||
    userData?.class ||
    userData?.studentClass ||
    userData?.lopHoc ||
    userData?.lop ||
    userData?.classId ||
    ''

  if (Array.isArray(rawClass)) return String(rawClass[0] || '').trim()
  return String(rawClass || '').trim()
}
export function normalizeClassName(value) {
  return String(value || '').trim().toLowerCase()
}
export function canAccessCourseByClass() {
  // Lớp của bài học hiện là tiêu chí lọc trên trang chủ, không phải cổng chặn truy cập.
  return true
}
export function isStudentRole(role) {
  return String(role || '').trim().toUpperCase() === 'STUDENT'
}
export function useDarkMode() {
  const getIsDark = () => {
    if (typeof window === 'undefined') return false
    const root = document.documentElement
    const body = document.body
    const storedTheme = window.localStorage?.getItem('theme') || window.localStorage?.getItem('color-theme')
    return (
      root.classList.contains('dark') ||
      body.classList.contains('dark') ||
      root.dataset.theme === 'dark' ||
      body.dataset.theme === 'dark' ||
      storedTheme === 'dark'
    )
  }

  const [isDarkMode, setIsDarkMode] = useState(getIsDark)

  useEffect(() => {
    const update = () => setIsDarkMode(getIsDark())

    update()

    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    })
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    })

    window.addEventListener('storage', update)

    return () => {
      observer.disconnect()
      window.removeEventListener('storage', update)
    }
  }, [])

  return isDarkMode
}

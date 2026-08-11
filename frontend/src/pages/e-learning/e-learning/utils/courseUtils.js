import { useEffect, useState } from 'react'
import { subjectCodes, defaultLearningChecklist } from '../constants/courseConstants'

export function getVideoDuration(course) { if (Number(course.estimatedMinutes||0)>0) return `${Number(course.estimatedMinutes)} phút`; if(course.duration&&course.duration!=='---') return course.duration; const lessons=Number(course.lessonCount||normalizeLessons(course.lessons).length||1); return `${lessons} bài` }
export function formatViews(value) { const n=Number(value||0); if(n>=1_000_000)return `${(n/1_000_000).toFixed(n>=10_000_000?0:1)} Tr`; if(n>=1_000)return `${(n/1_000).toFixed(n>=10_000?0:1)} N`; return String(n) }
export function formatRelativeDate(value) { const time=getAnyTime(value); if(!time)return 'Chưa cập nhật'; const days=Math.max(0,Math.floor((Date.now()-time)/86400000)); if(days===0)return 'Hôm nay'; if(days===1)return 'Hôm qua'; if(days<30)return `${days} ngày trước`; const months=Math.floor(days/30); if(months<12)return `${months} tháng trước`; return `${Math.floor(months/12)} năm trước` }
export function getCurrentLocalDateTimeValue(date = new Date()) {
  const safeDate = date instanceof Date ? date : new Date(date)
  const pad = (value) => String(value).padStart(2, '0')
  return `${safeDate.getFullYear()}-${pad(safeDate.getMonth() + 1)}-${pad(safeDate.getDate())}T${pad(safeDate.getHours())}:${pad(safeDate.getMinutes())}`
}
export function getEmptyForm(defaultSubject = '') {
  return {
    title: '',
    topic: '',
    description: '',
    content: '',
    category: defaultSubject || 'Toán',
    thumbnail: '',
    thumbnailFileName: '',
    documentImageUrl: '',
    documentImageName: '',
    simulationMode: 'embed',
    simulationUrl: '',
    simulationHtml: '',
    simulationLanguage: 'html',
    simulationCode: '',
    simulationCodes: {},
    simulationInstructions: '',
    youtubeUrl: '',
    lumiUrl: '',
    wordFileName: '',
    wordFileUrl: '',
    richDocument: '',
    documentMode: '',
    documentFileType: '',
    learningObjectives: [],
    prerequisites: [],
    difficulty: 'medium',
    estimatedMinutes: 0,
    durationSeconds: 0,
    duration: '---',
    mp4FileName: '',
    mp4FileUrl: '',
    videoSourceType: '',
    videoSources: [],
    publishConfirmed: false,
    courseRandomCode: '',
    checklist: defaultLearningChecklist,
    quiz: [],
    teacherCode: '0000',
    courseCode: '',
    visibility: 'public',
    className: '',
    openAt: getCurrentLocalDateTimeValue(),
    attachMode: 'youtube',
    codeLanguage: 'javascript',
    codeContent: '',
    lessonTopics: [],
    lessons: [],
  }
}
export function getEmptyLesson(title = 'Bài 1') {
  return {
    title,
    content: '',
    attachMode: 'youtube',
    youtubeUrl: '',
    lumiUrl: '',
    mp4FileName: '',
    mp4FileUrl: '',
    wordFileName: '',
    wordFileUrl: '',
    fileExtractedText: '',
    codeLanguage: 'javascript',
    codeContent: '',
    richDocument: '',
    documentMode: 'type',
    documentFileType: '',
    durationSeconds: 0,
    duration: '---',
    videoSourceType: '',
    topicId: '',
  }
}
export function normalizeLessons(lessons) {
  if (!Array.isArray(lessons) || lessons.length === 0) return []
  return lessons.map((lesson, index) => ({ ...getEmptyLesson(`Bài ${index + 1}`), ...lesson }))
}
export function normalizeTextList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
  if (typeof value === 'string') return value.split('\n').map((item) => item.trim()).filter(Boolean)
  return []
}
export function normalizeChecklist(value) {
  if (!Array.isArray(value) || value.length === 0) return defaultLearningChecklist
  return value.map((item, index) => ({ id: item.id || `item_${index}`, label: item.label || String(item || '') })).filter((item) => item.label)
}
export function normalizeQuiz(value) {
  if (!Array.isArray(value)) return []
  return value
}
export function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

export function countWords(value) {
  const clean = stripHtml(value).replace(/\s+/g, ' ').trim()
  return clean ? clean.split(' ').length : 0
}
export function limitWords(value, maxWords) {
  const text = String(value || '')
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (!maxWords || words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ')
}
export function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean)))
}
export function resolveClassesFromUserData(userData = {}) {
  return uniqueValues([
    userData.className,
    userData.class,
    userData.lop,
    userData.teacherClass,
    ...(Array.isArray(userData.classes) ? userData.classes : []),
    ...(Array.isArray(userData.teacherClasses) ? userData.teacherClasses : []),
  ])
}
export function resolveClassesFromClassDocs(docs = [], user, userData = {}) {
  return uniqueValues(docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => {
    const teacherIds = [item.teacherId, item.createdByUid, item.ownerId].filter(Boolean).map(String)
    const teacherEmails = [item.teacherEmail, item.ownerEmail].filter(Boolean).map((email) => String(email).toLowerCase())
    return teacherIds.includes(String(user?.uid || '')) || teacherEmails.includes(String(user?.email || '').toLowerCase()) || resolveClassesFromUserData(userData).includes(item.name || item.className)
  }).map((item) => item.name || item.className || item.title))
}
export function getUserClassName(userData = {}) {
  return userData?.className || userData?.class || userData?.lop || userData?.studentClass || ''
}
export function canAccessCourseByClass() {
  // Quyền 'Dành cho lớp' chỉ dùng để phân loại thẻ theo bộ lọc lớp,
  // không còn khóa người học theo lớp lưu trong hồ sơ tài khoản.
  return true
}
export function getCourseCreatedTime(course) {
  return getAnyTime(course?.createdAt || course?.updatedAt || course?.openAt || course?.openAtMs)
}
export function getAnyTime(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (value?.toMillis) return value.toMillis()
  if (value?.seconds) return value.seconds * 1000
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}
export function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(getAnyTime(value) || value || Date.now())
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
export function formatDate(value) {
  const time = getAnyTime(value)
  if (!time) return 'Chưa có'
  return new Date(time).toLocaleDateString('vi-VN')
}
export function isCompletedCourse(course) {
  return Number(course?.progress || 0) >= 100
}
export function isCourseLocked(course) {
  const openAtMs = course?.openAtMs || getOpenAtMs(course?.openAt)
  return Boolean(openAtMs && Date.now() < openAtMs)
}
export function isHotCourse(course) {
  return Boolean(course?.isFeatured || Number(course?.views || 0) >= 100 || getRatingAverageNumber(course) >= 4.5)
}
export function getRatingAverageNumber(course) {
  if (Number(course?.ratingCount || 0) > 0 && Number(course?.ratingTotal || 0) > 0) return Number(course.ratingTotal) / Number(course.ratingCount)
  return Number(course?.rating || 0)
}
export function getRatingAverage(course) {
  const value = getRatingAverageNumber(course)
  return value ? value.toFixed(1) : '0.0'
}
export function getOpenAtMs(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}
export function normalizeDateTimeLocal(value) {
  if (!value) return ''
  const time = getAnyTime(value)
  if (!time) return String(value)
  const date = new Date(time)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}
export function getFirebaseTeacherName(profile, user) {
  return profile?.fullName || profile?.name || profile?.displayName || user?.displayName || user?.email || 'GiaoVien'
}
export function generateCourseCode(teacherName, subject, teacherCode = '0000') {
  const nameCode = String(teacherName || 'GV').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'GV'
  return `${nameCode}_${subjectCodes[subject] || 'EL'}_${teacherCode || '0000'}`
}
export function formatVideoDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds || 0)))
  if (!total) return '---'
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const remainSeconds = total % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainSeconds).padStart(2, '0')}`
    : `${minutes}:${String(remainSeconds).padStart(2, '0')}`
}
export function getYoutubeVideoId(url) {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace('www.', '')
    if (host === 'youtu.be') return parsed.pathname.replace('/', '').split('?')[0]
    if (host.includes('youtube.com')) {
      return parsed.searchParams.get('v') || parsed.pathname.split('/embed/')[1]?.split('/')[0] || parsed.pathname.split('/shorts/')[1]?.split('/')[0] || ''
    }
    return ''
  } catch { return '' }
}
export function normalizeYoutubeUrl(url) {
  const videoId = getYoutubeVideoId(url)
  return videoId ? `https://www.youtube.com/embed/${videoId}` : String(url || '').trim()
}
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
  })
  return `${host}/embed/${videoId}?${params.toString()}`
}
export function loadYoutubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (window.youtubeIframeApiPromise) return window.youtubeIframeApiPromise
  window.youtubeIframeApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous()
      resolve(window.YT)
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
export async function getYoutubeDurationSeconds(url) {
  const videoId = getYoutubeVideoId(url)
  if (!videoId) return 0
  await loadYoutubeIframeApi()
  return new Promise((resolve) => {
    const node = document.createElement('div')
    node.style.cssText = 'position:fixed;left:-99999px;width:1px;height:1px;'
    document.body.appendChild(node)
    let player
    const timer = window.setTimeout(() => { try { player?.destroy() } catch {} node.remove(); resolve(0) }, 12000)
    player = new window.YT.Player(node, {
      videoId,
      events: {
        onReady: (event) => {
          window.clearTimeout(timer)
          const value = Number(event.target.getDuration() || 0)
          try { player.destroy() } catch {}
          node.remove()
          resolve(Number.isFinite(value) ? value : 0)
        },
        onError: () => {
          window.clearTimeout(timer)
          try { player?.destroy() } catch {}
          node.remove()
          resolve(0)
        },
      },
    })
  })
}
export function getMp4DurationFromFile(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve(0)
      return
    }

    const objectUrl = URL.createObjectURL(file)
    const video = document.createElement('video')
    let settled = false

    const finish = (value = 0) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      video.onloadedmetadata = null
      video.onerror = null
      video.removeAttribute('src')
      try { video.load() } catch {}
      URL.revokeObjectURL(objectUrl)
      const duration = Number(value || 0)
      resolve(Number.isFinite(duration) && duration > 0 ? duration : 0)
    }

    const timeoutId = window.setTimeout(() => finish(0), 7000)
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.onloadedmetadata = () => finish(video.duration)
    video.onerror = () => finish(0)
    video.src = objectUrl
    try { video.load() } catch { finish(0) }
  })
}

export function getYoutubeDurationText(url, seconds = 0) {
  if (!url && !seconds) return '---'
  return formatVideoDuration(seconds) || 'Video'
}
export function generateLibraryCourseCode(name, subject, randomCode = '') {
  const raw = String(name || 'USER').trim()
  const words = raw.split(/\s+/).filter(Boolean)
  const nameCode = words.length > 1
    ? words.map((word) => word[0]).join('').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6)
    : raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6)
  const subjectCode = String(subject || 'EL').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || 'EL'
  const fourDigits = String(randomCode || Math.floor(1000 + Math.random() * 9000))
  return `${nameCode || 'USER'}_${subjectCode}_${fourDigits}_LBR`
}
export function getCourseTeacherName(course, profiles = {}) {
  const profile = profiles[course?.teacherId] || profiles[course?.createdByUid] || profiles[course?.createdBy]
  return profile?.fullName || profile?.name || profile?.displayName || course?.teacherName || course?.teacherEmail || 'Đang cập nhật'
}
export function getCourseFormat(course) {
  if (course?.contentType === 'simulation' || course?.attachMode === 'simulation' || course?.simulationUrl || course?.simulationHtml) return 'simulation'
  if (course?.attachMode === 'code' || course?.codeContent) return 'code'
  if (course?.youtubeUrl || course?.lumiUrl || course?.mp4FileUrl || ['youtube', 'lumi', 'mp4'].includes(course?.attachMode)) return 'video'
  if (course?.wordFileUrl || course?.richDocument || course?.attachMode === 'document') return 'document'
  return 'lesson'
}
export function getCourseFormatLabel(course) {
  const format = getCourseFormat(course)
  if (format === 'video') return 'Video'
  if (format === 'document') return 'Tài liệu'
  if (format === 'code') return 'Code'
  if (format === 'simulation') return 'Mô phỏng'
  return 'Bài học'
}
export function getCourseIcon(course) {
  const format = getCourseFormat(course)
  if (format === 'video') return '🎬'
  if (format === 'document') return '📄'
  if (format === 'code') return '💻'
  if (format === 'simulation') return '🧪'
  if (hasAnyText(course, ['quiz', 'cbt'])) return '🧠'
  return '📘'
}
export function hasAnyText(course, keywords) {
  const haystack = [course?.title, course?.topic, course?.description, course?.category, course?.wordFileName, course?.attachMode].map(stripHtml).join(' ').toLowerCase()
  return keywords.some((keyword) => haystack.includes(String(keyword).toLowerCase()))
}
export function formatDuration(seconds) {
  const value = Number(seconds || 0)
  if (value <= 0) return '0 phút'
  const minutes = Math.round(value / 60)
  if (minutes < 60) return `${minutes} phút`
  const hours = Math.floor(minutes / 60)
  const remain = minutes % 60
  return remain ? `${hours}h ${remain}p` : `${hours}h`
}
export function getInitials(name) {
  const clean = stripHtml(name)
  if (!clean) return 'Z'
  return clean.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}
export function arrayToText(value) {
  return Array.isArray(value) ? value.join('\n') : String(value || '')
}
export function textToArray(value) {
  return String(value || '').split('\n').map((item) => item.trim()).filter(Boolean)
}
export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === 'undefined') return false
    return document.documentElement.classList.contains('dark') || document.body.classList.contains('dark')
  })

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark') || document.body.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return isDark
}

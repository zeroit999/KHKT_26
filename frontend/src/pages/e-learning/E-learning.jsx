import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import eLearningApi from '../../services/eLearningApi.js'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { getUserAvatar } from '../../utils/userAvatar.js'
import { subjects, defaultLearningChecklist, difficultyOptions, sortOptions, courseTextLimits } from './e-learning/constants/courseConstants'
import { DesktopSidebar, MobileSidebar, VideoSection, VideoGrid, VideoCourseCard, VideoSkeleton, EmptyLibraryState, FilterModal, CourseFormModal, ConfirmModal, AchievementModal } from './e-learning/components/CourseComponents'
import { MenuIcon, SearchIcon, CloseIcon, FilterIcon, PlusIcon, PlayIcon } from './e-learning/icons/Icons'
import { getEmptyForm, resolveClassesFromUserData, resolveClassesFromClassDocs, uniqueValues, normalizeLessons, stripHtml, normalizeTextList, normalizeChecklist, normalizeQuiz, normalizeDateTimeLocal, getCourseCreatedTime, getUserClassName, canAccessCourseByClass, getAnyTime, toDateKey, isCompletedCourse, isCourseLocked, isHotCourse, getRatingAverageNumber, getCourseFormat, getInitials, useDarkMode, hasAnyText, getOpenAtMs, getMp4DurationFromFile, formatVideoDuration, generateLibraryCourseCode, getYoutubeVideoId, getCourseTeacherName, countWords } from './e-learning/utils/courseUtils'


const getCurrentUserId = (user) =>
  String(
    user?.id ||
    user?.uid ||
    user?.user_id ||
    '',
  )


const getTeacherNameFromProfile = (profile, user) =>
  profile?.fullName ||
  profile?.name ||
  profile?.displayName ||
  profile?.teacherName ||
  user?.displayName ||
  user?.email ||
  'GiaoVien'

const normalizeApiUser = (payload, fallback = null) => {
  const source =
    payload?.user ||
    payload?.profile ||
    payload?.data ||
    payload ||
    {}

  if (!source || typeof source !== 'object') return fallback

  return {
    ...source,
    id: String(source.id || source.uid || source.user_id || fallback?.id || fallback?.uid || ''),
    uid: String(source.uid || source.id || source.user_id || fallback?.uid || fallback?.id || ''),
    email: source.email || fallback?.email || '',
    displayName:
      source.displayName ||
      source.fullName ||
      source.name ||
      fallback?.displayName ||
      '',
    photoURL:
      source.photoURL ||
      source.avatar ||
      source.avatarUrl ||
      source.profileImage ||
      source.imageUrl ||
      fallback?.photoURL ||
      '',
  }
}

const normalizeUsers = (payload) =>
  Array.isArray(payload?.users)
    ? payload.users
    : []

const normalizeCoursesResponse = (payload) =>
  Array.isArray(payload?.courses)
    ? payload.courses
    : []

const normalizePlaylistsResponse = (payload) =>
  Array.isArray(payload?.playlists)
    ? payload.playlists
    : []

const normalizeSavedListsResponse = (payload) =>
  Array.isArray(payload?.lists)
    ? payload.lists
    : []

const normalizeReportsResponse = (payload) =>
  Array.isArray(payload?.reports)
    ? payload.reports
    : []

const normalizeNotificationsResponse = (payload) =>
  Array.isArray(payload?.notifications)
    ? payload.notifications
    : []


const libraryTree = [
  {
    id: 'documents',
    icon: '📖',
    title: 'Tài liệu',
    description: 'Lý thuyết, đề thi, đề cương, slide, sách và file Word/PDF.',
    children: ['Lý thuyết', 'Đề thi', 'Đề cương', 'Slide', 'Sách', 'File Word/PDF'],
  },
  {
    id: 'learning',
    icon: '🎓',
    title: 'Học tập',
    description: 'Khóa học, video, lộ trình, CBT và các bài đang học dở.',
    children: ['Khóa học', 'Video', 'Lộ trình', 'CBT', 'Tiếp tục học'],
  },
  {
    id: 'simulation',
    icon: '🧪',
    title: 'Mô phỏng',
    description: 'AI, STEM, thí nghiệm, visual và các bài thực hành tương tác.',
    children: ['AI', 'STEM', 'Thí nghiệm', 'Visual'],
  },
  {
    id: 'saved',
    icon: '⭐',
    title: 'Đã lưu',
    description: 'Các bài học và tài nguyên học sinh đã đánh dấu để xem lại.',
    children: [],
  },
]

const libraryCategories = [
  { id: 'theory', title: 'Lý thuyết', icon: '📘', matcher: (course) => hasAnyText(course, ['lý thuyết', 'ly thuyet', 'theory']) },
  { id: 'video', title: 'Video', icon: '🎬', matcher: (course) => Boolean(course.youtubeUrl || course.lumiUrl || course.mp4FileUrl || ['youtube','lumi','mp4'].includes(course.attachMode)) },
  { id: 'slide', title: 'Slide', icon: '🧾', matcher: (course) => hasAnyText(course, ['slide', 'powerpoint', 'ppt']) },
  { id: 'exam', title: 'Đề thi', icon: '📝', matcher: (course) => hasAnyText(course, ['đề thi', 'de thi', 'exam', 'kiểm tra']) },
  { id: 'cbt', title: 'CBT', icon: '🧠', matcher: (course) => hasAnyText(course, ['cbt', 'quiz']) || Array.isArray(course.quiz) && course.quiz.length > 0 },
  { id: 'pdf', title: 'PDF', icon: '📄', matcher: (course) => hasAnyText(course, ['pdf']) || String(course.wordFileName || '').toLowerCase().endsWith('.pdf') },
  { id: 'visual', title: 'Visual', icon: '✨', matcher: (course) => hasAnyText(course, ['visual', 'mô phỏng', 'mo phong', 'stem', 'ai']) },
  { id: 'book', title: 'Sách', icon: '📚', matcher: (course) => hasAnyText(course, ['sách', 'book', 'ebook']) },

]

function getCourseGrade(course = {}) {
  const candidates = [
    course.grade,
    course.gradeLevel,
    course.khoi,
    course.className,
    course.class,
    course.lop,
    ...(Array.isArray(course.classNames) ? course.classNames : []),
    ...(Array.isArray(course.allowedClasses) ? course.allowedClasses : []),
  ]

  for (const value of candidates) {
    const match = String(value || '').match(/(?:^|\D)(10|11|12)(?:\D|$)/)
    if (match) return match[1]
  }

  return ''
}


async function extractDocxHtml(file) {
  const lowerName = String(file?.name || '').toLowerCase()
  if (!lowerName.endsWith('.docx') || typeof DecompressionStream === 'undefined') return ''

  const buffer = await file.arrayBuffer()
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  let eocdOffset = -1
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      eocdOffset = index
      break
    }
  }
  if (eocdOffset < 0) return ''

  const centralOffset = view.getUint32(eocdOffset + 16, true)
  const totalEntries = view.getUint16(eocdOffset + 10, true)
  let cursor = centralOffset
  let entry = null
  const decoder = new TextDecoder()

  for (let index = 0; index < totalEntries && cursor + 46 <= bytes.length; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break
    const method = view.getUint16(cursor + 10, true)
    const compressedSize = view.getUint32(cursor + 20, true)
    const fileNameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)
    const fileName = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + fileNameLength))
    if (fileName === 'word/document.xml') {
      entry = { method, compressedSize, localOffset }
      break
    }
    cursor += 46 + fileNameLength + extraLength + commentLength
  }
  if (!entry || view.getUint32(entry.localOffset, true) !== 0x04034b50) return ''

  const localNameLength = view.getUint16(entry.localOffset + 26, true)
  const localExtraLength = view.getUint16(entry.localOffset + 28, true)
  const dataStart = entry.localOffset + 30 + localNameLength + localExtraLength
  const compressed = bytes.slice(dataStart, dataStart + entry.compressedSize)
  let xmlBytes = compressed

  if (entry.method === 8) {
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    xmlBytes = new Uint8Array(await new Response(stream).arrayBuffer())
  } else if (entry.method !== 0) {
    return ''
  }

  const xml = decoder.decode(xmlBytes)
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const paragraphs = Array.from(doc.getElementsByTagNameNS('*', 'p'))
    .map((paragraph) => Array.from(paragraph.getElementsByTagNameNS('*', 't')).map((node) => node.textContent || '').join(''))
    .map((text) => text.trim())
    .filter(Boolean)

  const escapeHtml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`).join('')
}

const learningQuotes = [
  { text: 'Học, học nữa, học mãi.', author: 'V. I. Lenin', origin: 'Nga' },
  { text: 'Đi một ngày đàng, học một sàng khôn.', author: 'Tục ngữ Việt Nam', origin: 'Việt Nam' },
  { text: 'Tri thức là sức mạnh.', author: 'Francis Bacon', origin: 'Anh' },
  { text: 'Giáo dục không phải là đổ đầy một chiếc bình, mà là thắp sáng một ngọn lửa.', author: 'William Butler Yeats', origin: 'Ireland' },
  { text: 'Rễ của giáo dục thì đắng, nhưng quả của nó thì ngọt.', author: 'Aristotle', origin: 'Hy Lạp' },
  { text: 'Mỗi ngày không học được điều gì mới là một ngày chưa trọn vẹn.', author: 'Danh ngôn học tập', origin: 'Thế giới' },
  { text: 'Người hỏi có thể ngốc trong một phút; người không hỏi sẽ ngốc cả đời.', author: 'Tục ngữ Trung Hoa', origin: 'Trung Quốc' },
  { text: 'Thành công là tổng của những nỗ lực nhỏ được lặp lại mỗi ngày.', author: 'Robert Collier', origin: 'Hoa Kỳ' },
  { text: 'Không có con đường tắt nào dẫn đến nơi đáng đến.', author: 'Beverly Sills', origin: 'Hoa Kỳ' },
  { text: 'Biết mình không biết chính là khởi đầu của trí tuệ.', author: 'Socrates', origin: 'Hy Lạp' },
  { text: 'Hãy sống như thể bạn sẽ chết ngày mai. Hãy học như thể bạn sẽ sống mãi mãi.', author: 'Mahatma Gandhi', origin: 'Ấn Độ' },
  { text: 'Một cuốn sách hay là người bạn không bao giờ quay lưng.', author: 'Danh ngôn', origin: 'Thế giới' },
]

function Courses() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const lessonsRef = useRef(null)
  const sortBoxRef = useRef(null)
  const createMenuRef = useRef(null)
  const classCreateRequestHandledRef = useRef(false)
  const [currentUser, setCurrentUser] = useState(user || null)
  const [role, setRole] = useState('STUDENT')
  const [teacherProfile, setTeacherProfile] = useState(null)
  const [teacherProfilesById, setTeacherProfilesById] = useState({})
  const [teacherSubject, setTeacherSubject] = useState('')
  const [teacherClasses, setTeacherClasses] = useState([])
  const [participatingClasses, setParticipatingClasses] = useState([])
  const [classCreatePreset, setClassCreatePreset] = useState(null)
  const [courses, setCourses] = useState([])
  const [learningProgress, setLearningProgress] = useState({})
  const [learningError, setLearningError] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  const [sortBy, setSortBy] = useState('newest')
  const [mainSort, setMainSort] = useState('all')
  const [subjectSort, setSubjectSort] = useState('All')
  const [otherSort, setOtherSort] = useState('all')
  const [showSubjectMenu, setShowSubjectMenu] = useState(false)
  const [showOtherMenu, setShowOtherMenu] = useState(false)
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [showClassMenu, setShowClassMenu] = useState(false)
  const [typeSort, setTypeSort] = useState('all')
  const [homeClassSort, setHomeClassSort] = useState('All')
  const [quoteIndex, setQuoteIndex] = useState(0)
  const [quoteVisible, setQuoteVisible] = useState(true)
  const [reports, setReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [showSortBox, setShowSortBox] = useState(false)
  const getLibrarySectionFromUrl = () => {
    if (typeof window === 'undefined') return 'home'
    return String(
      new URLSearchParams(window.location.search).get('section') || 'home',
    ).trim() || 'home'
  }

  const [activeLibrarySection, setActiveLibrarySection] = useState(
    getLibrarySectionFromUrl,
  )
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showCreateTypeMenu, setShowCreateTypeMenu] = useState(false)
  const [createContentType, setCreateContentType] = useState('video')
  const [editingCourse, setEditingCourse] = useState(null)
  const [showAchievement, setShowAchievement] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [achievement, setAchievement] = useState({ watchedLessons: 0, watchedDates: [] })
  const [form, setForm] = useState(getEmptyForm())
  const [uploadingWord, setUploadingWord] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [rightSubjectFilter, setRightSubjectFilter] = useState('All')
  const [rightFormatFilter, setRightFormatFilter] = useState('all')
  const [rightProgressFilter, setRightProgressFilter] = useState('all')
  const [rightClassFilter, setRightClassFilter] = useState('All')
  const [rightExamFilter, setRightExamFilter] = useState('all')
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [openCourseMenuId, setOpenCourseMenuId] = useState(null)
  const [copySuccessCourse, setCopySuccessCourse] = useState(null)
  const [submissionNotice, setSubmissionNotice] = useState(false)
  const [reportTarget, setReportTarget] = useState(null)
  const [reportNotice, setReportNotice] = useState(null)
  const [adminTab, setAdminTab] = useState('posts')
  const [adminReports, setAdminReports] = useState([])
  const [adminCommentReports, setAdminCommentReports] = useState([])
  const [adminLoading, setAdminLoading] = useState(false)
  const [rejectCourseTarget, setRejectCourseTarget] = useState(null)
  const [resolveReportTarget, setResolveReportTarget] = useState(null)
  const [deleteReportedCourseTarget, setDeleteReportedCourseTarget] = useState(null)
  const [adminUsers, setAdminUsers] = useState([])
  const [blockTarget, setBlockTarget] = useState(null)
  const [warningTarget, setWarningTarget] = useState(null)
  const [postingBlockNotice, setPostingBlockNotice] = useState(null)
  const [postingWarningNotice, setPostingWarningNotice] = useState(null)
  const [selectedChannel, setSelectedChannel] = useState(null)
  const [followingAccounts, setFollowingAccounts] = useState([])
  const [followerHistory, setFollowerHistory] = useState([])
  const [channelPlaylists, setChannelPlaylists] = useState([])
  const [myPlaylists, setMyPlaylists] = useState([])
  const [savedLists, setSavedLists] = useState([])
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false)
  const [savedListModalOpen, setSavedListModalOpen] = useState(false)
  const [playlistPreview, setPlaylistPreview] = useState(null)
  const [savedListPreview, setSavedListPreview] = useState(null)
  const [channelReportTarget, setChannelReportTarget] = useState(null)
  const [savedSort, setSavedSort] = useState('posts')
  const [notifications, setNotifications] = useState([])
  const [notificationDismissalIds, setNotificationDismissalIds] = useState(() => new Set())
  const [deleteSuccessNotice, setDeleteSuccessNotice] = useState(null)
  const [saveCourseTarget, setSaveCourseTarget] = useState(null)
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(null)
  const [editingPlaylist, setEditingPlaylist] = useState(null)
  const [editingSavedList, setEditingSavedList] = useState(null)
  const [unsavingCourseId, setUnsavingCourseId] = useState('')
  const [shareSavedListTarget, setShareSavedListTarget] = useState(null)
  const [importSavedListOpen, setImportSavedListOpen] = useState(false)
  const [deleteSavedListTarget, setDeleteSavedListTarget] = useState(null)
  const [deletedSavedListNotice, setDeletedSavedListNotice] = useState(null)
  const isDarkMode = useDarkMode()
  const draftStorageKey = currentUser?.uid ? `zuny-elearning-draft:${currentUser.uid}:${createContentType}` : ''

  const normalizedRole = String(role || '')
    .trim()
    .replace(/[\s_-]/g, '')
    .toUpperCase()

  const isAdminDev = normalizedRole === 'ADMINDEV' || normalizedRole === 'ADMIN'
  const isTeacherOrAdmin = ['TEACHER', 'ADMINDEV', 'ADMIN', 'GIAOVIEN', 'GIÁOVIÊN'].includes(normalizedRole)

  const canCreateELearning = Boolean(currentUser) && (
    normalizedRole === 'TEACHER' ||
    normalizedRole === 'ADMINDEV'
  )

  const currentTeacherName =
    teacherProfile?.fullName ||
    teacherProfile?.name ||
    teacherProfile?.displayName ||
    currentUser?.displayName ||
    currentUser?.email ||
    'Đang cập nhật'

  const currentUserAvatar = getUserAvatar({
    ...(currentUser || {}),
    ...(teacherProfile || {}),
  })

  useEffect(() => {
    const warning = teacherProfile?.elearningPostingWarning
    if (warning?.active && !warning?.acknowledgedAt && !postingWarningNotice) {
      setPostingWarningNotice({ ...warning, requestedType: '' })
    }
  }, [teacherProfile?.elearningPostingWarning, postingWarningNotice])

  useEffect(() => {
    if (!showCreateForm || editingCourse || !draftStorageKey) return undefined
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(draftStorageKey, JSON.stringify({ form, contentType: createContentType, savedAt: Date.now(), expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 }))
      } catch (error) {
        console.warn('Không thể lưu bản nháp bài học:', error)
      }
    }, 500)
    return () => window.clearTimeout(timer)
  }, [form, createContentType, showCreateForm, editingCourse, draftStorageKey])

  useEffect(() => {
    if (!currentUser?.uid) return
    try {
      Object.keys(window.localStorage).filter((key) => key.startsWith(`zuny-elearning-draft:${currentUser.uid}:`)).forEach((key) => {
        const value = JSON.parse(window.localStorage.getItem(key) || '{}')
        if (!value.expiresAt || value.expiresAt < Date.now()) window.localStorage.removeItem(key)
      })
    } catch (error) {
      console.warn('Không thể dọn bản nháp hết hạn:', error)
    }
  }, [currentUser?.uid])

  useEffect(() => {
    let cancelled = false

    async function syncAuthenticatedUser() {
      setCurrentUser(user || null)

      if (!user) {
        setRole('STUDENT')
        setTeacherProfile(null)
        setTeacherProfilesById({})
        setTeacherSubject('')
        setTeacherClasses([])
        setParticipatingClasses([])
        setLearningProgress({})
        await fetchCourses()
        return
      }

      try {
        const [meResponse, classResponse] = await Promise.all([
          eLearningApi.me(),
          eLearningApi.classrooms().catch(() => ({ classes: [] })),
        ])

        if (cancelled) return

        const userData = normalizeApiUser(meResponse, user)
        const authenticatedUser = normalizeApiUser(userData, user)
        const uid = getCurrentUserId(authenticatedUser)

        setCurrentUser(authenticatedUser)

        const subject =
          userData?.subject ||
          userData?.teacherSubject ||
          userData?.mainSubject ||
          userData?.monHoc ||
          ''

        setRole(
          userData?.role ||
          userData?.Role ||
          userData?.accountType ||
          userData?.userRole ||
          userData?.type ||
          'STUDENT',
        )
        setTeacherProfile(userData)
        setTeacherSubject(subject)

        const classRows = Array.isArray(classResponse?.classes)
          ? classResponse.classes
          : []

        const userEmail = String(authenticatedUser?.email || '')
          .trim()
          .toLowerCase()

        const joinedClasses = classRows.filter((item) => {
          const memberIds = Array.isArray(item.memberIds)
            ? item.memberIds.map(String)
            : []

          const teacherIds = [
            item.teacherId,
            item.createdByUid,
            item.ownerId,
          ]
            .filter(Boolean)
            .map(String)

          const teacherEmails = [
            item.teacherEmail,
            item.ownerEmail,
          ]
            .filter(Boolean)
            .map((email) =>
              String(email).trim().toLowerCase(),
            )

          const className = String(
            item.name ||
            item.className ||
            item.title ||
            '',
          )

          const profileClass = String(
            getUserClassName(userData) || '',
          )

          return (
            memberIds.includes(uid) ||
            teacherIds.includes(uid) ||
            (userEmail && teacherEmails.includes(userEmail)) ||
            (profileClass &&
              className &&
              profileClass.toLowerCase() === className.toLowerCase())
          )
        })

        setParticipatingClasses(joinedClasses)

        const classesFromUser =
          resolveClassesFromUserData(userData)

        setTeacherClasses(
          uniqueValues([
            ...classesFromUser,
            ...joinedClasses.map(
              (item) =>
                item.name ||
                item.className ||
                item.title,
            ),
          ]),
        )

        if (subject && !cancelled) {
          setForm((prev) => ({
            ...prev,
            category: subject,
          }))
        }

        if (cancelled) return

        await fetchCourses()
        await fetchAchievement(uid)
        await fetchLearningProgress(uid)
        await fetchLearningReports(uid)
        await fetchFollowingAccounts(uid)
        await fetchMyPlaylists(uid)
      } catch (error) {
        console.error('Lỗi khi lấy dữ liệu user:', error)
        if (!cancelled) {
          await fetchCourses()
        }
      }
    }

    syncAuthenticatedUser()

    return () => {
      cancelled = true
    }
  }, [user])


  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncLibrarySectionFromUrl = () => {
      const params = new URLSearchParams(window.location.search)
      const requestedSection = String(params.get('section') || 'home').trim()

      setActiveLibrarySection(requestedSection || 'home')
    }

    window.addEventListener('popstate', syncLibrarySectionFromUrl)
    return () =>
      window.removeEventListener('popstate', syncLibrarySectionFromUrl)
  }, [])

  useEffect(() => {
    if (!currentUser?.uid || !canCreateELearning || classCreateRequestHandledRef.current || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('create') !== 'class') return
    const requestedClassId = String(params.get('classId') || '').trim()
    if (!requestedClassId) return
    const targetClass = participatingClasses.find((item) => String(item.id) === requestedClassId)
    if (!targetClass) return

    classCreateRequestHandledRef.current = true
    setClassCreatePreset({
      visibility: 'class',
      classId: targetClass.id,
      className: targetClass.name || targetClass.className || targetClass.title || '',
    })
    setShowCreateTypeMenu(true)

    params.delete('create')
    params.delete('classId')
    const nextQuery = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`)
  }, [canCreateELearning, currentUser?.uid, participatingClasses])

  useEffect(() => {
    if (!currentUser) return undefined

    const params = new URLSearchParams(window.location.search)
    const requestedSection = params.get('section')
    const targetUserId = String(params.get('user') || '').trim()

    if (!targetUserId) {
      if (requestedSection === 'account') setActiveLibrarySection('account')
      return undefined
    }

    let cancelled = false

    async function openRequestedPresenterChannel() {
      try {
        if (targetUserId === String(currentUser.uid)) {
          if (!cancelled) {
            setSelectedChannel(null)
            setActiveLibrarySection('account')
          }
          return
        }

        const usersResponse = await eLearningApi.users()
        if (cancelled) return

        const targetProfile = normalizeUsers(usersResponse).find(
          (item) =>
            String(item.id || item.uid || item.user_id || '') === targetUserId,
        ) || {}

        setSelectedChannel({
          id: targetUserId,
          profile: targetProfile,
        })
        setActiveLibrarySection('channel')
        setShowMobileSidebar(false)
        fetchChannelPlaylists(targetUserId)
      } catch (error) {
        console.warn('Không thể mở kênh trình bày từ liên kết:', error)
      }
    }

    openRequestedPresenterChannel()
    return () => { cancelled = true }
  }, [currentUser?.uid])

  useEffect(() => {
    let changeTimer = null
    const interval = window.setInterval(() => {
      setQuoteVisible(false)
      changeTimer = window.setTimeout(() => {
        setQuoteIndex((current) => (current + 1) % learningQuotes.length)
        setQuoteVisible(true)
      }, 450)
    }, 30000)

    return () => {
      window.clearInterval(interval)
      if (changeTimer) window.clearTimeout(changeTimer)
    }
  }, [])


  useEffect(() => {
    let cancelled = false

    async function refreshCourses() {
      try {
        const response = await eLearningApi.courses({ limit: 500 })
        const data = normalizeCoursesResponse(response)
          .sort((a, b) =>
            getCourseCreatedTime(b) -
            getCourseCreatedTime(a),
          )

        if (!cancelled) {
          setCourses(data)
          setLoading(false)
          fetchCourseTeacherProfiles(data)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Không thể đồng bộ courses:', error)
          setLoading(false)
        }
      }
    }

    refreshCourses()
    const timer = window.setInterval(refreshCourses, 60000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])


  useEffect(() => {
    if (!currentUser?.uid) {
      setFollowingAccounts([])
      return undefined
    }

    let cancelled = false
    async function refreshFollowing() {
      try {
        await fetchFollowingAccounts(
          getCurrentUserId(currentUser),
        )
      } catch (error) {
        if (!cancelled) {
          console.warn(
            'Không thể đồng bộ tài khoản đang theo dõi:',
            error,
          )
        }
      }
    }

    refreshFollowing()
    const timer = window.setInterval(refreshFollowing, 60000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [currentUser?.uid, courses])


  useEffect(() => {
    if (!currentUser?.uid) {
      setFollowerHistory([])
      return undefined
    }

    let cancelled = false

    async function refreshMainProfile() {
      try {
        const response = await eLearningApi.me()
        const userData = normalizeApiUser(response, currentUser)

        if (cancelled) return

        setTeacherProfile(userData)
        setRole(
          userData?.role ||
          userData?.Role ||
          userData?.accountType ||
          userData?.userRole ||
          userData?.type ||
          'STUDENT',
        )

        const history = Array.isArray(userData?.followerHistory)
          ? userData.followerHistory
          : []

        setFollowerHistory(
          [...history].sort(
            (a, b) =>
              getAnyTime(a.createdAt || a.occurredAt) -
              getAnyTime(b.createdAt || b.occurredAt),
          ),
        )
      } catch (error) {
        if (!cancelled) {
          console.warn(
            'Không thể đồng bộ tài khoản chính:',
            error,
          )
        }
      }
    }

    refreshMainProfile()
    const timer = window.setInterval(refreshMainProfile, 60000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [currentUser?.uid])


  useEffect(() => {
    if (!currentUser?.uid) {
      setNotifications([])
      setNotificationDismissalIds(new Set())
      return undefined
    }

    let cancelled = false

    async function refreshNotifications() {
      try {
        const response = await eLearningApi.notifications()

        if (cancelled) return

        const allItems = normalizeNotificationsResponse(response)
        const dismissed = new Set(
          allItems
            .filter((item) => Boolean(item.dismissed))
            .map((item) => String(item.id)),
        )

        setNotificationDismissalIds(dismissed)
        setNotifications(
          allItems
            .filter((item) => !item.dismissed)
            .sort(
              (a, b) =>
                getAnyTime(
                  b.createdAt ||
                  b.updatedAt ||
                  b.readAt,
                ) -
                getAnyTime(
                  a.createdAt ||
                  a.updatedAt ||
                  a.readAt,
                ),
            ),
        )
      } catch (error) {
        if (!cancelled) {
          console.warn(
            'Không thể đồng bộ thông báo E-learning:',
            error,
          )
        }
      }
    }

    refreshNotifications()
    const timer = window.setInterval(refreshNotifications, 30000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [currentUser?.uid])



  useEffect(() => {
    if (
      !currentUser?.uid ||
      !followingAccounts.length ||
      !courses.length
    ) {
      return undefined
    }

    let cancelled = false

    async function syncFollowedAccountNotifications() {
      const followedMap = new Map(
        followingAccounts.map(
          (account) => [
            String(account.id),
            account,
          ],
        ),
      )

      const eligibleCourses = courses.filter((course) => {
        const ownerId = String(
          course.teacherId ||
          course.createdByUid ||
          course.createdBy ||
          course.ownerId ||
          course.userId ||
          course.uid ||
          '',
        )

        const followedAccount =
          followedMap.get(ownerId)

        if (
          !followedAccount ||
          ownerId === getCurrentUserId(currentUser)
        ) {
          return false
        }

        const status = String(
          course.status ||
          course.moderationStatus ||
          'approved',
        ).toLowerCase()

        const visibility = String(
          course.visibility || 'public',
        ).toLowerCase()

        if (
          status !== 'approved' ||
          visibility === 'class'
        ) return false

        const courseTime =
          getCourseCreatedTime(course)

        const followedTime =
          getAnyTime(followedAccount.followedAt)

        return Boolean(
          courseTime &&
          (!followedTime ||
            courseTime >= followedTime),
        )
      })

      const existingLegacyIds = new Set(
        notifications.map(
          (item) =>
            String(
              item.legacyId ||
              item.data?.legacyId ||
              '',
            ),
        ),
      )

      try {
        await Promise.all(
          eligibleCourses.map(async (course) => {
            const ownerId = String(
              course.teacherId ||
              course.createdByUid ||
              course.createdBy ||
              course.ownerId ||
              course.userId ||
              course.uid ||
              '',
            )

            const followedAccount =
              followedMap.get(ownerId) || {}

            const ownerName =
              followedAccount.fullName ||
              followedAccount.name ||
              followedAccount.displayName ||
              followedAccount.email ||
              course.teacherName ||
              'Tài khoản bạn theo dõi'

            const notificationId =
              `follow_course_${course.id}`

            if (
              notificationDismissalIds.has(notificationId) ||
              existingLegacyIds.has(notificationId)
            ) {
              return
            }

            await eLearningApi.createNotification({
              legacyId: notificationId,
              userId: getCurrentUserId(currentUser),
              title: `${ownerName} vừa đăng bài mới`,
              message:
                `“${stripHtml(course.title) || 'Bài học mới'}” ` +
                'đã được đăng trong thư viện.',
              type: 'follow_course',
              data: {
                actorId: ownerId,
                actorName: ownerName,
                courseId: course.id,
                sourceCreatedAt:
                  course.createdAt ||
                  course.updatedAt ||
                  null,
              },
            })
          }),
        )
      } catch (error) {
        if (!cancelled) {
          console.warn(
            'Không thể tạo thông báo từ tài khoản đang theo dõi:',
            error,
          )
        }
      }
    }

    syncFollowedAccountNotifications()

    return () => {
      cancelled = true
    }
  }, [
    currentUser?.uid,
    followingAccounts,
    courses,
    notificationDismissalIds,
    notifications,
  ])


  useEffect(() => {
    if (!selectedChannel?.id) return undefined

    let cancelled = false

    async function refreshSelectedChannel() {
      try {
        const response = await eLearningApi.users()
        const profile = normalizeUsers(response).find(
          (item) =>
            String(
              item.id ||
              item.uid ||
              item.user_id ||
              '',
            ) === String(selectedChannel.id),
        )

        if (!cancelled && profile) {
          setSelectedChannel((current) =>
            current &&
            String(current.id) === String(selectedChannel.id)
              ? {
                  ...current,
                  profile,
                }
              : current,
          )
        }
      } catch (error) {
        if (!cancelled) {
          console.warn(
            'Không thể đồng bộ hồ sơ kênh:',
            error,
          )
        }
      }
    }

    refreshSelectedChannel()
    const timer =
      window.setInterval(
        refreshSelectedChannel,
        60000,
      )

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [selectedChannel?.id])


  useEffect(() => {
    let cancelled = false

    async function refreshPlaylists() {
      try {
        const response = await eLearningApi.playlists()
        const items = normalizePlaylistsResponse(response)

        if (cancelled) return

        if (currentUser?.uid) {
          setMyPlaylists(
            items
              .filter(
                (item) =>
                  String(item.ownerId || '') ===
                  getCurrentUserId(currentUser),
              )
              .sort(
                (a, b) =>
                  getAnyTime(
                    b.updatedAt ||
                    b.createdAt,
                  ) -
                  getAnyTime(
                    a.updatedAt ||
                    a.createdAt,
                  ),
              ),
          )
        } else {
          setMyPlaylists([])
        }

        if (selectedChannel?.id) {
          setChannelPlaylists(
            items
              .filter(
                (item) =>
                  String(item.ownerId || '') ===
                    String(selectedChannel.id) &&
                  !['private', 'class'].includes(
                    String(
                      item.visibility ||
                      item.data?.visibility ||
                      'public',
                    ).toLowerCase(),
                  ),
              )
              .sort(
                (a, b) =>
                  getAnyTime(
                    b.updatedAt ||
                    b.createdAt,
                  ) -
                  getAnyTime(
                    a.updatedAt ||
                    a.createdAt,
                  ),
              ),
          )
        }
      } catch (error) {
        if (!cancelled) {
          console.warn(
            'Không thể đồng bộ playlist:',
            error,
          )
        }
      }
    }

    refreshPlaylists()
    const timer =
      window.setInterval(
        refreshPlaylists,
        60000,
      )

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [currentUser?.uid, selectedChannel?.id])


  useEffect(() => {
    if (!currentUser?.uid) {
      setSavedLists([])
      return undefined
    }

    let cancelled = false

    async function refreshSavedLists() {
      try {
        const response =
          await eLearningApi.savedLists()

        if (cancelled) return

        const items =
          normalizeSavedListsResponse(response)
            .filter(
              (item) =>
                String(item.ownerId || '') ===
                getCurrentUserId(currentUser),
            )
            .map((item) => ({
              ...item,
              sharedSaveCount:
                Number(
                  item.sharedSaveCount ||
                  item.data?.sharedSaveCount ||
                  0,
                ),
            }))
            .sort(
              (a, b) =>
                getAnyTime(
                  b.updatedAt ||
                  b.createdAt,
                ) -
                getAnyTime(
                  a.updatedAt ||
                  a.createdAt,
                ),
            )

        setSavedLists(items)
      } catch (error) {
        if (!cancelled) {
          console.warn(
            'Không thể đồng bộ danh sách lưu:',
            error,
          )
        }
      }
    }

    refreshSavedLists()
    const timer =
      window.setInterval(
        refreshSavedLists,
        60000,
      )

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [currentUser?.uid])



  useEffect(() => {
    function handleClickOutside(event) {
      const clickedInsideSortPortal = event.target instanceof Element && event.target.closest('[data-sort-menu-portal]')
      if (sortBoxRef.current && !sortBoxRef.current.contains(event.target) && !clickedInsideSortPortal) {
        setShowSortBox(false)
        setShowSubjectMenu(false)
        setShowOtherMenu(false)
        setShowTypeMenu(false)
        setShowClassMenu(false)
      }
      const clickedInsideCreateTypePortal = event.target instanceof Element && event.target.closest('[data-create-type-portal]')
      if (createMenuRef.current && !createMenuRef.current.contains(event.target) && !clickedInsideCreateTypePortal) {
        setShowCreateTypeMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchCourses() {
    try {
      setLoading(true)

      const response =
        await eLearningApi.courses({
          limit: 500,
        })

      const data =
        normalizeCoursesResponse(response)

      const sortedData =
        data.sort(
          (a, b) =>
            getCourseCreatedTime(b) -
            getCourseCreatedTime(a),
        )

      setCourses(sortedData)

      await fetchCourseTeacherProfiles(
        sortedData,
      )
    } catch (error) {
      console.error(
        'Lỗi khi lấy dữ liệu courses:',
        error,
      )
    } finally {
      setLoading(false)
    }
  }


  async function fetchCourseTeacherProfiles(courseList) {
    try {
      const response = await eLearningApi.users()
      const users = normalizeUsers(response)
      const byId = new Map(
        users.map((item) => [
          String(
            item.id ||
            item.uid ||
            item.user_id ||
            '',
          ),
          item,
        ]),
      )

      const teacherIds = uniqueValues(
        courseList.flatMap((course) => [
          course.teacherId,
          course.createdByUid,
          course.createdBy,
          course.ownerId,
          course.userId,
          course.uid,
        ]),
      )

      const nextProfiles = {}

      teacherIds.forEach((teacherId) => {
        const profile =
          byId.get(String(teacherId))

        if (profile) {
          nextProfiles[String(teacherId)] =
            profile
        }
      })

      setTeacherProfilesById(nextProfiles)
    } catch (error) {
      console.warn(
        'Không thể tải danh sách tên giáo viên hiện tại:',
        error,
      )
      setTeacherProfilesById({})
    }
  }


  async function fetchAchievement(uid) {
    try {
      const courseResponse =
        await eLearningApi.courses({
          limit: 500,
        })

      const courseRows =
        normalizeCoursesResponse(
          courseResponse,
        )

      const progressEntries =
        await Promise.all(
          courseRows.map(
            async (course) => {
              try {
                const response =
                  await eLearningApi.progress(
                    course.id,
                  )

                return [
                  String(course.id),
                  response?.progress || null,
                ]
              } catch {
                return [
                  String(course.id),
                  null,
                ]
              }
            },
          ),
        )

      const watchedCourseIds = []
      const watchedDateSet = new Set()

      progressEntries.forEach(
        ([courseId, data]) => {
          if (!data) return

          const hasProgress =
            Number(data.progress || 0) > 0 ||
            Number(data.watchedSeconds || 0) > 0 ||
            Boolean(data.lastViewedAt)

          if (hasProgress) {
            watchedCourseIds.push(courseId)
          }

          const watchedDate =
            data.watchedDate ||
            toDateKey(
              data.lastViewedAt ||
              data.lastWatchedAt ||
              data.updatedAt ||
              data.createdAt,
            )

          if (watchedDate) {
            watchedDateSet.add(
              watchedDate,
            )
          }
        },
      )

      const watchedDates =
        Array.from(
          watchedDateSet,
        ).sort()

      setAchievement({
        watchedLessons:
          new Set(
            watchedCourseIds,
          ).size,
        watchedDates,
      })
    } catch (error) {
      console.error(
        'Lỗi khi lấy thành tích:',
        error,
      )

      setAchievement({
        watchedLessons: 0,
        watchedDates: [],
      })
    }
  }


  async function fetchLearningProgress(uid) {
    try {
      const courseResponse =
        await eLearningApi.courses({
          limit: 500,
        })

      const courseRows =
        normalizeCoursesResponse(
          courseResponse,
        )

      const entries =
        await Promise.all(
          courseRows.map(
            async (course) => {
              try {
                const response =
                  await eLearningApi.progress(
                    course.id,
                  )

                return [
                  String(course.id),
                  response?.progress || {},
                ]
              } catch {
                return [
                  String(course.id),
                  {},
                ]
              }
            },
          ),
        )

      const progressMap = {}

      entries.forEach(
        ([courseId, data]) => {
          progressMap[courseId] = {
            progress:
              Number(
                data.progress ||
                data.percent ||
                data.completion ||
                0,
              ),
            lastViewedAt:
              data.lastViewedAt ||
              data.lastWatchedAt ||
              data.updatedAt ||
              data.createdAt ||
              null,
            watchedSeconds:
              Number(
                data.watchedSeconds ||
                0,
              ),
            completedChecklist:
              data.completedChecklist ||
              {},
            bookmarked:
              Boolean(data.bookmarked),
            quizResult:
              data.quizResult ||
              null,
          }
        },
      )

      setLearningProgress(
        progressMap,
      )
      setLearningError('')
    } catch (error) {
      console.error(
        'Lỗi khi lấy tiến độ học:',
        error,
      )
      setLearningError(
        'Không thể tải tiến độ học tập.',
      )
      setLearningProgress({})
    }
  }


  async function fetchLearningReports(uid) {
    if (!uid) {
      setReports([])
      return
    }

    try {
      setReportsLoading(true)

      const response =
        await eLearningApi.reports()

      const items =
        normalizeReportsResponse(response)
          .filter(
            (item) =>
              String(
                item.reporterId ||
                item.userId ||
                '',
              ) === String(uid),
          )
          .sort(
            (a, b) =>
              getAnyTime(
                b.createdAt ||
                b.reportedAt ||
                b.updatedAt,
              ) -
                getAnyTime(
                  a.createdAt ||
                  a.reportedAt ||
                  a.updatedAt,
                ),
          )

      setReports(items)
    } catch (error) {
      console.warn(
        'Không thể tải lịch sử báo cáo E-learning:',
        error,
      )
      setReports([])
    } finally {
      setReportsLoading(false)
    }
  }



  async function fetchMyPlaylists(uid) {
    if (!uid) {
      setMyPlaylists([])
      return
    }

    try {
      const response =
        await eLearningApi.playlists()

      const items =
        normalizePlaylistsResponse(response)
          .filter(
            (item) =>
              String(item.ownerId || '') ===
              String(uid),
          )
          .sort(
            (a, b) =>
              getAnyTime(
                b.updatedAt ||
                b.createdAt,
              ) -
              getAnyTime(
                a.updatedAt ||
                a.createdAt,
              ),
          )

      setMyPlaylists(items)
    } catch (error) {
      console.warn(
        'Không thể tải danh sách phát:',
        error,
      )
      setMyPlaylists([])
    }
  }


  async function fetchChannelPlaylists(ownerId) {
    if (!ownerId) {
      setChannelPlaylists([])
      return
    }

    try {
      const response =
        await eLearningApi.playlists()

      const items =
        normalizePlaylistsResponse(response)
          .filter(
            (item) =>
              String(item.ownerId || '') ===
                String(ownerId) &&
              ![
                'private',
                'class',
              ].includes(
                String(
                  item.visibility ||
                  item.data?.visibility ||
                  'public',
                ).toLowerCase(),
              ),
          )
          .sort(
            (a, b) =>
              getAnyTime(
                b.updatedAt ||
                b.createdAt,
              ) -
              getAnyTime(
                a.updatedAt ||
                a.createdAt,
              ),
          )

      setChannelPlaylists(items)
    } catch (error) {
      console.warn(
        'Không thể tải playlist của kênh:',
        error,
      )
      setChannelPlaylists([])
    }
  }


  async function fetchFollowingAccounts(uid) {
    if (!uid) {
      setFollowingAccounts([])
      return
    }

    try {
      const [
        followResponse,
        usersResponse,
      ] = await Promise.all([
        eLearningApi.following(),
        eLearningApi.users(),
      ])

      const follows =
        Array.isArray(
          followResponse?.following,
        )
          ? followResponse.following
          : []

      const users =
        normalizeUsers(usersResponse)

      const usersById =
        new Map(
          users.map((item) => [
            String(
              item.id ||
              item.uid ||
              item.user_id ||
              '',
            ),
            item,
          ]),
        )

      const items =
        follows.map((follow) => {
          const targetId =
            String(
              follow.targetUserId ||
              follow.id ||
              '',
            )

          const profile =
            usersById.get(targetId) ||
            {}

          const lastOpened =
            getAnyTime(
              follow.lastOpenedAt ||
              follow.followedAt,
            )

          const unreadCount =
            courses.filter((course) => {
              const ownerIds = [
                course.teacherId,
                course.createdByUid,
                course.createdBy,
                course.ownerId,
                course.userId,
                course.uid,
              ]
                .filter(Boolean)
                .map(String)

              const status =
                String(
                  course.status ||
                  course.moderationStatus ||
                  'approved',
                ).toLowerCase()

              return (
                ownerIds.includes(
                  targetId,
                ) &&
                status === 'approved' &&
                getCourseCreatedTime(
                  course,
                ) > lastOpened
              )
            }).length

          return {
            id: targetId,
            ...profile,
            followedAt:
              follow.followedAt,
            lastOpenedAt:
              follow.lastOpenedAt,
            unreadCount,
          }
        })

      items.sort(
        (a, b) =>
          getAnyTime(b.followedAt) -
          getAnyTime(a.followedAt),
      )

      setFollowingAccounts(items)
    } catch (error) {
      console.warn(
        'Không thể tải tài khoản đang theo dõi:',
        error,
      )
      setFollowingAccounts([])
    }
  }


  function openPresenterChannel(ownerId, fallbackProfile = {}) {
    if (!ownerId) return
    if (String(ownerId) === String(currentUser?.uid || '')) {
      handleSidebarSelection('account')
      return
    }
    const profile = teacherProfilesById[ownerId] || followingAccounts.find((item) => String(item.id) === String(ownerId)) || fallbackProfile
    setSelectedChannel({ id: String(ownerId), profile })
    setActiveLibrarySection('channel')
    setShowMobileSidebar(false)
    fetchChannelPlaylists(ownerId)
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }))
  }

  async function openFollowingAccount(account) {
    if (
      !currentUser?.uid ||
      !account?.id
    ) {
      return
    }

    try {
      await eLearningApi.touchFollow(
        account.id,
      )

      setFollowingAccounts(
        (items) =>
          items.map((item) =>
            String(item.id) ===
            String(account.id)
              ? {
                  ...item,
                  unreadCount: 0,
                  lastOpenedAt:
                    new Date().toISOString(),
                }
              : item,
          ),
      )
    } catch (error) {
      console.warn(
        'Không thể cập nhật lần mở tài khoản theo dõi:',
        error,
      )
    }

    openPresenterChannel(
      account.id,
      account,
    )
  }


  async function toggleFollowChannel(targetUserId) {
    if (
      !currentUser?.uid ||
      !targetUserId ||
      getCurrentUserId(currentUser) ===
        String(targetUserId)
    ) {
      return
    }

    try {
      await eLearningApi.toggleFollow(
        targetUserId,
      )

      await fetchFollowingAccounts(
        getCurrentUserId(currentUser),
      )

      const usersResponse =
        await eLearningApi.users()

      const targetProfile =
        normalizeUsers(usersResponse).find(
          (item) =>
            String(
              item.id ||
              item.uid ||
              item.user_id ||
              '',
            ) === String(targetUserId),
        )

      if (targetProfile) {
        setSelectedChannel(
          (current) =>
            current &&
            String(current.id) ===
              String(targetUserId)
              ? {
                  ...current,
                  profile:
                    targetProfile,
                }
              : current,
        )
      }
    } catch (error) {
      console.error(
        'Không thể cập nhật theo dõi:',
        error,
      )

      alert(
        'Không thể cập nhật trạng thái theo dõi. Vui lòng thử lại.',
      )
    }
  }


  async function createPlaylist({
    title,
    description,
    courseIds,
    thumbnail = '',
    thumbnailFileName = '',
  }) {
    if (
      !currentUser?.uid ||
      !title.trim()
    ) {
      return
    }

    try {
      await eLearningApi.createPlaylist({
        title: title.trim(),
        description:
          description.trim(),
        thumbnail:
          String(
            thumbnail || '',
          ).trim(),
        thumbnailFileName:
          thumbnailFileName || '',
        courseIds:
          Array.from(
            new Set(
              courseIds || [],
            ),
          ),
        data: {
          ownerName:
            currentTeacherName,
          visibility:
            'public',
        },
      })

      setPlaylistModalOpen(false)

      await fetchMyPlaylists(
        getCurrentUserId(currentUser),
      )
    } catch (error) {
      console.error(
        'Không thể tạo danh sách phát:',
        error,
      )
      alert(
        'Không thể tạo danh sách phát. Vui lòng thử lại.',
      )
    }
  }


  async function createSavedList({
    title,
    description,
    courseIds,
    thumbnail = '',
    thumbnailFileName = '',
  }) {
    if (
      !currentUser?.uid ||
      !title.trim()
    ) {
      return
    }

    try {
      await eLearningApi.createSavedList({
        title: title.trim(),
        description:
          description.trim(),
        thumbnail:
          String(
            thumbnail || '',
          ).trim(),
        thumbnailFileName:
          thumbnailFileName || '',
        courseIds:
          Array.from(
            new Set(
              courseIds || [],
            ),
          ),
      })

      setSavedListModalOpen(false)

      const response =
        await eLearningApi.savedLists()

      setSavedLists(
        normalizeSavedListsResponse(
          response,
        ),
      )
    } catch (error) {
      console.error(
        'Không thể tạo danh sách lưu:',
        error,
      )
      alert(
        'Không thể tạo danh sách lưu. Vui lòng thử lại.',
      )
    }
  }


  async function updatePlaylist(
    playlistId,
    {
      title,
      description,
      courseIds,
      thumbnail = '',
      thumbnailFileName = '',
    },
  ) {
    if (
      !currentUser?.uid ||
      !playlistId ||
      !title.trim()
    ) {
      return
    }

    try {
      await eLearningApi.updatePlaylist(
        playlistId,
        {
          title:
            title.trim(),
          description:
            description.trim(),
          thumbnail:
            String(
              thumbnail || '',
            ).trim(),
          thumbnailFileName:
            thumbnailFileName || '',
          courseIds:
            Array.from(
              new Set(
                courseIds || [],
              ),
            ),
        },
      )

      setEditingPlaylist(null)
      setPlaylistPreview(null)

      await fetchMyPlaylists(
        getCurrentUserId(currentUser),
      )
    } catch (error) {
      console.error(
        'Không thể cập nhật danh sách phát:',
        error,
      )
      alert(
        'Không thể cập nhật danh sách phát. Vui lòng thử lại.',
      )
    }
  }


  async function updateSavedList(
    savedListId,
    {
      title,
      description,
      courseIds,
      thumbnail = '',
      thumbnailFileName = '',
    },
  ) {
    if (
      !currentUser?.uid ||
      !savedListId ||
      !title.trim()
    ) {
      return
    }

    try {
      const response =
        await eLearningApi.updateSavedList(
          savedListId,
          {
            title:
              title.trim(),
            description:
              description.trim(),
            thumbnail:
              String(
                thumbnail || '',
              ).trim(),
            thumbnailFileName:
              thumbnailFileName || '',
            courseIds:
              Array.from(
                new Set(
                  courseIds || [],
                ),
              ),
          },
        )

      const updated =
        response?.list

      if (updated) {
        setSavedLists(
          (current) =>
            current.map(
              (item) =>
                String(item.id) ===
                String(savedListId)
                  ? updated
                  : item,
            ),
        )
      }

      setEditingSavedList(null)
      setSavedListPreview(null)
    } catch (error) {
      console.error(
        'Không thể cập nhật danh sách lưu:',
        error,
      )
      alert(
        'Không thể cập nhật danh sách lưu. Vui lòng thử lại.',
      )
    }
  }


  async function unsaveCourse(course) {
    if (
      !currentUser?.uid ||
      !course?.id ||
      unsavingCourseId
    ) {
      return
    }

    try {
      setUnsavingCourseId(
        course.id,
      )

      await eLearningApi.updateProgress(
        course.id,
        {
          bookmarked: false,
          markViewed: true,
        },
      )

      const containingLists =
        savedLists.filter(
          (list) =>
            Array.isArray(
              list.courseIds,
            ) &&
            list.courseIds
              .map(String)
              .includes(
                String(course.id),
              ),
        )

      const updates =
        await Promise.all(
          containingLists.map(
            async (list) => {
              const nextCourseIds =
                list.courseIds
                  .map(String)
                  .filter(
                    (id) =>
                      id !==
                      String(course.id),
                  )

              const response =
                await eLearningApi.updateSavedList(
                  list.id,
                  {
                    courseIds:
                      nextCourseIds,
                  },
                )

              return (
                response?.list ||
                {
                  ...list,
                  courseIds:
                    nextCourseIds,
                }
              )
            },
          ),
        )

      if (updates.length) {
        const byId = new Map(
          updates.map((item) => [
            String(item.id),
            item,
          ]),
        )

        setSavedLists(
          (current) =>
            current.map(
              (item) =>
                byId.get(
                  String(item.id),
                ) || item,
            ),
        )
      }

      setLearningProgress(
        (current) => ({
          ...current,
          [course.id]: {
            ...(current[
              course.id
            ] || {}),
            bookmarked: false,
          },
        }),
      )

      setSaveSuccessNotice({
        courseTitle:
          stripHtml(
            course.title,
          ) || 'Bài học',
        destination:
          'removed',
      })
    } catch (error) {
      console.error(
        'Không thể hủy lưu bài học:',
        error,
      )
      alert(
        'Không thể hủy lưu bài học. Vui lòng thử lại.',
      )
    } finally {
      setUnsavingCourseId('')
    }
  }


  async function saveCourseToDestination(
    course,
    savedList = null,
  ) {
    if (
      !currentUser?.uid ||
      !course?.id
    ) {
      return
    }

    try {
      await eLearningApi.updateProgress(
        course.id,
        {
          bookmarked: true,
          markViewed: true,
        },
      )

      if (savedList?.id) {
        const nextCourseIds =
          Array.from(
            new Set([
              ...(Array.isArray(
                savedList.courseIds,
              )
                ? savedList.courseIds.map(
                    String,
                  )
                : []),
              String(course.id),
            ]),
          )

        const response =
          await eLearningApi.updateSavedList(
            savedList.id,
            {
              courseIds:
                nextCourseIds,
            },
          )

        const updated =
          response?.list ||
          {
            ...savedList,
            courseIds:
              nextCourseIds,
          }

        setSavedLists(
          (current) =>
            current.map(
              (item) =>
                String(item.id) ===
                String(savedList.id)
                  ? updated
                  : item,
            ),
        )
      }

      setLearningProgress(
        (current) => ({
          ...current,
          [course.id]: {
            ...(current[
              course.id
            ] || {}),
            bookmarked: true,
          },
        }),
      )

      setSaveCourseTarget(null)

      setSaveSuccessNotice({
        courseTitle:
          stripHtml(
            course.title,
          ) || 'Bài học',
        destination:
          savedList?.title ||
          'Đã lưu riêng',
      })
    } catch (error) {
      console.error(
        'Không thể lưu bài học:',
        error,
      )
      alert(
        'Không thể lưu bài học. Vui lòng thử lại.',
      )
    }
  }


  function getAvailablePlaylistCourseIds(playlist) {
    return (Array.isArray(playlist?.courseIds) ? playlist.courseIds : [])
      .map(String)
      .filter((id) => {
        const course = courses.find((item) => String(item.id) === id)
        const status = String(course?.status || course?.moderationStatus || 'approved').toLowerCase()
        return Boolean(course && status !== 'deleted')
      })
  }

  function playPlaylist(playlist) {
    const courseIds = getAvailablePlaylistCourseIds(playlist)
    if (!courseIds.length) {
      alert('Danh sách phát chưa có video khả dụng.')
      return
    }
    const params = new URLSearchParams({
      playlist: courseIds.join(','),
      playlistIndex: '0',
      autoplay: '1',
    })
    setPlaylistPreview(null)
    navigate(`/e-learning/${encodeURIComponent(courseIds[0])}?${params.toString()}`)
  }

  async function removeCourseFromPlaylist(
    playlist,
    courseId,
  ) {
    if (
      !playlist?.id ||
      !courseId ||
      String(
        playlist.ownerId ||
        '',
      ) !==
        getCurrentUserId(currentUser)
    ) {
      return
    }

    try {
      const nextCourseIds =
        (playlist.courseIds || [])
          .map(String)
          .filter(
            (id) =>
              id !==
              String(courseId),
          )

      const response =
        await eLearningApi.updatePlaylist(
          playlist.id,
          {
            title:
              playlist.title ||
              'Danh sách phát',
            description:
              playlist.description ||
              '',
            thumbnail:
              playlist.thumbnail ||
              '',
            thumbnailFileName:
              playlist.thumbnailFileName ||
              '',
            courseIds:
              nextCourseIds,
          },
        )

      const nextPlaylist =
        response?.playlist ||
        {
          ...playlist,
          courseIds:
            nextCourseIds,
        }

      setPlaylistPreview(
        nextPlaylist,
      )

      setMyPlaylists(
        (current) =>
          current.map(
            (item) =>
              String(item.id) ===
              String(playlist.id)
                ? nextPlaylist
                : item,
          ),
      )
    } catch (error) {
      console.error(
        'Không thể xóa bài khỏi danh sách phát:',
        error,
      )
      alert(
        'Không thể xóa bài khỏi danh sách phát. Vui lòng thử lại.',
      )
    }
  }


  function generateSavedListShareCode() {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const lower = 'abcdefghijkmnopqrstuvwxyz'
    const digits = '23456789'
    const alphabet = `${upper}${lower}${digits}`
    const chars = [
      upper[Math.floor(Math.random() * upper.length)],
      lower[Math.floor(Math.random() * lower.length)],
      digits[Math.floor(Math.random() * digits.length)],
    ]
    while (chars.length < 6) chars.push(alphabet[Math.floor(Math.random() * alphabet.length)])
    for (let index = chars.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1))
      ;[chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]]
    }
    return chars.join('')
  }

  async function ensureSavedListShareCode(list) {
    if (
      !list?.id ||
      String(
        list.ownerId ||
        '',
      ) !==
        getCurrentUserId(currentUser)
    ) {
      return ''
    }

    if (
      String(
        list.shareCode ||
        '',
      ).length === 6
    ) {
      return String(
        list.shareCode,
      )
    }

    try {
      const response =
        await eLearningApi.enableSavedListShare(
          list.id,
        )

      const updated =
        response?.list ||
        {
          ...list,
          shareCode:
            response?.shareCode ||
            '',
          shareEnabled: true,
        }

      setShareSavedListTarget(
        updated,
      )

      setSavedLists(
        (current) =>
          current.map(
            (item) =>
              String(item.id) ===
              String(list.id)
                ? updated
                : item,
          ),
      )

      return String(
        updated.shareCode ||
        response?.shareCode ||
        '',
      )
    } catch (error) {
      console.error(
        'Không thể tạo mã chia sẻ:',
        error,
      )
      alert(
        'Không thể tạo mã chia sẻ. Vui lòng thử lại.',
      )
      return ''
    }
  }


  async function importSavedListByCode(rawCode) {
    const code =
      String(
        rawCode || '',
      ).trim()

    if (
      !currentUser?.uid ||
      code.length !== 6
    ) {
      throw new Error(
        'Mã chia sẻ phải gồm đúng 6 ký tự.',
      )
    }

    await eLearningApi.importSavedList(
      code,
    )

    const response =
      await eLearningApi.savedLists()

    setSavedLists(
      normalizeSavedListsResponse(
        response,
      ),
    )

    setImportSavedListOpen(false)
  }


  function deleteSavedList(list) {
    if (!list?.id || String(list.ownerId || '') !== String(currentUser?.uid || '')) return
    setDeleteSavedListTarget(list)
  }

  async function confirmDeleteSavedList() {
    const list =
      deleteSavedListTarget

    if (
      !list?.id ||
      String(
        list.ownerId ||
        '',
      ) !==
        getCurrentUserId(currentUser)
    ) {
      return
    }

    try {
      await eLearningApi.deleteSavedList(
        list.id,
      )

      setSavedLists(
        (current) =>
          current.filter(
            (item) =>
              String(item.id) !==
              String(list.id),
          ),
      )

      if (
        String(
          savedListPreview?.id ||
          '',
        ) === String(list.id)
      ) {
        setSavedListPreview(null)
      }

      if (
        String(
          editingSavedList?.id ||
          '',
        ) === String(list.id)
      ) {
        setEditingSavedList(null)
      }

      if (
        String(
          shareSavedListTarget?.id ||
          '',
        ) === String(list.id)
      ) {
        setShareSavedListTarget(null)
      }

      setDeleteSavedListTarget(null)

      setDeletedSavedListNotice({
        title:
          list.title ||
          'Danh sách lưu',
      })
    } catch (error) {
      console.error(
        'Không thể xóa danh sách lưu:',
        error,
      )
      alert(
        'Không thể xóa danh sách lưu. Vui lòng thử lại.',
      )
    }
  }


  async function handleWordUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!currentUser || !canCreateELearning) {
      alert('Bạn cần đăng nhập để tải tài liệu lên.')
      return
    }
    try {
      setUploadingWord(true)
      const lowerName = String(file.name || '').toLowerCase()
      const maxDocumentBytes = 20 * 1024 * 1024
      if (file.size > maxDocumentBytes) {
        alert('Tài liệu vượt quá giới hạn 20 MB.')
        return
      }
      const isAllowedDocument = lowerName.endsWith('.pdf') || lowerName.endsWith('.doc') || lowerName.endsWith('.docx')
      if (!isAllowedDocument) {
        alert('Chỉ hỗ trợ file Word (.doc, .docx) hoặc PDF.')
        return
      }
      const extractedHtml = lowerName.endsWith('.docx')
        ? await extractDocxHtml(file).catch(() => '')
        : ''

      const uploadResult = await eLearningApi.uploadAsset(
        file,
        'course-file',
        'course-files',
      )

      const fileUrl =
        uploadResult?.url ||
        uploadResult?.publicUrl ||
        uploadResult?.fileUrl ||
        ''
      const documentFileType = lowerName.endsWith('.pdf') ? 'pdf' : lowerName.endsWith('.docx') ? 'docx' : 'doc'
      setForm((prev) => ({
        ...prev,
        documentMode: 'upload',
        documentFileType,
        wordFileName: file.name,
        wordFileUrl: fileUrl,
        documentFileSize: Number(file.size || 0),
        richDocument: extractedHtml || prev.richDocument || '',
      }))
    } catch (error) {
      console.error('Lỗi khi tải file Word/PDF:', error)
      alert('Không thể tải file. Vui lòng thử lại.')
    } finally {
      setUploadingWord(false)
    }
  }

  async function handleImageUpload(event, target = 'thumbnail') {
    const input = event?.target
    const file = input?.files?.[0]
    if (!file) return
    if (!currentUser || !canCreateELearning) {
      alert('Bạn cần đăng nhập để tải ảnh lên.')
      return
    }
    const extension = String(file.name || '').toLowerCase().split('.').pop()
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif']
    if (!allowedMime.includes(file.type) && !allowedExtensions.includes(extension)) {
      alert('Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Ảnh vượt quá giới hạn 5 MB.')
      return
    }
    try {
      setUploadingImage(true)
      const uploadResult = await eLearningApi.uploadAsset(
        file,
        'course-image',
        target === 'document'
          ? 'document-images'
          : 'course-images',
      )

      const imageUrl =
        uploadResult?.url ||
        uploadResult?.publicUrl ||
        uploadResult?.fileUrl ||
        ''
      setForm((prev) => target === 'document'
        ? { ...prev, documentMode: 'image', documentImageUrl: imageUrl, documentImageName: file.name, documentImageSize: Number(file.size || 0), wordFileName: '', wordFileUrl: '', documentFileSize: 0, richDocument: '' }
        : { ...prev, thumbnail: imageUrl, thumbnailFileName: file.name })
    } catch (error) {
      console.error('Lỗi khi tải ảnh:', error)
      alert(`Không thể tải ảnh${error?.message ? `: ${error.message}` : '.'}`)
    } finally {
      if (input) input.value = ''
      setUploadingImage(false)
    }
  }


  async function handleVideoUpload(event, lessonIndex = null) {
    const input = event?.target
    const file = input?.files?.[0]
    if (!file) return

    if (!currentUser || !canCreateELearning) {
      alert('Bạn cần đăng nhập để tải video lên.')
      return
    }

    const fileName = String(file.name || '')
    const isMp4 = file.type === 'video/mp4' || fileName.toLowerCase().endsWith('.mp4')
    if (!isMp4) {
      alert('Chỉ hỗ trợ file MP4.')
      return
    }

    const maxVideoBytes = 5 * 1024 * 1024
    if (file.size <= 0) {
      alert('File video không hợp lệ hoặc đang rỗng.')
      return
    }
    if (file.size > maxVideoBytes) {
      alert(`Video có dung lượng ${(file.size / 1024 / 1024).toFixed(2)} MB, vượt giới hạn 5 MB.`)
      return
    }

    try {
      setUploadingVideo(true)

      // Không để việc đọc metadata làm treo toàn bộ quá trình upload.
      const durationSeconds = await Promise.race([
        getMp4DurationFromFile(file),
        new Promise((resolve) => window.setTimeout(() => resolve(0), 8000)),
      ])

      const uploadResult = await eLearningApi.uploadAsset(
        file,
        'course-video',
        'course-videos',
      )

      const videoUrl =
        uploadResult?.url ||
        uploadResult?.publicUrl ||
        uploadResult?.fileUrl ||
        ''
      const duration = formatVideoDuration(durationSeconds)

      if (lessonIndex === null) {
        setForm((prev) => ({
          ...prev,
          videoSourceType: 'upload',
          attachMode: 'mp4',
          youtubeUrl: '',
          mp4FileName: fileName,
          mp4FileUrl: videoUrl,
          durationSeconds: Number(durationSeconds || 0),
          duration,
          estimatedMinutes: durationSeconds ? Math.ceil(durationSeconds / 60) : 0,
        }))
      } else {
        setForm((prev) => {
          const lessons = Array.isArray(prev.lessons) ? [...prev.lessons] : []
          lessons[lessonIndex] = {
            ...(lessons[lessonIndex] || {}),
            videoSourceType: 'upload',
            attachMode: 'mp4',
            youtubeUrl: '',
            mp4FileName: fileName,
            mp4FileUrl: videoUrl,
            durationSeconds: Number(durationSeconds || 0),
            duration,
          }
          return { ...prev, lessons }
        })
      }
    } catch (error) {
      console.error('Lỗi khi tải MP4:', error)
      const code = String(error?.code || '')
      if (code.includes('storage/unauthorized')) {
        alert('Hệ thống đang từ chối quyền tải video. Hãy kiểm tra lại thư mục course-videos/{uid}.')
      } else if (code.includes('storage/retry-limit-exceeded')) {
        alert('Kết nối tải video bị gián đoạn. Vui lòng kiểm tra mạng và thử lại.')
      } else {
        alert(`Không thể tải video lên hệ thống${error?.message ? `: ${error.message}` : '.'}`)
      }
    } finally {
      setUploadingVideo(false)
    }
  }

  async function handleCreateCourse(event) {
    event?.preventDefault?.()
    if (!stripHtml(form.title).trim() || !stripHtml(form.topic).trim()) {
      alert('Vui lòng nhập tên video bài học và chủ đề.')
      return
    }
    const titleWords = countWords(form.title)
    const topicWords = countWords(form.topic)
    const descriptionWords = countWords(form.description)
    if (titleWords > courseTextLimits.titleWords || topicWords > courseTextLimits.topicWords || descriptionWords > courseTextLimits.descriptionWords) {
      alert(`Giới hạn nội dung: tên bài tối đa ${courseTextLimits.titleWords} từ, chủ đề tối đa ${courseTextLimits.topicWords} từ và mô tả tối đa ${courseTextLimits.descriptionWords} từ.`)
      return
    }
    if (!currentUser || !canCreateELearning) {
      alert('Bạn cần đăng nhập để đăng bài e-learning.')
      return
    }
    if (form.visibility === 'private' && !form.className) {
      alert('Vui lòng chọn khối được xem bài học.')
      return
    }
    if (form.visibility === 'class' && !form.classId) {
      alert('Vui lòng chọn lớp được xem bài học.')
      return
    }
    if (createContentType === 'video' && !(Array.isArray(form.lessons) && form.lessons.some((lesson) => String(lesson.youtubeUrl || lesson.lumiUrl || lesson.mp4FileUrl || '').trim()))) {
      alert('Vui lòng thêm ít nhất một video trong tab Danh sách bài trước khi đăng.')
      return
    }
    try {
      const teacherName = getTeacherNameFromProfile(teacherProfile, currentUser)
      const lessons = Array.isArray(form.lessons) ? form.lessons : []
      const firstLesson = lessons[0] || {}
      const totalDurationSeconds = Number(firstLesson.durationSeconds || form.durationSeconds || 0)
      const youtubeDuration = firstLesson.duration || form.duration || formatVideoDuration(totalDurationSeconds)
      await eLearningApi.createCourse({
        title: form.title,
        topic: form.topic,
        description: form.description,
        content: form.content,
        category: form.category,
        thumbnail: form.thumbnail,
        thumbnailFileName: form.thumbnailFileName || '',
        documentImageUrl: form.documentImageUrl || '',
        documentImageName: form.documentImageName || '',
        documentImageSize: Number(form.documentImageSize || 0),
        documentFileSize: Number(form.documentFileSize || 0),
        contentType: createContentType,
        simulationMode: form.simulationMode || '',
        simulationUrl: form.simulationUrl || '',
        simulationHtml: form.simulationHtml || '',
        simulationLanguage: form.simulationLanguage || 'html',
        simulationCode: form.simulationCode || '',
        simulationCodes: form.simulationCodes || {},
        simulationInstructions: form.simulationInstructions || '',
        youtubeUrl: firstLesson.youtubeUrl || '',
        lumiUrl: firstLesson.lumiUrl || '',
        wordFileName: form.wordFileName,
        wordFileUrl: form.wordFileUrl,
        richDocument: form.richDocument,
        documentMode: form.documentMode || '',
        documentFileType: form.documentFileType || '',
        learningObjectives: normalizeTextList(form.learningObjectives),
        prerequisites: normalizeTextList(form.prerequisites),
        difficulty: form.difficulty || 'medium',
        estimatedMinutes: Number(form.estimatedMinutes || 0),
        checklist: normalizeChecklist(form.checklist),
        quiz: normalizeQuiz(form.quiz),
        teacherCode: '',
        courseCode: form.courseCode || generateLibraryCourseCode(teacherName, form.category, form.courseRandomCode),
        visibility: form.visibility,
        className: ['private', 'class'].includes(form.visibility) ? form.className : '',
        classId: form.visibility === 'class' ? form.classId || '' : '',
        openAt: form.openAt,
        openAtMs: getOpenAtMs(form.openAt),
        attachMode: firstLesson.attachMode || form.attachMode,
        codeLanguage: form.codeLanguage || 'javascript',
        codeContent: form.codeContent,
        lessonTopics: Array.isArray(form.lessonTopics) ? form.lessonTopics : [],
        lessons,
        lessonCount: lessons.length,
        mp4FileName: firstLesson.mp4FileName || '',
        mp4FileUrl: firstLesson.mp4FileUrl || '',
        videoSourceType: firstLesson.videoSourceType || '',
        durationSeconds: totalDurationSeconds,
        duration: youtubeDuration || '---',
        youtubeDuration,
        videoSources: Array.isArray(form.videoSources) ? form.videoSources : [],
        publishConfirmed: Boolean(form.publishConfirmed),
        teacherId: currentUser.uid,
        createdByUid: currentUser.uid,
        teacherEmail: currentUser.email || '',
        teacherName,
        teacherSubject: form.category,
        createdByRole: role,
        studentCount: 0,
        rating: 0,
        ratingTotal: 0,
        ratingCount: 0,
        views: 0,
        isFeatured: false,
        status: (isAdminDev || form.visibility === 'class') ? 'approved' : 'pending',
        moderationStatus: (isAdminDev || form.visibility === 'class') ? 'approved' : 'pending',
      })
      if (draftStorageKey) window.localStorage.removeItem(draftStorageKey)
      setForm(getEmptyForm(teacherSubject))
      setShowCreateForm(false)
      if (!isAdminDev) setSubmissionNotice(form.visibility === 'class' ? 'class' : 'review')
      await fetchCourses()
    } catch (error) {
      console.error('Lỗi khi tạo bài e-learning:', error)
      alert('Không thể tạo bài học. Vui lòng thử lại.')
    }
  }

  async function handleUpdateCourse(event) {
    event?.preventDefault?.()
    if (!stripHtml(form.title).trim() || !stripHtml(form.topic).trim()) {
      alert('Vui lòng nhập tên video bài học và chủ đề.')
      return
    }
    const titleWords = countWords(form.title)
    const topicWords = countWords(form.topic)
    const descriptionWords = countWords(form.description)
    if (titleWords > courseTextLimits.titleWords || topicWords > courseTextLimits.topicWords || descriptionWords > courseTextLimits.descriptionWords) {
      alert(`Giới hạn nội dung: tên bài tối đa ${courseTextLimits.titleWords} từ, chủ đề tối đa ${courseTextLimits.topicWords} từ và mô tả tối đa ${courseTextLimits.descriptionWords} từ.`)
      return
    }
    if (!canManageCourse(editingCourse)) {
      alert('Bạn chỉ có thể cập nhật bài học do chính bạn tạo.')
      return
    }
    if (form.visibility === 'private' && !form.className) {
      alert('Vui lòng chọn khối được xem bài học.')
      return
    }
    if (form.visibility === 'class' && !form.classId) {
      alert('Vui lòng chọn lớp được xem bài học.')
      return
    }
    if (createContentType === 'video' && !(Array.isArray(form.lessons) && form.lessons.some((lesson) => String(lesson.youtubeUrl || lesson.lumiUrl || lesson.mp4FileUrl || '').trim()))) {
      alert('Vui lòng thêm ít nhất một video trong tab Danh sách bài trước khi đăng.')
      return
    }
    try {
      const teacherName = getTeacherNameFromProfile(teacherProfile, currentUser) || editingCourse.teacherName || 'GiaoVien'
      const lessons = Array.isArray(form.lessons) ? form.lessons : []
      const firstLesson = lessons[0] || {}
      const totalDurationSeconds = Number(firstLesson.durationSeconds || form.durationSeconds || 0)
      const youtubeDuration = firstLesson.duration || form.duration || formatVideoDuration(totalDurationSeconds)
      await eLearningApi.updateCourse(editingCourse.id, {
        title: form.title,
        topic: form.topic,
        description: form.description,
        content: form.content,
        category: form.category,
        thumbnail: form.thumbnail,
        thumbnailFileName: form.thumbnailFileName || '',
        documentImageUrl: form.documentImageUrl || '',
        documentImageName: form.documentImageName || '',
        documentImageSize: Number(form.documentImageSize || 0),
        documentFileSize: Number(form.documentFileSize || 0),
        contentType: createContentType,
        simulationMode: form.simulationMode || '',
        simulationUrl: form.simulationUrl || '',
        simulationHtml: form.simulationHtml || '',
        simulationLanguage: form.simulationLanguage || 'html',
        simulationCode: form.simulationCode || '',
        simulationCodes: form.simulationCodes || {},
        simulationInstructions: form.simulationInstructions || '',
        youtubeUrl: firstLesson.youtubeUrl || '',
        lumiUrl: firstLesson.lumiUrl || '',
        wordFileName: form.wordFileName,
        wordFileUrl: form.wordFileUrl,
        richDocument: form.richDocument,
        documentMode: form.documentMode || '',
        documentFileType: form.documentFileType || '',
        learningObjectives: normalizeTextList(form.learningObjectives),
        prerequisites: normalizeTextList(form.prerequisites),
        difficulty: form.difficulty || 'medium',
        estimatedMinutes: Number(form.estimatedMinutes || 0),
        checklist: normalizeChecklist(form.checklist),
        quiz: normalizeQuiz(form.quiz),
        teacherCode: '',
        courseCode: form.courseCode || generateLibraryCourseCode(teacherName, form.category, form.courseRandomCode),
        visibility: form.visibility,
        className: ['private', 'class'].includes(form.visibility) ? form.className : '',
        classId: form.visibility === 'class' ? form.classId || '' : '',
        openAt: form.openAt,
        openAtMs: getOpenAtMs(form.openAt),
        attachMode: firstLesson.attachMode || form.attachMode,
        codeLanguage: form.codeLanguage || 'javascript',
        codeContent: form.codeContent,
        lessonTopics: Array.isArray(form.lessonTopics) ? form.lessonTopics : [],
        lessons,
        lessonCount: lessons.length,
        mp4FileName: firstLesson.mp4FileName || '',
        mp4FileUrl: firstLesson.mp4FileUrl || '',
        videoSourceType: firstLesson.videoSourceType || '',
        durationSeconds: totalDurationSeconds,
        duration: youtubeDuration || '---',
        youtubeDuration,
        videoSources: Array.isArray(form.videoSources) ? form.videoSources : [],
        publishConfirmed: Boolean(form.publishConfirmed),
        teacherName,
        teacherEmail: currentUser.email || editingCourse.teacherEmail || '',
        teacherSubject: form.category,
        status: (isAdminDev || form.visibility === 'class') ? 'approved' : 'pending',
        moderationStatus: (isAdminDev || form.visibility === 'class') ? 'approved' : 'pending',
      })
      setForm(getEmptyForm(teacherSubject))
      setEditingCourse(null)
      setShowCreateForm(false)
      if (!isAdminDev) setSubmissionNotice(form.visibility === 'class' ? 'class' : 'review')
      await fetchCourses()
    } catch (error) {
      console.error('Lỗi khi cập nhật bài e-learning:', error)
      alert('Không thể cập nhật bài học. Vui lòng thử lại.')
    }
  }

  function handleDeleteCourse(course) {
    if (!canManageCourse(course)) {
      alert('Bạn chỉ có thể xóa bài học do chính bạn tạo.')
      return
    }
    setDeleteTarget(course)
  }

  async function permanentlyDeleteCourse(courseId) {
    const normalizedCourseId =
      String(
        courseId || '',
      ).trim()

    if (!normalizedCourseId) return

    await eLearningApi.deleteCourse(
      normalizedCourseId,
    )

    setCourses(
      (current) =>
        current.filter(
          (item) =>
            String(item.id) !==
            normalizedCourseId,
        ),
    )

    setMyPlaylists(
      (current) =>
        current.map((item) => ({
          ...item,
          courseIds:
            Array.isArray(
              item.courseIds,
            )
              ? item.courseIds.filter(
                  (id) =>
                    String(id) !==
                    normalizedCourseId,
                )
              : [],
        })),
    )

    setSavedLists(
      (current) =>
        current.map((item) => ({
          ...item,
          courseIds:
            Array.isArray(
              item.courseIds,
            )
              ? item.courseIds.filter(
                  (id) =>
                    String(id) !==
                    normalizedCourseId,
                )
              : [],
        })),
    )
  }


  async function confirmDeleteCourse() {
    if (!deleteTarget) return
    try {
      const deletedCourse = deleteTarget
      const deletedTitle = stripHtml(deletedCourse.title) || 'Bài học'
      const courseOwnerId = String(deletedCourse.teacherId || deletedCourse.createdByUid || deletedCourse.createdBy || deletedCourse.ownerId || deletedCourse.userId || deletedCourse.uid || '')

      await permanentlyDeleteCourse(deletedCourse.id)

      if (courseOwnerId) {
        await pushNotification(courseOwnerId, {
          notificationId: `course_deleted_${deletedCourse.id}`,
          type: 'course_deleted',
          courseId: '',
          actorId: currentUser?.uid || '',
          title: 'Bài học đã bị xóa vĩnh viễn',
          message: String(courseOwnerId) === String(currentUser?.uid || '')
            ? `Bạn đã xóa vĩnh viễn bài học “${deletedTitle}”.`
            : `Bài học “${deletedTitle}” của bạn đã bị quản trị viên xóa vĩnh viễn.`,
        })
      }
      setDeleteTarget(null)
      setDeleteSuccessNotice({ title: deletedTitle })
    } catch (error) {
      console.error('Lỗi khi xóa vĩnh viễn bài học:', error)
      alert('Không thể xóa vĩnh viễn bài học. Vui lòng thử lại.')
    }
  }

  function getActivePostingBlock(profile = teacherProfile) {
    const block = profile?.elearningPostingBlock || null
    if (!block?.active) return null
    const endMs = getAnyTime(block.endAt)
    if (endMs && Date.now() > endMs) {
      if (currentUser?.uid) {
        eLearningApi.updateUser(
          getCurrentUserId(currentUser),
          {
            elearningPostingBlock: {
              ...(block || {}),
              active: false,
              unblockedAt: new Date().toISOString(),
            },
          },
        ).catch(() => {})
      }
      return null
    }
    return block
  }

  function requestCreateModal(contentType = 'video', preset = null) {
    const resolvedPreset = preset || classCreatePreset
    if (classCreatePreset) setClassCreatePreset(null)
    const block = getActivePostingBlock()
    if (block) {
      setPostingBlockNotice(block)
      setShowCreateTypeMenu(false)
      return
    }
    const warning = teacherProfile?.elearningPostingWarning
    if (warning?.active && !warning?.acknowledgedAt) {
      setPostingWarningNotice({ ...warning, requestedType: contentType, requestedPreset: resolvedPreset })
      setShowCreateTypeMenu(false)
      return
    }
    openCreateModal(contentType, resolvedPreset)
  }

  function resetCreateCourseForm() {
    const nextForm = getEmptyForm(teacherSubject)
    const randomCode = String(Math.floor(1000 + Math.random() * 9000))
    nextForm.attachMode = createContentType === 'document' ? 'document' : createContentType === 'simulation' ? 'simulation' : 'youtube'
    nextForm.lessons = []
    nextForm.courseRandomCode = randomCode
    nextForm.courseCode = generateLibraryCourseCode(currentTeacherName, nextForm.category, randomCode)
    setForm(nextForm)
    if (draftStorageKey) {
      try { window.localStorage.removeItem(draftStorageKey) } catch (error) { console.warn('Không thể xóa bản nháp khi đặt lại:', error) }
    }
  }

  function openCreateModal(contentType = 'video', preset = null) {
    const nextType = ['document', 'simulation'].includes(contentType) ? contentType : 'video'
    const nextForm = getEmptyForm(teacherSubject)
    const randomCode = String(Math.floor(1000 + Math.random() * 9000))
    nextForm.attachMode = nextType === 'document' ? 'document' : nextType === 'simulation' ? 'simulation' : 'youtube'
    nextForm.lessons = []
    nextForm.courseRandomCode = randomCode
    nextForm.courseCode = generateLibraryCourseCode(currentTeacherName, nextForm.category, randomCode)
    setCreateContentType(nextType)
    setShowCreateTypeMenu(false)
    setEditingCourse(null)
    let restoredForm = nextForm
    try {
      const key = `zuny-elearning-draft:${currentUser?.uid || 'guest'}:${nextType}`
      const draft = JSON.parse(window.localStorage.getItem(key) || '{}')
      if (draft?.form && draft?.expiresAt > Date.now()) restoredForm = { ...nextForm, ...draft.form }
      else if (draft?.expiresAt && draft.expiresAt <= Date.now()) window.localStorage.removeItem(key)
    } catch (error) {
      console.warn('Không thể khôi phục bản nháp:', error)
    }
    if (preset?.visibility === 'class' && preset?.classId) {
      restoredForm = {
        ...restoredForm,
        visibility: 'class',
        classId: String(preset.classId),
        className: preset.className || '',
      }
    }
    setForm(restoredForm)
    setShowCreateForm(true)
  }

  function canManageCourse(course) {
    if (!canCreateELearning || !currentUser?.uid || !course?.id) return false
    if (isAdminDev) return true
    const ownerIds = [course.teacherId, course.createdByUid, course.createdBy, course.ownerId, course.userId, course.uid].filter(Boolean).map(String)
    const ownerEmails = [course.teacherEmail, course.createdByEmail, course.ownerEmail].filter(Boolean).map((email) => String(email).toLowerCase())
    return ownerIds.includes(String(currentUser.uid)) || ownerEmails.includes(String(currentUser.email || '').toLowerCase())
  }

  function openUpdateModal(course) {
    if (!canManageCourse(course)) {
      alert('Bạn chỉ có thể cập nhật bài học do chính bạn tạo.')
      return
    }
    const inferredContentType = course.contentType === 'simulation' || course.attachMode === 'simulation' || course.simulationUrl || course.simulationHtml
      ? 'simulation'
      : (course.attachMode === 'document' || course.wordFileUrl || course.richDocument || course.documentImageUrl) && !course.youtubeUrl && !course.mp4FileUrl
        ? 'document'
        : 'video'
    setCreateContentType(inferredContentType)
    setEditingCourse(course)
    setForm({
      title: course.title || '',
      topic: course.topic || '',
      description: course.description || '',
      content: course.content || '',
      category: course.category || teacherSubject || 'Toán',
      thumbnail: course.thumbnail || '',
      thumbnailFileName: course.thumbnailFileName || '',
      documentImageUrl: course.documentImageUrl || '',
      documentImageName: course.documentImageName || '',
      simulationMode: course.simulationMode || 'embed',
      simulationUrl: course.simulationUrl || '',
      simulationHtml: course.simulationHtml || '',
      simulationLanguage: course.simulationLanguage || 'html',
      simulationCode: course.simulationCode || '',
      simulationCodes: course.simulationCodes || {},
      simulationInstructions: course.simulationInstructions || '',
      youtubeUrl: course.youtubeUrl || '',
      lumiUrl: course.lumiUrl || '',
      wordFileName: course.wordFileName || '',
      wordFileUrl: course.wordFileUrl || '',
      richDocument: course.richDocument || '',
      documentMode: course.documentMode || (course.wordFileUrl ? 'upload' : 'type'),
      documentFileType: course.documentFileType || (String(course.wordFileName || '').toLowerCase().endsWith('.pdf') ? 'pdf' : String(course.wordFileName || '').toLowerCase().endsWith('.docx') ? 'docx' : String(course.wordFileName || '').toLowerCase().endsWith('.doc') ? 'doc' : ''),
      learningObjectives: normalizeTextList(course.learningObjectives),
      prerequisites: normalizeTextList(course.prerequisites),
      difficulty: course.difficulty || 'medium',
      estimatedMinutes: Number(course.estimatedMinutes || 0),
      durationSeconds: Number(course.durationSeconds || 0),
      duration: course.duration || '---',
      mp4FileName: course.mp4FileName || '',
      mp4FileUrl: course.mp4FileUrl || '',
      videoSourceType: course.videoSourceType || (course.youtubeUrl ? 'youtube' : course.lumiUrl ? 'lumi' : course.mp4FileUrl ? 'upload' : ''),
      videoSources: Array.isArray(course.videoSources) ? course.videoSources : [],
      publishConfirmed: Boolean(course.publishConfirmed),
      courseRandomCode: course.courseRandomCode || '',
      checklist: normalizeChecklist(course.checklist),
      quiz: normalizeQuiz(course.quiz),
      teacherCode: '',
      courseCode: course.courseCode || '',
      visibility: course.visibility || 'public',
      className: course.className || '',
      classId: course.classId || '',
      openAt: normalizeDateTimeLocal(course.openAt || ''),
      attachMode: course.attachMode || 'youtube',
      codeLanguage: course.codeLanguage || 'javascript',
      codeContent: course.codeContent || '',
      lessonTopics: Array.isArray(course.lessonTopics) ? course.lessonTopics : [],
      lessons: Array.isArray(course.lessons) && course.lessons.length > 0
        ? course.lessons
        : [{
            title: course.title || 'Bài 1',
            content: course.content || '',
            attachMode: course.attachMode || 'youtube',
            youtubeUrl: course.youtubeUrl || '',
            lumiUrl: course.lumiUrl || '',
            mp4FileName: course.mp4FileName || '',
            mp4FileUrl: course.mp4FileUrl || '',
            wordFileName: course.wordFileName || '',
            wordFileUrl: course.wordFileUrl || '',
            fileExtractedText: course.fileExtractedText || '',
            codeLanguage: course.codeLanguage || 'javascript',
            codeContent: course.codeContent || '',
            richDocument: course.richDocument || '',
      documentMode: course.documentMode || (course.wordFileUrl ? 'upload' : 'type'),
      documentFileType: course.documentFileType || (String(course.wordFileName || '').toLowerCase().endsWith('.pdf') ? 'pdf' : String(course.wordFileName || '').toLowerCase().endsWith('.docx') ? 'docx' : String(course.wordFileName || '').toLowerCase().endsWith('.doc') ? 'doc' : ''),
          }],
    })
    setShowCreateForm(true)
  }

  const filteredCourses = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const participatingClassIds = new Set(participatingClasses.map((item) => String(item.id || '')).filter(Boolean))
    const participatingClassNames = new Set(participatingClasses.map((item) => String(item.name || item.className || item.title || '').trim().toLowerCase()).filter(Boolean))
    const participatingGrades = new Set()
    const addGrade = (value) => {
      const match = String(value || '').match(/(?:^|\D)(10|11|12)(?:\D|$)/)
      if (match) participatingGrades.add(match[1])
    }
    participatingClasses.forEach((item) => { addGrade(item.grade); addGrade(item.name); addGrade(item.className) })
    addGrade(getUserClassName(teacherProfile))

    const filtered = courses.filter((course) => {
      const matchSearch =
        !keyword ||
        stripHtml(course.title).toLowerCase().includes(keyword) ||
        stripHtml(course.description).toLowerCase().includes(keyword) ||
        course.category?.toLowerCase().includes(keyword) ||
        course.teacherName?.toLowerCase().includes(keyword) ||
        course.courseCode?.toLowerCase().includes(keyword)
      const status = String(course.status || course.moderationStatus || 'approved').toLowerCase()
      const isOwner = [course.teacherId, course.createdByUid, course.createdBy, course.ownerId, course.userId, course.uid].filter(Boolean).map(String).includes(String(currentUser?.uid || ''))
      const visibility = String(course.visibility || 'public').toLowerCase()
      if (visibility === 'class') return false
      const canSeeModeration = activeLibrarySection === 'manage' && isAdminDev
        ? true
        : activeLibrarySection === 'account' && isOwner
          ? ['approved', 'pending'].includes(status)
          : status === 'approved'
      let canSeeByVisibility = visibility === 'public' || isTeacherOrAdmin || isOwner
      if (!canSeeByVisibility && visibility === 'private') {
        const targetGrade = getCourseGrade(course)
        canSeeByVisibility = Boolean(targetGrade && participatingGrades.has(targetGrade))
      }
      return canSeeModeration && canSeeByVisibility && matchSearch
    })
    return [...filtered].sort((a, b) => {
      if (sortBy === 'newest') return getCourseCreatedTime(b) - getCourseCreatedTime(a)
      if (sortBy === 'oldest') return getCourseCreatedTime(a) - getCourseCreatedTime(b)
      if (sortBy === 'featured') {
        return Number(isHotCourse(b)) - Number(isHotCourse(a)) || Number(b.isFeatured || 0) - Number(a.isFeatured || 0) || Number(b.rating || 0) - Number(a.rating || 0) || Number(b.views || 0) - Number(a.views || 0) || getCourseCreatedTime(b) - getCourseCreatedTime(a)
      }
      if (sortBy === 'mostViewed') {
        return Number(b.views || 0) - Number(a.views || 0) || getCourseCreatedTime(b) - getCourseCreatedTime(a)
      }
      return getCourseCreatedTime(b) - getCourseCreatedTime(a)
    })
  }, [courses, search, sortBy, teacherProfile, currentUser, isAdminDev, isTeacherOrAdmin, activeLibrarySection, participatingClasses])

  const coursesWithProgress = useMemo(() => {
    return filteredCourses.map((course) => {
      const progressInfo = learningProgress[course.id] || {}
      const progress = Math.max(0, Math.min(100, Number(progressInfo.progress || course.progress || 0)))
      return {
        ...course,
        progress,
        lastViewedAt: progressInfo.lastViewedAt || course.lastViewedAt || null,
        watchedSeconds: progressInfo.watchedSeconds || 0,
        completedChecklist: progressInfo.completedChecklist || {},
        bookmarked: Boolean(progressInfo.bookmarked),
        quizResult: progressInfo.quizResult || null,
        __canBypassRestrictions: isTeacherOrAdmin,
      }
    })
  }, [filteredCourses, learningProgress, isTeacherOrAdmin])

  const recentlyCompletedCourses = useMemo(() => {
    return coursesWithProgress.filter((course) => isCompletedCourse(course)).sort((a, b) => getAnyTime(b.lastViewedAt) - getAnyTime(a.lastViewedAt)).slice(0, 6)
  }, [coursesWithProgress])

  const continueLearningCourses = useMemo(() => {
    return coursesWithProgress.filter((course) => course.progress > 0 && course.progress < 100).sort((a, b) => getAnyTime(b.lastViewedAt) - getAnyTime(a.lastViewedAt)).slice(0, 6)
  }, [coursesWithProgress])

  const featuredCourses = useMemo(() => {
    const popularCourses = coursesWithProgress.filter((course) => Number(course.views || 0) > 100)
    if (sortBy === 'newest') return [...popularCourses].sort((a, b) => getCourseCreatedTime(b) - getCourseCreatedTime(a)).slice(0, 6)
    if (sortBy === 'oldest') return [...popularCourses].sort((a, b) => getCourseCreatedTime(a) - getCourseCreatedTime(b)).slice(0, 6)
    return [...popularCourses].sort((a, b) => Number(b.views || 0) - Number(a.views || 0) || getRatingAverageNumber(b) - getRatingAverageNumber(a) || Number(b.lessonCount || 0) - Number(a.lessonCount || 0) || getCourseCreatedTime(b) - getCourseCreatedTime(a)).slice(0, 6)
  }, [coursesWithProgress, sortBy])

  const learningDashboardStats = useMemo(() => {
    const completed = coursesWithProgress.filter((course) => isCompletedCourse(course)).length
    const inProgress = coursesWithProgress.filter((course) => course.progress > 0 && course.progress < 100).length
    const totalWatchedSeconds = coursesWithProgress.reduce((sum, course) => sum + Number(course.watchedSeconds || 0), 0)
    const averageProgress = coursesWithProgress.length ? Math.round(coursesWithProgress.reduce((sum, course) => sum + Number(course.progress || 0), 0) / coursesWithProgress.length) : 0
    const teacherCourses = coursesWithProgress.filter((course) => canManageCourse(course))
    return {
      completed,
      inProgress,
      totalWatchedSeconds,
      averageProgress,
      streakDays: Array.isArray(achievement.watchedDates) ? achievement.watchedDates.length : 0,
      watchedDates: Array.isArray(achievement.watchedDates) ? achievement.watchedDates : [],
      teacherCourseCount: teacherCourses.length,
      teacherViews: teacherCourses.reduce((sum, course) => sum + Number(course.views || 0), 0),
      teacherStudents: teacherCourses.reduce((sum, course) => sum + Number(course.studentCount || 0), 0),
      bestRatedCourse: [...teacherCourses].sort((a, b) => getRatingAverageNumber(b) - getRatingAverageNumber(a))[0] || null,
    }
  }, [coursesWithProgress, achievement.watchedDates, currentUser, canCreateELearning])

  const suggestedCourse = useMemo(() => {
    return coursesWithProgress
      .filter((course) => {
        const status = String(course.status || course.moderationStatus || 'approved').toLowerCase()
        const progress = Number(course.progress || 0)
        return status === 'approved' && progress > 0 && progress < 100 && !isCourseLocked(course)
      })
      .sort((a, b) => getAnyTime(b.lastViewedAt) - getAnyTime(a.lastViewedAt))[0] || null
  }, [coursesWithProgress])

  const libraryCounts = useMemo(() => {
    return libraryCategories.reduce((acc, item) => {
      acc[item.id] = coursesWithProgress.filter((course) => item.matcher(course)).length
      return acc
    }, {})
  }, [coursesWithProgress])

  const rightFilteredCourses = useMemo(() => {
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000
    return coursesWithProgress.filter((course) => {
      const progress = Number(course.progress || 0)
      const hasViewed = progress > 0 || Number(course.watchedSeconds || 0) > 0 || Boolean(course.lastViewedAt)
      const searchableText = [course.title, course.topic, course.description, course.category, course.courseCode]
        .map((value) => stripHtml(value).toLowerCase())
        .join(' ')

      const byMainSort =
        mainSort === 'all' ||
        (mainSort === 'subject' && subjectSort !== 'All' && course.category === subjectSort) ||
        (mainSort === 'other' && otherSort !== 'all' && searchableText.includes(otherSort.toLowerCase())) ||
        (mainSort === 'recent' && getCourseCreatedTime(course) >= twoWeeksAgo) ||
        (mainSort === 'watched' && hasViewed) ||
        (mainSort === 'new' && !hasViewed)

      let bySidebar = true
      if (activeLibrarySection === 'watched') bySidebar = hasViewed
      if (activeLibrarySection === 'saved') bySidebar = Boolean(course.bookmarked)

      const bySubject = rightSubjectFilter === 'All' || course.category === rightSubjectFilter
      const selectedClass = activeLibrarySection === 'home' ? homeClassSort : rightClassFilter
      const byClass = selectedClass === 'All' || getCourseGrade(course) === selectedClass
      const byFormat = rightFormatFilter === 'all' || getCourseFormat(course) === rightFormatFilter
      const byTypeSort = typeSort === 'all' || getCourseFormat(course) === typeSort
      const byExam = rightExamFilter === 'all' || searchableText.includes(rightExamFilter.toLowerCase())
      const byProgress =
        rightProgressFilter === 'all' ||
        (rightProgressFilter === 'new' && !hasViewed) ||
        (rightProgressFilter === 'progress' && progress > 0 && progress < 100) ||
        (rightProgressFilter === 'done' && isCompletedCourse(course))
      return byMainSort && bySidebar && bySubject && byClass && byFormat && byTypeSort && byExam && byProgress
    })
  }, [coursesWithProgress, mainSort, subjectSort, otherSort, activeLibrarySection, rightSubjectFilter, rightClassFilter, homeClassSort, rightFormatFilter, rightExamFilter, rightProgressFilter, typeSort])

  const activeSectionContent = useMemo(() => {
    if (activeLibrarySection === 'watched') {
      return {
        title: 'Đã xem',
        subtitle: `${rightFilteredCourses.length} bài học đã xem hoặc đang học`,
      }
    }
    if (activeLibrarySection === 'saved') {
      return {
        title: 'Đã lưu',
        subtitle: `${rightFilteredCourses.length} bài học đã được lưu`,
      }
    }
    return {
      title: 'Tất cả bài học',
      subtitle: `${rightFilteredCourses.length} nội dung phù hợp`,
    }
  }, [activeLibrarySection, rightFilteredCourses.length])

  async function copyCourseLink(course) {
    if (!course?.id) return
    const courseUrl = `${window.location.origin}/e-learning/${encodeURIComponent(course.id)}`
    let copied = false

    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(courseUrl)
        copied = true
      }
    } catch (error) {
      console.warn('Clipboard API không khả dụng, chuyển sang cách sao chép dự phòng:', error)
    }

    if (!copied) {
      const input = document.createElement('textarea')
      input.value = courseUrl
      input.setAttribute('readonly', '')
      input.setAttribute('aria-hidden', 'true')
      input.style.position = 'fixed'
      input.style.left = '-9999px'
      input.style.top = '0'
      input.style.opacity = '0'
      document.body.appendChild(input)
      input.focus()
      input.select()
      input.setSelectionRange(0, input.value.length)
      try {
        copied = document.execCommand('copy')
      } catch (error) {
        console.warn('Không thể sao chép bằng phương thức dự phòng:', error)
      } finally {
        document.body.removeChild(input)
      }
    }

    setOpenCourseMenuId(null)
    if (copied) {
      setCopySuccessCourse(course)
    } else {
      window.prompt('Trình duyệt không cho phép sao chép tự động. Hãy sao chép liên kết này:', courseUrl)
    }
  }

  async function submitCourseReport({
    reason,
    detail,
  }) {
    if (
      !currentUser ||
      !reportTarget
    ) {
      setReportNotice({
        type: 'error',
        title:
          'Bạn chưa đăng nhập',
        message:
          'Hãy đăng nhập trước khi gửi báo cáo nhé.',
      })
      return
    }

    try {
      const reportResponse =
        await eLearningApi.reports()

      const alreadyReported =
        normalizeReportsResponse(
          reportResponse,
        ).some((report) => {
          const sameCourse =
            String(
              report.courseId ||
              '',
            ) ===
            String(
              reportTarget.id ||
              '',
            )

          const sameUser =
            String(
              report.reporterId ||
              '',
            ) ===
            getCurrentUserId(
              currentUser,
            )

          return (
            sameCourse &&
            sameUser
          )
        })

      if (alreadyReported) {
        setReportTarget(null)
        setReportNotice({
          type: 'duplicate',
          title:
            'Bạn đã báo cáo bài này rồi',
          message:
            'Một lần là đủ để quản trị viên tiếp nhận. Bạn cứ yên tâm, báo cáo đang được xem xét.',
        })
        return
      }

      const created =
        await eLearningApi.createReport({
          reportType:
            'course',
          courseId:
            reportTarget.id,
          reportedUserId:
            reportTarget.teacherId ||
            reportTarget.createdByUid ||
            reportTarget.createdBy ||
            '',
          reason,
          detail:
            detail || '',
          status:
            'pending',
          data: {
            courseTitle:
              stripHtml(
                reportTarget.title,
              ),
            courseOwnerId:
              reportTarget.teacherId ||
              reportTarget.createdByUid ||
              reportTarget.createdBy ||
              '',
            reporterName:
              currentTeacherName,
            reporterEmail:
              currentUser.email ||
              '',
          },
        })

      const reportId =
        created?.reportId ||
        ''

      await pushNotification(
        getCurrentUserId(
          currentUser,
        ),
        {
          notificationId:
            `report_submitted_${reportId}`,
          title:
            'Đã gửi báo cáo tới quản trị viên',
          message:
            `Báo cáo về bài học “${stripHtml(reportTarget.title) || 'Bài học'}” ` +
            'đã được tiếp nhận và đang chờ xử lý.',
          type:
            'report_submitted',
          courseId:
            reportTarget.id,
          reportId,
        },
      )

      setReportTarget(null)

      await fetchLearningReports(
        getCurrentUserId(
          currentUser,
        ),
      )

      setReportNotice({
        type: 'success',
        title:
          'Đã gửi báo cáo',
        message:
          'Cảm ơn bạn đã giúp ZUNY an toàn hơn. Quản trị viên sẽ kiểm tra nội dung này sớm nhất có thể.',
      })
    } catch (error) {
      console.error(
        'Không thể gửi báo cáo:',
        error,
      )
      setReportNotice({
        type: 'error',
        title:
          'Chưa gửi được báo cáo',
        message:
          'Có một chút trục trặc. Bạn vui lòng thử lại sau nhé.',
      })
    }
  }


  async function submitChannelReport({
    reason,
    detail,
  }) {
    if (
      !currentUser?.uid ||
      !channelReportTarget?.id
    ) {
      return
    }

    const duplicate =
      adminReports.some(
        (item) =>
          String(
            item.reporterId ||
            item.userId,
          ) ===
            getCurrentUserId(
              currentUser,
            ) &&
          String(
            item.reportedUserId ||
            '',
          ) ===
            String(
              channelReportTarget.id,
            ) &&
          ![
            'resolved',
            'deleted',
          ].includes(
            String(
              item.status ||
              'pending',
            ).toLowerCase(),
          ),
      )

    if (duplicate) {
      setChannelReportTarget(null)
      setReportNotice({
        type: 'duplicate',
        title:
          'Kênh đã được báo cáo',
        message:
          'Báo cáo trước đó vẫn đang được quản trị viên xem xét.',
      })
      return
    }

    try {
      const created =
        await eLearningApi.createReport({
          reportType:
            'account',
          reportedUserId:
            channelReportTarget.id,
          reason,
          detail:
            detail || '',
          status:
            'pending',
          data: {
            reportedUserName:
              channelReportTarget.name ||
              '',
            reporterName:
              currentTeacherName,
            reporterEmail:
              currentUser.email ||
              '',
          },
        })

      const reportId =
        created?.reportId ||
        ''

      await pushNotification(
        getCurrentUserId(
          currentUser,
        ),
        {
          notificationId:
            `report_submitted_${reportId}`,
          title:
            'Đã gửi báo cáo tới quản trị viên',
          message:
            `Báo cáo về tài khoản ${channelReportTarget.name || 'người dùng'} ` +
            'đã được tiếp nhận và đang chờ xử lý.',
          type:
            'account_report_submitted',
          reportId,
        },
      )

      setChannelReportTarget(null)

      setReportNotice({
        type: 'success',
        title:
          'Đã báo cáo kênh',
        message:
          'Quản trị viên sẽ kiểm tra tài khoản và nội dung liên quan.',
      })
    } catch (error) {
      console.error(
        'Không thể báo cáo kênh:',
        error,
      )

      setReportNotice({
        type: 'error',
        title:
          'Chưa gửi được báo cáo',
        message:
          'Vui lòng thử lại sau.',
      })
    }
  }


  async function pushNotification(
    targetUid,
    payload = {},
  ) {
    if (!targetUid) return

    try {
      await eLearningApi.createNotification({
        legacyId:
          payload.notificationId ||
          '',
        userId:
          String(targetUid),
        title:
          payload.title ||
          'Thông báo E-learning',
        message:
          payload.message ||
          '',
        type:
          payload.type ||
          'system',
        data: {
          courseId:
            payload.courseId ||
            '',
          reportId:
            payload.reportId ||
            '',
          actorId:
            payload.actorId ||
            getCurrentUserId(
              currentUser,
            ),
        },
      })
    } catch (error) {
      console.warn(
        'Không thể tạo thông báo:',
        error,
      )
    }
  }


  async function markNotificationRead(notification) {
    if (
      !currentUser?.uid ||
      !notification?.id ||
      notification.read
    ) {
      return
    }

    await eLearningApi.updateNotification(
      notification.id,
      {
        read: true,
      },
    )

    setNotifications(
      (current) =>
        current.map(
          (item) =>
            String(item.id) ===
            String(notification.id)
              ? {
                  ...item,
                  read: true,
                  readAt:
                    new Date().toISOString(),
                }
              : item,
        ),
    )
  }


  async function clearAllNotifications() {
    if (
      !currentUser?.uid ||
      !notifications.length
    ) {
      return
    }

    const itemsToDelete =
      [...notifications]

    const deletedIds =
      new Set(
        itemsToDelete.map(
          (item) =>
            String(item.id),
        ),
      )

    setNotificationDismissalIds(
      (current) =>
        new Set([
          ...current,
          ...deletedIds,
        ]),
    )
    setNotifications([])

    try {
      await Promise.all(
        itemsToDelete.map(
          (item) =>
            eLearningApi.updateNotification(
              item.id,
              {
                dismissed:
                  true,
              },
            ),
        ),
      )
    } catch (error) {
      console.error(
        'Không thể xóa toàn bộ thông báo:',
        error,
      )

      setNotificationDismissalIds(
        (current) => {
          const next =
            new Set(current)

          deletedIds.forEach(
            (id) =>
              next.delete(id),
          )

          return next
        },
      )

      setNotifications(
        itemsToDelete,
      )

      alert(
        'Không thể xóa toàn bộ thông báo. Vui lòng thử lại.',
      )
    }
  }


  async function deleteNotification(notification) {
    if (
      !currentUser?.uid ||
      !notification?.id
    ) {
      return
    }

    const notificationId =
      String(notification.id)

    setNotificationDismissalIds(
      (current) =>
        new Set([
          ...current,
          notificationId,
        ]),
    )

    setNotifications(
      (items) =>
        items.filter(
          (item) =>
            String(item.id) !==
            notificationId,
        ),
    )

    try {
      await eLearningApi.updateNotification(
        notification.id,
        {
          dismissed: true,
        },
      )
    } catch (error) {
      console.error(
        'Không thể xóa thông báo:',
        error,
      )

      setNotificationDismissalIds(
        (current) => {
          const next =
            new Set(current)

          next.delete(
            notificationId,
          )

          return next
        },
      )

      setNotifications(
        (items) =>
          items.some(
            (item) =>
              String(item.id) ===
              notificationId,
          )
            ? items
            : [
                notification,
                ...items,
              ],
      )

      alert(
        'Không thể xóa thông báo. Vui lòng thử lại.',
      )
    }
  }


  useEffect(() => {
    if (!isAdminDev) {
      return undefined
    }

    let cancelled = false

    async function refreshAdmin() {
      try {
        await fetchAdminData()
      } catch (error) {
        if (!cancelled) {
          console.warn(
            'Không thể đồng bộ dữ liệu quản trị:',
            error,
          )
        }
      }
    }

    refreshAdmin()

    const timer =
      window.setInterval(
        refreshAdmin,
        60000,
      )

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [isAdminDev])


  async function fetchAdminData() {
    if (!isAdminDev) return

    try {
      setAdminLoading(true)

      const [
        reportResponse,
        usersResponse,
        courseResponse,
      ] = await Promise.all([
        eLearningApi.reports(),
        eLearningApi.users(),
        eLearningApi.courses({
          limit: 500,
        }),
      ])

      const allReports =
        normalizeReportsResponse(
          reportResponse,
        )

      setAdminUsers(
        normalizeUsers(
          usersResponse,
        ),
      )

      setAdminReports(
        allReports
          .filter(
            (item) =>
              String(
                item.reportType ||
                '',
              ).toLowerCase() !==
              'comment',
          )
          .sort(
            (a, b) =>
              getAnyTime(
                b.createdAt,
              ) -
              getAnyTime(
                a.createdAt,
              ),
          ),
      )

      setAdminCommentReports(
        allReports
          .filter(
            (item) =>
              String(
                item.reportType ||
                '',
              ).toLowerCase() ===
              'comment',
          )
          .sort(
            (a, b) =>
              getAnyTime(
                b.createdAt,
              ) -
              getAnyTime(
                a.createdAt,
              ),
          ),
      )

      const nextCourses =
        normalizeCoursesResponse(
          courseResponse,
        ).sort(
          (a, b) =>
            getCourseCreatedTime(b) -
            getCourseCreatedTime(a),
        )

      setCourses(nextCourses)

      await fetchCourseTeacherProfiles(
        nextCourses,
      )
    } catch (error) {
      console.error(
        'Không thể tải dữ liệu quản trị:',
        error,
      )
    } finally {
      setAdminLoading(false)
    }
  }


  async function updateCourseModeration(
    course,
    status,
    reason = '',
  ) {
    if (
      !isAdminDev ||
      !course?.id
    ) {
      return
    }

    await eLearningApi.updateCourse(
      course.id,
      {
        status,
        moderationStatus:
          status,
        moderationReason:
          reason,
        metadata: {
          moderatedBy:
            getCurrentUserId(
              currentUser,
            ),
          moderatedAt:
            new Date().toISOString(),
        },
      },
    )

    const ownerId =
      course.teacherId ||
      course.createdByUid ||
      course.createdBy ||
      course.ownerId ||
      course.userId ||
      course.uid

    await pushNotification(
      ownerId,
      {
        title:
          status === 'approved'
            ? 'Bài đăng đã được duyệt'
            : 'Bài đăng bị từ chối',
        message:
          status === 'approved'
            ? `“${stripHtml(course.title)}” đã xuất hiện trong thư viện.`
            : `“${stripHtml(course.title)}” bị từ chối${reason ? `: ${reason}` : '.'}`,
        type:
          status === 'approved'
            ? 'approved'
            : 'rejected',
        courseId:
          course.id,
      },
    )

    await fetchAdminData()
  }


  function handleRejectCourse(course) {
    setRejectCourseTarget(course)
  }

  async function confirmRejectCourse(reason) {
    if (!rejectCourseTarget || !reason.trim()) return
    await updateCourseModeration(rejectCourseTarget, 'rejected', reason.trim())
    setRejectCourseTarget(null)
  }

  async function handleReportStatus(report, status) {
    if (
      !isAdminDev ||
      !report?.id
    ) {
      return
    }

    await eLearningApi.updateReport(
      report.id,
      {
        status,
        data: {
          handledBy:
            getCurrentUserId(
              currentUser,
            ),
          handledAt:
            new Date().toISOString(),
        },
      },
    )

    if (
      status === 'resolved' &&
      report.reporterId
    ) {
      const isAccountReport =
        [
          'account',
          'channel',
          'user',
        ].includes(
          String(
            report.reportType ||
            '',
          ).toLowerCase(),
        ) ||
        Boolean(
          report.reportedUserId,
        )

      await pushNotification(
        report.reporterId,
        {
          notificationId:
            `report_resolved_${report.id}`,
          title:
            isAccountReport
              ? 'Báo cáo tài khoản đã được giải quyết'
              : 'Báo cáo nội dung đã được giải quyết',
          message:
            isAccountReport
              ? `Báo cáo về tài khoản ${report.reportedUserName || 'người dùng'} đã được quản trị viên xem xét và giải quyết.`
              : `Báo cáo về “${report.courseTitle || report.title || 'nội dung'}” đã được quản trị viên xem xét và giải quyết.`,
          type:
            isAccountReport
              ? 'account_report_resolved'
              : 'report_resolved',
          courseId:
            report.courseId ||
            '',
          reportId:
            report.id,
        },
      )
    }

    await fetchAdminData()
  }


  async function handleCommentReportStatus(
    report,
    status = 'resolved',
  ) {
    if (
      !isAdminDev ||
      !report?.id
    ) {
      return
    }

    await eLearningApi.updateReport(
      report.id,
      {
        status,
        data: {
          handledBy:
            getCurrentUserId(
              currentUser,
            ),
          handledAt:
            new Date().toISOString(),
        },
      },
    )

    await pushNotification(
      report.reporterId,
      {
        title:
          'Báo cáo bình luận đã được xử lý',
        message:
          `Báo cáo về bình luận của ${report.commentUserName || 'người dùng'} ` +
          'đã được quản trị viên xem xét.',
        type:
          'comment_report_resolved',
        courseId:
          report.courseId ||
          '',
        reportId:
          report.id,
      },
    )

    await fetchAdminData()
  }


  async function handleDeleteReportedComment(report) {
    if (
      !isAdminDev ||
      !report?.id ||
      !report?.courseId ||
      !report?.questionId
    ) {
      return
    }

    try {
      if (report.replyId) {
        await eLearningApi.deleteReply(
          report.courseId,
          report.questionId,
          report.replyId,
        )
      } else {
        await eLearningApi.deleteQuestion(
          report.courseId,
          report.questionId,
        )
      }

      const reportsResponse =
        await eLearningApi.reports()

      const relatedReports =
        normalizeReportsResponse(
          reportsResponse,
        ).filter(
          (item) =>
            String(
              item.courseId ||
              '',
            ) ===
              String(
                report.courseId ||
                '',
              ) &&
            String(
              item.questionId ||
              '',
            ) ===
              String(
                report.questionId ||
                '',
              ) &&
            String(
              item.replyId ||
              '',
            ) ===
              String(
                report.replyId ||
                '',
              ),
        )

      await Promise.all(
        relatedReports.map(
          (item) =>
            eLearningApi.updateReport(
              item.id,
              {
                status:
                  'deleted',
                data: {
                  deletedBy:
                    getCurrentUserId(
                      currentUser,
                    ),
                  deletedAt:
                    new Date().toISOString(),
                  handledBy:
                    getCurrentUserId(
                      currentUser,
                    ),
                  handledAt:
                    new Date().toISOString(),
                },
              },
            ),
        ),
      )

      await pushNotification(
        report.commentUserId ||
        report.reportedUserId,
        {
          title:
            'Bình luận đã bị xóa',
          message:
            `Bình luận “${String(report.commentContent || '').slice(0, 90)}” ` +
            'đã bị quản trị viên xóa sau khi xem xét báo cáo.',
          type:
            'comment_deleted',
          courseId:
            report.courseId ||
            '',
          reportId:
            report.id,
        },
      )

      await fetchAdminData()
    } catch (error) {
      console.error(
        'Không thể xóa comment bị báo cáo:',
        error,
      )
    }
  }


  async function handleWarnReportedComment(
    report,
    payload = {},
  ) {
    if (
      !isAdminDev ||
      !(
        report?.commentUserId ||
        report?.reportedUserId
      ) ||
      !report?.id ||
      !payload.reason
    ) {
      return
    }

    try {
      const response =
        await eLearningApi.createCommentWarning({
          reportId:
            report.id,
          userId:
            report.commentUserId ||
            report.reportedUserId,
          courseId:
            report.courseId ||
            '',
          questionId:
            report.questionId ||
            '',
          replyId:
            report.replyId ||
            '',
          commentType:
            report.commentType ||
            (
              report.replyId
                ? 'reply'
                : 'question'
            ),
          commentContent:
            report.commentContent ||
            '',
          reason:
            payload.reason,
          detail:
            payload.detail ||
            '',
        })

      const nextWarningCount =
        Number(
          response?.warningCount ||
          report.warningCount ||
          0,
        )

      await eLearningApi.updateReport(
        report.id,
        {
          status:
            'warned',
          data: {
            warningId:
              response?.warningId ||
              '',
            warningReason:
              payload.reason,
            warningDetail:
              payload.detail ||
              '',
            warningCount:
              nextWarningCount,
            handledBy:
              getCurrentUserId(
                currentUser,
              ),
            handledAt:
              new Date().toISOString(),
          },
        },
      )

      await pushNotification(
        report.commentUserId ||
        report.reportedUserId,
        {
          title:
            `Cảnh báo bình luận lần ${Math.max(1, nextWarningCount)}`,
          message:
            `Bạn nhận cảnh báo vì bình luận: “${String(report.commentContent || '').slice(0, 90)}”.`,
          type:
            'comment_warning',
          courseId:
            report.courseId ||
            '',
          reportId:
            report.id,
        },
      )

      await fetchAdminData()
    } catch (error) {
      console.error(
        'Không thể tạo cảnh báo comment:',
        error,
      )
    }
  }


  async function confirmResolveReport() {
    if (!resolveReportTarget) return
    await handleReportStatus(resolveReportTarget, 'resolved')
    await pushNotification(resolveReportTarget.reporterId || resolveReportTarget.userId, { title: 'Báo cáo đã được xử lý', message: `Báo cáo về “${resolveReportTarget.courseTitle || 'bài học'}” đã được quản trị viên xử lý.`, type: 'report_resolved', courseId: resolveReportTarget.courseId, reportId: resolveReportTarget.id })
    setResolveReportTarget(null)
  }

  async function confirmDeleteReportedCourse({
    reason,
    detail,
  }) {
    const report =
      deleteReportedCourseTarget

    if (
      !report?.id ||
      !report?.courseId ||
      !reason
    ) {
      return
    }

    const reportsResponse =
      await eLearningApi.reports()

    const relatedReports =
      normalizeReportsResponse(
        reportsResponse,
      ).filter(
        (item) =>
          String(
            item.courseId ||
            '',
          ) ===
          String(
            report.courseId,
          ),
      )

    await Promise.all(
      relatedReports.map(
        (item) =>
          pushNotification(
            item.reporterId ||
            item.userId,
            {
              title:
                'Bài học đã bị xóa vĩnh viễn',
              message:
                `Bài “${item.courseTitle || 'đã báo cáo'}” ` +
                'đã bị xóa vĩnh viễn sau khi xem xét báo cáo.',
              type:
                'report_deleted',
              courseId: '',
              reportId:
                item.id,
            },
          ),
      ),
    )

    await permanentlyDeleteCourse(
      report.courseId,
    )

    await Promise.all(
      relatedReports.map(
        (item) =>
          eLearningApi.updateReport(
            item.id,
            {
              status:
                'deleted',
              data: {
                deleteReason:
                  reason,
                deleteDetail:
                  detail ||
                  '',
                handledBy:
                  getCurrentUserId(
                    currentUser,
                  ),
              },
            },
          ),
      ),
    )

    setDeleteReportedCourseTarget(
      null,
    )

    await fetchAdminData()

    if (currentUser?.uid) {
      await fetchLearningReports(
        getCurrentUserId(
          currentUser,
        ),
      )
    }
  }


  function applyRightFilter() {
    setActiveCategory(rightSubjectFilter)
    const element = lessonsRef.current
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function openCourse(course) {
    if (!course?.id) return
    if (!isTeacherOrAdmin && isCourseLocked(course)) return

    navigate(`/e-learning/${course.id}`)
  }

  function openReportedComment(report) {
    if (!report?.courseId || !report?.questionId) return
    const params = new URLSearchParams({ tab: 'qa', questionId: String(report.questionId) })
    if (report.replyId) params.set('replyId', String(report.replyId))
    navigate(`/e-learning/${encodeURIComponent(report.courseId)}?${params.toString()}`)
  }

  function resetRightFilters() {
    setRightSubjectFilter('All')
    setRightClassFilter('All')
    setRightFormatFilter('all')
    setRightProgressFilter('all')
    setRightExamFilter('all')
    setActiveCategory('All')
    setMainSort('all')
    setSubjectSort('All')
    setOtherSort('all')
    setTypeSort('all')
  }

  function handleSidebarSelection(sectionId) {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)

      if (sectionId === 'home') {
        url.searchParams.delete('section')
        url.searchParams.delete('user')
      } else {
        url.searchParams.set('section', sectionId)

        if (sectionId !== 'channel') {
          url.searchParams.delete('user')
        }
      }

      window.history.pushState(
        {},
        '',
        `${url.pathname}${url.search}${url.hash}`,
      )
    }
    setActiveLibrarySection(sectionId)
    setShowMobileSidebar(false)
    setMainSort('all')
    setSubjectSort('All')
    setOtherSort('all')
    setRightSubjectFilter('All')
    setRightClassFilter('All')
    setRightFormatFilter('all')
    setRightProgressFilter('all')
    setRightExamFilter('all')
    setShowSubjectMenu(false)
    setShowOtherMenu(false)
    setShowTypeMenu(false)
    if (sectionId === 'account' && currentUser?.uid) fetchLearningReports(currentUser.uid)
    if (sectionId === 'manage' && isAdminDev) fetchAdminData()
  }

  function selectMainSort(value) {
    setMainSort(value)
    setShowSubjectMenu(false)
    setShowOtherMenu(false)
    setShowTypeMenu(false)
    if (value !== 'subject') setSubjectSort('All')
    if (value !== 'other') setOtherSort('all')
  }



  const followedAccountIds = useMemo(
    () => new Set(followingAccounts.map((account) => String(account.id))),
    [followingAccounts],
  )

  const visibleNotifications = useMemo(
    () => notifications.filter((item) => {
      if (String(item.type || '') !== 'follow_course') return true
      return followedAccountIds.has(String(item.actorId || ''))
    }),
    [notifications, followedAccountIds],
  )

  const pageBg = isDarkMode
    ? 'min-h-screen bg-[#0b1120] text-slate-100'
    : 'min-h-screen bg-[#f8fafc] text-slate-950'

  return (
    <div className={`${pageBg} [&_button]:cursor-pointer [&_a]:cursor-pointer [&_select]:cursor-pointer`} onClick={() => openCourseMenuId && setOpenCourseMenuId(null)}>
      <MobileSidebar
        open={showMobileSidebar}
        activeItem={activeLibrarySection}
        canCreate={canCreateELearning}
        isAdmin={isAdminDev}
        onClose={() => setShowMobileSidebar(false)}
        onSelect={handleSidebarSelection}
        onCreate={requestCreateModal}
        followingAccounts={followingAccounts}
        onOpenFollowing={openFollowingAccount}
        badges={{ manage: isAdminDev ? courses.filter(c=>String(c.status||c.moderationStatus||'').toLowerCase()==='pending').length + adminReports.filter(r=>!['resolved','deleted'].includes(String(r.status||'pending').toLowerCase())).length + adminCommentReports.filter(r=>!['resolved','deleted','warned'].includes(String(r.status||'pending').toLowerCase())).length : 0, notifications: visibleNotifications.filter(n=>!n.read).length }}
      />

      <div className="mx-auto flex w-full max-w-[1920px] overflow-x-hidden">
        <DesktopSidebar
          collapsed={sidebarCollapsed}
          activeItem={activeLibrarySection}
          canCreate={canCreateELearning}
          isAdmin={isAdminDev}
          onCollapse={() => setSidebarCollapsed((value) => !value)}
          onSelect={handleSidebarSelection}
          onCreate={requestCreateModal}
          followingAccounts={followingAccounts}
          onOpenFollowing={openFollowingAccount}
          badges={{ manage: isAdminDev ? courses.filter(c=>String(c.status||c.moderationStatus||'').toLowerCase()==='pending').length + adminReports.filter(r=>!['resolved','deleted'].includes(String(r.status||'pending').toLowerCase())).length + adminCommentReports.filter(r=>!['resolved','deleted','warned'].includes(String(r.status||'pending').toLowerCase())).length : 0, notifications: visibleNotifications.filter(n=>!n.read).length }}
        />

        <main className="min-w-0 flex-1 overflow-x-hidden px-2.5 pb-28 sm:px-5 sm:pb-20 lg:px-6 [&_button]:cursor-pointer">
          <header className="sticky top-[var(--zuny-navbar-height,80px)] z-30 -mx-2.5 border-b border-slate-200/80 bg-[#f8fafc]/95 px-2.5 py-2 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1120]/95 sm:-mx-5 sm:px-5 sm:py-3 lg:-mx-6 lg:px-6">
            <div className="grid grid-cols-[40px_minmax(0,1fr)_38px] items-center gap-2 sm:flex sm:gap-3">
              <button type="button" onClick={() => setShowMobileSidebar(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10 xl:hidden" aria-label="Mở menu">
                <MenuIcon />
              </button>
              <div className="mx-auto flex min-w-0 items-center sm:flex-1 sm:max-w-3xl">
                <div className="flex min-w-0 flex-1 overflow-hidden rounded-l-full border border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-white/20 dark:bg-[#111827]">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm bài học, giáo viên hoặc mã..."
                    className="h-10 min-w-0 flex-1 bg-transparent px-3 text-[13px] outline-none placeholder:text-slate-400 sm:h-11 sm:px-4"
                  />
                  {search && <button type="button" onClick={() => setSearch('')} className="px-3 text-slate-500 hover:text-slate-900 dark:hover:text-white" aria-label="Xóa tìm kiếm"><CloseIcon /></button>}
                </div>
                <button type="button" className="grid h-10 w-11 shrink-0 place-items-center rounded-r-full sm:h-11 sm:w-14 border border-l-0 border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-white/20 dark:bg-white/5 dark:hover:bg-white/10" aria-label="Tìm kiếm">
                  <SearchIcon />
                </button>
              </div>
              {canCreateELearning && (
                <div ref={createMenuRef} className="relative hidden sm:block">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setShowCreateTypeMenu((value) => {
                        if (value && classCreatePreset) setClassCreatePreset(null)
                        return !value
                      })
                    }}
                    className={`inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/20 ${showCreateTypeMenu ? 'ring-4 ring-blue-500/15' : ''}`}
                    aria-expanded={showCreateTypeMenu}
                    aria-haspopup="menu"
                  >
                    <PlusIcon />
                    <span>Đăng bài</span>
                    <span className={`text-[11px] transition-transform duration-200 ${showCreateTypeMenu ? 'rotate-180' : ''}`}>⌄</span>
                  </button>

                  <div
                    className={`absolute right-0 top-[calc(100%+10px)] z-[150] w-[330px] origin-top-right rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-950/15 transition-all duration-200 dark:border-white/10 dark:bg-[#172033] ${
                      showCreateTypeMenu
                        ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
                        : 'pointer-events-none -translate-y-2 scale-95 opacity-0'
                    }`}
                    role="menu"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Chọn loại nội dung</p>
                    <button
                      type="button"
                      onClick={() => requestCreateModal('video')}
                      className="group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-blue-50 dark:hover:bg-blue-500/10"
                      role="menuitem"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-50 text-xl text-red-600 transition group-hover:scale-105 dark:bg-red-500/10">▶</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-black text-slate-900 dark:text-white">Đăng video bài học</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">YouTube, MP4, playlist nhiều bài và tiến độ xem.</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => requestCreateModal('document')}
                      className="group mt-1 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                      role="menuitem"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-xl text-emerald-700 transition group-hover:scale-105 dark:bg-emerald-500/10 dark:text-emerald-300">▤</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-black text-slate-900 dark:text-white">Đăng tài liệu</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">Word, PDF, nội dung đọc và tài nguyên học tập.</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => requestCreateModal('simulation')}
                      className="group mt-1 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-violet-50 dark:hover:bg-violet-500/10"
                      role="menuitem"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-xl text-violet-700 transition group-hover:scale-105 dark:bg-violet-500/10 dark:text-violet-300">🧪</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-black text-slate-900 dark:text-white">Tạo bài mô phỏng</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">Nhúng mô phỏng tương tác hoặc tự viết HTML/CSS/JS/TS.</span>
                      </span>
                    </button>
                  </div>
                </div>
              )}
              
              <button
                type="button"
                onClick={() => handleSidebarSelection('account')}
                className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden justify-self-end rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-black text-white ring-2 ring-transparent transition hover:ring-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title={`Mở tài khoản chính của ${currentTeacherName}`}
                aria-label="Mở tài khoản chính"
              >
                {currentUserAvatar ? (
                  <img
                    src={currentUserAvatar}
                    alt={currentTeacherName}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  getInitials(currentTeacherName)
                )}
              </button>
            </div>

            {activeLibrarySection === 'home' && (
              <div
  ref={sortBoxRef}
  className="relative z-[120] mt-2 flex flex-nowrap items-center gap-2 overflow-x-auto overflow-y-visible rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-sm backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-white/10 dark:bg-[#111827]/95 sm:flex-wrap sm:overflow-visible"
>
  <span className="mr-1 hidden shrink-0 rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:bg-white/[0.06] dark:text-slate-400 lg:inline-flex">
    Khám phá
  </span>

  <SortChip
    active={mainSort === 'all'}
    onClick={() => selectMainSort('all')}
  >
    Tất cả
  </SortChip>

  <div className="relative shrink-0">
    <SortChip
      active={mainSort === 'subject'}
      onClick={(event) => {
        event.stopPropagation()
        setShowSubjectMenu((value) => !value)
        setShowOtherMenu(false)
        setShowTypeMenu(false)
        setShowClassMenu(false)
        setMainSort('subject')
      }}
    >
      <span className="inline-flex items-center justify-center gap-2">
        <span className="max-w-[140px] truncate">
          {subjectSort !== 'All' ? subjectSort : 'Môn học'}
        </span>

        <span
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] transition-transform duration-200 ${
            mainSort === 'subject'
              ? 'bg-white/15 text-white'
              : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'
          } ${showSubjectMenu ? 'rotate-180' : ''}`}
        >
          ⌄
        </span>
      </span>
    </SortChip>

    {showSubjectMenu && (
      <ResponsiveSortMenu onClose={() => setShowSubjectMenu(false)} widthClass="sm:w-72">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
            Chọn môn học
          </p>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {subjects.map((subject) => (
            <button
              key={subject}
              type="button"
              onClick={() => {
                setSubjectSort(subject)
                setMainSort('subject')
                setShowSubjectMenu(false)
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                subjectSort === subject
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10'
              }`}
            >
              <span>{subject}</span>

              {subjectSort === subject && (
                <span className="text-xs font-black">✓</span>
              )}
            </button>
          ))}
        </div>
      </ResponsiveSortMenu>
    )}
  </div>

  <div className="relative shrink-0">
    <SortChip
      active={mainSort === 'other'}
      onClick={(event) => {
        event.stopPropagation()
        setShowOtherMenu((value) => !value)
        setShowSubjectMenu(false)
        setShowTypeMenu(false)
        setShowClassMenu(false)
        setMainSort('other')
      }}
    >
      <span className="inline-flex items-center justify-center gap-2">
        <span>{otherSort !== 'all' ? otherSort : 'Khác'}</span>

        <span
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] transition-transform duration-200 ${
            mainSort === 'other'
              ? 'bg-white/15 text-white'
              : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'
          } ${showOtherMenu ? 'rotate-180' : ''}`}
        >
          ⌄
        </span>
      </span>
    </SortChip>

    {showOtherMenu && (
      <ResponsiveSortMenu onClose={() => setShowOtherMenu(false)} widthClass="sm:w-52">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
            Nhóm khác
          </p>
        </div>

        <div className="p-2">
          {['ĐGNL', 'THPT'].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setOtherSort(option)
                setMainSort('other')
                setShowOtherMenu(false)
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                otherSort === option
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10'
              }`}
            >
              <span>{option}</span>

              {otherSort === option && (
                <span className="text-xs font-black">✓</span>
              )}
            </button>
          ))}
        </div>
      </ResponsiveSortMenu>
    )}
  </div>

  <div className="relative shrink-0">
    <SortChip active={typeSort !== 'all'} onClick={(event) => { event.stopPropagation(); setShowTypeMenu((value) => !value); setShowSubjectMenu(false); setShowOtherMenu(false); setShowClassMenu(false) }}>
      <span className="inline-flex items-center gap-2"><span>{typeSort === 'video' ? 'Video' : typeSort === 'document' ? 'Tài liệu' : typeSort === 'simulation' ? 'Mô phỏng' : 'Loại'}</span><span className={`text-[11px] transition-transform ${showTypeMenu ? 'rotate-180' : ''}`}>⌄</span></span>
    </SortChip>
    {showTypeMenu && <ResponsiveSortMenu onClose={() => setShowTypeMenu(false)} widthClass="sm:w-52" contentClassName="p-2">
      {[['all','Tất cả loại'],['video','Video'],['document','Tài liệu'],['simulation','Mô phỏng']].map(([value,label]) => <button key={value} type="button" onClick={() => { setTypeSort(value); setShowTypeMenu(false) }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${typeSort===value?'bg-blue-600 text-white':'hover:bg-slate-100 dark:hover:bg-white/10'}`}><span>{label}</span>{typeSort===value&&<span>✓</span>}</button>)}
    </ResponsiveSortMenu>}
  </div>

  <div className="relative shrink-0">
    <SortChip active={homeClassSort !== 'All'} onClick={(event) => { event.stopPropagation(); setShowClassMenu((value) => !value); setShowTypeMenu(false); setShowSubjectMenu(false); setShowOtherMenu(false) }}>
      <span className="inline-flex items-center gap-2"><span>{homeClassSort === 'All' ? 'Lớp: Tất cả' : `Lớp ${homeClassSort}`}</span><span className={`text-[11px] transition-transform ${showClassMenu ? 'rotate-180' : ''}`}>⌄</span></span>
    </SortChip>
    {showClassMenu && <ResponsiveSortMenu onClose={() => setShowClassMenu(false)} widthClass="sm:w-48" contentClassName="p-2">
      {[['All','Tất cả'],['10','Lớp 10'],['11','Lớp 11'],['12','Lớp 12']].map(([value,label]) => <button key={value} type="button" onClick={() => { setHomeClassSort(value); setShowClassMenu(false) }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${homeClassSort===value?'bg-blue-600 text-white':'hover:bg-slate-100 dark:hover:bg-white/10'}`}><span>{label}</span>{homeClassSort===value&&<span>✓</span>}</button>)}
    </ResponsiveSortMenu>}
  </div>

  <span className="mx-1 hidden h-7 w-px shrink-0 bg-slate-200 dark:bg-white/10 sm:block" />

  <SortChip
    active={mainSort === 'recent'}
    onClick={() => selectMainSort('recent')}
  >
    Đăng gần đây
  </SortChip>

  <SortChip
    active={mainSort === 'watched'}
    onClick={() => selectMainSort('watched')}
  >
    Đã xem
  </SortChip>

  <SortChip
    active={mainSort === 'new'}
    onClick={() => selectMainSort('new')}
  >
    Đề xuất mới
  </SortChip>
</div>
            )}
          </header>

          {activeLibrarySection === 'account' ? (
            <AccountPanel profile={teacherProfile} followerHistory={followerHistory} user={currentUser} role={role} classes={teacherClasses} courses={coursesWithProgress} stats={learningDashboardStats} canManageCourse={canManageCourse} teacherProfilesById={teacherProfilesById} openMenuId={openCourseMenuId} onToggleMenu={setOpenCourseMenuId} onOpen={openCourse} onUpdate={openUpdateModal} onDelete={handleDeleteCourse} onCopy={copyCourseLink} onReport={setReportTarget} onSave={setSaveCourseTarget} onUnsave={unsaveCourse} unsavingCourseId={unsavingCourseId} onOpenChannel={(course) => openPresenterChannel(course.teacherId||course.createdByUid||course.createdBy, {fullName:course.teacherName,photoURL:course.teacherAvatar})} playlists={myPlaylists} onOpenPlaylist={setPlaylistPreview} onCreatePlaylist={() => setPlaylistModalOpen(true)} onEditPlaylist={setEditingPlaylist} savedLists={savedLists} onOpenSavedList={setSavedListPreview} onCreateSavedList={() => setSavedListModalOpen(true)} onImportSavedList={() => setImportSavedListOpen(true)} onEditSavedList={setEditingSavedList} onShareSavedList={async (list)=>{setShareSavedListTarget(list);await ensureSavedListShareCode(list)}} onDeleteSavedList={deleteSavedList} reports={reports} reportsLoading={reportsLoading} />
          ) : activeLibrarySection === 'saved' ? (
            <SavedLibraryPanel courses={rightFilteredCourses} teacherProfilesById={teacherProfilesById} savedLists={savedLists} sort={savedSort} setSort={setSavedSort} onOpen={openCourse} onOpenChannel={(course) => openPresenterChannel(course.teacherId||course.createdByUid||course.createdBy||course.ownerId||course.userId||course.uid, {fullName:course.teacherName,photoURL:course.teacherAvatar})} onUnsave={unsaveCourse} unsavingCourseId={unsavingCourseId} onOpenSavedList={setSavedListPreview} onCreateSavedList={() => setSavedListModalOpen(true)} onImportSavedList={() => setImportSavedListOpen(true)} onEditSavedList={setEditingSavedList} onShareSavedList={async (list)=>{setShareSavedListTarget(list);await ensureSavedListShareCode(list)}} onDeleteSavedList={deleteSavedList} />
          ) : activeLibrarySection === 'channel' && selectedChannel ? (
            <PresenterChannel profile={selectedChannel.profile} channelId={selectedChannel.id} currentUserId={currentUser?.uid} onAvatarClick={() => openPresenterChannel(selectedChannel.id, selectedChannel.profile)} isFollowing={followingAccounts.some((item) => String(item.id) === String(selectedChannel.id))} playlists={channelPlaylists} courses={courses.filter((course) => String(course.status || course.moderationStatus || 'approved').toLowerCase() === 'approved' && String(course.visibility || 'public').toLowerCase() !== 'class' && [course.teacherId, course.createdByUid, course.createdBy].filter(Boolean).map(String).includes(String(selectedChannel.id)))} onBack={() => handleSidebarSelection('home')} onOpen={openCourse} onToggleFollow={toggleFollowChannel} onReport={(payload) => setChannelReportTarget(payload)} onOpenPlaylist={playPlaylist} />
          ) : activeLibrarySection === 'following' ? (
            <FollowingAccountsPanel accounts={followingAccounts} onOpen={openFollowingAccount} />
          ) : activeLibrarySection === 'notifications' ? (
            <NotificationCenter notifications={visibleNotifications} onRead={markNotificationRead} onDelete={deleteNotification} onClearAll={clearAllNotifications} onOpenCourse={(id)=>id&&navigate(`/e-learning/${id}`)} />
          ) : activeLibrarySection === 'manage' && isAdminDev ? (
            <AdminManagementPanel activeTab={adminTab} setActiveTab={setAdminTab} courses={courses.filter(
              (course) =>
                String(course.visibility || 'public').toLowerCase() !== 'class'
            )} reports={adminReports} commentReports={adminCommentReports} users={adminUsers} loading={adminLoading} onApprove={(course) => updateCourseModeration(course, 'approved')} onReject={handleRejectCourse} onOpen={openCourse} onDeleteCourse={handleDeleteCourse} onResolveReport={setResolveReportTarget} onDeleteReportedCourse={setDeleteReportedCourseTarget} onResolveCommentReport={handleCommentReportStatus} onOpenComment={openReportedComment} onDeleteComment={handleDeleteReportedComment} onWarnComment={handleWarnReportedComment} onBlock={setBlockTarget} onWarn={setWarningTarget} onVerify={async (user) => { const nextVerified=!Boolean(user.elearningVerified); await eLearningApi.updateUser(user.id, { elearningVerified: nextVerified, elearningVerifiedAt: nextVerified ? new Date().toISOString() : null, elearningVerifiedBy: nextVerified ? getCurrentUserId(currentUser) : '' }); await pushNotification(user.id, { title: nextVerified ? 'Bạn đã được cấp xác nhận' : 'Xác nhận đã được thu hồi', message: nextVerified ? 'Tài khoản của bạn đã có dấu tick xanh trong thư viện E-learning.' : 'Dấu xác nhận E-learning của tài khoản đã được thu hồi.', type: 'verified' }); await fetchAdminData() }} onOpenUser={(user) => openPresenterChannel(user.id, user)} onResolveViolation={(report) => handleReportStatus(report, 'resolved')} onUnblock={async (user) => { await eLearningApi.updateUser(user.id, { elearningPostingBlock: { ...(user.elearningPostingBlock || {}), active: false, unblockedBy: getCurrentUserId(currentUser), unblockedAt: new Date().toISOString() } }); await fetchAdminData() }} />
          ) : (
            <>
          {activeLibrarySection === 'home' && (
            <section className="py-3 sm:py-5">
              {canCreateELearning && (
                <div className="relative isolate overflow-hidden rounded-[20px] border border-cyan-300/50 bg-slate-950 px-4 py-4 text-white shadow-[0_14px_40px_rgba(8,47,73,0.28)] sm:hidden">
                  <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.30),transparent_38%),radial-gradient(circle_at_85%_80%,rgba(124,58,237,0.34),transparent_42%),linear-gradient(135deg,#07111f_0%,#0b2340_52%,#22164f_100%)]" />
                  <div className="pointer-events-none absolute inset-0 -z-10 opacity-25 [background-image:linear-gradient(rgba(103,232,249,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(103,232,249,0.18)_1px,transparent_1px)] [background-size:22px_22px]" />
                  <div className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full border border-cyan-200/20" />
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">ZUNY Creator</p>
                      <p className="mt-1 truncate text-sm font-black text-white">Chia sẻ bài học của bạn</p>
                    </div>
                    <button type="button" onClick={() => setShowCreateTypeMenu(true)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-cyan-200/40 bg-white px-4 py-2.5 text-sm font-black text-blue-700 shadow-lg shadow-black/20 transition active:scale-[0.97]" aria-haspopup="dialog" aria-expanded={showCreateTypeMenu}><PlusIcon /> Đăng bài</button>
                  </div>
                </div>
              )}

              <div className="relative isolate hidden min-h-[220px] overflow-hidden rounded-[1.35rem] border border-blue-200 bg-white p-4 text-slate-950 shadow-xl shadow-blue-900/10 dark:border-white/10 dark:bg-[#0f1b36] dark:text-white dark:shadow-2xl dark:shadow-slate-950/20 sm:block sm:min-h-[250px] sm:rounded-[2rem] sm:p-8 lg:min-h-[280px] lg:p-10">
                <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_15%_20%,rgba(56,189,248,0.22),transparent_35%),radial-gradient(circle_at_85%_25%,rgba(139,92,246,0.20),transparent_32%),linear-gradient(135deg,#eff6ff_0%,#dbeafe_48%,#ede9fe_100%)] dark:bg-[radial-gradient(circle_at_15%_20%,rgba(56,189,248,0.28),transparent_35%),radial-gradient(circle_at_85%_25%,rgba(139,92,246,0.32),transparent_32%),linear-gradient(135deg,#10224b_0%,#183b80_48%,#3d2d82_100%)]" />
                <div className="pointer-events-none absolute -left-20 bottom-[-110px] -z-10 h-72 w-72 rounded-full border border-white/10 bg-white/5 blur-sm" />
                <div className="pointer-events-none absolute right-10 top-8 -z-10 text-[150px] font-black leading-none text-white/[0.045]">“</div>

                <div className="flex min-h-[190px] flex-col justify-between gap-8 lg:flex-row lg:items-end">
                  <div className="max-w-4xl">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/10 text-xl backdrop-blur">✦</span>
                      <div><p className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-700 dark:text-cyan-100">Khu vực truyền cảm hứng</p></div>
                    </div>

                    <div className={`mt-7 transform transition-all duration-500 ease-out ${quoteVisible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}>
                      <blockquote className="max-w-4xl text-2xl font-black leading-tight tracking-[-0.02em] sm:text-3xl lg:text-[2.45rem] lg:leading-[1.18]">“{learningQuotes[quoteIndex].text}”</blockquote>
                      <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-blue-700 dark:text-blue-100"><span className="font-black text-slate-950 dark:text-white">{learningQuotes[quoteIndex].author}</span><span className="text-white/35">•</span><span>{learningQuotes[quoteIndex].origin}</span></div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-start gap-4 lg:items-end">
                    <button type="button" onClick={() => lessonsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="hidden items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-blue-700 shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-blue-50 sm:inline-flex"><SearchIcon /> Khám phá bài học</button>
                    <div className="flex items-center gap-2">{learningQuotes.map((_, index) => <button key={index} type="button" onClick={() => { setQuoteVisible(false); window.setTimeout(() => { setQuoteIndex(index); setQuoteVisible(true) }, 220) }} className={`h-2 rounded-full transition-all ${quoteIndex === index ? 'w-7 bg-white' : 'w-2 bg-white/35 hover:bg-white/65'}`} aria-label={`Hiển thị câu nói ${index + 1}`} />)}</div>
                  </div>
                </div>

                <div key={quoteIndex} className="absolute inset-x-0 bottom-0 h-1 origin-left bg-gradient-to-r from-cyan-300 via-blue-300 to-violet-300" style={{ animation: 'quoteCountdown 30s linear forwards' }} />
                <style>{`@keyframes quoteCountdown { from { transform: scaleX(0); } to { transform: scaleX(1); } }`}</style>
              </div>
            </section>
          )}

          {activeLibrarySection === 'watched' && (
            <section className="py-3 sm:py-5">
              <div className="relative isolate overflow-hidden rounded-[20px] sm:rounded-[28px] border border-cyan-200/80 bg-[#f8fbff] p-4 text-slate-950 shadow-[0_18px_55px_rgba(14,116,144,0.12)] sm:p-7 lg:p-8 dark:border-cyan-400/20 dark:bg-[#07111f] dark:text-white dark:shadow-[0_22px_65px_rgba(0,0,0,0.38)]">
                <div className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(120deg,rgba(236,254,255,0.96)_0%,rgba(239,246,255,0.94)_48%,rgba(245,243,255,0.96)_100%)] dark:bg-[linear-gradient(120deg,#07111f_0%,#0b2340_48%,#17143a_100%)]" />
                <div className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background-image:linear-gradient(rgba(14,116,144,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(14,116,144,0.08)_1px,transparent_1px)] [background-size:28px_28px] dark:opacity-25 dark:[background-image:linear-gradient(rgba(103,232,249,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(103,232,249,0.18)_1px,transparent_1px)]" />
                <div className="pointer-events-none absolute -right-20 -top-24 -z-10 h-72 w-72 rounded-full bg-cyan-300/35 blur-3xl dark:bg-cyan-400/15" />
                <div className="pointer-events-none absolute -bottom-28 left-[38%] -z-10 h-64 w-64 rounded-full bg-violet-300/30 blur-3xl dark:bg-violet-500/15" />

                <div className="relative flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 max-w-4xl">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/70 bg-white/80 text-xl text-cyan-700 shadow-sm backdrop-blur dark:border-cyan-300/20 dark:bg-white/[0.08] dark:text-cyan-200">◉</span>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-300">Đã xem gần đây</p>
                        <p className="mt-0.5 text-xs font-bold text-slate-500 dark:text-slate-400">Tiếp tục đúng bài bạn đã từng mở và đang học</p>
                      </div>
                    </div>

                    <h2 className="mt-4 max-w-3xl text-xl font-black leading-tight tracking-[-0.025em] sm:text-3xl lg:text-[2.15rem]">
                      {suggestedCourse ? stripHtml(suggestedCourse.title) : ''}
                    </h2>

                    {suggestedCourse ? (
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <span className="rounded-full border border-cyan-200 bg-white/75 px-3 py-1.5 text-xs font-black text-cyan-700 backdrop-blur dark:border-cyan-300/20 dark:bg-white/[0.07] dark:text-cyan-200">Đã hoàn thành {Math.round(Number(suggestedCourse.progress || 0))}%</span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Lần xem gần nhất: {new Date(getAnyTime(suggestedCourse.lastViewedAt) || Date.now()).toLocaleDateString('vi-VN')}</span>
                      </div>
                    ) : (
                      <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300"></p>
                    )}

                    {suggestedCourse && <div className="mt-5 h-2 max-w-2xl overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 shadow-[0_0_18px_rgba(34,211,238,0.55)] transition-all" style={{ width: `${Math.max(2, Math.min(100, Number(suggestedCourse.progress || 0)))}%` }} /></div>}
                  </div>

                  <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
                    {suggestedCourse ? (
                      <button type="button" onClick={() => openCourse(suggestedCourse)} className="group inline-flex w-full sm:min-w-[190px] sm:w-auto items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-cyan-900/15 transition hover:-translate-y-0.5 hover:bg-cyan-700 dark:bg-white dark:text-slate-950 dark:hover:bg-cyan-100"><PlayIcon /><span>Tiếp tục học</span><span className="transition group-hover:translate-x-1">→</span></button>
                    ) : (
                      <button type="button" onClick={() => handleSidebarSelection('home')} className="inline-flex w-full sm:min-w-[190px] sm:w-auto items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3.5 text-sm font-black text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-cyan-700 dark:bg-white dark:text-slate-950 dark:hover:bg-cyan-100"><SearchIcon /> Khám phá bài học</button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {learningError && <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">{learningError}</div>}

          {activeLibrarySection === 'home' && featuredCourses.length > 0 && (
            <VideoSection title="Nổi bật" subtitle="Các bài học được quan tâm và đánh giá cao">
              <VideoGrid>
                {featuredCourses.map((course) => (
                  <VideoCourseCard key={`featured-${course.id}`} course={course} canManage={canManageCourse(course)} teacherProfilesById={teacherProfilesById} openMenuId={openCourseMenuId} onToggleMenu={setOpenCourseMenuId} onOpen={openCourse} onUpdate={openUpdateModal} onDelete={handleDeleteCourse} onCopy={copyCourseLink} onReport={setReportTarget} onSave={setSaveCourseTarget} onOpenChannel={(course) => openPresenterChannel(course.teacherId||course.createdByUid||course.createdBy, {fullName:course.teacherName,photoURL:course.teacherAvatar})} featured />
                ))}
              </VideoGrid>
            </VideoSection>
          )}

          <VideoSection title={activeSectionContent.title} subtitle={activeSectionContent.subtitle} sectionRef={lessonsRef}>
            {loading ? (
              <VideoGrid>{Array.from({ length: 8 }).map((_, index) => <VideoSkeleton key={index} />)}</VideoGrid>
            ) : rightFilteredCourses.length > 0 ? (
              <VideoGrid>
                {rightFilteredCourses.map((course) => (
                  <VideoCourseCard key={course.id} course={course} canManage={canManageCourse(course)} teacherProfilesById={teacherProfilesById} openMenuId={openCourseMenuId} onToggleMenu={setOpenCourseMenuId} onOpen={openCourse} onUpdate={openUpdateModal} onDelete={handleDeleteCourse} onCopy={copyCourseLink} onReport={setReportTarget} onSave={setSaveCourseTarget} onOpenChannel={(course) => openPresenterChannel(course.teacherId||course.createdByUid||course.createdBy, {fullName:course.teacherName,photoURL:course.teacherAvatar})} />
                ))}
              </VideoGrid>
            ) : (
              <EmptyLibraryState canCreate={canCreateELearning} search={search} onReset={resetRightFilters} onCreate={() => { if (typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches) setShowCreateTypeMenu(true); else requestCreateModal('video') }} />
            )}
          </VideoSection>
            </>
          )}
        </main>
      </div>

      {showCreateTypeMenu && typeof document !== 'undefined' && createPortal(
        <div data-create-type-portal className="fixed inset-0 z-[500] flex items-end bg-slate-950/60 p-3 backdrop-blur-sm sm:hidden" onClick={() => { setShowCreateTypeMenu(false); if (classCreatePreset) setClassCreatePreset(null) }}>
          <div role="dialog" aria-modal="true" aria-labelledby="mobile-create-type-title" className="w-full min-w-0 max-h-[calc(100dvh-24px)] overflow-y-auto rounded-[26px] border border-slate-200 bg-white p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-2xl dark:border-white/10 dark:bg-[#111827]" onClick={(event) => event.stopPropagation()}>
            <div className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-white/10">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">Đăng bài E-learning</p>
                <h2 id="mobile-create-type-title" className="mt-1 break-words text-xl font-black text-slate-950 dark:text-white">Bạn muốn đăng loại nội dung nào?</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Chọn một loại để mở đúng biểu mẫu đăng bài hiện tại.</p>
              </div>
              <button type="button" onClick={() => { setShowCreateTypeMenu(false); if (classCreatePreset) setClassCreatePreset(null) }} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 transition active:scale-95 dark:bg-white/10 dark:text-slate-200" aria-label="Đóng chọn loại bài đăng"><CloseIcon /></button>
            </div>

            <div className="mt-3 grid gap-2">
              <button type="button" onClick={() => requestCreateModal('video')} className="flex min-w-0 items-center gap-3 rounded-2xl border border-red-100 bg-red-50/70 p-3 text-left transition active:scale-[0.99] dark:border-red-500/20 dark:bg-red-500/10">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-600 text-white shadow-sm"><PlayIcon filled /></span>
                <span className="min-w-0 flex-1"><span className="block break-words text-sm font-black text-slate-950 dark:text-white">Video</span><span className="mt-0.5 block break-words text-xs leading-5 text-slate-500 dark:text-slate-400">YouTube, MP4 hoặc playlist bài giảng.</span></span>
                <span className="shrink-0 text-lg text-slate-400">›</span>
              </button>
              <button type="button" onClick={() => requestCreateModal('document')} className="flex min-w-0 items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 text-left transition active:scale-[0.99] dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-xl font-black text-white shadow-sm">▤</span>
                <span className="min-w-0 flex-1"><span className="block break-words text-sm font-black text-slate-950 dark:text-white">Tài liệu</span><span className="mt-0.5 block break-words text-xs leading-5 text-slate-500 dark:text-slate-400">Word, PDF và nội dung đọc học tập.</span></span>
                <span className="shrink-0 text-lg text-slate-400">›</span>
              </button>
              <button type="button" onClick={() => requestCreateModal('simulation')} className="flex min-w-0 items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50/70 p-3 text-left transition active:scale-[0.99] dark:border-violet-500/20 dark:bg-violet-500/10">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-600 text-xl text-white shadow-sm">🧪</span>
                <span className="min-w-0 flex-1"><span className="block break-words text-sm font-black text-slate-950 dark:text-white">Mô phỏng</span><span className="mt-0.5 block break-words text-xs leading-5 text-slate-500 dark:text-slate-400">Mô phỏng tương tác hoặc HTML/CSS/JS/TS.</span></span>
                <span className="shrink-0 text-lg text-slate-400">›</span>
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {showFilters && (
        <FilterModal
          rightSubjectFilter={rightSubjectFilter}
          setRightSubjectFilter={setRightSubjectFilter}
          rightClassFilter={rightClassFilter}
          setRightClassFilter={setRightClassFilter}
          rightFormatFilter={rightFormatFilter}
          setRightFormatFilter={setRightFormatFilter}
          rightProgressFilter={rightProgressFilter}
          setRightProgressFilter={setRightProgressFilter}
          rightExamFilter={rightExamFilter}
          setRightExamFilter={setRightExamFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          teacherClasses={teacherClasses}
          resultCount={rightFilteredCourses.length}
          onApply={() => { applyRightFilter(); setShowFilters(false) }}
          onReset={resetRightFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      {showCreateForm && (
        <CourseFormModal
          form={form}
          setForm={setForm}
          editingCourse={editingCourse}
          contentType={createContentType}
          teacherClasses={teacherClasses}
          participatingClasses={participatingClasses}
          uploadingWord={uploadingWord}
          uploadingVideo={uploadingVideo}
          uploadingImage={uploadingImage}
          lessonsRef={lessonsRef}
          publisherName={currentTeacherName}
          onClose={() => { setShowCreateForm(false); setEditingCourse(null); if (editingCourse) setForm(getEmptyForm(teacherSubject)) }}
          onReset={resetCreateCourseForm}
          onSubmit={editingCourse ? handleUpdateCourse : handleCreateCourse}
          onWordUpload={handleWordUpload}
          onVideoUpload={handleVideoUpload}
          onImageUpload={handleImageUpload}
        />
      )}

      {deleteTarget && <ConfirmModal title="Xóa vĩnh viễn bài học?" courseTitle={stripHtml(deleteTarget.title)} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDeleteCourse} />}
      {showAchievement && <AchievementModal achievement={achievement} stats={learningDashboardStats} onClose={() => setShowAchievement(false)} />}
      {copySuccessCourse && <CopySuccessModal course={copySuccessCourse} onClose={() => setCopySuccessCourse(null)} />}
      {submissionNotice && <SubmissionSuccessModal mode={submissionNotice} onClose={() => setSubmissionNotice(false)} />}
      {reportTarget && <CourseReportModal course={reportTarget} onClose={() => setReportTarget(null)} onSubmit={submitCourseReport} />}
      {reportNotice && <ReportNoticeModal notice={reportNotice} onClose={() => setReportNotice(null)} />}
      {rejectCourseTarget && <ReasonModal title="Từ chối bài đăng" description="Nhập lý do để người đăng biết nội dung cần điều chỉnh." presets={["Nội dung chưa đầy đủ","Thông tin chưa chính xác","Tài liệu không phù hợp","Vi phạm quy định cộng đồng"]} confirmLabel="Xác nhận từ chối" tone="danger" onClose={() => setRejectCourseTarget(null)} onConfirm={({ reason, detail }) => confirmRejectCourse(detail ? `${reason}: ${detail}` : reason)} />}
      {resolveReportTarget && <ConfirmActionModal title="Xác nhận đã xử lý?" description="Báo cáo sẽ được đánh dấu đã xử lý và người dùng sẽ thấy trạng thái mới trong lịch sử báo cáo." confirmLabel="Xác nhận đã xử lý" onClose={() => setResolveReportTarget(null)} onConfirm={confirmResolveReport} />}
      {deleteReportedCourseTarget && <ReasonModal title="Xóa vĩnh viễn bài bị báo cáo" description="Bài học và dữ liệu liên quan sẽ bị xóa vĩnh viễn, không thể khôi phục." presets={["Nội dung nguy hiểm","Vi phạm bản quyền","Nội dung sai lệch","Spam hoặc lừa đảo","Vi phạm tiêu chuẩn cộng đồng"]} confirmLabel="Xóa vĩnh viễn" tone="danger" requireSecondConfirm onClose={() => setDeleteReportedCourseTarget(null)} onConfirm={confirmDeleteReportedCourse} />}
      {postingBlockNotice && <PostingBlockModal block={postingBlockNotice} onClose={() => setPostingBlockNotice(null)} />}
      {playlistModalOpen && <PlaylistCreateModal courses={coursesWithProgress.filter((course) => (canManageCourse(course) || course.bookmarked) && String(course.status || course.moderationStatus || 'approved').toLowerCase() === 'approved' && String(course.visibility || 'public').toLowerCase() !== 'class') } ownerId={currentUser?.uid} teacherProfilesById={teacherProfilesById} onClose={() => setPlaylistModalOpen(false)} onCreate={createPlaylist} />}
      {editingPlaylist && <PlaylistCreateModal initialPlaylist={editingPlaylist} courses={coursesWithProgress.filter((course) => canManageCourse(course) && String(course.status || course.moderationStatus || 'approved').toLowerCase() === 'approved' && String(course.visibility || 'public').toLowerCase() !== 'class') } ownerId={currentUser?.uid} teacherProfilesById={teacherProfilesById} onClose={() => setEditingPlaylist(null)} onCreate={(payload)=>updatePlaylist(editingPlaylist.id,payload)} />}
      {editingSavedList && <PlaylistCreateModal mode="saved" initialPlaylist={editingSavedList} courses={coursesWithProgress.filter((course) => course.bookmarked && String(course.status || course.moderationStatus || 'approved').toLowerCase() === 'approved' && String(course.visibility || 'public').toLowerCase() !== 'class') } ownerId={currentUser?.uid} teacherProfilesById={teacherProfilesById} onClose={() => setEditingSavedList(null)} onCreate={(payload)=>updateSavedList(editingSavedList.id,payload)} />}
      {savedListModalOpen && <PlaylistCreateModal mode="saved" courses={coursesWithProgress.filter((course) => course.bookmarked && String(course.status || course.moderationStatus || 'approved').toLowerCase() === 'approved' && String(course.visibility || 'public').toLowerCase() !== 'class') } ownerId={currentUser?.uid} teacherProfilesById={teacherProfilesById} onClose={() => setSavedListModalOpen(false)} onCreate={createSavedList} />}
      {savedListPreview && <PlaylistPreviewModal playlist={savedListPreview} courses={courses.filter((course) => String(course.visibility || 'public').toLowerCase() !== 'class')} onClose={() => setSavedListPreview(null)} onOpen={(course) => { setSavedListPreview(null); openCourse(course) }} onEdit={String(savedListPreview.ownerId||'')===String(currentUser?.uid||'')?(list)=>{setSavedListPreview(null);setEditingSavedList(list)}:undefined} />}
      {playlistPreview && <PlaylistPreviewModal playlist={playlistPreview} courses={courses.filter((course) => String(course.visibility || 'public').toLowerCase() !== 'class')} onClose={() => setPlaylistPreview(null)} onOpen={(course) => { setPlaylistPreview(null); openCourse(course) }} onPlayAll={playPlaylist} onRemoveCourse={String(playlistPreview.ownerId||'')===String(currentUser?.uid||'')?(courseId)=>removeCourseFromPlaylist(playlistPreview,courseId):undefined} onEdit={String(playlistPreview.ownerId||'')===String(currentUser?.uid||'')?(playlist)=>{setPlaylistPreview(null);setEditingPlaylist(playlist)}:undefined} />}
      {shareSavedListTarget && <SavedListShareModal list={shareSavedListTarget} onClose={()=>setShareSavedListTarget(null)} />}
      {deleteSavedListTarget && <SavedListDeleteModal list={deleteSavedListTarget} onClose={()=>setDeleteSavedListTarget(null)} onConfirm={confirmDeleteSavedList} />}
      {deletedSavedListNotice && <SuccessNoticeModal icon="🗑️" title="Đã xóa danh sách lưu" description={`“${deletedSavedListNotice.title}” đã được xóa. Các bài học gốc vẫn được giữ nguyên.`} onClose={()=>setDeletedSavedListNotice(null)} />}
      {importSavedListOpen && <ImportSavedListModal onClose={()=>setImportSavedListOpen(false)} onImport={importSavedListByCode} />}
      {saveCourseTarget && <SaveCourseModal course={saveCourseTarget} savedLists={savedLists} onClose={()=>setSaveCourseTarget(null)} onSaveSeparate={()=>saveCourseToDestination(saveCourseTarget,null)} onSaveToList={(list)=>saveCourseToDestination(saveCourseTarget,list)} onCreateList={()=>{setSaveCourseTarget(null);setSavedListModalOpen(true)}} />}
      {deleteSuccessNotice && <SuccessNoticeModal icon="🗑️" title="Đã xóa bài học" description={`“${deleteSuccessNotice.title}” đã được xóa khỏi thư viện.`} onClose={()=>setDeleteSuccessNotice(null)} />}
      {saveSuccessNotice && <SuccessNoticeModal icon={saveSuccessNotice.destination==='removed'?'☆':'★'} title={saveSuccessNotice.destination==='removed'?'Đã hủy lưu bài học':'Đã lưu bài học'} description={saveSuccessNotice.destination==='removed'?`“${saveSuccessNotice.courseTitle}” đã được gỡ khỏi bài đã lưu và các danh sách lưu.`:`“${saveSuccessNotice.courseTitle}” đã được lưu vào ${saveSuccessNotice.destination}.`} onClose={()=>setSaveSuccessNotice(null)} />}
      {channelReportTarget && <ChannelReportModal channel={channelReportTarget} onClose={() => setChannelReportTarget(null)} onSubmit={submitChannelReport} />}
      {postingWarningNotice && <PostingWarningModal warning={postingWarningNotice} onClose={() => setPostingWarningNotice(null)} onConfirm={async () => { if (currentUser?.uid) await eLearningApi.updateUser(getCurrentUserId(currentUser), { elearningPostingWarning: { ...(teacherProfile?.elearningPostingWarning || {}), acknowledgedAt: new Date().toISOString() } }); const type=postingWarningNotice.requestedType||''; const preset=postingWarningNotice.requestedPreset||null; setTeacherProfile((prev)=>({...prev,elearningPostingWarning:{...(prev?.elearningPostingWarning||{}),acknowledgedAt:new Date().toISOString()}})); setPostingWarningNotice(null); if (type) openCreateModal(type,preset) }} />}
      {blockTarget && <UserActionModal user={blockTarget} mode="block" onClose={() => setBlockTarget(null)} onSave={async ({reason,startAt,endAt}) => { await eLearningApi.updateUser(blockTarget.id, { elearningPostingBlock:{active:true,reason,startAt:new Date(`${startAt}T00:00:00`).toISOString(),endAt:new Date(`${endAt}T23:59:59`).toISOString(),blockedBy:getCurrentUserId(currentUser),createdAt:new Date().toISOString()} }); setBlockTarget(null); await fetchAdminData() }} />}
      {warningTarget && <UserActionModal user={warningTarget} mode="warning" onClose={() => setWarningTarget(null)} onSave={async ({reason}) => { const count=Math.max(1,adminReports.filter((report)=>String(report.reportedUserId||report.courseOwnerId||'')===String(warningTarget.id)).length); await eLearningApi.updateUser(warningTarget.id, { elearningPostingWarning:{active:true,reason,count,acknowledgedAt:null,warnedBy:getCurrentUserId(currentUser),createdAt:new Date().toISOString()} }); setWarningTarget(null); await fetchAdminData() }} />}
    </div>
  )
}


















































function CopySuccessModal({ course, onClose }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 2200)
    return () => window.clearTimeout(timer)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-3xl border border-white/10 bg-white p-6 text-center shadow-2xl dark:bg-[#171717]">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-blue-100 text-5xl shadow-inner dark:bg-blue-500/15">👍</div>
        <h2 className="mt-5 text-2xl font-black text-slate-950 dark:text-white">Đã copy liên kết!</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">Liên kết của “{stripHtml(course?.title)}” đã nằm gọn trong clipboard. Gửi ngay cho hội bạn học thôi 😎</p>
        <button type="button" onClick={onClose} className="mt-5 rounded-full bg-blue-600 px-6 py-2.5 text-sm font-black text-white hover:bg-blue-700">Tuyệt vời</button>
      </div>
    </div>
  )
}

function SubmissionSuccessModal({ onClose, mode = 'review' }) {
  const directClass = mode === 'class'
  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl dark:bg-[#171717]">
        <div className={`mx-auto grid h-20 w-20 place-items-center rounded-full text-4xl ${directClass ? 'bg-emerald-100 dark:bg-emerald-500/15' : 'bg-amber-100 dark:bg-amber-500/15'}`}>{directClass ? '✓' : '📨'}</div>
        <h2 className="mt-5 text-2xl font-black text-slate-950 dark:text-white">{directClass ? 'Đã đăng vào lớp' : 'Đã gửi quản trị viên'}</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{directClass ? 'Bài học đã được xuất bản trực tiếp trong Học liệu của lớp được chọn, không cần chờ duyệt và không xuất hiện ở thư viện E-learning bên ngoài lớp.' : 'Bài đăng của bạn đã được gửi đến quản trị viên. Vui lòng đợi duyệt trước khi nội dung xuất hiện công khai trong thư viện.'}</p>
        <button type="button" onClick={onClose} className="mt-6 w-full rounded-full bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700">Đã hiểu</button>
      </div>
    </div>
  )
}

function ReportNoticeModal({ notice, onClose }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 2600)
    return () => window.clearTimeout(timer)
  }, [onClose])

  const icon = notice?.type === 'success' ? '✅' : notice?.type === 'duplicate' ? '🛡️' : '⚠️'
  const iconClass = notice?.type === 'success'
    ? 'bg-emerald-100 dark:bg-emerald-500/15'
    : notice?.type === 'duplicate'
      ? 'bg-blue-100 dark:bg-blue-500/15'
      : 'bg-rose-100 dark:bg-rose-500/15'

  return (
    <div className="fixed inset-0 z-[1100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-white/10 dark:bg-[#171717]">
        <div className={`mx-auto grid h-20 w-20 place-items-center rounded-full text-4xl ${iconClass}`}>{icon}</div>
        <h2 className="mt-5 text-2xl font-black text-slate-950 dark:text-white">{notice?.title}</h2>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">{notice?.message}</p>
        <button type="button" onClick={onClose} className="mt-5 rounded-full bg-blue-600 px-6 py-2.5 text-sm font-black text-white transition hover:bg-blue-700">Đã hiểu</button>
      </div>
    </div>
  )
}

const reportReasons = [
  'Nội dung khiêu dâm',
  'Nội dung bạo lực hoặc phản cảm',
  'Nội dung kích động thù địch hoặc lạm dụng',
  'Hành động gây hại hoặc nguy hiểm',
  'Nội dung rác hoặc gây hiểu lầm',
  'Vi phạm bản quyền',
  'Khác',
]

function CourseReportModal({ course, onClose, onSubmit }) {
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!reason) return
    if (reason === 'Khác' && !detail.trim()) return
    setSubmitting(true)
    try {
      await onSubmit({ reason, detail })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-[#202020]">
        <div className="border-b border-slate-200 px-6 py-5 dark:border-white/10">
          <h2 className="text-xl font-black text-slate-950 dark:text-white">Báo cáo nội dung bài học</h2>
          <p className="mt-1 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">{stripHtml(course?.title)}</p>
        </div>
        <div className="max-h-[65vh] space-y-2 overflow-y-auto p-5">
          {reportReasons.map((item) => (
            <label key={item} className={`flex cursor-pointer items-center gap-4 rounded-2xl border px-4 py-3 transition ${reason === item ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-transparent hover:bg-slate-100 dark:hover:bg-white/[0.06]'}`}>
              <input type="radio" name="report-reason" checked={reason === item} onChange={() => setReason(item)} className="h-5 w-5 accent-blue-600" />
              <span className="font-semibold text-slate-800 dark:text-slate-100">{item}</span>
            </label>
          ))}
          {reason === 'Khác' && <textarea value={detail} onChange={(event) => setDetail(event.target.value)} rows="4" placeholder="Mô tả chi tiết nội dung cần kiểm tra..." className="mt-3 w-full rounded-2xl border border-slate-300 bg-transparent px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-white/15 dark:text-white" />}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-white/10">
          <button type="button" onClick={onClose} className="rounded-full px-5 py-2.5 text-sm font-black hover:bg-slate-100 dark:hover:bg-white/10">Hủy</button>
          <button type="button" disabled={!reason || submitting || (reason === 'Khác' && !detail.trim())} onClick={handleSubmit} className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Đang gửi...' : 'Báo vi phạm'}</button>
        </div>
      </div>
    </div>
  )
}

function ManagementCourseVisual({ course }) {
  const format = getCourseFormat(course)
  if (course.thumbnail) {
    return <img src={course.thumbnail} alt={stripHtml(course.title) || 'Ảnh bài đăng'} className="h-full w-full object-cover" />
  }

  const visual = format === 'document'
    ? { icon: '📄', label: 'TÀI LIỆU', classes: 'from-emerald-500 via-teal-600 to-cyan-700' }
    : format === 'simulation'
      ? { icon: '🧪', label: 'MÔ PHỎNG', classes: 'from-violet-600 via-purple-700 to-indigo-800' }
      : { icon: '▶', label: course.lumiUrl ? 'LUMI' : 'VIDEO', classes: 'from-red-500 via-rose-600 to-fuchsia-700' }

  return <div className={`relative grid h-full w-full place-items-center overflow-hidden bg-gradient-to-br ${visual.classes} text-white`}><span className="absolute -right-5 -top-8 text-8xl font-black text-white/10">{visual.icon}</span><div className="relative text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/25 bg-white/15 text-3xl shadow-xl backdrop-blur">{visual.icon}</span><span className="mt-2 block text-[10px] font-black tracking-[0.18em] text-white/90">{visual.label}</span></div></div>
}

function AdminManagementPanel({ activeTab, setActiveTab, courses, reports, commentReports = [], users = [], loading, onApprove, onReject, onOpen, onDeleteCourse, onResolveReport, onDeleteReportedCourse, onResolveCommentReport, onOpenComment, onDeleteComment, onWarnComment, onBlock, onWarn, onVerify, onUnblock, onOpenUser, onResolveViolation }) {
  const [queryText, setQueryText] = useState('')
  const [page, setPage] = useState(1)
  const [commentWarningTarget, setCommentWarningTarget] = useState(null)
  const [commentWarningReason, setCommentWarningReason] = useState('Ngôn từ không phù hợp')
  const [commentWarningDetail, setCommentWarningDetail] = useState('')
  const [commentWarningSubmitting, setCommentWarningSubmitting] = useState(false)
  const commentWarningReasons = ['Ngôn từ không phù hợp', 'Quấy rối hoặc xúc phạm', 'Spam hoặc quảng cáo', 'Thông tin sai lệch', 'Vi phạm quy tắc cộng đồng', 'Lý do khác']
  const pageSize = 8
  useEffect(() => setPage(1), [activeTab, queryText])
  const keyword = queryText.trim().toLowerCase()
  const accountReports = reports
    .filter((report) => ['account', 'channel', 'user'].includes(String(report.reportType || '').toLowerCase()) || Boolean(report.reportedUserId))
    .map((report) => {
      const reportedUser = users.find((user) => String(user.id) === String(report.reportedUserId || '')) || {}
      return { ...report, reportedUser }
    })
  const contentReports = reports.filter((report) => !(['account', 'channel', 'user'].includes(String(report.reportType || '').toLowerCase()) || Boolean(report.reportedUserId)))
  const source = activeTab === 'posts' ? courses : activeTab === 'reports' ? contentReports : activeTab === 'comments' ? commentReports : activeTab === 'violations' ? accountReports : users
  const filteredItems = source.filter((item) => !keyword || [item.title,item.courseTitle,item.teacherName,item.teacherEmail,item.reporterName,item.reporterEmail,item.reason,item.commentContent,item.commentUserName,item.fullName,item.name,item.email,item.schoolName,item.school].some((value)=>String(value||'').toLowerCase().includes(keyword)))
  const totalPages=Math.max(1,Math.ceil(filteredItems.length/pageSize)); const pageItems=filteredItems.slice((page-1)*pageSize,page*pageSize)
  const approvedCount=courses.filter(item=>String(item.status||item.moderationStatus||'approved').toLowerCase()==='approved').length
  const pendingCount=courses.filter(item=>String(item.status||item.moderationStatus||'').toLowerCase()==='pending').length
  const rejectedCount=courses.filter(item=>String(item.status||item.moderationStatus||'').toLowerCase()==='rejected').length
  const deletedCount=courses.filter(item=>String(item.status||item.moderationStatus||'').toLowerCase()==='deleted').length
  const resolvedReportCount=contentReports.filter(item=>String(item.status||'pending').toLowerCase()==='resolved').length
  const deletedReportCount=contentReports.filter(item=>String(item.status||'pending').toLowerCase()==='deleted').length
  const openReportCount=contentReports.filter(item=>!['resolved','deleted'].includes(String(item.status||'pending').toLowerCase())).length
  const openCommentReportCount=commentReports.filter(item=>!['resolved','deleted','warned'].includes(String(item.status||'pending').toLowerCase())).length
  return <section className="py-6 [&_button]:cursor-pointer"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Admin Dev</p><h1 className="mt-2 text-3xl font-black">Quản lý E-learning</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Duyệt bài, xử lý báo cáo và quản lý quyền đăng bài.</p></div><input value={queryText} onChange={e=>setQueryText(e.target.value)} placeholder="Tìm kiếm dữ liệu quản trị..." className="w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-white/10 dark:bg-white/[0.05]"/></div>
    <div className="mt-6 grid gap-4 lg:grid-cols-2"><ManagementDonut title="Thống kê bài đăng" total={courses.length} segments={[{label:'Đã duyệt',value:approvedCount,color:'#10b981'},{label:'Chờ duyệt',value:pendingCount,color:'#f59e0b'},{label:'Từ chối',value:rejectedCount,color:'#f43f5e'},{label:'Đã xóa',value:deletedCount,color:'#64748b'}]}/><ManagementDonut title="Thống kê báo cáo" total={contentReports.length} segments={[{label:'Chờ xử lý',value:openReportCount,color:'#f59e0b'},{label:'Đã xử lý',value:resolvedReportCount,color:'#10b981'},{label:'Đã xóa bài',value:deletedReportCount,color:'#f43f5e'}]}/></div>
    <div className="mt-7 flex gap-2 overflow-x-auto border-b border-slate-200 dark:border-white/10">{[['posts','Bài đăng',pendingCount],['reports','Báo cáo',openReportCount],['comments','Comment',openCommentReportCount],['violations','Tài khoản vi phạm',accountReports.filter((report)=>String(report.status||'pending').toLowerCase()!=='resolved').length],['blocks','Chặn',0]].map(([id,label,badge])=><button key={id} type="button" onClick={()=>setActiveTab(id)} className={`relative shrink-0 px-3 py-3 text-xs font-black sm:px-5 sm:text-sm ${activeTab===id?'text-blue-600 dark:text-blue-400':'text-slate-500'}`}>{label}{Number(badge)>0&&<span className="ml-2 inline-grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">{Math.min(99,Number(badge))}</span>}{activeTab===id&&<span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-blue-600"/>}</button>)}</div>
    <div className="mt-5 space-y-3">
      {loading&&<div className="py-16 text-center text-slate-500">Đang tải dữ liệu...</div>}
      {activeTab==='posts'&&pageItems.map(course=>{const status=String(course.status||course.moderationStatus||'approved').toLowerCase();const cardTone=status==='approved'?'border-emerald-300 bg-emerald-50/70 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/15 dark:border-emerald-400/30 dark:bg-emerald-500/[0.07]':status==='rejected'?'border-rose-300 bg-rose-50/70 shadow-lg shadow-rose-500/10 ring-1 ring-rose-500/15 dark:border-rose-400/30 dark:bg-rose-500/[0.07]':status==='deleted'?'border-slate-400 bg-slate-100 opacity-80 shadow-inner dark:border-slate-500/40 dark:bg-white/[0.04]':'border-amber-300 bg-amber-50/60 shadow-md shadow-amber-500/10 dark:border-amber-400/30 dark:bg-amber-500/[0.06]';return <article key={course.id} className={`flex flex-col gap-4 rounded-2xl border p-4 transition-all duration-300 lg:flex-row lg:items-center ${cardTone}`}><div className="aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 shadow-sm dark:bg-black lg:w-48"><ManagementCourseVisual course={course}/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={status}/>{status==='deleted'&&<span className="text-xs font-black text-slate-500 line-through dark:text-slate-400">Không còn hiển thị tại trang chủ</span>}</div><h2 className={`mt-2 line-clamp-2 font-black ${status==='deleted'?'text-slate-500 line-through dark:text-slate-400':''}`}>{stripHtml(course.title)}</h2><p className="mt-1 text-sm text-slate-500">{course.teacherName||course.teacherEmail||'Người dùng ZUNY'}</p>{status==='rejected'&&course.moderationReason&&<p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-300">Lý do: {course.moderationReason}</p>}</div><div className="flex flex-wrap gap-2">{status!=='deleted'&&<button onClick={()=>onOpen(course)} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black dark:border-white/20 dark:bg-white/5">Xem</button>}{status==='pending'&&<><button onClick={()=>onApprove(course)} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-black text-white">Duyệt</button><button onClick={()=>onReject(course)} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-black text-white">Từ chối</button></>}{status==='approved'&&<button onClick={()=>onDeleteCourse(course)} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-black text-white transition hover:bg-rose-700">Xóa bài</button>}</div></article>})}
      {activeTab==='violations'&&pageItems.map(report=>{const resolved=String(report.status||'pending').toLowerCase()==='resolved';const user=report.reportedUser||{};const userName=report.reportedUserName||user.fullName||user.name||user.displayName||user.userName||user.email||'Tài khoản ZUNY';const userAvatar=getUserAvatar(user);return <article key={report.id} className={`rounded-3xl border p-5 transition-all ${resolved?'border-emerald-400 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-lg shadow-emerald-500/10 ring-2 ring-emerald-500/15 dark:border-emerald-500/30 dark:from-emerald-500/[0.10] dark:to-teal-500/[0.04] dark:shadow-emerald-950/20 dark:ring-emerald-400/10':'border-amber-300 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/[0.06]'}`}><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-amber-500 to-rose-600 text-xl font-black text-white ring-2 ring-white shadow-md dark:ring-white/15">{userAvatar?<img src={userAvatar} alt={userName} referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={(event)=>{event.currentTarget.style.display='none';event.currentTarget.nextElementSibling?.classList.remove('hidden')}}/>:null}<span className={userAvatar?'hidden grid h-full w-full place-items-center':'grid h-full w-full place-items-center'}>{getInitials(userName)}</span></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-black text-slate-900 dark:text-slate-100">{userName}</h2>{resolved&&<span className="rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-black text-white">ĐÃ GIẢI QUYẾT</span>}</div><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{user.email||'Không có email'} • Người báo cáo: {report.reporterName||report.reporterEmail||'Ẩn danh'}</p><p className={`mt-2 text-xs font-semibold ${resolved?'text-emerald-700 dark:text-emerald-300':'text-amber-700 dark:text-amber-300'}`}>Lý do: {report.reason||'Tài khoản có dấu hiệu vi phạm.'}</p>{report.detail&&<p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-xs text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">{report.detail}</p>}</div><div className="flex flex-wrap gap-2">{report.reportedUserId&&<button type="button" onClick={()=>onOpenUser?.({...user,id:report.reportedUserId})} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800 dark:border-white/15 dark:bg-white/5 dark:text-slate-100">Xem tài khoản</button>}{!resolved&&<button type="button" onClick={()=>onResolveViolation?.(report)} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700">Đánh dấu đã giải quyết</button>}</div></div></article>})}
      {activeTab==='reports'&&pageItems.map(report=>{const status=String(report.status||'pending').toLowerCase();const deleted=status==='deleted';const resolved=status==='resolved';const tone=deleted?'border-rose-400 bg-gradient-to-br from-rose-50 to-red-50 shadow-lg shadow-rose-500/10 ring-1 ring-rose-500/20 dark:border-rose-500/35 dark:from-rose-500/[0.10] dark:to-red-500/[0.04]':resolved?'border-emerald-400 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/20 dark:border-emerald-500/35 dark:from-emerald-500/[0.10] dark:to-teal-500/[0.04]':'border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 shadow-md shadow-amber-500/10 dark:border-amber-500/30 dark:from-amber-500/[0.08] dark:to-orange-500/[0.03]';return <article key={report.id} className={`overflow-hidden rounded-3xl border p-5 transition-all duration-300 ${tone}`}><div className="flex flex-col gap-4 lg:flex-row lg:items-start"><div className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-3xl shadow-sm ${deleted?'bg-rose-600 text-white':resolved?'bg-emerald-600 text-white':'bg-amber-400 text-white'}`}>{deleted?'🗑️':resolved?'✓':'⚑'}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={status}/>{deleted&&<span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">Bài đã xóa</span>}</div><h2 className={`mt-3 text-lg font-black ${deleted?'text-rose-700 line-through dark:text-rose-300':''}`}>{report.courseTitle||'Bài học đã báo cáo'}</h2><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><p className="rounded-xl bg-white/70 px-3 py-2 dark:bg-white/[0.05]"><b>Lý do:</b> {report.reason||'Không ghi lý do'}</p><p className="rounded-xl bg-white/70 px-3 py-2 dark:bg-white/[0.05]"><b>Người báo cáo:</b> {report.reporterName||report.reporterEmail||'Ẩn danh'}</p></div>{report.detail&&<p className="mt-3 rounded-xl border border-white/80 bg-white/60 px-4 py-3 text-sm leading-6 dark:border-white/10 dark:bg-white/[0.04]">{report.detail}</p>}{deleted&&<p className="mt-3 text-sm font-bold text-rose-600 dark:text-rose-300">Nội dung đã bị gỡ khỏi trang chủ và không còn thao tác khả dụng.</p>}</div>{!deleted&&<div className="flex shrink-0 flex-wrap gap-2 lg:max-w-[260px] lg:justify-end">{report.courseId&&<button onClick={()=>onOpen({id:report.courseId})} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black shadow-sm dark:border-white/20 dark:bg-white/5">Xem bài</button>}{!resolved&&<button onClick={()=>onResolveReport(report)} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700">Đã xử lý</button>}{!resolved&&report.courseId&&<button onClick={()=>onDeleteReportedCourse(report)} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-rose-700">Xóa bài</button>}</div>}</div></article>})}
      {activeTab==='comments'&&pageItems.map(report=>{const status=String(report.status||'pending').toLowerCase();const resolved=['resolved','deleted','warned'].includes(status);return <article key={report.id} className={`rounded-3xl border p-5 shadow-sm ${status==='deleted'?'border-slate-400 bg-slate-100/80 dark:border-slate-500/40 dark:bg-white/[0.04]':status==='warned'?'border-amber-300 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/[0.06]':resolved?'border-emerald-300 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/[0.06]':'border-rose-300 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/[0.06]'}`}><div className="flex flex-col gap-4 lg:flex-row lg:items-start"><div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-2xl text-white ${status==='deleted'?'bg-slate-600':status==='warned'?'bg-amber-500':resolved?'bg-emerald-600':'bg-rose-600'}`}>{status==='deleted'?'🗑':status==='warned'?'⚠':resolved?'✓':'💬'}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={status}/><span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black dark:bg-white/10">{report.commentType==='reply'?'Câu trả lời':'Câu hỏi'}</span>{Number(report.warningCount||0)>0&&<span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Cảnh báo lần {report.warningCount}</span>}</div><h2 className="mt-3 text-lg font-black">Báo cáo comment của {report.commentUserName||'Người dùng ZUNY'}</h2><blockquote className="mt-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold leading-6 dark:border-white/10 dark:bg-white/[0.05]">“{report.commentContent||'Nội dung không còn tồn tại'}”</blockquote><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><p><b>Lý do:</b> {report.reason||'Không ghi lý do'}</p><p><b>Người báo cáo:</b> {report.reporterName||report.reporterEmail||'Ẩn danh'}</p></div>{report.detail&&<p className="mt-3 rounded-xl bg-white/70 px-4 py-3 text-sm dark:bg-white/[0.04]">{report.detail}</p>}</div><div className="flex shrink-0 flex-wrap gap-2 lg:max-w-[330px] lg:justify-end">{status!=='deleted'&&report.courseId&&report.questionId&&<button type="button" onClick={()=>onOpenComment?.(report)} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black dark:border-white/20 dark:bg-white/5">Xem bài</button>}{!resolved&&<button type="button" onClick={()=>onResolveCommentReport?.(report,'resolved')} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700">Đã xử lý</button>}{!resolved&&<button type="button" onClick={()=>setCommentWarningTarget(report)} className="rounded-full bg-amber-500 px-4 py-2 text-sm font-black text-white hover:bg-amber-600">Cảnh báo</button>}{status!=='deleted'&&<button type="button" onClick={()=>onDeleteComment?.(report)} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-black text-white hover:bg-rose-700">Xóa comment</button>}</div></div></article>})}
      {activeTab==='blocks'&&<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{pageItems.map(user=>{const role=String(user.role||user.Role||user.accountType||'STUDENT').replace(/[\s_-]/g,'').toUpperCase();const admin=['ADMIN','ADMINDEV'].includes(role);const verified=Boolean(user.elearningVerified);const avatar=getUserAvatar(user);const blocked=Boolean(user?.elearningPostingBlock?.active);return <article key={user.id} className={`rounded-2xl border p-5 transition-all ${admin?'border-amber-400 bg-amber-50/60 shadow-lg shadow-amber-500/10 dark:bg-amber-500/[0.07]':blocked?'border-rose-500 bg-rose-50/60 shadow-lg shadow-rose-500/10 ring-1 ring-rose-500/20 dark:bg-rose-500/[0.07]':verified?'border-blue-400 bg-blue-50/60 shadow-lg shadow-blue-500/10 dark:bg-blue-500/[0.06]':'border-slate-200 dark:border-white/10'}`}><div className="flex items-center gap-3"><div className="relative grid h-12 w-12 place-items-center overflow-visible rounded-full bg-blue-600 font-black text-white"><span className="h-full w-full overflow-hidden rounded-full">{avatar?<img src={avatar} className="h-full w-full object-cover" alt=""/>:getInitials(user.fullName||user.name||user.email)}</span>{(admin||verified)&&<span className={`absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-white text-[10px] font-black text-white shadow ${admin?'bg-amber-500':'bg-blue-600'}`}>✓</span>}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-black">{user.fullName||user.name||user.displayName||user.email||'Người dùng'}</h3>{blocked&&<span className="shrink-0 rounded-full bg-rose-600 px-2 py-1 text-[10px] font-black uppercase text-white">Đã chặn</span>}</div><div className="mt-1 flex flex-wrap items-center gap-2">{admin?<span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow">ADMIN ✓</span>:verified?<span className="rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-black text-white">Đã xác nhận ✓</span>:<p className="text-xs font-bold text-slate-500">{role}</p>}</div></div></div><div className="mt-4 space-y-1 text-sm text-slate-500"><p>Khối: <b>{user.grade||user.khoi||user.className||'Chưa cập nhật'}</b></p><p>Trường: <b>{user.schoolName||user.school||'Chưa cập nhật'}</b></p>{blocked&&<p className="text-rose-600">Lý do chặn: <b>{user.elearningPostingBlock?.reason||'Vi phạm quy định'}</b></p>}</div>{admin?<p className="mt-4 rounded-xl bg-amber-100/80 p-3 text-xs font-bold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">Tài khoản quản trị viên được xác nhận mặc định và không thể bị chặn.</p>:<><div className="mt-4 flex gap-2"><button onClick={()=>onVerify(user)} className={`flex-1 rounded-full px-4 py-2 text-sm font-black text-white ${verified?'bg-slate-600 hover:bg-slate-700':'bg-blue-600 hover:bg-blue-700'}`}>{verified?'Thu hồi xác nhận':'Cấp xác nhận'}</button>{blocked?<button onClick={()=>onUnblock(user)} className="flex-1 rounded-full bg-emerald-600 px-4 py-2 text-sm font-black text-white">Bỏ chặn</button>:<button onClick={()=>onBlock(user)} className="flex-1 rounded-full bg-rose-600 px-4 py-2 text-sm font-black text-white">Chặn</button>}</div>{!blocked&&<button onClick={()=>onWarn(user)} className="mt-2 w-full rounded-full bg-amber-500 px-4 py-2 text-sm font-black text-white">Cảnh báo</button>}</>}</article>})}</div>}
      {!pageItems.length&&<div className="py-16 text-center text-slate-500">Không có dữ liệu phù hợp.</div>}<Pagination page={page} totalPages={totalPages} onChange={setPage}/>
    </div>
    {commentWarningTarget&&<div className="fixed inset-0 z-[1500] grid place-items-center bg-slate-950/70 px-4 backdrop-blur-sm"><div className="w-full max-w-xl rounded-[28px] border border-amber-200 bg-white p-6 shadow-2xl dark:border-amber-500/30 dark:bg-[#111827]"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-amber-600">Cảnh báo người dùng</p><h3 className="mt-1 text-xl font-black">Tạo cảnh báo bình luận</h3><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Người dùng sẽ phải đọc trong 10 giây trước khi xác nhận và tiếp tục comment.</p></div><button type="button" onClick={()=>setCommentWarningTarget(null)} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-xl dark:bg-white/10">×</button></div><blockquote className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 dark:bg-amber-500/10">“{commentWarningTarget.commentContent||'Nội dung không còn tồn tại'}”</blockquote><div className="mt-4 grid gap-2">{commentWarningReasons.map(reason=><button key={reason} type="button" onClick={()=>setCommentWarningReason(reason)} className={`rounded-xl border px-4 py-3 text-left text-sm font-bold ${commentWarningReason===reason?'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300':'border-slate-200 dark:border-white/10'}`}>{reason}</button>)}</div><textarea value={commentWarningDetail} onChange={e=>setCommentWarningDetail(e.target.value)} rows="3" placeholder="Ghi chú thêm cho người dùng..." className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-amber-500 dark:border-white/10 dark:bg-white/5"/><button type="button" disabled={commentWarningSubmitting} onClick={async()=>{setCommentWarningSubmitting(true);try{await onWarnComment?.(commentWarningTarget,{reason:commentWarningReason,detail:commentWarningDetail.trim()});setCommentWarningTarget(null);setCommentWarningDetail('');setCommentWarningReason(commentWarningReasons[0])}finally{setCommentWarningSubmitting(false)}}} className="mt-4 w-full rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-white hover:bg-amber-600 disabled:opacity-50">{commentWarningSubmitting?'Đang tạo cảnh báo...':'Gửi cảnh báo'}</button></div></div>}
  </section>
}

function ManagementDonut({ title, total, segments = [] }) {
  const safeTotal = Math.max(0, Number(total || 0))
  let cursor = 0
  const stops = segments.map((segment) => { const start = cursor; cursor += safeTotal ? (Number(segment.value || 0) / safeTotal) * 100 : 0; return `${segment.color} ${start}% ${cursor}%` })
  const background = safeTotal ? `conic-gradient(${stops.join(', ')})` : 'conic-gradient(#cbd5e1 0 100%)'
  return <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><div className="relative mx-auto h-40 w-40 shrink-0 rounded-full" style={{background}}><div className="absolute inset-5 grid place-items-center rounded-full bg-white text-center shadow-inner dark:bg-[#111827]"><div><p className="text-3xl font-black">{safeTotal}</p><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tổng cộng</p></div></div></div><div className="min-w-0 flex-1"><h3 className="text-lg font-black">{title}</h3><div className="mt-4 grid gap-2">{segments.map((segment)=><div key={segment.label} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-white/[0.04]"><span className="flex min-w-0 items-center gap-2"><i className="h-3 w-3 shrink-0 rounded-full" style={{backgroundColor:segment.color}}/><span className="truncate font-semibold">{segment.label}</span></span><b>{Number(segment.value||0)}</b></div>)}</div></div></div></article>
}

function ManagementStatSmall({ label, value, tone }) {
  const classes = tone==='emerald'?'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300':tone==='amber'?'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300':tone==='rose'?'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300':'border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300'
  return <div className={`rounded-2xl border p-4 ${classes}`}><p className="text-xs font-black uppercase tracking-wider opacity-80">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>
}

function ManagementStats({ title, success, failed, successLabel, failedLabel, reasons }) { const total=Math.max(1,success+failed); const percent=Math.round(success/total*100); return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[0.04]"><div className="flex items-center gap-5"><div className="grid h-24 w-24 place-items-center rounded-full" style={{background:`conic-gradient(#10b981 ${percent}%, #f43f5e 0)`}}><div className="grid h-16 w-16 place-items-center rounded-full bg-white text-lg font-black dark:bg-[#111827]">{percent}%</div></div><div><h3 className="font-black">{title}</h3><p className="mt-2 text-sm text-emerald-600">{successLabel}: <b>{success}</b></p><p className="mt-1 text-sm text-rose-600">{failedLabel}: <b>{failed}</b></p></div></div><div className="mt-4 border-t border-slate-200 pt-4 dark:border-white/10"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Chi tiết lý do</p>{reasons.length?<ul className="mt-2 max-h-24 space-y-1 overflow-y-auto text-xs text-slate-600 dark:text-slate-300">{reasons.map((r,i)=><li key={`${r}-${i}`}>• {r}</li>)}</ul>:<p className="mt-2 text-xs text-slate-400">Chưa có lý do được ghi nhận.</p>}</div></div> }

function StatusBadge({ status }) {
  const classes = status === 'approved' || status === 'resolved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : status === 'rejected' || status === 'deleted' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
  const label = status === 'approved' ? 'Đã duyệt' : status === 'resolved' ? 'Đã xử lý' : status === 'deleted' ? 'Bài đã xóa' : status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${classes}`}>{label}</span>
}

function FollowingAccountsPanel({ accounts, onOpen }) {
  return <section className="py-6"><div className="mb-6"><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">Kênh đã đăng ký</p><h1 className="mt-2 text-3xl font-black">Tài khoản theo dõi</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Bài học mới được đánh dấu bằng huy hiệu đỏ. Mở kênh để đánh dấu đã xem thông báo.</p></div>{accounts.length?<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{accounts.map((account)=>{const name=account.fullName||account.name||account.displayName||account.email||'Tài khoản ZUNY';const avatar=getUserAvatar(account);const normalizedAccountRole=String(account.role||account.Role||account.accountType||account.userRole||account.type||'').trim().replace(/[\s_-]/g,'').toUpperCase();const isAdminAccount=['ADMIN','ADMINDEV'].includes(normalizedAccountRole);const isVerifiedAccount=Boolean(account.elearningVerified);return <button key={account.id} type="button" onClick={()=>onOpen(account)} className="group flex items-center gap-4 overflow-visible rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg dark:border-white/10 dark:bg-[#111827]"><span className="relative grid h-14 w-14 shrink-0 place-items-center overflow-visible rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-black text-white"><span className="h-full w-full overflow-hidden rounded-full">{avatar?<img src={avatar} alt={name} className="h-full w-full object-cover"/>:<span className="grid h-full w-full place-items-center">{getInitials(name)}</span>}</span>{(isAdminAccount||isVerifiedAccount)&&<span className={`absolute -bottom-1 -right-1 z-20 grid h-5 w-5 place-items-center rounded-full border-2 border-white text-[9px] font-black text-white shadow dark:border-[#111827] ${isAdminAccount?'bg-amber-500':'bg-blue-600'}`}>✓</span>}{Number(account.unreadCount||0)>0&&<span className="absolute -right-2 -top-2 z-30 grid h-6 min-w-6 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-black text-white shadow ring-2 ring-white dark:ring-[#111827]">{Math.min(99,Number(account.unreadCount||0))}</span>}</span><span className="min-w-0 flex-1"><span className="flex min-w-0 flex-wrap items-center gap-2"><span className="min-w-0 truncate font-black group-hover:text-blue-600 dark:group-hover:text-blue-400">{name}</span>{isAdminAccount?<span className="shrink-0 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[9px] font-black text-white shadow">ADMIN ✓</span>:isVerifiedAccount?<span className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-black text-white">✓</span>:null}</span><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{Number(account.unreadCount||0)>0?`${account.unreadCount} bài học mới`:'Không có bài mới'}</span></span><span className="text-slate-400">›</span></button>})}</div>:<div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center dark:border-white/15 dark:bg-[#111827]"><div className="text-5xl">👥</div><h2 className="mt-4 text-xl font-black">Chưa theo dõi tài khoản nào</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">Mở kênh của người đăng và nhấn “Theo dõi” để nội dung mới xuất hiện tại đây.</p></div>}</section>
}


function NotificationCenter({ notifications = [], onRead, onDelete, onClearAll, onOpenCourse }) {
  const unread = notifications.filter((item) => !item.read).length
  const tone = (type) => ({ approved:'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', rejected:'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', report_resolved:'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300', report_deleted:'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', verified:'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300', follow_course:'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' }[type] || 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300')
  const icon = (type) => ({ approved:'✓', rejected:'!', report_resolved:'⚑', report_deleted:'🗑', verified:'✓', follow_course:'▶' }[type] || '🔔')
  return (
    <section className="min-w-0 max-w-full overflow-x-hidden py-4 sm:py-6">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="break-words text-xs font-black uppercase tracking-[0.2em] text-blue-600 [overflow-wrap:anywhere] dark:text-blue-400">Trung tâm sự kiện</p>
          <h1 className="mt-2 break-words text-2xl font-black [overflow-wrap:anywhere] sm:text-3xl">Thông báo</h1>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:gap-3">
          <span className="max-w-full rounded-full bg-red-50 px-3 py-2 text-center text-xs font-black text-red-600 dark:bg-red-500/10 dark:text-red-300 sm:px-4 sm:text-sm">{unread} chưa đọc</span>
          {notifications.length > 0 && <button type="button" onClick={onClearAll} className="max-w-full whitespace-normal rounded-full border border-slate-300 px-3 py-2 text-center text-xs font-black leading-5 hover:bg-slate-100 dark:border-white/15 dark:hover:bg-white/10 sm:px-4 sm:text-sm">Xóa hết thông báo</button>}
        </div>
      </div>

      {notifications.length ? (
        <div className="mt-5 grid min-w-0 max-w-full gap-3 sm:mt-6">
          {notifications.map((item) => (
            <article key={item.id} onClick={() => onRead(item)} className={`group min-w-0 max-w-full cursor-pointer overflow-hidden rounded-2xl border p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg sm:p-4 ${item.read?'border-slate-200 bg-white opacity-75 dark:border-white/10 dark:bg-[#111827]':'border-blue-300 bg-blue-50/60 ring-1 ring-blue-500/10 dark:border-blue-500/30 dark:bg-blue-500/[0.06]'}`}>
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base font-black sm:h-11 sm:w-11 sm:rounded-2xl sm:text-lg ${tone(item.type)}`}>{icon(item.type)}</span>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <h2 className="min-w-0 flex-1 break-words text-sm font-black leading-5 [overflow-wrap:anywhere] sm:text-base">{item.title || 'Thông báo E-learning'}</h2>
                    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                      {!item.read && <span className="rounded-full bg-red-600 px-2 py-1 text-[9px] font-black text-white sm:px-2.5 sm:text-[10px]">MỚI</span>}
                      <button type="button" onClick={(event) => { event.stopPropagation(); onDelete?.(item) }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" aria-label="Xóa thông báo">×</button>
                    </div>
                  </div>
                  <p className="mt-1 max-w-full break-words text-sm leading-6 text-slate-600 [overflow-wrap:anywhere] dark:text-slate-300">{item.message || 'Có một sự kiện mới liên quan đến tài khoản của bạn.'}</p>
                  <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-400">
                    <span className="min-w-0 break-words [overflow-wrap:anywhere]">{formatReportDate(item.createdAt)}</span>
                    {item.courseId && <button type="button" onClick={(event) => { event.stopPropagation(); onRead(item); onOpenCourse(item.courseId) }} className="max-w-full break-words text-left font-black text-blue-600 [overflow-wrap:anywhere] hover:underline dark:text-blue-400">Xem nội dung</button>}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-8 min-w-0 max-w-full overflow-hidden rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-16 text-center dark:border-white/15 dark:bg-[#111827] sm:px-6 sm:py-20">
          <div className="text-5xl">🔔</div>
          <h2 className="mt-4 break-words text-xl font-black [overflow-wrap:anywhere]">Chưa có thông báo</h2>
          <p className="mt-2 break-words text-sm text-slate-500 [overflow-wrap:anywhere] dark:text-slate-400">Các sự kiện mới sẽ xuất hiện tại đây.</p>
        </div>
      )}
    </section>
  )
}

function AccountPanel({ profile, followerHistory = [], user, role, classes, courses, stats, canManageCourse, teacherProfilesById, openMenuId, onToggleMenu, onOpen, onUpdate, onDelete, onCopy, onReport, onOpenChannel, playlists = [], onOpenPlaylist, onCreatePlaylist, onEditPlaylist, savedLists = [], onOpenSavedList, onCreateSavedList, onImportSavedList, onEditSavedList, onShareSavedList, onDeleteSavedList, onUnsave, unsavingCourseId = '', reports = [], reportsLoading = false }) {
  const normalizedProfileRole = String(profile?.role || profile?.Role || profile?.accountType || profile?.userRole || role || '').replace(/[\s_-]/g, '').toUpperCase()
  const isAdminProfile = ['ADMIN', 'ADMINDEV'].includes(normalizedProfileRole)
  const isStudentProfile = normalizedProfileRole === 'STUDENT'
  const isVerifiedProfile = Boolean(profile?.elearningVerified)
  const [activeTab,setActiveTab]=useState('overview')
  const [accountSavedSort,setAccountSavedSort]=useState('posts')
  const tips=['Đặt tiêu đề rõ ràng, đúng trọng tâm để quản trị viên hiểu ngay nội dung bài học.','Dùng ảnh bìa sắc nét, đúng tỷ lệ 16:9 và liên quan trực tiếp đến bài đăng.','Chọn chính xác môn học, khối lớp và loại học liệu để bài được phân loại đúng.','Viết mô tả đầy đủ mục tiêu, nội dung và giá trị người học nhận được.','Kiểm tra toàn bộ video, liên kết và tài liệu trước khi gửi duyệt.','Không dùng nội dung sao chép khi chưa ghi nguồn hoặc chưa có quyền sử dụng.','Tránh tiêu đề giật gân, từ ngữ khó hiểu hoặc thông tin không khớp nội dung.','Sắp xếp bài học theo trình tự hợp lý, dễ theo dõi và có hướng dẫn rõ ràng.','Đảm bảo âm thanh, hình ảnh và chữ trong tài liệu đủ rõ để học sinh sử dụng.','Tuân thủ quy định cộng đồng ZUNY và cập nhật thông tin tác giả chính xác.']
  const [tipIndex,setTipIndex]=useState(0)
  useEffect(()=>{const timer=window.setInterval(()=>setTipIndex(v=>(v+1)%tips.length),120000);return()=>window.clearInterval(timer)},[])
  const displayName=profile?.fullName||profile?.name||profile?.displayName||user?.displayName||'Chưa cập nhật'
  const avatar=getUserAvatar({...(user||{}),...(profile||{})})
  const coverImage=profile?.coverImage||profile?.coverUrl||profile?.coverURL||profile?.banner||profile?.backgroundImage||profile?.backgroundUrl||profile?.profileCover||''
  const bio=profile?.personalNote||profile?.caption||profile?.statusText||profile?.bio||profile?.description||profile?.about||'Chưa có chú thích cá nhân.'
  const followers=Number(profile?.followersCount||profile?.followerCount||(Array.isArray(profile?.followers)?profile.followers.length:0)||0)
  const followerEvents=Array.isArray(followerHistory)&&followerHistory.length
    ? followerHistory
    : Array.isArray(profile?.followerHistory)
      ? profile.followerHistory
      : Array.isArray(profile?.followersHistory)
        ? profile.followersHistory
        : []
  const changeSince=(days)=>{const min=Date.now()-days*86400000;return followerEvents.reduce((sum,item)=>getAnyTime(item?.createdAt||item?.occurredAt||item?.followedAt||item)>=min?sum+Number(item?.delta??1):sum,0)}
  const changes={today:changeSince(1),week:changeSince(7),month:changeSince(30)}
  const followerGrowth=useMemo(()=>buildFollowerGrowthSeries(followerEvents,followers,30),[followerEvents,followers])
  const ownedCourses=useMemo(()=>{const uid=String(user?.uid||'');const email=String(user?.email||'').toLowerCase();return courses.filter(c=>{const isOwner=[c.teacherId,c.createdByUid,c.createdBy,c.ownerId,c.userId,c.uid].filter(Boolean).map(String).includes(uid)||[c.teacherEmail,c.createdByEmail,c.ownerEmail].filter(Boolean).map(v=>String(v).toLowerCase()).includes(email);const visibility=String(c.visibility||'public').toLowerCase();const status=String(c.status||c.moderationStatus||'approved').toLowerCase();return isOwner&&visibility!=='class'&&!['rejected','deleted'].includes(status)})},[courses,user?.uid,user?.email])
  const savedCourses=useMemo(()=>courses.filter(c=>Boolean(c.bookmarked)&&String(c.visibility||'public').toLowerCase()!=='class'&&String(c.status||c.moderationStatus||'approved').toLowerCase()==='approved'),[courses])
  const approvedCourses=ownedCourses.filter(c=>String(c.status||c.moderationStatus||'approved').toLowerCase()==='approved')
  const pendingCourses=ownedCourses.filter(c=>String(c.status||c.moderationStatus||'').toLowerCase()==='pending')
  const tabs=[
    ['overview','Tổng quan'],
    ...(!isStudentProfile ? [
      ['courses',`Bài đã đăng (${approvedCourses.length})`],
      ['pending',`Đang chờ duyệt (${pendingCourses.length})`],
    ] : []),
    ['saved',`Đã lưu (${savedCourses.length + savedLists.length})`],
    ['reports',`Lịch sử báo cáo (${reports.length})`],
  ]
  useEffect(() => {
    if (isStudentProfile && ['courses', 'pending'].includes(activeTab)) setActiveTab('overview')
  }, [isStudentProfile, activeTab])
  const tabCourses=activeTab==='pending'?pendingCourses:approvedCourses
  const total=Math.max(1,Number(stats.completed||0)+Number(stats.inProgress||0));const completedPercent=Math.round(Number(stats.completed||0)/total*100)
  return <section className="min-w-0 py-3 sm:py-6"><div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#111827] sm:rounded-3xl">
    <div className="relative isolate h-36 overflow-hidden bg-gradient-to-r from-blue-200 via-indigo-200 to-violet-200 dark:from-blue-950 dark:via-indigo-950 dark:to-violet-950 sm:h-56">{coverImage&&<img src={coverImage} alt="Ảnh bìa" className="absolute inset-0 -z-10 h-full w-full object-cover"/>}<div className="absolute inset-0 -z-0 bg-gradient-to-t from-white/90 via-white/15 to-transparent dark:from-[#111827]/95 dark:via-black/20 dark:to-black/5"/></div>
    <div className="relative z-10 min-w-0 px-3 pb-5 sm:px-8 sm:pb-7"><div className="-mt-12 flex min-w-0 flex-col gap-4 sm:-mt-20 sm:flex-row sm:items-end sm:gap-5"><div className="relative grid h-24 w-24 shrink-0 place-items-center overflow-visible rounded-full border-4 border-white bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl font-black text-white shadow-xl dark:border-[#111827] sm:h-32 sm:w-32 sm:text-3xl"><span className="h-full w-full overflow-hidden rounded-full">{avatar?<img src={avatar} alt={displayName} className="h-full w-full object-cover"/>:<span className="grid h-full w-full place-items-center">{getInitials(displayName)}</span>}</span>{(isAdminProfile||isVerifiedProfile)&&<span className={`absolute bottom-1 right-1 grid h-7 w-7 place-items-center rounded-full border-4 border-white text-xs font-black text-white shadow dark:border-[#111827] ${isAdminProfile?'bg-amber-500':'bg-blue-600'}`}>✓</span>}</div><div className="min-w-0 flex-1 pb-2"><div className="flex flex-wrap items-center gap-2"><h1 className="min-w-0 break-words text-2xl font-black leading-tight text-slate-950 [overflow-wrap:anywhere] dark:text-white sm:text-4xl">{displayName}</h1>{isAdminProfile?<span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1 text-xs font-black text-white shadow">ADMIN ✓</span>:isVerifiedProfile?<span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-black text-white">Đã xác nhận ✓</span>:null}</div><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{bio}</p><div className="mt-3 grid min-w-0 gap-1.5 text-xs text-slate-500 dark:text-slate-400 sm:flex sm:flex-wrap sm:items-center sm:gap-2 sm:text-sm"><b className="text-slate-900 dark:text-white">{followers.toLocaleString('vi-VN')} người theo dõi</b><span>•</span><span>{ownedCourses.length} bài đăng</span><span>•</span><span>{user?.email||profile?.email||'Tài khoản ZUNY'}</span></div></div></div>
      <div className="-mx-3 mt-5 flex min-w-0 gap-1 overflow-x-auto border-b border-slate-200 px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-white/10 sm:mx-0 sm:mt-6 sm:px-0">{tabs.map(([id,label])=><button key={id} type="button" onClick={()=>changeAccountTab(id)} className={`relative shrink-0 px-3 py-3 text-xs font-black sm:px-5 sm:text-sm ${activeTab===id?'text-blue-600 dark:text-blue-400':'text-slate-500'}`}>{label}{activeTab===id&&<span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-blue-600"/>}</button>)}</div>
      {activeTab==='reports'?<ReportHistoryPanel reports={reports} loading={reportsLoading} />:activeTab==='overview'?<div className="min-w-0 py-5 sm:py-7">
        <div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><h2 className="text-lg font-black sm:text-xl">Thống kê tài khoản</h2><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Tổng quan hoạt động học tập và tài khoản của bạn.</p></div><span className="shrink-0 rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">Tổng quan</span></div>
        <div className={`mt-4 grid min-w-0 grid-cols-1 gap-3 min-[390px]:grid-cols-2 sm:gap-4 ${isStudentProfile ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
          {!isStudentProfile&&<div className="min-w-0 min-[390px]:col-span-2 lg:col-span-1"><AccountStatCard icon="🎬" label="Bài đăng" value={approvedCourses.length + pendingCourses.length} detail={`${approvedCourses.length} đã duyệt • ${pendingCourses.length} chờ duyệt`}/></div>}
          <div className="min-w-0"><AccountStatCard icon="🔖" label="Đang lưu" value={savedCourses.length} detail="Bài học đã lưu để xem lại"/></div>
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04] sm:p-5"><div className="mx-auto grid h-24 w-24 place-items-center rounded-full sm:h-28 sm:w-28" style={{background:`conic-gradient(#10b981 ${completedPercent}%, #3b82f6 0)`}}><div className="grid h-[68px] w-[68px] place-items-center rounded-full bg-white text-lg font-black dark:bg-[#111827] sm:h-20 sm:w-20 sm:text-xl">{completedPercent}%</div></div><div className="mt-3 grid grid-cols-2 gap-2 text-center text-[10px] sm:mt-4 sm:text-xs"><span className="rounded-lg bg-emerald-50 px-2 py-1.5 font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Hoàn thành {stats.completed||0}</span><span className="rounded-lg bg-blue-50 px-2 py-1.5 font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">Đang học {stats.inProgress||0}</span></div></div>
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04] sm:p-5"><div className="flex min-w-0 items-center justify-between gap-3"><b className="truncate">Tiến độ học</b><b className="shrink-0 text-blue-600">{stats.averageProgress||0}%</b></div><div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10 sm:mt-6"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-500" style={{width:`${Math.min(100,stats.averageProgress||0)}%`}}/></div><p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400 sm:mt-4">Tiến độ trung bình của các bài đã bắt đầu.</p></div>
        </div>
        <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:mt-5"><div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04] sm:p-5"><div className="flex items-end justify-between"><div><p className="text-sm font-black">Số ngày học</p><p className="mt-1 text-3xl font-black">{stats.streakDays||0}</p></div><span className="text-2xl">📅</span></div><div className="min-w-0 overflow-x-auto"><LearningCalendar watchedDates={stats.watchedDates||[]}/></div></div><div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04] sm:p-5"><div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h3 className="font-black">Tăng trưởng người theo dõi</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Biến động trong 30 ngày gần nhất</p></div><span className="w-fit max-w-full truncate rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">{followers.toLocaleString('vi-VN')} người theo dõi</span></div><div className="mt-4 grid grid-cols-1 gap-2 min-[390px]:grid-cols-3 sm:gap-3"><FollowerChange label="Hôm nay" value={changes.today}/><FollowerChange label="7 ngày qua" value={changes.week}/><FollowerChange label="30 ngày qua" value={changes.month}/></div><div className="min-w-0 overflow-x-auto"><FollowerGrowthLineChart data={followerGrowth}/></div><p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">Đường biểu diễn là tổng số người theo dõi cuối mỗi ngày; thao tác theo dõi và bỏ theo dõi được ghi nhận.</p></div></div></div>:activeTab==='saved'?<SavedLibraryPanel courses={savedCourses} teacherProfilesById={teacherProfilesById} savedLists={savedLists} sort={accountSavedSort} setSort={setAccountSavedSort} onOpen={onOpen} onOpenChannel={onOpenChannel} onUnsave={onUnsave} unsavingCourseId={unsavingCourseId} onOpenSavedList={onOpenSavedList} onCreateSavedList={onCreateSavedList} onImportSavedList={onImportSavedList} onEditSavedList={onEditSavedList} onShareSavedList={onShareSavedList} onDeleteSavedList={onDeleteSavedList}/>:<div className="py-7">{activeTab==='pending'&&<div className="mb-5 overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 shadow-sm dark:border-amber-500/20 dark:from-amber-500/10 dark:via-yellow-500/[0.06] dark:to-orange-500/[0.04]"><div className="flex items-start gap-4 p-5 sm:p-6"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-400 text-2xl shadow-lg shadow-amber-500/20">💡</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-600">Tăng khả năng được duyệt</p><h3 className="mt-1 text-lg font-black text-amber-900 dark:text-amber-200">Mẹo hữu ích khi đăng bài</h3></div><span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black text-amber-700 shadow-sm dark:bg-white/10 dark:text-amber-200">{tipIndex+1}/{tips.length}</span></div><p key={tipIndex} className="mt-4 min-h-[48px] animate-[fadeIn_.3s_ease-out] text-sm font-semibold leading-6 text-amber-800 dark:text-amber-100">{tips[tipIndex]}</p><div className="mt-4 flex items-center justify-between gap-3"><button type="button" onClick={()=>setTipIndex(v=>(v-1+tips.length)%tips.length)} className="rounded-full border border-amber-300 bg-white/70 px-4 py-2 text-xs font-black text-amber-800 transition hover:-translate-y-0.5 hover:bg-white dark:border-amber-500/30 dark:bg-white/10 dark:text-amber-100">← Mẹo trước</button><div className="hidden gap-1.5 sm:flex">{tips.map((_,index)=><button key={index} type="button" aria-label={`Xem mẹo ${index+1}`} onClick={()=>setTipIndex(index)} className={`h-2 rounded-full transition-all ${index===tipIndex?'w-6 bg-amber-500':'w-2 bg-amber-300/70 dark:bg-amber-500/30'}`}/>)}</div><button type="button" onClick={()=>setTipIndex(v=>(v+1)%tips.length)} className="rounded-full bg-amber-500 px-4 py-2 text-xs font-black text-white shadow-md shadow-amber-500/20 transition hover:-translate-y-0.5 hover:bg-amber-600">Mẹo tiếp →</button></div></div></div></div>}{activeTab==='courses'&&<><div className="mb-5 flex items-center justify-between gap-3"><div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Đăng thành công</div><button type="button" onClick={onCreatePlaylist} title="Tạo danh sách phát" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-600 text-2xl font-light text-white shadow-lg shadow-blue-500/25 transition hover:scale-105 hover:bg-blue-700">+</button></div>{playlists.length>0&&<div className="mb-6"><div className="mb-3 flex items-center justify-between"><h3 className="font-black">Danh sách phát của bạn</h3><span className="text-xs font-bold text-slate-400">{playlists.length} danh sách</span></div><div className="flex gap-3 overflow-x-auto pb-2">{playlists.map((playlist)=><div key={playlist.id} className="relative w-64 shrink-0"><button type="button" onClick={()=>onOpenPlaylist?.(playlist)} className="group w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-white/[0.04]"><div className="relative aspect-video overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-violet-900">{playlist.thumbnail?<img src={playlist.thumbnail} alt={playlist.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/>:<div className="grid h-full place-items-center text-white"><div className="text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/25 bg-white/15 text-2xl shadow-xl">▣</div><p className="mt-2 text-[10px] font-black tracking-[0.16em]">DANH SÁCH HỌC</p></div></div>}<span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-black text-white backdrop-blur">{(playlist.courseIds||[]).length} bài</span></div><div className="p-4"><p className="truncate font-black group-hover:text-blue-600">{playlist.title}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{playlist.description||'Danh sách phát học tập'}</p><span className="mt-3 inline-flex text-xs font-black text-blue-600">Mở danh sách →</span></div></button><button type="button" onClick={()=>onEditPlaylist?.(playlist)} className="absolute right-3 top-3 z-20 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-white/95 text-blue-700 shadow-lg transition hover:scale-110 dark:bg-[#111827]/95 dark:text-blue-300" title="Chỉnh sửa danh sách phát">✎</button></div>)}</div></div>}</>}{tabCourses.length?<VideoGrid>{tabCourses.map(course=><div key={course.id}><VideoCourseCard course={course} canManage={canManageCourse(course)} teacherProfilesById={teacherProfilesById} openMenuId={openMenuId} onToggleMenu={onToggleMenu} onOpen={onOpen} onUpdate={onUpdate} onDelete={onDelete} onCopy={onCopy} onReport={onReport} onOpenChannel={onOpenChannel}/>{activeTab==='pending'&&<p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Đang chờ quản trị viên duyệt</p>}</div>)}</VideoGrid>:<div className="rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center dark:border-white/15">Chưa có nội dung phù hợp.</div>}</div>}
    </div></div></section>
}

function buildFollowerGrowthSeries(events, currentCount, days = 30) {
  const safeEvents = (Array.isArray(events) ? events : [])
    .map((item) => ({ ...item, time: getAnyTime(item?.createdAt || item?.occurredAt || item?.followedAt || item) }))
    .filter((item) => item.time)
    .sort((a, b) => a.time - b.time)
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (days - 1))
  const eventsAfterStart = safeEvents.filter((item) => item.time >= start.getTime())
  const deltaAfterStart = eventsAfterStart.reduce((sum, item) => sum + Number(item.delta ?? 1), 0)
  let running = Math.max(0, Number(currentCount || 0) - deltaAfterStart)
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const dayStart = date.getTime()
    const dayEnd = dayStart + 86400000
    eventsAfterStart.forEach((item) => {
      if (item.time >= dayStart && item.time < dayEnd) running = Math.max(0, running + Number(item.delta ?? 1))
    })
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      label: date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      value: running,
    }
  })
}

function FollowerGrowthLineChart({ data = [] }) {
  const width = 760
  const height = 230
  const padding = { left: 44, right: 18, top: 18, bottom: 34 }
  const values = data.map((item) => Number(item.value || 0))
  const minValue = Math.min(...values, 0)
  const maxValue = Math.max(...values, 1)
  const range = Math.max(1, maxValue - minValue)
  const x = (index) => padding.left + (index / Math.max(1, data.length - 1)) * (width - padding.left - padding.right)
  const y = (value) => padding.top + (1 - (Number(value || 0) - minValue) / range) * (height - padding.top - padding.bottom)
  const points = data.map((item, index) => `${x(index)},${y(item.value)}`).join(' ')
  const areaPoints = `${padding.left},${height-padding.bottom} ${points} ${width-padding.right},${height-padding.bottom}`
  const yTicks = [maxValue, Math.round((maxValue + minValue) / 2), minValue]
  const xTickIndexes = Array.from(new Set([0, 7, 14, 21, Math.max(0, data.length - 1)])).filter((index) => index < data.length)
  return <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#111827]"><div className="overflow-x-auto"><svg viewBox={`0 0 ${width} ${height}`} className="h-[230px] min-w-[620px] w-full" role="img" aria-label="Biểu đồ đường tăng trưởng người theo dõi 30 ngày"><defs><linearGradient id="followerGrowthArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.22"/><stop offset="100%" stopColor="currentColor" stopOpacity="0.02"/></linearGradient></defs>{yTicks.map((tick)=><g key={tick}><line x1={padding.left} x2={width-padding.right} y1={y(tick)} y2={y(tick)} className="stroke-slate-200 dark:stroke-white/10" strokeDasharray="4 5"/><text x={padding.left-8} y={y(tick)+4} textAnchor="end" className="fill-slate-400 text-[11px]">{tick}</text></g>)}<polygon points={areaPoints} className="fill-blue-500 text-blue-500" fill="url(#followerGrowthArea)"/><polyline points={points} fill="none" className="stroke-blue-600 dark:stroke-blue-400" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>{data.map((item,index)=><circle key={item.key} cx={x(index)} cy={y(item.value)} r={index===data.length-1?5:2.5} className="fill-white stroke-blue-600 dark:fill-[#111827] dark:stroke-blue-400" strokeWidth={index===data.length-1?3:2}><title>{item.label}: {item.value} người theo dõi</title></circle>)}{xTickIndexes.map((index)=><text key={data[index]?.key} x={x(index)} y={height-10} textAnchor={index===0?'start':index===data.length-1?'end':'middle'} className="fill-slate-400 text-[11px]">{data[index]?.label}</text>)}</svg></div></div>
}

function FollowerChange({ label, value }) { const positive=Number(value)>=0; return <div className="rounded-xl bg-white p-4 dark:bg-white/[0.05]"><p className="text-xs text-slate-500">{label}</p><p className={`mt-2 text-2xl font-black ${positive?'text-emerald-600':'text-rose-600'}`}>{positive?'+':''}{Number(value||0)}</p><p className="mt-1 text-[11px] text-slate-400">lượt theo dõi</p></div> }


function ResponsiveSortMenu({ children, onClose, widthClass = 'sm:w-56', contentClassName = '' }) {
  const menu = (
    <div
      data-sort-menu-portal="true"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      className={`max-h-[70dvh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-white/10 dark:bg-[#182235] ${contentClassName}`}
    >
      {children}
    </div>
  )

  return (
    <>
      <div className={`absolute left-0 top-[calc(100%+10px)] z-[350] hidden ${widthClass} sm:block`}>
        {menu}
      </div>
      {typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[500] sm:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
            onClick={onClose}
            aria-label="Đóng danh sách bộ lọc"
          />
          <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+12px)]">
            {menu}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

function SortChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl px-4 py-2 text-sm font-bold transition-all duration-200 ${
        active
          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:bg-blue-700'
          : 'bg-slate-100 text-slate-600 hover:-translate-y-0.5 hover:bg-slate-200 hover:text-slate-950 dark:bg-white/[0.07] dark:text-slate-300 dark:hover:bg-white/[0.12] dark:hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function AccountStatCard({ icon, label, value, detail }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[0.04]"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-100 text-lg text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">{icon}</span><span className="text-3xl font-black">{value}</span></div><p className="mt-4 text-sm font-black">{label}</p><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</p></div>
}

function LearningCalendar({ watchedDates }) {
  const activeDates = new Set((watchedDates || []).map(String))
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const totalDays = new Date(year, month + 1, 0).getDate()
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: totalDays }, (_, index) => index + 1)]
  return <div className="mt-4"><p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{today.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}</p><div className="grid grid-cols-7 gap-1 text-center text-[10px]">{['CN','T2','T3','T4','T5','T6','T7'].map((day) => <span key={day} className="text-slate-400">{day}</span>)}{cells.map((day, index) => { if (!day) return <span key={`empty-${index}`} />; const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const learned = activeDates.has(key); return <span key={key} className={`grid aspect-square place-items-center rounded-md font-bold ${learned ? 'bg-blue-600 text-white' : day === today.getDate() ? 'ring-1 ring-blue-400 text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>{day}</span> })}</div></div>
}

function AccountInfoRow({ label, value }) {
  return <div className="flex items-start justify-between gap-4 py-3"><span className="shrink-0 text-slate-500 dark:text-slate-400">{label}</span><span className="break-words text-right font-bold text-slate-800 dark:text-slate-100">{value}</span></div>
}

function ReportHistoryPanel({ reports, loading }) {
  const [queryText,setQueryText]=useState(''); const [page,setPage]=useState(1); const pageSize=5
  useEffect(()=>setPage(1),[queryText])
  const keyword=queryText.trim().toLowerCase(); const filtered=reports.filter(r=>!keyword||[r.courseTitle,r.title,r.reason,r.detail,r.status].some(v=>String(v||'').toLowerCase().includes(keyword)))
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)); const items=filtered.slice((page-1)*pageSize,page*pageSize)
  return <section className="py-6"><div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">Hoạt động tài khoản</p><h1 className="mt-2 text-2xl font-black">Lịch sử báo cáo</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Theo dõi trạng thái các nội dung bạn từng báo cáo.</p></div><div className="w-full max-w-md"><input value={queryText} onChange={e=>setQueryText(e.target.value)} placeholder="Tìm tên bài, lý do, trạng thái..." className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-white/10 dark:bg-[#111827]"/></div></div>{loading?<div className="grid gap-3">{Array.from({length:3}).map((_,i)=><div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-white/[0.07]"/>)}</div>:items.length?<div className="grid gap-3">{items.map(report=>{const status=String(report.status||'pending').toLowerCase();const cls=status==='resolved'?'border-emerald-300 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/[0.05]':status==='deleted'||status==='rejected'?'border-rose-300 bg-rose-50/50 dark:border-rose-500/30 dark:bg-rose-500/[0.05]':'border-amber-300 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-500/[0.05]';return <article key={report.id} className={`rounded-2xl border p-5 shadow-sm ${cls}`}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Báo cáo bài học</p><h2 className="mt-1 font-black">{report.courseTitle||report.title||'Báo cáo bài học'}</h2><p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">{report.reason||'Không ghi lý do'}</p></div><StatusBadge status={status}/></div>{(report.detail||report.deletionReason)&&<p className="mt-4 rounded-xl bg-white/70 px-4 py-3 text-sm dark:bg-white/[0.04]">{report.detail||report.deletionReason}</p>}<div className="mt-4 border-t border-slate-200/70 pt-4 text-xs text-slate-400 dark:border-white/10">◷ {formatReportDate(report.createdAt||report.updatedAt)}</div></article>})}<Pagination page={page} totalPages={totalPages} onChange={setPage}/></div>:<div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center dark:border-white/15 dark:bg-[#111827]">Chưa có báo cáo phù hợp.</div>}</section>
}

function Pagination({ page, totalPages, onChange }) { if(totalPages<=1)return null; return <div className="mt-6 flex items-center justify-center gap-2"><button disabled={page<=1} onClick={()=>onChange(page-1)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-40 dark:border-white/15">Trước</button>{Array.from({length:totalPages},(_,i)=>i+1).map(p=><button key={p} onClick={()=>onChange(p)} className={`grid h-9 w-9 place-items-center rounded-full text-sm font-black ${p===page?'bg-blue-600 text-white':'bg-slate-100 dark:bg-white/10'}`}>{p}</button>)}<button disabled={page>=totalPages} onClick={()=>onChange(page+1)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-40 dark:border-white/15">Sau</button></div> }

function SavedListDeleteModal({ list, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false)

  async function handleConfirm() {
    if (deleting) return
    setDeleting(true)
    try {
      await onConfirm?.()
    } finally {
      setDeleting(false)
    }
  }

  return <div className="fixed inset-0 z-[1700] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!deleting)onClose?.()}}><div className="w-full max-w-md overflow-hidden rounded-[28px] border border-rose-200 bg-white shadow-2xl dark:border-rose-400/20 dark:bg-[#111827]"><div className="bg-gradient-to-br from-rose-50 via-white to-orange-50 px-6 pb-5 pt-6 text-center dark:from-rose-500/10 dark:via-transparent dark:to-orange-500/[0.06]"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-rose-100 text-3xl shadow-sm dark:bg-rose-500/15">🗑️</div><p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-rose-600 dark:text-rose-400">Xóa danh sách lưu</p><h2 className="mt-2 text-xl font-black text-slate-950 dark:text-white">Bạn có chắc muốn xóa?</h2><p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-300">Danh sách <b className="text-slate-800 dark:text-white">“{list?.title || 'Danh sách lưu'}”</b> sẽ bị xóa khỏi tài khoản. Các bài học gốc bên trong vẫn được giữ nguyên.</p></div><div className="flex gap-3 border-t border-slate-200 p-5 dark:border-white/10"><button type="button" disabled={deleting} onClick={onClose} className="flex-1 rounded-full border border-slate-300 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10">Giữ lại</button><button type="button" disabled={deleting} onClick={handleConfirm} className="flex-1 rounded-full bg-rose-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-700 disabled:cursor-wait disabled:opacity-70">{deleting ? 'Đang xóa...' : 'Xóa danh sách'}</button></div></div></div>
}

function ConfirmActionModal({ title, description, confirmLabel, onClose, onConfirm }) { return <div className="fixed inset-0 z-[1100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#171717]"><h2 className="text-xl font-black">{title}</h2><p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-300">{description}</p><div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="rounded-full px-5 py-2.5 text-sm font-black hover:bg-slate-100 dark:hover:bg-white/10">Hủy</button><button onClick={onConfirm} className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-black text-white">{confirmLabel}</button></div></div></div> }

function ReasonModal({ title, description, presets, confirmLabel, tone='normal', requireSecondConfirm=false, onClose, onConfirm }) { const [reason,setReason]=useState('');const [detail,setDetail]=useState('');const [step,setStep]=useState(1);const submit=()=>{if(!reason)return;if(requireSecondConfirm&&step===1){setStep(2);return}onConfirm({reason,detail})};return <div className="fixed inset-0 z-[1100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#171717]"><h2 className="text-xl font-black">{step===2?'Xác nhận lần cuối':title}</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{step===2?'Thao tác này sẽ xóa bài học và không thể hoàn tác.':description}</p>{step===1&&<><div className="mt-5 grid gap-2">{presets.map(x=><label key={x} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 ${reason===x?'border-blue-500 bg-blue-50 dark:bg-blue-500/10':'border-slate-200 dark:border-white/10'}`}><input type="radio" checked={reason===x} onChange={()=>setReason(x)}/><span className="text-sm font-semibold">{x}</span></label>)}</div><textarea value={detail} onChange={e=>setDetail(e.target.value)} rows="4" placeholder="Mô tả thêm..." className="mt-4 w-full rounded-2xl border border-slate-300 bg-transparent px-4 py-3 text-sm outline-none dark:border-white/15"/></>}<div className="mt-6 flex justify-end gap-2"><button onClick={step===2?()=>setStep(1):onClose} className="rounded-full px-5 py-2.5 text-sm font-black hover:bg-slate-100 dark:hover:bg-white/10">{step===2?'Quay lại':'Hủy'}</button><button disabled={!reason} onClick={submit} className={`rounded-full px-5 py-2.5 text-sm font-black text-white disabled:opacity-40 ${tone==='danger'?'bg-rose-600':'bg-blue-600'}`}>{step===2?'Xác nhận xóa':confirmLabel}</button></div></div></div> }


function PostingBlockModal({ block, onClose }) { return <div className="fixed inset-0 z-[1300] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#171717]"><div className="text-4xl">⛔</div><h2 className="mt-4 text-xl font-black">Bạn đã bị Quản trị viên chặn đăng bài</h2><p className="mt-3 text-sm text-slate-500">Lý do: <b>{block?.reason || 'Vi phạm quy định'}</b></p><p className="mt-2 text-sm text-slate-500">Thời gian kết thúc: <b>{formatReportDate(block?.endAt)}</b></p><button onClick={onClose} className="mt-6 w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white dark:bg-white dark:text-slate-950">Đã hiểu</button></div></div> }
function PostingWarningModal({ warning, onConfirm }) { const [seconds,setSeconds]=useState(10); useEffect(()=>{const timer=window.setInterval(()=>setSeconds(v=>Math.max(0,v-1)),1000);return()=>window.clearInterval(timer)},[]); return <div className="fixed inset-0 z-[1300] grid place-items-center bg-black/75 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-3xl border border-amber-200 bg-white p-7 shadow-2xl dark:border-amber-500/20 dark:bg-[#171717]"><div className="grid h-16 w-16 place-items-center rounded-2xl bg-amber-100 text-4xl dark:bg-amber-500/15">⚠️</div><h2 className="mt-5 text-2xl font-black">Cảnh báo từ Quản trị viên</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Bạn cần đọc kỹ thông tin trước khi xác nhận.</p><div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/20 dark:bg-amber-500/10"><p className="text-xs font-black uppercase tracking-[0.16em] text-amber-600">Nội dung cảnh báo</p><p className="mt-2 text-sm font-semibold leading-6 text-amber-900 dark:text-amber-100">{warning?.reason || 'Vui lòng tuân thủ quy định đăng bài.'}</p>{warning?.detail&&<p className="mt-3 border-t border-amber-200 pt-3 text-sm text-amber-800 dark:border-amber-500/20 dark:text-amber-200">{warning.detail}</p>}</div><div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-white/[0.05]"><span className="text-slate-500">Tổng số cảnh báo</span><b>{Number(warning?.count || 1)}</b></div><button disabled={seconds>0} onClick={onConfirm} className="mt-6 w-full rounded-full bg-blue-600 px-5 py-3.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{seconds>0?`Vui lòng đọc kỹ (${seconds}s)`:'Tôi đã đọc và xác nhận'}</button></div></div> }
function UserActionModal({ user, mode, onClose, onSave }) {
  const presets=['Spam','Nội dung không phù hợp','Đăng quá nhiều','Vi phạm quy định','Khác']
  const [reason,setReason]=useState('')
  const [detail,setDetail]=useState('')
  const [startAt,setStartAt]=useState(new Date().toISOString().slice(0,10))
  const [endAt,setEndAt]=useState('')
  const [warningCount,setWarningCount]=useState(1)
  const [closing,setClosing]=useState(false)
  const closeWithMotion=()=>{setClosing(true);window.setTimeout(onClose,220)}
  const submit=()=>{const finalReason=reason==='Khác'?detail.trim():reason;if(!finalReason||mode==='block'&&!endAt)return;onSave({reason:finalReason,startAt,endAt,warningCount:Math.max(1,Number(warningCount||1))})}
  return <div onMouseDown={(event)=>{if(event.target===event.currentTarget)closeWithMotion()}} className={`fixed inset-0 z-[1300] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm transition-opacity duration-200 sm:items-center ${closing?'opacity-0':'opacity-100'}`}><div onMouseDown={event=>event.stopPropagation()} className={`w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl transition-all duration-200 dark:bg-[#171717] ${closing?'translate-y-16 scale-[0.98] opacity-0':'translate-y-0 scale-100 opacity-100'}`}><h2 className="text-xl font-black">{mode==='block'?'Chặn quyền đăng bài':'Gửi cảnh báo'}</h2><p className="mt-1 text-sm text-slate-500">{user?.fullName||user?.name||user?.email}</p><div className="mt-5 grid grid-cols-2 gap-2">{presets.map(x=><button key={x} onClick={()=>setReason(x)} className={`rounded-xl border px-3 py-2 text-sm font-bold ${reason===x?'border-blue-500 bg-blue-50 text-blue-700':'border-slate-200 dark:border-white/10'}`}>{x}</button>)}</div>{reason==='Khác'&&<textarea value={detail} onChange={e=>setDetail(e.target.value)} rows="3" placeholder="Nhập lý do..." className="mt-3 w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm dark:border-white/15"/>}{mode==='block'?<div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-black">Từ ngày<input type="date" value={startAt} onChange={e=>setStartAt(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent p-3 dark:border-white/15"/></label><label className="text-xs font-black">Đến ngày<input type="date" value={endAt} min={startAt} onChange={e=>setEndAt(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent p-3 dark:border-white/15"/></label></div>:<div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10"><p className="text-xs font-black uppercase tracking-[0.14em] text-amber-600">Số lần cảnh báo hiển thị</p><p className="mt-1 text-2xl font-black text-amber-800 dark:text-amber-200">{Math.max(1,Number(user?.reportCount||1))}</p><p className="mt-1 text-xs font-semibold text-amber-700/80 dark:text-amber-200/70">Tự động bằng tổng số báo cáo của tài khoản này.</p></div>}<div className="mt-6 flex justify-end gap-2"><button onClick={closeWithMotion} className="rounded-full px-5 py-2.5 text-sm font-black">Hủy</button><button onClick={submit} className={`rounded-full px-5 py-2.5 text-sm font-black text-white ${mode==='block'?'bg-rose-600':'bg-amber-500'}`}>Lưu</button></div></div></div>
}
function SuccessNoticeModal({ icon='✓', title, description, onClose }) {
  useEffect(()=>{const timer=window.setTimeout(onClose,2200);return()=>window.clearTimeout(timer)},[onClose])
  return <div className="fixed inset-0 z-[1700] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose()}}><div className="w-full max-w-sm animate-[fadeIn_.25s_ease-out] rounded-3xl border border-emerald-200 bg-white p-6 text-center shadow-2xl dark:border-emerald-500/20 dark:bg-[#111827]"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-3xl dark:bg-emerald-500/15">{icon}</div><h2 className="mt-4 text-xl font-black">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p><button type="button" onClick={onClose} className="mt-5 cursor-pointer rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-black text-white hover:bg-emerald-700">Đã hiểu</button></div></div>
}

function SaveCourseModal({ course, savedLists, onClose, onSaveSeparate, onSaveToList, onCreateList }) {
  return <div className="fixed inset-0 z-[1650] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose()}}><div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111827]"><div className="border-b border-slate-200 p-6 dark:border-white/10"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Lưu bài học</p><h2 className="mt-1 text-xl font-black">Chọn nơi lưu</h2><p className="mt-2 line-clamp-2 text-sm text-slate-500">{stripHtml(course?.title)}</p></div><button type="button" onClick={onClose} className="grid h-10 w-10 cursor-pointer place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10">×</button></div></div><div className="max-h-[55vh] overflow-y-auto p-5"><button type="button" onClick={onSaveSeparate} className="group flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg dark:border-blue-400/20 dark:from-blue-500/10 dark:to-indigo-500/10"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-600 text-2xl text-white shadow-lg shadow-blue-500/20">★</span><span><b className="block text-blue-800 dark:text-blue-200">Lưu riêng</b><span className="mt-1 block text-xs leading-5 text-blue-600/80 dark:text-blue-300/80">Đưa bài vào mục Bài đăng đã lưu, không thuộc danh sách nào.</span></span></button><div className="mt-5 flex items-center justify-between"><h3 className="text-sm font-black">Danh sách lưu đã tạo</h3><button type="button" onClick={onCreateList} className="cursor-pointer text-xs font-black text-blue-600 hover:underline">+ Tạo danh sách mới</button></div><div className="mt-3 grid gap-2">{savedLists.map((list)=>{const exists=(list.courseIds||[]).map(String).includes(String(course?.id));return <button key={list.id} type="button" onClick={()=>onSaveToList(list)} className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50 dark:border-white/10 dark:hover:bg-blue-500/10"><span className="min-w-0"><b className="block truncate">{list.title}</b><span className="mt-1 block text-xs text-slate-500">{(list.courseIds||[]).length} bài học</span></span><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${exists?'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300':'bg-slate-100 text-slate-500 dark:bg-white/10'}`}>{exists?'Đã có':'Lưu vào'}</span></button>})}{!savedLists.length&&<div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/15">Bạn chưa tạo danh sách lưu nào. Hãy dùng “Lưu riêng” hoặc tạo danh sách mới.</div>}</div></div></div></div>
}

function PlaylistCreateModal({ courses, ownerId, teacherProfilesById = {}, mode = 'playlist', initialPlaylist = null, onClose, onCreate }) {
  const editing=Boolean(initialPlaylist?.id)
  const [title,setTitle]=useState(initialPlaylist?.title || '')
  const [description,setDescription]=useState(initialPlaylist?.description || '')
  const [thumbnail,setThumbnail]=useState(initialPlaylist?.thumbnail || '')
  const [thumbnailFileName,setThumbnailFileName]=useState(initialPlaylist?.thumbnailFileName || '')
  const [searchText,setSearchText]=useState('')
  const [courseIds,setCourseIds]=useState(Array.isArray(initialPlaylist?.courseIds) ? initialPlaylist.courseIds : [])
  const [uploading,setUploading]=useState(false)
  const toggle=(id)=>setCourseIds((items)=>items.includes(id)?items.filter((item)=>item!==id):[...items,id])
  const filtered=courses.filter((course)=>[stripHtml(course.title),course.teacherName,course.category].some((value)=>String(value||'').toLowerCase().includes(searchText.trim().toLowerCase())))
  async function uploadThumbnail(event) {
    const file=event.target.files?.[0]
    if(!file||!ownerId)return
    if(!String(file.type||'').startsWith('image/')||file.size>5*1024*1024){alert('Chỉ hỗ trợ ảnh tối đa 5 MB.');return}
    try{setUploading(true);const uploadResult=await eLearningApi.uploadAsset(file,'playlist-image','playlist-images');const url=uploadResult?.url||uploadResult?.publicUrl||uploadResult?.fileUrl||'';setThumbnail(url);setThumbnailFileName(file.name)}catch(error){console.error('Không thể tải ảnh bộ sưu tập:',error);alert('Không thể tải ảnh lên.')}finally{setUploading(false);event.target.value=''}
  }
  return <div className="fixed inset-0 z-[1300] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-[#111827]"><div className="flex items-start justify-between border-b border-slate-200 p-6 dark:border-white/10"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">{mode==='saved'?'Danh sách lưu cá nhân':'Danh sách phát'}</p><h2 className="mt-1 text-2xl font-black">{editing?(mode==='saved'?'Chỉnh sửa danh sách lưu':'Chỉnh sửa danh sách phát'):mode==='saved'?'Tạo danh sách lưu':'Tạo danh sách phát'}</h2><p className="mt-1 text-sm text-slate-500">{mode==='saved'?'Danh sách này chỉ thuộc mục Đã lưu và không xuất hiện trong Bài đã đăng.':'Tạo danh sách phát từ các bài học đã đăng.'}</p></div><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10">×</button></div><div className="min-h-0 flex-1 overflow-y-auto p-6"><div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]"><div className="space-y-4"><div className="aspect-video overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-blue-600 to-violet-700 dark:border-white/20">{thumbnail?<img src={thumbnail} alt="Thumbnail bộ sưu tập" className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center text-center text-white"><div><div className="text-4xl">▣</div><p className="mt-2 text-xs font-black">ẢNH BỘ SƯU TẬP</p></div></div>}</div><input value={thumbnail} onChange={(event)=>setThumbnail(event.target.value)} placeholder="Dán URL thumbnail" className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-3 text-sm outline-none dark:border-white/15"/><label className="block cursor-pointer rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm font-black text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300">{uploading?'Đang tải ảnh...':'Tải ảnh từ máy'}<input type="file" accept="image/*" onChange={uploadThumbnail} className="hidden"/></label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder={mode==='saved'?'Tên danh sách lưu *':'Tên danh sách phát *'} className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-3 text-sm outline-none dark:border-white/15"/><textarea value={description} onChange={e=>setDescription(e.target.value)} rows="5" placeholder="Mô tả danh sách" className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-3 text-sm outline-none dark:border-white/15"/></div><div><div className="sticky top-0 z-10 bg-white pb-3 dark:bg-[#111827]"><input value={searchText} onChange={(event)=>setSearchText(event.target.value)} placeholder="Tìm bài học theo tên, người đăng hoặc môn..." className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-white/15 dark:bg-white/[0.05]"/><p className="mt-2 text-xs font-semibold text-slate-500">Đã chọn {courseIds.length} bài học</p></div><div className="grid gap-3">{filtered.map((course)=>{const selected=courseIds.includes(course.id);const teacherName=getCourseTeacherName(course,teacherProfilesById);return <button key={course.id} type="button" onClick={()=>toggle(course.id)} className={`flex gap-3 rounded-2xl border p-3 text-left transition ${selected?'border-blue-500 bg-blue-50 ring-2 ring-blue-500/10 dark:bg-blue-500/10':'border-slate-200 hover:border-blue-300 dark:border-white/10'}`}><div className="aspect-video w-32 shrink-0 overflow-hidden rounded-xl"><ChannelCourseThumbnail course={course}/></div><div className="min-w-0 flex-1"><p className="line-clamp-2 font-black">{stripHtml(course.title)}</p><p className="mt-1 truncate text-xs font-semibold text-slate-500">{teacherName}</p><p className="mt-2 text-xs text-slate-400">{course.category||'Môn học'} • {Number(course.views||0).toLocaleString('vi-VN')} lượt xem</p></div><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-black ${selected?'bg-blue-600 text-white':'bg-slate-100 text-slate-400 dark:bg-white/10'}`}>{selected?'✓':'+'}</span></button>})}{!filtered.length&&<div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-white/15">Không tìm thấy bài học phù hợp.</div>}</div></div></div></div><div className="flex justify-end gap-2 border-t border-slate-200 p-5 dark:border-white/10"><button onClick={onClose} className="rounded-full px-5 py-2.5 text-sm font-black">Hủy</button><button disabled={!title.trim()} onClick={()=>onCreate({title,description,courseIds,thumbnail,thumbnailFileName})} className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-black text-white disabled:opacity-40">{editing?'Lưu thay đổi':mode==='saved'?'Tạo danh sách lưu':'Tạo danh sách phát'}</button></div></div></div>
}

function PlaylistPreviewModal({ playlist, courses, onClose, onOpen, onPlayAll, onRemoveCourse, onEdit }) {
  const playlistItems=(playlist?.courseIds||[]).map((id)=>{
    const course=courses.find((item)=>String(item.id)===String(id))
    const status=String(course?.status||course?.moderationStatus||'').toLowerCase()
    return { id:String(id), course, deleted:!course||status==='deleted' }
  })
  const availableCount=playlistItems.filter((item)=>!item.deleted).length
  return <div className="fixed inset-0 z-[1350] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose()}}><div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-[#111827]" onMouseDown={(event)=>event.stopPropagation()}><div className="relative h-48 overflow-hidden bg-gradient-to-br from-blue-600 to-violet-800">{playlist?.thumbnail&&<img src={playlist.thumbnail} className="h-full w-full object-cover" alt={playlist.title}/>}<div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/10"/><div className="absolute right-4 top-4 flex gap-2">{onEdit&&<button onClick={()=>onEdit(playlist)} className="cursor-pointer rounded-full bg-white/90 px-4 py-2 text-sm font-black text-blue-700 shadow backdrop-blur">✎ Chỉnh sửa</button>}<button onClick={onClose} className="grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-black/40 text-white backdrop-blur">×</button></div><div className="absolute inset-x-0 bottom-0 p-6 text-white"><p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">{availableCount}/{playlistItems.length} bài còn khả dụng</p><div className="mt-1 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-3xl font-black">{playlist?.title}</h2><p className="mt-2 max-w-2xl text-sm text-white/80">{playlist?.description||'Danh sách học tập đã lưu.'}</p></div>{onPlayAll&&availableCount>0&&<button type="button" onClick={()=>onPlayAll(playlist)} className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-blue-700 shadow-xl transition hover:-translate-y-0.5 hover:scale-105"><span>▶</span> Phát tất cả</button>}</div></div></div><div className="max-h-[58vh] overflow-y-auto p-5"><div className="grid gap-3 sm:grid-cols-2">{playlistItems.map((item)=>item.deleted?<div key={item.id} className="relative flex cursor-not-allowed gap-3 rounded-2xl border border-slate-300 bg-slate-100 p-3 text-left opacity-75 grayscale dark:border-white/10 dark:bg-white/[0.05]"><div className="grid aspect-video w-32 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-300 text-3xl dark:bg-white/10">🗑️</div><div className="min-w-0"><p className="font-black text-slate-500 dark:text-slate-400">Bài đã xóa</p><p className="mt-2 text-xs leading-5 text-slate-400">Nội dung này không còn tồn tại hoặc đã bị người đăng xóa.</p></div>{onRemoveCourse&&<button type="button" onClick={()=>onRemoveCourse(item.id)} className="absolute right-2 top-2 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-white text-rose-600 shadow transition hover:scale-110 hover:bg-rose-600 hover:text-white dark:bg-[#182235]" title="Xóa khỏi danh sách phát">×</button>}</div>:<div key={item.id} className="relative"><button onClick={()=>onOpen?.(item.course)} className="flex w-full cursor-pointer gap-3 rounded-2xl border border-slate-200 p-3 pr-11 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg dark:border-white/10"><div className="aspect-video w-32 shrink-0 overflow-hidden rounded-xl"><ChannelCourseThumbnail course={item.course}/></div><div className="min-w-0"><p className="line-clamp-2 font-black">{stripHtml(item.course.title)}</p><p className="mt-2 text-xs text-slate-500">{item.course.category||'Môn học'} • {Number(item.course.views||0).toLocaleString('vi-VN')} lượt xem</p></div></button>{onRemoveCourse&&<button type="button" onClick={()=>onRemoveCourse(item.id)} className="absolute right-2 top-2 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-white text-rose-600 shadow transition hover:scale-110 hover:bg-rose-600 hover:text-white dark:bg-[#182235]" title="Xóa khỏi danh sách phát">×</button>}</div>)}{!playlistItems.length&&<div className="sm:col-span-2 rounded-2xl border border-dashed border-slate-300 p-12 text-center text-sm text-slate-500 dark:border-white/15">Danh sách chưa có bài học.</div>}</div></div></div></div>
}

function SavedLibraryPanel({ courses, teacherProfilesById = {}, savedLists = [], sort, setSort, onOpen, onOpenChannel, onUnsave, unsavingCourseId = '', onOpenSavedList, onCreateSavedList, onImportSavedList, onEditSavedList, onShareSavedList, onDeleteSavedList }) {
  const [createMenuOpen,setCreateMenuOpen]=useState(false)
  return <section className="animate-[fadeIn_.3s_ease-out] py-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Thư viện cá nhân</p><h1 className="mt-2 text-3xl font-black">Đã lưu</h1><p className="mt-1 text-sm text-slate-500">Danh sách lưu là bộ sưu tập cá nhân.</p></div>{sort==='lists'&&<div className="relative"><button onClick={()=>setCreateMenuOpen((value)=>!value)} className="cursor-pointer rounded-full bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20">+ Danh sách lưu ▾</button>{createMenuOpen&&<><button type="button" aria-label="Đóng menu" onClick={()=>setCreateMenuOpen(false)} className="fixed inset-0 z-40 cursor-default"/><div className="absolute right-0 top-14 z-50 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-[#182235]"><button type="button" onClick={()=>{setCreateMenuOpen(false);onCreateSavedList?.()}} className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-black hover:bg-blue-50 dark:hover:bg-blue-500/10"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">＋</span>Tạo danh sách</button><button type="button" onClick={()=>{setCreateMenuOpen(false);onImportSavedList?.()}} className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-black hover:bg-emerald-50 dark:hover:bg-emerald-500/10"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">⇩</span>Lấy danh sách</button></div></>}</div>}</div><div className="mt-6 inline-flex rounded-2xl bg-slate-100 p-1.5 dark:bg-white/[0.06]"><button onClick={()=>setSort('posts')} className={`cursor-pointer rounded-xl px-5 py-2.5 text-sm font-black ${sort==='posts'?'bg-white text-blue-600 shadow dark:bg-[#182235]':'text-slate-500'}`}>Bài đăng</button><button onClick={()=>setSort('lists')} className={`cursor-pointer rounded-xl px-5 py-2.5 text-sm font-black ${sort==='lists'?'bg-white text-blue-600 shadow dark:bg-[#182235]':'text-slate-500'}`}>Danh sách lưu</button></div>{sort==='posts'?(courses.length?<div className="mt-6"><VideoGrid>{courses.map((course)=><div key={course.id} className={`relative transition-all duration-300 ${unsavingCourseId===course.id?'scale-95 opacity-40 blur-[1px]':''}`}><VideoCourseCard course={course} canManage={false} teacherProfilesById={teacherProfilesById} openMenuId={null} onToggleMenu={()=>{}} onOpen={onOpen} onOpenChannel={onOpenChannel}/><button type="button" disabled={Boolean(unsavingCourseId)} onClick={()=>onUnsave?.(course)} className="group mt-2 flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 active:scale-95 disabled:cursor-wait"><span className="transition group-hover:rotate-12">★</span>{unsavingCourseId===course.id?'Đang hủy lưu...':'Đang lưu'}</button></div>)}</VideoGrid></div>:<div className="mt-6 rounded-3xl border border-dashed border-slate-300 p-14 text-center text-sm text-slate-500 dark:border-white/15">Bạn chưa lưu bài học nào.</div>):(savedLists.length?<div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{savedLists.map((list)=><PlaylistCoverCard key={list.id} playlist={list} courses={courses} onOpen={()=>onOpenSavedList?.(list)} onEdit={()=>onEditSavedList?.(list)} onShare={()=>onShareSavedList?.(list)} onDelete={()=>onDeleteSavedList?.(list)}/>)}</div>:<div className="mt-6 rounded-3xl border border-dashed border-slate-300 p-14 text-center text-sm text-slate-500 dark:border-white/15">Bạn chưa tạo danh sách lưu nào.</div>)}</section>
}

function PlaylistCoverCard({ playlist, courses, onOpen, onEdit, onShare, onDelete }) {
  const count=(playlist.courseIds||[]).filter((id)=>courses.some((course)=>String(course.id)===String(id)&&String(course.status||course.moderationStatus||'approved').toLowerCase()!=='deleted')).length
  const isOriginalSharedList=!playlist.importedFromListId&&String(playlist.shareCode||'').length===6
  const sharedSaveCount=Math.max(0,Number(playlist.sharedSaveCount||0))
  return <article className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-white/[0.04]"><button type="button" onClick={onOpen} className="block w-full cursor-pointer text-left"><div className="relative aspect-video overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-700 to-violet-900">{playlist.thumbnail?<img src={playlist.thumbnail} alt={playlist.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/>:<div className="grid h-full place-items-center text-white"><div className="text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/25 bg-white/15 text-2xl">▣</div><p className="mt-3 text-[10px] font-black tracking-[0.18em]">DANH SÁCH HỌC</p></div></div>}{isOriginalSharedList&&<span title={`${sharedSaveCount} người đã lưu danh sách này`} className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-emerald-600/90 px-3 py-1 text-xs font-black text-white shadow-lg backdrop-blur">👥 {sharedSaveCount} lượt lưu</span>}<span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-black text-white backdrop-blur">{count} bài</span></div><div className="p-5"><h3 className="truncate text-lg font-black">{playlist.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{playlist.description||'Danh sách học tập cá nhân'}</p><span className="mt-4 inline-flex text-sm font-black text-blue-600">Mở danh sách →</span></div></button><div className="absolute right-3 top-3 z-30 flex gap-2">{onShare&&<button type="button" onClick={(event)=>{event.preventDefault();event.stopPropagation();onShare()}} title="Chia sẻ danh sách lưu" className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-white/60 bg-slate-950/55 text-base font-black text-white shadow-lg backdrop-blur-md transition hover:scale-110 hover:bg-emerald-600">↗</button>}{onEdit&&<button type="button" onClick={(event)=>{event.preventDefault();event.stopPropagation();onEdit()}} title="Chỉnh sửa danh sách lưu" className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-white/60 bg-slate-950/55 text-base font-black text-white shadow-lg backdrop-blur-md transition hover:scale-110 hover:bg-blue-600">✎</button>}{onDelete&&<button type="button" onClick={(event)=>{event.preventDefault();event.stopPropagation();onDelete()}} title="Xóa danh sách lưu" className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-white/60 bg-slate-950/55 text-base font-black text-white shadow-lg backdrop-blur-md transition hover:scale-110 hover:bg-rose-600">🗑</button>}</div></article>
}

function SavedListShareModal({ list, onClose }) {
  const code=String(list?.shareCode||'')
  async function copyCode(){try{await navigator.clipboard.writeText(code)}catch{}}
  return <div className="fixed inset-0 z-[1750] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose()}}><div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-white/10 dark:bg-[#111827]"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-3xl dark:bg-emerald-500/15">↗</div><h2 className="mt-4 text-2xl font-black">Chia sẻ danh sách lưu</h2><p className="mt-2 text-sm leading-6 text-slate-500">Gửi mã này cho người khác để họ lấy một bản sao của “{list?.title}”.</p><div className="mt-5 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50 px-5 py-5 dark:border-emerald-500/30 dark:bg-emerald-500/10"><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Mã chia sẻ</p><p className="mt-2 select-all font-mono text-4xl font-black tracking-[0.2em] text-slate-950 dark:text-white">{code||'......'}</p></div><div className="mt-5 flex gap-2"><button type="button" onClick={onClose} className="flex-1 rounded-full border border-slate-200 px-5 py-3 text-sm font-black dark:border-white/10">Đóng</button><button type="button" disabled={!code} onClick={copyCode} className="flex-1 rounded-full bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-40">Sao chép mã</button></div></div></div>
}

function ImportSavedListModal({ onClose, onImport }) {
  const [code,setCode]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('')
  async function submit(){if(busy)return;setError('');setBusy(true);try{await onImport(code)}catch(err){setError(err?.message||'Không thể lấy danh sách.')}finally{setBusy(false)}}
  return <div className="fixed inset-0 z-[1750] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose()}}><div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#111827]"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Lấy danh sách</p><h2 className="mt-1 text-2xl font-black">Nhập mã chia sẻ</h2></div><button type="button" onClick={onClose} className="grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-slate-100 dark:bg-white/10">×</button></div><p className="mt-3 text-sm leading-6 text-slate-500">Nhập đúng mã gồm 6 chữ hoa, chữ thường hoặc số do chủ danh sách gửi.</p><input autoFocus value={code} onChange={(event)=>{setCode(event.target.value.replace(/[^A-Za-z0-9]/g,'').slice(0,6));setError('')}} onKeyDown={(event)=>{if(event.key==='Enter'&&code.length===6)submit()}} maxLength={6} placeholder="Ví dụ: aB3xY7" className="mt-5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-4 text-center font-mono text-2xl font-black tracking-[0.18em] outline-none focus:border-emerald-500 dark:border-white/15 dark:bg-white/[0.05]"/>{error&&<p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-600 dark:bg-rose-500/10">{error}</p>}<button type="button" disabled={busy||code.length!==6} onClick={submit} className="mt-5 w-full rounded-full bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{busy?'Đang lấy danh sách...':'Xác nhận lấy danh sách'}</button></div></div>
}

function ChannelReportModal({ channel, onClose, onSubmit }) {
  const reasons=['Giả mạo tài khoản','Nội dung không phù hợp','Spam hoặc quảng cáo','Thông tin sai lệch','Vi phạm bản quyền','Khác']
  const [reason,setReason]=useState(reasons[0]);const [detail,setDetail]=useState('')
  return <div className="fixed inset-0 z-[1400] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#171717]"><h2 className="text-xl font-black">Báo cáo kênh {channel?.name}</h2><p className="mt-2 text-sm text-slate-500">Chọn lý do phù hợp để quản trị viên kiểm tra.</p><div className="mt-5 grid gap-2 sm:grid-cols-2">{reasons.map((item)=><button key={item} onClick={()=>setReason(item)} className={`rounded-xl border px-3 py-3 text-left text-sm font-bold ${reason===item?'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-500/10':'border-slate-200 dark:border-white/10'}`}>{item}</button>)}</div><textarea value={detail} onChange={(event)=>setDetail(event.target.value)} rows="4" placeholder="Mô tả thêm..." className="mt-4 w-full rounded-2xl border border-slate-300 bg-transparent p-4 text-sm outline-none dark:border-white/15"/><div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="rounded-full px-5 py-2.5 text-sm font-black">Hủy</button><button onClick={()=>onSubmit({reason,detail})} className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-black text-white">Gửi báo cáo</button></div></div></div>
}

function PresenterChannel({ profile, channelId, currentUserId, isFollowing, playlists = [], courses, onBack, onOpen, onToggleFollow, onReport, onOpenPlaylist, onAvatarClick }) {
  const getChannelTabFromUrl = () => {
    if (typeof window === 'undefined') return 'courses'

    return new URLSearchParams(window.location.search)
      .get('channelTab') === 'playlists'
      ? 'playlists'
      : 'courses'
  }

  const [followBusy,setFollowBusy]=useState(false)
  const [followPulse,setFollowPulse]=useState(false)
  const [tab,setTab]=useState(getChannelTabFromUrl)

  const changeChannelTab = (tabId) => {
    const safeTab =
      tabId === 'playlists'
        ? 'playlists'
        : 'courses'

    setTab(safeTab)

    if (typeof window === 'undefined') return

    const url = new URL(window.location.href)

    if (safeTab === 'courses') {
      url.searchParams.delete('channelTab')
    } else {
      url.searchParams.set('channelTab', safeTab)
    }

    window.history.pushState(
      {},
      '',
      `${url.pathname}${url.search}${url.hash}`,
    )
  }

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncChannelTabFromUrl = () => {
      const requestedTab =
        new URLSearchParams(window.location.search)
          .get('channelTab')

      setTab(
        requestedTab === 'playlists'
          ? 'playlists'
          : 'courses',
      )
    }

    window.addEventListener(
      'popstate',
      syncChannelTabFromUrl,
    )

    return () =>
      window.removeEventListener(
        'popstate',
        syncChannelTabFromUrl,
      )
  }, [])
  const name=profile?.fullName||profile?.name||profile?.displayName||profile?.email||'Kênh ZUNY';const avatar=getUserAvatar(profile);const cover=profile?.coverURL||profile?.coverImage||profile?.banner||'';const bio=profile?.bio||profile?.description||'Chia sẻ kiến thức và tài nguyên học tập trên ZUNY.';const followers=Number(profile?.followersCount||profile?.followerCount||0);const views=courses.reduce((sum,item)=>sum+Number(item.views||0),0);const subjects=Array.from(new Set(courses.map((item)=>item.category).filter(Boolean)));const ownChannel=String(channelId||'')===String(currentUserId||'');const normalizedChannelRole=String(profile?.role||profile?.Role||profile?.accountType||profile?.userRole||'').replace(/[\s_-]/g,'').toUpperCase();const isAdminChannel=['ADMIN','ADMINDEV'].includes(normalizedChannelRole);const isVerifiedChannel=Boolean(profile?.elearningVerified)
  async function handleFollowClick(){if(followBusy)return;setFollowBusy(true);setFollowPulse(true);try{await onToggleFollow(channelId)}finally{window.setTimeout(()=>setFollowPulse(false),520);setFollowBusy(false)}}
  return <section className="animate-[fadeIn_.35s_ease-out] bg-white py-6 text-slate-950 dark:bg-[#0b1120] dark:text-white"><button onClick={onBack} className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black shadow-sm transition hover:-translate-x-1 dark:border-white/10 dark:bg-white/[0.06]">← Quay lại thư viện</button><div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/5 dark:border-white/10 dark:bg-[#111827]"><div className="relative h-52 overflow-hidden bg-gradient-to-r from-blue-200 via-indigo-200 to-violet-200 dark:from-blue-950 dark:via-indigo-950 dark:to-violet-950 sm:h-64">{cover&&<img src={cover} className="h-full w-full object-cover" alt="Ảnh bìa kênh"/>}<div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent"/></div><div className="relative bg-gradient-to-b from-blue-100 via-white to-white px-5 pb-8 dark:bg-none sm:px-8"><div className="-mt-16 flex flex-col gap-5 sm:-mt-20 sm:flex-row sm:items-end"><button type="button" onClick={onAvatarClick} title={ownChannel ? "Mở tài khoản chính" : `Mở kênh của ${name}`} className="relative grid h-32 w-32 shrink-0 place-items-center overflow-visible rounded-[2rem] border-4 border-white bg-gradient-to-br from-blue-500 to-indigo-700 text-3xl font-black text-white shadow-2xl transition hover:scale-[1.03] dark:border-[#111827]"><span className="h-full w-full overflow-hidden rounded-[1.65rem]">{avatar?<img src={avatar} className="h-full w-full object-cover" alt={name}/>:<span className="grid h-full w-full place-items-center">{getInitials(name)}</span>}</span>{(isAdminChannel||isVerifiedChannel)&&<span className={`absolute -bottom-2 -right-2 grid h-8 w-8 place-items-center rounded-full border-4 border-white text-sm font-black text-white shadow-lg dark:border-[#111827] ${isAdminChannel?'bg-amber-500':'bg-blue-600'}`}>✓</span>}</button><div className="min-w-0 flex-1 pb-1"><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">Người sáng tạo nội dung</p><div className="mt-1 flex min-w-0 flex-wrap items-center gap-3"><h1 className="truncate text-3xl font-black text-slate-950 dark:text-white sm:text-4xl">{name}</h1>{isAdminChannel?<span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1 text-xs font-black text-white">ADMIN ✓</span>:isVerifiedChannel?<span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-black text-white">Đã xác nhận ✓</span>:null}</div><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{bio}</p></div>{!ownChannel&&currentUserId&&<div className="mb-1 flex shrink-0 flex-wrap gap-2"><button type="button" disabled={followBusy} onClick={handleFollowClick} className={`rounded-full px-6 py-3 text-sm font-black transition ${isFollowing?'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300':'bg-red-600 text-white'} ${followPulse?'scale-105 ring-4 ring-blue-400/20':''}`}>{followBusy?'Đang cập nhật...':isFollowing?'✓ Đang theo dõi':'+ Theo dõi'}</button><button type="button" onClick={()=>onReport?.({id:channelId,name})} className="rounded-full border border-rose-300 bg-white px-5 py-3 text-sm font-black text-rose-600 hover:bg-rose-50 dark:border-rose-400/30 dark:bg-white/[0.04] dark:hover:bg-rose-500/10">⚑ Báo cáo</button></div>}</div><div className="mt-6 grid gap-3 sm:grid-cols-3"><ChannelStat label="Bài học công khai" value={courses.length} icon="🎬"/><ChannelStat label="Tổng lượt xem" value={views.toLocaleString('vi-VN')} icon="👁️"/><ChannelStat label="Người theo dõi" value={followers.toLocaleString('vi-VN')} icon="👥"/></div>{subjects.length>0&&<div className="mt-5 flex flex-wrap gap-2">{subjects.slice(0,8).map(subject=><span key={subject} className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">{subject}</span>)}</div>}<div className="mt-9 flex gap-2 border-b border-slate-200 dark:border-white/10"><button onClick={()=>changeChannelTab('courses')} className={`relative px-5 py-3 text-sm font-black ${tab==='courses'?'text-blue-600':'text-slate-500'}`}>Bài học công khai ({courses.length}){tab==='courses'&&<span className="absolute inset-x-2 bottom-0 h-0.5 bg-blue-600"/>}</button><button onClick={()=>changeChannelTab('playlists')} className={`relative px-5 py-3 text-sm font-black ${tab==='playlists'?'text-blue-600':'text-slate-500'}`}>Danh sách phát ({playlists.length}){tab==='playlists'&&<span className="absolute inset-x-2 bottom-0 h-0.5 bg-blue-600"/>}</button></div>{tab==='courses'?(courses.length?<div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{courses.map(c=><button key={c.id} onClick={()=>onOpen(c)} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm transition duration-300 hover:-translate-y-1.5 hover:shadow-xl dark:border-white/10 dark:bg-white/[0.03]"><div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-black"><ChannelCourseThumbnail course={c}/></div><div className="p-5"><p className="line-clamp-2 text-base font-black leading-6 group-hover:text-blue-600 dark:group-hover:text-blue-400">{stripHtml(c.title)}</p><div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500"><span>{Number(c.views||0).toLocaleString('vi-VN')} lượt xem</span><span className="text-blue-600">Xem bài →</span></div></div></button>)}</div>:<div className="mt-5 rounded-3xl border border-dashed border-slate-300 px-6 py-16 text-center text-slate-500 dark:border-white/15">Kênh chưa có bài học.</div>):(playlists.length?<div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{playlists.map((playlist)=><PlaylistCoverCard key={playlist.id} playlist={playlist} courses={courses} onOpen={()=>onOpenPlaylist?.(playlist)}/>)}</div>:<div className="mt-5 rounded-3xl border border-dashed border-slate-300 px-6 py-16 text-center text-slate-500 dark:border-white/15">Kênh chưa có danh sách phát.</div>)}</div></div></section>
}

function ChannelCourseThumbnail({ course }) {
  const [imageFailed,setImageFailed]=useState(false)
  const customThumbnail=String(course?.thumbnail||'').trim()
  const format=getCourseFormat(course)
  if(customThumbnail&&!imageFailed)return <img src={customThumbnail} onError={()=>setImageFailed(true)} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" alt={stripHtml(course?.title)||'Thumbnail bài học'}/>
  const visual=format==='document'?{icon:'📄',label:'TÀI LIỆU',classes:'from-emerald-600 via-teal-600 to-cyan-800'}:format==='simulation'?{icon:'⚙',label:'MÔ PHỎNG',classes:'from-violet-700 via-purple-700 to-indigo-900'}:{icon:'▶',label:'VIDEO BÀI GIẢNG',classes:'from-rose-600 via-red-600 to-fuchsia-800'}
  return <div className={`relative grid h-full place-items-center overflow-hidden bg-gradient-to-br ${visual.classes} text-white`}><div className="absolute -left-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl"/><div className="absolute -bottom-16 -right-8 h-48 w-48 rounded-full bg-black/15 blur-2xl"/><div className="relative text-center"><div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl border border-white/20 bg-white/10 text-4xl shadow-2xl backdrop-blur">{visual.icon}</div><p className="mt-4 text-xs font-black tracking-[0.18em] text-white/90">{visual.label}</p><p className="mt-2 max-w-[240px] truncate px-4 text-sm font-bold text-white/80">{course.category||'Bài học ZUNY'}</p></div></div>
}

function ChannelStat({ label, value, icon }) { return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]"><div className="flex items-center justify-between"><span className="text-2xl">{icon}</span><b className="text-2xl">{value}</b></div><p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">{label}</p></div> }

function formatReportDate(value) {
  const time = getAnyTime(value)
  if (!time) return 'Chưa có thời gian'
  return new Date(time).toLocaleString('vi-VN')
}

export default Courses

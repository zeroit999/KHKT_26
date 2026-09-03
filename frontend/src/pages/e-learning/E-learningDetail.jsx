import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import eLearningApi from '../../services/eLearningApi.js'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { getUserAvatar } from '../../utils/userAvatar.js'
import { CourseGateState, DetailHeader, DescriptionBox, MainLearningViewer, DetailSidebar, PlaylistPanel, OverviewList, CBTStudyPanel, LessonDetailBlock, EmptyLearningState, NotesPanel, MiniQuizPanel, RatingStars, QAPanel, NextCoursePanel, CompletionModal, HonestyWarningModal } from './e-learning-detail/components/DetailComponents'
import { useDarkMode, isCourseLocked, canAccessCourseByClass, getUserClassName, isTeacherRole, getRatingAverage, normalizeTextList, normalizeChecklist, normalizeQuiz, getYoutubeVideoId, markAllChecklistDone, getLocalDateKey, canTrackLearningProgress, isStudentRole, getOpenAtMs, normalizeText, formatOpenAt, stripHtml } from './e-learning-detail/utils/detailUtils'


const getTime = (value) => {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') return new Date(value).getTime() || 0
  return Number(value?.seconds || 0) * 1000
}

const normalizeCourses = (payload) => Array.isArray(payload?.courses) ? payload.courses : []
const normalizeSavedLists = (payload) =>
  (Array.isArray(payload?.lists) ? payload.lists : [])
    .sort((a, b) => getTime(b.updatedAt || b.createdAt) - getTime(a.updatedAt || a.createdAt))

const teacherIdFromCourse = (courseData) => String(
  courseData?.teacherId ||
  courseData?.createdByUid ||
  courseData?.createdBy ||
  courseData?.ownerId ||
  courseData?.userId ||
  courseData?.uid ||
  ''
)

function CourseDetail() {
  const { id: courseId } = useParams()
  const navigate = useNavigate()
  const { user: currentUser, userDetails } = useAuth()
  const userProfile = userDetails || null
  const currentRole =
    userProfile?.role ||
    userProfile?.Role ||
    userProfile?.accountType ||
    userProfile?.userRole ||
    userProfile?.type ||
    'STUDENT'
  const [userClassMemberships, setUserClassMemberships] = useState([])
  const [userClassMembershipsLoading, setUserClassMembershipsLoading] = useState(false)
  const [courseTeacherProfile, setCourseTeacherProfile] = useState(null)
  const [course, setCourse] = useState(null)
  const [realCourseId, setRealCourseId] = useState(courseId)
  const [loading, setLoading] = useState(true)
  const [selectedRating, setSelectedRating] = useState(0)
  const [ratingBurst, setRatingBurst] = useState(false)
  const [submittingRating, setSubmittingRating] = useState(false)
  const [skipWarning, setSkipWarning] = useState(null)
  const [learningRecord, setLearningRecord] = useState({})
  const [noteDraft, setNoteDraft] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [noteColor, setNoteColor] = useState('#000000')
  const [quizAnswers, setQuizAnswers] = useState({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [completionOpen, setCompletionOpen] = useState(false)
  const [nextCourse, setNextCourse] = useState(null)
  const validDetailTabIds = useMemo(
    () => new Set([
      'overview',
      'notes',
      'quiz',
      'rating',
      'qa',
    ]),
    [],
  )

  const getDetailTabFromUrl = () => {
    if (typeof window === 'undefined') {
      return 'overview'
    }

    const requestedTab =
      new URLSearchParams(
        window.location.search,
      ).get('tab')

    return requestedTab &&
      validDetailTabIds.has(requestedTab)
      ? requestedTab
      : 'overview'
  }

  const [activeDetailTab, setActiveDetailTab] =
    useState(getDetailTabFromUrl)
  const [selectedLessonIndex, setSelectedLessonIndex] = useState(0)
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const [shareNotice, setShareNotice] = useState(false)
  const [playlistOpen, setPlaylistOpen] = useState(false)
  const [playlistCollapsed, setPlaylistCollapsed] = useState(false)
  const [detailSidebarCollapsed, setDetailSidebarCollapsed] = useState(false)
  const [mobileDetailSidebarOpen, setMobileDetailSidebarOpen] = useState(false)
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('Nội dung không phù hợp')
  const [reportDetail, setReportDetail] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [ratingItems, setRatingItems] = useState([])
  const [selfRatingNotice, setSelfRatingNotice] = useState(false)
  const [focusedQuestionId, setFocusedQuestionId] = useState('')
  const [focusedReplyId, setFocusedReplyId] = useState('')
  const [savedLists, setSavedLists] = useState([])
  const [savePickerOpen, setSavePickerOpen] = useState(false)
  const [savingDestination, setSavingDestination] = useState('')
  const [saveNotice, setSaveNotice] = useState(null)
  const [playlistCourses, setPlaylistCourses] = useState([])
  const [simulationFocusMode, setSimulationFocusMode] = useState(false)
  const isDarkMode = useDarkMode()
  const playlistParams = new URLSearchParams(window.location.search)
  const playlistCourseIds = String(playlistParams.get('playlist') || '').split(',').map((item) => item.trim()).filter(Boolean)
  const playlistIndex = Math.max(0, Number(playlistParams.get('playlistIndex') || 0))
  const playlistAutoplay = playlistParams.get('autoplay') === '1'
  const isSimulationCourse = Boolean(
    course?.contentType === 'simulation' ||
    course?.attachMode === 'simulation' ||
    course?.simulationUrl ||
    course?.simulationHtml ||
    course?.simulationCode ||
    Object.values(course?.simulationCodes || {}).some((value) => String(value || '').trim()),
  )
  const simulationLanguageLabels = {
    html: 'HTML / CSS / JavaScript',
    javascript: 'JavaScript',
    typescript: 'TypeScript',
  }
  const simulationLanguageLabel = simulationLanguageLabels[String(course?.simulationLanguage || 'html').toLowerCase()] || String(course?.simulationLanguage || 'HTML / CSS / JavaScript')

  useEffect(() => {
    if (!isSimulationCourse && simulationFocusMode) setSimulationFocusMode(false)
  }, [isSimulationCourse, simulationFocusMode])

  useEffect(() => {
    if (!simulationFocusMode) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSimulationFocusMode(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [simulationFocusMode])

  useEffect(() => {
    let cancelled = false
    if (!playlistCourseIds.length) {
      setPlaylistCourses([])
      return undefined
    }

    async function loadPlaylistCourses() {
      try {
        const items = await Promise.all(
          playlistCourseIds.map(async (id) => {
            try {
              const response = await eLearningApi.course(id)
              const data = response?.course || null
              if (!data) return null
              const status = String(data.status || data.moderationStatus || 'approved').toLowerCase()
              return status === 'deleted' ? null : data
            } catch {
              return null
            }
          }),
        )
        if (!cancelled) setPlaylistCourses(items.filter(Boolean))
      } catch (error) {
        console.warn('Không thể tải danh sách phát trong trang chi tiết:', error)
        if (!cancelled) setPlaylistCourses([])
      }
    }

    loadPlaylistCourses()
    return () => { cancelled = true }
  }, [courseId, window.location.search])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') !== 'qa') return
    setActiveDetailTab(
      validDetailTabIds.has('qa')
        ? 'qa'
        : 'overview',
    )
    setFocusedQuestionId(String(params.get('questionId') || ''))
    setFocusedReplyId(String(params.get('replyId') || ''))
    window.setTimeout(() => document.getElementById('detail-qa')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }, [courseId])

  useEffect(() => {
    if (!learningRecord?.noteColor) {
      setNoteColor(isDarkMode ? '#ffffff' : '#000000')
    }
  }, [isDarkMode, learningRecord?.noteColor])

  useEffect(() => {
    function handleYoutubeSkipWarning(event) {
      setSkipWarning(event.detail || {})
    }

    window.addEventListener('youtube-skip-warning', handleYoutubeSkipWarning)

    return () => {
      window.removeEventListener('youtube-skip-warning', handleYoutubeSkipWarning)
    }
  }, [])

  useEffect(() => {
    if (!currentUser?.uid) {
      setUserClassMemberships([])
      setUserClassMembershipsLoading(false)
      return undefined
    }

    let cancelled = false
    setUserClassMembershipsLoading(true)

    async function loadMemberships() {
      const profileClassName = String(getUserClassName(userProfile) || '').trim()
      const profileGrade = String(userProfile?.grade || userProfile?.Grade || '').trim()

      try {
        const response = await eLearningApi.classrooms()
        const classes = Array.isArray(response?.classes) ? response.classes : []
        const matched = classes.filter((item) => {
          const name = String(item?.name || item?.className || '').trim()
          const grade = String(item?.grade || '').trim()
          return (
            (profileClassName && name.toLowerCase() === profileClassName.toLowerCase()) ||
            (profileGrade && grade === profileGrade)
          )
        })

        if (!cancelled) {
          setUserClassMemberships(
            matched.length
              ? matched
              : (profileClassName || profileGrade
                  ? [{ id: '', name: profileClassName, className: profileClassName, grade: profileGrade }]
                  : []),
          )
        }
      } catch (error) {
        console.warn('Không thể đồng bộ lớp để kiểm tra quyền xem E-learning:', error)
        if (!cancelled) {
          setUserClassMemberships(
            profileClassName || profileGrade
              ? [{ id: '', name: profileClassName, className: profileClassName, grade: profileGrade }]
              : [],
          )
        }
      } finally {
        if (!cancelled) setUserClassMembershipsLoading(false)
      }
    }

    loadMemberships()

    return () => {
      cancelled = true
    }
  }, [currentUser?.uid, userProfile])

  useEffect(() => {
    if (!currentUser?.uid) {
      setSavedLists([])
      return undefined
    }

    let cancelled = false

    async function loadSavedLists() {
      try {
        const response = await eLearningApi.savedLists()
        if (!cancelled) setSavedLists(normalizeSavedLists(response))
      } catch (error) {
        console.warn('Không thể đồng bộ danh sách lưu:', error)
        if (!cancelled) setSavedLists([])
      }
    }

    loadSavedLists()
    const timer = window.setInterval(loadSavedLists, 5000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [currentUser?.uid])

  async function fetchCourseTeacherProfile(courseData) {
    try {
      const teacherId = teacherIdFromCourse(courseData)

      if (!teacherId) {
        setCourseTeacherProfile(null)
        return
      }

      const response = await eLearningApi.forumUsers()
      const users = Array.isArray(response?.users) ? response.users : []
      const teacher = users.find((item) =>
        String(item?.id || item?.uid || item?.user_id || '') === String(teacherId),
      )

      setCourseTeacherProfile(teacher || null)
    } catch (error) {
      console.warn('Không thể lấy tên giáo viên hiện tại:', error)
      setCourseTeacherProfile(null)
    }
  }

  async function fetchNextCourseSuggestion(courseData, currentId) {
    try {
      const courseResponse = await eLearningApi.courses({ limit: 500 })
      const allCourses = normalizeCourses(courseResponse)

      const progressPairs = await Promise.all(
        allCourses.map(async (item) => {
          if (!currentUser?.uid) return [String(item.id), null]
          try {
            const response = await eLearningApi.progress(item.id)
            return [String(item.id), response?.progress || null]
          } catch {
            return [String(item.id), null]
          }
        }),
      )

      const completedCourseIds = new Set(
        progressPairs
          .filter(([, progress]) =>
            Number(progress?.progress || progress?.percent || progress?.completion || 0) >= 100 ||
            Boolean(progress?.completedAt),
          )
          .map(([id]) => id),
      )

      completedCourseIds.add(String(currentId))

      const studentClass = getUserClassName(userProfile)
      const teacherCanViewAll = isTeacherRole(currentRole)
      const eligibleCourses = allCourses.filter((item) => {
        const status = String(item.status || item.moderationStatus || 'approved').toLowerCase()
        const visibility = String(item.visibility || 'public').toLowerCase()
        if (status !== 'approved' || status === 'deleted') return false
        if (visibility === 'class') return false
        if (completedCourseIds.has(String(item.id))) return false
        if (!teacherCanViewAll && isCourseLocked(item)) return false
        if (!teacherCanViewAll && !canAccessCourseByClass(item, studentClass)) return false
        return true
      })

      if (!eligibleCourses.length) {
        setNextCourse(null)
        return
      }

      const randomIndex = Math.floor(Math.random() * eligibleCourses.length)
      setNextCourse(eligibleCourses[randomIndex])
    } catch (error) {
      console.warn('Không thể lấy bài học tiếp theo:', error)
      setNextCourse(null)
    }
  }

  useEffect(() => {
    async function fetchCourseDetail() {
      try {
        let courseData = null

        if (/^\d+$/.test(String(courseId || ''))) {
          try {
            const response = await eLearningApi.course(courseId)
            courseData = response?.course || null
          } catch {
            courseData = null
          }
        }

        if (!courseData) {
          const response = await eLearningApi.courses({ limit: 500 })
          const decodedTitle = decodeURIComponent(courseId)
          courseData = normalizeCourses(response).find(
            (item) => String(item?.title || '') === decodedTitle,
          ) || null
        }

        if (courseData) {
          setRealCourseId(courseData.id)
          setCourse(courseData)
          await fetchCourseTeacherProfile(courseData)
          await fetchNextCourseSuggestion(courseData, courseData.id)
          return
        }

        setCourse(null)
      } catch (error) {
        console.error('Lỗi khi lấy chi tiết bài học:', error)
        setCourse(null)
      } finally {
        setLoading(false)
      }
    }

    fetchCourseDetail()
  }, [courseId])



  useEffect(() => {
    if (!course?.id) return
    fetchNextCourseSuggestion(course, course.id)
  }, [course?.id, currentUser?.uid, currentRole, userProfile?.className, userProfile?.class, userProfile?.lop, userProfile?.studentClass])

  useEffect(() => {
    if (!realCourseId) return undefined

    let cancelled = false

    async function refreshCourse() {
      try {
        const response = await eLearningApi.course(realCourseId)
        if (!cancelled && response?.course) {
          setCourse((previous) => ({ ...(previous || {}), ...response.course }))
        }
      } catch (error) {
        if (!cancelled) console.warn('Không thể đồng bộ lượt xem và đánh giá:', error)
      }
    }

    const timer = window.setInterval(refreshCourse, 5000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [realCourseId])


  useEffect(() => {
    if (!realCourseId) return undefined

    let cancelled = false

    async function loadRatings() {
      try {
        const response = await eLearningApi.ratings(realCourseId)
        if (!cancelled) setRatingItems(Array.isArray(response?.ratings) ? response.ratings : [])
      } catch (error) {
        if (!cancelled) console.warn('Không thể đồng bộ danh sách đánh giá:', error)
      }
    }

    loadRatings()
    const timer = window.setInterval(loadRatings, 5000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [realCourseId])


  useEffect(() => {
    if (!currentUser || !realCourseId || !canTrackLearningProgress(currentRole)) return

    async function loadLearningRecord() {
      try {
        const response = await eLearningApi.progress(realCourseId)
        const data = response?.progress || {}
        setLearningRecord(data)
        setNoteDraft(data.notes || '')
        setNoteColor(data.noteColor || (isDarkMode ? '#ffffff' : '#000000'))
        setQuizSubmitted(Boolean(data.quizResult))
      } catch (error) {
        console.warn('Không thể tải dữ liệu học cá nhân:', error)
        setLearningRecord({})
      }
    }

    loadLearningRecord()
  }, [currentUser, realCourseId, currentRole, isDarkMode])


  useEffect(() => {
    if (!currentUser || !realCourseId || !course || !canTrackLearningProgress(currentRole)) return

    async function saveLearningProgress() {
      try {
        const today = getLocalDateKey()
        const hasYoutubeLesson =
          Boolean(course.youtubeUrl) ||
          (Array.isArray(course.lessons) &&
            course.lessons.some((lesson) =>
              (lesson.attachMode || 'youtube') === 'youtube' &&
              lesson.youtubeUrl,
            ))

        await eLearningApi.updateProgress(realCourseId, {
          watchedDate: today,
          markViewed: true,
          markWatched: true,
          ...(hasYoutubeLesson ? {} : { progress: 100, watchedSeconds: 10 }),
        })

        try {
          const viewResponse = await eLearningApi.addView(realCourseId)

          if (viewResponse?.created) {
            setCourse((previous) =>
              previous ? { ...previous, views: Number(previous.views || 0) + 1 } : previous,
            )
          }
        } catch (error) {
          console.warn('Không thể ghi nhận lượt xem duy nhất:', error)
        }
      } catch (error) {
        console.error('Lỗi khi lưu tiến độ học:', error)
      }
    }

    saveLearningProgress()
  }, [currentUser, realCourseId, course, currentRole, userProfile])


  async function updateLearningRecord(partial) {
    if (!currentUser || !realCourseId || !canTrackLearningProgress(currentRole)) return

    try {
      const response = await eLearningApi.updateProgress(realCourseId, {
        ...partial,
        watchedDate: getLocalDateKey(),
        markViewed: true,
        completed: Number(partial?.progress || 0) >= 100 || Boolean(partial?.completedAt),
      })

      setLearningRecord((prev) => ({
        ...prev,
        ...partial,
        ...(response?.progress || {}),
      }))
    } catch (error) {
      console.error('Không thể cập nhật tiến độ CBT:', error)
    }
  }


  function handleToggleChecklist(itemId) {
    const currentChecklist = learningRecord.completedChecklist || {}
    const nextChecklist = { ...currentChecklist, [itemId]: !currentChecklist[itemId] }
    const checklistItems = normalizeChecklist(course?.checklist)
    const completedCount = checklistItems.filter((item) => nextChecklist[item.id]).length
    const checklistProgress = checklistItems.length ? Math.round((completedCount / checklistItems.length) * 100) : 0
    const nextProgress = Math.max(Number(learningRecord.progress || 0), checklistProgress)
    updateLearningRecord({ completedChecklist: nextChecklist, progress: nextProgress })
    if (checklistItems.length && completedCount === checklistItems.length) setCompletionOpen(true)
  }

  async function handleSaveNotes() {
    setSavingNote(true)
    await updateLearningRecord({ notes: noteDraft, noteColor })
    setSavingNote(false)
  }

  async function handleToggleBookmark() {
    if (!currentUser?.uid) {
      alert('Bạn cần đăng nhập để lưu bài học.')
      return
    }
    if (!learningRecord.bookmarked) {
      setSavePickerOpen(true)
      return
    }
    if (savingDestination) return

    try {
      setSavingDestination('remove')

      await eLearningApi.updateProgress(realCourseId, {
        bookmarked: false,
        markViewed: true,
      })

      const containingLists = savedLists.filter((list) =>
        Array.isArray(list.courseIds) &&
        list.courseIds.map(String).includes(String(realCourseId)),
      )

      const updatedLists = await Promise.all(
        containingLists.map(async (list) => {
          const nextCourseIds = (list.courseIds || [])
            .map(String)
            .filter((courseId) => courseId !== String(realCourseId))

          const response = await eLearningApi.updateSavedList(list.id, {
            courseIds: nextCourseIds,
          })

          return response?.list || {
            ...list,
            courseIds: nextCourseIds,
          }
        }),
      )

      if (updatedLists.length) {
        const updatedMap = new Map(
          updatedLists.map((list) => [String(list.id), list]),
        )

        setSavedLists((current) =>
          current.map((list) =>
            updatedMap.get(String(list.id)) || list,
          ),
        )
      }

      setLearningRecord((current) => ({
        ...current,
        bookmarked: false,
      }))

      setSaveNotice({ removed: true })
      window.setTimeout(() => setSaveNotice(null), 2600)
    } catch (error) {
      console.error('Không thể hủy lưu bài học:', error)
      alert('Không thể hủy lưu bài học. Vui lòng thử lại.')
    } finally {
      setSavingDestination('')
    }
  }


  async function saveCourseToDestination(savedList = null) {
    if (!currentUser?.uid || !realCourseId || savingDestination) return
    const destinationId = savedList?.id || 'private'

    try {
      setSavingDestination(destinationId)

      await eLearningApi.updateProgress(realCourseId, {
        bookmarked: true,
        markViewed: true,
      })

      if (savedList?.id) {
        const nextCourseIds = Array.from(
          new Set([
            ...(Array.isArray(savedList.courseIds)
              ? savedList.courseIds.map(String)
              : []),
            String(realCourseId),
          ]),
        )

        const response = await eLearningApi.updateSavedList(
          savedList.id,
          {
            courseIds: nextCourseIds,
          },
        )

        const updatedList = response?.list || {
          ...savedList,
          courseIds: nextCourseIds,
        }

        setSavedLists((current) =>
          current.map((item) =>
            String(item.id) === String(savedList.id)
              ? updatedList
              : item,
          ),
        )
      }

      setLearningRecord((current) => ({
        ...current,
        bookmarked: true,
      }))

      setSavePickerOpen(false)
      setSaveNotice({
        destination: savedList?.title || 'Đã lưu riêng',
      })

      window.setTimeout(() => setSaveNotice(null), 2600)
    } catch (error) {
      console.error('Không thể lưu bài học:', error)
      alert('Không thể lưu bài học. Vui lòng thử lại.')
    } finally {
      setSavingDestination('')
    }
  }


  function handleQuizAnswer(questionIndex, optionIndex, statementIndex = null) {
    if (quizSubmitted) return
    setQuizAnswers((prev) => {
      if (statementIndex === null) return { ...prev, [questionIndex]: optionIndex }
      const currentStatements = prev[questionIndex] && typeof prev[questionIndex] === 'object'
        ? prev[questionIndex]
        : {}
      return {
        ...prev,
        [questionIndex]: {
          ...currentStatements,
          [statementIndex]: Boolean(optionIndex),
        },
      }
    })
  }

  async function handleSubmitQuiz(quiz) {
    const safeQuiz = normalizeQuiz(quiz)
    const correct = safeQuiz.reduce((sum, item, index) => {
      if (item.sourceType === 'true_false') {
        const answerMap = quizAnswers[index] && typeof quizAnswers[index] === 'object' ? quizAnswers[index] : {}
        const allCorrect = item.statements.every((statement, statementIndex) =>
          Boolean(answerMap[statementIndex]) === Boolean(statement.correct),
        )
        return sum + (allCorrect ? 1 : 0)
      }
      return sum + (Number(quizAnswers[index]) === Number(item.correctAnswer) ? 1 : 0)
    }, 0)
    const result = { correct, total: safeQuiz.length, completedAt: new Date().toISOString() }
    setQuizSubmitted(true)
    await updateLearningRecord({ quizResult: result, progress: Math.max(Number(learningRecord.progress || 0), safeQuiz.length ? 100 : 0), completedChecklist: { ...(learningRecord.completedChecklist || {}), quiz: true } })
    setCompletionOpen(true)
  }

  function handleManualComplete() {
    updateLearningRecord({ progress: 100, completedAt: new Date().toISOString(), completedChecklist: markAllChecklistDone(course?.checklist) })
    setCompletionOpen(true)
  }


  async function createCourseOwnerNotification(notificationId, payload = {}) {
    const ownerId = String(teacherId || '')
    if (!ownerId || !notificationId) return

    try {
      await eLearningApi.createNotification({
        legacyId: notificationId,
        userId: ownerId,
        title: payload.title || 'Thông báo bài học',
        message: payload.message || '',
        type: payload.type || 'course_activity',
        data: {
          courseId: realCourseId,
          actorId: currentUser?.uid || '',
        },
      })
    } catch (error) {
      console.warn('Không thể tạo thông báo cho chủ bài học:', error)
    }
  }


  async function handleRating(value) {
    if (!currentUser) {
      alert('Bạn cần đăng nhập để đánh giá bài học.')
      return
    }
    if (!course || submittingRating) return

    const ownerIds = [course.teacherId, course.createdByUid, course.createdBy, course.ownerId, course.userId, course.uid]
      .filter(Boolean)
      .map(String)

    if (ownerIds.includes(String(currentUser.uid))) {
      setSelfRatingNotice(true)
      return
    }

    try {
      setSubmittingRating(true)
      setSelectedRating(value)
      setRatingBurst(true)

      const oldRating = ratingItems.find(
        (item) => String(item.userId || item.id || '') === String(currentUser.uid),
      )
      const wasExistingRating = Boolean(oldRating)

      const response = await eLearningApi.rate(realCourseId, Number(value))

      setCourse((previous) =>
        previous
          ? {
              ...previous,
              rating: Number(response?.average || previous.rating || 0),
              ratingTotal: Number(response?.ratingTotal || previous.ratingTotal || 0),
              ratingCount: Number(response?.ratingCount || previous.ratingCount || 0),
            }
          : previous,
      )

      const reviewerName =
        userProfile?.fullName ||
        userProfile?.name ||
        userProfile?.displayName ||
        currentUser.displayName ||
        currentUser.email ||
        'Một người dùng'

      await createCourseOwnerNotification(`course_rating_${realCourseId}_${currentUser.uid}`, {
        type: 'course_rating',
        title: wasExistingRating ? 'Đánh giá bài học đã được cập nhật' : 'Bài học có đánh giá mới',
        message: `${reviewerName} ${wasExistingRating ? 'đã cập nhật đánh giá thành' : 'đã đánh giá'} ${Number(value)} sao cho “${stripHtml(course.title) || 'bài học của bạn'}”.`,
      })

      const ratingsResponse = await eLearningApi.ratings(realCourseId)
      setRatingItems(Array.isArray(ratingsResponse?.ratings) ? ratingsResponse.ratings : [])

      window.setTimeout(() => setRatingBurst(false), 650)
    } catch (error) {
      console.error('Lỗi khi đánh giá:', error)
      alert(error?.message || 'Không thể gửi đánh giá. Vui lòng thử lại.')
    } finally {
      setSubmittingRating(false)
    }
  }


  const changeDetailTab = (
    tabId,
    { replace = false } = {},
  ) => {
    const safeTab =
      validDetailTabIds.has(String(tabId))
        ? String(tabId)
        : 'overview'

    setActiveDetailTab(safeTab)

    if (typeof window === 'undefined') {
      return
    }

    const url = new URL(window.location.href)

    if (safeTab === 'overview') {
      url.searchParams.delete('tab')
    } else {
      url.searchParams.set('tab', safeTab)
    }

    /*
     * questionId/replyId chỉ có ý nghĩa trong Q&A.
     * Khi người dùng chủ động rời Q&A thì xóa chúng.
     *
     * Các query khác như playlist, playlistIndex,
     * autoplay... được giữ nguyên.
     */
    if (safeTab !== 'qa') {
      url.searchParams.delete('questionId')
      url.searchParams.delete('replyId')
    }

    const nextUrl =
      `${url.pathname}${url.search}${url.hash}`

    if (replace) {
      window.history.replaceState(
        {},
        '',
        nextUrl,
      )
    } else {
      window.history.pushState(
        {},
        '',
        nextUrl,
      )
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const syncDetailTabFromUrl = () => {
      const url =
        new URL(window.location.href)

      const requestedTab =
        url.searchParams.get('tab')

      const safeTab =
        requestedTab &&
        validDetailTabIds.has(requestedTab)
          ? requestedTab
          : 'overview'

      setActiveDetailTab(safeTab)

      /*
       * URL tab không hợp lệ:
       * fallback overview và canonicalize URL.
       */
      if (
        requestedTab &&
        requestedTab !== safeTab
      ) {
        url.searchParams.delete('tab')
        url.searchParams.delete('questionId')
        url.searchParams.delete('replyId')

        window.history.replaceState(
          {},
          '',
          `${url.pathname}${url.search}${url.hash}`,
        )
      }
    }

    window.addEventListener(
      'popstate',
      syncDetailTabFromUrl,
    )

    return () => {
      window.removeEventListener(
        'popstate',
        syncDetailTabFromUrl,
      )
    }
  }, [validDetailTabIds])

  if (loading) {
    return (
      <main className={`${isDarkMode ? 'dark ' : ''}min-h-screen bg-white px-3 py-5 text-slate-950 dark:bg-[#0f0f0f] dark:text-white sm:px-5 lg:px-7`}>
        <div className="mx-auto max-w-[1720px] animate-pulse">
          <div className="aspect-video w-full max-w-[1180px] rounded-2xl bg-slate-200 dark:bg-white/10" />
          <div className="mt-5 h-8 w-3/4 rounded-lg bg-slate-200 dark:bg-white/10" />
          <div className="mt-4 flex gap-3"><div className="h-11 w-11 rounded-full bg-slate-200 dark:bg-white/10" /><div className="h-11 w-48 rounded-xl bg-slate-200 dark:bg-white/10" /></div>
          <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]"><div className="h-72 rounded-2xl bg-slate-200 dark:bg-white/10" /><div className="h-[520px] rounded-2xl bg-slate-200 dark:bg-white/10" /></div>
        </div>
      </main>
    )
  }
  if (!course) {
    return <CourseGateState icon="🔎" title="Không tìm thấy bài học" description="Bài học này có thể đã bị xóa hoặc đường dẫn không đúng." onBack={() => navigate('/e-learning')} isDarkMode={isDarkMode} />
  }

  const normalizedCurrentRole = String(currentRole || '').trim().replace(/[\s_-]/g, '').toUpperCase()
  const isAdminDev = normalizedCurrentRole === 'ADMINDEV' || normalizedCurrentRole === 'ADMIN'
  const isCourseOwner = [course.teacherId, course.createdByUid, course.createdBy, course.ownerId, course.userId, course.uid]
    .filter(Boolean)
    .map(String)
    .includes(String(currentUser?.uid || ''))
  const moderationStatus = String(course.status || course.moderationStatus || 'approved').toLowerCase()
  const deletedCourse = moderationStatus === 'deleted'
  const isTeacherOrAdmin = isTeacherRole(currentRole)
  const canBypassAccessGate = isTeacherOrAdmin || isCourseOwner
  const canBypassClassGate = isAdminDev || isCourseOwner
  const locked = !canBypassAccessGate && isCourseLocked(course)
  const visibility = String(course.visibility || 'public').toLowerCase()
  const normalizedMembershipNames = new Set(userClassMemberships.map((item) => String(item.name || item.className || item.title || '').trim().toLowerCase()).filter(Boolean))
  const membershipIds = new Set(userClassMemberships.map((item) => String(item.id || '')).filter(Boolean))
  const membershipGrades = new Set()
  const addMembershipGrade = (value) => {
    const match = String(value || '').match(/(?:^|\D)(10|11|12)(?:\D|$)/)
    if (match) membershipGrades.add(match[1])
  }
  userClassMemberships.forEach((item) => { addMembershipGrade(item.grade); addMembershipGrade(item.name); addMembershipGrade(item.className) })
  addMembershipGrade(getUserClassName(userProfile))
  const targetClassName = String(course.className || '').trim().toLowerCase()
  const targetClassId = String(course.classId || '')
  const allowedByClass = visibility !== 'class' || Boolean((targetClassId && membershipIds.has(targetClassId)) || (targetClassName && normalizedMembershipNames.has(targetClassName)))
  const allowedByGrade = visibility !== 'private' || Boolean(targetClassName && membershipGrades.has(targetClassName))
  const canStudentOpenPendingClassPost = visibility === 'class' && allowedByClass && moderationStatus === 'pending'
  const deniedByModeration = moderationStatus !== 'approved' && !canStudentOpenPendingClassPost && !isTeacherOrAdmin && !isCourseOwner
  const deniedByPrivateClass = !userClassMembershipsLoading && (
    (!allowedByClass && !canBypassClassGate) ||
    (!allowedByGrade && !canBypassAccessGate)
  )

  if (deletedCourse) {
    return <CourseGateState icon="🗑️" title="Bài học đã bị xóa" description="Nội dung này không còn được hiển thị trong thư viện." onBack={() => navigate('/e-learning')} isDarkMode={isDarkMode} tone="danger" />
  }

  if (!canBypassAccessGate && userClassMembershipsLoading && ['class', 'private'].includes(visibility)) {
    return <CourseGateState icon="⌛" title="Đang kiểm tra quyền truy cập" description="ZUNY đang đồng bộ lớp học của bạn từ máy chủ." onBack={() => navigate('/e-learning')} isDarkMode={isDarkMode} />
  }

  if (deniedByModeration) {
    return <CourseGateState icon="🕒" title="Bài học đang chờ duyệt" description="Nội dung này chưa được quản trị viên phê duyệt để hiển thị công khai." onBack={() => navigate('/e-learning')} isDarkMode={isDarkMode} tone="warning" />
  }

  if (deniedByPrivateClass) {
    const audienceLabel = visibility === 'private' ? `khối ${course.className || 'được giáo viên chỉ định'}` : `lớp ${course.className || 'được giáo viên chỉ định'}`
    return <CourseGateState icon="🚫" title={visibility === 'private' ? 'Bạn không thuộc khối được xem bài này' : 'Bạn không thuộc lớp được xem bài này'} description={`Bài học này chỉ dành cho ${audienceLabel}.`} onBack={() => navigate('/e-learning')} isDarkMode={isDarkMode} tone="danger" />
  }

  if (locked) {
    return <CourseGateState icon="🔒" title="Bài học chưa mở" description={`Bài học sẽ mở vào ${formatOpenAt(course.openAt)}.`} onBack={() => navigate('/e-learning')} isDarkMode={isDarkMode} tone="warning" />
  }

  const ratingAverage = getRatingAverage(course)
  const lessons = Array.isArray(course.lessons) && course.lessons.length ? course.lessons : []
  const legacyMainVideo = !lessons.length && (course.youtubeUrl || course.lumiUrl || course.mp4FileUrl) ? {
    title: course.title || 'Video chính',
    content: course.content || '',
    attachMode: course.lumiUrl ? 'lumi' : course.mp4FileUrl ? 'mp4' : 'youtube',
    youtubeUrl: course.youtubeUrl || '',
    lumiUrl: course.lumiUrl || '',
    mp4FileUrl: course.mp4FileUrl || '',
    mp4FileName: course.mp4FileName || '',
    duration: course.duration || '---',
    topicId: '',
  } : null
  const lessonTopicMap = new Map((Array.isArray(course.lessonTopics) ? course.lessonTopics : []).map((topic) => [String(topic.id), topic.title || 'Chủ đề']))
  const orderedLessons = (lessons.length ? lessons : legacyMainVideo ? [legacyMainVideo] : []).map((lesson) => ({ ...lesson, topicTitle: lessonTopicMap.get(String(lesson.topicId || '')) || '' }))
  const lessonCount = orderedLessons.length || course.lessonCount || 1
  const learningObjectives = normalizeTextList(course.learningObjectives)
  const prerequisites = normalizeTextList(course.prerequisites)
  const checklist = normalizeChecklist(course.checklist)
  const quiz = normalizeQuiz(course.quiz)
  const completedChecklist = learningRecord.completedChecklist || {}
  const visibleProgress = Math.max(0, Math.min(100, Number(learningRecord.progress || 0)))
  const selectedLesson = selectedLessonIndex >= 0 ? orderedLessons[selectedLessonIndex] || null : null
  const mainVideoLesson = selectedLesson
  const detailTabs = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'notes', label: 'Ghi chú' },
    { id: 'quiz', label: `Quiz${quiz.length ? ` (${quiz.length})` : ''}` },
    { id: 'rating', label: 'Đánh giá' },
    { id: 'qa', label: 'Hỏi đáp' },
  ]

  function handleSelectPlaylistCourse(targetCourseId) {
    const targetIndex = playlistCourseIds.findIndex((id) => String(id) === String(targetCourseId))
    if (targetIndex < 0) return
    const params = new URLSearchParams({
      playlist: playlistCourseIds.join(','),
      playlistIndex: String(targetIndex),
      autoplay: playlistAutoplay ? '1' : '0',
    })
    navigate(`/e-learning/${encodeURIComponent(targetCourseId)}?${params.toString()}`)
  }

  function handleSelectLesson(index) {
    setSelectedLessonIndex(index)
    setActiveDetailTab('content')

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)

      url.searchParams.delete('tab')
      url.searchParams.delete('questionId')
      url.searchParams.delete('replyId')

      window.history.replaceState(
        {},
        '',
        `${url.pathname}${url.search}${url.hash}`,
      )
    }

    window.setTimeout(
      () =>
        document
          .getElementById(
            `lesson-block-${index}`,
          )
          ?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          }),
      80,
    )
  }

  async function handleShareCourse() {
    try {
      await navigator.clipboard?.writeText(window.location.href)
      setShareNotice(true)
      window.setTimeout(() => setShareNotice(false), 1800)
    } catch (error) {
      console.warn('Không thể sao chép liên kết:', error)
    }
  }

  const teacherName =
    courseTeacherProfile?.fullName ||
    courseTeacherProfile?.name ||
    courseTeacherProfile?.displayName ||
    course.teacherName ||
    course.teacherEmail ||
    'Đang cập nhật'
  const teacherAvatar = courseTeacherProfile
    ? getUserAvatar(courseTeacherProfile)
    : (course.teacherAvatar || '')
  const normalizedTeacherRole = String(course.createdByRole || courseTeacherProfile?.role || '')
    .trim()
    .replace(/[\s_-]/g, '')
    .toUpperCase()
  const isOfficialTeacher = ['ADMIN', 'ADMINDEV'].includes(normalizedTeacherRole)
  const isVerifiedTeacher = isOfficialTeacher || Boolean(courseTeacherProfile?.elearningVerified)
  const completedLessonCount = Object.values(learningRecord.lessonProgress || {}).filter((value) => Number(value || 0) >= 100).length
  const currentLessonTitle = selectedLesson?.title || course.title
  const previousLessonIndex = selectedLessonIndex > 0 ? selectedLessonIndex - 1 : null
  const nextLessonIndex = selectedLessonIndex < orderedLessons.length - 1 ? selectedLessonIndex + 1 : null

  const ratingDistribution = [5, 4, 3, 2, 1].map((star) => ({ star, count: ratingItems.filter((item) => Number(item.rating) === star).length }))
  const teacherId = course.teacherId || course.createdByUid || course.createdBy || course.ownerId || course.userId || course.uid || ''

  function openUserProfile(userId) {
    const targetUserId = String(userId || '').trim()
    if (!targetUserId) return
    if (targetUserId === String(currentUser?.uid || '')) {
      navigate('/e-learning?section=account')
      return
    }
    navigate(`/e-learning?section=channel&user=${encodeURIComponent(targetUserId)}`)
  }

  function openNextPlaylistCourse() {
    if (!playlistAutoplay || !playlistCourseIds.length) return false
    const nextIndex = playlistIndex + 1
    const nextCourseId = playlistCourseIds[nextIndex]
    if (!nextCourseId) return false
    const params = new URLSearchParams({
      playlist: playlistCourseIds.join(','),
      playlistIndex: String(nextIndex),
      autoplay: '1',
    })
    navigate(`/e-learning/${encodeURIComponent(nextCourseId)}?${params.toString()}`)
    return true
  }

  function handleAutoAdvance() {
    if (!autoPlayEnabled) return
    if (nextLessonIndex !== null) {
      handleSelectLesson(nextLessonIndex)
      return
    }
    if (!openNextPlaylistCourse()) handleManualComplete()
  }

  async function submitDetailReport(event) {
    event?.preventDefault?.()
    if (!currentUser) {
      alert('Bạn cần đăng nhập để gửi báo cáo.')
      return
    }
    if (!reportReason) return

    try {
      setReportSubmitting(true)

      const existingResponse = await eLearningApi.reports()
      const existingReports = Array.isArray(existingResponse?.reports) ? existingResponse.reports : []
      const duplicated = existingReports.some((item) =>
        String(item?.courseId || '') === String(realCourseId) &&
        String(item?.reporterId || item?.userId || '') === String(currentUser.uid),
      )

      if (duplicated) {
        alert('Bạn đã báo cáo bài học này rồi. Quản trị viên đang xem xét nhé!')
        setReportOpen(false)
        return
      }

      const createdReport = await eLearningApi.createReport({
        reportType: 'course',
        courseId: realCourseId,
        reportedUserId: teacherId || '',
        reason: reportReason,
        detail: reportDetail.trim(),
        data: {
          courseTitle: stripHtml(course.title),
          courseOwnerId: teacherId,
          reporterName:
            userProfile?.fullName ||
            userProfile?.name ||
            currentUser.displayName ||
            currentUser.email ||
            'Người dùng ZUNY',
          reporterEmail: currentUser.email || '',
        },
      })

      const reportId = createdReport?.reportId || ''

      await eLearningApi.createNotification({
        userId: currentUser.uid,
        title: 'Đã gửi báo cáo tới quản trị viên',
        message: `Báo cáo về bài học “${stripHtml(course.title) || 'Bài học'}” đã được tiếp nhận và đang chờ xử lý.`,
        type: 'report_submitted',
        data: {
          courseId: realCourseId,
          reportId,
          actorId: currentUser.uid,
        },
      })

      setReportOpen(false)
      setReportDetail('')
      alert('Đã gửi báo cáo tới quản trị viên. Bạn sẽ nhận thông báo khi báo cáo được giải quyết.')
    } catch (error) {
      console.error('Không thể gửi báo cáo:', error)
      alert('Chưa gửi được báo cáo. Vui lòng thử lại.')
    } finally {
      setReportSubmitting(false)
    }
  }



  return (
    <main className={`${isDarkMode ? 'dark ' : ''}min-h-screen bg-[#f6f8fc] ${simulationFocusMode ? 'pb-0' : 'pb-24'} text-slate-950 dark:bg-[#07111f] dark:text-white [&_a]:cursor-pointer [&_button:not(:disabled)]:cursor-pointer [&_label]:cursor-pointer`}>
      {completionOpen && <CompletionModal onClose={() => setCompletionOpen(false)} nextCourse={nextCourse} onNext={(item) => navigate(`/e-learning/${item.id}`)} isDarkMode={isDarkMode} />}
      {skipWarning && <HonestyWarningModal warning={skipWarning} onClose={() => setSkipWarning(null)} isDarkMode={isDarkMode} />}
      {shareNotice && <div className="fixed bottom-24 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-2xl dark:bg-white dark:text-slate-950">Đã sao chép liên kết bài học</div>}
      {selfRatingNotice && <div className="fixed inset-0 z-[1100] grid place-items-center bg-slate-950/60 px-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-[28px] border border-pink-200 bg-white p-6 text-center shadow-2xl dark:border-pink-400/20 dark:bg-[#10203a]"><div className="text-6xl">🙈</div><h2 className="mt-4 text-xl font-black">Úi, không được tự chấm mình đâu nha!</h2><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">Hãy để mọi người đánh giá bài học của bạn thật công bằng nhé ✨</p><button type="button" onClick={() => setSelfRatingNotice(false)} className="mt-5 rounded-full bg-pink-500 px-6 py-3 text-sm font-black text-white hover:bg-pink-600">Mình hiểu rồi</button></div></div>}
      {reportOpen && <div className="fixed inset-0 z-[1050] grid place-items-center bg-slate-950/65 px-4 backdrop-blur-sm"><form onSubmit={submitDetailReport} className="w-full max-w-lg rounded-[26px] border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#10203a]"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-rose-500">Báo cáo nội dung</p><h2 className="mt-1 text-xl font-black">Điều gì chưa phù hợp?</h2></div><button type="button" onClick={() => setReportOpen(false)} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-xl dark:bg-white/10">×</button></div><div className="mt-5 grid gap-2">{['Nội dung không phù hợp','Thông tin sai lệch','Vi phạm bản quyền','Nội dung nguy hiểm','Spam hoặc quảng cáo','Lý do khác'].map((reason)=><button key={reason} type="button" onClick={() => setReportReason(reason)} className={`rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${reportReason===reason?'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300':'border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5'}`}>{reason}</button>)}</div><textarea value={reportDetail} onChange={(event)=>setReportDetail(event.target.value)} rows="4" placeholder="Mô tả thêm để quản trị viên dễ kiểm tra..." className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-rose-500 dark:border-white/10 dark:bg-white/5"/><button disabled={reportSubmitting} className="mt-4 w-full rounded-xl bg-rose-600 px-5 py-3 text-sm font-black text-white hover:bg-rose-700 disabled:opacity-50">{reportSubmitting?'Đang gửi...':'Gửi báo cáo'}</button></form></div>}

      <div className="w-full">
        <div className={`grid min-h-0 grid-cols-1 transition-[grid-template-columns] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${simulationFocusMode ? 'grid-cols-1' : detailSidebarCollapsed ? 'xl:grid-cols-[76px_minmax(0,1fr)]' : 'xl:grid-cols-[3fr_10fr]'}`}>
          <button type="button" aria-label="Đóng left sidebar" onClick={()=>setMobileDetailSidebarOpen(false)} className={`fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[2px] transition-opacity duration-300 xl:hidden ${mobileDetailSidebarOpen?'pointer-events-auto opacity-100':'pointer-events-none opacity-0'}`}/>
          {!simulationFocusMode && <aside className={`fixed inset-y-0 left-0 z-50 flex w-[min(88vw,360px)] min-h-0 flex-col overflow-hidden border-r border-slate-200/80 bg-white/95 shadow-2xl backdrop-blur-sm transition-[transform,width,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-white/10 dark:bg-[#0a1728]/95 ${mobileDetailSidebarOpen?'translate-x-0':'-translate-x-full pointer-events-none'} xl:sticky xl:top-0 xl:z-20 xl:h-dvh xl:w-auto xl:translate-x-0 xl:pointer-events-auto xl:shadow-[12px_0_32px_-24px_rgba(15,23,42,0.75)] xl:dark:shadow-[12px_0_34px_-22px_rgba(0,0,0,0.95)]`}>
            <div className={`flex items-center px-4 pb-3 pt-4 ${detailSidebarCollapsed?'xl:justify-center':'justify-between'}`}>
              <button type="button" onClick={()=>setDetailSidebarCollapsed((value)=>!value)} className="hidden h-10 w-10 place-items-center rounded-xl bg-slate-100 text-lg transition duration-300 hover:scale-105 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 xl:grid" aria-label={detailSidebarCollapsed?'Mở left sidebar':'Ẩn left sidebar'}>☰</button>
              <span className={`text-sm font-black transition-all duration-300 ${detailSidebarCollapsed?'xl:w-0 xl:translate-x-2 xl:opacity-0':'opacity-100'}`}>Học tập</span>
              <button type="button" onClick={()=>setMobileDetailSidebarOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-xl transition hover:rotate-90 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 xl:hidden" aria-label="Đóng left sidebar">×</button>
            </div>
            <div className={`min-h-0 flex-1 overflow-y-auto px-4 pb-6 transition-all duration-300 [scrollbar-color:#64748b_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400/70 [&::-webkit-scrollbar-track]:bg-transparent xl:pb-24 ${detailSidebarCollapsed?'xl:pointer-events-none xl:translate-x-3 xl:opacity-0':'translate-x-0 opacity-100'}`}><div className="mb-3 rounded-2xl border border-slate-200 p-4 dark:border-white/10"><div className="flex items-center gap-3"><button type="button" onClick={()=>openUserProfile(teacherId)} title={String(teacherId)===String(currentUser?.uid||'') ? "Mở tài khoản chính" : `Mở kênh của ${teacherName}`} className="shrink-0 rounded-full transition hover:scale-105">{teacherAvatar?<img src={teacherAvatar} alt={teacherName} className="h-12 w-12 rounded-full object-cover"/>:<span className="grid h-12 w-12 place-items-center rounded-full bg-blue-600 font-black text-white">{teacherName.slice(0,2).toUpperCase()}</span>}</button><div className="min-w-0"><p className="truncate font-black">{teacherName}</p><p className="text-xs text-slate-500">Giáo viên {course.category || 'ZUNY'}</p></div></div><button type="button" onClick={()=>openUserProfile(teacherId)} className="mt-3 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-bold hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">Xem trang cá nhân</button></div><PlaylistPanel lessons={orderedLessons} selectedLessonIndex={selectedLessonIndex} learningRecord={learningRecord} onSelectLesson={handleSelectLesson} playlistCourses={playlistCourses} currentCourseId={realCourseId} currentPlaylistIndex={playlistIndex} onSelectPlaylistCourse={handleSelectPlaylistCourse} collapsed={playlistCollapsed} onToggleCollapsed={()=>setPlaylistCollapsed((value)=>!value)} autoPlayEnabled={autoPlayEnabled} onToggleAutoPlay={()=>setAutoPlayEnabled((value)=>!value)}/></div>
          </aside>}

          <section className={`relative z-0 min-w-0 ${simulationFocusMode ? 'fixed inset-0 z-[1200] overflow-y-auto bg-[#07111f] p-2 sm:p-4' : 'px-3 py-4 sm:px-5 xl:px-6 xl:pb-28'}`}>
            {!simulationFocusMode && <header className="mb-5">
              <div className="relative flex min-h-12 min-w-0 items-start justify-center px-12 sm:px-24">
                <button type="button" onClick={() => setMobileDetailSidebarOpen(true)} className="absolute left-0 top-0 grid h-11 w-11 place-items-center rounded-xl border border-slate-300 bg-slate-200 text-lg font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 xl:hidden" aria-label="Mở left sidebar" aria-expanded={mobileDetailSidebarOpen}>☰</button>
                <h1 className="w-full min-w-0 max-w-4xl max-h-[3.75em] overflow-y-auto whitespace-normal break-words pr-1 text-center text-xl font-black leading-tight [overflow-wrap:anywhere] [word-break:break-word] sm:text-3xl lg:text-[34px]">{stripHtml(course.title)}</h1>
                <button type="button" onClick={() => navigate('/e-learning')} className="absolute right-0 top-0 inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-300 bg-slate-200 px-3 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 sm:px-4" aria-label="Quay lại thư viện">
                  <span aria-hidden="true">←</span>
                  <span className="hidden sm:inline">Quay lại</span>
                </button>
              </div>
            </header>}<div className={`overflow-visible rounded-2xl border border-slate-200 bg-black shadow-xl shadow-slate-950/15 dark:border-white/10 dark:shadow-black/40 ${simulationFocusMode ? 'h-[calc(100dvh-84px)] rounded-xl border-white/10' : ''}`}><MainLearningViewer course={course} mainVideoLesson={mainVideoLesson} selectedLessonIndex={selectedLessonIndex} realCourseId={realCourseId} currentUser={currentUser} currentRole={currentRole} lessonCount={lessonCount} onSkipWarning={(warning)=>setSkipWarning(warning || {})} autoPlay={autoPlayEnabled} onEnded={handleAutoAdvance} focusMode={simulationFocusMode}/></div><div className={`mt-3 flex items-center gap-2 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/85 p-2 shadow-md shadow-slate-900/5 backdrop-blur-sm [scrollbar-width:none] dark:border-white/10 dark:bg-[#0c1a2f]/90 dark:shadow-black/25 [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:justify-end sm:p-2.5 ${simulationFocusMode ? 'fixed right-3 top-3 z-[1210] mt-0 border-white/15 bg-black/75 shadow-2xl backdrop-blur-xl dark:bg-black/75' : ''}`}>{!simulationFocusMode && <button type="button" disabled={Boolean(savingDestination)} onClick={handleToggleBookmark} className={`group relative h-10 cursor-pointer overflow-hidden rounded-full border px-4 text-xs font-black transition-all duration-300 active:scale-95 disabled:cursor-wait disabled:opacity-70 ${learningRecord.bookmarked?'border-emerald-500 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/25':'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white'}`}><span className="mr-2">{savingDestination==='remove'?'◌':learningRecord.bookmarked?'★':'☆'}</span>{savingDestination==='remove'?'Đang hủy lưu...':learningRecord.bookmarked?'Đang lưu':'Lưu bài học'}</button>}{isSimulationCourse && <button type="button" onClick={()=>setSimulationFocusMode((value)=>!value)} className={`h-10 rounded-full border px-4 text-xs font-black shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${simulationFocusMode?'border-violet-400 bg-violet-600 text-white':'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-400/25 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20'}`}><span className="mr-2">{simulationFocusMode?'↙':'⛶'}</span>{simulationFocusMode?'Thoát tập trung':'Chế độ tập trung'}</button>}{!simulationFocusMode && <button type="button" onClick={handleShareCourse} className="h-10 rounded-full border border-slate-300 bg-white px-4 text-xs font-black shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-md dark:border-slate-600 dark:bg-slate-800">↗ Chia sẻ</button>}{!simulationFocusMode && <button type="button" onClick={()=>setReportOpen(true)} className="h-10 rounded-full border border-rose-200 bg-white px-4 text-xs font-black text-rose-600 hover:bg-rose-50 dark:border-rose-400/20 dark:bg-white/5 dark:hover:bg-rose-500/10">⚑ Báo cáo</button>}</div>

            {!simulationFocusMode && <div className="mt-4 space-y-4">
              <div className="sticky top-0 z-30 overflow-x-auto rounded-2xl border border-slate-200 bg-white/95 px-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#0c1a2f]/95 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><div className="flex min-w-max gap-1">{detailTabs.map((tab)=><button key={tab.id} type="button" onClick={()=>changeDetailTab(tab.id)} className={`shrink-0 rounded-xl px-4 py-4 text-sm font-bold transition ${activeDetailTab===tab.id?'bg-blue-600 text-white shadow':'text-slate-600 hover:text-blue-700 dark:text-slate-300 dark:hover:text-sky-300'}`}>{tab.label}</button>)}</div></div>

              {activeDetailTab==='overview' && <section id="detail-overview" className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0c1a2f] sm:p-6"><h2 className="text-xl font-black">Tổng quát</h2><div className="mt-5 space-y-5"><section className="min-w-0"><h3 className="text-lg font-black">Mô tả bài học</h3><div className={`mt-3 w-full min-w-0 max-w-[900px] whitespace-normal break-words text-sm leading-7 text-slate-600 [overflow-wrap:anywhere] [&_*]:max-w-full [&_*]:whitespace-normal [&_*]:break-words dark:text-slate-300 ${descriptionExpanded?'':'line-clamp-3'}`} dangerouslySetInnerHTML={{__html:course.description||course.content||'Giáo viên chưa thêm mô tả bài học.'}}/><button type="button" onClick={()=>setDescriptionExpanded((value)=>!value)} className="mt-2 cursor-pointer text-sm font-bold text-blue-600">{descriptionExpanded?'Thu gọn':'Xem thêm'}</button></section><section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><div className="grid min-w-0 gap-4 md:grid-cols-2"><OverviewList title="Bạn sẽ học được" items={learningObjectives} empty="Giáo viên chưa thêm mục tiêu học tập."/><OverviewList title="Kiến thức cần có" items={prerequisites} empty="Bài học này chưa yêu cầu kiến thức nền cụ thể."/></div><div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 p-4 text-sm dark:border-white/10"><div><p className="text-xs text-slate-500">Cấp lớp</p><b>{course.className||'Tất cả'}</b></div><div><p className="text-xs text-slate-500">Môn học</p><b>{course.category||'---'}</b></div><div className="min-w-0"><p className="text-xs text-slate-500">Chủ đề</p><b className="block w-full min-w-0 max-w-[220px] whitespace-normal break-words [overflow-wrap:anywhere]">{stripHtml(course.topic)||'---'}</b></div><div><p className="text-xs text-slate-500">{isSimulationCourse?'Ngôn ngữ':'Thời lượng'}</p><b>{isSimulationCourse?simulationLanguageLabel:(course.duration||course.estimatedMinutes||'---')}</b></div><div><p className="text-xs text-slate-500">Lượt xem</p><b>{Number(course.views||0).toLocaleString('vi-VN')}</b></div><div><p className="text-xs text-slate-500">Mã thẻ bài học</p><b className="break-all">{course.courseCode||realCourseId||'---'}</b></div><div><p className="text-xs text-slate-500">Cập nhật</p><b>{course.updatedAt?'Gần đây':'---'}</b></div></div></section><section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10"><h3 className="font-black">Đánh giá từ học viên</h3><div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center"><div><div className="text-4xl font-black">{ratingAverage}</div><div className="text-amber-400">★★★★★</div><p className="mt-1 text-xs text-slate-500">({course.ratingCount||0} đánh giá)</p></div><div className="flex-1 space-y-2">{ratingDistribution.map(({star,count})=><div key={star} className="flex items-center gap-2 text-xs"><span>{star}★</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full rounded-full bg-amber-400" style={{width:`${ratingItems.length?Math.round(count/ratingItems.length*100):0}%`}}/></div><span className="w-8 text-right">{count}</span></div>)}</div></div></section></div></section>}
              {activeDetailTab==='notes' && <section id="detail-notes" className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0c1a2f] sm:p-6"><NotesPanel noteDraft={noteDraft} setNoteDraft={setNoteDraft} noteColor={noteColor} setNoteColor={setNoteColor} savingNote={savingNote} onSave={handleSaveNotes}/></section>}
              {activeDetailTab==='quiz' && <section id="detail-quiz" className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0c1a2f] sm:p-6">{quiz.length?<MiniQuizPanel quiz={quiz} answers={quizAnswers} submitted={quizSubmitted} savedResult={learningRecord.quizResult} onAnswer={handleQuizAnswer} onSubmit={()=>handleSubmitQuiz(quiz)}/>:<EmptyLearningState text="Bài học này chưa có quiz."/>}</section>}
              {activeDetailTab==='rating' && <section id="detail-rating" className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0c1a2f] sm:p-6"><RatingStars selectedRating={selectedRating} ratingAverage={ratingAverage} ratingCount={course.ratingCount||0} ratingBurst={ratingBurst} onRate={handleRating}/></section>}
              {activeDetailTab==='qa' && <section id="detail-qa" className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0c1a2f] sm:p-6"><QAPanel courseId={realCourseId} currentUser={currentUser} userProfile={userProfile} currentRole={currentRole} courseOwnerId={teacherId} focusQuestionId={focusedQuestionId} focusReplyId={focusedReplyId} onOpenUser={openUserProfile}/></section>}
            </div>}
          </section>
        </div>
      </div>

      {savePickerOpen && <div className="fixed inset-0 z-[160] grid place-items-center bg-slate-950/65 p-4 backdrop-blur-sm"><button type="button" aria-label="Đóng hộp lưu bài học" onClick={()=>setSavePickerOpen(false)} className="absolute inset-0 cursor-pointer"/><section className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0c1a2f]"><div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-5 dark:border-white/10 dark:from-blue-500/10 dark:via-transparent dark:to-emerald-500/10"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">Lưu bài học</p><h2 className="mt-1 text-xl font-black">Chọn nơi bạn muốn lưu</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Danh sách được đồng bộ trực tiếp với Tài khoản chính.</p></div><button type="button" onClick={()=>setSavePickerOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-lg shadow-sm transition hover:rotate-90 dark:bg-white/10">×</button></div></div><div className="max-h-[60vh] overflow-y-auto p-4 sm:p-5"><button type="button" disabled={Boolean(savingDestination)} onClick={()=>saveCourseToDestination(null)} className="group flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-lg disabled:cursor-wait disabled:opacity-60 dark:border-blue-400/20 dark:bg-blue-500/10"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-600 text-2xl text-white shadow-lg shadow-blue-500/25">★</span><span className="min-w-0 flex-1"><span className="block font-black text-blue-800 dark:text-blue-200">Lưu riêng</span><span className="mt-1 block text-xs leading-5 text-blue-600/80 dark:text-blue-300/80">Chỉ xuất hiện trong mục bài đã lưu của bạn.</span></span><span className="text-xl text-blue-600">{savingDestination==='private'?'…':'›'}</span></button><div className="my-4 flex items-center gap-3"><span className="h-px flex-1 bg-slate-200 dark:bg-white/10"/><span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Danh sách lưu đã tạo</span><span className="h-px flex-1 bg-slate-200 dark:bg-white/10"/></div>{savedLists.length?<div className="grid gap-2">{savedLists.map((list)=>{const alreadySaved=Array.isArray(list.courseIds)&&list.courseIds.map(String).includes(String(realCourseId)); return <button key={list.id} type="button" disabled={Boolean(savingDestination)} onClick={()=>saveCourseToDestination(list)} className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-wait disabled:opacity-60 ${alreadySaved?'border-emerald-300 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-500/10':'border-slate-200 bg-slate-50 hover:border-blue-300 dark:border-white/10 dark:bg-white/[0.04]'}`}><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg ${alreadySaved?'bg-emerald-500 text-white':'bg-slate-200 dark:bg-white/10'}`}>{alreadySaved?'✓':'▣'}</span><span className="min-w-0 flex-1"><span className="block truncate font-black">{list.title||'Danh sách chưa đặt tên'}</span><span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{alreadySaved?'Bài học đã có trong danh sách':list.description||`${(list.courseIds||[]).length} bài học`}</span></span><span className="text-lg text-slate-400">{savingDestination===list.id?'…':'›'}</span></button>})}</div>:<div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center dark:border-white/15"><div className="text-3xl">📚</div><p className="mt-2 font-black">Chưa có danh sách lưu</p><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Bạn có thể tạo danh sách mới trong Tài khoản chính, sau đó danh sách sẽ tự xuất hiện tại đây.</p></div>}</div></section></div>}

      {saveNotice && <div className={`fixed left-1/2 top-5 z-[180] -translate-x-1/2 animate-[fadeIn_.25s_ease-out] rounded-2xl border bg-white px-5 py-3 shadow-2xl dark:bg-[#0c1a2f] ${saveNotice.removed?'border-rose-300 dark:border-rose-400/30':'border-emerald-300 dark:border-emerald-400/30'}`}><div className="flex items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-full text-lg text-white shadow-lg ${saveNotice.removed?'bg-rose-500 shadow-rose-500/30':'bg-emerald-500 shadow-emerald-500/30'}`}>{saveNotice.removed?'☆':'✓'}</span><div><p className={`font-black ${saveNotice.removed?'text-rose-700 dark:text-rose-300':'text-emerald-700 dark:text-emerald-300'}`}>{saveNotice.removed?'Đã hủy lưu bài học':'Đã lưu bài học'}</p><p className="text-xs text-slate-500 dark:text-slate-400">{saveNotice.removed?'Bài học đã được gỡ khỏi mục Đã lưu và các danh sách lưu.':`Đã thêm vào ${saveNotice.destination}.`}</p></div></div></div>}

      {!simulationFocusMode && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 py-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-[#081528]/95 sm:px-3 sm:py-3"><div className="grid grid-cols-3 items-center gap-2 sm:flex sm:justify-between sm:gap-3"><button type="button" disabled={previousLessonIndex===null} onClick={()=>previousLessonIndex!==null&&handleSelectLesson(previousLessonIndex)} className="min-w-0 rounded-xl border border-slate-200 px-2 py-2.5 text-xs font-bold disabled:opacity-40 dark:border-white/10 sm:px-4 sm:text-sm"><span className="sm:hidden">← Trước</span><span className="hidden sm:inline">← Bài trước</span></button><button type="button" onClick={()=>nextLessonIndex!==null?handleSelectLesson(nextLessonIndex):(openNextPlaylistCourse()||handleManualComplete())} className="min-w-0 rounded-xl bg-blue-600 px-2 py-3 text-xs font-black text-white sm:px-7 sm:text-sm">{nextLessonIndex!==null?'Tiếp tục học ▶':playlistAutoplay&&playlistCourseIds[playlistIndex+1]?'Phát bài tiếp ▶':'Hoàn thành ✓'}</button><button type="button" disabled={nextLessonIndex===null} onClick={()=>nextLessonIndex!==null&&handleSelectLesson(nextLessonIndex)} className="min-w-0 rounded-xl border border-slate-200 px-2 py-2.5 text-xs font-bold disabled:opacity-40 dark:border-white/10 sm:px-4 sm:text-sm"><span className="sm:hidden">Tiếp →</span><span className="hidden sm:inline">Bài tiếp theo →</span></button></div></div>}
    </main>
  )
}

export default CourseDetail
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'

import useSyncedDarkMode from '../../hooks/common/useSyncedDarkMode'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { db } from '../../components/firebase'

import { isAdminDev, isTeacherLike, normalizeRole } from '../../utils/eLearningUiUtils'

import { ELearningCard } from '../../components/e-learning/ELearningCards'
import ELearningCreateModal from '../../components/e-learning/ELearningCreateModal'
import {
  EmptyState,
  GlassPanel,
  StatPill,
} from '../../components/e-learning/ELearningUI'

const DEFAULT_THUMBNAIL =
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop'

const FIRESTORE_COLLECTIONS = ['eLearnings', 'courses']

function ELearning() {
  const navigate = useNavigate()
  const isDarkMode = useSyncedDarkMode()
  const { user, userDetails } = useAuth()

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [teacherClasses, setTeacherClasses] = useState([])
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [eLearnings, setELearnings] = useState([])
  const [loadingELearnings, setLoadingELearnings] = useState(true)
  const [learningError, setLearningError] = useState('')

  const role = getProjectRole(userDetails)
  const canManage = isTeacherLike(role)
  const isSystemAdmin = isAdminDev(role)

  const fetchELearnings = useCallback(async () => {
    try {
      setLoadingELearnings(true)
      setLearningError('')

      const snapshots = await Promise.allSettled(
        FIRESTORE_COLLECTIONS.map(async (collectionName) => {
          const snapshot = await getDocs(collection(db, collectionName))
          return snapshot.docs.map((item) =>
            normalizeELearningDoc(item.id, item.data(), collectionName),
          )
        }),
      )

      const mergedItems = snapshots.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : [],
      )

      const uniqueItems = dedupeELearnings(mergedItems)

      uniqueItems.sort((a, b) => getAnyTime(b.createdAt || b.updatedAt) - getAnyTime(a.createdAt || a.updatedAt))

      setELearnings(uniqueItems)
    } catch (error) {
      console.error('Không thể lấy dữ liệu E-learning từ Firestore:', error)
      setLearningError('Không thể lấy dữ liệu E-learning từ Firebase Firestore.')
      setELearnings([])
    } finally {
      setLoadingELearnings(false)
    }
  }, [])

  useEffect(() => {
    fetchELearnings()
  }, [fetchELearnings])

  useEffect(() => {
    async function fetchTeacherClasses() {
      if (!user || !canManage) {
        setTeacherClasses([])
        return
      }

      try {
        setLoadingClasses(true)

        const snapshot = await getDocs(collection(db, 'classes'))

        const uid = String(user.uid || '')
        const email = String(user.email || '').toLowerCase()
        const teacherName = String(getTeacherName(userDetails, user)).toLowerCase()

        const classes = snapshot.docs
          .map((classDoc) => ({
            id: classDoc.id,
            ...classDoc.data(),
          }))
          .filter((classItem) =>
            isClassOfTeacher(classItem, uid, email, teacherName),
          )
          .map((classItem) => getClassDisplayName(classItem))
          .filter(Boolean)

        setTeacherClasses(Array.from(new Set(classes)))
      } catch (error) {
        console.error('Không thể lấy dữ liệu Classes từ Firestore:', error)
        setTeacherClasses([])
      } finally {
        setLoadingClasses(false)
      }
    }

    fetchTeacherClasses()
  }, [user, userDetails, canManage])

  const visibleELearnings = useMemo(() => {
    return eLearnings.filter((item) =>
      canViewELearning(item, userDetails, user, role),
    )
  }, [eLearnings, userDetails, user, role])

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    if (!keyword) return visibleELearnings

    return visibleELearnings.filter((item) => {
      return [
        item.title,
        item.topic,
        item.subject,
        item.category,
        item.teacherName,
        item.className,
        item.courseCode,
        item.eLearningCode,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    })
  }, [search, visibleELearnings])

  const completedCount = visibleELearnings.filter(
    (item) => Number(item.progress || 0) >= 100,
  ).length

  const learningCount = visibleELearnings.filter((item) => {
    const progress = Number(item.progress || 0)
    return progress > 0 && progress < 100
  }).length

  const totalViews = visibleELearnings.reduce(
    (total, item) => total + Number(item.views || 0),
    0,
  )

  const publishedCount = visibleELearnings.filter(
    (item) => item.status === 'published',
  ).length

  const scheduledCount = visibleELearnings.filter(
    (item) => item.status === 'scheduled',
  ).length

  const privateCount = visibleELearnings.filter(
    (item) => item.visibility === 'private',
  ).length

  const averageProgress =
    visibleELearnings.length > 0
      ? Math.round(
          visibleELearnings.reduce(
            (total, item) => total + Math.max(0, Math.min(100, Number(item.progress || 0))),
            0,
          ) / visibleELearnings.length,
        )
      : 0

  const heroTitle = canManage ? 'E-learning Studio' : 'Trung tâm học tập'
  const heroDescription = canManage
    ? isSystemAdmin
      ? 'Giám sát hệ thống học liệu số, quản trị phân quyền và đảm bảo các bài học được vận hành ổn định trong toàn trường.'
      : 'Thiết kế, quản lý và phân phối bài học số theo từng lớp; theo dõi dữ liệu học tập để hỗ trợ học sinh hiệu quả hơn.'
    : 'Xây dựng kiến thức từng bước thông qua các bài học trực quan, theo dõi tiến độ và phát triển năng lực học tập bền vững.'

  return (
    <main
      className={`${
        isDarkMode ? 'dark ' : ''
      }min-h-screen bg-slate-50 px-4 py-8 text-slate-950 transition-colors dark:bg-[#020617] dark:text-white sm:px-6 lg:px-8`}
    >
      <div className="mx-auto max-w-7xl">
        <GlassPanel className="relative overflow-hidden p-6 md:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl dark:bg-sky-400/10" />
          <div className="pointer-events-none absolute -bottom-24 left-20 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl dark:bg-violet-500/10" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-6xl">
                {heroTitle}
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300">
                {heroDescription}
              </p>
            </div>

            {canManage && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-sky-400 to-violet-500 px-6 py-4 text-sm font-black text-white shadow-xl shadow-sky-500/25 transition hover:-translate-y-0.5"
              >
                <span>＋</span>
                <span>Tạo E-learning</span>
              </button>
            )}
          </div>

          <div className="relative z-10 mt-8 grid gap-4 md:grid-cols-4">
            {canManage ? (
              <>
                <StatPill icon="📚" label={isSystemAdmin ? 'Tổng bài toàn hệ thống' : 'Bài đã tạo'} value={visibleELearnings.length} />
                <StatPill icon="🚀" label="Đã xuất bản" value={publishedCount} />
                <StatPill icon="⏰" label="Đã lên lịch" value={scheduledCount} />
                <StatPill icon="🔒" label="Bài riêng tư" value={privateCount} />
              </>
            ) : (
              <>
                <StatPill icon="📚" label="Khóa học của tôi" value={visibleELearnings.length} />
                <StatPill icon="✅" label="Đã hoàn thành" value={completedCount} />
                <StatPill icon="⏳" label="Đang học" value={learningCount} />
                <StatPill icon="📈" label="Tiến độ TB" value={`${averageProgress}%`} />
              </>
            )}
          </div>
        </GlassPanel>

        <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/50 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-slate-950/20">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={canManage ? "Tìm E-learning, chủ đề, giáo viên, lớp, mã bài..." : "Tìm bài học, chủ đề, giáo viên hoặc mã khóa học..."}
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-slate-950 dark:text-white"
          />
        </div>

        {learningError && (
          <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">
            {learningError}
          </div>
        )}

        <section className="mt-8">
          {loadingELearnings ? (
            <LessonSkeletonGrid />
          ) : filteredItems.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item) => (
                <ELearningCard
                  key={`${item.sourceCollection}-${item.id}`}
                  item={item}
                  canManage={canManage}
                  currentUserDetails={userDetails}
                  onOpen={(selected) => navigate(`/e-learning/${selected.id}`)}
                  onEdit={(selected) => navigate(`/e-learning/${selected.id}`)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title={canManage ? "Chưa có E-learning" : "Chưa có bài học phù hợp"}
              description={
                canManage
                  ? 'Nhấn “Tạo E-learning” để thiết kế và lưu bài học mới.'
                  : 'Hiện chưa có bài E-learning nào được hiển thị cho tài khoản của bạn.'
              }
            />
          )}
        </section>
      </div>

      <ELearningCreateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={fetchELearnings}
        isDarkMode={isDarkMode}
        teacherProfile={userDetails}
        currentUser={user}
        teacherClasses={teacherClasses}
        loadingClasses={loadingClasses}
      />
    </main>
  )
}

function LessonSkeletonGrid() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-[670px] animate-pulse rounded-[1.75rem] bg-slate-200 dark:bg-white/[0.06]"
        />
      ))}
    </div>
  )
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
        duration: lesson.duration || '',
        completed: Boolean(lesson.completed),
      }))
    : []

  const subject =
    data.subject ||
    data.category ||
    data.teacherSubject ||
    data.mainSubject ||
    data.monHoc ||
    'E-learning'

  const rating = getRatingAverage(data)

  return {
    id,
    sourceCollection,
    title: data.title || data.name || 'Bài E-learning chưa đặt tên',
    topic: data.topic || data.chapter || data.subjectTopic || '',
    description: data.description || data.summary || data.content || '',
    subject,
    category: data.category || subject,
    teacherName:
      data.teacherName ||
      data.createdByName ||
      data.ownerName ||
      data.authorName ||
      data.teacherDisplayName ||
      'Giáo viên',
    teacherId:
      data.teacherId ||
      data.createdByUid ||
      data.ownerId ||
      data.userId ||
      data.uid ||
      '',
    teacherEmail: data.teacherEmail || data.createdByEmail || data.ownerEmail || '',
    createdByEmail: data.createdByEmail || data.teacherEmail || data.ownerEmail || '',
    createdByUid: data.createdByUid || data.teacherId || data.ownerId || data.userId || '',
    ownerId: data.ownerId || '',
    userId: data.userId || '',
    uid: data.uid || '',
    createdByName: data.createdByName || data.teacherName || data.ownerName || '',
    ownerName: data.ownerName || '',
    authorName: data.authorName || '',
    teacherDisplayName: data.teacherDisplayName || data.teacherName || '',
    className: data.className || '',
    classNames: Array.isArray(data.classNames) ? data.classNames : [],
    allowedClasses: Array.isArray(data.allowedClasses) ? data.allowedClasses : [],
    visibility: data.visibility || (data.className ? 'private' : 'public'),
    openAt: normalizeDateValue(data.openAt || data.openTime || data.availableAt),
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
    lessons: lessonList.length || Number(data.lessonCount || data.lessons || 1),
    lessonList,
    lessonCount: lessonList.length || Number(data.lessonCount || data.lessons || 1),
    views: Number(data.views || data.viewCount || 0),
    rating,
    ratingCount: Number(data.ratingCount || 0),
    progress: Number(data.progress || data.percent || data.completion || 0),
    duration: data.duration || data.youtubeDuration || 'Đang cập nhật',
    status: data.status || (isFutureOpen(data.openAt || data.openTime) ? 'scheduled' : 'published'),
    courseCode: data.courseCode || data.eLearningCode || data.code || '',
    eLearningCode: data.eLearningCode || data.courseCode || data.code || '',
    createdAt: data.createdAt || data.createdAtMs || data.timestamp || null,
    updatedAt: data.updatedAt || null,
  }
}

function dedupeELearnings(items) {
  const map = new Map()

  items.forEach((item) => {
    const strongKey = item.eLearningCode || item.courseCode || `${item.sourceCollection}:${item.id}`
    const existing = map.get(strongKey)

    if (!existing || getAnyTime(item.updatedAt || item.createdAt) > getAnyTime(existing.updatedAt || existing.createdAt)) {
      map.set(strongKey, item)
    }
  })

  return Array.from(map.values())
}

function getRatingAverage(data) {
  const ratingCount = Number(data.ratingCount || 0)
  const ratingTotal = Number(data.ratingTotal || 0)

  if (ratingCount > 0 && ratingTotal > 0) {
    return (ratingTotal / ratingCount).toFixed(1)
  }

  return Number(data.rating || 0).toFixed(1)
}

function normalizeDateValue(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  if (typeof value.toMillis === 'function') return new Date(value.toMillis()).toISOString()
  if (value.seconds) return new Date(value.seconds * 1000).toISOString()

  const time = new Date(value).getTime()
  return Number.isFinite(time) ? new Date(time).toISOString() : ''
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

function getProjectRole(userDetails) {
  const normalized = normalizeRole(
    userDetails?.role ||
      userDetails?.Role ||
      userDetails?.accountType ||
      userDetails?.userRole ||
      userDetails?.type ||
      'STUDENT',
  )

  if (normalized === 'ADMINDEV' || normalized === 'ADMIN') return 'Admin_Dev'
  if (normalized === 'TEACHER' || normalized === 'GIAOVIEN' || normalized === 'GIÁOVIÊN') return 'TEACHER'
  return 'STUDENT'
}

function canViewELearning(item, userDetails, user, role) {
  if (role === 'Admin_Dev') return true

  if (role === 'TEACHER') {
    return isELearningOwner(item, userDetails, user)
  }

  if (item.visibility !== 'private') return true

  const studentClass = normalizeClassName(getUserClassName(userDetails))
  if (!studentClass) return false

  const allowedClasses = [
    item.className,
    ...(Array.isArray(item.classNames) ? item.classNames : []),
    ...(Array.isArray(item.allowedClasses) ? item.allowedClasses : []),
  ].filter(Boolean)

  return allowedClasses.some((classItem) => normalizeClassName(classItem) === studentClass)
}

function isELearningOwner(item, userDetails, user) {
  const uid = String(user?.uid || '').toLowerCase()
  const email = String(user?.email || userDetails?.email || '').toLowerCase()
  const teacherName = String(getTeacherName(userDetails, user)).toLowerCase()

  const itemTeacherIds = [
    item.teacherId,
    item.createdByUid,
    item.ownerId,
    item.userId,
    item.uid,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())

  const itemTeacherEmails = [item.teacherEmail, item.createdByEmail, item.ownerEmail]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())

  const itemTeacherNames = [
    item.teacherName,
    item.createdByName,
    item.ownerName,
    item.authorName,
    item.teacherDisplayName,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())

  return (
    itemTeacherIds.includes(uid) ||
    itemTeacherEmails.includes(email) ||
    itemTeacherNames.includes(teacherName)
  )
}

function getUserClassName(userDetails) {
  const rawClass =
    userDetails?.className ||
    userDetails?.class ||
    userDetails?.studentClass ||
    userDetails?.lopHoc ||
    userDetails?.lop ||
    userDetails?.classId ||
    ''

  if (Array.isArray(rawClass)) return String(rawClass[0] || '').trim()
  return String(rawClass || '').trim()
}

function normalizeClassName(value) {
  return String(value || '').trim().toLowerCase()
}

function getTeacherName(userDetails, user) {
  return (
    userDetails?.fullName ||
    userDetails?.name ||
    userDetails?.displayName ||
    userDetails?.teacherName ||
    user?.displayName ||
    user?.email ||
    ''
  )
}

function getClassDisplayName(classItem) {
  return String(
    classItem.className ||
      classItem.name ||
      classItem.title ||
      classItem.maLop ||
      classItem.code ||
      classItem.id ||
      '',
  ).trim()
}

function isClassOfTeacher(classItem, uid, email, teacherName) {
  const normalizedUid = String(uid || '').toLowerCase()
  const normalizedEmail = String(email || '').toLowerCase()
  const normalizedTeacherName = String(teacherName || '').toLowerCase()

  const teacherIds = [
    classItem.teacherId,
    classItem.teacherUid,
    classItem.ownerId,
    classItem.createdByUid,
    classItem.createdBy,
    classItem.userId,
    classItem.uid,
    classItem.authorId,
    classItem.creatorId,
    classItem.homeroomTeacherId,
    classItem.giaoVienId,
  ]
    .filter(Boolean)
    .map((item) => String(item).toLowerCase())

  const teacherEmails = [
    classItem.teacherEmail,
    classItem.giaoVienEmail,
    classItem.email,
    classItem.createdByEmail,
    classItem.ownerEmail,
  ]
    .filter(Boolean)
    .map((item) => String(item).toLowerCase())

  const teacherNames = [
    classItem.teacherName,
    classItem.giaoVien,
    classItem.homeroomTeacher,
    classItem.fullName,
    classItem.nameTeacher,
    classItem.ownerName,
  ]
    .filter(Boolean)
    .map((item) => String(item).toLowerCase())

  const teacherList = [
    ...(Array.isArray(classItem.teachers) ? classItem.teachers : []),
    ...(Array.isArray(classItem.teacherList) ? classItem.teacherList : []),
    ...(Array.isArray(classItem.teacherUids) ? classItem.teacherUids : []),
  ]

  const matchTeacherList = teacherList.some((item) => {
    if (!item) return false

    if (typeof item === 'string') {
      const text = item.toLowerCase()
      return (
        text === normalizedUid ||
        text === normalizedEmail ||
        text === normalizedTeacherName
      )
    }

    const itemUid = String(
      item.uid || item.id || item.teacherId || item.teacherUid || '',
    ).toLowerCase()

    const itemEmail = String(
      item.email || item.teacherEmail || item.giaoVienEmail || '',
    ).toLowerCase()

    const itemName = String(
      item.name || item.fullName || item.teacherName || item.giaoVien || '',
    ).toLowerCase()

    return (
      itemUid === normalizedUid ||
      itemEmail === normalizedEmail ||
      itemName === normalizedTeacherName
    )
  })

  return (
    teacherIds.includes(normalizedUid) ||
    teacherEmails.includes(normalizedEmail) ||
    teacherNames.includes(normalizedTeacherName) ||
    matchTeacherList
  )
}

export default ELearning

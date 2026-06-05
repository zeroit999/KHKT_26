import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'

import useSyncedDarkMode from '../../hooks/common/useSyncedDarkMode'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { db } from '../../components/firebase'

import { mockELearnings, USER_ROLES } from '../../data/eLearningMockData'
import { isTeacherLike } from '../../utils/eLearningUiUtils'

import { ELearningCard } from '../../components/e-learning/ELearningCards'
import ELearningCreateModal from '../../components/e-learning/ELearningCreateModal'
import {
  EmptyState,
  GlassPanel,
  StatPill,
} from '../../components/e-learning/ELearningUI'

function ELearning() {
  const navigate = useNavigate()
  const isDarkMode = useSyncedDarkMode()
  const { user, userDetails } = useAuth()

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [teacherClasses, setTeacherClasses] = useState([])
  const [loadingClasses, setLoadingClasses] = useState(false)

  const role =
    userDetails?.role ||
    userDetails?.Role ||
    userDetails?.accountType ||
    userDetails?.userRole ||
    userDetails?.type ||
    USER_ROLES.STUDENT

  const canManage = isTeacherLike(role)

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

  const eLearnings = mockELearnings

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    if (!keyword) return eLearnings

    return eLearnings.filter((item) => {
      return [
        item.title,
        item.topic,
        item.subject,
        item.teacherName,
        item.className,
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    })
  }, [search, eLearnings])

  const completedCount = eLearnings.filter(
    (item) => Number(item.progress || 0) >= 100,
  ).length

  const totalViews = eLearnings.reduce(
    (total, item) => total + Number(item.views || 0),
    0,
  )

  const averageRating =
    eLearnings.length > 0
      ? (
          eLearnings.reduce(
            (total, item) => total + Number(item.rating || 0),
            0,
          ) / eLearnings.length
        ).toFixed(1)
      : '0.0'

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
                E-learning Studio
              </h1>

              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600 dark:text-slate-300">
                Nơi giáo viên tạo nên những bài học trực quan, còn học sinh chủ
                động khám phá, luyện tập và hoàn thành hành trình học tập của
                mình.
              </p>
            </div>

            {canManage ? (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="rounded-2xl bg-gradient-to-r from-sky-400 to-violet-500 px-6 py-3 text-sm font-black text-white shadow-xl shadow-sky-500/20 transition hover:-translate-y-0.5"
              >
                + Tạo E-learning
              </button>
            ) : (
              <button
                type="button"
                className="rounded-2xl bg-gradient-to-r from-amber-300 to-pink-400 px-6 py-3 text-sm font-black text-slate-950 shadow-xl shadow-amber-500/20 transition hover:-translate-y-0.5"
              >
                🏆 Thành tích
              </button>
            )}
          </div>
        </GlassPanel>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <StatPill icon="📚" label="E-learning" value={eLearnings.length} />
          <StatPill icon="✅" label="Hoàn thành" value={completedCount} />
          <StatPill icon="👁️" label="Lượt xem" value={totalViews} />
          <StatPill icon="⭐" label="Đánh giá TB" value={averageRating} />
        </div>

        <div className="mt-8 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/50 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-slate-950/20">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm E-learning, chủ đề, giáo viên, lớp..."
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-slate-950 dark:text-white"
          />
        </div>

        <section className="mt-8">
          {filteredItems.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item) => (
                <ELearningCard
                  key={item.id}
                  item={item}
                  canManage={canManage}
                  currentUserDetails={userDetails}
                  onOpen={(selected) => navigate(`/e-learning/${selected.id}`)}
                  onEdit={() => setModalOpen(true)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Chưa có E-learning"
              description={
                canManage
                  ? 'Nhấn “Tạo E-learning” để thiết kế giao diện bài học mới.'
                  : 'Hiện chưa có bài E-learning nào được hiển thị.'
              }
            />
          )}
        </section>
      </div>

      <ELearningCreateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        isDarkMode={isDarkMode}
        teacherProfile={userDetails}
        teacherClasses={teacherClasses}
        loadingClasses={loadingClasses}
      />
    </main>
  )
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
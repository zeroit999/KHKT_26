import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '../../components/firebase'

function CourseDetail() {
  const { id: courseId } = useParams()
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState(null)
  const [currentRole, setCurrentRole] = useState('STUDENT')
  const [userProfile, setUserProfile] = useState(null)
  const [courseTeacherProfile, setCourseTeacherProfile] = useState(null)
  const [course, setCourse] = useState(null)
  const [realCourseId, setRealCourseId] = useState(courseId)
  const [loading, setLoading] = useState(true)
  const [selectedRating, setSelectedRating] = useState(0)
  const [ratingBurst, setRatingBurst] = useState(false)
  const [submittingRating, setSubmittingRating] = useState(false)
  const [skipWarningOpen, setSkipWarningOpen] = useState(false)
  const isDarkMode = useDarkMode()

  useEffect(() => {
    function handleYoutubeSkipWarning() {
      setSkipWarningOpen(true)
    }

    window.addEventListener('youtube-skip-warning', handleYoutubeSkipWarning)

    return () => {
      window.removeEventListener('youtube-skip-warning', handleYoutubeSkipWarning)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (!user) {
        setCurrentRole('STUDENT')
        setUserProfile(null)
        return
      }
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        if (userSnap.exists()) {
          const userData = userSnap.data()
          setUserProfile(userData)
          setCurrentRole(userData.role || userData.Role || userData.accountType || userData.userRole || userData.type || 'STUDENT')
        } else {
          setUserProfile(null)
          setCurrentRole('STUDENT')
        }
      } catch (error) {
        console.error('Lỗi khi lấy role:', error)
        setCurrentRole('STUDENT')
        setUserProfile(null)
      }
    })
    return () => unsubscribe()
  }, [])

  async function fetchCourseTeacherProfile(courseData) {
    try {
      const teacherId =
        courseData?.teacherId ||
        courseData?.createdByUid ||
        courseData?.createdBy ||
        courseData?.ownerId ||
        courseData?.userId ||
        courseData?.uid ||
        ''

      if (!teacherId) {
        setCourseTeacherProfile(null)
        return
      }

      const teacherSnap = await getDoc(doc(db, 'users', String(teacherId)))
      setCourseTeacherProfile(teacherSnap.exists() ? teacherSnap.data() : null)
    } catch (error) {
      console.warn('Không thể lấy tên giáo viên hiện tại:', error)
      setCourseTeacherProfile(null)
    }
  }

  useEffect(() => {
    async function fetchCourseDetail() {
      try {
        const courseRef = doc(db, 'courses', courseId)
        const courseSnap = await getDoc(courseRef)
        if (courseSnap.exists()) {
          const courseData = { id: courseSnap.id, ...courseSnap.data() }
          setRealCourseId(courseSnap.id)
          setCourse(courseData)
          await fetchCourseTeacherProfile(courseData)
          return
        }
        const titleQuery = query(collection(db, 'courses'), where('title', '==', decodeURIComponent(courseId)))
        const titleSnapshot = await getDocs(titleQuery)
        if (!titleSnapshot.empty) {
          const firstCourse = titleSnapshot.docs[0]
          const courseData = { id: firstCourse.id, ...firstCourse.data() }
          setRealCourseId(firstCourse.id)
          setCourse(courseData)
          await fetchCourseTeacherProfile(courseData)
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
    if (!currentUser || !realCourseId || !course || !canTrackLearningProgress(currentRole)) return
    if (!isTeacherRole(currentRole) && !canAccessCourseByClass(course, getUserClassName(userProfile))) return
    async function saveLearningProgress() {
      try {
        const today = getLocalDateKey()
        const statsRef = doc(db, 'learningStats', currentUser.uid)
        const progressRef = doc(db, 'learningStats', currentUser.uid, 'courses', realCourseId)
        const progressSnap = await getDoc(progressRef)
        const alreadyWatched = progressSnap.exists()
        const hasYoutubeLesson =
          Boolean(course.youtubeUrl) ||
          (Array.isArray(course.lessons) &&
            course.lessons.some((lesson) => (lesson.attachMode || 'youtube') === 'youtube' && lesson.youtubeUrl))

        await setDoc(
          progressRef,
          {
            courseId: realCourseId,
            lastWatchedAt: serverTimestamp(),
            lastViewedAt: serverTimestamp(),
            watchedDate: today,
            ...(hasYoutubeLesson ? {} : { progress: 100, watchedSeconds: 10 }),
          },
          { merge: true },
        )

        const statsSnap = await getDoc(statsRef)
        const statsData = statsSnap.exists() ? statsSnap.data() : {}
        const oldDates = Array.isArray(statsData.watchedDates) ? statsData.watchedDates : []
        const oldCourseIds = Array.isArray(statsData.watchedCourseIds) ? statsData.watchedCourseIds : []
        const nextDates = oldDates.includes(today) ? oldDates : [...oldDates, today]
        const nextCourseIds = oldCourseIds.includes(realCourseId) ? oldCourseIds : [...oldCourseIds, realCourseId]

        await setDoc(
          statsRef,
          {
            watchedLessons: nextCourseIds.length,
            watchedCourses: nextCourseIds.length,
            watchedCourseIds: nextCourseIds,
            watchedDates: nextDates,
            firstWatchedAt: statsData.firstWatchedAt || serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        )
        try {
          await updateDoc(doc(db, 'courses', realCourseId), { views: increment(1) })
        } catch (error) {
          console.warn('Không thể cập nhật lượt xem:', error)
        }
      } catch (error) {
        console.error('Lỗi khi lưu tiến độ học:', error)
      }
    }
    saveLearningProgress()
  }, [currentUser, realCourseId, course, currentRole, userProfile])

  async function handleRating(value) {
    if (!currentUser) {
      alert('Bạn cần đăng nhập để đánh giá bài học.')
      return
    }
    if (!isStudentRole(currentRole)) {
      alert('Chỉ học sinh mới được đánh giá bài học.')
      return
    }
    if (!course || submittingRating) return
    try {
      setSubmittingRating(true)
      setSelectedRating(value)
      setRatingBurst(true)
      const ratingRef = doc(db, 'courses', realCourseId, 'ratings', currentUser.uid)
      const ratingSnap = await getDoc(ratingRef)
      if (ratingSnap.exists()) {
        const oldRating = Number(ratingSnap.data().rating || 0)
        const nextTotal = Number(course.ratingTotal || 0) - oldRating + value
        const nextCount = Number(course.ratingCount || 0) || 1
        const nextAverage = nextTotal / nextCount
        await setDoc(ratingRef, { rating: value, updatedAt: serverTimestamp() }, { merge: true })
        await updateDoc(doc(db, 'courses', realCourseId), { ratingTotal: nextTotal, ratingCount: nextCount, rating: nextAverage, updatedAt: serverTimestamp() })
        setCourse({ ...course, ratingTotal: nextTotal, ratingCount: nextCount, rating: nextAverage })
      } else {
        const nextTotal = Number(course.ratingTotal || 0) + value
        const nextCount = Number(course.ratingCount || 0) + 1
        const nextAverage = nextTotal / nextCount
        await setDoc(ratingRef, { userId: currentUser.uid, rating: value, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
        await updateDoc(doc(db, 'courses', realCourseId), { ratingTotal: nextTotal, ratingCount: nextCount, rating: nextAverage, updatedAt: serverTimestamp() })
        setCourse({ ...course, ratingTotal: nextTotal, ratingCount: nextCount, rating: nextAverage })
      }
      setTimeout(() => setRatingBurst(false), 650)
    } catch (error) {
      console.error('Lỗi khi đánh giá:', error)
      alert('Không thể gửi đánh giá. Vui lòng thử lại.')
    } finally {
      setSubmittingRating(false)
    }
  }

  if (loading) {
    return <main className={`${isDarkMode ? 'dark ' : ''}min-h-screen bg-slate-50 px-4 py-8 text-slate-950 dark:bg-[#020617] dark:text-white sm:px-6 lg:px-8`}><div className="mx-auto max-w-6xl"><div className="h-96 animate-pulse rounded-[2rem] bg-slate-200 dark:bg-white/[0.06]" /></div></main>
  }
  if (!course) {
    return <main className={`${isDarkMode ? 'dark ' : ''}min-h-screen bg-slate-50 px-4 py-8 text-slate-950 dark:bg-[#020617] dark:text-white sm:px-6 lg:px-8`}><div className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0f1324]/90 p-10 text-center"><div className="text-5xl">🔎</div><h1 className="mt-4 text-2xl font-bold text-slate-950 dark:text-white">Không tìm thấy bài học</h1><p className="mt-2 text-slate-500 dark:text-slate-400">Bài học này có thể đã bị xóa hoặc đường dẫn không đúng.</p><button type="button" onClick={() => navigate('/courses')} className="mt-6 rounded-2xl bg-sky-400 px-6 py-3 font-bold text-slate-950">Quay lại danh sách</button></div></main>
  }

  const isTeacherOrAdmin = isTeacherRole(currentRole)
  const locked = !isTeacherOrAdmin && isCourseLocked(course)
  const deniedByPrivateClass = !isTeacherOrAdmin && !canAccessCourseByClass(course, getUserClassName(userProfile))

  if (deniedByPrivateClass) {
    return (
      <main className={`${isDarkMode ? 'dark ' : ''}min-h-screen bg-slate-50 px-4 py-8 text-slate-950 dark:bg-[#020617] dark:text-white sm:px-6 lg:px-8`}>
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-red-300/40 bg-white p-10 text-center dark:border-red-300/20 dark:bg-[#0f1324]/90">
          <div className="text-5xl">🚫</div>
          <h1 className="mt-4 text-2xl font-bold text-slate-950 dark:text-white">Bạn không thuộc lớp được xem bài này</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            Bài học này chỉ dành cho lớp {course.className || 'được giáo viên chỉ định'}.
          </p>
          <button type="button" onClick={() => navigate('/courses')} className="mt-6 rounded-2xl bg-sky-400 px-6 py-3 font-bold text-slate-950">Quay lại danh sách</button>
        </div>
      </main>
    )
  }

  if (locked) {
    return (
      <main className={`${isDarkMode ? 'dark ' : ''}min-h-screen bg-slate-50 px-4 py-8 text-slate-950 dark:bg-[#020617] dark:text-white sm:px-6 lg:px-8`}>
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-amber-300/40 bg-white dark:border-amber-300/20 dark:bg-[#0f1324]/90 p-10 text-center">
          <div className="text-5xl">🔒</div>
          <h1 className="mt-4 text-2xl font-bold text-slate-950 dark:text-white">Bài học chưa mở</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">Bài học sẽ mở vào {formatOpenAt(course.openAt)}.</p>
          <button type="button" onClick={() => navigate('/courses')} className="mt-6 rounded-2xl bg-sky-400 px-6 py-3 font-bold text-slate-950">Quay lại danh sách</button>
        </div>
      </main>
    )
  }

  const ratingAverage = getRatingAverage(course)
  const lessonCount = Array.isArray(course.lessons) ? course.lessons.length : course.lessonCount || 1

  return (
    <main className={`${isDarkMode ? 'dark ' : ''}min-h-screen bg-slate-50 px-4 py-8 text-slate-950 dark:bg-[#020617] dark:text-white sm:px-6 lg:px-8`}>
      <div className="mx-auto max-w-6xl">
        {skipWarningOpen && (
          <HonestyWarningModal
            onClose={() => setSkipWarningOpen(false)}
            isDarkMode={isDarkMode}
          />
        )}

        <button type="button" onClick={() => navigate('/courses')} className="mb-6 cursor-pointer rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08] dark:hover:text-white">← Quay lại thư viện</button>
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0f1324]/90 shadow-2xl shadow-slate-200/80 dark:shadow-sky-950/30">
          <div className="relative h-72 overflow-hidden">
            <img src={course.thumbnail || 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=1400&auto=format&fit=crop'} alt={stripHtml(course.title)} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f1324] via-[#0f1324]/50 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <div className="mb-4 flex flex-wrap gap-2"><span className="rounded-full bg-sky-400 px-4 py-2 text-sm font-bold text-slate-950">{course.category || 'Science'}</span>{course.courseCode && <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white backdrop-blur">{course.courseCode}</span>}</div>
              <h1 className="max-w-4xl text-3xl font-black tracking-tight text-white sm:text-5xl" dangerouslySetInnerHTML={{ __html: course.title }} />
            </div>
          </div>
          <div className="p-6 md:p-8">
            <p className="max-w-4xl text-base leading-8 text-slate-600 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: course.description }} />
            {(course.topic || course.courseCode || course.visibility || course.openAt) && <div className="mt-5 grid gap-3 md:grid-cols-2">{course.topic && <InfoPanel label="Chủ đề" value={stripHtml(course.topic)} />}{course.courseCode && <InfoPanel label="Mã bài" value={course.courseCode} />}{course.visibility && <InfoPanel label="Chế độ" value={course.visibility === 'private' ? 'Riêng tư' : 'Công khai'} />}{course.openAt && <InfoPanel label="Thời gian mở" value={formatOpenAt(course.openAt)} />}{course.className && <InfoPanel label="Lớp được xem" value={course.className} />}</div>}
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Giáo viên" value={getCurrentCourseTeacherName(course, courseTeacherProfile)} /><Metric label="Thời lượng" value={course.youtubeUrl ? course.duration || '---' : '---'} /><Metric label="Bài học" value={lessonCount} /><Metric label="Ngày tạo" value={formatFullDateTime(course.createdAt)} /><Metric label="Đánh giá" value={`★ ${ratingAverage}`} /></div>
            <RatingStars selectedRating={selectedRating} ratingAverage={ratingAverage} ratingCount={course.ratingCount || 0} ratingBurst={ratingBurst} onRate={handleRating} />
            {Array.isArray(course.lessons) && course.lessons.length > 0 && (
              <section className="mt-8 rounded-[1.5rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="text-sm font-bold uppercase tracking-[0.3em] text-sky-600 dark:text-sky-300">Danh sách bài nhỏ</div>
                <div className="mt-5 grid gap-4">
                  {course.lessons.map((lesson, index) => (
                    <LessonDetailBlock
                      key={index}
                      lesson={lesson}
                      index={index}
                      courseId={realCourseId}
                      currentUser={currentUser}
                      currentRole={currentRole}
                      totalLessons={lessonCount}
                      onSkipWarning={() => setSkipWarningOpen(true)}
                    />
                  ))}
                </div>
              </section>
            )}
            {getYoutubeVideoId(course.youtubeUrl) && (
              <section className="mt-8 rounded-[1.5rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="text-sm font-bold uppercase tracking-[0.3em] text-red-300">Video bài học</div>
                <h2 className="mt-3 text-2xl font-black text-slate-950 dark:text-white">Xem video e-learning</h2>
                <YoutubeProgressPlayer
                  youtubeUrl={course.youtubeUrl}
                  title={stripHtml(course.title)}
                  courseId={realCourseId}
                  currentUser={currentUser}
                  currentRole={currentRole}
                  lessonIndex={0}
                  totalLessons={lessonCount}
                  onSkipWarning={() => setSkipWarningOpen(true)}
                />
              </section>
            )}
            {course.wordFileUrl && <section className="mt-8 rounded-[1.5rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.04]"><div className="text-sm font-bold uppercase tracking-[0.3em] text-sky-600 dark:text-sky-300">File Word / PDF</div><h2 className="mt-3 text-2xl font-black text-slate-950 dark:text-white">Tài liệu giáo viên đã tải lên</h2>{isPdfFile(course.wordFileName, course.wordFileUrl) && <iframe src={course.wordFileUrl} title={course.wordFileName || 'PDF'} className="mt-5 h-[600px] w-full rounded-2xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-950" />}<a href={course.wordFileUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-3 rounded-2xl bg-sky-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-sky-300"><span>📄</span>Mở file {course.wordFileName || 'tài liệu'}</a></section>}
            <section className="mt-8 rounded-[1.5rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.04]"><div className="text-sm font-bold uppercase tracking-[0.3em] text-sky-600 dark:text-sky-300">Nội dung bài học</div><h2 className="mt-3 text-2xl font-black text-slate-950 dark:text-white">Bắt đầu học</h2><div className="mt-5 whitespace-pre-line rounded-2xl bg-slate-50 p-5 text-base leading-8 text-slate-700 dark:bg-slate-950/50 dark:text-slate-200">{course.content || 'Giáo viên chưa thêm nội dung chi tiết cho bài học này.'}</div></section>
            {course.codeContent && <section className="mt-8 rounded-[1.5rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.04]"><div className="text-sm font-bold uppercase tracking-[0.3em] text-emerald-300">Code</div><h2 className="mt-3 text-2xl font-black text-slate-950 dark:text-white">Nội dung code của bài học</h2><div className="mt-5 grid gap-4 lg:grid-cols-2"><pre className="min-h-72 overflow-auto rounded-2xl border border-emerald-400/20 bg-black p-5 font-mono text-sm leading-7 text-emerald-300">{course.codeContent}</pre><CodeRunner code={course.codeContent} /></div></section>}
            {course.richDocument && <section className="mt-8 rounded-[1.5rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.04]"><div className="text-sm font-bold uppercase tracking-[0.3em] text-emerald-300">Tài liệu</div><h2 className="mt-3 text-2xl font-black text-slate-950 dark:text-white">Tài liệu dạng Word</h2><div className="prose mt-5 max-w-none rounded-2xl bg-slate-50 p-5 text-base leading-8 text-slate-700 dark:prose-invert dark:bg-slate-950/50 dark:text-slate-200 [&_ol]:ml-6 [&_ol]:list-decimal [&_ul]:ml-6 [&_ul]:list-disc" dangerouslySetInnerHTML={{ __html: course.richDocument }} /></section>}
          </div>
        </section>
      </div>
    </main>
  )
}

function LessonDetailBlock({ lesson, index, courseId, currentUser, currentRole, totalLessons, onSkipWarning }) {
  const mode = lesson.attachMode || 'youtube'

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-slate-950/50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-bold text-slate-950 dark:text-white">Bài {index + 1}: {lesson.title}</div>
          {lesson.content && <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{lesson.content}</div>}
        </div>
        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700 dark:bg-sky-400/10 dark:text-sky-200">
          {mode === 'youtube' ? 'YouTube' : mode === 'file' ? 'Word/PDF' : mode === 'code' ? `Code ${lesson.codeLanguage === 'cpp' ? 'C++' : 'JavaScript'}` : 'Tài liệu'}
        </span>
      </div>

      {mode === 'youtube' && getYoutubeVideoId(lesson.youtubeUrl) && (
        <YoutubeProgressPlayer
          youtubeUrl={lesson.youtubeUrl}
          title={lesson.title || `Bài ${index + 1}`}
          courseId={courseId}
          currentUser={currentUser}
          currentRole={currentRole}
          lessonIndex={index}
          totalLessons={totalLessons}
          onSkipWarning={onSkipWarning}
        />
      )}

      {mode === 'youtube' && !getYoutubeVideoId(lesson.youtubeUrl) && lesson.mp4FileUrl && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-black dark:border-white/10">
          <video
            src={lesson.mp4FileUrl}
            title={lesson.title || `MP4 bài ${index + 1}`}
            controls
            className="aspect-video w-full"
          />
        </div>
      )}

      {mode === 'file' && lesson.wordFileUrl && (
        <div className="mt-4">
          {isPdfFile(lesson.wordFileName, lesson.wordFileUrl) && (
            <iframe
              src={lesson.wordFileUrl}
              title={lesson.wordFileName || `File bài ${index + 1}`}
              className="h-[500px] w-full rounded-2xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-950"
            />
          )}
          {lesson.fileExtractedText && (
            <div className="mt-4 whitespace-pre-line rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
              {lesson.fileExtractedText}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={lesson.wordFileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-3 rounded-2xl bg-sky-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-sky-300"
            >
              📄 Mở file {lesson.wordFileName || 'tài liệu'}
            </a>

            <a
              href={lesson.wordFileUrl}
              download={lesson.wordFileName || true}
              className="inline-flex items-center gap-3 rounded-2xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-emerald-300"
            >
              ⬇️ Tải xuống
            </a>
          </div>
        </div>
      )}

      {mode === 'code' && lesson.codeContent && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <pre className="min-h-72 overflow-auto rounded-2xl border border-emerald-400/20 bg-black p-5 font-mono text-sm leading-7 text-emerald-300">
            {lesson.codeContent}
          </pre>
          {lesson.codeLanguage === 'cpp' ? <CppNote /> : <CodeRunner code={lesson.codeContent} />}
        </div>
      )}

      {mode === 'document' && lesson.richDocument && (
        <div
          className="prose mt-4 max-w-none rounded-2xl bg-white p-5 text-base leading-8 text-slate-700 dark:prose-invert dark:bg-slate-950/70 dark:text-slate-200 [&_ol]:ml-6 [&_ol]:list-decimal [&_ul]:ml-6 [&_ul]:list-disc"
          dangerouslySetInnerHTML={{ __html: lesson.richDocument }}
        />
      )}
    </div>
  )
}




function YoutubeProgressPlayer({
  youtubeUrl,
  title,
  courseId,
  currentUser,
  currentRole,
  lessonIndex = 0,
  totalLessons = 1,
  onSkipWarning,
}) {
  const videoId = getYoutubeVideoId(youtubeUrl)
  const playerElementId = `youtube-player-${courseId || 'course'}-${lessonIndex}-${videoId}`
  const [progressText, setProgressText] = useState('Đang tải tiến trình đã lưu...')
  const [progressValue, setProgressValue] = useState(0)
  const maxWatchedRef = useRef(0)
  const lastPlayerTimeRef = useRef(0)
  const warningCooldownRef = useRef(0)
  const hasRestoredRef = useRef(false)

  useEffect(() => {
    if (!videoId) return

    let player = null
    let interval = null
    let cancelled = false

    async function loadSavedProgress() {
      if (!currentUser || !courseId || !canTrackLearningProgress(currentRole)) return 0

      try {
        const progressRef = doc(db, 'learningStats', currentUser.uid, 'courses', courseId)
        const progressSnap = await getDoc(progressRef)

        if (!progressSnap.exists()) return 0

        const data = progressSnap.data()
        const lessonMaxWatchedSeconds = data.lessonMaxWatchedSeconds || {}
        const lessonWatchedSeconds = data.lessonWatchedSeconds || {}
        const savedTime =
          Number(lessonMaxWatchedSeconds[lessonIndex] || 0) ||
          Number(lessonWatchedSeconds[lessonIndex] || 0) ||
          Number(data.watchedSeconds || 0)

        return Math.max(0, savedTime)
      } catch (error) {
        console.warn('Không thể tải tiến trình YouTube đã lưu:', error)
        return 0
      }
    }

    async function saveYoutubeProgress(watchedTime, duration) {
      if (!currentUser || !courseId || !canTrackLearningProgress(currentRole) || !duration) return

      const safeWatchedTime = Math.min(Number(watchedTime || 0), Number(duration || 0))
      const watchedSeconds = Math.floor(safeWatchedTime)
      const durationSeconds = Math.floor(duration)
      const lessonProgress = Math.min(100, Math.round((safeWatchedTime / duration) * 100))
      const safeTotalLessons = Math.max(1, Number(totalLessons || 1))
      const courseProgress =
        safeTotalLessons <= 1
          ? lessonProgress
          : Math.min(100, Math.round(((lessonIndex + lessonProgress / 100) / safeTotalLessons) * 100))

      const today = getLocalDateKey()
      const statsRef = doc(db, 'learningStats', currentUser.uid)
      const progressRef = doc(db, 'learningStats', currentUser.uid, 'courses', courseId)

      await setDoc(
        progressRef,
        {
          courseId,
          progress: courseProgress,
          watchedSeconds,
          durationSeconds,
          lastViewedAt: serverTimestamp(),
          lastWatchedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          watchedDate: today,
          [`lessonProgress.${lessonIndex}`]: lessonProgress,
          [`lessonWatchedSeconds.${lessonIndex}`]: watchedSeconds,
          [`lessonDurationSeconds.${lessonIndex}`]: durationSeconds,
          [`lessonMaxWatchedSeconds.${lessonIndex}`]: watchedSeconds,
        },
        { merge: true },
      )

      const statsSnap = await getDoc(statsRef)
      const statsData = statsSnap.exists() ? statsSnap.data() : {}
      const oldDates = Array.isArray(statsData.watchedDates) ? statsData.watchedDates : []
      const oldCourseIds = Array.isArray(statsData.watchedCourseIds) ? statsData.watchedCourseIds : []
      const nextDates = oldDates.includes(today) ? oldDates : [...oldDates, today]
      const nextCourseIds = oldCourseIds.includes(courseId) ? oldCourseIds : [...oldCourseIds, courseId]

      await setDoc(
        statsRef,
        {
          watchedLessons: nextCourseIds.length,
          watchedCourses: nextCourseIds.length,
          watchedCourseIds: nextCourseIds,
          watchedDates: nextDates,
          firstWatchedAt: statsData.firstWatchedAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    }

    function showSkipWarning() {
      const now = Date.now()
      if (now - warningCooldownRef.current < 2500) return
      warningCooldownRef.current = now

      if (typeof onSkipWarning === 'function') {
        onSkipWarning()
      } else {
        window.dispatchEvent(new CustomEvent('youtube-skip-warning'))
      }
    }

    function updateProgressDisplay(watchedTime, duration) {
      if (!duration) return

      const safeWatchedTime = Math.min(Number(watchedTime || 0), Number(duration || 0))
      const nextProgress = Math.min(100, Math.round((safeWatchedTime / duration) * 100))

      setProgressValue(nextProgress)
      setProgressText(`${formatSeconds(safeWatchedTime)} / ${formatSeconds(duration)} • ${nextProgress}%`)
    }

    function syncProgress() {
      if (!player || typeof player.getCurrentTime !== 'function') return

      const currentTime = Number(player.getCurrentTime() || 0)
      const duration = Number(player.getDuration() || 0)

      if (!duration) return

      const currentMaxWatched = Number(maxWatchedRef.current || 0)
      const allowedForwardLimit = currentMaxWatched + 300

      if (currentTime > allowedForwardLimit) {
        showSkipWarning()

        const rewindTo = Math.max(0, currentMaxWatched)
        player.seekTo(rewindTo, true)
        lastPlayerTimeRef.current = rewindTo
        updateProgressDisplay(currentMaxWatched, duration)
        return
      }

      if (currentTime > currentMaxWatched) {
        maxWatchedRef.current = currentTime
      }

      lastPlayerTimeRef.current = currentTime

      const safeWatchedTime = Math.min(maxWatchedRef.current, duration)
      updateProgressDisplay(safeWatchedTime, duration)

      saveYoutubeProgress(safeWatchedTime, duration).catch((error) => {
        console.warn('Không thể lưu tiến trình YouTube:', error)
      })
    }

    function createPlayer() {
      if (cancelled || !window.YT?.Player || !document.getElementById(playerElementId)) return

      player = new window.YT.Player(playerElementId, {
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: async () => {
            const savedTime = await loadSavedProgress()

            if (cancelled || !player) return

            const duration = Number(player.getDuration?.() || 0)
            const safeSavedTime = duration ? Math.min(savedTime, duration) : savedTime

            maxWatchedRef.current = safeSavedTime
            lastPlayerTimeRef.current = safeSavedTime

            if (safeSavedTime > 0 && !hasRestoredRef.current) {
              hasRestoredRef.current = true
              player.seekTo(safeSavedTime, true)
            }

            updateProgressDisplay(safeSavedTime, duration)

            interval = setInterval(syncProgress, 3000)
          },
          onStateChange: () => {
            syncProgress()
          },
        },
      })
    }

    loadYoutubeIframeApi().then(createPlayer)

    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
      if (player?.destroy) player.destroy()
    }
  }, [videoId, playerElementId, courseId, currentUser, currentRole, lessonIndex, totalLessons, onSkipWarning])

  if (!videoId) return null

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-950">
      <div id={playerElementId} title={title} className="aspect-video w-full" />
      <div className="border-t border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-500 dark:text-slate-400">
          <span>Tiến trình thật</span>
          <span>{progressText}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-400 to-sky-400 transition-all duration-500"
            style={{ width: `${Math.max(0, Math.min(100, progressValue))}%` }}
          />
        </div>
      </div>
    </div>
  )
}


function HonestyWarningModal({ onClose, isDarkMode }) {
  return (
    <div className={`${isDarkMode ? 'dark ' : ''}fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-md`}>
      <div className="w-full max-w-md rounded-[2rem] border border-amber-200 bg-white p-6 text-center shadow-2xl shadow-amber-900/20 dark:border-amber-300/20 dark:bg-[#0f1324]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-400/15 text-4xl">
          ⚠️
        </div>

        <h2 className="mt-5 text-2xl font-black text-slate-950 dark:text-white">
          Không được lướt bài
        </h2>

        <p className="mt-3 text-sm font-bold leading-6 text-slate-600 dark:text-slate-300">
          KHÔNG ĐƯỢC LƯỚT BÀI, XIN VUI LÒNG TRUNG THỰC TRONG HỌC TẬP
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full cursor-pointer rounded-2xl bg-gradient-to-r from-amber-300 to-orange-400 px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/25 transition hover:-translate-y-0.5"
        >
          Tôi đã hiểu
        </button>
      </div>
    </div>
  )
}

function CppNote() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-slate-950">
      <div className="text-xs font-bold uppercase tracking-[0.25em] text-sky-600 dark:text-sky-300">Console</div>
      <pre className="mt-4 w-full max-w-none whitespace-pre-wrap rounded-xl bg-white p-4 font-mono text-sm text-slate-700 dark:bg-black/50 dark:text-slate-300">
        C++ không chạy trực tiếp trong trình duyệt. Cần backend/compiler service riêng để biên dịch và chạy.
      </pre>
    </div>
  )
}

function RatingStars({ selectedRating, ratingAverage, ratingCount,    , onRate }) {
  return (
    <section className="relative mt-8 rounded-[1.5rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="text-sm font-bold uppercase tracking-[0.3em] text-amber-500 dark:text-amber-300">Đánh giá bài học</div>
      <h2 className="mt-3 text-2xl font-black text-slate-950 dark:text-white">Bạn thấy bài học này thế nào?</h2>
      <div className="relative mt-5 flex flex-wrap items-center gap-3">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onRate(star)}
            className={`relative cursor-pointer text-4xl transition duration-200 hover:scale-125 ${
              star <= selectedRating
                ? 'text-amber-300 drop-shadow-[0_0_14px_rgba(252,211,77,0.9)]'
                : 'text-slate-300 hover:text-amber-300 dark:text-slate-600 dark:hover:text-amber-200'
            }`}
          >
            ★
          </button>
        ))}
        <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">Trung bình: ★ {ratingAverage} ({ratingCount} lượt)</span>
        {ratingBurst && (
          <div className="pointer-events-none absolute left-16 top-1/2">
            {Array.from({ length: 14 }).map((_, index) => (
              <span
                key={index}
                className="absolute h-2 w-2 animate-[ratingBurst_650ms_ease-out_forwards] rounded-full bg-amber-300"
                style={{ '--rotate': `${index * 26}deg` }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function CodeRunner({ code }) {
  const [output, setOutput] = useState('Ấn "Chạy code" để xem console.')

  function runCode() {
    const logs = []
    const customConsole = {
      log: (...args) => logs.push(args.map(String).join(' ')),
      error: (...args) => logs.push(`Error: ${args.map(String).join(' ')}`),
      warn: (...args) => logs.push(`Warn: ${args.map(String).join(' ')}`),
    }

    try {
      const runner = new Function('console', code || '')
      const result = runner(customConsole)
      if (result !== undefined) logs.push(String(result))
      setOutput(logs.length ? logs.join('\n') : 'Code đã chạy xong nhưng không có output.')
    } catch (error) {
      setOutput(error.message)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-sky-600 dark:text-sky-300">Console</div>
        <button type="button" onClick={runCode} className="cursor-pointer rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-300">
          Chạy code
        </button>
      </div>
      <pre className="mt-4 min-h-60 whitespace-pre-wrap rounded-xl bg-white p-4 font-mono text-sm text-slate-700 dark:bg-black/50 dark:text-slate-300">{output}</pre>
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.05]">
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 font-bold text-slate-950 dark:text-white">{value}</div>
    </div>
  )
}
function InfoPanel({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.05]">
      <div className="text-xs font-bold uppercase tracking-[0.25em] text-sky-600 dark:text-sky-300">{label}</div>
      <div className="mt-2 font-bold text-slate-950 dark:text-white">{value}</div>
    </div>
  )
}

function getCurrentCourseTeacherName(course, teacherProfile) {
  const currentName = getProfileDisplayName(teacherProfile)
  return currentName || course?.teacherName || course?.teacherEmail || 'Đang cập nhật'
}

function getProfileDisplayName(profile) {
  return (
    profile?.fullName ||
    profile?.name ||
    profile?.displayName ||
    profile?.teacherName ||
    profile?.userName ||
    ''
  )
}

function stripHtml(value) { return String(value || '').replace(/<[^>]*>/g, '') }

function getLocalDateKey(date = new Date()) {
  const safeDate = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(safeDate.getTime())) return ''

  const year = safeDate.getFullYear()
  const month = String(safeDate.getMonth() + 1).padStart(2, '0')
  const day = String(safeDate.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatFullDateTime(value) {
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

function formatOpenAt(value) { if (!value) return '---'; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return date.toLocaleString('vi-VN') }
function isPdfFile(name, url) { return `${name || ''} ${url || ''}`.toLowerCase().includes('.pdf') }
function getRatingAverage(course) { if (course.ratingCount && course.ratingTotal) return (course.ratingTotal / course.ratingCount).toFixed(1); return Number(course.rating || 0).toFixed(1) }
function getYoutubeEmbedUrl(url) {
  const videoId = getYoutubeVideoId(url)
  return videoId ? `https://www.youtube.com/embed/${videoId}` : ''
}

function getYoutubeVideoId(url) {
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

function loadYoutubeIframeApi() {
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

function formatSeconds(value) {
  const total = Math.max(0, Math.floor(Number(value || 0)))
  const minutes = Math.floor(total / 60)
  const seconds = String(total % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}
function getCourseMinutes(duration) { if (!duration) return 0; const text = String(duration).toLowerCase(); const hourMatch = text.match(/(\d+)\s*h/); const minuteMatch = text.match(/(\d+)\s*m/); const hours = hourMatch ? Number(hourMatch[1]) : 0; const minutes = minuteMatch ? Number(minuteMatch[1]) : 0; if (hours || minutes) return hours * 60 + minutes; const numberOnly = Number(text.replace(/\D/g, '')); return Number.isFinite(numberOnly) ? numberOnly : 0 }

/*
Thêm CSS này vào index.css hoặc App.css để hiệu ứng nổ sao hoạt động:
@keyframes ratingBurst {
  0% { opacity: 1; transform: rotate(var(--rotate, 0deg)) translateX(0) scale(1); }
  100% { opacity: 0; transform: rotate(var(--rotate, 0deg)) translateX(70px) scale(0.2); }
}
*/

function isTeacherRole(role) {
  const normalizedRole = String(role || '').trim().replace(/[\s_-]/g, '').toUpperCase()
  return ['TEACHER', 'ADMINDEV', 'ADMIN', 'GIAOVIEN', 'GIÁOVIÊN'].includes(normalizedRole)
}

function canTrackLearningProgress(role) {
  return isStudentRole(role) || isTeacherRole(role)
}

function getOpenAtMs(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value.seconds) return value.seconds * 1000
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function isCourseLocked(course) {
  const openTime = getOpenAtMs(course?.openAtMs || course?.openAt)
  return Boolean(openTime && Date.now() < openTime)
}


function getUserClassName(userData) {
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

function normalizeClassName(value) {
  return String(value || '').trim().toLowerCase()
}

function canAccessCourseByClass(course, studentClass) {
  if (course?.visibility !== 'private') return true

  const allowedClasses = [
    course.className,
    ...(Array.isArray(course.classNames) ? course.classNames : []),
    ...(Array.isArray(course.allowedClasses) ? course.allowedClasses : []),
  ].filter(Boolean)

  if (!allowedClasses.length) return false

  const normalizedStudentClass = normalizeClassName(studentClass)

  return allowedClasses.some((classItem) => normalizeClassName(classItem) === normalizedStudentClass)
}

function isStudentRole(role) {
  return String(role || '').trim().toUpperCase() === 'STUDENT'
}

function useDarkMode() {
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


export default CourseDetail

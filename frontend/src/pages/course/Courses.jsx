import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { auth, db, storage } from '../../components/firebase'

const subjects = [
  'Toán',
  'Vật lý',
  'Hóa học',
  'Sinh học',
  'Tin học',
  'Ngữ văn',
  'Lịch sử',
  'Địa lý',
  'Tiếng Anh',
  'Công nghệ',
  'Quốc phòng - An ninh',
  'Trải nghiệm hướng nghiệp',
  'Giáo dục địa phương',
  'Giáo dục thể chất',
  'Giáo dục Kinh tế và Pháp luật',
]

const subjectCodes = {
  Toán: 'TO',
  'Vật lý': 'VL',
  'Hóa học': 'HH',
  'Sinh học': 'SH',
  'Tin học': 'TH',
  'Ngữ văn': 'NV',
  'Lịch sử': 'LS',
  'Địa lý': 'DL',
  'Tiếng Anh': 'TA',
  'Công nghệ': 'CN',
  'Quốc phòng - An ninh': 'QP',
  'Trải nghiệm hướng nghiệp': 'HN',
  'Giáo dục địa phương': 'DP',
  'Giáo dục thể chất': 'TD',
  'Giáo dục Kinh tế và Pháp luật': 'KT',
}

const sortOptions = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Trễ nhất' },
  { value: 'featured', label: 'Nổi bật' },
]

const typingTexts = [
  'Khơi dậy đam mê học tập',
  'Học tập những điều mới',
  'Cùng nhau khám phá tự nhiên',
  'Khơi nguồn hiểu biết sáng tạo',
  'Bắt đầu thôi, bạn nhé!',
]

function Courses() {
  const lessonsRef = useRef(null)
  const sortBoxRef = useRef(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [role, setRole] = useState('STUDENT')
  const [teacherProfile, setTeacherProfile] = useState(null)
  const [teacherSubject, setTeacherSubject] = useState('')
  const [teacherClasses, setTeacherClasses] = useState([])
  const [courses, setCourses] = useState([])
  const [learningProgress, setLearningProgress] = useState({})
  const [learningError, setLearningError] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  const [sortBy, setSortBy] = useState('newest')
  const [search, setSearch] = useState('')
  const [showSortBox, setShowSortBox] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingCourse, setEditingCourse] = useState(null)
  const [showAchievement, setShowAchievement] = useState(false)
  const [achievement, setAchievement] = useState({ watchedLessons: 0, totalMinutes: 0, watchedDates: [] })
  const [form, setForm] = useState(getEmptyForm())
  const [uploadingWord, setUploadingWord] = useState(false)

  const normalizedRole = String(role || '')
    .trim()
    .replace(/[\s_-]/g, '')
    .toUpperCase()

  const canCreateELearning =
    normalizedRole === 'TEACHER' ||
    normalizedRole === 'ADMINDEV' ||
    normalizedRole === 'ADMIN' ||
    normalizedRole === 'GIAOVIEN' ||
    normalizedRole === 'GIÁOVIÊN'

  useEffect(() => {
    console.log('Courses role debug:', { role, normalizedRole, canCreateELearning, uid: currentUser?.uid })
  }, [role, normalizedRole, canCreateELearning, currentUser])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (!user) {
        setRole('STUDENT')
        setTeacherProfile(null)
        setTeacherSubject('')
        setTeacherClasses([])
        setLearningProgress({})
        await fetchCourses()
        return
      }
      try {
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          const userData = userSnap.data()
          const subjectFromFirebase = userData.subject || userData.teacherSubject || userData.mainSubject || userData.monHoc || ''
          setRole(userData.role || userData.Role || userData.accountType || userData.userRole || userData.type || 'STUDENT')
          setTeacherProfile(userData)
          setTeacherSubject(subjectFromFirebase)
          setTeacherClasses(resolveClassesFromUserData(userData))
          if (subjectFromFirebase) setForm((prev) => ({ ...prev, category: subjectFromFirebase }))
        } else {
          setRole('STUDENT')
        }
        await fetchAchievement(user.uid)
        await fetchLearningProgress(user.uid)
      } catch (error) {
        console.error('Lỗi khi lấy dữ liệu user:', error)
        setRole('STUDENT')
      }
      await fetchCourses()
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    function handleClickOutside(event) {
      if (showSortBox && sortBoxRef.current && !sortBoxRef.current.contains(event.target)) setShowSortBox(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSortBox])

async function fetchCourses() {
  try {
    setLoading(true)

    const snapshot = await getDocs(collection(db, 'courses'))

    const data = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }))

    const sortedData = data.sort((a, b) => getCourseTime(b) - getCourseTime(a))

    setCourses(sortedData)
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu courses:', error)
  } finally {
    setLoading(false)
  }
}


  async function fetchAchievement(uid) {
    try {
      const achievementRef = doc(db, 'learningStats', uid)
      const achievementSnap = await getDoc(achievementRef)

      if (achievementSnap.exists()) {
        const data = achievementSnap.data()

        setAchievement({
          watchedLessons: data.watchedLessons || data.watchedCourses || 0,
          totalMinutes: data.totalMinutes || 0,
          watchedDates: Array.isArray(data.watchedDates) ? data.watchedDates : [],
        })
      } else {
        setAchievement({
          watchedLessons: 0,
          totalMinutes: 0,
          watchedDates: [],
        })
      }
    } catch (error) {
      console.error('Lỗi khi lấy thành tích:', error)
      setAchievement({
        watchedLessons: 0,
        totalMinutes: 0,
        watchedDates: [],
      })
    }
  }


  async function fetchLearningProgress(uid) {
    try {
      const progressSnapshot = await getDocs(
        collection(db, 'learningStats', uid, 'courses'),
      )

      const progressMap = {}

      progressSnapshot.docs.forEach((progressDoc) => {
        const data = progressDoc.data()
        progressMap[progressDoc.id] = {
          progress: Number(data.progress || data.percent || data.completion || 0),
          lastViewedAt:
            data.lastViewedAt ||
            data.lastWatchedAt ||
            data.updatedAt ||
            data.createdAt ||
            null,
          watchedSeconds: Number(data.watchedSeconds || 0),
        }
      })

      setLearningProgress(progressMap)
    } catch (error) {
      console.error('Lỗi khi lấy tiến độ học:', error)
      setLearningError('Không thể tải tiến độ học tập.')
      setLearningProgress({})
    }
  }

  async function handleWordUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!currentUser || !canCreateELearning) {
      alert('Chỉ giáo viên hoặc admin dev mới được tải file lên.')
      return
    }
    try {
      setUploadingWord(true)
      const safeName = `${Date.now()}-${file.name}`
      const fileRef = ref(storage, `course-files/${currentUser.uid}/${safeName}`)
      await uploadBytes(fileRef, file)
      const fileUrl = await getDownloadURL(fileRef)
      setForm((prev) => ({ ...prev, wordFileName: file.name, wordFileUrl: fileUrl }))
    } catch (error) {
      console.error('Lỗi khi tải file Word/PDF:', error)
      alert('Không thể tải file. Vui lòng thử lại.')
    } finally {
      setUploadingWord(false)
    }
  }

  async function handleCreateCourse(event) {
    event.preventDefault()
    if (!currentUser || !canCreateELearning) {
      alert('Chỉ giáo viên hoặc admin dev mới được đăng bài e-learning')
      return
    }
    try {
      const teacherName = teacherProfile?.fullName || teacherProfile?.name || currentUser.displayName || currentUser.email || 'GiaoVien'
      const lessons = normalizeLessons(form.lessons)
      const youtubeDuration = getYoutubeDurationText(form.youtubeUrl)
      await addDoc(collection(db, 'courses'), {
        title: form.title,
        topic: form.topic,
        description: form.description,
        content: form.content,
        category: form.category,
        thumbnail: form.thumbnail,
        youtubeUrl: form.youtubeUrl,
        wordFileName: form.wordFileName,
        wordFileUrl: form.wordFileUrl,
        richDocument: form.richDocument,
        teacherCode: form.teacherCode || '0000',
        courseCode: generateCourseCode(teacherName, form.category, form.teacherCode),
        visibility: form.visibility,
        className: form.visibility === 'private' ? form.className : '',
        openAt: form.openAt,
        attachMode: form.attachMode,
        codeContent: form.codeContent,
        lessons,
        lessonCount: lessons.length,
        duration: form.youtubeUrl ? youtubeDuration : '---',
        youtubeDuration,
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setForm(getEmptyForm(teacherSubject))
      setShowCreateForm(false)
      await fetchCourses()
    } catch (error) {
      console.error('Lỗi khi tạo bài e-learning:', error)
      alert('Không thể tạo bài học. Vui lòng thử lại.')
    }
  }

  async function handleUpdateCourse(event) {
    event.preventDefault()
    if (!canManageCourse(editingCourse)) {
      alert('Bạn chỉ có thể cập nhật bài học do chính bạn tạo.')
      return
    }
    try {
      const teacherName = teacherProfile?.fullName || teacherProfile?.name || currentUser.displayName || currentUser.email || editingCourse.teacherName || 'GiaoVien'
      const lessons = normalizeLessons(form.lessons)
      const youtubeDuration = getYoutubeDurationText(form.youtubeUrl)
      await updateDoc(doc(db, 'courses', editingCourse.id), {
        title: form.title,
        topic: form.topic,
        description: form.description,
        content: form.content,
        category: form.category,
        thumbnail: form.thumbnail,
        youtubeUrl: form.youtubeUrl,
        wordFileName: form.wordFileName,
        wordFileUrl: form.wordFileUrl,
        richDocument: form.richDocument,
        teacherCode: form.teacherCode || '0000',
        courseCode: generateCourseCode(teacherName, form.category, form.teacherCode),
        visibility: form.visibility,
        className: form.visibility === 'private' ? form.className : '',
        openAt: form.openAt,
        attachMode: form.attachMode,
        codeContent: form.codeContent,
        lessons,
        lessonCount: lessons.length,
        duration: form.youtubeUrl ? youtubeDuration : '---',
        youtubeDuration,
        teacherSubject: form.category,
        updatedAt: serverTimestamp(),
      })
      setForm(getEmptyForm(teacherSubject))
      setEditingCourse(null)
      setShowCreateForm(false)
      await fetchCourses()
    } catch (error) {
      console.error('Lỗi khi cập nhật bài e-learning:', error)
      alert('Không thể cập nhật bài học. Vui lòng thử lại.')
    }
  }

  async function handleDeleteCourse(course) {
    if (!canManageCourse(course)) {
      alert('Bạn chỉ có thể xóa bài học do chính bạn tạo.')
      return
    }
    if (!window.confirm(`Bạn có chắc muốn xóa bài "${stripHtml(course.title)}"?`)) return
    try {
      await deleteDoc(doc(db, 'courses', course.id))
      await fetchCourses()
    } catch (error) {
      console.error('Lỗi khi xóa bài học:', error)
      alert('Không thể xóa bài học. Vui lòng thử lại.')
    }
  }

  function openCreateModal() {
    setEditingCourse(null)
    setForm(getEmptyForm(teacherSubject))
    setShowCreateForm(true)
  }


  function canManageCourse(course) {
    return Boolean(canCreateELearning && currentUser?.uid && course?.id)
  }

  function openUpdateModal(course) {
    if (!canManageCourse(course)) {
      alert('Bạn chỉ có thể cập nhật bài học do chính bạn tạo.')
      return
    }
    setEditingCourse(course)
    setForm({
      title: course.title || '',
      topic: course.topic || '',
      description: course.description || '',
      content: course.content || '',
      category: course.category || teacherSubject || 'Toán',
      thumbnail: course.thumbnail || '',
      youtubeUrl: course.youtubeUrl || '',
      wordFileName: course.wordFileName || '',
      wordFileUrl: course.wordFileUrl || '',
      richDocument: course.richDocument || '',
      teacherCode: course.teacherCode || '0000',
      courseCode: course.courseCode || '',
      visibility: course.visibility || 'public',
      className: course.className || '',
      openAt: normalizeDateTimeLocal(course.openAt || ''),
      attachMode: course.attachMode || 'youtube',
      codeContent: course.codeContent || '',
      lessons: Array.isArray(course.lessons) && course.lessons.length > 0 ? course.lessons : [{ title: course.title || 'Bài 1', content: course.content || '' }],
    })
    setShowCreateForm(true)
  }

  const filteredCourses = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const filtered = courses.filter((course) => {
      const matchCategory = activeCategory === 'All' || course.category === activeCategory
      const matchSearch =
        !keyword ||
        stripHtml(course.title).toLowerCase().includes(keyword) ||
        stripHtml(course.description).toLowerCase().includes(keyword) ||
        course.category?.toLowerCase().includes(keyword) ||
        course.teacherName?.toLowerCase().includes(keyword) ||
        course.courseCode?.toLowerCase().includes(keyword)
      return matchCategory && matchSearch
    })
    return [...filtered].sort((a, b) => {
      if (sortBy === 'oldest') return getCourseTime(a) - getCourseTime(b)
      if (sortBy === 'featured') {
        return Number(b.isFeatured || 0) - Number(a.isFeatured || 0) || Number(b.rating || 0) - Number(a.rating || 0) || Number(b.views || 0) - Number(a.views || 0) || getCourseTime(b) - getCourseTime(a)
      }
      return getCourseTime(b) - getCourseTime(a)
    })
  }, [courses, activeCategory, search, sortBy])


  const coursesWithProgress = useMemo(() => {
    return filteredCourses.map((course) => {
      const progressInfo = learningProgress[course.id] || {}
      const progress = Math.max(
        0,
        Math.min(100, Number(progressInfo.progress || course.progress || 0)),
      )

      return {
        ...course,
        progress,
        lastViewedAt: progressInfo.lastViewedAt || course.lastViewedAt || null,
        watchedSeconds: progressInfo.watchedSeconds || 0,
      }
    })
  }, [filteredCourses, learningProgress])

  const recentlyCompletedCourses = useMemo(() => {
    return coursesWithProgress
      .filter((course) => isCompletedCourse(course))
      .sort((a, b) => getAnyTime(b.lastViewedAt) - getAnyTime(a.lastViewedAt))
      .slice(0, 6)
  }, [coursesWithProgress])

  const continueLearningCourses = useMemo(() => {
    return coursesWithProgress
      .filter((course) => course.progress > 0 && course.progress < 95)
      .sort((a, b) => getAnyTime(b.lastViewedAt) - getAnyTime(a.lastViewedAt))
      .slice(0, 6)
  }, [coursesWithProgress])

  const featuredCourses = useMemo(() => {
    return [...filteredCourses]
      .sort((a, b) => {
        return (
          getRatingAverageNumber(b) - getRatingAverageNumber(a) ||
          Number(b.views || 0) - Number(a.views || 0) ||
          Number(b.lessonCount || 0) - Number(a.lessonCount || 0)
        )
      })
      .slice(0, 6)
  }, [filteredCourses])

  return (
    <main className="min-h-screen bg-[#020617] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="relative rounded-[2rem] border border-white/10 bg-[#0f1324]/90 p-6 shadow-2xl shadow-sky-950/30 backdrop-blur-xl md:p-8">
          <button type="button" onClick={() => lessonsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="absolute right-10 -top-10 z-30 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-violet-300/40 bg-gradient-to-br from-violet-500/40 to-sky-400/25 text-5xl shadow-2xl shadow-violet-500/40 backdrop-blur transition hover:-translate-y-1 hover:scale-105 hover:border-violet-200" title="Tới phần bài học">📖</button>
          <div className="w-full">
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Science Lecture Library</h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">Khám phá thư viện bài học khoa học, tìm kiếm nội dung phù hợp và tiếp tục hành trình học tập e-learning của bạn.</p>
            <TypeEffect />
          </div>
          <div className="mt-9 grid gap-4 lg:grid-cols-2">
            <div className="relative">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm bài học, chủ đề, môn học, mã bài..." className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 pr-12 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400" />
              <span className="absolute right-5 top-1/3 -translate-y-1/2 text-xl
                 text-slate-300">⌕</span>
            </div>
            {canCreateELearning ? (
              <button type="button" onClick={openCreateModal} className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-sky-400 to-indigo-500 px-8 py-4 text-base font-bold text-white shadow-xl shadow-sky-500/25 transition hover:-translate-y-0.5 hover:from-sky-300 hover:to-indigo-400"><span>📝</span>Đăng bài<span className="text-xl">✨</span></button>
            ) : (
              <button type="button" onClick={() => { if (currentUser) fetchAchievement(currentUser.uid); setShowAchievement(true) }} className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-amber-300 to-pink-400 px-8 py-4 text-base font-bold text-slate-950 shadow-xl shadow-amber-500/20 transition hover:-translate-y-0.5"><span>🏆</span>Thành tích<span>🌟</span></button>
            )}
          </div>
        </section>

        <div ref={sortBoxRef} className="relative mt-6">
          <button type="button" onClick={() => setShowSortBox((prev) => !prev)} className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-[#0f1324] px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-sky-300/40 hover:bg-white/[0.08]"><span>🎛️</span>Sort / Lọc môn học<span>{showSortBox ? '▲' : '▼'}</span></button>
          {showSortBox && (
            <div className="absolute left-0 top-14 z-30 w-full max-w-3xl rounded-[1.5rem] border border-white/10 bg-slate-900 p-4 shadow-2xl shadow-slate-950/50">
              <div className="flex flex-wrap gap-3">{sortOptions.map((option) => <button key={option.value} type="button" onClick={() => setSortBy(option.value)} className={`rounded-full px-5 py-2 text-sm font-bold transition ${sortBy === option.value ? 'bg-sky-400 text-slate-950' : 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.12]'}`}>{option.label}</button>)}</div>
              <div className="mt-4 border-t border-white/10 pt-4"><div className="flex flex-wrap gap-3"><button type="button" onClick={() => setActiveCategory('All')} className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${activeCategory === 'All' ? 'border-sky-300 bg-sky-400 text-slate-950' : 'border-white/10 bg-white/[0.05] text-slate-200 hover:border-sky-300/40'}`}>Tất cả</button>{subjects.map((subject) => <button key={subject} type="button" onClick={() => setActiveCategory(subject)} className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${activeCategory === subject ? 'border-sky-300 bg-sky-400 text-slate-950' : 'border-white/10 bg-white/[0.05] text-slate-200 hover:border-sky-300/40'}`}>{subject}</button>)}</div></div>
            </div>
          )}
        </div>

        {showCreateForm && canCreateELearning && <CreateCourseModal form={form} setForm={setForm} onSubmit={editingCourse ? handleUpdateCourse : handleCreateCourse} onClose={() => { setShowCreateForm(false); setEditingCourse(null); setForm(getEmptyForm(teacherSubject)) }} onWordUpload={handleWordUpload} uploadingWord={uploadingWord} currentUser={currentUser} teacherProfile={teacherProfile} teacherSubject={teacherSubject} teacherClasses={teacherClasses} isEditing={Boolean(editingCourse)} />}
        {showAchievement && <AchievementModal achievement={achievement} onClose={() => setShowAchievement(false)} />}

        <section ref={lessonsRef} className="mt-10 scroll-mt-8">
          <div>
            <div className="text-sm font-bold uppercase tracking-[0.35em] text-sky-300">E-learning</div>
            <h2 className="mt-3 text-2xl font-black text-white">Danh sách bài học</h2>
            <p className="mt-2 text-sm text-slate-400">
              Dữ liệu bài học, tiến độ, lượt xem và đánh giá được lấy từ Firebase.
            </p>
          </div>

          {learningError && (
            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
              {learningError}
            </div>
          )}

          {loading ? (
            <LessonSkeletonGrid />
          ) : (
            <div className="mt-8 space-y-10">
              <LearningSection icon="✅" title="Đã xem gần đây" subtitle="Các bài học bạn đã hoàn thành gần đây">
                {recentlyCompletedCourses.length > 0 ? (
                  <div className="grid gap-4 lg:grid-cols-3">
                    {recentlyCompletedCourses.map((course) => (
<RecentLessonCard
  key={course.id}
  course={course}
onOpen={() => {
  window.location.href = `/courses/${course.id}`
}}/>                    ))}
                  </div>
                ) : (
                  <LearningEmptyState text="Bạn chưa có bài học nào hoàn thành gần đây. Hãy bắt đầu học ngay!" />
                )}
              </LearningSection>

              <LearningSection icon="▶️" title="Tiếp tục học tập" subtitle="Hoàn thành các khóa học đang theo dõi">
                {continueLearningCourses.length > 0 ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {continueLearningCourses.map((course) => (
                      <ContinueLessonCard key={course.id} course={course} onOpen={() => navigate(`/courses/${course.id}`)} />
                    ))}
                  </div>
                ) : (
                  <LearningEmptyState text="Bạn chưa có bài học đang học dở." />
                )}
              </LearningSection>

              <LearningSection icon="✨" title="Nổi bật" subtitle="Khóa học được đề xuất cho bạn">
                {featuredCourses.length > 0 ? (
                  <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {featuredCourses.map((course) => (
<FeaturedLessonCard
  key={course.id}
  course={course}
  canManage={canCreateELearning}
  onOpen={() => {
    console.log('Open course:', course.id)
    navigate(`/courses/${course.id}`)
  }}
  onDelete={handleDeleteCourse}
  onUpdate={openUpdateModal}
/>
                    ))}
                  </div>
                ) : (
                  <LearningEmptyState text="Chưa có bài học nổi bật để hiển thị." />
                )}
              </LearningSection>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function TypeEffect() {
  const [textIndex, setTextIndex] = useState(0)
  const [displayText, setDisplayText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  useEffect(() => {
    const currentText = typingTexts[textIndex]
    let timer
    if (!isDeleting && displayText.length < currentText.length) timer = setTimeout(() => setDisplayText(currentText.slice(0, displayText.length + 1)), 1000 / currentText.length)
    else if (!isDeleting && displayText.length === currentText.length) timer = setTimeout(() => setIsDeleting(true), 2000)
    else if (isDeleting && displayText.length > 0) timer = setTimeout(() => setDisplayText(currentText.slice(0, displayText.length - 1)), 1000 / currentText.length)
    else if (isDeleting && displayText.length === 0) { setIsDeleting(false); setTextIndex((prev) => (prev + 1) % typingTexts.length) }
    return () => clearTimeout(timer)
  }, [displayText, isDeleting, textIndex])
  return <div className="relative mt-6 flex min-h-[3.25rem] w-full items-center justify-center gap-3 overflow-hidden rounded-2xl border border-sky-300/20 bg-sky-400/10 px-5 py-3 text-lg font-bold text-sky-100"><FallingParticles /><span className="relative z-10 text-2xl">✨</span><span className="relative z-10">{displayText}</span><span className="relative z-10 h-7 w-[3px] animate-pulse rounded-full bg-sky-200" /><span className="relative z-10 text-2xl">🌱</span></div>
}

function FallingParticles() {
  return <div className="pointer-events-none absolute inset-0 overflow-hidden">{Array.from({ length: 24 }).map((_, index) => <span key={index} className="absolute top-[-10px] h-1.5 w-1.5 animate-[particleFall_3s_linear_infinite] rounded-full bg-sky-200/80 shadow-[0_0_10px_rgba(125,211,252,0.9)]" style={{ left: `${(index * 43) % 100}%`, animationDelay: `${(index % 8) * 0.35}s`, animationDuration: `${2.4 + (index % 5) * 0.35}s` }} />)}</div>
}

function CreateCourseModal({ form, setForm, onSubmit, onClose, onWordUpload, uploadingWord, currentUser, teacherProfile, teacherSubject, teacherClasses, isEditing }) {
  const [activeEditor, setActiveEditor] = useState(null)
  const [codeConsole, setCodeConsole] = useState('Console sẽ hiển thị kết quả chạy JavaScript tại đây.')
  const teacherName = teacherProfile?.fullName || teacherProfile?.name || currentUser?.displayName || currentUser?.email || 'GiaoVien'
  const courseCodePreview = generateCourseCode(teacherName, form.category, form.teacherCode)
  const lessons = normalizeLessons(form.lessons)

  function handleTextFormat(field, format) {
    const tagMap = { bold: ['<strong>', '</strong>'], italic: ['<em>', '</em>'], underline: ['<u>', '</u>'] }
    const [openTag, closeTag] = tagMap[format] || ['', '']
    const textarea = document.querySelector(`[data-rich-field="${field}"]`)
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentValue = form[field] || ''
    const selectedText = currentValue.slice(start, end)
    const formattedText = selectedText ? `${openTag}${selectedText}${closeTag}` : `${openTag}${closeTag}`
    const nextValue = currentValue.slice(0, start) + formattedText + currentValue.slice(end)
    setForm({ ...form, [field]: nextValue })
    requestAnimationFrame(() => { textarea.focus(); const cursorPosition = selectedText ? start + formattedText.length : start + openTag.length; textarea.setSelectionRange(cursorPosition, cursorPosition) })
  }

  function applyDocumentStyle(command) {
    document.execCommand(command, false, null)
    const editor = document.getElementById('rich-document-editor')
    if (editor) setForm((prev) => ({ ...prev, richDocument: editor.innerHTML }))
  }

  function updateTeacherCode(value) { setForm({ ...form, teacherCode: value.replace(/\D/g, '').slice(0, 4) || '0000' }) }
  function addLesson() { setForm({ ...form, lessons: [...lessons, { title: `Bài ${lessons.length + 1}`, content: '' }] }) }
  function updateLesson(index, key, value) { const next = [...lessons]; next[index] = { ...next[index], [key]: value }; setForm({ ...form, lessons: next }) }
  function removeLesson(index) { if (lessons.length <= 1) return; setForm({ ...form, lessons: lessons.filter((_, itemIndex) => itemIndex !== index) }) }
  function runCode() { const logs = []; const customConsole = { log: (...args) => logs.push(args.map(String).join(' ')), error: (...args) => logs.push(`Error: ${args.map(String).join(' ')}`), warn: (...args) => logs.push(`Warn: ${args.map(String).join(' ')}`) }; try { const runner = new Function('console', form.codeContent || ''); const result = runner(customConsole); if (result !== undefined) logs.push(String(result)); setCodeConsole(logs.length ? logs.join('\n') : 'Code đã chạy xong nhưng không có output.') } catch (error) { setCodeConsole(error.message) } }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur">
      <form onSubmit={onSubmit} className="custom-scrollbar max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/10 bg-[#050816] p-6 shadow-2xl shadow-sky-950/40">
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-5"><div><div className="text-sm font-bold uppercase tracking-[0.35em] text-sky-300">{isEditing ? 'Cập nhật bài' : 'Đăng bài'}</div><h2 className="mt-2 text-3xl font-black text-white">{isEditing ? 'Cập nhật bài e-learning' : 'Đăng tải các bài e-learning của bạn'}</h2><p className="mt-2 text-sm text-slate-400">Tạo bài học, chọn quyền xem, thời gian mở và gắn tài liệu học tập.</p></div><button type="button" onClick={onClose} className="rounded-full bg-white/10 px-4 py-3 text-sm text-white transition hover:bg-white/20">✕</button></div>
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2"><RichInput field="title" value={form.title} placeholder="Tên bài học" activeEditor={activeEditor} setActiveEditor={setActiveEditor} onChange={(value) => setForm({ ...form, title: value })} onFormat={handleTextFormat} required /><RichInput field="topic" value={form.topic} placeholder="Chủ đề bài học" activeEditor={activeEditor} setActiveEditor={setActiveEditor} onChange={(value) => setForm({ ...form, topic: value })} onFormat={handleTextFormat} required /></div>
          <RichTextarea field="description" value={form.description} placeholder="Mô tả bài học" activeEditor={activeEditor} setActiveEditor={setActiveEditor} onChange={(value) => setForm({ ...form, description: value })} onFormat={handleTextFormat} rows="3" required />
          <div className="grid gap-4 md:grid-cols-3"><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-4 font-bold text-white outline-none focus:border-sky-400">{(teacherSubject ? [teacherSubject] : subjects).map((subject) => <option key={subject} className="bg-slate-900">{subject}</option>)}</select><input required value={form.teacherCode} onChange={(event) => updateTeacherCode(event.target.value)} placeholder="0000" inputMode="numeric" maxLength="4" className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-4 font-bold text-white outline-none placeholder:text-slate-400 focus:border-sky-400" /><input readOnly value={courseCodePreview} placeholder="Mã bài" className="rounded-2xl border border-white/10 bg-sky-400/10 px-4 py-4 font-bold text-sky-200 outline-none" /></div>
          <div className="grid gap-4 md:grid-cols-3"><select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value, className: event.target.value === 'public' ? '' : form.className })} className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-4 font-bold text-white outline-none focus:border-sky-400"><option value="public" className="bg-slate-900">Công khai</option><option value="private" className="bg-slate-900">Riêng tư</option></select>{form.visibility === 'private' ? <select value={form.className} onChange={(event) => setForm({ ...form, className: event.target.value })} className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-4 font-bold text-white outline-none focus:border-sky-400"><option value="" className="bg-slate-900">Chọn lớp</option>{teacherClasses.map((classItem) => <option key={classItem} value={classItem} className="bg-slate-900">{classItem}</option>)}</select> : <TimeOpenInput value={form.openAt} onChange={(value) => setForm({ ...form, openAt: value })} />}{form.visibility === 'private' && <TimeOpenInput value={form.openAt} onChange={(value) => setForm({ ...form, openAt: value })} />}</div>
          <input value={form.thumbnail} onChange={(event) => setForm({ ...form, thumbnail: event.target.value })} placeholder="Link ảnh thumbnail" className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-4 font-bold text-white outline-none placeholder:text-slate-400 focus:border-sky-400" />
          {form.thumbnail && <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"><img src={form.thumbnail} alt="Thumbnail preview" className="h-48 w-full object-cover" /></div>}
          <div className="grid gap-4 md:grid-cols-2"><select value={form.attachMode} onChange={(event) => setForm({ ...form, attachMode: event.target.value })} className="rounded-2xl border border-white/10 bg-slate-800 px-4 py-4 font-bold text-white outline-none focus:border-sky-400"><option value="youtube">Chọn chế độ: YouTube</option><option value="file">Chọn chế độ: Word / PDF</option><option value="code">Chọn chế độ: Code</option><option value="document">Chọn chế độ: Tài liệu</option></select><button type="button" onClick={addLesson} className="rounded-2xl bg-gradient-to-r from-emerald-400 to-sky-400 px-6 py-4 font-black text-slate-950 shadow-xl shadow-emerald-500/20 transition hover:-translate-y-0.5">+ Thêm bài</button></div>
          <div className="grid gap-3">{lessons.map((lesson, index) => <div key={index} className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4"><div className="mb-3 flex items-center justify-between gap-3"><div className="font-bold text-white">Bài {index + 1}</div>{lessons.length > 1 && <button type="button" onClick={() => removeLesson(index)} className="rounded-full bg-red-500/15 px-3 py-1 text-sm font-bold text-red-200 hover:bg-red-500/25">Xóa bài</button>}</div><div className="grid gap-3 md:grid-cols-2"><input value={lesson.title} onChange={(event) => updateLesson(index, 'title', event.target.value)} placeholder="Tên bài nhỏ" className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 font-bold text-white outline-none placeholder:text-slate-400 focus:border-sky-400" /><input value={lesson.content} onChange={(event) => updateLesson(index, 'content', event.target.value)} placeholder="Mô tả/nội dung bài nhỏ" className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 font-bold text-white outline-none placeholder:text-slate-400 focus:border-sky-400" /></div></div>)}</div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
            {form.attachMode === 'youtube' && <div><input value={form.youtubeUrl} onChange={(event) => setForm({ ...form, youtubeUrl: event.target.value })} placeholder="Dán link YouTube vào đây" className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-4 text-white outline-none placeholder:text-slate-500 focus:border-sky-400" />{getYoutubeEmbedUrl(form.youtubeUrl) && <div className="mt-4 overflow-hidden rounded-2xl border border-white/10"><iframe src={getYoutubeEmbedUrl(form.youtubeUrl)} title="YouTube preview" className="aspect-video w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>}</div>}
            {form.attachMode === 'file' && <div><label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-sky-300/40 bg-sky-400/10 px-4 py-8 text-center text-sky-100 transition hover:bg-sky-400/20"><span className="text-3xl">📎</span><span className="mt-2 font-bold">{uploadingWord ? 'Đang tải file...' : 'Tải file Word / PDF'}</span><span className="mt-1 text-sm text-slate-400">Chọn file giáo viên muốn tải lên</span><input type="file" accept=".doc,.docx,.pdf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={onWordUpload} className="hidden" /></label>{form.wordFileUrl && <a href={form.wordFileUrl} target="_blank" rel="noreferrer" className="mt-4 block rounded-2xl bg-white/[0.06] px-4 py-3 text-sm font-bold text-sky-200 hover:bg-white/[0.1]">Đã tải: {form.wordFileName || 'File tài liệu'}</a>}</div>}
            {form.attachMode === 'code' && <div className="grid gap-4 lg:grid-cols-2"><div><div className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">Soạn thảo code</div><textarea value={form.codeContent} onChange={(event) => setForm({ ...form, codeContent: event.target.value })} placeholder="Nhập JavaScript tại đây..." rows="14" className="w-full rounded-2xl border border-emerald-400/20 bg-black px-4 py-4 font-mono text-sm leading-7 text-emerald-300 outline-none placeholder:text-emerald-800 focus:border-emerald-400" /><button type="button" onClick={runCode} className="mt-3 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-300">Chạy code</button></div><div><div className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-sky-300">Console</div><pre className="min-h-[374px] whitespace-pre-wrap rounded-2xl border border-white/10 bg-slate-950 p-4 font-mono text-sm text-slate-300">{codeConsole}</pre></div></div>}
            {form.attachMode === 'document' && <div><div className="mb-3 flex flex-wrap gap-2"><button type="button" onClick={() => applyDocumentStyle('bold')} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold text-white">B</button><button type="button" onClick={() => applyDocumentStyle('italic')} className="rounded-lg bg-white/10 px-3 py-2 text-sm italic text-white">I</button><button type="button" onClick={() => applyDocumentStyle('underline')} className="rounded-lg bg-white/10 px-3 py-2 text-sm underline text-white">U</button><button type="button" onClick={() => applyDocumentStyle('insertUnorderedList')} className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white">• List</button><button type="button" onClick={() => applyDocumentStyle('insertOrderedList')} className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white">1. List</button></div><div id="rich-document-editor" contentEditable suppressContentEditableWarning onInput={(event) => setForm({ ...form, richDocument: event.currentTarget.innerHTML })} className="min-h-56 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white outline-none focus:border-sky-400" dangerouslySetInnerHTML={isEditing ? { __html: form.richDocument } : undefined} /></div>}
          </div>
        </div>
        <button type="submit" className="mt-6 w-full rounded-2xl bg-gradient-to-r from-sky-400 to-indigo-500 px-6 py-4 text-sm font-bold text-white transition hover:from-sky-300 hover:to-indigo-400">{isEditing ? 'Cập nhật bài' : 'Đăng bài'}</button>
      </form>
    </div>
  )
}

function RichInput({ field, value, placeholder, activeEditor, setActiveEditor, onChange, onFormat, required }) { return <div className="relative">{activeEditor === field && <TextToolbar field={field} onFormat={onFormat} />}<textarea data-rich-field={field} required={required} value={value} onFocus={() => setActiveEditor(field)} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows="1" className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-4 font-bold text-white outline-none placeholder:text-slate-400 focus:border-sky-400" /></div> }
function RichTextarea({ field, value, placeholder, activeEditor, setActiveEditor, onChange, onFormat, rows, required }) { return <div className="relative">{activeEditor === field && <TextToolbar field={field} onFormat={onFormat} />}<textarea data-rich-field={field} required={required} value={value} onFocus={() => setActiveEditor(field)} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} className="w-full rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-4 font-bold text-white outline-none placeholder:text-slate-400 focus:border-sky-400" /></div> }
function TextToolbar({ field, onFormat }) { return <div className="absolute -top-11 left-2 z-20 flex gap-2 rounded-full border border-white/10 bg-slate-950 px-2 py-2 shadow-xl"><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onFormat(field, 'bold')} className="rounded-full bg-white/10 px-3 py-1 text-sm font-black text-white hover:bg-sky-400 hover:text-slate-950">B</button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onFormat(field, 'italic')} className="rounded-full bg-white/10 px-3 py-1 text-sm italic text-white hover:bg-sky-400 hover:text-slate-950">I</button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onFormat(field, 'underline')} className="rounded-full bg-white/10 px-3 py-1 text-sm underline text-white hover:bg-sky-400 hover:text-slate-950">U</button></div> }
function TimeOpenInput({ value, onChange }) { return <label className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-2 focus-within:border-sky-400"><div className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">Thời gian mở</div><input type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} onClick={(event) => event.currentTarget.showPicker?.()} className="mt-1 w-full bg-transparent font-bold text-white outline-none" /></label> }

function AchievementModal({ achievement, onClose }) {
  const days = getDaysInCurrentMonth()
  const watchedDates = new Set(achievement.watchedDates || [])
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-white/10 bg-slate-900 p-6 shadow-2xl"><div className="mb-6 flex items-start justify-between gap-4"><div><div className="text-4xl">🏆</div><h2 className="mt-3 text-2xl font-black text-white">Thành tích học tập</h2><p className="mt-2 text-sm text-slate-400">CHUỖI NGÀY HỌC TẬP CỦA BẠN</p></div><button type="button" onClick={onClose} className="rounded-full bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20">✕</button></div><div className="grid gap-4 sm:grid-cols-2"><AchievementCard icon="📚" label="Số bài đã coi" value={achievement.watchedLessons || 0} /><AchievementCard icon="⏱️" label="Số phút đã tích lũy" value={achievement.totalMinutes || 0} /></div><div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4"><h3 className="font-bold text-white">🔥 Lịch streak tháng này</h3><div className="mt-4 grid grid-cols-7 gap-2">{days.map((date) => { const isActive = watchedDates.has(date.iso); return <div key={date.iso} className={`flex aspect-square items-center justify-center rounded-2xl text-sm font-bold ${isActive ? 'bg-gradient-to-br from-amber-300 to-pink-400 text-slate-950 shadow-lg shadow-amber-400/20' : 'bg-white/[0.06] text-slate-500'}`} title={date.iso}>{date.day}</div> })}</div></div></div></div>
}
function AchievementCard({ icon, label, value }) { return <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-5"><div className="text-3xl">{icon}</div><div className="mt-3 text-sm text-slate-400">{label}</div><div className="mt-1 text-3xl font-black text-white">{value}</div></div> }


function LearningSection({ icon, title, subtitle, children }) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-400 text-lg text-slate-950 shadow-lg shadow-sky-500/20">
            {icon}
          </div>
          <div>
            <h3 className="text-2xl font-black text-white">{title}</h3>
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          </div>
        </div>

        <button
          type="button"
          className="hidden rounded-full px-4 py-2 text-sm font-bold text-violet-300 transition hover:bg-white/[0.06] sm:inline-flex"
        >
          Xem tất cả ›
        </button>
      </div>

      {children}
    </section>
  )
}

function RecentLessonCard({ course, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen()}
      className="group flex h-[128px] w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-left shadow-lg shadow-slate-950/10 transition hover:-translate-y-1 hover:border-emerald-300/40 hover:bg-white/[0.07]"
    >
      <div className="relative h-full w-32 shrink-0 overflow-hidden sm:w-36">
        <img
          src={getCourseThumbnail(course)}
          alt={stripHtml(course.title)}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          loading="lazy"
        />

        <div className="absolute inset-0 bg-black/0 transition duration-300 group-hover:bg-black/55" />

        <div className="absolute inset-0 flex scale-75 items-center justify-center opacity-0 transition duration-300 group-hover:scale-100 cursor-pointer group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-white/20 text-xl text-white shadow-2xl backdrop-blur">
            ▶
          </div>
        </div>

        <div className="absolute left-2 top-2 rounded-full bg-emerald-400 px-2 py-1 text-[10px] font-black text-slate-950">
          ✓ Đã hoàn thành
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center p-4">
        <h4
          className="line-clamp-2 text-base font-black text-white"
          dangerouslySetInnerHTML={{ __html: course.title }}
        />

        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
          <span>{formatRelativeTime(course.lastViewedAt)}</span>
          <span>•</span>
          <span>{course.youtubeUrl ? course.duration || '---' : '---'}</span>
        </div>
      </div>
    </button>
  )
}

function ContinueLessonCard({ course, onOpen }) {
  const progress = Math.max(0, Math.min(100, Number(course.progress || 0)))

  return (
    <article className="group flex min-h-[150px] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-lg shadow-slate-950/10 transition hover:-translate-y-1 hover:border-sky-300/40 hover:bg-white/[0.07]">
      <div className="relative hidden w-40 shrink-0 overflow-hidden sm:block">
        <img
          src={getCourseThumbnail(course)}
          alt={stripHtml(course.title)}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-sky-950/20" />
        <div className="absolute bottom-0 left-0 h-1 bg-sky-400 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center p-5">
        <h4
          className="line-clamp-2 text-lg font-black text-white"
          dangerouslySetInnerHTML={{ __html: course.title }}
        />
        <p className="mt-1 text-sm text-sky-300">{stripHtml(course.topic) || course.category || 'Chủ đề bài học'}</p>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-slate-400">Tiến độ</span>
            <span className="font-bold text-violet-300">{Math.round(progress)}%</span>
          </div>
          <ProgressBar value={progress} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span>⏱ {formatRelativeTime(course.lastViewedAt)}</span>
          <span>{course.youtubeUrl ? course.duration || '---' : '---'}</span>
          <button type="button" onClick={() => onOpen()} className="ml-auto rounded-full bg-sky-400 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-sky-300">
            Tiếp tục học
          </button>
        </div>
      </div>
    </article>
  )
}

function FeaturedLessonCard({ course, canManage, onOpen, onDelete, onUpdate }) {
  const ratingAverage = getRatingAverage(course)
  const lessonCount = Array.isArray(course.lessons)
    ? course.lessons.length
    : course.lessonCount || 0

  return (
    <article className="group flex h-auto min-h-[560px] w-full flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.025] shadow-xl shadow-slate-950/20 backdrop-blur transition hover:-translate-y-1 hover:border-sky-300/40 hover:shadow-sky-500/10">
      <div className="relative h-48 w-full shrink-0 overflow-hidden">
        <img
          src={getCourseThumbnail(course)}
          alt={stripHtml(course.title)}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />

        <span className="absolute left-4 top-4 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 px-3 py-1 text-xs font-black text-white shadow-lg shadow-fuchsia-500/20">
          🔥 Hot
        </span>

        {course.courseCode && (
          <span className="absolute right-4 top-4 rounded-full border border-white/30 bg-white/95 px-3 py-1 text-xs font-black text-slate-900 shadow-lg">
            {course.courseCode}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="line-clamp-1 font-black text-sky-300">
            {stripHtml(course.topic) || course.category || 'Science'}
          </span>

          <span className="rounded-full bg-amber-300/10 px-2 py-1 text-amber-300">
            {renderStars(ratingAverage)}
          </span>
        </div>

        <h3
          className="mt-3 line-clamp-2 min-h-[3.5rem] text-xl font-black leading-7 text-white"
          dangerouslySetInnerHTML={{ __html: course.title }}
        />

        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
          <span className="text-slate-500">Giáo viên:</span>{' '}
          <span className="font-bold text-white">
            {course.teacherName || 'Đang cập nhật'}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-400">
          <Info
            label="Thời lượng"
            value={course.youtubeUrl ? course.duration || '---' : '---'}
          />
          <Info label="Bài học" value={lessonCount} />
          <Info label="Lượt xem" value={course.views || 0} />
        </div>

        <div className="mt-auto space-y-3 pt-5">
          {!canManage && (
            <button
              type="button"
              onClick={() => {
                window.location.href = `/courses/${course.id}`
              }}
              className="w-full cursor-pointer rounded-2xl bg-gradient-to-r from-violet-500 via-sky-400 to-cyan-400 px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-sky-500/25 transition hover:-translate-y-0.5 hover:shadow-sky-400/40"
            >
              🚀 Bắt đầu học ngay
            </button>
          )}

          {canManage && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onUpdate(course)}
                className="cursor-pointer rounded-2xl border border-sky-300/25 bg-sky-400/10 px-4 py-3 text-sm font-black text-sky-100 shadow-lg shadow-sky-500/10 transition hover:-translate-y-0.5 hover:bg-sky-400 hover:text-slate-950"
              >
                ✏️ Cập nhật
              </button>

              <button
                type="button"
                onClick={() => onDelete(course)}
                className="cursor-pointer rounded-2xl border border-fuchsia-300/25 bg-fuchsia-500/10 px-4 py-3 text-sm font-black text-fuchsia-100 shadow-lg shadow-fuchsia-500/10 transition hover:-translate-y-0.5 hover:bg-fuchsia-500 hover:text-white"
              >
                🗑️ Xóa
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function LearningEmptyState({ text }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
      <div className="text-4xl">📚</div>
      <p className="mt-3 text-sm text-slate-400">{text}</p>
    </div>
  )
}

function LessonSkeletonGrid() {
  return (
    <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <div key={item} className="h-80 animate-pulse rounded-[1.5rem] bg-white/[0.06]" />
      ))}
    </div>
  )
}

function ProgressBar({ value }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, Number(value || 0)))}%` }} />
    </div>
  )
}

function Info({ label, value }) { return <div className="rounded-xl bg-white/[0.05] p-3"><div className="font-semibold text-white">{value}</div><div className="mt-1">{label}</div></div> }
function EmptyState() { return <div className="mt-8 rounded-[2rem] border border-white/10 bg-[#0f1324]/90 p-10 text-center shadow-xl shadow-sky-950/20"><div className="text-4xl">🔬</div><h3 className="mt-4 text-xl font-semibold text-white">Chưa có bài học phù hợp</h3><p className="mt-2 text-slate-400">Hãy thử đổi từ khóa tìm kiếm, bộ lọc hoặc môn học.</p></div> }

function getEmptyForm(defaultSubject = '') { return { title: '', topic: '', description: '', content: '', category: defaultSubject || 'Toán', thumbnail: '', youtubeUrl: '', wordFileName: '', wordFileUrl: '', richDocument: '', teacherCode: '0000', courseCode: '', visibility: 'public', className: '', openAt: '', attachMode: 'youtube', codeContent: '', lessons: [{ title: 'Bài 1', content: '' }] } }
function normalizeLessons(lessons) { if (!Array.isArray(lessons) || lessons.length === 0) return [{ title: 'Bài 1', content: '' }]; return lessons.map((lesson, index) => ({ title: lesson.title || `Bài ${index + 1}`, content: lesson.content || '' })) }
function resolveClassesFromUserData(userData) { const rawClasses = userData.classes || userData.classList || userData.teacherClasses || userData.lopHoc || []; if (Array.isArray(rawClasses)) return rawClasses; if (typeof rawClasses === 'string') return rawClasses.split(',').map((item) => item.trim()).filter(Boolean); return [] }
function getCourseTime(course) { if (!course.createdAt) return 0; if (typeof course.createdAt.toMillis === 'function') return course.createdAt.toMillis(); if (course.createdAt.seconds) return course.createdAt.seconds * 1000; return new Date(course.createdAt).getTime() || 0 }
function getDaysInCurrentMonth() { const now = new Date(); const year = now.getFullYear(); const month = now.getMonth(); const totalDays = new Date(year, month + 1, 0).getDate(); return Array.from({ length: totalDays }, (_, index) => { const day = index + 1; const date = new Date(year, month, day); const iso = date.toISOString().slice(0, 10); return { day, iso } }) }
function getYoutubeEmbedUrl(url) { if (!url) return ''; try { const parsedUrl = new URL(url); if (parsedUrl.hostname.includes('youtu.be')) { const videoId = parsedUrl.pathname.replace('/', ''); return videoId ? `https://www.youtube.com/embed/${videoId}` : '' } if (parsedUrl.hostname.includes('youtube.com')) { const videoId = parsedUrl.searchParams.get('v'); if (videoId) return `https://www.youtube.com/embed/${videoId}`; if (parsedUrl.pathname.includes('/embed/')) return url; if (parsedUrl.pathname.includes('/shorts/')) { const videoIdFromShorts = parsedUrl.pathname.split('/shorts/')[1]; return videoIdFromShorts ? `https://www.youtube.com/embed/${videoIdFromShorts}` : '' } } return '' } catch { return '' } }
function getYoutubeDurationText(url) { return url ? 'Đang cập nhật' : '---' }
function getRatingAverage(course) { if (course.ratingCount && course.ratingTotal) return (course.ratingTotal / course.ratingCount).toFixed(1); return Number(course.rating || 0).toFixed(1) }
function generateCourseCode(teacherName, subject, teacherCode) { return `${getTeacherInitials(teacherName)}_${subjectCodes[subject] || 'MH'}_${teacherCode || '0000'}` }
function getTeacherInitials(teacherName) { const cleanName = String(teacherName || 'GiaoVien').trim().replace(/[^\p{L}\p{N}\s]/gu, ''); if (!cleanName) return 'GiaoVien'; const words = cleanName.split(/\s+/).filter(Boolean); if (words.length <= 1) return cleanName; return words.map((word) => word[0]?.toUpperCase()).join('') }
function stripHtml(value) { return String(value || '').replace(/<[^>]*>/g, '') }
function normalizeDateTimeLocal(value) { if (!value) return ''; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); const hours = String(date.getHours()).padStart(2, '0'); const minutes = String(date.getMinutes()).padStart(2, '0'); return `${year}-${month}-${day}T${hours}:${minutes}` }

function isCompletedCourse(course) {
  const progress = Number(course.progress || 0)
  if (progress >= 95) return true
  if (!course.youtubeUrl && Number(course.watchedSeconds || 0) >= 10) return true
  return false
}

function getAnyTime(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value.seconds) return value.seconds * 1000
  return new Date(value).getTime() || 0
}

function formatRelativeTime(value) {
  const time = getAnyTime(value)
  if (!time) return 'Chưa có dữ liệu'
  const diff = Date.now() - time
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  if (hours < 24) return `${hours} giờ trước`
  return `${days} ngày trước`
}

function getCourseThumbnail(course) {
  return course.thumbnail || 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=1200&auto=format&fit=crop'
}

function getRatingAverageNumber(course) {
  if (course.ratingCount && course.ratingTotal) return Number(course.ratingTotal || 0) / Number(course.ratingCount || 1)
  return Number(course.rating || 0)
}

function renderStars(value) {
  const rating = Math.round(Number(value || 0))
  return '★'.repeat(Math.max(0, rating)) + '☆'.repeat(Math.max(0, 5 - rating))
}


export default Courses

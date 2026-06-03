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
  setDoc,
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
  const [teacherProfilesById, setTeacherProfilesById] = useState({})
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
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [achievement, setAchievement] = useState({ watchedLessons: 0, watchedDates: [] })
  const [form, setForm] = useState(getEmptyForm())
  const [uploadingWord, setUploadingWord] = useState(false)
  const isDarkMode = useDarkMode()

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

  const currentTeacherName =
    teacherProfile?.fullName ||
    teacherProfile?.name ||
    teacherProfile?.displayName ||
    currentUser?.displayName ||
    currentUser?.email ||
    'Đang cập nhật'



  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (!user) {
        setRole('STUDENT')
        setTeacherProfile(null)
        setTeacherProfilesById({})
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
          try {
            const classSnapshot = await getDocs(collection(db, 'classes'))
            const classesFromUser = resolveClassesFromUserData(userData)
            const classesFromCollection = resolveClassesFromClassDocs(classSnapshot.docs, user, userData)
            setTeacherClasses(uniqueValues([...classesFromUser, ...classesFromCollection]))
          } catch (classError) {
            console.warn('Không thể lấy danh sách lớp:', classError)
            setTeacherClasses(resolveClassesFromUserData(userData))
          }
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

    const sortedData = data.sort((a, b) => getCourseCreatedTime(b) - getCourseCreatedTime(a))

    setCourses(sortedData)
    await fetchCourseTeacherProfiles(sortedData)
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu courses:', error)
  } finally {
    setLoading(false)
  }
}

  async function fetchCourseTeacherProfiles(courseList) {
    try {
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

      await Promise.all(
        teacherIds.map(async (teacherId) => {
          try {
            const userSnap = await getDoc(doc(db, 'users', teacherId))
            if (userSnap.exists()) {
              nextProfiles[teacherId] = userSnap.data()
            }
          } catch (error) {
            console.warn('Không thể lấy tên giáo viên:', teacherId, error)
          }
        }),
      )

      setTeacherProfilesById(nextProfiles)
    } catch (error) {
      console.warn('Không thể tải danh sách tên giáo viên hiện tại:', error)
      setTeacherProfilesById({})
    }
  }


  async function fetchAchievement(uid) {
    try {
      const achievementRef = doc(db, 'learningStats', uid)
      const achievementSnap = await getDoc(achievementRef)
      const achievementData = achievementSnap.exists() ? achievementSnap.data() : {}

      const progressSnapshot = await getDocs(collection(db, 'learningStats', uid, 'courses'))
      const watchedCourseIds = []
      const watchedDateSet = new Set(Array.isArray(achievementData.watchedDates) ? achievementData.watchedDates : [])

      progressSnapshot.docs.forEach((progressDoc) => {
        const data = progressDoc.data()
        watchedCourseIds.push(progressDoc.id)

        const watchedDate = data.watchedDate || toDateKey(data.lastViewedAt || data.lastWatchedAt || data.updatedAt || data.createdAt)
        if (watchedDate) watchedDateSet.add(watchedDate)
      })

      const uniqueCourseIds = Array.from(new Set([...(Array.isArray(achievementData.watchedCourseIds) ? achievementData.watchedCourseIds : []), ...watchedCourseIds]))
      const watchedDates = Array.from(watchedDateSet).sort()

      const nextAchievement = {
        watchedLessons: uniqueCourseIds.length,
        watchedDates,
      }

      setAchievement(nextAchievement)

      await setDoc(
        achievementRef,
        {
          watchedLessons: uniqueCourseIds.length,
          watchedCourses: uniqueCourseIds.length,
          watchedCourseIds: uniqueCourseIds,
          watchedDates,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    } catch (error) {
      console.error('Lỗi khi lấy thành tích:', error)
      setAchievement({
        watchedLessons: 0,
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
    if (!stripHtml(form.title).trim() || !stripHtml(form.topic).trim() || !stripHtml(form.description).trim()) {
      alert('Vui lòng nhập đầy đủ tên bài học, chủ đề và mô tả bài học.')
      return
    }
    if (!currentUser || !canCreateELearning) {
      alert('Chỉ giáo viên hoặc admin dev mới được đăng bài e-learning')
      return
    }
    if (form.visibility === 'private' && !form.className) {
      alert('Vui lòng chọn lớp được xem bài học.')
      return
    }
    try {
      const teacherName = getFirebaseTeacherName(teacherProfile, currentUser)
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
        openAtMs: getOpenAtMs(form.openAt),
        attachMode: form.attachMode,
        codeLanguage: form.codeLanguage || 'javascript',
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
    if (!stripHtml(form.title).trim() || !stripHtml(form.topic).trim() || !stripHtml(form.description).trim()) {
      alert('Vui lòng nhập đầy đủ tên bài học, chủ đề và mô tả bài học.')
      return
    }
    if (!canManageCourse(editingCourse)) {
      alert('Bạn chỉ có thể cập nhật bài học do chính bạn tạo.')
      return
    }
    if (form.visibility === 'private' && !form.className) {
      alert('Vui lòng chọn lớp được xem bài học.')
      return
    }
    try {
      const teacherName = getFirebaseTeacherName(teacherProfile, currentUser) || editingCourse.teacherName || 'GiaoVien'
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
        openAtMs: getOpenAtMs(form.openAt),
        attachMode: form.attachMode,
        codeLanguage: form.codeLanguage || 'javascript',
        codeContent: form.codeContent,
        lessons,
        lessonCount: lessons.length,
        duration: form.youtubeUrl ? youtubeDuration : '---',
        youtubeDuration,
        teacherName,
        teacherEmail: currentUser.email || editingCourse.teacherEmail || '',
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

  function handleDeleteCourse(course) {
    if (!canManageCourse(course)) {
      alert('Bạn chỉ có thể xóa bài học do chính bạn tạo.')
      return
    }

    setDeleteTarget(course)
  }

  async function confirmDeleteCourse() {
    if (!deleteTarget) return

    try {
      await deleteDoc(doc(db, 'courses', deleteTarget.id))
      setDeleteTarget(null)
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
    if (!canCreateELearning || !currentUser?.uid || !course?.id) return false

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

    const ownerEmails = [
      course.teacherEmail,
      course.createdByEmail,
      course.ownerEmail,
    ]
      .filter(Boolean)
      .map((email) => String(email).toLowerCase())

    return (
      ownerIds.includes(String(currentUser.uid)) ||
      ownerEmails.includes(String(currentUser.email || '').toLowerCase())
    )
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
      lessons: Array.isArray(course.lessons) && course.lessons.length > 0
        ? course.lessons
        : [{
            title: course.title || 'Bài 1',
            content: course.content || '',
            attachMode: course.attachMode || 'youtube',
            youtubeUrl: course.youtubeUrl || '',
            mp4FileName: course.mp4FileName || '',
            mp4FileUrl: course.mp4FileUrl || '',
            wordFileName: course.wordFileName || '',
            wordFileUrl: course.wordFileUrl || '',
            fileExtractedText: course.fileExtractedText || '',
            codeLanguage: course.codeLanguage || 'javascript',
            codeContent: course.codeContent || '',
            richDocument: course.richDocument || '',
          }],
    })
    setShowCreateForm(true)
  }

  const filteredCourses = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const currentStudentClass = getUserClassName(teacherProfile)
    const filtered = courses.filter((course) => {
      const matchCategory = activeCategory === 'All' || course.category === activeCategory
      const matchSearch =
        !keyword ||
        stripHtml(course.title).toLowerCase().includes(keyword) ||
        stripHtml(course.description).toLowerCase().includes(keyword) ||
        course.category?.toLowerCase().includes(keyword) ||
        course.teacherName?.toLowerCase().includes(keyword) ||
        course.courseCode?.toLowerCase().includes(keyword)
      const canSeeByVisibility = canCreateELearning || canAccessCourseByClass(course, currentStudentClass)
      return canSeeByVisibility && matchCategory && matchSearch
    })
    return [...filtered].sort((a, b) => {
      if (sortBy === 'newest') {
        return getCourseCreatedTime(b) - getCourseCreatedTime(a)
      }

      if (sortBy === 'oldest') {
        return getCourseCreatedTime(a) - getCourseCreatedTime(b)
      }

      if (sortBy === 'featured') {
        return (
          Number(isHotCourse(b)) - Number(isHotCourse(a)) ||
          Number(b.isFeatured || 0) - Number(a.isFeatured || 0) ||
          Number(b.rating || 0) - Number(a.rating || 0) ||
          Number(b.views || 0) - Number(a.views || 0) ||
          getCourseCreatedTime(b) - getCourseCreatedTime(a)
        )
      }

      return getCourseCreatedTime(b) - getCourseCreatedTime(a)
    })
  }, [courses, activeCategory, search, sortBy, teacherProfile, canCreateELearning])


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
      .filter((course) => course.progress > 0 && course.progress < 100)
      .sort((a, b) => getAnyTime(b.lastViewedAt) - getAnyTime(a.lastViewedAt))
      .slice(0, 6)
  }, [coursesWithProgress])

  const featuredCourses = useMemo(() => {
    if (sortBy === 'newest') {
      return [...coursesWithProgress]
        .sort((a, b) => getCourseCreatedTime(b) - getCourseCreatedTime(a))
        .slice(0, 6)
    }

    if (sortBy === 'oldest') {
      return [...coursesWithProgress]
        .sort((a, b) => getCourseCreatedTime(a) - getCourseCreatedTime(b))
        .slice(0, 6)
    }

    return [...coursesWithProgress]
      .sort((a, b) => {
        return (
          Number(isHotCourse(b)) - Number(isHotCourse(a)) ||
          getRatingAverageNumber(b) - getRatingAverageNumber(a) ||
          Number(b.views || 0) - Number(a.views || 0) ||
          Number(b.lessonCount || 0) - Number(a.lessonCount || 0) ||
          getCourseCreatedTime(b) - getCourseCreatedTime(a)
        )
      })
      .slice(0, 6)
  }, [coursesWithProgress, sortBy])

  return (
    <main className={`${isDarkMode ? 'dark ' : ''}min-h-screen bg-slate-50 px-4 py-8 text-slate-950 transition-colors dark:bg-[#020617] dark:text-white sm:px-6 lg:px-8`}>
      <div className="mx-auto max-w-7xl">
        <section className="relative rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-2xl shadow-slate-200/80 backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1324]/90 dark:shadow-sky-950/30 md:p-8">
          <button type="button" onClick={() => lessonsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="absolute right-10 -top-10 z-30 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-violet-300/40 bg-gradient-to-br from-violet-500/40 to-sky-400/25 text-5xl shadow-2xl shadow-violet-500/40 backdrop-blur transition hover:-translate-y-1 hover:scale-105 hover:border-violet-200" title="Tới phần bài học">📖</button>
          <div className="w-full">
            <h1 className="text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">Science Lecture Library</h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300">Khám phá thư viện bài học khoa học, tìm kiếm nội dung phù hợp và tiếp tục hành trình học tập e-learning của bạn.</p>
            <TypeEffect />
          </div>
          <div className="mt-9 grid gap-4 lg:grid-cols-2">
            <div className="relative">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm bài học, chủ đề, môn học, mã bài..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 pr-12 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-slate-500" />
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
          <button type="button" aria-expanded={showSortBox} onClick={() => setShowSortBox((prev) => !prev)} className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-sky-300/40 hover:bg-slate-50 dark:border-white/10 dark:bg-[#0f1324] dark:text-slate-200 dark:hover:bg-white/[0.08]"><span>🎛️</span>Sort / Lọc môn học<span>{showSortBox ? '▲' : '▼'}</span></button>
          <div className={`absolute left-0 top-14 z-30 w-full max-w-3xl origin-top rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-300/60 transition duration-150 dark:border-white/10 dark:bg-slate-900 dark:shadow-slate-950/50 ${showSortBox ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1 scale-[0.98] opacity-0'}`}>
            <div className="flex flex-wrap gap-3">{sortOptions.map((option) => <button key={option.value} type="button" onClick={() => setSortBy(option.value)} className={`rounded-full px-5 py-2 text-sm font-bold transition ${sortBy === option.value ? 'bg-sky-400 text-slate-950' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.12]'}`}>{option.label}</button>)}</div>
            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-white/10"><div className="flex flex-wrap gap-3"><button type="button" onClick={() => setActiveCategory('All')} className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${activeCategory === 'All' ? 'border-sky-300 bg-sky-400 text-slate-950' : 'border-slate-200 bg-slate-100 text-slate-700 hover:border-sky-300/40 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200'}`}>Tất cả</button>{subjects.map((subject) => <button key={subject} type="button" onClick={() => setActiveCategory(subject)} className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${activeCategory === subject ? 'border-sky-300 bg-sky-400 text-slate-950' : 'border-slate-200 bg-slate-100 text-slate-700 hover:border-sky-300/40 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200'}`}>{subject}</button>)}</div></div>
          </div>
        </div>

        {showCreateForm && canCreateELearning && <CreateCourseModal form={form} setForm={setForm} onSubmit={editingCourse ? handleUpdateCourse : handleCreateCourse} onClose={() => { setShowCreateForm(false); setEditingCourse(null); setForm(getEmptyForm(teacherSubject)) }} onWordUpload={handleWordUpload} uploadingWord={uploadingWord} currentUser={currentUser} teacherProfile={teacherProfile} teacherSubject={teacherSubject} teacherClasses={teacherClasses} isEditing={Boolean(editingCourse)} isDarkMode={isDarkMode} />}
        {showAchievement && <AchievementModal achievement={achievement} onClose={() => setShowAchievement(false)} isDarkMode={isDarkMode} />}
        {deleteTarget && (
          <DeleteConfirmModal
            course={deleteTarget}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={confirmDeleteCourse}
            isDarkMode={isDarkMode}
          />
        )}

        <section ref={lessonsRef} className="mt-10 scroll-mt-8">
          <div>
            <div className="text-sm font-bold uppercase tracking-[0.35em] text-sky-300">E-learning</div>
            <h2 className="mt-3 text-2xl font-black text-slate-950 dark:text-white">Danh sách bài học</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
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
  disabled={!canCreateELearning && isCourseLocked(course)}
  onOpen={() => {
    if (!canCreateELearning && isCourseLocked(course)) return
    window.location.href = `/courses/${course.id}`
  }}
/>                    ))}
                  </div>
                ) : (
                  <LearningEmptyState text="Bạn chưa có bài học nào hoàn thành gần đây. Hãy bắt đầu học ngay!" />
                )}
              </LearningSection>

              <LearningSection icon="▶️" title="Tiếp tục học tập" subtitle="Hoàn thành các khóa học đang theo dõi">
                {continueLearningCourses.length > 0 ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {continueLearningCourses.map((course) => (
                      <ContinueLessonCard
                        key={course.id}
                        course={course}
                        disabled={!canCreateELearning && isCourseLocked(course)}
                        onOpen={() => {
                          if (!canCreateELearning && isCourseLocked(course)) return
                          window.location.href = `/courses/${course.id}`
                        }}
                      />
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
  canManage={canManageCourse(course)}
  teacherDisplayName={getCurrentCourseTeacherName(course, teacherProfilesById)}
  isLocked={!canCreateELearning && isCourseLocked(course)}
  onOpen={() => {
    if (!canCreateELearning && isCourseLocked(course)) return
    window.location.href = `/courses/${course.id}`
  }}
  onDelete={handleDeleteCourse}
  onUpdate={openUpdateModal}
  onPreview={(courseItem) => {
    window.location.href = `/courses/${courseItem.id}?preview=student`
  }}
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
  return <div className="relative mt-6 flex min-h-[3.25rem] w-full items-center justify-center gap-3 overflow-hidden rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3 text-lg font-bold text-sky-700 dark:border-sky-300/20 dark:bg-sky-400/10 dark:text-sky-100"><FallingParticles /><span className="relative z-10 text-2xl">✨</span><span className="relative z-10">{displayText}</span><span className="relative z-10 h-7 w-[3px] animate-pulse rounded-full bg-sky-500 dark:bg-sky-200" /><span className="relative z-10 text-2xl">🌱</span></div>
}

function FallingParticles() {
  return <div className="pointer-events-none absolute inset-0 overflow-hidden">{Array.from({ length: 24 }).map((_, index) => <span key={index} className="absolute top-[-10px] h-1.5 w-1.5 animate-[particleFall_3s_linear_infinite] rounded-full bg-sky-200/80 shadow-[0_0_10px_rgba(125,211,252,0.9)]" style={{ left: `${(index * 43) % 100}%`, animationDelay: `${(index % 8) * 0.35}s`, animationDuration: `${2.4 + (index % 5) * 0.35}s` }} />)}</div>
}


function CreateCourseModal({ form, setForm, onSubmit, onClose, onWordUpload, uploadingWord, currentUser, teacherProfile, teacherSubject, teacherClasses, isEditing, isDarkMode }) {
  const [activeDocumentFormats, setActiveDocumentFormats] = useState({})
  const [activeEditor, setActiveEditor] = useState(null)
  const [codeConsole, setCodeConsole] = useState({})
  const [uploadingLessonIndex, setUploadingLessonIndex] = useState(null)
  const [uploadingMp4Index, setUploadingMp4Index] = useState(null)
  const [mp4ErrorOpen, setMp4ErrorOpen] = useState(false)

  const teacherName = getFirebaseTeacherName(teacherProfile, currentUser)
  const courseCodePreview = generateCourseCode(teacherName, form.category, form.teacherCode)
  const lessons = normalizeLessons(form.lessons)
  const fixedTeacherSubject = teacherSubject || form.category || 'Toán'


function updateDocumentFormats(index) {
  setActiveDocumentFormats((prev) => ({
    ...prev,
    [index]: {
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
    },
  }))
}
function documentToolbarButtonClass(index, command) {
  const isActive = activeDocumentFormats[index]?.[command]

  return `cursor-pointer rounded-lg px-3 py-2 text-sm font-bold transition ${
    isActive
      ? 'bg-sky-400 text-slate-950 shadow-lg shadow-sky-400/30'
      : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white'
  }`
}
  function updateTeacherCode(value) {
    setForm({ ...form, teacherCode: value.replace(/\D/g, '').slice(0, 4) || '0000' })
  }

  function addLesson() {
    setForm({
      ...form,
      lessons: [
        ...lessons,
        {
          title: `Bài ${lessons.length + 1}`,
          content: '',
          attachMode: 'youtube',
          youtubeUrl: '',
          mp4FileName: '',
          mp4FileUrl: '',
          wordFileName: '',
          wordFileUrl: '',
          fileExtractedText: '',
          codeLanguage: 'javascript',
          codeContent: '',
          richDocument: '',
        },
      ],
    })
  }

  function updateLesson(index, key, value) {
    const next = [...lessons]
    next[index] = { ...next[index], [key]: value }
    setForm({ ...form, lessons: next })
  }

  function removeLesson(index) {
    if (lessons.length <= 1) return
    setForm({ ...form, lessons: lessons.filter((_, itemIndex) => itemIndex !== index) })
  }

  async function uploadLessonFile(index, event) {
    const file = event.target.files?.[0]
    if (!file || !currentUser) return

    try {
      setUploadingLessonIndex(index)

      const safeName = `${Date.now()}-${file.name}`
      const fileRef = ref(storage, `course-files/${currentUser.uid}/lessons/${safeName}`)
      await uploadBytes(fileRef, file)
      const fileUrl = await getDownloadURL(fileRef)
      const extractedText = await extractReadableFileText(file)

      const next = [...lessons]
      next[index] = {
        ...next[index],
        wordFileName: file.name,
        wordFileUrl: fileUrl,
        fileExtractedText: extractedText,
        content:
          extractedText ||
          next[index].content ||
          'Không thể đọc nội dung file này trực tiếp. Học sinh có thể tải file xuống để xem.',
      }

      setForm({ ...form, lessons: next })
    } catch (error) {
      console.error('Lỗi khi tải file bài nhỏ:', error)
      alert('Không thể tải file bài nhỏ. Vui lòng thử lại.')
    } finally {
      setUploadingLessonIndex(null)
    }
  }

  async function uploadLessonMp4(index, event) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file || !currentUser) return

    const fileName = String(file.name || '').trim()
    const normalizedFileName = fileName.replace(/\.+$/, '').toLowerCase()
    const normalizedFileType = String(file.type || '').trim().toLowerCase()
    const fileExtension = normalizedFileName.includes('.')
      ? normalizedFileName.split('.').pop()
      : ''
    const isClearlyNotMp4 =
      Boolean(fileExtension && fileExtension !== 'mp4') ||
      Boolean(normalizedFileType && !normalizedFileType.includes('mp4') && !normalizedFileType.startsWith('video/'))

    if (isClearlyNotMp4) {
      setMp4ErrorOpen(true)
      return
    }

    try {
      setUploadingMp4Index(index)

      const safeName = `${Date.now()}-${file.name}`
      const fileRef = ref(storage, `course-files/${currentUser.uid}/lesson-videos/${safeName}`)
      await uploadBytes(fileRef, file)
      const fileUrl = await getDownloadURL(fileRef)

      const next = [...lessons]
      next[index] = {
        ...next[index],
        mp4FileName: file.name,
        mp4FileUrl: fileUrl,
      }

      setForm({ ...form, lessons: next })
    } catch (error) {
      console.error('Lỗi khi tải file MP4:', error)
      alert('Không thể tải file MP4. Vui lòng thử lại.')
    } finally {
      setUploadingMp4Index(null)
    }
  }


function applyLessonDocumentStyle(index, command) {
  const editor = document.getElementById(`lesson-rich-document-${index}`)
  if (!editor) return

  editor.focus()
  document.execCommand(command, false, null)

  requestAnimationFrame(() => {
    updateDocumentFormats(index)
    updateLesson(index, 'richDocument', editor.innerHTML)
  })
}

  function runLessonCode(index) {
    const lesson = lessons[index] || {}
    const language = lesson.codeLanguage || 'javascript'
    const code = lesson.codeContent || ''

    if (language === 'cpp') {
      setCodeConsole((prev) => ({
        ...prev,
        [index]:
          'C++ không thể chạy trực tiếp trong trình duyệt. Code đã được lưu để học sinh xem. Nếu muốn chạy C++, cần backend/compiler service riêng.',
      }))
      return
    }

    const logs = []
    const customConsole = {
      log: (...args) => logs.push(args.map(String).join(' ')),
      error: (...args) => logs.push(`Error: ${args.map(String).join(' ')}`),
      warn: (...args) => logs.push(`Warn: ${args.map(String).join(' ')}`),
    }

    try {
      const runner = new Function('console', code)
      const result = runner(customConsole)
      if (result !== undefined) logs.push(String(result))
      setCodeConsole((prev) => ({
        ...prev,
        [index]: logs.length ? logs.join('\n') : 'Code đã chạy xong nhưng không có output.',
      }))
    } catch (error) {
      setCodeConsole((prev) => ({ ...prev, [index]: error.message }))
    }
  }


  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className={`${isDarkMode ? 'dark ' : ''}fixed inset-0 z-50 overflow-y-auto bg-slate-900/45 px-4 py-6 backdrop-blur-md dark:bg-slate-950/80`}
    >
      {mp4ErrorOpen && (
        <Mp4OnlyModal
          onClose={() => setMp4ErrorOpen(false)}
          isDarkMode={isDarkMode}
        />
      )}

      <form
        onSubmit={onSubmit}
        className="custom-scrollbar mx-auto flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-white/10 dark:bg-[#050816] dark:shadow-sky-950/40"
      >
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur dark:border-white/10 dark:bg-[#050816]/95">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.35em] text-sky-500">
                {isEditing ? 'Cập nhật' : 'Đăng bài'}
              </div>
              <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
                {isEditing ? 'Cập nhật bài e-learning' : 'Đăng bài e-learning'}
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Dữ liệu giáo viên, môn học và lớp được lấy từ Firebase.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl bg-slate-100 text-xl font-black text-slate-600 transition hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
            >
              ×
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-6">
          <div className="grid gap-6">
            <FormSection badge="01" title="Thông tin bài học" subtitle="Môn học luôn mặc định theo môn của giáo viên trong Firebase.">
              <div className="grid gap-4 md:grid-cols-2">
                <RichInput field="title" value={form.title} placeholder="Tên bài học" activeEditor={activeEditor} setActiveEditor={setActiveEditor} onChange={(value) => setForm({ ...form, title: value })}  required />
                <RichInput field="topic" value={form.topic} placeholder="Chủ đề bài học" activeEditor={activeEditor} setActiveEditor={setActiveEditor} onChange={(value) => setForm({ ...form, topic: value })}  required />
              </div>

              <RichTextarea field="description" value={form.description} placeholder="Mô tả bài học" activeEditor={activeEditor} setActiveEditor={setActiveEditor} onChange={(value) => setForm({ ...form, description: value })}  rows="4" required />

              <div className="grid gap-4 md:grid-cols-3">
                <input readOnly value={fixedTeacherSubject} className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-4 font-black text-slate-700 outline-none dark:border-white/10 dark:bg-white/[0.06] dark:text-white" />

                <input required value={form.teacherCode} onChange={(event) => updateTeacherCode(event.target.value)} placeholder="0000" inputMode="numeric" maxLength="4" className={fieldClass} />

                <input readOnly value={courseCodePreview} placeholder="Mã bài" className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 font-black text-sky-700 outline-none dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200" />
              </div>
            </FormSection>

            <FormSection badge="02" title="Quyền xem và thời gian mở" subtitle="Trước thời gian mở, thẻ hiển thị 'Chưa mở' và học sinh không thể vào xem.">
              <div className="grid gap-4 md:grid-cols-3">
                <select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value, className: event.target.value === 'public' ? '' : form.className })} className={selectClass}>
                  <option value="public" className="bg-white text-slate-950 dark:bg-slate-900 dark:text-white">Công khai</option>
                  <option value="private" className="bg-white text-slate-950 dark:bg-slate-900 dark:text-white">Riêng tư</option>
                </select>

                {form.visibility === 'private' && (
                  <select value={form.className} onChange={(event) => setForm({ ...form, className: event.target.value })} className={selectClass} required>
                    <option value="" className="bg-white text-slate-950 dark:bg-slate-900 dark:text-white">
                      {teacherClasses.length ? 'Chọn lớp' : 'Chưa có lớp trong Firebase'}
                    </option>
                    {teacherClasses.map((classItem) => (
                      <option key={classItem} value={classItem} className="bg-white text-slate-950 dark:bg-slate-900 dark:text-white">{classItem}</option>
                    ))}
                  </select>
                )}

                <TimeOpenInput value={form.openAt} onChange={(value) => setForm({ ...form, openAt: value })} />
              </div>

              <input value={form.thumbnail} onChange={(event) => setForm({ ...form, thumbnail: event.target.value })} placeholder="Link ảnh thumbnail" className={fieldClass} />

              {form.thumbnail && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.04]">
                  <img src={form.thumbnail} alt="Thumbnail preview" className="h-48 w-full object-cover" />
                </div>
              )}
            </FormSection>

            <FormSection badge="03" title="Danh sách bài và nội dung từng bài" subtitle="Mỗi bài nhỏ là một bài riêng, có thể chọn YouTube, Word/PDF, Code hoặc Tài liệu riêng.">
              <button type="button" onClick={addLesson} className="cursor-pointer rounded-2xl bg-gradient-to-r from-emerald-400 to-sky-400 px-6 py-4 font-black text-slate-950 shadow-xl shadow-emerald-500/20 transition hover:-translate-y-0.5">
                + Thêm bài
              </button>

              <div className="grid gap-4">
                {lessons.map((lesson, index) => (
                  <div key={index} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="font-black text-slate-950 dark:text-white">Bài {index + 1}</div>
                      {lessons.length > 1 && (
                        <button type="button" onClick={() => removeLesson(index)} className="cursor-pointer rounded-full bg-red-500/10 px-3 py-1 text-sm font-bold text-red-600 transition hover:bg-red-500 hover:text-white dark:text-red-200 dark:hover:bg-red-500">
                          Xóa bài
                        </button>
                      )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <input value={lesson.title} onChange={(event) => updateLesson(index, 'title', event.target.value)} placeholder="Tên bài nhỏ" className={fieldClass} />
                      <select value={lesson.attachMode || 'youtube'} onChange={(event) => updateLesson(index, 'attachMode', event.target.value)} className={selectClass}>
                        <option value="youtube" className="bg-white text-slate-950 dark:bg-slate-900 dark:text-white">YouTube</option>
                        <option value="file" className="bg-white text-slate-950 dark:bg-slate-900 dark:text-white">Word / PDF</option>
                        <option value="code" className="bg-white text-slate-950 dark:bg-slate-900 dark:text-white">Code</option>
                        <option value="document" className="bg-white text-slate-950 dark:bg-slate-900 dark:text-white">Tài liệu</option>
                      </select>
                    </div>

                    <input value={lesson.content} onChange={(event) => updateLesson(index, 'content', event.target.value)} placeholder="Mô tả/nội dung ngắn của bài nhỏ" className={`${fieldClass} mt-3`} />

                    {(lesson.attachMode || 'youtube') === 'youtube' && (
                      <div className="mt-3">
                        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                          <input
                            value={lesson.youtubeUrl || ''}
                            onChange={(event) => updateLesson(index, 'youtubeUrl', event.target.value)}
                            placeholder="Dán link YouTube cho bài này"
                            className={fieldClass}
                          />

                          <label className="inline-flex min-w-[180px] cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-400 to-orange-400 px-5 py-4 text-sm font-black text-white shadow-lg shadow-red-500/20 transition hover:-translate-y-0.5">
                            🎬 {uploadingMp4Index === index ? 'Đang tải...' : 'Add file .MP4'}
                            <input
                              type="file"
                              accept="video/mp4,.mp4"
                              onChange={(event) => uploadLessonMp4(index, event)}
                              className="hidden"
                            />
                          </label>
                        </div>

                        {lesson.mp4FileUrl && (
                          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-700 dark:text-emerald-200">
                            <span>✅ File MP4:</span>
                            <a href={lesson.mp4FileUrl} target="_blank" rel="noreferrer" className="underline">
                              {lesson.mp4FileName || 'video.mp4'}
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...lessons]
                                next[index] = { ...next[index], mp4FileName: '', mp4FileUrl: '' }
                                setForm({ ...form, lessons: next })
                              }}
                              className="ml-auto cursor-pointer rounded-full bg-red-500/10 px-3 py-1 text-xs font-black text-red-600 hover:bg-red-500 hover:text-white dark:text-red-200"
                            >
                              Xóa MP4
                            </button>
                          </div>
                        )}

                        {getYoutubeEmbedUrl(lesson.youtubeUrl) && (
                          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
                            <iframe src={getYoutubeEmbedUrl(lesson.youtubeUrl)} title={`YouTube preview ${index + 1}`} className="aspect-video w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
                          </div>
                        )}

                        {!getYoutubeEmbedUrl(lesson.youtubeUrl) && lesson.mp4FileUrl && (
                          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-black dark:border-white/10">
                            <video src={lesson.mp4FileUrl} controls className="aspect-video w-full" />
                          </div>
                        )}
                      </div>
                    )}

                    {lesson.attachMode === 'file' && (
                      <div className="mt-3">
                        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-sky-300 bg-sky-50 px-4 py-7 text-center text-sky-700 transition hover:bg-sky-100 dark:border-sky-300/40 dark:bg-sky-400/10 dark:text-sky-100 dark:hover:bg-sky-400/20">
                          <span className="text-3xl">📎</span>
                          <span className="mt-2 font-black">{uploadingLessonIndex === index ? 'Đang tải file...' : 'Tải file Word / PDF cho bài này'}</span>
                          <input type="file" accept=".doc,.docx,.pdf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => uploadLessonFile(index, event)} className="hidden" />
                        </label>
                        {lesson.fileExtractedText && (
                          <textarea
                            value={lesson.fileExtractedText}
                            onChange={(event) => updateLesson(index, 'fileExtractedText', event.target.value)}
                            rows="8"
                            className={`${fieldClass} mt-4`}
                            placeholder="Nội dung đọc được từ file"
                          />
                        )}

                        {lesson.wordFileUrl && (
                          <div className="mt-4 flex flex-wrap gap-3">
                            <a
                              href={lesson.wordFileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-sky-700 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-sky-200 dark:hover:bg-white/[0.1]"
                            >
                              👁️ Mở file {lesson.wordFileName || 'tài liệu'}
                            </a>

                            <a
                              href={lesson.wordFileUrl}
                              download={lesson.wordFileName || true}
                              className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-emerald-300"
                            >
                              ⬇️ Tải xuống
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {lesson.attachMode === 'code' && (
                      <div className="mt-3 grid gap-4 lg:grid-cols-2">
                        <div>
                          <select
                            value={lesson.codeLanguage || 'javascript'}
                            onChange={(event) => updateLesson(index, 'codeLanguage', event.target.value)}
                            className={`${selectClass} mb-3`}
                          >
                            <option value="javascript" className="bg-[#111827] text-white">JavaScript</option>
                            <option value="cpp" className="bg-[#111827] text-white">C++</option>
                          </select>

                          <textarea
                            value={lesson.codeContent || ''}
                            onChange={(event) => updateLesson(index, 'codeContent', event.target.value)}
                            placeholder={lesson.codeLanguage === 'cpp' ? 'Nhập C++ tại đây...' : 'Nhập JavaScript tại đây...'}
                            rows="12"
                            className="w-full rounded-2xl border border-emerald-400/30 bg-slate-950 px-4 py-4 font-mono text-sm leading-7 text-emerald-300 outline-none placeholder:text-emerald-800 focus:border-emerald-400"
                          />

                          <button type="button" onClick={() => runLessonCode(index)} className="mt-3 cursor-pointer rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-300">
                            {lesson.codeLanguage === 'cpp' ? 'Kiểm tra C++' : 'Chạy JavaScript'}
                          </button>
                        </div>
                        <pre className="min-h-[312px] whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-950 p-4 font-mono text-sm text-slate-300 dark:border-white/10">
                          {codeConsole[index] || 'Console sẽ hiển thị kết quả tại đây.'}
                        </pre>
                      </div>
                    )}

                    {lesson.attachMode === 'document' && (
                      <div className="mt-3">
                        <div className="mb-3 flex flex-wrap gap-2">
                          <button
  type="button"
  onMouseDown={(event) => event.preventDefault()}
  onClick={() => applyLessonDocumentStyle(index, 'bold')}
  className={documentToolbarButtonClass(index, 'bold')}
>
  B
</button>

<button
  type="button"
  onMouseDown={(event) => event.preventDefault()}
  onClick={() => applyLessonDocumentStyle(index, 'italic')}
  className={`${documentToolbarButtonClass(index, 'italic')} italic`}
>
  I
</button>

<button
  type="button"
  onMouseDown={(event) => event.preventDefault()}
  onClick={() => applyLessonDocumentStyle(index, 'underline')}
  className={`${documentToolbarButtonClass(index, 'underline')} underline`}
>
  U
</button>

<button
  type="button"
  onMouseDown={(event) => event.preventDefault()}
  onClick={() => applyLessonDocumentStyle(index, 'insertUnorderedList')}
  className={documentToolbarButtonClass(index, 'insertUnorderedList')}
>
  • List
</button>

<button
  type="button"
  onMouseDown={(event) => event.preventDefault()}
  onClick={() => applyLessonDocumentStyle(index, 'insertOrderedList')}
  className={documentToolbarButtonClass(index, 'insertOrderedList')}
>
  1. List
</button>
                        </div>
                        <div
                          id={`lesson-rich-document-${index}`}
                          contentEditable
                          suppressContentEditableWarning
                          onFocus={() => updateDocumentFormats(index)}
                          onKeyUp={() => updateDocumentFormats(index)}
                          onMouseUp={() => updateDocumentFormats(index)}
                          onInput={(event) => {
                            updateLesson(index, 'richDocument', event.currentTarget.innerHTML)
                            updateDocumentFormats(index)
                          }}
                          className="min-h-44 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/[0.06] dark:text-white [&_ol]:ml-6 [&_ol]:list-decimal [&_ul]:ml-6 [&_ul]:list-disc"
                          dangerouslySetInnerHTML={isEditing ? { __html: lesson.richDocument || '' } : undefined}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </FormSection>
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-white/10 dark:bg-[#050816]/95">
          <button type="submit" className="w-full cursor-pointer rounded-2xl bg-gradient-to-r from-sky-400 to-indigo-500 px-6 py-4 text-sm font-black text-white shadow-xl shadow-sky-500/20 transition hover:-translate-y-0.5 hover:from-sky-300 hover:to-indigo-400">
            {isEditing ? 'Cập nhật bài' : 'Đăng bài'}
          </button>
        </div>
      </form>
    </div>
  )
}


const fieldClass =
  'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-sky-400 focus:bg-slate-50 dark:border-white/10 dark:bg-[#111827] dark:text-white dark:placeholder:text-slate-400 dark:focus:border-sky-400 dark:focus:bg-[#111827]'
const selectClass =
  `${fieldClass} cursor-pointer appearance-none [color-scheme:light] dark:[color-scheme:dark] bg-[linear-gradient(45deg,transparent_50%,currentColor_50%),linear-gradient(135deg,currentColor_50%,transparent_50%)] bg-[length:6px_6px,6px_6px] bg-[position:calc(100%-20px)_50%,calc(100%-14px)_50%] bg-no-repeat pr-12`

const toolbarButtonClass =
  'cursor-pointer rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-sky-400 hover:text-slate-950 dark:bg-white/10 dark:text-white'

function FormSection({ badge, title, subtitle, children }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 text-sm font-black text-white shadow-lg shadow-sky-500/20">
          {badge}
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-950 dark:text-white">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  )
}


function RichInput({
  field,
  value,
  placeholder,
  activeEditor,
  setActiveEditor,
  onChange,
  required,
}) {
  const editorRef = useRef(null)

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || document.activeElement === editor) return

    if ((value || '') !== editor.innerText) {
      editor.innerText = value || ''
    }
  }, [value])

  function handleInput(event) {
    onChange(event.currentTarget.innerText)
  }

  function handleBlur(event) {
    if (required && !event.currentTarget.innerText.trim()) {
      event.currentTarget.innerText = ''
      onChange('')
    }
  }

  return (
    <div className="relative">
      <div
        ref={editorRef}
        data-rich-field={field}
        data-placeholder={placeholder}
        contentEditable
        suppressContentEditableWarning
        dir="ltr"
        onFocus={() => setActiveEditor(field)}
        onInput={handleInput}
        onBlur={handleBlur}
        className={`${fieldClass} min-h-[58px] cursor-text whitespace-pre-wrap break-words text-left empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] dark:empty:before:text-slate-400`}
      />
    </div>
  )
}

function RichTextarea({
  field,
  value,
  placeholder,
  activeEditor,
  setActiveEditor,
  onChange,
  rows,
  required,
}) {
  const editorRef = useRef(null)
  const minHeight = Number(rows || 4) * 28 + 32

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || document.activeElement === editor) return

    if ((value || '') !== editor.innerText) {
      editor.innerText = value || ''
    }
  }, [value])

  function handleInput(event) {
    onChange(event.currentTarget.innerText)
  }

  function handleBlur(event) {
    if (required && !event.currentTarget.innerText.trim()) {
      event.currentTarget.innerText = ''
      onChange('')
    }
  }

  return (
    <div className="relative">
      <div
        ref={editorRef}
        data-rich-field={field}
        data-placeholder={placeholder}
        contentEditable
        suppressContentEditableWarning
        dir="ltr"
        onFocus={() => setActiveEditor(field)}
        onInput={handleInput}
        onBlur={handleBlur}
        className={`${fieldClass} cursor-text whitespace-pre-wrap break-words text-left empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] dark:empty:before:text-slate-400`}
        style={{ minHeight }}
      />
    </div>
  )
}


function TimeOpenInput({ value, onChange }) {
  return (
    <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 transition focus-within:border-sky-400 focus-within:bg-slate-50 dark:border-white/10 dark:bg-[#111827] dark:focus-within:border-sky-400 dark:focus-within:bg-[#111827]">
      <div className="text-xs font-black uppercase tracking-[0.2em] text-sky-500 dark:text-sky-300">
        Thời gian mở
      </div>

      <input
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => event.currentTarget.showPicker?.()}
        className="mt-1 w-full bg-transparent font-bold text-slate-900 outline-none dark:text-white"
      />
    </label>
  )
}



function Mp4OnlyModal({ onClose, isDarkMode }) {
  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className={`${isDarkMode ? 'dark ' : ''}fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-md`}
    >
      <div className="w-full max-w-md rounded-[2rem] border border-red-200 bg-white p-6 text-center shadow-2xl shadow-red-900/20 dark:border-red-300/20 dark:bg-[#0f1324]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-red-500/10 text-4xl">
          🎬
        </div>

        <h2 className="mt-5 text-2xl font-black text-slate-950 dark:text-white">
          Chỉ hỗ trợ .mp4
        </h2>

        <p className="mt-3 text-sm font-bold leading-6 text-slate-600 dark:text-slate-300">
          File bạn chọn không đúng định dạng. Vui lòng chỉ tải file video có đuôi .mp4.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full cursor-pointer rounded-2xl bg-gradient-to-r from-red-400 to-orange-400 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-500/25 transition hover:-translate-y-0.5"
        >
          Tôi đã hiểu
        </button>
      </div>
    </div>
  )
}

function DeleteConfirmModal({ course, onCancel, onConfirm, isDarkMode }) {
  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
      className={`${isDarkMode ? 'dark ' : ''}fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-md`}
    >
      <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 text-center shadow-2xl shadow-slate-900/20 dark:border-white/10 dark:bg-[#0f1324] dark:shadow-red-950/30">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-red-500/10 text-4xl shadow-lg shadow-red-500/10">
          🗑️
        </div>

        <h2 className="mt-5 text-2xl font-black text-slate-950 dark:text-white">
          Xóa bài học?
        </h2>

        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Bạn có chắc muốn xóa bài{' '}
          <span className="font-black text-slate-950 dark:text-white">
            “{stripHtml(course.title)}”
          </span>
          ? Hành động này không thể hoàn tác.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="cursor-pointer rounded-2xl bg-gradient-to-r from-red-500 to-fuchsia-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-500/25 transition hover:-translate-y-0.5 hover:shadow-red-500/40"
          >
            Xóa bài
          </button>
        </div>
      </div>
    </div>
  )
}

function AchievementModal({ achievement, onClose, isDarkMode }) {
  const days = getDaysInCurrentMonth(achievement.watchedDates)
  const watchedDates = new Set(achievement.watchedDates || [])

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className={`${isDarkMode ? 'dark ' : ''}fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-md dark:bg-slate-950/80`}
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/20 dark:border-white/10 dark:bg-slate-900">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-4xl">🏆</div>
            <h2 className="mt-3 text-2xl font-black text-slate-950 dark:text-white">Thành tích học tập</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">CHUỖI NGÀY HỌC TẬP CỦA BẠN</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
          >
            ✕
          </button>
        </div>

        <div className="grid gap-4">
          <AchievementCard icon="📚" label="Số thẻ bài đã coi" value={achievement.watchedLessons || 0} />
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <h3 className="font-bold text-slate-950 dark:text-white">🔥 Lịch streak tháng này</h3>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {days.map((date) => {
              const isActive = watchedDates.has(date.iso)
              return (
                <div
                  key={date.iso}
                  className={`flex aspect-square items-center justify-center rounded-2xl text-sm font-bold ${
                    isActive
                      ? 'bg-gradient-to-br from-amber-300 to-pink-400 text-slate-950 shadow-lg shadow-amber-400/20'
                      : date.isBeforeFirstWatched
                        ? 'bg-slate-50 text-slate-300 opacity-50 dark:bg-white/[0.03] dark:text-slate-600'
                        : 'bg-slate-100 text-slate-400 dark:bg-white/[0.06] dark:text-slate-500'
                  }`}
                  title={date.iso}
                >
                  {date.day}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}


function AchievementCard({ icon, label, value }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[0.06]">
      <div className="text-3xl">{icon}</div>
      <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-3xl font-black text-slate-950 dark:text-white">{value}</div>
    </div>
  )
}



function LearningSection({ icon, title, subtitle, children }) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-400 text-lg text-slate-950 shadow-lg shadow-sky-500/20">
            {icon}
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-950 dark:text-white">{title}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
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

function RecentLessonCard({ course, onOpen, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onOpen()}
      className={`group flex h-[128px] w-full overflow-hidden rounded-2xl border
      border-slate-200 bg-white text-left shadow-lg shadow-slate-200/40
      transition hover:-translate-y-1 hover:border-emerald-300/40 hover:bg-slate-50

      dark:border-white/10
      dark:bg-white/[0.04]
      dark:shadow-slate-950/20
      dark:hover:bg-white/[0.07]

      ${
        disabled
          ? 'cursor-not-allowed opacity-70'
          : 'cursor-pointer'
      }`}
    >
      <div className="relative h-full w-32 shrink-0 overflow-hidden sm:w-36">
        <img
          src={getCourseThumbnail(course)}
          alt={stripHtml(course.title)}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          loading="lazy"
        />

        <div className="absolute inset-0 bg-black/0 transition duration-300 group-hover:bg-black/55" />

        <div className="absolute inset-0 flex scale-75 items-center justify-center opacity-0 transition duration-300 group-hover:scale-100 group-hover:opacity-100">
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
          className="line-clamp-2 text-base font-black
          text-slate-900
          dark:text-white"
          dangerouslySetInnerHTML={{ __html: course.title }}
        />

        <div
          className="mt-2 flex flex-wrap gap-2 text-xs
          text-slate-500
          dark:text-slate-300"
        >
          <span>{formatRelativeTime(course.lastViewedAt)}</span>
          <span>•</span>
          <span>{formatProgressLabel(course.progress)}</span>
        </div>
      </div>
    </button>
  )
}

function ContinueLessonCard({ course, onOpen, disabled }) {
  const progress = Math.max(0, Math.min(100, Number(course.progress || 0)))

  return (
    <article className="group flex min-h-[150px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/40 transition hover:-translate-y-1 hover:border-sky-300/40 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-slate-950/10 dark:hover:bg-white/[0.07]">
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
          className="line-clamp-2 text-lg font-black text-slate-950 dark:text-white"
          dangerouslySetInnerHTML={{ __html: course.title }}
        />
        <p className="mt-1 text-sm text-sky-600 dark:text-sky-300">{stripHtml(course.topic) || course.category || 'Chủ đề bài học'}</p>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Tiến độ</span>
            <span className="font-bold text-violet-600 dark:text-violet-300">{Math.round(progress)}%</span>
          </div>
          <ProgressBar value={progress} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>⏱ {formatRelativeTime(course.lastViewedAt)}</span>
          <span>{formatProgressLabel(course.progress)}</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onOpen()}
            className={`ml-auto rounded-full px-4 py-2 text-xs font-black transition ${disabled ? 'cursor-not-allowed bg-amber-300 text-slate-950 opacity-80' : 'cursor-pointer bg-sky-400 text-slate-950 hover:bg-sky-300'}`}
          >
            {disabled ? 'Chưa mở' : 'Tiếp tục học'}
          </button>
        </div>
      </div>
    </article>
  )
}


function FeaturedLessonCard({ course, canManage, teacherDisplayName, isLocked, onOpen, onDelete, onUpdate, onPreview }) {
  const ratingAverage = getRatingAverage(course)
  const lessonCount = Array.isArray(course.lessons)
    ? course.lessons.length
    : course.lessonCount || 0

  const displayTeacherName = teacherDisplayName || course.teacherName || 'Đang cập nhật'

  return (
<article className="group flex h-auto min-h-[610px] w-full flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.025] shadow-xl shadow-slate-950/20 backdrop-blur transition hover:-translate-y-1 hover:border-sky-300/40 hover:shadow-sky-500/10">      <div className="relative h-48 w-full shrink-0 overflow-hidden">
        <img
          src={getCourseThumbnail(course)}
          alt={stripHtml(course.title)}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />

        {isHotCourse(course) && (
          <span className="absolute left-4 top-4 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 px-3 py-1 text-xs font-black text-white shadow-lg shadow-fuchsia-500/20">
            🔥 Hot
          </span>
        )}

        {isLocked && (
          <span className="absolute bottom-4 left-4 rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950 shadow-lg">
            🔒 Chưa mở
          </span>
        )}

        {course.courseCode && (
          <span className="absolute right-4 top-4 rounded-full border border-white/30 bg-white/95 px-3 py-1 text-xs font-black text-slate-900 shadow-lg">
            {course.courseCode}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="line-clamp-1 font-black text-sky-600 dark:text-sky-300">
            {stripHtml(course.topic) || course.category || 'Science'}
          </span>

          <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-500 dark:bg-amber-300/15 dark:text-amber-300">
            {renderStars(ratingAverage)}
          </span>
        </div>

        <h3
          className="mt-3 line-clamp-2 min-h-[3.5rem] text-xl font-black leading-7 text-slate-950 dark:text-white"
          dangerouslySetInnerHTML={{ __html: course.title }}
        />

        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
          <span className="text-slate-500 dark:text-slate-400">Giáo viên:</span>{' '}
          <span className="font-bold text-slate-950 dark:text-white">
            {displayTeacherName}
          </span>
        </div>

        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
          <div className="font-black text-slate-950 dark:text-white">
            {formatFullDateTime(course.createdAt)}
          </div>
          <div className="mt-1 text-slate-500 dark:text-slate-400">Ngày tạo bài học</div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Info
            label="Tiến trình"
            value={formatProgressLabel(course.progress)}
          />
          <Info label="Bài học" value={lessonCount} />
          <Info label="Lượt xem" value={course.views || 0} />
        </div>

        <div className="mt-auto space-y-3 pt-5">
          {!canManage && (
            <button
              type="button"
              disabled={isLocked}
              onClick={() => !isLocked && onOpen()}
              className={`w-full rounded-2xl px-4 py-3.5 text-sm font-black shadow-lg transition ${isLocked ? 'cursor-not-allowed bg-amber-300 text-slate-950 opacity-80' : 'cursor-pointer bg-gradient-to-r from-violet-500 via-sky-400 to-cyan-400 text-white shadow-sky-500/25 hover:-translate-y-0.5 hover:shadow-sky-400/40'}`}
            >
              {isLocked ? '🔒 Chưa mở' : '🚀 Bắt đầu học ngay'}
            </button>
          )}

          {canManage && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onUpdate(course)}
                className="cursor-pointer rounded-2xl border border-sky-300/30 bg-sky-50 px-4 py-3 text-sm font-black text-sky-700 shadow-lg shadow-sky-500/10 transition hover:-translate-y-0.5 hover:bg-sky-400 hover:text-slate-950 dark:bg-sky-400/10 dark:text-sky-100"
              >
                ✏️ Cập nhật
              </button>

              <button
                type="button"
                onClick={() => onDelete(course)}
                className="cursor-pointer rounded-2xl border border-fuchsia-300/30 bg-fuchsia-50 px-4 py-3 text-sm font-black text-fuchsia-700 shadow-lg shadow-fuchsia-500/10 transition hover:-translate-y-0.5 hover:bg-fuchsia-500 hover:text-white dark:bg-fuchsia-500/10 dark:text-fuchsia-100"
              >
                🗑️ Xóa
              </button>

              <button
                type="button"
                onClick={() => onPreview(course)}
                className="col-span-2 cursor-pointer rounded-2xl border border-emerald-300/30 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 shadow-lg shadow-emerald-500/10 transition hover:-translate-y-0.5 hover:bg-emerald-400 hover:text-slate-950 dark:bg-emerald-400/10 dark:text-emerald-100"
              >
                👀 Xem trước giao diện học sinh
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
    <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-white/[0.03]">
      <div className="text-4xl">📚</div>
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{text}</p>
    </div>
  )
}

function LessonSkeletonGrid() {
  return (
    <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <div key={item} className="h-80 animate-pulse rounded-[1.5rem] bg-slate-200 dark:bg-white/[0.06]" />
      ))}
    </div>
  )
}

function ProgressBar({ value }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, Number(value || 0)))}%` }} />
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-100 p-3 dark:bg-white/[0.05]">
      <div className="font-semibold text-slate-950 dark:text-white">{value}</div>
      <div className="mt-1 text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  )
}
function EmptyState() {
  return (
    <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-xl shadow-slate-200/60 dark:border-white/10 dark:bg-[#0f1324]/90 dark:shadow-sky-950/20">
      <div className="text-4xl">🔬</div>
      <h3 className="mt-4 text-xl font-semibold text-slate-950 dark:text-white">Chưa có bài học phù hợp</h3>
      <p className="mt-2 text-slate-500 dark:text-slate-400">Hãy thử đổi từ khóa tìm kiếm, bộ lọc hoặc môn học.</p>
    </div>
  )
}


function getCurrentCourseTeacherName(course, teacherProfilesById = {}) {
  const teacherIds = [
    course?.teacherId,
    course?.createdByUid,
    course?.createdBy,
    course?.ownerId,
    course?.userId,
    course?.uid,
  ].filter(Boolean)

  for (const teacherId of teacherIds) {
    const profile = teacherProfilesById[String(teacherId)]
    const name = getProfileDisplayName(profile)
    if (name) return name
  }

  return course?.teacherName || course?.teacherEmail || 'Đang cập nhật'
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

function getEmptyForm(defaultSubject = '') {
  return {
    title: '',
    topic: '',
    description: '',
    content: '',
    category: defaultSubject || 'Toán',
    thumbnail: '',
    youtubeUrl: '',
    wordFileName: '',
    wordFileUrl: '',
    richDocument: '',
    teacherCode: '0000',
    courseCode: '',
    visibility: 'public',
    className: '',
    openAt: '',
    attachMode: 'youtube',
    codeContent: '',
    lessons: [{
      title: 'Bài 1',
      content: '',
      attachMode: 'youtube',
      youtubeUrl: '',
      mp4FileName: '',
      mp4FileUrl: '',
      wordFileName: '',
      wordFileUrl: '',
      fileExtractedText: '',
      codeLanguage: 'javascript',
      codeContent: '',
      richDocument: '',
    }],
  }
}
function normalizeLessons(lessons) {
  if (!Array.isArray(lessons) || lessons.length === 0) {
    return [{
      title: 'Bài 1',
      content: '',
      attachMode: 'youtube',
      youtubeUrl: '',
      mp4FileName: '',
      mp4FileUrl: '',
      wordFileName: '',
      wordFileUrl: '',
      fileExtractedText: '',
      codeLanguage: 'javascript',
      codeContent: '',
      richDocument: '',
    }]
  }

  return lessons.map((lesson, index) => ({
    title: lesson.title || `Bài ${index + 1}`,
    content: lesson.content || '',
    attachMode: lesson.attachMode || 'youtube',
    youtubeUrl: lesson.youtubeUrl || '',
    mp4FileName: lesson.mp4FileName || '',
    mp4FileUrl: lesson.mp4FileUrl || '',
    wordFileName: lesson.wordFileName || '',
    wordFileUrl: lesson.wordFileUrl || '',
    fileExtractedText: lesson.fileExtractedText || '',
    codeLanguage: lesson.codeLanguage || 'javascript',
    codeContent: lesson.codeContent || '',
    richDocument: lesson.richDocument || '',
  }))
}
function resolveClassesFromUserData(userData) {
  const rawClasses =
    userData.classes ||
    userData.classList ||
    userData.teacherClasses ||
    userData.lopHoc ||
    userData.className ||
    userData.studentClass ||
    []

  if (Array.isArray(rawClasses)) return rawClasses.map(String).map((item) => item.trim()).filter(Boolean)
  if (typeof rawClasses === 'string') return rawClasses.split(',').map((item) => item.trim()).filter(Boolean)
  return []
}

function resolveClassesFromClassDocs(classDocs, user, userData = {}) {
  const uid = user?.uid || ''
  const email = String(user?.email || '').toLowerCase()
  const teacherName = String(getFirebaseTeacherName(userData, user) || '').toLowerCase()

  return classDocs
    .map((classDoc) => ({ id: classDoc.id, ...classDoc.data() }))
    .filter((classItem) => isUserInClassAsTeacher(classItem, uid, email, teacherName))
    .map((classItem) => getClassDisplayName(classItem))
    .filter(Boolean)
}

function isUserInClassAsTeacher(classItem, uid, email, teacherName) {
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
].filter(Boolean).map(String)

  const teacherEmails = [
  classItem.teacherEmail,
  classItem.giaoVienEmail,
  classItem.email,
  classItem.createdByEmail,
  classItem.ownerEmail,
].filter(Boolean).map((item) => String(item).toLowerCase())

  const teacherNames = [
  classItem.teacherName,
  classItem.giaoVien,
  classItem.homeroomTeacher,
  classItem.fullName,
  classItem.nameTeacher,
  classItem.ownerName,
].filter(Boolean).map((item) => String(item).toLowerCase())

  const teacherList = [
    ...(Array.isArray(classItem.teachers) ? classItem.teachers : []),
    ...(Array.isArray(classItem.teacherList) ? classItem.teacherList : []),
    ...(Array.isArray(classItem.teacherUids) ? classItem.teacherUids : []),
  ]

  const matchList = teacherList.some((item) => {
    if (!item) return false
    if (typeof item === 'string') {
      const text = item.toLowerCase()
      return text === uid || text === email || text === teacherName
    }

    const itemUid = String(item.uid || item.id || item.teacherId || '').toLowerCase()
    const itemEmail = String(item.email || item.teacherEmail || '').toLowerCase()
    const itemName = String(item.name || item.fullName || item.teacherName || '').toLowerCase()

    return itemUid === String(uid).toLowerCase() || itemEmail === email || itemName === teacherName
  })

  return (
    teacherIds.includes(uid) ||
    teacherEmails.includes(email) ||
    teacherNames.includes(teacherName) ||
    matchList
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
    ''
  ).trim()
}

function uniqueValues(values) {
  return Array.from(new Set(values.map((item) => String(item || '').trim()).filter(Boolean)))
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
  if (course.visibility !== 'private') return true

  const allowedClasses = [
    course.className,
    ...(Array.isArray(course.classNames) ? course.classNames : []),
    ...(Array.isArray(course.allowedClasses) ? course.allowedClasses : []),
  ].filter(Boolean)

  if (!allowedClasses.length) return false

  const normalizedStudentClass = normalizeClassName(studentClass)

  return allowedClasses.some((classItem) => normalizeClassName(classItem) === normalizedStudentClass)
}
function getCourseCreatedTime(course) {
  const value =
    course?.createdAt ||
    course?.createdAtMs ||
    course?.created_time ||
    course?.createdTime ||
    course?.timestamp ||
    course?.updatedAt
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value.seconds) return value.seconds * 1000
  return new Date(value).getTime() || 0
}

function getLocalDateKey(date = new Date()) {
  const safeDate = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(safeDate.getTime())) return ''

  const year = safeDate.getFullYear()
  const month = String(safeDate.getMonth() + 1).padStart(2, '0')
  const day = String(safeDate.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function toDateKey(value) {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  let time = 0
  if (typeof value?.toMillis === 'function') time = value.toMillis()
  else if (value?.seconds) time = value.seconds * 1000
  else time = new Date(value).getTime()

  return Number.isFinite(time) ? getLocalDateKey(new Date(time)) : ''
}

function getDaysInCurrentMonth(watchedDates = []) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const totalDays = new Date(year, month + 1, 0).getDate()
  const firstWatchedDate = Array.isArray(watchedDates) && watchedDates.length ? watchedDates.slice().sort()[0] : ''
  const firstWatchedTime = firstWatchedDate ? new Date(`${firstWatchedDate}T00:00:00`).getTime() : 0

  return Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1
    const date = new Date(year, month, day)
    const iso = getLocalDateKey(date)
    const isBeforeFirstWatched = Boolean(firstWatchedTime && date.getTime() < firstWatchedTime)

    return { day, iso, isBeforeFirstWatched }
  })
}
function getYoutubeEmbedUrl(url) { if (!url) return ''; try { const parsedUrl = new URL(url); if (parsedUrl.hostname.includes('youtu.be')) { const videoId = parsedUrl.pathname.replace('/', ''); return videoId ? `https://www.youtube.com/embed/${videoId}` : '' } if (parsedUrl.hostname.includes('youtube.com')) { const videoId = parsedUrl.searchParams.get('v'); if (videoId) return `https://www.youtube.com/embed/${videoId}`; if (parsedUrl.pathname.includes('/embed/')) return url; if (parsedUrl.pathname.includes('/shorts/')) { const videoIdFromShorts = parsedUrl.pathname.split('/shorts/')[1]; return videoIdFromShorts ? `https://www.youtube.com/embed/${videoIdFromShorts}` : '' } } return '' } catch { return '' } }
function getYoutubeDurationText(url) { return url ? 'Đang cập nhật' : '---' }
function getRatingAverage(course) { if (course.ratingCount && course.ratingTotal) return (course.ratingTotal / course.ratingCount).toFixed(1); return Number(course.rating || 0).toFixed(1) }
function generateCourseCode(teacherName, subject, teacherCode) { return `${getTeacherInitials(teacherName)}_${subjectCodes[subject] || 'MH'}_${teacherCode || '0000'}` }
function getTeacherInitials(teacherName) { const cleanName = String(teacherName || 'GiaoVien').trim().replace(/[^\p{L}\p{N}\s]/gu, ''); if (!cleanName) return 'GiaoVien'; const words = cleanName.split(/\s+/).filter(Boolean); if (words.length <= 1) return cleanName; return words.map((word) => word[0]?.toUpperCase()).join('') }
function stripHtml(value) { return String(value || '').replace(/<[^>]*>/g, '') }
function normalizeDateTimeLocal(value) { if (!value) return ''; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); const hours = String(date.getHours()).padStart(2, '0'); const minutes = String(date.getMinutes()).padStart(2, '0'); return `${year}-${month}-${day}T${hours}:${minutes}` }

function isCompletedCourse(course) {
  const progress = Math.round(Number(course.progress || 0))
  return progress >= 100
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


function formatProgressLabel(value) {
  const progress = Math.max(0, Math.min(100, Number(value || 0)))
  return `${Math.round(progress)}%`
}

function getCourseThumbnail(course) {
  return course.thumbnail || 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=1200&auto=format&fit=crop'
}

function getRatingAverageNumber(course) {
  if (course.ratingCount && course.ratingTotal) return Number(course.ratingTotal || 0) / Number(course.ratingCount || 1)
  return Number(course.rating || 0)
}

function isHotCourse(course) {
  return getRatingAverageNumber(course) >= 4.5
}

function renderStars(value) {
  const rating = Math.round(Number(value || 0))
  return '★'.repeat(Math.max(0, rating)) + '☆'.repeat(Math.max(0, 5 - rating))
}


function getFirebaseTeacherName(teacherProfile, currentUser) {
  return (
    teacherProfile?.fullName ||
    teacherProfile?.name ||
    teacherProfile?.displayName ||
    currentUser?.displayName ||
    currentUser?.email ||
    'GiaoVien'
  )
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


function formatFullDateTime(value) {
  const time = getAnyTime(value)
  if (!time) return 'Chưa có thời gian'
  return new Date(time).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
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


async function extractReadableFileText(file) {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('http://localhost:5000/api/extract-file', {
      method: 'POST',
      body: formData,
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      console.warn(data.message || 'Backend không đọc được file.')
      return ''
    }

    return data.text || ''
  } catch (error) {
    console.error('Lỗi gọi backend đọc file:', error)
    return ''
  }
}


export default Courses

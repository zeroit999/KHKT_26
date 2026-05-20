import { useEffect, useState } from 'react'
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
  const [course, setCourse] = useState(null)
  const [realCourseId, setRealCourseId] = useState(courseId)
  const [loading, setLoading] = useState(true)
  const [selectedRating, setSelectedRating] = useState(0)
  const [ratingBurst, setRatingBurst] = useState(false)
  const [submittingRating, setSubmittingRating] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (!user) {
        setCurrentRole('STUDENT')
        return
      }
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        setCurrentRole(userSnap.exists() ? userSnap.data().role || 'STUDENT' : 'STUDENT')
      } catch (error) {
        console.error('Lỗi khi lấy role:', error)
        setCurrentRole('STUDENT')
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    async function fetchCourseDetail() {
      try {
        const courseRef = doc(db, 'courses', courseId)
        const courseSnap = await getDoc(courseRef)
        if (courseSnap.exists()) {
          setRealCourseId(courseSnap.id)
          setCourse({ id: courseSnap.id, ...courseSnap.data() })
          return
        }
        const titleQuery = query(collection(db, 'courses'), where('title', '==', decodeURIComponent(courseId)))
        const titleSnapshot = await getDocs(titleQuery)
        if (!titleSnapshot.empty) {
          const firstCourse = titleSnapshot.docs[0]
          setRealCourseId(firstCourse.id)
          setCourse({ id: firstCourse.id, ...firstCourse.data() })
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
    if (!currentUser || !realCourseId || !course || !isStudentRole(currentRole)) return
    async function saveLearningProgress() {
      try {
        const today = new Date().toISOString().slice(0, 10)
        const statsRef = doc(db, 'learningStats', currentUser.uid)
        const progressRef = doc(db, 'learningStats', currentUser.uid, 'courses', realCourseId)
        const progressSnap = await getDoc(progressRef)
        const alreadyWatched = progressSnap.exists()
        await setDoc(progressRef, { courseId: realCourseId, lastWatchedAt: serverTimestamp(), watchedDate: today, progress: course.youtubeUrl ? 25 : 100, watchedSeconds: course.youtubeUrl ? 0 : 10 }, { merge: true })
        if (!alreadyWatched) {
          await setDoc(statsRef, { watchedLessons: increment(1), totalMinutes: increment(getCourseMinutes(course?.duration)), watchedDates: [today], updatedAt: serverTimestamp() }, { merge: true })
        } else {
          const statsSnap = await getDoc(statsRef)
          const oldDates = statsSnap.exists() ? statsSnap.data().watchedDates || [] : []
          if (!oldDates.includes(today)) await setDoc(statsRef, { watchedDates: [...oldDates, today], updatedAt: serverTimestamp() }, { merge: true })
        }
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
  }, [currentUser, realCourseId, course, currentRole])

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
    return <main className="min-h-screen bg-[#020617] px-4 py-8 text-white sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl"><div className="h-96 animate-pulse rounded-[2rem] bg-white/[0.06]" /></div></main>
  }
  if (!course) {
    return <main className="min-h-screen bg-[#020617] px-4 py-8 text-white sm:px-6 lg:px-8"><div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-[#0f1324]/90 p-10 text-center"><div className="text-5xl">🔎</div><h1 className="mt-4 text-2xl font-bold">Không tìm thấy bài học</h1><p className="mt-2 text-slate-400">Bài học này có thể đã bị xóa hoặc đường dẫn không đúng.</p><button type="button" onClick={() => navigate('/courses')} className="mt-6 rounded-2xl bg-sky-400 px-6 py-3 font-bold text-slate-950">Quay lại danh sách</button></div></main>
  }

  const ratingAverage = getRatingAverage(course)
  const lessonCount = Array.isArray(course.lessons) ? course.lessons.length : course.lessonCount || 1

  return (
    <main className="min-h-screen bg-[#020617] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <button type="button" onClick={() => navigate('/courses')} className="mb-6 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm text-slate-300 transition hover:bg-white/[0.08] hover:text-white">← Quay lại thư viện</button>
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#0f1324]/90 shadow-2xl shadow-sky-950/30">
          <div className="relative h-72 overflow-hidden">
            <img src={course.thumbnail || 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=1400&auto=format&fit=crop'} alt={stripHtml(course.title)} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f1324] via-[#0f1324]/50 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <div className="mb-4 flex flex-wrap gap-2"><span className="rounded-full bg-sky-400 px-4 py-2 text-sm font-bold text-slate-950">{course.category || 'Science'}</span>{course.courseCode && <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white backdrop-blur">{course.courseCode}</span>}</div>
              <h1 className="max-w-4xl text-3xl font-black tracking-tight text-white sm:text-5xl" dangerouslySetInnerHTML={{ __html: course.title }} />
            </div>
          </div>
          <div className="p-6 md:p-8">
            <p className="max-w-4xl text-base leading-8 text-slate-300" dangerouslySetInnerHTML={{ __html: course.description }} />
            {(course.topic || course.courseCode || course.visibility || course.openAt) && <div className="mt-5 grid gap-3 md:grid-cols-2">{course.topic && <InfoPanel label="Chủ đề" value={stripHtml(course.topic)} />}{course.courseCode && <InfoPanel label="Mã bài" value={course.courseCode} />}{course.visibility && <InfoPanel label="Chế độ" value={course.visibility === 'private' ? 'Riêng tư' : 'Công khai'} />}{course.openAt && <InfoPanel label="Thời gian mở" value={formatOpenAt(course.openAt)} />}{course.className && <InfoPanel label="Lớp được xem" value={course.className} />}</div>}
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Giáo viên" value={course.teacherName || 'Đang cập nhật'} /><Metric label="Thời lượng" value={course.youtubeUrl ? course.duration || '---' : '---'} /><Metric label="Bài học" value={lessonCount} /><Metric label="Đánh giá" value={`★ ${ratingAverage}`} /></div>
            <RatingStars selectedRating={selectedRating} ratingAverage={ratingAverage} ratingCount={course.ratingCount || 0} ratingBurst={ratingBurst} onRate={handleRating} />
            {Array.isArray(course.lessons) && course.lessons.length > 0 && <section className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6"><div className="text-sm font-bold uppercase tracking-[0.3em] text-sky-300">Danh sách bài nhỏ</div><div className="mt-5 grid gap-3">{course.lessons.map((lesson, index) => <div key={index} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"><div className="font-bold text-white">Bài {index + 1}: {lesson.title}</div>{lesson.content && <div className="mt-2 text-sm leading-6 text-slate-300">{lesson.content}</div>}</div>)}</div></section>}
            {getYoutubeEmbedUrl(course.youtubeUrl) && <section className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6"><div className="text-sm font-bold uppercase tracking-[0.3em] text-red-300">Video bài học</div><h2 className="mt-3 text-2xl font-black text-white">Xem video e-learning</h2><div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-slate-950"><iframe src={getYoutubeEmbedUrl(course.youtubeUrl)} title={stripHtml(course.title)} className="aspect-video w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div></section>}
            {course.wordFileUrl && <section className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6"><div className="text-sm font-bold uppercase tracking-[0.3em] text-sky-300">File Word / PDF</div><h2 className="mt-3 text-2xl font-black text-white">Tài liệu giáo viên đã tải lên</h2>{isPdfFile(course.wordFileName, course.wordFileUrl) && <iframe src={course.wordFileUrl} title={course.wordFileName || 'PDF'} className="mt-5 h-[600px] w-full rounded-2xl border border-white/10 bg-slate-950" />}<a href={course.wordFileUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-3 rounded-2xl bg-sky-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-sky-300"><span>📄</span>Mở file {course.wordFileName || 'tài liệu'}</a></section>}
            <section className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6"><div className="text-sm font-bold uppercase tracking-[0.3em] text-sky-300">Nội dung bài học</div><h2 className="mt-3 text-2xl font-black text-white">Bắt đầu học</h2><div className="mt-5 whitespace-pre-line rounded-2xl bg-slate-950/50 p-5 text-base leading-8 text-slate-200">{course.content || 'Giáo viên chưa thêm nội dung chi tiết cho bài học này.'}</div></section>
            {course.codeContent && <section className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6"><div className="text-sm font-bold uppercase tracking-[0.3em] text-emerald-300">Code</div><h2 className="mt-3 text-2xl font-black text-white">Nội dung code của bài học</h2><div className="mt-5 grid gap-4 lg:grid-cols-2"><pre className="min-h-72 overflow-auto rounded-2xl border border-emerald-400/20 bg-black p-5 font-mono text-sm leading-7 text-emerald-300">{course.codeContent}</pre><CodeRunner code={course.codeContent} /></div></section>}
            {course.richDocument && <section className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6"><div className="text-sm font-bold uppercase tracking-[0.3em] text-emerald-300">Tài liệu</div><h2 className="mt-3 text-2xl font-black text-white">Tài liệu dạng Word</h2><div className="prose prose-invert mt-5 max-w-none rounded-2xl bg-slate-950/50 p-5 text-base leading-8 text-slate-200" dangerouslySetInnerHTML={{ __html: course.richDocument }} /></section>}
          </div>
        </section>
      </div>
    </main>
  )
}

function RatingStars({ selectedRating, ratingAverage, ratingCount, ratingBurst, onRate }) {
  return <section className="relative mt-8 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6"><div className="text-sm font-bold uppercase tracking-[0.3em] text-amber-300">Đánh giá bài học</div><h2 className="mt-3 text-2xl font-black text-white">Bạn thấy bài học này thế nào?</h2><div className="relative mt-5 flex flex-wrap items-center gap-3">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" onClick={() => onRate(star)} className={`relative text-4xl transition duration-200 hover:scale-125 ${star <= selectedRating ? 'text-amber-300 drop-shadow-[0_0_14px_rgba(252,211,77,0.9)]' : 'text-slate-600 hover:text-amber-200'}`}>★</button>)}<span className="ml-2 text-sm text-slate-400">Trung bình: ★ {ratingAverage} ({ratingCount} lượt)</span>{ratingBurst && <div className="pointer-events-none absolute left-16 top-1/2">{Array.from({ length: 14 }).map((_, index) => <span key={index} className="absolute h-2 w-2 animate-[ratingBurst_650ms_ease-out_forwards] rounded-full bg-amber-300" style={{ '--rotate': `${index * 26}deg` }} />)}</div>}</div></section>
}
function CodeRunner({ code }) { const [output, setOutput] = useState('Ấn "Chạy code" để xem console.'); function runCode() { const logs = []; const customConsole = { log: (...args) => logs.push(args.map(String).join(' ')), error: (...args) => logs.push(`Error: ${args.map(String).join(' ')}`), warn: (...args) => logs.push(`Warn: ${args.map(String).join(' ')}`) }; try { const runner = new Function('console', code || ''); const result = runner(customConsole); if (result !== undefined) logs.push(String(result)); setOutput(logs.length ? logs.join('\n') : 'Code đã chạy xong nhưng không có output.') } catch (error) { setOutput(error.message) } } return <div className="rounded-2xl border border-white/10 bg-slate-950 p-5"><div className="flex items-center justify-between gap-3"><div className="text-xs font-bold uppercase tracking-[0.25em] text-sky-300">Console</div><button type="button" onClick={runCode} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-300">Chạy code</button></div><pre className="mt-4 min-h-60 whitespace-pre-wrap rounded-xl bg-black/50 p-4 font-mono text-sm text-slate-300">{output}</pre></div> }
function Metric({ label, value }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4"><div className="text-sm text-slate-400">{label}</div><div className="mt-1 font-bold text-white">{value}</div></div> }
function InfoPanel({ label, value }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4"><div className="text-xs font-bold uppercase tracking-[0.25em] text-sky-300">{label}</div><div className="mt-2 font-bold text-white">{value}</div></div> }
function stripHtml(value) { return String(value || '').replace(/<[^>]*>/g, '') }
function formatOpenAt(value) { if (!value) return '---'; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return date.toLocaleString('vi-VN') }
function isPdfFile(name, url) { return `${name || ''} ${url || ''}`.toLowerCase().includes('.pdf') }
function getRatingAverage(course) { if (course.ratingCount && course.ratingTotal) return (course.ratingTotal / course.ratingCount).toFixed(1); return Number(course.rating || 0).toFixed(1) }
function getYoutubeEmbedUrl(url) { if (!url) return ''; try { const parsedUrl = new URL(url); if (parsedUrl.hostname.includes('youtu.be')) { const videoId = parsedUrl.pathname.replace('/', ''); return videoId ? `https://www.youtube.com/embed/${videoId}` : '' } if (parsedUrl.hostname.includes('youtube.com')) { const videoId = parsedUrl.searchParams.get('v'); if (videoId) return `https://www.youtube.com/embed/${videoId}`; if (parsedUrl.pathname.includes('/embed/')) return url; if (parsedUrl.pathname.includes('/shorts/')) { const videoIdFromShorts = parsedUrl.pathname.split('/shorts/')[1]; return videoIdFromShorts ? `https://www.youtube.com/embed/${videoIdFromShorts}` : '' } } return '' } catch { return '' } }
function getCourseMinutes(duration) { if (!duration) return 0; const text = String(duration).toLowerCase(); const hourMatch = text.match(/(\d+)\s*h/); const minuteMatch = text.match(/(\d+)\s*m/); const hours = hourMatch ? Number(hourMatch[1]) : 0; const minutes = minuteMatch ? Number(minuteMatch[1]) : 0; if (hours || minutes) return hours * 60 + minutes; const numberOnly = Number(text.replace(/\D/g, '')); return Number.isFinite(numberOnly) ? numberOnly : 0 }

/*
Thêm CSS này vào index.css hoặc App.css để hiệu ứng nổ sao hoạt động:
@keyframes ratingBurst {
  0% { opacity: 1; transform: rotate(var(--rotate, 0deg)) translateX(0) scale(1); }
  100% { opacity: 0; transform: rotate(var(--rotate, 0deg)) translateX(70px) scale(0.2); }
}
*/

function isStudentRole(role) {
  return String(role || '').trim().toUpperCase() === 'STUDENT'
}

export default CourseDetail

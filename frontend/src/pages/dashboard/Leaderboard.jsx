import { useEffect, useMemo, useState } from 'react'
import {
  Award,
  BookOpen,
  Flame,
  GraduationCap,
  Loader2,
  Medal,
  RefreshCcw,
  Search,
  Sparkles,
  Star,
  Trophy,
  UsersRound,
} from 'lucide-react'
import {
  collection,
  getDocs,
} from 'firebase/firestore'

import { db } from '../../components/firebase'
import useSyncedDarkMode from '../../hooks/common/useSyncedDarkMode'

const gradeTabs = [
  { value: 'all', label: 'Tất cả' },
  { value: '10', label: 'Khối 10' },
  { value: '11', label: 'Khối 11' },
  { value: '12', label: 'Khối 12' },
]

const normalizeRole = (value = '') => String(value || '').trim().toUpperCase()

const isStudentRole = (value = '') => {
  const role = normalizeRole(value)
  return role === 'STUDENT' || role === 'HOCSINH' || role === 'HỌC SINH'
}

const getStudentGrade = (student = {}) => {
  const grade =
    student.grade ||
    student.khoi ||
    student.gradeLevel ||
    student.studentGrade ||
    student.block ||
    ''

  const match = String(grade).match(/10|11|12/)
  return match?.[0] || String(grade || '').trim()
}

const getStudentName = (student = {}) => {
  return (
    student.fullName ||
    student.displayName ||
    student.name ||
    student.studentName ||
    student.email ||
    student.studentEmail ||
    'Học sinh'
  )
}

const getStudentHandle = (student = {}) => {
  const source =
    student.username ||
    student.handle ||
    student.email?.split('@')[0] ||
    student.studentEmail?.split('@')[0] ||
    getStudentName(student)

  return `@${String(source || 'student')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')}`
}

const getStudentSchool = (student = {}) => {
  return (
    student.school ||
    student.schoolName ||
    student.truong ||
    student.highSchool ||
    student.className ||
    student.lop ||
    'Chưa cập nhật trường/lớp'
  )
}

const getResultStudentId = (result = {}) => {
  return String(
    result.studentId ||
      result.userId ||
      result.uid ||
      result.id ||
      result.email ||
      result.studentEmail ||
      '',
  )
}

const toMillis = (value) => {
  if (!value) return 0
  if (value?.toDate) return value.toDate().getTime()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

const scoreToPoint = (score) => Math.round(Number(score || 0) * 100)

const avatarClasses = [
  'bg-fuchsia-500 text-white',
  'bg-sky-500 text-white',
  'bg-emerald-500 text-white',
  'bg-orange-500 text-white',
  'bg-pink-500 text-white',
  'bg-violet-500 text-white',
  'bg-blue-500 text-white',
  'bg-rose-500 text-white',
]

function LoadingState({ dark }) {
  return (
    <section className={`${dark ? 'dark ' : ''}min-h-screen bg-slate-50 px-4 py-16 text-slate-950 transition dark:bg-slate-950 dark:text-white`}>
      <div className="mx-auto flex max-w-6xl items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 shadow-sm dark:border-white/10 dark:bg-white/5">
        <Loader2 className="mr-3 h-6 w-6 animate-spin text-violet-600 dark:text-violet-300" />
        <span className="font-black">Đang tải bảng xếp hạng từ Firebase...</span>
      </div>
    </section>
  )
}

function EmptyState({ onReload }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:shadow-2xl dark:shadow-black/20">
      <Trophy className="mx-auto h-14 w-14 text-slate-400 dark:text-slate-500" />
      <h2 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">Chưa có dữ liệu xếp hạng</h2>
      <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
        Hệ thống chưa tìm thấy học sinh hoặc kết quả bài làm trong Firestore.
      </p>
      <button
        type="button"
        onClick={onReload}
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-700"
      >
        <RefreshCcw className="h-4 w-4" />
        Tải lại dữ liệu
      </button>
    </div>
  )
}

function RankBadge({ rank }) {
  if (rank === 1) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-white shadow-lg shadow-amber-500/30"><Trophy className="h-4 w-4" /> #1</span>
  }

  if (rank === 2) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-slate-400 px-3 py-1 text-xs font-black text-white shadow-lg shadow-slate-500/20"><Medal className="h-4 w-4" /> #2</span>
  }

  if (rank === 3) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-3 py-1 text-xs font-black text-white shadow-lg shadow-orange-500/20"><Award className="h-4 w-4" /> #3</span>
  }

  return <span className="font-black text-slate-400">{rank}</span>
}

function PodiumCard({ item, rank }) {
  const styleByRank = {
    1: 'border-amber-300 bg-amber-50 shadow-amber-200 lg:-translate-y-2 dark:border-amber-400/60 dark:bg-amber-500/10 dark:shadow-amber-500/20',
    2: 'border-slate-300 bg-slate-50 shadow-slate-200 dark:border-slate-300/50 dark:bg-slate-500/10 dark:shadow-slate-500/20',
    3: 'border-orange-300 bg-orange-50 shadow-orange-200 dark:border-orange-500/60 dark:bg-orange-500/10 dark:shadow-orange-500/20',
  }

  const textByRank = {
    1: 'text-amber-600 dark:text-amber-300',
    2: 'text-slate-700 dark:text-slate-200',
    3: 'text-orange-600 dark:text-orange-300',
  }

  return (
    <article className={`relative rounded-3xl border p-6 text-center shadow-xl backdrop-blur ${styleByRank[rank]}`}>
      <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
        <RankBadge rank={rank} />
      </div>

      <div className={`mx-auto mt-4 flex h-16 w-16 items-center justify-center rounded-full border-2 text-2xl font-black ${item.avatarClass}`}>
        {item.initial}
      </div>

      <h3 className="mt-4 text-lg font-black text-slate-950 dark:text-white">{item.name}</h3>
      <p className="mt-1 text-sm font-bold text-blue-600 dark:text-blue-300">{item.handle}</p>
      <p className="mt-3 line-clamp-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{item.school}</p>

      <span className="mt-4 inline-flex rounded-full bg-cyan-100 px-3 py-1 text-xs font-black text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300">
        • Khối {item.grade || '—'}
      </span>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/70 p-4 dark:bg-black/20">
          <p className={`text-2xl font-black ${textByRank[rank]}`}>{item.points}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">điểm</p>
        </div>
        <div className="rounded-2xl bg-white/70 p-4 dark:bg-black/20">
          <p className="text-2xl font-black text-slate-800 dark:text-slate-200">{item.submissions}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">bài làm</p>
        </div>
      </div>
    </article>
  )
}

function Leaderboard() {
  const dark = useSyncedDarkMode()
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState([])
  const [activeGrade, setActiveGrade] = useState('all')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const loadLeaderboard = async () => {
    try {
      setLoading(true)
      setError('')

      const [usersSnap, examsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'exams')),
      ])

      const studentMap = new Map()

      usersSnap.docs.forEach((userDoc, index) => {
        const data = userDoc.data() || {}
        const role = data.role || data.userRole || data.type || ''

        if (!isStudentRole(role)) return

        const grade = getStudentGrade(data)
        const name = getStudentName(data)
        const key = String(userDoc.id || data.uid || data.email || name)

        studentMap.set(key, {
          id: key,
          name,
          handle: getStudentHandle(data),
          school: getStudentSchool(data),
          grade,
          className: data.className || data.lop || data.studentClass || '',
          initial: String(name).trim().charAt(0).toUpperCase() || 'S',
          avatarClass: avatarClasses[index % avatarClasses.length],
          points: 0,
          submissions: 0,
          bestByExam: {},
          latestSubmitAt: 0,
        })
      })

      const subcollectionJobs = examsSnap.docs.map(async (examDoc) => {
        const exam = { id: examDoc.id, ...(examDoc.data() || {}) }
        let results = Array.isArray(exam.studentResults) ? exam.studentResults : []

        try {
          const resultsSnap = await getDocs(collection(db, 'exams', examDoc.id, 'results'))
          const subResults = resultsSnap.docs.map((resultDoc) => ({
            id: resultDoc.id,
            ...resultDoc.data(),
          }))
          results = [...results, ...subResults]
        } catch (subError) {
          console.warn('Không thể tải results subcollection:', examDoc.id, subError)
        }

        return { examId: examDoc.id, results }
      })

      const examResults = await Promise.all(subcollectionJobs)

      examResults.forEach(({ examId, results }) => {
        results.forEach((result) => {
          const studentId = getResultStudentId(result)
          if (!studentId) return

          if (!studentMap.has(studentId)) {
            const name = getStudentName(result)
            studentMap.set(studentId, {
              id: studentId,
              name,
              handle: getStudentHandle(result),
              school: getStudentSchool(result),
              grade: getStudentGrade(result),
              className: result.className || result.lop || result.studentClass || '',
              initial: String(name).trim().charAt(0).toUpperCase() || 'S',
              avatarClass: avatarClasses[studentMap.size % avatarClasses.length],
              points: 0,
              submissions: 0,
              bestByExam: {},
              latestSubmitAt: 0,
            })
          }

          const student = studentMap.get(studentId)
          const score = Number(result.score || result.totalScore || 0)
          const submitAt = toMillis(result.createdAt || result.submittedAt || result.updatedAt)

          student.submissions += 1
          student.latestSubmitAt = Math.max(student.latestSubmitAt, submitAt)

          const currentBest = student.bestByExam[examId]
          if (!currentBest || score > currentBest.score) {
            student.bestByExam[examId] = { score, submitAt }
          }
        })
      })

      const rows = Array.from(studentMap.values()).map((student) => {
        const points = Object.values(student.bestByExam).reduce(
          (total, item) => total + scoreToPoint(item.score),
          0,
        )

        return {
          ...student,
          points,
          solved: Object.keys(student.bestByExam).length,
        }
      })

      rows.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.solved !== a.solved) return b.solved - a.solved
        if (a.submissions !== b.submissions) return a.submissions - b.submissions
        return b.latestSubmitAt - a.latestSubmitAt
      })

      setStudents(rows)
    } catch (loadError) {
      console.error(loadError)
      setError(loadError.message || 'Không thể tải bảng xếp hạng')
      setStudents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLeaderboard()
  }, [])

  const filteredStudents = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return students.filter((student) => {
      if (activeGrade !== 'all' && String(student.grade) !== activeGrade) return false
      if (!keyword) return true

      return (
        student.name.toLowerCase().includes(keyword) ||
        student.handle.toLowerCase().includes(keyword) ||
        student.school.toLowerCase().includes(keyword) ||
        String(student.className || '').toLowerCase().includes(keyword)
      )
    })
  }, [students, activeGrade, search])

  const rankedStudents = useMemo(
    () => filteredStudents.map((student, index) => ({ ...student, rank: index + 1 })),
    [filteredStudents],
  )

  const topThree = rankedStudents.slice(0, 3)
  const rest = rankedStudents.slice(3)

  const totalSubmissions = students.reduce((total, student) => total + student.submissions, 0)
  const highestPoint = students.reduce((max, student) => Math.max(max, student.points), 0)

  if (loading) return <LoadingState dark={dark} />

  return (
    <div className={dark ? 'dark' : ''}>
      <section className="min-h-screen bg-slate-50 text-slate-950 transition dark:bg-slate-950 dark:text-white">
        <div className="relative overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.18),transparent_35%),linear-gradient(135deg,#f8fafc,#eef2ff_55%,#ede9fe)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.5),transparent_35%),linear-gradient(135deg,#111827,#1e1b4b_55%,#2e1065)]">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:48px_48px] dark:bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)]" />

          <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="mb-8 inline-flex items-center gap-3 rounded-full bg-white/80 px-4 py-2 text-sm font-black uppercase tracking-[0.16em] text-blue-700 ring-1 ring-slate-200 dark:bg-white/5 dark:text-blue-200 dark:ring-white/10">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white">
                <Star className="h-5 w-5 fill-current" />
              </span>
              Online Judge
            </div>

            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="flex items-center gap-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-300/30 bg-violet-500/15 text-violet-700 shadow-lg shadow-violet-500/10 dark:text-violet-200 dark:shadow-violet-500/20">
                  <Trophy className="h-9 w-9" />
                </div>
                <div>
                  <h1 className="text-4xl font-black tracking-tight text-slate-950 md:text-6xl dark:text-white">
                    Bảng Xếp Hạng
                  </h1>
                  <p className="mt-3 text-base font-semibold text-slate-600 md:text-lg dark:text-blue-200">
                    Thành tích học sinh xuất sắc theo từng khối
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 dark:border-blue-300/20 dark:bg-blue-400/10 dark:text-blue-200">
                  <UsersRound className="h-4 w-4" />
                  {students.length} học sinh
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-black text-indigo-700 dark:border-indigo-300/20 dark:bg-indigo-400/10 dark:text-indigo-200">
                  <BookOpen className="h-4 w-4" />
                  {totalSubmissions.toLocaleString('vi-VN')} bài làm
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-black text-amber-700 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-200">
                  <Flame className="h-4 w-4" />
                  Cao nhất: {highestPoint} điểm
                </span>
              </div>
            </div>
          </div>
        </div>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-3">
              {gradeTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveGrade(tab.value)}
                  className={`rounded-2xl border px-5 py-3 text-sm font-black transition ${
                    activeGrade === tab.value
                      ? 'border-violet-500 bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-violet-300/50 dark:hover:bg-white/10'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300 lg:w-96">
              <Search className="h-5 w-5 text-slate-400 dark:text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm học sinh, trường..."
                className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </div>
          )}

          {!rankedStudents.length ? (
            <EmptyState onReload={loadLeaderboard} />
          ) : (
            <>
              <div className="grid gap-5 lg:grid-cols-3 lg:items-end">
                {topThree.map((item) => (
                  <PodiumCard key={item.id} item={item} rank={item.rank} />
                ))}
              </div>

              <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:shadow-2xl dark:shadow-black/20">
                <div className="grid grid-cols-[90px_1.4fr_150px_120px_120px] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 max-lg:hidden">
                  <span>Hạng</span>
                  <span>Học sinh</span>
                  <span>Khối</span>
                  <span>Số bài</span>
                  <span className="text-right">Điểm</span>
                </div>

                <div className="divide-y divide-slate-200 dark:divide-white/10">
                  {rest.map((student) => (
                    <div
                      key={student.id}
                      className="grid gap-4 px-6 py-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/[0.04] lg:grid-cols-[90px_1.4fr_150px_120px_120px] lg:items-center"
                    >
                      <div className="flex items-center gap-3">
                        <RankBadge rank={student.rank} />
                      </div>

                      <div className="flex min-w-0 items-center gap-4">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black ${student.avatarClass}`}>
                          {student.initial}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-950 dark:text-white">{student.name}</p>
                          <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                            <span className="text-blue-600 dark:text-blue-300">{student.handle}</span>
                            <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
                            {student.school}
                          </p>
                        </div>
                      </div>

                      <div>
                        <span className="inline-flex rounded-full bg-cyan-100 px-3 py-1 text-xs font-black text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300">
                          • Khối {student.grade || '—'}
                        </span>
                      </div>

                      <div>
                        <p className="text-base font-black text-slate-950 dark:text-white">{student.submissions}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-500">bài làm</p>
                      </div>

                      <div className="lg:text-right">
                        <p className="text-lg font-black text-blue-700 dark:text-blue-200">{student.points}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-500">điểm</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {rankedStudents.length <= 3 && (
                <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm font-bold text-slate-500 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
                  <Sparkles className="mx-auto mb-3 h-8 w-8 text-violet-300" />
                  Chưa đủ dữ liệu để hiển thị bảng chi tiết phía dưới.
                </div>
              )}
            </>
          )}
        </main>
      </section>
    </div>
  )
}

export default Leaderboard

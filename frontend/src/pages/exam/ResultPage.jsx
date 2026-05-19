import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '../../components/firebase'
import { getMyExamResultApi } from '../../api/examApi'
import GlassCard from '../../components/ui/GlassCard.jsx'
import GradientButton from '../../components/ui/GradientButton.jsx'

const normalizeRole = (value) => String(value || '').trim().toLowerCase()

const canManageExams = (value) => {
  const role = normalizeRole(value)

  return (
    role === 'teacher' ||
    role === 'admin user' ||
    role === 'admin_user' ||
    role === 'admin' ||
    role === 'admin dev' ||
    role === 'admin_dev'
  )
}

const waitForFirebaseUser = () => {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(auth.currentUser)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe()
      resolve(user)
    })
  })
}

const requestFullscreen = async () => {
  if (document.fullscreenElement) return

  if (document.documentElement.requestFullscreen) {
    await document.documentElement.requestFullscreen()
  }
}

const getSyncedDarkMode = () => {
  if (typeof window === 'undefined') return false

  const root = document.documentElement
  const body = document.body

  if (root.classList.contains('dark') || body.classList.contains('dark')) return true
  if (root.classList.contains('light') || body.classList.contains('light')) return false

  const storageKeys = ['theme', 'color-theme', 'vite-ui-theme', 'darkMode', 'dark-mode', 'mode']

  for (const key of storageKeys) {
    const value = window.localStorage.getItem(key)?.toLowerCase()

    if (['dark', 'true', '1', 'night'].includes(value)) return true
    if (['light', 'false', '0', 'day'].includes(value)) return false
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function useSyncedDarkMode() {
  const [isDark, setIsDark] = useState(getSyncedDarkMode)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncDarkMode = () => setIsDark(getSyncedDarkMode())
    const root = document.documentElement
    const body = document.body
    const observer = new MutationObserver(syncDarkMode)
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')

    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    if (body) observer.observe(body, { attributes: true, attributeFilter: ['class'] })

    window.addEventListener('storage', syncDarkMode)
    media?.addEventListener?.('change', syncDarkMode)
    syncDarkMode()

    return () => {
      observer.disconnect()
      window.removeEventListener('storage', syncDarkMode)
      media?.removeEventListener?.('change', syncDarkMode)
    }
  }, [])

  return isDark
}

function ResultPage() {
  const dark = useSyncedDarkMode()
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [role, setRole] = useState(null)
  const [studentId, setStudentId] = useState(null)
  const [exam, setExam] = useState(location.state?.exam ?? null)
  const [questions, setQuestions] = useState(location.state?.questions ?? [])
  const [latestResult, setLatestResult] = useState(location.state?.result ?? null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const isTeacher = canManageExams(role)

  useEffect(() => {
    let cancelled = false

    const fetchResult = async () => {
      try {
        setLoading(true)
        setNotFound(false)

        const user = await waitForFirebaseUser()

        if (!user?.uid) {
          if (!cancelled) {
            setNotFound(true)
            setLoading(false)
          }
          return
        }

        if (cancelled) return

        setStudentId(user.uid)

        const userSnap = await getDoc(doc(db, 'users', user.uid))
        const userRole = userSnap.exists() ? userSnap.data().role : null

        if (cancelled) return

        setRole(userRole)

        const examSnap = await getDoc(doc(db, 'exams', id))

        if (cancelled) return

        if (!examSnap.exists()) {
          setNotFound(true)
          return
        }

        const questionSnap = await getDocs(
          query(collection(db, 'exams', id, 'questions'), orderBy('order', 'asc')),
        )

        if (cancelled) return

        setExam({
          id: examSnap.id,
          ...examSnap.data(),
        })

        setQuestions(
          questionSnap.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })),
        )

        if (!canManageExams(userRole)) {
          const response = await getMyExamResultApi(id)

          if (cancelled) return

          setLatestResult(response.data?.result ?? location.state?.result ?? null)
        }
      } catch (error) {
        console.error(error)

        if (!cancelled) {
          setLatestResult(location.state?.result ?? null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchResult()

    return () => {
      cancelled = true
    }
  }, [id, location.state])

  const handleRetakeExam = async () => {
    try {
      await requestFullscreen()
    } catch (error) {
      console.warn('Không thể bật toàn màn hình:', error)
    }

    navigate(`/exam/${safeExam.id}`, {
      state: {
        role,
        studentId,
        forceFullscreen: true,
      },
    })
  }

  if (!loading && (notFound || !exam)) {
    return (
      <section className={`${dark ? 'dark ' : ''}min-h-screen bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-500 dark:bg-slate-950 dark:text-slate-300`}>
        Không tìm thấy kết quả
      </section>
    )
  }

  const safeExam = exam ?? {
    id,
    title: 'Kết quả bài thi',
  }

  const score = Number(latestResult?.score ?? 0)
  const wrongQuestions = latestResult?.wrongQuestions ?? []

  const answeredCount =
    latestResult?.answeredCount ??
    questions.filter((question) => {
      const type = question.type ?? 'multiple'

      if (type === 'essay' || type === 'code') {
        return String(latestResult?.textAnswers?.[question.id] ?? '').trim().length > 0
      }

      if (type === 'truefalse') {
        const value = latestResult?.answers?.[question.id]
        return value && typeof value === 'object' && Object.keys(value).length > 0
      }

      return latestResult?.answers?.[question.id] !== undefined
    }).length

  const totalMultipleAnswered = questions.filter(
    (question) => question.type === 'multiple' && latestResult?.answers?.[question.id] !== undefined,
  ).length

  const wrongCount = wrongQuestions.length
  const correctCount = Math.max(0, totalMultipleAnswered - wrongCount)
  const blankCount = Math.max(0, questions.length - answeredCount)

  const pieData = isTeacher
    ? [{ name: 'Không tính giáo viên', value: 1, color: '#94a3b8' }]
    : [
        { name: 'Điểm đạt được', value: score || 0.01, color: '#8b5cf6' },
        { name: 'Điểm còn thiếu', value: Math.max(0, 10 - score) || 0.01, color: '#e2e8f0' },
      ]

  return (
    <section className={`${dark ? 'dark ' : ''}relative min-h-screen bg-slate-50 px-4 py-10 text-slate-950 sm:px-6 lg:px-8 dark:bg-slate-950 dark:text-white`}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 grid gap-5 lg:grid-cols-[1fr_0.8fr] lg:items-stretch">
          <GlassCard className="relative overflow-hidden p-7">
            <div className="absolute inset-0 bg-[linear-gradient(130deg,rgba(139,92,246,0.14),transparent_48%,rgba(99,102,241,0.16))]" />

            <div className="relative z-10">
              <p className="mb-3 inline-flex items-center gap-2 rounded-lg bg-violet-400/15 px-4 py-2 text-sm font-bold text-violet-700 dark:text-violet-200">
                <Sparkles className="h-4 w-4" />
                {isTeacher ? 'Chế độ xem của giáo viên' : 'Kết quả bài làm'}
              </p>

              <h1 className="text-3xl font-black text-slate-950 dark:text-white md:text-5xl">
                {safeExam.title}
              </h1>

              {loading && (
                <p className="mt-4 rounded-2xl bg-blue-100 p-4 text-sm font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                  Đang đồng bộ kết quả...
                </p>
              )}

              {!latestResult && !isTeacher && !loading && (
                <p className="mt-4 rounded-2xl bg-amber-100 p-4 text-sm font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
                  Chưa tìm thấy kết quả bài làm của bạn. Hãy quay lại bài thi và nộp lại.
                </p>
              )}

              {isTeacher && (
                <p className="mt-4 rounded-2xl bg-violet-100 p-4 text-sm font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
                  Giáo viên không được làm bài như học sinh. Điểm giáo viên không được tính vào biểu đồ và thống kê.
                </p>
              )}

              <div className="mt-8 grid gap-4 sm:grid-cols-4">
                {[
                  [isTeacher ? '—' : score.toFixed(1), 'Điểm số'],
                  [isTeacher ? '—' : correctCount, 'Câu đúng'],
                  [isTeacher ? '—' : wrongCount, 'Câu sai'],
                  [isTeacher ? '—' : blankCount, 'Bỏ trống'],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-lg border border-white/60 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="text-3xl font-black text-slate-950 dark:text-white">{value}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-950 dark:text-white">Biểu đồ điểm số</h2>
              <Target className="h-6 w-6 text-violet-500" />
            </div>

            <div className="h-72 min-h-[288px] w-full min-w-0">
              <ResponsiveContainer width="100%" height={288}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={4}
                  >
                    {pieData.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <p className="text-center text-sm font-semibold text-slate-500">
              {isTeacher ? 'Không hiển thị điểm giáo viên trong thống kê.' : 'Biểu đồ chỉ tính kết quả học sinh.'}
            </p>
          </GlassCard>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <GlassCard className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <BrainCircuit className="h-7 w-7 text-violet-500" />
              <h2 className="text-2xl font-black text-slate-950 dark:text-white">Gợi ý cải thiện của giáo viên</h2>
            </div>

            <div className="space-y-4">
              {[
                ['Điểm mạnh', 'Nắm được kiến thức nền và hoàn thành tốt nhóm câu nhận biết.'],
                ['Cần cải thiện', 'Cần xem lại các câu sai và đối chiếu với đáp án đúng.'],
                ['Gợi ý tiếp theo', 'Luyện lại nhóm câu sai, sau đó làm lại bài tương tự trong thời gian giới hạn.'],
              ].map(([title, text]) => (
                <div key={title} className="rounded-lg border border-white/60 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="mb-1 flex items-center gap-2 font-bold text-slate-950 dark:text-white">
                    <Lightbulb className="h-4 w-4 text-violet-500" />
                    {title}
                  </p>

                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{text}</p>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <h2 className="mb-5 flex items-center gap-2 text-2xl font-black text-slate-950 dark:text-white">
              <ClipboardList className="h-6 w-6 text-violet-500" />
              Lịch sử lỗi sai
            </h2>

            <div className="space-y-3">
              {wrongQuestions.length ? (
                wrongQuestions.map((item, index) => (
                  <div key={index} className="rounded-lg border border-white/60 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-start gap-3">
                      <XCircle className="mt-1 h-5 w-5 text-orange-500" />

                      <div>
                        <p className="font-bold text-slate-950 dark:text-white">
                          Câu sai {index + 1}: {item.question}
                        </p>

                        <p className="mt-2 text-sm text-emerald-600">
                          Đáp án đúng: {item.correctAnswer}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {item.teacherNote || 'Giáo viên sẽ bổ sung lời giải thích cho câu hỏi này.'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-white/60 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-500" />

                    <div>
                      <p className="font-bold text-slate-950 dark:text-white">Không có câu sai</p>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        Học sinh chưa có lỗi sai trong kết quả hiện tại.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        <GlassCard className="mt-5 p-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            {!isTeacher && (
              <button type="button" onClick={handleRetakeExam} className="inline-flex">
                <GradientButton variant="subtle" icon={RotateCcw}>
                  Làm lại
                </GradientButton>
              </button>
            )}

            <Link to="/exams">
              <GradientButton icon={ArrowRight}>Về danh sách bài thi</GradientButton>
            </Link>
          </div>
        </GlassCard>
      </div>
    </section>
  )
}

export default ResultPage
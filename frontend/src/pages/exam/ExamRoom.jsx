import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Bookmark, ChevronLeft, ChevronRight, Flag, Send } from 'lucide-react'
import toast from 'react-hot-toast'
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
import { submitExamApi } from '../../api/examApi'
import AnswerOption from '../../components/exam/AnswerOption.jsx'
import QuestionNavigator from '../../components/exam/QuestionNavigator.jsx'
import SubmitModal from '../../components/exam/SubmitModal.jsx'
import TimerCard from '../../components/exam/TimerCard.jsx'
import GlassCard from '../../components/ui/GlassCard.jsx'
import GradientButton from '../../components/ui/GradientButton.jsx'

const labels = ['A', 'B', 'C', 'D']

const normalizeRole = (value) => String(value || '').trim().toLowerCase()

const isAdminRole = (value) => {
  const role = normalizeRole(value)
  return (
    role === 'teacher' ||
    role === 'admin user' ||
    role === 'admin_user' ||
    role === 'admin'
  )
}

const isAdminDevRole = (value) => {
  const role = normalizeRole(value)
  return role === 'admin dev' || role === 'admin_dev'
}

const canManageExams = (value) => isAdminRole(value) || isAdminDevRole(value)

const studentResultRoles = ['user', 'student']

const hasAnsweredValue = (value) => {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

const getAnsweredCount = (questions, answers, textAnswers) =>
  questions.filter((question) => {
    const type = question.type ?? 'multiple'

    if (type === 'essay' || type === 'code') {
      return hasAnsweredValue(textAnswers[question.id])
    }

    if (type === 'truefalse') {
      const value = answers[question.id]
      return value && typeof value === 'object' && Object.keys(value).length > 0
    }

    return answers[question.id] !== undefined
  }).length

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

function CodeBlock({ value, readOnly = false, onChange }) {
  return (
    <textarea
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange?.(event.target.value)}
      rows={8}
      className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 p-4 font-mono text-sm text-emerald-300 outline-none"
      placeholder="$ nhập code tại đây..."
    />
  )
}

function ExamRoom() {
  const dark = useSyncedDarkMode()
  const { id } = useParams()
  const navigate = useNavigate()

  const [role, setRole] = useState(null)
  const [studentId, setStudentId] = useState(null)
  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(Boolean(id))
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [textAnswers, setTextAnswers] = useState({})
  const [marked, setMarked] = useState([])
  const [submitOpen, setSubmitOpen] = useState(false)
  const [attemptCount, setAttemptCount] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const timerFinishedRef = useRef(false)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return undefined
    }

    let cancelled = false

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setLoading(true)

        if (!user?.uid) {
          toast.error('Bạn chưa đăng nhập')
          navigate('/exams')
          return
        }

        const userSnap = await getDoc(doc(db, 'users', user.uid))

        if (!userSnap.exists()) {
          toast.error('Không tìm thấy thông tin người dùng')
          navigate('/exams')
          return
        }

        const userRole = userSnap.data().role

        if (cancelled) return

        setRole(userRole)
        setStudentId(user.uid)

        const examSnap = await getDoc(doc(db, 'exams', id))

        if (!examSnap.exists()) {
          toast.error('Không tìm thấy bài thi')
          navigate('/exams')
          return
        }

        const questionSnap = await getDocs(
          query(collection(db, 'exams', id, 'questions'), orderBy('order', 'asc')),
        )

        const attemptSnap = await getDoc(doc(db, 'exams', id, 'attempts', user.uid))

        const resultSnap = await getDocs(collection(db, 'exams', id, 'results'))

        const studentResults = resultSnap.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .filter((item) => studentResultRoles.includes(normalizeRole(item.role)) && item.studentId === user.uid)
          .sort((a, b) => {
            const bTime = b.createdAt?.toMillis?.() ?? 0
            const aTime = a.createdAt?.toMillis?.() ?? 0
            return bTime - aTime
          })

        if (cancelled) return

        const examPayload = {
          id: examSnap.id,
          ...examSnap.data(),
        }

        setExam(examPayload)
        setSecondsLeft(Math.max(0, Number(examPayload.duration || 45) * 60))
        timerFinishedRef.current = false

        setQuestions(
          questionSnap.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })),
        )

        setAttemptCount(attemptSnap.exists() ? Number(attemptSnap.data().count || 0) : 0)
      } catch (error) {
        console.error(error)
        if (!cancelled) toast.error('Không thể tải bài thi')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [id, navigate])

  useEffect(() => {
    if (!exam?.id || !role) return undefined

    const durationSeconds = Math.max(0, Number(exam.duration || 45) * 60)
    setSecondsLeft((current) => (current > 0 ? current : durationSeconds))
    timerFinishedRef.current = false

    return undefined
  }, [exam?.id, exam?.duration, role])

  useEffect(() => {
    if (!exam?.id || !role || loading) return undefined
    if (canManageExams(role)) return undefined
    if (secondsLeft <= 0) return undefined

    const intervalId = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId)

          if (!timerFinishedRef.current) {
            timerFinishedRef.current = true
            setSubmitOpen(true)
            toast.error('Đã hết thời gian làm bài')
          }

          return 0
        }

        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [exam?.id, role, loading, secondsLeft])

  if (!id) return null

  if (loading || !role || !studentId) {
    return (
      <section className={`${dark ? 'dark ' : ''}min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8 dark:bg-slate-950`}>
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 h-28 animate-pulse rounded-2xl bg-white/75 shadow-sm dark:bg-white/5" />
          <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
            <div className="space-y-5">
              <div className="h-40 animate-pulse rounded-2xl bg-white/75 shadow-sm dark:bg-white/5" />
              <div className="h-72 animate-pulse rounded-2xl bg-white/75 shadow-sm dark:bg-white/5" />
            </div>
            <div className="h-[520px] animate-pulse rounded-2xl bg-white/75 shadow-sm dark:bg-white/5" />
          </div>
        </div>
      </section>
    )
  }

  if (!exam || !questions.length) {
    return (
      <section className={`${dark ? 'dark ' : ''}min-h-screen bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-500 dark:bg-slate-950 dark:text-slate-300`}>
        Bài thi chưa có câu hỏi
      </section>
    )
  }

  const isTeacher = canManageExams(role)
  const maxAttempts = exam.attemptMode === 'multiple' ? Number(exam.maxAttempts || 1) : 1
  const attemptsLeft = isTeacher ? Infinity : Math.max(0, maxAttempts - attemptCount)
  const isOutOfAttempts = !isTeacher && attemptsLeft <= 0

  const currentQuestion = questions[currentIndex]
  const questionType = currentQuestion.type ?? 'multiple'
  const options = currentQuestion.answers ?? []

  const answeredCount = getAnsweredCount(questions, answers, textAnswers)
  const answerProgress = Math.round((answeredCount / questions.length) * 100)
  const totalSeconds = Math.max(1, Number(exam.duration || 45) * 60)
  const timerProgress = Math.max(0, Math.min(100, Math.round((secondsLeft / totalSeconds) * 100)))

  const selectAnswer = (optionIndex) => {
    if (isTeacher) return

    if (isOutOfAttempts) {
      toast.error('Bạn đã hết số lượt làm bài thi này')
      return
    }

    setAnswers((value) => ({
      ...value,
      [currentQuestion.id]: optionIndex,
    }))
  }

  const toggleMarked = () => {
    setMarked((value) =>
      value.includes(currentQuestion.id)
        ? value.filter((questionId) => questionId !== currentQuestion.id)
        : [...value, currentQuestion.id],
    )
  }

  const confirmSubmit = async () => {
    if (submitting) return

    if (isTeacher) {
      toast.error('Giáo viên không được nộp bài như học sinh')
      return
    }

    if (isOutOfAttempts) {
      toast.error('Bạn đã hết số lượt làm bài thi này')
      navigate('/exams')
      return
    }

    try {
      setSubmitting(true)

      const response = await submitExamApi(exam.id, {
        answers,
        textAnswers,
      })

      toast.success('Đã nộp bài thi')

      navigate(`/exam/${exam.id}/result`, {
        state: {
          role,
          studentId,
          submitted: true,
          result: response.data,
        },
      })
    } catch (error) {
      console.error(error)

      toast.error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          'Nộp bài thi thất bại',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className={`${dark ? 'dark ' : ''}min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8 dark:bg-slate-950 dark:text-white`}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/60 bg-white/75 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link to="/exams" className="text-sm font-bold text-cyan-700 hover:text-cyan-500 dark:text-cyan-200">
              ← Quay lại danh sách bài thi
            </Link>

            <h1 className="mt-2 text-2xl font-black text-slate-950 dark:text-white md:text-3xl">{exam.title}</h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {exam.subject} • {questions.length} câu • {exam.duration} phút
            </p>

            {!isTeacher && (
              <p
                className={`mt-2 rounded-xl px-3 py-2 text-sm font-bold ${
                  isOutOfAttempts
                    ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200'
                    : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-200'
                }`}
              >
                {isOutOfAttempts ? 'Bạn đã hết số lượt làm bài thi này.' : `Số lượt còn lại: ${attemptsLeft}`}
              </p>
            )}

            {isTeacher && (
              <p className="mt-2 rounded-xl bg-violet-100 px-3 py-2 text-sm font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
                Giáo viên chỉ đang xem bài. Kết quả không được tính vào thống kê.
              </p>
            )}
          </div>

          <div className="min-w-64">
            <div className="mb-2 flex justify-between text-sm font-semibold">
              <span className="text-slate-500 dark:text-slate-400">Tiến độ bài làm</span>
              <span className="text-cyan-700 dark:text-cyan-200">{answerProgress}%</span>
            </div>

            <div className="h-2 overflow-hidden rounded bg-slate-200 dark:bg-white/10">
              <span className="block h-full rounded bg-gradient-to-r from-cyan-300 to-blue-600" style={{ width: `${answerProgress}%` }} />
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <TimerCard secondsLeft={secondsLeft} totalSeconds={totalSeconds} progress={timerProgress} />

            <QuestionNavigator
              questions={questions}
              currentIndex={currentIndex}
              answers={answers}
              textAnswers={textAnswers}
              marked={marked}
              onSelect={setCurrentIndex}
            />
          </aside>

          <GlassCard className="p-5 sm:p-7" initial={false} whileInView={false}>
            <div className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-300">
                  Câu {currentIndex + 1}/{questions.length}
                </p>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{exam.subject}</p>
              </div>

              <button
                type="button"
                onClick={toggleMarked}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold transition ${
                  marked.includes(currentQuestion.id)
                    ? 'border-orange-300 bg-orange-400/10 text-orange-500'
                    : 'border-cyan-300/35 text-cyan-700 hover:bg-cyan-400/10 dark:text-cyan-200'
                }`}
              >
                <Flag className="h-4 w-4" />
                Đánh dấu
              </button>
            </div>

            <h2 className="text-xl font-bold leading-8 text-slate-950 dark:text-white md:text-2xl">
              {currentQuestion.question}
            </h2>

            {questionType === 'code' && (
              <div className="mt-7 space-y-4">
                {isTeacher && <CodeBlock value={currentQuestion.code ?? ''} readOnly />}

                <CodeBlock
                  value={textAnswers[currentQuestion.id] ?? ''}
                  readOnly={isTeacher || isOutOfAttempts}
                  onChange={(value) => {
                    if (isTeacher) return

                    if (isOutOfAttempts) {
                      toast.error('Bạn đã hết số lượt làm bài thi này')
                      return
                    }

                    setTextAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }))
                  }}
                />

                <label
                  className={`inline-flex rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-bold text-slate-600 dark:border-white/10 dark:text-white ${
                    isTeacher || isOutOfAttempts ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  }`}
                >
                  Tải file lên
                  <input type="file" disabled={isTeacher || isOutOfAttempts} className="hidden" />
                </label>
              </div>
            )}

            {questionType === 'essay' && (
              <textarea
                value={textAnswers[currentQuestion.id] ?? ''}
                disabled={isTeacher || isOutOfAttempts}
                onChange={(event) => setTextAnswers((prev) => ({ ...prev, [currentQuestion.id]: event.target.value }))}
                rows={8}
                className="mt-7 w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white"
                placeholder="Nhập câu trả lời tự luận..."
              />
            )}

            {questionType === 'truefalse' && (
              <div className="mt-7 grid gap-3">
                {options.map((option, index) => (
                  <div key={option.id ?? index} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="font-bold text-slate-900 dark:text-white">{option.content}</p>

                    <div className="mt-3 flex gap-2">
                      {['Đúng', 'Sai'].map((item) => (
                        <button
                          key={item}
                          type="button"
                          disabled={isTeacher || isOutOfAttempts}
                          onClick={() => {
                            if (isOutOfAttempts) {
                              toast.error('Bạn đã hết số lượt làm bài thi này')
                              return
                            }

                            setAnswers((prev) => ({
                              ...prev,
                              [currentQuestion.id]: {
                                ...(prev[currentQuestion.id] ?? {}),
                                [index]: item,
                              },
                            }))
                          }}
                          className={`rounded-xl px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60 ${
                            answers[currentQuestion.id]?.[index] === item
                              ? 'bg-violet-600 text-white'
                              : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white'
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {questionType !== 'code' && questionType !== 'essay' && questionType !== 'truefalse' && (
              <div className="mt-7 grid gap-3">
                {options.map((option, index) => (
                  <AnswerOption
                    key={option.id ?? index}
                    label={labels[index] ?? String(index + 1)}
                    value={option.content}
                    selected={answers[currentQuestion.id] === index}
                    onClick={() => selectAnswer(index)}
                  />
                ))}
              </div>
            )}

            <div className="mt-8 grid gap-3 border-t border-slate-200 pt-6 dark:border-white/10 sm:grid-cols-2 lg:grid-cols-[auto_1fr_auto_auto] lg:items-center">
              <GradientButton
                variant="subtle"
                icon={ChevronLeft}
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}
                className={currentIndex === 0 ? 'opacity-50' : ''}
              >
                Câu trước
              </GradientButton>

              <button
                type="button"
                onClick={toggleMarked}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/10"
              >
                <Bookmark className="h-4 w-4" />
                Lưu để xem lại
              </button>

              <GradientButton
                variant="subtle"
                icon={ChevronRight}
                onClick={() => setCurrentIndex((value) => Math.min(questions.length - 1, value + 1))}
              >
                Câu tiếp
              </GradientButton>

              {!isTeacher && (
                <GradientButton
                  icon={Send}
                  disabled={isOutOfAttempts || submitting}
                  onClick={() => {
                    if (isOutOfAttempts) {
                      toast.error('Bạn đã hết số lượt làm bài thi này')
                      return
                    }

                    setSubmitOpen(true)
                  }}
                  className={isOutOfAttempts || submitting ? 'opacity-50' : ''}
                >
                  {submitting ? 'Đang nộp...' : 'Nộp bài'}
                </GradientButton>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      <SubmitModal
        open={submitOpen}
        answered={answeredCount}
        total={questions.length}
        onClose={() => {
          if (!submitting) setSubmitOpen(false)
        }}
        onConfirm={confirmSubmit}
      />
    </section>
  )
}

export default ExamRoom
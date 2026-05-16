import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Bookmark, ChevronLeft, ChevronRight, Flag, Send, X } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { auth, db } from '../../components/firebase'
import AnswerOption from '../../components/exam/AnswerOption.jsx'
import QuestionNavigator from '../../components/exam/QuestionNavigator.jsx'
import SubmitModal from '../../components/exam/SubmitModal.jsx'
import TimerCard from '../../components/exam/TimerCard.jsx'
import GlassCard from '../../components/ui/GlassCard.jsx'
import GradientButton from '../../components/ui/GradientButton.jsx'

const labels = ['A', 'B', 'C', 'D']

const normalizeRole = (value) => String(value || '').trim().toLowerCase()
const isStudentRole = (value) => normalizeRole(value) === 'user' || normalizeRole(value) === 'student'
const isAdminRole = (value) =>
  normalizeRole(value) === 'admin user' ||
  normalizeRole(value) === 'admin_user' ||
  normalizeRole(value) === 'admin' ||
  normalizeRole(value) === 'teacher'
const isAdminDevRole = (value) => normalizeRole(value) === 'admin dev' || normalizeRole(value) === 'admin_dev'
const canManageExams = (value) => isAdminRole(value) || isAdminDevRole(value)
const studentResultRoles = ['user', 'student']

function StartAttemptModal({ role, attemptsLeft, lastScore, onContinue, onBack }) {
  const isTeacher = canManageExams(role)
  const outOfAttempts = !isTeacher && attemptsLeft <= 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-950">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-950 dark:text-white">
            {outOfAttempts ? 'Đã hết lượt làm bài' : isTeacher ? 'Chế độ giáo viên' : 'Thông tin bài làm'}
          </h2>

          <button onClick={onBack} className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-white/10">
            <X className="h-5 w-5 dark:text-white" />
          </button>
        </div>

        {isTeacher ? (
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            Giáo viên chỉ được xem bài kiểm tra. Giáo viên không được làm bài như học sinh và không được tính vào thống kê.
          </p>
        ) : (
          <>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
              <p className="text-sm font-semibold text-slate-500">Điểm hiện tại</p>
              <p className="mt-2 text-4xl font-black text-slate-950 dark:text-white">{lastScore ?? 'Chưa có'}</p>
            </div>

            <p className="mt-4 text-sm font-semibold text-slate-500">Số lượt còn lại: {attemptsLeft}</p>
          </>
        )}

        <div className="mt-6 flex gap-3">
          {!outOfAttempts && (
            <button
              onClick={onContinue}
              className="flex-1 rounded-2xl bg-violet-600 px-5 py-3 font-bold text-white"
            >
              {isTeacher ? 'Xem bài' : 'Làm tiếp'}
            </button>
          )}

          <button
            onClick={onBack}
            className="flex-1 rounded-2xl bg-slate-100 px-5 py-3 font-bold text-slate-700 dark:bg-white/10 dark:text-white"
          >
            Quay lại
          </button>
        </div>
      </div>
    </div>
  )
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
  const { id } = useParams()
  const navigate = useNavigate()

  const [role, setRole] = useState(null)
  const [studentId, setStudentId] = useState(null)
  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [textAnswers, setTextAnswers] = useState({})
  const [marked, setMarked] = useState([])
  const [submitOpen, setSubmitOpen] = useState(false)
  const [startOpen, setStartOpen] = useState(true)
  const [attemptCount, setAttemptCount] = useState(0)
  const [lastScore, setLastScore] = useState(null)

  useEffect(() => {
    const fetchExam = async () => {
      try {
        setLoading(true)

const user = auth.currentUser

        if (!user) {
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
        setRole(userRole)
        setStudentId(user.uid)

        const examSnap = await getDoc(doc(db, 'exams', id))

        if (!examSnap.exists()) {
          toast.error('Không tìm thấy bài kiểm tra')
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

        setAttemptCount(attemptSnap.exists() ? Number(attemptSnap.data().count || 0) : 0)
        setLastScore(studentResults[0]?.score ?? null)
      } catch (error) {
        console.error(error)
        toast.error('Không thể tải bài kiểm tra')
      } finally {
        setLoading(false)
      }
    }

    fetchExam()
  }, [id, navigate])

  if (loading || !role || !studentId) {
    return (
      <section className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
        Đang tải bài làm...
      </section>
    )
  }

  if (!exam || !questions.length) {
    return (
      <section className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
        Bài kiểm tra chưa có câu hỏi
      </section>
    )
  }

  const isTeacher = canManageExams(role)
  const maxAttempts = exam.attemptMode === 'multiple' ? Number(exam.maxAttempts || 1) : 1
  const attemptsLeft = isTeacher ? Infinity : Math.max(0, maxAttempts - attemptCount)
  const currentQuestion = questions[currentIndex]
  const progress = Math.round((Object.keys(answers).length / questions.length) * 100)
  const displayedQuestions = questions

  const selectAnswer = (optionIndex) => {
    if (isTeacher) return
    setAnswers((value) => ({ ...value, [currentQuestion.id]: optionIndex }))
  }

  const toggleMarked = () => {
    setMarked((value) =>
      value.includes(currentQuestion.id)
        ? value.filter((questionId) => questionId !== currentQuestion.id)
        : [...value, currentQuestion.id],
    )
  }

  const confirmSubmit = async () => {
    if (isTeacher) {
      toast.error('Giáo viên không được nộp bài như học sinh')
      return
    }

    try {
      const wrongQuestions = questions
        .filter((question) => {
          if (question.type !== 'multiple') return false

          const selectedIndex = answers[question.id]
          const correctIndex = question.answers?.findIndex((answer) => answer.isCorrect)

          return selectedIndex !== correctIndex
        })
        .map((question) => ({
          question: question.question,
          correctAnswer: question.answers?.find((answer) => answer.isCorrect)?.content ?? 'Đang cập nhật',
          teacherNote: question.explanation ?? '',
        }))

      const multipleQuestions = questions.filter((question) => question.type === 'multiple')
      const correctCount = multipleQuestions.length - wrongQuestions.length
      const score = multipleQuestions.length ? Number(((correctCount / multipleQuestions.length) * 10).toFixed(1)) : 0

      await addDoc(collection(db, 'exams', exam.id, 'results'), {
        studentId,
        role,
        score,
        answers,
        textAnswers,
        wrongQuestions,
        createdAt: serverTimestamp(),
      })

      await setDoc(
        doc(db, 'exams', exam.id, 'attempts', studentId),
        {
          studentId,
          count: attemptCount + 1,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )

      toast.success('Đã nộp bài')
      navigate(`/exam/${exam.id}/result`, { state: { role, studentId } })
    } catch (error) {
      console.error(error)
      toast.error('Nộp bài thất bại')
    }
  }

  const questionType = currentQuestion.type ?? 'multiple'
  const options = currentQuestion.answers ?? []

  return (
    <section className="px-4 py-8 sm:px-6 lg:px-8">
      {startOpen && (
        <StartAttemptModal
          role={role}
          attemptsLeft={attemptsLeft}
          lastScore={lastScore}
          onContinue={() => setStartOpen(false)}
          onBack={() => navigate('/exams')}
        />
      )}

      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/60 bg-white/75 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link to="/exams" className="text-sm font-bold text-cyan-700 hover:text-cyan-500 dark:text-cyan-200">
              ← Quay lại danh sách bài kiểm tra
            </Link>

            <h1 className="mt-2 text-2xl font-black text-slate-950 dark:text-white md:text-3xl">{exam.title}</h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {exam.subject} • {questions.length} câu • {exam.duration} phút
            </p>

            {isTeacher && (
              <p className="mt-2 rounded-xl bg-violet-100 px-3 py-2 text-sm font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
                Giáo viên chỉ đang xem bài. Kết quả không được tính vào thống kê.
              </p>
            )}
          </div>

          <div className="min-w-64">
            <div className="mb-2 flex justify-between text-sm font-semibold">
              <span className="text-slate-500 dark:text-slate-400">Tiến độ bài làm</span>
              <span className="text-cyan-700 dark:text-cyan-200">{progress}%</span>
            </div>

            <div className="h-2 overflow-hidden rounded bg-slate-200 dark:bg-white/10">
              <span className="block h-full rounded bg-gradient-to-r from-cyan-300 to-blue-600" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <TimerCard minutesLeft={Number(exam.duration || 45)} progress={52} />

            <QuestionNavigator
              questions={displayedQuestions}
              currentIndex={currentIndex}
              answers={answers}
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
                <CodeBlock value={currentQuestion.code ?? ''} readOnly />

                <CodeBlock
                  value={textAnswers[currentQuestion.id] ?? ''}
                  onChange={(value) => !isTeacher && setTextAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }))}
                />

                <label className="inline-flex cursor-pointer rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-bold text-slate-600 dark:border-white/10 dark:text-white">
                  Tải file lên
                  <input type="file" disabled={isTeacher} className="hidden" />
                </label>
              </div>
            )}

            {questionType === 'essay' && (
              <textarea
                value={textAnswers[currentQuestion.id] ?? ''}
                disabled={isTeacher}
                onChange={(event) => setTextAnswers((prev) => ({ ...prev, [currentQuestion.id]: event.target.value }))}
                rows={8}
                className="mt-7 w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
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
                          disabled={isTeacher}
                          onClick={() =>
                            setAnswers((prev) => ({
                              ...prev,
                              [currentQuestion.id]: {
                                ...(prev[currentQuestion.id] ?? {}),
                                [index]: item,
                              },
                            }))
                          }
                          className={`rounded-xl px-4 py-2 text-sm font-bold ${
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
                <GradientButton icon={Send} onClick={() => setSubmitOpen(true)}>
                  Nộp bài
                </GradientButton>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      <SubmitModal
        open={submitOpen}
        answered={Object.keys(answers).length}
        total={questions.length}
        onClose={() => setSubmitOpen(false)}
        onConfirm={confirmSubmit}
      />
    </section>
  )
}

export default ExamRoom
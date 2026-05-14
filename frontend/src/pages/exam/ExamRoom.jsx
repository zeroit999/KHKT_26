import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Bookmark, ChevronLeft, ChevronRight, Flag, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { exams, questions } from '../../data/mockData.js'
import AnswerOption from '../../components/exam/AnswerOption.jsx'
import QuestionNavigator from '../../components/exam/QuestionNavigator.jsx'
import SubmitModal from '../../components/exam/SubmitModal.jsx'
import TimerCard from '../../components/exam/TimerCard.jsx'
import GlassCard from '../../components/ui/GlassCard.jsx'
import GradientButton from '../../components/ui/GradientButton.jsx'

const labels = ['A', 'B', 'C', 'D']

function ExamRoom() {
  const { id } = useParams()
  const navigate = useNavigate()
  const exam = useMemo(() => exams.find((item) => item.id === id) ?? exams[0], [id])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({ 1: 0, 2: 2 })
  const [marked, setMarked] = useState([3])
  const [submitOpen, setSubmitOpen] = useState(false)
  const currentQuestion = questions[currentIndex]
  const progress = Math.round((Object.keys(answers).length / questions.length) * 100)

  const selectAnswer = (optionIndex) => {
    setAnswers((value) => ({ ...value, [currentQuestion.id]: optionIndex }))
  }

  const toggleMarked = () => {
    setMarked((value) =>
      value.includes(currentQuestion.id)
        ? value.filter((questionId) => questionId !== currentQuestion.id)
        : [...value, currentQuestion.id],
    )
  }

  const confirmSubmit = () => {
    toast.success('Đã nộp bài trong giao diện mô phỏng')
    navigate(`/exam/${exam.id}/result`)
  }

  return (
    <section className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 rounded-lg border border-white/60 bg-white/75 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link to="/exams" className="text-sm font-bold text-cyan-700 hover:text-cyan-500 dark:text-cyan-200">
              ← Quay lại kho đề
            </Link>
            <h1 className="mt-2 text-2xl font-black text-slate-950 dark:text-white md:text-3xl">{exam.title}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {exam.subject} • {exam.questions} câu • {exam.duration} phút
            </p>
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
            <TimerCard minutesLeft={42} progress={52} />
            <QuestionNavigator
              questions={questions}
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
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{currentQuestion.subject}</p>
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

            <h2 className="text-xl font-bold leading-8 text-slate-950 dark:text-white md:text-2xl">{currentQuestion.question}</h2>
            <div className="mt-7 grid gap-3">
              {currentQuestion.options.map((option, index) => (
                <AnswerOption
                  key={option}
                  label={labels[index]}
                  value={option}
                  selected={answers[currentQuestion.id] === index}
                  onClick={() => selectAnswer(index)}
                />
              ))}
            </div>

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
              <GradientButton icon={Send} onClick={() => setSubmitOpen(true)}>
                Nộp bài
              </GradientButton>
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

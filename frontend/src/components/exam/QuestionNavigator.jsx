import { Flag } from 'lucide-react'
import GlassCard from '../ui/GlassCard.jsx'

function QuestionNavigator({ questions, currentIndex, answers, marked, onSelect }) {
  return (
    <GlassCard className="p-4" initial={false} whileInView={false}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-slate-950 dark:text-white">Danh sách câu hỏi</h2>
        <span className="text-sm font-semibold text-cyan-700 dark:text-cyan-200">
          {Object.keys(answers).length}/{questions.length}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2 lg:grid-cols-4 xl:grid-cols-5">
        {questions.map((question, index) => {
          const isCurrent = index === currentIndex
          const isAnswered = answers[question.id] !== undefined
          const isMarked = marked.includes(question.id)

          return (
            <button
              key={question.id}
              type="button"
              onClick={() => onSelect(index)}
              className={`relative flex aspect-square items-center justify-center rounded-lg text-sm font-black transition ${
                isCurrent
                  ? 'bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-[0_12px_28px_rgba(14,165,233,0.32)]'
                  : isAnswered
                    ? 'bg-cyan-400/15 text-cyan-700 dark:text-cyan-100'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15'
              }`}
            >
              {index + 1}
              {isMarked ? <Flag className="absolute -right-1 -top-1 h-3.5 w-3.5 fill-orange-400 text-orange-400" /> : null}
            </button>
          )
        })}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded bg-cyan-400" />
          Đang làm
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded bg-cyan-400/30" />
          Đã chọn
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded bg-slate-300 dark:bg-white/20" />
          Trống
        </span>
      </div>
    </GlassCard>
  )
}

export default QuestionNavigator

import { getAnswerDisplayValue } from '../../utils/examHelpers'

function StudentAnswers({ exam, result }) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
      <p className="mb-3 text-sm font-black text-blue-700 dark:text-blue-200">
        Bài học sinh đã làm
      </p>

      <div className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {(exam.questions ?? []).map((question, questionIndex) => (
          <div
            key={question.id ?? questionIndex}
            className="rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-slate-900"
          >
            <span className="font-black text-slate-950 dark:text-white">
              Câu {questionIndex + 1}:{' '}
            </span>
            <span>{getAnswerDisplayValue(question, result)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default StudentAnswers

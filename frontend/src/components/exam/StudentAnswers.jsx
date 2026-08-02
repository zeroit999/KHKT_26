const getSubmittedAnswer = (question, result) => {
  if (question.type === 'essay' || question.type === 'code' || question.type === 'short-answer') {
    return result?.textAnswers?.[question.id] || 'Chưa trả lời'
  }

  if (question.type === 'truefalse') {
    const values = result?.answers?.[question.id]
    if (!values || typeof values !== 'object') return 'Chưa trả lời'
    return (question.answers || []).map((_, index) => {
      const value = values[index] ?? values[String(index)]
      return `${String.fromCharCode(97 + index)}) ${value === true ? 'Đúng' : value === false ? 'Sai' : '—'}`
    }).join(' · ')
  }

  const selectedIndex = result?.answers?.[question.id]
  if (selectedIndex === undefined || selectedIndex === null) return 'Chưa trả lời'
  const answer = question.answers?.[Number(selectedIndex)]
  const content = typeof answer === 'string' ? answer : answer?.content
  return `${String.fromCharCode(65 + Number(selectedIndex))}. ${content || ''}`.trim()
}

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
            <span>{getSubmittedAnswer(question, result)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default StudentAnswers

import { X } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

function StatsModal({ open, onClose, exams }) {
  if (!open) return null

  const studentResults = exams.flatMap((exam) => exam.studentResults ?? [])
  const average = studentResults.length
    ? (studentResults.reduce((total, result) => total + Number(result.score || 0), 0) / studentResults.length).toFixed(1)
    : '0.0'

  const pieData = [
    { name: '0 - 5', value: studentResults.filter((item) => item.score < 5).length || 1, color: '#ef4444' },
    { name: '5 - 8', value: studentResults.filter((item) => item.score >= 5 && item.score < 8).length || 1, color: '#8b5cf6' },
    { name: '8 - 10', value: studentResults.filter((item) => item.score >= 8).length || 1, color: '#22c55e' },
  ]

  const wrongQuestions = studentResults.flatMap((result) => result.wrongQuestions ?? [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-950">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950 dark:text-white">Thống kê chi tiết</h2>
            <p className="text-sm text-slate-500">Điểm trung bình học sinh: {average}</p>
          </div>

          <button onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-white/10">
            <X className="h-5 w-5 dark:text-white" />
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="h-72 min-h-[288px] w-full min-w-0 rounded-3xl bg-slate-50 p-4 dark:bg-white/5">
            <ResponsiveContainer width="100%" height={288}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92}>
                  {pieData.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            <h3 className="font-black text-slate-950 dark:text-white">Lịch sử lỗi sai</h3>

            {wrongQuestions.length ? (
              wrongQuestions.map((item, index) => (
                <div key={index} className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                  <p className="font-bold text-slate-900 dark:text-white">{item.question}</p>
                  <p className="mt-1 text-sm text-emerald-600">Đáp án đúng: {item.correctAnswer}</p>
                  <p className="mt-1 text-sm text-slate-500">Gợi ý: {item.teacherNote}</p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-white/5">
                Chưa có lỗi sai nào.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const getStudentDisplayName = (result = {}) => {
  const name =
    result.studentName ||
    result.studentDisplayName ||
    result.displayName ||
    result.fullName ||
    result.name ||
    result.studentEmail ||
    result.email

  return String(name || '').trim() || 'Tên học sinh'
}

const getAnswerDisplayValue = (question, result = {}) => {
  const type = question.type ?? 'multiple'

  if (type === 'essay' || type === 'code') {
    const value = result.textAnswers?.[question.id]
    return String(value || '').trim() || 'Chưa trả lời'
  }

  const value = result.answers?.[question.id]

  if (type === 'truefalse') {
    if (!value || typeof value !== 'object') return 'Chưa trả lời'

    return (question.answers ?? [])
      .map((answer, index) => `${index + 1}. ${value[index] || 'Chưa chọn'}`)
      .join('; ')
  }

  if (value === undefined || value === null) return 'Chưa trả lời'

  if (typeof value === 'number') {
    return labels[value] ?? String(value + 1)
  }

  return String(value)
}

export default StatsModal

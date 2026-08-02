import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { getExamDetailApi, getMyExamResultApi } from '../../api/examApi'

const getAnswerText = (question, result) => {
  const questionId = question.id

  if (question.type === 'essay' || question.type === 'code' || question.type === 'short-answer') {
    return result?.textAnswers?.[questionId] || 'Chưa trả lời'
  }

  if (question.type === 'truefalse') {
    const selected = result?.answers?.[questionId]
    if (!selected || typeof selected !== 'object') return 'Chưa trả lời'

    return (question.answers || []).map((_, index) => {
      const value = selected[index] ?? selected[String(index)]
      return `${String.fromCharCode(97 + index)}) ${value === true ? 'Đúng' : value === false ? 'Sai' : '—'}`
    }).join(' · ')
  }

  const selectedIndex = result?.answers?.[questionId]
  if (selectedIndex === undefined || selectedIndex === null) return 'Chưa trả lời'
  const answer = question.answers?.[Number(selectedIndex)]
  const content = typeof answer === 'string' ? answer : answer?.content
  return `${String.fromCharCode(65 + Number(selectedIndex))}. ${content || ''}`.trim()
}

function ResultPage() {
  const { id } = useParams()
  const location = useLocation()
  const [exam, setExam] = useState(location.state?.exam ?? null)
  const [result, setResult] = useState(location.state?.result ?? null)
  const [loading, setLoading] = useState(!exam || !result)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadResult = async () => {
      try {
        const [examResponse, resultResponse] = await Promise.all([
          exam ? Promise.resolve(null) : getExamDetailApi(id),
          result ? Promise.resolve(null) : getMyExamResultApi(id),
        ])

        if (cancelled) return
        if (examResponse) setExam(examResponse.data?.exam ?? null)
        if (resultResponse) setResult(resultResponse.data?.result ?? null)
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError?.response?.data?.message || loadError.message || 'Không thể tải kết quả')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadResult()
    return () => {
      cancelled = true
    }
  }, [exam, id, result])

  const summary = useMemo(() => {
    const total = Number(result?.totalQuestions ?? exam?.questions?.length ?? 0)
    const answered = Number(result?.answeredCount ?? 0)
    const pending = (exam?.questions || []).filter(
      (question) =>
        (question.type === 'essay' || question.type === 'code') &&
        String(result?.textAnswers?.[question.id] || '').trim(),
    ).length
    const autoGradedAnswered = Math.max(0, answered - pending)
    const wrong = Math.min(
      autoGradedAnswered,
      Number(result?.wrongCount ?? result?.wrongQuestions?.length ?? 0),
    )
    return {
      total,
      answered,
      wrong,
      correct: Math.max(0, autoGradedAnswered - wrong),
      blank: Math.max(0, total - answered),
      pending,
    }
  }, [exam, result])

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-black text-slate-500 dark:bg-slate-950 dark:text-slate-300">Đang tải kết quả...</div>
  }

  if (error || !exam || !result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="max-w-lg rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl dark:border-red-500/20 dark:bg-slate-900">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
          <p className="mt-4 font-black text-red-600 dark:text-red-300">{error || 'Không tìm thấy kết quả bài làm'}</p>
          <Link to="/exams" className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white">Về kho đề</Link>
        </div>
      </div>
    )
  }

  return (
    <section className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-white sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-[30px] bg-gradient-to-br from-blue-600 to-indigo-700 p-7 text-white shadow-xl sm:p-9">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-100">Kết quả bài làm</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">{exam.title}</h1>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {[
              [`${Number(result.score || 0).toFixed(2)}/10`, 'Điểm'],
              [summary.answered, 'Đã trả lời'],
              [summary.correct, 'Câu đúng'],
              [summary.wrong, 'Câu sai'],
              [summary.blank, 'Bỏ trống'],
              [summary.pending, 'Chờ chấm'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl bg-white/12 p-4 backdrop-blur-sm">
                <p className="text-2xl font-black">{value}</p>
                <p className="mt-1 text-xs font-bold text-blue-100">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {location.state?.autoSubmit && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm font-bold">Bài đã được tự động nộp sau khi đạt ngưỡng {location.state?.violations ?? result.proctoringViolations ?? 0} vi phạm.</p>
          </div>
        )}

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-black">Chi tiết câu trả lời</h2>
          </div>

          <div className="mt-5 space-y-4">
            {(exam.questions || []).map((question, index) => {
              const wrongItem = (result.wrongQuestions || []).find(
                (item) => item.question === question.question,
              )
              const awaitsManualGrading =
                (question.type === 'essay' || question.type === 'code') &&
                String(result?.textAnswers?.[question.id] || '').trim()

              return (
                <article key={question.id ?? index} className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
                  <div className="flex items-start gap-3">
                    {wrongItem ? (
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                    ) : awaitsManualGrading ? (
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                    )}
                    <div className="min-w-0">
                      <p className="font-black">Câu {index + 1}: {String(question.question || '').replace(/<[^>]+>/g, '')}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">Bài làm: {getAnswerText(question, result)}</p>
                      {awaitsManualGrading && <p className="mt-2 text-sm font-bold text-amber-600">Đang chờ giáo viên chấm</p>}
                      {wrongItem && <p className="mt-2 text-sm font-bold text-emerald-600">Đáp án đúng: {wrongItem.correctAnswer || 'Xem hướng dẫn chấm'}</p>}
                      {wrongItem?.teacherNote && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{wrongItem.teacherNote}</p>}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to="/exams" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-white">
            <ArrowLeft className="h-4 w-4" /> Về kho đề
          </Link>
          <Link to={`/exam/${id}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white">
            <RotateCcw className="h-4 w-4" /> Làm lại
          </Link>
        </div>
      </div>
    </section>
  )
}

export default ResultPage

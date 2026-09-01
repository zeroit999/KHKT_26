import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
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

const formatReviewTime = (value) => {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function ResultPage() {
  const { id } = useParams()
  const location = useLocation()
  const [exam, setExam] = useState(location.state?.exam ?? null)
  const [result, setResult] = useState(location.state?.result ?? null)
  const [review, setReview] = useState(location.state?.review ?? null)
  const [loading, setLoading] = useState(!exam || !result || !review)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadResult = async () => {
      try {
        const [examResponse, resultResponse] = await Promise.all([
          exam ? Promise.resolve(null) : getExamDetailApi(id),
          (!result || !review) ? getMyExamResultApi(id) : Promise.resolve(null),
        ])

        if (cancelled) return

        if (examResponse) {
          setExam(examResponse.data?.exam ?? null)

          if (!review && examResponse.data?.review) {
            setReview(examResponse.data.review)
          }
        }

        if (resultResponse) {
          setResult(resultResponse.data?.result ?? null)
          setReview(resultResponse.data?.review ?? null)
        }
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
  }, [exam, id, result, review])

  const summary = useMemo(() => {
    const total = Number(result?.totalQuestions ?? exam?.questions?.length ?? 0)
    const answered = Number(result?.answeredCount ?? 0)
    const pending = (exam?.questions || []).filter(
      (question) =>
        (question.type === 'essay' || question.type === 'code') &&
        String(result?.textAnswers?.[question.id] || '').trim(),
    ).length

    const canReviewAnswers = review?.allowed === true

    return {
      total,
      answered,
      wrong: canReviewAnswers ? Number(result?.wrongCount ?? 0) : null,
      correct: canReviewAnswers ? Number(result?.correctCount ?? 0) : null,
      blank: Math.max(0, total - answered),
      pending,
    }
  }, [exam, result, review])

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
              [summary.correct ?? '—', 'Câu đúng'],
              [summary.wrong ?? '—', 'Câu sai'],
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

        {review?.allowed === true ? (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-black">Đang trong thời gian xem đáp án</p>
              <p className="mt-1 text-sm font-semibold opacity-80">
                Bạn có thể xem kết quả đúng/sai, đáp án đúng và lời giải của giáo viên.
                {review.endAt ? ` Thời gian xem kết thúc lúc ${formatReviewTime(review.endAt)}.` : ''}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-black">
                {review?.status === 'not_started'
                  ? 'Chưa đến thời gian xem đáp án'
                  : review?.status === 'expired'
                    ? 'Đã hết thời gian xem đáp án'
                    : review?.status === 'invalid'
                      ? 'Chưa thể xem đáp án'
                      : 'Giáo viên chưa cho phép xem đáp án'}
              </p>

              <p className="mt-1 text-sm font-semibold opacity-80">
                {review?.status === 'not_started' && review?.startAt
                  ? `Bạn có thể xem đáp án từ ${formatReviewTime(review.startAt)}. Hiện tại bạn vẫn có thể xem lại bài làm của mình.`
                  : review?.status === 'expired'
                    ? 'Bạn vẫn có thể xem lại câu trả lời của mình, nhưng đáp án đúng và lời giải đã được ẩn.'
                    : review?.status === 'invalid'
                      ? 'Cấu hình thời gian xem đáp án chưa hợp lệ. Bạn vẫn có thể xem lại bài làm của mình.'
                      : 'Bạn vẫn có thể xem lại bài làm của mình. Đáp án đúng và lời giải hiện đang được ẩn.'}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-black">Chi tiết câu trả lời</h2>
          </div>

          <div className="mt-5 space-y-4">
            {(exam.questions || []).map((question, index) => {
              const canReviewAnswers = review?.allowed === true

              const wrongItem = canReviewAnswers
                ? (result.wrongQuestions || []).find(
                    (item) =>
                      item.questionId === question.id ||
                      item.question === question.question,
                  )
                : null

              const awaitsManualGrading =
                (question.type === 'essay' || question.type === 'code') &&
                String(result?.textAnswers?.[question.id] || '').trim()

              return (
                <article key={question.id ?? index} className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
                  <div className="flex items-start gap-3">
                    {!canReviewAnswers ? (
                      <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                    ) : wrongItem ? (
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                    ) : awaitsManualGrading ? (
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                    )}
                    <div className="min-w-0">
                      <p className="font-black">Câu {index + 1}: {String(question.question || '').replace(/<[^>]+>/g, '')}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">Bài làm: {getAnswerText(question, result)}</p>
                      {canReviewAnswers && awaitsManualGrading && (
                        <p className="mt-2 text-sm font-bold text-amber-600">
                          Đang chờ giáo viên chấm
                        </p>
                      )}

                      {canReviewAnswers && wrongItem && (
                        <p className="mt-2 text-sm font-bold text-emerald-600">
                          Đáp án đúng: {wrongItem.correctAnswer || 'Xem hướng dẫn chấm'}
                        </p>
                      )}

                      {canReviewAnswers && wrongItem?.teacherNote && (
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {wrongItem.teacherNote}
                        </p>
                      )}
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

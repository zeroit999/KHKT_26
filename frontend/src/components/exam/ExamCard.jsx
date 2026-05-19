import {
  BookOpen,
  CalendarDays,
  Clock3,
  Eye,
  FileText,
  RotateCcw,
  UserRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import {
  formatDateTimeText,
} from '../../utils/examHelpers'

function ExamCard({
  exam,
  role,
  currentUserId,
  studentClass,
  getStudentAttemptCount,
  getExamMaxAttempts,
  onOutOfAttempts,
}) {
  const questionCount = Number(
    exam.questionCount || exam.questions?.length || 0,
  )

  const attemptCount = getStudentAttemptCount
    ? getStudentAttemptCount(exam)
    : 0

  const maxAttempts = getExamMaxAttempts
    ? getExamMaxAttempts(exam)
    : 1

  const hasResult = exam.studentResults?.some(
    (result) => result.studentId === currentUserId,
  )

  const bestScore = exam.studentResults
    ?.filter((result) => result.studentId === currentUserId)
    ?.reduce(
      (max, result) => Math.max(max, Number(result.score || 0)),
      0,
    ) ?? 0

  const canRetake = attemptCount < maxAttempts

  const isDisabled = !canRetake

  const examLinkState = {
    role,
    studentClass,
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-white/5">
      <div
        className={`absolute inset-x-0 top-0 h-1.5 ${
          hasResult ? 'bg-emerald-500' : 'bg-blue-500'
        }`}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-xl font-black text-slate-950 dark:text-white">
            {exam.title || 'Chưa có tên đề'}
          </h3>

          <span className="mt-3 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
            {exam.subject || 'Chưa có môn'}
          </span>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-200">
          <BookOpen className="h-6 w-6" />
        </div>
      </div>

      <div className="mt-5 space-y-3 text-sm font-semibold text-slate-500 dark:text-slate-300">
        <p className="flex items-center gap-2">
          <UserRound className="h-4 w-4" />
          {exam.status === 'public'
            ? 'Công khai cho tất cả học sinh'
            : exam.selectedClasses?.length
              ? exam.selectedClasses.join(', ')
              : 'Riêng tư'}
        </p>

        <p className="flex items-center gap-2">
          <Clock3 className="h-4 w-4" />
          {Number(exam.duration || 45)} phút
        </p>

        <p className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {questionCount} câu hỏi
        </p>

        <p className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          {exam.openDate
            ? formatDateTimeText(exam.openDate)
            : 'Chưa đặt thời gian'}
        </p>

        <p className="flex items-center gap-2">
          <Clock3 className="h-4 w-4" />
          Còn {attemptCount}/{maxAttempts} lượt làm
        </p>
      </div>

      {hasResult ? (
        <div className="mt-5 rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-500/10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black text-emerald-700 dark:text-emerald-200">
                Điểm cao nhất
              </p>

              <p className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                Đã làm bài
              </p>
            </div>

            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-200">
              {bestScore}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-center text-sm font-black text-blue-700 dark:bg-blue-500/10 dark:text-blue-200">
          Chưa làm bài
        </div>
      )}

      <div className="mt-4 grid gap-3">
        {hasResult && (
          <Link
            to={`/exam/${exam.id}/result`}
            state={examLinkState}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
          >
            <Eye className="h-4 w-4" />
            Xem lại
          </Link>
        )}

        {isDisabled ? (
          <button
            type="button"
            onClick={onOutOfAttempts}
            className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-slate-300 px-5 py-3 text-sm font-black text-slate-600 dark:bg-white/10 dark:text-slate-400"
          >
            <RotateCcw className="h-4 w-4" />
            Hết lượt làm
          </button>
        ) : (
          <Link
            to={`/exam/${exam.id}`}
            state={examLinkState}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:from-blue-700 hover:to-violet-700"
          >
            {hasResult ? (
              <>
                <RotateCcw className="h-4 w-4" />
                Làm lại bài thi
              </>
            ) : (
              <>
                <BookOpen className="h-4 w-4" />
                Làm bài
              </>
            )}
          </Link>
        )}
      </div>
    </div>
  )
}

export default ExamCard
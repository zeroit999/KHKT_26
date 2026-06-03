import {
  BarChart3,
  CalendarDays,
  Clock3,
  Copy,
  Edit3,
  Eye,
  FileText,
  Globe2,
  LockKeyhole,
  Trash2,
  UserRound,
} from 'lucide-react'

import { formatDateTimeText } from '../../utils/examHelpers'

function TeacherExamRow({
  exam,
  getExamAudienceText,
  onCopy,
  onResults,
  onPreview,
  onEdit,
  onDelete,
}) {
  const questionCount = Number(exam.questionCount || exam.questions?.length || 0)
  const totalScore = Number(exam.totalScore || 0)

  const statusText =
    exam.availabilityStatus === 'published'
      ? 'Hoạt động'
      : exam.availabilityStatus === 'draft'
        ? 'Chưa mở'
        : 'Đã kết thúc'

  const statusClass =
    exam.availabilityStatus === 'published'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
      : exam.availabilityStatus === 'draft'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200'
        : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200'

  const privacyClass =
    exam.status === 'public'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
      : 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-slate-950 dark:text-white">
              {exam.title || 'Chưa có tên đề'}
            </h3>

            <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass}`}>
              {statusText}
            </span>

            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${privacyClass}`}>
              {exam.status === 'public' ? (
                <Globe2 className="h-3.5 w-3.5" />
              ) : (
                <LockKeyhole className="h-3.5 w-3.5" />
              )}
              {exam.status === 'public' ? 'Công khai' : 'Riêng tư'}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-slate-500 dark:text-slate-300">
            <span className="inline-flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {exam.subject || 'Chưa có môn'}
            </span>

            <span className="inline-flex items-center gap-2">
              <UserRound className="h-4 w-4" />
              {getExamAudienceText(exam)}
            </span>

            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {exam.openDate
                ? `${formatDateTimeText(exam.openDate)} - ${formatDateTimeText(exam.closeDate)}`
                : 'Chưa đặt thời gian'}
            </span>

            <span className="inline-flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              {Number(exam.duration || 45)} phút
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => onCopy(exam)}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            title="Sao chép link"
          >
            <Copy className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => onResults(exam)}
            className="rounded-xl p-2 text-violet-600 transition hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-500/10"
            title="Bài làm học sinh"
          >
            <BarChart3 className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => onPreview(exam)}
            className="rounded-xl p-2 text-emerald-600 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
            title="Xem trước"
          >
            <Eye className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => onEdit(exam)}
            className="rounded-xl p-2 text-blue-600 transition hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
            title="Sửa"
          >
            <Edit3 className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(exam)}
            className="rounded-xl p-2 text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
            title="Xóa"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4 dark:border-white/10">
        <div className="grid gap-4 text-center sm:grid-cols-3">
          <div>
            <p className="text-3xl font-black text-blue-600">
              {questionCount}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
              Câu hỏi
            </p>
          </div>

          <div>
            <p className="text-3xl font-black text-emerald-600">
              {totalScore.toFixed(1)}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
              Điểm tối đa
            </p>
          </div>

          <div>
            <p className="text-3xl font-black text-violet-600">
              {totalScore.toFixed(1)}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
              Tổng cấu hình điểm
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TeacherExamRow
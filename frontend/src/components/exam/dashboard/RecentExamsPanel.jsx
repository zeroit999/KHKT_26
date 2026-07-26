import { CalendarClock, ChevronRight, FileText } from 'lucide-react'

const formatDate = (value) => {
  if (!value) return 'Chưa đặt thời gian'
  const date = value?.toDate ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa đặt thời gian'
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default function RecentExamsPanel({ title, description, exams, onOpenExam, emptyMessage }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-950 dark:text-white">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <FileText className="h-6 w-6 text-blue-600 dark:text-blue-300" />
      </div>

      {exams.length ? (
        <div className="mt-5 space-y-3">
          {exams.map((exam) => (
            <button
              key={exam.id}
              type="button"
              onClick={() => onOpenExam(exam)}
              className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/60 dark:border-white/10 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-200">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-950 dark:text-white">{exam.title || 'Đề thi chưa đặt tên'}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>{exam.subject || 'Chưa có môn học'}</span>
                  <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{formatDate(exam.startTime || exam.createdAt)}</span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl bg-slate-50 px-5 py-8 text-center text-sm font-bold text-slate-500 dark:bg-white/5 dark:text-slate-400">
          {emptyMessage}
        </div>
      )}
    </section>
  )
}

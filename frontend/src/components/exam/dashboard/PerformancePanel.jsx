import { Award, BarChart3 } from 'lucide-react'

export default function PerformancePanel({ averageScore, completedCount, rank, totalStudents }) {
  const safeAverage = Math.max(0, Math.min(10, Number(averageScore || 0)))
  const width = `${safeAverage * 10}%`

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-950 dark:text-white">Hiệu suất học tập</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Tổng hợp từ dữ liệu bài thi hiện có.</p>
        </div>
        <BarChart3 className="h-6 w-6 text-violet-600 dark:text-violet-300" />
      </div>

      <div className="mt-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Điểm trung bình</p>
            <p className="mt-2 text-4xl font-black text-slate-950 dark:text-white">{safeAverage.toFixed(1)}</p>
          </div>
          <span className="text-sm font-black text-violet-600 dark:text-violet-300">/10</span>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-600 transition-all" style={{ width }} />
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Đã hoàn thành</p>
          <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{completedCount}</p>
        </div>
        <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-500/10">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-200">
            <Award className="h-4 w-4" />
            <p className="text-xs font-black uppercase tracking-[0.12em]">Xếp hạng</p>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{rank ? `#${rank}` : '—'}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">trên {totalStudents || 0} học sinh</p>
        </div>
      </div>
    </section>
  )
}

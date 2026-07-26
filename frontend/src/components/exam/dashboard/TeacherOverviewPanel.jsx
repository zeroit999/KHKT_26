import { Activity, UsersRound } from 'lucide-react'

export default function TeacherOverviewPanel({ totalSubmissions, uniqueStudents, activeExams }) {
  const items = [
    { label: 'Lượt nộp bài', value: totalSubmissions, Icon: Activity },
    { label: 'Học sinh tham gia', value: uniqueStudents, Icon: UsersRound },
    { label: 'Đề đang hoạt động', value: activeExams, Icon: Activity },
  ]

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-6">
      <div>
        <h2 className="text-xl font-black text-slate-950 dark:text-white">Hoạt động hệ thống</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Dữ liệu được tổng hợp trực tiếp từ các đề thi hiện tại.</p>
      </div>
      <div className="mt-5 grid gap-3">
        {items.map(({ label, value, Icon }) => (
          <div key={label} className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-200">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</p>
              <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

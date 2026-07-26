export default function DashboardStatCard({ label, value, helper, Icon, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-200',
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-200',
    violet: 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-200',
    rose: 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-200',
  }

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">{value}</p>
          {helper ? <p className="mt-2 text-xs font-semibold text-slate-400 dark:text-slate-500">{helper}</p> : null}
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tones[tone] || tones.blue}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </article>
  )
}

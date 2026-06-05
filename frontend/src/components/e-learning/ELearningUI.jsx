export function GlassPanel({ children, className = '' }) {
  return (
    <section className={`rounded-[2rem] border border-slate-200 bg-white/90 shadow-xl shadow-slate-200/60 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70 dark:shadow-slate-950/30 ${className}`}>
      {children}
    </section>
  )
}

export function StatPill({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{value}</div>
    </div>
  )
}

export function ProgressBar({ value }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)))

  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-500 transition-all duration-700"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  )
}

export function RoleBadge({ role }) {
  const label = role === 'TEACHER' ? 'Giáo viên' : role === 'Admin_dev' ? 'Admin dev' : 'Học sinh'

  return (
    <span className="rounded-full border border-sky-300/40 bg-sky-100 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-sky-700 dark:bg-sky-400/10 dark:text-sky-200">
      {label}
    </span>
  )
}

export function EmptyState({ title, description }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center dark:border-white/10 dark:bg-white/[0.03]">
      <div className="text-5xl">📚</div>
      <h3 className="mt-4 text-xl font-black text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  )
}

export const inputClass = 'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white dark:border-white/10 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-sky-400'

export const selectClass = `${inputClass} cursor-pointer [color-scheme:light] dark:[color-scheme:dark]`

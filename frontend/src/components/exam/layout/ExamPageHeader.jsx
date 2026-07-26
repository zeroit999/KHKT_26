import { Menu } from 'lucide-react'

export default function ExamPageHeader({ eyebrow = 'Trung tâm đề thi', title, description, action, onOpenMenu }) {
  return (
    <div className="border-b border-slate-200 bg-white/85 px-4 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/75 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onOpenMenu} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm lg:hidden dark:border-white/10 dark:bg-white/5 dark:text-white" aria-label="Mở thanh điều hướng"><Menu className="h-5 w-5" /></button>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">{eyebrow}</p>
            <h1 className="truncate text-xl font-black text-slate-950 dark:text-white sm:text-2xl">{title}</h1>
            {description && <p className="mt-0.5 hidden text-sm font-medium text-slate-500 dark:text-slate-400 sm:block">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}

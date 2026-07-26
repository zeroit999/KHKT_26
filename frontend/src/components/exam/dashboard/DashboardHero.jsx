import { ArrowRight, Sparkles } from 'lucide-react'

export default function DashboardHero({ eyebrow, title, description, primaryAction, secondaryAction }) {
  return (
    <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-6 text-white shadow-xl shadow-blue-500/20 sm:p-8">
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] backdrop-blur">
          <Sparkles className="h-4 w-4" />
          {eyebrow}
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-blue-50 sm:text-base">{description}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          {primaryAction ? (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-blue-700 shadow-lg transition hover:-translate-y-0.5"
            >
              {primaryAction.label}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : null}

          {secondaryAction ? (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
            >
              {secondaryAction.label}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}

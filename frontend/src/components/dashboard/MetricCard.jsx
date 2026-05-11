import GlassCard from '../ui/GlassCard.jsx'

function MetricCard({ label, value, change, icon: Icon, delay = 0 }) {
  return (
    <GlassCard className="p-5" delay={delay}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{value}</p>
          <p className="mt-2 text-sm font-semibold text-cyan-700 dark:text-cyan-200">{change}</p>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400/20 to-blue-500/20 text-cyan-600 dark:text-cyan-200">
          <Icon className="h-6 w-6" />
        </span>
      </div>
    </GlassCard>
  )
}

export default MetricCard

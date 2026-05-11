import { Clock3 } from 'lucide-react'
import GlassCard from '../ui/GlassCard.jsx'

function TimerCard({ minutesLeft, progress }) {
  const isWarning = minutesLeft <= 15

  return (
    <GlassCard className="p-4" initial={false} whileInView={false}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Thời gian</p>
          <p className={`mt-1 text-3xl font-black ${isWarning ? 'text-orange-500' : 'text-cyan-600 dark:text-cyan-200'}`}>
            {minutesLeft}:00
          </p>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-600 dark:text-cyan-200">
          <Clock3 className="h-6 w-6" />
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded bg-slate-200 dark:bg-white/10">
        <span
          className={`block h-full rounded ${isWarning ? 'bg-orange-400' : 'bg-gradient-to-r from-cyan-300 to-blue-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </GlassCard>
  )
}

export default TimerCard

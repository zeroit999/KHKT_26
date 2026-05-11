import { motion } from 'framer-motion'
import { Award, Flame } from 'lucide-react'

function rankStyle(rank) {
  if (rank === 1) return 'from-amber-300 to-yellow-500 text-slate-950'
  if (rank === 2) return 'from-slate-200 to-slate-400 text-slate-950'
  if (rank === 3) return 'from-orange-300 to-orange-500 text-white'
  return 'from-cyan-400/20 to-blue-500/20 text-cyan-700 dark:text-cyan-200'
}

function LeaderboardTable({ rows }) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/60 bg-white/75 shadow-soft dark:border-white/10 dark:bg-white/5">
      <div className="hidden grid-cols-[80px_1.5fr_1fr_120px_120px] border-b border-slate-200 px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:border-white/10 dark:text-slate-400 md:grid">
        <span>Rank</span>
        <span>Học sinh</span>
        <span>Trường</span>
        <span>Điểm</span>
        <span>Streak</span>
      </div>
      <div className="divide-y divide-slate-200 dark:divide-white/10">
        {rows.map((row, index) => (
          <motion.div
            key={row.rank}
            className="grid gap-3 px-5 py-4 md:grid-cols-[80px_1.5fr_1fr_120px_120px] md:items-center"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.06 }}
          >
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${rankStyle(row.rank)}`}>
                {row.rank <= 3 ? <Award className="h-5 w-5" /> : row.rank}
              </span>
            </div>
            <div>
              <p className="font-bold text-slate-950 dark:text-white">{row.name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 md:hidden">{row.school}</p>
            </div>
            <p className="hidden text-sm text-slate-600 dark:text-slate-300 md:block">{row.school}</p>
            <p className="text-lg font-black text-cyan-700 dark:text-cyan-200">{row.score.toLocaleString('vi-VN')}</p>
            <p className="flex items-center gap-2 text-sm font-semibold text-orange-500">
              <Flame className="h-4 w-4" />
              {row.streak} ngày
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export default LeaderboardTable

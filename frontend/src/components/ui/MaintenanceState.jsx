import { motion } from 'framer-motion'
import { Construction, Sparkles } from 'lucide-react'
import GlassCard from './GlassCard.jsx'

function MaintenanceState() {
  return (
    <section className="relative min-h-[68vh] overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <GlassCard className="relative overflow-hidden p-8 text-center sm:p-12">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(34,211,238,0.14),transparent_38%,rgba(59,130,246,0.16))]" />
          <div className="maintenance-particles" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, index) => (
              <span key={index} style={{ '--delay': `${index * 0.3}s`, '--x': `${(index * 19) % 100}%` }} />
            ))}
          </div>
          <div className="relative z-10">
            <motion.div
              className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-lg border border-cyan-300/40 bg-cyan-400/15 text-cyan-500 dark:text-cyan-200"
              animate={{ y: [0, -10, 0], rotate: [0, -5, 5, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Construction className="h-10 w-10" />
            </motion.div>
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-lg border border-white/60 bg-white/70 px-4 py-2 text-sm font-semibold text-blue-700 dark:border-white/10 dark:bg-white/10 dark:text-cyan-200">
              <Sparkles className="h-4 w-4" />
              E-Learning
            </div>
            <motion.h1
              className="text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              Đang bảo trì
            </motion.h1>
            <p className="mt-4 text-lg font-semibold text-cyan-700 dark:text-cyan-200">
              Dữ liệu đang được cập nhật
            </p>
            <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-300">Vui lòng quay lại sau</p>
            <div className="mt-8 flex justify-center gap-2">
              <span className="loading-dot" />
              <span className="loading-dot delay-150" />
              <span className="loading-dot delay-300" />
            </div>
          </div>
        </GlassCard>
      </div>
    </section>
  )
}

export default MaintenanceState

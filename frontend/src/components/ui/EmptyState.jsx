import { motion } from 'framer-motion'
import { Inbox, RefreshCw } from 'lucide-react'
import GlassCard from './GlassCard.jsx'
import LoadingSkeleton from './LoadingSkeleton.jsx'

function EmptyState({
  title = 'Dữ liệu đang cập nhật',
  description = 'Vui lòng quay lại sau',
  icon: Icon = Inbox,
  showSkeleton = true,
}) {
  return (
    <GlassCard className="mx-auto max-w-2xl text-center">
      <motion.div
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-lg border border-cyan-300/40 bg-cyan-400/10 text-cyan-500 dark:text-cyan-200"
        animate={{ y: [0, -8, 0], rotate: [0, 4, 0] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Icon className="h-8 w-8" />
      </motion.div>
      <h2 className="text-2xl font-bold text-slate-950 dark:text-white">{title}</h2>
      <p className="mt-3 text-slate-600 dark:text-slate-300">{description}</p>
      {showSkeleton ? <LoadingSkeleton rows={3} className="mx-auto mt-7 max-w-sm" /> : null}
      <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-cyan-300/30 px-4 py-2 text-sm font-semibold text-cyan-700 dark:text-cyan-200">
        <RefreshCw className="h-4 w-4 animate-spin-slow" />
        Đang đồng bộ
      </div>
    </GlassCard>
  )
}

export default EmptyState

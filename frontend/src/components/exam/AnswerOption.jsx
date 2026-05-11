import { CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'

function AnswerOption({ label, value, selected, onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-start gap-4 rounded-lg border p-4 text-left transition ${
        selected
          ? 'border-cyan-300 bg-cyan-400/15 shadow-[0_14px_35px_rgba(14,165,233,0.16)]'
          : 'border-slate-200 bg-white/70 hover:border-cyan-300 hover:bg-cyan-400/10 dark:border-white/10 dark:bg-white/5'
      }`}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black ${
          selected ? 'bg-cyan-400 text-white' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
        }`}
      >
        {label}
      </span>
      <span className="flex-1 text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">{value}</span>
      {selected ? <CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-500 dark:text-cyan-200" /> : null}
    </motion.button>
  )
}

export default AnswerOption

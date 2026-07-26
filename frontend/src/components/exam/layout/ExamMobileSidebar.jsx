import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

import ExamSidebar from './ExamSidebar.jsx'

export default function ExamMobileSidebar({ open, role, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <motion.button type="button" aria-label="Đóng menu" onClick={onClose} className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div className="relative h-full w-[min(86vw,320px)] shadow-2xl" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}>
            <button type="button" onClick={onClose} className="absolute right-3 top-3 z-10 rounded-xl bg-slate-100 p-2 text-slate-600 dark:bg-white/10 dark:text-white" aria-label="Đóng thanh điều hướng"><X className="h-5 w-5" /></button>
            <ExamSidebar role={role} collapsed={false} onToggle={onClose} onNavigate={onClose} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

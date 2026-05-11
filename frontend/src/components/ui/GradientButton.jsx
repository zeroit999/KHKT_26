import { motion } from 'framer-motion'

function GradientButton({ children, className = '', icon: Icon, variant = 'primary', ...props }) {
  const variants = {
    primary:
      'bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 text-white shadow-[0_18px_45px_rgba(14,165,233,0.28)]',
    subtle:
      'border border-cyan-300/40 bg-white/75 text-slate-900 hover:border-cyan-300 dark:bg-white/10 dark:text-white',
    ghost: 'text-slate-700 hover:bg-white/70 dark:text-slate-200 dark:hover:bg-white/10',
  }

  return (
    <motion.button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition ${variants[variant]} ${className}`}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      {...props}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </motion.button>
  )
}

export default GradientButton

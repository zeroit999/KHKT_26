import { motion } from 'framer-motion'

function GlassCard({ as: Tag = motion.div, children, className = '', delay = 0, ...props }) {
  return (
    <Tag
      className={`glass-card rounded-lg border border-white/60 p-5 shadow-soft dark:border-white/10 ${className}`}
      initial={props.initial ?? { opacity: 0, y: 18 }}
      whileInView={props.whileInView ?? { opacity: 1, y: 0 }}
      viewport={props.viewport ?? { once: true, margin: '-60px' }}
      transition={props.transition ?? { duration: 0.35, delay, ease: 'easeOut' }}
      {...props}
    >
      {children}
    </Tag>
  )
}

export default GlassCard

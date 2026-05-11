function LoadingSkeleton({ rows = 3, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`} aria-label="Đang tải">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-4 overflow-hidden rounded bg-slate-200/80 dark:bg-white/10">
          <span
            className="block h-full w-1/2 animate-shimmer rounded bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/20"
            style={{ animationDelay: `${index * 0.12}s` }}
          />
        </div>
      ))}
    </div>
  )
}

export default LoadingSkeleton

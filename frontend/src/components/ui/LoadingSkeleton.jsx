function LoadingSkeleton({ className = '' }) {
  return (
    <div
      className={`flex min-h-screen w-full items-center justify-center bg-slate-100 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-white ${className}`}
      aria-label="Đang tải"
      role="status"
    >
      <div className="flex flex-col items-center justify-center gap-4">
        <svg width="320" height="160" viewBox="0 0 320 160" aria-hidden="true">
          <defs>
            <filter id="zunyGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <text
            x="50%"
            y="55%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="zuny-loading-text"
          >
            Zuny
          </text>
        </svg>
      </div>

      <style>{`
        .zuny-loading-text {
          font-size: 72px;
          font-weight: 800;
          font-family: Arial, Helvetica, sans-serif;
          fill: transparent;
          stroke: #2563eb;
          stroke-width: 2;
          stroke-dasharray: 420;
          stroke-dashoffset: 420;
          filter: url(#zunyGlow);
          animation: drawZuny 3s ease-in-out infinite;
        }

        .dark .zuny-loading-text {
          stroke: #00f0ff;
        }

        @keyframes drawZuny {
          0% {
            stroke-dashoffset: 420;
            fill: transparent;
          }
          55% {
            stroke-dashoffset: 0;
            fill: transparent;
          }
          75% {
            stroke-dashoffset: 0;
            fill: #2563eb;
          }
          100% {
            stroke-dashoffset: 420;
            fill: transparent;
          }
        }

        .dark .zuny-loading-text {
          animation-name: drawZunyDark;
        }

        @keyframes drawZunyDark {
          0% {
            stroke-dashoffset: 420;
            fill: transparent;
          }
          55% {
            stroke-dashoffset: 0;
            fill: transparent;
          }
          75% {
            stroke-dashoffset: 0;
            fill: #e0ffff;
          }
          100% {
            stroke-dashoffset: 420;
            fill: transparent;
          }
        }
      `}</style>
    </div>
  )
}

export default LoadingSkeleton

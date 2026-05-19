import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

function DarkModeSelect({ value, onChange, options, className = '' }) {
  const [open, setOpen] = useState(false)
  const selectedOption =
    options.find((option) => option.value === value) ?? options[0]

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700 outline-none transition hover:border-violet-300 focus:border-violet-400 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:hover:border-violet-400/60"
      >
        <span>{selectedOption?.label}</span>
        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-slate-900">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-bold transition ${
                value === option.value
                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-100'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-white dark:hover:bg-white/10'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default DarkModeSelect
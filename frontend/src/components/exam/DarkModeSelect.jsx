import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

function DarkModeSelect({
  value,
  onChange,
  options = [],
  className = '',
  buttonClassName = '',
  menuClassName = '',
  placeholder = 'Chọn',
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)
  const buttonRef = useRef(null)

  const selectedOption = useMemo(() => {
    return options.find((option) => option.value === value) ?? null
  }, [options, value])

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleSelect = (nextValue) => {
    onChange(nextValue)
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700 outline-none transition hover:border-violet-300 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:hover:border-violet-400/60 ${buttonClassName}`}
      >
        <span className="truncate text-left">
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute left-0 top-full z-[90] mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-2xl shadow-slate-900/10 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/30 ${menuClassName}`}
        >
          {options.map((option) => {
            const selected = option.value === value

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => handleSelect(option.value)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition ${
                  selected
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-100'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-white dark:hover:bg-white/10'
                }`}
              >
                <span className="truncate">{option.label}</span>
                {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default DarkModeSelect

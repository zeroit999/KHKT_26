import { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react'
import DatePicker from 'react-datepicker'
import { CalendarDays, Clock3 } from 'lucide-react'
import { vi } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'

const pad = (value) => String(value).padStart(2, '0')

const toDate = (value) => {
  if (!value) return null

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const toDateTimeLocalValue = (date) => {
  if (!date || Number.isNaN(date.getTime())) return ''

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const formatDisplayValue = (value) => {
  const date = toDate(value)
  if (!date) return 'Chọn thời gian'

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const DateTimeInput = forwardRef(function DateTimeInput(
  { value, onClick, disabled, hasError },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-[48px] w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-black outline-none transition disabled:cursor-not-allowed disabled:opacity-60 ${
        hasError
          ? 'border-red-500 bg-slate-950 text-white focus:border-red-500'
          : 'border-slate-700 bg-slate-950 text-white hover:border-blue-500 focus:border-blue-500'
      }`}
    >
      <span className="inline-flex min-w-0 items-center gap-2">
        <CalendarDays className="h-4 w-4 shrink-0 text-blue-400" />
        <span className="truncate">{value || 'Chọn thời gian'}</span>
      </span>

      <Clock3 className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
  )
})

function DateTimePicker({ value, onChange, min, disabled = false, hasError = false }) {
  const pickerId = useId()
  const [open, setOpen] = useState(false)
  const fieldRef = useRef(null)

  const selectedDate = useMemo(() => toDate(value), [value])
  const minDate = useMemo(() => toDate(min), [min])

  const closePicker = () => setOpen(false)

  const openPicker = () => {
    if (disabled) return

    window.dispatchEvent(
      new CustomEvent('zuny-datepicker-open', {
        detail: pickerId,
      }),
    )

    setOpen(true)
  }

  useEffect(() => {
    const handleAnotherPickerOpen = (event) => {
      if (event.detail !== pickerId) closePicker()
    }

    window.addEventListener('zuny-datepicker-open', handleAnotherPickerOpen)

    return () => {
      window.removeEventListener('zuny-datepicker-open', handleAnotherPickerOpen)
    }
  }, [pickerId])

  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closePicker()
    }

    const handlePointerDown = (event) => {
      const target = event.target
      const clickedInsideField = fieldRef.current?.contains(target)
      const clickedInsideCalendar = target?.closest?.('.zuny-datepicker-popper')

      if (!clickedInsideField && !clickedInsideCalendar) {
        closePicker()
      }
    }

    document.addEventListener('mousedown', handlePointerDown, true)
    document.addEventListener('touchstart', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true)
      document.removeEventListener('touchstart', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleChange = (date) => {
    onChange(toDateTimeLocalValue(date))
  }

  return (
    <div ref={fieldRef} className="zuny-datepicker-field w-full">
      <DatePicker
        selected={selectedDate}
        onChange={handleChange}
        open={open}
        onInputClick={openPicker}
        onCalendarOpen={openPicker}
        onCalendarClose={closePicker}
        onClickOutside={closePicker}
        shouldCloseOnSelect={false}
        showTimeSelect
        timeIntervals={5}
        timeCaption="Giờ"
        dateFormat="dd/MM/yyyy HH:mm"
        locale={vi}
        minDate={minDate || undefined}
        disabled={disabled}
        popperPlacement="bottom-start"
        popperClassName="zuny-datepicker-popper"
        calendarClassName="zuny-datepicker-calendar"
        wrapperClassName="zuny-datepicker-wrapper"
        customInput={
          <DateTimeInput
            value={formatDisplayValue(value)}
            disabled={disabled}
            hasError={hasError}
            onClick={openPicker}
          />
        }
      />

      <style>{`
        .zuny-datepicker-field,
        .zuny-datepicker-wrapper,
        .zuny-datepicker-wrapper > div {
          width: 100%;
        }

        .zuny-datepicker-popper {
          z-index: 9999 !important;
          padding-top: 10px !important;
        }

        .zuny-datepicker-popper[data-placement^='bottom'] .react-datepicker__triangle {
          left: 52px !important;
          transform: none !important;
          fill: #111827 !important;
          color: #111827 !important;
          stroke: #334155 !important;
        }

        .zuny-datepicker-calendar.react-datepicker {
          width: 430px !important;
          display: grid !important;
          grid-template-columns: 1fr 108px !important;
          overflow: hidden !important;
          border: 1px solid rgba(51, 65, 85, 0.95) !important;
          border-radius: 22px !important;
          background: #111827 !important;
          color: #ffffff !important;
          font-family: inherit !important;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.38) !important;
        }

        .zuny-datepicker-calendar .react-datepicker__month-container {
          width: 322px !important;
          background: #111827 !important;
        }

        .zuny-datepicker-calendar .react-datepicker__header {
          border-bottom: 1px solid rgba(51, 65, 85, 0.95) !important;
          background: #111827 !important;
          padding: 14px 14px 8px !important;
        }

        .zuny-datepicker-calendar .react-datepicker__current-month {
          color: #ffffff !important;
          font-size: 15px !important;
          font-weight: 900 !important;
          line-height: 28px !important;
          text-transform: capitalize !important;
        }

        .zuny-datepicker-calendar .react-datepicker__navigation {
          top: 17px !important;
          width: 28px !important;
          height: 28px !important;
          border-radius: 10px !important;
          transition: background 0.15s ease !important;
        }

        .zuny-datepicker-calendar .react-datepicker__navigation:hover {
          background: rgba(255, 255, 255, 0.08) !important;
        }

        .zuny-datepicker-calendar .react-datepicker__navigation--previous {
          left: 12px !important;
        }

        .zuny-datepicker-calendar .react-datepicker__navigation--next {
          right: 116px !important;
        }

        .zuny-datepicker-calendar .react-datepicker__navigation-icon::before {
          border-color: #cbd5e1 !important;
          border-width: 2px 2px 0 0 !important;
          width: 8px !important;
          height: 8px !important;
        }

        .zuny-datepicker-calendar .react-datepicker__day-names,
        .zuny-datepicker-calendar .react-datepicker__week {
          display: grid !important;
          grid-template-columns: repeat(7, 1fr) !important;
          gap: 6px !important;
          margin: 0 !important;
        }

        .zuny-datepicker-calendar .react-datepicker__day-names {
          padding: 0 14px !important;
        }

        .zuny-datepicker-calendar .react-datepicker__month {
          margin: 0 !important;
          padding: 10px 14px 16px !important;
        }

        .zuny-datepicker-calendar .react-datepicker__day-name,
        .zuny-datepicker-calendar .react-datepicker__day {
          width: 34px !important;
          height: 34px !important;
          margin: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 12px !important;
          color: #dbeafe !important;
          font-size: 14px !important;
          font-weight: 900 !important;
          line-height: 1 !important;
        }

        .zuny-datepicker-calendar .react-datepicker__day-name {
          height: 28px !important;
          color: #93c5fd !important;
          font-size: 13px !important;
        }

        .zuny-datepicker-calendar .react-datepicker__day:hover {
          background: rgba(37, 99, 235, 0.28) !important;
          color: #ffffff !important;
        }

        .zuny-datepicker-calendar .react-datepicker__day--outside-month,
        .zuny-datepicker-calendar .react-datepicker__day--disabled {
          color: #475569 !important;
        }

        .zuny-datepicker-calendar .react-datepicker__day--selected,
        .zuny-datepicker-calendar .react-datepicker__day--keyboard-selected {
          background: #2563eb !important;
          color: #ffffff !important;
        }

        .zuny-datepicker-calendar .react-datepicker__time-container {
          width: 108px !important;
          border-left: 1px solid rgba(51, 65, 85, 0.95) !important;
          background: #0f172a !important;
        }

        .zuny-datepicker-calendar .react-datepicker__header--time {
          height: 57px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-bottom: 1px solid rgba(51, 65, 85, 0.95) !important;
          background: #111827 !important;
          padding: 0 !important;
        }

        .zuny-datepicker-calendar .react-datepicker-time__header {
          color: #ffffff !important;
          font-size: 15px !important;
          font-weight: 900 !important;
        }

        .zuny-datepicker-calendar .react-datepicker__time,
        .zuny-datepicker-calendar .react-datepicker__time-box {
          width: 108px !important;
          background: #0f172a !important;
        }

        .zuny-datepicker-calendar .react-datepicker__time-list {
          height: 236px !important;
          padding: 8px 0 !important;
          overflow-y: auto !important;
          background: #0f172a !important;
          scrollbar-width: thin;
          scrollbar-color: #3b82f6 #0f172a;
        }

        .zuny-datepicker-calendar .react-datepicker__time-list::-webkit-scrollbar {
          width: 8px;
        }

        .zuny-datepicker-calendar .react-datepicker__time-list::-webkit-scrollbar-track {
          background: #0f172a;
        }

        .zuny-datepicker-calendar .react-datepicker__time-list::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: #3b82f6;
        }

        .zuny-datepicker-calendar .react-datepicker__time-list-item {
          height: 34px !important;
          margin: 0 8px 4px !important;
          padding: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 10px !important;
          color: #dbeafe !important;
          font-size: 14px !important;
          font-weight: 900 !important;
          transition: background 0.15s ease !important;
        }

        .zuny-datepicker-calendar .react-datepicker__time-list-item:hover {
          background: rgba(37, 99, 235, 0.28) !important;
          color: #ffffff !important;
        }

        .zuny-datepicker-calendar .react-datepicker__time-list-item--selected {
          background: #2563eb !important;
          color: #ffffff !important;
        }
      `}</style>
    </div>
  )
}

export default DateTimePicker

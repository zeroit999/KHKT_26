import { Link } from 'react-router-dom'
import SettingToggle from './SettingToggle.jsx'

export default function SettingCard({
  item,
  darkMode,
  onToggleDarkMode,
}) {
  const Icon = item.icon

  const rightAction = () => {
    if (item.type === 'toggle') {
      const checked = item.id === 'darkMode' ? darkMode : false

      return (
        <SettingToggle
          checked={checked}
          onChange={item.id === 'darkMode' ? onToggleDarkMode : undefined}
          disabled={item.id !== 'darkMode'}
        />
      )
    }

    if (item.type === 'link') {
      return (
        <Link
          to={item.href}
          className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-600"
        >
          Mở
        </Link>
      )
    }

    return (
      <button
        type="button"
        disabled={item.disabled}
        className="rounded-xl border border-cyan-200 px-4 py-2 text-sm font-bold text-cyan-700 transition hover:bg-cyan-50 disabled:opacity-50 dark:border-cyan-400/30 dark:text-cyan-200 dark:hover:bg-white/5"
      >
        {item.disabled ? 'Sắp có' : 'Thiết lập'}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-slate-900/70 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 dark:bg-cyan-400/10 dark:text-cyan-300">
          <Icon size={22} />
        </div>

        <div>
          <h3 className="font-bold text-slate-900 dark:text-white">
            {item.title}
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {item.description}
          </p>
        </div>
      </div>

      <div className="shrink-0">{rightAction()}</div>
    </div>
  )
}
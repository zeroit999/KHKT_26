import SettingCard from './SettingCard.jsx'

export default function SettingSection({
  section,
  darkMode,
  onToggleDarkMode,
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          {section.title}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {section.description}
        </p>
      </div>

      <div className="grid gap-4">
        {section.items.map((item) => (
          <SettingCard
            key={item.id}
            item={item}
            darkMode={darkMode}
            onToggleDarkMode={onToggleDarkMode}
          />
        ))}
      </div>
    </section>
  )
}
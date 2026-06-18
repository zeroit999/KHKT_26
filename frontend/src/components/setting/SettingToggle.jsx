export default function SettingToggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      className={`relative h-7 w-13 rounded-full transition ${
        checked
          ? 'bg-cyan-500'
          : 'bg-slate-300 dark:bg-slate-700'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
          checked ? 'left-7' : 'left-1'
        }`}
      />
    </button>
  )
}
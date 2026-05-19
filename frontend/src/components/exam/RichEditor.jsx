import { useState } from 'react'
import { Image } from 'lucide-react'

function RichEditor({ label, value, onChange }) {
  const [toolbar, setToolbar] = useState({
    bold: false,
    italic: false,
    underline: false,
    size: '16',
  })

  const insertImage = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    onChange(`${value}\n[Ảnh: ${file.name}]`)
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-slate-800 dark:text-white">
        {label}
      </label>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setToolbar((prev) => ({ ...prev, bold: !prev.bold }))}
            className={`rounded-lg px-3 py-1.5 text-sm font-black ${
              toolbar.bold
                ? 'bg-violet-600 text-white'
                : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white'
            }`}
          >
            B
          </button>

          <button
            type="button"
            onClick={() => setToolbar((prev) => ({ ...prev, italic: !prev.italic }))}
            className={`rounded-lg px-3 py-1.5 text-sm font-black italic ${
              toolbar.italic
                ? 'bg-violet-600 text-white'
                : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white'
            }`}
          >
            I
          </button>

          <button
            type="button"
            onClick={() =>
              setToolbar((prev) => ({ ...prev, underline: !prev.underline }))
            }
            className={`rounded-lg px-3 py-1.5 text-sm font-black underline ${
              toolbar.underline
                ? 'bg-violet-600 text-white'
                : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white'
            }`}
          >
            U
          </button>

          <select
            value={toolbar.size}
            onChange={(event) =>
              setToolbar((prev) => ({ ...prev, size: event.target.value }))
            }
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold outline-none dark:border-white/10 dark:bg-white/10 dark:text-white"
          >
            <option value="14">14</option>
            <option value="16">16</option>
            <option value="18">18</option>
            <option value="20">20</option>
            <option value="24">24</option>
          </select>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700 dark:bg-white/10 dark:text-white">
            <Image className="h-4 w-4" />
            Ảnh
            <input
              type="file"
              accept="image/*"
              onChange={insertImage}
              className="hidden"
            />
          </label>
        </div>

        <textarea
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          style={{
            fontWeight: toolbar.bold ? 700 : 400,
            fontStyle: toolbar.italic ? 'italic' : 'normal',
            textDecoration: toolbar.underline ? 'underline' : 'none',
            fontSize: `${toolbar.size}px`,
          }}
          className="w-full resize-none rounded-xl border border-slate-100 bg-slate-50 p-3 text-slate-900 outline-none focus:border-violet-400 dark:border-white/10 dark:bg-slate-950 dark:text-white"
          placeholder={`Nhập ${label.toLowerCase()}...`}
        />
      </div>
    </div>
  )
}

export default RichEditor
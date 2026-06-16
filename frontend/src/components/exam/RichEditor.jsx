import { useMemo, useState } from 'react'
import { Image, Trash2 } from 'lucide-react'

import DarkModeSelect from './DarkModeSelect.jsx'

const imageRegex = /<img[^>]*src="([^"]+)"[^>]*>/g

function RichEditor({ label, value, onChange }) {
  const [toolbar, setToolbar] = useState({
    bold: false,
    italic: false,
    underline: false,
    size: '16',
  })

  const images = useMemo(() => {
    const content = String(value || '')
    const result = []

    for (const match of content.matchAll(imageRegex)) {
      result.push({
        src: match[1],
      })
    }

    return result
  }, [value])

  const textValue = useMemo(() => {
    return String(value || '')
      .replace(imageRegex, '')
      .replace(/\n{3,}/g, '\n\n')
      .trimStart()
  }, [value])

  const syncContent = (nextText, nextImages = images) => {
    const imageHtml = nextImages
      .map((image) => `<img src="${image.src}" />`)
      .join('\n')

    const nextContent = [nextText, imageHtml]
      .filter((item) => String(item || '').trim())
      .join('\n\n')

    onChange(nextContent)
  }

  const insertImage = (event) => {
    const file = event.target.files?.[0]

    if (!file) return

    if (!file.type.startsWith('image/')) {
      event.target.value = ''
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      const nextImages = [
        ...images,
        {
          src: reader.result,
        },
      ]

      syncContent(textValue, nextImages)
    }

    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const removeImage = (imageIndex) => {
    const nextImages = images.filter((_, index) => index !== imageIndex)
    syncContent(textValue, nextImages)
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
            onClick={() =>
              setToolbar((prev) => ({ ...prev, bold: !prev.bold }))
            }
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
            onClick={() =>
              setToolbar((prev) => ({ ...prev, italic: !prev.italic }))
            }
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

          <DarkModeSelect
            value={toolbar.size}
            onChange={(size) =>
              setToolbar((prev) => ({ ...prev, size }))
            }
            options={[
              { value: '14', label: '14' },
              { value: '16', label: '16' },
              { value: '18', label: '18' },
              { value: '20', label: '20' },
              { value: '24', label: '24' },
            ]}
            className="w-24"
          />

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
          value={textValue}
          onChange={(event) => syncContent(event.target.value)}
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

        {images.length > 0 && (
          <div className="mt-3 grid gap-3">
            {images.map((image, index) => (
              <div
                key={`${image.src}-${index}`}
                className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950"
              >
                <img
                  src={image.src}
                  alt=""
                  className="max-h-72 w-full rounded-lg object-contain"
                />

                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute right-3 top-3 rounded-lg bg-red-600 p-2 text-white shadow-lg transition hover:bg-red-700"
                  title="Xóa ảnh"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default RichEditor
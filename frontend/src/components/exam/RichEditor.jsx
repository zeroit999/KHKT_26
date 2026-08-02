import { Image, Trash2 } from 'lucide-react'
import { useMemo } from 'react'

const imageRegex = /<img[^>]*src="([^"]+)"[^>]*>/g

function RichEditor({ label, value, onChange, rows = 4 }) {
  const images = useMemo(() => {
    const result = []

    for (const match of String(value || '').matchAll(imageRegex)) {
      result.push({ src: match[1] })
    }

    return result
  }, [value])

  const textValue = useMemo(
    () => String(value || '').replace(imageRegex, '').replace(/\n{3,}/g, '\n\n').trimStart(),
    [value],
  )

  const syncContent = (nextText, nextImages = images) => {
    const imageHtml = nextImages
      .map((image) => `<img src="${image.src}" />`)
      .join('\n')

    onChange(
      [nextText, imageHtml]
        .filter((item) => String(item || '').trim())
        .join('\n\n'),
    )
  }

  const insertImage = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file || !file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = () => syncContent(textValue, [...images, { src: reader.result }])
    reader.readAsDataURL(file)
  }

  const removeImage = (imageIndex) => {
    syncContent(textValue, images.filter((_, index) => index !== imageIndex))
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
        {label}
      </label>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Hỗ trợ văn bản nhiều dòng và hình ảnh minh họa
          </span>
          <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15">
            <Image className="h-4 w-4" />
            Thêm ảnh
            <input type="file" accept="image/*" onChange={insertImage} className="hidden" />
          </label>
        </div>

        <textarea
          value={textValue}
          onChange={(event) => syncContent(event.target.value)}
          rows={rows}
          className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-950 dark:text-white"
          placeholder={`Nhập ${label.toLowerCase()}...`}
        />

        {images.length > 0 && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {images.map((image, index) => (
              <div
                key={`${image.src.slice(0, 48)}-${index}`}
                className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950"
              >
                <img src={image.src} alt={`Minh họa ${index + 1}`} className="max-h-64 w-full rounded-lg object-contain" />
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

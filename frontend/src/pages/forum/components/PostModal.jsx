import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'

function PostModal({ open, onClose, onSubmit, groups, classes, userClass, roleKey, displayName, initials, avatarUrl = '' }) {
  const initialForm = {
    title: '',
    content: '',
    type: 'discuss',
    tags: [],
    tagDraft: '#',
    scope: 'hall',
    className: userClass || '',
    groupId: '',
    attachmentUrl: '',
    attachmentName: '',
    imageUrl: '',
    imageFileName: '',
    showImageInput: false,
    isAnonymous: false,
    teacherOnly: false,
    eventStartAt: '',
    eventEndAt: '',
    eventDate: '',
    eventLocation: '',
    pollOptions: ['', ''],
  }
  const [form, setForm] = useState(initialForm)
  const imageFileInputRef = useRef(null)

  useEffect(() => {
    if (open) setForm((prev) => ({ ...prev, className: userClass || prev.className || '' }))
  }, [open, userClass])

  if (!open) return null

  const resetForm = () => setForm({ ...initialForm, className: userClass || '' })

  const typeButtons = [
    {
      value: 'discuss',
      label: 'Thảo luận',
      icon: '💬',
      helper: 'Trao đổi mở, chia sẻ quan điểm và cùng nhau phân tích vấn đề.',
      activeClass: 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25',
      panelClass: 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-500/10',
    },
    {
      value: 'question',
      label: 'Hỏi đáp',
      icon: '❓',
      helper: 'Đặt câu hỏi rõ ràng để giáo viên hoặc bạn học hỗ trợ nhanh hơn.',
      activeClass: 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/25',
      panelClass: 'border-cyan-200 bg-cyan-50 dark:border-cyan-400/20 dark:bg-cyan-500/10',
    },
    {
      value: 'announce',
      label: 'Thông báo',
      icon: '📢',
      helper: 'Thông tin quan trọng, ngắn gọn, dễ đọc và có hành động rõ ràng.',
      activeClass: 'bg-amber-500 text-white shadow-lg shadow-amber-500/25',
      panelClass: 'border-amber-200 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-500/10',
    },
    {
      value: 'event',
      label: 'Sự kiện',
      icon: '🗓️',
      helper: 'Tạo sự kiện có ngày bắt đầu để hiển thị trong Sự kiện sắp tới.',
      activeClass: 'bg-rose-600 text-white shadow-lg shadow-rose-500/25',
      panelClass: 'border-rose-200 bg-rose-50 dark:border-rose-400/20 dark:bg-rose-500/10',
    },
    {
      value: 'poll',
      label: 'Bình chọn',
      icon: '📊',
      helper: 'Tạo câu hỏi bình chọn với ít nhất hai lựa chọn.',
      activeClass: 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-500/25',
      panelClass: 'border-fuchsia-200 bg-fuchsia-50 dark:border-fuchsia-400/20 dark:bg-fuchsia-500/10',
    },
  ]

  const currentType = typeButtons.find((item) => item.value === form.type) || typeButtons[0]
  const canPostClass = Boolean(userClass) || roleKey !== 'student'
  const availableGroups = groups || []
  const availableClasses = classes || []

  const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-violet-400/60'
  const sectionClass = 'rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5'

  const addTag = () => {
    const tag = form.tagDraft.replace(/^#+/, '').trim()
    if (!tag) return setForm({ ...form, tagDraft: '#' })
    if (form.tags.includes(tag)) return setForm({ ...form, tagDraft: '#' })
    setForm({ ...form, tags: [...form.tags, tag].slice(0, 8), tagDraft: '#' })
  }

  const updatePollOption = (index, value) => {
    const nextOptions = [...(form.pollOptions || [])]
    nextOptions[index] = value
    setForm({ ...form, pollOptions: nextOptions })
  }

  const handleImageFile = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type?.startsWith('image/')) {
      toast.error('Vui lòng chọn đúng file ảnh')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setForm((prev) => ({
        ...prev,
        imageUrl: String(reader.result || ''),
        imageFileName: file.name,
        showImageInput: true,
      }))
      toast.success(`Đã tải ảnh: ${file.name}`)
    }
    reader.onerror = () => toast.error('Không thể đọc file ảnh')
    reader.readAsDataURL(file)
  }

  const submit = (event) => {
    event.preventDefault()
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Vui lòng nhập tiêu đề và nội dung')
      return
    }
    if (form.type === 'event') {
      const startMs = new Date(form.eventStartAt).getTime()
      const endMs = new Date(form.eventEndAt).getTime()

      if (!form.eventStartAt || Number.isNaN(startMs)) {
        toast.error('Vui lòng chọn thời gian mở sự kiện')
        return
      }

      if (!form.eventEndAt || Number.isNaN(endMs)) {
        toast.error('Vui lòng chọn thời gian đóng sự kiện')
        return
      }

      if (endMs <= startMs) {
        toast.error('Thời gian đóng phải sau thời gian mở')
        return
      }
    }
    if (form.type === 'poll' && (form.pollOptions || []).filter((option) => option.trim()).length < 2) {
      toast.error('Bình chọn cần ít nhất 2 lựa chọn')
      return
    }

    onSubmit(form)
    resetForm()
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm dark:bg-slate-950/70" onMouseDown={onClose}>
      <form
        onSubmit={submit}
        className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-2xl shadow-violet-500/15 dark:border-white/10 dark:bg-slate-900 dark:shadow-[0_0_60px_rgba(124,58,237,0.35)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-white/10">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-500">ZUNY Community</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Đăng bài mới ✍️</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Đóng">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[68vh] overflow-y-auto px-6 py-6">
          <div className="mb-5 flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-black text-white shadow-lg shadow-violet-500/20">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName || 'Người dùng ZUNY'} className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center">{initials}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-black text-slate-950 dark:text-white">{displayName || 'Người dùng ZUNY'}</p>
              <p className="text-xs font-bold text-slate-400">Chọn loại bài, nhập nội dung và thiết lập phần riêng bên dưới.</p>
            </div>
          </div>

          <div className={sectionClass}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">1. Chọn chủ đề bài đăng</h3>
                <p className="mt-1 text-xs font-bold text-slate-400">Mỗi chủ đề có phần nhập riêng để bài đăng dễ hiểu hơn.</p>
              </div>
              <span className="hidden rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-500 dark:bg-white/10 dark:text-slate-300 sm:inline-flex">
                {currentType.icon} {currentType.label}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {typeButtons.map((item) => {
                const active = form.type === item.value
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setForm({ ...form, type: item.value, teacherOnly: item.value === 'question' ? form.teacherOnly : false })}
                    className={`rounded-2xl px-4 py-3 text-left text-sm font-black transition ${
                      active
                        ? item.activeClass
                        : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-5">
              <div className={sectionClass}>
                <h3 className="mb-3 text-sm font-black text-slate-800 dark:text-white">2. Nội dung chính</h3>
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder={form.type === 'event' ? 'Tiêu đề sự kiện...' : form.type === 'poll' ? 'Câu hỏi bình chọn...' : 'Tiêu đề bài viết...'}
                  className="w-full border-0 border-b border-slate-200 bg-transparent px-0 py-3 text-2xl font-black text-slate-950 outline-none placeholder:text-slate-400 focus:border-violet-400 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
                />

                <textarea
                  value={form.content}
                  onChange={(event) => setForm({ ...form, content: event.target.value })}
                  rows={6}
                  placeholder={
                    form.type === 'event'
                      ? 'Mô tả sự kiện, đối tượng tham gia, nội dung chính...'
                      : form.type === 'question'
                        ? 'Mô tả câu hỏi, phần bạn chưa hiểu, dữ kiện bài toán...'
                        : 'Nội dung bài viết...'
                  }
                  className="mt-4 w-full resize-none rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-400 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-violet-400/60"
                />
              </div>

              <div className={`${sectionClass} ${currentType.panelClass}`}>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">3. Phần riêng của {currentType.label}</h3>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-600 dark:text-slate-300">{currentType.helper}</p>

                {form.type === 'question' && (
                  <div className="mt-4 space-y-3">
                    <ToggleSwitch checked={form.teacherOnly} onChange={(checked) => setForm({ ...form, teacherOnly: checked })} icon="🎓" label="Chỉ giáo viên được trả lời" />
                    <div className="rounded-2xl bg-white/70 p-3 text-xs font-bold text-cyan-700 dark:bg-white/5 dark:text-cyan-200">
                      Gợi ý: ghi rõ bạn đã thử cách nào và đang vướng ở bước nào.
                    </div>
                  </div>
                )}



                {form.type === 'event' && (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-rose-200 bg-white/80 p-3 dark:border-rose-400/20 dark:bg-slate-900/45">
                        <label className="text-xs font-black text-rose-600 dark:text-rose-200">Thời gian mở</label>
                        <input
                          type="datetime-local"
                          step="1"
                          value={form.eventStartAt}
                          onChange={(event) => setForm({ ...form, eventStartAt: event.target.value, eventDate: event.target.value })}
                          className={`${inputClass} mt-2 appearance-none focus:border-rose-300`}
                          style={{ colorScheme: 'dark' }}
                        />
                      </div>

                      <div className="rounded-2xl border border-rose-200 bg-white/80 p-3 dark:border-rose-400/20 dark:bg-slate-900/45">
                        <label className="text-xs font-black text-rose-600 dark:text-rose-200">Thời gian đóng</label>
                        <input
                          type="datetime-local"
                          step="1"
                          value={form.eventEndAt}
                          onChange={(event) => setForm({ ...form, eventEndAt: event.target.value })}
                          className={`${inputClass} mt-2 appearance-none focus:border-rose-300`}
                          style={{ colorScheme: 'dark' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-black text-rose-600 dark:text-rose-200">Địa điểm hoặc link tham gia</label>
                      <input
                        value={form.eventLocation}
                        onChange={(event) => setForm({ ...form, eventLocation: event.target.value })}
                        placeholder="VD: Phòng A1 / Google Meet..."
                        className={`${inputClass} mt-2 focus:border-rose-300`}
                      />
                    </div>
                  </div>
                )}

                {form.type === 'poll' && (
                  <div className="mt-4 space-y-3">
                    {(form.pollOptions || []).map((option, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          value={option}
                          onChange={(event) => updatePollOption(index, event.target.value)}
                          placeholder={`Lựa chọn ${index + 1}`}
                          className={inputClass}
                        />
                        {(form.pollOptions || []).length > 2 && (
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, pollOptions: form.pollOptions.filter((_, optionIndex) => optionIndex !== index) })}
                            className="rounded-2xl px-3 text-sm font-black text-rose-500 transition hover:bg-rose-100 dark:hover:bg-rose-500/10"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, pollOptions: [...(form.pollOptions || []), ''].slice(0, 8) })}
                      className="rounded-2xl bg-fuchsia-600 px-4 py-3 text-sm font-black text-white transition hover:bg-fuchsia-700"
                    >
                      + Thêm lựa chọn
                    </button>
                  </div>
                )}
              </div>

              <div className={sectionClass}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-white">4. Hình ảnh minh họa</h3>
                    <p className="mt-1 text-xs font-bold text-slate-400">Chức năng nào cũng có thể thêm ảnh bằng link hoặc tải file ảnh lên.</p>
                  </div>
                  {form.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, imageUrl: '', imageFileName: '', showImageInput: false })}
                      className="shrink-0 rounded-xl px-3 py-2 text-xs font-black text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-500/10"
                    >
                      Xóa ảnh
                    </button>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    value={form.imageUrl && !form.imageUrl.startsWith('data:') ? form.imageUrl : ''}
                    onChange={(event) => setForm({ ...form, imageUrl: event.target.value, imageFileName: '', showImageInput: Boolean(event.target.value) })}
                    placeholder="Dán link ảnh minh họa..."
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => imageFileInputRef.current?.click()}
                    className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-700"
                  >
                    Tải ảnh lên
                  </button>
                </div>

                <input
                  ref={imageFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageFile}
                />

                {form.imageFileName && (
                  <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300">
                    Ảnh đã chọn: {form.imageFileName}
                  </p>
                )}

                {form.imageUrl && (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
                    <img src={form.imageUrl} alt="Xem trước ảnh minh họa" className="max-h-72 w-full object-cover" />
                  </div>
                )}
              </div>
            </div>

            <aside className="space-y-5">
              <div className={sectionClass}>
                <h3 className="mb-3 text-sm font-black text-slate-800 dark:text-white">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {form.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setForm({ ...form, tags: form.tags.filter((item) => item !== tag) })}
                      className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700 dark:bg-violet-500/20 dark:text-violet-200"
                    >
                      #{tag} ×
                    </button>
                  ))}
                </div>
                <input
                  value={form.tagDraft}
                  onChange={(event) => {
                    const value = event.target.value
                    setForm({ ...form, tagDraft: value.startsWith('#') ? value : `#${value}` })
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addTag()
                    }
                  }}
                  placeholder="#Nhập tag rồi bấm Enter"
                  className={`${inputClass} mt-3`}
                />
              </div>

              <ToggleSwitch checked={form.isAnonymous} onChange={(checked) => setForm({ ...form, isAnonymous: checked })} icon="⌘" label="Đăng ẩn danh" />
            </aside>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-white/10">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Tối đa 10,000 ký tự</p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="rounded-2xl px-5 py-3 text-sm font-black text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10">
              Hủy
            </button>
            <button type="submit" className="rounded-2xl bg-violet-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-700 disabled:opacity-50">
              Đăng bài 🚀
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}


function ToggleSwitch({ checked, onChange, icon, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition ${
        checked
          ? 'border-violet-400 bg-violet-50 dark:border-violet-400/60 dark:bg-violet-500/15'
          : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
      }`}
    >
      <span className="flex items-center gap-3 text-sm font-black text-slate-700 dark:text-slate-200"><span>{icon}</span>{label}</span>
      <span className={`flex h-7 w-12 items-center rounded-full p-1 transition ${checked ? 'bg-violet-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
        <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  )
}

export default PostModal

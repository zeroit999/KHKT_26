import { KeyRound, Search } from 'lucide-react'
import DarkModeSelect from '../DarkModeSelect.jsx'

export default function LibraryToolbar({ page }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-5">
      <div className={`grid gap-3 ${page.isStudent ? 'xl:grid-cols-[1fr_220px_250px]' : 'xl:grid-cols-[1fr_190px_190px]'}`}>
        <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 dark:border-white/10 dark:bg-slate-900">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            value={page.search}
            onChange={(event) => page.setSearch(event.target.value)}
            placeholder="Tìm theo tên đề, môn học, chủ đề hoặc mã đề..."
            className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 dark:text-white"
          />
        </label>

        {page.isStudent ? (
          <>
            <DarkModeSelect
              value={page.subjectFilter}
              onChange={page.setSubjectFilter}
              options={[
                { value: 'all', label: 'Tất cả môn học' },
                ...page.availableSubjects.map((subject) => ({ value: subject, label: subject })),
              ]}
              buttonClassName="min-h-12 rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900"
            />
            <div className="flex gap-2">
              <label className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 dark:border-white/10 dark:bg-slate-900">
                <KeyRound className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  value={page.codeSearch}
                  onChange={(event) => page.setCodeSearch(event.target.value)}
                  placeholder="Nhập mã đề"
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-700 outline-none dark:text-white"
                />
              </label>
              <button type="button" onClick={page.openByCode} className="rounded-2xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700">
                Vào đề
              </button>
            </div>
          </>
        ) : (
          <>
            <DarkModeSelect
              value={page.privacyFilter}
              onChange={page.setPrivacyFilter}
              options={[
                { value: 'all', label: 'Mọi phạm vi' },
                { value: 'public', label: 'Công khai' },
                { value: 'private', label: 'Riêng tư' },
              ]}
              buttonClassName="min-h-12 rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900"
            />
            <DarkModeSelect
              value={page.publishFilter}
              onChange={page.setPublishFilter}
              options={[
                { value: 'all', label: 'Mọi trạng thái' },
                { value: 'published', label: 'Đang hoạt động' },
                { value: 'draft', label: 'Chưa mở' },
                { value: 'ended', label: 'Đã kết thúc' },
              ]}
              buttonClassName="min-h-12 rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900"
            />
          </>
        )}
      </div>
    </section>
  )
}

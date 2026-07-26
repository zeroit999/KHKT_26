import { BookOpenCheck, Plus, Search } from 'lucide-react'

export default function LibraryHero({ isStudent, totalExams, onCreate }) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-blue-200/70 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-6 text-white shadow-xl shadow-blue-500/15 sm:p-8">
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em]">
            <BookOpenCheck className="h-4 w-4" /> Kho đề thi
          </span>
          <h1 className="mt-4 text-3xl font-black sm:text-4xl">
            {isStudent ? 'Tìm đề phù hợp và bắt đầu luyện tập' : 'Quản lý toàn bộ đề thi tại một nơi'}
          </h1>
          <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-blue-50 sm:text-base">
            {isStudent
              ? 'Tìm kiếm theo môn học, nhập mã đề và theo dõi trạng thái làm bài của bạn.'
              : 'Theo dõi trạng thái xuất bản, phạm vi hiển thị và hoạt động của từng đề thi.'}
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white/12 px-4 py-3 text-sm font-black">
            <Search className="h-4 w-4" /> {totalExams} đề đang hiển thị
          </div>
        </div>

        {!isStudent && (
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-blue-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50 sm:w-auto"
          >
            <Plus className="h-5 w-5" /> Tạo đề thi
          </button>
        )}
      </div>
    </section>
  )
}

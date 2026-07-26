import { BookOpen } from 'lucide-react'

export default function LibraryEmptyState({ isStudent, onCreate }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-white/15 dark:bg-white/5">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-200">
        <BookOpen className="h-8 w-8" />
      </div>
      <h2 className="mt-5 text-xl font-black text-slate-950 dark:text-white">Chưa có đề thi phù hợp</h2>
      <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
        {isStudent ? 'Hãy thử thay đổi từ khóa hoặc bộ lọc để tìm đề thi khác.' : 'Bạn có thể thay đổi bộ lọc hoặc tạo đề thi đầu tiên.'}
      </p>
      {!isStudent && (
        <button type="button" onClick={onCreate} className="mt-5 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700">
          Tạo đề thi
        </button>
      )}
    </div>
  )
}

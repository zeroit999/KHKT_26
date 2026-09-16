import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  Trophy,
  Code2,
  CheckCircle2,
  CircleDashed,
  ChevronRight,
  TerminalSquare,
} from 'lucide-react';

const MOCK_PROBLEMS = [
  { id: 'Z001', title: 'Tổng hai số', topic: 'Cơ bản', difficulty: 'Dễ', points: 100, solved: 1248, status: 'solved' },
  { id: 'Z002', title: 'Ước chung lớn nhất', topic: 'Số học', difficulty: 'Dễ', points: 100, solved: 934, status: 'attempted' },
  { id: 'Z003', title: 'Sàng số nguyên tố', topic: 'Số học', difficulty: 'Trung bình', points: 150, solved: 681, status: 'none' },
  { id: 'Z004', title: 'Dãy con tăng dài nhất', topic: 'Quy hoạch động', difficulty: 'Khó', points: 250, solved: 326, status: 'none' },
  { id: 'Z005', title: 'Đường đi ngắn nhất', topic: 'Đồ thị', difficulty: 'Khó', points: 300, solved: 214, status: 'none' },
];

const FILTERS = [
  ['all', 'Tất cả'],
  ['none', 'Chưa làm'],
  ['attempted', 'Đã thử'],
  ['solved', 'Đã giải'],
];

function DifficultyBadge({ value }) {
  const style = value === 'Dễ'
    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    : value === 'Trung bình'
      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400';

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${style}`}>{value}</span>;
}

function StatusIcon({ status }) {
  if (status === 'solved') return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  if (status === 'attempted') return <CircleDashed className="h-5 w-5 text-amber-500" />;
  return <span className="block h-5 w-5 rounded-full border-2 border-slate-300 dark:border-slate-700" />;
}

export default function OJHome() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [difficulty, setDifficulty] = useState('all');

  const problems = useMemo(() => MOCK_PROBLEMS.filter((problem) => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || `${problem.id} ${problem.title} ${problem.topic}`.toLowerCase().includes(q);
    const matchesStatus = status === 'all' || problem.status === status;
    const matchesDifficulty = difficulty === 'all' || problem.difficulty === difficulty;
    return matchesQuery && matchesStatus && matchesDifficulty;
  }), [query, status, difficulty]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-400">
                <TerminalSquare className="h-4 w-4" /> ZUNY Online Judge
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Luyện lập trình & chấm bài tự động</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400 sm:text-base">
                Chọn bài, viết chương trình và xem kết quả chấm ngay sau khi nộp. Giao diện hiện dùng dữ liệu mẫu để hoàn thiện trải nghiệm trước khi kết nối hệ thống Judge.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs text-slate-500">Bài tập</div><div className="mt-1 text-xl font-black">{MOCK_PROBLEMS.length}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs text-slate-500">Đã giải</div><div className="mt-1 text-xl font-black text-emerald-500">1</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs text-slate-500">Điểm</div><div className="mt-1 text-xl font-black text-cyan-500">100</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(([value, label]) => (
              <button key={value} onClick={() => setStatus(value)} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${status === value ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-cyan-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm mã bài, tên bài, chủ đề..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-cyan-400 dark:border-slate-800 dark:bg-slate-900" />
            </label>
            <label className="relative">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-sm font-semibold outline-none dark:border-slate-800 dark:bg-slate-900">
                <option value="all">Mọi độ khó</option><option value="Dễ">Dễ</option><option value="Trung bình">Trung bình</option><option value="Khó">Khó</option>
              </select>
            </label>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                <tr><th className="w-16 px-5 py-4">TT</th><th className="px-5 py-4">Bài tập</th><th className="px-5 py-4">Chủ đề</th><th className="px-5 py-4">Độ khó</th><th className="px-5 py-4 text-center">Điểm</th><th className="px-5 py-4 text-center">Đã giải</th><th className="w-16 px-5 py-4" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {problems.map((problem) => (
                  <tr key={problem.id} className="group transition hover:bg-cyan-50/50 dark:hover:bg-cyan-950/10">
                    <td className="px-5 py-4"><StatusIcon status={problem.status} /></td>
                    <td className="px-5 py-4"><Link to={`/oj/problems/${problem.id}`} className="font-extrabold text-slate-900 transition hover:text-cyan-600 dark:text-white dark:hover:text-cyan-400">{problem.id} · {problem.title}</Link></td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{problem.topic}</td>
                    <td className="px-5 py-4"><DifficultyBadge value={problem.difficulty} /></td>
                    <td className="px-5 py-4 text-center font-bold">{problem.points}</td>
                    <td className="px-5 py-4 text-center text-slate-500 dark:text-slate-400">{problem.solved.toLocaleString('vi-VN')}</td>
                    <td className="px-5 py-4"><ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-cyan-500" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {problems.length === 0 && <div className="px-6 py-16 text-center text-sm text-slate-500">Không tìm thấy bài tập phù hợp.</div>}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/70"><div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-500"><Code2 className="h-5 w-5" /></div><div><div className="font-extrabold">Bài nộp gần đây</div><div className="text-sm text-slate-500">Theo dõi verdict và lịch sử nộp bài.</div></div></div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/70"><div className="flex items-center gap-3"><div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-500"><Trophy className="h-5 w-5" /></div><div><div className="font-extrabold">Bảng xếp hạng</div><div className="text-sm text-slate-500">So sánh điểm và số bài đã giải.</div></div></div></div>
        </div>
      </main>
    </div>
  );
}

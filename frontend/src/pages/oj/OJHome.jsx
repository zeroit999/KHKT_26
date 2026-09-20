import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { Link } from 'react-router-dom'

import {
  AlertCircle,
  Code2,
  LoaderCircle,
  Search,
  Terminal,
  Trophy,
} from 'lucide-react'

import { useAuth } from '../../contexts/AuthContext'
import ojApi from '../../services/ojApi'


const difficultyLabels = {
  EASY: 'Dễ',
  MEDIUM: 'Trung bình',
  HARD: 'Khó',
}


function DifficultyBadge({
  difficulty,
}) {
  const label =
    difficultyLabels[difficulty]
    || difficulty
    || 'Chưa xác định'

  const className =
    difficulty === 'EASY'
      ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400'
      : difficulty === 'MEDIUM'
        ? 'border-amber-500/25 bg-amber-500/10 text-amber-500 dark:text-amber-400'
        : 'border-red-500/25 bg-red-500/10 text-red-500 dark:text-red-400'

  return (
    <span
      className={
        `inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${className}`
      }
    >
      {label}
    </span>
  )
}


function CategoryTags({
  category,
}) {
  const tags =
    String(category || '')
      .split(/[,/|]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3)

  if (!tags.length) {
    return (
      <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-500">
        Chưa phân loại
      </span>
    )
  }

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-400"
        >
          {tag}
        </span>
      ))}
    </div>
  )
}


export default function OJHome() {
  const { canManageOJ } = useAuth()
  const [
    problems,
    setProblems,
  ] = useState([])

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    error,
    setError,
  ] = useState('')

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    difficulty,
    setDifficulty,
  ] = useState('all')


  useEffect(() => {
    let active = true

    const loadProblems = async () => {
      setLoading(true)
      setError('')

      try {
        const data =
          await ojApi.listProblems()

        if (!active) {
          return
        }

        setProblems(
          Array.isArray(data?.problems)
            ? data.problems
            : [],
        )
      } catch (loadError) {
        if (!active) {
          return
        }

        setError(
          loadError.message
          || 'Không thể tải danh sách bài toán.',
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadProblems()

    return () => {
      active = false
    }
  }, [])


  const filteredProblems =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase()

      return problems.filter(
        (problem) => {
          const code =
            String(
              String(problem.id || ''),
            ).toLowerCase()

          const title =
            String(
              problem.title || '',
            ).toLowerCase()

          const category =
            String(
              problem.category || '',
            ).toLowerCase()

          const matchesSearch =
            !keyword
            || code.includes(keyword)
            || title.includes(keyword)
            || category.includes(keyword)

          const matchesDifficulty =
            difficulty === 'all'
            || problem.difficulty
              === difficulty

          return (
            matchesSearch
            && matchesDifficulty
          )
        },
      )
    }, [
      problems,
      search,
      difficulty,
    ])


  const totalPoints =
    problems.reduce(
      (
        sum,
        problem,
      ) => (
        sum
        + Number(
          problem.points || 0,
        )
      ),
      0,
    )

  const clearFilters = () => {
    setSearch('')
    setDifficulty('all')
  }


  return (
    <section className="min-h-screen bg-[#f6f8fb] pb-16 pt-20 text-slate-950 transition-colors dark:bg-[#0d1117] dark:text-slate-100">
      <div className="border-b border-slate-200 bg-white/90 dark:border-[#29313b] dark:bg-[#161b22]">
        <div className="mx-auto flex h-14 max-w-[1070px] items-center gap-7 px-4 lg:px-0">
          <Link
            to="/oj"
            className="flex items-center gap-2.5"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 text-white shadow-sm">
              <Terminal className="h-4 w-4" />
            </span>

            <span className="hidden text-[15px] font-black sm:block">
              ZUNY OJ
            </span>
          </Link>

          <nav className="flex h-full items-center gap-1 overflow-x-auto">
            <Link
              to="/oj"
              className="flex h-full items-center border-b-2 border-blue-500 px-3 text-xs font-bold text-slate-900 dark:text-slate-100"
            >
              Danh sách bài làm
            </Link>

            <span className="flex h-full cursor-default items-center px-3 text-xs font-semibold text-slate-400">
              Kỳ thi
            </span>

            <span className="hidden h-full cursor-default items-center px-3 text-xs font-semibold text-slate-400 sm:flex">
              Xếp hạng
            </span>

            <span className="hidden h-full cursor-default items-center px-3 text-xs font-semibold text-slate-400 sm:flex">
              Bài nộp
            </span>
          
            {canManageOJ && (
              <Link
                to="/oj/manage"
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-black text-white transition hover:bg-violet-500"
              >
                Quản lý OJ
              </Link>
            )}

</nav>

          <div className="ml-auto hidden items-center gap-2 text-[11px] font-semibold text-slate-400 md:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />

            Hệ thống chấm bài
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1070px] px-4 pt-8 lg:px-0">
        <div className="mb-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-blue-500">
              <Code2 className="h-3.5 w-3.5" />

              ZUNY Online Judge
            </div>

            <h1 className="text-[23px] font-black tracking-tight">
              Danh sách bài làm
            </h1>

            <p className="mt-1 text-xs font-medium text-slate-400">
              {problems.length}
              {' bài toán · '}
              {totalPoints.toLocaleString(
                'vi-VN',
              )}
              {' điểm'}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            <label className="relative w-full md:w-[220px]">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />

              <input
                value={search}
                onChange={(event) => {
                  setSearch(
                    event.target.value,
                  )
                }}
                placeholder="Tìm bài toán..."
                className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-xs font-medium outline-none transition placeholder:text-slate-400 focus:border-blue-500 dark:border-[#30363d] dark:bg-[#161b22] dark:text-slate-200 dark:placeholder:text-slate-600"
              />
            </label>

            <select
              value={difficulty}
              onChange={(event) => {
                setDifficulty(
                  event.target.value,
                )
              }}
              className="h-9 min-w-[130px] rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold outline-none focus:border-blue-500 dark:border-[#30363d] dark:bg-[#161b22] dark:text-slate-300"
            >
              <option value="all">
                Tất cả
              </option>

              <option value="EASY">
                Dễ
              </option>

              <option value="MEDIUM">
                Trung bình
              </option>

              <option value="HARD">
                Khó
              </option>
            </select>

            {(search || difficulty !== 'all') && (
              <button
                type="button"
                onClick={clearFilters}
                className="h-9 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-500 transition hover:border-blue-300 hover:text-blue-600 dark:border-[#30363d] dark:text-slate-400 dark:hover:border-blue-500 dark:hover:text-blue-400"
              >
                Xóa lọc
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-500 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />

            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-[#30363d] dark:bg-[#161b22]">
          {loading ? (
            <div className="flex min-h-[330px] flex-col items-center justify-center gap-3">
              <LoaderCircle className="h-6 w-6 animate-spin text-blue-500" />

              <p className="text-xs font-semibold text-slate-500">
                Đang tải bài toán...
              </p>
            </div>
          ) : filteredProblems.length === 0 ? (
            <div className="flex min-h-[330px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-blue-500/10 text-blue-500">
                <Code2 className="h-6 w-6" />
              </div>

              <h2 className="text-sm font-black">
                {problems.length === 0
                  ? 'Chưa có bài toán'
                  : 'Không tìm thấy bài phù hợp'}
              </h2>

              <p className="mt-2 max-w-sm text-xs font-medium leading-5 text-slate-500">
                {problems.length === 0
                  ? 'Hiện chưa có bài lập trình được xuất bản trên hệ thống.'
                  : 'Hãy thử thay đổi từ khóa hoặc bộ lọc độ khó.'}
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100 dark:divide-[#252c34] md:hidden">
                {filteredProblems.map((problem) => (
                  <Link
                    key={problem.id}
                    to={`/oj/problem/${problem.id}`}
                    className="block px-4 py-4 transition active:bg-slate-50 dark:active:bg-[#1b222a]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-mono text-[11px] font-black text-blue-500 dark:text-[#58a6ff]">
                          {problem.id}
                        </span>
                        <p className="mt-1 line-clamp-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                          {problem.title}
                        </p>
                        <CategoryTags category={problem.category} />
                      </div>
                      <DifficultyBadge difficulty={problem.difficulty} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <span>{Number(problem.points || 0).toLocaleString('vi-VN')} điểm</span>
                      <span>{problem.timeLimitMs} ms</span>
                      <span>{problem.memoryLimitMb} MB</span>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[780px] border-collapse text-left">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-[#29313b] dark:bg-[#20262d]">
                  <tr className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400 dark:text-slate-500">
                    <th className="w-[76px] px-4 py-3">
                      Mã
                    </th>

                    <th className="px-4 py-3">
                      Bài làm
                    </th>

                    <th className="w-[100px] px-4 py-3 text-center">
                      Điểm
                    </th>

                    <th className="w-[110px] px-4 py-3 text-center">
                      Thời gian
                    </th>

                    <th className="w-[100px] px-4 py-3 text-center">
                      Bộ nhớ
                    </th>

                    <th className="w-[120px] px-4 py-3 text-center">
                      Độ khó
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-[#252c34]">
                  {filteredProblems.map(
                    (problem) => (
                      <tr
                        key={problem.id}
                        className="group transition-colors hover:bg-slate-50 dark:hover:bg-[#1b222a]"
                      >
                        <td className="px-4 py-3.5">
                          <Link
                            to={
                              `/oj/problem/${problem.id}`
                            }
                            className="font-mono text-xs font-black text-blue-500 transition hover:text-blue-600 dark:text-[#58a6ff]"
                          >
                            {problem.id}
                          </Link>
                        </td>

                        <td className="px-4 py-3.5">
                          <Link
                            to={
                              `/oj/problem/${problem.id}`
                            }
                            className="block"
                          >
                            <p className="text-[13px] font-bold text-slate-800 transition-colors group-hover:text-blue-600 dark:text-slate-200 dark:group-hover:text-[#58a6ff]">
                              {problem.title}
                            </p>

                            <CategoryTags
                              category={
                                problem.category
                              }
                            />
                          </Link>
                        </td>

                        <td className="px-4 py-3.5 text-center font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                          {Number(
                            problem.points || 0,
                          ).toLocaleString(
                            'vi-VN',
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-center font-mono text-[11px] font-semibold text-slate-500">
                          {problem.timeLimitMs}
                          {' ms'}
                        </td>

                        <td className="px-4 py-3.5 text-center font-mono text-[11px] font-semibold text-slate-500">
                          {problem.memoryLimitMb}
                          {' MB'}
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <DifficultyBadge
                            difficulty={
                              problem.difficulty
                            }
                          />
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[10px] font-semibold text-slate-500">
          <div className="flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5 text-blue-500" />

            Dữ liệu được tải trực tiếp từ
            Online Judge của ZUNY.
          </div>

          <span>
            Hiển thị{' '}
            {filteredProblems.length}
            {' / '}
            {problems.length}
            {' bài'}
          </span>
        </div>
      </main>
    </section>
  )
}

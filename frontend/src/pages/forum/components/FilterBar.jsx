import { useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { FILTER_TABS } from '../utils/forumConstants'

function FilterBar({
  filter,
  setFilter,
  sortBy,
  setSortBy,
  search = '',
  setSearch = () => {},
}) {
  const [sortOpen, setSortOpen] = useState(false)

  return (
    <div className="relative z-50 mb-4 flex items-center gap-3 overflow-visible pb-1">

      {/* FILTERS */}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pr-2">
        {FILTER_TABS.map((tab) => {
          const Icon = tab.icon
          const active = filter === tab.value

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilter(tab.value)}
              title={tab.label}
              className={`group flex h-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-xs font-black transition-all duration-300 ${
                active ? 'w-auto gap-1.5 px-3' : 'w-10 px-0'
              } ${
                active
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-white text-slate-500 hover:bg-slate-100 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />

              <span
                className={`whitespace-nowrap transition-all duration-300 ${
                  active ? 'max-w-24 opacity-100' : 'max-w-0 opacity-0'
                }`}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* SEARCH */}
      <div className="relative hidden w-[180px] shrink-0 lg:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm tên tác giả..."
          className="
            w-full rounded-2xl border border-slate-200
            bg-white px-9 py-2.5 text-xs font-bold
            text-slate-700 outline-none transition
            placeholder:text-slate-400
            focus:border-blue-400
            dark:border-white/10
            dark:bg-white/5
            dark:text-white
            dark:placeholder:text-slate-500
          "
        />
      </div>

      {/* SORT */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setSortOpen(!sortOpen)}
          className="
            flex min-w-[132px] items-center justify-between gap-3 rounded-2xl border
            border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700
            shadow-sm transition
            hover:border-blue-300
            hover:bg-blue-50
            hover:text-blue-700
            dark:border-white/10
            dark:bg-slate-900
            dark:text-white
            dark:hover:bg-white/10
          "
        >
          <span>
            {sortBy === 'newest' ? 'Mới nhất' : 'Phổ biến'}
          </span>

          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/10">
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ${
                sortOpen ? 'rotate-180' : ''
              }`}
            />
          </span>
        </button>

        {sortOpen && (
          <div
            className="
              absolute right-0 top-full z-[999]
              mt-2 w-40 overflow-hidden rounded-2xl border
              border-slate-200 bg-white p-1 shadow-2xl
              dark:border-white/10 dark:bg-slate-900
            "
          >
            {[
              ['newest', 'Mới nhất'],
              ['popular', 'Phổ biến'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setSortBy(value)
                  setSortOpen(false)
                }}
                className={`block w-full rounded-xl px-3 py-2.5 text-left text-xs font-black transition ${
                  sortBy === value
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


export default FilterBar

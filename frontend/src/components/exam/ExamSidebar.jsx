import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  ChevronUp,
  ClipboardList,
  DoorOpen,
  FileCheck2,
  LayoutDashboard,
  X,
} from 'lucide-react'

const STORAGE_KEY = 'zuny:exam-dynamic-island-pinned'

function ExamSidebar({ page, isStudent, activeItem: controlledActiveItem, onNavigate }) {
  const [pinned, setPinned] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopHovered, setDesktopHovered] = useState(false)
  const [internalActiveItem, setInternalActiveItem] = useState('overview')

  const activeItem = controlledActiveItem ?? internalActiveItem
  const desktopExpanded = pinned || desktopHovered

  const menuItems = useMemo(
    () =>
      isStudent
        ? [
            { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
            { id: 'repository', label: 'Kho đề thi', icon: BookOpen },
            { id: 'exam-room', label: 'Phòng thi', icon: DoorOpen },
            { id: 'statistics', label: 'Thống kê', icon: BarChart3 },
          ]
        : [
            { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
            { id: 'repository', label: 'Kho đề thi', icon: BookOpen },
            { id: 'exam-room', label: 'Phòng thi', icon: DoorOpen },
            { id: 'submissions', label: 'Danh sách nộp bài', icon: ClipboardList },
            { id: 'grading', label: 'Chấm tự luận', icon: FileCheck2 },
            { id: 'statistics', label: 'Thống kê', icon: BarChart3 },
          ],
    [isStudent, page],
  )

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(pinned))
    } catch {
      // localStorage có thể bị chặn; Dynamic Island vẫn hoạt động bình thường.
    }
  }, [pinned])

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMobileOpen(false)
        setDesktopHovered(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  const handleItemClick = (item) => {
    setInternalActiveItem(item.id)
    setMobileOpen(false)
    setDesktopHovered(false)
    onNavigate?.(item.id)
  }

  const renderIsland = ({ expanded, mobile = false }) => (
    <aside
      className={`relative flex shrink-0 flex-col overflow-hidden border border-white/15 bg-[#090f1f]/95 text-white ring-1 ring-black/10 backdrop-blur-2xl transition-[width,max-height,border-radius,transform,box-shadow] duration-300 ease-out ${
        expanded
          ? 'max-h-[560px] w-[288px] rounded-[30px] shadow-[0_28px_82px_rgba(15,23,42,0.44)]'
          : 'max-h-[270px] w-[76px] rounded-full shadow-[0_18px_46px_rgba(15,23,42,0.38)]'
      } ${desktopHovered && !mobile ? 'scale-[1.015]' : ''}`}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" />
      <div className="pointer-events-none absolute -right-12 top-12 h-28 w-28 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-14 bottom-10 h-28 w-28 rounded-full bg-indigo-500/10 blur-3xl" />

      {expanded ? (
        <div className="relative flex h-[54px] shrink-0 flex-row items-center gap-3 px-3.5">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-[0_7px_22px_rgba(99,102,241,0.30)] ring-1 ring-white/30">
            <span className="absolute inset-[3px] rounded-[9px] bg-gradient-to-br from-cyan-400 via-indigo-500 to-fuchsia-500" />
            <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-[#0b1224] text-sm font-black tracking-[-0.08em] text-white">
              Z
            </span>
          </div>

          <div className="min-w-0 max-w-[135px] translate-x-0 overflow-hidden opacity-100 transition-[opacity,max-width,transform] duration-300">
            <p className="truncate text-sm font-black tracking-tight">ZUNY Exam</p>
            <p className="truncate text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Điều hướng
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="ml-auto rounded-xl p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Đóng menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <nav
          className="relative flex h-[270px] w-[76px] shrink-0 flex-col items-center justify-center py-4"
          aria-label="Điều hướng nhanh"
        >
          <div
            className="mb-3 flex flex-col items-center"
            title="ZUNY Exam"
            aria-label="ZUNY Exam"
          >
            <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-[20px] bg-white shadow-[0_8px_24px_rgba(99,102,241,0.32)] ring-1 ring-white/35">
              <span className="absolute inset-[3px] rounded-[16px] bg-gradient-to-br from-cyan-400 via-indigo-500 to-fuchsia-500" />
              <span className="relative flex h-8 w-8 items-center justify-center rounded-[12px] bg-[#0b1224] text-sm font-black tracking-[-0.08em] text-white">
                Z
              </span>
            </div>
            <span className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/85">
              Exam
            </span>
          </div>

          <div className="mb-2 h-px w-10 bg-gradient-to-r from-transparent via-white/25 to-transparent" />

          <div className="flex flex-col items-center gap-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const active = activeItem === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  handleItemClick(item)
                }}
                className={`group relative flex h-7 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${
                  active
                    ? 'bg-white text-slate-950 shadow-[0_5px_15px_rgba(0,0,0,0.22)]'
                    : 'text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                title={item.label}
              >
                {active && (
                  <span className="absolute -left-1 h-4 w-0.5 rounded-full bg-gradient-to-b from-indigo-400 to-fuchsia-400 shadow-[0_0_9px_rgba(129,140,248,0.95)]" />
                )}
                <Icon className="h-5 w-5" />
              </button>
            )
          })}
          </div>
        </nav>
      )}

      <div
        className={`transition-[opacity,transform] duration-300 ${
          expanded ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
        }`}
        aria-hidden={!expanded}
      >
        <nav className="relative px-2.5 pb-1 pt-2">
          <div className="space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon
              const active = activeItem === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  disabled={!expanded}
                  tabIndex={expanded ? 0 : -1}
                  className={`group relative flex w-full items-center gap-2.5 rounded-[20px] px-2.5 py-2 text-left text-sm font-semibold transition-all duration-200 ${
                    active
                      ? 'bg-white text-slate-950 shadow-[0_9px_26px_rgba(0,0,0,0.20)]'
                      : 'text-slate-400 hover:bg-white/10 hover:text-white'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && (
                    <span className="absolute -left-1 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-indigo-400 to-fuchsia-400 shadow-[0_0_12px_rgba(129,140,248,0.9)]" />
                  )}

                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
                      active
                        ? 'bg-slate-950 text-white'
                        : 'bg-white/5 text-current group-hover:bg-white/10'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>

                  <span className="min-w-0 truncate">{item.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        <div className="shrink-0 p-2.5 pt-1">
          <div className="mb-2 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

          <button
            type="button"
            onClick={() => setPinned((value) => !value)}
            className="hidden w-full items-center gap-2.5 rounded-[20px] px-2.5 py-2 text-sm font-semibold text-slate-400 transition hover:bg-white/10 hover:text-white lg:flex"
            aria-label={pinned ? 'Bỏ ghim Dynamic Island' : 'Ghim Dynamic Island'}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/5">
              <ChevronUp
                className={`h-5 w-5 shrink-0 transition-transform duration-300 ${
                  pinned ? 'rotate-180' : ''
                }`}
              />
            </span>

            <span className="whitespace-nowrap">
              {pinned ? 'Bỏ ghim' : 'Ghim mở rộng'}
            </span>
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <>
      <div className="fixed left-4 top-1/2 z-40 flex h-[270px] w-[76px] -translate-y-1/2 flex-col items-center justify-center rounded-full border border-white/15 bg-[#090f1f] py-4 text-white shadow-xl shadow-slate-950/30 ring-1 ring-black/10 backdrop-blur-2xl lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="mb-3 flex flex-col items-center"
          aria-label="Mở menu ZUNY Exam"
          title="ZUNY Exam"
        >
          <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-[20px] bg-white shadow-[0_8px_24px_rgba(99,102,241,0.32)] ring-1 ring-white/35">
            <span className="absolute inset-[3px] rounded-[16px] bg-gradient-to-br from-cyan-400 via-indigo-500 to-fuchsia-500" />
            <span className="relative flex h-8 w-8 items-center justify-center rounded-[12px] bg-[#0b1224] text-sm font-black tracking-[-0.08em] text-white">
              Z
            </span>
          </span>
          <span className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/85">
            Exam
          </span>
        </button>

        <div className="mb-2 h-px w-10 bg-gradient-to-r from-transparent via-white/25 to-transparent" />

        <div className="flex flex-col items-center gap-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const active = activeItem === item.id

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleItemClick(item)}
              className={`relative flex h-7 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${
                active
                  ? 'bg-white text-slate-950 shadow-[0_5px_15px_rgba(0,0,0,0.22)]'
                  : 'text-slate-400 active:bg-white/10 active:text-white'
              }`}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              title={item.label}
            >
              {active && (
                <span className="absolute -left-1 h-4 w-0.5 rounded-full bg-gradient-to-b from-indigo-400 to-fuchsia-400 shadow-[0_0_9px_rgba(129,140,248,0.95)]" />
              )}
              <Icon className="h-5 w-5" />
            </button>
          )
        })}
        </div>
      </div>

      <div
        className="fixed left-4 top-1/2 z-[70] hidden -translate-y-1/2 lg:block"
        onMouseEnter={() => setDesktopHovered(true)}
        onMouseLeave={() => setDesktopHovered(false)}
      >
        {renderIsland({ expanded: desktopExpanded })}
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Đóng menu"
          />

          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            {renderIsland({ expanded: true, mobile: true })}
          </div>
        </div>
      )}
    </>
  )
}

export default ExamSidebar
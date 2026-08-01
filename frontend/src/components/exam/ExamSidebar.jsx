import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  DoorOpen,
  FileCheck2,
  LayoutDashboard,
  X,
} from 'lucide-react'

function ExamSidebar({
  page,
  darkMode: darkModeProp,
  isStudent,
  activeItem: controlledActiveItem,
  onNavigate,
  onExpandedChange,
}) {
  const [desktopHovered, setDesktopHovered] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [internalActiveItem, setInternalActiveItem] = useState('overview')

  const darkMode = darkModeProp ?? page?.dark ?? false
  const activeItem = controlledActiveItem ?? internalActiveItem
  const expanded = desktopHovered

  useEffect(() => {
    onExpandedChange?.(expanded)

    return () => onExpandedChange?.(false)
  }, [expanded, onExpandedChange])

  const menuItems = useMemo(
    () =>
      isStudent
        ? [
            {
              id: 'overview',
              label: 'Tổng quan',
              icon: LayoutDashboard,
            },
            {
              id: 'repository',
              label: 'Kho đề thi',
              icon: BookOpen,
            },
            {
              id: 'exam-room',
              label: 'Phòng thi',
              icon: DoorOpen,
            },
            {
              id: 'statistics',
              label: 'Thống kê',
              icon: BarChart3,
            },
          ]
        : [
            {
              id: 'overview',
              label: 'Tổng quan',
              icon: LayoutDashboard,
            },
            {
              id: 'repository',
              label: 'Kho đề thi',
              icon: BookOpen,
              badge: page?.exams?.length || 0,
            },
            {
              id: 'exam-room',
              label: 'Phòng thi',
              icon: DoorOpen,
            },
            {
              id: 'submissions',
              label: 'Danh sách bài nộp',
              icon: ClipboardList,
              badge: page?.studentResults?.length || 0,
            },
            {
              id: 'grading',
              label: 'Chấm tự luận',
              icon: FileCheck2,
              badge:
                page?.studentResults?.filter(
                  (item) => item.status === 'pending' || item.needsGrading,
                ).length || 0,
            },
            {
              id: 'statistics',
              label: 'Thống kê',
              icon: BarChart3,
            },
          ],
    [isStudent, page?.exams?.length, page?.studentResults],
  )

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileOpen(false)
        setDesktopHovered(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!mobileOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mobileOpen])

  const handleNavigate = (item) => {
    setInternalActiveItem(item.id)
    setMobileOpen(false)
    onNavigate?.(item.id)
  }

  const SidebarContent = ({ mobile = false }) => (
    <aside
      className={`relative flex h-fit max-h-[calc(100dvh-112px)] flex-col overflow-hidden rounded-[26px] border transition-[width] duration-300 ease-out ${
        mobile ? 'w-[220px]' : expanded ? 'w-[240px]' : 'w-[64px]'
      } ${
        darkMode
          ? 'border-white/10 bg-[#0b0b14] text-white shadow-none'
          : 'border-slate-200 bg-white text-slate-900 shadow-none'
      }`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <div
        className={`absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent to-transparent ${
          darkMode ? 'via-violet-300/45' : 'via-violet-400/55'
        }`}
      />

      </div>

      <div
        className={`flex h-[64px] shrink-0 items-center border-b ${
          expanded || mobile ? 'gap-3 px-3' : 'justify-center px-1'
        } ${darkMode ? 'border-white/8' : 'border-slate-200/80'}`}
      >
        <div
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[16px] shadow-[0_7px_22px_rgba(99,102,241,0.30)] ring-1 ${
            darkMode
              ? 'bg-white ring-white/30'
              : 'bg-slate-50 ring-violet-200'
          }`}
        >
          <span className="absolute inset-[3px] rounded-[11px] bg-gradient-to-br from-cyan-400 via-indigo-500 to-fuchsia-500" />

          <span
            className={`relative flex h-8 w-8 items-center justify-center rounded-[9px] text-sm font-black tracking-[-0.08em] ${
              darkMode
                ? 'bg-[#0b1224] text-white'
                : 'bg-white text-violet-700'
            }`}
          >
            Z
          </span>
        </div>

        {(expanded || mobile) && (
          <>
            <div className="min-w-0 flex-1">
              <p
                className={`truncate text-sm font-black tracking-wide ${
                  darkMode ? 'text-violet-200' : 'text-violet-700'
                }`}
              >
                ZUNY Exam
              </p>
            </div>

            {mobile && (
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className={`rounded-lg p-1.5 transition ${
                  darkMode
                    ? 'text-slate-400 hover:bg-white/10 hover:text-white'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
                aria-label="Đóng sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>

      <nav
        className={`shrink-0 py-3 ${
          expanded || mobile ? 'px-2.5' : 'px-1.5'
        }`}
        aria-label="Điều hướng đề thi"
      >
        <div className="space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon
            const active = activeItem === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item)}
                title={!expanded && !mobile ? item.label : undefined}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={`group relative flex h-11 w-full items-center rounded-[16px] transition-all duration-200 ${
                  expanded || mobile
                    ? 'gap-3 px-3'
                    : 'justify-center px-0'
                } ${
                  active
                    ? darkMode
                      ? 'bg-violet-600/35 text-violet-200 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.18)]'
                      : 'bg-violet-100 text-violet-700 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.16)]'
                    : darkMode
                      ? 'text-slate-500 hover:bg-white/6 hover:text-slate-200'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-violet-400 to-fuchsia-400 shadow-[0_0_10px_rgba(167,139,250,0.95)]" />
                )}

                <Icon
                  className={`h-5 w-5 shrink-0 transition ${
                    active
                      ? darkMode
                        ? 'text-violet-300'
                        : 'text-violet-600'
                      : 'text-current'
                  }`}
                />

                {(expanded || mobile) && (
                  <>
                    <span className="min-w-0 flex-1 truncate text-left text-[15px] font-semibold">
                      {item.label}
                    </span>

                    {Number(item.badge) > 0 && (
                      <span
                        className={`flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-black ${
                          darkMode
                            ? 'bg-violet-500/25 text-violet-200'
                            : 'bg-violet-100 text-violet-700'
                        }`}
                      >
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </aside>
  )

  return (
    <>
      <div
        className="fixed left-4 top-1/2 z-40 hidden -translate-y-1/2 lg:block"
        onMouseEnter={() => setDesktopHovered(true)}
        onMouseLeave={() => setDesktopHovered(false)}
      >
        <SidebarContent />
      </div>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className={`fixed left-3 top-1/2 z-40 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-2xl border shadow-none lg:hidden ${
          darkMode
            ? 'border-white/10 bg-[#0b0b14] text-violet-200'
            : 'border-slate-200 bg-white text-violet-700'
        }`}
        aria-label="Mở sidebar đề thi"
      >
        <LayoutDashboard className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button
            type="button"
            className={`absolute inset-0 backdrop-blur-sm ${
              darkMode ? 'bg-slate-950/65' : 'bg-slate-900/35'
            }`}
            onClick={() => setMobileOpen(false)}
            aria-label="Đóng sidebar"
          />

          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <SidebarContent mobile />
          </div>
        </div>
      )}
    </>
  )
}

export default ExamSidebar
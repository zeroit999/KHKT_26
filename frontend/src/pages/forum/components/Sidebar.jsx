import {
  Bell,
  Bookmark,
  FileText,
  Globe2,
  PanelLeftClose,
  PanelRightOpen,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { SECTIONS } from '../utils/forumConstants'

function Sidebar({
  activeSection,
  onChange,
  dark,
  onToggleDark,
  mobileOpen,
  onClose,
  roleKey,
  unreadNotificationsCount = 0,
  pendingReviewCount = 0,
  collapsed = false,
  onToggleCollapsed,
}) {
  const items = [
    { id: SECTIONS.HALL, label: 'Cộng đồng ZUNY', icon: Globe2 },
    { id: SECTIONS.GROUPS, label: 'Nhóm học', icon: Users },
    { id: SECTIONS.MY_POSTS, label: 'Bài của tôi', icon: FileText },
    { id: SECTIONS.SAVED, label: 'Đã lưu', icon: Bookmark },
    { id: SECTIONS.NOTIFICATIONS, label: 'Thông báo', icon: Bell, badge: unreadNotificationsCount },
    ...(roleKey === 'admin_dev'
      ? [{ id: SECTIONS.ADMIN_REVIEW, label: 'Quản lý', icon: ShieldCheck, badge: pendingReviewCount }]
      : []),
  ]

  const content = (
    <aside
      className={`flex h-full max-h-full shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white/95 p-4 shadow-xl shadow-slate-200/70 backdrop-blur transition-all duration-300 dark:border-white/10 dark:bg-slate-950/95 dark:shadow-black/20 ${
        collapsed ? 'w-24' : 'w-72'
      }`}
    >
      <div className={`shrink-0 flex items-center gap-3 px-2 py-2 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/25">
            <Globe2 className="h-6 w-6" />
          </div>

          {!collapsed && (
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">ZUNY Community</h1>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Cộng đồng học tập</p>
            </div>
          )}
        </div>

        <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 lg:hidden">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="mt-8 flex-1 space-y-2 overflow-y-auto pr-1">
        {items.map((item) => {
          const Icon = item.icon
          const active = activeSection === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              title={collapsed ? item.label : undefined}
              className={`flex w-full items-center rounded-2xl px-4 py-3 text-sm font-black transition ${
                collapsed ? 'justify-center' : 'gap-3'
              } ${
                active
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'
              }`}
            >
              <span className="relative inline-flex">
                <Icon className="h-5 w-5 shrink-0" />
                {item.badge > 0 && (
                  <span className="absolute -right-2.5 -top-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-400 px-1 text-[10px] font-black text-white shadow-lg shadow-cyan-400/40">
                    {item.badge > 999 ? '999+' : item.badge}
                  </span>
                )}
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto shrink-0 pt-4">
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
          className={`group hidden w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-500 shadow-sm transition-all duration-300 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600 hover:shadow-lg dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-violet-500/10 dark:hover:text-violet-200 lg:flex ${
            collapsed ? 'h-12 px-0' : ''
          }`}
        >
          {collapsed ? (
            <PanelRightOpen className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
          ) : (
            <>
              <PanelLeftClose className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
              <span className="whitespace-nowrap">Thu gọn menu</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )

  return (
    <>
      <div className="fixed left-0 top-[80px] z-40 hidden h-[calc(100vh-80px)] lg:block">{content}</div>
      {mobileOpen && <div className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm lg:hidden" onMouseDown={onClose}><div className="h-full" onMouseDown={(event) => event.stopPropagation()}>{content}</div></div>}
    </>
  )
}


export default Sidebar

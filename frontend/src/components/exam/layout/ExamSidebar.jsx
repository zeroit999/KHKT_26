import { ChevronLeft, ChevronRight, FileCheck2, Sparkles } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

import { getExamNavigationByRole } from '../../../constants/examNavigation.js'

function NavigationItem({ entry, collapsed, onNavigate }) {
  const location = useLocation()
  const Icon = entry.icon
  const isActive = Boolean(entry.path && location.pathname === entry.path)

  const className = [
    'group relative flex w-full items-center rounded-xl text-sm font-bold transition',
    collapsed ? 'justify-center px-3 py-3' : 'gap-3 px-3 py-3',
    isActive
      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
    entry.disabled ? 'cursor-not-allowed opacity-55' : '',
  ].join(' ')

  const content = (
    <>
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{entry.label}</span>}
      {!collapsed && entry.badge && (
        <span className={isActive ? 'rounded-full bg-white/20 px-2 py-0.5 text-[10px]' : 'rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700 dark:bg-blue-500/20 dark:text-blue-200'}>
          {entry.badge}
        </span>
      )}
      {collapsed && (
        <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white shadow-xl group-hover:block">
          {entry.label}{entry.disabled ? ' · Sắp ra mắt' : ''}
        </span>
      )}
    </>
  )

  if (entry.disabled) {
    return <button type="button" className={className} title={`${entry.label} · Sắp ra mắt`}>{content}</button>
  }

  return <Link to={entry.path} onClick={onNavigate} className={className}>{content}</Link>
}

export default function ExamSidebar({ role, collapsed, onToggle, onNavigate }) {
  const navigation = getExamNavigationByRole(role)

  return (
    <aside className={[
      'flex h-full flex-col border-r border-slate-200 bg-white/95 backdrop-blur-xl transition-[width] duration-300 dark:border-white/10 dark:bg-slate-950/95',
      collapsed ? 'w-[84px]' : 'w-[272px]',
    ].join(' ')}>
      <div className="flex h-20 items-center border-b border-slate-200 px-4 dark:border-white/10">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/25">
            <FileCheck2 className="h-6 w-6" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-base font-black text-slate-950 dark:text-white">Trung tâm đề thi</p>
              <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">Không gian thi trực tuyến</p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        {navigation.map((entry) => (
          <NavigationItem key={entry.id} entry={entry} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3 dark:border-white/10">
        {!collapsed && (
          <div className="mb-3 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 p-4 text-white shadow-lg shadow-blue-500/15">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em]"><Sparkles className="h-4 w-4" /> Kho đề thi</div>
            <p className="mt-2 text-xs font-semibold leading-5 text-blue-50">Các tính năng đang được hoàn thiện theo từng giai đoạn.</p>
          </div>
        )}
        <button type="button" onClick={onToggle} className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10" aria-label={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}>
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <><ChevronLeft className="h-5 w-5" /><span>Thu gọn</span></>}
        </button>
      </div>
    </aside>
  )
}

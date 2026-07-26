import { useEffect, useState } from 'react'

import ExamMobileSidebar from './ExamMobileSidebar.jsx'
import ExamPageHeader from './ExamPageHeader.jsx'
import ExamSidebar from './ExamSidebar.jsx'

const STORAGE_KEY = 'zuny.exam.sidebar.collapsed'

export default function ExamLayout({ role, title, description, action, children }) {
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === 'true')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(collapsed))
  }, [collapsed])

  useEffect(() => {
    if (!mobileOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [mobileOpen])

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-white">
      <div className="flex min-h-[calc(100vh-5rem)]">
        <div className="sticky top-20 hidden h-[calc(100vh-5rem)] shrink-0 lg:block">
          <ExamSidebar role={role} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
        </div>
        <ExamMobileSidebar open={mobileOpen} role={role} onClose={() => setMobileOpen(false)} />
        <div className="min-w-0 flex-1">
          <div className="sticky top-20 z-30"><ExamPageHeader title={title} description={description} action={action} onOpenMenu={() => setMobileOpen(true)} /></div>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  )
}

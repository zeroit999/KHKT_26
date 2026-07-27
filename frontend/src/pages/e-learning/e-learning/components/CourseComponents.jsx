import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { subjects, sortOptions, courseTextLimits } from '../constants/courseConstants'
import { MenuIcon, SearchIcon, CloseIcon, PlayIcon, MoreIcon, HomeIcon, HistoryIcon, BookmarkIcon, UserIcon, ReportHistoryIcon, ManageIcon, NotificationIcon, FlagIcon, LinkIcon, EditIcon, TrashIcon, DocumentIcon, LargeFormatIcon } from '../icons/Icons'
import { stripHtml, getCourseTeacherName, isCourseLocked, isHotCourse, getVideoDuration, formatViews, formatRelativeDate, getInitials, getCourseFormat, formatDate, normalizeLessons, normalizeChecklist, normalizeQuiz, getEmptyLesson, getYoutubeVideoId, getYoutubeDurationSeconds, formatVideoDuration, generateLibraryCourseCode, normalizeYoutubeUrl, getYoutubeEmbedUrl, countWords, limitWords } from '../utils/courseUtils'

function getSidebarItems(isAdmin, badges = {}) {
  return [
    { id: 'home', label: 'Trang chủ', description: 'Hiển thị tất cả bài học', icon: HomeIcon },
    { id: 'watched', label: 'Đã xem', description: 'Bài đã xem hoặc đang học dở', icon: HistoryIcon },
    ...(isAdmin ? [{ id: 'manage', label: 'Quản lý', description: 'Duyệt bài đăng và xử lý báo cáo', icon: ManageIcon, badge: badges.manage }] : []),
    { id: 'account', label: 'Tài khoản chính', description: 'Thông tin tài khoản ZUNY', icon: UserIcon },
    { id: 'notifications', label: 'Thông báo', description: 'Tất cả hoạt động và sự kiện mới', icon: NotificationIcon, badge: badges.notifications },
  ]
}

export function DesktopSidebar({ collapsed, activeItem, canCreate, isAdmin = false, onCollapse, onSelect, onCreate, followingAccounts = [], onOpenFollowing, onViewFollowing, badges = {} }) {
  return (
    <aside className={`sticky top-0 hidden h-dvh shrink-0 border-r border-slate-200/80 bg-slate-50 px-3 py-4 transition-[width] duration-200 dark:border-white/[0.08] dark:bg-[#111827] xl:block ${collapsed ? 'w-[76px]' : 'w-[248px]'}`}>
      <div className="flex h-full flex-col">
        <div className="flex items-center px-1"><button type="button" onClick={onCollapse} className="cursor-pointer grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-600 transition hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Thu gọn sidebar"><MenuIcon /></button></div>
        <nav className="mt-5 space-y-1.5">
          {getSidebarItems(isAdmin, badges).map((item) => {
            const Icon = item.icon
            const active = activeItem === item.id
            return (
              <button key={item.id} type="button" onClick={() => onSelect(item.id)} title={collapsed ? item.label : undefined} className={`group flex w-full cursor-pointer items-center rounded-xl py-3 text-sm font-semibold transition ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'} ${active ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/20' : 'text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.07] dark:hover:text-white'}`}>
                <span className="relative shrink-0"><Icon />{Number(item.badge||0)>0&&<span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white ring-2 ring-slate-50 dark:ring-[#111827]">{Math.min(99,Number(item.badge||0))}</span>}</span>
                {!collapsed && <span className="min-w-0 text-left"><span className="block truncate">{item.label}</span><span className={`mt-0.5 block truncate text-[11px] font-medium ${active ? 'text-blue-500 dark:text-blue-300/80' : 'text-slate-400 dark:text-slate-500'}`}>{item.description}</span></span>}
              </button>
            )
          })}
        </nav>
        {!collapsed && <FollowingSidebarList accounts={followingAccounts} onOpen={onOpenFollowing} onViewAll={onViewFollowing} />}
      </div>
    </aside>
  )
}
export function MobileSidebar({ open, activeItem, canCreate, isAdmin = false, onClose, onSelect, onCreate, followingAccounts = [], onOpenFollowing, onViewFollowing, badges = {} }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 xl:hidden">
      <button type="button" className="absolute inset-0 cursor-pointer bg-black/60" onClick={onClose} aria-label="Đóng menu" />
      <aside className="relative h-full w-[min(88vw,320px)] overflow-y-auto bg-slate-50 p-4 shadow-2xl dark:bg-[#111827]">
        <div className="flex items-center justify-end"><button type="button" onClick={onClose} className="cursor-pointer grid h-10 w-10 place-items-center rounded-full hover:bg-white dark:hover:bg-white/10"><CloseIcon /></button></div>
        <nav className="mt-5 space-y-1.5">
          {getSidebarItems(isAdmin, badges).map((item) => {
            const Icon = item.icon
            const active = activeItem === item.id
            return <button key={item.id} type="button" onClick={() => onSelect(item.id)} className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left transition ${active ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/20' : 'text-slate-700 hover:bg-white dark:text-slate-300 dark:hover:bg-white/[0.07]'}`}><span className="relative shrink-0"><Icon />{Number(item.badge||0)>0&&<span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white ring-2 ring-slate-50 dark:ring-[#111827]">{Math.min(99,Number(item.badge||0))}</span>}</span><span className="min-w-0 flex-1"><span className="block text-sm font-bold">{item.label}</span><span className="mt-0.5 block truncate text-xs text-slate-400 dark:text-slate-500">{item.description}</span></span></button>
          })}
        </nav>
        <FollowingSidebarList accounts={followingAccounts} onOpen={onOpenFollowing} onViewAll={onViewFollowing} mobile />
      </aside>
    </div>
  )
}
function FollowingSidebarList({ accounts, onOpen, onViewAll, mobile = false }) {
  const [visibleCount, setVisibleCount] = useState(3)
  const visibleAccounts = accounts.slice(0, visibleCount)
  const hasMore = visibleCount < accounts.length

  useEffect(() => {
    setVisibleCount((current) => Math.max(3, Math.min(current, Math.max(3, accounts.length))))
  }, [accounts.length])

  return (
    <div className={`${mobile ? 'mt-5' : 'mt-4'} min-h-0 border-t border-slate-200 pt-4 dark:border-white/10`}>
      <button
        type="button"
        onClick={() => onViewAll?.()}
        className="mb-2 flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white dark:hover:bg-white/[0.07]"
        aria-label="Mở danh sách tài khoản đang theo dõi"
      >
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Đang theo dõi</span>
        <span className="flex items-center gap-1.5">
          {accounts.length > 0 && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-500 dark:bg-white/10 dark:text-slate-300">{accounts.length}</span>}
          <span className="text-xs font-black text-slate-400">›</span>
        </span>
      </button>
      {accounts.length ? (
        <>
          <div className="space-y-1">
            {visibleAccounts.map((account) => {
              const name = account.fullName || account.name || account.displayName || account.email || 'Tài khoản ZUNY'
              const avatar = account.photoURL || account.avatar || account.avatarUrl || account.profileImage || ''
              const normalizedRole = String(account.role || account.Role || account.accountType || account.userRole || account.type || '').trim().replace(/[\s_-]/g, '').toUpperCase()
              const isAdminAccount = ['ADMIN', 'ADMINDEV'].includes(normalizedRole)
              const isVerifiedAccount = Boolean(account.elearningVerified)
              return (
                <button key={account.id} type="button" onClick={() => onOpen?.(account)} className="group flex w-full items-center gap-3 overflow-visible rounded-xl px-2 py-2 text-left transition duration-200 hover:translate-x-0.5 hover:bg-white dark:hover:bg-white/[0.07]">
                  <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-visible rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-black text-white transition group-hover:scale-105">
                    <span className="h-full w-full overflow-hidden rounded-full">{avatar ? <img src={avatar} alt={name} className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center">{getInitials(name)}</span>}</span>
                    {(isAdminAccount || isVerifiedAccount) && <span className={`absolute -bottom-1 -right-1 z-20 grid h-4 w-4 place-items-center rounded-full border-2 border-slate-50 text-[8px] font-black text-white shadow dark:border-[#111827] ${isAdminAccount ? 'bg-amber-500' : 'bg-blue-600'}`}>✓</span>}
                    {Number(account.unreadCount || 0) > 0 && <span className="absolute -right-2 -top-2 z-30 grid h-5 min-w-5 animate-pulse place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white shadow ring-2 ring-slate-50 dark:ring-[#111827]">{Math.min(99, Number(account.unreadCount || 0))}</span>}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-700 dark:text-slate-200">{name}</span>{isAdminAccount ? <span className="shrink-0 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-1.5 py-0.5 text-[8px] font-black text-white">ADMIN</span> : null}</span>
                </button>
              )
            })}
          </div>
          {hasMore && (
            <button type="button" onClick={() => setVisibleCount((current) => Math.min(accounts.length, current + 3))} className="mt-2 w-full rounded-xl px-3 py-2 text-xs font-black text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10">
              Xem thêm 3 tài khoản
            </button>
          )}
        </>
      ) : (
        <p className="px-2 py-4 text-center text-xs leading-5 text-slate-400">Bạn chưa theo dõi tài khoản nào.</p>
      )}
    </div>
  )
}

export function VideoSection({ title, subtitle, children, sectionRef }) {
  return <section ref={sectionRef} className="mb-9 scroll-mt-32"><div className="mb-4"><h2 className="text-xl font-black tracking-tight sm:text-2xl">{title}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p></div>{children}</section>
}
export function VideoGrid({ children }) { return <div className="grid grid-cols-1 gap-x-4 gap-y-6 min-[560px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 min-[1800px]:grid-cols-5">{children}</div> }
export function VideoCourseCard({ course, canManage, teacherProfilesById, openMenuId, onToggleMenu, onOpen, onUpdate, onDelete, onCopy, onReport, onSave, onOpenChannel, featured = false }) {
  const teacherName = getCourseTeacherName(course, teacherProfilesById)
  const locked = isCourseLocked(course)
  const progress = Math.round(Number(course.progress || 0))
  const menuOpen = openMenuId === course.id
  const format = getCourseFormat(course)
  const typeConfig = {
    video: {
      label: 'VIDEO',
      icon: <PlayIcon filled />,
      accent: 'from-rose-600 via-red-600 to-fuchsia-700',
      border: 'border-rose-300/70 dark:border-rose-400/20',
      ring: 'ring-rose-300/70 dark:ring-rose-400/20',
      text: 'hover:text-rose-600 dark:hover:text-rose-400',
      progress: 'bg-rose-500',
      watermark: 'VIDEO',
    },
    document: {
      label: 'TÀI LIỆU',
      icon: <DocumentIcon />,
      accent: 'from-emerald-600 via-teal-600 to-cyan-700',
      border: 'border-emerald-300/70 dark:border-emerald-400/20',
      ring: 'ring-emerald-300/70 dark:ring-emerald-400/20',
      text: 'hover:text-emerald-600 dark:hover:text-emerald-400',
      progress: 'bg-emerald-500',
      watermark: String(course.documentFileType || course.wordFileName || '').toLowerCase().includes('pdf') ? 'PDF' : 'DOC',
    },
    simulation: {
      label: 'MÔ PHỎNG',
      icon: <LargeFormatIcon format="simulation" />,
      accent: 'from-violet-700 via-purple-700 to-indigo-700',
      border: 'border-violet-300/70 dark:border-violet-400/20',
      ring: 'ring-violet-300/70 dark:ring-violet-400/20',
      text: 'hover:text-violet-600 dark:hover:text-violet-400',
      progress: 'bg-violet-500',
      watermark: 'SIMULATION',
    },
  }[format] || {
    label: 'BÀI HỌC', icon: <span className="text-2xl">✦</span>, accent: 'from-blue-600 to-indigo-700',
    border: 'border-blue-300/70 dark:border-blue-400/20', ring: 'ring-blue-300/70 dark:ring-blue-400/20',
    text: 'hover:text-blue-600 dark:hover:text-blue-400', progress: 'bg-blue-500', watermark: 'LEARNING',
  }
  const teacherProfile = teacherProfilesById?.[course?.teacherId] || teacherProfilesById?.[course?.createdByUid] || teacherProfilesById?.[course?.createdBy] || teacherProfilesById?.[course?.ownerId] || teacherProfilesById?.[course?.userId] || teacherProfilesById?.[course?.uid] || {}
  const teacherAvatar = teacherProfile?.photoURL || teacherProfile?.avatar || teacherProfile?.avatarUrl || teacherProfile?.profileImage || teacherProfile?.profilePicture || teacherProfile?.imageUrl || course?.teacherAvatar || course?.teacherPhotoURL || ''
  const isOfficial = ['ADMINDEV','ADMIN'].includes(String(course.createdByRole || '').replace(/[\s_-]/g, '').toUpperCase())
  const hasThumbnail = Boolean(String(course.thumbnail || '').trim())

  return (
    <article className={`group relative min-w-0 overflow-visible rounded-[18px] sm:rounded-[22px] border bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl dark:bg-[#111827] ${menuOpen ? 'z-[120]' : 'z-0'} ${typeConfig.border} ${locked ? 'opacity-70 grayscale-[0.65]' : ''}`}>
      <div className="relative aspect-video overflow-hidden">
        <button type="button" onClick={() => onOpen(course)} className="absolute inset-0 z-10 block h-full w-full" aria-label={`Mở ${stripHtml(course.title)}`} />
        <CourseThumbnail course={course} />
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${typeConfig.accent} ${course.thumbnail ? 'opacity-20 mix-blend-multiply dark:mix-blend-screen' : 'opacity-100'}`} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/15" />
        <span className="pointer-events-none absolute -bottom-2 left-3 max-w-[90%] truncate text-[42px] font-black tracking-[-0.08em] text-white/[0.10] sm:text-[52px]">{typeConfig.watermark}</span>
        <div className="absolute left-2.5 top-2.5 z-20 flex flex-wrap gap-1.5">
          <span className={`inline-flex h-8 max-w-full items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg bg-gradient-to-r ${typeConfig.accent} px-2.5 text-[10px] font-black leading-none tracking-wide text-white shadow-lg`}>
            <span className="grid h-4 w-4 shrink-0 place-items-center overflow-hidden [&_svg]:!h-3.5 [&_svg]:!w-3.5">
              {typeConfig.icon}
            </span>
            <span className="truncate leading-none">{typeConfig.label}</span>
          </span>
          {featured && <VideoBadge>Đề xuất</VideoBadge>}
          {isOfficial && <span className="rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-1.5 text-[10px] font-black text-white shadow-lg">★ OFFICIAL</span>}
          {isHotCourse(course) && <VideoBadge hot>Nổi bật</VideoBadge>}
        </div>
        <div className={`pointer-events-none absolute inset-0 z-[5] grid place-items-center transition-opacity duration-300 ${format === 'video' && hasThumbnail ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
          <span className={`grid h-16 w-16 place-items-center rounded-2xl border border-white/25 bg-gradient-to-br ${typeConfig.accent} text-white shadow-2xl transition duration-300 group-hover:scale-110 group-hover:rounded-full [&_svg]:h-7 [&_svg]:w-7`}>
            {typeConfig.icon}
          </span>
        </div>
        {locked && <span className="absolute bottom-11 left-2.5 z-20 rounded-lg bg-slate-950/90 px-2.5 py-1.5 text-[10px] font-black text-white shadow">Chưa tới thời gian mở bài học</span>}
        <span className="absolute bottom-2.5 right-2.5 z-20 rounded-md bg-black/80 px-2 py-1 text-[11px] font-black text-white backdrop-blur">{getVideoDuration(course)}</span>
        {progress > 0 && <div className="absolute inset-x-0 bottom-0 z-20 h-1.5 bg-white/35"><div className={`h-full ${progress >= 100 ? 'bg-emerald-400' : typeConfig.progress}`} style={{ width: `${Math.min(100, progress)}%` }} /></div>}
      </div>
      <div className="flex gap-2.5 p-3 sm:gap-3 sm:p-3.5">
        <button type="button" onClick={(event) => { event.stopPropagation(); onOpenChannel?.(course) }} title={`Mở kênh của ${teacherName}`} className={`relative grid h-10 w-10 shrink-0 place-items-center overflow-visible rounded-full bg-gradient-to-br ${typeConfig.accent} text-xs font-black text-white ring-2 transition hover:scale-105 ${typeConfig.ring}`}>
          <span className="h-full w-full overflow-hidden rounded-full">{teacherAvatar ? <img src={teacherAvatar} alt={teacherName} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <span className="grid h-full w-full place-items-center">{getInitials(teacherName)}</span>}</span>
          {(isOfficial || teacherProfile?.elearningVerified) && <span className={`absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full border-2 border-white text-[8px] font-black text-white shadow ${isOfficial ? 'bg-amber-500' : 'bg-blue-600'}`}>✓</span>}
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onOpen(course)} className={`block w-full max-w-[210px] truncate whitespace-nowrap text-left text-[15px] font-black leading-5 text-slate-950 transition dark:text-white sm:max-w-[240px] ${typeConfig.text}`} title={stripHtml(course.title)}>{stripHtml(course.title)}</button>
          <div className="mt-1 flex min-w-0 items-center gap-2"><p className="truncate text-sm font-semibold text-slate-600 dark:text-slate-300">{teacherName}</p>{isOfficial?<span className="shrink-0 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[9px] font-black text-white">ADMIN ✓</span>:teacherProfile?.elearningVerified?<span className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-black text-white">✓</span>:null}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{course.category || 'Môn học'}</span><span>•</span><span>{formatViews(course.views)} lượt xem</span><span>•</span><span>{formatRelativeDate(course.createdAt || course.updatedAt)}</span>
          </div>
        </div>
        <div className="relative z-50 shrink-0" onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={(event) => { event.stopPropagation(); onToggleMenu(menuOpen ? null : course.id) }} className={`grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white ${menuOpen ? 'bg-slate-100 text-slate-950 dark:bg-white/10 dark:text-white' : ''}`} aria-label="Tùy chọn" aria-expanded={menuOpen}>
            <MoreIcon />
          </button>
          {menuOpen && <CourseMenu course={course} canManage={canManage} onOpen={onOpen} onUpdate={onUpdate} onDelete={onDelete} onCopy={onCopy} onReport={onReport} onSave={onSave} />}
        </div>
      </div>
    </article>
  )
}
export function CourseMenu({ course, canManage, onUpdate, onDelete, onCopy, onReport }) {
  return <div onClick={(event) => event.stopPropagation()} className="fixed inset-x-3 bottom-3 z-[200] max-h-[70vh] overflow-y-auto rounded-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-11 sm:w-56 sm:rounded-xl overflow-hidden rounded-xl border border-slate-200 bg-white py-2 shadow-2xl dark:border-white/10 dark:bg-[#282828]"><MenuAction icon={LinkIcon} label="Sao chép liên kết" onClick={(event) => { event.stopPropagation(); onCopy?.(course) }} /><MenuAction icon={FlagIcon} label="Báo cáo" onClick={() => onReport?.(course)} />{canManage && <><MenuAction icon={EditIcon} label="Cập nhật" onClick={() => onUpdate(course)} /><MenuAction icon={TrashIcon} label="Xóa bài học" danger onClick={() => onDelete(course)} /></>}</div>
}

export function MenuAction({ icon: Icon, label, onClick, danger=false, accent=false }) { return <button type="button" onClick={(event) => { event.stopPropagation(); onClick?.(event) }} className={`flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/10 ${danger ? 'text-rose-600' : accent ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : ''}`}><Icon />{label}</button> }
export function CourseThumbnail({ course }) {
  const [failed, setFailed] = useState(false)
  const format = getCourseFormat(course)
  const visual = {
    video: { gradient: 'from-rose-600 via-red-600 to-fuchsia-800', icon: <PlayIcon filled />, label: 'VIDEO BÀI GIẢNG' },
    document: { gradient: 'from-emerald-600 via-teal-600 to-cyan-800', icon: <DocumentIcon />, label: 'TÀI LIỆU HỌC TẬP' },
    simulation: { gradient: 'from-violet-700 via-purple-700 to-indigo-900', icon: <LargeFormatIcon format="simulation" />, label: 'MÔ PHỎNG TƯƠNG TÁC' },
  }[format] || { gradient: 'from-blue-600 to-indigo-800', icon: <LargeFormatIcon format={format} />, label: 'BÀI HỌC ZUNY' }

  if (course.thumbnail && !failed) return <img src={course.thumbnail} onError={() => setFailed(true)} alt={stripHtml(course.title)} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]" />
  return <div className={`relative grid h-full place-items-center overflow-hidden bg-gradient-to-br ${visual.gradient}`}><div className="absolute -left-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl"/><div className="absolute -bottom-16 -right-8 h-48 w-48 rounded-full bg-black/15 blur-2xl"/><div className="relative text-center text-white"><div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl [&_svg]:h-10 [&_svg]:w-10 border border-white/20 bg-white/10 shadow-2xl backdrop-blur">{visual.icon}</div><p className="mt-4 text-xs font-black tracking-[0.18em] text-white/90">{visual.label}</p><p className="mt-2 max-w-[240px] truncate px-4 text-sm font-bold text-white/80">{course.category || 'Bài học ZUNY'}</p></div></div>
}
export function ContinueVideoCard({ course, teacherProfilesById, onOpen }) { const teacher=getCourseTeacherName(course,teacherProfilesById); return <button type="button" onClick={() => onOpen(course)} className="w-[310px] shrink-0 text-left sm:w-[360px]"><div className="relative aspect-video overflow-hidden rounded-xl bg-slate-200"><CourseThumbnail course={course}/><div className="absolute inset-x-0 bottom-0 h-1 bg-white/40"><div className="h-full bg-red-600" style={{width:`${course.progress||0}%`}}/></div><span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-bold text-white">{Math.round(course.progress||0)}%</span></div><p className="mt-2 line-clamp-2 font-bold">{stripHtml(course.title)}</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{teacher} • {formatDate(course.lastViewedAt)}</p></button> }
export function RecentVideoRow({ course,onOpen }) { return <button type="button" onClick={() => onOpen(course)} className="flex min-w-0 gap-3 rounded-xl p-2 text-left hover:bg-slate-100 dark:hover:bg-white/5"><div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg"><CourseThumbnail course={course}/><span className="absolute bottom-1 right-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">Hoàn thành</span></div><div className="min-w-0 py-1"><p className="line-clamp-2 text-sm font-bold">{stripHtml(course.title)}</p><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Xem lại • {formatDate(course.lastViewedAt)}</p></div></button> }
export function VideoBadge({ children,hot=false }) { return <span className={`rounded px-2 py-1 text-[10px] font-black text-white shadow ${hot?'bg-red-600':'bg-black/75'}`}>{children}</span> }
export function VideoSkeleton() { return <div className="animate-pulse"><div className="aspect-video rounded-xl bg-slate-200 dark:bg-white/10"/><div className="mt-3 flex gap-3"><div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-white/10"/><div className="flex-1 space-y-2"><div className="h-4 rounded bg-slate-200 dark:bg-white/10"/><div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-white/10"/></div></div></div> }
export function EmptyLibraryState({ canCreate, search, onReset, onCreate }) { return <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center dark:border-white/15"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-white/10"><SearchIcon large /></div><h3 className="mt-4 text-xl font-black">Không tìm thấy bài học</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">{search ? `Không có kết quả phù hợp với “${search}”. Hãy thử từ khóa hoặc bộ lọc khác.` : 'Thư viện chưa có nội dung phù hợp với bộ lọc hiện tại.'}</p><div className="mt-5 flex flex-wrap justify-center gap-2"><button type="button" onClick={onReset} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10">Xóa bộ lọc</button>{canCreate && <button type="button" onClick={onCreate} className="rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Đăng bài học</button>}</div></div> }
export function FilterModal(props) {
  const {
    rightSubjectFilter,
    setRightSubjectFilter,
    rightClassFilter,
    setRightClassFilter,
    rightFormatFilter,
    setRightFormatFilter,
    rightProgressFilter,
    setRightProgressFilter,
    rightExamFilter,
    setRightExamFilter,
    sortBy,
    setSortBy,
    teacherClasses,
    resultCount = 0,
    onApply,
    onReset,
    onClose,
  } = props

  const activeFilters = [
    rightExamFilter !== 'all' && {
      id: 'exam',
      label: rightExamFilter === 'đgnl' ? 'ĐGNL' : 'THPT',
      clear: () => setRightExamFilter('all'),
    },
    rightSubjectFilter !== 'All' && {
      id: 'subject',
      label: rightSubjectFilter,
      clear: () => setRightSubjectFilter('All'),
    },
    rightClassFilter !== 'All' && {
      id: 'class',
      label: rightClassFilter,
      clear: () => setRightClassFilter('All'),
    },
    rightFormatFilter !== 'all' && {
      id: 'format',
      label: {
        video: 'Video',
        document: 'Word/PDF',
        code: 'Code',
        lesson: 'Bài học',
      }[rightFormatFilter] || rightFormatFilter,
      clear: () => setRightFormatFilter('all'),
    },
    rightProgressFilter !== 'all' && {
      id: 'progress',
      label: {
        new: 'Chưa học',
        progress: 'Đang học',
        done: 'Đã hoàn thành',
      }[rightProgressFilter] || rightProgressFilter,
      clear: () => setRightProgressFilter('all'),
    },
  ].filter(Boolean)

  const sortChoices = [
    { value: 'newest', label: 'Mới nhất', icon: '↘' },
    { value: 'oldest', label: 'Cũ nhất', icon: '↗' },
    { value: 'featured', label: 'Nổi bật', icon: '✦' },
    { value: 'mostViewed', label: 'Xem nhiều', icon: '◉' },
  ]

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-3xl">
      <div className="flex h-[100dvh] max-h-[100dvh] flex-col bg-white sm:h-auto sm:max-h-[92vh] text-slate-950 dark:bg-[#111827] dark:text-white">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 via-white to-indigo-50 px-5 py-5 dark:border-white/10 dark:from-blue-500/10 dark:via-transparent dark:to-violet-500/10 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">Bộ lọc thông minh</p>
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-black text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                {activeFilters.length} tiêu chí
              </span>
            </div>
            <h2 className="mt-1 text-2xl font-black tracking-tight">Tìm đúng bài học cần học</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Chọn nhanh theo nội dung, môn học, lớp 10/11/12, định dạng và tiến độ cá nhân.</p>
          </div>
          <span className="grid min-h-11 min-w-11 place-items-center"><IconButton onClick={onClose}><CloseIcon /></IconButton></span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <FilterSection index="01" title="Loại nội dung" description="Chọn nhóm nội dung chính trước khi tinh chỉnh thêm.">
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-white/[0.05]">
              {[
                ['all', 'Tất cả', '◎'],
                ['đgnl', 'ĐGNL', '🧠'],
                ['thpt', 'THPT', '🎓'],
              ].map(([value, label, icon]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRightExamFilter(value)}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition-all ${
                    rightExamFilter === value
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                      : 'text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.08] dark:hover:text-white'
                  }`}
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </FilterSection>

          <FilterSection index="02" title="Phân loại học tập" description="Kết hợp nhiều tiêu chí để thu hẹp kết quả.">
            <div className="grid gap-4 sm:grid-cols-2">
              <SmartFilterSelect
                label="Môn học"
                value={rightSubjectFilter}
                onChange={setRightSubjectFilter}
                options={[{ value: 'All', label: 'Tất cả môn' }, ...subjects.map((item) => ({ value: item, label: item }))]}
                icon="📘"
              />
              <SmartFilterSelect
                label="Lớp"
                value={rightClassFilter}
                onChange={setRightClassFilter}
                options={[
                  { value: 'All', label: 'Tất cả lớp' },
                  { value: '10', label: 'Lớp 10' },
                  { value: '11', label: 'Lớp 11' },
                  { value: '12', label: 'Lớp 12' },
                ]}
                icon="🏫"
              />
              <SmartFilterSelect
                label="Định dạng"
                value={rightFormatFilter}
                onChange={setRightFormatFilter}
                options={[
                  { value: 'all', label: 'Tất cả định dạng' },
                  { value: 'video', label: 'Video' },
                  { value: 'document', label: 'Word / PDF' },
                  { value: 'code', label: 'Code' },
                  { value: 'lesson', label: 'Bài học' },
                ]}
                icon="▣"
              />
              <SmartFilterSelect
                label="Tiến độ"
                value={rightProgressFilter}
                onChange={setRightProgressFilter}
                options={[
                  { value: 'all', label: 'Tất cả tiến độ' },
                  { value: 'new', label: 'Chưa học' },
                  { value: 'progress', label: 'Đang học' },
                  { value: 'done', label: 'Đã hoàn thành' },
                ]}
                icon="◔"
              />
            </div>
          </FilterSection>

          <FilterSection index="03" title="Sắp xếp kết quả" description="Ưu tiên cách hiển thị phù hợp với mục tiêu hiện tại.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {sortChoices.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setSortBy(item.value)}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-black transition ${
                    sortBy === item.value
                      ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/10 dark:border-blue-400 dark:bg-blue-500/15 dark:text-blue-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/50 hover:text-blue-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-blue-400/30 dark:hover:bg-blue-500/[0.08]'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </FilterSection>

          <FilterSection index="04" title="Đang áp dụng" description="Nhấn dấu × để bỏ nhanh từng tiêu chí.">
            {activeFilters.length ? (
              <div className="flex flex-wrap gap-2">
                {activeFilters.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.clear}
                    className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:border-rose-400/20 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                    title={`Bỏ bộ lọc ${item.label}`}
                  >
                    <span>{item.label}</span>
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm font-semibold text-slate-500 dark:border-white/15 dark:bg-white/[0.03] dark:text-slate-400">
                Chưa có tiêu chí nâng cao — hệ thống đang hiển thị toàn bộ nội dung.
              </div>
            )}
          </FilterSection>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/80 px-5 py-4 dark:border-white/10 dark:bg-white/[0.025] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-sm font-black text-slate-900 dark:text-white">
              {resultCount > 0 ? `${resultCount} bài học phù hợp` : 'Chưa có bài học phù hợp'}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Kết quả được cập nhật theo các lựa chọn hiện tại.</p>
          </div>
          <div className="flex gap-2 sm:justify-end">
            <button type="button" onClick={onReset} className="flex-1 rounded-full px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10 sm:flex-none">Đặt lại</button>
            <button
              type="button"
              onClick={onApply}
              disabled={resultCount === 0}
              className="flex-1 rounded-full bg-blue-600 px-6 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none dark:disabled:bg-white/10 dark:disabled:text-slate-500 sm:flex-none"
            >
              {resultCount > 0 ? `Xem ${resultCount} kết quả` : 'Không có kết quả'}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

function FilterSection({ index, title, description, children }) {
  return (
    <section className="border-b border-slate-200 py-5 first:pt-0 last:border-b-0 last:pb-0 dark:border-white/10">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-100 text-[11px] font-black text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">{index}</span>
        <div>
          <h3 className="text-sm font-black text-slate-950 dark:text-white">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function SmartFilterSelect({ label, value, onChange, options, icon }) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)
  const selected = options.find((item) => String(item.value) === String(value)) || options[0]

  useEffect(() => {
    function handleOutside(event) {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  return (
    <div ref={boxRef} className="relative">
      <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex min-h-12 w-full items-center gap-3 rounded-xl border bg-white px-3.5 text-left text-sm font-bold transition dark:bg-white/[0.04] ${
          open
            ? 'border-blue-500 ring-4 ring-blue-500/10 dark:border-blue-400'
            : 'border-slate-200 hover:border-blue-300 dark:border-white/10 dark:hover:border-blue-400/40'
        }`}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm dark:bg-white/[0.06]">{icon}</span>
        <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">{selected?.label}</span>
        <span className={`text-xs text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>

      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-[120] max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-950/15 dark:border-white/10 dark:bg-[#182235]">
          {options.map((item) => {
            const active = String(item.value) === String(value)
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  onChange(item.value)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/[0.08]'
                }`}
              >
                <span>{item.label}</span>
                {active && <span>✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function CourseFormModal({ form, setForm, editingCourse, contentType = 'video', teacherClasses, uploadingWord, uploadingVideo = false, uploadingImage = false, lessonsRef, publisherName = '', onClose, onReset, onSubmit, onWordUpload, onVideoUpload, onImageUpload }) {
  const isDocument = contentType === 'document'
  const isSimulation = contentType === 'simulation'
  const [tab, setTab] = useState('overview')
  const [submitting, setSubmitting] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [collapsedLessonTopics, setCollapsedLessonTopics] = useState({})
  const fileInputRef = useRef(null)
  const thumbnailInputRef = useRef(null)
  const documentImageInputRef = useRef(null)

  const tabs = isSimulation
    ? [['overview','Thông tin chung','01'],['simulation','Mô phỏng','02'],['learning','Hỗ trợ học tập','03'],['access','Xuất bản','04']]
    : isDocument
      ? [['overview','Thông tin chung','01'],['document','Tài liệu','02'],['learning','Hỗ trợ học tập','03'],['access','Xuất bản','04']]
      : [['overview','Thông tin chung','01'],['video','Nguồn video','02'],['playlist','Danh sách bài','03'],['learning','Hỗ trợ học tập','04'],['access','Xuất bản','05']]

  useEffect(() => { setTab('overview') }, [contentType])
  useEffect(() => {
    const randomCode = form.courseRandomCode || String(Math.floor(1000 + Math.random() * 9000))
    const nextCode = generateLibraryCourseCode(publisherName, form.category, randomCode)
    if (form.courseCode !== nextCode || form.courseRandomCode !== randomCode) {
      setForm((prev) => ({ ...prev, courseRandomCode: randomCode, courseCode: nextCode }))
    }
  }, [form.category, publisherName, contentType])

  function updateField(field, value) {
    const wordLimit = {
      title: courseTextLimits.titleWords,
      topic: courseTextLimits.topicWords,
      description: courseTextLimits.descriptionWords,
    }[field]
    const nextValue = wordLimit ? limitWords(value, wordLimit) : value
    setForm((prev) => ({ ...prev, [field]: nextValue }))
  }
  function updateLesson(index, field, value) {
    setForm((prev) => {
      const lessons = Array.isArray(prev.lessons) ? [...prev.lessons] : []
      lessons[index] = { ...getEmptyLesson(`Bài ${index + 1}`), ...(lessons[index] || {}), [field]: value }
      return { ...prev, lessons }
    })
  }
  function addLesson(topicId = '') {
    setForm((prev) => ({ ...prev, lessons: [...(Array.isArray(prev.lessons) ? prev.lessons : []), { ...getEmptyLesson(`Bài ${(prev.lessons?.length || 0) + 1}`), attachMode: '', videoSourceType: '', topicId }] }))
    setTimeout(() => lessonsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  function removeLesson(index) { setForm((prev) => ({ ...prev, lessons: (prev.lessons || []).filter((_, i) => i !== index) })) }
  function addLessonTopic() {
    const id = `topic_${Date.now()}`
    setForm((prev) => ({ ...prev, lessonTopics: [...(Array.isArray(prev.lessonTopics) ? prev.lessonTopics : []), { id, title: `Chủ đề ${(prev.lessonTopics?.length || 0) + 1}` }] }))
  }
  function updateLessonTopic(topicId, title) {
    setForm((prev) => ({ ...prev, lessonTopics: (prev.lessonTopics || []).map((topic) => String(topic.id) === String(topicId) ? { ...topic, title } : topic) }))
  }
  function removeLessonTopic(topicId) {
    setForm((prev) => ({ ...prev, lessonTopics: (prev.lessonTopics || []).filter((topic) => String(topic.id) !== String(topicId)), lessons: (prev.lessons || []).map((lesson) => String(lesson.topicId || '') === String(topicId) ? { ...lesson, topicId: '' } : lesson) }))
  }
  function updateChecklist(index, value) { setForm((prev) => { const list = normalizeChecklist(prev.checklist); list[index] = { ...list[index], label: value }; return { ...prev, checklist: list } }) }
  function addChecklist() { setForm((prev) => ({ ...prev, checklist: [...normalizeChecklist(prev.checklist), { id: `item_${Date.now()}`, label: '' }] })) }
  function removeChecklist(index) { setForm((prev) => ({ ...prev, checklist: normalizeChecklist(prev.checklist).filter((_, i) => i !== index) })) }
  function addTag(field, value) { const clean = String(value || '').trim(); if (!clean) return; setForm((prev) => ({ ...prev, [field]: Array.from(new Set([...(Array.isArray(prev[field]) ? prev[field] : []), clean])) })) }
  function removeTag(field, index) { setForm((prev) => ({ ...prev, [field]: (prev[field] || []).filter((_, i) => i !== index) })) }
  function addQuiz() { setForm((prev) => ({ ...prev, quiz: [...(Array.isArray(prev.quiz) ? prev.quiz : []), { type: '', question: '', options: ['', '', '', ''], correctAnswer: 0, trueFalseItems: [{ text: '', correct: true }, { text: '', correct: true }, { text: '', correct: true }, { text: '', correct: true }], passage: '', passageQuestions: [] }] })) }
  function removeQuiz(index) { setForm((prev) => ({ ...prev, quiz: (prev.quiz || []).filter((_, i) => i !== index) })) }
  function updateQuiz(index, patch) { setForm((prev) => { const quiz = [...(prev.quiz || [])]; quiz[index] = { ...(quiz[index] || {}), ...patch }; return { ...prev, quiz } }) }
  function addPassageQuestion(index) { const q = form.quiz?.[index] || {}; updateQuiz(index, { passageQuestions: [...(q.passageQuestions || []), { question: '', options: ['', '', '', ''], correctAnswer: 0 }] }) }
  function updatePassageQuestion(index, qIndex, patch) { const q = form.quiz?.[index] || {}; const items = [...(q.passageQuestions || [])]; items[qIndex] = { ...items[qIndex], ...patch }; updateQuiz(index, { passageQuestions: items }) }
  function removePassageQuestion(index, qIndex) { const q = form.quiz?.[index] || {}; updateQuiz(index, { passageQuestions: (q.passageQuestions || []).filter((_, i) => i !== qIndex) }) }

  async function detectYoutube(url, lessonIndex = null) {
    if (!getYoutubeVideoId(url)) return
    const seconds = await getYoutubeDurationSeconds(url)
    const duration = formatVideoDuration(seconds)
    if (lessonIndex === null) setForm((prev) => ({ ...prev, durationSeconds: seconds, duration, estimatedMinutes: seconds ? Math.ceil(seconds / 60) : 0 }))
    else { updateLesson(lessonIndex, 'durationSeconds', seconds); updateLesson(lessonIndex, 'duration', duration) }
  }

  const infoDone = Boolean(stripHtml(form.title).trim() && stripHtml(form.topic).trim())
  const sourceDone = isSimulation
    ? Boolean((form.simulationMode === 'embed' && String(form.simulationUrl || '').trim()) || (form.simulationMode === 'code' && String(form.simulationHtml || '').trim()))
    : isDocument
      ? Boolean(form.wordFileUrl || form.documentImageUrl || stripHtml(form.richDocument).trim())
      : Boolean((form.lessons || []).length)
  const accessDone = Boolean(form.visibility && (form.visibility === 'public' || form.className))
  const publishDone = Boolean(form.publishConfirmed)
  const criteria = isDocument
    ? [infoDone, sourceDone, accessDone, publishDone]
    : isSimulation
      ? [infoDone, sourceDone, accessDone, publishDone]
      : [infoDone, sourceDone, accessDone, publishDone]
  const completion = Math.round((criteria.filter(Boolean).length / criteria.length) * 100)
  const canSubmit = criteria.every(Boolean)

  async function submit(event) {
    event.preventDefault()
    event.stopPropagation()
    if (submitting || uploadingWord || uploadingVideo || uploadingImage || !canSubmit) return
    setSubmitting(true)
    try { await onSubmit() } finally { setSubmitting(false) }
  }


  function resetForm() {
    if (submitting || uploadingWord || uploadingVideo || uploadingImage) return
    setResetConfirmOpen(true)
  }

  function confirmResetForm() {
    fileInputRef.current && (fileInputRef.current.value = '')
    thumbnailInputRef.current && (thumbnailInputRef.current.value = '')
    documentImageInputRef.current && (documentImageInputRef.current.value = '')
    setTab('overview')
    setCollapsedLessonTopics({})
    setResetConfirmOpen(false)
    onReset?.()
  }

  function toggleLessonTopic(topicId) {
    setCollapsedLessonTopics((current) => ({ ...current, [topicId]: !current[topicId] }))
  }

  const subjectOptions = [...subjects, 'ĐGNL', 'THPT'].map((item) => ({ value: item, label: item }))
  const classOptions = [{ value: '', label: 'Chọn lớp' }, { value: '10', label: 'Lớp 10' }, { value: '11', label: 'Lớp 11' }, { value: '12', label: 'Lớp 12' }]
  const titleLabel = isSimulation ? 'Tên bài mô phỏng *' : isDocument ? 'Tên tài liệu *' : 'Tên video bài học *'
  const typeLabel = isSimulation ? 'bài mô phỏng' : isDocument ? 'tài liệu học tập' : 'video bài học'
  const eyebrowClass = isSimulation ? 'text-violet-700 dark:text-violet-300' : isDocument ? 'text-emerald-700 dark:text-emerald-300' : 'text-blue-700 dark:text-blue-300'

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-7xl">
      {resetConfirmOpen && <div className="fixed inset-0 z-[1600] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event)=>{if(event.target===event.currentTarget)setResetConfirmOpen(false)}}><div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#111827]"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-100 text-3xl dark:bg-amber-500/15">↺</div><h3 className="mt-4 text-center text-xl font-black">Đặt lại toàn bộ dữ liệu?</h3><p className="mt-2 text-center text-sm leading-6 text-slate-500 dark:text-slate-400">Tên bài, nội dung, file, danh sách bài, quiz và bản nháp hiện tại sẽ bị xóa. Thao tác này không thể hoàn tác.</p><div className="mt-6 flex gap-2"><button type="button" onClick={()=>setResetConfirmOpen(false)} className="flex-1 cursor-pointer rounded-full border border-slate-300 px-5 py-3 text-sm font-black dark:border-white/20">Giữ lại dữ liệu</button><button type="button" onClick={confirmResetForm} className="flex-1 cursor-pointer rounded-full bg-amber-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600">Đặt lại</button></div></div></div>}
      <form onSubmit={submit} className="flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col bg-white text-slate-950 dark:bg-[#101827] dark:text-white sm:h-[calc(96dvh-1.5rem)] sm:max-h-[calc(96dvh-1.5rem)]">
        <header className={`relative shrink-0 overflow-hidden border-b px-4 py-4 sm:px-7 sm:py-5 dark:border-white/10 sm:px-7 ${isSimulation ? 'border-violet-100 bg-violet-50/80 dark:bg-violet-500/[0.06]' : isDocument ? 'border-emerald-100 bg-emerald-50/80 dark:bg-emerald-500/[0.06]' : 'border-blue-100 bg-blue-50/80 dark:bg-blue-500/[0.06]'}`}>
          <div className="relative flex items-start justify-between gap-3 sm:gap-5"><div className="min-w-0"><p className={`text-[11px] font-black uppercase tracking-[0.18em] ${eyebrowClass}`}>{editingCourse ? 'Cập nhật nội dung' : 'Tạo nội dung mới'}</p><h2 className="mt-1 text-xl font-black sm:text-2xl">{editingCourse ? 'Cập nhật' : 'Đăng'} {typeLabel}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{isDocument ? 'Tạo tài liệu trực tiếp hoặc tải Word/PDF lên thư viện.' : isSimulation ? 'Tạo nội dung mô phỏng tương tác cho người học.' : 'Tạo video bài giảng và sắp xếp nội dung học tập.'}</p></div><IconButton onClick={onClose}><CloseIcon /></IconButton></div>
        </header>
        <div className="min-h-0 flex flex-1 flex-col overflow-hidden md:flex-row">
          <aside className="min-h-0 shrink-0 border-b border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-white/10 dark:bg-white/[0.025] md:w-[84px] md:overflow-y-auto md:border-b-0 md:border-r md:p-3 xl:w-[290px] xl:p-4">
            <div className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:block md:space-y-2 md:overflow-visible md:pb-0">{tabs.map(([id,label,index]) => <button key={id} type="button" onClick={() => setTab(id)} title={label} className={`flex min-w-max shrink-0 snap-start items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold sm:text-sm md:w-full md:min-w-0 md:justify-center md:px-2 md:py-3 xl:justify-start xl:gap-3 xl:px-3 ${tab === id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-white/[0.06]'}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/10 text-[10px]">{index}</span><span className="md:hidden xl:inline">{label}</span></button>)}</div>
            <div className="hidden xl:block"><CompletionPanel completion={completion} criteria={criteria} isDocument={isDocument} isSimulation={isSimulation} canSubmit={canSubmit} /></div>
          </aside>
          <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-5 sm:p-6 xl:p-7">
            {tab === 'overview' && <FormSection eyebrow="Bước khởi tạo" title="Thông tin chung" description="Tên nội dung và chủ đề là bắt buộc."><div className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><Input label={titleLabel} value={form.title} onChange={(v) => updateField('title', v)} required wordLimit={courseTextLimits.titleWords} /></div><Input label="Chủ đề *" value={form.topic} onChange={(v) => updateField('topic', v)} required wordLimit={courseTextLimits.topicWords} /><SmartFilterSelect label="Môn học" value={form.category} onChange={(v) => updateField('category', v)} options={subjectOptions} icon="📘" /><div className="md:col-span-2"><Textarea label="Mô tả ngắn (không bắt buộc)" value={form.description} onChange={(v) => updateField('description', v)} rows={4} wordLimit={courseTextLimits.descriptionWords} /></div></div></FormSection>}

            {tab === 'video' && !isDocument && !isSimulation && <FormSection eyebrow="Hình ảnh đại diện" title="Nguồn video" description="Video phát chính được lấy từ bài đầu tiên trong tab Danh sách bài."><div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]"><div className="space-y-5"><ThumbnailPicker value={form.thumbnail} fileName={form.thumbnailFileName} uploading={uploadingImage} inputRef={thumbnailInputRef} onUrlChange={(v)=>updateField('thumbnail',v)} onUpload={(event)=>onImageUpload?.(event,'thumbnail')} /><div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300"><b>Video chính:</b> bài đầu tiên trong Danh sách bài sẽ tự động xuất hiện ở Main Content khi người học mở khóa học.</div></div><SourceIdeaEditor sources={form.videoSources || []} onChange={(sources) => updateField('videoSources',sources)} /></div></FormSection>}

            {tab === 'document' && isDocument && <FormSection eyebrow="Tài nguyên chính" title="Soạn hoặc tải tài liệu" description="Nhấn nút chọn nguồn để mở ba phương thức tạo tài liệu."><DocumentComposer mode={form.documentMode || ''} onModeChange={(mode) => updateField('documentMode', mode)} html={form.richDocument || ''} onHtmlChange={(html) => updateField('richDocument', html)} fileName={form.wordFileName || ''} fileUrl={form.wordFileUrl || ''} fileType={form.documentFileType || ''} fileSize={form.documentFileSize || 0} imageUrl={form.documentImageUrl || ''} imageName={form.documentImageName || ''} imageSize={form.documentImageSize || 0} uploading={uploadingWord} uploadingImage={uploadingImage} fileInputRef={fileInputRef} imageInputRef={documentImageInputRef} onUpload={onWordUpload} onImageUpload={(event)=>onImageUpload?.(event,'document')} onClearFile={()=>setForm(prev=>({...prev,wordFileName:'',wordFileUrl:'',documentFileType:'',documentFileSize:0,richDocument: prev.documentMode==='upload'?'':prev.richDocument}))} onClearImage={()=>setForm(prev=>({...prev,documentImageUrl:'',documentImageName:'',documentImageSize:0}))} /></FormSection>}

            {tab === 'simulation' && isSimulation && <FormSection eyebrow="Không gian tương tác" title="Thiết kế bài mô phỏng" description="Có thể nhúng mô phỏng từ URL hoặc tự tạo bằng HTML/CSS/JavaScript."><div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={()=>{updateField('simulationMode','embed');updateField('attachMode','simulation')}} className={`rounded-2xl border p-4 text-left transition ${form.simulationMode === 'embed' ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300' : 'border-slate-200 dark:border-white/10'}`}><b>Nhúng mô phỏng</b><span className="mt-1 block text-xs text-slate-500">Dùng URL HTTPS từ PhET, GeoGebra hoặc nguồn tương tác khác.</span></button><button type="button" onClick={()=>{updateField('simulationMode','code');updateField('attachMode','simulation')}} className={`rounded-2xl border p-4 text-left transition ${form.simulationMode === 'code' ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300' : 'border-slate-200 dark:border-white/10'}`}><b>Tự viết mã mô phỏng</b><span className="mt-1 block text-xs text-slate-500">Soạn HTML/CSS/JS và xem trước trực tiếp.</span></button></div>{form.simulationMode === 'embed' ? <><Input label="URL mô phỏng *" value={form.simulationUrl} onChange={(v)=>updateField('simulationUrl',v)} /><SimulationPreview url={form.simulationUrl} /></> : <><Textarea label="HTML / CSS / JavaScript *" value={form.simulationHtml} onChange={(v)=>updateField('simulationHtml',v)} rows={14} /><SimulationPreview html={form.simulationHtml} /></>}<ThumbnailPicker value={form.thumbnail} fileName={form.thumbnailFileName} uploading={uploadingImage} inputRef={thumbnailInputRef} onUrlChange={(v)=>updateField('thumbnail',v)} onUpload={(event)=>onImageUpload?.(event,'thumbnail')} /></div></FormSection>}

            {tab === 'playlist' && !isDocument && !isSimulation && <FormSection eyebrow="Nội dung đi kèm" title="Danh sách bài / Playlist" description="Tạo chủ đề chung, sau đó thêm nhiều bài vào từng chủ đề."><div ref={lessonsRef}><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-slate-500">{(form.lessons || []).length} bài • {(form.lessonTopics || []).length} chủ đề</p><div className="flex flex-wrap gap-2"><button type="button" onClick={addLessonTopic} className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-black text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300">+ Tạo chủ đề</button><button type="button" onClick={()=>addLesson('')} className="rounded-full bg-blue-600 px-4 py-2.5 text-sm font-black text-white">+ Thêm bài lẻ</button></div></div>{!(form.lessonTopics || []).length && !(form.lessons || []).length ? <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-white/15">Playlist đang trống.</div> : <div className="space-y-5">{(form.lessonTopics || []).map((topic) => { const topicLessons=(form.lessons || []).map((lesson,index)=>({lesson,index})).filter((item)=>String(item.lesson.topicId||'')===String(topic.id)); const collapsed=Boolean(collapsedLessonTopics[topic.id]); return <section key={topic.id} className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-400/20 dark:bg-blue-500/[0.05]"><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={()=>toggleLessonTopic(topic.id)} className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl border border-blue-200 bg-white text-blue-700 transition hover:bg-blue-100 dark:border-blue-400/20 dark:bg-[#182235] dark:text-blue-300" aria-label={collapsed?'Mở rộng chủ đề':'Thu gọn chủ đề'} aria-expanded={!collapsed}><span className={`transition-transform ${collapsed?'-rotate-90':'rotate-0'}`}>⌄</span></button><input value={topic.title || ''} onChange={(event)=>updateLessonTopic(topic.id,event.target.value)} className="min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-3 py-2.5 font-black outline-none focus:border-blue-500 dark:border-blue-400/20 dark:bg-[#182235]"/><span className="rounded-full bg-blue-100 px-3 py-1 text-[11px] font-black text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">{topicLessons.length} bài</span><button type="button" onClick={()=>addLesson(topic.id)} className="cursor-pointer rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-black text-white">+ Thêm bài</button><button type="button" onClick={()=>removeLessonTopic(topic.id)} className="cursor-pointer rounded-xl px-3 py-2.5 text-xs font-black text-rose-600">Xóa chủ đề</button></div>{!collapsed&&<div className="mt-4 space-y-4">{topicLessons.length ? topicLessons.map(({lesson,index}) => <PlaylistLessonEditor key={index} lesson={lesson} index={index} uploadingVideo={uploadingVideo} onUpdate={updateLesson} onRemove={removeLesson} onYoutubeDuration={detectYoutube} onVideoUpload={onVideoUpload} />) : <div className="rounded-xl border border-dashed border-blue-200 p-5 text-center text-xs text-slate-500 dark:border-blue-400/20">Chủ đề chưa có bài nào.</div>}</div>}</section>})}{(form.lessons || []).map((lesson,index)=>({lesson,index})).filter((item)=>!item.lesson.topicId).map(({lesson,index}) => <PlaylistLessonEditor key={index} lesson={lesson} index={index} uploadingVideo={uploadingVideo} onUpdate={updateLesson} onRemove={removeLesson} onYoutubeDuration={detectYoutube} onVideoUpload={onVideoUpload} />)}</div>}</div></FormSection>}

            {tab === 'learning' && <LearningSupport hideChecklist form={form} addTag={addTag} removeTag={removeTag} updateChecklist={updateChecklist} addChecklist={addChecklist} removeChecklist={removeChecklist} addQuiz={addQuiz} updateQuiz={updateQuiz} removeQuiz={removeQuiz} addPassageQuestion={addPassageQuestion} updatePassageQuestion={updatePassageQuestion} removePassageQuestion={removePassageQuestion} />}

            {tab === 'access' && <FormSection eyebrow="Xuất bản" title="Quyền truy cập và thời gian mở" description="Bài học tự mở khi tới thời điểm được chỉ định."><div className="grid gap-4 md:grid-cols-2"><SmartFilterSelect label="Quyền truy cập" value={form.visibility} onChange={(v) => updateField('visibility',v)} options={[{value:'public',label:'Công khai'},{value:'private',label:'Dành cho lớp'}]} icon="◉" />{form.visibility === 'private' && <SmartFilterSelect label="Lớp học" value={form.className} onChange={(v) => updateField('className',v)} options={classOptions} icon="🏫" />}<div className="md:col-span-2"><OpenSchedulePicker value={form.openAt || ''} onChange={(value) => updateField('openAt', value)} /></div><Input label="Mã khóa học" value={form.courseCode} onChange={() => {}} disabled /><label className="md:col-span-2 flex cursor-pointer items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-400/20 dark:bg-blue-500/10"><input type="checkbox" checked={Boolean(form.publishConfirmed)} onChange={(e) => updateField('publishConfirmed',e.target.checked)} className="mt-1 h-4 w-4 accent-blue-600" /><span><b>Tôi xác nhận quyền xuất bản</b><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Nội dung không vi phạm bản quyền và đã được kiểm tra.</span></span></label></div></FormSection>}
          </main>
        </div>
        <footer className="relative z-20 shrink-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-[#101827]/95 sm:px-5 sm:py-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="hidden min-w-0 text-xs text-slate-500 lg:block">Bản nháp được tự động lưu.</p><div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto sm:flex-wrap sm:justify-end">{!editingCourse && <button type="button" onClick={resetForm} disabled={submitting || uploadingWord || uploadingVideo || uploadingImage} className="min-w-0 cursor-pointer rounded-full border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 sm:w-auto sm:min-w-[104px] sm:px-5">Đặt lại</button>}<button type="button" onClick={onClose} className="min-w-0 cursor-pointer rounded-full border border-slate-300 px-4 py-2.5 text-sm font-bold dark:border-white/20 sm:w-auto sm:min-w-[96px] sm:px-5">Hủy</button><button type="submit" disabled={submitting || uploadingWord || uploadingVideo || uploadingImage || !canSubmit} className="col-span-2 min-w-0 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-black whitespace-nowrap text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-[156px] sm:px-6">{submitting ? 'Đang xử lý...' : editingCourse ? 'Lưu cập nhật' : isSimulation ? 'Gửi mô phỏng' : isDocument ? 'Gửi tài liệu' : 'Gửi video'}</button></div></div></footer>
      </form>
    </ModalShell>
  )
}

function CompletionPanel({ completion, criteria, isDocument, isSimulation, canSubmit }) {
  const labels = isDocument ? ['Thông tin','Tài liệu','Quyền truy cập','Quyền xuất bản'] : isSimulation ? ['Thông tin','Mô phỏng','Quyền truy cập','Quyền xuất bản'] : ['Thông tin video','Danh sách bài','Quyền truy cập','Quyền xuất bản']
  return <div className="relative mt-5 min-h-[220px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]"><div className={`transition-all duration-500 ${canSubmit ? 'scale-95 opacity-0 blur-sm' : 'scale-100 opacity-100'}`}><div className="flex items-center justify-between text-xs font-black"><span>Mức hoàn thiện</span><span className="text-blue-600 dark:text-blue-300">{completion}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{width:`${completion}%`}} /></div><ul className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">{labels.map((label,index)=><li key={label} className="flex gap-2"><span className={criteria[index]?'text-emerald-500':''}>{criteria[index]?'✓':'○'}</span>{label}</li>)}</ul></div><div className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-5 text-center transition-all duration-500 dark:from-emerald-500/15 dark:via-[#182235] dark:to-cyan-500/10 ${canSubmit?'scale-100 opacity-100':'scale-110 opacity-0'}`}><div className={`text-6xl transition-all duration-500 ${canSubmit?'translate-y-0 rotate-0 scale-100':'translate-y-4 -rotate-12 scale-75'}`}>👍</div><p className="mt-3 text-sm font-black text-emerald-700 dark:text-emerald-300">Nội dung đã sẵn sàng để gửi</p><p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">Bạn đã hoàn thành đủ các tiêu chí.</p></div></div>
}

function ThumbnailPicker({ value, fileName, uploading, inputRef, onUrlChange, onUpload }) {
  return <div><span className="mb-1.5 block text-sm font-bold">Ảnh bìa / Thumbnail</span><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={onUpload}/><div className="flex gap-2"><input value={value || ''} onChange={(e)=>onUrlChange(e.target.value)} placeholder="Dán URL hoặc tải ảnh" className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-white/15"/><button type="button" disabled={uploading} onClick={()=>inputRef.current?.click()} className="rounded-xl bg-slate-900 px-4 text-xs font-black text-white disabled:opacity-50 dark:bg-white dark:text-slate-950">{uploading?'Đang tải...':'Tải ảnh'}</button></div>{value&&<div className="mt-3 aspect-video overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-white/10"><img src={value} alt={fileName||'Thumbnail'} className="h-full w-full object-cover"/></div>}</div>
}

function InfoHint({items}) { return <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 dark:border-blue-400/15 dark:bg-blue-500/[0.06]"><p className="font-black">Gợi ý</p><ul className="mt-3 space-y-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{items.map(item=><li key={item}>• {item}</li>)}</ul></div> }
function SimulationPreview({url,html}) { return <div className="overflow-hidden rounded-2xl border border-violet-200 bg-white dark:border-violet-400/20"><div className="border-b border-violet-100 px-4 py-2 text-xs font-black text-violet-700 dark:border-violet-400/20 dark:text-violet-300">Xem trước mô phỏng</div>{url?<iframe src={url} title="Mô phỏng" className="h-[420px] w-full bg-white" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"/>:html?<iframe srcDoc={html} title="Mô phỏng tự tạo" className="h-[420px] w-full bg-white" sandbox="allow-scripts allow-forms allow-modals"/>:<div className="grid h-[320px] place-items-center text-sm text-slate-400">Nội dung xem trước sẽ xuất hiện tại đây.</div>}</div> }

function LearningSupport({form,hideChecklist=false,addTag,removeTag,updateChecklist,addChecklist,removeChecklist,addQuiz,updateQuiz,removeQuiz,addPassageQuestion,updatePassageQuestion,removePassageQuestion}) {
  return <FormSection eyebrow="Trải nghiệm học" title={hideChecklist ? 'Mục tiêu và quiz' : 'Mục tiêu, checklist và quiz'} description="Nhấn Enter để tách từng mục thành gạch đầu dòng."><div className="grid gap-5 xl:grid-cols-2"><TagInput label="Mục tiêu học tập" items={form.learningObjectives||[]} onAdd={(v)=>addTag('learningObjectives',v)} onRemove={(i)=>removeTag('learningObjectives',i)}/><TagInput label="Kiến thức cần có" items={form.prerequisites||[]} onAdd={(v)=>addTag('prerequisites',v)} onRemove={(i)=>removeTag('prerequisites',i)}/></div><div className={`mt-7 grid gap-6 ${hideChecklist ? '' : 'xl:grid-cols-2'}`}>{!hideChecklist&&<div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10"><div className="flex justify-between"><div><h4 className="font-black">Checklist học tập</h4><p className="text-xs text-slate-500">Mặc định: Coi bài giảng, Thực hành, Làm quiz.</p></div><button type="button" onClick={addChecklist} className="text-sm font-black text-blue-600">+ Thêm mục</button></div><div className="mt-4 space-y-2">{normalizeChecklist(form.checklist).map((item,index)=><div key={item.id||index} className="flex gap-2"><input value={item.label} onChange={(e)=>updateChecklist(index,e.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 text-sm dark:border-white/15"/><button type="button" onClick={()=>removeChecklist(index)} className="text-rose-600"><TrashIcon/></button></div>)}</div></div>}<div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10"><div className="flex justify-between"><div><h4 className="font-black">Quiz nhanh</h4><p className="text-xs text-slate-500">Chọn loại câu hỏi trước khi nhập.</p></div><button type="button" onClick={addQuiz} className="text-sm font-black text-blue-600">+ Thêm câu</button></div><div className="mt-4 space-y-4">{(form.quiz||[]).map((q,index)=><QuizEditor key={index} question={q} index={index} onUpdate={updateQuiz} onRemove={removeQuiz} onAddPassageQuestion={addPassageQuestion} onUpdatePassageQuestion={updatePassageQuestion} onRemovePassageQuestion={removePassageQuestion}/>)}</div></div></div></FormSection>
}

function LumiPreview({ url }) {
  const safeUrl = String(url || '').trim()
  if (!safeUrl) return <div className="grid min-h-[240px] w-full place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-400 dark:border-white/15 dark:bg-white/[0.03] sm:min-h-[320px] lg:min-h-[420px]">Dán URL Lumi để xem trước bài tương tác.</div>
  return <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10"><div className="relative aspect-video w-full min-h-[220px] sm:min-h-[320px] lg:min-h-[420px]"><iframe src={safeUrl} title="Bài học tương tác Lumi" className="absolute inset-0 h-full w-full border-0 bg-white" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-presentation" allow="fullscreen; autoplay; clipboard-read; clipboard-write" allowFullScreen /></div></div>
}

function VideoPreview({ youtubeUrl, mp4Url }) {
  const videoId = getYoutubeVideoId(youtubeUrl)
  return <div className="aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-black dark:border-white/10">{videoId ? <iframe src={getYoutubeEmbedUrl(youtubeUrl)} title="Xem trước YouTube" className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /> : mp4Url ? <video src={mp4Url} controls className="h-full w-full object-contain" /> : <div className="grid h-full place-items-center text-center text-sm text-slate-400">Màn hình xem trước video</div>}</div>
}
function TagInput({ label, items, onAdd, onRemove }) {
  const [value,setValue] = useState('')
  return <div><span className="mb-1.5 block text-sm font-bold">{label}</span><div className="rounded-2xl border border-slate-300 p-3 dark:border-white/15"><div className="mb-2 flex flex-wrap gap-2">{items.map((item,index) => <span key={`${item}-${index}`} className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"><span>• {item}</span><button type="button" onClick={() => onRemove(index)}>×</button></span>)}</div><input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAdd(value); setValue('') } }} placeholder="Nhập một ý rồi nhấn Enter" className="w-full bg-transparent px-1 py-2 text-sm outline-none" /></div></div>
}
function PlaylistLessonEditor({ lesson,index,uploadingVideo,onUpdate,onRemove,onYoutubeDuration,onVideoUpload }) {
  const [menu,setMenu] = useState(false)
  const fileRef = useRef(null)
  return <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.025]"><div className="mb-4 flex items-center justify-between"><strong>Câu chuyện bài {index + 1}</strong><button type="button" onClick={() => onRemove(index)} className="text-xs font-black text-rose-600">Xóa bài</button></div><div className="grid gap-4"><Input label="Tiêu đề bài" value={lesson.title} onChange={(v) => onUpdate(index,'title',v)} /><div className="relative"><button type="button" onClick={() => setMenu((v) => !v)} className="flex w-full items-center justify-between rounded-xl border border-slate-300 px-4 py-3 text-sm font-black dark:border-white/15"><span>{lesson.videoSourceType === 'upload' ? 'Tải video' : lesson.videoSourceType === 'youtube' ? 'YouTube URL' : lesson.videoSourceType === 'lumi' ? 'URL Lumi' : 'Chọn nguồn video'}</span><span>⌄</span></button>{menu && <div className="absolute inset-x-0 top-[calc(100%+8px)] z-30 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#182235]"><button type="button" onClick={() => { onUpdate(index,'videoSourceType','youtube'); onUpdate(index,'attachMode','youtube'); onUpdate(index,'mp4FileUrl',''); onUpdate(index,'lumiUrl',''); setMenu(false) }} className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-white/10">YouTube URL</button><button type="button" onClick={() => { onUpdate(index,'videoSourceType','lumi'); onUpdate(index,'attachMode','lumi'); onUpdate(index,'youtubeUrl',''); onUpdate(index,'mp4FileUrl',''); setMenu(false) }} className="w-full rounded-lg px-3 py-2 text-left hover:bg-emerald-50 dark:hover:bg-emerald-500/10">URL Lumi</button><button type="button" onClick={() => { onUpdate(index,'videoSourceType','upload'); onUpdate(index,'attachMode','mp4'); onUpdate(index,'youtubeUrl',''); onUpdate(index,'lumiUrl',''); setMenu(false) }} className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-white/10">Tải video</button></div>}</div>{lesson.videoSourceType === 'youtube' && <><Input label="YouTube URL" value={lesson.youtubeUrl} onChange={(v) => { const normalized = getYoutubeVideoId(v) ? normalizeYoutubeUrl(v) : v; onUpdate(index,'youtubeUrl',normalized); if (getYoutubeVideoId(v)) onYoutubeDuration(v,index) }} /><VideoPreview youtubeUrl={lesson.youtubeUrl} /></>}{lesson.videoSourceType === 'lumi' && <><Input label="URL Lumi" value={lesson.lumiUrl || ''} onChange={(v) => onUpdate(index,'lumiUrl',v)} /><LumiPreview url={lesson.lumiUrl} /></>}{lesson.videoSourceType === 'upload' && <><input ref={fileRef} type="file" accept="video/mp4" className="hidden" onChange={(event) => onVideoUpload?.(event,index)} /><div className="flex flex-col gap-2 sm:flex-row"><input readOnly value={lesson.mp4FileUrl || ''} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-white/15 dark:bg-white/[0.04]" /><button type="button" disabled={uploadingVideo} onClick={() => fileRef.current?.click()} className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white sm:w-auto">Tải video</button></div><VideoPreview mp4Url={lesson.mp4FileUrl} /></>}<Input label="Thời lượng" value={lesson.duration || 'Chưa nhận diện'} onChange={() => {}} disabled /></div></div>
}
function QuizEditor({ question,index,onUpdate,onRemove,onAddPassageQuestion,onUpdatePassageQuestion,onRemovePassageQuestion }) {
  const types=[{value:'abcd',label:'Trắc nghiệm ABCD'},{value:'true_false',label:'Trắc nghiệm đúng sai'},{value:'passage',label:'Trắc nghiệm đoạn văn'}]
  return <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/[0.04]"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><strong>Câu {index + 1}</strong><SmartFilterSelect label="" value={question.type || ''} onChange={(v) => onUpdate(index,{type:v})} options={[{value:'',label:'Chọn chế độ'},...types]} icon="?" /></div><button type="button" onClick={() => onRemove(index)} className="text-xs font-black text-rose-600">Xóa</button></div>{question.type === 'abcd' && <ABCDQuizEditor value={question} onChange={(patch) => onUpdate(index,patch)} />}{question.type === 'true_false' && <TrueFalseQuizEditor value={question} onChange={(patch) => onUpdate(index,patch)} />}{question.type === 'passage' && <div className="space-y-4"><Textarea label="Đoạn văn" value={question.passage || ''} onChange={(v) => onUpdate(index,{passage:v})} rows={6} maxLength={3000} showCount /><button type="button" onClick={() => onAddPassageQuestion(index)} className="rounded-full bg-blue-600 px-4 py-2 text-xs font-black text-white">+ Tạo câu hỏi ABCD</button>{(question.passageQuestions || []).map((item,qIndex) => <div key={qIndex} className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><div className="mb-2 flex justify-between"><b>Câu con {qIndex+1}</b><button type="button" onClick={() => onRemovePassageQuestion(index,qIndex)} className="text-xs text-rose-600">Xóa</button></div><ABCDQuizEditor value={item} onChange={(patch) => onUpdatePassageQuestion(index,qIndex,patch)} /></div>)}</div>}</div>
}
function ABCDQuizEditor({ value,onChange }) {
  const options = Array.isArray(value.options) && value.options.length === 4 ? value.options : ['', '', '', '']
  return <div className="space-y-3"><Input label="Câu hỏi" value={value.question || ''} onChange={(v) => onChange({question:v})} maxLength={300} showCount />{options.map((option,i) => <div key={i} className="flex items-end gap-2"><div className="min-w-0 flex-1"><Input label={`Đáp án ${String.fromCharCode(65+i)}`} value={option} onChange={(v) => { const next=[...options]; next[i]=v; onChange({options:next}) }} maxLength={200} showCount /></div><label className="mb-1 flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold dark:border-white/10"><input type="radio" checked={Number(value.correctAnswer || 0) === i} onChange={() => onChange({correctAnswer:i})} />Đúng</label></div>)}</div>
}
function TrueFalseQuizEditor({ value,onChange }) {
  const items = Array.isArray(value.trueFalseItems) && value.trueFalseItems.length === 4 ? value.trueFalseItems : [{text:'',correct:true},{text:'',correct:true},{text:'',correct:true},{text:'',correct:true}]
  return <div className="space-y-3"><Input label="Câu dẫn" value={value.question || ''} onChange={(v) => onChange({question:v})} maxLength={300} showCount />{items.map((item,i) => <div key={i} className="grid gap-2 md:grid-cols-[1fr_160px]"><Input label={`Ý ${String.fromCharCode(97+i)}`} value={item.text} onChange={(v) => { const next=items.map((x,j) => j===i ? {...x,text:v} : x); onChange({trueFalseItems:next}) }} maxLength={300} showCount /><SmartFilterSelect label="Đáp án" value={item.correct ? 'true' : 'false'} onChange={(v) => { const next=items.map((x,j) => j===i ? {...x,correct:v==='true'} : x); onChange({trueFalseItems:next}) }} options={[{value:'true',label:'Đúng'},{value:'false',label:'Sai'}]} icon="✓" /></div>)}</div>
}

function DocumentComposer({ mode, onModeChange, html, onHtmlChange, fileName, fileUrl, fileType, fileSize = 0, imageUrl, imageName, imageSize = 0, uploading, uploadingImage, fileInputRef, imageInputRef, onUpload, onImageUpload, onClearFile, onClearImage }) {
  const editorRef = useRef(null)
  const selectionRef = useRef(null)
  const [draggingFile, setDraggingFile] = useState(false)
  const [draggingImage, setDraggingImage] = useState(false)
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false })
  const [activeAlign, setActiveAlign] = useState('left')
  const [activeList, setActiveList] = useState('')
  const [fontSize, setFontSize] = useState('16')
  const [textColor, setTextColor] = useState('#111827')
  const [highlightColor, setHighlightColor] = useState('#fef08a')
  const [textHexInput, setTextHexInput] = useState('#111827')
  const [highlightHexInput, setHighlightHexInput] = useState('#fef08a')
  const [savedTextColors, setSavedTextColors] = useState([])
  const [savedHighlightColors, setSavedHighlightColors] = useState([])
  const [isEditorDark, setIsEditorDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
  const [insertDialog, setInsertDialog] = useState(null)
  const [insertValue, setInsertValue] = useState('')
  const [tableRows, setTableRows] = useState(2)
  const [tableColumns, setTableColumns] = useState(2)
  const fontMenuRef = useRef(null)
  const textColorMenuRef = useRef(null)
  const highlightColorMenuRef = useRef(null)
  const listMenuRef = useRef(null)
  const insertMenuRef = useRef(null)
  const toolbarMenuHideTimerRef = useRef(null)
  const pendingFormatsRef = useRef({ bold: null, italic: null, underline: null })
  const pendingSelectionRef = useRef(null)
  const [openToolbarMenu, setOpenToolbarMenu] = useState('')
  const [toolbarMenuPosition, setToolbarMenuPosition] = useState({ top: 0, left: 0 })
  const isPdf = String(fileType || fileName).toLowerCase().includes('pdf')
  const isWord = /docx?|word/.test(String(fileType || fileName).toLowerCase())
  const wordCount = stripHtml(html || '').trim().split(/\s+/).filter(Boolean).length
  const methods = [
    ['type', '✎', 'Soạn trực tiếp', 'Nhập nội dung bằng trình soạn thảo'],
    ['upload', '⇧', 'Tải Word/PDF', 'Kéo thả hoặc chọn file tài liệu'],
    ['image', '▧', 'Tải ảnh tài liệu', 'Hỗ trợ JPG, PNG và WEBP'],
  ]
  const fontSizes = ['8','9','10','11','12','14','16','18','20','22','24','26','28','32','36','40','44','48','54','60','72']
  const rainbowColors = [
    { name: 'Đỏ', value: '#ef4444' },
    { name: 'Cam', value: '#f97316' },
    { name: 'Vàng', value: '#eab308' },
    { name: 'Lục', value: '#22c55e' },
    { name: 'Lam', value: '#3b82f6' },
    { name: 'Chàm', value: '#4f46e5' },
    { name: 'Tím', value: '#a855f7' },
  ]
  const adaptiveColor = isEditorDark ? '#000000' : '#ffffff'
  const defaultColorSwatch = isEditorDark ? '#ffffff' : '#000000'

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== (html || '')) editorRef.current.innerHTML = html || ''
  }, [html, mode])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const updateTheme = () => setIsEditorDark(document.documentElement.classList.contains('dark'))
    updateTheme()
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    function handleSelectionChange() {
      const selection = window.getSelection?.()
      if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return
      const range = selection.getRangeAt(0)
      const pendingRange = pendingSelectionRef.current
      const isSamePendingCaret = Boolean(
        range.collapsed &&
        pendingRange?.collapsed &&
        range.startContainer === pendingRange.startContainer &&
        range.startOffset === pendingRange.startOffset,
      )

      if (!isSamePendingCaret) clearPendingFormats()
      rememberSelection()
      refreshToolbarState({ preservePending: isSamePendingCaret })
    }
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      if (toolbarMenuHideTimerRef.current) window.clearTimeout(toolbarMenuHideTimerRef.current)
    }
  }, [])

  function clearPendingFormats() {
    pendingFormatsRef.current = { bold: null, italic: null, underline: null }
    pendingSelectionRef.current = null
  }
  function sync() { onHtmlChange(editorRef.current?.innerHTML || '') }
  function handleEditorInput() {
    clearPendingFormats()
    sync()
    window.requestAnimationFrame(() => refreshToolbarState({ preservePending: false }))
  }
  function rememberSelection() {
    const selection = window.getSelection?.()
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) selectionRef.current = selection.getRangeAt(0).cloneRange()
  }
  function restoreSelection() {
    const selection = window.getSelection?.()
    if (!selection || !selectionRef.current) return
    selection.removeAllRanges()
    selection.addRange(selectionRef.current)
  }
  function getDomFormatState() {
    const selection = window.getSelection?.()
    if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return { bold: false, italic: false, underline: false }
    let node = selection.anchorNode?.nodeType === Node.TEXT_NODE ? selection.anchorNode.parentElement : selection.anchorNode
    const state = { bold: false, italic: false, underline: false }
    while (node && node !== editorRef.current) {
      const tag = String(node.tagName || '').toLowerCase()
      const style = window.getComputedStyle(node)
      const weight = Number.parseInt(style.fontWeight, 10)
      if (tag === 'b' || tag === 'strong' || Number.isFinite(weight) && weight >= 600) state.bold = true
      if (tag === 'i' || tag === 'em' || style.fontStyle === 'italic') state.italic = true
      if (tag === 'u' || String(style.textDecorationLine || '').includes('underline')) state.underline = true
      node = node.parentElement
    }
    return state
  }
  function getCommandFormatState(name, fallbackState) {
    try {
      const selection = window.getSelection?.()
      if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return false
      if (typeof document.queryCommandState !== 'function') return Boolean(fallbackState)
      return Boolean(document.queryCommandState(name))
    } catch {
      return Boolean(fallbackState)
    }
  }
  function refreshToolbarState({ preservePending = true } = {}) {
    try {
      const selection = window.getSelection?.()
      const collapsed = Boolean(selection?.rangeCount && selection.getRangeAt(0).collapsed)
      const domState = getDomFormatState()
      const commandState = {
        bold: getCommandFormatState('bold', domState.bold),
        italic: getCommandFormatState('italic', domState.italic),
        underline: getCommandFormatState('underline', domState.underline),
      }
      const pending = pendingFormatsRef.current
      const nextFormats = collapsed && preservePending
        ? {
            bold: pending.bold === null ? commandState.bold : pending.bold,
            italic: pending.italic === null ? commandState.italic : pending.italic,
            underline: pending.underline === null ? commandState.underline : pending.underline,
          }
        : commandState
      setActiveFormats(nextFormats)
      const anchorElement = selection?.anchorNode?.nodeType === Node.TEXT_NODE
        ? selection.anchorNode.parentElement
        : selection?.anchorNode
      if (anchorElement && editorRef.current?.contains(anchorElement)) {
        const computedSize = Number.parseFloat(window.getComputedStyle(anchorElement).fontSize)
        if (Number.isFinite(computedSize)) setFontSize(String(Math.round(computedSize)))
      }
      setActiveAlign(document.queryCommandState('justifyCenter') ? 'center' : document.queryCommandState('justifyRight') ? 'right' : 'left')
      setActiveList(document.queryCommandState('insertUnorderedList') ? 'unordered' : document.queryCommandState('insertOrderedList') ? 'ordered' : '')
    } catch {}
  }
  function toggleFormat(name) {
    editorRef.current?.focus()
    restoreSelection()
    const selection = window.getSelection?.()
    if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return

    const range = selection.getRangeAt(0)
    const collapsed = range.collapsed
    const domState = getDomFormatState()
    const pendingValue = pendingFormatsRef.current[name]
    const currentValue = collapsed && pendingValue !== null
      ? pendingValue
      : getCommandFormatState(name, domState[name])
    const nextValue = !currentValue

    document.execCommand(name, false, null)
    if (collapsed) {
      pendingFormatsRef.current = { ...pendingFormatsRef.current, [name]: nextValue }
    } else {
      clearPendingFormats()
    }

    rememberSelection()
    if (collapsed && selectionRef.current) pendingSelectionRef.current = selectionRef.current.cloneRange()
    setActiveFormats((current) => ({ ...current, [name]: nextValue }))
    sync()
    window.requestAnimationFrame(() => refreshToolbarState({ preservePending: collapsed }))
  }
  function command(name, value = null) {
    editorRef.current?.focus()
    restoreSelection()
    document.execCommand(name, false, value)
    rememberSelection()
    refreshToolbarState()
    sync()
  }
  function applyAdaptiveEditorColor(commandName) {
    if (!selectionRef.current) return
    editorRef.current?.focus({ preventScroll: true })
    restoreSelection()
    const selection = window.getSelection?.()
    if (!selection?.rangeCount) return
    const range = selection.getRangeAt(0)
    const span = document.createElement('span')
    if (commandName === 'foreColor') span.dataset.zunyAdaptiveText = 'true'
    else span.dataset.zunyAdaptiveBackground = 'true'

    if (range.collapsed) {
      const marker = document.createTextNode('​')
      span.appendChild(marker)
      range.insertNode(span)
      const caret = document.createRange()
      caret.setStart(marker, marker.data.length)
      caret.collapse(true)
      selection.removeAllRanges()
      selection.addRange(caret)
    } else {
      span.appendChild(range.extractContents())
      range.insertNode(span)
      const nextRange = document.createRange()
      nextRange.selectNodeContents(span)
      selection.removeAllRanges()
      selection.addRange(nextRange)
    }

    if (commandName === 'foreColor') setTextColor('adaptive')
    else setHighlightColor('adaptive')
    rememberSelection()
    sync()
  }
  function applyEditorColor(commandName, value) {
    const color = String(value || '').trim()
    if (!color || !selectionRef.current) return
    if (color === 'adaptive') {
      applyAdaptiveEditorColor(commandName)
      setOpenToolbarMenu('')
      return
    }

    editorRef.current?.focus({ preventScroll: true })
    restoreSelection()

    const selection = window.getSelection?.()
    if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return
    const range = selection.getRangeAt(0)

    // Khi con trỏ đang thu gọn, execCommand có thể đổi màu cả node văn bản
    // đang chứa con trỏ. Tạo một span định dạng mới để màu chỉ áp dụng cho
    // ký tự được nhập từ vị trí này trở đi, không ảnh hưởng phần đã gõ trước đó.
    if (range.collapsed) {
      const span = document.createElement('span')
      if (commandName === 'foreColor') {
        span.style.color = color
        span.dataset.zunyTextColor = color
      } else {
        span.style.backgroundColor = color
        span.dataset.zunyHighlightColor = color
      }

      const marker = document.createTextNode('​')
      span.appendChild(marker)
      range.insertNode(span)

      const caret = document.createRange()
      caret.setStart(marker, marker.data.length)
      caret.collapse(true)
      selection.removeAllRanges()
      selection.addRange(caret)
    } else {
      try {
        document.execCommand('styleWithCSS', false, true)
        const applied = document.execCommand(commandName, false, color)
        if (!applied && commandName === 'hiliteColor') document.execCommand('backColor', false, color)
      } catch {
        if (commandName === 'hiliteColor') {
          try { document.execCommand('backColor', false, color) } catch {}
        }
      }
    }

    if (commandName === 'foreColor') setTextColor(color)
    if (commandName === 'hiliteColor') setHighlightColor(color)
    rememberSelection()
    sync()
    setOpenToolbarMenu('')
    window.requestAnimationFrame(() => refreshToolbarState())
  }
  function applyCustomColor(commandName) {
    const raw = commandName === 'foreColor' ? textHexInput : highlightHexInput
    const normalized = String(raw || '').trim()
    if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized)) return
    const color = normalized.toLowerCase()
    if (commandName === 'foreColor') setSavedTextColors((items) => Array.from(new Set([color, ...items])).slice(0, 6))
    else setSavedHighlightColors((items) => Array.from(new Set([color, ...items])).slice(0, 6))
    applyEditorColor(commandName, color)
  }
  function applyFontSize(value) {
    const px = Math.max(8, Math.min(96, Number(value || 16)))
    setFontSize(String(px))
    editorRef.current?.focus({ preventScroll: true })
    restoreSelection()

    const selection = window.getSelection?.()
    if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return

    const range = selection.getRangeAt(0)
    const span = document.createElement('span')
    span.style.fontSize = `${px}px`
    span.dataset.zunyFontSize = String(px)

    if (range.collapsed) {
      const marker = document.createTextNode('​')
      span.appendChild(marker)
      range.insertNode(span)

      const caret = document.createRange()
      caret.setStart(marker, marker.data.length)
      caret.collapse(true)
      selection.removeAllRanges()
      selection.addRange(caret)
    } else {
      try {
        span.appendChild(range.extractContents())
        range.insertNode(span)
        const selectedRange = document.createRange()
        selectedRange.selectNodeContents(span)
        selection.removeAllRanges()
        selection.addRange(selectedRange)
      } catch {
        document.execCommand('styleWithCSS', false, true)
        document.execCommand('fontSize', false, '7')
        editorRef.current?.querySelectorAll('font[size="7"]').forEach((node) => {
          node.removeAttribute('size')
          node.style.fontSize = `${px}px`
          node.dataset.zunyFontSize = String(px)
        })
      }
    }

    rememberSelection()
    sync()
    window.requestAnimationFrame(() => refreshToolbarState())
  }
  function cancelToolbarMenuHide() {
    if (toolbarMenuHideTimerRef.current) {
      window.clearTimeout(toolbarMenuHideTimerRef.current)
      toolbarMenuHideTimerRef.current = null
    }
  }
  function showToolbarMenu(type, triggerRef) {
    cancelToolbarMenuHide()
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      const menuWidth = type === 'font' ? 260 : type === 'textColor' || type === 'highlightColor' ? 300 : 224
      const menuHeight = type === 'font' ? 360 : type === 'textColor' || type === 'highlightColor' ? 330 : type === 'list' ? 132 : 190
      const safeLeft = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - menuWidth - 8))
      const belowTop = rect.bottom + 6
      const safeTop = belowTop + menuHeight <= window.innerHeight - 8
        ? belowTop
        : Math.max(8, rect.top - menuHeight - 6)
      setToolbarMenuPosition({ top: safeTop, left: safeLeft })
    }
    setOpenToolbarMenu(type)
  }
  function hideToolbarMenu(type) {
    cancelToolbarMenuHide()
    toolbarMenuHideTimerRef.current = window.setTimeout(() => {
      setOpenToolbarMenu((current) => current === type ? '' : current)
      toolbarMenuHideTimerRef.current = null
    }, 320)
  }
  function toggleToolbarMenu(type, triggerRef) {
    if (openToolbarMenu === type) {
      setOpenToolbarMenu('')
      return
    }
    showToolbarMenu(type, triggerRef)
  }
  function openInsertDialog(type) {
    rememberSelection()
    setInsertValue('')
    setTableRows(2)
    setTableColumns(2)
    setInsertDialog(type)
  }
  function confirmInsert() {
    if (insertDialog === 'link') {
      const url = String(insertValue || '').trim()
      if (!url) return
      command('createLink', /^https?:\/\//i.test(url) ? url : `https://${url}`)
    }
    if (insertDialog === 'image') {
      const url = String(insertValue || '').trim()
      if (!url) return
      command('insertImage', url)
    }
    if (insertDialog === 'table') {
      const rows = Math.max(1, Math.min(20, Number(tableRows || 1)))
      const columns = Math.max(1, Math.min(12, Number(tableColumns || 1)))
      const body = Array.from({ length: rows }, (_, rowIndex) => `<tr>${Array.from({ length: columns }, (_, columnIndex) => `<td>Ô ${rowIndex + 1}.${columnIndex + 1}</td>`).join('')}</tr>`).join('')
      command('insertHTML', `<table><tbody>${body}</tbody></table><p><br></p>`)
    }
    setInsertDialog(null)
  }
  function handleDrop(event, kind) {
    event.preventDefault()
    const file = event.dataTransfer?.files?.[0]
    kind === 'file' ? setDraggingFile(false) : setDraggingImage(false)
    if (!file) return
    const syntheticEvent = { target: { files: [file], value: '' } }
    if (kind === 'file') onUpload?.(syntheticEvent)
    else onImageUpload?.(syntheticEvent)
  }
  function formatBytes(value) {
    const bytes = Number(value || 0)
    if (!bytes) return 'Không rõ dung lượng'
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  const baseTool = 'grid h-9 min-w-9 shrink-0 place-items-center rounded-lg px-2 text-sm font-black transition-colors duration-150'
  const toolButton = `${baseTool} text-slate-600 hover:bg-slate-200/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white`
  const activeTool = `${baseTool} bg-blue-600 text-white shadow-sm shadow-blue-500/20 dark:bg-blue-500`
  const previewHtml = html || '<p class="text-slate-400">Nội dung xem trước sẽ xuất hiện tại đây.</p>'

  return <div className="mx-auto w-full max-w-[1050px] space-y-5">
    <div className="grid gap-3 sm:grid-cols-3">
      {methods.map(([value, icon, label, description]) => <button key={value} type="button" onClick={() => onModeChange(value)} className={`rounded-2xl border p-4 text-left transition ${mode === value ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-500/10 dark:bg-emerald-500/10' : 'border-slate-200 hover:border-emerald-300 dark:border-white/10'}`}><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-lg text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">{icon}</span><b className="mt-3 block text-sm">{label}</b><span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</span></button>)}
    </div>

    {mode === 'upload' && <div className="space-y-4">
      <input ref={fileInputRef} type="file" accept=".doc,.docx,.pdf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={onUpload} className="hidden" />
      {!fileUrl ? <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} onDragOver={(e)=>{e.preventDefault();setDraggingFile(true)}} onDragLeave={()=>setDraggingFile(false)} onDrop={(e)=>handleDrop(e,'file')} className={`grid min-h-[230px] w-full place-items-center rounded-3xl border-2 border-dashed p-6 text-center transition disabled:opacity-60 ${draggingFile ? 'border-emerald-500 bg-emerald-100 dark:bg-emerald-500/15' : 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-400/30 dark:bg-emerald-500/10'}`}><span><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white text-3xl shadow-sm dark:bg-white/10">⇧</span><b className="mt-4 block text-base text-emerald-700 dark:text-emerald-300">{uploading ? 'Đang tải tài liệu...' : 'Kéo thả tài liệu vào đây'}</b><span className="mt-2 block text-sm text-slate-500">hoặc <u>Chọn file từ máy</u></span><span className="mt-4 block text-xs leading-5 text-slate-500 dark:text-slate-400">Hỗ trợ: .doc, .docx, .pdf • Dung lượng tối đa 20 MB<br/>Word được trích xuất để xem trước • PDF giữ nguyên định dạng</span></span></button> : <UploadedFileCard icon={isPdf ? 'PDF' : 'DOC'} name={fileName} size={formatBytes(fileSize)} status={uploading ? 'Đang tải' : 'Tải thành công'} onPreview={()=>window.open(fileUrl,'_blank','noopener,noreferrer')} onReplace={()=>fileInputRef.current?.click()} onRemove={onClearFile} />}
      {fileUrl && isPdf && <iframe src={fileUrl} title={fileName || 'PDF'} className="h-[clamp(420px,65vh,720px)] w-full rounded-2xl border border-slate-200 bg-white dark:border-white/10" />}
      {fileUrl && isWord && <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 text-sm dark:border-blue-400/20 dark:bg-blue-500/10">Nội dung Word đã được trích xuất. Bạn có thể chỉnh sửa và xem trước bên dưới.</div>}
    </div>}

    {mode === 'image' && <div className="space-y-4">
      <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onImageUpload} className="hidden" />
      {!imageUrl ? <button type="button" disabled={uploadingImage} onClick={()=>imageInputRef.current?.click()} onDragOver={(e)=>{e.preventDefault();setDraggingImage(true)}} onDragLeave={()=>setDraggingImage(false)} onDrop={(e)=>handleDrop(e,'image')} className={`grid min-h-[220px] w-full place-items-center rounded-3xl border-2 border-dashed p-6 text-center transition disabled:opacity-60 ${draggingImage ? 'border-violet-500 bg-violet-100 dark:bg-violet-500/15' : 'border-violet-300 bg-violet-50/60 dark:border-violet-400/30 dark:bg-violet-500/10'}`}><span><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white text-3xl shadow-sm dark:bg-white/10">▧</span><b className="mt-4 block text-base text-violet-700 dark:text-violet-300">{uploadingImage ? 'Đang tải ảnh...' : 'Kéo thả ảnh tài liệu vào đây'}</b><span className="mt-2 block text-sm text-slate-500">JPG, PNG hoặc WEBP • Tối đa 5 MB</span></span></button> : <UploadedFileCard icon="IMG" name={imageName} size={formatBytes(imageSize)} status={uploadingImage ? 'Đang tải' : 'Tải thành công'} onPreview={()=>window.open(imageUrl,'_blank','noopener,noreferrer')} onReplace={()=>imageInputRef.current?.click()} onRemove={onClearImage} />}
      {imageUrl && <div className="min-h-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]"><img src={imageUrl} alt={imageName || 'Tài liệu ảnh'} className="mx-auto max-h-[680px] w-full object-contain" /></div>}
    </div>}

    {(mode === 'type' || (mode === 'upload' && !isPdf)) && <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 p-2 backdrop-blur dark:border-white/10 dark:bg-[#182235]/95">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            <div ref={fontMenuRef} className="relative shrink-0" onPointerEnter={()=>showToolbarMenu('font',fontMenuRef)} onPointerLeave={()=>hideToolbarMenu('font')}>
              <button type="button" title="Cỡ chữ" aria-expanded={openToolbarMenu==='font'} onMouseDown={(e)=>e.preventDefault()} onClick={()=>toggleToolbarMenu('font',fontMenuRef)} className="inline-flex h-10 min-w-[98px] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200">
                <span className="flex items-center gap-1.5"><span className="text-[11px] font-bold text-slate-400">Aa</span><span className="tabular-nums">{fontSize}</span></span><span className="text-[10px] text-slate-400">▾</span>
              </button>
              {openToolbarMenu==='font' && typeof document !== 'undefined' && createPortal(<div onPointerEnter={()=>{cancelToolbarMenuHide();setOpenToolbarMenu('font')}} onPointerLeave={()=>hideToolbarMenu('font')} className="fixed overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#1e293b]" style={{top:toolbarMenuPosition.top,left:toolbarMenuPosition.left,zIndex:1200,width:260}}><div className="border-b border-slate-200 px-4 py-3 dark:border-white/10"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Cỡ chữ</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Số càng lớn, chữ hiển thị càng lớn.</p></div><div className="max-h-[286px] overflow-y-auto p-2">{fontSizes.map((size)=>{const active=fontSize===size; const sampleSize=Math.max(12,Math.min(32,Number(size)*0.5)); return <button key={size} type="button" onMouseDown={(e)=>e.preventDefault()} onClick={()=>{applyFontSize(size);setOpenToolbarMenu('')}} className={`mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${active?'bg-blue-600 text-white':'hover:bg-slate-100 dark:hover:bg-white/10'}`}><span className="font-black">{size} px</span><span style={{fontSize:sampleSize}} className="leading-none">Aa</span></button>})}</div></div>,document.body)}
            </div>
            <span className="h-7 w-px shrink-0 bg-slate-200 dark:bg-white/10" />
            <button type="button" title="In đậm" aria-pressed={activeFormats.bold} onMouseDown={(e)=>e.preventDefault()} onClick={()=>toggleFormat('bold')} className={activeFormats.bold ? activeTool : toolButton}>B</button>
            <button type="button" title="In nghiêng" aria-pressed={activeFormats.italic} onMouseDown={(e)=>e.preventDefault()} onClick={()=>toggleFormat('italic')} className={`${activeFormats.italic ? activeTool : toolButton} italic`}>I</button>
            <button type="button" title="Gạch chân" aria-pressed={activeFormats.underline} onMouseDown={(e)=>e.preventDefault()} onClick={()=>toggleFormat('underline')} className={`${activeFormats.underline ? activeTool : toolButton} underline`}>U</button>
            <div ref={textColorMenuRef} className="relative shrink-0">
              <button type="button" title="Màu chữ" aria-expanded={openToolbarMenu==='textColor'} onMouseDown={(e)=>{e.preventDefault();rememberSelection()}} onClick={()=>toggleToolbarMenu('textColor',textColorMenuRef)} className={`${toolButton} !flex min-w-[46px] items-center gap-1`}><span className="flex flex-col items-center leading-none"><span className="text-base font-black">A</span><span className="mt-0.5 h-1 w-4 rounded-full" style={{backgroundColor:textColor==='adaptive'?adaptiveColor:textColor}} /></span><span className="text-[9px] text-slate-400">▾</span></button>
              {openToolbarMenu==='textColor' && typeof document !== 'undefined' && createPortal(<ColorPaletteMenu title="Màu chữ" selected={textColor} adaptiveColor={adaptiveColor} defaultColorSwatch={defaultColorSwatch} rainbowColors={rainbowColors} savedColors={savedTextColors} hexValue={textHexInput} onHexChange={setTextHexInput} onApplyHex={()=>applyCustomColor('foreColor')} onSelect={(color)=>applyEditorColor('foreColor',color)} position={toolbarMenuPosition}/>,document.body)}
            </div>
            <div ref={highlightColorMenuRef} className="relative shrink-0">
              <button type="button" title="Màu nền chữ" aria-expanded={openToolbarMenu==='highlightColor'} onMouseDown={(e)=>{e.preventDefault();rememberSelection()}} onClick={()=>toggleToolbarMenu('highlightColor',highlightColorMenuRef)} className={`${toolButton} !flex min-w-[46px] items-center gap-1`}><span className="grid h-6 w-6 place-items-center rounded-md border border-slate-300/70 text-sm font-black dark:border-white/15" style={{backgroundColor:highlightColor==='adaptive'?adaptiveColor:highlightColor,color:highlightColor==='adaptive'?(isEditorDark?'#ffffff':'#111827'):'#111827'}}>A</span><span className="text-[9px] text-slate-400">▾</span></button>
              {openToolbarMenu==='highlightColor' && typeof document !== 'undefined' && createPortal(<ColorPaletteMenu title="Màu nền chữ" selected={highlightColor} adaptiveColor={adaptiveColor} defaultColorSwatch={defaultColorSwatch} rainbowColors={rainbowColors} savedColors={savedHighlightColors} hexValue={highlightHexInput} onHexChange={setHighlightHexInput} onApplyHex={()=>applyCustomColor('hiliteColor')} onSelect={(color)=>applyEditorColor('hiliteColor',color)} position={toolbarMenuPosition}/>,document.body)}
            </div>
            <span className="h-7 w-px shrink-0 bg-slate-200 dark:bg-white/10" />
            <button type="button" title="Căn trái" aria-pressed={activeAlign==='left'} onMouseDown={(e)=>e.preventDefault()} onClick={()=>command('justifyLeft')} className={activeAlign==='left' ? activeTool : toolButton}>☰</button>
            <button type="button" title="Căn giữa" aria-pressed={activeAlign==='center'} onMouseDown={(e)=>e.preventDefault()} onClick={()=>command('justifyCenter')} className={activeAlign==='center' ? activeTool : toolButton}>≣</button>
            <button type="button" title="Căn phải" aria-pressed={activeAlign==='right'} onMouseDown={(e)=>e.preventDefault()} onClick={()=>command('justifyRight')} className={activeAlign==='right' ? activeTool : toolButton}>☷</button>
            <span className="h-7 w-px shrink-0 bg-slate-200 dark:bg-white/10" />
            <div ref={listMenuRef} className="relative shrink-0" onPointerEnter={()=>showToolbarMenu('list',listMenuRef)} onPointerLeave={()=>hideToolbarMenu('list')}>
              <button type="button" title="Danh sách" aria-expanded={openToolbarMenu==='list'} onMouseDown={(e)=>e.preventDefault()} onClick={()=>toggleToolbarMenu('list',listMenuRef)} className={`${activeList ? activeTool : toolButton} !flex min-w-[96px] items-center justify-between gap-2`}><span className="grid h-6 min-w-6 place-items-center rounded-md bg-black/5 text-sm dark:bg-white/10">{activeList==='ordered'?'1.':'•'}</span><span className="text-[11px] font-bold">Danh sách</span><span className="text-[9px]">⌄</span></button>
              {openToolbarMenu==='list' && typeof document !== 'undefined' && createPortal(<div role="menu" onPointerEnter={()=>{cancelToolbarMenuHide();setOpenToolbarMenu('list')}} onPointerLeave={()=>hideToolbarMenu('list')} className="fixed w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-white/10 dark:bg-[#1e293b]" style={{top:toolbarMenuPosition.top,left:toolbarMenuPosition.left,zIndex:1200}}>
                <button type="button" role="menuitem" onMouseDown={(e)=>e.preventDefault()} onClick={()=>{command('insertUnorderedList');setOpenToolbarMenu('')}} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-bold ${activeList==='unordered'?'bg-blue-600 text-white':'hover:bg-slate-100 dark:hover:bg-white/10'}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-lg text-slate-700 dark:bg-white/10 dark:text-white">•</span><span><span className="block">Danh sách chấm</span><span className="block text-[10px] font-medium opacity-70">Tạo danh sách ký hiệu</span></span></button>
                <button type="button" role="menuitem" onMouseDown={(e)=>e.preventDefault()} onClick={()=>{command('insertOrderedList');setOpenToolbarMenu('')}} className={`mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-bold ${activeList==='ordered'?'bg-blue-600 text-white':'hover:bg-slate-100 dark:hover:bg-white/10'}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs text-slate-700 dark:bg-white/10 dark:text-white">1.</span><span><span className="block">Danh sách số</span><span className="block text-[10px] font-medium opacity-70">Tạo danh sách thứ tự</span></span></button>
              </div>, document.body)}
            </div>
            <div ref={insertMenuRef} className="relative shrink-0" onPointerEnter={()=>showToolbarMenu('insert',insertMenuRef)} onPointerLeave={()=>hideToolbarMenu('insert')}>
              <button type="button" title="Chèn nội dung" aria-expanded={openToolbarMenu==='insert'} onMouseDown={(e)=>e.preventDefault()} onClick={()=>toggleToolbarMenu('insert',insertMenuRef)} className={`${toolButton} !flex min-w-[88px] items-center justify-between gap-2`}><span className="grid h-6 w-6 place-items-center rounded-md bg-black/5 text-base dark:bg-white/10">＋</span><span className="text-[11px] font-bold">Chèn</span><span className="text-[9px]">⌄</span></button>
              {openToolbarMenu==='insert' && typeof document !== 'undefined' && createPortal(<div role="menu" onPointerEnter={()=>{cancelToolbarMenuHide();setOpenToolbarMenu('insert')}} onPointerLeave={()=>hideToolbarMenu('insert')} className="fixed w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-white/10 dark:bg-[#1e293b]" style={{top:toolbarMenuPosition.top,left:toolbarMenuPosition.left,zIndex:1200}}>
                <button type="button" role="menuitem" onMouseDown={(e)=>e.preventDefault()} onClick={()=>{setOpenToolbarMenu('');openInsertDialog('link')}} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-slate-100 dark:hover:bg-white/10"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-base dark:bg-blue-500/15">🔗</span><span><span className="block">Chèn liên kết</span><span className="block text-[10px] font-medium text-slate-400">Gắn URL vào văn bản</span></span></button>
                <button type="button" role="menuitem" onMouseDown={(e)=>e.preventDefault()} onClick={()=>{setOpenToolbarMenu('');openInsertDialog('image')}} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-slate-100 dark:hover:bg-white/10"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-base dark:bg-emerald-500/15">▧</span><span><span className="block">Chèn ảnh</span><span className="block text-[10px] font-medium text-slate-400">Thêm ảnh từ đường dẫn</span></span></button>
                <button type="button" role="menuitem" onMouseDown={(e)=>e.preventDefault()} onClick={()=>{setOpenToolbarMenu('');openInsertDialog('table')}} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-slate-100 dark:hover:bg-white/10"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-50 text-base dark:bg-violet-500/15">▦</span><span><span className="block">Chèn bảng</span><span className="block text-[10px] font-medium text-slate-400">Chọn số hàng và cột</span></span></button>
              </div>, document.body)}
            </div>
            <span className="h-7 w-px shrink-0 bg-slate-200 dark:bg-white/10" />
            <button type="button" title="Hoàn tác" onMouseDown={(e)=>e.preventDefault()} onClick={()=>command('undo')} className={toolButton}>↶</button>
            <button type="button" title="Làm lại" onMouseDown={(e)=>e.preventDefault()} onClick={()=>command('redo')} className={toolButton}>↷</button>
          </div>
        </div>
        <div ref={editorRef} contentEditable suppressContentEditableWarning data-placeholder="Bắt đầu nhập nội dung tài liệu tại đây…" onInput={handleEditorInput} onKeyUp={()=>{rememberSelection();refreshToolbarState()}} onMouseUp={()=>{rememberSelection();refreshToolbarState()}} onFocus={()=>{rememberSelection();refreshToolbarState()}} style={{fontSize:'16px'}} className="prose min-h-[400px] max-w-none overflow-visible p-5 text-base leading-7 outline-none empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] dark:prose-invert [&_img]:max-w-full [&_ol]:ml-7 [&_ol]:list-decimal [&_ul]:ml-7 [&_ul]:list-disc [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:p-2 dark:[&_td]:border-white/20 [&_span[data-zuny-adaptive-text]]:text-slate-950 dark:[&_span[data-zuny-adaptive-text]]:text-white [&_span[data-zuny-adaptive-background]]:bg-white dark:[&_span[data-zuny-adaptive-background]]:bg-black [&_span[data-zuny-font-size]]:leading-[1.35]" />
        <div className="border-t border-slate-200 px-4 py-2 text-right text-xs font-semibold text-slate-400 dark:border-white/10">{wordCount.toLocaleString('vi-VN')} từ</div>
      </div>
      <div className="min-h-[320px] rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]"><div className="mb-4 border-b border-slate-200 pb-3 text-sm font-black dark:border-white/10">Xem trước tài liệu</div><article className="prose max-w-none dark:prose-invert [&_img]:max-w-full [&_ol]:ml-7 [&_ol]:list-decimal [&_ul]:ml-7 [&_ul]:list-disc [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:p-2 dark:[&_td]:border-white/20 [&_span[data-zuny-adaptive-text]]:text-slate-950 dark:[&_span[data-zuny-adaptive-text]]:text-white [&_span[data-zuny-adaptive-background]]:bg-white dark:[&_span[data-zuny-adaptive-background]]:bg-black" dangerouslySetInnerHTML={{__html:previewHtml}} /></div>
    </div>}

    {insertDialog && <div className="fixed inset-0 z-[300] grid place-items-center bg-black/60 p-4" onMouseDown={()=>setInsertDialog(null)}>
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#111827]" onMouseDown={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">Chèn nội dung</p><h3 className="mt-1 text-xl font-black">{insertDialog==='link'?'Thêm liên kết':insertDialog==='image'?'Thêm ảnh':'Tạo bảng'}</h3></div><button type="button" onClick={()=>setInsertDialog(null)} className="grid h-11 w-11 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10">×</button></div>
        {insertDialog !== 'table' ? <label className="mt-5 block"><span className="mb-2 block text-sm font-bold">{insertDialog==='link'?'Địa chỉ liên kết':'Đường dẫn ảnh'}</span><input autoFocus value={insertValue} onChange={(e)=>setInsertValue(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&confirmInsert()} placeholder={insertDialog==='link'?'https://example.com':'https://example.com/image.jpg'} className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-white/[0.06]" /></label> : <div className="mt-5 grid grid-cols-2 gap-3"><label><span className="mb-2 block text-sm font-bold">Số hàng</span><input type="number" min="1" max="20" value={tableRows} onChange={(e)=>setTableRows(e.target.value)} className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-white/[0.06]" /></label><label><span className="mb-2 block text-sm font-bold">Số cột</span><input type="number" min="1" max="12" value={tableColumns} onChange={(e)=>setTableColumns(e.target.value)} className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-white/[0.06]" /></label></div>}
        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={()=>setInsertDialog(null)} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-black dark:border-white/15">Hủy</button><button type="button" onClick={confirmInsert} className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-700">Chèn</button></div>
      </div>
    </div>}
  </div>
}

function ColorPaletteMenu({ title, selected, adaptiveColor, defaultColorSwatch, rainbowColors, savedColors, hexValue, onHexChange, onApplyHex, onSelect, position }) {
  const allColors = [...rainbowColors, ...savedColors.map((value) => ({ name: value.toUpperCase(), value }))]
  return <div className="fixed w-[300px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#1e293b]" style={{top:position.top,left:position.left,zIndex:1200}}>
    <div className="border-b border-slate-200 px-4 py-3 dark:border-white/10"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{title}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Chọn màu cầu vồng hoặc nhập mã HEX.</p></div>
    <div className="p-3">
      <button type="button" onMouseDown={(e)=>e.preventDefault()} onClick={()=>onSelect('adaptive')} className={`mb-3 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${selected==='adaptive'?'border-blue-500 bg-blue-50 dark:bg-blue-500/15':'border-slate-200 hover:border-blue-300 dark:border-white/10'}`}><span className="h-8 w-8 rounded-lg border border-slate-300 shadow-inner dark:border-white/20" style={{backgroundColor:defaultColorSwatch || adaptiveColor}}/><span className="min-w-0 flex-1"><span className="block text-sm font-black">Màu mặc định</span><span className="block text-[10px] text-slate-500 dark:text-slate-400">Light: đen • Dark: trắng</span></span>{selected==='adaptive'&&<span className="text-blue-600">✓</span>}</button>
      <div className="grid grid-cols-7 gap-2">{rainbowColors.map((color)=><button key={color.value} type="button" title={color.name} onMouseDown={(e)=>e.preventDefault()} onClick={()=>onSelect(color.value)} className={`grid aspect-square place-items-center rounded-xl border-2 transition hover:scale-105 ${selected===color.value?'border-slate-950 dark:border-white':'border-transparent'}`}><span className="h-7 w-7 rounded-lg shadow-sm" style={{backgroundColor:color.value}}/></button>)}</div>
      {savedColors.length>0&&<div className="mt-3"><p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Màu tạm lưu</p><div className="flex flex-wrap gap-2">{savedColors.map((color)=><button key={color} type="button" title={color} onMouseDown={(e)=>e.preventDefault()} onClick={()=>onSelect(color)} className={`h-8 w-8 rounded-lg border-2 ${selected===color?'border-slate-950 dark:border-white':'border-slate-200 dark:border-white/10'}`} style={{backgroundColor:color}}/>)}</div></div>}
      <div className="mt-4 flex gap-2"><input value={hexValue} onChange={(e)=>onHexChange(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter'){e.preventDefault();onApplyHex()}}} placeholder="#1d4ed8" className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 bg-transparent px-3 font-mono text-sm uppercase outline-none focus:border-blue-500 dark:border-white/15"/><button type="button" onMouseDown={(e)=>e.preventDefault()} onClick={onApplyHex} className="rounded-xl bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-700">Lưu & dùng</button></div>
      <p className="mt-2 text-[10px] text-slate-400">Hỗ trợ mã #RGB hoặc #RRGGBB. Màu chỉ được lưu trong lần soạn hiện tại.</p>
    </div>
  </div>
}

function UploadedFileCard({ icon, name, size, status, onPreview, onReplace, onRemove }) {
  return <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03] sm:flex-row sm:items-center"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-xs font-black text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">{icon}</span><div className="min-w-0 flex-1"><p className="truncate font-black">{name || 'Tài liệu'}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{size} • <span className="font-bold text-emerald-600 dark:text-emerald-400">{status}</span></p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={onPreview} className="rounded-full border border-slate-300 px-3 py-2 text-xs font-black dark:border-white/15">Xem trước</button><button type="button" onClick={onReplace} className="rounded-full bg-slate-900 px-3 py-2 text-xs font-black text-white dark:bg-white dark:text-slate-950">Thay file</button><button type="button" onClick={onRemove} className="rounded-full border border-rose-200 px-3 py-2 text-xs font-black text-rose-600 dark:border-rose-400/20">Xóa</button></div></div>
}

function OpenSchedulePicker({ value, onChange }) {
  const initial=value?new Date(value):null
  const [open,setOpen]=useState(false)
  const [month,setMonth]=useState(()=>initial&&!Number.isNaN(initial.getTime())?new Date(initial.getFullYear(),initial.getMonth(),1):new Date(new Date().getFullYear(),new Date().getMonth(),1))
  const selected=value?new Date(value):null
  const validSelected=selected&&!Number.isNaN(selected.getTime())?selected:null
  const hour=validSelected?String(validSelected.getHours()).padStart(2,'0'):'08'
  const minute=validSelected?String(validSelected.getMinutes()).padStart(2,'0'):'00'
  const daysInMonth=new Date(month.getFullYear(),month.getMonth()+1,0).getDate()
  const offset=new Date(month.getFullYear(),month.getMonth(),1).getDay()
  const cells=[...Array(offset).fill(null),...Array.from({length:daysInMonth},(_,i)=>i+1)]
  const pad=(n)=>String(n).padStart(2,'0')
  function emit(date){onChange(`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`)}
  function setDatePart(day){emit(new Date(month.getFullYear(),month.getMonth(),day,Number(hour),Number(minute),0,0))}
  function setTimePart(nextHour,nextMinute){const base=validSelected||new Date();emit(new Date(base.getFullYear(),base.getMonth(),base.getDate(),Number(nextHour),Number(nextMinute),0,0))}
  return <div onClick={()=>setOpen(true)} className={`cursor-pointer rounded-2xl border p-4 transition ${open?'border-blue-400 bg-blue-50/70 ring-4 ring-blue-500/10 dark:border-blue-400/40 dark:bg-blue-500/[0.08]':'border-slate-200 bg-slate-50/70 hover:border-blue-300 dark:border-white/10 dark:bg-white/[0.035]'}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-black">Thời gian mở bài học</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Nhấn bất kỳ vị trí nào trong khung để chọn lịch mở.</p></div><button type="button" onClick={(e)=>{e.stopPropagation();setOpen(v=>!v)}} className="rounded-full bg-blue-600 px-4 py-2 text-xs font-black text-white">{validSelected?validSelected.toLocaleString('vi-VN'):'Chọn ngày giờ'}</button></div>{open&&<div onClick={(e)=>e.stopPropagation()} className="mt-4 grid gap-4 lg:grid-cols-[1fr_240px]"><div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#182235]"><div className="flex items-center justify-between"><button type="button" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))} className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10">‹</button><b>Tháng {month.getMonth()+1}/{month.getFullYear()}</b><button type="button" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))} className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10">›</button></div><div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-black text-slate-400">{['CN','T2','T3','T4','T5','T6','T7'].map(x=><span key={x}>{x}</span>)}</div><div className="mt-2 grid grid-cols-7 gap-1">{cells.map((day,i)=>day?<button key={i} type="button" onClick={()=>setDatePart(day)} className={`aspect-square rounded-lg text-xs font-bold transition ${validSelected&&validSelected.getFullYear()===month.getFullYear()&&validSelected.getMonth()===month.getMonth()&&validSelected.getDate()===day?'bg-blue-600 text-white':'hover:bg-blue-50 dark:hover:bg-white/10'}`}>{day}</button>:<span key={i}/>)}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#182235]"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Giờ mở</p><div className="mt-3 grid grid-cols-2 gap-2"><SmartFilterSelect label="Giờ" value={hour} onChange={(v)=>setTimePart(v,minute)} options={Array.from({length:24},(_,i)=>({value:pad(i),label:pad(i)}))} icon="◷"/><SmartFilterSelect label="Phút" value={minute} onChange={(v)=>setTimePart(hour,v)} options={Array.from({length:60},(_,i)=>({value:pad(i),label:pad(i)}))} icon="⋮"/></div>{validSelected&&<button type="button" onClick={()=>onChange('')} className="mt-4 w-full rounded-xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-600 dark:border-rose-400/20">Mở ngay, bỏ lịch</button>}</div></div>}</div>
}

function SourceIdeaEditor({ sources,onChange }) {
  function add(){onChange([...(sources || []),{title:'',url:''}])}
  function update(index,field,value){const next=[...(sources || [])]; next[index]={...next[index],[field]:value}; onChange(next)}
  return <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10"><div className="flex items-center justify-between"><div><h4 className="font-black">Nguồn video tham khảo</h4><p className="text-xs text-slate-500">Dữ liệu này được lưu cùng bài học trên Firebase.</p></div><button type="button" onClick={add} className="text-sm font-black text-blue-600">+ Thêm nguồn</button></div><div className="mt-4 space-y-3">{(sources || []).map((source,index) => <div key={index} className="grid gap-2 md:grid-cols-[1fr_1.3fr_auto]"><Input label="Tên nguồn" value={source.title} onChange={(v) => update(index,'title',v)} /><Input label="URL / ghi chú" value={source.url} onChange={(v) => update(index,'url',v)} /><button type="button" onClick={() => onChange(sources.filter((_,i) => i!==index))} className="self-end rounded-xl px-3 py-2.5 text-rose-600"><TrashIcon /></button></div>)}</div></div>
}

function FormSection({ eyebrow, title, description, children }) {
  return (
    <section>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
      <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  )
}

export function ModalShell({ children,onClose,maxWidth='max-w-2xl' }) { return <div className="fixed inset-0 z-999 flex items-center justify-center overflow-hidden bg-black/65 p-0 backdrop-blur-sm sm:p-3"><button type="button" className="absolute inset-0" onClick={onClose} aria-label="Đóng"/><div className={`relative h-[100dvh] w-full ${maxWidth} overflow-hidden rounded-none bg-white shadow-2xl dark:bg-[#202020] sm:h-auto sm:max-h-[96dvh] sm:rounded-2xl`}>{children}</div></div> }
export function ConfirmModal({ title,courseTitle,onCancel,onConfirm }) { return <ModalShell onClose={onCancel} maxWidth="max-w-md"><div className="p-6"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/10"><TrashIcon large/></div><h2 className="mt-4 text-center text-xl font-black">{title}</h2><p className="mt-2 text-center text-sm leading-6 text-slate-500 dark:text-slate-400">Bạn chắc chắn muốn xóa <strong>“{courseTitle}”</strong>? Hành động này không thể hoàn tác.</p><div className="mt-6 flex justify-center gap-2"><button type="button" onClick={onCancel} className="flex-1 rounded-full border border-slate-300 px-4 py-2.5 text-sm font-bold dark:border-white/20 sm:flex-none sm:px-5">Hủy</button><button type="button" onClick={onConfirm} className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-bold text-white">Xóa bài học</button></div></div></ModalShell> }
export function AchievementModal({ achievement,stats,onClose }) { const cards=[['Bài đã xem',achievement.watchedLessons||0],['Ngày học',achievement.watchedDates?.length||0],['Tiến độ trung bình',`${stats.averageProgress||0}%`],['Đã hoàn thành',stats.completed||0]]; return <ModalShell onClose={onClose} maxWidth="max-w-xl"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10"><div><p className="text-xs font-black uppercase tracking-wider text-blue-600">ZUNY Achievement</p><h2 className="text-xl font-black">Thành tích học tập</h2></div><IconButton onClick={onClose}><CloseIcon/></IconButton></div><div className="grid gap-3 p-5 sm:grid-cols-2">{cards.map(([label,value])=><div key={label} className="rounded-xl bg-slate-100 p-4 dark:bg-white/5"><p className="text-sm text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>)}</div></ModalShell> }
export function IconButton({children,onClick}) { return <button type="button" onClick={onClick} className="cursor-pointer grid h-10 w-10 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10">{children}</button> }
export function Input({label,value,onChange,type='text',required=false,disabled=false,maxLength,showCount=false,wordLimit=0}) { const text=String(value??''); const words=countWords(text); return <label className="block min-w-0"><span className="mb-1.5 flex items-center justify-between gap-3 text-sm font-bold"><span>{label}</span>{wordLimit?<span className={`text-[10px] font-semibold ${words>=wordLimit?'text-amber-600 dark:text-amber-400':'text-slate-400'}`}>{words}/{wordLimit} từ</span>:showCount&&maxLength?<span className="text-[10px] font-semibold text-slate-400">{text.length}/{maxLength}</span>:null}</span><input type={type} required={required} disabled={disabled} value={text} maxLength={maxLength} onChange={e=>onChange(wordLimit?limitWords(e.target.value,wordLimit):e.target.value)} className="w-full min-w-0 rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 dark:border-white/15"/></label> }
export function Textarea({label,value,onChange,required=false,rows=4,maxLength,showCount=false,wordLimit=0}) { const text=String(value??''); const words=countWords(text); return <label className="block min-w-0"><span className="mb-1.5 flex items-center justify-between gap-3 text-sm font-bold"><span>{label}</span>{wordLimit?<span className={`text-[10px] font-semibold ${words>=wordLimit?'text-amber-600 dark:text-amber-400':'text-slate-400'}`}>{words}/{wordLimit} từ</span>:showCount&&maxLength?<span className="text-[10px] font-semibold text-slate-400">{text.length}/{maxLength}</span>:null}</span><textarea required={required} rows={rows} value={text} maxLength={maxLength} onChange={e=>onChange(wordLimit?limitWords(e.target.value,wordLimit):e.target.value)} className="max-h-64 w-full min-w-0 resize-y overflow-auto rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-white/15"/></label> }
export function Select({label,value,onChange,options}) { return <label className="block"><span className="mb-1.5 block text-sm font-bold">{label}</span><select value={value??''} onChange={e=>onChange(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-white/15 dark:bg-[#202020]">{options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label> }
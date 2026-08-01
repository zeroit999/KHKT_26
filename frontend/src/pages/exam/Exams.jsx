import { useState } from 'react'
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  Edit3,
  Eye,
  ChevronRight,
  ClipboardList,
  DoorOpen,
  FileText,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Target,
  Trophy,
  Users,
  X,
} from 'lucide-react'

import useExamsPage from '../../hooks/exam/useExamsPage.js'

import CreateExamModal from '../../components/exam/CreateExamModal.jsx'
import StudentResultsModal from '../../components/exam/StudentResultsModal.jsx'
import DarkModeSelect from '../../components/exam/DarkModeSelect.jsx'
import ExamSidebar from '../../components/exam/ExamSidebar.jsx'
import MaintenanceState from '../../components/ui/MaintenanceState.jsx'

const formatDate = (value) => {
  if (!value) return 'Chưa đặt hạn'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa đặt hạn'

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

const getInitials = (name = '') => {
  const words = String(name).trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 'ZU'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

function LoadingState({ dark }) {
  return (
    <div className={dark ? 'dark' : ''}>
      <section className="min-h-screen bg-[#f7f9fc] px-4 py-8 text-slate-950 transition dark:bg-slate-950">
        <div className="mx-auto max-w-[1240px] animate-pulse space-y-7">
          <div className="h-20 rounded-2xl bg-white shadow-sm dark:bg-white/5" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-28 rounded-2xl bg-white shadow-sm dark:bg-white/5" />
            ))}
          </div>
          <div className="h-72 rounded-2xl bg-white shadow-sm dark:bg-white/5" />
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value, helper, icon, iconClass = 'bg-indigo-50 text-indigo-500' }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-5 py-5 shadow-[0_1px_4px_rgba(15,23,42,0.09)] dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-1 text-[31px] font-black leading-none text-slate-950 dark:text-white">
            {value}
          </p>
          <p className="mt-2 truncate text-xs font-medium text-slate-400 dark:text-slate-500">
            {helper}
          </p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl ${iconClass}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function DashboardHeader({ page, isStudent }) {
  const displayName = isStudent
    ? page.studentName || page.currentUserName || 'Học sinh'
    : page.teacherName || 'Thầy/Cô'

  return (
    <>
      <div className="px-5 pt-8 lg:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white md:text-[28px]">
              Chào mừng trở lại, {displayName} 👋
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              Hôm nay là {new Intl.DateTimeFormat('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              }).format(new Date())}
              {' — '}
              {isStudent
                ? `Bạn có ${page.visibleExams?.filter((exam) => exam.isUpcoming || exam.isActive).length || 0} đề thi sắp đến hạn.`
                : `Có ${page.studentResults?.length || 0} bài tự luận hoặc bài nộp đang chờ xử lý.`}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

function DashboardStats({ page, isStudent }) {
  const activeExams = page.visibleExams?.filter((exam) => exam.isActive).length || 0
  const upcomingExams = page.visibleExams?.filter((exam) => exam.isUpcoming || exam.isActive).length || 0
  const completedCount = page.studentResults?.length || 0
  const participants = page.studentResults?.length || 0
  const average = page.averageScore || '0.0'

  const cards = isStudent
    ? [
        {
          label: 'Đề thi sắp thi',
          value: upcomingExams,
          helper: 'trong 7 ngày tới',
          icon: '📋',
          iconClass: 'bg-indigo-50 text-indigo-500 dark:bg-indigo-500/15',
        },
        {
          label: 'Bài đã nộp',
          value: completedCount,
          helper: 'trong học kỳ này',
          icon: '✅',
          iconClass: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/15',
        },
        {
          label: 'Điểm trung bình',
          value: average,
          helper: 'trên tất cả môn',
          icon: '🎯',
          iconClass: 'bg-amber-50 text-amber-500 dark:bg-amber-500/15',
        },
        {
          label: 'Xếp hạng lớp',
          value: page.currentStudentRank ? `#${page.currentStudentRank.rank}` : '—',
          helper: page.currentStudentRank ? 'trên bảng xếp hạng' : 'chưa có dữ liệu',
          icon: '🏆',
          iconClass: 'bg-violet-50 text-violet-500 dark:bg-violet-500/15',
        },
      ]
    : [
        {
          label: 'Đề thi đang mở',
          value: activeExams,
          helper: `trong ${page.exams?.length || 0} đề tổng`,
          icon: '📋',
          iconClass: 'bg-indigo-50 text-indigo-500 dark:bg-indigo-500/15',
        },
        {
          label: 'Bài nộp hôm nay',
          value: participants,
          helper: 'dữ liệu đã ghi nhận',
          icon: '✉️',
          iconClass: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/15',
        },
        {
          label: 'Chờ chấm tự luận',
          value: page.studentResults?.filter((item) => item.status === 'pending').length || 0,
          helper: 'cần xử lý',
          icon: '✏️',
          iconClass: 'bg-amber-50 text-amber-500 dark:bg-amber-500/15',
        },
        {
          label: 'Học sinh tham gia',
          value: participants,
          helper: `trong ${page.classes?.length || 0} lớp`,
          icon: '👥',
          iconClass: 'bg-violet-50 text-violet-500 dark:bg-violet-500/15',
        },
      ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </div>
  )
}

function UpcomingExamsPanel({ page, isStudent }) {
  const upcoming = (page.visibleExams || [])
    .filter((exam) => exam.isActive || exam.isUpcoming)
    .sort((a, b) => new Date(a.closeDate || a.openDate || 0) - new Date(b.closeDate || b.openDate || 0))
    .slice(0, 4)

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.09)] dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-white/10">
        <h2 className="font-black text-slate-800 dark:text-white">Đề thi sắp đến hạn</h2>
        <button
          type="button"
          onClick={() => document.getElementById('exam-list')?.scrollIntoView({ behavior: 'smooth' })}
          className="inline-flex items-center gap-1 text-xs font-bold text-[#5138f5] hover:underline"
        >
          Xem tất cả <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-[224px] divide-y divide-slate-100 dark:divide-white/10">
        {upcoming.length ? (
          upcoming.map((exam, index) => (
            <div key={exam.id} className="flex items-center gap-4 px-6 py-4">
              <span className={`h-2 w-2 shrink-0 rounded-full ${index === 1 ? 'bg-red-400' : 'bg-emerald-400'}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-700 dark:text-slate-100">
                  {exam.subject ? `${exam.subject} - ` : ''}{exam.title || 'Đề thi chưa đặt tên'}
                </p>
                <p className="mt-0.5 text-xs font-medium text-slate-400">
                  {exam.questions?.some((question) => question.type === 'essay') ? 'Tự luận' : 'Trắc nghiệm'}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-xs font-bold ${index === 1 ? 'text-red-500' : 'text-slate-500 dark:text-slate-300'}`}>
                  Hạn: {formatDate(exam.closeDate || exam.openDate)}
                </p>
                {index === 1 && <p className="mt-0.5 text-[11px] text-red-400">Hôm nay!</p>}
              </div>
              {isStudent && exam.isActive ? (
                <button
                  type="button"
                  onClick={() => page.previewExam?.(exam)}
                  className="hidden rounded-lg bg-[#5339f7] px-3 py-2 text-xs font-bold text-white sm:block"
                >
                  Vào thi
                </button>
              ) : null}
            </div>
          ))
        ) : (
          <div className="flex min-h-[224px] flex-col items-center justify-center px-6 text-center text-slate-400">
            <CalendarDays className="h-9 w-9" />
            <p className="mt-3 text-sm font-semibold">Chưa có đề thi sắp đến hạn</p>
          </div>
        )}
      </div>
    </div>
  )
}

function RecentActivityPanel({ page, isStudent }) {
  const activities = isStudent
    ? [
        ...(page.studentResults || []).slice(0, 4).map((result) => ({
          id: result.id || `${result.examId}-${result.submittedAt}`,
          text: `Bạn đã nộp ${result.examTitle || result.title || 'một bài thi'}`,
          time: result.submittedAt ? formatDate(result.submittedAt) : 'Gần đây',
          color: 'bg-blue-400',
        })),
        ...(page.visibleExams || []).slice(0, 4).map((exam) => ({
          id: `exam-${exam.id}`,
          text: `${exam.subject || 'Môn học'}: ${exam.title || 'Đề thi mới'}`,
          time: exam.isActive ? 'Đang mở' : 'Sắp diễn ra',
          color: 'bg-emerald-400',
        })),
      ].slice(0, 4)
    : [
        ...(page.studentResults || []).slice(0, 3).map((result) => ({
          id: result.id || `${result.studentId}-${result.submittedAt}`,
          text: `${result.studentName || result.name || 'Học sinh'} đã nộp ${result.examTitle || 'bài thi'}`,
          time: result.submittedAt ? formatDate(result.submittedAt) : 'Gần đây',
          color: 'bg-blue-400',
        })),
        ...(page.exams || []).slice(0, 2).map((exam) => ({
          id: `created-${exam.id}`,
          text: `Đề ${exam.subject || ''} ${exam.title || ''} đã được tạo`,
          time: exam.openDate ? formatDate(exam.openDate) : 'Gần đây',
          color: 'bg-violet-400',
        })),
      ].slice(0, 4)

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.09)] dark:border-white/10 dark:bg-white/5">
      <div className="border-b border-slate-100 px-6 py-4 dark:border-white/10">
        <h2 className="font-black text-slate-800 dark:text-white">Hoạt động gần đây</h2>
      </div>
      <div className="min-h-[224px] px-6 py-3">
        {activities.length ? (
          activities.map((activity) => (
            <div key={activity.id} className="flex gap-3 py-2.5">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${activity.color}`} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-600 dark:text-slate-200">
                  {activity.text}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{activity.time}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex min-h-[190px] flex-col items-center justify-center text-center text-slate-400">
            <ClipboardList className="h-8 w-8" />
            <p className="mt-3 text-sm font-semibold">Chưa có hoạt động</p>
          </div>
        )}
      </div>
    </div>
  )
}

function LeaderboardCard({ leaderboard = [], currentStudentRank = null, compact = false }) {
  const topStudents = leaderboard.slice(0, compact ? 5 : 10)

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_4px_rgba(15,23,42,0.09)] dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-black text-slate-950 dark:text-white">Bảng xếp hạng</h2>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            Điểm cộng = điểm bài thi / 10 × 1.05.
          </p>
        </div>
        {currentStudentRank ? (
          <div className="rounded-xl bg-amber-100 px-4 py-2 text-xs font-black text-amber-700 dark:bg-amber-500/20 dark:text-amber-100">
            Hạng của bạn: #{currentStudentRank.rank} • {currentStudentRank.points.toFixed(2)} điểm
          </div>
        ) : null}
      </div>

      {topStudents.length ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[70px_1fr_110px_110px] gap-3 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 dark:bg-white/5 dark:text-slate-300">
              <span>Hạng</span><span>Học sinh</span><span>Điểm cộng</span><span>Bài đã làm</span>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-white/10">
              {topStudents.map((student) => (
                <div key={student.id} className="grid grid-cols-[70px_1fr_110px_110px] gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                  <span className="inline-flex items-center gap-2 font-black text-amber-600 dark:text-amber-200"><Award className="h-4 w-4" />#{student.rank}</span>
                  <span className="truncate text-slate-950 dark:text-white">{student.name}</span>
                  <span className="font-black text-blue-600 dark:text-blue-200">{student.points.toFixed(2)}</span>
                  <span>{student.completedExams}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-slate-50 p-5 text-center text-sm font-bold text-slate-500 dark:bg-white/5 dark:text-slate-300">Chưa có dữ liệu xếp hạng.</div>
      )}
    </div>
  )
}

function ExamToolbar({ page, isStudent }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.09)] dark:border-white/10 dark:bg-white/5">
      <div className={`grid gap-3 ${isStudent ? 'lg:grid-cols-[1fr_210px_190px]' : 'lg:grid-cols-[1fr_170px_170px]'}`}>
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-slate-900">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={page.search}
            onChange={(event) => page.setSearch(event.target.value)}
            placeholder={isStudent ? 'Tìm kiếm đề thi...' : 'Tìm theo tên, môn học hoặc mã đề...'}
            className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 dark:text-white"
          />
        </div>

        {isStudent ? (
          <DarkModeSelect
            value={page.subjectFilter}
            onChange={page.setSubjectFilter}
            options={[
              { value: 'all', label: 'Tất cả môn học' },
              ...page.availableSubjects.map((subject) => ({ value: subject, label: subject })),
            ]}
            buttonClassName="rounded-lg bg-white px-4 py-3 text-sm dark:bg-slate-900"
          />
        ) : (
          <>
            <DarkModeSelect
              value={page.privacyFilter}
              onChange={page.setPrivacyFilter}
              options={[
                { value: 'all', label: 'Tất cả đề thi' },
                { value: 'public', label: 'Công khai' },
                { value: 'private', label: 'Riêng tư' },
              ]}
              buttonClassName="rounded-lg bg-white px-4 py-3 text-sm dark:bg-slate-900"
            />
            <DarkModeSelect
              value={page.publishFilter}
              onChange={page.setPublishFilter}
              options={[
                { value: 'all', label: 'Tất cả trạng thái' },
                { value: 'published', label: 'Hoạt động' },
                { value: 'draft', label: 'Chưa mở' },
                { value: 'ended', label: 'Đã kết thúc' },
              ]}
              buttonClassName="rounded-lg bg-white px-4 py-3 text-sm dark:bg-slate-900"
            />
          </>
        )}

        {isStudent ? (
          <div className="flex gap-2">
            <input
              value={page.codeSearch}
              onChange={(event) => page.setCodeSearch(event.target.value)}
              placeholder="Mã bài thi"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
            <button type="button" onClick={page.openByCode} className="rounded-lg bg-[#5339f7] px-4 py-3 text-sm font-black text-white">Vào</button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SectionTopbar({ page, isStudent, activeSection }) {
  const displayName = isStudent
    ? page.studentName || page.currentUserName || 'Học sinh'
    : page.teacherName || 'Thầy/Cô'

  const labels = {
    overview: 'Tổng quan',
    repository: 'Kho đề thi',
    'exam-room': 'Phòng thi',
    submissions: 'Danh sách nộp bài',
    grading: 'Chấm tự luận',
    statistics: 'Thống kê',
  }
}

function DashboardShell({ page, isStudent, activeSection, onNavigate, children }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false)

  return (
    <div className={page.dark ? 'dark' : ''}>
      <div
        className="relative min-h-[calc(100dvh-var(--zuny-navbar-height,72px))] bg-white text-slate-950 transition-colors dark:bg-slate-950"
      >
        <ExamSidebar
          page={page}
          isStudent={isStudent}
          activeItem={activeSection}
          onNavigate={onNavigate}
          onExpandedChange={setSidebarExpanded}
        />

        <section
          className={`min-w-0 transition-[padding] duration-300 ease-out ${
            sidebarExpanded ? 'lg:pl-[272px]' : 'lg:pl-24'
          }`}
        >
          <div className="min-h-[calc(100dvh-var(--zuny-navbar-height,72px))] bg-white dark:bg-slate-950">
            {activeSection === 'overview' ? (
              <DashboardHeader page={page} isStudent={isStudent} />
            ) : (
              <SectionTopbar page={page} isStudent={isStudent} activeSection={activeSection} />
            )}

            <main className="w-full px-5 pb-10 pt-7 lg:px-8">{children}</main>
          </div>
        </section>
      </div>
    </div>
  )
}

function RepositoryTabs({ page }) {
  const tabs = [
    { value: 'all', label: 'Tất cả' },
    { value: 'published', label: 'Đang mở' },
    { value: 'draft', label: 'Nháp' },
    { value: 'ended', label: 'Đã đóng' },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = page.publishFilter === tab.value
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => page.setPublishFilter(tab.value)}
            className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
              active
                ? 'border-[#5339f7] bg-[#5339f7] text-white shadow-lg shadow-violet-500/20'
                : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:text-[#5339f7] dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

function ExamStatusBadge({ exam }) {
  const config = exam.isActive
    ? { label: 'Đang mở', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300' }
    : exam.isUpcoming
      ? { label: 'Nháp', className: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-300' }
      : { label: 'Đã đóng', className: 'border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300' }

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${config.className}`}>
      {config.label}
    </span>
  )
}

const getExamTypeText = (exam) => {
  const questions = Array.isArray(exam.questions) ? exam.questions : []
  const hasEssay = questions.some((question) => question.type === 'essay')
  const hasChoice = questions.some((question) => question.type !== 'essay')
  if (hasEssay && hasChoice) return 'Trắc nghiệm + Tự luận'
  if (hasEssay) return 'Tự luận'
  return 'Trắc nghiệm'
}

function ExamRepositoryTable({ page, isStudent }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/5">
      <div className="overflow-x-auto">
        <div className="min-w-[980px]">
          <div className={`grid ${isStudent ? 'grid-cols-[2.2fr_1fr_1.35fr_0.8fr_1fr_0.9fr_90px]' : 'grid-cols-[2.2fr_1fr_1.35fr_0.8fr_1fr_0.9fr_120px]'} items-center gap-4 bg-slate-50 px-6 py-4 text-[11px] font-black uppercase tracking-[0.05em] text-slate-500 dark:bg-white/5 dark:text-slate-400`}>
            <span>Tên đề thi</span>
            <span>Môn</span>
            <span>Loại</span>
            <span>Thời gian</span>
            <span>Hạn nộp</span>
            <span>Trạng thái</span>
            <span className="text-right">Thao tác</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-white/10">
            {page.visibleExams.map((exam) => (
              <div
                key={exam.id}
                className={`grid ${isStudent ? 'grid-cols-[2.2fr_1fr_1.35fr_0.8fr_1fr_0.9fr_90px]' : 'grid-cols-[2.2fr_1fr_1.35fr_0.8fr_1fr_0.9fr_120px]'} items-center gap-4 px-6 py-4 transition hover:bg-slate-50/80 dark:hover:bg-white/[0.04]`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800 dark:text-white">
                    {exam.title || 'Đề thi chưa đặt tên'}
                  </p>
                  <p className="mt-0.5 truncate text-xs font-medium text-slate-400">
                    {exam.questionCount || exam.questions?.length || 0} câu hỏi
                    {!isStudent ? ` · ${exam.studentResults?.length || 0} học sinh` : ''}
                  </p>
                </div>
                <span className="truncate text-sm font-medium text-slate-600 dark:text-slate-300">{exam.subject || '—'}</span>
                <span className="truncate text-sm font-medium text-slate-600 dark:text-slate-300">{getExamTypeText(exam)}</span>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300"><Clock3 className="h-3.5 w-3.5 text-slate-400" />{exam.duration || 45} phút</span>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{formatDate(exam.closeDate)}</span>
                <ExamStatusBadge exam={exam} />

                <div className="flex items-center justify-end gap-1">
                  {isStudent ? (
                    <button
                      type="button"
                      onClick={() => page.previewExam?.(exam)}
                      disabled={!exam.isActive}
                      className="rounded-lg px-3 py-2 text-xs font-bold text-[#5339f7] transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:text-slate-300 dark:hover:bg-violet-500/10"
                    >
                      {exam.isActive ? 'Vào thi' : 'Xem'}
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={() => page.previewExam(exam)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-[#5339f7] dark:hover:bg-white/10" title="Xem trước"><Eye className="h-4 w-4" /></button>
                      <button type="button" onClick={() => page.openEditModal(exam)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-[#5339f7] dark:hover:bg-white/10" title="Chỉnh sửa"><Edit3 className="h-4 w-4" /></button>
                      <button type="button" onClick={() => page.copyExamLink(exam)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-[#5339f7] dark:hover:bg-white/10" title="Sao chép liên kết"><Copy className="h-4 w-4" /></button>
                      <button type="button" onClick={() => page.setDeleteConfirmExam(exam)} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10" title="Xóa"><Trash2 className="h-4 w-4" /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function RepositoryEmptyState({ page, isStudent }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center text-slate-400 dark:border-white/10 dark:bg-white/5">
      <BookOpen className="h-14 w-14" />
      <p className="mt-4 text-sm font-semibold">Không tìm thấy đề thi phù hợp</p>
      {isStudent && page.studentClasses.length > 0 ? (
        <p className="mt-2 text-xs font-semibold">Lớp hiện tại: {page.studentClasses.join(', ')}</p>
      ) : null}
    </div>
  )
}

function OverviewSection({ page, isStudent }) {
  return (
    <div className="space-y-7">
      <DashboardStats page={page} isStudent={isStudent} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2.05fr)_minmax(320px,1fr)]">
        <UpcomingExamsPanel page={page} isStudent={isStudent} />
        <RecentActivityPanel page={page} isStudent={isStudent} />
      </div>
    </div>
  )
}

function RepositorySection({ page, isStudent }) {
  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Kho đề thi</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {isStudent ? 'Quản lý và truy cập tất cả đề thi được giao.' : 'Quản lý và truy cập tất cả đề thi.'}
          </p>
        </div>
        {!isStudent && (
          <button
            data-zuny-ai-action="create-exam"
            onClick={page.openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5339f7] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:bg-[#4630df]"
          >
            <Plus className="h-4 w-4" /> Tạo đề thi
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/5 xl:flex-row xl:items-center xl:justify-between">
        <RepositoryTabs page={page} />
        <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
          <div className="flex min-w-[280px] flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 dark:border-white/10 dark:bg-slate-900">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={page.search}
              onChange={(event) => page.setSearch(event.target.value)}
              placeholder={isStudent ? 'Tìm đề thi...' : 'Tìm theo tên, môn học hoặc mã đề...'}
              className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 dark:text-white"
            />
          </div>

          {isStudent ? (
            <>
              <DarkModeSelect
                value={page.subjectFilter}
                onChange={page.setSubjectFilter}
                options={[
                  { value: 'all', label: 'Tất cả môn học' },
                  ...page.availableSubjects.map((subject) => ({ value: subject, label: subject })),
                ]}
                buttonClassName="min-w-[170px] rounded-xl bg-white px-4 py-2.5 text-sm dark:bg-slate-900"
              />
              <div className="flex gap-2">
                <input
                  value={page.codeSearch}
                  onChange={(event) => page.setCodeSearch(event.target.value)}
                  placeholder="Mã bài thi"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
                <button type="button" onClick={page.openByCode} className="rounded-xl bg-[#5339f7] px-4 py-2.5 text-sm font-black text-white">Vào</button>
              </div>
            </>
          ) : (
            <DarkModeSelect
              value={page.privacyFilter}
              onChange={page.setPrivacyFilter}
              options={[
                { value: 'all', label: 'Tất cả phạm vi' },
                { value: 'public', label: 'Công khai' },
                { value: 'private', label: 'Riêng tư' },
              ]}
              buttonClassName="min-w-[160px] rounded-xl bg-white px-4 py-2.5 text-sm dark:bg-slate-900"
            />
          )}
        </div>
      </div>

      {page.visibleExams.length ? (
        <ExamRepositoryTable page={page} isStudent={isStudent} />
      ) : (
        <RepositoryEmptyState page={page} isStudent={isStudent} />
      )}
    </section>
  )
}

function SubmissionsSection({ page }) {
  const results = page.studentResults || []
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Danh sách nộp bài</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">Theo dõi các bài thi học sinh đã gửi.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/5">
        {results.length ? (
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[1.3fr_1.8fr_1fr_1fr] gap-4 bg-slate-50 px-6 py-4 text-[11px] font-black uppercase tracking-[0.05em] text-slate-500 dark:bg-white/5">
                <span>Học sinh</span><span>Đề thi</span><span>Thời gian nộp</span><span>Trạng thái</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-white/10">
                {results.map((result, index) => (
                  <div key={result.id || `${result.examId}-${index}`} className="grid grid-cols-[1.3fr_1.8fr_1fr_1fr] gap-4 px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-bold text-slate-800 dark:text-white">{result.studentName || result.name || 'Học sinh'}</span>
                    <span>{result.examTitle || result.title || 'Bài thi'}</span>
                    <span>{result.submittedAt ? formatDate(result.submittedAt) : 'Chưa xác định'}</span>
                    <span className="font-bold text-emerald-600">Đã nộp</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center text-slate-400">
            <ClipboardList className="h-12 w-12" />
            <p className="mt-3 text-sm font-semibold">Chưa có bài nộp</p>
          </div>
        )}
      </div>
    </section>
  )
}

function GradingSection({ page }) {
  const pending = (page.studentResults || []).filter((result) => result.status === 'pending' || result.needsGrading)
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Chấm tự luận</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">Các bài tự luận đang chờ giáo viên xử lý.</p>
      </div>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/5">
        {pending.length ? (
          <div className="space-y-3">
            {pending.map((result, index) => (
              <div key={result.id || `${result.examId}-${index}`} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-slate-800 dark:text-white">{result.studentName || result.name || 'Học sinh'}</p>
                  <p className="mt-1 text-sm text-slate-500">{result.examTitle || result.title || 'Bài tự luận'}</p>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Chờ chấm</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-56 flex-col items-center justify-center text-slate-400">
            <CheckCircle2 className="h-12 w-12" />
            <p className="mt-3 text-sm font-semibold">Không có bài tự luận đang chờ chấm</p>
          </div>
        )}
      </div>
    </section>
  )
}

function StatisticsSection({ page, isStudent }) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Thống kê</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Tổng hợp kết quả và hoạt động thi.</p>
        </div>
        {!isStudent && (
          <button type="button" onClick={() => page.setStatsOpen(true)} className="rounded-xl bg-[#5339f7] px-5 py-3 text-sm font-bold text-white">Xem thống kê chi tiết</button>
        )}
      </div>
      <DashboardStats page={page} isStudent={isStudent} />
      <LeaderboardCard leaderboard={page.leaderboard} currentStudentRank={isStudent ? page.currentStudentRank : null} />
    </section>
  )
}


function ExamRoomSection({ page, isStudent }) {
  const roomExams = (page.visibleExams || []).filter(
    (exam) => exam.isActive || exam.isUpcoming,
  )

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          Phòng thi
        </h1>
        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
          {isStudent
            ? 'Chọn đề thi đang mở để bắt đầu làm bài trong phòng thi được giám sát.'
            : 'Xem trước phòng thi của các đề đang mở hoặc sắp diễn ra.'}
        </p>
      </div>

      {roomExams.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roomExams.map((exam) => (
            <article
              key={exam.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#5339f7]">
                    {exam.subject || 'Môn học'}
                  </p>
                  <h2 className="mt-2 truncate text-lg font-black text-slate-900 dark:text-white">
                    {exam.title || 'Đề thi chưa đặt tên'}
                  </h2>
                </div>
                <ExamStatusBadge exam={exam} />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-white/5">
                  <p className="text-xs font-bold text-slate-400">Số câu</p>
                  <p className="mt-1 font-black text-slate-700 dark:text-slate-100">
                    {exam.questionCount || exam.questions?.length || 0}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-white/5">
                  <p className="text-xs font-bold text-slate-400">Thời gian</p>
                  <p className="mt-1 font-black text-slate-700 dark:text-slate-100">
                    {exam.duration || 45} phút
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                Hạn nộp: {formatDate(exam.closeDate)}
              </p>

              <button
                type="button"
                onClick={() => page.previewExam?.(exam)}
                disabled={isStudent && !exam.isActive}
                className="mt-5 w-full rounded-xl bg-[#5339f7] px-4 py-3 text-sm font-black text-white transition hover:bg-[#4630df] disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
              >
                {isStudent
                  ? exam.isActive
                    ? 'Vào phòng thi'
                    : 'Chưa đến giờ thi'
                  : 'Xem trước phòng thi'}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center text-slate-400 dark:border-white/10 dark:bg-white/5">
          <DoorOpen className="h-12 w-12" />
          <p className="mt-4 text-sm font-bold">Chưa có phòng thi khả dụng</p>
          <p className="mt-1 text-xs font-medium">
            Phòng thi sẽ xuất hiện khi có đề đang mở hoặc sắp diễn ra.
          </p>
        </div>
      )}
    </section>
  )
}

function ActiveSection({ page, isStudent, activeSection }) {
  switch (activeSection) {
    case 'overview':
      return <OverviewSection page={page} isStudent={isStudent} />

    case 'exam-room':
      return <ExamRoomSection page={page} isStudent={isStudent} />

    case 'submissions':
      return (
        <MaintenanceState
          badge="Danh sách nộp bài"
          title="Đang bảo trì"
          subtitle="Tính năng đang được hoàn thiện"
          description="Danh sách bài nộp của học sinh sẽ sớm được cập nhật. Vui lòng quay lại sau."
        />
      )

    case 'grading':
      return (
        <MaintenanceState
          badge="Chấm tự luận"
          title="Đang bảo trì"
          subtitle="Tính năng đang được hoàn thiện"
          description="Khu vực chấm bài tự luận hiện chưa sẵn sàng. Vui lòng quay lại sau."
        />
      )

    case 'statistics':
      return (
        <MaintenanceState
          badge="Thống kê đề thi"
          title="Đang bảo trì"
          subtitle="Dữ liệu thống kê đang được cập nhật"
          description="Báo cáo và biểu đồ kết quả thi sẽ sớm được mở lại. Vui lòng quay lại sau."
        />
      )

    case 'repository':
    default:
      return <RepositorySection page={page} isStudent={isStudent} />
  }
}

function StudentView({ page, activeSection, onNavigate }) {
  return (
    <DashboardShell page={page} isStudent activeSection={activeSection} onNavigate={onNavigate}>
      <ActiveSection page={page} isStudent activeSection={activeSection} />
    </DashboardShell>
  )
}

function NoAccessView({ dark }) {
  return (
    <div className={dark ? 'dark' : ''}>
      <section className="flex min-h-screen items-center justify-center bg-[#f7f9fc] px-4 text-slate-950 transition dark:bg-slate-950">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200"><FileText className="h-8 w-8" /></div>
          <h1 className="mt-6 text-3xl font-black text-slate-950 dark:text-white">Không có quyền truy cập</h1>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-500 dark:text-slate-300">Tài khoản của bạn chưa được gán quyền STUDENT hoặc TEACHER phù hợp để truy cập trang đề thi.</p>
        </div>
      </section>
    </div>
  )
}

function TeacherView({ page, activeSection, onNavigate }) {
  return (
    <DashboardShell page={page} isStudent={false} activeSection={activeSection} onNavigate={onNavigate}>
      <ActiveSection page={page} isStudent={false} activeSection={activeSection} />

      <StudentResultsModal open={Boolean(page.resultsExam)} exam={page.resultsExam} onClose={page.closeResultsModal} />

      {page.deleteConfirmExam && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={page.closeDeleteConfirm}>
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-950" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">Xác nhận xóa</p>
                <h3 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">Xóa đề thi?</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">Bạn có chắc muốn xóa đề "{page.deleteConfirmExam.title || 'Chưa có tên'}" khỏi hệ thống?</p>
              </div>
              <button type="button" onClick={page.closeDeleteConfirm} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10" aria-label="Đóng"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={page.closeDeleteConfirm} className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15">Hủy</button>
              <button type="button" onClick={page.confirmDeleteExam} className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-500/20 transition hover:bg-red-700">Xóa đề thi</button>
            </div>
          </div>
        </div>
      )}

      <CreateExamModal open={page.createOpen} onClose={page.closeCreateModal} onSave={page.saveExam} editingExam={page.editingExam} teacherSubject={page.teacherSubject} teacherName={page.teacherName} availableClasses={page.classes} />
    </DashboardShell>
  )
}

function Exams() {
  const page = useExamsPage()
  const [activeSection, setActiveSection] = useState('overview')

  if (page.roleLoading) return <LoadingState dark={page.dark} />
  if (page.isStudent) {
    return <StudentView page={page} activeSection={activeSection} onNavigate={setActiveSection} />
  }
  if (!page.canManage) return <NoAccessView dark={page.dark} />
  return <TeacherView page={page} activeSection={activeSection} onNavigate={setActiveSection} />
}

export default Exams
import { Plus } from 'lucide-react'

import { ExamLayout } from '../../components/exam/layout/index.js'
import {
  DashboardHero,
  DashboardStatCard,
  PerformancePanel,
  RecentExamsPanel,
  TeacherOverviewPanel,
} from '../../components/exam/dashboard/index.js'
import useExamDashboard from '../../hooks/exam/useExamDashboard.js'

function LoadingDashboard({ dark }) {
  return (
    <div className={dark ? 'dark' : ''}>
      <section className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="h-64 animate-pulse rounded-[2rem] bg-slate-200 dark:bg-white/5" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => <div key={item} className="h-36 animate-pulse rounded-3xl bg-slate-200 dark:bg-white/5" />)}
          </div>
        </div>
      </section>
    </div>
  )
}

function StudentDashboard({ page }) {
  return (
    <ExamLayout role={page.role} title="Tổng quan" description="Theo dõi lịch thi, tiến độ và kết quả học tập của bạn.">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <DashboardHero
          eyebrow="Không gian thi trực tuyến"
          title="Sẵn sàng cho bài thi tiếp theo"
          description="Khám phá đề thi phù hợp, theo dõi các bài sắp diễn ra và xem nhanh hiệu suất học tập của bạn."
          primaryAction={{ label: 'Mở kho đề thi', onClick: page.goToLibrary }}
        />

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {page.studentStats.map((item) => <DashboardStatCard key={item.label} {...item} />)}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <RecentExamsPanel
            title="Bài thi sắp diễn ra"
            description="Các đề có thời gian mở trong tương lai."
            exams={page.upcomingExams}
            onOpenExam={page.openExam}
            emptyMessage="Hiện chưa có bài thi sắp diễn ra."
          />
          <PerformancePanel
            averageScore={page.studentAverageScore}
            completedCount={page.completedExams.length}
            rank={page.currentStudentRank?.rank}
            totalStudents={page.leaderboard.length}
          />
        </section>

        <div className="mt-6">
          <RecentExamsPanel
            title="Đề thi mới cập nhật"
            description="Danh sách đề gần nhất trong phạm vi bạn có thể truy cập."
            exams={page.recentExams}
            onOpenExam={page.openExam}
            emptyMessage="Chưa có đề thi nào trong hệ thống."
          />
        </div>
      </main>
    </ExamLayout>
  )
}

function ManagerDashboard({ page }) {
  const isAdmin = String(page.role || '').replace(/[\s_-]/g, '').toUpperCase() === 'ADMINDEV'

  return (
    <ExamLayout
      role={page.role}
      title="Tổng quan"
      description={isAdmin ? 'Theo dõi tình hình vận hành của toàn bộ hệ thống thi.' : 'Quản lý đề thi, học sinh tham gia và hoạt động gần đây.'}
      action={(
        <button
          type="button"
          onClick={page.goToCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Tạo đề thi</span>
        </button>
      )}
    >
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <DashboardHero
          eyebrow={isAdmin ? 'Trung tâm điều hành' : 'Bảng điều khiển giáo viên'}
          title={isAdmin ? 'Kiểm soát hoạt động thi toàn hệ thống' : 'Quản lý hoạt động đánh giá hiệu quả hơn'}
          description={isAdmin
            ? 'Theo dõi đề thi, lượt nộp bài và mức độ tham gia dựa trên dữ liệu thực tế trong hệ thống.'
            : 'Tạo đề, theo dõi trạng thái xuất bản và nắm nhanh tình hình học sinh tham gia.'}
          primaryAction={{ label: 'Quản lý đề thi', onClick: page.goToLibrary }}
          secondaryAction={{ label: 'Tạo đề mới', onClick: page.goToCreate }}
        />

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {page.managerStats.map((item) => <DashboardStatCard key={item.label} {...item} />)}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <RecentExamsPanel
            title="Đề thi gần đây"
            description="Các đề mới nhất trong phạm vi quản lý của bạn."
            exams={page.recentExams}
            onOpenExam={page.openExam}
            emptyMessage="Chưa có đề thi nào để hiển thị."
          />
          <TeacherOverviewPanel
            totalSubmissions={page.totalSubmissions}
            uniqueStudents={page.uniqueStudents}
            activeExams={page.activeExams}
          />
        </section>

      </main>
    </ExamLayout>
  )
}

export default function ExamDashboard() {
  const page = useExamDashboard()

  if (page.roleLoading) return <LoadingDashboard dark={page.dark} />
  if (page.isStudent) return <StudentDashboard page={page} />
  if (page.canManage) return <ManagerDashboard page={page} />

  return (
    <ExamLayout role={page.role} title="Tổng quan" description="Tài khoản chưa có quyền truy cập module thi.">
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-sm font-bold text-slate-500 dark:text-slate-400">
        Tài khoản của bạn chưa được gán quyền phù hợp.
      </div>
    </ExamLayout>
  )
}

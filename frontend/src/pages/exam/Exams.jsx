import { useState } from 'react'
import {
  Award,
  BookOpen,
  FileText,
  Plus,
  Search,
  Sparkles,
  Trophy,
  Trash2,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react'

import useExamsPage from '../../hooks/exam/useExamsPage.js'

import { ExamLayout } from '../../components/exam/layout/index.js'
import StatsModal from '../../components/exam/StatsModal.jsx'
import ExamCard from '../../components/exam/ExamCard.jsx'
import TeacherExamRow from '../../components/exam/TeacherExamRow.jsx'
import StudentResultsModal from '../../components/exam/StudentResultsModal.jsx'
import DarkModeSelect from '../../components/exam/DarkModeSelect.jsx'

function LoadingState({ dark }) {
  return (
    <div className={dark ? 'dark' : ''}>
      <section className="min-h-screen bg-slate-50 text-slate-950 transition dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="h-20 animate-pulse rounded-2xl bg-white shadow-sm dark:bg-white/5" />

          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-24 animate-pulse rounded-2xl bg-white shadow-sm dark:bg-white/5"
              />
            ))}
          </div>

          <div className="mt-7 h-20 animate-pulse rounded-2xl bg-white shadow-sm dark:bg-white/5" />
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value, Icon, iconClass }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-3 text-3xl font-black text-slate-950 dark:text-white">
            {value}
          </p>
        </div>

        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconClass}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  )
}


function LeaderboardCard({ leaderboard = [], currentStudentRank = null, compact = false }) {
  const topStudents = leaderboard.slice(0, compact ? 5 : 10)

  return (
    <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500" />
            <h2 className="text-xl font-black text-slate-950 dark:text-white">
              Bảng xếp hạng toàn hệ thống
            </h2>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Điểm cộng = điểm bài thi / 10 × 1.05. Ví dụ: 10đ được +1.05 điểm.
          </p>
        </div>

        {currentStudentRank ? (
          <div className="rounded-2xl bg-amber-100 px-4 py-3 text-sm font-black text-amber-700 dark:bg-amber-500/20 dark:text-amber-100">
            Hạng của bạn: #{currentStudentRank.rank} • {currentStudentRank.points.toFixed(2)} điểm
          </div>
        ) : null}
      </div>

      {topStudents.length ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
          <div className="grid grid-cols-[80px_1fr_120px_120px] gap-3 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:bg-white/5 dark:text-slate-300">
            <span>Hạng</span>
            <span>Học sinh</span>
            <span>Điểm cộng</span>
            <span>Bài đã làm</span>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-white/10">
            {topStudents.map((student) => (
              <div
                key={student.id}
                className="grid grid-cols-[80px_1fr_120px_120px] gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200"
              >
                <span className="inline-flex items-center gap-2 font-black text-amber-600 dark:text-amber-200">
                  <Award className="h-4 w-4" />
                  #{student.rank}
                </span>
                <span className="truncate text-slate-950 dark:text-white">
                  {student.name}
                </span>
                <span className="font-black text-blue-600 dark:text-blue-200">
                  {student.points.toFixed(2)}
                </span>
                <span>{student.completedExams}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500 dark:bg-white/5 dark:text-slate-300">
          Chưa có dữ liệu xếp hạng.
        </div>
      )}
    </div>
  )
}

function StudentView(page) {
  return (
    <div className={page.dark ? 'dark' : ''}>
      <ExamLayout role={page.role} title="Đề thi trực tuyến" description="Hệ thống làm bài thi cho học sinh">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {page.studentStatCards.map((item) => (
              <StatCard key={item.label} {...item} />
            ))}
          </div>

          <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px]">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <Search className="h-5 w-5 text-slate-400" />
                <input
                  value={page.search}
                  onChange={(event) => page.setSearch(event.target.value)}
                  placeholder="Tìm kiếm đề thi..."
                  className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 dark:text-white"
                />
              </div>

              <DarkModeSelect
                value={page.subjectFilter}
                onChange={page.setSubjectFilter}
                options={[
                  { value: 'all', label: 'Tất cả môn học' },
                  ...page.availableSubjects.map((subject) => ({
                    value: subject,
                    label: subject,
                  })),
                ]}
                buttonClassName="rounded-xl bg-white px-4 py-3 text-sm dark:bg-slate-900"
              />

              <div className="flex gap-2">
                <input
                  value={page.codeSearch}
                  onChange={(event) => page.setCodeSearch(event.target.value)}
                  placeholder="Mã bài thi"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={page.openByCode}
                  className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white"
                >
                  Vào
                </button>
              </div>
            </div>
          </div>

          <LeaderboardCard
            leaderboard={page.leaderboard}
            currentStudentRank={page.currentStudentRank}
            compact
          />

          {page.visibleExams.length ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {page.visibleExams.map((exam) => (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  role={page.role}
                  currentUserId={page.currentUserId}
                  studentClass={page.studentClass}
                  getStudentAttemptCount={page.getStudentAttemptCount}
                  getExamMaxAttempts={page.getExamMaxAttempts}
                  onOutOfAttempts={page.handleOutOfAttempts}
                />
              ))}
            </div>
          ) : (
            <div className="mt-16 flex flex-col items-center justify-center text-slate-400">
              <BookOpen className="h-16 w-16" />
              <p className="mt-4 text-sm font-semibold">Chưa có bài thi nào</p>

              {page.studentClasses.length > 0 && (
                <p className="mt-2 text-xs font-semibold text-slate-400">
                  Lớp hiện tại: {page.studentClasses.join(', ')}
                </p>
              )}
            </div>
          )}
        </main>
      </ExamLayout>
    </div>
  )
}

function NoAccessView({ dark }) {
  return (
    <div className={dark ? 'dark' : ''}>
      <ExamLayout role="student" title="Không có quyền truy cập" description="Tài khoản của bạn chưa đủ quyền để vào khu vực đề thi.">
        <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-10 text-slate-950 transition dark:text-white">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-200">
              <FileText className="h-8 w-8" />
            </div>

            <h1 className="mt-6 text-3xl font-black text-slate-950 dark:text-white">
              Không có quyền truy cập
            </h1>

            <p className="mt-3 text-sm font-medium leading-6 text-slate-500 dark:text-slate-300">
              Tài khoản của bạn chưa được gán quyền phù hợp để truy cập trang đề thi.
            </p>
          </div>
        </div>
      </ExamLayout>
    </div>
  )
}

function TeacherView(page) {
  const [section, setSection] = useState('active')
  const isAdmin = String(page.role || '').replace(/[\s_-]/g, '').toUpperCase() === 'ADMINDEV'

  const openTrash = async () => {
    setSection('trash')
    await page.loadTrashExams()
  }

  const totalExams = page.exams?.length || 0
  const activeExams = page.visibleExams?.length || 0

  return (
    <div className={page.dark ? 'dark' : ''}>
      <ExamLayout
        role={page.role}
        title="Quản lý đề thi"
        description="Theo dõi, quản lý và vận hành toàn bộ đề thi từ một bảng điều khiển hiện đại"
        action={(
          <button
            type="button"
            onClick={page.openCreateModal}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Tạo đề thi
          </button>
        )}
      >
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <header className="relative overflow-hidden rounded-4xl bg-linear-to-br from-blue-600 via-indigo-600 to-violet-700 p-6 text-white shadow-xl shadow-blue-500/20 sm:p-8">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-36 left-1/3 h-72 w-72 rounded-full bg-blue-300/20 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-blue-50 backdrop-blur">
                  <Sparkles className="h-4 w-4" />
                  Không gian quản trị đề thi
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                  Quản lý bộ đề thi với trải nghiệm mới, rõ ràng và hiện đại
                </h1>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-blue-50 sm:text-base">
                  Tạo đề, kiểm tra trạng thái, theo dõi quyền truy cập và quản lý toàn bộ quy trình đánh giá từ một bảng điều khiển trực quan.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={page.openCreateModal}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-blue-700 shadow-lg transition hover:-translate-y-0.5"
                  >
                    <Plus className="h-4 w-4" />
                    Tạo đề thi mới
                  </button>
                  <button
                    type="button"
                    onClick={() => setSection('active')}
                    className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                  >
                    Xem danh sách đề
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-50">Tổng đề</p>
                  <p className="mt-2 text-2xl font-black">{totalExams}</p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-50">Đang hiển thị</p>
                  <p className="mt-2 text-2xl font-black">{activeExams}</p>
                </div>
              </div>
            </div>
          </header>

          <div className="mt-6 rounded-[1.75rem] border border-slate-200/80 bg-white/80 p-3 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur dark:border-white/10 dark:bg-slate-950/75 dark:shadow-black/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSection('active')}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-black transition ${section === 'active' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'}`}
                >
                  Đề đang quản lý
                </button>
                <button
                  type="button"
                  onClick={openTrash}
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition ${section === 'trash' ? 'bg-red-600 text-white shadow-lg shadow-red-500/20' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'}`}
                >
                  <Trash2 className="h-4 w-4" />
                  Thùng rác
                </button>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                <ShieldCheck className="h-4 w-4" />
                {isAdmin ? 'Quản trị viên xem toàn hệ thống' : 'Chỉ hiển thị đề của bạn'}
              </div>
            </div>
          </div>

          {section === 'active' ? (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                {page.teacherStatCards.map((item) => (
                  <StatCard key={item.label} {...item} />
                ))}
              </div>

              <div className="mt-6 rounded-[1.75rem] border border-slate-200/80 bg-white/80 p-4 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur sm:p-5 dark:border-white/10 dark:bg-slate-950/75 dark:shadow-black/30">
                <div className="grid gap-3 lg:grid-cols-[1.3fr_170px_170px]">
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <Search className="h-5 w-5 text-slate-400" />
                    <input
                      value={page.search}
                      onChange={(event) => page.setSearch(event.target.value)}
                      placeholder="Tìm kiếm đề thi theo tên hoặc môn học..."
                      className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 dark:text-white"
                    />
                  </div>

                  <DarkModeSelect
                    value={page.privacyFilter}
                    onChange={page.setPrivacyFilter}
                    options={[
                      { value: 'all', label: 'Tất cả đề thi' },
                      { value: 'public', label: 'Công khai' },
                      { value: 'private', label: 'Riêng tư' },
                    ]}
                    buttonClassName="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:bg-slate-900 dark:text-white"
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
                    buttonClassName="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-slate-950 dark:text-white">Danh sách đề thi</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                      Theo dõi nhanh tình trạng, quyền xem và thời gian mở của từng đề.
                    </p>
                  </div>
                  <div className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-black text-blue-700 dark:bg-blue-500/10 dark:text-blue-200">
                    {activeExams} đề đang hiển thị
                  </div>
                </div>

                {page.visibleExams.length ? (
                  <div className="mt-6 space-y-4">
                    {page.visibleExams.map((exam) => (
                      <TeacherExamRow
                        key={exam.id}
                        exam={exam}
                        role={page.role}
                        getExamAudienceText={page.getExamAudienceText}
                        onCopy={page.copyExamLink}
                        onResults={page.setResultsExam}
                        onPreview={page.previewExam}
                        onEdit={page.openEditModal}
                        onDelete={page.setDeleteConfirmExam}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="mt-16 flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 py-16 text-slate-400 dark:border-white/10">
                    <BookOpen className="h-16 w-16" />
                    <p className="mt-4 text-sm font-semibold">Chưa có đề thi nào</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <section className="mt-6 rounded-[1.75rem] border border-slate-200/80 bg-white/80 p-5 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-slate-950/75 dark:shadow-black/30">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-950 dark:text-white">Thùng rác đề thi</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Đề bị xóa mềm có thể khôi phục. Chỉ quản trị viên được xóa vĩnh viễn.
                  </p>
                </div>
                <span className="rounded-full bg-red-50 px-4 py-2 text-sm font-black text-red-700 dark:bg-red-500/10 dark:text-red-200">
                  {page.trashExams.length} đề
                </span>
              </div>

              {page.trashLoading ? (
                <div className="mt-6 rounded-2xl bg-slate-50 p-8 text-center text-sm font-bold text-slate-500 dark:bg-white/5 dark:text-slate-300">Đang tải thùng rác...</div>
              ) : page.trashExams.length ? (
                <div className="mt-6 space-y-3">
                  {page.trashExams.map((exam) => (
                    <div key={exam.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-black text-slate-950 dark:text-white">{exam.title || 'Chưa có tên đề'}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{exam.code || 'Chưa có mã'} • {exam.subject || 'Chưa có môn'}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => page.restoreExam(exam.id)} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700">
                          <RotateCcw className="h-4 w-4" /> Khôi phục
                        </button>
                        {isAdmin ? (
                          <button type="button" onClick={() => page.permanentDeleteExam(exam.id)} className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-red-700">
                            <Trash2 className="h-4 w-4" /> Xóa vĩnh viễn
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-2xl bg-slate-50 p-10 text-center text-sm font-bold text-slate-500 dark:bg-white/5 dark:text-slate-300">Thùng rác đang trống.</div>
              )}
            </section>
          )}
        </main>
      </ExamLayout>

      <StudentResultsModal
        open={Boolean(page.resultsExam)}
        exam={page.resultsExam}
        onClose={page.closeResultsModal}
      />

      {page.deleteConfirmExam && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={page.closeDeleteConfirm}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-950"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
                  Xác nhận xóa
                </p>

                <h3 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                  Xóa đề thi?
                </h3>

                <p className="mt-3 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">
                  Bạn có chắc muốn xóa đề "{page.deleteConfirmExam.title || 'Chưa có tên'}" khỏi hệ thống?
                </p>
              </div>

              <button
                type="button"
                onClick={page.closeDeleteConfirm}
                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={page.closeDeleteConfirm}
                className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              >
                Hủy
              </button>

              <button
                type="button"
                onClick={page.confirmDeleteExam}
                className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-500/20 transition hover:bg-red-700"
              >
                Xóa đề thi
              </button>
            </div>
          </div>
        </div>
      )}

      <StatsModal
        open={page.statsOpen}
        onClose={() => page.setStatsOpen(false)}
        exams={page.exams}
      />
    </div>
  )
}

function Exams() {
  const page = useExamsPage()

  if (page.roleLoading) {
    return <LoadingState dark={page.dark} />
  }

  if (page.isStudent) {
    return <StudentView {...page} />
  }

  if (!page.canManage) {
    return <NoAccessView dark={page.dark} />
  }

  return <TeacherView {...page} />
}

export default Exams

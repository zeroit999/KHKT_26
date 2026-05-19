import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Clock3,
  FileText,
  Globe2,
  LockKeyhole,
  Plus,
  Search,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'

import useExams from '../../hooks/useExams'
import CreateExamModal from '../../components/exam/CreateExamModal.jsx'
import StatsModal from '../../components/exam/StatsModal.jsx'
import ExamCard from '../../components/exam/ExamCard.jsx'
import TeacherExamRow from '../../components/exam/TeacherExamRow.jsx'
import StudentResultsModal from '../../components/exam/StudentResultsModal.jsx'

import {
  canManageExams,
  isStudentRole,
  normalizeSubject,
  teacherSubjects,
} from '../../utils/examHelpers'

function Exams() {
  const navigate = useNavigate()

  const {
    dark,
    role,
    currentUserId,
    teacherSubject,
    teacherName,
    studentClass,
    studentClasses,
    classes,

    search,
    setSearch,
    subjectFilter,
    setSubjectFilter,
    codeSearch,
    setCodeSearch,
    privacyFilter,
    setPrivacyFilter,
    publishFilter,
    setPublishFilter,

    exams,
    visibleExams,
    roleLoading,

    createOpen,
    setCreateOpen,
    statsOpen,
    setStatsOpen,
    resultsExam,
    setResultsExam,
    editingExam,
    setEditingExam,
    deleteConfirmExam,
    setDeleteConfirmExam,

    saveExam,
    deleteExam,
  } = useExams()

  if (roleLoading) {
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

  const openByCode = () => {
    const exam = visibleExams.find(
      (item) => item.code?.toLowerCase() === codeSearch.trim().toLowerCase(),
    )

    if (!exam) {
      toast.error('Không tìm thấy mã bài thi')
      return
    }

    navigate(`/exam/${exam.id}`, { state: { role } })
  }

  const copyExamLink = async (exam) => {
    try {
      const examUrl = `${window.location.origin}/exam/${exam.id}`

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(examUrl)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = examUrl
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }

      toast.success('Đã sao chép link bài thi cho học sinh')
    } catch (error) {
      console.error(error)
      toast.error('Không thể sao chép link bài thi')
    }
  }

  const previewExam = (exam) => {
    navigate(`/exam/${exam.id}`, { state: { role, preview: true } })
  }

  const getStudentAttemptCount = (exam) => {
    if (!currentUserId) return 0

    const attempt = exam.attempts?.find(
      (item) => item.id === currentUserId || item.studentId === currentUserId,
    )

    if (attempt) return Number(attempt.count || 0)

    return (
      exam.studentResults?.filter((result) => result.studentId === currentUserId)
        .length ?? 0
    )
  }

  const getExamMaxAttempts = (exam) =>
    exam.attemptMode === 'multiple'
      ? Math.max(1, Number(exam.maxAttempts || 1))
      : 1

  const getExamAudienceText = (exam) =>
    exam.status === 'public'
      ? 'Công khai cho tất cả học sinh'
      : exam.selectedClasses?.length
        ? exam.selectedClasses.join(', ')
        : 'Chưa chọn lớp'

  const handleOutOfAttempts = () => {
    toast.error('Bạn đã hết số lượt làm bài thi này')
  }

  if (isStudentRole(role)) {
    const examSubjects = visibleExams
      .map((exam) => normalizeSubject(exam.subject))
      .filter(Boolean)

    const availableSubjects = Array.from(
      new Set([...teacherSubjects, ...examSubjects]),
    )

    const completedExams = visibleExams.filter((exam) =>
      exam.studentResults?.some((result) => result.studentId === currentUserId),
    )

    const pendingExams = Math.max(0, visibleExams.length - completedExams.length)

    const studentScores = visibleExams
      .flatMap((exam) => exam.studentResults ?? [])
      .filter((result) => result.studentId === currentUserId)
      .map((result) => Number(result.score || 0))

    const studentAverageScore = studentScores.length
      ? (
          studentScores.reduce((total, score) => total + score, 0) /
          studentScores.length
        ).toFixed(1)
      : '0.0'

    return (
      <div className={dark ? 'dark' : ''}>
        <section className="min-h-screen bg-slate-50 text-slate-950 transition dark:bg-slate-950">
          <header className="border-b border-slate-200 bg-white/95 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-500/25">
                  <BookOpen className="h-7 w-7" />
                </div>

                <div>
                  <h1 className="text-2xl font-black text-slate-950 dark:text-white md:text-3xl">
                    Đề thi trực tuyến
                  </h1>
                  <p className="text-sm font-medium text-slate-500">
                    Hệ thống làm bài thi cho học sinh
                  </p>
                </div>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Đề thi khả dụng', visibleExams.length, FileText, 'bg-blue-100 text-blue-600'],
                ['Đã hoàn thành', completedExams.length, Globe2, 'bg-emerald-100 text-emerald-600'],
                ['Chưa làm', pendingExams, Clock3, 'bg-orange-100 text-orange-600'],
                ['Điểm trung bình', studentAverageScore, FileText, 'bg-violet-100 text-violet-600'],
              ].map(([label, value, Icon, iconClass]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        {label}
                      </p>
                      <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
                        {value}
                      </p>
                    </div>

                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconClass}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
              <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px]">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <Search className="h-5 w-5 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm kiếm đề thi..."
                    className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 dark:text-white"
                  />
                </div>

                <select
                  value={subjectFilter}
                  onChange={(event) => setSubjectFilter(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
                >
                  <option value="all">Tất cả môn học</option>
                  {availableSubjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <input
                    value={codeSearch}
                    onChange={(event) => setCodeSearch(event.target.value)}
                    placeholder="Mã bài thi"
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={openByCode}
                    className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white"
                  >
                    Vào
                  </button>
                </div>
              </div>
            </div>

            {visibleExams.length ? (
              <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {visibleExams.map((exam) => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    role={role}
                    currentUserId={currentUserId}
                    studentClass={studentClass}
                    getStudentAttemptCount={getStudentAttemptCount}
                    getExamMaxAttempts={getExamMaxAttempts}
                    onOutOfAttempts={handleOutOfAttempts}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-16 flex flex-col items-center justify-center text-slate-400">
                <BookOpen className="h-16 w-16" />
                <p className="mt-4 text-sm font-semibold">Chưa có bài thi nào</p>

                {studentClasses.length > 0 && (
                  <p className="mt-2 text-xs font-semibold text-slate-400">
                    Lớp hiện tại: {studentClasses.join(', ')}
                  </p>
                )}
              </div>
            )}
          </main>
        </section>
      </div>
    )
  }

  if (!canManageExams(role)) {
    return (
      <div className={dark ? 'dark' : ''}>
        <section className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-950 transition dark:bg-slate-950">
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
        </section>
      </div>
    )
  }

  const totalExams = visibleExams.length
  const publicExams = visibleExams.filter((exam) => exam.status === 'public').length
  const privateExams = visibleExams.filter((exam) => exam.status !== 'public').length
  const publishedExams = visibleExams.filter((exam) => exam.availabilityStatus === 'published').length
  const draftExams = visibleExams.filter((exam) => exam.availabilityStatus === 'draft').length
  const endedExams = visibleExams.filter((exam) => exam.availabilityStatus === 'ended').length

  return (
    <div className={dark ? 'dark' : ''}>
      <section className="min-h-screen bg-slate-50 text-slate-950 transition dark:bg-slate-950">
        <header className="border-b border-slate-200 bg-white/95 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/25">
                <FileText className="h-7 w-7" />
              </div>

              <div>
                <h1 className="text-2xl font-black text-slate-950 dark:text-white md:text-3xl">
                  Quản lý đề thi
                </h1>
                <p className="text-sm font-medium text-slate-500">
                  Hệ thống quản lý đề thi cho giáo viên
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setStatsOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              >
                Thống kê
              </button>

              <button
                onClick={() => {
                  setEditingExam(null)
                  setCreateOpen(true)
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Tạo đề thi
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {[
              ['Tổng đề thi', totalExams, FileText, 'bg-blue-100 text-blue-600'],
              ['Công khai', publicExams, Globe2, 'bg-emerald-100 text-emerald-600'],
              ['Riêng tư', privateExams, LockKeyhole, 'bg-violet-100 text-violet-600'],
              ['Hoạt động', publishedExams, FileText, 'bg-green-100 text-green-600'],
              ['Chưa mở', draftExams, FileText, 'bg-amber-100 text-amber-600'],
              ['Đã kết thúc', endedExams, FileText, 'bg-red-100 text-red-600'],
            ].map(([label, value, Icon, iconClass]) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      {label}
                    </p>
                    <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
                      {value}
                    </p>
                  </div>

                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconClass}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="grid gap-3 lg:grid-cols-[1fr_170px_170px]">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <Search className="h-5 w-5 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm kiếm đề thi theo tên hoặc môn học..."
                  className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 dark:text-white"
                />
              </div>

              <select
                value={privacyFilter}
                onChange={(event) => setPrivacyFilter(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
              >
                <option value="all">Tất cả đề thi</option>
                <option value="public">Công khai</option>
                <option value="private">Riêng tư</option>
              </select>

              <select
                value={publishFilter}
                onChange={(event) => setPublishFilter(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="published">Hoạt động</option>
                <option value="draft">Chưa mở</option>
                <option value="ended">Đã kết thúc</option>
              </select>
            </div>
          </div>

          {visibleExams.length ? (
            <div className="mt-5 space-y-4">
              {visibleExams.map((exam) => (
                <TeacherExamRow
                  key={exam.id}
                  exam={exam}
                  role={role}
                  getExamAudienceText={getExamAudienceText}
                  onCopy={copyExamLink}
                  onResults={setResultsExam}
                  onPreview={previewExam}
                  onEdit={(selectedExam) => {
                    setEditingExam(selectedExam)
                    setCreateOpen(true)
                  }}
                  onDelete={setDeleteConfirmExam}
                />
              ))}
            </div>
          ) : (
            <div className="mt-16 flex flex-col items-center justify-center text-slate-400">
              <BookOpen className="h-16 w-16" />
              <p className="mt-4 text-sm font-semibold">Chưa có đề thi nào</p>
            </div>
          )}
        </main>

        <StudentResultsModal
          open={Boolean(resultsExam)}
          exam={resultsExam}
          onClose={() => setResultsExam(null)}
        />

        {deleteConfirmExam && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
            onMouseDown={() => setDeleteConfirmExam(null)}
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
                    Bạn có chắc muốn xóa đề "
                    {deleteConfirmExam.title || 'Chưa có tên'}" khỏi hệ thống?
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setDeleteConfirmExam(null)}
                  className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                  aria-label="Đóng"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmExam(null)}
                  className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                >
                  Hủy
                </button>

                <button
                  type="button"
                  onClick={() => deleteExam(deleteConfirmExam.id)}
                  className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-500/20 transition hover:bg-red-700"
                >
                  Xóa đề thi
                </button>
              </div>
            </div>
          </div>
        )}

        <CreateExamModal
          open={createOpen}
          onClose={() => {
            setCreateOpen(false)
            setEditingExam(null)
          }}
          onSave={saveExam}
          editingExam={editingExam}
          teacherSubject={teacherSubject}
          teacherName={teacherName}
          availableClasses={classes}
        />

        <StatsModal
          open={statsOpen}
          onClose={() => setStatsOpen(false)}
          exams={exams}
        />
      </section>
    </div>
  )
}

export default Exams
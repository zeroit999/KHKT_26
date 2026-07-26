import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Filter,
  FileText,
  NotebookTabs,
  PenLine,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { ExamLayout } from '../../components/exam/layout/index.js'
import DarkModeSelect from '../../components/exam/DarkModeSelect.jsx'
import StudentAnswers from '../../components/exam/StudentAnswers.jsx'
import useExamsPage from '../../hooks/exam/useExamsPage.js'
import {
  formatDateTimeText,
  getStudentDisplayName,
  normalizeSubject,
  removeVietnameseTones,
} from '../../utils/examHelpers'
import {
  getExamDetailApi,
  getExamResultsApi,
  gradeExamResultApi,
} from '../../api/examApi'

const reviewQuestionTypes = new Set(['essay', 'code', 'short-answer'])

const normalizeText = (value = '') =>
  removeVietnameseTones(String(value || ''))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const renderRichContent = (content = '') => {
  const html = String(content || '')
    .replace(
      /<img\s+/g,
      '<img class="my-4 max-h-96 max-w-full rounded-2xl border border-slate-200 object-contain shadow-sm dark:border-white/10" ',
    )
    .replace(/\n/g, '<br />')

  return (
    <div
      className="max-w-none text-sm font-semibold leading-6 text-slate-900 dark:text-white"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function StatCard({ label, value, icon: Icon, className }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-black text-slate-950 dark:text-white">{value}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${className}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  )
}

function SubmissionRow({ result, active, onSelect, examQuestions }) {
  const finalScore = Number(result.manualScore ?? result.score ?? 0)
  const hasReviewQuestions = examQuestions.some((question) => reviewQuestionTypes.has(question.type))
  const status = result.gradedAt
    ? 'Đã chấm'
    : hasReviewQuestions
      ? 'Cần chấm'
      : 'Tự động'

  const statusClass = result.gradedAt
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100'
    : hasReviewQuestions
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100'
      : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200'

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${active ? 'border-blue-300 bg-blue-50 shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10' : 'border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5'}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-black text-slate-950 dark:text-white">
            {getStudentDisplayName(result)}
          </h3>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {result.studentEmail || 'Chưa có email'}
          </p>
        </div>

        <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass}`}>
          {status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Điểm</p>
          <p className="mt-1 text-2xl font-black text-blue-600 dark:text-blue-200">{finalScore.toFixed(1)}</p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Nộp lúc</p>
          <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">
            {result.createdAt ? formatDateTimeText(result.createdAt) : 'Chưa có'}
          </p>
        </div>
      </div>
    </button>
  )
}

export default function StudentSubmissions({ mode = 'submissions' }) {
  const page = useExamsPage()
  const location = useLocation()

  const [selectedExamId, setSelectedExamId] = useState('')
  const [selectedResultId, setSelectedResultId] = useState('')
  const [examDetail, setExamDetail] = useState(null)
  const [results, setResults] = useState([])
  const [loadingResults, setLoadingResults] = useState(false)
  const [savingGrade, setSavingGrade] = useState(false)
  const [search, setSearch] = useState('')
  const [resultFilter, setResultFilter] = useState('all')
  const [scoreDraft, setScoreDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')

  const isGradingMode = mode === 'grading' || location.pathname.endsWith('/essay-grading')
  const isSubmissionsMode = !isGradingMode
  const pageTitle = isGradingMode ? 'Chấm tự luận' : 'Bài làm của học sinh'
  const pageDescription = isGradingMode
    ? 'Xem các bài thi có phần tự luận và lưu điểm chấm tay, nhận xét cho từng bài nộp.'
    : 'Tra cứu toàn bộ bài nộp theo đề thi, mở bài làm chi tiết và chấm lại khi cần.'

  const accessibleExams = page.visibleExams ?? []

  useEffect(() => {
    if (!selectedExamId && accessibleExams.length) {
      setSelectedExamId(accessibleExams[0].id)
    }
  }, [accessibleExams, selectedExamId])

  useEffect(() => {
    const incomingExamId = location.state?.examId

    if (incomingExamId && accessibleExams.some((exam) => exam.id === incomingExamId)) {
      setSelectedExamId(incomingExamId)
    }
  }, [accessibleExams, location.state?.examId])

  useEffect(() => {
    setResultFilter(isGradingMode ? 'pending' : 'all')
  }, [isGradingMode])

  const selectedExam = useMemo(
    () => accessibleExams.find((exam) => exam.id === selectedExamId) ?? null,
    [accessibleExams, selectedExamId],
  )

  useEffect(() => {
    if (!selectedExamId) {
      setExamDetail(null)
      setResults([])
      setSelectedResultId('')
      return undefined
    }

    let cancelled = false

    const loadSubmissionData = async () => {
      try {
        setLoadingResults(true)

        const [detailResponse, resultsResponse] = await Promise.all([
          getExamDetailApi(selectedExamId),
          getExamResultsApi(selectedExamId),
        ])

        if (cancelled) return

        setExamDetail(detailResponse.data?.exam ?? null)
        const nextResults = resultsResponse.data?.results ?? []

        setResults(nextResults)
        setSelectedResultId((current) => current || nextResults[0]?.id || '')
      } catch (error) {
        if (cancelled) return

        console.error(error)
        toast.error(
          error?.response?.data?.message ||
            error.message ||
            'Không thể tải bài làm học sinh',
        )

        setExamDetail(selectedExam)
        setResults([])
        setSelectedResultId('')
      } finally {
        if (!cancelled) setLoadingResults(false)
      }
    }

    loadSubmissionData()

    return () => {
      cancelled = true
    }
  }, [selectedExamId, selectedExam])

  const questions = examDetail?.questions ?? []

  const filteredResults = useMemo(() => {
    const keyword = normalizeText(search)

    return results.filter((result) => {
      const resultType = result.gradedAt ? 'reviewed' : 'pending'
      const hasManualQuestions = questions.some((question) => reviewQuestionTypes.has(question.type))
      const needsReview = hasManualQuestions && !result.gradedAt

      if (resultFilter === 'reviewed' && !result.gradedAt) return false
      if (resultFilter === 'pending' && !needsReview) return false
      if (!keyword) return true

      return normalizeText(
        [
          getStudentDisplayName(result),
          result.studentEmail,
          result.studentId,
          result.teacherNote,
          result.score,
          result.manualScore,
          resultType,
        ].join(' '),
      ).includes(keyword)
    })
  }, [results, resultFilter, search, questions])

  useEffect(() => {
    if (!filteredResults.length) {
      setSelectedResultId('')
      return
    }

    if (!filteredResults.some((result) => result.id === selectedResultId)) {
      setSelectedResultId(filteredResults[0].id)
    }
  }, [filteredResults, selectedResultId])

  const selectedResult = useMemo(
    () => filteredResults.find((result) => result.id === selectedResultId) ?? null,
    [filteredResults, selectedResultId],
  )

  useEffect(() => {
    if (!selectedResult) {
      setScoreDraft('')
      setNoteDraft('')
      return
    }

    setScoreDraft(String(selectedResult.manualScore ?? selectedResult.score ?? ''))
    setNoteDraft(String(selectedResult.teacherNote ?? ''))
  }, [selectedResult])

  const reviewQuestions = useMemo(
    () => questions.filter((question) => reviewQuestionTypes.has(question.type)),
    [questions],
  )

  const hasReviewQuestions = reviewQuestions.length > 0

  const stats = useMemo(() => {
    const total = results.length
    const reviewed = results.filter((result) => result.gradedAt).length
    const pending = results.filter((result) => !result.gradedAt).length
    const average = total
      ? (results.reduce((sum, result) => sum + Number(result.manualScore ?? result.score ?? 0), 0) / total).toFixed(1)
      : '0.0'

    return { total, reviewed, pending, average }
  }, [results, reviewQuestions.length])

  const finalScore = Number(selectedResult?.manualScore ?? selectedResult?.score ?? 0)

  const handleSaveGrade = async () => {
    if (!selectedExamId || !selectedResult?.id) return

    try {
      setSavingGrade(true)

      const response = await gradeExamResultApi(selectedExamId, selectedResult.id, {
        score: scoreDraft,
        teacherNote: noteDraft,
      })

      const updatedResult = response.data?.result

      if (updatedResult) {
        setResults((current) =>
          current.map((item) => (item.id === updatedResult.id ? updatedResult : item)),
        )
        setSelectedResultId(updatedResult.id)
        toast.success('Đã lưu chấm bài')
      }
    } catch (error) {
      console.error(error)
      toast.error(
        error?.response?.data?.message ||
          error.message ||
          'Không thể lưu chấm bài',
      )
    } finally {
      setSavingGrade(false)
    }
  }

  if (page.roleLoading || page.loading) {
    return (
      <div className={page.dark ? 'dark' : ''}>
        <ExamLayout role={page.role || 'TEACHER'} title={pageTitle} description="Đang tải dữ liệu...">
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="space-y-5">
              <div className="h-44 animate-pulse rounded-4xl bg-slate-200 dark:bg-white/5" />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="h-24 animate-pulse rounded-3xl bg-slate-200 dark:bg-white/5" />
                ))}
              </div>
              <div className="h-115 animate-pulse rounded-4xl bg-slate-200 dark:bg-white/5" />
            </div>
          </main>
        </ExamLayout>
      </div>
    )
  }

  if (!page.canManage) {
    return (
      <div className={page.dark ? 'dark' : ''}>
        <ExamLayout role={page.role} title={pageTitle} description="Khu vực này chỉ dành cho giáo viên và quản trị viên.">
          <div className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-3xl items-center justify-center px-4 py-12 text-center">
            <div className="w-full rounded-4xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-white/5">
              <ShieldCheck className="mx-auto h-12 w-12 text-amber-500" />
              <h2 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">
                Không có quyền truy cập
              </h2>
              <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                Tài khoản của bạn chưa được cấp quyền xem và chấm bài làm của học sinh.
              </p>
            </div>
          </div>
        </ExamLayout>
      </div>
    )
  }

  return (
    <div className={page.dark ? 'dark' : ''}>
      <ExamLayout
        role={page.role}
        title={pageTitle}
        description={pageDescription}
        action={(
          <Link
            to={isGradingMode ? '/exams/submissions' : '/exams/essay-grading'}
            state={{ examId: selectedExamId || undefined }}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
          >
            {isGradingMode ? 'Xem bài làm' : 'Chấm tự luận'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      >
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <section className="relative overflow-hidden rounded-4xl bg-linear-to-br from-blue-600 via-indigo-600 to-violet-700 p-6 text-white shadow-xl shadow-blue-500/20 sm:p-8">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-blue-50 backdrop-blur">
                  <Sparkles className="h-4 w-4" />
                  {isGradingMode ? 'Chế độ chấm tự luận' : 'Theo dõi bài làm'}
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                  {isGradingMode
                    ? 'Xem bài nộp và chấm tay theo từng đề thi'
                    : 'Tra cứu, xem và đánh giá bài làm của học sinh'}
                </h1>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-blue-50 sm:text-base">
                  {isGradingMode
                    ? 'Màn này ưu tiên các đề có câu tự luận hoặc câu trả lời ngắn để giáo viên lưu điểm chấm tay và ghi chú.'
                    : 'Từ đây giáo viên và quản trị có thể mở từng bài nộp, xem chi tiết và cập nhật nhận xét khi cần.'}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:min-w-96">
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-50">Tổng bài nộp</p>
                  <p className="mt-2 text-3xl font-black">{stats.total}</p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-50">Cần chấm</p>
                  <p className="mt-2 text-3xl font-black">{stats.pending}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Đã chấm"
              value={stats.reviewed}
              icon={CheckCircle2}
              className="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-100"
            />
            <StatCard
              label="Điểm trung bình"
              value={stats.average}
              icon={FileText}
              className="bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-100"
            />
            <StatCard
              label="Đề đang chọn"
              value={accessibleExams.length ? accessibleExams.length : 0}
              icon={NotebookTabs}
              className="bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-100"
            />
            <StatCard
              label="Bài cần xem lại"
              value={hasReviewQuestions ? reviewQuestions.length : 0}
              icon={PenLine}
              className="bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-100"
            />
          </section>

          <section className="mt-6 rounded-[1.75rem] border border-slate-200/80 bg-white/80 p-4 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur dark:border-white/10 dark:bg-slate-950/75 dark:shadow-black/30 sm:p-5">
            <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_180px]">
              <DarkModeSelect
                value={selectedExamId}
                onChange={setSelectedExamId}
                options={accessibleExams.map((exam) => ({
                  value: exam.id,
                  label: `${exam.title || 'Chưa có tên'} • ${normalizeSubject(exam.subject)}`,
                }))}
                buttonClassName="min-h-12 rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900"
                placeholder="Chọn đề thi"
              />

              <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 dark:border-white/10 dark:bg-white/5">
                <Search className="h-5 w-5 shrink-0 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm học sinh, email, ghi chú..."
                  className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 dark:text-white"
                />
              </label>

              <DarkModeSelect
                value={resultFilter}
                onChange={setResultFilter}
                options={[
                  { value: 'all', label: 'Tất cả bài nộp' },
                  { value: 'pending', label: 'Cần chấm' },
                  { value: 'reviewed', label: 'Đã chấm' },
                ]}
                buttonClassName="min-h-12 rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900"
                placeholder="Lọc"
              />
            </div>
          </section>

          <section className="mt-6 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            <Filter className="h-4 w-4" />
            {filteredResults.length} / {results.length} bài nộp đang hiển thị
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="space-y-4">
              <div className="rounded-4xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-slate-950 dark:text-white">
                      {isGradingMode ? 'Bài nộp cần chấm' : 'Danh sách bài nộp'}
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                      {selectedExam
                        ? `${selectedExam.title || 'Đề thi'} • ${normalizeSubject(selectedExam.subject)}`
                        : 'Chưa chọn đề thi'}
                    </p>
                  </div>
                  <div className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-black text-blue-700 dark:bg-blue-500/10 dark:text-blue-200">
                    {loadingResults ? 'Đang tải...' : `${filteredResults.length} bài`}
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {filteredResults.length ? (
                    filteredResults.map((result) => (
                      <SubmissionRow
                        key={result.id}
                        result={result}
                        active={result.id === selectedResultId}
                        onSelect={() => setSelectedResultId(result.id)}
                        examQuestions={questions}
                      />
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm font-bold text-slate-500 dark:border-white/10 dark:text-slate-300">
                      Chưa có bài nộp phù hợp với bộ lọc hiện tại.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-4xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
              {selectedResult ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
                        Chi tiết bài làm
                      </p>
                      <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                        {getStudentDisplayName(selectedResult)}
                      </h2>
                      <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                        {selectedResult.studentEmail || 'Chưa có email'}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right dark:bg-white/5">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Điểm hiện tại</p>
                      <p className="mt-1 text-3xl font-black text-blue-600 dark:text-blue-200">
                        {finalScore.toFixed(1)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Nộp lúc</p>
                      <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">
                        {selectedResult.createdAt ? formatDateTimeText(selectedResult.createdAt) : 'Chưa có'}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Đã trả lời</p>
                      <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">
                        {selectedResult.answeredCount ?? 0}/{selectedResult.totalQuestions ?? questions.length}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Vi phạm</p>
                      <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">
                        {Number(selectedResult.fullscreenViolations || 0)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Trạng thái</p>
                      <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">
                        {selectedResult.gradedAt ? 'Đã chấm' : reviewQuestions.length ? 'Cần chấm' : 'Tự động'}
                      </p>
                    </div>
                  </div>

                  <StudentAnswers exam={examDetail ?? selectedExam ?? { questions }} result={selectedResult} />

                  {isGradingMode && hasReviewQuestions ? (
                    <div className="space-y-3 rounded-3xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                      <div>
                        <h3 className="text-xl font-black text-amber-700 dark:text-amber-100">
                          Câu cần chấm tay
                        </h3>
                        <p className="mt-1 text-sm font-semibold text-amber-700/80 dark:text-amber-100/80">
                          Tập trung vào câu tự luận, lập trình và trả lời ngắn nếu cần ghi chú riêng.
                        </p>
                      </div>

                      <div className="space-y-3">
                        {reviewQuestions.map((question, index) => (
                          <div key={question.id ?? index} className="rounded-2xl border border-amber-200 bg-white p-4 dark:border-amber-500/20 dark:bg-slate-950/40">
                            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                              {renderRichContent(question.question)}
                            </div>
                            <div className="mt-3 rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                Bài làm của học sinh
                              </p>
                              <p className="mt-2 text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">
                                {String(selectedResult.textAnswers?.[question.id] || '').trim() || 'Chưa trả lời'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : isSubmissionsMode ? (
                    <div className="rounded-3xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-xl font-black text-blue-700 dark:text-blue-100">
                            Bài làm chỉ ở chế độ xem
                          </h3>
                          <p className="mt-1 text-sm font-semibold text-blue-700/80 dark:text-blue-100/80">
                            Chuyển sang màn chấm tự luận để ghi điểm và nhận xét cho các câu cần chấm tay.
                          </p>
                        </div>

                        <Link
                          to="/exams/essay-grading"
                          state={{ examId: selectedExamId || undefined }}
                          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
                        >
                          Mở màn chấm
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  ) : null}

                  {isGradingMode ? (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                      <div className="flex items-center gap-2">
                        <PenLine className="h-5 w-5 text-blue-600 dark:text-blue-200" />
                        <h3 className="text-lg font-black text-slate-950 dark:text-white">
                          Chấm bài và ghi chú
                        </h3>
                      </div>

                      <div className="mt-4 grid gap-4">
                        <label className="grid gap-2">
                          <span className="text-sm font-black text-slate-700 dark:text-slate-200">Điểm cuối cùng</span>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={scoreDraft}
                            onChange={(event) => setScoreDraft(event.target.value)}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                            placeholder="Nhập điểm"
                          />
                        </label>

                        <label className="grid gap-2">
                          <span className="text-sm font-black text-slate-700 dark:text-slate-200">Nhận xét</span>
                          <textarea
                            rows={5}
                            value={noteDraft}
                            onChange={(event) => setNoteDraft(event.target.value)}
                            placeholder="Ghi nhận xét cho học sinh..."
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                          />
                        </label>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                            {selectedResult.gradedAt ? 'Bài này đã được chấm tay trước đó.' : 'Lưu điểm và nhận xét sẽ cập nhật trực tiếp vào kết quả.'}
                          </p>

                          <button
                            type="button"
                            onClick={handleSaveGrade}
                            disabled={savingGrade}
                            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingGrade ? 'Đang lưu...' : 'Lưu chấm bài'}
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex min-h-130 flex-col items-center justify-center rounded-4xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center dark:border-white/10 dark:bg-white/5">
                  <UsersRound className="h-14 w-14 text-slate-400" />
                  <h2 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">
                    Chưa chọn bài làm
                  </h2>
                  <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
                    Hãy chọn một đề thi và một bài nộp bên trái để xem chi tiết và chấm bài.
                  </p>
                </div>
              )}
            </section>
          </div>
        </main>
      </ExamLayout>
    </div>
  )
}
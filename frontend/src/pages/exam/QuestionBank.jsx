import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpenCheck,
  FileQuestion,
  Filter,
  Layers3,
  NotebookTabs,
  Search,
  Sparkles,
  SquareCheckBig,
  SquareDashedBottomCode,
  SquareDashedMousePointer,
} from 'lucide-react'

import { ExamLayout } from '../../components/exam/layout/index.js'
import DarkModeSelect from '../../components/exam/DarkModeSelect.jsx'
import useExamsPage from '../../hooks/exam/useExamsPage.js'
import { normalizeSubject, removeVietnameseTones } from '../../utils/examHelpers.js'

const questionTypeMeta = {
  multiple: { label: 'Trắc nghiệm', icon: SquareCheckBig, className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-100' },
  truefalse: { label: 'Đúng/Sai', icon: SquareDashedMousePointer, className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100' },
  'short-answer': { label: 'Trả lời ngắn', icon: FileQuestion, className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100' },
  essay: { label: 'Tự luận', icon: SquareDashedBottomCode, className: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-100' },
  code: { label: 'Lập trình', icon: SquareDashedBottomCode, className: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-100' },
}

const sectionLabels = {
  part1: 'Phần 1',
  part2: 'Phần 2',
  part3: 'Phần 3',
  part4: 'Phần 4',
}

const stripHtml = (value = '') => String(value || '').replace(/<[^>]*>/g, ' ')

const normalizeSearchText = (value = '') => removeVietnameseTones(String(value || '')).toLowerCase().replace(/\s+/g, ' ').trim()

const renderRichContent = (content = '') => {
  const html = String(content || '')
    .replace(/<img\s+/g, '<img class="my-4 max-h-96 max-w-full rounded-2xl border border-slate-200 object-contain shadow-sm dark:border-white/10" ')
    .replace(/\n/g, '<br />')

  return <div className="max-w-none text-base font-semibold leading-7 text-slate-900 dark:text-white" dangerouslySetInnerHTML={{ __html: html }} />
}

function BankStatCard({ label, value, icon: Icon, className }) {
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

function QuestionCard({ item, onPreviewSource }) {
  const typeMeta = questionTypeMeta[item.type] || questionTypeMeta.multiple
  const TypeIcon = typeMeta.icon
  const hasAnswers = Array.isArray(item.answers) && item.answers.length > 0

  return (
    <article className="overflow-hidden rounded-4xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-white/10">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] ${typeMeta.className}`}>
              <TypeIcon className="h-3.5 w-3.5" />
              {typeMeta.label}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-slate-600 dark:bg-white/10 dark:text-slate-300">
              {sectionLabels[item.section] || 'Phần khác'}
            </span>
          </div>

          <h3 className="mt-3 truncate text-lg font-black text-slate-950 dark:text-white">
            {item.examTitle || 'Đề thi'}
          </h3>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {item.subject} • {item.examCode || 'Chưa có mã'} • Câu {item.order + 1}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onPreviewSource(item.exam)}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
        >
          Xem đề nguồn
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-5 px-6 py-6">
        <div className="rounded-3xl bg-slate-50 p-5 dark:bg-white/5">
          {renderRichContent(item.question)}
        </div>

        {item.type === 'multiple' && hasAnswers ? (
          <div className="grid gap-3">
            {item.answers.slice(0, 4).map((answer, index) => {
              const selected = Boolean(answer.isCorrect)

              return (
                <div
                  key={answer.id ?? index}
                  className={`flex items-start gap-4 rounded-2xl border px-4 py-3 ${selected ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/40'}`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${selected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white'}`}>
                    {String.fromCharCode(65 + index)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{answer.content || 'Chưa có nội dung'}</p>
                    {selected ? <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-200">Đáp án đúng</p> : null}
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}

        {item.type === 'truefalse' && hasAnswers ? (
          <div className="grid gap-3">
            {item.answers.slice(0, 4).map((answer, index) => (
              <div
                key={answer.id ?? index}
                className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-slate-950/40"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    <span className="mr-2 font-black">{String.fromCharCode(97 + index)})</span>
                    {answer.content || 'Chưa có nội dung'}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${answer.isCorrect ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-100'}`}>
                  {answer.isCorrect ? 'Đúng' : 'Sai'}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {(item.type === 'short-answer' || item.type === 'essay' || item.type === 'code') ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Đáp án mẫu</p>
              <p className="mt-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                {item.correctAnswer || 'Chưa thiết lập'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Ghi chú</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                {item.explanation || (item.type === 'essay' ? 'Câu tự luận lấy từ đề gốc.' : 'Chưa có ghi chú bổ sung.')}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  )
}

export default function QuestionBank() {
  const page = useExamsPage()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')

  const questionItems = useMemo(() => {
    const exams = page.visibleExams ?? []

    return exams.flatMap((exam) =>
      (exam.questions ?? []).map((question, order) => ({
        id: `${exam.id}:${question.id || order}`,
        exam,
        examId: exam.id,
        examTitle: exam.title || 'Chưa có tên đề',
        examCode: exam.code || '',
        subject: normalizeSubject(exam.subject),
        order,
        type: question.type || 'multiple',
        section: question.section || 'part1',
        question: question.question || '',
        answers: question.answers ?? [],
        correctAnswer: question.correctAnswer || '',
        explanation: question.explanation || '',
        searchBlob: normalizeSearchText(
          [
            exam.title,
            exam.code,
            exam.subject,
            question.question,
            question.correctAnswer,
            question.explanation,
            ...(question.answers ?? []).map((answer) => answer.content),
          ].join(' '),
        ),
      })),
    )
  }, [page.visibleExams])

  const sourceExams = useMemo(() => {
    const map = new Map()
    questionItems.forEach((item) => {
      if (!map.has(item.examId)) map.set(item.examId, item.exam)
    })
    return Array.from(map.values())
  }, [questionItems])

  const availableSubjects = useMemo(() => {
    return Array.from(new Set(questionItems.map((item) => item.subject).filter(Boolean)))
  }, [questionItems])

  const filteredQuestions = useMemo(() => {
    const keyword = normalizeSearchText(search)

    return questionItems.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false
      if (subjectFilter !== 'all' && item.subject !== subjectFilter) return false
      if (sourceFilter !== 'all' && item.examId !== sourceFilter) return false
      if (!keyword) return true

      return item.searchBlob.includes(keyword)
    })
  }, [questionItems, search, typeFilter, subjectFilter, sourceFilter])

  const stats = useMemo(() => {
    const multiple = questionItems.filter((item) => item.type === 'multiple').length
    const truefalse = questionItems.filter((item) => item.type === 'truefalse').length
    const shortAnswer = questionItems.filter((item) => item.type === 'short-answer').length
    const essay = questionItems.filter((item) => item.type === 'essay' || item.type === 'code').length

    return {
      total: questionItems.length,
      exams: sourceExams.length,
      multiple,
      truefalse,
      shortAnswer,
      essay,
    }
  }, [questionItems, sourceExams.length])

  if (page.roleLoading || page.loading) {
    return (
      <div className={page.dark ? 'dark' : ''}>
        <ExamLayout role={page.role || 'TEACHER'} title="Ngân hàng câu hỏi" description="Đang tải dữ liệu câu hỏi...">
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="space-y-5">
              <div className="h-44 animate-pulse rounded-4xl bg-slate-200 dark:bg-white/5" />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="h-24 animate-pulse rounded-3xl bg-slate-200 dark:bg-white/5" />
                ))}
              </div>
              <div className="h-20 animate-pulse rounded-3xl bg-slate-200 dark:bg-white/5" />
            </div>
          </main>
        </ExamLayout>
      </div>
    )
  }

  return (
    <div className={page.dark ? 'dark' : ''}>
      <ExamLayout
        role={page.role}
        title="Ngân hàng câu hỏi"
        description="Tổng hợp và tra cứu toàn bộ câu hỏi từ những đề thi bạn được phép truy cập."
        action={(
          <Link
            to="/exams/create"
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
          >
            <Sparkles className="h-4 w-4" />
            Tạo đề thi
          </Link>
        )}
      >
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <section className="relative overflow-hidden rounded-4xl bg-linear-to-br from-blue-600 via-indigo-600 to-violet-700 p-6 text-white shadow-xl shadow-blue-500/20 sm:p-8">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-blue-50 backdrop-blur">
                  <NotebookTabs className="h-4 w-4" />
                  Ngân hàng câu hỏi
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                  Tìm, lọc và rà soát câu hỏi theo từng đề thi
                </h1>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-blue-50 sm:text-base">
                  Màn này gom toàn bộ câu hỏi từ các đề bạn được phép xem, giúp tra cứu nhanh nội dung, đáp án mẫu và đề nguồn.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:min-w-90">
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-50">Tổng câu hỏi</p>
                  <p className="mt-2 text-3xl font-black">{stats.total}</p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-50">Đề nguồn</p>
                  <p className="mt-2 text-3xl font-black">{stats.exams}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <BankStatCard label="Trắc nghiệm" value={stats.multiple} icon={SquareCheckBig} className="bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-100" />
            <BankStatCard label="Đúng/Sai" value={stats.truefalse} icon={SquareDashedMousePointer} className="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-100" />
            <BankStatCard label="Trả lời ngắn" value={stats.shortAnswer} icon={FileQuestion} className="bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-100" />
            <BankStatCard label="Tự luận / Code" value={stats.essay} icon={SquareDashedBottomCode} className="bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-100" />
          </section>

          <section className="mt-6 rounded-[1.75rem] border border-slate-200/80 bg-white/80 p-4 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur dark:border-white/10 dark:bg-slate-950/75 dark:shadow-black/30 sm:p-5">
            <div className="grid gap-3 lg:grid-cols-[1.3fr_180px_200px_220px]">
              <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 dark:border-white/10 dark:bg-white/5">
                <Search className="h-5 w-5 shrink-0 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm theo câu hỏi, đáp án, đề nguồn..."
                  className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 dark:text-white"
                />
              </label>

              <DarkModeSelect
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { value: 'all', label: 'Tất cả loại câu hỏi' },
                  { value: 'multiple', label: 'Trắc nghiệm' },
                  { value: 'truefalse', label: 'Đúng/Sai' },
                  { value: 'short-answer', label: 'Trả lời ngắn' },
                  { value: 'essay', label: 'Tự luận' },
                  { value: 'code', label: 'Lập trình' },
                ]}
                buttonClassName="min-h-12 rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900"
              />

              <DarkModeSelect
                value={subjectFilter}
                onChange={setSubjectFilter}
                options={[
                  { value: 'all', label: 'Tất cả môn học' },
                  ...availableSubjects.map((subject) => ({ value: subject, label: subject })),
                ]}
                buttonClassName="min-h-12 rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900"
              />

              <DarkModeSelect
                value={sourceFilter}
                onChange={setSourceFilter}
                options={[
                  { value: 'all', label: 'Tất cả đề nguồn' },
                  ...sourceExams.map((exam) => ({ value: exam.id, label: exam.title || exam.code || 'Đề thi' })),
                ]}
                buttonClassName="min-h-12 rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900"
              />
            </div>
          </section>

          <section className="mt-6 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            <Filter className="h-4 w-4" />
            {filteredQuestions.length} / {questionItems.length} câu hỏi đang hiển thị
          </section>

          {filteredQuestions.length ? (
            <div className="mt-6 grid gap-5 xl:grid-cols-2">
              {filteredQuestions.map((item) => (
                <QuestionCard key={item.id} item={item} onPreviewSource={page.previewExam} />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
              <Layers3 className="mx-auto h-14 w-14 text-slate-400" />
              <h2 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">
                Không tìm thấy câu hỏi phù hợp
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
                Hãy thử đổi từ khóa, loại câu hỏi, môn học hoặc đề nguồn.
              </p>
            </div>
          )}
        </main>
      </ExamLayout>
    </div>
  )
}
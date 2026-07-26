import { ArrowLeft, FileUp, ListChecks, Save, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import CreateExamModal from '../../components/exam/CreateExamModal.jsx'
import { ExamLayout } from '../../components/exam/layout/index.js'
import useExams from '../../hooks/exam/useExams.js'
import { canManageExams } from '../../utils/examHelpers.js'

const builderSteps = [
  {
    title: 'Thông tin và phạm vi',
    description: 'Đặt tên, môn học, mã đề, khối hoặc lớp được phép truy cập.',
    Icon: ShieldCheck,
  },
  {
    title: 'Thời gian và quy định',
    description: 'Thiết lập lịch mở, lịch đóng, số lượt làm và giới hạn vi phạm.',
    Icon: Save,
  },
  {
    title: 'Câu hỏi và chấm điểm',
    description: 'Soạn trực tiếp hoặc nhập file Word, sau đó cấu hình điểm từng phần.',
    Icon: ListChecks,
  },
]

function LoadingBuilder() {
  return (
    <section className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="h-24 animate-pulse rounded-3xl bg-slate-200 dark:bg-white/5" />
        <div className="h-[620px] animate-pulse rounded-3xl bg-slate-200 dark:bg-white/5" />
      </div>
    </section>
  )
}

export default function ExamBuilder() {
  const navigate = useNavigate()
  const page = useExams()

  const closeBuilder = () => navigate('/exams/library')

  const handleSave = async (exam) => {
    const saved = await page.saveExam(exam)
    if (saved) navigate('/exams/library')
  }

  if (page.roleLoading) return <LoadingBuilder />

  if (!canManageExams(page.role)) {
    return (
      <ExamLayout
        role={page.role}
        title="Tạo đề thi"
        description="Khu vực dành cho giáo viên và quản trị viên."
      >
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-white/5">
            <ShieldCheck className="mx-auto h-12 w-12 text-amber-500" />
            <h2 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">
              Bạn không có quyền tạo đề thi
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
              Chỉ giáo viên và quản trị viên được phép truy cập khu vực này.
            </p>
          </div>
        </div>
      </ExamLayout>
    )
  }

  return (
    <ExamLayout
      role={page.role}
      title="Tạo đề thi"
      description="Thiết lập đầy đủ nội dung, phạm vi, thời gian và cách chấm điểm."
      action={(
        <button
          type="button"
          onClick={closeBuilder}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Quay lại kho đề</span>
        </button>
      )}
    >
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <CreateExamModal
          open
          presentation="page"
          onClose={closeBuilder}
          onSave={handleSave}
          editingExam={null}
          teacherSubject={page.teacherSubject}
          teacherName={page.teacherName}
          availableClasses={page.classes}
        />
      </main>
    </ExamLayout>
  )
}

import { useEffect, useState } from 'react'
import { FileText, Plus, Trash2, Upload, X } from 'lucide-react'

import RichEditor from './RichEditor.jsx'
import DarkModeSelect from './DarkModeSelect.jsx'

import {
  addMinutesToDateTime,
  createDefaultAnswers,
  createDefaultQuestion,
  getCodeNumberFromExam,
  normalizeSubject,
} from '../../utils/examHelpers'

const questionTypes = [
  { value: 'multiple', label: 'Trắc nghiệm' },
  { value: 'essay', label: 'Tự luận' },
  { value: 'code', label: 'Code' },
]

function CreateExamModal({
  open,
  onClose,
  onSave,
  editingExam,
  teacherSubject = 'Toán',
  teacherName = 'GiaoVien',
  availableClasses = [],
}) {
  const fixedTeacherSubject = normalizeSubject(teacherSubject)

  const [form, setForm] = useState({
    title: '',
    subject: fixedTeacherSubject,
    codeNumber: '0001',
    topic: '',
    status: 'public',
    selectedClasses: [],
    attemptMode: 'once',
    maxAttempts: 1,
    duration: 45,
    openDate: '',
    closeDate: '',
    shuffleQuestions: false,
    shuffleAnswers: false,
    totalScore: '',
    scorePerQuestion: '',
    wordFileName: '',
    maxFullscreenViolations: 2,
    questions: [createDefaultQuestion()],
  })

  const questionCount = form.questions?.length || 0

  useEffect(() => {
    if (!open) return

    if (editingExam) {
      setForm({
        id: editingExam.id,
        title: editingExam.title ?? '',
        subject: fixedTeacherSubject,
        codeNumber: getCodeNumberFromExam(editingExam, '0001'),
        topic: editingExam.topic ?? '',
        status: editingExam.status ?? 'public',
        selectedClasses: editingExam.selectedClasses ?? [],
        attemptMode: editingExam.attemptMode ?? 'once',
        maxAttempts: Number(editingExam.maxAttempts || 1),
        duration: Number(editingExam.duration || 45),
        openDate: editingExam.openDate ?? '',
        closeDate:
          editingExam.closeDate ??
          addMinutesToDateTime(editingExam.openDate, editingExam.duration || 45),
        shuffleQuestions: Boolean(editingExam.shuffleQuestions),
        shuffleAnswers: Boolean(editingExam.shuffleAnswers),
        totalScore: editingExam.totalScore ?? '',
        scorePerQuestion: editingExam.scorePerQuestion ?? '',
        wordFileName: editingExam.wordFileName ?? '',
        maxFullscreenViolations: Number(editingExam.maxFullscreenViolations ?? 2),
        questions:
          editingExam.questions?.length > 0
            ? editingExam.questions
            : [createDefaultQuestion()],
      })
    } else {
      setForm({
        title: '',
        subject: fixedTeacherSubject,
        codeNumber: String(Date.now()).slice(-4),
        topic: '',
        status: 'public',
        selectedClasses: [],
        attemptMode: 'once',
        maxAttempts: 1,
        duration: 45,
        openDate: '',
        closeDate: '',
        shuffleQuestions: false,
        shuffleAnswers: false,
        totalScore: '',
        scorePerQuestion: '',
        wordFileName: '',
        maxFullscreenViolations: 2,
        questions: [createDefaultQuestion()],
      })
    }
  }, [open, editingExam, fixedTeacherSubject])

  if (!open) return null

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const updateQuestion = (questionIndex, key, value) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question, index) =>
        index === questionIndex ? { ...question, [key]: value } : question,
      ),
    }))
  }

  const updateAnswer = (questionIndex, answerIndex, key, value) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question, index) => {
        if (index !== questionIndex) return question
        return {
          ...question,
          answers: question.answers.map((answer, currentAnswerIndex) =>
            currentAnswerIndex === answerIndex
              ? { ...answer, [key]: value }
              : answer,
          ),
        }
      }),
    }))
  }

  const setCorrectAnswer = (questionIndex, answerIndex) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question, index) => {
        if (index !== questionIndex) return question
        return {
          ...question,
          answers: question.answers.map((answer, currentAnswerIndex) => ({
            ...answer,
            isCorrect: currentAnswerIndex === answerIndex,
          })),
        }
      }),
    }))
  }

  const addQuestion = () => {
    setForm((prev) => ({
      ...prev,
      questions: [...prev.questions, createDefaultQuestion()],
    }))
  }

  const removeQuestion = (questionIndex) => {
    setForm((prev) => ({
      ...prev,
      questions:
        prev.questions.length > 1
          ? prev.questions.filter((_, index) => index !== questionIndex)
          : prev.questions,
    }))
  }

  const addAnswer = (questionIndex) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question, index) =>
        index === questionIndex
          ? {
              ...question,
              answers: [
                ...question.answers,
                {
                  id: Date.now().toString(),
                  content: '',
                  isCorrect: false,
                  trueFalse: '',
                },
              ],
            }
          : question,
      ),
    }))
  }

  const removeAnswer = (questionIndex, answerIndex) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question, index) => {
        if (index !== questionIndex) return question
        return {
          ...question,
          answers:
            question.answers.length > 2
              ? question.answers.filter((_, currentAnswerIndex) => currentAnswerIndex !== answerIndex)
              : question.answers,
        }
      }),
    }))
  }

  const toggleClass = (className) => {
    setForm((prev) => {
      const selected = prev.selectedClasses ?? []
      return {
        ...prev,
        selectedClasses: selected.includes(className)
          ? selected.filter((item) => item !== className)
          : [...selected, className],
      }
    })
  }

  const handleWordFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    updateForm('wordFileName', file.name)
  }

  const handleSubmit = () => {
    if (!form.title.trim()) {
      alert('Vui lòng nhập tên bài thi')
      return
    }

    if (!form.questions.length) {
      alert('Vui lòng thêm ít nhất 1 câu hỏi')
      return
    }

    if (Number(form.totalScore || 0) <= 0) {
      alert('Vui lòng nhập tổng điểm lớn hơn 0')
      return
    }

    if (Number(form.scorePerQuestion || 0) <= 0) {
      alert('Vui lòng nhập điểm mỗi câu lớn hơn 0')
      return
    }

    onSave({
      ...form,
      subject: fixedTeacherSubject,
      maxAttempts: Number(form.maxAttempts || 1),
      duration: Number(form.duration || 45),
      totalScore: Number(form.totalScore || 0),
      scorePerQuestion: Number(form.scorePerQuestion || 0),
      maxFullscreenViolations: Number(form.maxFullscreenViolations ?? 2),
    })
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-950"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
              {editingExam ? 'Cập nhật bài thi' : 'Tạo bài thi'}
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
              {editingExam ? 'Sửa bài thi' : 'Tạo bài thi mới'}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">
              Giáo viên: {teacherName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
              Tên bài thi
            </label>
            <input
              value={form.title}
              onChange={(event) => updateForm('title', event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              placeholder="Nhập tên bài thi..."
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
              Môn thi theo chuyên môn giáo viên
            </label>
            <input
              value={fixedTeacherSubject}
              disabled
              className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 outline-none dark:border-white/10 dark:bg-white/10 dark:text-white"
            />
            <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Môn thi được khóa theo chuyên môn đã thiết lập ban đầu.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
              Mã số bài thi
            </label>
            <input
              value={form.codeNumber}
              onChange={(event) => updateForm('codeNumber', event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              placeholder="0001"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
              Chủ đề
            </label>
            <input
              value={form.topic}
              onChange={(event) => updateForm('topic', event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              placeholder="Nhập chủ đề..."
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
              Tổng điểm
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.totalScore}
              onChange={(event) => updateForm('totalScore', event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              placeholder="Ví dụ: 10"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
              Điểm mỗi câu
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.scorePerQuestion}
              onChange={(event) => updateForm('scorePerQuestion', event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              placeholder="Ví dụ: 0.25"
            />
            <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Giáo viên tự nhập điểm mỗi câu.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
              File Word đề thi
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
              <span className="inline-flex min-w-0 items-center gap-2">
                <Upload className="h-5 w-5 shrink-0" />
                <span className="truncate">
                  {form.wordFileName || 'Chọn file .doc / .docx'}
                </span>
              </span>
              <input
                type="file"
                accept=".doc,.docx"
                onChange={handleWordFileChange}
                className="hidden"
              />
            </label>
            {form.wordFileName && (
              <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <FileText className="h-4 w-4" />
                {form.wordFileName}
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
              Thời lượng phút
            </label>
            <input
              type="number"
              min={1}
              value={form.duration}
              onChange={(event) => {
                const duration = Number(event.target.value || 45)
                updateForm('duration', duration)
                if (form.openDate) {
                  updateForm('closeDate', addMinutesToDateTime(form.openDate, duration))
                }
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
              Số lần được thoát toàn màn hình
            </label>
            <input
              type="number"
              min={0}
              value={form.maxFullscreenViolations ?? 2}
              onChange={(event) => updateForm('maxFullscreenViolations', Number(event.target.value || 0))}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
              Thời gian mở
            </label>
            <input
              type="datetime-local"
              value={form.openDate}
              onChange={(event) => {
                updateForm('openDate', event.target.value)
                updateForm('closeDate', addMinutesToDateTime(event.target.value, form.duration))
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
              Thời gian đóng
            </label>
            <input
              type="datetime-local"
              value={form.closeDate}
              onChange={(event) => updateForm('closeDate', event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
              Chế độ công khai
            </label>
            <DarkModeSelect
              value={form.status}
              onChange={(value) => updateForm('status', value)}
              options={[
                { value: 'public', label: 'Công khai' },
                { value: 'private', label: 'Riêng tư theo lớp' },
              ]}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
              Số lượt làm
            </label>
            <DarkModeSelect
              value={form.attemptMode}
              onChange={(value) => {
                updateForm('attemptMode', value)
                if (value === 'once') updateForm('maxAttempts', 1)
              }}
              options={[
                { value: 'once', label: 'Chỉ 1 lần' },
                { value: 'multiple', label: 'Nhiều lần' },
              ]}
            />
            {form.attemptMode === 'multiple' && (
              <input
                type="number"
                min={1}
                value={form.maxAttempts}
                onChange={(event) => updateForm('maxAttempts', Number(event.target.value || 1))}
                className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            )}
          </div>
        </div>

        {form.status === 'private' && (
          <div className="mt-5 rounded-2xl border border-slate-200 p-4 dark:border-white/10">
            <p className="mb-3 text-sm font-black text-slate-700 dark:text-slate-200">
              Chọn lớp được làm bài
            </p>
            {availableClasses.length ? (
              <div className="flex flex-wrap gap-2">
                {availableClasses.map((className) => (
                  <button
                    key={className}
                    type="button"
                    onClick={() => toggleClass(className)}
                    className={`rounded-xl px-4 py-2 text-sm font-black transition ${
                      form.selectedClasses.includes(className)
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white'
                    }`}
                  >
                    {className}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Chưa có lớp học nào.
              </p>
            )}
          </div>
        )}

        <div className="mt-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">
                Câu hỏi
              </h3>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                {questionCount} câu • {form.totalScore || 0} điểm • {form.scorePerQuestion || 0} điểm/câu
              </p>
            </div>
            <button
              type="button"
              onClick={addQuestion}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Thêm câu hỏi
            </button>
          </div>

          {form.questions.map((question, questionIndex) => (
            <div
              key={question.id ?? questionIndex}
              className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-blue-600">
                    Câu {questionIndex + 1}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {form.scorePerQuestion || 0} điểm
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeQuestion(questionIndex)}
                  className="rounded-xl bg-red-100 p-2 text-red-600 transition hover:bg-red-200 dark:bg-red-500/20 dark:text-red-200"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-4">
                <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
                  Loại câu hỏi
                </label>
                <DarkModeSelect
                  value={question.type ?? 'multiple'}
                  onChange={(value) => updateQuestion(questionIndex, 'type', value)}
                  options={questionTypes}
                />
              </div>

              <RichEditor
                label="Nội dung câu hỏi"
                value={question.question}
                onChange={(value) => updateQuestion(questionIndex, 'question', value)}
              />

              {(question.type === 'essay' || question.type === 'code') && (
                <div className="mt-4">
                  <RichEditor
                    label="Gợi ý/chấm điểm"
                    value={question.explanation ?? ''}
                    onChange={(value) => updateQuestion(questionIndex, 'explanation', value)}
                  />
                </div>
              )}

              {question.type === 'multiple' && (
                <div className="mt-4 space-y-3">
                  {(question.answers ?? createDefaultAnswers()).map((answer, answerIndex) => (
                    <div
                      key={answer.id ?? answerIndex}
                      className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900 lg:grid-cols-[auto_1fr_auto_auto]"
                    >
                      <button
                        type="button"
                        onClick={() => setCorrectAnswer(questionIndex, answerIndex)}
                        className={`h-10 w-10 rounded-xl text-sm font-black ${
                          answer.isCorrect
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white'
                        }`}
                      >
                        {String.fromCharCode(65 + answerIndex)}
                      </button>

                      <input
                        value={answer.content ?? ''}
                        onChange={(event) =>
                          updateAnswer(questionIndex, answerIndex, 'content', event.target.value)
                        }
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                        placeholder={`Đáp án ${String.fromCharCode(65 + answerIndex)}`}
                      />

                      <span className="flex items-center text-xs font-black text-slate-500">
                        {answer.isCorrect ? 'Đáp án đúng' : 'Đáp án sai'}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeAnswer(questionIndex, answerIndex)}
                        className="rounded-xl bg-red-100 px-3 py-2 text-xs font-black text-red-600 transition hover:bg-red-200 dark:bg-red-500/20 dark:text-red-200"
                      >
                        Xóa
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => addAnswer(questionIndex)}
                    className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                  >
                    + Thêm đáp án
                  </button>

                  <RichEditor
                    label="Giải thích đáp án"
                    value={question.explanation ?? ''}
                    onChange={(value) => updateQuestion(questionIndex, 'explanation', value)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 dark:border-white/10 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
          >
            {editingExam ? 'Cập nhật bài thi' : 'Tạo bài thi'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateExamModal

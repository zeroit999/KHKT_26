import { auth, db } from '../../components/firebase'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  Edit3,
  Image,
  Moon,
  Plus,
  Search,
  Sun,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'

const subjectCodes = {
  Toán: 'TO',
  Văn: 'NV',
  Anh: 'TA',
  Lý: 'VL',
  Hóa: 'HH',
  Sinh: 'SH',
  Tin: 'TH',
  Sử: 'LS',
  Địa: 'DL',
  'Công nghệ': 'CN',
  GDQP: 'QP',
  'TN-HN': 'HN',
  GDDP: 'DP',
  GDTC: 'TD',
  'GDKT-PL': 'KT',
}

const classes = Array.from({ length: 10 }, (_, index) => `Lớp ${index + 1}`)

const createId = () => Date.now().toString() + Math.random().toString(36).slice(2)

const createDefaultAnswers = () => [
  { id: createId(), content: '', isCorrect: false, trueFalse: '' },
  { id: createId(), content: '', isCorrect: false, trueFalse: '' },
  { id: createId(), content: '', isCorrect: false, trueFalse: '' },
  { id: createId(), content: '', isCorrect: false, trueFalse: '' },
]

const createDefaultQuestion = () => ({
  id: createId(),
  type: 'multiple',
  question: '',
  code: '',
  explanation: '',
  answers: createDefaultAnswers(),
})

function RichEditor({ label, value, onChange }) {
  const [toolbar, setToolbar] = useState({
    bold: false,
    italic: false,
    underline: false,
    size: '16',
  })

  const insertImage = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    onChange(`${value}\n[Ảnh: ${file.name}]`)
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-slate-800 dark:text-white">{label}</label>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setToolbar((prev) => ({ ...prev, bold: !prev.bold }))}
            className={`rounded-lg px-3 py-1.5 text-sm font-black ${
              toolbar.bold ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white'
            }`}
          >
            B
          </button>

          <button
            type="button"
            onClick={() => setToolbar((prev) => ({ ...prev, italic: !prev.italic }))}
            className={`rounded-lg px-3 py-1.5 text-sm font-black italic ${
              toolbar.italic ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white'
            }`}
          >
            I
          </button>

          <button
            type="button"
            onClick={() => setToolbar((prev) => ({ ...prev, underline: !prev.underline }))}
            className={`rounded-lg px-3 py-1.5 text-sm font-black underline ${
              toolbar.underline ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white'
            }`}
          >
            U
          </button>

          <select
            value={toolbar.size}
            onChange={(event) => setToolbar((prev) => ({ ...prev, size: event.target.value }))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold outline-none dark:border-white/10 dark:bg-white/10 dark:text-white"
          >
            <option value="14">14</option>
            <option value="16">16</option>
            <option value="18">18</option>
            <option value="20">20</option>
            <option value="24">24</option>
          </select>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700 dark:bg-white/10 dark:text-white">
            <Image className="h-4 w-4" />
            Ảnh
            <input type="file" accept="image/*" onChange={insertImage} className="hidden" />
          </label>
        </div>

        <textarea
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          style={{
            fontWeight: toolbar.bold ? 700 : 400,
            fontStyle: toolbar.italic ? 'italic' : 'normal',
            textDecoration: toolbar.underline ? 'underline' : 'none',
            fontSize: `${toolbar.size}px`,
          }}
          className="w-full resize-none rounded-xl border border-slate-100 bg-slate-50 p-3 text-slate-900 outline-none focus:border-violet-400 dark:border-white/10 dark:bg-slate-950 dark:text-white"
          placeholder={`Nhập ${label.toLowerCase()}...`}
        />
      </div>
    </div>
  )
}

function CreateExamModal({ open, onClose, onSave, editingExam }) {
  const [form, setForm] = useState(
    editingExam ?? {
      title: '',
      subject: 'Toán',
      codeNumber: '0001',
      topic: '',
      status: 'public',
      selectedClasses: [],
      attemptMode: 'once',
      maxAttempts: 1,
      openDate: '',
      closeDate: '',
      duration: 45,
      shuffleQuestions: false,
      shuffleAnswers: false,
      questions: [createDefaultQuestion()],
    },
  )

  const [classPanelOpen, setClassPanelOpen] = useState(false)

  useEffect(() => {
    if (editingExam) {
      setForm({
        ...editingExam,
        codeNumber: editingExam.code?.slice(2) ?? '0001',
        questions: editingExam.questions?.length ? editingExam.questions : [createDefaultQuestion()],
      })
    } else {
      setForm({
        title: '',
        subject: 'Toán',
        codeNumber: '0001',
        topic: '',
        status: 'public',
        selectedClasses: [],
        attemptMode: 'once',
        maxAttempts: 1,
        openDate: '',
        closeDate: '',
        duration: 45,
        shuffleQuestions: false,
        shuffleAnswers: false,
        questions: [createDefaultQuestion()],
      })
    }
  }, [editingExam, open])

  if (!open) return null

  const updateQuestion = (questionId, patch) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question) =>
        question.id === questionId ? { ...question, ...patch } : question,
      ),
    }))
  }

  const updateAnswer = (questionId, answerId, patch) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              answers: question.answers.map((answer) =>
                answer.id === answerId ? { ...answer, ...patch } : answer,
              ),
            }
          : question,
      ),
    }))
  }

  const addAnswer = (questionId) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              answers: [
                ...question.answers,
                { id: createId(), content: '', isCorrect: false, trueFalse: '' },
              ],
            }
          : question,
      ),
    }))
  }

  const removeAnswer = (questionId, answerId) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question) =>
        question.id === questionId && question.answers.length > 2
          ? { ...question, answers: question.answers.filter((answer) => answer.id !== answerId) }
          : question,
      ),
    }))
  }

  const validate = () => {
    if (!form.title.trim()) return 'Vui lòng nhập tên bài kiểm tra.'
    if (!form.topic.trim()) return 'Vui lòng nhập chủ đề.'
    if (!/^\d{4}$/.test(form.codeNumber)) return 'Mã số phải gồm đúng 4 chữ số.'
    if (!form.selectedClasses.length) return 'Vui lòng chọn ít nhất một lớp.'

    for (const question of form.questions) {
      if (question.type !== 'post' && !question.question.trim()) return 'Mỗi câu hỏi phải có nội dung.'
      if (!question.explanation.trim()) return 'Mỗi câu hỏi phải có lời giải thích.'

      if (question.type === 'multiple') {
        const filledAnswers = question.answers.filter((answer) => answer.content.trim())
        if (filledAnswers.length < 2) return 'Câu nhiều lựa chọn phải có tối thiểu 2 đáp án.'
      }

      if (question.type === 'truefalse') {
        if (question.answers.length !== 4) return 'Câu đúng/sai phải có đúng 4 đáp án.'
        if (question.answers.some((answer) => !answer.trueFalse)) {
          return 'Mỗi đáp án đúng/sai phải chọn Đúng hoặc Sai.'
        }
      }

      if (question.type === 'code' && !question.code.trim()) {
        return 'Câu code phải có nội dung terminal code.'
      }
    }

    return ''
  }

  const submit = () => {
    const error = validate()
    if (error) {
      toast.error(error)
      return
    }

    onSave({
      ...form,
      code: `${subjectCodes[form.subject]}${form.codeNumber}`,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-950">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950 dark:text-white">
              {editingExam ? 'Cập nhật bài tập' : 'Tạo bài tập'}
            </h2>
            <p className="text-sm text-slate-500">Dữ liệu sẽ được lưu vào Firebase.</p>
          </div>

          <button onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-white/10">
            <X className="h-5 w-5 dark:text-white" />
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Tên bài kiểm tra"
            className="rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold outline-none dark:border-white/10 dark:bg-white/10 dark:text-white"
          />

          <input
            value={form.topic}
            onChange={(event) => setForm((prev) => ({ ...prev, topic: event.target.value }))}
            placeholder="Chủ đề"
            className="rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold outline-none dark:border-white/10 dark:bg-white/10 dark:text-white"
          />

          <select
            value={form.subject}
            onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold outline-none dark:border-white/10 dark:bg-white/10 dark:text-white"
          >
            {Object.keys(subjectCodes).map((subject) => (
              <option key={subject}>{subject}</option>
            ))}
          </select>

          <input
            value={form.codeNumber}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                codeNumber: event.target.value.replace(/\D/g, '').slice(0, 4),
              }))
            }
            placeholder="4 số mã, ví dụ 0001"
            className="rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold outline-none dark:border-white/10 dark:bg-white/10 dark:text-white"
          />

          <select
            value={form.status}
            onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold outline-none dark:border-white/10 dark:bg-white/10 dark:text-white"
          >
            <option value="public">Công khai</option>
            <option value="private">Riêng tư</option>
          </select>

          <div className="relative">
            <button
              type="button"
              onClick={() => setClassPanelOpen((value) => !value)}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-white"
            >
              {form.selectedClasses.length ? form.selectedClasses.join(', ') : 'Chọn lớp'}
              <ChevronDown className="h-4 w-4" />
            </button>

            {classPanelOpen && (
              <div className="absolute left-0 top-14 z-10 w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-slate-900">
                <div className="mb-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, selectedClasses: classes }))}
                    className="flex-1 rounded-xl bg-violet-600 px-3 py-2 text-sm font-bold text-white"
                  >
                    Chọn hết
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, selectedClasses: [] }))}
                    className="flex-1 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 dark:bg-white/10 dark:text-white"
                  >
                    Xóa hết
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {classes.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          selectedClasses: prev.selectedClasses.includes(item)
                            ? prev.selectedClasses.filter((value) => value !== item)
                            : [...prev.selectedClasses, item],
                        }))
                      }
                      className={`rounded-xl px-3 py-2 text-sm font-bold ${
                        form.selectedClasses.includes(item)
                          ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200'
                          : 'bg-slate-50 text-slate-600 dark:bg-white/10 dark:text-white'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <select
            value={form.attemptMode}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                attemptMode: event.target.value,
                maxAttempts: event.target.value === 'once' ? 1 : prev.maxAttempts,
              }))
            }
            className="rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold outline-none dark:border-white/10 dark:bg-white/10 dark:text-white"
          >
            <option value="once">Làm 1 lần</option>
            <option value="multiple">Được làm nhiều lần</option>
          </select>

          {form.attemptMode === 'multiple' && (
            <input
              type="number"
              min="2"
              value={form.maxAttempts}
              onChange={(event) => setForm((prev) => ({ ...prev, maxAttempts: Number(event.target.value) }))}
              placeholder="Số lượt làm"
              className="rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold outline-none dark:border-white/10 dark:bg-white/10 dark:text-white"
            />
          )}

          <input
            type="date"
            value={form.openDate}
            onChange={(event) => setForm((prev) => ({ ...prev, openDate: event.target.value }))}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold outline-none dark:border-white/10 dark:bg-white/10 dark:text-white"
          />

          <input
            type="date"
            value={form.closeDate}
            onChange={(event) => setForm((prev) => ({ ...prev, closeDate: event.target.value }))}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold outline-none dark:border-white/10 dark:bg-white/10 dark:text-white"
          />

          <input
            type="number"
            min="1"
            value={form.duration}
            onChange={(event) => setForm((prev) => ({ ...prev, duration: Number(event.target.value) }))}
            placeholder="Thời gian làm bài, phút"
            className="rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold outline-none dark:border-white/10 dark:bg-white/10 dark:text-white"
          />

          <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/10">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-white">
              <input
                type="checkbox"
                checked={form.shuffleQuestions}
                onChange={(event) => setForm((prev) => ({ ...prev, shuffleQuestions: event.target.checked }))}
              />
              Xáo trộn câu hỏi
            </label>

            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-white">
              <input
                type="checkbox"
                checked={form.shuffleAnswers}
                onChange={(event) => setForm((prev) => ({ ...prev, shuffleAnswers: event.target.checked }))}
              />
              Xáo trộn đáp án
            </label>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          {form.questions.map((question, questionIndex) => (
            <div key={question.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-black text-slate-950 dark:text-white">Câu {questionIndex + 1}</h3>

                <select
                  value={question.type}
                  onChange={(event) =>
                    updateQuestion(question.id, {
                      type: event.target.value,
                      answers: createDefaultAnswers(),
                    })
                  }
                  className="rounded-xl border border-slate-200 bg-white p-2 text-sm font-bold outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
                >
                  <option value="multiple">Câu hỏi nhiều lựa chọn</option>
                  <option value="truefalse">Câu đúng sai</option>
                  <option value="essay">Tự luận</option>
                  <option value="post">Đăng bài</option>
                  <option value="code">Code</option>
                </select>
              </div>

              {question.type !== 'post' && (
                <RichEditor
                  label="Câu hỏi"
                  value={question.question}
                  onChange={(value) => updateQuestion(question.id, { question: value })}
                />
              )}

              {question.type === 'post' && (
                <div className="space-y-3">
                  <RichEditor
                    label="Nội dung đăng bài"
                    value={question.question}
                    onChange={(value) => updateQuestion(question.id, { question: value })}
                  />

                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm dark:bg-slate-900 dark:text-white">
                    <Upload className="h-4 w-4" />
                    Upload ảnh hoặc Word
                    <input type="file" accept="image/*,.doc,.docx" className="hidden" />
                  </label>
                </div>
              )}

              {question.type === 'code' && (
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-bold text-slate-800 dark:text-white">
                    Terminal code giáo viên nhập
                  </label>

                  <textarea
                    value={question.code || ''}
                    onChange={(event) => updateQuestion(question.id, { code: event.target.value })}
                    rows={6}
                    className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 p-4 font-mono text-sm text-emerald-300 outline-none"
                    placeholder="$ nhập code tại đây..."
                  />
                </div>
              )}

              {(question.type === 'multiple' || question.type === 'truefalse') && (
                <div className="mt-4 space-y-3">
                  {question.answers.map((answer, answerIndex) => (
                    <div key={answer.id} className="rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-900">
                      <div className="flex items-start gap-3">
                        <div className="mt-9 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 font-black text-violet-700">
                          {answerIndex + 1}
                        </div>

                        <div className="flex-1">
                          <RichEditor
                            label={`Đáp án ${answerIndex + 1}`}
                            value={answer.content}
                            onChange={(value) => updateAnswer(question.id, answer.id, { content: value })}
                          />

                          {question.type === 'multiple' && (
                            <label className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-white">
                              <input
                                type="checkbox"
                                checked={answer.isCorrect}
                                onChange={(event) =>
                                  updateAnswer(question.id, answer.id, { isCorrect: event.target.checked })
                                }
                              />
                              Đáp án đúng
                            </label>
                          )}

                          {question.type === 'truefalse' && (
                            <div className="mt-2 flex gap-2">
                              {['Đúng', 'Sai'].map((item) => (
                                <button
                                  key={item}
                                  type="button"
                                  onClick={() => updateAnswer(question.id, answer.id, { trueFalse: item })}
                                  className={`rounded-xl px-4 py-2 text-sm font-bold ${
                                    answer.trueFalse === item
                                      ? 'bg-violet-600 text-white'
                                      : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white'
                                  }`}
                                >
                                  {item}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {question.answers.length > 2 && question.type === 'multiple' && (
                          <button
                            type="button"
                            onClick={() => removeAnswer(question.id, answer.id)}
                            className="mt-9 rounded-xl p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {question.type === 'multiple' && (
                    <button
                      type="button"
                      onClick={() => addAnswer(question.id)}
                      className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-violet-700 shadow-sm dark:bg-slate-900 dark:text-violet-200"
                    >
                      + Thêm đáp án
                    </button>
                  )}
                </div>
              )}

              {question.type === 'essay' && (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-slate-900">
                  Ô trả lời tự luận của học sinh
                </div>
              )}

              <div className="mt-4">
                <RichEditor
                  label="Lời giải thích"
                  value={question.explanation}
                  onChange={(value) => updateQuestion(question.id, { explanation: value })}
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, questions: [...prev.questions, createDefaultQuestion()] }))}
            className="rounded-2xl bg-violet-600 px-5 py-3 font-bold text-white shadow-lg shadow-violet-500/20"
          >
            + Thêm câu hỏi
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-5 dark:border-white/10">
          <button
            onClick={onClose}
            className="rounded-2xl px-5 py-3 font-bold text-slate-600 hover:bg-slate-100 dark:text-white dark:hover:bg-white/10"
          >
            Hủy
          </button>

          <button onClick={submit} className="rounded-2xl bg-violet-600 px-5 py-3 font-bold text-white">
            {editingExam ? 'Cập nhật' : 'Tạo bài tập'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatsModal({ open, onClose, exams }) {
  if (!open) return null

  const studentResults = exams.flatMap((exam) => exam.studentResults ?? [])
  const average = studentResults.length
    ? (studentResults.reduce((total, result) => total + Number(result.score || 0), 0) / studentResults.length).toFixed(1)
    : '0.0'

  const pieData = [
    { name: '0 - 5', value: studentResults.filter((item) => item.score < 5).length || 1, color: '#ef4444' },
    { name: '5 - 8', value: studentResults.filter((item) => item.score >= 5 && item.score < 8).length || 1, color: '#8b5cf6' },
    { name: '8 - 10', value: studentResults.filter((item) => item.score >= 8).length || 1, color: '#22c55e' },
  ]

  const wrongQuestions = studentResults.flatMap((result) => result.wrongQuestions ?? [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-950">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950 dark:text-white">Thống kê chi tiết</h2>
            <p className="text-sm text-slate-500">Điểm trung bình học sinh: {average}</p>
          </div>

          <button onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-white/10">
            <X className="h-5 w-5 dark:text-white" />
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="h-72 rounded-3xl bg-slate-50 p-4 dark:bg-white/5">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92}>
                  {pieData.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            <h3 className="font-black text-slate-950 dark:text-white">Lịch sử lỗi sai</h3>

            {wrongQuestions.length ? (
              wrongQuestions.map((item, index) => (
                <div key={index} className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                  <p className="font-bold text-slate-900 dark:text-white">{item.question}</p>
                  <p className="mt-1 text-sm text-emerald-600">Đáp án đúng: {item.correctAnswer}</p>
                  <p className="mt-1 text-sm text-slate-500">Gợi ý: {item.teacherNote}</p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-white/5">
                Chưa có lỗi sai nào.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Exams() {
  const navigate = useNavigate()

  const [role, setRole] = useState(null)
  const [studentClass, setStudentClass] = useState('Lớp 1')
  const [dark, setDark] = useState(false)
  const [search, setSearch] = useState('')
  const [codeSearch, setCodeSearch] = useState('')
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [roleLoading, setRoleLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [editingExam, setEditingExam] = useState(null)

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        setRoleLoading(true)

const user = auth.currentUser

        if (!user) {
          toast.error('Bạn chưa đăng nhập')
          return
        }

        const userSnap = await getDoc(doc(db, 'users', user.uid))

        if (!userSnap.exists()) {
          toast.error('Không tìm thấy thông tin người dùng')
          return
        }

        setRole(userSnap.data().role)
      } catch (error) {
        console.error(error)
        toast.error('Không thể tải vai trò người dùng')
      } finally {
        setRoleLoading(false)
      }
    }

    fetchUserRole()
  }, [])

  useEffect(() => {
    const fetchExams = async () => {
      try {
        setLoading(true)

        const snapshot = await getDocs(query(collection(db, 'exams'), orderBy('createdAt', 'desc')))
        const examData = await Promise.all(
          snapshot.docs.map(async (examDoc) => {
            const questionSnapshot = await getDocs(
              query(collection(db, 'exams', examDoc.id, 'questions'), orderBy('order', 'asc')),
            )

            const resultSnapshot = await getDocs(collection(db, 'exams', examDoc.id, 'results'))

            return {
              id: examDoc.id,
              ...examDoc.data(),
              questions: questionSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
              studentResults: resultSnapshot.docs
                .map((item) => ({ id: item.id, ...item.data() }))
                .filter((item) => item.role === 'student'),
            }
          }),
        )

        setExams(examData)
      } catch (error) {
        console.error(error)
        toast.error('Không thể tải danh sách bài kiểm tra')
      } finally {
        setLoading(false)
      }
    }

    fetchExams()
  }, [])

  const visibleExams = useMemo(() => {
    const now = new Date()

    return exams
      .map((exam) => {
        const opened = !exam.openDate || now >= new Date(exam.openDate)
        const closed = exam.closeDate && now > new Date(exam.closeDate)
        const status = opened && !closed ? exam.status : 'private'
        return { ...exam, status }
      })
      .filter((exam) => {
        if (role === 'student') {
          if (exam.status !== 'public') return false
          if (!exam.selectedClasses?.includes(studentClass)) return false
        }

        const keyword = search.trim().toLowerCase()
        if (!keyword) return true

        return (
          exam.title?.toLowerCase().includes(keyword) ||
          exam.topic?.toLowerCase().includes(keyword) ||
          exam.code?.toLowerCase().includes(keyword)
        )
      })
  }, [exams, role, studentClass, search])

  const studentResults = exams.flatMap((exam) => exam.studentResults ?? [])
  const averageScore = studentResults.length
    ? (studentResults.reduce((total, item) => total + Number(item.score || 0), 0) / studentResults.length).toFixed(1)
    : '0.0'

  const saveExam = async (exam) => {
    try {
      const examData = {
        title: exam.title,
        subject: exam.subject,
        subjectCode: subjectCodes[exam.subject],
        code: `${subjectCodes[exam.subject]}${exam.codeNumber}`,
        topic: exam.topic,
        status: exam.status,
        selectedClasses: exam.selectedClasses,
        attemptMode: exam.attemptMode,
        maxAttempts: Number(exam.maxAttempts || 1),
        duration: Number(exam.duration || 45),
        openDate: exam.openDate,
        closeDate: exam.closeDate,
        shuffleQuestions: Boolean(exam.shuffleQuestions),
        shuffleAnswers: Boolean(exam.shuffleAnswers),
        updatedAt: serverTimestamp(),
      }

      let examId = exam.id

      if (examId) {
        await updateDoc(doc(db, 'exams', examId), examData)
      } else {
        const created = await addDoc(collection(db, 'exams'), {
          ...examData,
          createdAt: serverTimestamp(),
        })

        examId = created.id
      }

      await Promise.all(
        exam.questions.map((question, index) =>
          addDoc(collection(db, 'exams', examId, 'questions'), {
            type: question.type,
            question: question.question,
            code: question.code ?? '',
            answers: question.answers ?? [],
            explanation: question.explanation,
            order: index,
            updatedAt: serverTimestamp(),
          }),
        ),
      )

      const nextExam = {
        ...exam,
        id: examId,
        ...examData,
        code: examData.code,
        studentResults: exam.studentResults ?? [],
      }

      setExams((prev) =>
        prev.some((item) => item.id === examId)
          ? prev.map((item) => (item.id === examId ? nextExam : item))
          : [nextExam, ...prev],
      )

      toast.success(editingExam ? 'Đã cập nhật bài tập' : 'Đã tạo bài tập')
      setEditingExam(null)
      setCreateOpen(false)
    } catch (error) {
      console.error(error)
      toast.error('Lưu bài kiểm tra thất bại')
    }
  }

  const openByCode = () => {
    const exam = visibleExams.find((item) => item.code?.toLowerCase() === codeSearch.trim().toLowerCase())

    if (!exam) {
      toast.error('Không tìm thấy mã bài kiểm tra')
      return
    }

    navigate(`/exam/${exam.id}`, { state: { role } })
  }

  if (roleLoading) {
    return (
      <section className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
        Đang tải vai trò người dùng...
      </section>
    )
  }

  return (
    <div className={dark ? 'dark' : ''}>
      <section className="min-h-screen bg-[#eef3ff] text-slate-950 transition dark:bg-slate-950">
        <header className="border-b border-slate-200 bg-white/95 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-500/25">
                <BookOpen className="h-7 w-7" />
              </div>

              <div>
                <h1 className="text-2xl font-black text-violet-600 md:text-3xl">
                  Hệ Thống Bài Kiểm Tra Khoa Học
                </h1>
                <p className="text-sm font-medium text-slate-500">Nền tảng học tập thông minh</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <UserRound className="h-5 w-5 text-slate-600 dark:text-white" />

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold dark:border-white/10 dark:bg-white/10 dark:text-white">
                {role === 'teacher' ? 'Giáo viên' : 'Học sinh'}
              </div>

              {role === 'student' && (
                <select
                  value={studentClass || 'Lớp 1'}
                  onChange={(event) => setStudentClass(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none dark:border-white/10 dark:bg-white/10 dark:text-white"
                >
                  {classes.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              )}

              {role === 'teacher' && (
                <button
                  onClick={() => {
                    setEditingExam(null)
                    setCreateOpen(true)
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20"
                >
                  <Plus className="h-4 w-4" />
                  Tạo bài tập
                </button>
              )}

              <button
                onClick={() => setDark((value) => !value)}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/10"
              >
                {dark ? <Sun className="h-5 w-5 text-white" /> : <Moon className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-2">
            <button
              onClick={() => setStatsOpen(true)}
              className="rounded-2xl border border-white bg-white p-6 text-left shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-center justify-between">
                <p className="font-bold text-slate-950 dark:text-white">Điểm trung bình</p>
                <BarChart3 className="h-5 w-5 dark:text-white" />
              </div>

              <p className="mt-7 text-3xl font-black text-slate-950 dark:text-white">{averageScore}</p>
              <p className="mt-1 text-sm text-slate-500">Từ {studentResults.length} bài đã làm</p>

              <p className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-white">
                <BarChart3 className="h-4 w-4" />
                Xem thống kê chi tiết
              </p>
            </button>

            <div className="rounded-2xl border border-white bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
              <p className="font-bold text-slate-950 dark:text-white">Nhập mã bài kiểm tra</p>

              <div className="mt-9 flex overflow-hidden rounded-xl bg-slate-100 dark:bg-white/10">
                <input
                  value={codeSearch}
                  onChange={(event) => setCodeSearch(event.target.value.toUpperCase())}
                  placeholder="NHẬP MÃ (VD: TO0001)"
                  className="flex-1 bg-transparent px-4 py-3 text-sm font-semibold outline-none dark:text-white"
                />

                <button onClick={openByCode} className="bg-slate-950 px-4 text-white">
                  <Search className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className="flex items-center gap-2 text-2xl font-black text-slate-950 dark:text-white">
              <BookOpen className="h-6 w-6" />
              Danh sách bài kiểm tra
            </h2>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm kiếm theo tên, mã, chủ đề..."
              className="w-full rounded-xl border border-white bg-white px-4 py-3 text-sm font-semibold outline-none dark:border-white/10 dark:bg-white/5 dark:text-white md:w-80"
            />
          </div>

          {loading ? (
            <div className="mt-16 text-center text-sm font-semibold text-slate-500">Đang tải bài kiểm tra...</div>
          ) : visibleExams.length ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleExams.map((exam) => (
                <div key={exam.id} className="rounded-3xl border border-white bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-950 dark:text-white">{exam.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">Chủ đề: {exam.topic}</p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        exam.status === 'public'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-white'
                      }`}
                    >
                      {exam.status === 'public' ? 'Công khai' : 'Riêng tư'}
                    </span>
                  </div>

                  <div className="grid gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    <p>Mã bài: {exam.code}</p>
                    <p>Môn: {exam.subject}</p>
                    <p>Lớp: {exam.selectedClasses?.join(', ')}</p>
                    <p>Thời gian: {exam.duration} phút</p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {role === 'teacher' ? (
                      <>
                        <Link
                          to={`/exam/${exam.id}`}
                          state={{ role }}
                          className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 dark:bg-white/10 dark:text-white"
                        >
                          Xem
                        </Link>

                        <button
                          onClick={() => {
                            setEditingExam(exam)
                            setCreateOpen(true)
                          }}
                          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white"
                        >
                          <Edit3 className="h-4 w-4" />
                          Cập nhật
                        </button>
                      </>
                    ) : (
                      <Link
                        to={`/exam/${exam.id}`}
                        state={{ role }}
                        className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white"
                      >
                        Làm bài
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-16 flex flex-col items-center justify-center text-slate-400">
              <BookOpen className="h-16 w-16" />
              <p className="mt-4 text-sm font-semibold">Chưa có bài kiểm tra nào</p>
            </div>
          )}
        </main>

        <CreateExamModal
          open={createOpen}
          onClose={() => {
            setCreateOpen(false)
            setEditingExam(null)
          }}
          onSave={saveExam}
          editingExam={editingExam}
        />

        <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} exams={exams} />
      </section>
    </div>
  )
}

export default Exams
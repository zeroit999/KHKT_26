import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, FileText, Loader2, Plus, Trash2, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'

import RichEditor from './RichEditor.jsx'
import DarkModeSelect from './DarkModeSelect.jsx'

import { parseWordExamApi } from '../../api/examApi'

import {
  addMinutesToDateTime,
  createDefaultAnswers,
  createDefaultQuestion,
  getCodeNumberFromExam,
  normalizeSubject,
} from '../../utils/examHelpers'

const questionTypes = [
  { value: 'multiple', label: 'Trắc nghiệm A/B/C/D' },
  { value: 'truefalse', label: 'Đúng/Sai 4 ý' },
  { value: 'short-answer', label: 'Trả lời ngắn' },
  { value: 'essay', label: 'Tự luận' },
]

const defaultScoring = {
  part1: {
    perQuestion: '',
  },
  part2: {
    oneCorrect: '',
    twoCorrect: '',
    threeCorrect: '',
    fourCorrect: '',
  },
  part3: {
    perQuestion: '',
  },
}

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

  const createQuestionWithSection = (section = 'part1') => ({
    ...createDefaultQuestion(),
    section,
    type:
      section === 'part2'
        ? 'truefalse'
        : section === 'part3'
          ? 'short-answer'
          : section === 'part4'
            ? 'essay'
            : 'multiple',
    score: '',
    correctAnswer: '',
  })

  const normalizeQuestions = (questions = []) =>
    questions.map((question) => ({
      ...question,
      section:
        question.section ||
        (question.type === 'truefalse'
          ? 'part2'
          : question.type === 'short-answer'
            ? 'part3'
            : question.type === 'essay'
              ? 'part4'
              : 'part1'),
      score: question.score ?? '',
      correctAnswer: question.correctAnswer ?? '',
    }))

  const [parsingWord, setParsingWord] = useState(false)

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
    totalScore: 0,
    scoring: defaultScoring,
    wordFileName: '',
    maxFullscreenViolations: 2,
    questions: [createQuestionWithSection('part1')],
  })

  const sectionCounts = useMemo(() => {
    const counts = {
      part1: 0,
      part2: 0,
      part3: 0,
      part4: 0,
    }

    for (const question of form.questions ?? []) {
      const section = question.section || 'part1'
      counts[section] = (counts[section] || 0) + 1
    }

    return counts
  }, [form.questions])

  const part1Total = Number(form.scoring.part1.perQuestion || 0) * sectionCounts.part1

  const part2Total =
    Number(form.scoring.part2.fourCorrect || 0) * sectionCounts.part2

  const part3Total = Number(form.scoring.part3.perQuestion || 0) * sectionCounts.part3

  const part4Total = (form.questions ?? [])
    .filter((question) => question.section === 'part4')
    .reduce((total, question) => total + Number(question.score || 0), 0)

  const computedTotalScore = Number(
    (part1Total + part2Total + part3Total + part4Total).toFixed(2),
  )

  const scoreOverLimit = computedTotalScore > 10

  useEffect(() => {
    if (!open) return

    if (editingExam) {
      const existingQuestions =
        editingExam.questions?.length > 0
          ? normalizeQuestions(editingExam.questions)
          : [createQuestionWithSection('part1')]

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
        totalScore: Number(editingExam.totalScore || 0),
        scoring: {
          ...defaultScoring,
          ...(editingExam.scoring ?? {}),
          part1: {
            ...defaultScoring.part1,
            ...(editingExam.scoring?.part1 ?? {}),
          },
          part2: {
            ...defaultScoring.part2,
            ...(editingExam.scoring?.part2 ?? {}),
          },
          part3: {
            ...defaultScoring.part3,
            ...(editingExam.scoring?.part3 ?? {}),
          },
        },
        wordFileName: editingExam.wordFileName ?? '',
        maxFullscreenViolations: Number(editingExam.maxFullscreenViolations ?? 2),
        questions: existingQuestions,
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
        totalScore: 0,
        scoring: defaultScoring,
        wordFileName: '',
        maxFullscreenViolations: 2,
        questions: [createQuestionWithSection('part1')],
      })
    }
  }, [open, editingExam, fixedTeacherSubject])

  if (!open) return null

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const updateScoring = (part, key, value) => {
    setForm((prev) => ({
      ...prev,
      scoring: {
        ...prev.scoring,
        [part]: {
          ...prev.scoring[part],
          [key]: value,
        },
      },
    }))
  }

  const updateQuestion = (questionIndex, key, value) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question, index) =>
        index === questionIndex ? { ...question, [key]: value } : question,
      ),
    }))
  }

  const updateQuestionType = (questionIndex, type) => {
    const section =
      type === 'truefalse'
        ? 'part2'
        : type === 'short-answer'
          ? 'part3'
          : type === 'essay'
            ? 'part4'
            : 'part1'

    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question, index) =>
        index === questionIndex
          ? {
              ...question,
              type,
              section,
              answers:
                type === 'multiple' || type === 'truefalse'
                  ? question.answers?.length
                    ? question.answers
                    : createDefaultAnswers()
                  : [],
            }
          : question,
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

  const toggleTrueFalseAnswer = (questionIndex, answerIndex, value) => {
    updateAnswer(questionIndex, answerIndex, 'isCorrect', value)
  }

  const addQuestion = (section = 'part1') => {
    setForm((prev) => ({
      ...prev,
      questions: [...prev.questions, createQuestionWithSection(section)],
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
              ? question.answers.filter(
                  (_, currentAnswerIndex) => currentAnswerIndex !== answerIndex,
                )
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

  const handleWordFileChange = async (event) => {
    const file = event.target.files?.[0]

    if (!file) return

    updateForm('wordFileName', file.name)

    const formData = new FormData()
    formData.append('file', file)

    try {
      setParsingWord(true)

      const response = await parseWordExamApi(formData)
      const parsedQuestions = response.data?.questions ?? []

      if (!parsedQuestions.length) {
        toast.error('Không tìm thấy câu hỏi trong file Word')
        return
      }

      setForm((prev) => ({
        ...prev,
        wordFileName: file.name,
        questions: normalizeQuestions(parsedQuestions),
      }))

      toast.success(`Đã nhập ${parsedQuestions.length} câu hỏi từ file Word`)
    } catch (error) {
      console.error(error)

      toast.error(
        error?.response?.data?.message ||
          error.message ||
          'Không thể đọc file Word',
      )
    } finally {
      setParsingWord(false)
      event.target.value = ''
    }
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

    if (computedTotalScore <= 0) {
      alert('Vui lòng nhập điểm cho từng phần')
      return
    }

    if (scoreOverLimit) {
      alert('Tổng điểm đang vượt quá 10. Vui lòng điều chỉnh điểm từng phần.')
      return
    }

    const questionsWithScore = form.questions.map((question) => ({
      ...question,
      score:
        question.section === 'part4'
          ? Number(question.score || 0)
          : 0,
    }))

    onSave({
      ...form,
      questions: questionsWithScore,
      subject: fixedTeacherSubject,
      maxAttempts: Number(form.maxAttempts || 1),
      duration: Number(form.duration || 45),
      totalScore: computedTotalScore,
      scoring: {
        part1: {
          perQuestion: Number(form.scoring.part1.perQuestion || 0),
        },
        part2: {
          oneCorrect: Number(form.scoring.part2.oneCorrect || 0),
          twoCorrect: Number(form.scoring.part2.twoCorrect || 0),
          threeCorrect: Number(form.scoring.part2.threeCorrect || 0),
          fourCorrect: Number(form.scoring.part2.fourCorrect || 0),
        },
        part3: {
          perQuestion: Number(form.scoring.part3.perQuestion || 0),
        },
      },
      maxFullscreenViolations: Number(form.maxFullscreenViolations ?? 2),
    })
  }

  const renderScoreSettings = () => (
    <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-950 dark:text-white">
            Cấu hình điểm theo 4 phần
          </h3>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Giáo viên nhập điểm từng phần. Phần tự luận nhập điểm riêng từng câu.
          </p>
        </div>

        <div
          className={`rounded-2xl px-4 py-3 text-sm font-black ${
            scoreOverLimit
              ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200'
          }`}
        >
          Tổng điểm: {computedTotalScore}/10
        </div>
      </div>

      {scoreOverLimit && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 dark:bg-red-500/10 dark:text-red-200">
          <AlertTriangle className="h-5 w-5" />
          Tổng điểm vượt quá 10. Hệ thống sẽ không cho tạo/cập nhật đề.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 dark:bg-slate-900">
          <p className="font-black text-slate-900 dark:text-white">
            Phần 1: A/B/C/D
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {sectionCounts.part1} câu
          </p>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.scoring.part1.perQuestion}
            onChange={(event) =>
              updateScoring('part1', 'perQuestion', event.target.value)
            }
            className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
            placeholder="Điểm mỗi câu"
          />
          <p className="mt-2 text-xs font-bold text-blue-600">
            Tổng phần 1: {Number(part1Total.toFixed(2))}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 dark:bg-slate-900">
          <p className="font-black text-slate-900 dark:text-white">
            Phần 2: Đúng/Sai 4 ý
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {sectionCounts.part2} câu • tính tối đa theo 4 ý đúng
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              ['oneCorrect', 'Đúng 1 ý'],
              ['twoCorrect', 'Đúng 2 ý'],
              ['threeCorrect', 'Đúng 3 ý'],
              ['fourCorrect', 'Đúng 4 ý'],
            ].map(([key, label]) => (
              <input
                key={key}
                type="number"
                min={0}
                step="0.01"
                value={form.scoring.part2[key]}
                onChange={(event) =>
                  updateScoring('part2', key, event.target.value)
                }
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                placeholder={label}
              />
            ))}
          </div>

          <p className="mt-2 text-xs font-bold text-blue-600">
            Tổng phần 2 tối đa: {Number(part2Total.toFixed(2))}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 dark:bg-slate-900">
          <p className="font-black text-slate-900 dark:text-white">
            Phần 3: Trả lời ngắn
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {sectionCounts.part3} câu
          </p>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.scoring.part3.perQuestion}
            onChange={(event) =>
              updateScoring('part3', 'perQuestion', event.target.value)
            }
            className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
            placeholder="Điểm mỗi câu"
          />
          <p className="mt-2 text-xs font-bold text-blue-600">
            Tổng phần 3: {Number(part3Total.toFixed(2))}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 dark:bg-slate-900">
          <p className="font-black text-slate-900 dark:text-white">
            Phần 4: Tự luận
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {sectionCounts.part4} câu • nhập điểm riêng từng câu
          </p>
          <p className="mt-3 text-sm font-black text-blue-600">
            Tổng phần 4: {Number(part4Total.toFixed(2))}
          </p>
        </div>
      </div>
    </div>
  )

  const renderQuestion = (question, questionIndex) => {
    const type = question.type ?? 'multiple'

    return (
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
              {question.section === 'part1'
                ? 'Phần 1'
                : question.section === 'part2'
                  ? 'Phần 2'
                  : question.section === 'part3'
                    ? 'Phần 3'
                    : 'Phần 4'}
            </p>

            {question.section === 'part4' && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">
                  Điểm tự luận:
                </span>

                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={question.score ?? ''}
                  onChange={(event) =>
                    updateQuestion(questionIndex, 'score', event.target.value)
                  }
                  className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-black text-blue-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-blue-200"
                  placeholder="0"
                />
              </div>
            )}
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
            value={type}
            onChange={(value) => updateQuestionType(questionIndex, value)}
            options={questionTypes}
          />
        </div>

        <RichEditor
          label="Nội dung câu hỏi"
          value={question.question}
          onChange={(value) => updateQuestion(questionIndex, 'question', value)}
        />

        {type === 'short-answer' && (
          <div className="mt-4">
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
              Đáp án trả lời ngắn
            </label>
            <input
              value={question.correctAnswer ?? ''}
              onChange={(event) =>
                updateQuestion(questionIndex, 'correctAnswer', event.target.value)
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              placeholder="Nhập đáp án đúng"
            />
          </div>
        )}

        {(type === 'essay' || type === 'code' || type === 'short-answer') && (
          <div className="mt-4">
            <RichEditor
              label="Gợi ý/chấm điểm"
              value={question.explanation ?? ''}
              onChange={(value) =>
                updateQuestion(questionIndex, 'explanation', value)
              }
            />
          </div>
        )}

        {type === 'multiple' && (
          <div className="mt-4 space-y-3">
            {(question.answers ?? createDefaultAnswers()).map(
              (answer, answerIndex) => (
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
                      updateAnswer(
                        questionIndex,
                        answerIndex,
                        'content',
                        event.target.value,
                      )
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
              ),
            )}

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
              onChange={(value) =>
                updateQuestion(questionIndex, 'explanation', value)
              }
            />
          </div>
        )}

        {type === 'truefalse' && (
          <div className="mt-4 space-y-3">
            {(question.answers ?? createDefaultAnswers()).slice(0, 4).map(
              (answer, answerIndex) => (
                <div
                  key={answer.id ?? answerIndex}
                  className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900 lg:grid-cols-[auto_1fr_auto]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-600 dark:bg-white/10 dark:text-white">
                    {String.fromCharCode(97 + answerIndex)})
                  </div>

                  <input
                    value={answer.content ?? ''}
                    onChange={(event) =>
                      updateAnswer(
                        questionIndex,
                        answerIndex,
                        'content',
                        event.target.value,
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                    placeholder={`Ý ${answerIndex + 1}`}
                  />

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        toggleTrueFalseAnswer(questionIndex, answerIndex, true)
                      }
                      className={`rounded-xl px-3 py-2 text-xs font-black ${
                        answer.isCorrect
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white'
                      }`}
                    >
                      Đúng
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        toggleTrueFalseAnswer(questionIndex, answerIndex, false)
                      }
                      className={`rounded-xl px-3 py-2 text-xs font-black ${
                        !answer.isCorrect
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white'
                      }`}
                    >
                      Sai
                    </button>
                  </div>
                </div>
              ),
            )}

            <RichEditor
              label="Giải thích đáp án"
              value={question.explanation ?? ''}
              onChange={(value) =>
                updateQuestion(questionIndex, 'explanation', value)
              }
            />
          </div>
        )}
      </div>
    )
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
              File Word đề thi
            </label>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <label
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 text-sm font-black transition ${
                  parsingWord
                    ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
                    : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200'
                }`}
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  {parsingWord ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                  ) : (
                    <Upload className="h-5 w-5 shrink-0" />
                  )}

                  <span className="truncate">
                    {parsingWord
                      ? 'Đang đọc file Word...'
                      : form.wordFileName || 'Chọn file .docx'}
                  </span>
                </span>

                <input
                  type="file"
                  accept=".docx"
                  onChange={handleWordFileChange}
                  className="hidden"
                  disabled={parsingWord}
                />
              </label>

              <a
                href="/De Mau Trac Nghiem Online - DoanVan.docx"
                download
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              >
                <FileText className="h-4 w-4" />
                Format đề thi
              </a>
            </div>

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
              onChange={(event) =>
                updateForm('maxFullscreenViolations', Number(event.target.value || 0))
              }
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
                onChange={(event) =>
                  updateForm('maxAttempts', Number(event.target.value || 1))
                }
                className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            )}
          </div>
        </div>

        {renderScoreSettings()}

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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">
                Câu hỏi
              </h3>

              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                {form.questions.length} câu • Tổng điểm: {computedTotalScore}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => addQuestion('part1')}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white"
              >
                + Phần 1
              </button>

              <button
                type="button"
                onClick={() => addQuestion('part2')}
                className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white"
              >
                + Phần 2
              </button>

              <button
                type="button"
                onClick={() => addQuestion('part3')}
                className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white"
              >
                + Phần 3
              </button>

              <button
                type="button"
                onClick={() => addQuestion('part4')}
                className="rounded-xl bg-orange-600 px-4 py-3 text-sm font-black text-white"
              >
                + Phần 4
              </button>
            </div>
          </div>

          {form.questions.map(renderQuestion)}
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
            disabled={parsingWord || scoreOverLimit}
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {editingExam ? 'Cập nhật bài thi' : 'Tạo bài thi'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateExamModal

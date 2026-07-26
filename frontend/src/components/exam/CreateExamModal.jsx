import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Award,
  BookOpenCheck,
  CalendarClock,
  FileText,
  GraduationCap,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  UsersRound,
  X,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Settings2,
  WandSparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'

import RichEditor from './RichEditor.jsx'
import DarkModeSelect from './DarkModeSelect.jsx'
import DateTimePicker from './DateTimePicker.jsx'

import { parseWordExamApi } from '../../api/examApi'

import {
  addMinutesToDateTime,
  createDefaultAnswers,
  createDefaultQuestion,
  getCodeNumberFromExam,
  getExamCode,
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
  presentation = 'modal',
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
  const [activeStep, setActiveStep] = useState(0)

  const [form, setForm] = useState({
    title: '',
    subject: fixedTeacherSubject,
    codeNumber: '0001',
    topic: '',
    status: 'public',
    selectedClasses: [],
    selectedGrades: [],
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
    leaderboardBonusPoints: 0,
    questions: [createQuestionWithSection('part1')],
  })

  const examCodePreview = useMemo(() => {
    return getExamCode(teacherName, fixedTeacherSubject, form.codeNumber)
  }, [teacherName, fixedTeacherSubject, form.codeNumber])

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
  const part2Total = Number(form.scoring.part2.fourCorrect || 0) * sectionCounts.part2
  const part3Total = Number(form.scoring.part3.perQuestion || 0) * sectionCounts.part3

  const part4Total = (form.questions ?? [])
    .filter((question) => question.section === 'part4')
    .reduce((total, question) => total + Number(question.score || 0), 0)

  const computedTotalScore = Number(
    (part1Total + part2Total + part3Total + part4Total).toFixed(2),
  )

  const scoreOverLimit = computedTotalScore > 10

  const openTimeValue = form.openDate ? new Date(form.openDate).getTime() : 0
  const closeTimeValue = form.closeDate ? new Date(form.closeDate).getTime() : 0
  const invalidCloseDate = Boolean(
    form.openDate &&
      form.closeDate &&
      !Number.isNaN(openTimeValue) &&
      !Number.isNaN(closeTimeValue) &&
      closeTimeValue <= openTimeValue,
  )

  const getValidCloseDate = (openDate, duration = 45, closeDate = '') => {
    if (!openDate) return closeDate || ''

    const fallbackCloseDate = addMinutesToDateTime(openDate, duration || 45)

    if (!closeDate) return fallbackCloseDate

    const openTime = new Date(openDate).getTime()
    const closeTime = new Date(closeDate).getTime()

    if (Number.isNaN(openTime) || Number.isNaN(closeTime)) {
      return fallbackCloseDate
    }

    return closeTime > openTime ? closeDate : fallbackCloseDate
  }

  useEffect(() => {
    if (!open) return

    setActiveStep(0)

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
        selectedGrades: editingExam.selectedGrades ?? [],
        attemptMode: editingExam.attemptMode ?? 'once',
        maxAttempts: Number(editingExam.maxAttempts || 1),
        duration: Number(editingExam.duration || 45),
        openDate: editingExam.openDate ?? '',
        closeDate: getValidCloseDate(
          editingExam.openDate ?? '',
          Number(editingExam.duration || 45),
          editingExam.closeDate ?? '',
        ),
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
        leaderboardBonusPoints: Number(editingExam.leaderboardBonusPoints ?? 0),
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
        selectedGrades: [],
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
        leaderboardBonusPoints: 0,
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

  const toggleGrade = (grade) => {
    setForm((prev) => {
      const selected = prev.selectedGrades ?? []

      return {
        ...prev,
        selectedGrades: selected.includes(grade)
          ? selected.filter((item) => item !== grade)
          : [...selected, grade],
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
      toast.error('Vui lòng nhập tên bài thi')
      return
    }

    if (!form.questions.length) {
      toast.error('Vui lòng thêm ít nhất 1 câu hỏi')
      return
    }

    if (form.status === 'public' && !(form.selectedGrades ?? []).length) {
      toast.error('Bài thi công khai bắt buộc phải chọn ít nhất 1 khối')
      return
    }

    if (form.status === 'private' && !(form.selectedClasses ?? []).length) {
      toast.error('Bài thi riêng tư bắt buộc phải chọn ít nhất 1 lớp')
      return
    }

    if (!form.openDate) {
      toast.error('Vui lòng chọn thời gian mở bài thi')
      return
    }

    if (!form.closeDate) {
      toast.error('Vui lòng chọn thời gian đóng bài thi')
      return
    }

    if (invalidCloseDate) {
      toast.error('Thời gian đóng phải sau thời gian mở')
      return
    }

    if (computedTotalScore <= 0) {
      toast.error('Vui lòng nhập điểm cho từng phần')
      return
    }

    if (scoreOverLimit) {
      toast.error('Tổng điểm đang vượt quá 10. Vui lòng điều chỉnh điểm từng phần.')
      return
    }

    if (Number(form.maxFullscreenViolations) < 0) {
      toast.error('Số lần được phép vi phạm không được nhỏ hơn 0')
      return
    }

    if (Number(form.leaderboardBonusPoints) < 0) {
      toast.error('Điểm cộng xếp hạng không được nhỏ hơn 0')
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
      code: examCodePreview,
      questions: questionsWithScore,
      subject: fixedTeacherSubject,
      selectedGrades: form.selectedGrades ?? [],
      selectedClasses: form.selectedClasses ?? [],
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
      leaderboardBonusPoints: Number(form.leaderboardBonusPoints ?? 0),
    })
  }

  const renderScoreSettings = () => (
    <div id="exam-score-settings" className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200">
              <BookOpenCheck className="h-5 w-5" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">
                Điểm thành phần và cấu hình chấm điểm
              </h3>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                Thiết lập rõ điểm từng phần. Tổng điểm đề thi được kiểm soát tối đa 10 điểm.
              </p>
            </div>
          </div>
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

  const isPage = presentation === 'page'
  const steps = [
    { id: 'information', label: 'Thông tin đề thi', Icon: FileText },
    { id: 'configuration', label: 'Cấu hình và điểm', Icon: Settings2 },
    { id: 'questions', label: 'Nội dung câu hỏi', Icon: ListChecks },
  ]

  const goToNextStep = () => {
    if (activeStep === 0) {
      if (!form.title.trim()) {
        toast.error('Vui lòng nhập tên bài thi')
        return
      }

      if (form.status === 'public' && !(form.selectedGrades ?? []).length) {
        toast.error('Vui lòng chọn ít nhất một khối học sinh')
        return
      }

      if (form.status === 'private' && !(form.selectedClasses ?? []).length) {
        toast.error('Vui lòng chọn ít nhất một lớp học')
        return
      }
    }

    if (activeStep === 1) {
      if (!form.openDate || !form.closeDate) {
        toast.error('Vui lòng thiết lập đầy đủ thời gian mở và đóng đề')
        return
      }

      if (invalidCloseDate) {
        toast.error('Thời gian đóng phải sau thời gian mở')
        return
      }

      if (computedTotalScore <= 0 || scoreOverLimit) {
        toast.error('Vui lòng hoàn thiện cấu hình điểm thành phần')
        return
      }
    }

    setActiveStep((current) => Math.min(current + 1, steps.length - 1))
  }

  const shellClass = isPage
    ? 'relative w-full overflow-visible rounded-[32px] border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-950'
    : 'relative max-h-[94vh] w-full max-w-7xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950'

  return (
    <div
      className={
        isPage
          ? 'w-full'
          : 'fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md'
      }
      onMouseDown={isPage ? undefined : onClose}
    >
      <div className={shellClass} onMouseDown={(event) => event.stopPropagation()}>
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-violet-700 px-6 py-7 text-white sm:px-8">
          <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-36 left-1/3 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/15 shadow-lg backdrop-blur">
                <WandSparkles className="h-7 w-7" />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-100">
                  {editingExam ? 'Cập nhật đề thi' : 'Tạo đề thi mới'}
                </p>
                <h2 className="mt-2 text-2xl font-black sm:text-3xl">
                  Thiết lập đề thi trực tuyến
                </h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-blue-100">
                  Hoàn thiện thông tin, cấu hình điểm và xây dựng nội dung theo từng bước rõ ràng.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
                <p className="text-[11px] font-black uppercase tracking-wider text-blue-100">Giáo viên</p>
                <p className="mt-1 text-sm font-black">{teacherName}</p>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
                <p className="text-[11px] font-black uppercase tracking-wider text-blue-100">Môn học</p>
                <p className="mt-1 text-sm font-black">{fixedTeacherSubject}</p>
              </div>
              {!isPage ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-white/20 bg-white/10 p-3 transition hover:bg-white/20"
                  aria-label="Đóng"
                >
                  <X className="h-5 w-5" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-white px-6 py-5 dark:border-white/10 dark:bg-slate-950 sm:px-8">
          <div className="grid gap-3 md:grid-cols-3">
            {steps.map((step, index) => {
              const completed = index < activeStep
              const selected = index === activeStep
              const StepIcon = step.Icon

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={`group flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    selected
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-400/50 dark:bg-blue-500/15 dark:text-blue-100'
                      : completed
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                        : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-400'
                  }`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-blue-600 text-white' : completed ? 'bg-emerald-600 text-white' : 'bg-white text-slate-400 dark:bg-white/10'}`}>
                    {completed ? <CheckCircle2 className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                  </span>
                  <span>
                    <span className="block text-[11px] font-black uppercase tracking-wider opacity-70">Bước {index + 1}</span>
                    <span className="mt-0.5 block text-sm font-black">{step.label}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className={`${isPage ? '' : 'max-h-[calc(94vh-260px)] overflow-y-auto'} bg-white px-6 py-6 dark:bg-slate-950 sm:px-8 sm:py-8`}>
          {activeStep === 0 ? (
            <div className="mx-auto max-w-6xl space-y-6">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-950">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-200">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-950 dark:text-white">Thông tin cơ bản</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Tên đề, chủ đề, mã đề và phạm vi hiển thị.</p>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="lg:col-span-2">
                    <label className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">Tên bài thi</label>
                    <input
                      value={form.title}
                      onChange={(event) => updateForm('title', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
                      placeholder="Ví dụ: Kiểm tra giữa học kì I"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">Chủ đề</label>
                    <input
                      value={form.topic}
                      onChange={(event) => updateForm('topic', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
                      placeholder="Nhập chủ đề kiến thức"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">Mã đề</label>
                    <input
                      value={form.codeNumber}
                      onChange={(event) => updateForm('codeNumber', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
                      placeholder="0001"
                    />
                    <p className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-300">Mã hoàn chỉnh: {examCodePreview}</p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">Chế độ hiển thị</label>
                    <DarkModeSelect
                      value={form.status}
                      onChange={(value) => updateForm('status', value)}
                      options={[
                        { value: 'public', label: 'Công khai theo khối' },
                        { value: 'private', label: 'Riêng tư theo lớp' },
                      ]}
                      buttonClassName="rounded-2xl bg-slate-50 px-4 py-3.5 dark:bg-white/5"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">Số lượt làm</label>
                    <DarkModeSelect
                      value={form.attemptMode}
                      onChange={(value) => updateForm('attemptMode', value)}
                      options={[
                        { value: 'once', label: 'Chỉ một lần' },
                        { value: 'multiple', label: 'Nhiều lần' },
                      ]}
                      buttonClassName="rounded-2xl bg-slate-50 px-4 py-3.5 dark:bg-white/5"
                    />
                  </div>
                </div>

                {form.attemptMode === 'multiple' ? (
                  <div className="mt-5 max-w-sm">
                    <label className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">Số lượt tối đa</label>
                    <input
                      type="number"
                      min="1"
                      value={form.maxAttempts}
                      onChange={(event) => updateForm('maxAttempts', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                  </div>
                ) : null}
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-950">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-200">
                    {form.status === 'public' ? <GraduationCap className="h-6 w-6" /> : <UsersRound className="h-6 w-6" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-950 dark:text-white">Đối tượng làm bài</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Chọn đúng khối hoặc lớp được phép truy cập đề.</p>
                  </div>
                </div>

                {form.status === 'public' ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {['10', '11', '12'].map((grade) => {
                      const selected = (form.selectedGrades ?? []).includes(grade)
                      return (
                        <button key={grade} type="button" onClick={() => toggleGrade(grade)} className={`rounded-2xl border px-5 py-4 text-sm font-black transition ${selected ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-400 dark:border-white/10 dark:bg-white/5 dark:text-white'}`}>
                          Khối {grade}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {availableClasses.length ? availableClasses.map((classItem) => {
                      const className = typeof classItem === 'string' ? classItem : classItem.name || classItem.className || classItem.title || classItem.id || 'Lớp'
                      const selected = (form.selectedClasses ?? []).includes(className)
                      return (
                        <button key={className} type="button" onClick={() => toggleClass(className)} className={`rounded-2xl border px-5 py-3 text-sm font-black transition ${selected ? 'border-violet-600 bg-violet-600 text-white shadow-lg shadow-violet-500/20' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-violet-400 dark:border-white/10 dark:bg-white/5 dark:text-white'}`}>
                          {className}
                        </button>
                      )
                    }) : <p className="w-full rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-bold text-slate-500 dark:border-white/10">Chưa có lớp học trong hệ thống.</p>}
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {activeStep === 1 ? (
            <div className="mx-auto max-w-6xl space-y-6">
              <section className="grid gap-5 xl:grid-cols-3">
                <div className="rounded-3xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-6 shadow-sm dark:border-orange-500/20 dark:from-orange-500/10 dark:to-amber-500/5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/25"><ShieldAlert className="h-6 w-6" /></div>
                  <h3 className="mt-5 text-lg font-black text-slate-950 dark:text-white">Số lần được phép vi phạm</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">Giới hạn số lần học sinh được thoát chế độ toàn màn hình.</p>
                  <div className="mt-5 flex items-center gap-3">
                    <button type="button" onClick={() => updateForm('maxFullscreenViolations', Math.max(0, Number(form.maxFullscreenViolations || 0) - 1))} className="h-12 w-12 rounded-2xl border border-orange-200 bg-white text-xl font-black text-orange-600 dark:border-orange-500/30 dark:bg-white/10">−</button>
                    <input type="number" min="0" value={form.maxFullscreenViolations} onChange={(event) => updateForm('maxFullscreenViolations', event.target.value)} className="h-12 min-w-0 flex-1 rounded-2xl border border-orange-200 bg-white text-center text-xl font-black text-slate-950 outline-none focus:border-orange-500 dark:border-orange-500/30 dark:bg-white/10 dark:text-white" />
                    <button type="button" onClick={() => updateForm('maxFullscreenViolations', Number(form.maxFullscreenViolations || 0) + 1)} className="h-12 w-12 rounded-2xl bg-orange-500 text-xl font-black text-white shadow-lg shadow-orange-500/20">+</button>
                  </div>
                </div>

                <div className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-6 shadow-sm dark:border-violet-500/20 dark:from-violet-500/10 dark:to-fuchsia-500/5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-500/25"><Award className="h-6 w-6" /></div>
                  <h3 className="mt-5 text-lg font-black text-slate-950 dark:text-white">Điểm cộng xếp hạng</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">Điểm được cộng vào bảng xếp hạng toàn hệ thống sau khi hoàn thành.</p>
                  <div className="relative mt-5">
                    <input type="number" min="0" step="0.1" value={form.leaderboardBonusPoints} onChange={(event) => updateForm('leaderboardBonusPoints', event.target.value)} className="h-12 w-full rounded-2xl border border-violet-200 bg-white px-4 pr-16 text-xl font-black text-slate-950 outline-none focus:border-violet-500 dark:border-violet-500/30 dark:bg-white/10 dark:text-white" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-violet-600 dark:text-violet-300">điểm</span>
                  </div>
                </div>

                <div className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-6 shadow-sm dark:border-blue-500/20 dark:from-blue-500/10 dark:to-cyan-500/5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/25"><CalendarClock className="h-6 w-6" /></div>
                  <h3 className="mt-5 text-lg font-black text-slate-950 dark:text-white">Thời lượng làm bài</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">Thời gian đếm ngược của mỗi lượt làm bài.</p>
                  <div className="relative mt-5">
                    <input type="number" min="1" value={form.duration} onChange={(event) => updateForm('duration', event.target.value)} className="h-12 w-full rounded-2xl border border-blue-200 bg-white px-4 pr-16 text-xl font-black text-slate-950 outline-none focus:border-blue-500 dark:border-blue-500/30 dark:bg-white/10 dark:text-white" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-blue-600 dark:text-blue-300">phút</span>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-950">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-200"><CalendarClock className="h-6 w-6" /></div>
                  <div><h3 className="text-xl font-black text-slate-950 dark:text-white">Lịch mở và đóng đề</h3><p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Thiết lập khoảng thời gian học sinh được truy cập.</p></div>
                </div>
                <div className="grid gap-5 lg:grid-cols-2">
                  <div><label className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">Thời gian mở</label><DateTimePicker value={form.openDate} onChange={(value) => { updateForm('openDate', value); updateForm('closeDate', addMinutesToDateTime(value, form.duration)) }} /></div>
                  <div><label className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">Thời gian đóng</label><DateTimePicker value={form.closeDate} min={form.openDate || undefined} onChange={(value) => updateForm('closeDate', value)} hasError={invalidCloseDate} /></div>
                </div>
              </section>

              {renderScoreSettings()}

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-950">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div><h3 className="text-xl font-black text-slate-950 dark:text-white">Tùy chọn trộn đề</h3><p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Tạo trải nghiệm làm bài khác nhau giữa học sinh.</p></div>
                  <div className="flex flex-wrap gap-3">
                    {[['shuffleQuestions', 'Trộn câu hỏi'], ['shuffleAnswers', 'Trộn đáp án']].map(([key, label]) => (
                      <button key={key} type="button" onClick={() => updateForm(key, !form[key])} className={`rounded-2xl border px-5 py-3 text-sm font-black transition ${form[key] ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white'}`}>{label}</button>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {activeStep === 2 ? (
            <div className="mx-auto max-w-6xl space-y-6">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-950">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200"><Upload className="h-6 w-6" /></div>
                    <div><h3 className="text-xl font-black text-slate-950 dark:text-white">Nhập đề từ Word</h3><p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Tải tệp .docx theo đúng định dạng hệ thống.</p></div>
                  </div>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-700">
                    {parsingWord ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {parsingWord ? 'Đang xử lý...' : 'Chọn tệp Word'}
                    <input type="file" accept=".docx" onChange={handleWordFileChange} className="hidden" disabled={parsingWord} />
                  </label>
                </div>
                {form.wordFileName ? <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">Đã chọn: {form.wordFileName}</p> : null}
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950">
                <div className="sticky top-0 z-20 flex flex-col gap-4 border-b border-slate-200 bg-white/95 p-5 backdrop-blur dark:border-white/10 dark:bg-slate-950/95 lg:flex-row lg:items-center lg:justify-between">
                  <div><h3 className="text-xl font-black text-slate-950 dark:text-white">Danh sách câu hỏi</h3><p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{form.questions.length} câu • Tổng điểm hiện tại: {computedTotalScore}/10</p></div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => addQuestion('part1')} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white">+ Phần 1</button>
                    <button type="button" onClick={() => addQuestion('part2')} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white">+ Phần 2</button>
                    <button type="button" onClick={() => addQuestion('part3')} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white">+ Phần 3</button>
                    <button type="button" onClick={() => addQuestion('part4')} className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-black text-white">+ Phần 4</button>
                  </div>
                </div>
                <div className="space-y-5 p-5">{form.questions.map(renderQuestion)}</div>
              </section>
            </div>
          ) : null}
        </div>

        <div
          className={`flex flex-col-reverse gap-3 border-t border-slate-200 bg-white/95 px-6 py-5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 sm:flex-row sm:items-center sm:justify-between sm:px-8 ${
            isPage
              ? 'sticky bottom-4 z-40 mx-4 mb-4 rounded-3xl border border-slate-200 shadow-[0_-12px_40px_rgba(15,23,42,0.14)] dark:border-white/10 dark:shadow-[0_-12px_40px_rgba(0,0,0,0.35)]'
              : ''
          }`}
        >
          <button type="button" onClick={onClose} className="rounded-2xl px-5 py-3 text-sm font-black text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">Hủy</button>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            {activeStep > 0 ? (
              <button type="button" onClick={() => setActiveStep((current) => Math.max(0, current - 1))} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white">
                <ChevronLeft className="h-4 w-4" /> Quay lại
              </button>
            ) : null}

            {activeStep < steps.length - 1 ? (
              <button type="button" onClick={goToNextStep} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700">
                Tiếp tục <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={parsingWord || scoreOverLimit || invalidCloseDate} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                <CheckCircle2 className="h-4 w-4" /> {editingExam ? 'Lưu thay đổi' : 'Tạo đề thi'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateExamModal

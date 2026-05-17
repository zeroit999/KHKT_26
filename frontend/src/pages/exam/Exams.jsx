import { auth, db } from '../../components/firebase'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Clock3,
  Copy,
  FileText,
  Globe2,
  LockKeyhole,
  ChevronDown,
  Edit3,
  Eye,
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
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'

const teacherSubjects = [
  'Toán',
  'Vật lý',
  'Hóa học',
  'Sinh học',
  'Tin học',
  'Ngữ văn',
  'Lịch sử',
  'Địa lý',
  'Tiếng Anh',
  'Công nghệ',
  'Quốc phòng - An ninh',
  'Trải nghiệm hướng nghiệp',
  'Giáo dục địa phương',
  'Giáo dục thể chất',
  'Giáo dục Kinh tế và Pháp luật',
]

const subjectCodes = {
  Toán: 'TO',
  'Vật lý': 'VL',
  'Hóa học': 'HH',
  'Sinh học': 'SH',
  'Tin học': 'TH',
  'Ngữ văn': 'NV',
  'Lịch sử': 'LS',
  'Địa lý': 'DL',
  'Tiếng Anh': 'TA',
  'Công nghệ': 'CN',
  'Quốc phòng - An ninh': 'QP',
  'Trải nghiệm hướng nghiệp': 'HN',
  'Giáo dục địa phương': 'DP',
  'Giáo dục thể chất': 'TD',
  'Giáo dục Kinh tế và Pháp luật': 'KT',
}

const normalizeSubject = (value) => {
  if (!value) return 'Toán'

  const rawValue = String(value).trim()
  const lowerValue = rawValue.toLowerCase()

  const subjectAliases = {
    toán: 'Toán',

    lý: 'Vật lý',
    'vật lý': 'Vật lý',

    hóa: 'Hóa học',
    'hóa học': 'Hóa học',

    sinh: 'Sinh học',
    'sinh học': 'Sinh học',

    tin: 'Tin học',
    'tin học': 'Tin học',

    văn: 'Ngữ văn',
    'ngữ văn': 'Ngữ văn',

    sử: 'Lịch sử',
    'lịch sử': 'Lịch sử',

    địa: 'Địa lý',
    'địa lý': 'Địa lý',

    anh: 'Tiếng Anh',
    'tiếng anh': 'Tiếng Anh',

    'công nghệ': 'Công nghệ',

    gdqp: 'Quốc phòng - An ninh',
    'quốc phòng - an ninh': 'Quốc phòng - An ninh',
    'quốc phòng': 'Quốc phòng - An ninh',

    'trải nghiệm hướng nghiệp': 'Trải nghiệm hướng nghiệp',
    'tn-hn': 'Trải nghiệm hướng nghiệp',
    tnhn: 'Trải nghiệm hướng nghiệp',

    'giáo dục địa phương': 'Giáo dục địa phương',
    gddp: 'Giáo dục địa phương',

    'giáo dục thể chất': 'Giáo dục thể chất',
    'thể dục': 'Giáo dục thể chất',
    gdtc: 'Giáo dục thể chất',

    gdktpl: 'Giáo dục Kinh tế và Pháp luật',
    'gdkt-pl': 'Giáo dục Kinh tế và Pháp luật',
    'giáo dục kinh tế và pháp luật': 'Giáo dục Kinh tế và Pháp luật',
    'kinh tế và pháp luật': 'Giáo dục Kinh tế và Pháp luật',
  }

  if (subjectAliases[lowerValue]) {
    return subjectAliases[lowerValue]
  }

  const matchedSubject = teacherSubjects.find(
    (subject) =>
      subject.toLowerCase() === lowerValue ||
      lowerValue.includes(subject.toLowerCase()),
  )

  return matchedSubject ?? rawValue
}


const normalizeRole = (value) => String(value || '').trim().toLowerCase()
const isStudentRole = (value) => normalizeRole(value) === 'user' || normalizeRole(value) === 'student'
const isAdminRole = (value) =>
  normalizeRole(value) === 'admin user' ||
  normalizeRole(value) === 'admin_user' ||
  normalizeRole(value) === 'admin' ||
  normalizeRole(value) === 'teacher'
const isAdminDevRole = (value) => normalizeRole(value) === 'admin dev' || normalizeRole(value) === 'admin_dev'
const canManageExams = (value) => isAdminRole(value) || isAdminDevRole(value)
const studentResultRoles = ['user', 'student']

const getSyncedDarkMode = () => {
  if (typeof window === 'undefined') return false

  const root = document.documentElement
  const body = document.body

  if (root.classList.contains('dark') || body.classList.contains('dark')) return true
  if (root.classList.contains('light') || body.classList.contains('light')) return false

  const storageKeys = ['theme', 'color-theme', 'vite-ui-theme', 'darkMode', 'dark-mode', 'mode']

  for (const key of storageKeys) {
    const value = window.localStorage.getItem(key)?.toLowerCase()

    if (['dark', 'true', '1', 'night'].includes(value)) return true
    if (['light', 'false', '0', 'day'].includes(value)) return false
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function useSyncedDarkMode() {
  const [isDark, setIsDark] = useState(getSyncedDarkMode)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncDarkMode = () => setIsDark(getSyncedDarkMode())
    const root = document.documentElement
    const body = document.body
    const observer = new MutationObserver(syncDarkMode)
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')

    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    if (body) observer.observe(body, { attributes: true, attributeFilter: ['class'] })

    window.addEventListener('storage', syncDarkMode)
    media?.addEventListener?.('change', syncDarkMode)
    syncDarkMode()

    return () => {
      observer.disconnect()
      window.removeEventListener('storage', syncDarkMode)
      media?.removeEventListener?.('change', syncDarkMode)
    }
  }, [])

  return isDark
}


const defaultClasses = Array.from({ length: 10 }, (_, index) => `Lớp ${index + 1}`)

const getClassName = (item) =>
  item?.name ??
  item?.className ??
  item?.title ??
  item?.label ??
  item?.grade ??
  item?.id ??
  ''

const getUserClassName = (item) =>
  item?.className ??
  item?.class ??
  item?.lop ??
  item?.grade ??
  item?.studentClass ??
  item?.classId ??
  item?.classNameText ??
  ''

const normalizeClassName = (value) => String(value || '').trim().toLowerCase()

const getStudentIdentityValues = (user, userData = {}) =>
  [
    user?.uid,
    user?.email,
    userData?.uid,
    userData?.id,
    userData?.email,
    userData?.studentId,
    userData?.studentCode,
    userData?.maHocSinh,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase())

const extractStudentItems = (classData = {}) => [
  ...(Array.isArray(classData.students) ? classData.students : []),
  ...(Array.isArray(classData.studentIds) ? classData.studentIds : []),
  ...(Array.isArray(classData.studentUids) ? classData.studentUids : []),
  ...(Array.isArray(classData.members) ? classData.members : []),
  ...(Array.isArray(classData.memberIds) ? classData.memberIds : []),
  ...(Array.isArray(classData.users) ? classData.users : []),
]

const classHasStudent = (classData, studentIdentities) => {
  if (!studentIdentities.length) return false

  return extractStudentItems(classData).some((student) => {
    if (student === null || student === undefined) return false

    if (typeof student === 'string') {
      return studentIdentities.includes(student.trim().toLowerCase())
    }

    if (typeof student === 'object') {
      return [
        student.uid,
        student.id,
        student.email,
        student.studentId,
        student.studentCode,
        student.maHocSinh,
      ]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase())
        .some((value) => studentIdentities.includes(value))
    }

    return false
  })
}



const toDateTimeInputValue = (value) => {
  if (!value) return ''

  const text = String(value).trim()
  if (!text) return ''
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return text
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T00:00`

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const getDateTimeValue = (value) => {
  const inputValue = toDateTimeInputValue(value)
  if (!inputValue) return 0
  const date = new Date(inputValue)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

const addMinutesToDateTime = (value, minutes = 45) => {
  const inputValue = toDateTimeInputValue(value)
  if (!inputValue) return ''

  const date = new Date(inputValue)
  if (Number.isNaN(date.getTime())) return ''

  date.setMinutes(date.getMinutes() + Number(minutes || 45))

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const mins = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${mins}`
}

const formatDateTimeText = (value) => {
  const inputValue = toDateTimeInputValue(value)
  if (!inputValue) return 'Chưa đặt thời gian'

  const [datePart, timePart = '00:00'] = inputValue.split('T')
  const [year, month, day] = datePart.split('-')

  return `${timePart} ${day}/${month}/${year}`
}


const normalizeCodePart = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/_/g, '-')

const getTeacherCodeName = (value) => {
  const text = String(value || 'GV').trim()
  if (!text) return 'GV'

  const initials = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')

  return initials || 'GV'
}

const getExamCode = (teacherName, subject, codeNumber) => {
  const fixedSubject = normalizeSubject(subject)
  const subjectCode = subjectCodes[fixedSubject] ?? fixedSubject.slice(0, 2).toUpperCase()
  return `${getTeacherCodeName(teacherName)}_${subjectCode}_${normalizeCodePart(codeNumber)}`
}

const getCodeNumberFromExam = (exam, fallback = '0001') => {
  const code = String(exam?.code || '').trim()
  if (!code) return exam?.codeNumber ?? fallback
  if (code.includes('_')) return code.split('_').pop() || fallback
  const subject = normalizeSubject(exam?.subject)
  const subjectCode = subjectCodes[subject] ?? subject.slice(0, 2).toUpperCase()
  return code.startsWith(subjectCode) ? code.slice(subjectCode.length) || fallback : code
}

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


function DarkModeSelect({ value, onChange, options, className = '' }) {
  const [open, setOpen] = useState(false)
  const selectedOption = options.find((option) => option.value === value) ?? options[0]

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700 outline-none transition hover:border-violet-300 focus:border-violet-400 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:hover:border-violet-400/60"
      >
        <span>{selectedOption?.label}</span>
        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-slate-900">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-bold transition ${
                value === option.value
                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-100'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-white dark:hover:bg-white/10'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CreateExamModal({ open, onClose, onSave, editingExam, teacherSubject, teacherName, availableClasses }) {
  const fixedSubject = normalizeSubject(teacherSubject)
  const classes = Array.isArray(availableClasses) ? availableClasses : defaultClasses

  const [form, setForm] = useState(
    editingExam ?? {
      title: '',
      subject: fixedSubject,
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
      wordFileName: '',
      questions: [createDefaultQuestion()],
    },
  )

  const [classPanelOpen, setClassPanelOpen] = useState(false)
  const classPanelRef = useRef(null)

  const closeClassPanelIfOutside = (event) => {
    if (classPanelRef.current && !classPanelRef.current.contains(event.target)) {
      setClassPanelOpen(false)
    }
  }

  useEffect(() => {
    if (!classPanelOpen) return undefined

    const closeClassPanelWhenClickOutside = (event) => {
      closeClassPanelIfOutside(event)
    }

    document.addEventListener('mousedown', closeClassPanelWhenClickOutside, true)
    document.addEventListener('touchstart', closeClassPanelWhenClickOutside, true)

    return () => {
      document.removeEventListener('mousedown', closeClassPanelWhenClickOutside, true)
      document.removeEventListener('touchstart', closeClassPanelWhenClickOutside, true)
    }
  }, [classPanelOpen])

  useEffect(() => {
    if (editingExam) {
      setForm({
        ...editingExam,
        codeNumber: getCodeNumberFromExam(editingExam),
        wordFileName: editingExam.wordFileName ?? '',
        questions: editingExam.questions?.length ? editingExam.questions : [createDefaultQuestion()],
      })
    } else {
      setForm({
        title: '',
        subject: fixedSubject,
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
  }, [editingExam, open, fixedSubject])

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

  const handleWordUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const isWordFile = /\.(doc|docx)$/i.test(file.name)
    if (!isWordFile) {
      toast.error('Vui lòng chọn file Word .doc hoặc .docx')
      event.target.value = ''
      return
    }

    setForm((prev) => ({
      ...prev,
      wordFileName: file.name,
      questions: [
        {
          id: createId(),
          type: 'post',
          question: `[File Word: ${file.name}]`,
          code: '',
          explanation: '',
          answers: [],
        },
      ],
    }))
  }

  const clearWordUpload = () => {
    setForm((prev) => ({
      ...prev,
      wordFileName: '',
      questions: prev.questions?.length && prev.questions.some((question) => question.type !== 'post')
        ? prev.questions
        : [createDefaultQuestion()],
    }))
  }

  const validate = () => {
    if (!form.title.trim()) return 'Vui lòng nhập tên bài kiểm tra.'
    if (!form.topic.trim()) return 'Vui lòng nhập chủ đề.'
    if (!normalizeCodePart(form.codeNumber)) return 'Vui lòng nhập mã đề.'
    if (form.status === 'private' && !form.selectedClasses.length) return 'Vui lòng chọn ít nhất một lớp.'
    if (form.openDate && form.closeDate && getDateTimeValue(form.closeDate) <= getDateTimeValue(form.openDate)) return 'Thời gian kết thúc phải lớn hơn thời gian bắt đầu.'

    if (form.wordFileName) return ''

    for (const question of form.questions) {
      if (!question.question.trim()) return 'Mỗi câu hỏi phải có nội dung.'
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
      code: getExamCode(teacherName, form.subject, form.codeNumber),
      questions: form.wordFileName
        ? [
            {
              id: createId(),
              type: 'post',
              question: `[File Word: ${form.wordFileName}]`,
              code: '',
              answers: [],
              explanation: '',
            },
          ]
        : form.questions,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-950"
        onMouseDown={(e) => e.stopPropagation()}
        onMouseDownCapture={(event) => {
          if (classPanelOpen) closeClassPanelIfOutside(event)
        }}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950 dark:text-white">
              {editingExam ? 'Cập nhật bài tập' : 'Tạo bài tập'}
            </h2>
            <p className="text-sm text-slate-500">Dữ liệu sẽ được lưu vào hệ thống.</p>
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

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Môn học</p>
            <p className="mt-1">{form.subject}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
            <label className="rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-white">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Giáo viên nhập mã đề
              </span>
              <input
                value={form.codeNumber}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    codeNumber: normalizeCodePart(event.target.value),
                  }))
                }
                placeholder="Ví dụ 0001 hoặc DP01"
                className="w-full bg-transparent font-semibold text-slate-700 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
              />
            </label>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-white">
              <p className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Mã đề
              </p>
              <p className="break-all text-base font-black text-slate-900 dark:text-white">
                {getExamCode(teacherName, form.subject, form.codeNumber || '0001')}
              </p>
            </div>
          </div>

          <DarkModeSelect
            value={form.status}
            onChange={(value) => {
              setClassPanelOpen(false)
              setForm((prev) => ({ ...prev, status: value }))
            }}
            options={[
              { value: 'public', label: 'Công khai' },
              { value: 'private', label: 'Riêng tư' },
            ]}
          />

          {form.status === 'private' && (
          <div ref={classPanelRef} className="relative">
            <button
              type="button"
              onClick={() => setClassPanelOpen((value) => !value)}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-white"
            >
              {form.selectedClasses.length ? form.selectedClasses.join(', ') : 'Chọn lớp'}
              <ChevronDown className="h-4 w-4" />
            </button>

            {classPanelOpen && (
              <div className="absolute left-0 top-14 z-50 w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-slate-900">
                <div className="mb-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, selectedClasses: classes }))}
                    disabled={!classes.length}
                    className="flex-1 rounded-xl bg-violet-600 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
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

                {classes.length ? (
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
                ) : (
                  <div className="rounded-xl bg-slate-50 p-4 text-center text-sm font-bold text-slate-500 dark:bg-white/10 dark:text-slate-300">
                    Bạn chưa có lớp học nào. Hãy tạo lớp học trước và thêm học sinh vào lớp để có thể chọn lớp cho bài kiểm tra.
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          <DarkModeSelect
            value={form.attemptMode}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                attemptMode: value,
                maxAttempts: value === 'once' ? 1 : prev.maxAttempts,
              }))
            }
            options={[
              { value: 'once', label: 'Làm 1 lần' },
              { value: 'multiple', label: 'Được làm nhiều lần' },
            ]}
          />

          {form.attemptMode === 'multiple' && (
            <input
              type="number"
              min="2"
              value={form.maxAttempts}
              onChange={(event) => setForm((prev) => ({ ...prev, maxAttempts: Number(event.target.value) }))}
              placeholder="Số lượt làm"
              className="rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700 outline-none [color-scheme:light] dark:border-white/10 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400 dark:[color-scheme:dark]"
            />
          )}

          <label className="rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-white">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Thời gian bắt đầu
            </span>
            <input
              type="datetime-local"
              value={toDateTimeInputValue(form.openDate)}
              onChange={(event) => {
                const nextOpenDate = event.target.value

                setForm((prev) => {
                  const nextCloseDate =
                    !prev.closeDate ||
                    (nextOpenDate && getDateTimeValue(prev.closeDate) <= getDateTimeValue(nextOpenDate))
                      ? addMinutesToDateTime(nextOpenDate, prev.duration)
                      : prev.closeDate

                  return {
                    ...prev,
                    openDate: nextOpenDate,
                    closeDate: nextCloseDate,
                  }
                })
              }}
              className="w-full border-0 bg-transparent p-0 font-bold outline-none dark:text-white"
            />
          </label>

          <label className="rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-white">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Thời gian kết thúc
            </span>
            <input
              type="datetime-local"
              value={toDateTimeInputValue(form.closeDate)}
              min={toDateTimeInputValue(form.openDate) || undefined}
              onChange={(event) => {
                const nextCloseDate = event.target.value

                setForm((prev) => {
                  if (
                    prev.openDate &&
                    nextCloseDate &&
                    getDateTimeValue(nextCloseDate) <= getDateTimeValue(prev.openDate)
                  ) {
                    toast.error('Thời gian kết thúc phải sau thời gian bắt đầu')
                    return {
                      ...prev,
                      closeDate: addMinutesToDateTime(prev.openDate, prev.duration),
                    }
                  }

                  return {
                    ...prev,
                    closeDate: nextCloseDate,
                  }
                })
              }}
              className="w-full border-0 bg-transparent p-0 font-bold outline-none dark:text-white"
            />
          </label>

          <label className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/10">
            <span className="mb-1 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Thời gian làm bài (phút)
            </span>
            <input
              type="number"
              min="1"
              value={form.duration}
              onChange={(event) => {
                const nextDuration = Number(event.target.value)

                setForm((prev) => ({
                  ...prev,
                  duration: nextDuration,
                  closeDate:
                    prev.openDate &&
                    (!prev.closeDate || getDateTimeValue(prev.closeDate) <= getDateTimeValue(prev.openDate))
                      ? addMinutesToDateTime(prev.openDate, nextDuration)
                      : prev.closeDate,
                }))
              }}
              placeholder="45"
              className="w-full bg-transparent font-semibold text-slate-700 outline-none dark:text-white"
            />
          </label>

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

        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-black text-slate-950 dark:text-white">Đăng bài bằng file Word</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                Upload file Word nếu đề đã có sẵn. Khi có file Word, đề thi sẽ được tạo tự động.
              </p>
            </div>

            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-700">
              <Upload className="h-4 w-4" />
              Upload Word
              <input type="file" accept=".doc,.docx" onChange={handleWordUpload} className="hidden" />
            </label>
          </div>

          {form.wordFileName && (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-500/30 dark:bg-violet-500/10 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-violet-700 dark:text-violet-200">Đã chọn file Word</p>
                <p className="mt-1 break-all text-sm font-semibold text-slate-600 dark:text-slate-300">{form.wordFileName}</p>
              </div>

              <button
                type="button"
                onClick={clearWordUpload}
                className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 dark:bg-slate-900 dark:text-white dark:hover:bg-white/10"
              >
                Gỡ file
              </button>
            </div>
          )}
        </div>

        {!form.wordFileName && (
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
                  <option value="code">Code</option>
                </select>
              </div>

              <RichEditor
                label="Câu hỏi"
                value={question.question}
                onChange={(value) => updateQuestion(question.id, { question: value })}
              />

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
        )}

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
  const [currentUserId, setCurrentUserId] = useState(null)
  const [teacherSubject, setTeacherSubject] = useState('Toán')
  const [teacherName, setTeacherName] = useState('GiaoVien')
  const [studentClass, setStudentClass] = useState('')
  const [studentClasses, setStudentClasses] = useState([])
  const [classes, setClasses] = useState([])
  const dark = useSyncedDarkMode()

  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [codeSearch, setCodeSearch] = useState('')
  const [privacyFilter, setPrivacyFilter] = useState('all')
  const [publishFilter, setPublishFilter] = useState('all')
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [roleLoading, setRoleLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [editingExam, setEditingExam] = useState(null)
  const [deleteConfirmExam, setDeleteConfirmExam] = useState(null)

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        setRoleLoading(true)

const user = auth.currentUser

        if (!user) {
          toast.error('Bạn chưa đăng nhập')
          return
        }

        setCurrentUserId(user.uid)

        const userSnap = await getDoc(doc(db, 'users', user.uid))

        if (!userSnap.exists()) {
          toast.error('Không tìm thấy thông tin người dùng')
          return
        }

        const userData = userSnap.data()

        setRole(userData.role)

        const fixedStudentClass = String(getUserClassName(userData) || '').trim()

        if (fixedStudentClass) {
          setStudentClass(fixedStudentClass)
          setStudentClasses([fixedStudentClass])
        }

        setTeacherName(
          userData.displayName ??
            userData.fullName ??
            userData.name ??
            userData.teacherName ??
            user.displayName ??
            user.email?.split('@')[0] ??
            'GiaoVien',
        )
        setTeacherSubject(
          normalizeSubject(
            userData.specialty ??
              userData.specialization ??
              userData.subject ??
              userData.major ??
              userData.chuyenMon ??
              userData.chuyenmon,
          ),
        )
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
    const user = auth.currentUser

    if (!user?.uid || !role) {
      setClasses([])
      return undefined
    }

    if (isStudentRole(role)) {
      const classesQuery = query(collection(db, 'classes'))

      const unsubscribe = onSnapshot(
        classesQuery,
        async (classSnapshot) => {
          try {
            const userSnap = await getDoc(doc(db, 'users', user.uid))
            const userData = userSnap.exists() ? userSnap.data() : {}
            const directClass = String(getUserClassName(userData) || '').trim()
            const identities = getStudentIdentityValues(user, userData)

            const membershipClasses = classSnapshot.docs
              .map((classDoc) => {
                const data = classDoc.data()
                const className = getClassName({ id: classDoc.id, ...data })

                return className && classHasStudent(data, identities) ? String(className).trim() : ''
              })
              .filter(Boolean)

            const uniqueStudentClasses = Array.from(
              new Set([directClass, ...membershipClasses].filter(Boolean)),
            ).sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }))

            setStudentClasses(uniqueStudentClasses)
            setStudentClass((value) =>
              uniqueStudentClasses.includes(value) ? value : uniqueStudentClasses[0] ?? '',
            )
            setClasses([])
          } catch (error) {
            console.error(error)
            setStudentClasses([])
          }
        },
        (error) => {
          console.error(error)
          setStudentClasses([])
        },
      )

      return () => unsubscribe()
    }

    const classesQuery = query(
      collection(db, 'classes'),
      where('teacherId', '==', user.uid),
    )

    const unsubscribe = onSnapshot(
      classesQuery,
      (classSnapshot) => {
        const classData = classSnapshot.docs
          .map((classDoc) => {
            const data = classDoc.data()
            const className = getClassName({ id: classDoc.id, ...data })

            return className ? String(className).trim() : ''
          })
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }))

        const uniqueClasses = Array.from(new Set(classData))

        setClasses(uniqueClasses)

        if (uniqueClasses.length) {
          setStudentClass((value) => (uniqueClasses.includes(value) ? value : uniqueClasses[0]))
        } else {
          setStudentClass('')
        }
      },
      (error) => {
        console.error(error)
        toast.error('Không thể đồng bộ danh sách lớp học')
        setClasses([])
        setStudentClass('')
      },
    )

    return () => unsubscribe()
  }, [role])

  useEffect(() => {
    setLoading(true)

    const examsQuery = query(collection(db, 'exams'), orderBy('createdAt', 'desc'))

    const unsubscribe = onSnapshot(
      examsQuery,
      async (snapshot) => {
        try {
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
                  .filter((item) => isStudentRole(item.role)),
              }
            }),
          )

          setExams(examData)
        } catch (error) {
          console.error(error)
          toast.error('Không thể đồng bộ danh sách bài kiểm tra')
        } finally {
          setLoading(false)
        }
      },
      (error) => {
        console.error(error)
        toast.error('Không thể đồng bộ danh sách bài kiểm tra')
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [])

  const visibleExams = useMemo(() => {
    const now = new Date()

    return exams
      .map((exam) => {
        const opened = !exam.openDate || now.getTime() >= getDateTimeValue(exam.openDate)
        const closed = Boolean(exam.closeDate && now.getTime() > getDateTimeValue(exam.closeDate))
        const isUpcoming = Boolean(exam.openDate && now.getTime() < getDateTimeValue(exam.openDate))
        const isActive = opened && !closed
        const availabilityStatus = isActive ? 'published' : isUpcoming ? 'draft' : 'ended'

        return {
          ...exam,
          status: exam.status || 'public',
          isActive,
          isUpcoming,
          isEnded: closed,
          availabilityStatus,
        }
      })
      .filter((exam) => {
        if (roleLoading) return false

        if (isStudentRole(role)) {
          const isPublicExam = exam.status === 'public'
          const normalizedStudentClasses = studentClasses.map(normalizeClassName)
          const isAssignedPrivateExam =
            exam.status === 'private' &&
            Array.isArray(exam.selectedClasses) &&
            exam.selectedClasses.some((item) => normalizedStudentClasses.includes(normalizeClassName(item)))

          if (!isPublicExam && !isAssignedPrivateExam) return false
        }

        if (privacyFilter !== 'all' && exam.status !== privacyFilter) return false

        if (publishFilter !== 'all' && exam.availabilityStatus !== publishFilter) return false

        const keyword = search.trim().toLowerCase()
        if (!keyword) return true

        return (
          exam.title?.toLowerCase().includes(keyword) ||
          exam.subject?.toLowerCase().includes(keyword) ||
          exam.topic?.toLowerCase().includes(keyword) ||
          exam.code?.toLowerCase().includes(keyword)
        )
      })
  }, [exams, role, studentClass, studentClasses, search, privacyFilter, publishFilter])

  const studentResults = exams.flatMap((exam) => exam.studentResults ?? [])
  const averageScore = studentResults.length
    ? (studentResults.reduce((total, item) => total + Number(item.score || 0), 0) / studentResults.length).toFixed(1)
    : '0.0'

  const saveExam = async (exam) => {
    try {
      const fixedExamSubject = normalizeSubject(exam.subject || teacherSubject)
      const fixedSubjectCode = subjectCodes[fixedExamSubject] ?? fixedExamSubject.slice(0, 2).toUpperCase()

      const examData = {
        title: exam.title,
        subject: fixedExamSubject,
        subjectCode: fixedSubjectCode,
        code: getExamCode(teacherName, fixedExamSubject, exam.codeNumber),
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
        wordFileName: exam.wordFileName ?? '',
        isPublished: (() => {
          const now2 = new Date()
          const opened = !exam.openDate || now2.getTime() >= getDateTimeValue(exam.openDate)
          const closed = exam.closeDate && now2.getTime() > getDateTimeValue(exam.closeDate)
          return opened && !closed
        })(),
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

      const questionSnapshot = await getDocs(collection(db, 'exams', examId, 'questions'))
      await Promise.all(questionSnapshot.docs.map((questionDoc) => deleteDoc(questionDoc.ref)))

      await Promise.all(
        exam.questions.map((question, index) => {
          const questionId = question.id || createId()

          return setDoc(doc(db, 'exams', examId, 'questions', questionId), {
            type: question.type,
            question: question.question,
            code: question.code ?? '',
            answers: question.answers ?? [],
            explanation: question.explanation,
            order: index,
            updatedAt: serverTimestamp(),
          })
        }),
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

  const deleteExam = async (examId) => {
    try {
      const subCollections = ['questions', 'results', 'attempts']

      await Promise.all(
        subCollections.map(async (subCollection) => {
          const subSnapshot = await getDocs(collection(db, 'exams', examId, subCollection))
          const batch = writeBatch(db)

          subSnapshot.docs.forEach((item) => {
            batch.delete(item.ref)
          })

          await batch.commit()
        }),
      )

      await deleteDoc(doc(db, 'exams', examId))

      toast.success('Đã xóa đề thi')
      setDeleteConfirmExam(null)
    } catch (error) {
      console.error(error)
      toast.error('Xóa đề thi thất bại')
    }
  }

  const duplicateExam = async (exam) => {
    try {
      const fixedExamSubject = normalizeSubject(exam.subject || teacherSubject)
      const fixedSubjectCode = subjectCodes[fixedExamSubject] ?? fixedExamSubject.slice(0, 2).toUpperCase()
      const newCodeNumber = String(Date.now()).slice(-4)

      const created = await addDoc(collection(db, 'exams'), {
        title: `${exam.title} - Bản sao`,
        subject: fixedExamSubject,
        subjectCode: fixedSubjectCode,
        code: getExamCode(teacherName, fixedExamSubject, newCodeNumber),
        topic: exam.topic ?? '',
        status: 'private',
        selectedClasses: exam.selectedClasses ?? [],
        attemptMode: exam.attemptMode ?? 'once',
        maxAttempts: Number(exam.maxAttempts || 1),
        duration: Number(exam.duration || 45),
        openDate: exam.openDate ?? '',
        closeDate: exam.closeDate ?? '',
        shuffleQuestions: Boolean(exam.shuffleQuestions),
        shuffleAnswers: Boolean(exam.shuffleAnswers),
        wordFileName: exam.wordFileName ?? '',
        isPublished: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      await Promise.all(
        (exam.questions ?? []).map((question, index) =>
          setDoc(doc(db, 'exams', created.id, 'questions', createId()), {
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

      toast.success('Đã sao chép đề thi lên Firebase')
    } catch (error) {
      console.error(error)
      toast.error('Sao chép đề thi thất bại')
    }
  }

  if (roleLoading) {
    return (
      <div className={dark ? 'dark' : ''}>
        <section className="min-h-screen bg-slate-50 text-slate-950 transition dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="h-20 animate-pulse rounded-2xl bg-white shadow-sm dark:bg-white/5" />
            <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-2xl bg-white shadow-sm dark:bg-white/5" />
              ))}
            </div>
            <div className="mt-7 h-20 animate-pulse rounded-2xl bg-white shadow-sm dark:bg-white/5" />
          </div>
        </section>
      </div>
    )
  }

  const openByCode = () => {
    const exam = visibleExams.find((item) => item.code?.toLowerCase() === codeSearch.trim().toLowerCase())

    if (!exam) {
      toast.error('Không tìm thấy mã bài kiểm tra')
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

  if (isStudentRole(role)) {
    const examSubjects = visibleExams.map((exam) => normalizeSubject(exam.subject)).filter(Boolean)
    const availableSubjects = Array.from(new Set([...teacherSubjects, ...examSubjects]))
    const completedExams = visibleExams.filter((exam) =>
      exam.studentResults?.some((result) => result.studentId === currentUserId),
    )
    const pendingExams = Math.max(0, visibleExams.length - completedExams.length)
    const studentScores = visibleExams
      .flatMap((exam) => exam.studentResults ?? [])
      .filter((result) => result.studentId === currentUserId)
      .map((result) => Number(result.score || 0))
    const studentAverageScore = studentScores.length
      ? Math.round((studentScores.reduce((total, score) => total + score, 0) / studentScores.length) * 10)
      : 0

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
                  <p className="text-sm font-medium text-slate-500">Hệ thống làm bài thi cho học sinh</p>
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
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
                      <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{value}</p>
                    </div>

                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconClass}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
              <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
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
              </div>
            </div>

            {visibleExams.length ? (
              <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {visibleExams.map((exam) => {
                  const studentResult = exam.studentResults?.find((result) => result.studentId === currentUserId)
                  const completed = Boolean(studentResult)
                  const bestScore = studentResult?.score ?? null
                  const questionCount = exam.questions?.length ?? 0
                  const examDate = formatDateTimeText(exam.openDate || exam.closeDate)

                  return (
                    <article
                      key={exam.id}
                      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-white/10 dark:bg-white/5 ${
                        completed ? 'border-t-4 border-t-emerald-500' : 'border-t-4 border-t-blue-500'
                      }`}
                    >
                      <div className="p-5">
                        <h3 className="text-lg font-black text-slate-950 dark:text-white">{exam.title}</h3>

                        <span className="mt-3 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                          {exam.subject}
                        </span>

                        <div className="mt-5 grid gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-2">
                            <UserRound className="h-4 w-4" />
                            {exam.selectedClasses?.join(', ') || studentClass}
                          </span>

                          <span className="inline-flex items-center gap-2">
                            <Clock3 className="h-4 w-4" />
                            {exam.duration} phút
                          </span>

                          <span className="inline-flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            {questionCount} câu hỏi
                          </span>

                          <span className="inline-flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" />
                            {examDate}
                          </span>
                        </div>

                        <div className={`mt-5 rounded-xl p-4 ${completed ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                          {completed ? (
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-bold">Điểm cao nhất</p>
                                <p className="mt-1 text-xs font-semibold">Đã làm bài</p>
                              </div>
                              <p className="text-2xl font-black">{bestScore}</p>
                            </div>
                          ) : (
                            <div className="text-center">
                              <p className="text-sm font-bold">Chưa làm bài</p>
                            </div>
                          )}
                        </div>

                        <Link
                          to={`/exam/${exam.id}`}
                          state={{ role }}
                          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:from-blue-700 hover:to-violet-700"
                        >
                          {completed ? 'Làm lại bài thi' : 'Bắt đầu làm bài'}
                        </Link>
                      </div>
                    </article>
                  )
                })}
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

  if (!roleLoading && !canManageExams(role)) {
    return (
      <div className={dark ? 'dark' : ''}>
        <section className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-950 transition dark:bg-slate-950">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-200">
              <FileText className="h-8 w-8" />
            </div>

            <h1 className="mt-6 text-3xl font-black text-slate-950 dark:text-white">Không có quyền truy cập</h1>

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
                <p className="text-sm font-medium text-slate-500">Hệ thống quản lý đề thi cho giáo viên</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {canManageExams(role) && (
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
              )}
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
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{value}</p>
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
              {visibleExams.map((exam) => {
                const questionCount = exam.questions?.length ?? 0
                const maxScore = 100
                const pointPerQuestion = questionCount ? (maxScore / questionCount).toFixed(1) : '0.0'
                const examDate = exam.openDate || exam.closeDate ? `${formatDateTimeText(exam.openDate)} - ${formatDateTimeText(exam.closeDate)}` : 'Chưa đặt thời gian'
                const isActive = exam.availabilityStatus === 'published'
                const isUpcoming = exam.availabilityStatus === 'draft'

                return (
                  <div
                    key={exam.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 dark:border-white/10 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-black text-slate-950 dark:text-white">{exam.title}</h3>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${
                              isActive ? 'bg-emerald-100 text-emerald-700' : isUpcoming ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {isActive ? 'Hoạt động' : isUpcoming ? 'Sắp mở' : 'Đã kết thúc'}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${
                              exam.status === 'public'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-violet-100 text-violet-700'
                            }`}
                          >
                            {exam.status === 'public' ? <Globe2 className="h-3 w-3" /> : <LockKeyhole className="h-3 w-3" />}
                            {exam.status === 'public' ? 'Công khai' : 'Riêng tư'}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1.5">
                            <FileText className="h-4 w-4" />
                            {exam.subject}
                          </span>

                          <span className="inline-flex items-center gap-1.5">
                            <UserRound className="h-4 w-4" />
                            {exam.selectedClasses?.join(', ') || 'Chưa chọn lớp'}
                          </span>

                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-4 w-4" />
                            {examDate}
                          </span>

                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="h-4 w-4" />
                            {exam.duration} phút
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end lg:self-start">
                        {canManageExams(role) ? (
                          <>
                            <button
                              type="button"
                              onClick={() => copyExamLink(exam)}
                              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10"
                              title="Sao chép link bài thi cho học sinh"
                            >
                              <Copy className="h-5 w-5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => previewExam(exam)}
                              className="rounded-xl p-2 text-emerald-600 transition hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                              title="Xem trước đề thi"
                            >
                              <Eye className="h-5 w-5" />
                            </button>

                            <button
                              onClick={() => {
                                setEditingExam(exam)
                                setCreateOpen(true)
                              }}
                              className="rounded-xl p-2 text-blue-600 transition hover:bg-blue-50 dark:hover:bg-blue-500/10"
                              title="Cập nhật đề thi"
                            >
                              <Edit3 className="h-5 w-5" />
                            </button>

                            <button
                              type="button"
                              className="rounded-xl p-2 text-red-500 transition hover:bg-red-50 dark:hover:bg-red-500/10"
                              title="Xóa đề thi"
                              onClick={() => setDeleteConfirmExam(exam)}
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </>
                        ) : (
                          <Link
                            to={`/exam/${exam.id}`}
                            state={{ role }}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700"
                          >
                            Làm bài
                          </Link>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 pt-4 text-center">
                      <div>
                        <p className="text-2xl font-black text-blue-600">{questionCount}</p>
                        <p className="text-sm font-medium text-slate-500">Câu hỏi</p>
                      </div>

                      <div className="border-x border-slate-200 dark:border-white/10">
                        <p className="text-2xl font-black text-emerald-600">{maxScore}</p>
                        <p className="text-sm font-medium text-slate-500">Điểm tối đa</p>
                      </div>

                      <div>
                        <p className="text-2xl font-black text-violet-600">{pointPerQuestion}</p>
                        <p className="text-sm font-medium text-slate-500">Điểm/câu</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="mt-16 flex flex-col items-center justify-center text-slate-400">
              <BookOpen className="h-16 w-16" />
              <p className="mt-4 text-sm font-semibold">Chưa có đề thi nào</p>
            </div>
          )}
        </main>


        {deleteConfirmExam && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={() => setDeleteConfirmExam(null)}>
            <div
              className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-950"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">Xác nhận xóa</p>
                  <h3 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">Xóa đề thi?</h3>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">
                    Bạn có chắc muốn xóa đề "{deleteConfirmExam.title || 'Chưa có tên'}" khỏi Firebase? Hành động này sẽ xóa cả câu hỏi, kết quả và lượt làm.
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

        <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} exams={exams} />
      </section>
    </div>
  )
}

export default Exams
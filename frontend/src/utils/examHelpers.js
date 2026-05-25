export const teacherSubjects = [
  'Toán',
  'Vật lí',
  'Hóa học',
  'Sinh học',
  'Ngữ văn',
  'Lịch sử',
  'Địa lí',
  'Tiếng Anh',
  'Tin học',
  'GDCD',
  'Công nghệ',
]

export const subjectCodes = {
  Toán: 'TOAN',
  'Vật lí': 'VATLI',
  'Hóa học': 'HOAHOC',
  'Sinh học': 'SINHHOC',
  'Ngữ văn': 'NGUVAN',
  'Lịch sử': 'LICHSU',
  'Địa lí': 'DIALI',
  'Tiếng Anh': 'TIENGANH',
  'Tin học': 'TINHOC',
  GDCD: 'GDCD',
  'Công nghệ': 'CONGNGHE',
}

export const removeVietnameseTones = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')

export const normalizeSubject = (subject = '') => {
  const raw = String(subject || '').trim()

  if (!raw) return 'Toán'

  const lowerRaw = removeVietnameseTones(raw).toLowerCase().replace(/\s+/g, '')

  const found = teacherSubjects.find((item) => {
    const normalizedItem = removeVietnameseTones(item)
      .toLowerCase()
      .replace(/\s+/g, '')

    return normalizedItem === lowerRaw
  })

  return found || raw
}

export const getTeacherNameAbbreviation = (teacherName = '') => {
  const cleanName = removeVietnameseTones(teacherName)
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()

  if (!cleanName) return 'GV'

  return cleanName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export const getExamCode = (teacherName = '', subject = '', codeNumber = '') => {
  const teacherCode = getTeacherNameAbbreviation(teacherName)

  const normalizedSubject = normalizeSubject(subject)
  const subjectCode =
    subjectCodes[normalizedSubject] ||
    removeVietnameseTones(normalizedSubject)
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase() ||
    'MON'

  const cleanCodeNumber = String(codeNumber || '')
    .replace(/\s+/g, '')
    .toUpperCase()

  return `${teacherCode}_${subjectCode}_${cleanCodeNumber || '0001'}`
}

export const getCodeNumberFromExam = (exam = {}, fallback = '0001') => {
  if (exam.codeNumber) return String(exam.codeNumber)

  const code = String(exam.code || '')

  if (!code) return fallback

  const parts = code.split('_')
  const last = parts[parts.length - 1]

  return last || fallback
}

export const createDefaultAnswers = () => [
  {
    id: 'answer_1',
    content: '',
    isCorrect: true,
    trueFalse: '',
  },
  {
    id: 'answer_2',
    content: '',
    isCorrect: false,
    trueFalse: '',
  },
  {
    id: 'answer_3',
    content: '',
    isCorrect: false,
    trueFalse: '',
  },
  {
    id: 'answer_4',
    content: '',
    isCorrect: false,
    trueFalse: '',
  },
]

export const createDefaultQuestion = () => ({
  id: `question_${Date.now()}_${Math.random().toString(16).slice(2)}`,
  type: 'multiple',
  section: 'part1',
  question: '',
  code: '',
  explanation: '',
  correctAnswer: '',
  score: '',
  answers: createDefaultAnswers(),
})

export const addMinutesToDateTime = (dateTimeValue, minutes = 45) => {
  if (!dateTimeValue) return ''

  const date = new Date(dateTimeValue)

  if (Number.isNaN(date.getTime())) return ''

  date.setMinutes(date.getMinutes() + Number(minutes || 45))

  const pad = (value) => String(value).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const getDateTimeValue = (dateTimeValue) => {
  if (!dateTimeValue) return 0

  const date = new Date(dateTimeValue)

  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

export const formatDateTimeText = (dateTimeValue) => {
  if (!dateTimeValue) return 'Chưa đặt thời gian'

  const date = new Date(dateTimeValue)

  if (Number.isNaN(date.getTime())) return 'Chưa đặt thời gian'

  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export const normalizeClassName = (value = '') =>
  removeVietnameseTones(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim()

export const isStudentRole = (role = '') =>
  String(role || '').trim().toUpperCase() === 'STUDENT'

export const canManageExams = (role = '') => {
  const normalizedRole = String(role || '').trim().toUpperCase()

  return normalizedRole === 'TEACHER' || normalizedRole === 'ADMIN_DEV'
}

export const formatDuration = (seconds = 0) => {
  const totalSeconds = Math.max(0, Number(seconds || 0))
  const minutes = Math.floor(totalSeconds / 60)
  const remainSeconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(remainSeconds).padStart(2, '0')}`
}


export const getAnswerDisplayValue = (answer, index = 0) => {
  if (!answer) return ''

  if (typeof answer === 'string') return answer

  return (
    answer.content ||
    answer.text ||
    answer.label ||
    String.fromCharCode(65 + index)
  )
}


export const getStudentDisplayName = (student = {}) => {
  if (!student) return 'Học sinh'

  return (
    student.studentName ||
    student.fullName ||
    student.displayName ||
    student.name ||
    student.email ||
    student.studentEmail ||
    'Học sinh'
  )
}

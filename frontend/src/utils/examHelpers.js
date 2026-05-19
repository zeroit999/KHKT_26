export const labels = ['A', 'B', 'C', 'D']

export const teacherSubjects = [
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

export const subjectCodes = {
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

export const defaultClasses = Array.from(
  { length: 10 },
  (_, index) => `Lớp ${index + 1}`,
)

export const normalizeRole = (value) =>
  String(value || '').trim().toLowerCase()

export const isStudentRole = (value) => {
  const role = normalizeRole(value)
  return role === 'student' || role === 'user'
}

export const isTeacherRole = (value) => {
  const role = normalizeRole(value)

  return (
    role === 'teacher' ||
    role === 'admin user' ||
    role === 'admin_user' ||
    role === 'admin'
  )
}

export const isAdminDevRole = (value) => {
  const role = normalizeRole(value)

  return role === 'admin dev' || role === 'admin_dev'
}

export const canManageExams = (value) =>
  isTeacherRole(value) || isAdminDevRole(value)

export const normalizeSubject = (value) => {
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

  return (
    teacherSubjects.find(
      (subject) =>
        subject.toLowerCase() === lowerValue ||
        lowerValue.includes(subject.toLowerCase()),
    ) ?? rawValue
  )
}

export const getClassName = (item) =>
  item?.name ??
  item?.className ??
  item?.title ??
  item?.label ??
  item?.grade ??
  item?.id ??
  ''

export const getUserClassName = (item) =>
  item?.className ??
  item?.class ??
  item?.lop ??
  item?.grade ??
  item?.studentClass ??
  item?.classId ??
  item?.classNameText ??
  ''

export const normalizeClassName = (value) =>
  String(value || '').trim().toLowerCase()

export const getStudentIdentityValues = (user, userData = {}) =>
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

export const extractStudentItems = (classData = {}) => [
  ...(Array.isArray(classData.students) ? classData.students : []),
  ...(Array.isArray(classData.studentIds) ? classData.studentIds : []),
  ...(Array.isArray(classData.studentUids) ? classData.studentUids : []),
  ...(Array.isArray(classData.members) ? classData.members : []),
  ...(Array.isArray(classData.memberIds) ? classData.memberIds : []),
  ...(Array.isArray(classData.users) ? classData.users : []),
]

export const classHasStudent = (classData, studentIdentities) => {
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

export const toDateTimeInputValue = (value) => {
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

export const getDateTimeValue = (value) => {
  const inputValue = toDateTimeInputValue(value)

  if (!inputValue) return 0

  const date = new Date(inputValue)

  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

export const addMinutesToDateTime = (value, minutes = 45) => {
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

export const formatDateTimeText = (value) => {
  const inputValue = toDateTimeInputValue(value)

  if (!inputValue) return 'Chưa đặt thời gian'

  const [datePart, timePart = '00:00'] = inputValue.split('T')
  const [year, month, day] = datePart.split('-')

  return `${timePart} ${day}/${month}/${year}`
}

export const formatDuration = (totalSeconds = 0) => {
  const safeSeconds = Math.max(0, Number(totalSeconds || 0))

  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export const normalizeCodePart = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/_/g, '-')

export const getTeacherCodeName = (value) => {
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

export const getExamCode = (teacherName, subject, codeNumber) => {
  const fixedSubject = normalizeSubject(subject)

  const subjectCode =
    subjectCodes[fixedSubject] ?? fixedSubject.slice(0, 2).toUpperCase()

  return `${getTeacherCodeName(teacherName)}_${subjectCode}_${normalizeCodePart(codeNumber)}`
}

export const getCodeNumberFromExam = (exam, fallback = '0001') => {
  const code = String(exam?.code || '').trim()

  if (!code) return exam?.codeNumber ?? fallback
  if (code.includes('_')) return code.split('_').pop() || fallback

  const subject = normalizeSubject(exam?.subject)
  const subjectCode = subjectCodes[subject] ?? subject.slice(0, 2).toUpperCase()

  return code.startsWith(subjectCode)
    ? code.slice(subjectCode.length) || fallback
    : code
}

export const createId = () =>
  Date.now().toString() + Math.random().toString(36).slice(2)

export const createDefaultAnswers = () => [
  { id: createId(), content: '', isCorrect: false, trueFalse: '' },
  { id: createId(), content: '', isCorrect: false, trueFalse: '' },
  { id: createId(), content: '', isCorrect: false, trueFalse: '' },
  { id: createId(), content: '', isCorrect: false, trueFalse: '' },
]

export const createDefaultQuestion = () => ({
  id: createId(),
  type: 'multiple',
  question: '',
  code: '',
  explanation: '',
  answers: createDefaultAnswers(),
})

export const getStudentDisplayName = (result = {}) => {
  const name =
    result.studentName ||
    result.studentDisplayName ||
    result.displayName ||
    result.fullName ||
    result.name ||
    result.studentEmail ||
    result.email

  return String(name || '').trim() || 'Tên học sinh'
}

export const getAnswerDisplayValue = (question, result = {}) => {
  const type = question.type ?? 'multiple'

  if (type === 'essay' || type === 'code') {
    const value = result.textAnswers?.[question.id]

    return String(value || '').trim() || 'Chưa trả lời'
  }

  const value = result.answers?.[question.id]

  if (type === 'truefalse') {
    if (!value || typeof value !== 'object') return 'Chưa trả lời'

    return (question.answers ?? [])
      .map((_, index) => `${index + 1}. ${value[index] || 'Chưa chọn'}`)
      .join('; ')
  }

  if (value === undefined || value === null) return 'Chưa trả lời'

  if (typeof value === 'number') {
    return labels[value] ?? String(value + 1)
  }

  return String(value)
}
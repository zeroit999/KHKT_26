import apiClient from '../utils/apiClient'


// =========================================================
// HELPERS
// =========================================================

const normalizeId = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return ''
  }

  return String(value)
}


const unwrap = (response) => (
  response?.data ?? response
)


const cleanParams = (params = {}) => {
  const result = {}

  Object.entries(params).forEach(
    ([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ''
      ) {
        result[key] = value
      }
    },
  )

  return result
}


// =========================================================
// CLASSROOMS
// =========================================================

const listClassrooms = async () => {
  const response = await apiClient.get(
    '/classrooms',
  )

  return unwrap(response)
}


const getClassroom = async (
  classroomId,
) => {
  const response = await apiClient.get(
    `/classrooms/${normalizeId(classroomId)}`,
  )

  return unwrap(response)
}


const createClassroom = async (
  payload,
) => {
  const response = await apiClient.post(
    '/classrooms',
    payload,
  )

  return unwrap(response)
}


const updateClassroom = async (
  classroomId,
  payload,
) => {
  const response = await apiClient.patch(
    `/classrooms/${normalizeId(classroomId)}`,
    payload,
  )

  return unwrap(response)
}


const deleteClassroom = async (
  classroomId,
) => {
  const response = await apiClient.delete(
    `/classrooms/${normalizeId(classroomId)}`,
  )

  return unwrap(response)
}


const joinClassroom = async (
  classCode,
  extra = {},
) => {
  const response = await apiClient.post(
    '/classrooms/join',
    {
      classCode,
      ...extra,
    },
  )

  return unwrap(response)
}


const leaveClassroom = async (
  classroomId,
) => {
  const response = await apiClient.post(
    `/classrooms/${normalizeId(classroomId)}/leave`,
    {},
  )

  return unwrap(response)
}


// =========================================================
// USER RESOLUTION
// =========================================================

const resolveUser = async (
  params = {},
) => {
  const response = await apiClient.get(
    '/classrooms/users/resolve',
    {
      params:
        cleanParams(
          typeof params === 'string'
            ? {
                email: params,
              }
            : params,
        ),
    },
  )

  return unwrap(response)
}


// =========================================================
// MEMBERS
// =========================================================

const listMembers = async (
  classroomId,
) => {
  const response = await apiClient.get(
    `/classrooms/${normalizeId(classroomId)}/members`,
  )

  return unwrap(response)
}


const addMember = async (
  classroomId,
  payload,
) => {
  const response = await apiClient.post(
    `/classrooms/${normalizeId(classroomId)}/members`,
    payload,
  )

  return unwrap(response)
}


const updateMember = async (
  classroomId,
  memberId,
  payload,
) => {
  const response = await apiClient.patch(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/members/${normalizeId(memberId)}`
    ),
    payload,
  )

  return unwrap(response)
}


const deleteMember = async (
  classroomId,
  memberId,
) => {
  const response = await apiClient.delete(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/members/${normalizeId(memberId)}`
    ),
  )

  return unwrap(response)
}


// =========================================================
// ATTENDANCE
// =========================================================

const listAttendance = async (
  classroomId,
  params = {},
) => {
  const response = await apiClient.get(
    `/classrooms/${normalizeId(classroomId)}/attendance`,
    {
      params:
        cleanParams(params),
    },
  )

  return unwrap(response)
}


const getAttendance = async (
  classroomId,
  attendanceDate,
) => {
  const response = await apiClient.get(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/attendance/${encodeURIComponent(attendanceDate)}`
    ),
  )

  return unwrap(response)
}


const saveAttendance = async (
  classroomId,
  attendanceDate,
  payload,
) => {
  const response = await apiClient.patch(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/attendance/${encodeURIComponent(attendanceDate)}`
    ),
    payload,
  )

  return unwrap(response)
}


const getAttendanceHistory = async (
  classroomId,
  attendanceDate,
) => {
  const response = await apiClient.get(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/attendance/${encodeURIComponent(attendanceDate)}`
      + '/history'
    ),
  )

  return unwrap(response)
}


const updateInternAttendance = async (
  classroomId,
  attendanceDate,
  memberId,
  payload,
) => {
  const response = await apiClient.patch(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/attendance/${encodeURIComponent(attendanceDate)}`
      + `/intern/${normalizeId(memberId)}`
    ),
    payload,
  )

  return unwrap(response)
}


const createAttendanceQr = async (
  classroomId,
  attendanceDate,
  payload = {},
) => {
  const response = await apiClient.post(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/attendance/${encodeURIComponent(attendanceDate)}`
      + '/qr'
    ),
    payload,
  )

  return unwrap(response)
}


const getAttendanceQr = async (
  classroomId,
  attendanceDate,
  params = {},
) => {
  const response = await apiClient.get(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/attendance/${encodeURIComponent(attendanceDate)}`
      + '/qr'
    ),
    {
      params:
        cleanParams(params),
    },
  )

  return unwrap(response)
}


const attendanceCheckIn = async (
  classroomId,
  attendanceDate,
  payload,
) => {
  const response = await apiClient.post(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/attendance/${encodeURIComponent(attendanceDate)}`
      + '/check-in'
    ),
    payload,
  )

  return unwrap(response)
}


// =========================================================
// SUBJECTS
// =========================================================

const listSubjects = async (
  classroomId,
) => {
  const response = await apiClient.get(
    `/classrooms/${normalizeId(classroomId)}/subjects`,
  )

  return unwrap(response)
}


const createSubject = async (
  classroomId,
  payload,
) => {
  const response = await apiClient.post(
    `/classrooms/${normalizeId(classroomId)}/subjects`,
    payload,
  )

  return unwrap(response)
}


const updateSubject = async (
  classroomId,
  subjectId,
  payload,
) => {
  const response = await apiClient.patch(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/subjects/${normalizeId(subjectId)}`
    ),
    payload,
  )

  return unwrap(response)
}


const deleteSubject = async (
  classroomId,
  subjectId,
) => {
  const response = await apiClient.delete(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/subjects/${normalizeId(subjectId)}`
    ),
  )

  return unwrap(response)
}


// =========================================================
// SUBJECT TESTS
// =========================================================

const listSubjectTests = async (
  classroomId,
  subjectId,
) => {
  const response = await apiClient.get(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/subjects/${normalizeId(subjectId)}`
      + '/tests'
    ),
  )

  return unwrap(response)
}


const createSubjectTest = async (
  classroomId,
  subjectId,
  payload,
) => {
  const response = await apiClient.post(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/subjects/${normalizeId(subjectId)}`
      + '/tests'
    ),
    payload,
  )

  return unwrap(response)
}


const updateSubjectTest = async (
  classroomId,
  subjectId,
  testId,
  payload,
) => {
  const response = await apiClient.patch(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/subjects/${normalizeId(subjectId)}`
      + `/tests/${normalizeId(testId)}`
    ),
    payload,
  )

  return unwrap(response)
}


const deleteSubjectTest = async (
  classroomId,
  subjectId,
  testId,
) => {
  const response = await apiClient.delete(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/subjects/${normalizeId(subjectId)}`
      + `/tests/${normalizeId(testId)}`
    ),
  )

  return unwrap(response)
}


// =========================================================
// SCORES
// =========================================================

const listScores = async (
  classroomId,
  subjectId,
) => {
  const response = await apiClient.get(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/subjects/${normalizeId(subjectId)}`
      + '/scores'
    ),
  )

  return unwrap(response)
}


const getMemberScore = async (
  classroomId,
  subjectId,
  memberId,
) => {
  const response = await apiClient.get(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/subjects/${normalizeId(subjectId)}`
      + `/scores/${normalizeId(memberId)}`
    ),
  )

  return unwrap(response)
}


const updateMemberScore = async (
  classroomId,
  subjectId,
  memberId,
  payload,
) => {
  const response = await apiClient.patch(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/subjects/${normalizeId(subjectId)}`
      + `/scores/${normalizeId(memberId)}`
    ),
    payload,
  )

  return unwrap(response)
}


// =========================================================
// SCHEDULE
// =========================================================

const listSchedule = async (
  classroomId,
  params = {},
) => {
  const response = await apiClient.get(
    `/classrooms/${normalizeId(classroomId)}/schedule`,
    {
      params:
        cleanParams(params),
    },
  )

  return unwrap(response)
}


const createSchedule = async (
  classroomId,
  payload,
) => {
  const response = await apiClient.post(
    `/classrooms/${normalizeId(classroomId)}/schedule`,
    payload,
  )

  return unwrap(response)
}


const updateSchedule = async (
  classroomId,
  scheduleId,
  payload,
) => {
  const response = await apiClient.patch(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/schedule/${normalizeId(scheduleId)}`
    ),
    payload,
  )

  return unwrap(response)
}


const deleteSchedule = async (
  classroomId,
  scheduleId,
) => {
  const response = await apiClient.delete(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/schedule/${normalizeId(scheduleId)}`
    ),
  )

  return unwrap(response)
}


const getScheduleConfig = async (
  classroomId,
) => {
  const response = await apiClient.get(
    `/classrooms/${normalizeId(classroomId)}/schedule-config`,
  )

  return unwrap(response)
}


const updateScheduleConfig = async (
  classroomId,
  payload,
) => {
  const response = await apiClient.patch(
    `/classrooms/${normalizeId(classroomId)}/schedule-config`,
    payload,
  )

  return unwrap(response)
}


const batchSchedule = async (
  classroomId,
  payload,
) => {
  const response = await apiClient.post(
    `/classrooms/${normalizeId(classroomId)}/schedule/batch`,
    payload,
  )

  return unwrap(response)
}


// =========================================================
// NOTIFICATIONS
// =========================================================

const listNotifications = async (
  classroomId,
  params = {},
) => {
  const response = await apiClient.get(
    `/classrooms/${normalizeId(classroomId)}/notifications`,
    {
      params:
        cleanParams(params),
    },
  )

  return unwrap(response)
}


const createNotification = async (
  classroomId,
  payload,
) => {
  const response = await apiClient.post(
    `/classrooms/${normalizeId(classroomId)}/notifications`,
    payload,
  )

  return unwrap(response)
}


const updateNotification = async (
  classroomId,
  notificationId,
  payload,
) => {
  const response = await apiClient.patch(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/notifications/${normalizeId(notificationId)}`
    ),
    payload,
  )

  return unwrap(response)
}


const deleteNotification = async (
  classroomId,
  notificationId,
) => {
  const response = await apiClient.delete(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/notifications/${normalizeId(notificationId)}`
    ),
  )

  return unwrap(response)
}


const readNotification = async (
  classroomId,
  notificationId,
) => {
  const response = await apiClient.post(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/notifications/${normalizeId(notificationId)}/read`
    ),
    {},
  )

  return unwrap(response)
}


const dismissNotification = async (
  classroomId,
  notificationId,
) => {
  const response = await apiClient.post(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/notifications/${normalizeId(notificationId)}/dismiss`
    ),
    {},
  )

  return unwrap(response)
}


// =========================================================
// MESSAGES
// =========================================================

const listMessages = async (
  classroomId,
  params = {},
) => {
  const response = await apiClient.get(
    `/classrooms/${normalizeId(classroomId)}/messages`,
    {
      params:
        cleanParams(params),
    },
  )

  return unwrap(response)
}


const createMessage = async (
  classroomId,
  payload,
) => {
  const response = await apiClient.post(
    `/classrooms/${normalizeId(classroomId)}/messages`,
    payload,
  )

  return unwrap(response)
}


const updateMessage = async (
  classroomId,
  messageId,
  payload,
) => {
  const response = await apiClient.patch(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/messages/${normalizeId(messageId)}`
    ),
    payload,
  )

  return unwrap(response)
}


const recallMessage = async (
  classroomId,
  messageId,
) => {
  const response = await apiClient.post(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/messages/${normalizeId(messageId)}/recall`
    ),
    {},
  )

  return unwrap(response)
}


const deleteMessage = async (
  classroomId,
  messageId,
) => {
  const response = await apiClient.delete(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/messages/${normalizeId(messageId)}`
    ),
  )

  return unwrap(response)
}


// =========================================================
// ASSIGNMENTS
// =========================================================

const listAssignments = async (
  classroomId,
) => {
  const response = await apiClient.get(
    `/classrooms/${normalizeId(classroomId)}/assignments`,
  )

  return unwrap(response)
}


const getAssignment = async (
  classroomId,
  assignmentId,
) => {
  const response = await apiClient.get(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/assignments/${normalizeId(assignmentId)}`
    ),
  )

  return unwrap(response)
}


const createAssignment = async (
  classroomId,
  payload,
) => {
  const response = await apiClient.post(
    `/classrooms/${normalizeId(classroomId)}/assignments`,
    payload,
  )

  return unwrap(response)
}


const updateAssignment = async (
  classroomId,
  assignmentId,
  payload,
) => {
  const response = await apiClient.patch(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/assignments/${normalizeId(assignmentId)}`
    ),
    payload,
  )

  return unwrap(response)
}


const deleteAssignment = async (
  classroomId,
  assignmentId,
) => {
  const response = await apiClient.delete(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/assignments/${normalizeId(assignmentId)}`
    ),
  )

  return unwrap(response)
}


// =========================================================
// SUBMISSIONS
// =========================================================

const listSubmissions = async (
  classroomId,
  assignmentId,
) => {
  const response = await apiClient.get(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/assignments/${normalizeId(assignmentId)}`
      + '/submissions'
    ),
  )

  return unwrap(response)
}


const submitAssignment = async (
  classroomId,
  assignmentId,
  payload,
) => {
  const response = await apiClient.post(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/assignments/${normalizeId(assignmentId)}`
      + '/submissions'
    ),
    payload,
  )

  return unwrap(response)
}


const updateSubmission = async (
  classroomId,
  assignmentId,
  submissionId,
  payload,
) => {
  const response = await apiClient.patch(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/assignments/${normalizeId(assignmentId)}`
      + `/submissions/${normalizeId(submissionId)}`
    ),
    payload,
  )

  return unwrap(response)
}


const deleteSubmission = async (
  classroomId,
  assignmentId,
  submissionId,
) => {
  const response = await apiClient.delete(
    (
      `/classrooms/${normalizeId(classroomId)}`
      + `/assignments/${normalizeId(assignmentId)}`
      + `/submissions/${normalizeId(submissionId)}`
    ),
  )

  return unwrap(response)
}


// =========================================================
// CLASSROOM R2 STORAGE
// =========================================================

const uploadAsset = async (
  classroomId,
  kind,
  file,
) => {
  if (!file) {
    throw new Error(
      'Không có file để tải lên.',
    )
  }

  const form = new FormData()

  form.append(
    'file',
    file,
    file.name || 'upload.bin',
  )

  form.append(
    'classId',
    normalizeId(classroomId),
  )

  form.append(
    'kind',
    kind,
  )

  const response = await apiClient.post(
    '/storage/classroom/asset',
    form,
    {
      headers: {
        'Content-Type':
          'multipart/form-data',
      },
    },
  )

  return unwrap(response)
}


const deleteAsset = async (
  storagePath,
) => {
  if (!storagePath) {
    return {
      success: true,
    }
  }

  const response = await apiClient.delete(
    '/storage/classroom/asset',
    {
      data: {
        storagePath,
      },
    },
  )

  return unwrap(response)
}


// =========================================================
// CONVENIENCE UPLOAD HELPERS
// =========================================================

const uploadMessageAsset = (
  classroomId,
  file,
) => (
  uploadAsset(
    classroomId,
    'class-message',
    file,
  )
)


const uploadNotificationAsset = (
  classroomId,
  file,
) => (
  uploadAsset(
    classroomId,
    'class-notification',
    file,
  )
)


const uploadAssignmentAsset = (
  classroomId,
  file,
) => (
  uploadAsset(
    classroomId,
    'class-assignment',
    file,
  )
)


const uploadSubmissionAsset = (
  classroomId,
  file,
) => (
  uploadAsset(
    classroomId,
    'class-submission',
    file,
  )
)


const uploadClassLogo = (
  classroomId,
  file,
) => (
  uploadAsset(
    classroomId,
    'class-logo',
    file,
  )
)


const uploadClassCover = (
  classroomId,
  file,
) => (
  uploadAsset(
    classroomId,
    'class-cover',
    file,
  )
)


// =========================================================
// PUBLIC API
// =========================================================

export const classroomApi = {
  // Classroom
  listClassrooms,
  getClassroom,
  createClassroom,
  updateClassroom,
  deleteClassroom,
  joinClassroom,
  leaveClassroom,

  // User
  resolveUser,

  // Members
  listMembers,
  addMember,
  updateMember,
  deleteMember,

  // Attendance
  listAttendance,
  getAttendance,
  saveAttendance,
  getAttendanceHistory,
  updateInternAttendance,
  createAttendanceQr,
  getAttendanceQr,
  attendanceCheckIn,

  // Subjects
  listSubjects,
  createSubject,
  updateSubject,
  deleteSubject,

  // Tests
  listSubjectTests,
  createSubjectTest,
  updateSubjectTest,
  deleteSubjectTest,

  // Scores
  listScores,
  getMemberScore,
  updateMemberScore,

  // Schedule
  listSchedule,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getScheduleConfig,
  updateScheduleConfig,
  batchSchedule,

  // Notifications
  listNotifications,
  createNotification,
  updateNotification,
  deleteNotification,
  readNotification,
  dismissNotification,

  // Messages
  listMessages,
  createMessage,
  updateMessage,
  recallMessage,
  deleteMessage,

  // Assignments
  listAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,

  // Submissions
  listSubmissions,
  submitAssignment,
  updateSubmission,
  deleteSubmission,

  // Storage
  uploadAsset,
  deleteAsset,
  uploadMessageAsset,
  uploadNotificationAsset,
  uploadAssignmentAsset,
  uploadSubmissionAsset,
  uploadClassLogo,
  uploadClassCover,
}

export default classroomApi

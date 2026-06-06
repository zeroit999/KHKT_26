export function normalizeRole(role) {
  return String(role || 'STUDENT').trim().replace(/[\s_-]/g, '').toUpperCase()
}

export function isTeacherLike(role) {
  const normalized = normalizeRole(role)
  return ['TEACHER', 'ADMINDEV', 'ADMIN', 'GIAOVIEN', 'GIÁOVIÊN'].includes(normalized)
}

export function isAdminDev(role) {
  return ['ADMINDEV', 'ADMIN'].includes(normalizeRole(role))
}

export function isStudent(role) {
  return normalizeRole(role) === 'STUDENT'
}

export function formatOpenTime(value) {
  if (!value) return 'Chưa đặt lịch'

  const time = getTimeValue(value)
  if (!time) return String(value)

  return new Date(time).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function getStatusText(status) {
  if (status === 'published') return 'Đã xuất bản'
  if (status === 'draft') return 'Bản nháp'
  if (status === 'pending') return 'Chờ duyệt'
  if (status === 'scheduled') return 'Đã lên lịch'
  return 'Đang cập nhật'
}

export function resolveDisplayRole(role) {
  const normalized = normalizeRole(role)

  if (normalized === 'ADMINDEV' || normalized === 'ADMIN') {
    return 'Admin_dev'
  }

  if (normalized === 'TEACHER' || normalized === 'GIAOVIEN' || normalized === 'GIÁOVIÊN') {
    return 'TEACHER'
  }

  return 'STUDENT'
}

function getTimeValue(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  if (value.seconds) return value.seconds * 1000

  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

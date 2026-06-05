export function normalizeRole(role) {
  return String(role || 'STUDENT').trim().replace(/[\s_-]/g, '').toUpperCase()
}

export function isTeacherLike(role) {
  const normalized = normalizeRole(role)
  return ['TEACHER', 'ADMINDEV', 'ADMIN'].includes(normalized)
}

export function isAdminDev(role) {
  return normalizeRole(role) === 'ADMINDEV'
}

export function isStudent(role) {
  return normalizeRole(role) === 'STUDENT'
}

export function formatOpenTime(value) {
  if (!value) return 'Chưa đặt lịch'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('vi-VN', {
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
  return 'Đang cập nhật'
}

export function resolveDisplayRole(role) {
  const normalized = normalizeRole(role)

  if (
    normalized === 'ADMINDEV' ||
    normalized === 'ADMIN_DEV' ||
    normalized === 'ADMINDEV' ||
    normalized === 'ADMIN'
  ) {
    return 'Admin_dev'
  }

  if (
    normalized === 'TEACHER' ||
    normalized === 'GIAOVIEN' ||
    normalized === 'GIÁOVIÊN'
  ) {
    return 'TEACHER'
  }

  return 'STUDENT'
}

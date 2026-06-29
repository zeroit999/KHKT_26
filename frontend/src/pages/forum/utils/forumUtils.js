import { REACTIONS } from './forumConstants'

// =========================
// GROUP CODE
// 7 ký tự A-Z a-z 0-9
// =========================
export const generateGroupCode = () => {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

  let code = ''

  for (let i = 0; i < 7; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }

  return code
}

export const normalizeGroupCode = (value = '') => {
  return String(value || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 7)
}

// =========================
// INVITE CODE
// 6 ký tự đặc biệt + _ + 4 số
// Sinh 1 lần khi mở popup
// =========================

export const generateInviteCode = () => {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'

  let prefix = ''

  for (let i = 0; i < 6; i += 1) {
    prefix += chars[Math.floor(Math.random() * chars.length)]
  }

  let suffix = ''

  for (let i = 0; i < 4; i += 1) {
    suffix += Math.floor(Math.random() * 10)
  }

  return `${prefix}_${suffix}`
}

export const getReactionSummary = (reactions = {}, reactionCounts = {}) => {
  const counts = { ...(reactionCounts || {}) }

  Object.values(reactions || {}).forEach((value) => {
    if (!value) return
    if (!counts[value]) counts[value] = 0
  })

  const items = REACTIONS
    .map((reaction) => ({ ...reaction, count: Number(counts[reaction.value] || 0) }))
    .filter((reaction) => reaction.count > 0)

  const total = items.reduce((sum, item) => sum + item.count, 0)

  return { items, total }
}

export const getUserReaction = (target = {}, userId = '') => {
  if (!userId) return ''
  const reactions = target.reactions || {}
  if (reactions[userId]) return reactions[userId]
  if ((target.likedBy || []).includes(userId)) return 'love'
  return ''
}

export const buildReactionCounts = (reactions = {}) => {
  const counts = {}
  Object.values(reactions || {}).forEach((value) => {
    if (!value) return
    counts[value] = Number(counts[value] || 0) + 1
  })
  return counts
}

export const isDeletedPostNotification = (type = '') => ['post-deleted', 'admin-delete-post', 'post-deleted-by-admin'].includes(type)

export const getChatMembersText = (item = {}) => {
  const safeItem = item && typeof item === 'object' ? item : {}
  const count = Number(safeItem.membersCount || safeItem.members?.length || safeItem.memberIds?.length || safeItem.students?.length || 0)
  return count > 0 ? `${count} thành viên` : 'Kênh trò chuyện'
}

export const getRoleKey = (role = '') => {
  const raw = String(role || '').trim().toLowerCase()
  const value = raw.replace(/[\s_-]/g, '')
  if (raw.includes('admin_dev') || raw.includes('admin-dev') || value.includes('admindev')) return 'admin_dev'
  if (value.includes('admin')) return 'admin'
  if (value.includes('teacher') || value.includes('giaovien') || value.includes('giáoviên')) return 'teacher'
  return 'student'
}

export const getInitials = (name = '', email = '') => {
  const source = String(name || email || 'User').trim()
  const clean = source.includes('@') ? source.split('@')[0] : source
  const parts = clean.split(/\s+/).filter(Boolean)
  if (!parts.length) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export const timestampToMs = (value) => {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

export const formatRelativeTime = (value) => {
  const ms = timestampToMs(value)
  if (!ms) return 'Vừa xong'
  const diff = Date.now() - ms
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return 'Vừa xong'
  if (diff < hour) return `${Math.floor(diff / minute)} phút trước`
  if (diff < day) return `${Math.floor(diff / hour)} giờ trước`
  if (diff < day * 7) return `${Math.floor(diff / day)} ngày trước`
  return new Date(ms).toLocaleDateString('vi-VN')
}

export const formatEventDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export const normalizeText = (value = '') => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export const getClassDisplayName = (item = {}) => {
  if (!item) return ''
  if (typeof item === 'string') return item
  if (typeof item !== 'object') return ''
  return item.name || item.className || item.title || item.code || item.id || ''
}

export const valueMatchesUser = (value, currentUser, userClass) => {
  if (!value) return false
  if (typeof value === 'string') {
    return (
      value === currentUser?.uid ||
      normalizeText(value) === normalizeText(currentUser?.email) ||
      normalizeText(value) === normalizeText(userClass)
    )
  }

  if (typeof value === 'object') {
    return (
      value.uid === currentUser?.uid ||
      value.id === currentUser?.uid ||
      normalizeText(value.email) === normalizeText(currentUser?.email) ||
      normalizeText(value.className || value.class || value.lop || value.name) === normalizeText(userClass)
    )
  }

  return false
}

export const userBelongsToClass = (item = {}, currentUser, userClass) => {
  const className = getClassDisplayName(item)
  if (userClass && normalizeText(className) === normalizeText(userClass)) return true

  const ownerValues = [
    item.teacherId,
    item.teacherUid,
    item.ownerId,
    item.createdBy,
    item.creatorId,
    item.createdById,
    item.adminId,
    item.userId,
  ]

  if (ownerValues.some((value) => valueMatchesUser(value, currentUser, userClass))) {
    return true
  }

  const ownerObjects = [
    item.teacher,
    item.owner,
    item.creator,
    item.createdByUser,
    item.admin,
  ]

  if (ownerObjects.some((value) => valueMatchesUser(value, currentUser, userClass))) {
    return true
  }

  const ownerEmails = [
    item.teacherEmail,
    item.ownerEmail,
    item.creatorEmail,
    item.createdByEmail,
  ]

  if (
    currentUser?.email &&
    ownerEmails.some((value) => normalizeText(value) === normalizeText(currentUser.email))
  ) {
    return true
  }

  const possibleLists = [
    item.memberIds,
    item.members,
    item.studentIds,
    item.students,
    item.userIds,
    item.joinedUsers,
    item.participants,
    item.teacherIds,
    item.teachers,
    item.teacherEmails,
    item.ownerIds,
    item.adminIds,
    item.admins,
  ]

  return possibleLists.some(
    (list) =>
      Array.isArray(list) &&
      list.some((value) => valueMatchesUser(value, currentUser, userClass)),
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import classroomApi from '../../services/classroomApi.js'
import eLearningApi from '../../services/eLearningApi.js'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { getUserAvatar } from '../../utils/userAvatar.js'
import useExamsPage from '../../hooks/exam/useExamsPage.js'
import {
  formatRelativeDate as formatELearningRelativeDate,
  formatViews as formatELearningViews,
  getCourseFormat as getELearningCourseFormat,
  getCourseFormatLabel as getELearningCourseFormatLabel,
  getVideoDuration as getELearningVideoDuration,
  stripHtml as stripELearningHtml,
} from '../e-learning/e-learning/utils/courseUtils.js'

const NAV_ITEMS = [
  { id: 'home', label: 'Trang chủ', icon: '⌂' },
  { id: 'overview', label: 'Tổng quan', icon: '▦' },
  { id: 'members', label: 'Danh sách lớp', icon: '♟' },
  { id: 'attendance', label: 'Điểm danh', icon: '✓' },
  { id: 'assignments', label: 'Đề thi', icon: '▤' },
  { id: 'resources', label: 'Học liệu', icon: '▱' },
  { id: 'grades', label: 'Đánh giá', icon: '★' },
]

const SECONDARY_NAV_ITEMS = [
  { id: 'schedule', label: 'Lịch học', icon: '▦' },
  { id: 'notifications', label: 'Thông báo', icon: '◇' },
  { id: 'messages', label: 'Trao đổi', icon: '☵' },
]

const STUDENT_WORKSPACE_SECTIONS = [
  {
    id: 'main',
    label: 'NGĂN CHÍNH',
    items: NAV_ITEMS.filter((item) => item.id !== 'home'),
  },
  {
    id: 'secondary',
    label: 'NGĂN PHỤ',
    items: SECONDARY_NAV_ITEMS,
  },
]

const STUDENT_SCHEDULE_DEFAULT_SLOTS = [
  { id: 'morning-1', period: 1, startTime: '07:00', endTime: '07:45' },
  { id: 'morning-2', period: 2, startTime: '07:50', endTime: '08:35' },
  { id: 'morning-3', period: 3, startTime: '08:40', endTime: '09:25' },
  { id: 'morning-4', period: 4, startTime: '09:30', endTime: '10:15' },
  { id: 'afternoon-1', period: 5, startTime: '13:00', endTime: '13:45' },
  { id: 'afternoon-2', period: 6, startTime: '13:50', endTime: '14:35' },
  { id: 'afternoon-3', period: 7, startTime: '14:40', endTime: '15:25' },
  { id: 'afternoon-4', period: 8, startTime: '15:30', endTime: '16:15' },
]

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function getApiRows(payload) {
  if (Array.isArray(payload)) return payload
  const candidates = [
    payload?.items, payload?.rows, payload?.data, payload?.results,
    payload?.classes, payload?.classrooms, payload?.members, payload?.assignments,
    payload?.notifications, payload?.messages, payload?.attendance,
    payload?.schedule, payload?.subjects, payload?.tests, payload?.scores,
    payload?.courses, payload?.users, payload?.submissions,
  ]
  return candidates.find(Array.isArray) || []
}

function getApiItem(payload) {
  if (!payload || typeof payload !== 'object') return payload || null
  return payload.item || payload.data || payload.user || payload.member ||
    payload.classroom || payload.assignment || payload.notification ||
    payload.message || payload.submission || payload
}

function normalizeApiAsset(payload, file) {
  const source = payload?.asset || payload?.file || payload?.data || payload || {}
  return {
    ...source,
    name: source.name || source.fileName || source.filename || file?.name || 'file',
    type: source.type || source.contentType || source.mimeType || file?.type || 'file',
    url: source.url || source.publicUrl || source.downloadUrl || source.href || '',
    storagePath: source.storagePath || source.path || source.key || source.objectKey || '',
  }
}

function resizeChatTextarea(element, maxHeight = 140) {
  if (!element) return
  element.style.height = 'auto'
  const nextHeight = Math.min(element.scrollHeight, maxHeight)
  element.style.height = `${Math.max(40, nextHeight)}px`
  element.style.overflowY = element.scrollHeight > maxHeight ? 'auto' : 'hidden'
}

function getTimeValue(value) {
  if (!value) return 0
  if (typeof value?.toMillis === 'function') return value.toMillis()
  if (typeof value?.seconds === 'number') return value.seconds * 1000
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function toNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function average(values = []) {
  const numbers = values.map(toNumber).filter((value) => value !== null)
  if (!numbers.length) return null
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length
}

function isTeacherMember(member = {}) {
  const role = normalizeText(member.role || member.userRole || member.memberRole || member.accountRole)
  const classRole = normalizeText(member.classRole)
  return classRole === 'intern_teacher' || ['teacher', 'giáo viên', 'giao vien', 'admin_teacher', 'homeroom_teacher'].includes(role)
}

function getMondayStart(date = new Date()) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  const day = value.getDay()
  value.setDate(value.getDate() + (day === 0 ? -6 : 1 - day))
  return value
}

function addDays(date, amount) {
  const value = new Date(date)
  value.setDate(value.getDate() + amount)
  return value
}

function normalizeScheduleTime(value = '') {
  const text = String(value || '').trim()
  const match = text.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return text
  return `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`
}

function getStudentScheduleSlots(classItem = {}, weekKey = '') {
  const exact = classItem?.scheduleWeekConfigs?.[weekKey]
  const rules = classItem?.scheduleTimeRules && typeof classItem.scheduleTimeRules === 'object' ? classItem.scheduleTimeRules : {}
  const ruleKey = Object.keys(rules).filter((key) => key <= weekKey).sort().pop()
  const source = exact?.slots || exact?.scheduleTimeSlots || (ruleKey ? rules[ruleKey]?.slots || rules[ruleKey]?.scheduleTimeSlots : null) || classItem?.scheduleTimeSlots || STUDENT_SCHEDULE_DEFAULT_SLOTS
  return (Array.isArray(source) ? source : STUDENT_SCHEDULE_DEFAULT_SLOTS).map((slot, index) => ({
    id: slot.id || `slot-${index + 1}`,
    period: Number(slot.period) || index + 1,
    startTime: normalizeScheduleTime(slot.startTime || ''),
    endTime: normalizeScheduleTime(slot.endTime || ''),
  })).filter((slot) => slot.startTime && slot.endTime)
}

function getStudentScheduleBreaks(classItem = {}, weekKey = '') {
  const exact = classItem?.scheduleWeekConfigs?.[weekKey]
  const rules = classItem?.scheduleTimeRules && typeof classItem.scheduleTimeRules === 'object' ? classItem.scheduleTimeRules : {}
  const ruleKey = Object.keys(rules).filter((key) => key <= weekKey).sort().pop()
  const source = exact?.breaks || (ruleKey ? rules[ruleKey]?.breaks : null) || classItem?.scheduleBreaks || []
  return (Array.isArray(source) ? source : []).map((item, index) => ({
    id: item.id || `break-${index + 1}`,
    afterPeriod: Number(item.afterPeriod) || 1,
    label: item.label || 'Giờ nghỉ',
    startTime: normalizeScheduleTime(item.startTime || ''),
    endTime: normalizeScheduleTime(item.endTime || ''),
    kind: item.kind || 'break',
  }))
}

function makeNotificationDocId(value = '') {
  return `auto-${String(value).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 140)}`
}

function escapeIcsText(value = '') {
  return String(value || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function toIcsDate(dateKey = '', time = '') {
  const normalizedTime = normalizeScheduleTime(time).replace(':', '')
  return `${String(dateKey).replace(/-/g, '')}T${normalizedTime}00`
}

function concatUint8Arrays(parts) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const merged = new Uint8Array(totalLength)
  let offset = 0
  parts.forEach((part) => { merged.set(part, offset); offset += part.length })
  return merged
}

function buildJpegPdf(pages = []) {
  const encoder = new TextEncoder()
  const objectCount = 2 + pages.length * 3
  const offsets = new Array(objectCount + 1).fill(0)
  const parts = []
  let byteOffset = 0
  const pushBytes = (bytes) => { parts.push(bytes); byteOffset += bytes.length }
  const pushText = (text) => pushBytes(encoder.encode(text))
  const pushObject = (objectNumber, chunks) => {
    offsets[objectNumber] = byteOffset
    pushText(`${objectNumber} 0 obj\n`)
    chunks.forEach((chunk) => { if (typeof chunk === 'string') pushText(chunk); else pushBytes(chunk) })
    pushText('\nendobj\n')
  }
  pushBytes(new Uint8Array([0x25,0x50,0x44,0x46,0x2d,0x31,0x2e,0x34,0x0a,0x25,0xe2,0xe3,0xcf,0xd3,0x0a]))
  pushObject(1, ['<< /Type /Catalog /Pages 2 0 R >>'])
  const pageRefs = pages.map((_, index) => `${3 + index * 3} 0 R`).join(' ')
  pushObject(2, [`<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`])
  pages.forEach((page, index) => {
    const pageObject = 3 + index * 3
    const imageObject = pageObject + 1
    const contentObject = pageObject + 2
    pushObject(pageObject, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>`])
    pushObject(imageObject, [`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`, page.bytes, '\nendstream'])
    const content = encoder.encode('q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ')
    pushObject(contentObject, [`<< /Length ${content.length} >>\nstream\n`, content, '\nendstream'])
  })
  const xrefOffset = byteOffset
  pushText(`xref\n0 ${objectCount + 1}\n`)
  pushText('0000000000 65535 f \n')
  for (let objectNumber = 1; objectNumber <= objectCount; objectNumber += 1) pushText(`${String(offsets[objectNumber]).padStart(10, '0')} 00000 n \n`)
  pushText(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)
  return concatUint8Arrays(parts)
}

function getInitial(name = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return (parts[parts.length - 1] || '?').charAt(0).toUpperCase()
}

function getDisplayName(userDetails, currentUser, studentRecord) {
  return (
    studentRecord?.name ||
    userDetails?.displayName ||
    userDetails?.name ||
    currentUser?.displayName ||
    currentUser?.email?.split('@')?.[0] ||
    'Học sinh'
  )
}

function getAvatar(userDetails, currentUser, studentRecord) {
  return getUserAvatar({
    ...(currentUser || {}),
    ...(userDetails || {}),
    ...(studentRecord || {}),
  })
}

function getDefaultClassCover(index = 0) {
  const covers = [
    'linear-gradient(135deg, rgba(114,166,128,.75), rgba(255,255,255,.2)), url("https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=600&q=80")',
    'linear-gradient(135deg, rgba(37,99,235,.35), rgba(255,255,255,.08)), url("https://images.unsplash.com/photo-1517976487492-5750f3195933?auto=format&fit=crop&w=600&q=80")',
    'linear-gradient(135deg, rgba(245,158,11,.28), rgba(255,255,255,.08)), url("https://images.unsplash.com/photo-1539650116574-8efeb43e2750?auto=format&fit=crop&w=600&q=80")',
    'linear-gradient(135deg, rgba(15,23,42,.35), rgba(255,255,255,.08)), url("https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=600&q=80")',
    'linear-gradient(135deg, rgba(234,179,8,.25), rgba(255,255,255,.12)), url("https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=600&q=80")',
  ]

  return covers[index % covers.length]
}

function getClassCover(classItem) {
  return classItem?.coverPhotoUrl || classItem?.coverUrl || classItem?.coverPhoto || ''
}

function getClassCoverStyle(classItem, index = 0) {
  const cover = getClassCover(classItem)
  if (!cover) return getDefaultClassCover(index)
  const value = String(cover).trim()
  if (value.includes('gradient(') || value.startsWith('url(')) return value
  return `url(${JSON.stringify(value)})`
}

function getClassTheme(classItem) {
  return classItem?.themeColor || '#2563eb'
}

function getAssignmentTitle(item = {}) {
  return item.title || item.name || item.lessonName || 'Bài tập'
}

function getAssignmentDue(item = {}) {
  return getTimeValue(item.dueAt || item.endAt || item.deadline || item.closeAt)
}

function isAssignmentDraft(item = {}) {
  const status = normalizeText(item.status || item.state)
  return ['draft', 'nháp', 'nhap'].includes(status)
}

function isAssignmentClosed(item = {}) {
  const status = normalizeText(item.status || item.state)
  return ['closed', 'đã đóng', 'da dong', 'archived', 'completed'].includes(status) || Boolean(item.closedAt)
}

function formatDateTime(value) {
  const millis = getTimeValue(value)
  if (!millis) return 'Chưa có thời gian'
  return new Date(millis).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatShortDate(value) {
  const millis = getTimeValue(value)
  if (!millis) return '—'
  return new Date(millis).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

function getDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getScheduleDate(item = {}) {
  const direct = item.date || item.sessionDate || item.day
  if (typeof direct === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct
  const millis = getTimeValue(direct || item.startAt)
  return millis ? getDateKey(new Date(millis)) : ''
}

function getScheduleTime(item = {}) {
  if (item.startTime) return String(item.startTime).slice(0, 5)
  const millis = getTimeValue(item.startAt)
  return millis ? new Date(millis).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''
}

function getScheduleEndTime(item = {}) {
  if (item.endTime) return String(item.endTime).slice(0, 5)
  const millis = getTimeValue(item.endAt)
  return millis ? new Date(millis).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''
}

function stripHtml(value = '') {
  return String(value || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function getAttendanceRows(record = {}) {
  if (Array.isArray(record.records)) return record.records
  if (Array.isArray(record.students)) return record.students
  if (Array.isArray(record.attendees)) return record.attendees
  if (record.records && typeof record.records === 'object') {
    return Object.entries(record.records).map(([studentId, value]) => ({
      studentId,
      ...(typeof value === 'string' ? { status: value } : value),
    }))
  }
  return []
}

function normalizeAttendance(value = '') {
  const status = normalizeText(value)
  if (['present', 'có mặt', 'co mat'].includes(status)) return 'present'
  if (['late', 'trễ', 'tre', 'đi muộn', 'di muon'].includes(status)) return 'late'
  if (['excused', 'vắng phép', 'vang phep', 'vắng có phép', 'vang co phep'].includes(status)) return 'excused'
  if (['absent', 'vắng', 'vang', 'unexcused', 'vắng không phép', 'vang khong phep'].includes(status)) return 'absent'
  return ''
}

function attendanceLabel(value = '') {
  const status = normalizeAttendance(value)
  if (status === 'present') return 'Có mặt'
  if (status === 'late') return 'Đi muộn'
  if (status === 'excused') return 'Vắng có phép'
  if (status === 'absent') return 'Vắng không phép'
  return 'Chưa đánh dấu'
}

function EmptyState({ icon = '○', title, description }) {
  return (
    <div className="student-empty-state">
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  )
}

function SkeletonRows({ count = 4 }) {
  return (
    <div className="student-skeleton-list">
      {Array.from({ length: count }, (_, index) => (
        <div className="student-skeleton-row" key={index}><i /><div><b /><span /></div></div>
      ))}
    </div>
  )
}

function getStudentClassExamType(exam = {}) {
  const questions = Array.isArray(exam.questions) ? exam.questions : []
  const hasEssay = questions.some((question) => question.type === 'essay')
  const hasChoice = questions.some((question) => question.type !== 'essay')
  if (hasEssay && hasChoice) return 'Trắc nghiệm + Tự luận'
  if (hasEssay) return 'Tự luận'
  return 'Trắc nghiệm'
}

function getStudentClassExamStatus(exam = {}) {
  if (exam.isActive) return { id: 'active', label: 'Đang mở' }
  if (exam.isUpcoming) return { id: 'upcoming', label: 'Sắp mở' }
  return { id: 'ended', label: 'Đã đóng' }
}

function formatStudentClassExamDate(value) {
  if (!value) return 'Chưa đặt hạn'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa đặt hạn'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function StudentClassExamWorkspace({ selectedClass }) {
  const page = useExamsPage()
  const visibleExams = Array.isArray(page.visibleExams) ? page.visibleExams : []
  const activeCount = visibleExams.filter((exam) => exam.isActive).length
  const upcomingCount = visibleExams.filter((exam) => exam.isUpcoming).length
  const endedCount = visibleExams.filter((exam) => !exam.isActive && !exam.isUpcoming).length
  const resultRows = Array.isArray(page.studentResults) ? page.studentResults : []

  if (page.roleLoading) {
    return (
      <div className="student-class-exam-page">
        <section className="student-class-exam-head"><div><span>Đề thi · đồng bộ module Đề thi</span><h1>Đề thi</h1><p>Đang tải các đề thi được giao cho tài khoản học sinh...</p></div></section>
        <div className="student-class-exam-skeleton">{Array.from({ length: 4 }, (_, index) => <i key={index} />)}</div>
      </div>
    )
  }

  return (
    <div className="student-class-exam-page">
      <section className="student-class-exam-head">
        <div>
          <span>Đề thi · đồng bộ module Đề thi</span>
          <h1>Đề thi</h1>
          <p>Các đề thi mà module Đề thi cho tài khoản của bạn được phép truy cập. Bạn đang mở từ lớp {selectedClass?.name || 'hiện tại'}.</p>
        </div>
        <button type="button" className="student-class-exam-open-page" onClick={() => window.location.assign('/exams')}>Mở trang Đề thi ↗</button>
      </section>

      <section className="student-class-exam-stats">
        <article><span>▤</span><div><strong>{visibleExams.length}</strong><small>Đang hiển thị</small></div></article>
        <article className="active"><span>●</span><div><strong>{activeCount}</strong><small>Đang mở</small></div></article>
        <article className="upcoming"><span>◷</span><div><strong>{upcomingCount}</strong><small>Sắp mở</small></div></article>
        <article className="ended"><span>✓</span><div><strong>{endedCount}</strong><small>Đã đóng</small></div></article>
      </section>

      <section className="student-class-exam-toolbar">
        <div className="student-class-exam-tabs" role="tablist" aria-label="Trạng thái đề thi">
          {[['all','Tất cả'],['published','Đang mở'],['draft','Sắp mở'],['ended','Đã đóng']].map(([value, label]) => (
            <button type="button" key={value} className={page.publishFilter === value ? 'active' : ''} onClick={() => page.setPublishFilter(value)}>{label}</button>
          ))}
        </div>
        <div className="student-class-exam-tools">
          <label className="student-class-exam-search"><span>⌕</span><input value={page.search || ''} onChange={(event) => page.setSearch(event.target.value)} placeholder="Tìm đề thi..." /></label>
          <select value={page.subjectFilter || 'all'} onChange={(event) => page.setSubjectFilter(event.target.value)} aria-label="Lọc môn học">
            <option value="all">Tất cả môn học</option>
            {(page.availableSubjects || []).map((subject) => <option value={subject} key={subject}>{subject}</option>)}
          </select>
          <div className="student-class-exam-code"><input value={page.codeSearch || ''} onChange={(event) => page.setCodeSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') page.openByCode?.() }} placeholder="Mã bài thi" /><button type="button" onClick={() => page.openByCode?.()}>Vào</button></div>
        </div>
      </section>

      {visibleExams.length ? <section className="student-class-exam-list">
        {visibleExams.map((exam) => {
          const status = getStudentClassExamStatus(exam)
          const result = resultRows.find((item) => String(item.examId || '') === String(exam.id || ''))
          const score = result?.score
          return <article className={`student-class-exam-card ${status.id}`} key={exam.id}>
            <div className="student-class-exam-card-icon"><span>▤</span></div>
            <div className="student-class-exam-card-main">
              <div className="student-class-exam-card-title"><div><span>{exam.subject || 'Môn học'}</span><h2>{exam.title || 'Đề thi chưa đặt tên'}</h2></div><em className={status.id}>{status.label}</em></div>
              <div className="student-class-exam-meta"><span>{exam.questionCount || exam.questions?.length || 0} câu hỏi</span><span>•</span><span>{getStudentClassExamType(exam)}</span><span>•</span><span>{exam.duration || 45} phút</span><span>•</span><span>Hạn {formatStudentClassExamDate(exam.closeDate)}</span></div>
              {result ? <div className="student-class-exam-result"><span>✓ Đã nộp</span>{score !== undefined && score !== null && Number.isFinite(Number(score)) ? <strong>{Number(score).toFixed(2)}/10</strong> : null}</div> : null}
            </div>
            <button type="button" className="student-class-exam-enter" onClick={() => page.previewExam?.(exam)} disabled={!exam.isActive}>{exam.isActive ? 'Vào thi' : exam.isUpcoming ? 'Chưa đến giờ' : 'Đã đóng'}</button>
          </article>
        })}
      </section> : <EmptyState icon="▤" title="Chưa có đề thi phù hợp" description="Không có đề thi nào khớp bộ lọc hoặc được module Đề thi phân quyền cho tài khoản hiện tại." />}
    </div>
  )
}

function LearningPage() {
  const { user, userDetails } = useAuth()

  const validPageIds = useMemo(
    () =>
      new Set([
        'home',
        ...NAV_ITEMS.map((item) => item.id),
        ...SECONDARY_NAV_ITEMS.map((item) => item.id),
      ]),
    [],
  )

  const getPageFromUrl = () => {
    if (typeof window === 'undefined') return 'home'
    const requestedPage =
      new URLSearchParams(window.location.search).get('page')

    return requestedPage && validPageIds.has(requestedPage)
      ? requestedPage
      : 'home'
  }

  const getClassIdFromUrl = () => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('classId') || ''
  }

  const initialClassId = getClassIdFromUrl()

  const [currentUser, setCurrentUser] = useState(() => user || null)
  const [activePage, setActivePage] = useState(getPageFromUrl)
  const [classView, setClassView] = useState(
    initialClassId ? 'workspace' : 'list'
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const url = new URL(window.location.href)
    const currentPage = url.searchParams.get('page')

    if (activePage === 'home') {
      if (currentPage !== null) {
        url.searchParams.delete('page')
        window.history.replaceState(
          {},
          '',
          `${url.pathname}${url.search}${url.hash}`,
        )
      }
      return
    }

    if (validPageIds.has(activePage) && currentPage !== activePage) {
      url.searchParams.set('page', activePage)
      window.history.replaceState(
        {},
        '',
        `${url.pathname}${url.search}${url.hash}`,
      )
    }
  }, [activePage, validPageIds])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncPageFromUrl = () => {
      const params = new URLSearchParams(window.location.search)
      const requestedPage = params.get('page')
      const safePage =
        requestedPage && validPageIds.has(requestedPage)
          ? requestedPage
          : 'home'

      setActivePage(safePage)
    }

    window.addEventListener('popstate', syncPageFromUrl)
    return () => window.removeEventListener('popstate', syncPageFromUrl)
  }, [validPageIds])
  const [classes, setClasses] = useState([])
  const [classAssignments, setClassAssignments] = useState({})
  const [selectedClassId, setSelectedClassId] = useState(
    () => initialClassId
  )
  const [students, setStudents] = useState([])
  const [userProfilesByEmail, setUserProfilesByEmail] = useState({})
  const [studentRecord, setStudentRecord] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [messages, setMessages] = useState([])
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [scheduleItems, setScheduleItems] = useState([])
  const [subjects, setSubjects] = useState([])
  const [eLearningCourses, setELearningCourses] = useState([])
  const [eLearningTeacherProfiles, setELearningTeacherProfiles] = useState({})
  const [eLearningResourcesLoading, setELearningResourcesLoading] = useState(false)
  const [eLearningResourcesError, setELearningResourcesError] = useState('')
  const [eLearningResourceSearch, setELearningResourceSearch] = useState('')
  const [eLearningResourceScope, setELearningResourceScope] = useState('class')
  const [eLearningResourceFormat, setELearningResourceFormat] = useState('all')
  const [eLearningResourceSort, setELearningResourceSort] = useState('newest')
  const [subjectScores, setSubjectScores] = useState({})
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [joinOpen, setJoinOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [leaveClassOpen, setLeaveClassOpen] = useState(false)
  const [leavingClass, setLeavingClass] = useState(false)
  const [leaveClassError, setLeaveClassError] = useState('')
  const [searchText, setSearchText] = useState('')
  const [classSearch, setClassSearch] = useState('')
  const [assignmentFilter, setAssignmentFilter] = useState('all')
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('')
  const [submissionText, setSubmissionText] = useState('')
  const [submissionFile, setSubmissionFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState('')
  const [selectedConversationClassId, setSelectedConversationClassId] = useState('')
  const [messageDraft, setMessageDraft] = useState('')
  const [messageFile, setMessageFile] = useState(null)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [messageError, setMessageError] = useState('')
  const [recallTarget, setRecallTarget] = useState(null)
  const [recalling, setRecalling] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sectionOpen, setSectionOpen] = useState({ main: true, secondary: true })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [studentMemberPage, setStudentMemberPage] = useState(0)
  const [teacherMemberPage, setTeacherMemberPage] = useState(0)
  const [scheduleWeekOffset, setScheduleWeekOffset] = useState(0)
  const [notificationClock, setNotificationClock] = useState(() => new Date())
  const [notificationFilter, setNotificationFilter] = useState('all')
  const [notificationActionError, setNotificationActionError] = useState('')
  const [notificationActionBusy, setNotificationActionBusy] = useState('')
  const [notificationDeleteAllOpen, setNotificationDeleteAllOpen] = useState(false)
  const [classCodeCopied, setClassCodeCopied] = useState(false)
  const [scheduleSyncMessage, setScheduleSyncMessage] = useState('')
  const [scheduleGoogleGuideOpen, setScheduleGoogleGuideOpen] = useState(false)
  const [studentProfileTab, setStudentProfileTab] = useState('info')
  const [selfProfileEditing, setSelfProfileEditing] = useState(false)
  const [selfProfileSaving, setSelfProfileSaving] = useState(false)
  const [selfProfileError, setSelfProfileError] = useState('')
  const [selfProfileEditForm, setSelfProfileEditForm] = useState({
    name: '', phone: '', gender: '', birthDate: '',
    parentName: '', parentPhone: '', parentEmail: '', parentRelation: '', medicalNote: '',
  })
  const messageFileRef = useRef(null)
  const messageTextareaRef = useRef(null)
  const membershipRepairUidRef = useRef('')

  useEffect(() => {
    setCurrentUser(user || null)
  }, [user])

  useEffect(() => {
    const timer = window.setInterval(() => setNotificationClock(new Date()), 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const frame = window.requestAnimationFrame(() => resizeChatTextarea(messageTextareaRef.current, 140))
    return () => window.cancelAnimationFrame(frame)
  }, [messageDraft])

  useEffect(() => {
    const uid = String(currentUser?.uid || '').trim()

    if (!uid) {
      setClasses([])
      setLoadingClasses(false)
      return
    }

    const loadClasses = async () => {
      try {
        setLoadingClasses(true)
        setError('')

        const response = await classroomApi.listClassrooms({ mine: 1 })

        const rows = getApiRows(response)
          .filter((item) => String(
            item.teacherId ||
            item.teacher_id ||
            item.ownerId ||
            item.owner_id ||
            ''
          ) !== uid)
          .sort(
            (a, b) =>
              getTimeValue(b.createdAt || b.created_at) -
              getTimeValue(a.createdAt || a.created_at)
          )

        setClasses(rows)

        setSelectedClassId((current) =>
          rows.some((item) => String(item.id) === String(current))
            ? current
            : (rows[0]?.id || '')
        )
      } catch (apiError) {
        console.error('Không thể tải lớp học của học sinh:', apiError)
        setError(
          apiError?.response?.data?.message ||
          apiError?.message ||
          'Không thể tải lớp học.'
        )
      } finally {
        setLoadingClasses(false)
      }
    }

    loadClasses()
  }, [currentUser?.uid])

  useEffect(() => {
    if (!classes.length) {
      setClassAssignments({})
      return undefined
    }

    let cancelled = false
    const loadAssignments = async () => {
      const entries = await Promise.all(classes.map(async (classItem) => {
        try {
          const response = await classroomApi.listAssignments(classItem.id)
          return [classItem.id, getApiRows(response).map((item) => ({
            ...item,
            classId: item.classId || item.class_id || classItem.id,
            className: item.className || item.class_name || classItem.name,
          }))]
        } catch (apiError) {
          console.error(`Không thể tải bài tập lớp ${classItem.id}:`, apiError)
          return [classItem.id, []]
        }
      }))
      if (!cancelled) setClassAssignments(Object.fromEntries(entries))
    }
    loadAssignments()
    return () => { cancelled = true }
  }, [classes])

  useEffect(() => {
    if (!selectedClassId) {
      setStudents([])
      setStudentRecord(null)
      setNotifications([])
      setMessages([])
      setAttendanceRecords([])
      setScheduleItems([])
      setSubjects([])
      setSubjectScores({})
      return undefined
    }

    let cancelled = false
    const loadClassDetail = async () => {
      try {
        setDetailLoading(true)
        setMessageError('')
        const [membersResponse, notificationsResponse, messagesResponse, attendanceResponse, scheduleResponse, subjectsResponse] = await Promise.all([
          classroomApi.listMembers(selectedClassId),
          classroomApi.listNotifications(selectedClassId),
          classroomApi.listMessages(selectedClassId),
          classroomApi.listAttendance(selectedClassId),
          classroomApi.listSchedule(selectedClassId),
          classroomApi.listSubjects(selectedClassId),
        ])
        if (cancelled) return
        setStudents(getApiRows(membersResponse))
        setNotifications(getApiRows(notificationsResponse).sort((a, b) => getTimeValue(b.createdAt || b.created_at) - getTimeValue(a.createdAt || a.created_at)))
        setMessages(getApiRows(messagesResponse).sort((a, b) => getTimeValue(a.createdAt || a.created_at) - getTimeValue(b.createdAt || b.created_at)))
        setAttendanceRecords(getApiRows(attendanceResponse))
        setScheduleItems(getApiRows(scheduleResponse))
        setSubjects(getApiRows(subjectsResponse).sort((a, b) => Number(a.order ?? a.sortOrder ?? a.sort_order ?? 0) - Number(b.order ?? b.sortOrder ?? b.sort_order ?? 0)))
      } catch (apiError) {
        if (cancelled) return
        console.error('Không thể tải chi tiết lớp:', apiError)
        setMessageError(apiError?.response?.data?.message || apiError?.message || 'Không thể tải dữ liệu lớp.')
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }
    loadClassDetail()
    return () => { cancelled = true }
  }, [selectedClassId])

  useEffect(() => {
    if (classView !== 'workspace' || activePage !== 'resources' || !currentUser?.uid || !selectedClassId) {
      setELearningResourcesLoading(false)
      return undefined
    }

    let cancelled = false
    const loadCourses = async () => {
      try {
        setELearningResourcesLoading(true)
        setELearningResourcesError('')
        const response = await eLearningApi.courses()
        if (!cancelled) setELearningCourses(getApiRows(response))
      } catch (apiError) {
        if (cancelled) return
        console.error('Không thể tải học liệu E-learning cho học sinh:', apiError)
        setELearningCourses([])
        setELearningResourcesError(apiError?.response?.data?.message || apiError?.message || 'Không thể tải học liệu E-learning.')
      } finally {
        if (!cancelled) setELearningResourcesLoading(false)
      }
    }
    loadCourses()
    return () => { cancelled = true }
  }, [activePage, classView, currentUser?.uid, selectedClassId])

  useEffect(() => {
    if (classView !== 'workspace' || activePage !== 'resources' || !currentUser?.uid || !eLearningCourses.length) {
      setELearningTeacherProfiles({})
      return undefined
    }
    let cancelled = false
    const loadProfiles = async () => {
      try {
        const response = await eLearningApi.users()
        if (cancelled) return
        const profileMap = {}
        getApiRows(response).forEach((profile) => {
          ;[profile.id, profile.uid, profile.userId, profile.user_id].filter(Boolean).map(String).forEach((id) => {
            profileMap[`id:${id}`] = profile
          })
          const email = normalizeText(profile.email)
          if (email) profileMap[`email:${email}`] = profile
        })
        setELearningTeacherProfiles(profileMap)
      } catch (apiError) {
        console.warn('Không thể đồng bộ avatar người đăng E-learning:', apiError)
        if (!cancelled) setELearningTeacherProfiles({})
      }
    }
    loadProfiles()
    return () => { cancelled = true }
  }, [activePage, classView, currentUser?.uid, eLearningCourses])

  useEffect(() => {
    const selectedTeacherEmail = classes.find((item) => item.id === selectedClassId)?.teacherEmail || ''
    const emails = Array.from(new Set([
      ...students.map((item) => normalizeText(item.email)),
      normalizeText(selectedTeacherEmail),
      normalizeText(currentUser?.email),
    ].filter(Boolean)))
    if (!emails.length) {
      setUserProfilesByEmail({})
      return undefined
    }
    let cancelled = false
    const loadProfiles = async () => {
      try {
        const response = await eLearningApi.users()
        if (cancelled) return
        const wanted = new Set(emails)
        const map = {}
        getApiRows(response).forEach((profile) => {
          const email = normalizeText(profile.email)
          if (email && wanted.has(email)) map[email] = profile
        })
        setUserProfilesByEmail(map)
      } catch (apiError) {
        console.error('Không thể đồng bộ hồ sơ thành viên:', apiError)
        if (!cancelled) setUserProfilesByEmail({})
      }
    }
    loadProfiles()
    return () => { cancelled = true }
  }, [classes, currentUser?.email, selectedClassId, students])

  useEffect(() => {
    if (!currentUser?.uid || !selectedClassId || !students.length) {
      setStudentRecord(null)
      return
    }
    const mergeMember = (item) => {
      const profile = userProfilesByEmail[normalizeText(item.email)] || {}
      return {
        ...profile,
        ...item,
        uid: item.uid || profile.uid || profile.id || '',
        name: item.name || profile.displayName || profile.name || profile.fullName || '',
        role: profile.role || item.role || item.userRole || item.memberRole || '',
        gender: item.gender || item.sex || profile.gender || profile.sex || '',
        photoURL: profile.photoURL || profile.photoUrl || profile.avatarUrl || profile.avatar || item.photoURL || item.photoUrl || item.avatarUrl || item.avatar || '',
      }
    }
    const mergedStudents = students.map(mergeMember)
    const byUid = mergedStudents.find((item) => item.uid === currentUser.uid)
    const byEmail = mergedStudents.find((item) => normalizeText(item.email) === normalizeText(currentUser.email))
    setStudentRecord(byUid || byEmail || null)
  }, [currentUser?.email, currentUser?.uid, selectedClassId, students, userProfilesByEmail])

  useEffect(() => {
    if (!selectedClassId || !subjects.length) {
      setSubjectScores({})
      return undefined
    }
    let cancelled = false
    const loadScores = async () => {
      const entries = await Promise.all(subjects.map(async (subject) => {
        try {
          const [testsResponse, scoresResponse] = await Promise.all([
            classroomApi.listSubjectTests(selectedClassId, subject.id),
            classroomApi.listScores(selectedClassId, subject.id),
          ])
          return [subject.id, { tests: getApiRows(testsResponse), scores: getApiRows(scoresResponse) }]
        } catch (apiError) {
          console.error(`Không thể tải điểm môn ${subject.id}:`, apiError)
          return [subject.id, { tests: [], scores: [] }]
        }
      }))
      if (!cancelled) setSubjectScores(Object.fromEntries(entries))
    }
    loadScores()
    return () => { cancelled = true }
  }, [selectedClassId, subjects])

  useEffect(() => {
    if (typeof document === 'undefined' || classView !== 'workspace') return undefined

    const workspace = document.querySelector('.student-learning-page:not(.student-class-hub)')
    if (!workspace) return undefined

    document.documentElement.classList.add('student-class-workspace-fullscreen')
    document.body.classList.add('student-class-workspace-fullscreen')

    const previousBodyOverflow = document.body.style.overflow
    const previousBodyOverflowX = document.body.style.overflowX
    document.body.style.setProperty('overflow', 'hidden', 'important')
    document.body.style.setProperty('overflow-x', 'hidden', 'important')

    const hiddenFooters = Array.from(document.querySelectorAll('body footer'))
      .filter((element) => !workspace.contains(element))
      .map((element) => ({ element, display: element.style.display }))
    hiddenFooters.forEach(({ element }) => element.style.setProperty('display', 'none', 'important'))

    const mobileHiddenElements = new Map()
    const syncMobileWorkspaceChrome = () => {
      const shouldHide = window.matchMedia('(max-width: 780px)').matches
      const candidates = Array.from(document.querySelectorAll(
        '[class*="chatbot"], [class*="Chatbot"], [class*="ai-button"], [class*="AIButton"], [class*="floating-ai"], [class*="FloatingAI"], [id*="chatbot" i], [id*="zuny-ai" i], [aria-label*="AI" i], [title*="AI" i]'
      )).filter((element) => !workspace.contains(element) && !element.contains(workspace))

      if (shouldHide) {
        candidates.forEach((element) => {
          if (!mobileHiddenElements.has(element)) mobileHiddenElements.set(element, element.style.display)
          element.style.setProperty('display', 'none', 'important')
        })
      } else {
        mobileHiddenElements.forEach((display, element) => {
          if (display) element.style.display = display
          else element.style.removeProperty('display')
        })
        mobileHiddenElements.clear()
      }
    }
    syncMobileWorkspaceChrome()
    window.addEventListener('resize', syncMobileWorkspaceChrome)

    const adjustedAncestors = []
    let ancestor = workspace.parentElement
    while (ancestor && ancestor !== document.body) {
      adjustedAncestors.push({
        element: ancestor,
        margin: ancestor.style.margin,
        padding: ancestor.style.padding,
        maxWidth: ancestor.style.maxWidth,
        width: ancestor.style.width,
      })
      ancestor.style.setProperty('margin', '0', 'important')
      ancestor.style.setProperty('padding', '0', 'important')
      ancestor.style.setProperty('max-width', 'none', 'important')
      ancestor.style.setProperty('width', '100%', 'important')
      ancestor = ancestor.parentElement
    }

    const syncWorkspaceHeight = () => {
      const top = Math.max(0, workspace.getBoundingClientRect().top)
      workspace.style.setProperty('--student-workspace-top', `${top}px`)
    }
    syncWorkspaceHeight()
    window.addEventListener('resize', syncWorkspaceHeight)
    const frame = window.requestAnimationFrame(syncWorkspaceHeight)

    return () => {
      window.removeEventListener('resize', syncWorkspaceHeight)
      window.removeEventListener('resize', syncMobileWorkspaceChrome)
      window.cancelAnimationFrame(frame)
      mobileHiddenElements.forEach((display, element) => {
        if (display) element.style.display = display
        else element.style.removeProperty('display')
      })
      mobileHiddenElements.clear()
      workspace.style.removeProperty('--student-workspace-top')
      document.documentElement.classList.remove('student-class-workspace-fullscreen')
      document.body.classList.remove('student-class-workspace-fullscreen')
      if (previousBodyOverflow) document.body.style.overflow = previousBodyOverflow
      else document.body.style.removeProperty('overflow')
      if (previousBodyOverflowX) document.body.style.overflowX = previousBodyOverflowX
      else document.body.style.removeProperty('overflow-x')
      hiddenFooters.forEach(({ element, display }) => {
        if (display) element.style.display = display
        else element.style.removeProperty('display')
      })
      adjustedAncestors.forEach(({ element, margin, padding, maxWidth, width }) => {
        element.style.margin = margin
        element.style.padding = padding
        element.style.maxWidth = maxWidth
        element.style.width = width
      })
    }
  }, [classView])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const syncMobileSidebar = () => {
      if (window.matchMedia('(max-width: 780px)').matches) {
        setSidebarCollapsed(false)
        setSectionOpen({ main: true, secondary: true })
      }
    }
    syncMobileSidebar()
    window.addEventListener('resize', syncMobileSidebar)
    return () => window.removeEventListener('resize', syncMobileSidebar)
  }, [])

  useEffect(() => {
    setStudentMemberPage(0)
    setTeacherMemberPage(0)
    setScheduleWeekOffset(0)
    setNotificationFilter('all')
    setNotificationActionError('')
    setNotificationDeleteAllOpen(false)
    setSelfProfileEditing(false)
    setSelfProfileError('')
  }, [selectedClassId])

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) || null,
    [classes, selectedClassId]
  )

  const classMembers = useMemo(() => students.map((member) => {
    const profile = userProfilesByEmail[normalizeText(member.email)] || {}
    return {
      ...profile,
      ...member,
      uid: member.uid || profile.uid || profile.id || '',
      name: member.name || profile.displayName || profile.name || profile.fullName || '',
      role: profile.role || member.role || member.userRole || member.memberRole || '',
      classRole: member.classRole || '',
      gender: member.gender || member.sex || profile.gender || profile.sex || '',
      photoURL: profile.photoURL || profile.photoUrl || profile.avatarUrl || profile.avatar || member.photoURL || member.photoUrl || member.avatarUrl || member.avatar || '',
    }
  }), [students, userProfilesByEmail])

  const studentMembers = useMemo(
    () => classMembers.filter((item) => !isTeacherMember(item) && item.uid !== selectedClass?.teacherId && normalizeText(item.email) !== normalizeText(selectedClass?.teacherEmail)),
    [classMembers, selectedClass?.teacherEmail, selectedClass?.teacherId]
  )

  const teacherMembers = useMemo(() => {
    const rows = []
    if (selectedClass?.teacherId || selectedClass?.teacherEmail) {
      const ownerProfile = userProfilesByEmail[normalizeText(selectedClass.teacherEmail)] || {}
      rows.push({
        id: selectedClass.teacherId || `owner-${selectedClassId}`,
        uid: selectedClass.teacherId || ownerProfile.uid || ownerProfile.id || '',
        name: selectedClass.teacherName || ownerProfile.displayName || ownerProfile.name || ownerProfile.fullName || selectedClass.teacherEmail || 'Giáo viên',
        email: selectedClass.teacherEmail || ownerProfile.email || '',
        role: 'TEACHER',
        classRole: 'owner',
        photoURL: ownerProfile.photoURL || ownerProfile.photoUrl || ownerProfile.avatarUrl || ownerProfile.avatar || selectedClass.teacherPhotoURL || selectedClass.teacherAvatar || '',
        owner: true,
      })
    }
    classMembers.filter(isTeacherMember).forEach((teacher) => {
      const duplicate = rows.some((item) => (item.uid && item.uid === teacher.uid) || (item.email && normalizeText(item.email) === normalizeText(teacher.email)))
      if (!duplicate) rows.push(teacher)
    })
    return rows
  }, [classMembers, selectedClass, selectedClassId, userProfilesByEmail])

  const notificationMatchesCurrentStudent = (item = {}) => {
    const recipientUid = item.recipientUid || item.recipientUserId || item.targetUid || ''
    const recipientEmail = normalizeText(item.recipientEmail || item.targetEmail)
    const recipientStudentId = item.recipientStudentId || item.studentRecipientId || ''
    const hasRecipient = Boolean(recipientUid || recipientEmail || recipientStudentId || item.recipientType)
    if (!hasRecipient) return !item.systemGenerated
    if (item.recipientType && !['student', 'user', 'class'].includes(normalizeText(item.recipientType))) return false
    if (normalizeText(item.recipientType) === 'class') return !item.systemGenerated
    return Boolean(
      (recipientUid && recipientUid === currentUser?.uid) ||
      (recipientEmail && recipientEmail === normalizeText(currentUser?.email)) ||
      (recipientStudentId && recipientStudentId === studentRecord?.id)
    )
  }

  const studentNotifications = useMemo(
    () => notifications.filter((item) => {
      if (!notificationMatchesCurrentStudent(item)) return false
      return !Array.isArray(item.dismissedBy) || !item.dismissedBy.includes(currentUser?.uid)
    }),
    [currentUser?.email, currentUser?.uid, notifications, studentRecord?.id]
  )

  const teacherCreatedNotifications = useMemo(
    () => studentNotifications.filter((item) => !item.systemGenerated),
    [studentNotifications]
  )

  const visibleHubClasses = useMemo(() => {
    const keyword = normalizeText(classSearch)
    if (!keyword) return classes
    return classes.filter((item) => [item.name, item.subject, item.grade, item.teacherName, item.teacherEmail, item.school, item.schoolName].some((value) => normalizeText(value).includes(keyword)))
  }, [classSearch, classes])

  const studentName = getDisplayName(userDetails, currentUser, studentRecord)
  const studentAvatar = getAvatar(userDetails, currentUser, studentRecord)

  const allAssignments = useMemo(() => Object.values(classAssignments).flat(), [classAssignments])

  const visibleAssignments = useMemo(() => allAssignments.filter((item) => !isAssignmentDraft(item)), [allAssignments])

  const getSubmission = (assignment) => {
    if (!assignment) return null
    const submissionMap = assignment.submissions || assignment.studentSubmissions || {}
    if (studentRecord?.id && (!assignment.classId || assignment.classId === selectedClassId) && submissionMap?.[studentRecord.id]) return submissionMap[studentRecord.id]
    if (!submissionMap || typeof submissionMap !== 'object') return null
    return Object.values(submissionMap).find((submission) => {
      if (!submission || typeof submission !== 'object') return false
      return submission.uid === currentUser?.uid || normalizeText(submission.email) === normalizeText(currentUser?.email)
    }) || null
  }

  const assignmentRows = useMemo(() => {
    const keyword = normalizeText(searchText)
    const now = Date.now()
    return visibleAssignments
      .filter((item) => {
        const submission = getSubmission(item)
        const due = getAssignmentDue(item)
        const submitted = Boolean(submission?.submittedAt || ['submitted', 'graded', 'đã nộp', 'đã chấm'].includes(normalizeText(submission?.status || submission?.state)))
        const graded = toNumber(submission?.score) !== null || ['graded', 'đã chấm'].includes(normalizeText(submission?.status || submission?.state))
        const overdue = !submitted && due && due < now
        if (assignmentFilter === 'todo' && (submitted || isAssignmentClosed(item))) return false
        if (assignmentFilter === 'submitted' && !submitted) return false
        if (assignmentFilter === 'graded' && !graded) return false
        if (assignmentFilter === 'overdue' && !overdue) return false
        return !keyword || [getAssignmentTitle(item), item.className, item.subjectName, item.subject].some((value) => normalizeText(value).includes(keyword))
      })
      .sort((a, b) => {
        const aDue = getAssignmentDue(a) || Number.MAX_SAFE_INTEGER
        const bDue = getAssignmentDue(b) || Number.MAX_SAFE_INTEGER
        return aDue - bDue
      })
  }, [assignmentFilter, currentUser?.email, currentUser?.uid, searchText, studentRecord?.id, visibleAssignments])

  const pendingAssignments = useMemo(() => visibleAssignments.filter((item) => {
    const submission = getSubmission(item)
    const submitted = Boolean(submission?.submittedAt || ['submitted', 'graded', 'đã nộp', 'đã chấm'].includes(normalizeText(submission?.status || submission?.state)))
    return !submitted && !isAssignmentClosed(item)
  }), [currentUser?.email, currentUser?.uid, studentRecord?.id, visibleAssignments])

  const ownAttendance = useMemo(() => {
    if (!studentRecord?.id && !currentUser?.email) return []
    const studentKeys = new Set([studentRecord?.id, studentRecord?.uid, currentUser?.uid, normalizeText(studentRecord?.email), normalizeText(currentUser?.email)].filter(Boolean))
    return attendanceRecords.map((record) => {
      const rows = getAttendanceRows(record)
      const row = rows.find((item) => studentKeys.has(item.studentId || item.id || item.uid) || studentKeys.has(normalizeText(item.email)))
      const qr = record.qrCheckIns?.[studentRecord?.id]
      const source = row || qr || null
      if (!source) return null
      return {
        id: record.id,
        date: record.date || record.attendanceDate || record.id,
        status: normalizeAttendance(source.status || source.attendanceStatus || source.state),
        note: source.note || source.notes || '',
        updatedAt: record.updatedAt || source.confirmedAt || record.createdAt,
      }
    }).filter(Boolean).sort((a, b) => String(b.date).localeCompare(String(a.date)))
  }, [attendanceRecords, currentUser?.email, currentUser?.uid, studentRecord])

  const attendanceStats = useMemo(() => ownAttendance.reduce((acc, item) => {
    if (item.status === 'present') acc.present += 1
    if (item.status === 'late') acc.late += 1
    if (item.status === 'excused') acc.excused += 1
    if (item.status === 'absent') acc.absent += 1
    acc.total += 1
    return acc
  }, { present: 0, late: 0, excused: 0, absent: 0, total: 0 }), [ownAttendance])

  const attendanceRate = attendanceStats.total
    ? Math.round(((attendanceStats.present + attendanceStats.late) / attendanceStats.total) * 100)
    : null


  const attendanceReminderNotification = useMemo(() => {
    if (!selectedClassId || !currentUser?.uid || !studentRecord?.id) return null
    const now = notificationClock
    const minuteOfDay = now.getHours() * 60 + now.getMinutes()
    const warningStart = 11 * 60 + 30
    const warningEnd = 11 * 60 + 59
    if (minuteOfDay < warningStart || minuteOfDay > warningEnd) return null
    const todayKey = getDateKey(now)
    const checkedToday = ownAttendance.some((item) => String(item.date) === todayKey && Boolean(item.status))
    if (checkedToday) return null
    return {
      id: `attendance-reminder-${selectedClassId}-${studentRecord.id}-${todayKey}`,
      type: 'attendanceReminder',
      severity: 'warning',
      title: 'Bạn chưa điểm danh hôm nay',
      message: 'Sắp đến 11:59 nhưng tài khoản của bạn chưa có trạng thái điểm danh hôm nay.',
      systemGenerated: true,
      automaticLabel: 'Thông báo tự động',
      recipientType: 'student',
      recipientUid: currentUser.uid,
      recipientEmail: normalizeText(currentUser.email),
      recipientStudentId: studentRecord.id,
      createdAt: now.getTime(),
    }
  }, [currentUser?.email, currentUser?.uid, notificationClock, ownAttendance, selectedClassId, studentRecord?.id])


  const studentNotificationRows = useMemo(() => {
    const rows = attendanceReminderNotification ? [attendanceReminderNotification, ...studentNotifications] : studentNotifications
    return [...rows].sort((a, b) => getTimeValue(b.createdAt || b.updatedAt) - getTimeValue(a.createdAt || a.updatedAt))
  }, [attendanceReminderNotification, studentNotifications])

  const unreadStudentNotifications = useMemo(
    () => studentNotificationRows.filter((item) => !Array.isArray(item.readBy) || !item.readBy.includes(currentUser?.uid)),
    [currentUser?.uid, studentNotificationRows]
  )

  const visibleStudentNotifications = useMemo(
    () => notificationFilter === 'unread' ? unreadStudentNotifications : studentNotificationRows,
    [notificationFilter, studentNotificationRows, unreadStudentNotifications]
  )

  const ownGrades = useMemo(() => subjects.map((subject) => {
    const source = subjectScores[subject.id] || {}
    const tests = source.tests || []
    const scoreRow = (source.scores || []).find((item) => {
      const id = item.studentId || item.id
      return id === studentRecord?.id || item.uid === currentUser?.uid || normalizeText(item.email) === normalizeText(currentUser?.email)
    })
    if (!scoreRow) return { subject, average: null, tests: [] }
    const rows = tests.map((test) => ({
      test,
      value: toNumber(scoreRow.scores?.[test.id]),
    })).filter((item) => item.value !== null)
    const directAverage = toNumber(scoreRow.average)
    return { subject, average: directAverage ?? average(rows.map((item) => item.value)), tests: rows }
  }), [currentUser?.email, currentUser?.uid, studentRecord?.id, subjectScores, subjects])

  const overallAverage = useMemo(() => average(ownGrades.map((item) => item.average)), [ownGrades])

  const selectedClassAssignments = useMemo(
    () => (classAssignments[selectedClassId] || []).filter((item) => !isAssignmentDraft(item)),
    [classAssignments, selectedClassId]
  )

  const automaticStudentNotificationCandidates = useMemo(() => {
    if (!selectedClassId || !currentUser?.uid || !studentRecord?.id) return []
    const rows = []
    const push = (sourceKey, type, severity, title, message, extra = {}) => {
      const scopedSourceKey = `${sourceKey}-recipient-${currentUser.uid}`
      rows.push({
        id: makeNotificationDocId(scopedSourceKey), sourceKey: scopedSourceKey, type, severity, title, message, classId: selectedClassId,
        systemGenerated: true, automaticLabel: 'Thông báo tự động', recipientType: 'student', recipientUid: currentUser.uid,
        recipientEmail: normalizeText(currentUser.email), recipientStudentId: studentRecord.id, ...extra,
      })
    }
    if (attendanceStats.absent >= 3) push(`absence-${studentRecord.id}`, 'attendance', 'critical', 'Cảnh báo chuyên cần', `Bạn đã vắng không phép ${attendanceStats.absent} buổi trong lớp ${selectedClass?.name || ''}.`)
    selectedClassAssignments.forEach((assignment) => {
      const submission = getSubmission(assignment)
      const due = getAssignmentDue(assignment)
      const submittedAt = getTimeValue(submission?.submittedAt || submission?.createdAt)
      const lateState = ['late', 'nộp trễ', 'nop tre', 'overdue'].includes(normalizeText(submission?.status || submission?.state))
      if (submission && ((due && submittedAt && submittedAt > due) || lateState)) push(`late-assignment-${assignment.id}-${studentRecord.id}`, 'assignment', 'medium', 'Bài tập nộp trễ', `Bài “${getAssignmentTitle(assignment)}” của bạn được ghi nhận là nộp trễ.`, { assignmentId: assignment.id })
    })
    ownGrades.forEach(({ subject, average: subjectAverage, tests }) => {
      tests.filter(({ value }) => value < 5).forEach(({ test, value }) => push(`low-score-${subject.id}-${studentRecord.id}-${test.id}`, 'score', 'critical', 'Điểm thấp cảnh báo', `Bạn đạt ${value.toFixed(1)} điểm môn ${subject.name || 'Môn học'} ở ${test.name || test.code || 'bài đánh giá'}.`, { subjectId: subject.id }))
      if (subjectAverage !== null && subjectAverage < 5) push(`low-average-${subject.id}-${studentRecord.id}`, 'average', 'critical', 'ĐTB dưới 5', `Điểm trung bình môn ${subject.name || 'Môn học'} của bạn hiện là ${subjectAverage.toFixed(1)}.`, { subjectId: subject.id })
      const latest = tests.slice(-3)
      if (latest.length === 3 && latest[0].value < latest[1].value && latest[1].value < latest[2].value) push(`improvement-${subject.id}-${studentRecord.id}-${latest.map(({ test }) => test.id).join('-')}`, 'reward', 'reward', 'Khen thưởng tiến bộ', `Điểm môn ${subject.name || 'Môn học'} của bạn tăng liên tục: ${latest.map(({ value }) => value.toFixed(1)).join(' → ')}.`, { subjectId: subject.id })
    })
    scheduleItems.filter((item) => item.kind !== 'persistentImportant' && Boolean(item.important || item.isImportant || item.pinned)).forEach((item) => {
      const dateKey = getScheduleDate(item)
      if (!dateKey) return
      const today = new Date(); today.setHours(0,0,0,0)
      const target = new Date(`${dateKey}T00:00:00`)
      const days = Math.ceil((target.getTime() - today.getTime()) / 86400000)
      if (days >= 0 && days <= 2) push(`schedule-important-${item.id}`, 'schedule', 'medium', 'Lịch học quan trọng sắp tới', `${item.title || item.subject || 'Nội dung quan trọng'} diễn ra ${days === 0 ? 'hôm nay' : `sau ${days} ngày`}.`, { scheduleId: item.id })
    })
    scheduleItems.filter((item) => item.kind === 'persistentImportant' && Number(item.expiresAtMillis || 0) >= Date.now()).forEach((item) => {
      const days = Math.ceil((Number(item.expiresAtMillis) - Date.now()) / 86400000)
      if (days <= 7) push(`persistent-important-${item.id}-${days <= 3 ? 3 : days <= 5 ? 5 : 7}`, 'schedulePersistent', 'important', 'Nhắc nội dung quan trọng', `${item.title || 'Nội dung quan trọng'} còn ${Math.max(0, days)} ngày trước khi hết thời gian.`, { scheduleId: item.id })
    })
    return rows
  }, [attendanceStats.absent, currentUser?.email, currentUser?.uid, ownGrades, scheduleItems, selectedClass?.name, selectedClassAssignments, selectedClassId, studentRecord?.id])

  useEffect(() => {
    if (!selectedClassId || !currentUser?.uid || !automaticStudentNotificationCandidates.length) return undefined
    const existing = new Set(notifications.map((item) => item.sourceKey).filter(Boolean))
    const missing = automaticStudentNotificationCandidates.filter((item) => !existing.has(item.sourceKey))
    if (!missing.length) return undefined
    let cancelled = false
    const syncNotifications = async () => {
      for (const item of missing) {
        if (cancelled) return
        try {
          const response = await classroomApi.createNotification(selectedClassId, {
            ...item,
            readBy: [],
            authorId: 'system',
            authorName: 'Hệ thống lớp học',
          })
          const created = getApiItem(response)
          if (!cancelled && created?.id) {
            setNotifications((current) => current.some((row) => String(row.id) === String(created.id)) ? current : [created, ...current])
          }
        } catch (apiError) {
          console.error('Không thể tạo thông báo tự động cho học sinh:', apiError)
        }
      }
    }
    syncNotifications()
    return () => { cancelled = true }
  }, [automaticStudentNotificationCandidates, currentUser?.uid, notifications, selectedClassId])


  const todaySchedule = useMemo(() => {
    const today = getDateKey(new Date())
    return scheduleItems
      .filter((item) => item.kind !== 'persistentImportant' && getScheduleDate(item) === today)
      .sort((a, b) => getScheduleTime(a).localeCompare(getScheduleTime(b)))
  }, [scheduleItems])

  const weekSchedule = useMemo(() => scheduleItems
    .filter((item) => item.kind !== 'persistentImportant')
    .sort((a, b) => `${getScheduleDate(a)} ${getScheduleTime(a)}`.localeCompare(`${getScheduleDate(b)} ${getScheduleTime(b)}`)), [scheduleItems])

  const lessons = useMemo(() => scheduleItems
    .filter((item) => item.kind !== 'persistentImportant' && (item.lessonContent || item.lessonName || item.lesson || item.topic))
    .map((item) => ({
      id: item.id,
      title: item.lessonContent || item.lessonName || item.lesson || item.topic,
      subject: item.title || item.subject || item.subjectName || selectedClass?.subject || 'Môn học',
      date: getScheduleDate(item),
      room: item.room || item.location || '',
      note: item.note || item.description || '',
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date))), [scheduleItems, selectedClass?.subject])

  const resources = useMemo(() => {
    const rows = []
    selectedClassAssignments.forEach((assignment) => {
      const attachments = Array.isArray(assignment.attachments) ? assignment.attachments : []
      attachments.forEach((attachment, index) => rows.push({
        id: `assignment-${assignment.id}-${index}`,
        name: attachment.name || attachment.title || `Tệp đính kèm ${index + 1}`,
        url: attachment.url || attachment.downloadURL || attachment.href || '',
        source: getAssignmentTitle(assignment),
        type: attachment.type || 'file',
      }))
    })
    studentNotifications.forEach((notification) => {
      const attachments = Array.isArray(notification.attachments) ? notification.attachments : []
      attachments.forEach((attachment, index) => rows.push({
        id: `notification-${notification.id}-${index}`,
        name: attachment.name || attachment.title || attachment.url || `Tài liệu ${index + 1}`,
        url: attachment.url || attachment.href || '',
        source: 'Thông báo lớp học',
        type: attachment.type || 'file',
      }))
    })
    return rows
  }, [studentNotifications, selectedClassAssignments])

  const studentELearningResourceCounts = useMemo(() => {
    const className = normalizeText(selectedClass?.name || selectedClass?.className || '')
    const classId = String(selectedClassId || '')
    const gradeMatch = String(selectedClass?.grade || selectedClass?.name || selectedClass?.className || '').match(/(?:^|\D)(10|11|12)(?:\D|$)/)
    const grade = gradeMatch?.[1] || ''
    const isClassCourse = (course) => {
      const visibility = normalizeText(course.visibility || 'public')
      const courseClassId = String(course.classId || '')
      const courseClassName = normalizeText(course.className || course.class || course.lop || '')
      const direct = visibility === 'class' && Boolean((courseClassId && courseClassId === classId) || (!courseClassId && className && courseClassName === className))
      const legacy = visibility === 'private' && className && courseClassName === className && !['10', '11', '12'].includes(courseClassName)
      return direct || legacy
    }
    const isVisibleClassCourse = (course) => {
      const status = normalizeText(course.status || course.moderationStatus || 'approved')
      return isClassCourse(course) && !['rejected', 'deleted'].includes(status)
    }
    const isApprovedCourse = (course) => normalizeText(course.status || course.moderationStatus || 'approved') === 'approved'
    const isGradeCourse = (course) => isApprovedCourse(course) && normalizeText(course.visibility || 'public') === 'private' && Boolean(grade && normalizeText(course.className || course.class || course.lop || '') === grade)
    return {
      class: eLearningCourses.filter(isVisibleClassCourse).length,
      grade: eLearningCourses.filter(isGradeCourse).length,
      public: eLearningCourses.filter((course) => isApprovedCourse(course) && normalizeText(course.visibility || 'public') === 'public').length,
    }
  }, [eLearningCourses, selectedClass, selectedClassId])

  const visibleStudentELearningResources = useMemo(() => {
    const className = normalizeText(selectedClass?.name || selectedClass?.className || '')
    const classId = String(selectedClassId || '')
    const gradeMatch = String(selectedClass?.grade || selectedClass?.name || selectedClass?.className || '').match(/(?:^|\D)(10|11|12)(?:\D|$)/)
    const grade = gradeMatch?.[1] || ''
    const keyword = normalizeText(eLearningResourceSearch)
    const filtered = eLearningCourses.filter((course) => {
      const status = normalizeText(course.status || course.moderationStatus || 'approved')
      const visibility = normalizeText(course.visibility || 'public')
      const courseClassId = String(course.classId || '')
      const courseClassName = normalizeText(course.className || course.class || course.lop || '')
      const isDirectClassPost = visibility === 'class' && Boolean((courseClassId && courseClassId === classId) || (!courseClassId && className && courseClassName === className))
      const isLegacyDirectClassPost = visibility === 'private' && className && courseClassName === className && !['10', '11', '12'].includes(courseClassName)
      const isForClass = isDirectClassPost || isLegacyDirectClassPost
      const isForGrade = visibility === 'private' && Boolean(grade && courseClassName === grade)
      const isPublic = visibility === 'public'

      if (eLearningResourceScope === 'class') {
        if (!isForClass || ['rejected', 'deleted'].includes(status)) return false
      } else {
        if (status !== 'approved') return false
        if (eLearningResourceScope === 'grade' && !isForGrade) return false
        if (eLearningResourceScope === 'public' && !isPublic) return false
      }

      const format = getELearningCourseFormat(course)
      if (eLearningResourceFormat !== 'all' && format !== eLearningResourceFormat) return false
      if (keyword) {
        const haystack = [
          stripELearningHtml(course.title), stripELearningHtml(course.topic), stripELearningHtml(course.description),
          course.category, course.teacherName, course.teacherEmail, course.courseCode, course.className,
        ].map((value) => normalizeText(value)).join(' ')
        if (!haystack.includes(keyword)) return false
      }
      return true
    })
    return [...filtered].sort((a, b) => {
      if (eLearningResourceSort === 'oldest') return getTimeValue(a.createdAt || a.updatedAt) - getTimeValue(b.createdAt || b.updatedAt)
      if (eLearningResourceSort === 'views') return Number(b.views || 0) - Number(a.views || 0) || getTimeValue(b.createdAt || b.updatedAt) - getTimeValue(a.createdAt || a.updatedAt)
      return getTimeValue(b.createdAt || b.updatedAt) - getTimeValue(a.createdAt || a.updatedAt)
    })
  }, [eLearningCourses, eLearningResourceFormat, eLearningResourceScope, eLearningResourceSearch, eLearningResourceSort, selectedClass, selectedClassId])

  const openStudentELearningResource = (course) => {
    if (!course?.id || typeof window === 'undefined') return
    window.location.assign(`/e-learning/${encodeURIComponent(course.id)}`)
  }

  const conversationRows = useMemo(() => classes.map((classItem) => {
    const teacherEmail = normalizeText(classItem.teacherEmail)
    const related = messages.filter((message) => {
      if (message.classId && message.classId !== classItem.id) return false
      if (message.conversationId === `student:${normalizeText(currentUser?.email)}`) return true
      return normalizeText(message.senderEmail) === teacherEmail || normalizeText(message.receiverEmail) === teacherEmail || message.senderId === classItem.teacherId || message.receiverId === classItem.teacherId
    })
    const last = related[related.length - 1] || null
    return { classItem, messages: related, last }
  }).sort((a, b) => getTimeValue(b.last?.createdAt) - getTimeValue(a.last?.createdAt)), [classes, currentUser?.email, messages])

  const selectedConversation = useMemo(() => {
    const id = selectedConversationClassId || selectedClassId || classes[0]?.id || ''
    return conversationRows.find((item) => item.classItem.id === id) || conversationRows[0] || null
  }, [classes, conversationRows, selectedClassId, selectedConversationClassId])

  const selectedAssignment = useMemo(
    () => visibleAssignments.find((item) => item.id === selectedAssignmentId) || null,
    [selectedAssignmentId, visibleAssignments]
  )

  const showToast = (message) => setToast(message)

  const openClass = (classId, page = 'home') => {
    setClassView('workspace')
    setSelectedClassId(classId)
    setSelectedConversationClassId(classId)
    setActivePage(page)
    setMobileMenuOpen(false)

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('classId', String(classId))

      if (page === 'home') {
        url.searchParams.delete('page')
      } else {
        url.searchParams.set('page', page)
      }

      window.history.replaceState(
        {},
        '',
        `${url.pathname}${url.search}${url.hash}`,
      )
    }
  }

  const handleJoinClass = async (event) => {
    event.preventDefault()
    const normalizedCode = joinCode.trim().toUpperCase()
    if (!currentUser?.uid || !normalizedCode || joining) return
    try {
      setJoining(true)
      setJoinError('')
      await classroomApi.joinClassroom(normalizedCode, {
        uid: currentUser.uid,
        email: currentUser.email || '',
        name: currentUser.displayName || userDetails?.displayName || '',
        role: userDetails?.role || 'STUDENT',
        photoURL: getUserAvatar({
        ...(currentUser || {}),
        ...(userDetails || {}),
      }),
        gender: userDetails?.gender || userDetails?.sex || '',
      })
      const response = await classroomApi.listClassrooms({ mine: 1 })
      const rows = getApiRows(response)
        .filter((item) => String(item.teacherId || item.teacher_id || '') !== String(currentUser.uid))
        .sort((a, b) => getTimeValue(b.createdAt || b.created_at) - getTimeValue(a.createdAt || a.created_at))
      setClasses(rows)
      const joinedClass = rows.find((item) => normalizeText(item.classCode || item.class_code || item.code) === normalizeText(normalizedCode))
      if (joinedClass?.id) setSelectedClassId(joinedClass.id)
      setJoinOpen(false)
      setJoinCode('')
      showToast('Tham gia lớp thành công')
    } catch (apiError) {
      console.error('Không thể tham gia lớp:', apiError)
      setJoinError(apiError?.response?.data?.message || apiError?.message || 'Không thể tham gia lớp học.')
    } finally {
      setJoining(false)
    }
  }

  const leaveCurrentClass = async () => {
    if (!selectedClassId || !currentUser?.uid || leavingClass) return
    try {
      setLeavingClass(true)
      setLeaveClassError('')
      await classroomApi.leaveClassroom(selectedClassId)
      const leftClassId = selectedClassId
      setClasses((current) => current.filter((item) => String(item.id) !== String(leftClassId)))
      setLeaveClassOpen(false)
      setProfileMenuOpen(false)
      setMobileMenuOpen(false)
      setSelectedConversationClassId('')
      setSelectedClassId('')
      setActivePage('home')
      setClassView('list')
      showToast('Đã rời khỏi lớp')
    } catch (apiError) {
      console.error('Không thể rời khỏi lớp:', apiError)
      setLeaveClassError(apiError?.response?.data?.message || apiError?.message || 'Không thể rời khỏi lớp. Vui lòng thử lại.')
    } finally {
      setLeavingClass(false)
    }
  }

  const submitAssignment = async () => {
    if (!selectedAssignment || !studentRecord?.id || !currentUser?.uid || submitting) return
    const content = submissionText.trim()
    if (!content && !submissionFile) {
      setSubmissionError('Vui lòng nhập nội dung hoặc chọn tệp bài làm.')
      return
    }
    let uploadedAttachment = null
    try {
      setSubmitting(true)
      setSubmissionError('')
      if (submissionFile) {
        const uploadResponse = await classroomApi.uploadSubmissionAsset(selectedAssignment.classId, submissionFile)
        uploadedAttachment = normalizeApiAsset(uploadResponse, submissionFile)
      }
      const due = getAssignmentDue(selectedAssignment)
      const submittedAtMillis = Date.now()
      await classroomApi.submitAssignment(selectedAssignment.classId, selectedAssignment.id, {
        studentId: studentRecord.id,
        uid: currentUser.uid,
        email: currentUser.email || studentRecord.email || '',
        studentName,
        content,
        attachment: uploadedAttachment,
        attachments: uploadedAttachment ? [uploadedAttachment] : [],
        status: due && submittedAtMillis > due ? 'late' : 'submitted',
        isLate: Boolean(due && submittedAtMillis > due),
        submittedAt: new Date(submittedAtMillis).toISOString(),
        updatedAt: new Date(submittedAtMillis).toISOString(),
      })
      const refreshedResponse = await classroomApi.listAssignments(selectedAssignment.classId)
      const refreshed = getApiRows(refreshedResponse).map((item) => ({
        ...item,
        classId: item.classId || item.class_id || selectedAssignment.classId,
        className: item.className || item.class_name || selectedClass?.name || '',
      }))
      setClassAssignments((current) => ({ ...current, [selectedAssignment.classId]: refreshed }))
      setSubmissionText('')
      setSubmissionFile(null)
      showToast('Nộp bài thành công')
    } catch (apiError) {
      console.error('Không thể nộp bài:', apiError)
      if (uploadedAttachment?.storagePath) {
        try { await classroomApi.deleteAsset(uploadedAttachment.storagePath) }
        catch (cleanupError) { console.warn('Không thể dọn file R2 sau khi nộp bài thất bại:', cleanupError) }
      }
      setSubmissionError(apiError?.response?.data?.message || apiError?.message || 'Không thể nộp bài.')
    } finally {
      setSubmitting(false)
    }
  }

  const sendMessage = async () => {
    const conversation = selectedConversation
    if (!conversation || !currentUser?.uid || sendingMessage) return
    const content = messageDraft.trim()
    if (content.length > 2000) { setMessageError('Tin nhắn tối đa 2000 ký tự.'); return }
    if (!content && !messageFile) return
    const classItem = conversation.classItem
    let uploadedAttachment = null
    try {
      setSendingMessage(true)
      setMessageError('')
      if (messageFile) {
        const uploadResponse = await classroomApi.uploadMessageAsset(classItem.id, messageFile)
        uploadedAttachment = normalizeApiAsset(uploadResponse, messageFile)
      }
      const response = await classroomApi.createMessage(classItem.id, {
        classId: classItem.id,
        conversationId: `student:${normalizeText(currentUser.email)}`,
        senderId: currentUser.uid,
        senderEmail: normalizeText(currentUser.email),
        senderName: studentName,
        senderAvatar: studentAvatar,
        receiverId: classItem.teacherId || '',
        receiverEmail: normalizeText(classItem.teacherEmail),
        receiverName: classItem.teacherName || classItem.teacherEmail || 'Giáo viên',
        receiverType: 'teacher',
        receiverAvatar: classItem.teacherPhotoURL || classItem.teacherAvatar || '',
        content,
        attachment: uploadedAttachment,
        recalled: false,
      })
      const created = getApiItem(response)
      if (created?.id) {
        setMessages((current) => [...current, created])
      } else {
        const refreshed = await classroomApi.listMessages(classItem.id)
        setMessages(getApiRows(refreshed).sort((a, b) => getTimeValue(a.createdAt || a.created_at) - getTimeValue(b.createdAt || b.created_at)))
      }
      setMessageDraft('')
      setMessageFile(null)
      if (messageFileRef.current) messageFileRef.current.value = ''
      showToast('Đã gửi tin nhắn')
    } catch (apiError) {
      console.error('Không thể gửi tin nhắn:', apiError)
      if (uploadedAttachment?.storagePath) {
        try { await classroomApi.deleteAsset(uploadedAttachment.storagePath) }
        catch (cleanupError) { console.warn('Không thể dọn file R2:', cleanupError) }
      }
      setMessageError(apiError?.response?.data?.message || apiError?.message || 'Không thể gửi tin nhắn.')
    } finally {
      setSendingMessage(false)
    }
  }

  const recallMessage = async () => {
    const item = recallTarget
    const ownMessage = item?.senderId === currentUser?.uid || normalizeText(item?.senderEmail) === normalizeText(currentUser?.email)
    if (!item?.id || !currentUser?.uid || !ownMessage || item.recalled || recalling) return
    try {
      setRecalling(true)
      setMessageError('')
      const classroomId = item.classId || item.class_id || selectedConversation?.classItem?.id
      await classroomApi.recallMessage(classroomId, item.id)
      setMessages((current) => current.map((message) => String(message.id) === String(item.id) ? {
        ...message,
        content: '',
        attachment: null,
        recalled: true,
        recalledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } : message))
      setRecallTarget(null)
      showToast('Đã thu hồi tin nhắn')
    } catch (apiError) {
      console.error('Không thể thu hồi tin nhắn:', apiError)
      setMessageError(apiError?.response?.data?.message || apiError?.message || 'Không thể thu hồi tin nhắn.')
    } finally {
      setRecalling(false)
    }
  }

  const copyMessage = async (item) => {
    if (!item?.id) return
    const copyParts = []
    if (item.recalled) {
      copyParts.push('Tin nhắn đã được thu hồi.')
    } else {
      if (String(item.content || '').trim()) copyParts.push(String(item.content).trim())
      if (item.attachment?.url) copyParts.push(String(item.attachment.url))
    }
    const copyText = copyParts.join('\n').trim()
    if (!copyText) {
      showToast('Tin nhắn không có nội dung để sao chép')
      return
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyText)
      } else {
        const fallback = document.createElement('textarea')
        fallback.value = copyText
        fallback.setAttribute('readonly', '')
        fallback.style.position = 'fixed'
        fallback.style.opacity = '0'
        document.body.appendChild(fallback)
        fallback.select()
        document.execCommand('copy')
        fallback.remove()
      }
      setCopiedMessageId(item.id)
      showToast('Đã sao chép tin nhắn')
      window.setTimeout(() => {
        setCopiedMessageId((current) => current === item.id ? '' : current)
      }, 1600)
    } catch (copyError) {
      console.error('Không thể sao chép tin nhắn:', copyError)
      showToast('Không thể sao chép tin nhắn')
    }
  }

  const markStudentNotificationRead = async (item) => {
    if (!selectedClassId || !currentUser?.uid || !item?.id || item.type === 'attendanceReminder') return
    if (Array.isArray(item.readBy) && item.readBy.includes(currentUser.uid)) return
    try {
      setNotificationActionBusy(`read:${item.id}`)
      setNotificationActionError('')
      await classroomApi.readNotification(selectedClassId, item.id)
      setNotifications((current) => current.map((notification) => String(notification.id) === String(item.id) ? {
        ...notification,
        readBy: Array.from(new Set([...(Array.isArray(notification.readBy) ? notification.readBy : []), currentUser.uid])),
      } : notification))
    } catch (apiError) {
      console.error('Không thể đánh dấu thông báo đã đọc:', apiError)
      setNotificationActionError(apiError?.response?.data?.message || apiError?.message || 'Không thể đánh dấu thông báo đã đọc.')
    } finally {
      setNotificationActionBusy('')
    }
  }

  const dismissStudentNotification = async (item) => {
    if (!selectedClassId || !currentUser?.uid || !item?.id || item.type === 'attendanceReminder') return
    try {
      setNotificationActionBusy(`delete:${item.id}`)
      setNotificationActionError('')
      await classroomApi.dismissNotification(selectedClassId, item.id)
      setNotifications((current) => current.filter((notification) => String(notification.id) !== String(item.id)))
      showToast('Đã xóa thông báo khỏi danh sách của bạn')
    } catch (apiError) {
      console.error('Không thể xóa thông báo khỏi danh sách học sinh:', apiError)
      setNotificationActionError(apiError?.response?.data?.message || apiError?.message || 'Không thể xóa thông báo.')
    } finally {
      setNotificationActionBusy('')
    }
  }

  const dismissAllStudentNotifications = async () => {
    if (!selectedClassId || !currentUser?.uid || !studentNotifications.length || notificationActionBusy) return
    try {
      setNotificationActionBusy('delete-all')
      setNotificationActionError('')
      await Promise.all(studentNotifications.map((item) => classroomApi.dismissNotification(selectedClassId, item.id)))
      const ids = new Set(studentNotifications.map((item) => String(item.id)))
      setNotifications((current) => current.filter((item) => !ids.has(String(item.id))))
      setNotificationDeleteAllOpen(false)
      setNotificationFilter('all')
      showToast('Đã xóa tất cả thông báo khỏi danh sách của bạn')
    } catch (apiError) {
      console.error('Không thể xóa tất cả thông báo khỏi danh sách học sinh:', apiError)
      setNotificationActionError(apiError?.response?.data?.message || apiError?.message || 'Không thể xóa tất cả thông báo.')
    } finally {
      setNotificationActionBusy('')
    }
  }

  const formatNotificationStamp = (value) => {
    const millis = getTimeValue(value)
    if (!millis) return 'Chưa có thời gian'
    const date = new Date(millis)
    return `${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`
  }

  const pageTitle = NAV_ITEMS.concat(SECONDARY_NAV_ITEMS).find((item) => item.id === activePage)?.label || 'Trang chủ'

  const renderClassPicker = () => classes.length > 1 ? (
    <select className="student-class-select" value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)}>
      {classes.map((item) => <option value={item.id} key={item.id}>{item.name || 'Lớp học'}</option>)}
    </select>
  ) : null

  const renderOverview = () => {
    const nowMillis = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const todayKey = getDateKey(new Date())
    const greetingHour = new Date().getHours()
    const greeting = greetingHour < 11 ? 'Chào buổi sáng' : greetingHour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
    const notificationCount = studentNotificationRows.length
    const todayAttendance = ownAttendance.find((item) => String(item.date) === todayKey) || null

    const pendingDashboardAssignments = visibleAssignments
      .filter((item) => {
        const submission = getSubmission(item)
        const submitted = Boolean(submission?.submittedAt || ['submitted', 'graded', 'đã nộp', 'đã chấm', 'late'].includes(normalizeText(submission?.status || submission?.state)))
        return !submitted && !isAssignmentClosed(item)
      })
      .sort((a, b) => (getAssignmentDue(a) || Number.MAX_SAFE_INTEGER) - (getAssignmentDue(b) || Number.MAX_SAFE_INTEGER))

    const todoRows = pendingDashboardAssignments.slice(0, 5).map((item) => {
      const due = getAssignmentDue(item)
      const daysLeft = due ? Math.ceil((due - nowMillis) / dayMs) : null
      let status = 'Chưa có hạn'
      let tone = 'neutral'
      if (due && due < nowMillis) { status = 'Quá hạn'; tone = 'danger' }
      else if (due && getDateKey(new Date(due)) === todayKey) { status = 'Hôm nay'; tone = 'warning' }
      else if (daysLeft !== null && daysLeft <= 3) { status = `Còn ${daysLeft} ngày`; tone = 'warning' }
      else if (due) status = `Hạn ${formatShortDate(due)}`
      return { item, due, status, tone }
    })

    const selectedSubmissionSummary = selectedClassAssignments.reduce((acc, item) => {
      const submission = getSubmission(item)
      const submittedAt = getTimeValue(submission?.submittedAt)
      const due = getAssignmentDue(item)
      const submitted = Boolean(submittedAt || ['submitted', 'graded', 'đã nộp', 'đã chấm', 'late'].includes(normalizeText(submission?.status || submission?.state)))
      const late = submitted && Boolean(submission?.isLate || normalizeText(submission?.status || submission?.state) === 'late' || (due && submittedAt && submittedAt > due))
      if (!submitted) acc.pending += 1
      else if (late) acc.late += 1
      else acc.submitted += 1
      return acc
    }, { submitted: 0, pending: 0, late: 0 })
    const assignmentSummaryTotal = selectedSubmissionSummary.submitted + selectedSubmissionSummary.pending + selectedSubmissionSummary.late
    const submittedStop = assignmentSummaryTotal ? (selectedSubmissionSummary.submitted / assignmentSummaryTotal) * 100 : 0
    const pendingStop = assignmentSummaryTotal ? submittedStop + (selectedSubmissionSummary.pending / assignmentSummaryTotal) * 100 : 0

    const progressStart = new Date()
    progressStart.setHours(23, 59, 59, 999)
    progressStart.setDate(progressStart.getDate() - 6)
    const learningProgress = Array.from({ length: 7 }, (_, index) => {
      const end = new Date(progressStart)
      end.setDate(progressStart.getDate() + index)
      const endMillis = end.getTime()
      const available = selectedClassAssignments.filter((item) => {
        const due = getAssignmentDue(item)
        const created = getTimeValue(item.createdAt || item.publishedAt || item.startAt)
        return (due && due <= endMillis) || (!due && created && created <= endMillis)
      })
      if (!available.length) return { label: end.toLocaleDateString('vi-VN', { weekday: 'short' }), value: null }
      const completed = available.filter((item) => {
        const submission = getSubmission(item)
        const submittedAt = getTimeValue(submission?.submittedAt)
        return submittedAt && submittedAt <= endMillis
      }).length
      return { label: end.toLocaleDateString('vi-VN', { weekday: 'short' }), value: Math.round((completed / available.length) * 100) }
    })
    const chartWidth = 520
    const chartHeight = 150
    const chartPaddingX = 24
    const chartPaddingY = 18
    const progressPoints = learningProgress.map((item, index) => {
      if (item.value === null) return null
      const x = chartPaddingX + (index * (chartWidth - chartPaddingX * 2)) / Math.max(1, learningProgress.length - 1)
      const y = chartHeight - chartPaddingY - (Math.max(0, Math.min(100, item.value)) / 100) * (chartHeight - chartPaddingY * 2)
      return { ...item, x, y }
    }).filter(Boolean)
    const progressPath = progressPoints.map((item, index) => `${index ? 'L' : 'M'} ${item.x} ${item.y}`).join(' ')

    const activityRows = [
      ...visibleAssignments.flatMap((item) => {
        const submission = getSubmission(item)
        const time = getTimeValue(submission?.submittedAt)
        return time ? [{ id: `submission-${item.classId}-${item.id}`, time, icon: '⇧', tone: 'blue', title: `Đã nộp “${getAssignmentTitle(item)}”`, subtitle: item.className || 'Lớp học' }] : []
      }),
      ...ownGrades.flatMap(({ subject, tests }) => tests.flatMap(({ test, value }) => {
        const time = getTimeValue(test.gradedAt || test.updatedAt || test.createdAt || test.date)
        return time ? [{ id: `grade-${subject.id}-${test.id}`, time, icon: '★', tone: 'green', title: `Bạn đạt ${value.toFixed(1)} điểm`, subtitle: `${subject.name || 'Môn học'} · ${test.name || test.code || 'Bài đánh giá'}` }] : []
      })),
    ].filter((item) => item.time).sort((a, b) => b.time - a.time).slice(0, 5)

    const recentMessagePeople = conversationRows.reduce((rows, conversation) => {
      if (!conversation.last) return rows
      const personKey = conversation.classItem.teacherId || normalizeText(conversation.classItem.teacherEmail) || conversation.classItem.id
      if (rows.some((item) => item.personKey === personKey)) return rows
      rows.push({ ...conversation, personKey })
      return rows
    }, []).slice(0, 3)

    const attendanceTone = todayAttendance?.status === 'absent' ? 'red' : todayAttendance?.status === 'excused' ? 'purple' : todayAttendance?.status === 'late' ? 'amber' : 'green'

    const getNoticeVisual = (item = {}) => {
      const severity = normalizeText(item.severity)
      if (item.type === 'attendanceReminder' || severity === 'critical' || severity === 'warning') return { icon: '!', label: item.systemGenerated ? 'Tự động · Cảnh báo' : 'Cảnh báo', tone: 'danger' }
      if (severity === 'reward') return { icon: '★', label: 'Khen thưởng', tone: 'reward' }
      if (severity === 'important') return { icon: '◆', label: 'Quan trọng', tone: 'important' }
      return { icon: '◇', label: item.systemGenerated ? 'Thông báo tự động' : 'Giáo viên', tone: 'normal' }
    }


    const quickLinks = [
      ['attendance', '✓', 'Điểm danh'],
      ['grades', '▥', 'Bảng điểm'],
      ['resources', '▱', 'Tài liệu'],
      ['messages', '☵', 'Trao đổi'],
      ['assignments', '⇧', 'Bài tập'],
      ['members', '♟', 'Danh sách lớp'],
      ['schedule', '▦', 'Lịch học'],
      ['notifications', '◇', 'Thông báo'],
    ]

    return (
      <div className="student-overview-dashboard">
        <div className="student-overview-main-column">
          <section className="student-overview-welcome">
            <div>
              <span>{greeting} 👋</span>
              <h1>{studentName}</h1>
              <p>{selectedClass?.name ? `Tổng quan học tập trong ${selectedClass.name}` : 'Tổng quan học tập của bạn'}</p>
              <div className="student-overview-welcome-badges">
                <b>{attendanceRate === null ? 'Chưa có dữ liệu điểm danh' : `Điểm danh ${attendanceRate}%`}</b>
                <b>{overallAverage === null ? 'Chưa có điểm trung bình' : `ĐTB ${overallAverage.toFixed(1)}`}</b>
                <b>{pendingDashboardAssignments.length} bài cần làm</b>
              </div>
            </div>
            <div className="student-overview-welcome-art" aria-hidden="true"><span>▤</span><i>✓</i></div>
          </section>

          <section className="student-overview-stat-grid">
            <article><span className="student-overview-stat-icon blue">↗</span><div><strong>{overallAverage === null ? '—' : overallAverage.toFixed(1)}</strong><b>Điểm trung bình</b><small>{ownGrades.some((item) => item.tests.length) ? `${ownGrades.reduce((sum, item) => sum + item.tests.length, 0)} bài kiểm tra có điểm` : 'Chưa có bài kiểm tra có điểm'}</small></div></article>
            <article><span className="student-overview-stat-icon amber">▤</span><div><strong>{pendingDashboardAssignments.length}</strong><b>Bài tập chưa nộp</b><small>{pendingDashboardAssignments.some((item) => getAssignmentDue(item) && getAssignmentDue(item) < nowMillis) ? 'Có bài đã quá hạn' : 'Theo dữ liệu bài tập hiện tại'}</small></div></article>
            <article className={`attendance ${todayAttendance?.status || 'unknown'}`}><span className={`student-overview-stat-icon ${attendanceTone}`}>♙</span><div><strong>{todayAttendance ? attendanceLabel(todayAttendance.status) : 'Chưa có'}</strong><b>Điểm danh hôm nay</b><small>{todayAttendance?.note || (attendanceRate === null ? 'Chưa có dữ liệu chuyên cần' : `Tỷ lệ chuyên cần ${attendanceRate}%`)}</small></div></article>
            <article><span className="student-overview-stat-icon purple">♢</span><div><strong>{notificationCount}</strong><b>Thông báo lớp</b><small>{studentNotificationRows.length ? `${studentNotificationRows.length} thông báo dành cho bạn` : 'Chưa có thông báo'}</small></div></article>
          </section>

          <section className="student-overview-card student-overview-todo-card student-overview-todo-wide">
            <header><div><h2>Việc cần làm</h2><p>{pendingDashboardAssignments.length} bài chưa hoàn thành</p></div><button type="button" onClick={() => setActivePage('assignments')}>Xem tất cả →</button></header>
            {todoRows.length ? <div className="student-overview-todo-list">{todoRows.map(({ item, status, tone }) => <button type="button" key={`${item.classId}-${item.id}`} onClick={() => { setSelectedClassId(item.classId); setSelectedAssignmentId(item.id); setActivePage('assignment-detail') }}><span className={`student-overview-alert ${tone}`}>△</span><div><strong>{getAssignmentTitle(item)}</strong><small>{item.className || item.subjectName || item.subject || 'Bài tập'}</small></div><em className={tone}>{status}</em></button>)}</div> : <EmptyState icon="✓" title="Không có bài cần làm" description="Bạn đã hoàn thành các bài đang mở hoặc lớp chưa giao bài." />}
          </section>

          <section className="student-overview-two-column charts">
            <article className="student-overview-card student-overview-progress-card">
              <header><div><h2>Tiến độ học tập</h2><p>7 ngày gần nhất · tính từ bài tập của lớp đang mở</p></div></header>
              {progressPoints.length ? <div className="student-overview-line-chart"><svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Tiến độ hoàn thành bài tập 7 ngày gần nhất">{[0, 25, 50, 75, 100].map((tick) => { const y = chartHeight - chartPaddingY - (tick / 100) * (chartHeight - chartPaddingY * 2); return <g key={tick}><line x1={chartPaddingX} y1={y} x2={chartWidth - chartPaddingX} y2={y} /><text x="2" y={y + 3}>{tick}</text></g> })}<path d={progressPath} />{progressPoints.map((point) => <circle key={`${point.label}-${point.x}`} cx={point.x} cy={point.y} r="4"><title>{point.label}: {point.value}%</title></circle>)}</svg><div>{learningProgress.map((item, index) => <span key={`${item.label}-${index}`}>{item.label}</span>)}</div></div> : <EmptyState icon="⌁" title="Chưa có dữ liệu tiến độ" description="Biểu đồ sẽ xuất hiện khi bài tập có thời gian và bài nộp tương ứng." />}
            </article>

            <article className="student-overview-card student-overview-submission-card">
              <header><div><h2>Bài tập gần đây</h2><p>{selectedClass?.name || 'Lớp đang mở'}</p></div></header>
              {assignmentSummaryTotal ? <div className="student-overview-submission-body"><div className="student-overview-donut" style={{ background: `conic-gradient(#10b981 0 ${submittedStop}%, #f59e0b ${submittedStop}% ${pendingStop}%, #ef4444 ${pendingStop}% 100%)` }}><span><b>{assignmentSummaryTotal}</b><small>tổng</small></span></div><div className="student-overview-donut-legend"><span><i className="green" />Đã nộp <b>{selectedSubmissionSummary.submitted}</b></span><span><i className="amber" />Chưa nộp <b>{selectedSubmissionSummary.pending}</b></span><span><i className="red" />Nộp muộn <b>{selectedSubmissionSummary.late}</b></span></div></div> : <EmptyState icon="▤" title="Chưa có bài tập" description="Thống kê nộp bài sẽ xuất hiện khi lớp có bài tập." />}
            </article>
          </section>

          <section className="student-overview-card student-overview-activity-card">
            <header><div><h2>Hoạt động gần đây</h2><p>Bài nộp, thông báo và trao đổi có thời gian trong hệ thống</p></div></header>
            {activityRows.length ? <div className="student-overview-activity-list">{activityRows.map((item) => <article key={item.id}><span className={item.tone}>{item.icon}</span><div><strong>{item.title}</strong><small>{item.subtitle}</small></div><time>{formatDateTime(item.time)}</time></article>)}</div> : <EmptyState icon="◌" title="Chưa có hoạt động gần đây" description="Bài nộp và kết quả học tập có dấu thời gian sẽ xuất hiện tại đây." />}
          </section>

          <section className="student-overview-card student-overview-quick-card">
            <header><div><h2>Truy cập nhanh</h2><p>Mở nhanh các chức năng đang có trong lớp học</p></div></header>
            <div className="student-overview-quick-grid">{quickLinks.map(([id, icon, label]) => <button type="button" key={id} onClick={() => setActivePage(id)}><span>{icon}</span><small>{label}</small></button>)}</div>
          </section>
        </div>

        <aside className="student-overview-side-column">
          <section className="student-overview-card student-overview-schedule-card">
            <header><div><h2>Lịch hôm nay</h2><p>{selectedClass?.name || 'Lớp đang mở'}</p></div><button type="button" onClick={() => setActivePage('schedule')}>Chi tiết →</button></header>
            {todaySchedule.length ? <div className="student-overview-schedule-list">{todaySchedule.map((item) => <article key={item.id}><time><b>{getScheduleTime(item) || '—'}</b><small>{getScheduleEndTime(item) || '—'}</small></time><div><strong>{item.title || item.subject || selectedClass?.subject || 'Nội dung học'}</strong><small>{item.lessonContent || item.lessonName || item.room || item.location || 'Chưa có nội dung chi tiết'}</small></div></article>)}</div> : <EmptyState icon="▦" title="Hôm nay chưa có lịch" description="Lịch giáo viên đã lưu sẽ xuất hiện tại đây." />}
          </section>

          <section className="student-overview-card student-overview-notice-card">
            <header><div><h2>Thông báo mới</h2><p>{notificationCount ? `${notificationCount} cập nhật` : 'Chưa có cập nhật'}</p></div><button type="button" onClick={() => setActivePage('notifications')}>Xem tất cả →</button></header>
            {studentNotificationRows.length ? <div className="student-overview-notice-list">{studentNotificationRows.slice(0, 5).map((item) => { const visual = getNoticeVisual(item); return <button type="button" key={item.id} className={`notice-${visual.tone}`} onClick={() => setActivePage('notifications')}><span>{visual.icon}</span><div><strong>{item.title || 'Thông báo lớp học'}</strong><em>{visual.label}</em><p>{stripHtml(item.contentHtml || item.content || item.message || '') || 'Thông báo không có nội dung văn bản.'}</p><small>{formatDateTime(item.createdAt)}</small></div></button> })}</div> : <EmptyState icon="◇" title="Chưa có thông báo" description="Thông báo dành cho tài khoản của bạn sẽ xuất hiện tại đây." />}
          </section>

          <section className="student-overview-card student-overview-message-card">
            <header><div><h2>Tin nhắn</h2><p>Trao đổi trong lớp đang mở</p></div><button type="button" onClick={() => setActivePage('messages')}>Xem tất cả →</button></header>
            {recentMessagePeople.length ? <div className="student-overview-message-list">{recentMessagePeople.map((row) => <button type="button" key={row.personKey} onClick={() => { setSelectedConversationClassId(row.classItem.id); setSelectedClassId(row.classItem.id); setActivePage('messages') }}><span className="student-avatar small">{row.classItem.teacherPhotoURL ? <img src={row.classItem.teacherPhotoURL} alt="" referrerPolicy="no-referrer" /> : getInitial(row.classItem.teacherName || row.classItem.teacherEmail || 'G')}</span><div><strong>{row.classItem.teacherName || row.classItem.teacherEmail || 'Giáo viên'}</strong><p>{row.last?.recalled ? 'Tin nhắn đã được thu hồi' : row.last?.content || (row.last?.attachment ? `Tệp: ${row.last.attachment.name || 'Đính kèm'}` : 'Tin nhắn')}</p><small>{formatDateTime(row.last?.createdAt)}</small></div></button>)}</div> : <EmptyState icon="☵" title="Chưa có tin nhắn" description="Ba người trao đổi gần nhất sẽ xuất hiện tại đây." />}
          </section>
        </aside>
      </div>
    )
  }

  const copyClassCode = async () => {
    const code = selectedClass?.classCode || ''
    if (!code || classCodeCopied) return
    try {
      await navigator.clipboard.writeText(code)
      setClassCodeCopied(true)
      window.setTimeout(() => setClassCodeCopied(false), 1700)
    } catch (copyError) {
      console.error('Không thể sao chép mã lớp:', copyError)
      showToast('Không thể sao chép mã lớp')
    }
  }

  const renderHome = () => {
    const classPendingAssignments = selectedClassAssignments
      .filter((item) => {
        const submission = getSubmission(item)
        const submitted = Boolean(submission?.submittedAt || ['submitted', 'graded', 'đã nộp', 'đã chấm'].includes(normalizeText(submission?.status || submission?.state)))
        return !submitted && !isAssignmentClosed(item)
      })
      .sort((a, b) => (getAssignmentDue(a) || Number.MAX_SAFE_INTEGER) - (getAssignmentDue(b) || Number.MAX_SAFE_INTEGER))
    const classCoverStyle = getClassCoverStyle(selectedClass)
    const classTheme = getClassTheme(selectedClass)
    const classHeroStyle = classCoverStyle
      ? { backgroundImage: classCoverStyle, borderColor: classTheme }
      : { background: `linear-gradient(135deg,${classTheme},#0f172a)`, borderColor: classTheme }
    return (
      <div className="student-class-home" style={{ '--student-accent': classTheme }}>
        <section className="student-class-home-hero" style={classHeroStyle}>
          <div className="student-class-home-overlay"><div><span>LỚP HỌC</span><h1>{selectedClass?.name || 'Lớp học'}</h1><p>{selectedClass?.school || selectedClass?.schoolName || 'Chưa cập nhật trường'}{selectedClass?.grade ? ` · Khối ${selectedClass.grade}` : ''}</p></div></div>
        </section>
        <section className="student-home-reference-grid">
          <div className="student-home-left-stack">
            <article className="student-home-ref-card student-class-code-card" style={{ borderColor: classTheme }}><span>MÃ LỚP</span><div className="student-class-code-row"><strong>{selectedClass?.classCode || 'Chưa có mã lớp'}</strong><button type="button" className={classCodeCopied ? 'copied' : ''} onClick={copyClassCode} disabled={!selectedClass?.classCode} title="Sao chép mã lớp"><span>{classCodeCopied ? '✓' : '⧉'}</span><b>{classCodeCopied ? 'Đã sao chép' : 'Sao chép'}</b></button></div><p>Mã lớp do giáo viên cung cấp để tham gia lớp.</p></article>
            <article className="student-home-ref-card" style={{ borderColor: classTheme }}><span>SẮP ĐẾN HẠN ĐÓNG</span><strong>{classPendingAssignments.length} bài học</strong>{classPendingAssignments.length ? <div className="student-home-deadline-list">{classPendingAssignments.slice(0, 4).map((item) => <button type="button" key={item.id} onClick={() => { setSelectedAssignmentId(item.id); setActivePage('assignment-detail') }}><b>{getAssignmentTitle(item)}</b><small>{getAssignmentDue(item) ? `Hạn ${formatDateTime(getAssignmentDue(item))}` : 'Chưa có hạn nộp'}</small></button>)}</div> : <p>Chưa có bài học sắp tới hạn đóng.</p>}</article>
          </div>
          <article className="student-home-notification-panel" style={{ borderColor: classTheme }}><div className="student-home-panel-head"><span>THÔNG BÁO MỚI</span><button type="button" onClick={() => setActivePage('notifications')}>Xem tất cả</button></div>{teacherCreatedNotifications.length ? <div className="student-home-notification-list">{teacherCreatedNotifications.slice(0, 6).map((item) => <article key={item.id}><div><strong>{item.title || 'Thông báo lớp học'}</strong><small>{item.authorName || selectedClass?.teacherName || 'Giáo viên'} · {formatDateTime(item.createdAt)}</small></div><p>{stripHtml(item.contentHtml || item.content || item.message || '') || 'Thông báo không có nội dung văn bản.'}</p></article>)}</div> : <EmptyState icon="◇" title="Chưa có thông báo" description="Thông báo mới từ giáo viên sẽ xuất hiện tại đây." />}</article>
        </section>
      </div>
    )
  }

  const renderMembers = () => {
    const PAGE_SIZE = 12
    const studentPageCount = Math.max(1, Math.ceil(studentMembers.length / PAGE_SIZE))
    const teacherPageCount = Math.max(1, Math.ceil(teacherMembers.length / PAGE_SIZE))
    const safeStudentPage = Math.min(studentMemberPage, studentPageCount - 1)
    const safeTeacherPage = Math.min(teacherMemberPage, teacherPageCount - 1)
    const visibleStudents = studentMembers.slice(safeStudentPage * PAGE_SIZE, safeStudentPage * PAGE_SIZE + PAGE_SIZE)
    const visibleTeachers = teacherMembers.slice(safeTeacherPage * PAGE_SIZE, safeTeacherPage * PAGE_SIZE + PAGE_SIZE)
    const Pagination = ({ page, pageCount, onChange }) => pageCount > 1 ? <div className="student-member-pagination"><button type="button" disabled={page <= 0} onClick={() => onChange(page - 1)}>←</button><span>Trang {page + 1}/{pageCount}</span><button type="button" disabled={page >= pageCount - 1} onClick={() => onChange(page + 1)}>→</button></div> : null
    return (
      <div>
        <div className="student-page-heading"><div><h1>Danh sách lớp</h1><p>{studentMembers.length} học sinh · {teacherMembers.length} giáo viên trong {selectedClass?.name || 'lớp học'}.</p></div></div>
        <section className="student-member-section">
          <div className="student-member-section-head"><div><h2>Giáo viên</h2><p>Hiển thị đầy đủ giáo viên có trong lớp.</p></div><b>{teacherMembers.length}</b></div>
          {visibleTeachers.length ? <div className="student-members-grid">{visibleTeachers.map((member) => <article key={member.id}><span className="student-avatar">{getAvatar({}, null, member) ? <img src={getAvatar({}, null, member)} alt="" referrerPolicy="no-referrer" /> : getInitial(member.name || member.displayName || member.email || 'G')}</span><div><strong>{member.name || member.displayName || member.email?.split('@')?.[0] || 'Giáo viên'}</strong><small>{member.owner ? 'Giáo viên chủ lớp' : normalizeText(member.classRole) === 'intern_teacher' ? 'Giáo viên thực tập' : 'Giáo viên'}</small></div>{normalizeText(member.classRole) === 'intern_teacher' ? <em className="student-intern-badge">Thực tập</em> : null}</article>)}</div> : <EmptyState icon="♟" title="Chưa có giáo viên" description="Danh sách giáo viên sẽ xuất hiện theo dữ liệu lớp hiện tại." />}
          <Pagination page={safeTeacherPage} pageCount={teacherPageCount} onChange={setTeacherMemberPage} />
        </section>
        <section className="student-member-section">
          <div className="student-member-section-head"><div><h2>Học sinh</h2><p>Mỗi trang tối đa 12 học sinh.</p></div><b>{studentMembers.length}</b></div>
          {visibleStudents.length ? <div className="student-members-grid">{visibleStudents.map((member) => <article key={member.id}><span className="student-avatar">{getAvatar({}, null, member) ? <img src={getAvatar({}, null, member)} alt="" referrerPolicy="no-referrer" /> : getInitial(member.name || member.displayName || member.email || 'H')}</span><div><strong>{member.name || member.displayName || member.email?.split('@')?.[0] || 'Học sinh'}</strong><small>{member.studentCode || member.code || 'Học sinh'}</small></div></article>)}</div> : <EmptyState icon="♟" title="Chưa có học sinh" description="Danh sách học sinh sẽ cập nhật theo thời gian thực khi có thành viên tham gia." />}
          <Pagination page={safeStudentPage} pageCount={studentPageCount} onChange={setStudentMemberPage} />
        </section>
      </div>
    )
  }

  const renderClasses = () => (
    <div>
      <div className="student-page-heading"><div><h1>Lớp học của tôi</h1><p>{classes.length ? `${classes.length} lớp đang tham gia` : 'Các lớp bạn tham gia sẽ xuất hiện tại đây.'}</p></div><button className="student-primary-btn" type="button" onClick={() => { setJoinError(''); setJoinOpen(true) }}>+ Tham gia lớp</button></div>
      {loadingClasses ? <div className="student-class-grid">{Array.from({ length: 4 }, (_, index) => <div className="student-class-card skeleton" key={index}><div /><span /><b /></div>)}</div> : classes.length ? <div className="student-class-grid">{classes.map((item, index) => {
        const assignments = (classAssignments[item.id] || []).filter((assignment) => !isAssignmentDraft(assignment))
        const pending = assignments.filter((assignment) => {
          const submission = getSubmission(assignment)
          return !submission?.submittedAt && !isAssignmentClosed(assignment)
        }).length
        const cover = getClassCover(item) || getDefaultClassCover(index)
        return <button type="button" className="student-class-card" key={item.id} onClick={() => openClass(item.id, 'home')} style={{ '--student-accent': getClassTheme(item) }}>
          <div className="student-class-cover" style={cover ? { backgroundImage: `linear-gradient(180deg,rgba(15,23,42,.08),rgba(15,23,42,.45)),url("${cover}")` } : { background: `linear-gradient(135deg,${getClassTheme(item)},#0f172a)` }}><span>{item.subject || item.grade || 'Lớp học'}</span></div>
          <div className="student-class-copy"><strong>{item.name || 'Lớp học'}</strong><small>{item.teacherName || item.teacherEmail || 'Giáo viên'}{item.grade ? ` · Khối ${item.grade}` : ''}</small><div><span>{item.schoolYear || 'Năm học chưa cập nhật'}</span>{pending ? <b>{pending} bài cần làm</b> : <em>Đã cập nhật</em>}</div></div>
        </button>
      })}</div> : <EmptyState icon="▣" title="Bạn chưa tham gia lớp học nào" description="Nhập mã lớp do giáo viên cung cấp để bắt đầu học cùng lớp." />}
    </div>
  )

  const renderAssignments = () => (
    <div>
      <div className="student-page-heading"><div><h1>Bài tập</h1><p>Theo dõi bài được giao từ các lớp bạn đang tham gia.</p></div></div>
      <div className="student-toolbar"><label className="student-search">⌕<input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Tìm bài tập..." /></label><div className="student-filter-tabs">{[['all','Tất cả'],['todo','Cần làm'],['submitted','Đã nộp'],['graded','Đã chấm'],['overdue','Quá hạn']].map(([id,label]) => <button key={id} type="button" className={assignmentFilter === id ? 'active' : ''} onClick={() => setAssignmentFilter(id)}>{label}</button>)}</div></div>
      {assignmentRows.length ? <div className="student-assignment-list">{assignmentRows.map((item) => {
        const submission = getSubmission(item)
        const due = getAssignmentDue(item)
        const overdue = !submission?.submittedAt && due && due < Date.now()
        const score = toNumber(submission?.score)
        return <button type="button" key={`${item.classId}-${item.id}`} onClick={() => { setSelectedClassId(item.classId); setSelectedAssignmentId(item.id); setSubmissionText(submission?.content || ''); setActivePage('assignment-detail') }}>
          <span className="student-assignment-icon" style={{ color: getClassTheme(classes.find((c) => c.id === item.classId)) }}>▤</span>
          <div className="student-assignment-main"><strong>{getAssignmentTitle(item)}</strong><small>{item.className || 'Lớp học'} · {item.subjectName || item.subject || 'Bài tập'}</small><p>{stripHtml(item.description || item.instructions || '') || 'Giáo viên chưa thêm mô tả.'}</p></div>
          <div className="student-assignment-meta"><span className={`student-status ${score !== null ? 'graded' : submission?.submittedAt ? 'submitted' : overdue ? 'overdue' : 'pending'}`}>{score !== null ? `Đã chấm · ${score.toFixed(1)}` : submission?.submittedAt ? 'Đã nộp' : overdue ? 'Quá hạn' : 'Cần làm'}</span><time>{due ? `Hạn ${formatDateTime(due)}` : 'Chưa có hạn nộp'}</time></div>
        </button>
      })}</div> : <EmptyState icon="▤" title="Chưa có bài tập phù hợp" description="Không có bài tập trong bộ lọc hiện tại." />}
    </div>
  )

  const renderAssignmentDetail = () => {
    if (!selectedAssignment) return <EmptyState icon="▤" title="Không tìm thấy bài tập" description="Bài tập có thể đã bị xóa hoặc bạn chưa chọn bài tập." />
    const submission = getSubmission(selectedAssignment)
    const score = toNumber(submission?.score)
    const due = getAssignmentDue(selectedAssignment)
    const attachments = Array.isArray(selectedAssignment.attachments) ? selectedAssignment.attachments : []
    return <div className="student-detail-page">
      <button className="student-back-link" type="button" onClick={() => setActivePage('assignments')}>← Bài tập</button>
      <div className="student-detail-grid"><section className="student-panel"><span className="student-eyebrow">{selectedAssignment.className || selectedClass?.name || 'Lớp học'}</span><h1>{getAssignmentTitle(selectedAssignment)}</h1><div className="student-detail-meta"><span>Giáo viên: {classes.find((c) => c.id === selectedAssignment.classId)?.teacherName || 'Chưa cập nhật'}</span><span>{due ? `Hạn nộp: ${formatDateTime(due)}` : 'Chưa có hạn nộp'}</span>{toNumber(selectedAssignment.maxScore) !== null ? <span>Điểm tối đa: {toNumber(selectedAssignment.maxScore)}</span> : null}</div><div className="student-rich-content">{stripHtml(selectedAssignment.description || selectedAssignment.instructions || selectedAssignment.content || '') || 'Giáo viên chưa thêm nội dung chi tiết.'}</div>{attachments.length ? <div className="student-attachment-list"><h3>Tài liệu giáo viên</h3>{attachments.map((file, index) => <a key={index} href={file.url || file.href || '#'} target="_blank" rel="noreferrer">▱ {file.name || file.title || `Tệp ${index + 1}`}</a>)}</div> : null}</section>
      <aside className="student-panel student-submission-card"><span className="student-eyebrow">Bài làm của bạn</span>{submission?.submittedAt ? <div className="student-submitted-box"><strong>{score !== null ? `Điểm: ${score.toFixed(1)}` : 'Đã nộp'}</strong><small>{formatDateTime(submission.submittedAt)}</small>{submission.content ? <p>{submission.content}</p> : null}{submission.attachment?.url ? <a href={submission.attachment.url} target="_blank" rel="noreferrer">▱ {submission.attachment.name || 'Tệp đã nộp'}</a> : null}{submission.feedback ? <div className="student-feedback"><b>Nhận xét giáo viên</b><p>{submission.feedback}</p></div> : score !== null ? <p>Giáo viên chưa có nhận xét.</p> : null}</div> : <p className="student-muted">Bạn chưa nộp bài tập này.</p>}
      {score === null && !isAssignmentClosed(selectedAssignment) ? <><textarea value={submissionText} onChange={(event) => setSubmissionText(event.target.value)} placeholder="Nhập nội dung bài làm..." rows={6} /><label className="student-file-picker">▱ {submissionFile ? submissionFile.name : 'Chọn tệp bài làm'}<input type="file" onChange={(event) => setSubmissionFile(event.target.files?.[0] || null)} /></label>{submissionError ? <p className="student-error">{submissionError}</p> : null}<button className="student-primary-btn full" type="button" disabled={submitting} onClick={submitAssignment}>{submitting ? 'Đang nộp bài...' : submission?.submittedAt ? 'Nộp lại bài' : 'Nộp bài'}</button></> : null}</aside></div>
    </div>
  }

  const renderSchedule = () => {
    const baseMonday = getMondayStart(new Date())
    const weekStart = addDays(baseMonday, scheduleWeekOffset * 7)
    const weekDays = Array.from({ length: 5 }, (_, index) => { const date = addDays(weekStart, index); return { date, key: getDateKey(date), label: date.toLocaleDateString('vi-VN', { weekday: 'short' }), shortDate: date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) } })
    const weekKey = getDateKey(weekStart)
    const slots = getStudentScheduleSlots(selectedClass || {}, weekKey)
    const breaks = getStudentScheduleBreaks(selectedClass || {}, weekKey)
    const weekEnd = addDays(weekStart, 4)
    const weekItems = scheduleItems.filter((item) => item.kind !== 'persistentImportant' && weekDays.some((day) => getScheduleDate(item) === day.key))
    const persistentItems = scheduleItems.filter((item) => item.kind === 'persistentImportant' && (!item.expiresAtMillis || Number(item.expiresAtMillis) >= Date.now())).sort((a,b) => Number(a.expiresAtMillis || 0) - Number(b.expiresAtMillis || 0))
    const importantItems = weekItems.filter((item) => Boolean(item.important || item.isImportant || item.pinned)).sort((a,b) => `${getScheduleDate(a)} ${getScheduleTime(a)}`.localeCompare(`${getScheduleDate(b)} ${getScheduleTime(b)}`))
    const findCell = (dateKey, slot) => weekItems.find((item) => getScheduleDate(item) === dateKey && getScheduleTime(item) === slot.startTime)

    const exportSchedulePdf = () => {
      if (typeof document === 'undefined') return
      const canvas = document.createElement('canvas'); canvas.width = 1240; canvas.height = 1754
      const ctx = canvas.getContext('2d'); if (!ctx) return
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.textBaseline='middle'; ctx.textAlign='left'
      ctx.fillStyle='#0f172a'; ctx.font='700 40px Arial, sans-serif'; ctx.fillText('Thời khóa biểu',60,68)
      ctx.fillStyle='#64748b'; ctx.font='500 21px Arial, sans-serif'; ctx.fillText(`Lớp ${selectedClass?.name || ''} · Tuần ${weekStart.toLocaleDateString('vi-VN')} - ${weekEnd.toLocaleDateString('vi-VN')}`,60,110)
      const left=60, top=155, timeWidth=150, dayWidth=194, headerHeight=64, totalWidth=timeWidth+dayWidth*weekDays.length
      ctx.fillStyle='#f8fafc'; ctx.fillRect(left,top,totalWidth,headerHeight); ctx.strokeStyle='#dbe3ef'; ctx.strokeRect(left,top,totalWidth,headerHeight); ctx.textAlign='center'; ctx.font='700 17px Arial, sans-serif'; ctx.fillStyle='#475569'; ctx.fillText('Thời gian',left+timeWidth/2,top+headerHeight/2)
      weekDays.forEach((day,index)=>{ const x=left+timeWidth+index*dayWidth; ctx.strokeRect(x,top,dayWidth,headerHeight); ctx.fillText(`${day.label} ${day.shortDate}`,x+dayWidth/2,top+headerHeight/2) })
      let y=top+headerHeight
      slots.forEach((slot,slotIndex)=>{
        const rowHeight=92; ctx.fillStyle=slotIndex%2?'#ffffff':'#fbfdff'; ctx.fillRect(left,y,totalWidth,rowHeight); ctx.strokeStyle='#e5e7eb'; ctx.strokeRect(left,y,timeWidth,rowHeight); ctx.fillStyle='#334155'; ctx.font='700 17px Arial, sans-serif'; ctx.fillText(`Tiết ${slot.period}`,left+timeWidth/2,y+28); ctx.font='500 15px Arial, sans-serif'; ctx.fillStyle='#64748b'; ctx.fillText(`${slot.startTime} - ${slot.endTime}`,left+timeWidth/2,y+57)
        weekDays.forEach((day,dayIndex)=>{ const x=left+timeWidth+dayIndex*dayWidth; ctx.strokeRect(x,y,dayWidth,rowHeight); const item=findCell(day.key,slot); if(!item)return; let title=String(item.title||item.subject||'Nội dung lịch'); ctx.fillStyle='#1d4ed8'; ctx.font='700 16px Arial, sans-serif'; while(ctx.measureText(title).width>dayWidth-20&&title.length>4)title=`${title.slice(0,-2)}…`; ctx.fillText(title,x+dayWidth/2,y+35); ctx.fillStyle='#64748b'; ctx.font='500 14px Arial, sans-serif'; ctx.fillText(item.room||item.location||'',x+dayWidth/2,y+61) })
        y+=rowHeight
        breaks.filter((item)=>Number(item.afterPeriod)===Number(slot.period)).forEach((item)=>{ const h=52; ctx.fillStyle='#fff7ed'; ctx.fillRect(left,y,totalWidth,h); ctx.strokeStyle='#fed7aa'; ctx.strokeRect(left,y,totalWidth,h); ctx.fillStyle='#c2410c'; ctx.font='700 15px Arial, sans-serif'; ctx.fillText(`${item.label} · ${item.startTime} - ${item.endTime}`,left+totalWidth/2,y+h/2); y+=h })
      })
      ctx.textAlign='left'; ctx.fillStyle='#94a3b8'; ctx.font='500 15px Arial, sans-serif'; ctx.fillText('Dữ liệu lịch học được đồng bộ từ lịch dạy của giáo viên tại thời điểm xuất.',60,1690)
      const dataUrl=canvas.toDataURL('image/jpeg',0.92); const binary=atob(dataUrl.split(',')[1]); const bytes=new Uint8Array(binary.length); for(let i=0;i<binary.length;i+=1)bytes[i]=binary.charCodeAt(i)
      const blob=new Blob([buildJpegPdf([{width:canvas.width,height:canvas.height,bytes}])],{type:'application/pdf'}); const url=URL.createObjectURL(blob); const anchor=document.createElement('a'); anchor.href=url; anchor.download=`ThoiKhoaBieu_${String(selectedClass?.name||'Lop').replace(/[^a-zA-Z0-9_-]+/g,'_')}_${weekKey}.pdf`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(()=>URL.revokeObjectURL(url),1000)
    }

    const syncScheduleWithGoogle = () => {
      if (!weekItems.length) { setScheduleSyncMessage('Tuần này chưa có tiết học để đồng bộ Google Calendar.'); return }
      const events = weekItems.map((item) => { const date=getScheduleDate(item), start=getScheduleTime(item), end=getScheduleEndTime(item); if(!date||!start||!end)return ''; return ['BEGIN:VEVENT',`UID:zuny-${selectedClassId}-${item.id || `${date}-${start}`}@zuny`,`DTSTART:${toIcsDate(date,start)}`,`DTEND:${toIcsDate(date,end)}`,`SUMMARY:${escapeIcsText(item.title||item.subject||'Lịch học')}`,`DESCRIPTION:${escapeIcsText(item.lessonContent||item.note||'')}`,`LOCATION:${escapeIcsText(item.room||item.location||'')}`,'END:VEVENT'].join('\r\n') }).filter(Boolean)
      const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ZUNY//Class Schedule//VI','CALSCALE:GREGORIAN',...events,'END:VCALENDAR'].join('\r\n')
      const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'}); const url=URL.createObjectURL(blob); const anchor=document.createElement('a'); anchor.href=url; anchor.download=`LichHoc_${String(selectedClass?.name||'Lop').replace(/[^a-zA-Z0-9_-]+/g,'_')}_${weekKey}.ics`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(()=>URL.revokeObjectURL(url),1000); setScheduleSyncMessage('Đã tải file Google Calendar (.ics). Hãy nhập file này vào Google Calendar.'); setScheduleGoogleGuideOpen(true)
    }

    return <div className="student-teacher-schedule-page">
      <div className="student-page-heading student-schedule-page-head"><div><h1>Lịch học</h1><p>{selectedClass?.name || 'Chọn lớp để xem lịch học.'}</p></div>{renderClassPicker()}</div>
      {!selectedClass ? <EmptyState icon="▦" title="Chưa có lớp học" description="Hãy tham gia lớp để xem lịch." /> : <>
        <div className="student-schedule-toolbar"><div><button type="button" onClick={() => setScheduleWeekOffset((value) => value - 1)}>←</button><button type="button" onClick={() => setScheduleWeekOffset(0)}>Tuần này</button><button type="button" onClick={() => setScheduleWeekOffset((value) => value + 1)}>→</button></div><strong>{weekStart.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit' })} – {weekEnd.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' })}</strong><aside><button type="button" onClick={exportSchedulePdf}>⇩ Xuất PDF</button><button type="button" onClick={syncScheduleWithGoogle}>G Đồng bộ Google</button></aside></div>
        {scheduleSyncMessage ? <div className="student-schedule-sync-message">{scheduleSyncMessage}</div> : null}
        <div className="student-schedule-board-scroll"><section className="student-schedule-board">
          <div className="student-schedule-grid-head student-schedule-time-head">Thời gian</div>
          {weekDays.map((day) => <div className="student-schedule-grid-head" key={day.key}><strong>{day.label}</strong><small>{day.shortDate}</small></div>)}
          {slots.flatMap((slot) => { const cells=[<div className="student-schedule-time-cell" key={`time-${slot.id}`}><b>TIẾT {slot.period}</b><strong>{slot.startTime}</strong><small>{slot.endTime}</small></div>,...weekDays.map((day)=>{const item=findCell(day.key,slot);return <div className={`student-schedule-cell ${item?'filled':''} ${item?.important||item?.isImportant||item?.pinned?'important':''}`} key={`${slot.id}-${day.key}`}>{item?<><strong>{item.title||item.subject||'Nội dung học'}</strong><span>{item.lessonContent||item.lessonName||item.note||'Chưa có nội dung chi tiết'}</span><small>{item.room||item.location||''}</small>{item.important||item.isImportant||item.pinned?<em>! Quan trọng</em>:null}</>:<span className="student-schedule-empty-cell">—</span>}</div>})]; const after=breaks.filter((item)=>Number(item.afterPeriod)===Number(slot.period)); return after.length?[...cells,<div className="student-schedule-break-row" key={`break-${slot.id}`}>{after.map((item)=><span key={item.id}><b>{item.label}</b><small>{item.startTime} – {item.endTime}</small></span>)}</div>]:cells }).flat()}
        </section></div>
        <section className="student-schedule-important-section"><div className="student-schedule-important-head"><div><h2>Quan trọng trong tuần</h2><p>Các tiết được giáo viên đánh dấu Quan trọng.</p></div><b>{importantItems.length}</b></div>{importantItems.length?<div className="student-schedule-important-grid">{importantItems.map((item)=><article key={item.id}><i>!</i><div><strong>{item.title||item.subject||'Nội dung quan trọng'}</strong><span>{getScheduleDate(item)} · {getScheduleTime(item)}{getScheduleEndTime(item)?`–${getScheduleEndTime(item)}`:''}</span>{item.note?<small>{item.note}</small>:null}</div></article>)}</div>:<p className="student-schedule-important-empty">Chưa có nội dung quan trọng trong tuần này.</p>}</section>
        <section className="student-schedule-persistent-section"><div className="student-schedule-important-head"><div><h2>Quan trọng</h2><p>Nội dung dài hạn giáo viên đang theo dõi.</p></div><b>{persistentItems.length}</b></div>{persistentItems.length?<div className="student-schedule-persistent-list">{persistentItems.map((item)=><article key={item.id}><i>!</i><div><strong>{item.title||'Nội dung quan trọng'}</strong><small>{item.note||'Không có ghi chú'}</small>{item.expiresAtMillis?<time>Đến {new Date(Number(item.expiresAtMillis)).toLocaleString('vi-VN')}</time>:null}</div></article>)}</div>:<p className="student-schedule-important-empty">Chưa có nội dung quan trọng dài hạn.</p>}</section>
      </>}
      {scheduleGoogleGuideOpen ? <div className="student-modal-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)setScheduleGoogleGuideOpen(false)}}><section className="student-modal student-google-guide"><header><div><span>GOOGLE CALENDAR</span><h2>Nhập thời khóa biểu vào Google</h2></div><button type="button" onClick={()=>setScheduleGoogleGuideOpen(false)}>×</button></header><div className="student-google-guide-body"><p>✓ File <b>.ics</b> đã được tải xuống thiết bị.</p><ol><li>Mở Google Calendar.</li><li>Vào Cài đặt → Nhập và xuất.</li><li>Chọn file <b>LichHoc_...ics</b> vừa tải.</li><li>Chọn lịch muốn lưu và bấm Nhập.</li></ol><a href="https://calendar.google.com/calendar/u/0/r/settings/export" target="_blank" rel="noreferrer">Mở trang Nhập và xuất Google Calendar ↗</a></div><footer><button type="button" className="student-primary-btn" onClick={()=>setScheduleGoogleGuideOpen(false)}>Đã hiểu</button></footer></section></div> : null}
    </div>
  }

  const renderGrades = () => (
    <div><div className="student-page-heading"><div><h1>Điểm số</h1><p>Chỉ hiển thị kết quả của tài khoản học sinh hiện tại.</p></div>{renderClassPicker()}</div>{ownGrades.some((item) => item.average !== null || item.tests.length) ? <><section className="student-grade-hero"><span>Điểm trung bình</span><strong>{overallAverage === null ? '—' : overallAverage.toFixed(1)}</strong><p>{selectedClass?.name || 'Lớp học'}</p></section><div className="student-grade-grid">{ownGrades.map((row) => <section className="student-panel" key={row.subject.id}><div className="student-panel-head"><div><span>Môn học</span><h2>{row.subject.name || 'Môn học'}</h2></div><b className="student-grade-pill">{row.average === null ? '—' : row.average.toFixed(1)}</b></div>{row.tests.length ? <div className="student-score-list">{row.tests.map(({ test, value }) => <div key={test.id}><span><strong>{test.name || test.code || 'Bài đánh giá'}</strong><small>{test.type || test.category || 'Đánh giá'}</small></span><b>{value.toFixed(1)}</b></div>)}</div> : <p className="student-muted">Chưa có điểm thành phần.</p>}</section>)}</div></> : <EmptyState icon="★" title="Chưa có kết quả" description="Điểm của bạn sẽ xuất hiện sau khi giáo viên cập nhật." />}</div>
  )

  const renderAttendance = () => (
    <div><div className="student-page-heading"><div><h1>Điểm danh</h1><p>Lịch sử chuyên cần của riêng bạn trong lớp.</p></div>{renderClassPicker()}</div><section className="student-stat-grid attendance"><article><span className="student-stat-icon green">✓</span><div><small>Có mặt</small><strong>{attendanceStats.present}</strong></div></article><article><span className="student-stat-icon amber">◷</span><div><small>Đi muộn</small><strong>{attendanceStats.late}</strong></div></article><article><span className="student-stat-icon purple">○</span><div><small>Vắng phép</small><strong>{attendanceStats.excused}</strong></div></article><article><span className="student-stat-icon red">×</span><div><small>Vắng không phép</small><strong>{attendanceStats.absent}</strong></div></article></section>{attendanceRate !== null ? <section className="student-attendance-rate"><div><span>Tỷ lệ chuyên cần</span><strong>{attendanceRate}%</strong></div><i><em style={{ width: `${attendanceRate}%` }} /></i><p>Kết quả được tính từ dữ liệu điểm danh giáo viên đã lưu.</p></section> : null}{ownAttendance.length ? <div className="student-attendance-list">{ownAttendance.map((item) => <article key={item.id}><time>{item.date}</time><span className={`student-status ${item.status}`}>{attendanceLabel(item.status)}</span><p>{item.note || 'Không có ghi chú'}</p></article>)}</div> : <EmptyState icon="✓" title="Chưa có dữ liệu điểm danh" description="Khi giáo viên lưu điểm danh, trạng thái của bạn sẽ xuất hiện tại đây." />}</div>
  )

  const renderNotifications = () => {
    const classAccent = getClassTheme(selectedClass)
    return (
      <div className="student-notification-center" style={{ '--student-notification-accent': classAccent }}>
        <section className="student-notification-center-head">
          <div className="student-notification-center-title">
            <h1>Thông báo</h1>
            {unreadStudentNotifications.length ? <b>{unreadStudentNotifications.length}</b> : null}
          </div>
          <div className="student-notification-center-actions">
            {classes.length > 1 ? renderClassPicker() : null}
            <div className="student-notification-filter-tabs" role="tablist" aria-label="Lọc thông báo">
              <button type="button" className={notificationFilter === 'all' ? 'active' : ''} onClick={() => setNotificationFilter('all')}>Tất cả</button>
              <button type="button" className={notificationFilter === 'unread' ? 'active' : ''} onClick={() => setNotificationFilter('unread')}>Chưa đọc ({unreadStudentNotifications.length})</button>
            </div>
            <button type="button" className="student-notification-delete-all" onClick={() => setNotificationDeleteAllOpen(true)} disabled={!studentNotifications.length || notificationActionBusy === 'delete-all'}>⌫ Xóa hết</button>
          </div>
        </section>

        {notificationActionError ? <p className="student-notification-action-error">{notificationActionError}</p> : null}

        <section className="student-notification-center-list">
          {visibleStudentNotifications.length ? visibleStudentNotifications.map((item) => {
            const automatic = Boolean(item.systemGenerated)
            const severity = normalizeText(item.severity || (automatic ? 'medium' : 'normal'))
            const unread = !Array.isArray(item.readBy) || !item.readBy.includes(currentUser?.uid)
            const isLocalReminder = item.type === 'attendanceReminder'
            const icon = isLocalReminder || item.type === 'attendance' || severity === 'critical' || severity === 'warning'
              ? '!'
              : item.type === 'assignment'
                ? '▤'
                : item.type === 'score' || item.type === 'average'
                  ? '▥'
                  : item.type === 'reward' || severity === 'reward'
                    ? '★'
                    : item.type?.startsWith?.('schedule') || severity === 'important'
                      ? '◆'
                      : '●'
            const message = stripHtml(item.contentHtml || item.content || item.message || item.body || '') || 'Thông báo không có nội dung văn bản.'
            return (
              <article
                key={item.id}
                className={`student-notification-center-card ${unread ? 'unread' : 'read'} severity-${severity}`}
                role={isLocalReminder ? undefined : 'button'}
                tabIndex={isLocalReminder ? undefined : 0}
                onClick={() => { if (!isLocalReminder && unread) markStudentNotificationRead(item) }}
                onKeyDown={(event) => {
                  if (!isLocalReminder && unread && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault()
                    markStudentNotificationRead(item)
                  }
                }}
              >
                <div className={`student-notification-center-icon severity-${severity}`}>{icon}</div>
                <div className="student-notification-center-content">
                  <div className="student-notification-center-title-line">
                    <strong>{item.title || (automatic ? 'Thông báo tự động' : 'Thông báo lớp học')}</strong>
                    <div className="student-notification-center-badges">
                      {automatic ? <em className="automatic">Thông báo tự động</em> : null}
                      {severity === 'critical' ? <em className="critical">Khẩn cấp</em> : severity === 'warning' ? <em className="warning">Cảnh báo</em> : severity === 'reward' ? <em className="reward">Khen thưởng</em> : severity === 'important' ? <em className="important">Quan trọng</em> : null}
                    </div>
                    {unread ? <i className="student-notification-unread-dot" title="Chưa đọc" /> : null}
                  </div>
                  <p>{message}</p>
                  <small>{formatNotificationStamp(item.createdAt || item.updatedAt)}</small>
                  {Array.isArray(item.attachments) && item.attachments.length ? <div className="student-notification-files">{item.attachments.map((file, index) => <a key={index} href={file.url || file.href || '#'} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>▱ {file.name || file.title || file.url || `Đính kèm ${index + 1}`}</a>)}</div> : null}
                </div>
                <div className="student-notification-card-actions">
                  {!isLocalReminder ? <button type="button" className="student-notification-trash-btn" onClick={(event) => { event.stopPropagation(); dismissStudentNotification(item) }} disabled={notificationActionBusy === `delete:${item.id}`} title="Xóa thông báo" aria-label="Xóa thông báo">⌫</button> : null}
                </div>
              </article>
            )
          }) : <div className="student-notification-center-empty">{notificationFilter === 'unread' ? 'Không còn thông báo chưa đọc.' : 'Chưa có thông báo dành cho bạn.'}</div>}
        </section>

        {notificationDeleteAllOpen ? <div className="student-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && notificationActionBusy !== 'delete-all') setNotificationDeleteAllOpen(false) }}><section className="student-modal student-notification-delete-modal"><header><div><span>THÔNG BÁO</span><h2>Xóa hết thông báo?</h2></div><button type="button" onClick={() => setNotificationDeleteAllOpen(false)} disabled={notificationActionBusy === 'delete-all'}>×</button></header><p>Thông báo sẽ chỉ được ẩn khỏi tài khoản của bạn. Giáo viên và các thành viên khác trong lớp không bị ảnh hưởng.</p><footer><button type="button" className="student-secondary-btn" onClick={() => setNotificationDeleteAllOpen(false)} disabled={notificationActionBusy === 'delete-all'}>Hủy</button><button type="button" className="student-danger-btn" onClick={dismissAllStudentNotifications} disabled={notificationActionBusy === 'delete-all' || !studentNotifications.length}>{notificationActionBusy === 'delete-all' ? 'Đang xóa...' : 'Xóa hết'}</button></footer></section></div> : null}
      </div>
    )
  }

  const renderMessages = () => {
    if (!classes.length) return <EmptyState icon="☵" title="Chưa có cuộc trò chuyện" description="Hãy tham gia lớp trước khi trao đổi với giáo viên." />
    const conversation = selectedConversation
    return <div className="student-message-layout"><aside className="student-conversation-list"><div className="student-page-heading compact"><div><h1>Trao đổi</h1><p>Giáo viên theo từng lớp</p></div></div>{conversationRows.map((row) => <button type="button" key={row.classItem.id} className={conversation?.classItem.id === row.classItem.id ? 'active' : ''} onClick={() => { setSelectedConversationClassId(row.classItem.id); setSelectedClassId(row.classItem.id) }}><span className="student-avatar">{row.classItem.teacherPhotoURL ? <img src={row.classItem.teacherPhotoURL} alt="" /> : getInitial(row.classItem.teacherName || 'G')}</span><div><strong>{row.classItem.teacherName || 'Giáo viên'}</strong><small>{row.classItem.name || 'Lớp học'}</small><p>{row.last?.recalled ? 'Tin nhắn đã được thu hồi' : row.last?.content || (row.last?.attachment ? `Tệp: ${row.last.attachment.name}` : 'Chưa có tin nhắn')}</p></div></button>)}</aside><section className="student-chat-panel"><header><span className="student-avatar">{conversation?.classItem.teacherPhotoURL ? <img src={conversation.classItem.teacherPhotoURL} alt="" /> : getInitial(conversation?.classItem.teacherName || 'G')}</span><div><strong>{conversation?.classItem.teacherName || 'Giáo viên'}</strong><small>{conversation?.classItem.name || 'Lớp học'} · Giáo viên</small></div></header><div className="student-chat-messages">{conversation?.messages?.length ? conversation.messages.map((item) => {
      const own = item.senderId === currentUser?.uid || normalizeText(item.senderEmail) === normalizeText(currentUser?.email)
      const copied = copiedMessageId === item.id
      return <div key={item.id} className={`student-message ${own ? 'own' : ''} ${item.recalled ? 'recalled' : ''}`}>
        <div className="student-message-bubble">{item.recalled ? <em>Tin nhắn đã được thu hồi.</em> : <>{item.content ? <p>{item.content}</p> : null}{item.attachment?.url ? <a href={item.attachment.url} target="_blank" rel="noreferrer">▱ {item.attachment.name || 'Tệp đính kèm'}</a> : null}</>}<small>{formatDateTime(item.createdAt)}</small></div>
        <span className="student-message-actions" aria-label="Thao tác tin nhắn">
          <button type="button" className={`student-message-action copy ${copied ? 'copied' : ''}`} onClick={() => copyMessage(item)} title={copied ? 'Đã sao chép' : 'Sao chép tin nhắn'} aria-label={copied ? 'Đã sao chép tin nhắn' : 'Sao chép tin nhắn'}><span>{copied ? '✓' : '⧉'}</span><b>{copied ? 'Đã copy' : 'Copy'}</b></button>
          {own && !item.recalled ? <button type="button" className="student-message-action recall" onClick={() => setRecallTarget(item)} title="Thu hồi tin nhắn" aria-label="Thu hồi tin nhắn"><span>↶</span><b>Thu hồi</b></button> : null}
        </span>
      </div>
    }) : <EmptyState icon="☵" title="Chưa có tin nhắn" description="Bạn có thể bắt đầu cuộc trò chuyện với giáo viên." />}</div><footer>{messageFile ? <div className="student-file-chip">▱ {messageFile.name}<button type="button" onClick={() => { setMessageFile(null); if (messageFileRef.current) messageFileRef.current.value = '' }}>×</button></div> : null}{messageError ? <p className="student-error">{messageError}</p> : null}<div><label className="student-chat-file">▱<input ref={messageFileRef} type="file" onChange={(event) => setMessageFile(event.target.files?.[0] || null)} /></label><textarea ref={messageTextareaRef} rows={1} maxLength={2000} value={messageDraft} onChange={(event) => { setMessageDraft(event.target.value); resizeChatTextarea(event.currentTarget, 140) }} onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); sendMessage() } }} placeholder="Nhập tin nhắn..." /><button type="button" disabled={sendingMessage || (!messageDraft.trim() && !messageFile)} onClick={sendMessage}>{sendingMessage ? '…' : '➤'}</button></div></footer></section></div>
  }

  const renderLessons = () => (
    <div><div className="student-page-heading"><div><h1>Bài giảng</h1><p>Nội dung bài học được lấy từ lịch dạy giáo viên đã nhập.</p></div>{renderClassPicker()}</div>{lessons.length ? <div className="student-lesson-grid">{lessons.map((item) => <article className="student-panel" key={item.id}><span className="student-lesson-icon">▶</span><small>{item.subject}</small><h2>{item.title}</h2><p>{item.note || 'Không có ghi chú bổ sung.'}</p><footer><span>{item.date || 'Chưa có ngày'}</span><span>{item.room || 'Chưa có phòng'}</span></footer></article>)}</div> : <EmptyState icon="▶" title="Chưa có bài giảng" description="Hiện chưa có nội dung lessonContent trong lịch dạy của lớp này." />}</div>
  )

  const renderResources = () => (
    <div className="student-elearning-resources-page">
      <div className="student-page-heading"><div><h1>Học liệu</h1><p>Bài đăng E-learning dành trực tiếp cho lớp, cho khối và nội dung công khai.</p></div>{renderClassPicker()}</div>

      <section className="student-elearning-stats">
        <article><span>▣</span><div><strong>{studentELearningResourceCounts.class}</strong><small>Dành cho lớp</small></div></article>
        <article><span>◎</span><div><strong>{studentELearningResourceCounts.grade}</strong><small>Dành cho khối</small></div></article>
        <article><span>✦</span><div><strong>{studentELearningResourceCounts.public}</strong><small>Công khai</small></div></article>
      </section>

      <section className="student-elearning-toolbar">
        <label className="student-elearning-search"><span>⌕</span><input value={eLearningResourceSearch} onChange={(event) => setELearningResourceSearch(event.target.value)} placeholder="Tìm tên bài, chủ đề, môn học, mã bài..." /></label>
        <div className="student-elearning-scope" role="tablist" aria-label="Phạm vi học liệu E-learning">
          <button type="button" className={eLearningResourceScope === 'class' ? 'active' : ''} onClick={() => setELearningResourceScope('class')}>Lớp <b>{studentELearningResourceCounts.class}</b></button>
          <button type="button" className={eLearningResourceScope === 'grade' ? 'active' : ''} onClick={() => setELearningResourceScope('grade')}>Khối <b>{studentELearningResourceCounts.grade}</b></button>
          <button type="button" className={eLearningResourceScope === 'public' ? 'active' : ''} onClick={() => setELearningResourceScope('public')}>Công khai <b>{studentELearningResourceCounts.public}</b></button>
        </div>
        <div className="student-elearning-selects">
          <label><span>Định dạng</span><select value={eLearningResourceFormat} onChange={(event) => setELearningResourceFormat(event.target.value)}><option value="all">Tất cả</option><option value="video">Video</option><option value="document">Tài liệu</option><option value="simulation">Mô phỏng</option><option value="code">Code</option><option value="lesson">Bài học</option></select></label>
          <label><span>Sắp xếp</span><select value={eLearningResourceSort} onChange={(event) => setELearningResourceSort(event.target.value)}><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option><option value="views">Nhiều lượt xem</option></select></label>
        </div>
      </section>

      {eLearningResourcesError ? <div className="student-elearning-error">{eLearningResourcesError}</div> : null}
      {eLearningResourcesLoading ? (
        <div className="student-elearning-grid" aria-label="Đang tải học liệu E-learning">{Array.from({ length: 6 }, (_, index) => <article className="student-elearning-card skeleton" key={index}><div className="student-elearning-thumb" /><div className="student-elearning-card-body"><i /><i /><i /></div></article>)}</div>
      ) : visibleStudentELearningResources.length ? (
        <div className="student-elearning-grid">
          {visibleStudentELearningResources.map((course) => {
            const format = getELearningCourseFormat(course)
            const formatLabel = getELearningCourseFormatLabel(course)
            const title = stripELearningHtml(course.title) || 'Bài học E-learning'
            const thumbnail = String(course.thumbnail || course.documentImageUrl || '').trim()
            const ownerId = String(course.teacherId || course.createdByUid || course.createdBy || course.ownerId || course.userId || course.uid || '')
            const ownerEmail = normalizeText(course.teacherEmail || course.createdByEmail || course.ownerEmail || '')
            const teacherProfile = eLearningTeacherProfiles[`id:${ownerId}`] || eLearningTeacherProfiles[`email:${ownerEmail}`] || {}
            const teacherName = teacherProfile.fullName || teacherProfile.displayName || teacherProfile.name || course.teacherName || course.teacherEmail || 'Giáo viên ZUNY'
            const teacherAvatar = getUserAvatar(teacherProfile)
            return <article className={`student-elearning-card format-${format}`} key={course.id}>
              <button type="button" className="student-elearning-card-open" onClick={() => openStudentELearningResource(course)} aria-label={`Mở ${title}`} />
              <div className="student-elearning-thumb" style={thumbnail ? { backgroundImage: `url(${JSON.stringify(thumbnail)})` } : undefined}>
                <span className="student-elearning-format">{format === 'video' ? '▶' : format === 'document' ? '▤' : format === 'simulation' ? '✦' : format === 'code' ? '</>' : '▱'} {formatLabel}</span>
                {!thumbnail ? <strong>{format === 'video' ? 'VIDEO' : format === 'document' ? 'TÀI LIỆU' : format === 'simulation' ? 'MÔ PHỎNG' : format === 'code' ? 'CODE' : 'LEARNING'}</strong> : null}
                <small>{getELearningVideoDuration(course)}</small>
              </div>
              <div className="student-elearning-card-body">
                <span className="student-elearning-subject">{course.category || 'Môn học'}</span>
                <h2 title={title}>{title}</h2>
                <p>{stripELearningHtml(course.topic || course.description) || 'Chưa có mô tả cho bài học này.'}</p>
                <div className="student-elearning-teacher"><span>{teacherAvatar ? <img src={teacherAvatar} alt={teacherName} referrerPolicy="no-referrer" /> : getInitial(teacherName)}</span><div><strong>{teacherName}</strong><small>{course.courseCode || course.className || 'E-learning ZUNY'}</small></div></div>
                <footer><span>{formatELearningViews(course.views)} lượt xem</span><span>•</span><span>{formatELearningRelativeDate(course.createdAt || course.updatedAt)}</span><span>•</span><span>{Number(course.lessonCount || 0) || 1} bài</span></footer>
              </div>
            </article>
          })}
        </div>
      ) : (
        <EmptyState icon="▱" title="Chưa có bài E-learning phù hợp" description={eLearningResourceScope === 'class' ? `Chưa có bài E-learning được đăng trực tiếp cho lớp ${selectedClass?.name || 'này'}.` : eLearningResourceScope === 'grade' ? 'Chưa có bài E-learning dành cho khối của lớp hiện tại.' : 'Chưa có bài E-learning công khai phù hợp với bộ lọc.'} />
      )}
    </div>
  )

  const startSelfProfileEdit = (profile = {}) => {
    if (!studentRecord?.id) return
    setSelfProfileEditForm({
      name: profile.name || profile.displayName || studentName || '',
      phone: profile.phone || profile.phoneNumber || '',
      gender: profile.gender || profile.sex || '',
      birthDate: profile.birthDate || profile.dob || '',
      parentName: profile.parentName || profile.guardianName || '',
      parentPhone: profile.parentPhone || profile.guardianPhone || '',
      parentEmail: profile.parentEmail || profile.guardianEmail || '',
      parentRelation: profile.parentRelation || profile.guardianRelation || '',
      medicalNote: profile.medicalNote || profile.medicalNotes || profile.healthNote || '',
    })
    setSelfProfileError('')
    setSelfProfileEditing(true)
  }

  const cancelSelfProfileEdit = () => {
    if (selfProfileSaving) return
    setSelfProfileEditing(false)
    setSelfProfileError('')
  }

  const saveSelfProfileEdit = async () => {
    if (!selectedClassId || !studentRecord?.id || !currentUser?.uid || selfProfileSaving) return
    const name = selfProfileEditForm.name.trim()
    const parentEmail = selfProfileEditForm.parentEmail.trim().toLowerCase()
    if (!name) {
      setSelfProfileError('Vui lòng nhập họ và tên.')
      return
    }
    if (parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) {
      setSelfProfileError('Email phụ huynh chưa đúng định dạng.')
      return
    }
    const payload = {
      name,
      phone: selfProfileEditForm.phone.trim(),
      gender: selfProfileEditForm.gender.trim(),
      birthDate: selfProfileEditForm.birthDate.trim(),
      parentName: selfProfileEditForm.parentName.trim(),
      parentPhone: selfProfileEditForm.parentPhone.trim(),
      parentEmail,
      parentRelation: selfProfileEditForm.parentRelation.trim(),
      medicalNote: selfProfileEditForm.medicalNote.trim(),
    }
    try {
      setSelfProfileSaving(true)
      setSelfProfileError('')
      await classroomApi.updateMember(selectedClassId, studentRecord.id, payload)
      setStudents((current) => current.map((item) => String(item.id) === String(studentRecord.id) ? { ...item, ...payload } : item))
      setSelfProfileEditing(false)
      showToast('Đã cập nhật hồ sơ')
    } catch (apiError) {
      console.error('Không thể cập nhật hồ sơ học sinh:', apiError)
      setSelfProfileError(apiError?.response?.data?.message || apiError?.message || 'Không thể cập nhật hồ sơ học sinh.')
    } finally {
      setSelfProfileSaving(false)
    }
  }

  const renderProfile = () => {
    const profile = { ...(userProfilesByEmail[normalizeText(currentUser?.email)] || {}), ...(studentRecord || {}) }
    const parentName = profile.parentName || profile.guardianName || ''
    const parentPhone = profile.parentPhone || profile.guardianPhone || ''
    const parentEmail = profile.parentEmail || profile.guardianEmail || ''
    const profileEvents = Array.isArray(profile.profileEvents) ? profile.profileEvents : Array.isArray(profile.notes) ? profile.notes : []
    const assignmentRows = selectedClassAssignments.map((assignment) => {
      const submission = getSubmission(assignment)
      const due = getAssignmentDue(assignment)
      const submittedAt = getTimeValue(submission?.submittedAt)
      const submitted = Boolean(submittedAt || submission?.status)
      const late = submitted && Boolean(submission?.isLate || normalizeText(submission?.status) === 'late' || (due && submittedAt && submittedAt > due))
      return {
        assignment,
        submission,
        due,
        submittedAt,
        label: !submitted ? (due && due < Date.now() ? 'Quá hạn' : 'Chưa nộp') : late ? 'Nộp trễ' : 'Đã nộp',
        tone: !submitted ? (due && due < Date.now() ? 'overdue' : 'warning') : late ? 'late' : 'submitted',
      }
    })
    const autoRewards = overallAverage !== null && overallAverage >= 8
      ? [{ icon: '★', title: 'Kết quả học tập tốt', note: `Điểm trung bình hiện tại của bạn là ${overallAverage.toFixed(1)}.` }]
      : []

    return (
      <div className="student-self-profile-page">
        <div className="student-page-heading">
          <div><h1>Hồ sơ học sinh</h1><p>Đồng bộ từ hồ sơ đang dùng trong quản lý lớp học.</p></div>
        </div>
        <section className="student-self-profile-hero">
          <span className="student-avatar xl">{studentAvatar ? <img src={studentAvatar} alt="" referrerPolicy="no-referrer" /> : getInitial(studentName)}</span>
          <div className="student-self-profile-hero-main">
            <h2>{studentName}</h2>
            <p>{profile.email || currentUser?.email || 'Chưa có email'}</p>
            <div><span>{profile.studentCode || profile.code || 'Chưa có mã HS'}</span><span>{selectedClass?.name || 'Chưa chọn lớp'}</span></div>
          </div>
          {studentProfileTab === 'info' ? <div className="student-self-profile-actions">
            {selfProfileEditing ? <>
              <button type="button" className="student-self-profile-cancel" onClick={cancelSelfProfileEdit} disabled={selfProfileSaving}>Hủy</button>
              <button type="button" className="student-self-profile-save" onClick={saveSelfProfileEdit} disabled={selfProfileSaving}>{selfProfileSaving ? 'Đang lưu...' : 'Lưu hồ sơ'}</button>
            </> : <button type="button" className="student-self-profile-edit" onClick={() => startSelfProfileEdit(profile)} disabled={!studentRecord?.id}>✎ Chỉnh sửa</button>}
          </div> : null}
        </section>
        <nav className="student-self-profile-tabs">
          {[['info', 'Hồ sơ'], ['attendance', 'Điểm danh'], ['scores', 'Điểm số'], ['assignments', 'Bài tập'], ['profile', 'Khen thưởng']].map(([id, label]) => (
            <button type="button" key={id} className={studentProfileTab === id ? 'active' : ''} onClick={() => { setStudentProfileTab(id); if (id !== 'info') cancelSelfProfileEdit() }}>{label}</button>
          ))}
        </nav>
        <section className="student-self-profile-body">
          {studentProfileTab === 'info' ? <>
            {selfProfileError ? <p className="student-self-profile-error">{selfProfileError}</p> : null}
            <h3>Thông tin cá nhân</h3>
            {selfProfileEditing ? <div className="student-self-profile-edit-grid">
              <label><small>Họ và tên</small><input value={selfProfileEditForm.name} onChange={(event) => setSelfProfileEditForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label><small>Giới tính</small><select value={selfProfileEditForm.gender} onChange={(event) => setSelfProfileEditForm((current) => ({ ...current, gender: event.target.value }))}><option value="">Chưa chọn</option><option value="Nam">Nam</option><option value="Nữ">Nữ</option><option value="Khác">Khác</option></select></label>
              <label><small>Ngày sinh</small><input type="date" value={selfProfileEditForm.birthDate} onChange={(event) => setSelfProfileEditForm((current) => ({ ...current, birthDate: event.target.value }))} /></label>
              <label><small>Số điện thoại</small><input value={selfProfileEditForm.phone} onChange={(event) => setSelfProfileEditForm((current) => ({ ...current, phone: event.target.value }))} /></label>
              <div className="student-self-profile-readonly"><small>Lớp</small><strong>{selectedClass?.name || '—'}</strong></div>
              <div className="student-self-profile-readonly"><small>Mã học sinh</small><strong>{profile.studentCode || profile.code || 'Chưa cập nhật'}</strong></div>
              <div className="student-self-profile-readonly"><small>Email đăng nhập</small><strong>{profile.email || currentUser?.email || 'Chưa có dữ liệu'}</strong></div>
              <div className="student-self-profile-readonly"><small>Khối</small><strong>{selectedClass?.grade || 'Chưa cập nhật'}</strong></div>
            </div> : <div className="student-self-profile-grid">
              <div><small>Họ và tên</small><strong>{studentName}</strong></div><div><small>Giới tính</small><strong>{profile.gender || profile.sex || 'Chưa có dữ liệu'}</strong></div><div><small>Ngày sinh</small><strong>{profile.birthDate || profile.dob || 'Chưa có dữ liệu'}</strong></div><div><small>Lớp</small><strong>{selectedClass?.name || '—'}</strong></div><div><small>Mã học sinh</small><strong>{profile.studentCode || profile.code || 'Chưa cập nhật'}</strong></div><div><small>Email</small><strong>{profile.email || currentUser?.email || 'Chưa có dữ liệu'}</strong></div><div><small>Số điện thoại</small><strong>{profile.phone || profile.phoneNumber || 'Chưa có dữ liệu'}</strong></div><div><small>Khối</small><strong>{selectedClass?.grade || 'Chưa cập nhật'}</strong></div>
            </div>}
            <h3>Phụ huynh / Liên hệ khẩn cấp</h3>
            {selfProfileEditing ? <div className="student-self-profile-edit-grid">
              <label><small>Tên phụ huynh</small><input value={selfProfileEditForm.parentName} onChange={(event) => setSelfProfileEditForm((current) => ({ ...current, parentName: event.target.value }))} /></label>
              <label><small>Số điện thoại</small><input value={selfProfileEditForm.parentPhone} onChange={(event) => setSelfProfileEditForm((current) => ({ ...current, parentPhone: event.target.value }))} /></label>
              <label><small>Email</small><input type="email" value={selfProfileEditForm.parentEmail} onChange={(event) => setSelfProfileEditForm((current) => ({ ...current, parentEmail: event.target.value }))} /></label>
              <label><small>Quan hệ</small><input value={selfProfileEditForm.parentRelation} onChange={(event) => setSelfProfileEditForm((current) => ({ ...current, parentRelation: event.target.value }))} /></label>
            </div> : <div className="student-self-profile-grid">
              <div><small>Tên phụ huynh</small><strong>{parentName || 'Chưa có dữ liệu'}</strong></div><div><small>Số điện thoại</small><strong>{parentPhone || 'Chưa có dữ liệu'}</strong></div><div><small>Email</small><strong>{parentEmail || 'Chưa có dữ liệu'}</strong></div><div><small>Quan hệ</small><strong>{profile.parentRelation || profile.guardianRelation || 'Chưa có dữ liệu'}</strong></div>
            </div>}
            <h3>Ghi chú y tế</h3>
            {selfProfileEditing ? <textarea className="student-self-medical-edit" rows={4} value={selfProfileEditForm.medicalNote} onChange={(event) => setSelfProfileEditForm((current) => ({ ...current, medicalNote: event.target.value }))} placeholder="Ghi chú y tế..." /> : <div className="student-self-medical">{profile.medicalNote || profile.medicalNotes || profile.healthNote || 'Chưa có ghi chú y tế.'}</div>}
          </> : null}
          {studentProfileTab === 'attendance' ? <><h3>Lịch sử điểm danh</h3><div className="student-self-profile-stats"><div><b>{attendanceStats.present}</b><span>Có mặt</span></div><div><b>{attendanceStats.late}</b><span>Trễ</span></div><div><b>{attendanceStats.absent + attendanceStats.excused}</b><span>Vắng</span></div><div><b>{attendanceStats.total}</b><span>Tổng lượt</span></div></div>{ownAttendance.length ? <div className="student-self-list">{ownAttendance.slice(0, 20).map((item) => <article key={item.id}><time>{item.date}</time><strong>{attendanceLabel(item.status)}</strong><span>{item.note || ''}</span></article>)}</div> : <EmptyState icon="✓" title="Chưa có lịch sử điểm danh" description="Dữ liệu giáo viên lưu sẽ xuất hiện tại đây." />}</> : null}
          {studentProfileTab === 'scores' ? <><h3>Điểm số các bài thi đã làm</h3>{ownGrades.some((row) => row.tests.length) ? <div className="student-self-score-groups">{ownGrades.map((row) => <article key={row.subject.id}><header><div><strong>{row.subject.name || 'Môn học'}</strong><small>{row.tests.length} bài có điểm</small></div><b>{row.average === null ? '—' : row.average.toFixed(1)}</b></header>{row.tests.map(({ test, value }) => <div key={test.id}><span><strong>{test.name || test.title || test.code || 'Bài kiểm tra'}</strong><small>{test.type || test.category || 'Bài thi'}</small></span><b>{value.toFixed(1)}</b></div>)}</article>)}</div> : <EmptyState icon="★" title="Chưa có điểm bài thi" description="Điểm giáo viên cập nhật sẽ xuất hiện tại đây." />}</> : null}
          {studentProfileTab === 'assignments' ? <><h3>Bài tập & trạng thái</h3>{assignmentRows.length ? <div className="student-self-assignment-list">{assignmentRows.map(({ assignment, due, submittedAt, label, tone }) => <article key={assignment.id}><div><strong>{getAssignmentTitle(assignment)}</strong><small>{due ? `Hạn ${formatDateTime(due)}` : 'Chưa có hạn nộp'}</small></div><em className={tone}>{label}</em><time>{submittedAt ? `Nộp ${formatDateTime(submittedAt)}` : 'Chưa có bài nộp'}</time></article>)}</div> : <EmptyState icon="▤" title="Chưa có bài tập" description="Bài tập trong lớp sẽ xuất hiện tại đây." />}</> : null}
          {studentProfileTab === 'profile' ? <><h3>Khen thưởng & nhận xét</h3><div className="student-self-auto-note">Đánh giá tự động chỉ suy ra từ điểm hiện có trong hệ thống.</div>{autoRewards.length ? <div className="student-self-reward-list">{autoRewards.map((reward) => <article key={reward.title}><span>{reward.icon}</span><div><strong>{reward.title}</strong><p>{reward.note}</p></div></article>)}</div> : <div className="student-self-empty-note">{overallAverage === null ? 'Chưa có đủ dữ liệu điểm.' : 'Điểm trung bình hiện tại chưa đạt ngưỡng khen thưởng tự động từ 8.0 trở lên.'}</div>}{profileEvents.length ? <div className="student-self-list profile-events">{profileEvents.map((event, index) => <article key={event.id || index}><time>{formatDateTime(event.date || event.createdAt)}</time><strong>{event.title || event.type || 'Ghi nhận'}</strong><span>{event.note || event.description || ''}</span></article>)}</div> : null}</> : null}
        </section>
      </div>
    )
  }

  const renderCurrentPage = () => {
    if (error && activePage === 'home') return <EmptyState icon="!" title="Không thể tải dữ liệu" description={error} />
    if (activePage === 'classes') return renderClasses()
    if (activePage === 'overview') return renderOverview()
    if (activePage === 'members') return renderMembers()
    if (activePage === 'assignments') return <StudentClassExamWorkspace selectedClass={selectedClass} />
    if (activePage === 'assignment-detail') return renderAssignmentDetail()
    if (activePage === 'lessons') return renderLessons()
    if (activePage === 'schedule') return renderSchedule()
    if (activePage === 'grades') return renderGrades()
    if (activePage === 'attendance') return renderAttendance()
    if (activePage === 'resources') return renderResources()
    if (activePage === 'notifications') return renderNotifications()
    if (activePage === 'messages') return renderMessages()
    if (activePage === 'profile') return renderProfile()
    return renderHome()
  }

  if (classView === 'list') {
    const upcomingHubAssignments = visibleAssignments
      .filter((item) => {
        const due = getAssignmentDue(item)
        return due && due >= Date.now() && !isAssignmentClosed(item)
      })
      .sort((a, b) => getAssignmentDue(a) - getAssignmentDue(b))
      .slice(0, 3)

    return (
      <main className="student-learning-page student-class-hub">
        <section className="student-hub-shell">
          <div className="student-hub-toolbar">
            <label className="student-hub-search"><span>⌕</span><input value={classSearch} onChange={(event) => setClassSearch(event.target.value)} placeholder="Tìm kiếm lớp học..." /></label>
            <button className="student-hub-join-btn" type="button" title="Nhập mã lớp" aria-label="Nhập mã lớp" onClick={() => { setJoinError(''); setJoinOpen(true) }}>+</button>
          </div>

          <section className="student-hub-due">
            <div>
              <span>SẮP ĐẾN HẠN</span>
              <strong>Bài tập từ các lớp bạn đang tham gia</strong>
              {upcomingHubAssignments.length ? <div className="student-hub-due-list">{upcomingHubAssignments.map((item) => <button type="button" key={`${item.classId}-${item.id}`} onClick={() => { setSelectedClassId(item.classId); setSelectedAssignmentId(item.id); openClass(item.classId, 'assignment-detail') }}><b>{getAssignmentTitle(item)}</b><small>{item.className || 'Lớp học'} · Hạn {formatDateTime(getAssignmentDue(item))}</small></button>)}</div> : <p>Chưa có bài tập sắp đến hạn.</p>}
            </div>
            <b className="student-hub-due-count">{upcomingHubAssignments.length}</b>
          </section>

          {loadingClasses ? <div className="student-class-grid student-hub-class-grid">{Array.from({ length: 4 }, (_, index) => <div className="student-class-card skeleton" key={index}><div /><span /><b /></div>)}</div> : classes.length ? (visibleHubClasses.length ? <div className="student-class-grid student-hub-class-grid">{visibleHubClasses.map((item) => { const coverStyle = getClassCoverStyle(item); return <button type="button" className="student-class-card student-hub-class-card" key={item.id} onClick={() => openClass(item.id, 'home')} style={{ '--student-accent': getClassTheme(item) }}><div className="student-class-cover" style={coverStyle ? { backgroundImage: coverStyle } : { background: `linear-gradient(135deg,${getClassTheme(item)},#0f172a)` }} /><span className="student-hub-class-badge">{item.logoUrl ? <img src={item.logoUrl} alt="" referrerPolicy="no-referrer" /> : getInitial(item.name || 'L')}</span><div className="student-class-copy"><strong>{item.name || 'Lớp học'}</strong><div className="student-hub-teacher-row"><small>{item.teacherName || item.teacherEmail || 'Giáo viên'}</small>{item.grade ? <em>Khối {item.grade}</em> : null}</div><p>⌂ {item.school || item.schoolName || 'Trường học chưa cập nhật'}</p></div></button> })}</div> : <EmptyState icon="⌕" title="Không tìm thấy lớp học" description="Không có lớp đã tham gia phù hợp với từ khóa tìm kiếm." />) : <EmptyState icon="▣" title="Bạn chưa tham gia một lớp học nào" description="Nhấn dấu + và nhập mã lớp do giáo viên cung cấp để tham gia." />}
        </section>
        {joinOpen ? <div className="student-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !joining) setJoinOpen(false) }}><form className="student-modal" onSubmit={handleJoinClass}><header><div><span>THAM GIA LỚP</span><h2>Nhập mã lớp học</h2></div><button type="button" onClick={() => setJoinOpen(false)} disabled={joining}>×</button></header><p>Nhập mã lớp do giáo viên cung cấp.</p><label>Mã lớp<input autoFocus value={joinCode} maxLength={12} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="VD: ABCD1234" /></label>{joinError ? <p className="student-error">{joinError}</p> : null}<footer><button type="button" className="student-secondary-btn" onClick={() => setJoinOpen(false)} disabled={joining}>Hủy</button><button type="submit" className="student-primary-btn" disabled={joining || !joinCode.trim()}>{joining ? 'Đang kiểm tra...' : 'Tham gia lớp'}</button></footer></form></div> : null}
        {toast ? <div className="student-toast">✓ {toast}</div> : null}
        <style>{styles}</style>
      </main>
    )
  }

  return (
    <main className="student-learning-page">
      <div className={`student-workspace-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <aside className={`student-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <div className="student-sidebar-collapse-row"><button type="button" className="student-sidebar-back-list" onClick={() => setSidebarCollapsed((value) => !value)}>{sidebarCollapsed ? '›' : '‹'} {!sidebarCollapsed ? <b>Thu gọn</b> : null}</button><button type="button" className="student-mobile-close" onClick={() => setMobileMenuOpen(false)}>×</button></div>
          <div className="student-sidebar-class-chip"><i />{!sidebarCollapsed ? <div><span>Lớp đang mở</span><strong>{selectedClass?.name || 'Lớp học'} — {studentMembers.length} học sinh</strong></div> : null}</div>
          <nav>
            <button type="button" className={activePage === 'home' ? 'active' : ''} onClick={() => { setActivePage('home'); setMobileMenuOpen(false) }} title={sidebarCollapsed ? 'Trang chủ' : undefined}><span>⌂</span>{!sidebarCollapsed ? <b>Trang chủ</b> : null}</button>
            {STUDENT_WORKSPACE_SECTIONS.map((section) => <div className="student-nav-section" key={section.id}><button type="button" className="student-nav-section-toggle" onClick={() => { if (typeof window !== 'undefined' && window.matchMedia('(max-width: 780px)').matches) return; setSectionOpen((current) => ({ ...current, [section.id]: !current[section.id] })) }}><span>{sidebarCollapsed ? '⋯' : section.label}</span>{!sidebarCollapsed ? <b>{sectionOpen[section.id] ? '⌃' : '⌄'}</b> : null}</button>{sectionOpen[section.id] ? <div className="student-nav-section-items">{section.items.map((item) => <button type="button" key={item.id} className={activePage === item.id || (item.id === 'assignments' && activePage === 'assignment-detail') ? 'active' : ''} onClick={() => { setActivePage(item.id); setMobileMenuOpen(false) }}><span>{item.icon}</span>{!sidebarCollapsed ? <b>{item.label}</b> : null}{item.id === 'assignments' && pendingAssignments.length ? <em>{pendingAssignments.length}</em> : null}</button>)}</div> : null}</div>)}
          </nav>
          <div className="student-sidebar-bottom"><span className="student-avatar">{studentAvatar ? <img src={studentAvatar} alt="" referrerPolicy="no-referrer" /> : getInitial(studentName)}</span>{!sidebarCollapsed ? <div><strong>{studentName}</strong><small>{selectedClass?.name || 'Học sinh'}</small></div> : null}<button type="button" className="student-sidebar-leave-btn" title="Rời khỏi lớp" aria-label="Rời khỏi lớp" onClick={() => { setLeaveClassError(''); setLeaveClassOpen(true); setMobileMenuOpen(false) }}>{sidebarCollapsed ? '↪' : 'Rời lớp'}</button></div>
        </aside>
        {mobileMenuOpen ? <button type="button" className="student-mobile-backdrop" onClick={() => setMobileMenuOpen(false)} aria-label="Đóng menu" /> : null}

        <section className="student-workspace-main">
          <header className="student-topbar"><button type="button" className="student-workspace-back" onClick={() => setClassView('list')} title="Về danh sách lớp">←</button><button className="student-menu-btn" type="button" onClick={() => { setSidebarCollapsed(false); setSectionOpen({ main: true, secondary: true }); setMobileMenuOpen(true) }}>☰</button><div className="student-topbar-actions"><button type="button" title="Thông báo" onClick={() => setActivePage('notifications')}>◇{unreadStudentNotifications.length ? <i /> : null}</button><div className="student-profile-menu-wrap"><button type="button" className="student-profile-trigger" onClick={() => setProfileMenuOpen((value) => !value)}><span className="student-avatar small">{studentAvatar ? <img src={studentAvatar} alt="" referrerPolicy="no-referrer" /> : getInitial(studentName)}</span><div><strong>{studentName}</strong><small>{selectedClass?.name || 'Học sinh'}</small></div><b>⌄</b></button>{profileMenuOpen ? <div className="student-profile-dropdown"><button type="button" onClick={() => { setActivePage('profile'); setProfileMenuOpen(false) }}>♙ Hồ sơ</button><span>{currentUser?.email || ''}</span></div> : null}</div></div></header>
          <div className="student-page-content">{detailLoading && selectedClassId && ['grades','attendance','schedule','notifications'].includes(activePage) ? <SkeletonRows /> : renderCurrentPage()}</div>
          <nav className="student-mobile-nav">{[['home','⌂','Trang chủ'],['assignments','▤','Bài tập'],['schedule','▦','Lịch'],['messages','☵','Tin nhắn'],['notifications','◇','Thông báo']].map(([id,icon,label]) => <button key={id} type="button" className={activePage === id ? 'active' : ''} onClick={() => setActivePage(id)}><span>{icon}</span><small>{label}</small></button>)}</nav>
        </section>
      </div>

      {joinOpen ? <div className="student-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !joining) setJoinOpen(false) }}><form className="student-modal" onSubmit={handleJoinClass}><header><div><span>THAM GIA LỚP</span><h2>Nhập mã lớp học</h2></div><button type="button" onClick={() => setJoinOpen(false)} disabled={joining}>×</button></header><p>Nhập mã lớp do giáo viên cung cấp. Hệ thống sẽ dùng dữ liệu lớp học hiện tại.</p><label>Mã lớp<input autoFocus value={joinCode} maxLength={12} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="VD: ABCD1234" /></label>{joinError ? <p className="student-error">{joinError}</p> : null}<footer><button type="button" className="student-secondary-btn" onClick={() => setJoinOpen(false)} disabled={joining}>Hủy</button><button type="submit" className="student-primary-btn" disabled={joining || !joinCode.trim()}>{joining ? 'Đang kiểm tra...' : 'Tham gia lớp'}</button></footer></form></div> : null}

      {leaveClassOpen ? <div className="student-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !leavingClass) setLeaveClassOpen(false) }}><section className="student-modal student-leave-class-modal"><header><div><span>LỚP HỌC</span><h2>Rời khỏi lớp?</h2></div><button type="button" onClick={() => setLeaveClassOpen(false)} disabled={leavingClass}>×</button></header><p>Bạn sẽ rời khỏi lớp <strong>{selectedClass?.name || 'hiện tại'}</strong> và lớp này sẽ không còn xuất hiện trong danh sách lớp của bạn.</p><div className="student-leave-class-warning">Hành động này sẽ xóa tư cách thành viên hiện tại của bạn khỏi lớp. Nếu muốn tham gia lại, bạn cần dùng lại mã lớp.</div>{leaveClassError ? <p className="student-error">{leaveClassError}</p> : null}<footer><button className="student-secondary-btn" type="button" disabled={leavingClass} onClick={() => setLeaveClassOpen(false)}>Hủy</button><button className="student-danger-btn" type="button" disabled={leavingClass} onClick={leaveCurrentClass}>{leavingClass ? 'Đang rời lớp...' : 'Rời khỏi lớp'}</button></footer></section></div> : null}

      {recallTarget ? <div className="student-modal-backdrop"><section className="student-modal recall"><header><div><span>TRAO ĐỔI</span><h2>Thu hồi tin nhắn?</h2></div></header><p>Tin nhắn sẽ không còn hiển thị nội dung và tệp đính kèm trong cuộc trò chuyện.</p><footer><button className="student-secondary-btn" type="button" disabled={recalling} onClick={() => setRecallTarget(null)}>Hủy</button><button className="student-danger-btn" type="button" disabled={recalling} onClick={recallMessage}>{recalling ? 'Đang thu hồi...' : 'Thu hồi'}</button></footer></section></div> : null}

      {toast ? <div className="student-toast">✓ {toast}</div> : null}
      <style>{styles}</style>
    </main>
  )
}

const styles = `
.student-learning-page{--sl-blue:#2563eb;--sl-bg:#f8fafc;--sl-card:#fff;--sl-text:#0f172a;--sl-muted:#64748b;--sl-border:#e2e8f0;min-height:100vh;background:var(--sl-bg);color:var(--sl-text);font-family:Inter,Roboto,Arial,sans-serif}.student-learning-page *{box-sizing:border-box}.student-learning-page button,.student-learning-page input,.student-learning-page textarea,.student-learning-page select{font:inherit}.student-workspace-shell{height:calc(100dvh - var(--app-navbar-height,64px));min-height:640px;display:grid;grid-template-columns:220px minmax(0,1fr);overflow:hidden}.student-sidebar{height:100%;background:#fff;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;z-index:50}.student-brand{height:64px;display:flex;align-items:center;gap:10px;padding:0 16px;border-bottom:1px solid #f1f5f9}.student-brand>span{width:34px;height:34px;border-radius:11px;background:#2563eb;color:#fff;display:grid;place-items:center;font-weight:900}.student-brand strong,.student-brand small{display:block}.student-brand strong{font-size:18px}.student-brand small{font-size:10px;color:#94a3b8;margin-top:2px}.student-mobile-close{display:none;margin-left:auto;border:0;background:transparent;font-size:26px;color:#64748b}.student-sidebar nav{flex:1;overflow-y:auto;padding:14px 12px}.student-sidebar nav>p{margin:4px 10px 7px;color:#94a3b8;font-size:10px;font-weight:800;letter-spacing:.12em}.student-sidebar nav>button{width:100%;height:42px;border:0;border-radius:11px;background:transparent;color:#64748b;display:flex;align-items:center;gap:11px;padding:0 11px;margin-bottom:3px;text-align:left;cursor:pointer}.student-sidebar nav>button>span{width:22px;text-align:center;color:#94a3b8}.student-sidebar nav>button>b{font-size:13px;flex:1}.student-sidebar nav>button>em{min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#dbeafe;color:#1d4ed8;display:grid;place-items:center;font-size:10px;font-style:normal}.student-sidebar nav>button:hover{background:#f8fafc;color:#0f172a}.student-sidebar nav>button.active{background:#2563eb;color:#fff;box-shadow:0 6px 15px rgba(37,99,235,.2)}.student-sidebar nav>button.active>span{color:#fff}.student-sidebar nav>button.active>em{background:rgba(255,255,255,.2);color:#fff}.student-sidebar nav hr{border:0;border-top:1px solid #f1f5f9;margin:14px 10px}.student-sidebar-bottom{min-height:72px;border-top:1px solid #f1f5f9;padding:12px;display:flex;align-items:center;gap:10px}.student-sidebar-bottom div{min-width:0}.student-sidebar-bottom strong,.student-sidebar-bottom small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.student-sidebar-bottom strong{font-size:12px}.student-sidebar-bottom small{font-size:10px;color:#94a3b8;margin-top:3px}.student-avatar{width:40px;height:40px;border-radius:50%;background:#8b5cf6;color:#fff;display:grid;place-items:center;font-weight:800;overflow:hidden;flex:0 0 auto}.student-avatar.small{width:34px;height:34px;font-size:12px}.student-avatar.xl{width:86px;height:86px;font-size:30px}.student-avatar img{width:100%;height:100%;object-fit:cover}.student-workspace-main{min-width:0;height:100%;display:flex;flex-direction:column}.student-topbar{height:64px;flex:0 0 64px;background:#fff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;padding:0 22px;gap:16px;z-index:20}.student-menu-btn{display:none;border:0;background:transparent;font-size:22px}.student-topbar-search{height:38px;max-width:480px;flex:1;border:1px solid #e2e8f0;border-radius:11px;background:#f8fafc;display:flex;align-items:center;gap:8px;padding:0 12px;color:#94a3b8}.student-topbar-search input{width:100%;border:0;outline:0;background:transparent;color:#0f172a;font-size:13px}.student-topbar-actions{margin-left:auto;display:flex;align-items:center;gap:7px}.student-topbar-actions>button{position:relative;width:38px;height:38px;border:0;border-radius:11px;background:transparent;color:#64748b;font-size:18px;cursor:pointer}.student-topbar-actions>button:hover{background:#f1f5f9}.student-topbar-actions>button i{position:absolute;right:7px;top:6px;width:7px;height:7px;border-radius:50%;background:#ef4444;border:2px solid #fff}.student-profile-menu-wrap{position:relative}.student-profile-trigger{border:0;background:transparent;display:flex;align-items:center;gap:9px;padding:4px 6px;border-radius:12px;cursor:pointer}.student-profile-trigger:hover{background:#f8fafc}.student-profile-trigger div{text-align:left;min-width:90px}.student-profile-trigger strong,.student-profile-trigger small{display:block}.student-profile-trigger strong{font-size:12px}.student-profile-trigger small{font-size:10px;color:#94a3b8;margin-top:2px}.student-profile-trigger>b{color:#94a3b8}.student-profile-dropdown{position:absolute;right:0;top:48px;width:220px;border:1px solid #e2e8f0;border-radius:13px;background:#fff;box-shadow:0 16px 36px rgba(15,23,42,.15);padding:8px;z-index:60}.student-profile-dropdown button{width:100%;border:0;border-radius:9px;background:transparent;text-align:left;padding:10px;color:#334155;cursor:pointer}.student-profile-dropdown button:hover{background:#f1f5f9}.student-profile-dropdown span{display:block;padding:8px 10px 5px;color:#94a3b8;font-size:10px;overflow:hidden;text-overflow:ellipsis}.student-page-content{flex:1;overflow-y:auto;padding:24px;scrollbar-width:thin}.student-dashboard{max-width:1380px;margin:0 auto}.student-welcome-banner{min-height:160px;border-radius:20px;background:linear-gradient(135deg,#2563eb,#1d4ed8 58%,#1e40af);color:#fff;padding:28px 30px;display:flex;align-items:center;justify-content:space-between;gap:20px;box-shadow:0 14px 32px rgba(37,99,235,.2)}.student-welcome-banner span{font-size:10px;font-weight:800;letter-spacing:.14em;opacity:.8}.student-welcome-banner h1{margin:8px 0 7px;font-size:28px}.student-welcome-banner p{margin:0;font-size:13px;opacity:.86}.student-welcome-banner button{border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.14);color:#fff;border-radius:11px;padding:11px 14px;font-weight:700;cursor:pointer}.student-stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:18px 0}.student-stat-grid article{border:1px solid #e2e8f0;border-radius:15px;background:#fff;padding:16px;display:flex;align-items:center;gap:13px;box-shadow:0 2px 6px rgba(15,23,42,.03)}.student-stat-icon{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-size:18px}.student-stat-icon.blue{background:#eff6ff;color:#2563eb}.student-stat-icon.amber{background:#fffbeb;color:#d97706}.student-stat-icon.green{background:#ecfdf5;color:#059669}.student-stat-icon.purple{background:#f5f3ff;color:#7c3aed}.student-stat-icon.red{background:#fef2f2;color:#dc2626}.student-stat-grid small,.student-stat-grid strong{display:block}.student-stat-grid small{color:#64748b;font-size:11px}.student-stat-grid strong{margin-top:4px;font-size:23px}.student-home-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:16px}.student-panel{border:1px solid #e2e8f0;border-radius:16px;background:#fff;padding:19px;box-shadow:0 2px 8px rgba(15,23,42,.03)}.student-panel-wide{min-height:250px}.student-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}.student-panel-head span,.student-eyebrow{display:block;color:#94a3b8;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.09em}.student-panel-head h2{margin:4px 0 0;font-size:16px}.student-panel-head button{border:0;background:transparent;color:#2563eb;font-size:11px;font-weight:700;cursor:pointer}.student-todo-list{display:grid;gap:8px}.student-todo-list>button{width:100%;display:grid;grid-template-columns:8px 1fr auto;align-items:center;gap:12px;border:1px solid #f1f5f9;border-radius:12px;background:#fbfdff;padding:12px;text-align:left;cursor:pointer}.student-todo-list>button:hover{border-color:#bfdbfe;background:#f8fbff}.student-todo-dot{width:8px;height:8px;border-radius:50%}.student-todo-list strong,.student-todo-list small{display:block}.student-todo-list strong{font-size:12px}.student-todo-list small{margin-top:4px;color:#94a3b8;font-size:10px}.student-todo-list em{border-radius:999px;background:#fff7ed;color:#c2410c;padding:5px 8px;font-size:9px;font-style:normal;font-weight:800}.student-todo-list b{color:#94a3b8}.student-schedule-mini{display:grid;gap:5px}.student-schedule-mini>div{display:grid;grid-template-columns:54px 10px 1fr;gap:9px;align-items:center;padding:7px 0}.student-schedule-mini time{font-size:9px;color:#64748b;text-align:right}.student-schedule-mini>div>span{width:8px;height:8px;border-radius:50%;background:#2563eb}.student-schedule-mini strong,.student-schedule-mini small{display:block}.student-schedule-mini strong{font-size:11px}.student-schedule-mini small{margin-top:2px;color:#94a3b8;font-size:9px}.student-notification-mini{display:grid;gap:10px}.student-notification-mini article{display:flex;gap:10px}.student-notification-mini article>span{width:32px;height:32px;border-radius:10px;background:#eff6ff;color:#2563eb;display:grid;place-items:center;font-weight:800;font-size:11px;flex:0 0 auto}.student-notification-mini strong{display:block;font-size:11px}.student-notification-mini p{margin:3px 0;color:#64748b;font-size:10px;line-height:1.4}.student-notification-mini small{font-size:9px;color:#94a3b8}.student-progress-list{display:grid;gap:13px}.student-progress-list>div>span{display:flex;justify-content:space-between;gap:12px;font-size:11px}.student-progress-list>div>span b{color:#2563eb}.student-progress-list i,.student-attendance-rate i{height:7px;border-radius:999px;background:#eef2f7;display:block;overflow:hidden;margin-top:7px}.student-progress-list i em,.student-attendance-rate i em{height:100%;display:block;border-radius:inherit;background:linear-gradient(90deg,#2563eb,#60a5fa)}.student-empty-state{min-height:170px;display:grid;place-items:center;align-content:center;text-align:center;padding:25px;border:1px dashed #dbe3ef;border-radius:13px;background:#fbfdff}.student-empty-state>span{width:42px;height:42px;border-radius:13px;background:#eff6ff;color:#2563eb;display:grid;place-items:center;font-size:18px}.student-empty-state strong{margin-top:10px;font-size:13px}.student-empty-state p{max-width:330px;margin:5px auto 0;color:#94a3b8;font-size:11px;line-height:1.5}.student-page-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:20px}.student-page-heading.compact{margin-bottom:12px}.student-page-heading h1{margin:0;font-size:24px}.student-page-heading p{margin:5px 0 0;color:#64748b;font-size:12px}.student-primary-btn,.student-secondary-btn,.student-danger-btn{border:0;border-radius:11px;padding:10px 14px;font-weight:700;font-size:12px;cursor:pointer}.student-primary-btn{background:#2563eb;color:#fff;box-shadow:0 5px 12px rgba(37,99,235,.18)}.student-primary-btn.full{width:100%;margin-top:12px}.student-primary-btn:disabled,.student-danger-btn:disabled{opacity:.6;cursor:not-allowed}.student-secondary-btn{background:#fff;color:#475569;border:1px solid #dbe3ef}.student-danger-btn{background:#dc2626;color:#fff}.student-class-select{min-width:190px;border:1px solid #dbe3ef;border-radius:10px;background:#fff;padding:9px 12px;color:#334155}.student-class-grid{display:grid;grid-template-columns:repeat(3,minmax(220px,1fr));gap:16px}.student-class-card{border:1px solid #e2e8f0;border-top:4px solid var(--student-accent,#2563eb);border-radius:16px;background:#fff;overflow:hidden;text-align:left;padding:0;cursor:pointer;box-shadow:0 4px 12px rgba(15,23,42,.04);transition:.15s}.student-class-card:hover{transform:translateY(-3px);box-shadow:0 12px 24px rgba(15,23,42,.1)}.student-class-cover{height:128px;background-size:cover;background-position:center;display:flex;align-items:flex-end;padding:14px}.student-class-cover span{border-radius:999px;background:rgba(15,23,42,.58);color:#fff;padding:5px 8px;font-size:9px;font-weight:800}.student-class-copy{padding:16px}.student-class-copy>strong{display:block;font-size:15px}.student-class-copy>small{display:block;margin-top:5px;color:#64748b;font-size:10px}.student-class-copy>div{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:16px;padding-top:12px;border-top:1px solid #f1f5f9}.student-class-copy>div span{font-size:9px;color:#94a3b8}.student-class-copy>div b{font-size:9px;color:#dc2626}.student-class-copy>div em{font-size:9px;color:#059669;font-style:normal}.student-class-card.skeleton{height:270px;padding:14px}.student-class-card.skeleton div,.student-class-card.skeleton span,.student-class-card.skeleton b,.student-skeleton-row i,.student-skeleton-row b,.student-skeleton-row span{display:block;border-radius:8px;background:linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%);background-size:200% 100%;animation:student-shimmer 1.3s infinite}.student-class-card.skeleton div{height:120px}.student-class-card.skeleton span{height:18px;width:62%;margin-top:18px}.student-class-card.skeleton b{height:12px;width:82%;margin-top:10px}@keyframes student-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}.student-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:16px}.student-search{height:42px;min-width:240px;flex:1;display:flex;align-items:center;gap:8px;border:1px solid #dbe3ef;border-radius:11px;background:#fff;padding:0 12px;color:#94a3b8}.student-search input{width:100%;border:0;outline:0;background:transparent;font-size:12px;color:#0f172a}.student-filter-tabs{display:flex;gap:5px;overflow-x:auto}.student-filter-tabs button{border:1px solid #e2e8f0;border-radius:999px;background:#fff;color:#64748b;padding:8px 11px;font-size:10px;font-weight:700;white-space:nowrap;cursor:pointer}.student-filter-tabs button.active{background:#2563eb;border-color:#2563eb;color:#fff}.student-assignment-list{display:grid;gap:9px}.student-assignment-list>button{width:100%;display:grid;grid-template-columns:46px 1fr 190px;gap:14px;align-items:center;border:1px solid #e2e8f0;border-radius:14px;background:#fff;padding:14px;text-align:left;cursor:pointer}.student-assignment-list>button:hover{border-color:#bfdbfe;box-shadow:0 5px 16px rgba(15,23,42,.06)}.student-assignment-icon{width:42px;height:42px;border-radius:11px;background:#f8fafc;display:grid;place-items:center;font-size:19px}.student-assignment-main strong,.student-assignment-main small{display:block}.student-assignment-main strong{font-size:13px}.student-assignment-main small{font-size:10px;color:#64748b;margin-top:3px}.student-assignment-main p{margin:7px 0 0;color:#94a3b8;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.student-assignment-meta{text-align:right}.student-assignment-meta time{display:block;margin-top:7px;color:#94a3b8;font-size:9px}.student-status{display:inline-flex;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:800}.student-status.pending{background:#fffbeb;color:#b45309}.student-status.submitted,.student-status.present{background:#ecfdf5;color:#047857}.student-status.graded{background:#eff6ff;color:#1d4ed8}.student-status.overdue,.student-status.absent{background:#fef2f2;color:#b91c1c}.student-status.late{background:#fff7ed;color:#c2410c}.student-status.excused{background:#f5f3ff;color:#7c3aed}.student-detail-page{max-width:1260px;margin:0 auto}.student-back-link{border:0;background:transparent;color:#64748b;font-size:11px;cursor:pointer;margin-bottom:15px}.student-detail-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(300px,.7fr);gap:16px}.student-detail-grid h1{margin:8px 0 10px;font-size:24px}.student-detail-meta{display:flex;flex-wrap:wrap;gap:10px;color:#64748b;font-size:10px;padding-bottom:16px;border-bottom:1px solid #f1f5f9}.student-rich-content{padding:18px 0;white-space:pre-wrap;line-height:1.7;color:#334155;font-size:12px}.student-attachment-list h3{font-size:12px}.student-attachment-list a,.student-submitted-box a{display:block;color:#2563eb;text-decoration:none;font-size:11px;margin-top:7px}.student-submission-card textarea{width:100%;resize:vertical;border:1px solid #dbe3ef;border-radius:11px;padding:11px;outline:0;font-size:12px;color:#0f172a;background:#fff}.student-submission-card textarea:focus{border-color:#93c5fd;box-shadow:0 0 0 3px rgba(37,99,235,.08)}.student-file-picker{display:flex;align-items:center;justify-content:center;border:1px dashed #cbd5e1;border-radius:11px;padding:10px;margin-top:9px;color:#64748b;font-size:10px;font-weight:700;cursor:pointer}.student-file-picker input,.student-chat-file input{display:none}.student-submitted-box{border-radius:12px;background:#f8fafc;padding:12px;margin:10px 0}.student-submitted-box strong,.student-submitted-box small{display:block}.student-submitted-box strong{color:#059669;font-size:12px}.student-submitted-box small{color:#94a3b8;font-size:9px;margin-top:4px}.student-submitted-box p{font-size:10px;color:#64748b;line-height:1.5}.student-feedback{margin-top:12px;padding-top:10px;border-top:1px solid #e2e8f0}.student-muted{color:#94a3b8;font-size:11px;line-height:1.5}.student-error{border-radius:9px;background:#fef2f2;color:#b91c1c;padding:9px 10px;font-size:10px}.student-schedule-table{border:1px solid #e2e8f0;border-radius:14px;background:#fff;overflow:hidden}.student-schedule-table-head,.student-schedule-row{display:grid;grid-template-columns:120px 130px 1fr 160px;gap:12px;align-items:center;padding:12px 15px}.student-schedule-table-head{background:#f8fafc;color:#64748b;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.student-schedule-row{border-top:1px solid #f1f5f9}.student-schedule-row time,.student-schedule-row b,.student-schedule-row>span{font-size:10px}.student-schedule-row div strong,.student-schedule-row div small{display:block}.student-schedule-row div strong{font-size:11px}.student-schedule-row div small{margin-top:3px;color:#94a3b8;font-size:9px}.student-schedule-row>span em{display:block;width:max-content;margin-top:5px;border-radius:999px;background:#fff7ed;color:#c2410c;padding:4px 6px;font-size:8px;font-style:normal}.student-grade-hero{border-radius:18px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;padding:22px;margin-bottom:16px}.student-grade-hero span{font-size:10px;opacity:.8}.student-grade-hero strong{display:block;font-size:35px;margin:5px 0}.student-grade-hero p{margin:0;font-size:10px;opacity:.8}.student-grade-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.student-grade-pill{border-radius:999px;background:#eff6ff;color:#1d4ed8;padding:6px 9px;font-size:11px}.student-score-list{display:grid;gap:7px}.student-score-list>div{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid #f1f5f9;padding-top:9px}.student-score-list strong,.student-score-list small{display:block}.student-score-list strong{font-size:11px}.student-score-list small{font-size:9px;color:#94a3b8;margin-top:2px}.student-score-list>div>b{font-size:13px;color:#2563eb}.student-stat-grid.attendance{margin-top:0}.student-attendance-rate{border:1px solid #e2e8f0;border-radius:15px;background:#fff;padding:18px;margin-bottom:15px}.student-attendance-rate>div{display:flex;align-items:center;justify-content:space-between}.student-attendance-rate span{font-size:11px;color:#64748b}.student-attendance-rate strong{font-size:21px}.student-attendance-rate p{margin:8px 0 0;color:#94a3b8;font-size:9px}.student-attendance-list{display:grid;gap:8px}.student-attendance-list article{display:grid;grid-template-columns:120px 140px 1fr;align-items:center;gap:12px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;padding:12px}.student-attendance-list time{font-size:10px;font-weight:700}.student-attendance-list p{margin:0;color:#64748b;font-size:10px}.student-notification-page{display:grid;gap:10px;max-width:900px}.student-notification-page article{display:flex;gap:12px;border:1px solid #e2e8f0;border-radius:14px;background:#fff;padding:15px}.student-notification-page article>div{flex:1;min-width:0}.student-notification-page header{display:flex;align-items:center;justify-content:space-between;gap:12px}.student-notification-page header strong{font-size:12px}.student-notification-page header time{font-size:9px;color:#94a3b8}.student-notification-page article small{color:#64748b;font-size:9px}.student-notification-page article p{font-size:11px;color:#475569;line-height:1.6}.student-notification-files{display:flex;flex-wrap:wrap;gap:6px}.student-notification-files a{border-radius:8px;background:#eff6ff;color:#2563eb;text-decoration:none;padding:6px 8px;font-size:9px}.student-message-layout{height:calc(100dvh - var(--app-navbar-height,64px) - 112px);display:grid;grid-template-columns:320px minmax(0,1fr);border:1px solid #e2e8f0;border-radius:16px;background:#fff;overflow:hidden}.student-conversation-list{border-right:1px solid #e2e8f0;padding:16px;overflow-y:auto}.student-conversation-list>button{width:100%;border:0;border-radius:12px;background:transparent;display:flex;align-items:center;gap:10px;padding:10px;text-align:left;cursor:pointer}.student-conversation-list>button:hover,.student-conversation-list>button.active{background:#f1f5f9}.student-conversation-list>button>div{min-width:0}.student-conversation-list strong,.student-conversation-list small,.student-conversation-list p{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.student-conversation-list strong{font-size:11px}.student-conversation-list small{font-size:9px;color:#64748b;margin-top:2px}.student-conversation-list p{margin:4px 0 0;font-size:9px;color:#94a3b8}.student-chat-panel{min-width:0;display:flex;flex-direction:column}.student-chat-panel>header{height:64px;flex:0 0 64px;border-bottom:1px solid #f1f5f9;padding:11px 15px;display:flex;align-items:center;gap:10px}.student-chat-panel>header strong,.student-chat-panel>header small{display:block}.student-chat-panel>header strong{font-size:12px}.student-chat-panel>header small{margin-top:3px;color:#94a3b8;font-size:9px}.student-chat-messages{flex:1;overflow-y:auto;padding:18px;background:#fbfdff}.student-message{display:flex;align-items:flex-end;gap:5px;margin-bottom:10px;justify-content:flex-start}.student-message.own{justify-content:flex-end}.student-message>div{max-width:68%;border-radius:15px 15px 15px 4px;background:#eef2f7;color:#334155;padding:9px 11px}.student-message.own>div{border-radius:15px 15px 4px 15px;background:#2563eb;color:#fff}.student-message p{margin:0;font-size:11px;line-height:1.5}.student-message em{font-size:10px;opacity:.7}.student-message a{display:block;color:inherit;font-size:10px;margin-top:4px}.student-message small{display:block;margin-top:5px;font-size:8px;opacity:.65}.student-message>button{border:0;background:transparent;color:#94a3b8;cursor:pointer}.student-chat-panel>footer{border-top:1px solid #f1f5f9;padding:10px}.student-chat-panel>footer>div:last-child{display:flex;align-items:center;gap:8px}.student-chat-panel>footer input{flex:1;height:40px;border:1px solid #e2e8f0;border-radius:11px;padding:0 11px;outline:0}.student-chat-panel>footer>div:last-child>button{width:40px;height:40px;border:0;border-radius:11px;background:#2563eb;color:#fff;cursor:pointer}.student-chat-panel>footer>div:last-child>button:disabled{opacity:.45}.student-chat-file{width:40px;height:40px;border-radius:11px;background:#f1f5f9;display:grid;place-items:center;color:#64748b;cursor:pointer}.student-file-chip{display:flex!important;align-items:center;justify-content:space-between;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:7px 9px;margin-bottom:7px;font-size:9px;color:#64748b}.student-file-chip button{border:0;background:transparent;color:#64748b}.student-lesson-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.student-lesson-icon{width:40px;height:40px;border-radius:12px;background:#eff6ff;color:#2563eb;display:grid;place-items:center}.student-lesson-grid article>small{display:block;margin-top:14px;color:#64748b;font-size:9px}.student-lesson-grid h2{font-size:14px;margin:5px 0}.student-lesson-grid p{min-height:42px;color:#64748b;font-size:10px;line-height:1.5}.student-lesson-grid footer{display:flex;justify-content:space-between;gap:10px;border-top:1px solid #f1f5f9;padding-top:10px;color:#94a3b8;font-size:9px}.student-resource-list{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.student-resource-list>a{display:flex;align-items:center;gap:11px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;padding:13px;text-decoration:none;color:#334155}.student-resource-list>a>span{width:38px;height:38px;border-radius:10px;background:#eff6ff;color:#2563eb;display:grid;place-items:center}.student-resource-list>a>div{flex:1;min-width:0}.student-resource-list strong,.student-resource-list small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.student-resource-list strong{font-size:11px}.student-resource-list small{margin-top:3px;color:#94a3b8;font-size:9px}.student-resource-list b{color:#94a3b8}.student-profile-card{max-width:760px;border:1px solid #e2e8f0;border-radius:17px;background:#fff;padding:22px;display:flex;align-items:flex-start;gap:20px}.student-profile-card>div{flex:1}.student-profile-card h2{margin:3px 0 4px}.student-profile-card>div>p{margin:0;color:#64748b;font-size:11px}.student-profile-fields{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:18px}.student-profile-fields span{border-radius:11px;background:#f8fafc;padding:11px}.student-profile-fields small,.student-profile-fields strong{display:block}.student-profile-fields small{font-size:9px;color:#94a3b8}.student-profile-fields strong{font-size:11px;margin-top:4px}.student-modal-backdrop{position:fixed;inset:0;z-index:100;background:rgba(15,23,42,.52);display:grid;place-items:center;padding:18px}.student-modal{width:min(480px,100%);border:1px solid #dbe3ef;border-radius:17px;background:#fff;padding:20px;box-shadow:0 24px 70px rgba(15,23,42,.25)}.student-modal>header{display:flex;align-items:flex-start;justify-content:space-between;gap:15px}.student-modal>header span{color:#2563eb;font-size:9px;font-weight:800;letter-spacing:.1em}.student-modal>header h2{margin:5px 0 0;font-size:20px}.student-modal>header button{border:0;background:#f1f5f9;width:32px;height:32px;border-radius:50%;font-size:20px;color:#64748b;cursor:pointer}.student-modal>p{color:#64748b;font-size:11px;line-height:1.5}.student-modal label{display:grid;gap:6px;color:#475569;font-size:10px;font-weight:700}.student-modal label input{width:100%;border:1px solid #dbe3ef;border-radius:10px;padding:11px 12px;outline:0;text-transform:uppercase;letter-spacing:.1em}.student-modal>footer{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.student-toast{position:fixed;right:22px;bottom:22px;z-index:120;border-radius:12px;background:#0f172a;color:#fff;padding:11px 14px;font-size:11px;box-shadow:0 14px 30px rgba(15,23,42,.25)}.student-skeleton-list{display:grid;gap:9px}.student-skeleton-row{height:68px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;padding:12px;display:flex;gap:10px}.student-skeleton-row i{width:42px;height:42px}.student-skeleton-row div{flex:1}.student-skeleton-row b{height:12px;width:38%;margin:4px 0 8px}.student-skeleton-row span{height:9px;width:65%}.student-mobile-nav{display:none}.student-hub-shell{max-width:1440px;margin:0 auto;padding:28px 24px}.student-workspace-back{width:36px;height:36px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;color:#334155;cursor:pointer;font-size:18px;flex:0 0 auto}.student-mobile-backdrop{display:none}
.student-hub-search{max-width:760px;height:46px;margin:0 0 22px;border:1px solid #dbe3ef;border-radius:13px;background:#fff;display:flex;align-items:center;gap:10px;padding:0 14px;color:#94a3b8}.student-hub-search input{width:100%;border:0;outline:0;background:transparent;color:#0f172a;font-size:13px}.student-nav-section>p{margin:14px 10px 7px!important}.student-nav-section>button{width:100%;height:42px;border:0;border-radius:11px;background:transparent;color:#64748b;display:flex;align-items:center;gap:11px;padding:0 11px;margin-bottom:3px;text-align:left;cursor:pointer}.student-nav-section>button>span{width:22px;text-align:center;color:#94a3b8}.student-nav-section>button>b{font-size:13px;flex:1}.student-nav-section>button>em{min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#dbeafe;color:#1d4ed8;display:grid;place-items:center;font-size:10px;font-style:normal}.student-nav-section>button:hover{background:#f8fafc;color:#0f172a}.student-nav-section>button.active{background:#2563eb;color:#fff;box-shadow:0 6px 15px rgba(37,99,235,.2)}.student-nav-section>button.active>span{color:#fff}.student-nav-section>button.active>em{background:rgba(255,255,255,.2);color:#fff}.student-nav-section>hr{border:0;border-top:1px solid #f1f5f9;margin:14px 10px}.student-class-workspace-fullscreen .student-learning-page:not(.student-class-hub){width:100%!important;max-width:none!important;margin:0!important}.student-class-workspace-fullscreen .student-workspace-shell{width:100%!important;max-width:none!important}.dark .student-hub-search{background:#111827;border-color:#263244}.dark .student-hub-search input{color:#f8fafc}.dark .student-nav-section>button{color:#cbd5e1}.dark .student-nav-section>button:hover{background:#1e293b;color:#f8fafc}.dark .student-nav-section>button.active{background:#2563eb;color:#fff}.dark .student-nav-section>hr{border-color:#263244}.dark .student-learning-page{--sl-bg:#0b1020;--sl-card:#111827;--sl-text:#f8fafc;--sl-muted:#94a3b8;--sl-border:#263244;background:#0b1020;color:#f8fafc}.dark .student-sidebar,.dark .student-topbar,.dark .student-panel,.dark .student-stat-grid article,.dark .student-class-card,.dark .student-assignment-list>button,.dark .student-schedule-table,.dark .student-attendance-rate,.dark .student-attendance-list article,.dark .student-notification-page article,.dark .student-message-layout,.dark .student-profile-card,.dark .student-resource-list>a,.dark .student-modal,.dark .student-profile-dropdown,.dark .student-search,.dark .student-class-select{background:#111827;border-color:#263244;color:#f8fafc}.dark .student-topbar-search,.dark .student-chat-messages,.dark .student-submitted-box,.dark .student-profile-fields span,.dark .student-schedule-table-head,.dark .student-empty-state{background:#0f172a;border-color:#334155}.dark .student-sidebar nav>button:hover,.dark .student-conversation-list>button:hover,.dark .student-conversation-list>button.active,.dark .student-profile-trigger:hover{background:#1e293b;color:#f8fafc}.dark .student-topbar-search input,.dark .student-search input,.dark .student-submission-card textarea,.dark .student-chat-panel>footer input,.dark .student-modal input{color:#f8fafc;background:#0f172a;border-color:#334155}.dark .student-class-copy>div,.dark .student-schedule-row,.dark .student-score-list>div,.dark .student-chat-panel>header,.dark .student-chat-panel>footer,.dark .student-conversation-list{border-color:#263244}.dark .student-assignment-icon,.dark .student-chat-file{background:#1e293b}.dark .student-rich-content,.dark .student-resource-list>a{color:#cbd5e1}.dark .student-muted,.dark .student-page-heading p,.dark .student-class-copy>small,.dark .student-assignment-main small,.dark .student-assignment-main p{color:#94a3b8}
@media(max-width:1050px){.student-stat-grid{grid-template-columns:repeat(2,1fr)}.student-class-grid{grid-template-columns:repeat(2,1fr)}.student-home-grid{grid-template-columns:1fr}.student-grade-grid{grid-template-columns:1fr}.student-lesson-grid{grid-template-columns:repeat(2,1fr)}.student-detail-grid{grid-template-columns:1fr}.student-message-layout{grid-template-columns:280px minmax(0,1fr)}}
@media(max-width:780px){.student-workspace-shell{display:block;height:auto;min-height:100vh}.student-sidebar{position:fixed;left:0;top:0;transform:translateX(-105%);transition:transform .2s;width:220px}.student-sidebar.mobile-open{transform:translateX(0)}.student-mobile-close{display:block}.student-mobile-backdrop{display:block;position:fixed;inset:0;z-index:40;border:0;background:rgba(15,23,42,.45)}.student-workspace-main{height:calc(100dvh - var(--app-navbar-height,64px))}.student-menu-btn{display:block}.student-topbar{padding:0 12px}.student-profile-trigger>div,.student-profile-trigger>b{display:none}.student-page-content{padding:16px 14px 74px}.student-mobile-nav{position:fixed;left:0;right:0;bottom:0;z-index:30;height:60px;background:#fff;border-top:1px solid #e2e8f0;display:grid;grid-template-columns:repeat(5,1fr);padding-bottom:env(safe-area-inset-bottom)}.student-mobile-nav button{border:0;background:transparent;color:#94a3b8;display:grid;place-items:center;align-content:center;gap:2px}.student-mobile-nav button.active{color:#2563eb}.student-mobile-nav span{font-size:17px}.student-mobile-nav small{font-size:8px}.dark .student-mobile-nav{background:#111827;border-color:#263244}.student-message-layout{height:calc(100vh - 150px);grid-template-columns:1fr}.student-conversation-list{display:none}.student-chat-panel{height:100%}.student-schedule-table{overflow-x:auto}.student-schedule-table-head,.student-schedule-row{min-width:720px}.student-resource-list{grid-template-columns:1fr}}
@media(max-width:560px){.student-welcome-banner{padding:22px;align-items:flex-start;flex-direction:column}.student-welcome-banner h1{font-size:23px}.student-welcome-banner button{width:100%}.student-stat-grid{grid-template-columns:1fr 1fr}.student-stat-grid article{padding:12px}.student-stat-grid strong{font-size:19px}.student-class-grid,.student-lesson-grid{grid-template-columns:1fr}.student-toolbar{align-items:stretch;flex-direction:column}.student-search{min-width:0}.student-assignment-list>button{grid-template-columns:40px 1fr}.student-assignment-meta{grid-column:1/-1;text-align:left;padding-left:52px}.student-page-heading{align-items:stretch;flex-direction:column}.student-page-heading .student-primary-btn,.student-class-select{width:100%}.student-profile-card{align-items:center;flex-direction:column;text-align:center}.student-profile-fields{grid-template-columns:1fr 1fr;text-align:left}.student-topbar-search{max-width:none}.student-topbar-actions>button:first-child,.student-topbar-actions>button:nth-child(2){display:none}}

/* 2026-08-20: student hub reference layout + isolated viewport scrolling */
.student-class-hub{background:#fff;min-height:100vh}.student-hub-shell{max-width:1420px;margin:0 auto;padding:22px 24px 72px}.student-hub-toolbar{display:grid;grid-template-columns:minmax(0,1fr) 48px;gap:14px;align-items:center;margin-bottom:16px}.student-hub-toolbar .student-hub-search{max-width:none;width:100%;height:48px;margin:0;border:1px solid #d7e0ed;border-radius:13px;box-shadow:0 4px 14px rgba(15,23,42,.025)}.student-hub-join-btn{width:48px;height:48px;border:0;border-radius:13px;background:#2563eb;color:#fff;font-size:29px;line-height:1;cursor:pointer;box-shadow:0 9px 22px rgba(37,99,235,.23);transition:transform .15s ease,box-shadow .15s ease}.student-hub-join-btn:hover{transform:translateY(-1px);box-shadow:0 12px 26px rgba(37,99,235,.3)}.student-hub-due{min-height:116px;border:1px solid #dce4ef;border-radius:18px;background:#fff;padding:18px 20px;display:flex;align-items:flex-start;justify-content:space-between;gap:18px;box-shadow:0 8px 24px rgba(15,23,42,.04);margin-bottom:20px}.student-hub-due>div{min-width:0;flex:1}.student-hub-due>div>span{display:block;color:#64748b;font-size:11px;font-weight:900;letter-spacing:.05em}.student-hub-due>div>strong{display:block;margin-top:8px;color:#0f172a;font-size:15px}.student-hub-due>div>p{margin:14px 0 0;color:#94a3b8;font-size:12px}.student-hub-due-count{min-width:34px;height:34px;border-radius:11px;background:#eff6ff;color:#2563eb;display:grid;place-items:center;font-size:15px}.student-hub-due-list{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.student-hub-due-list button{max-width:320px;border:1px solid #e5eaf2;border-radius:10px;background:#f8fafc;padding:8px 10px;text-align:left;cursor:pointer}.student-hub-due-list b,.student-hub-due-list small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.student-hub-due-list b{color:#334155;font-size:11px}.student-hub-due-list small{margin-top:3px;color:#94a3b8;font-size:9px}.student-hub-class-grid{grid-template-columns:repeat(auto-fill,minmax(236px,256px));gap:22px;align-items:start}.student-hub-class-card{min-height:304px;position:relative;text-align:left;border-radius:19px;overflow:visible}.student-hub-class-card .student-class-cover{height:144px;border-radius:18px 18px 0 0;background-size:cover;background-position:center}.student-hub-class-card .student-class-cover>span{display:none}.student-hub-class-badge{position:absolute;left:18px;top:116px;width:48px;height:48px;border-radius:12px;background:#eef2ff;color:#2563eb;border:1px solid #e3e8f1;display:grid;place-items:center;font-weight:900;overflow:hidden;box-shadow:0 7px 18px rgba(15,23,42,.13)}.student-hub-class-badge img{width:100%;height:100%;object-fit:cover}.student-hub-class-card .student-class-copy{padding:35px 17px 17px}.student-hub-class-card .student-class-copy>strong{font-size:15px;color:#0f172a}.student-hub-teacher-row{margin-top:4px;display:flex;align-items:center;justify-content:space-between;gap:10px}.student-hub-teacher-row small{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#64748b;font-size:12px}.student-hub-teacher-row em{flex:0 0 auto;color:#64748b;font-size:10px;font-style:normal}.student-hub-class-card .student-class-copy>p{margin:18px 0 0;color:#94a3b8;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.student-class-workspace-fullscreen .student-learning-page:not(.student-class-hub){height:calc(100dvh - var(--student-workspace-top,0px))!important;min-height:0!important;overflow:hidden!important}.student-class-workspace-fullscreen .student-workspace-shell{height:100%!important;min-height:0!important;overflow:hidden!important}.student-class-workspace-fullscreen .student-workspace-main{height:100%!important;min-height:0!important;overflow:hidden}.student-class-workspace-fullscreen .student-page-content{min-height:0;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}.student-class-workspace-fullscreen .student-sidebar{height:100%!important;max-height:none!important}.dark .student-class-hub{background:#0b1020}.dark .student-hub-due{background:#111827;border-color:#263244}.dark .student-hub-due>div>strong{color:#f8fafc}.dark .student-hub-due-list button{background:#0f172a;border-color:#334155}.dark .student-hub-due-list b{color:#e2e8f0}.dark .student-hub-class-card .student-class-copy>strong{color:#f8fafc}.dark .student-hub-join-btn{background:#2563eb}
@media(max-width:1050px){.student-hub-shell{padding-left:18px;padding-right:18px}.student-hub-class-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.student-hub-class-card{width:100%}}
@media(max-width:780px){.student-workspace-shell.sidebar-collapsed{grid-template-columns:1fr}.student-sidebar.collapsed nav>button,.student-sidebar.collapsed .student-nav-section-items>button{justify-content:flex-start}.student-class-workspace-fullscreen .student-workspace-shell{display:block;height:100%!important;min-height:0!important}.student-class-workspace-fullscreen .student-workspace-main{height:100%!important}.student-sidebar{height:100%!important;max-height:100%!important}.student-topbar{height:58px;flex-basis:58px}.student-page-content{padding:16px 14px calc(76px + env(safe-area-inset-bottom))}.student-hub-class-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.student-hub-due{padding:16px}.student-hub-due-list{display:grid}.student-hub-due-list button{max-width:none}.student-message-layout{height:calc(100dvh - 150px)}}
@media(max-width:560px){.student-hub-shell{padding:14px 12px 56px}.student-hub-toolbar{grid-template-columns:minmax(0,1fr) 44px;gap:9px}.student-hub-toolbar .student-hub-search,.student-hub-join-btn{height:44px}.student-hub-join-btn{width:44px;border-radius:11px;font-size:25px}.student-hub-due{min-height:104px;border-radius:14px;margin-bottom:16px}.student-hub-due>div>strong{font-size:13px}.student-hub-class-grid{grid-template-columns:1fr;gap:14px}.student-hub-class-card{min-height:286px}.student-hub-class-card .student-class-cover{height:132px}.student-hub-class-badge{top:106px}.student-topbar-search{display:none}.student-workspace-back{order:2}.student-menu-btn{order:1}.student-topbar-actions{order:3}.student-stat-grid{grid-template-columns:1fr}.student-stat-grid article{min-height:72px}.student-profile-fields{grid-template-columns:1fr}.student-page-content{padding-left:10px;padding-right:10px}.student-welcome-banner{border-radius:15px}.student-panel,.student-attendance-rate,.student-profile-card{border-radius:13px}}


/* 2026-08-20: student workspace matched to teacher classroom reference */
.student-workspace-shell{grid-template-columns:280px minmax(0,1fr)}.student-workspace-shell.sidebar-collapsed{grid-template-columns:78px minmax(0,1fr)}
.student-sidebar{background:#fff;border-right:1px solid #e2e8f0}
.student-sidebar-collapse-row{min-height:66px;padding:11px 14px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:8px}.student-sidebar-back-list{height:42px;border:1px solid #dbe3ef;border-radius:12px;background:#f8fafc;color:#334155;padding:0 12px;font-weight:800;cursor:pointer}.student-sidebar-class-chip{margin:16px 16px 10px;border:1px solid color-mix(in srgb,var(--student-accent,#2563eb) 26%,#e2e8f0);border-radius:14px;background:color-mix(in srgb,var(--student-accent,#2563eb) 7%,#fff);padding:13px;display:flex;align-items:center;gap:10px}.student-sidebar-class-chip i{width:9px;height:9px;border-radius:50%;background:#10b981;box-shadow:0 0 9px rgba(16,185,129,.6);flex:0 0 auto}.student-sidebar-class-chip span,.student-sidebar-class-chip strong{display:block}.student-sidebar-class-chip span{font-size:10px;color:#64748b;font-weight:700}.student-sidebar-class-chip strong{margin-top:3px;font-size:12px;color:#0f172a}.student-sidebar nav{padding:7px 14px 14px}.student-sidebar.collapsed .student-sidebar-collapse-row{justify-content:center;padding:11px 8px}.student-sidebar.collapsed .student-sidebar-back-list{width:44px;padding:0}.student-sidebar.collapsed .student-sidebar-class-chip{width:44px;height:44px;margin:12px auto;padding:0;justify-content:center}.student-sidebar.collapsed nav{padding:7px 8px 14px}.student-sidebar.collapsed nav>button,.student-sidebar.collapsed .student-nav-section-items>button{justify-content:center;padding:8px}.student-sidebar.collapsed .student-nav-section-toggle{justify-content:center}.student-sidebar.collapsed .student-sidebar-bottom{justify-content:center;padding:12px 8px}.student-sidebar nav>button,.student-nav-section-items>button{width:100%;min-height:44px;border:0;border-radius:11px;background:transparent;color:#64748b;display:flex;align-items:center;gap:11px;padding:8px 11px;margin-bottom:3px;text-align:left;cursor:pointer}.student-sidebar nav>button.active,.student-nav-section-items>button.active{background:#dbeafe;color:#2563eb;box-shadow:inset 3px 0 #2563eb}.student-sidebar nav>button>span,.student-nav-section-items>button>span{width:25px;height:25px;border-radius:8px;background:#f1f5f9;display:grid;place-items:center;color:#475569;flex:0 0 auto}.student-sidebar nav>button.active>span,.student-nav-section-items>button.active>span{background:#fff;color:#2563eb}.student-sidebar nav>button>b,.student-nav-section-items>button>b{font-size:13px;flex:1}.student-nav-section{margin-top:10px;padding-top:9px;border-top:1px solid #e2e8f0}.student-nav-section-toggle{width:100%;border:0;background:transparent;color:#475569;display:flex;justify-content:space-between;align-items:center;padding:7px 10px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;cursor:pointer}.student-nav-section-toggle b{font-size:12px}.student-nav-section-items{display:grid;gap:2px}
.student-class-home{display:grid;gap:18px;max-width:1500px;margin:0 auto}.student-class-home-hero{min-height:255px;border-radius:22px;background-size:cover;background-position:center;overflow:hidden;position:relative;border:1px solid #e2e8f0}.student-class-home-overlay{position:absolute;inset:0;padding:28px;display:flex;align-items:flex-end;justify-content:space-between;gap:18px;background:linear-gradient(180deg,rgba(15,23,42,.08),rgba(15,23,42,.83));color:#fff}.student-class-home-overlay>div>span{font-size:11px;font-weight:900;letter-spacing:.08em}.student-class-home-overlay h1{margin:8px 0 4px;font-size:34px}.student-class-home-overlay p{margin:0;color:#e2e8f0}.student-home-status{align-self:flex-start;border-radius:999px;background:#dcfce7;color:#166534;padding:8px 12px;font-size:11px;font-weight:900}.student-home-reference-grid{display:grid;grid-template-columns:minmax(260px,.75fr) minmax(0,2.25fr);gap:16px}.student-home-left-column{display:grid;gap:16px}.student-home-ref-card,.student-home-notification-panel{border:1px solid #e2e8f0;border-radius:18px;background:#fff;padding:20px;border-top:4px solid var(--student-accent,#2563eb);box-shadow:0 4px 16px rgba(15,23,42,.04)}.student-home-ref-card>span,.student-home-panel-head span{display:block;color:#64748b;font-size:10px;font-weight:900;letter-spacing:.08em}.student-home-ref-card>strong,.student-home-panel-head strong{display:block;margin-top:6px;color:#0f172a}.student-home-class-code{font-size:28px;letter-spacing:.12em}.student-home-ref-card>p{margin:12px 0 0;color:#64748b;font-size:11px}.student-home-deadline-list{display:grid;gap:7px;margin-top:12px}.student-home-deadline-list button{border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;padding:9px 10px;text-align:left;cursor:pointer}.student-home-deadline-list b,.student-home-deadline-list small{display:block}.student-home-deadline-list b{color:#0f172a;font-size:11px}.student-home-deadline-list small{margin-top:3px;color:#94a3b8;font-size:9px}.student-home-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.student-home-panel-head button{border:0;border-radius:11px;background:var(--student-accent,#2563eb);color:#fff;padding:10px 13px;font-weight:800;cursor:pointer}.student-home-notification-list{display:grid;gap:10px;margin-top:14px}.student-home-notification-list article{border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;padding:13px}.student-home-notification-list strong{color:#0f172a;font-size:12px}.student-home-notification-list p{margin:5px 0;color:#475569;font-size:11px;line-height:1.5}.student-home-notification-list small{color:#94a3b8;font-size:9px}
.dark .student-sidebar-class-chip{background:#0f172a;border-color:#334155}.dark .student-sidebar-class-chip strong{color:#f8fafc}.dark .student-nav-section{border-color:#263244}.dark .student-nav-section-toggle{color:#94a3b8}.dark .student-nav-section-items>button{color:#cbd5e1}.dark .student-nav-section-items>button.active{background:#172554;color:#93c5fd}.dark .student-home-ref-card,.dark .student-home-notification-panel{background:#111827;border-color:#263244}.dark .student-home-ref-card>strong,.dark .student-home-panel-head strong,.dark .student-home-deadline-list b,.dark .student-home-notification-list strong{color:#f8fafc}.dark .student-home-deadline-list button,.dark .student-home-notification-list article{background:#0f172a;border-color:#334155}.dark .student-home-notification-list p{color:#cbd5e1}
@media(max-width:1050px){.student-workspace-shell{grid-template-columns:230px minmax(0,1fr)}.student-home-reference-grid{grid-template-columns:1fr 2fr}.student-class-home-hero{min-height:220px}}
@media(max-width:780px){.student-workspace-shell.sidebar-collapsed{grid-template-columns:1fr}.student-sidebar.collapsed nav>button,.student-sidebar.collapsed .student-nav-section-items>button{justify-content:flex-start}.student-class-workspace-fullscreen .student-learning-page:not(.student-class-hub){height:100dvh!important}.student-workspace-shell{grid-template-columns:1fr}.student-sidebar{width:min(300px,86vw)!important;top:0!important;height:100dvh!important}.student-home-reference-grid{grid-template-columns:1fr}.student-class-home-hero{min-height:200px}.student-class-home-overlay{padding:20px}.student-class-home-overlay h1{font-size:27px}.student-topbar{height:56px;flex-basis:56px}.student-topbar-search{display:none}.student-topbar-actions{display:none}.student-page-content{padding:14px 12px calc(72px + env(safe-area-inset-bottom))}.student-mobile-nav{height:58px}.student-mobile-close{display:block}.student-sidebar-back-list b{display:inline}.student-home-panel-head{align-items:flex-start}.student-home-panel-head button{padding:8px 10px}}
@media(max-width:520px){.student-class-home-hero{min-height:176px;border-radius:15px}.student-class-home-overlay{padding:16px}.student-class-home-overlay h1{font-size:23px}.student-home-reference-grid{gap:12px}.student-home-left-column{gap:12px}.student-home-ref-card,.student-home-notification-panel{padding:15px;border-radius:14px}.student-home-class-code{font-size:23px}.student-home-panel-head{flex-direction:column}.student-home-panel-head button{width:100%}.student-mobile-nav small{font-size:8px}}


/* 2026-08-20: student sidebar/home aligned with teacher workspace reference */
.student-sidebar nav{min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}.student-nav-section-toggle{position:sticky;top:0;z-index:2;background:#fff}.student-nav-section-toggle>span{display:block;flex:1 1 auto;min-width:0;white-space:nowrap!important;word-break:keep-all!important;overflow-wrap:normal!important;text-align:left;line-height:1.2}.student-sidebar:not(.collapsed) .student-nav-section-toggle{min-width:0;white-space:nowrap!important}.student-class-home{max-width:1540px;margin:0 auto}.student-class-home-hero{min-height:255px;border-radius:20px;background-size:cover;background-position:center;overflow:hidden;box-shadow:0 8px 22px rgba(15,23,42,.08)}.student-class-home-overlay{min-height:255px;padding:30px;display:flex;align-items:flex-end;background:linear-gradient(90deg,rgba(2,20,38,.86),rgba(2,20,38,.36) 52%,rgba(2,20,38,.28));color:#fff}.student-class-home-overlay span{font-size:11px;font-weight:900;letter-spacing:.08em}.student-class-home-overlay h1{margin:10px 0 8px;font-size:34px}.student-class-home-overlay p{margin:0;color:#e2e8f0;font-weight:600}.student-home-reference-grid{display:grid;grid-template-columns:minmax(270px,360px) minmax(0,1fr);gap:18px;margin-top:18px}.student-home-left-stack{display:grid;gap:16px}.student-home-ref-card,.student-home-notification-panel{border:1px solid #e2e8f0;border-top:4px solid var(--student-accent,#2563eb);border-radius:17px;background:#fff;padding:20px;box-shadow:0 4px 16px rgba(15,23,42,.04)}.student-home-ref-card>span,.student-home-panel-head>span{display:block;color:#64748b;font-size:10px;font-weight:900;letter-spacing:.08em}.student-home-ref-card>strong{display:block;margin:16px 0 8px;color:#0f172a;font-size:26px;letter-spacing:.12em}.student-home-ref-card>p{margin:0;color:#94a3b8;font-size:12px;line-height:1.5}.student-home-deadline-list{display:grid;gap:8px;margin-top:14px}.student-home-deadline-list button{border:1px solid #e2e8f0;border-radius:11px;background:#f8fafc;padding:10px 11px;text-align:left;cursor:pointer}.student-home-deadline-list b,.student-home-deadline-list small{display:block}.student-home-deadline-list b{color:#0f172a;font-size:12px}.student-home-deadline-list small{margin-top:4px;color:#64748b;font-size:10px}.student-home-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.student-home-panel-head button{border:0;border-radius:10px;background:#eff6ff;color:#2563eb;padding:9px 12px;font-size:11px;font-weight:800;cursor:pointer}.student-home-notification-list{display:grid;gap:10px}.student-home-notification-list article{border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;padding:12px}.student-home-notification-list strong,.student-home-notification-list small{display:block}.student-home-notification-list strong{font-size:12px}.student-home-notification-list small{margin-top:4px;color:#94a3b8;font-size:9px}.student-home-notification-list p{margin:8px 0 0;color:#475569;font-size:11px;line-height:1.5}.student-member-teacher{display:flex;align-items:center;gap:12px;border:1px solid #dbeafe;border-radius:15px;background:#eff6ff;padding:15px;margin-bottom:16px}.student-member-teacher small,.student-member-teacher strong{display:block}.student-member-teacher small{color:#64748b;font-size:9px;font-weight:900;letter-spacing:.08em}.student-member-teacher strong{margin-top:3px;color:#0f172a}.student-members-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.student-members-grid article{display:flex;align-items:center;gap:11px;border:1px solid #e2e8f0;border-radius:14px;background:#fff;padding:14px}.student-members-grid strong,.student-members-grid small{display:block}.student-members-grid strong{font-size:12px}.student-members-grid small{margin-top:3px;color:#94a3b8;font-size:10px}.dark .student-nav-section-toggle{background:#111827}.dark .student-member-teacher{background:#172554;border-color:#1e3a8a}.dark .student-member-teacher strong,.dark .student-members-grid strong{color:#f8fafc}.dark .student-members-grid article{background:#111827;border-color:#263244}
@media(max-width:1100px){.student-members-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.student-home-reference-grid{grid-template-columns:minmax(240px,320px) minmax(0,1fr)}}
@media(max-width:780px){.student-class-workspace-fullscreen .student-learning-page:not(.student-class-hub){position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;z-index:1000!important}.student-workspace-shell{height:100dvh!important;min-height:0!important}.student-sidebar{top:0!important;height:100dvh!important;max-height:100dvh!important}.student-workspace-main{height:100dvh!important;min-height:0!important}.student-page-content{min-height:0!important;overflow-y:auto!important}.student-class-home-hero,.student-class-home-overlay{min-height:190px}.student-home-reference-grid{grid-template-columns:1fr}.student-members-grid{grid-template-columns:1fr 1fr}.student-topbar{padding:0 10px}.student-topbar-actions{display:none}.student-mobile-nav{z-index:1002}}
@media(max-width:520px){.student-page-content{padding:12px 10px calc(70px + env(safe-area-inset-bottom))}.student-class-home-hero,.student-class-home-overlay{min-height:168px}.student-class-home-overlay{padding:18px}.student-class-home-overlay h1{font-size:26px}.student-home-reference-grid{gap:12px;margin-top:12px}.student-home-ref-card,.student-home-notification-panel{padding:15px;border-radius:14px}.student-members-grid{grid-template-columns:1fr}.student-sidebar{width:min(300px,90vw)!important}.student-nav-section-toggle{min-height:38px}}


/* 2026-08-20: student overview dashboard + mobile sidebar stability */
.student-sidebar nav{flex:1 1 auto!important;min-height:0!important}.student-sidebar-bottom{flex:0 0 auto;position:sticky;bottom:0;z-index:5;background:#fff}.student-nav-section-toggle{font-size:9.5px!important;letter-spacing:.06em!important}.student-nav-section-items>button>b{font-size:12px!important;font-weight:700!important}
.student-overview-dashboard{max-width:1500px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:18px;align-items:start}.student-overview-main-column,.student-overview-side-column{display:grid;gap:16px;min-width:0}.student-overview-welcome{min-height:132px;border-radius:18px;background:linear-gradient(135deg,#2563eb,#2463eb 58%,#1d4ed8);color:#fff;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;overflow:hidden;position:relative}.student-overview-welcome:before{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.13) 1px,transparent 1px);background-size:20px 20px;pointer-events:none}.student-overview-welcome>div:first-child{position:relative;z-index:1}.student-overview-welcome>div:first-child>span{font-size:10px;font-weight:800}.student-overview-welcome h1{margin:5px 0 4px;font-size:24px;line-height:1.15}.student-overview-welcome p{margin:0;color:#dbeafe;font-size:11px}.student-overview-welcome-badges{display:flex;flex-wrap:wrap;gap:7px;margin-top:14px}.student-overview-welcome-badges b{border-radius:999px;background:rgba(255,255,255,.16);padding:6px 9px;font-size:9px;font-weight:700}.student-overview-welcome-art{position:relative;width:150px;height:96px;flex:0 0 150px;opacity:.8}.student-overview-welcome-art:before,.student-overview-welcome-art:after{content:"";position:absolute;border-radius:50%;background:rgba(255,255,255,.08)}.student-overview-welcome-art:before{width:76px;height:76px;right:38px;top:-8px}.student-overview-welcome-art:after{width:96px;height:96px;right:-25px;bottom:-35px}.student-overview-welcome-art>span{position:absolute;right:38px;bottom:18px;width:56px;height:42px;border-radius:8px;background:rgba(255,255,255,.2);display:grid;place-items:center;font-size:24px}.student-overview-welcome-art>i{position:absolute;right:13px;bottom:9px;width:28px;height:28px;border-radius:50%;background:#60a5fa;display:grid;place-items:center;font-style:normal;font-weight:900}
.student-overview-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.student-overview-stat-grid article{min-height:104px;border:1px solid #dbe3ef;border-radius:14px;background:#fff;padding:13px;display:flex;align-items:flex-start;gap:10px}.student-overview-stat-grid article.attendance{background:#f0fdf4}.student-overview-stat-icon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;flex:0 0 auto;font-size:14px}.student-overview-stat-icon.blue{background:#eff6ff;color:#2563eb}.student-overview-stat-icon.amber{background:#fffbeb;color:#d97706}.student-overview-stat-icon.green{background:#ecfdf5;color:#059669}.student-overview-stat-icon.purple{background:#faf5ff;color:#9333ea}.student-overview-stat-grid article>div{min-width:0}.student-overview-stat-grid strong,.student-overview-stat-grid b,.student-overview-stat-grid small{display:block}.student-overview-stat-grid strong{color:#0f172a;font-size:22px;line-height:1.1}.student-overview-stat-grid b{margin-top:5px;color:#334155;font-size:10px}.student-overview-stat-grid small{margin-top:3px;color:#94a3b8;font-size:8.5px;line-height:1.35}
.student-overview-two-column{display:grid;grid-template-columns:1.08fr 1fr;gap:12px}.student-overview-two-column.charts{grid-template-columns:1.1fr 1fr}.student-overview-card{border:1px solid #dbe3ef;border-radius:14px;background:#fff;padding:14px;min-width:0}.student-overview-card>header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px}.student-overview-card>header h2{margin:0;color:#1e293b;font-size:12px}.student-overview-card>header p{margin:4px 0 0;color:#94a3b8;font-size:8.5px}.student-overview-card>header button{border:0;background:transparent;color:#2563eb;font-size:8.5px;font-weight:700;cursor:pointer;white-space:nowrap}
.student-overview-class-list{display:grid;gap:8px}.student-overview-class-list>button{width:100%;border:0;background:transparent;display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:9px;align-items:center;padding:7px 4px;text-align:left;cursor:pointer}.student-overview-class-list>button:hover{background:#f8fafc;border-radius:10px}.student-overview-class-avatar{width:30px;height:30px;border-radius:9px;color:#fff;display:grid;place-items:center;font-size:10px;font-weight:900}.student-overview-class-list>button>div{min-width:0}.student-overview-class-list strong,.student-overview-class-list small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.student-overview-class-list strong{font-size:9.5px;color:#334155}.student-overview-class-list small{margin-top:2px;color:#94a3b8;font-size:7.5px}.student-overview-class-list i{display:block;height:4px;border-radius:999px;background:#eef2f7;overflow:hidden;margin-top:6px}.student-overview-class-list i em{display:block;height:100%;border-radius:inherit}.student-overview-class-list aside{text-align:right}.student-overview-class-list aside b,.student-overview-class-list aside small{display:block}.student-overview-class-list aside b{color:#334155;font-size:9px}.student-overview-class-list aside small{margin-top:3px;color:#94a3b8;font-size:7px}
.student-overview-todo-list{display:grid;gap:7px}.student-overview-todo-list>button{display:grid;grid-template-columns:26px minmax(0,1fr) auto;align-items:center;gap:8px;width:100%;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;padding:8px;text-align:left;cursor:pointer}.student-overview-alert{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:#eff6ff;color:#2563eb}.student-overview-alert.warning{background:#fffbeb;color:#d97706}.student-overview-alert.danger{background:#fef2f2;color:#dc2626}.student-overview-todo-list strong,.student-overview-todo-list small{display:block}.student-overview-todo-list strong{font-size:9px;color:#334155}.student-overview-todo-list small{margin-top:2px;color:#94a3b8;font-size:7px}.student-overview-todo-list em{border-radius:999px;background:#eef2ff;color:#475569;padding:4px 6px;font-size:7px;font-style:normal;font-weight:800;white-space:nowrap}.student-overview-todo-list em.warning{background:#fef3c7;color:#b45309}.student-overview-todo-list em.danger{background:#fee2e2;color:#b91c1c}
.student-overview-line-chart{height:165px}.student-overview-line-chart svg{display:block;width:100%;height:135px;overflow:visible}.student-overview-line-chart line{stroke:#e2e8f0;stroke-width:1}.student-overview-line-chart text{fill:#94a3b8;font-size:8px}.student-overview-line-chart path{fill:none;stroke:#2563eb;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}.student-overview-line-chart circle{fill:#fff;stroke:#2563eb;stroke-width:2}.student-overview-line-chart>div{display:grid;grid-template-columns:repeat(7,1fr);padding:0 14px 0 20px}.student-overview-line-chart>div span{text-align:center;color:#94a3b8;font-size:7px}.student-overview-submission-body{min-height:165px;display:flex;align-items:center;justify-content:center;gap:22px}.student-overview-donut{width:92px;height:92px;border-radius:50%;position:relative;display:grid;place-items:center;flex:0 0 auto}.student-overview-donut:after{content:"";position:absolute;inset:14px;border-radius:50%;background:#fff}.student-overview-donut>span{position:relative;z-index:1;text-align:center}.student-overview-donut b,.student-overview-donut small{display:block}.student-overview-donut b{font-size:18px}.student-overview-donut small{font-size:7px;color:#94a3b8}.student-overview-donut-legend{display:grid;gap:9px;min-width:110px}.student-overview-donut-legend span{display:grid;grid-template-columns:7px 1fr auto;gap:6px;align-items:center;color:#64748b;font-size:8px}.student-overview-donut-legend i{width:7px;height:7px;border-radius:50%}.student-overview-donut-legend i.green{background:#10b981}.student-overview-donut-legend i.amber{background:#f59e0b}.student-overview-donut-legend i.red{background:#ef4444}.student-overview-donut-legend b{color:#334155}
.student-overview-activity-list{display:grid}.student-overview-activity-list article{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px 0;border-top:1px solid #f1f5f9}.student-overview-activity-list article:first-child{border-top:0}.student-overview-activity-list article>span{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font-size:10px}.student-overview-activity-list article>span.blue{background:#eff6ff;color:#2563eb}.student-overview-activity-list article>span.purple{background:#faf5ff;color:#9333ea}.student-overview-activity-list article>span.green{background:#ecfdf5;color:#059669}.student-overview-activity-list strong,.student-overview-activity-list small{display:block}.student-overview-activity-list strong{color:#334155;font-size:8.5px}.student-overview-activity-list small{margin-top:2px;color:#94a3b8;font-size:7px}.student-overview-activity-list time{color:#94a3b8;font-size:7px;white-space:nowrap}.student-overview-quick-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:8px}.student-overview-quick-grid button{border:0;background:transparent;display:grid;justify-items:center;gap:6px;cursor:pointer;color:#475569}.student-overview-quick-grid span{width:34px;height:34px;border-radius:9px;background:#eff6ff;color:#2563eb;display:grid;place-items:center;font-size:13px}.student-overview-quick-grid small{font-size:7px;text-align:center}
.student-overview-side-column{position:sticky;top:0}.student-overview-side-column .student-overview-card{padding:13px}.student-overview-schedule-list,.student-overview-notice-list,.student-overview-message-list{display:grid;gap:6px}.student-overview-schedule-list article{display:grid;grid-template-columns:42px minmax(0,1fr);gap:8px;border-radius:9px;background:#f8fafc;padding:8px}.student-overview-schedule-list time b,.student-overview-schedule-list time small,.student-overview-schedule-list strong,.student-overview-schedule-list div small{display:block}.student-overview-schedule-list time b{font-size:8px}.student-overview-schedule-list time small{margin-top:3px;color:#94a3b8;font-size:7px}.student-overview-schedule-list strong{font-size:8.5px}.student-overview-schedule-list div small{margin-top:3px;color:#94a3b8;font-size:7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.student-overview-notice-list button,.student-overview-message-list button{width:100%;border:0;background:transparent;display:flex;align-items:flex-start;gap:7px;padding:6px 2px;text-align:left;cursor:pointer}.student-overview-notice-list button>span{color:#2563eb;font-size:16px;line-height:12px}.student-overview-notice-list div,.student-overview-message-list div{min-width:0}.student-overview-notice-list strong,.student-overview-notice-list p,.student-overview-notice-list small,.student-overview-message-list strong,.student-overview-message-list p,.student-overview-message-list small{display:block}.student-overview-notice-list strong,.student-overview-message-list strong{color:#334155;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.student-overview-notice-list p,.student-overview-message-list p{margin:2px 0;color:#64748b;font-size:7px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.student-overview-notice-list small,.student-overview-message-list small{color:#94a3b8;font-size:6.5px}
.dark .student-sidebar-bottom{background:#111827}.dark .student-overview-stat-grid article,.dark .student-overview-card{background:#111827;border-color:#263244}.dark .student-overview-stat-grid article.attendance{background:#10271c}.dark .student-overview-stat-grid strong,.dark .student-overview-stat-grid b,.dark .student-overview-card h2,.dark .student-overview-class-list strong,.dark .student-overview-class-list aside b,.dark .student-overview-todo-list strong,.dark .student-overview-donut-legend b,.dark .student-overview-activity-list strong,.dark .student-overview-schedule-list strong,.dark .student-overview-notice-list strong,.dark .student-overview-message-list strong{color:#f8fafc}.dark .student-overview-class-list>button:hover,.dark .student-overview-todo-list>button,.dark .student-overview-schedule-list article{background:#0f172a}.dark .student-overview-todo-list>button{border-color:#334155}.dark .student-overview-donut:after{background:#111827}.dark .student-overview-line-chart line{stroke:#334155}.dark .student-overview-activity-list article{border-color:#263244}
@media(max-width:1180px){.student-overview-dashboard{grid-template-columns:1fr}.student-overview-side-column{position:static;grid-template-columns:repeat(3,minmax(0,1fr))}.student-overview-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:780px){.student-sidebar-back-list{display:none!important}.student-sidebar-collapse-row{min-height:52px!important;justify-content:flex-end!important;padding:8px 12px!important}.student-nav-section-toggle{cursor:default!important}.student-nav-section-toggle>b{display:none!important}.student-sidebar-bottom{padding-bottom:calc(12px + env(safe-area-inset-bottom))}.student-overview-dashboard{gap:12px}.student-overview-welcome{min-height:120px;padding:18px}.student-overview-welcome-art{display:none}.student-overview-stat-grid,.student-overview-two-column,.student-overview-two-column.charts,.student-overview-side-column{grid-template-columns:1fr}.student-overview-quick-grid{grid-template-columns:repeat(4,1fr)}.student-overview-side-column{display:grid}.student-overview-card{padding:12px}.student-overview-stat-grid article{min-height:82px}}
@media(max-width:520px){.student-overview-welcome h1{font-size:21px}.student-overview-welcome-badges{gap:5px}.student-overview-welcome-badges b{font-size:8px}.student-overview-stat-grid{grid-template-columns:1fr 1fr}.student-overview-stat-grid article{padding:10px;gap:8px}.student-overview-stat-grid strong{font-size:18px}.student-overview-submission-body{gap:14px}.student-overview-quick-grid{grid-template-columns:repeat(4,1fr)}.student-overview-activity-list article{grid-template-columns:26px minmax(0,1fr)}.student-overview-activity-list time{grid-column:2}.student-overview-card>.student-empty-state{min-height:130px}}


/* 2026-08-20: student notification privacy, responsive content, member paging and read-only teacher-style schedule */
.student-workspace-shell{min-height:0!important;height:100dvh!important}.student-sidebar{min-height:0!important;overflow:hidden}.student-sidebar nav{overflow-y:auto!important;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-gutter:stable}.student-page-content{min-width:0;min-height:0;max-width:100%;overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior:contain}.student-page-content>div{min-width:0;max-width:100%}.student-overview-dashboard{width:100%;max-width:100%!important}.student-overview-main-column,.student-overview-side-column,.student-overview-card{max-width:100%;overflow-wrap:anywhere}.student-overview-todo-wide{width:100%}
.student-overview-stat-grid article.attendance.present{background:#f0fdf4}.student-overview-stat-grid article.attendance.late{background:#fffbeb}.student-overview-stat-grid article.attendance.excused{background:#faf5ff}.student-overview-stat-grid article.attendance.absent{background:#fef2f2}.dark .student-overview-stat-grid article.attendance.present{background:#10271c}.dark .student-overview-stat-grid article.attendance.late{background:#33280b}.dark .student-overview-stat-grid article.attendance.excused{background:#24143d}.dark .student-overview-stat-grid article.attendance.absent{background:#3b1717}
.student-overview-notice-list em{display:inline-flex;margin:2px 0 1px;border-radius:999px;background:#eff6ff;color:#2563eb;padding:2px 5px;font-size:6px;font-style:normal;font-weight:800}.student-overview-notice-list .notice-danger>span{color:#dc2626}.student-overview-notice-list .notice-danger em{background:#fef2f2;color:#dc2626}.student-overview-notice-list .notice-reward em{background:#fffbeb;color:#b45309}.student-overview-notice-list .notice-important em{background:#faf5ff;color:#7c3aed}
.student-member-section{margin-top:18px}.student-member-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}.student-member-section-head h2{margin:0;color:#0f172a;font-size:16px}.student-member-section-head p{margin:4px 0 0;color:#94a3b8;font-size:10px}.student-member-section-head>b{min-width:30px;height:30px;border-radius:9px;background:#eff6ff;color:#2563eb;display:grid;place-items:center;font-size:11px}.student-members-grid article{position:relative;min-width:0}.student-members-grid article>div{min-width:0}.student-members-grid article strong,.student-members-grid article small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.student-intern-badge{margin-left:auto;border-radius:999px;background:#fef3c7;color:#b45309;padding:4px 7px;font-size:8px;font-style:normal;font-weight:800;white-space:nowrap}.student-member-pagination{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:14px}.student-member-pagination button{width:34px;height:32px;border:1px solid #dbe3ef;border-radius:9px;background:#fff;color:#334155;cursor:pointer}.student-member-pagination button:disabled{opacity:.4;cursor:not-allowed}.student-member-pagination span{color:#64748b;font-size:10px;font-weight:700}.dark .student-member-section-head h2{color:#f8fafc}.dark .student-member-pagination button{background:#111827;border-color:#334155;color:#e2e8f0}
.student-notification-page article{grid-template-columns:38px minmax(0,1fr)!important}.student-notification-icon{width:36px;height:36px;border-radius:11px;background:#eff6ff;color:#2563eb;display:grid;place-items:center;font-weight:900}.student-notification-icon.warning,.student-notification-icon.critical{background:#fef2f2;color:#dc2626}.student-notification-icon.reward{background:#fffbeb;color:#b45309}.student-notification-icon.important{background:#faf5ff;color:#7c3aed}.student-notification-labels{display:flex;flex-wrap:wrap;gap:5px;margin:4px 0}.student-notification-labels em{border-radius:999px;background:#eff6ff;color:#2563eb;padding:3px 6px;font-size:8px;font-style:normal;font-weight:800}.student-notification-labels em.automatic{background:#e0f2fe;color:#0369a1}.student-notification-labels em.warning{background:#fee2e2;color:#b91c1c}.student-notification-labels em.reward{background:#fef3c7;color:#b45309}.student-notification-labels em.important{background:#ede9fe;color:#6d28d9}
.student-teacher-schedule-page{min-width:0;max-width:100%}.student-schedule-weekbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px;border:1px solid #e2e8f0;border-radius:14px;background:#fff;padding:12px 14px}.student-schedule-weekbar strong,.student-schedule-weekbar small{display:block}.student-schedule-weekbar strong{font-size:13px}.student-schedule-weekbar small{margin-top:3px;color:#94a3b8;font-size:9px}.student-schedule-weekbar>div:last-child{display:flex;gap:7px}.student-schedule-weekbar button{min-height:34px;border:1px solid #dbe3ef;border-radius:9px;background:#fff;color:#334155;padding:0 10px;font-size:9px;font-weight:700;cursor:pointer}.student-schedule-board-scroll{width:100%;max-width:100%;overflow-x:auto;padding-bottom:10px;scrollbar-gutter:stable}.student-schedule-board{display:grid;grid-template-columns:78px repeat(5,minmax(155px,1fr));min-width:860px;border:1px solid #dbe3ef;border-radius:14px;overflow:hidden;background:#fff}.student-schedule-grid-head{min-height:58px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;display:grid;place-items:center;align-content:center;text-align:center;background:#f8fafc}.student-schedule-grid-head strong,.student-schedule-grid-head small{display:block}.student-schedule-grid-head strong{font-size:10px}.student-schedule-grid-head small{margin-top:3px;color:#94a3b8;font-size:8px}.student-schedule-time-head{font-size:9px;font-weight:900;color:#64748b}.student-schedule-time-cell{min-height:76px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;display:grid;place-items:center;align-content:center;background:#f8fafc;text-align:center}.student-schedule-time-cell b,.student-schedule-time-cell strong,.student-schedule-time-cell small{display:block}.student-schedule-time-cell b{font-size:8px;color:#94a3b8}.student-schedule-time-cell strong{font-size:10px;margin-top:3px}.student-schedule-time-cell small{font-size:7px;color:#94a3b8}.student-schedule-cell{min-height:76px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;padding:8px;min-width:0}.student-schedule-cell.filled{background:#eff6ff}.student-schedule-cell.important{background:#fffbeb}.student-schedule-cell strong,.student-schedule-cell span,.student-schedule-cell small{display:block;overflow:hidden;text-overflow:ellipsis}.student-schedule-cell strong{color:#1e3a8a;font-size:9px;white-space:nowrap}.student-schedule-cell span{margin-top:4px;color:#475569;font-size:8px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.student-schedule-cell small{margin-top:4px;color:#64748b;font-size:7px;white-space:nowrap}.student-schedule-cell em{display:inline-flex;margin-top:5px;border-radius:999px;background:#fef3c7;color:#b45309;padding:2px 5px;font-size:7px;font-style:normal;font-weight:800}.student-schedule-empty-cell{height:100%;display:grid!important;place-items:center;color:#cbd5e1!important}.dark .student-schedule-weekbar,.dark .student-schedule-board{background:#111827;border-color:#334155}.dark .student-schedule-weekbar button{background:#0f172a;border-color:#334155;color:#e2e8f0}.dark .student-schedule-grid-head,.dark .student-schedule-time-cell{background:#0f172a;border-color:#263244}.dark .student-schedule-cell{border-color:#263244}.dark .student-schedule-cell.filled{background:#172554}.dark .student-schedule-cell.important{background:#422006}.dark .student-schedule-cell strong{color:#93c5fd}.dark .student-schedule-cell span,.dark .student-schedule-cell small{color:#94a3b8}
@media(max-width:780px){.student-workspace-shell{height:100dvh!important}.student-sidebar{height:100dvh!important;max-height:100dvh!important}.student-sidebar nav{max-height:none!important}.student-page-content{height:calc(100dvh - 64px)!important}.student-schedule-weekbar{align-items:stretch;flex-direction:column}.student-schedule-weekbar>div:last-child{display:grid;grid-template-columns:repeat(3,1fr)}.student-overview-side-column{position:static!important}.student-overview-card{max-height:none!important}}
@media(max-width:520px){.student-members-grid{grid-template-columns:1fr!important}.student-member-section-head{align-items:center}.student-schedule-board{grid-template-columns:64px repeat(5,minmax(135px,1fr));min-width:740px}}


/* 2026-08-20: student class code copy, synced schedule/profile, multiline messages */
.student-class-code-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:14px 0 8px}.student-class-code-row>strong{margin:0!important;min-width:0}.student-class-code-row>button{height:38px;border:1px solid #bfdbfe;border-radius:11px;background:#eff6ff;color:#2563eb;display:flex;align-items:center;gap:7px;padding:0 12px;font-size:10px;font-weight:900;cursor:pointer;transition:transform .2s ease,background .2s ease,color .2s ease}.student-class-code-row>button span{font-size:15px}.student-class-code-row>button.copied{background:#dcfce7;border-color:#bbf7d0;color:#15803d;transform:scale(1.03)}.student-class-code-row>button:disabled{opacity:.45;cursor:not-allowed}
.student-schedule-toolbar{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;margin-bottom:14px;border:1px solid #e2e8f0;border-radius:14px;background:#fff;padding:11px 12px}.student-schedule-toolbar>div,.student-schedule-toolbar>aside{display:flex;align-items:center;gap:7px}.student-schedule-toolbar>strong{text-align:center;font-size:11px;color:#475569}.student-schedule-toolbar button{min-height:34px;border:1px solid #dbe3ef;border-radius:9px;background:#fff;color:#334155;padding:0 10px;font-size:9px;font-weight:800;cursor:pointer}.student-schedule-toolbar>aside button:last-child{background:#eff6ff;border-color:#bfdbfe;color:#2563eb}.student-schedule-sync-message{margin:-4px 0 12px;border-radius:10px;background:#ecfdf5;color:#047857;padding:9px 11px;font-size:9px;font-weight:700}.student-schedule-break-row{grid-column:1/-1;display:flex;justify-content:center;gap:18px;padding:8px 12px;background:#fff7ed;border-bottom:1px solid #fed7aa}.student-schedule-break-row span{display:flex;align-items:center;gap:8px;color:#c2410c}.student-schedule-break-row b{font-size:9px}.student-schedule-break-row small{font-size:8px}.student-schedule-important-section,.student-schedule-persistent-section{margin-top:16px;border:1px solid #e2e8f0;border-radius:14px;background:#fff;padding:15px}.student-schedule-important-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.student-schedule-important-head h2{margin:0;font-size:14px}.student-schedule-important-head p{margin:4px 0 0;color:#94a3b8;font-size:9px}.student-schedule-important-head>b{min-width:28px;height:28px;border-radius:999px;background:#fef3c7;color:#b45309;display:grid;place-items:center;font-size:10px}.student-schedule-important-grid,.student-schedule-persistent-list{display:grid;gap:8px}.student-schedule-important-grid article,.student-schedule-persistent-list article{display:flex;align-items:flex-start;gap:10px;border:1px solid #fde68a;border-radius:11px;background:#fffbeb;padding:11px}.student-schedule-important-grid i,.student-schedule-persistent-list i{width:28px;height:28px;border-radius:9px;background:#fef3c7;color:#b45309;display:grid;place-items:center;font-style:normal;font-weight:900;flex:0 0 auto}.student-schedule-important-grid strong,.student-schedule-important-grid span,.student-schedule-important-grid small,.student-schedule-persistent-list strong,.student-schedule-persistent-list small,.student-schedule-persistent-list time{display:block}.student-schedule-important-grid strong,.student-schedule-persistent-list strong{font-size:10px}.student-schedule-important-grid span,.student-schedule-persistent-list time{margin-top:3px;color:#b45309;font-size:8px}.student-schedule-important-grid small,.student-schedule-persistent-list small{margin-top:4px;color:#64748b;font-size:8px}.student-schedule-important-empty{margin:0;color:#94a3b8;font-size:9px}.student-google-guide{width:min(560px,100%)}.student-google-guide-body{color:#475569;font-size:12px;line-height:1.6}.student-google-guide-body p{padding:10px;border-radius:10px;background:#ecfdf5;color:#047857}.student-google-guide-body a{color:#2563eb;font-weight:800}
.student-chat-messages .student-message>div{max-width:min(72%,680px);max-height:360px;overflow-y:auto}.student-chat-messages .student-message p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;line-height:1.55}.student-chat-panel footer>div>textarea{flex:1;min-height:40px;max-height:140px;resize:vertical;border:0;outline:0;background:transparent;color:#0f172a;padding:10px 4px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}.student-chat-panel footer>div{align-items:flex-end}
.student-self-profile-page{max-width:1050px;margin:0 auto}.student-self-profile-hero{display:flex;align-items:center;gap:18px;border:1px solid #e2e8f0;border-radius:16px;background:#fff;padding:18px}.student-self-profile-hero h2{margin:0;font-size:20px}.student-self-profile-hero p{margin:5px 0;color:#64748b;font-size:11px}.student-self-profile-hero>div>div{display:flex;gap:8px;flex-wrap:wrap}.student-self-profile-hero>div>div span{border-radius:999px;background:#eff6ff;color:#2563eb;padding:5px 8px;font-size:9px;font-weight:800}.student-self-profile-tabs{display:flex;gap:6px;overflow-x:auto;margin:14px 0;border-bottom:1px solid #e2e8f0;padding-bottom:8px}.student-self-profile-tabs button{border:0;border-radius:9px;background:transparent;color:#64748b;padding:9px 11px;font-size:10px;font-weight:800;white-space:nowrap;cursor:pointer}.student-self-profile-tabs button.active{background:#dbeafe;color:#1d4ed8}.student-self-profile-body{border:1px solid #e2e8f0;border-radius:16px;background:#fff;padding:18px}.student-self-profile-body h3{margin:0 0 12px;font-size:13px}.student-self-profile-body h3:not(:first-child){margin-top:20px}.student-self-profile-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.student-self-profile-grid>div{border:1px solid #e2e8f0;border-radius:11px;background:#f8fafc;padding:11px}.student-self-profile-grid small,.student-self-profile-grid strong{display:block}.student-self-profile-grid small{color:#94a3b8;font-size:8px}.student-self-profile-grid strong{margin-top:4px;font-size:10px;overflow-wrap:anywhere}.student-self-medical,.student-self-auto-note,.student-self-empty-note{border:1px solid #e2e8f0;border-radius:11px;background:#f8fafc;padding:12px;color:#64748b;font-size:10px;line-height:1.55}.student-self-profile-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}.student-self-profile-stats>div{border:1px solid #e2e8f0;border-radius:11px;background:#f8fafc;padding:10px;text-align:center}.student-self-profile-stats b,.student-self-profile-stats span{display:block}.student-self-profile-stats b{font-size:18px}.student-self-profile-stats span{margin-top:3px;color:#94a3b8;font-size:8px}.student-self-list{display:grid;gap:8px}.student-self-list article{display:grid;grid-template-columns:120px 160px 1fr;gap:10px;border:1px solid #e2e8f0;border-radius:10px;padding:10px;font-size:9px}.student-self-list time{color:#94a3b8}.student-self-score-groups{display:grid;gap:10px}.student-self-score-groups>article{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}.student-self-score-groups>article>header,.student-self-score-groups>article>div{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid #e2e8f0}.student-self-score-groups>article>header{background:#f8fafc}.student-self-score-groups small,.student-self-score-groups strong{display:block}.student-self-score-groups small{margin-top:3px;color:#94a3b8;font-size:8px}.student-self-score-groups strong{font-size:10px}.student-self-assignment-list{display:grid;gap:8px}.student-self-assignment-list article{display:grid;grid-template-columns:1fr auto;gap:6px 10px;border:1px solid #e2e8f0;border-radius:11px;background:#f8fafc;padding:11px}.student-self-assignment-list strong,.student-self-assignment-list small,.student-self-assignment-list time{display:block}.student-self-assignment-list strong{font-size:10px}.student-self-assignment-list small,.student-self-assignment-list time{margin-top:3px;color:#94a3b8;font-size:8px}.student-self-assignment-list time{grid-column:1/-1}.student-self-assignment-list em{border-radius:999px;padding:5px 8px;font-size:8px;font-style:normal;font-weight:800;background:#e2e8f0}.student-self-assignment-list em.submitted{background:#dcfce7;color:#166534}.student-self-assignment-list em.late,.student-self-assignment-list em.overdue{background:#fee2e2;color:#b91c1c}.student-self-assignment-list em.warning{background:#fef3c7;color:#b45309}.student-self-reward-list article{display:flex;gap:10px;border:1px solid #bbf7d0;border-radius:11px;background:#f0fdf4;padding:11px}.student-self-reward-list article>span{width:30px;height:30px;border-radius:9px;background:#dcfce7;color:#15803d;display:grid;place-items:center}.student-self-reward-list strong{color:#166534;font-size:10px}.student-self-reward-list p{margin:4px 0 0;color:#64748b;font-size:9px}
.dark .student-class-code-row>button{background:#172554;border-color:#1e3a8a;color:#93c5fd}.dark .student-schedule-toolbar,.dark .student-schedule-important-section,.dark .student-schedule-persistent-section,.dark .student-self-profile-hero,.dark .student-self-profile-body{background:#111827;border-color:#334155}.dark .student-schedule-toolbar button{background:#0f172a;border-color:#334155;color:#e2e8f0}.dark .student-chat-panel footer>div>textarea{color:#f8fafc}.dark .student-self-profile-grid>div,.dark .student-self-profile-stats>div,.dark .student-self-score-groups>article>header,.dark .student-self-assignment-list article,.dark .student-self-medical,.dark .student-self-auto-note,.dark .student-self-empty-note{background:#0f172a;border-color:#334155}.dark .student-self-profile-grid strong,.dark .student-self-score-groups strong,.dark .student-self-assignment-list strong{color:#f8fafc}
@media(max-width:780px){.student-schedule-toolbar{grid-template-columns:1fr;align-items:stretch}.student-schedule-toolbar>strong{text-align:left}.student-schedule-toolbar>aside{display:grid;grid-template-columns:1fr 1fr}.student-schedule-toolbar>aside button{width:100%}.student-class-code-row{align-items:flex-start;flex-direction:column}.student-self-profile-grid{grid-template-columns:1fr}.student-self-profile-stats{grid-template-columns:repeat(2,1fr)}.student-self-list article{grid-template-columns:1fr}.student-chat-messages .student-message>div{max-width:88%}}


/* Chat workspace: giữ chiều cao ổn định, chỉ cuộn phần nội dung tin nhắn. */
.student-message-layout{height:clamp(500px,calc(100dvh - var(--app-navbar-height,64px) - 112px),680px);min-height:0}
.student-chat-panel{height:100%;min-height:0;overflow:hidden}
.student-chat-messages{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}
.student-chat-panel footer>div>textarea{height:40px;min-height:40px;max-height:140px;resize:none;overflow-y:hidden;box-sizing:border-box;scrollbar-width:thin}
@media(max-width:780px){.student-message-layout{height:calc(100dvh - 150px);min-height:0}.student-chat-panel footer>div>textarea{max-height:120px}}


/* ============================================================
   2026-08-20: final student workspace light/dark consistency fix
   Scope only the in-class student workspace. Keep data/UI logic intact.
   ============================================================ */
.student-learning-page:not(.student-class-hub){color-scheme:light}
.dark .student-learning-page:not(.student-class-hub){color-scheme:dark;background:#0b1020;color:#f8fafc}
.dark .student-learning-page:not(.student-class-hub) .student-page-content{background:#0b1020;color:#f8fafc}

/* Sidebar + topbar controls added after the original theme block. */
.dark .student-learning-page:not(.student-class-hub) .student-sidebar-collapse-row,
.dark .student-learning-page:not(.student-class-hub) .student-brand,
.dark .student-learning-page:not(.student-class-hub) .student-sidebar-bottom,
.dark .student-learning-page:not(.student-class-hub) .student-topbar{border-color:#263244}
.dark .student-learning-page:not(.student-class-hub) .student-sidebar-back-list,
.dark .student-learning-page:not(.student-class-hub) .student-workspace-back{background:#0f172a;border-color:#334155;color:#e2e8f0}
.dark .student-learning-page:not(.student-class-hub) .student-sidebar-back-list:hover,
.dark .student-learning-page:not(.student-class-hub) .student-workspace-back:hover{background:#1e293b;color:#f8fafc}
.dark .student-learning-page:not(.student-class-hub) .student-menu-btn,
.dark .student-learning-page:not(.student-class-hub) .student-mobile-close{color:#cbd5e1}
.dark .student-learning-page:not(.student-class-hub) .student-sidebar nav>button>span,
.dark .student-learning-page:not(.student-class-hub) .student-nav-section-items>button>span{background:#1e293b;color:#94a3b8;border:1px solid #263244}
.dark .student-learning-page:not(.student-class-hub) .student-sidebar nav>button.active>span,
.dark .student-learning-page:not(.student-class-hub) .student-nav-section-items>button.active>span{background:#0f172a;color:#93c5fd;border-color:#1e3a8a}
.dark .student-learning-page:not(.student-class-hub) .student-sidebar nav>button.active,
.dark .student-learning-page:not(.student-class-hub) .student-nav-section-items>button.active{background:#172554;color:#93c5fd;box-shadow:inset 3px 0 #3b82f6}
.dark .student-learning-page:not(.student-class-hub) .student-topbar-actions>button{color:#cbd5e1}
.dark .student-learning-page:not(.student-class-hub) .student-topbar-actions>button:hover,
.dark .student-learning-page:not(.student-class-hub) .student-profile-trigger:hover{background:#1e293b}
.dark .student-learning-page:not(.student-class-hub) .student-topbar-actions>button i{border-color:#111827}
.dark .student-learning-page:not(.student-class-hub) .student-profile-dropdown button{color:#e2e8f0}
.dark .student-learning-page:not(.student-class-hub) .student-profile-dropdown button:hover{background:#1e293b}

/* Generic student workspace inputs/actions. */
.dark .student-learning-page:not(.student-class-hub) .student-secondary-btn,
.dark .student-learning-page:not(.student-class-hub) .student-filter-tabs button:not(.active),
.dark .student-learning-page:not(.student-class-hub) .student-member-pagination button,
.dark .student-learning-page:not(.student-class-hub) .student-file-picker{background:#0f172a;border-color:#334155;color:#cbd5e1}
.dark .student-learning-page:not(.student-class-hub) .student-filter-tabs button:not(.active):hover,
.dark .student-learning-page:not(.student-class-hub) .student-member-pagination button:not(:disabled):hover{background:#1e293b;color:#f8fafc}
.dark .student-learning-page:not(.student-class-hub) .student-class-select,
.dark .student-learning-page:not(.student-class-hub) .student-search,
.dark .student-learning-page:not(.student-class-hub) .student-submission-card textarea{background:#0f172a;border-color:#334155;color:#f8fafc}
.dark .student-learning-page:not(.student-class-hub) .student-class-select option{background:#111827;color:#f8fafc}

/* Sidebar/home/member cards. */
.dark .student-learning-page:not(.student-class-hub) .student-home-panel-head button{background:#172554;color:#93c5fd}
.dark .student-learning-page:not(.student-class-hub) .student-home-status{background:#12351f;color:#86efac}
.dark .student-learning-page:not(.student-class-hub) .student-member-section-head>b{background:#172554;color:#93c5fd}
.dark .student-learning-page:not(.student-class-hub) .student-intern-badge{background:#422006;color:#fbbf24}
.dark .student-learning-page:not(.student-class-hub) .student-member-teacher small{color:#94a3b8}
.dark .student-learning-page:not(.student-class-hub) .student-members-grid small,
.dark .student-learning-page:not(.student-class-hub) .student-member-pagination span{color:#94a3b8}

/* Dashboard/overview semantic surfaces. */
.dark .student-learning-page:not(.student-class-hub) .student-stat-icon.blue,
.dark .student-learning-page:not(.student-class-hub) .student-overview-stat-icon.blue,
.dark .student-learning-page:not(.student-class-hub) .student-overview-quick-grid span{background:#172554;color:#93c5fd}
.dark .student-learning-page:not(.student-class-hub) .student-stat-icon.amber,
.dark .student-learning-page:not(.student-class-hub) .student-overview-stat-icon.amber,
.dark .student-learning-page:not(.student-class-hub) .student-overview-alert.warning{background:#422006;color:#fbbf24}
.dark .student-learning-page:not(.student-class-hub) .student-stat-icon.green,
.dark .student-learning-page:not(.student-class-hub) .student-overview-stat-icon.green{background:#12351f;color:#86efac}
.dark .student-learning-page:not(.student-class-hub) .student-stat-icon.purple,
.dark .student-learning-page:not(.student-class-hub) .student-overview-stat-icon.purple{background:#2e1065;color:#c4b5fd}
.dark .student-learning-page:not(.student-class-hub) .student-stat-icon.red,
.dark .student-learning-page:not(.student-class-hub) .student-overview-alert.danger{background:#3f1d24;color:#fca5a5}
.dark .student-learning-page:not(.student-class-hub) .student-overview-class-list i{background:#263244}
.dark .student-learning-page:not(.student-class-hub) .student-overview-line-chart circle{fill:#111827}
.dark .student-learning-page:not(.student-class-hub) .student-overview-quick-grid button{color:#cbd5e1}
.dark .student-learning-page:not(.student-class-hub) .student-overview-todo-list em{background:#1e293b;color:#cbd5e1}
.dark .student-learning-page:not(.student-class-hub) .student-overview-todo-list em.warning{background:#422006;color:#fbbf24}
.dark .student-learning-page:not(.student-class-hub) .student-overview-todo-list em.danger{background:#3f1d24;color:#fca5a5}
.dark .student-learning-page:not(.student-class-hub) .student-overview-notice-list em{background:#172554;color:#93c5fd}
.dark .student-learning-page:not(.student-class-hub) .student-overview-notice-list .notice-danger em{background:#3f1d24;color:#fca5a5}
.dark .student-learning-page:not(.student-class-hub) .student-overview-notice-list .notice-reward em{background:#422006;color:#fbbf24}
.dark .student-learning-page:not(.student-class-hub) .student-overview-notice-list .notice-important em{background:#2e1065;color:#c4b5fd}

/* Assignment/detail/grade/attendance borders and chips. */
.dark .student-learning-page:not(.student-class-hub) .student-detail-meta,
.dark .student-learning-page:not(.student-class-hub) .student-feedback,
.dark .student-learning-page:not(.student-class-hub) .student-lesson-grid footer,
.dark .student-learning-page:not(.student-class-hub) .student-self-profile-tabs{border-color:#263244}
.dark .student-learning-page:not(.student-class-hub) .student-detail-grid h1,
.dark .student-learning-page:not(.student-class-hub) .student-attendance-rate strong,
.dark .student-learning-page:not(.student-class-hub) .student-attendance-list time{color:#f8fafc}
.dark .student-learning-page:not(.student-class-hub) .student-grade-pill{background:#172554;color:#93c5fd}
.dark .student-learning-page:not(.student-class-hub) .student-submitted-box{background:#0f172a;border-color:#334155}

/* Notification page. */
.dark .student-learning-page:not(.student-class-hub) .student-notification-page article p{color:#cbd5e1}
.dark .student-learning-page:not(.student-class-hub) .student-notification-page article small{color:#94a3b8}
.dark .student-learning-page:not(.student-class-hub) .student-notification-files a{background:#172554;color:#93c5fd}
.dark .student-learning-page:not(.student-class-hub) .student-notification-icon.reward{background:#422006;color:#fbbf24}

/* Chat: incoming bubble/file chip were still using light colors. */
.dark .student-learning-page:not(.student-class-hub) .student-chat-messages{background:#0b1220}
.dark .student-learning-page:not(.student-class-hub) .student-message:not(.own)>div{background:#1e293b;color:#e2e8f0}
.dark .student-learning-page:not(.student-class-hub) .student-message.own>div{background:#2563eb;color:#fff}
.dark .student-learning-page:not(.student-class-hub) .student-file-chip{background:#0f172a;border-color:#334155;color:#cbd5e1}
.dark .student-learning-page:not(.student-class-hub) .student-file-chip button{color:#94a3b8}
.dark .student-learning-page:not(.student-class-hub) .student-chat-file{background:#1e293b;color:#cbd5e1}

/* Schedule: toolbar, breaks and important cards. */
.dark .student-learning-page:not(.student-class-hub) .student-schedule-toolbar>strong{color:#cbd5e1}
.dark .student-learning-page:not(.student-class-hub) .student-schedule-sync-message{background:#12351f;color:#86efac}
.dark .student-learning-page:not(.student-class-hub) .student-schedule-break-row{background:#2a1b0d;border-color:#7c2d12}
.dark .student-learning-page:not(.student-class-hub) .student-schedule-break-row span{color:#fdba74}
.dark .student-learning-page:not(.student-class-hub) .student-schedule-important-head>b,
.dark .student-learning-page:not(.student-class-hub) .student-schedule-important-grid i,
.dark .student-learning-page:not(.student-class-hub) .student-schedule-persistent-list i{background:#422006;color:#fbbf24}
.dark .student-learning-page:not(.student-class-hub) .student-schedule-important-grid article,
.dark .student-learning-page:not(.student-class-hub) .student-schedule-persistent-list article{background:#2b2208;border-color:#854d0e}
.dark .student-learning-page:not(.student-class-hub) .student-schedule-important-grid span,
.dark .student-learning-page:not(.student-class-hub) .student-schedule-persistent-list time{color:#fbbf24}
.dark .student-learning-page:not(.student-class-hub) .student-schedule-important-grid small,
.dark .student-learning-page:not(.student-class-hub) .student-schedule-persistent-list small{color:#cbd5e1}
.dark .student-learning-page:not(.student-class-hub) .student-google-guide-body{color:#cbd5e1}
.dark .student-learning-page:not(.student-class-hub) .student-google-guide-body p{background:#12351f;color:#86efac}

/* Student self-profile. */
.dark .student-learning-page:not(.student-class-hub) .student-self-profile-hero>div>div span,
.dark .student-learning-page:not(.student-class-hub) .student-self-profile-tabs button.active{background:#172554;color:#93c5fd}
.dark .student-learning-page:not(.student-class-hub) .student-self-profile-tabs button:not(.active){color:#94a3b8}
.dark .student-learning-page:not(.student-class-hub) .student-self-list article,
.dark .student-learning-page:not(.student-class-hub) .student-self-score-groups>article{background:#111827;border-color:#334155}
.dark .student-learning-page:not(.student-class-hub) .student-self-score-groups>article>header,
.dark .student-learning-page:not(.student-class-hub) .student-self-score-groups>article>div{border-color:#334155}
.dark .student-learning-page:not(.student-class-hub) .student-self-list strong,
.dark .student-learning-page:not(.student-class-hub) .student-self-score-groups>article>div>b,
.dark .student-learning-page:not(.student-class-hub) .student-self-profile-stats b{color:#f8fafc}
.dark .student-learning-page:not(.student-class-hub) .student-self-reward-list article{background:#10271c;border-color:#166534}
.dark .student-learning-page:not(.student-class-hub) .student-self-reward-list article>span{background:#12351f;color:#86efac}
.dark .student-learning-page:not(.student-class-hub) .student-self-reward-list strong{color:#86efac}
.dark .student-learning-page:not(.student-class-hub) .student-self-reward-list p{color:#cbd5e1}
.dark .student-learning-page:not(.student-class-hub) .student-self-assignment-list em{background:#1e293b;color:#cbd5e1}
.dark .student-learning-page:not(.student-class-hub) .student-self-assignment-list em.submitted{background:#12351f;color:#86efac}
.dark .student-learning-page:not(.student-class-hub) .student-self-assignment-list em.late,
.dark .student-learning-page:not(.student-class-hub) .student-self-assignment-list em.overdue{background:#3f1d24;color:#fca5a5}
.dark .student-learning-page:not(.student-class-hub) .student-self-assignment-list em.warning{background:#422006;color:#fbbf24}

/* Loading skeletons should not flash light blocks in dark mode. */
.dark .student-learning-page:not(.student-class-hub) .student-skeleton-row{background:#111827;border-color:#263244}
.dark .student-learning-page:not(.student-class-hub) .student-class-card.skeleton div,
.dark .student-learning-page:not(.student-class-hub) .student-class-card.skeleton span,
.dark .student-learning-page:not(.student-class-hub) .student-class-card.skeleton b,
.dark .student-learning-page:not(.student-class-hub) .student-skeleton-row i,
.dark .student-learning-page:not(.student-class-hub) .student-skeleton-row b,
.dark .student-learning-page:not(.student-class-hub) .student-skeleton-row span{background:linear-gradient(90deg,#1e293b 25%,#334155 50%,#1e293b 75%);background-size:200% 100%}


/* 2026-08-20: align student sidebar section labels + leave class action */
.student-learning-page:not(.student-class-hub) .student-nav-section{margin-left:0!important;margin-right:0!important}
.student-learning-page:not(.student-class-hub) .student-nav-section-toggle{padding-left:2px!important;padding-right:2px!important}
.student-learning-page:not(.student-class-hub) .student-sidebar-bottom>div{flex:1;min-width:0}
.student-learning-page:not(.student-class-hub) .student-sidebar-leave-btn{flex:0 0 auto;border:1px solid #fecaca;border-radius:9px;background:#fff;color:#dc2626;padding:7px 9px;font-size:10px;font-weight:800;cursor:pointer;white-space:nowrap}
.student-learning-page:not(.student-class-hub) .student-sidebar-leave-btn:hover{background:#fef2f2;border-color:#fca5a5}
.student-learning-page:not(.student-class-hub) .student-sidebar.collapsed .student-sidebar-leave-btn{width:34px;height:34px;padding:0;display:grid;place-items:center;font-size:15px}
.student-leave-class-warning{margin-top:12px;border:1px solid #fecaca;border-radius:11px;background:#fef2f2;color:#991b1b;padding:11px 12px;font-size:10px;line-height:1.55;font-weight:700}
.student-leave-class-modal>p strong{color:#0f172a}
.dark .student-learning-page:not(.student-class-hub) .student-sidebar-leave-btn{background:#1f1518;border-color:#7f1d1d;color:#fca5a5}
.dark .student-learning-page:not(.student-class-hub) .student-sidebar-leave-btn:hover{background:#3f1d24;border-color:#991b1b}
.dark .student-learning-page:not(.student-class-hub) .student-leave-class-warning{background:#3f1d24;border-color:#7f1d1d;color:#fecaca}
.dark .student-learning-page:not(.student-class-hub) .student-leave-class-modal>p strong{color:#f8fafc}
@media(max-width:780px){.student-learning-page:not(.student-class-hub) .student-nav-section-toggle{padding-left:2px!important;padding-right:2px!important}.student-learning-page:not(.student-class-hub) .student-sidebar-leave-btn{min-height:34px}}

/* 2026-08-20: sidebar section alignment, self-profile edit, class theme borders */
.student-learning-page:not(.student-class-hub) .student-sidebar nav{padding-left:8px!important;padding-right:8px!important}
.student-learning-page:not(.student-class-hub) .student-sidebar:not(.collapsed) .student-nav-section{margin:10px 0 0!important;padding:0!important;border-top:0!important}
.student-learning-page:not(.student-class-hub) .student-sidebar:not(.collapsed) .student-nav-section-toggle{width:100%!important;min-height:48px;margin:0 0 6px!important;padding:0 14px!important;border-radius:14px!important;background:#f1f5f9!important;color:#0f172a!important;box-shadow:none!important}
.student-learning-page:not(.student-class-hub) .student-sidebar:not(.collapsed) .student-nav-section-toggle>span{font-size:12px;font-weight:900;letter-spacing:.08em;text-align:left!important;color:inherit!important;width:auto!important}
.student-learning-page:not(.student-class-hub) .student-sidebar:not(.collapsed) .student-nav-section-toggle>b{flex:0 0 auto;margin-left:10px;color:inherit}
.student-learning-page:not(.student-class-hub) .student-sidebar:not(.collapsed) .student-nav-section-items>button{padding-left:14px!important;padding-right:12px!important}
.dark .student-learning-page:not(.student-class-hub) .student-sidebar:not(.collapsed) .student-nav-section-toggle{background:#1e293b!important;color:#e2e8f0!important}

.student-class-home-hero{border:2px solid var(--student-accent,#2563eb)}
.student-class-home .student-home-ref-card,.student-class-home .student-home-notification-panel{border-color:var(--student-accent,#2563eb)}

.student-self-profile-actions{margin-left:auto;display:flex;align-items:center;gap:8px;flex:0 0 auto}
.student-self-profile-actions button{min-height:36px;border-radius:10px;padding:0 12px;font-size:10px;font-weight:900;cursor:pointer}
.student-self-profile-edit{border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8}
.student-self-profile-cancel{border:1px solid #cbd5e1;background:#fff;color:#475569}
.student-self-profile-save{border:1px solid #2563eb;background:#2563eb;color:#fff}
.student-self-profile-actions button:disabled{opacity:.55;cursor:not-allowed}
.student-self-profile-edit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.student-self-profile-edit-grid label,.student-self-profile-readonly{display:grid;gap:6px;border:1px solid #e2e8f0;border-radius:11px;background:#f8fafc;padding:10px}
.student-self-profile-edit-grid small,.student-self-profile-readonly small{color:#94a3b8;font-size:8px;font-weight:800}
.student-self-profile-edit-grid input,.student-self-profile-edit-grid select,.student-self-medical-edit{width:100%;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#0f172a;padding:9px 10px;outline:0;font-size:10px}
.student-self-profile-edit-grid input:focus,.student-self-profile-edit-grid select:focus,.student-self-medical-edit:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
.student-self-profile-readonly strong{font-size:10px;overflow-wrap:anywhere}
.student-self-medical-edit{min-height:96px;resize:vertical;line-height:1.5}
.student-self-profile-error{margin:0 0 12px;border:1px solid #fecaca;border-radius:10px;background:#fef2f2;color:#b91c1c;padding:10px 12px;font-size:10px;font-weight:800}
.dark .student-learning-page:not(.student-class-hub) .student-self-profile-edit{background:#172554;border-color:#1e3a8a;color:#93c5fd}
.dark .student-learning-page:not(.student-class-hub) .student-self-profile-cancel{background:#0f172a;border-color:#334155;color:#cbd5e1}
.dark .student-learning-page:not(.student-class-hub) .student-self-profile-save{background:#2563eb;border-color:#2563eb;color:#fff}
.dark .student-learning-page:not(.student-class-hub) .student-self-profile-edit-grid label,.dark .student-learning-page:not(.student-class-hub) .student-self-profile-readonly{background:#0f172a;border-color:#334155}
.dark .student-learning-page:not(.student-class-hub) .student-self-profile-edit-grid input,.dark .student-learning-page:not(.student-class-hub) .student-self-profile-edit-grid select,.dark .student-learning-page:not(.student-class-hub) .student-self-medical-edit{background:#111827;border-color:#475569;color:#f8fafc;color-scheme:dark}
.dark .student-learning-page:not(.student-class-hub) .student-self-profile-readonly strong{color:#f8fafc}
.dark .student-learning-page:not(.student-class-hub) .student-self-profile-error{background:#3f1d24;border-color:#7f1d1d;color:#fecaca}
@media(max-width:780px){.student-self-profile-hero{align-items:flex-start;flex-wrap:wrap}.student-self-profile-actions{width:100%;margin-left:0}.student-self-profile-actions button{flex:1}.student-self-profile-edit-grid{grid-template-columns:1fr}}


/* 2026-08-20: student notification center - read filter, per-user dismissal and complete light/dark theme */
.student-notification-center{max-width:1500px;margin:0 auto;color:#0f172a}
.student-notification-center-head{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:24px}
.student-notification-center-title{display:flex;align-items:center;gap:10px;min-width:0}
.student-notification-center-title h1{margin:0;font-size:26px;font-weight:800;letter-spacing:-.02em;color:#0f172a}
.student-notification-center-title>b{min-width:28px;height:28px;padding:0 8px;border-radius:999px;background:#ef4444;color:#fff;display:grid;place-items:center;font-size:12px;font-weight:900}
.student-notification-center-actions{display:flex;align-items:center;justify-content:flex-end;gap:12px;flex-wrap:wrap}
.student-notification-center-actions>.student-class-select{min-height:46px;margin:0}
.student-notification-filter-tabs{display:flex;align-items:stretch;overflow:hidden;border:1px solid #cbd5e1;border-radius:13px;background:#fff}
.student-notification-filter-tabs button{min-height:46px;border:0;border-right:1px solid #e2e8f0;background:#fff;color:#64748b;padding:0 20px;font-size:12px;font-weight:900;cursor:pointer;transition:background .18s ease,color .18s ease,border-color .18s ease}
.student-notification-filter-tabs button:last-child{border-right:0}
.student-notification-filter-tabs button:hover{background:#f8fafc;color:#0f172a}
.student-notification-filter-tabs button.active{background:var(--student-notification-accent,#2563eb);color:#fff}
.student-notification-delete-all{min-height:46px;border:1px solid #fecaca;border-radius:13px;background:#fff;color:#dc2626;padding:0 17px;font-size:12px;font-weight:900;cursor:pointer;transition:background .18s ease,border-color .18s ease,transform .18s ease}
.student-notification-delete-all:hover:not(:disabled){background:#fef2f2;border-color:#fca5a5;transform:translateY(-1px)}
.student-notification-delete-all:disabled{opacity:.45;cursor:not-allowed}
.student-notification-action-error{margin:0 0 14px;border:1px solid #fecaca;border-radius:12px;background:#fef2f2;color:#b91c1c;padding:11px 13px;font-size:11px;font-weight:800}
.student-notification-center-list{display:grid;gap:13px}
.student-notification-center-card{display:grid;grid-template-columns:54px minmax(0,1fr) 46px;align-items:center;gap:16px;min-height:112px;border:1px solid color-mix(in srgb,var(--student-notification-accent,#2563eb) 30%,#dbeafe);border-radius:18px;background:#fff;padding:17px 20px;box-shadow:0 2px 7px rgba(15,23,42,.025);transition:border-color .18s ease,background .18s ease,box-shadow .18s ease,transform .18s ease;outline:none}
.student-notification-center-card[role="button"]{cursor:pointer}
.student-notification-center-card[role="button"]:hover,.student-notification-center-card[role="button"]:focus-visible{border-color:color-mix(in srgb,var(--student-notification-accent,#2563eb) 65%,#bfdbfe);box-shadow:0 9px 25px rgba(15,23,42,.07);transform:translateY(-1px)}
.student-notification-center-card.unread{border-color:color-mix(in srgb,var(--student-notification-accent,#2563eb) 55%,#bfdbfe);background:color-mix(in srgb,var(--student-notification-accent,#2563eb) 2.5%,#fff)}
.student-notification-center-card.read{border-color:#dbeafe}
.student-notification-center-icon{width:50px;height:50px;border-radius:14px;background:#f8fafc;color:#64748b;display:grid;place-items:center;font-size:18px;font-weight:900;flex:0 0 auto}
.student-notification-center-icon.severity-critical,.student-notification-center-icon.severity-warning{background:#fff1f2;color:#ef4444}
.student-notification-center-icon.severity-reward{background:#f0fdf4;color:#16a34a}
.student-notification-center-icon.severity-important{background:#fff7ed;color:#f59e0b}
.student-notification-center-icon.severity-medium{background:#eff6ff;color:#2563eb}
.student-notification-center-content{min-width:0;align-self:center}
.student-notification-center-title-line{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}
.student-notification-center-title-line>strong{font-size:14px;font-weight:900;color:#0f172a;overflow-wrap:anywhere}
.student-notification-center-badges{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.student-notification-center-badges em{border-radius:999px;padding:4px 8px;font-size:9px;line-height:1.2;font-style:normal;font-weight:900;white-space:nowrap}
.student-notification-center-badges em.automatic{background:#e0f2fe;color:#0369a1}
.student-notification-center-badges em.critical{background:#fee2e2;color:#dc2626}
.student-notification-center-badges em.warning{background:#fff7ed;color:#ea580c}
.student-notification-center-badges em.reward{background:#dcfce7;color:#15803d}
.student-notification-center-badges em.important{background:#ffedd5;color:#ea580c}
.student-notification-unread-dot{width:8px;height:8px;border-radius:50%;background:var(--student-notification-accent,#2563eb);display:block;flex:0 0 auto;box-shadow:0 0 0 3px color-mix(in srgb,var(--student-notification-accent,#2563eb) 12%,transparent)}
.student-notification-center-content>p{margin:8px 0 0;color:#64748b;font-size:12px;line-height:1.55;overflow-wrap:anywhere}
.student-notification-center-content>small{display:block;margin-top:7px;color:#94a3b8;font-size:10px;font-weight:600}
.student-notification-center-content .student-notification-files{margin-top:9px}
.student-notification-center-content .student-notification-files a{border:1px solid #dbeafe;background:#eff6ff;color:#2563eb}
.student-notification-card-actions{display:flex;align-items:center;justify-content:flex-end}
.student-notification-trash-btn{width:42px;height:42px;border:1px solid #fecaca;border-radius:12px;background:#fff;color:#ef4444;display:grid;place-items:center;font-size:17px;font-weight:900;cursor:pointer;transition:background .18s ease,border-color .18s ease,transform .18s ease}
.student-notification-trash-btn:hover:not(:disabled){background:#fef2f2;border-color:#fca5a5;transform:scale(1.04)}
.student-notification-trash-btn:disabled{opacity:.45;cursor:not-allowed}
.student-notification-center-empty{min-height:190px;border:1px dashed #cbd5e1;border-radius:18px;background:#fff;color:#94a3b8;display:grid;place-items:center;text-align:center;padding:28px;font-size:12px;font-weight:800}
.student-notification-delete-modal>p{font-size:12px;line-height:1.6}

.dark .student-learning-page:not(.student-class-hub) .student-notification-center{color:#f8fafc}
.dark .student-learning-page:not(.student-class-hub) .student-notification-center-title h1{color:#f8fafc}
.dark .student-learning-page:not(.student-class-hub) .student-notification-filter-tabs{background:#111827;border-color:#334155}
.dark .student-learning-page:not(.student-class-hub) .student-notification-filter-tabs button{background:#111827;color:#cbd5e1;border-right-color:#334155}
.dark .student-learning-page:not(.student-class-hub) .student-notification-filter-tabs button:hover{background:#1e293b;color:#f8fafc}
.dark .student-learning-page:not(.student-class-hub) .student-notification-filter-tabs button.active{background:var(--student-notification-accent,#2563eb);color:#fff}
.dark .student-learning-page:not(.student-class-hub) .student-notification-delete-all{background:#111827;border-color:#7f1d1d;color:#fca5a5}
.dark .student-learning-page:not(.student-class-hub) .student-notification-delete-all:hover:not(:disabled){background:#3f1d24;border-color:#991b1b}
.dark .student-learning-page:not(.student-class-hub) .student-notification-action-error{background:#3f1d24;border-color:#7f1d1d;color:#fecaca}
.dark .student-learning-page:not(.student-class-hub) .student-notification-center-card{background:#111827;border-color:color-mix(in srgb,var(--student-notification-accent,#2563eb) 38%,#334155);box-shadow:none}
.dark .student-learning-page:not(.student-class-hub) .student-notification-center-card.unread{background:color-mix(in srgb,var(--student-notification-accent,#2563eb) 7%,#111827);border-color:color-mix(in srgb,var(--student-notification-accent,#2563eb) 62%,#475569)}
.dark .student-learning-page:not(.student-class-hub) .student-notification-center-card.read{border-color:#334155}
.dark .student-learning-page:not(.student-class-hub) .student-notification-center-card[role="button"]:hover,.dark .student-learning-page:not(.student-class-hub) .student-notification-center-card[role="button"]:focus-visible{background:#172033;border-color:color-mix(in srgb,var(--student-notification-accent,#2563eb) 72%,#64748b);box-shadow:0 10px 24px rgba(0,0,0,.22)}
.dark .student-learning-page:not(.student-class-hub) .student-notification-center-icon{background:#1e293b;color:#94a3b8}
.dark .student-learning-page:not(.student-class-hub) .student-notification-center-icon.severity-critical,.dark .student-learning-page:not(.student-class-hub) .student-notification-center-icon.severity-warning{background:#3f1d24;color:#fca5a5}
.dark .student-learning-page:not(.student-class-hub) .student-notification-center-icon.severity-reward{background:#12351f;color:#86efac}
.dark .student-learning-page:not(.student-class-hub) .student-notification-center-icon.severity-important{background:#422006;color:#fbbf24}
.dark .student-learning-page:not(.student-class-hub) .student-notification-center-icon.severity-medium{background:#172554;color:#93c5fd}
.dark .student-learning-page:not(.student-class-hub) .student-notification-center-title-line>strong{color:#f8fafc}
.dark .student-learning-page:not(.student-class-hub) .student-notification-center-badges em.automatic{background:#0c4a6e;color:#bae6fd}
.dark .student-learning-page:not(.student-class-hub) .student-notification-center-badges em.critical{background:#7f1d1d;color:#fecaca}
.dark .student-learning-page:not(.student-class-hub) .student-notification-center-badges em.warning{background:#431407;color:#fdba74}
.dark .student-learning-page:not(.student-class-hub) .student-notification-center-badges em.reward{background:#14532d;color:#bbf7d0}
.dark .student-learning-page:not(.student-class-hub) .student-notification-center-badges em.important{background:#431407;color:#fed7aa}
.dark .student-learning-page:not(.student-class-hub) .student-notification-center-content>p{color:#cbd5e1}
.dark .student-learning-page:not(.student-class-hub) .student-notification-center-content>small{color:#94a3b8}
.dark .student-learning-page:not(.student-class-hub) .student-notification-center-content .student-notification-files a{background:#172554;border-color:#1e3a8a;color:#93c5fd}
.dark .student-learning-page:not(.student-class-hub) .student-notification-trash-btn{background:#111827;border-color:#7f1d1d;color:#fca5a5}
.dark .student-learning-page:not(.student-class-hub) .student-notification-trash-btn:hover:not(:disabled){background:#3f1d24;border-color:#991b1b}
.dark .student-learning-page:not(.student-class-hub) .student-notification-center-empty{background:#111827;border-color:#334155;color:#94a3b8}
.dark .student-learning-page:not(.student-class-hub) .student-notification-delete-modal{background:#111827;border-color:#334155;color:#f8fafc}
.dark .student-learning-page:not(.student-class-hub) .student-notification-delete-modal>p{color:#cbd5e1}

@media(max-width:900px){
  .student-notification-center-head{align-items:flex-start;flex-direction:column}
  .student-notification-center-actions{width:100%;justify-content:flex-start}
}
@media(max-width:620px){
  .student-notification-center-title h1{font-size:22px}
  .student-notification-center-actions{display:grid;grid-template-columns:1fr auto;gap:8px}
  .student-notification-center-actions>.student-class-select{grid-column:1/-1;width:100%}
  .student-notification-filter-tabs{min-width:0;width:100%}
  .student-notification-filter-tabs button{flex:1;min-width:0;padding:0 10px;font-size:10px}
  .student-notification-delete-all{padding:0 12px;font-size:10px}
  .student-notification-center-card{grid-template-columns:42px minmax(0,1fr) 38px;gap:10px;min-height:96px;border-radius:15px;padding:13px 12px}
  .student-notification-center-icon{width:40px;height:40px;border-radius:12px;font-size:15px}
  .student-notification-center-title-line>strong{font-size:12px}
  .student-notification-center-badges em{font-size:8px;padding:3px 6px}
  .student-notification-center-content>p{font-size:10px;margin-top:6px}
  .student-notification-center-content>small{font-size:8px;margin-top:5px}
  .student-notification-trash-btn{width:36px;height:36px;border-radius:10px;font-size:15px}
}
@media(max-width:420px){
  .student-notification-center-actions{grid-template-columns:1fr}
  .student-notification-delete-all{width:100%}
  .student-notification-center-card{grid-template-columns:38px minmax(0,1fr);align-items:start}
  .student-notification-center-icon{width:36px;height:36px}
  .student-notification-card-actions{grid-column:2;justify-content:flex-start}
  .student-notification-trash-btn{width:auto;height:32px;padding:0 10px}
}

/* 2026-08-21: E-learning resources inside student class workspace */
.student-elearning-resources-page{display:grid;gap:16px;min-width:0}
.student-elearning-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.student-elearning-stats article{display:flex;align-items:center;gap:11px;min-width:0;border:1px solid #e2e8f0;border-radius:15px;background:#fff;padding:14px 15px;box-shadow:0 4px 12px rgba(15,23,42,.04)}
.student-elearning-stats article>span{width:38px;height:38px;border-radius:11px;background:#eff6ff;color:#2563eb;display:grid;place-items:center;flex:0 0 auto;font-weight:900}
.student-elearning-stats strong,.student-elearning-stats small{display:block}.student-elearning-stats strong{color:#0f172a;font-size:20px}.student-elearning-stats small{margin-top:2px;color:#64748b;font-size:10px;font-weight:700}
.student-elearning-toolbar{display:grid;grid-template-columns:minmax(240px,1.3fr) auto auto;gap:12px;align-items:end}
.student-elearning-search{height:46px;display:flex;align-items:center;gap:9px;border:1px solid #dbe3ef;border-radius:13px;background:#fff;padding:0 13px}.student-elearning-search>span{color:#64748b;font-size:21px}.student-elearning-search input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:#0f172a;font-size:12px}.student-elearning-search input::placeholder{color:#94a3b8}
.student-elearning-scope{display:flex;align-items:center;gap:4px;border:1px solid #dbe3ef;border-radius:13px;background:#f8fafc;padding:4px}.student-elearning-scope button{display:flex;align-items:center;justify-content:center;gap:6px;min-height:36px;border:0;border-radius:9px;background:transparent;color:#64748b;padding:0 10px;font-size:10px;font-weight:850;cursor:pointer;white-space:nowrap}.student-elearning-scope button b{min-width:18px;border-radius:999px;background:#e2e8f0;color:#475569;padding:2px 5px;font-size:9px}.student-elearning-scope button.active{background:#fff;color:#2563eb;box-shadow:0 2px 7px rgba(15,23,42,.08)}.student-elearning-scope button.active b{background:#dbeafe;color:#1d4ed8}
.student-elearning-selects{display:flex;align-items:flex-end;gap:8px}.student-elearning-selects label{display:grid;gap:4px;color:#64748b;font-size:9px;font-weight:800}.student-elearning-selects select{height:46px;min-width:118px;border:1px solid #dbe3ef;border-radius:12px;background:#fff;color:#334155;padding:0 30px 0 10px;font-size:10px;font-weight:750;outline:0}
.student-elearning-error{border:1px solid #fecaca;border-radius:12px;background:#fef2f2;color:#b91c1c;padding:11px 13px;font-size:11px;font-weight:750}
.student-elearning-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(245px,1fr));gap:14px}.student-elearning-card{position:relative;min-width:0;overflow:hidden;border:1px solid #e2e8f0;border-radius:18px;background:#fff;box-shadow:0 6px 18px rgba(15,23,42,.06);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}.student-elearning-card:hover{transform:translateY(-3px);border-color:#bfdbfe;box-shadow:0 14px 28px rgba(15,23,42,.11)}.student-elearning-card-open{position:absolute;inset:0;z-index:5;border:0;background:transparent;cursor:pointer}.student-elearning-thumb{height:142px;position:relative;overflow:hidden;background:linear-gradient(135deg,#2563eb,#4f46e5);background-position:center;background-size:cover}.student-elearning-card.format-document .student-elearning-thumb{background-image:linear-gradient(135deg,#059669,#0f766e)}.student-elearning-card.format-simulation .student-elearning-thumb{background-image:linear-gradient(135deg,#7c3aed,#4338ca)}.student-elearning-card.format-code .student-elearning-thumb{background-image:linear-gradient(135deg,#111827,#334155)}.student-elearning-thumb>strong{position:absolute;left:13px;bottom:-7px;color:rgba(255,255,255,.13);font-size:34px;font-weight:950}.student-elearning-format{position:absolute;left:10px;top:10px;max-width:62%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid rgba(255,255,255,.26);border-radius:8px;background:rgba(15,23,42,.72);color:#fff;padding:6px 8px;font-size:9px;font-weight:900;backdrop-filter:blur(6px)}.student-elearning-thumb>small{position:absolute;right:10px;bottom:10px;border-radius:7px;background:rgba(2,6,23,.82);color:#fff;padding:5px 7px;font-size:9px;font-weight:850}
.student-elearning-card-body{padding:14px}.student-elearning-subject{display:block;color:#2563eb;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.05em}.student-elearning-card-body h2{margin:4px 0 0;min-height:38px;color:#0f172a;font-size:13px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.student-elearning-card-body>p{height:34px;margin:9px 0 12px;color:#64748b;font-size:9.5px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.student-elearning-teacher{display:flex;align-items:center;gap:8px;padding-top:10px;border-top:1px solid #eef2f7}.student-elearning-teacher>span{width:30px;height:30px;border-radius:999px;background:#e0e7ff;color:#4338ca;display:grid;place-items:center;flex:0 0 auto;font-size:10px;font-weight:900;overflow:hidden}.student-elearning-teacher>span img{width:100%;height:100%;object-fit:cover;display:block}.student-elearning-teacher>div{min-width:0}.student-elearning-teacher strong,.student-elearning-teacher small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.student-elearning-teacher strong{color:#334155;font-size:9.5px}.student-elearning-teacher small{margin-top:2px;color:#94a3b8;font-size:8px}.student-elearning-card footer{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:11px;color:#94a3b8;font-size:8px;font-weight:700}
.student-elearning-card.skeleton{pointer-events:none}.student-elearning-card.skeleton .student-elearning-thumb,.student-elearning-card.skeleton .student-elearning-card-body i{background:linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%);background-size:200% 100%;animation:studentElearningShimmer 1.3s infinite}.student-elearning-card.skeleton .student-elearning-card-body i{display:block;height:10px;border-radius:7px;margin-top:8px}.student-elearning-card.skeleton .student-elearning-card-body i:first-child{width:72%;height:15px}.student-elearning-card.skeleton .student-elearning-card-body i:last-child{width:50%}@keyframes studentElearningShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.dark .student-learning-page:not(.student-class-hub) .student-elearning-stats article,.dark .student-learning-page:not(.student-class-hub) .student-elearning-search,.dark .student-learning-page:not(.student-class-hub) .student-elearning-selects select,.dark .student-learning-page:not(.student-class-hub) .student-elearning-card{background:#111827;border-color:#273449}.dark .student-learning-page:not(.student-class-hub) .student-elearning-stats strong,.dark .student-learning-page:not(.student-class-hub) .student-elearning-search input,.dark .student-learning-page:not(.student-class-hub) .student-elearning-card-body h2{color:#f8fafc}.dark .student-learning-page:not(.student-class-hub) .student-elearning-stats small,.dark .student-learning-page:not(.student-class-hub) .student-elearning-selects label,.dark .student-learning-page:not(.student-class-hub) .student-elearning-card-body>p{color:#94a3b8}.dark .student-learning-page:not(.student-class-hub) .student-elearning-scope{background:#0f172a;border-color:#334155}.dark .student-learning-page:not(.student-class-hub) .student-elearning-scope button{color:#94a3b8}.dark .student-learning-page:not(.student-class-hub) .student-elearning-scope button b{background:#1e293b;color:#cbd5e1}.dark .student-learning-page:not(.student-class-hub) .student-elearning-scope button.active{background:#1e293b;color:#93c5fd;box-shadow:none}.dark .student-learning-page:not(.student-class-hub) .student-elearning-scope button.active b{background:#1e3a8a;color:#bfdbfe}.dark .student-learning-page:not(.student-class-hub) .student-elearning-selects select{color:#e2e8f0}.dark .student-learning-page:not(.student-class-hub) .student-elearning-teacher{border-color:#263244}.dark .student-learning-page:not(.student-class-hub) .student-elearning-teacher strong{color:#e2e8f0}.dark .student-learning-page:not(.student-class-hub) .student-elearning-error{background:#3f1d24;border-color:#7f1d1d;color:#fecaca}.dark .student-learning-page:not(.student-class-hub) .student-elearning-card.skeleton .student-elearning-thumb,.dark .student-learning-page:not(.student-class-hub) .student-elearning-card.skeleton .student-elearning-card-body i{background:linear-gradient(90deg,#1e293b 25%,#334155 50%,#1e293b 75%);background-size:200% 100%}
@media(max-width:1050px){.student-elearning-toolbar{grid-template-columns:1fr}.student-elearning-scope{width:max-content;max-width:100%;overflow-x:auto}.student-elearning-selects{justify-content:flex-start}}
@media(max-width:700px){.student-elearning-stats{grid-template-columns:1fr 1fr}.student-elearning-grid{grid-template-columns:1fr}.student-elearning-scope{width:100%}.student-elearning-scope button{flex:1}.student-elearning-selects{display:grid;grid-template-columns:1fr 1fr}.student-elearning-selects label,.student-elearning-selects select{width:100%;min-width:0}.student-elearning-thumb{height:165px}}
@media(max-width:430px){.student-elearning-stats{grid-template-columns:1fr}.student-elearning-scope{display:grid;grid-template-columns:1fr}.student-elearning-selects{grid-template-columns:1fr}.student-elearning-card-body h2{min-height:0}}


/* 2026-08-21: student exam workspace synced with Exams module */
.student-class-exam-page{display:grid;gap:16px;min-width:0}
.student-class-exam-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px}.student-class-exam-head>div>span{display:block;color:#5339f7;font-size:10px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.student-class-exam-head h1{margin:5px 0 5px;color:#0f172a;font-size:24px}.student-class-exam-head p{margin:0;max-width:720px;color:#64748b;font-size:11px;line-height:1.55}.student-class-exam-open-page{min-height:42px;flex:0 0 auto;border:1px solid #ddd6fe;border-radius:11px;background:#fff;color:#5b45e8;padding:0 14px;font-size:11px;font-weight:850;cursor:pointer}.student-class-exam-open-page:hover{background:#f5f3ff;border-color:#c4b5fd}
.student-class-exam-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px}.student-class-exam-stats article{display:flex;align-items:center;gap:10px;min-width:0;border:1px solid #e2e8f0;border-radius:14px;background:#fff;padding:13px 14px;box-shadow:0 4px 12px rgba(15,23,42,.04)}.student-class-exam-stats article>span{width:36px;height:36px;border-radius:10px;background:#ede9fe;color:#6d28d9;display:grid;place-items:center;flex:0 0 auto;font-size:13px;font-weight:950}.student-class-exam-stats article.active>span{background:#dcfce7;color:#15803d}.student-class-exam-stats article.upcoming>span{background:#fef3c7;color:#b45309}.student-class-exam-stats article.ended>span{background:#fee2e2;color:#b91c1c}.student-class-exam-stats strong,.student-class-exam-stats small{display:block}.student-class-exam-stats strong{color:#0f172a;font-size:20px}.student-class-exam-stats small{margin-top:2px;color:#64748b;font-size:9px;font-weight:750}
.student-class-exam-toolbar{display:grid;gap:11px;border:1px solid #e2e8f0;border-radius:16px;background:#fff;padding:12px;box-shadow:0 4px 14px rgba(15,23,42,.04)}.student-class-exam-tabs{display:flex;gap:6px;flex-wrap:wrap}.student-class-exam-tabs button{min-height:34px;border:1px solid #e2e8f0;border-radius:999px;background:#fff;color:#64748b;padding:0 12px;font-size:9.5px;font-weight:850;cursor:pointer}.student-class-exam-tabs button.active{border-color:#5339f7;background:#5339f7;color:#fff;box-shadow:0 5px 12px rgba(83,57,247,.16)}.student-class-exam-tools{display:grid;grid-template-columns:minmax(220px,1fr) 150px minmax(190px,240px);gap:9px}.student-class-exam-search{height:42px;display:flex;align-items:center;gap:8px;border:1px solid #dbe3ef;border-radius:11px;background:#fff;padding:0 11px}.student-class-exam-search span{color:#64748b;font-size:18px}.student-class-exam-search input,.student-class-exam-code input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:#0f172a;font-size:10.5px}.student-class-exam-search input::placeholder,.student-class-exam-code input::placeholder{color:#94a3b8}.student-class-exam-tools>select{height:42px;border:1px solid #dbe3ef;border-radius:11px;background:#fff;color:#334155;padding:0 28px 0 10px;font-size:10px;font-weight:750;outline:0}.student-class-exam-code{height:42px;display:flex;align-items:center;border:1px solid #dbe3ef;border-radius:11px;background:#fff;overflow:hidden}.student-class-exam-code input{padding:0 10px}.student-class-exam-code button{height:100%;border:0;background:#5339f7;color:#fff;padding:0 13px;font-size:10px;font-weight:900;cursor:pointer}.student-class-exam-code button:hover{background:#4630df}
.student-class-exam-list{display:grid;gap:10px}.student-class-exam-card{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:13px;min-width:0;border:1px solid #e2e8f0;border-radius:16px;background:#fff;padding:14px 15px;box-shadow:0 5px 14px rgba(15,23,42,.05);transition:border-color .16s ease,box-shadow .16s ease,transform .16s ease}.student-class-exam-card:hover{transform:translateY(-1px);border-color:#c4b5fd;box-shadow:0 10px 22px rgba(15,23,42,.08)}.student-class-exam-card-icon{width:46px;height:46px;border-radius:13px;background:#ede9fe;color:#6d28d9;display:grid;place-items:center}.student-class-exam-card-icon span{font-size:18px;font-weight:950}.student-class-exam-card.active .student-class-exam-card-icon{background:#dcfce7;color:#15803d}.student-class-exam-card.upcoming .student-class-exam-card-icon{background:#fef3c7;color:#b45309}.student-class-exam-card.ended .student-class-exam-card-icon{background:#f1f5f9;color:#64748b}.student-class-exam-card-main{min-width:0}.student-class-exam-card-title{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.student-class-exam-card-title>div{min-width:0}.student-class-exam-card-title>div>span{display:block;color:#6d28d9;font-size:8.5px;font-weight:950;text-transform:uppercase;letter-spacing:.06em}.student-class-exam-card-title h2{margin:3px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#0f172a;font-size:13px}.student-class-exam-card-title em{flex:0 0 auto;border:1px solid #e2e8f0;border-radius:999px;background:#f8fafc;color:#64748b;padding:4px 8px;font-size:8.5px;font-style:normal;font-weight:850}.student-class-exam-card-title em.active{border-color:#bbf7d0;background:#f0fdf4;color:#15803d}.student-class-exam-card-title em.upcoming{border-color:#fde68a;background:#fffbeb;color:#b45309}.student-class-exam-card-title em.ended{border-color:#fecaca;background:#fef2f2;color:#b91c1c}.student-class-exam-meta{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:7px;color:#64748b;font-size:8.5px;font-weight:700}.student-class-exam-result{display:flex;align-items:center;gap:8px;margin-top:8px}.student-class-exam-result span{border-radius:999px;background:#ecfdf5;color:#047857;padding:4px 8px;font-size:8.5px;font-weight:900}.student-class-exam-result strong{color:#047857;font-size:10px}.student-class-exam-enter{min-width:104px;min-height:40px;border:0;border-radius:11px;background:#5339f7;color:#fff;padding:0 13px;font-size:10px;font-weight:900;cursor:pointer}.student-class-exam-enter:hover:not(:disabled){background:#4630df}.student-class-exam-enter:disabled{cursor:not-allowed;background:#e2e8f0;color:#94a3b8}
.student-class-exam-skeleton{display:grid;gap:10px}.student-class-exam-skeleton i{display:block;height:82px;border-radius:15px;background:linear-gradient(90deg,#e2e8f0,#f8fafc,#e2e8f0);background-size:200% 100%;animation:studentExamShimmer 1.25s infinite}@keyframes studentExamShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.dark .student-learning-page:not(.student-class-hub) .student-class-exam-head h1{color:#f8fafc}.dark .student-learning-page:not(.student-class-hub) .student-class-exam-head p{color:#94a3b8}.dark .student-learning-page:not(.student-class-hub) .student-class-exam-open-page{border-color:#4338ca;background:#111827;color:#c4b5fd}.dark .student-learning-page:not(.student-class-hub) .student-class-exam-open-page:hover{background:#1e1b4b}.dark .student-learning-page:not(.student-class-hub) .student-class-exam-stats article,.dark .student-learning-page:not(.student-class-hub) .student-class-exam-toolbar,.dark .student-learning-page:not(.student-class-hub) .student-class-exam-card,.dark .student-learning-page:not(.student-class-hub) .student-class-exam-search,.dark .student-learning-page:not(.student-class-hub) .student-class-exam-tools>select,.dark .student-learning-page:not(.student-class-hub) .student-class-exam-code{border-color:#273449;background:#111827}.dark .student-learning-page:not(.student-class-hub) .student-class-exam-stats strong,.dark .student-learning-page:not(.student-class-hub) .student-class-exam-card-title h2,.dark .student-learning-page:not(.student-class-hub) .student-class-exam-search input,.dark .student-learning-page:not(.student-class-hub) .student-class-exam-code input{color:#f8fafc}.dark .student-learning-page:not(.student-class-hub) .student-class-exam-stats small,.dark .student-learning-page:not(.student-class-hub) .student-class-exam-meta{color:#94a3b8}.dark .student-learning-page:not(.student-class-hub) .student-class-exam-tabs button{border-color:#334155;background:#0f172a;color:#cbd5e1}.dark .student-learning-page:not(.student-class-hub) .student-class-exam-tabs button.active{border-color:#6d5dfc;background:#6d5dfc;color:#fff}.dark .student-learning-page:not(.student-class-hub) .student-class-exam-tools>select{color:#e2e8f0}.dark .student-learning-page:not(.student-class-hub) .student-class-exam-card-title em{border-color:#334155;background:#1e293b;color:#cbd5e1}.dark .student-learning-page:not(.student-class-hub) .student-class-exam-card-title em.active{border-color:#065f46;background:#052e2b;color:#6ee7b7}.dark .student-learning-page:not(.student-class-hub) .student-class-exam-card-title em.upcoming{border-color:#92400e;background:#451a03;color:#fcd34d}.dark .student-learning-page:not(.student-class-hub) .student-class-exam-card-title em.ended{border-color:#7f1d1d;background:#3f0a0a;color:#fca5a5}.dark .student-learning-page:not(.student-class-hub) .student-class-exam-enter:disabled{background:#1e293b;color:#64748b}.dark .student-learning-page:not(.student-class-hub) .student-class-exam-skeleton i{background:linear-gradient(90deg,#1e293b,#334155,#1e293b);background-size:200% 100%}
@media(max-width:900px){.student-class-exam-head{align-items:stretch;flex-direction:column}.student-class-exam-open-page{width:max-content}.student-class-exam-stats{grid-template-columns:1fr 1fr}.student-class-exam-tools{grid-template-columns:1fr 1fr}.student-class-exam-search{grid-column:1/-1}.student-class-exam-code{min-width:0}}
@media(max-width:620px){.student-class-exam-head h1{font-size:21px}.student-class-exam-open-page{width:100%}.student-class-exam-stats{grid-template-columns:1fr 1fr;gap:8px}.student-class-exam-stats article{padding:10px}.student-class-exam-toolbar{padding:10px}.student-class-exam-tabs{display:grid;grid-template-columns:1fr 1fr}.student-class-exam-tabs button{width:100%}.student-class-exam-tools{grid-template-columns:1fr}.student-class-exam-search{grid-column:auto}.student-class-exam-tools>select,.student-class-exam-code{width:100%}.student-class-exam-card{grid-template-columns:42px minmax(0,1fr);align-items:start;padding:12px}.student-class-exam-card-icon{width:40px;height:40px}.student-class-exam-card-title{display:block}.student-class-exam-card-title em{display:inline-flex;margin-top:6px}.student-class-exam-enter{grid-column:2;width:100%;min-height:38px}.student-class-exam-meta{line-height:1.5}}
@media(max-width:400px){.student-class-exam-stats{grid-template-columns:1fr}.student-class-exam-tabs{grid-template-columns:1fr}.student-class-exam-card{grid-template-columns:1fr}.student-class-exam-card-icon{display:none}.student-class-exam-enter{grid-column:1}}


/* 2026-08-21: student chat per-message actions */
.student-chat-messages .student-message{position:relative;align-items:center;gap:7px;animation:studentMessageBubbleIn .24s cubic-bezier(.2,.8,.2,1) both}
.student-chat-messages .student-message-bubble{position:relative;transition:transform .18s ease,box-shadow .18s ease,filter .18s ease}
.student-chat-messages .student-message:hover .student-message-bubble{transform:translateY(-1px);box-shadow:0 8px 18px rgba(15,23,42,.08)}
.student-chat-messages .student-message.own:hover .student-message-bubble{box-shadow:0 10px 22px rgba(37,99,235,.22)}
.student-message-actions{display:flex;align-items:center;gap:5px;flex:0 0 auto;opacity:.7;transform:translateX(-4px);transition:opacity .18s ease,transform .18s ease}
.student-message.own .student-message-actions{order:-1;transform:translateX(4px)}
.student-message:hover .student-message-actions,.student-message:focus-within .student-message-actions{opacity:1;transform:translateX(0)}
.student-message-action{height:32px;min-width:32px;max-width:32px;border:1px solid #dbe3ef!important;border-radius:999px!important;background:rgba(255,255,255,.96)!important;color:#64748b!important;display:inline-flex;align-items:center;justify-content:center;gap:0;padding:0 8px!important;overflow:hidden;white-space:nowrap;box-shadow:0 5px 14px rgba(15,23,42,.08);cursor:pointer;transition:max-width .24s cubic-bezier(.2,.8,.2,1),background .18s ease,border-color .18s ease,color .18s ease,transform .18s ease,box-shadow .18s ease!important}
.student-message-action>span{width:15px;flex:0 0 15px;display:grid;place-items:center;font-size:13px;font-weight:900;transition:transform .2s ease}
.student-message-action>b{max-width:0;opacity:0;overflow:hidden;font-size:9px;font-weight:900;transition:max-width .24s ease,opacity .16s ease,margin-left .24s ease}
.student-message:hover .student-message-action,.student-message-action:focus-visible,.student-message-action.copied{max-width:92px}
.student-message:hover .student-message-action>b,.student-message-action:focus-visible>b,.student-message-action.copied>b{max-width:52px;opacity:1;margin-left:4px}
.student-message-action:hover{transform:translateY(-2px);box-shadow:0 8px 18px rgba(15,23,42,.13)}
.student-message-action.copy:hover{border-color:#93c5fd!important;background:#eff6ff!important;color:#1d4ed8!important}
.student-message-action.copy.copied{border-color:#86efac!important;background:#ecfdf5!important;color:#047857!important;animation:studentMessageActionPop .28s cubic-bezier(.2,.8,.2,1)}
.student-message-action.copy.copied>span{transform:scale(1.08)}
.student-message-action.recall:hover{border-color:#fecaca!important;background:#fef2f2!important;color:#dc2626!important}
.student-message.recalled .student-message-bubble{font-style:italic;filter:saturate(.7);opacity:.82}
.dark .student-learning-page:not(.student-class-hub) .student-message-action{border-color:#334155!important;background:rgba(15,23,42,.96)!important;color:#94a3b8!important;box-shadow:0 7px 18px rgba(0,0,0,.24)}
.dark .student-learning-page:not(.student-class-hub) .student-message-action.copy:hover{border-color:#1d4ed8!important;background:#172554!important;color:#93c5fd!important}
.dark .student-learning-page:not(.student-class-hub) .student-message-action.copy.copied{border-color:#065f46!important;background:#052e2b!important;color:#6ee7b7!important}
.dark .student-learning-page:not(.student-class-hub) .student-message-action.recall:hover{border-color:#7f1d1d!important;background:#3f0a0a!important;color:#fca5a5!important}
@keyframes studentMessageBubbleIn{from{opacity:0;transform:translateY(7px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes studentMessageActionPop{0%{transform:scale(.9)}60%{transform:scale(1.08)}100%{transform:scale(1)}}
@media(max-width:780px){
  .student-chat-messages .student-message{gap:5px}
  .student-message-actions{opacity:1;transform:none!important;gap:4px}
  .student-message-action{height:30px;min-width:30px;max-width:30px;padding:0 7px!important}
  .student-message:hover .student-message-action{max-width:30px}
  .student-message:hover .student-message-action>b{max-width:0;opacity:0;margin-left:0}
  .student-message-action.copied{max-width:78px}
  .student-message-action.copied>b{max-width:46px;opacity:1;margin-left:3px}
}
@media(prefers-reduced-motion:reduce){
  .student-chat-messages .student-message,.student-message-action.copy.copied{animation:none}
  .student-message-actions,.student-message-action,.student-message-action>b,.student-message-bubble{transition:none!important}
}
`
export default LearningPage
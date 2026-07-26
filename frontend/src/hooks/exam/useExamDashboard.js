import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, BookOpenCheck, Clock3, FileText, Globe2, GraduationCap, LockKeyhole, Trophy, UsersRound } from 'lucide-react'

import useExamsPage from './useExamsPage.js'

const getStudentKey = (result = {}) => String(
  result.studentId || result.userId || result.uid || result.studentEmail || result.email || '',
)

const getTimestamp = (value) => {
  if (!value) return 0
  const date = value?.toDate ? value.toDate() : new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

export default function useExamDashboard() {
  const navigate = useNavigate()
  const page = useExamsPage()
  const [dashboardOpenedAt] = useState(() => Date.now())

  const recentExams = useMemo(() => {
    return [...page.visibleExams]
      .sort((a, b) => getTimestamp(b.createdAt || b.startTime) - getTimestamp(a.createdAt || a.startTime))
      .slice(0, 5)
  }, [page.visibleExams])

  const completedExams = useMemo(() => {
    if (!page.currentUserId) return []
    return page.visibleExams.filter((exam) =>
      (exam.studentResults || []).some((result) => getStudentKey(result) === page.currentUserId),
    )
  }, [page.currentUserId, page.visibleExams])

  const upcomingExams = useMemo(() => {
    return page.visibleExams
      .filter((exam) => {
        const start = getTimestamp(exam.startTime)
        return start > dashboardOpenedAt
      })
      .sort((a, b) => getTimestamp(a.startTime) - getTimestamp(b.startTime))
      .slice(0, 5)
  }, [dashboardOpenedAt, page.visibleExams])

  const studentAverageScore = useMemo(() => {
    if (!page.currentUserId) return 0
    const scores = page.visibleExams
      .flatMap((exam) => exam.studentResults || [])
      .filter((result) => getStudentKey(result) === page.currentUserId)
      .map((result) => Number(result.score || 0))
    if (!scores.length) return 0
    return Number((scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1))
  }, [page.currentUserId, page.visibleExams])

  const totalSubmissions = useMemo(
    () => page.visibleExams.reduce((total, exam) => total + (exam.studentResults?.length || 0), 0),
    [page.visibleExams],
  )

  const uniqueStudents = useMemo(() => {
    const ids = new Set()
    page.visibleExams.forEach((exam) => {
      ;(exam.studentResults || []).forEach((result) => {
        const key = getStudentKey(result)
        if (key) ids.add(key)
      })
    })
    return ids.size
  }, [page.visibleExams])

  const activeExams = useMemo(
    () => page.visibleExams.filter((exam) => exam.availabilityStatus === 'published').length,
    [page.visibleExams],
  )

  const publicExams = useMemo(
    () => page.visibleExams.filter((exam) => exam.status === 'public').length,
    [page.visibleExams],
  )

  const privateExams = Math.max(0, page.visibleExams.length - publicExams)

  const studentStats = [
    { label: 'Đề khả dụng', value: page.visibleExams.length, helper: 'Từ hệ thống hiện tại', Icon: FileText, tone: 'blue' },
    { label: 'Đã hoàn thành', value: completedExams.length, helper: 'Dựa trên bài đã nộp', Icon: BookOpenCheck, tone: 'emerald' },
    { label: 'Sắp diễn ra', value: upcomingExams.length, helper: 'Có lịch mở trong tương lai', Icon: Clock3, tone: 'amber' },
    { label: 'Xếp hạng', value: page.currentStudentRank ? `#${page.currentStudentRank.rank}` : '—', helper: `${page.leaderboard.length} học sinh có dữ liệu`, Icon: Trophy, tone: 'violet' },
  ]

  const managerStats = [
    { label: 'Tổng đề thi', value: page.visibleExams.length, helper: 'Đề bạn có quyền quản lý', Icon: FileText, tone: 'blue' },
    { label: 'Đang hoạt động', value: activeExams, helper: 'Đề đang trong thời gian hoạt động', Icon: Activity, tone: 'emerald' },
    { label: 'Công khai', value: publicExams, helper: 'Mọi học sinh có thể thấy', Icon: Globe2, tone: 'amber' },
    { label: 'Riêng tư', value: privateExams, helper: 'Theo lớp được chỉ định', Icon: LockKeyhole, tone: 'violet' },
    { label: 'Lượt nộp', value: totalSubmissions, helper: 'Tổng kết quả đã ghi nhận', Icon: GraduationCap, tone: 'rose' },
    { label: 'Học sinh', value: uniqueStudents, helper: 'Người học đã tham gia', Icon: UsersRound, tone: 'blue' },
  ]

  const openExam = (exam) => {
    if (!exam?.id) return
    if (page.isStudent) {
      navigate(`/exam/${exam.id}`, { state: { role: page.role } })
      return
    }
    page.previewExam(exam)
  }

  return {
    ...page,
    recentExams,
    completedExams,
    upcomingExams,
    totalSubmissions,
    uniqueStudents,
    activeExams,
    studentAverageScore,
    studentStats,
    managerStats,
    openExam,
    goToLibrary: () => navigate('/exams/library'),
    goToCreate: () => navigate('/exams/create'),
  }
}

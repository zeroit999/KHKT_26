import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock3, FileText, Globe2, LockKeyhole } from 'lucide-react'
import toast from 'react-hot-toast'

import useExams from './useExams'
import {
  canManageExams,
  isStudentRole,
  normalizeSubject,
  teacherSubjects,
} from '../../utils/examHelpers'

export default function useExamsPage() {
  const navigate = useNavigate()
  const state = useExams()

  const {
    role,
    currentUserId,
    studentClasses,
    visibleExams,
    codeSearch,
    setStatsOpen,
    setCreateOpen,
    setEditingExam,
    setResultsExam,
    setDeleteConfirmExam,
    deleteConfirmExam,
    deleteExam,
    canEditExam,
  } = state

  const isStudent = isStudentRole(role)
  const canManage = canManageExams(role)

  const availableSubjects = useMemo(() => {
    const examSubjects = visibleExams
      .map((exam) => normalizeSubject(exam.subject))
      .filter(Boolean)

    return Array.from(new Set([...teacherSubjects, ...examSubjects]))
  }, [visibleExams])

  const completedExams = useMemo(() => {
    return visibleExams.filter((exam) =>
      exam.studentResults?.some((result) => result.studentId === currentUserId),
    )
  }, [visibleExams, currentUserId])

  const pendingExams = Math.max(0, visibleExams.length - completedExams.length)

  const studentAverageScore = useMemo(() => {
    const scores = visibleExams
      .flatMap((exam) => exam.studentResults ?? [])
      .filter((result) => result.studentId === currentUserId)
      .map((result) => Number(result.score || 0))

    return scores.length
      ? (
          scores.reduce((total, score) => total + score, 0) / scores.length
        ).toFixed(1)
      : '0.0'
  }, [visibleExams, currentUserId])

  const studentStatCards = [
    {
      label: 'Đề thi khả dụng',
      value: visibleExams.length,
      Icon: FileText,
      iconClass: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Đã hoàn thành',
      value: completedExams.length,
      Icon: Globe2,
      iconClass: 'bg-emerald-100 text-emerald-600',
    },
    {
      label: 'Chưa làm',
      value: pendingExams,
      Icon: Clock3,
      iconClass: 'bg-orange-100 text-orange-600',
    },
    {
      label: 'Điểm trung bình',
      value: studentAverageScore,
      Icon: FileText,
      iconClass: 'bg-violet-100 text-violet-600',
    },
  ]

  const teacherStatCards = [
    {
      label: 'Tổng đề thi',
      value: visibleExams.length,
      Icon: FileText,
      iconClass: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Công khai',
      value: visibleExams.filter((exam) => exam.status === 'public').length,
      Icon: Globe2,
      iconClass: 'bg-emerald-100 text-emerald-600',
    },
    {
      label: 'Riêng tư',
      value: visibleExams.filter((exam) => exam.status !== 'public').length,
      Icon: LockKeyhole,
      iconClass: 'bg-violet-100 text-violet-600',
    },
    {
      label: 'Hoạt động',
      value: visibleExams.filter((exam) => exam.availabilityStatus === 'published').length,
      Icon: FileText,
      iconClass: 'bg-green-100 text-green-600',
    },
    {
      label: 'Chưa mở',
      value: visibleExams.filter((exam) => exam.availabilityStatus === 'draft').length,
      Icon: FileText,
      iconClass: 'bg-amber-100 text-amber-600',
    },
    {
      label: 'Đã kết thúc',
      value: visibleExams.filter((exam) => exam.availabilityStatus === 'ended').length,
      Icon: FileText,
      iconClass: 'bg-red-100 text-red-600',
    },
  ]

  const openByCode = () => {
    const exam = visibleExams.find(
      (item) => item.code?.toLowerCase() === codeSearch.trim().toLowerCase(),
    )

    if (!exam) {
      toast.error('Không tìm thấy mã bài thi')
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

  const getStudentAttemptCount = (exam) => {
    if (!currentUserId) return 0

    const attempt = exam.attempts?.find(
      (item) => item.id === currentUserId || item.studentId === currentUserId,
    )

    if (attempt) return Number(attempt.count || 0)

    return (
      exam.studentResults?.filter((result) => result.studentId === currentUserId)
        .length ?? 0
    )
  }

  const getExamMaxAttempts = (exam) =>
    exam.attemptMode === 'multiple'
      ? Math.max(1, Number(exam.maxAttempts || 1))
      : 1

  const getExamAudienceText = (exam) => {
    if (exam.status === 'public') {
      return exam.selectedGrades?.length
        ? `Công khai cho khối ${exam.selectedGrades.join(', ')}`
        : 'Công khai nhưng chưa chọn khối'
    }

    return exam.selectedClasses?.length
      ? exam.selectedClasses.join(', ')
      : 'Chưa chọn lớp'
  }

  const handleOutOfAttempts = () => {
    toast.error('Bạn đã hết số lượt làm bài thi này')
  }

  const openCreateModal = () => {
    setEditingExam(null)
    setCreateOpen(true)
  }

  const openEditModal = (exam) => {
    if (!canEditExam?.(exam)) {
      toast.error('Bạn không có quyền chỉnh sửa đề thi của giáo viên khác')
      return
    }

    setEditingExam(exam)
    setCreateOpen(true)
  }

  const closeCreateModal = () => {
    setCreateOpen(false)
    setEditingExam(null)
  }

  const closeDeleteConfirm = () => {
    setDeleteConfirmExam(null)
  }

  const confirmDeleteExam = () => {
    if (!deleteConfirmExam?.id) return

    if (!canEditExam?.(deleteConfirmExam)) {
      toast.error('Bạn không có quyền xóa đề thi của giáo viên khác')
      setDeleteConfirmExam(null)
      return
    }

    deleteExam(deleteConfirmExam.id)
  }

  return {
    ...state,
    isStudent,
    canManage,
    availableSubjects,
    studentStatCards,
    teacherStatCards,
    openByCode,
    copyExamLink,
    previewExam,
    getStudentAttemptCount,
    getExamMaxAttempts,
    getExamAudienceText,
    handleOutOfAttempts,
    openCreateModal,
    openEditModal,
    closeCreateModal,
    closeDeleteConfirm,
    confirmDeleteExam,
    closeResultsModal: () => setResultsExam(null),
    openStatsModal: () => setStatsOpen(true),
  }
}

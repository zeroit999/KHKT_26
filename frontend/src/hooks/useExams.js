import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { doc, getDoc } from 'firebase/firestore'

import { auth, db } from '../components/firebase'
import useSyncedDarkMode from './useSyncedDarkMode'

import {
  createExamApi,
  deleteExamApi,
  getExamsApi,
  updateExamApi,
} from '../api/examApi'

import {
  getDateTimeValue,
  isStudentRole,
  normalizeClassName,
  normalizeSubject,
  subjectCodes,
  getExamCode,
} from '../utils/examHelpers'

export default function useExams() {
  const dark = useSyncedDarkMode()

  const [role, setRole] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)

  const [teacherSubject, setTeacherSubject] = useState('Toán')
  const [teacherName, setTeacherName] = useState('GiaoVien')

  const [studentClass, setStudentClass] = useState('')
  const [studentClasses, setStudentClasses] = useState([])
  const [classes, setClasses] = useState([])

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
  const [resultsExam, setResultsExam] = useState(null)
  const [editingExam, setEditingExam] = useState(null)
  const [deleteConfirmExam, setDeleteConfirmExam] = useState(null)

  const loadExams = async () => {
    try {
      setLoading(true)
      const response = await getExamsApi()
      setExams(response.data?.exams ?? [])
    } catch (error) {
      console.error(error)
      toast.error(
        error?.response?.data?.message ||
          error.message ||
          'Không thể tải danh sách bài thi',
      )
      setExams([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loadUser = async () => {
      try {
        setRoleLoading(true)
        const user = auth.currentUser

        if (!user) {
          toast.error('Bạn chưa đăng nhập')
          return
        }

        setCurrentUserId(user.uid)
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        const userData = userSnap.exists() ? userSnap.data() : {}

        const firestoreRole = userData.role || userData.userRole || userData.type || 'STUDENT'
        setRole(firestoreRole)

        const displayName =
          userData.fullName ||
          userData.displayName ||
          userData.name ||
          userData.teacherName ||
          user.displayName ||
          user.email?.split('@')[0] ||
          'GiaoVien'
        setTeacherName(displayName)

        const fixedTeacherSubject =
          userData.subject ||
          userData.teacherSubject ||
          userData.major ||
          userData.specialization ||
          userData.chuyenMon ||
          userData.chuyênMôn ||
          'Toán'
        setTeacherSubject(normalizeSubject(fixedTeacherSubject))

        const userClass = String(
          userData.className ||
            userData.class ||
            userData.lop ||
            userData.grade ||
            userData.studentClass ||
            '',
        ).trim()

        if (userClass) {
          setStudentClass(userClass)
          setStudentClasses([userClass])
        }

        const userClasses = userData.classes || userData.classList || userData.managedClasses || []
        if (Array.isArray(userClasses)) {
          setClasses(userClasses.filter(Boolean))
        }
      } catch (error) {
        console.error(error)
        toast.error('Không thể tải dữ liệu người dùng')
      } finally {
        setRoleLoading(false)
      }
    }

    loadUser()
  }, [])

  useEffect(() => {
    if (!roleLoading) {
      loadExams()
    }
  }, [roleLoading])

  const visibleExams = useMemo(() => {
    const now = new Date()

    return exams
      .map((exam) => {
        const opened = !exam.openDate || now.getTime() >= getDateTimeValue(exam.openDate)
        const closed = Boolean(exam.closeDate && now.getTime() > getDateTimeValue(exam.closeDate))
        const isUpcoming = Boolean(exam.openDate && now.getTime() < getDateTimeValue(exam.openDate))
        const isActive = opened && !closed
        const availabilityStatus = isActive ? 'published' : isUpcoming ? 'draft' : 'ended'
        const questionCount = Number(exam.questionCount || exam.questions?.length || 0)
        const totalScore = Number(exam.totalScore || 0)
        const scorePerQuestion = Number(exam.scorePerQuestion || 0)

        return {
          ...exam,
          status: exam.status || 'public',
          questions: exam.questions ?? [],
          studentResults: exam.studentResults ?? [],
          attempts: exam.attempts ?? [],
          questionCount,
          totalScore,
          scorePerQuestion,
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
            exam.selectedClasses.some((item) =>
              normalizedStudentClasses.includes(normalizeClassName(item)),
            )

          if (!isPublicExam && !isAssignedPrivateExam) return false
        }

        if (privacyFilter !== 'all' && exam.status !== privacyFilter) return false
        if (publishFilter !== 'all' && exam.availabilityStatus !== publishFilter) return false
        if (subjectFilter !== 'all' && normalizeSubject(exam.subject) !== subjectFilter) return false

        const keyword = search.trim().toLowerCase()
        if (!keyword) return true

        return (
          exam.title?.toLowerCase().includes(keyword) ||
          exam.subject?.toLowerCase().includes(keyword) ||
          exam.topic?.toLowerCase().includes(keyword) ||
          exam.code?.toLowerCase().includes(keyword)
        )
      })
  }, [
    exams,
    role,
    roleLoading,
    studentClasses,
    search,
    subjectFilter,
    privacyFilter,
    publishFilter,
  ])

  const studentResults = exams.flatMap((exam) => exam.studentResults ?? [])

  const averageScore = studentResults.length
    ? (
        studentResults.reduce((total, item) => total + Number(item.score || 0), 0) /
        studentResults.length
      ).toFixed(1)
    : '0.0'

  const normalizeExamPayload = (exam) => {
    const fixedExamSubject = normalizeSubject(teacherSubject)
    const fixedSubjectCode =
      subjectCodes[fixedExamSubject] ?? fixedExamSubject.slice(0, 2).toUpperCase()
    const questions = exam.questions ?? []
    const totalScore = Number(exam.totalScore || 0)
    const scorePerQuestion = Number(exam.scorePerQuestion || 0)

    return {
      title: exam.title,
      subject: fixedExamSubject,
      subjectCode: fixedSubjectCode,
      code: getExamCode(teacherName, fixedExamSubject, exam.codeNumber),
      topic: exam.topic,
      status: exam.status,
      selectedClasses: exam.selectedClasses ?? [],
      attemptMode: exam.attemptMode,
      maxAttempts: Number(exam.maxAttempts || 1),
      duration: Number(exam.duration || 45),
      openDate: exam.openDate,
      closeDate: exam.closeDate,
      shuffleQuestions: Boolean(exam.shuffleQuestions),
      shuffleAnswers: Boolean(exam.shuffleAnswers),
      totalScore,
      scorePerQuestion,
      wordFileName: exam.wordFileName ?? '',
      maxFullscreenViolations: Number(exam.maxFullscreenViolations ?? 2),
      questions,
    }
  }

  const saveExam = async (exam) => {
    try {
      const payload = normalizeExamPayload(exam)

      if (exam.id) {
        await updateExamApi(exam.id, payload)
        toast.success('Đã cập nhật bài thi')
      } else {
        await createExamApi(payload)
        toast.success('Đã tạo bài thi')
      }

      setEditingExam(null)
      setCreateOpen(false)
      await loadExams()
    } catch (error) {
      console.error(error)
      toast.error(
        error?.response?.data?.message ||
          error.message ||
          'Lưu bài thi thất bại',
      )
    }
  }

  const deleteExam = async (examId) => {
    try {
      await deleteExamApi(examId)
      toast.success('Đã xóa đề thi')
      setDeleteConfirmExam(null)
      await loadExams()
    } catch (error) {
      console.error(error)
      toast.error(
        error?.response?.data?.message ||
          error.message ||
          'Xóa đề thi thất bại',
      )
    }
  }

  const duplicateExam = async (exam) => {
    try {
      const newCodeNumber = String(Date.now()).slice(-4)
      const payload = normalizeExamPayload({
        ...exam,
        id: undefined,
        title: `${exam.title} - Bản sao`,
        codeNumber: newCodeNumber,
        status: 'private',
      })

      await createExamApi(payload)
      toast.success('Đã sao chép đề thi')
      await loadExams()
    } catch (error) {
      console.error(error)
      toast.error(
        error?.response?.data?.message ||
          error.message ||
          'Sao chép đề thi thất bại',
      )
    }
  }

  return {
    dark,
    role,
    currentUserId,
    teacherSubject,
    teacherName,
    studentClass,
    setStudentClass,
    studentClasses,
    setStudentClasses,
    classes,
    setClasses,
    search,
    setSearch,
    subjectFilter,
    setSubjectFilter,
    codeSearch,
    setCodeSearch,
    privacyFilter,
    setPrivacyFilter,
    publishFilter,
    setPublishFilter,
    exams,
    visibleExams,
    studentResults,
    averageScore,
    loading,
    roleLoading,
    createOpen,
    setCreateOpen,
    statsOpen,
    setStatsOpen,
    resultsExam,
    setResultsExam,
    editingExam,
    setEditingExam,
    deleteConfirmExam,
    setDeleteConfirmExam,
    loadExams,
    saveExam,
    deleteExam,
    duplicateExam,
  }
}

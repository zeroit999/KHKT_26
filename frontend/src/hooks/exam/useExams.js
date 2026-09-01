import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

import { useAuth } from '../../contexts/AuthContext'
import useSyncedDarkMode from '../common/useSyncedDarkMode'
import apiClient from '../../utils/apiClient'

import {
  createExamApi,
  deleteExamApi,
  getExamsApi,
  getExamResultsApi,
  getMyExamStatisticsApi,
  updateExamApi,
} from '../../api/examApi'

import {
  getDateTimeValue,
  isStudentRole,
  normalizeClassName,
  normalizeSubject,
  subjectCodes,
  getExamCode,
  getTeacherNameAbbreviation,
  canManageExams,
} from '../../utils/examHelpers'

const normalizeGradeValue = (value = '') => {
  const text = String(value || '').trim()
  const match = text.match(/\d+/)

  return match ? match[0] : text
}

export default function useExams() {
  const dark = useSyncedDarkMode()
  const { user } = useAuth()

  const [role, setRole] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)

  const [teacherSubject, setTeacherSubject] = useState('Toán')
  const [teacherName, setTeacherName] = useState('GiaoVien')

  const [studentClass, setStudentClass] = useState('')
  const [studentGrade, setStudentGrade] = useState('')
  const [studentClasses, setStudentClasses] = useState([])
  const [classes, setClasses] = useState([])

  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [codeSearch, setCodeSearch] = useState('')
  const [privacyFilter, setPrivacyFilter] = useState('all')
  const [publishFilter, setPublishFilter] = useState('all')

  const [exams, setExams] = useState([])
  const [teacherSubmissions, setTeacherSubmissions] = useState([])
  const [submissionsLoading, setSubmissionsLoading] = useState(false)

  const [studentStatistics, setStudentStatistics] = useState(null)
  const [progressLoading, setProgressLoading] = useState(false)

  const [loading, setLoading] = useState(true)
  const [roleLoading, setRoleLoading] = useState(true)

  const [createOpen, setCreateOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [resultsExam, setResultsExam] = useState(null)
  const [editingExam, setEditingExam] = useState(null)
  const [deleteConfirmExam, setDeleteConfirmExam] = useState(null)

  const loadStudentStatistics = async () => {
    if (role !== 'STUDENT') {
      setStudentStatistics(null)
      return
    }

    try {
      setProgressLoading(true)

      const response =
        await getMyExamStatisticsApi()

      setStudentStatistics(
        response.data?.statistics ?? null,
      )
    } catch (error) {
      console.error(error)
      setStudentStatistics(null)
    } finally {
      setProgressLoading(false)
    }
  }

  const loadExams = async () => {
    try {
      setLoading(true)
      const response = await getExamsApi()
      const loadedExams = response.data?.exams ?? []

      setExams(loadedExams)

      if (canManageExams(role)) {
        await loadTeacherSubmissions(loadedExams)
      }
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

  const loadTeacherSubmissions = async (examItems = exams) => {
    if (!canManageExams(role)) {
      setTeacherSubmissions([])
      return
    }

    const ownedExams = Array.isArray(examItems)
      ? examItems
      : []

    if (!ownedExams.length) {
      setTeacherSubmissions([])
      return
    }

    try {
      setSubmissionsLoading(true)

      const responses = await Promise.allSettled(
        ownedExams.map((exam) =>
          getExamResultsApi(exam.id),
        ),
      )

      const merged = responses.flatMap((response, index) => {
        if (response.status !== 'fulfilled') {
          console.warn(
            'Không thể tải bài nộp của đề:',
            ownedExams[index]?.id,
            response.reason,
          )
          return []
        }

        const exam = ownedExams[index]

        const items =
          response.value?.data?.results ??
          response.value?.data?.studentResults ??
          []

        if (!Array.isArray(items)) {
          return []
        }

        return items.map((result) => ({
          ...result,
          examId:
            result.examId ??
            exam.id,
          examTitle:
            result.examTitle ??
            exam.title ??
            'Bài thi',
          examSubject:
            result.examSubject ??
            exam.subject ??
            '',
        }))
      })

      merged.sort((a, b) => {
        const aTime = new Date(
          a.submittedAt ||
          a.updatedAt ||
          a.createdAt ||
          0,
        ).getTime()

        const bTime = new Date(
          b.submittedAt ||
          b.updatedAt ||
          b.createdAt ||
          0,
        ).getTime()

        return bTime - aTime
      })

      setTeacherSubmissions(merged)
    } catch (error) {
      console.error(error)
      setTeacherSubmissions([])
    } finally {
      setSubmissionsLoading(false)
    }
  }

  useEffect(() => {
    const loadUser = async () => {
      try {
        setRoleLoading(true)

        if (!user) {
          toast.error('Bạn chưa đăng nhập')
          return
        }

        setCurrentUserId(
          user.uid ||
            user.user_id ||
            user.id ||
            null,
        )

        const userData = user || {}

        const resolvedRole =
          userData.role ||
          userData.userRole ||
          userData.type ||
          'STUDENT'

        setRole(resolvedRole)

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

        setTeacherSubject(
          normalizeSubject(
            fixedTeacherSubject,
          ),
        )

        const userGrade = String(
          userData.grade ||
            userData.khoi ||
            userData.gradeLevel ||
            userData.studentGrade ||
            '',
        ).trim()

        setStudentGrade(userGrade)

        const userClass = String(
          userData.className ||
            userData.class ||
            userData.lop ||
            userData.studentClass ||
            '',
        ).trim()

        if (userClass) {
          setStudentClass(userClass)
          setStudentClasses([userClass])
        } else {
          setStudentClass('')
          setStudentClasses([])
        }

        const userClasses =
          userData.classes ||
          userData.classList ||
          userData.managedClasses ||
          []

        if (
          Array.isArray(userClasses) &&
          userClasses.length
        ) {
          setClasses(
            userClasses.filter(Boolean),
          )

          setStudentClasses(
            (current) =>
              current.length
                ? current
                : userClasses.filter(Boolean),
          )
        }

        try {
          const classesResponse =
            await apiClient.get(
              '/classrooms',
            )

          const classroomItems =
            classesResponse.data?.classes ??
            []

          const classList =
            classroomItems
              .map((classroom) => {
                if (
                  typeof classroom ===
                  'string'
                ) {
                  return classroom
                }

                return (
                  classroom?.name ||
                  classroom?.className ||
                  classroom?.title ||
                  classroom?.classCode ||
                  classroom?.class_code ||
                  classroom?.code ||
                  classroom?.id
                )
              })
              .filter(Boolean)
              .map(String)

          if (classList.length) {
            setClasses(
              Array.from(
                new Set(classList),
              ),
            )
          }
        } catch (classesError) {
          console.warn(
            'Không thể tải dữ liệu Classes:',
            classesError,
          )
        }
      } catch (error) {
        console.error(error)
        toast.error(
          'Không thể tải dữ liệu người dùng',
        )
      } finally {
        setRoleLoading(false)
      }
    }

    loadUser()
  }, [user])

  useEffect(() => {
    if (!roleLoading) {
      loadExams()
    }
  }, [roleLoading])

  useEffect(() => {
    if (roleLoading) {
      return
    }

    if (role === 'STUDENT') {
      loadStudentStatistics()
      return
    }

    setStudentStatistics(null)
  }, [role, roleLoading])

  const visibleExams = useMemo(() => {
    const now = new Date()

    return exams
      .map((exam) => {
        const opened =
          !exam.openDate ||
          now.getTime() >=
            getDateTimeValue(
              exam.openDate,
            )

        const closed = Boolean(
          exam.closeDate &&
            now.getTime() >
              getDateTimeValue(
                exam.closeDate,
              ),
        )

        const isUpcoming = Boolean(
          exam.openDate &&
            now.getTime() <
              getDateTimeValue(
                exam.openDate,
              ),
        )

        const isActive =
          opened && !closed

        const availabilityStatus =
          isActive
            ? 'published'
            : isUpcoming
              ? 'draft'
              : 'ended'

        const questionCount = Number(
          exam.questionCount ||
            exam.questions?.length ||
            0,
        )

        const totalScore = Number(
          exam.totalScore || 0,
        )

        const scorePerQuestion = Number(
          exam.scorePerQuestion || 0,
        )

        return {
          ...exam,
          status:
            exam.status || 'public',
          questions:
            exam.questions ?? [],
          studentResults:
            exam.studentResults ?? [],
          attempts:
            exam.attempts ?? [],
          selectedGrades:
            exam.selectedGrades ?? [],
          selectedClasses:
            exam.selectedClasses ?? [],
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
          const normalizedStudentGrade =
            normalizeGradeValue(
              studentGrade ||
                studentClass ||
                studentClasses[0],
            )

          const selectedGrades =
            exam.selectedGrades ?? []

          const isPublicExam =
            exam.status === 'public' &&
            (
              selectedGrades.length === 0 ||
              selectedGrades
                .map(
                  normalizeGradeValue,
                )
                .includes(
                  normalizedStudentGrade,
                )
            )

          const normalizedStudentClasses =
            studentClasses.map(
              normalizeClassName,
            )

          const isAssignedPrivateExam =
            exam.status === 'private' &&
            Array.isArray(
              exam.selectedClasses,
            ) &&
            exam.selectedClasses.some(
              (item) =>
                normalizedStudentClasses.includes(
                  normalizeClassName(
                    item,
                  ),
                ),
            )

          if (
            !isPublicExam &&
            !isAssignedPrivateExam
          ) {
            return false
          }
        }

        if (
          privacyFilter !== 'all' &&
          exam.status !==
            privacyFilter
        ) {
          return false
        }

        if (
          publishFilter !== 'all' &&
          exam.availabilityStatus !==
            publishFilter
        ) {
          return false
        }

        if (
          subjectFilter !== 'all' &&
          normalizeSubject(
            exam.subject,
          ) !== subjectFilter
        ) {
          return false
        }

        const keyword =
          search
            .trim()
            .toLowerCase()

        if (!keyword) return true

        return (
          exam.title
            ?.toLowerCase()
            .includes(keyword) ||
          exam.subject
            ?.toLowerCase()
            .includes(keyword) ||
          exam.topic
            ?.toLowerCase()
            .includes(keyword) ||
          exam.code
            ?.toLowerCase()
            .includes(keyword)
        )
      })
  }, [
    exams,
    role,
    roleLoading,
    studentClass,
    studentClasses,
    studentGrade,
    search,
    subjectFilter,
    privacyFilter,
    publishFilter,
  ])

  const studentResults =
    canManageExams(role)
      ? teacherSubmissions
      : exams.flatMap(
          (exam) =>
            exam.studentResults ?? [],
        )

  const averageScore =
    studentResults.length
      ? (
          studentResults.reduce(
            (total, item) =>
              total +
              Number(
                item.score || 0,
              ),
            0,
          ) /
          studentResults.length
        ).toFixed(1)
      : '0.0'

  const normalizeExamPayload = (
    exam,
  ) => {
    const fixedExamSubject =
      normalizeSubject(
        teacherSubject,
      )

    const fixedSubjectCode =
      subjectCodes[
        fixedExamSubject
      ] ??
      fixedExamSubject
        .slice(0, 2)
        .toUpperCase()

    const questions =
      exam.questions ?? []

    const totalScore =
      Number(
        exam.totalScore || 0,
      )

    const scorePerQuestion =
      Number(
        exam.scorePerQuestion || 0,
      )

    return {
      title: exam.title,
      subject: fixedExamSubject,
      subjectCode:
        fixedSubjectCode,
      code: getExamCode(
        teacherName,
        fixedExamSubject,
        exam.codeNumber,
      ),
      topic: exam.topic,
      status: exam.status,
      createdBy:
        exam.createdBy ||
        currentUserId,
      teacherId:
        exam.teacherId ||
        currentUserId,
      ownerId:
        exam.ownerId ||
        currentUserId,
      teacherName,
      selectedClasses:
        exam.selectedClasses ?? [],
      selectedGrades:
        exam.selectedGrades ?? [],
      attemptMode:
        exam.attemptMode,
      maxAttempts: Number(
        exam.maxAttempts || 1,
      ),
      duration: Number(
        exam.duration || 45,
      ),
      openDate: exam.openDate,
      closeDate: exam.closeDate,
      shuffleQuestions:
        Boolean(
          exam.shuffleQuestions,
        ),
      shuffleAnswers:
        Boolean(
          exam.shuffleAnswers,
        ),
      totalScore,
      scorePerQuestion,
      scoring:
        exam.scoring ?? {},
      settings: {
        ...(exam.settings ?? {}),
      },
      wordFileName:
        exam.wordFileName ?? '',
      maxFullscreenViolations:
        Number(
          exam.proctoring
            ?.maxViolations ??
            exam.maxFullscreenViolations ??
            2,
        ),
      proctoring:
        exam.proctoring ?? {},
      questions,
    }
  }

  const saveExam = async (
    exam,
  ) => {
    try {
      const payload =
        normalizeExamPayload(
          exam,
        )

      if (exam.id) {
        await updateExamApi(
          exam.id,
          payload,
        )

        toast.success(
          'Đã cập nhật bài thi',
        )
      } else {
        await createExamApi(
          payload,
        )

        toast.success(
          'Đã tạo bài thi',
        )
      }

      setEditingExam(null)
      setCreateOpen(false)

      await loadExams()
    } catch (error) {
      console.error(error)

      toast.error(
        error?.response?.data
          ?.message ||
          error.message ||
          'Lưu bài thi thất bại',
      )
    }
  }

  const deleteExam = async (
    examId,
  ) => {
    try {
      await deleteExamApi(
        examId,
      )

      toast.success(
        'Đã xóa đề thi',
      )

      setDeleteConfirmExam(
        null,
      )

      await loadExams()
    } catch (error) {
      console.error(error)

      toast.error(
        error?.response?.data
          ?.message ||
          error.message ||
          'Xóa đề thi thất bại',
      )
    }
  }

  const duplicateExam = async (
    exam,
  ) => {
    try {
      const newCodeNumber =
        String(
          Date.now(),
        ).slice(-4)

      const payload =
        normalizeExamPayload({
          ...exam,
          id: undefined,
          title:
            `${exam.title} - Bản sao`,
          codeNumber:
            newCodeNumber,
          status: 'private',
        })

      await createExamApi(
        payload,
      )

      toast.success(
        'Đã sao chép đề thi',
      )

      await loadExams()
    } catch (error) {
      console.error(error)

      toast.error(
        error?.response?.data
          ?.message ||
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
    studentGrade,
    setStudentGrade,
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
    teacherSubmissions,
    submissionsLoading,
    loadTeacherSubmissions,
    studentStatistics,
    progressLoading,
    loadStudentStatistics,
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
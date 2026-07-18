import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import { getExamDetailApi, submitExamApi } from '../../api/examApi'
import useExamProctoring from './useExamProctoring.js'

export default function useExamRoom() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()

  const examId = params.examId || params.id

  const preview = Boolean(location.state?.preview)
  const role = String(location.state?.role || 'STUDENT').toUpperCase()

  const isTeacher =
    role === 'TEACHER' ||
    role === 'ADMIN_DEV' ||
    role === 'ADMIN'

  const [exam, setExam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [hasStarted, setHasStarted] = useState(false)

  const [answers, setAnswers] = useState({})
  const [textAnswers, setTextAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(0)
  const submittedRef = useRef(false)

  const {
    config: proctoringConfig,
    needsDevicePermission,
    preparing: preparingProctoring,
    permissionError: proctoringError,
    ready: proctoringReady,
    cameraActive,
    microphoneActive,
    screenActive,
    cameraStream,
    monitoringBlocked,
    blockingReason,
    violationCount: violations,
    acquireRequiredStreams,
    restoreMonitoring: restoreRequiredStreams,
    stopMonitoring,
    flushEvidence,
    getReport: getProctoringReport,
  } = useExamProctoring({
    exam,
    active: hasStarted && !preview && !isTeacher,
    disabled: preview || isTeacher,
  })

  useEffect(() => {
    const loadExam = async () => {
      if (!examId) {
        setLoading(false)
        toast.error('Không tìm thấy mã đề thi trên URL')
        return
      }

      try {
        setLoading(true)

        const response = await getExamDetailApi(examId)
        const loadedExam = response.data?.exam

        if (!loadedExam) {
          toast.error('Không tìm thấy đề thi')
          return
        }

        setExam(loadedExam)
        setTimeLeft(Number(loadedExam.duration || 45) * 60)
      } catch (error) {
        console.error(error)
        toast.error(
          error?.response?.data?.message ||
            error.message ||
            'Không thể tải đề thi',
        )
      } finally {
        setLoading(false)
      }
    }

    loadExam()
  }, [examId])

  const requestExamFullscreen = useCallback(async () => {
    if (preview || isTeacher) return true
    if (!proctoringConfig.enabled || !proctoringConfig.requireFullscreen) return true

    if (!document.fullscreenEnabled) {
      toast.error('Trình duyệt không cho phép bật toàn màn hình')
      return false
    }

    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      }

      const success = Boolean(document.fullscreenElement)

      if (!success) {
        toast.error('Bạn cần cho phép toàn màn hình để làm bài')
        return false
      }

      return true
    } catch (error) {
      console.error(error)
      toast.error('Bạn cần cho phép toàn màn hình để làm bài')
      return false
    }
  }, [preview, isTeacher, proctoringConfig.enabled, proctoringConfig.requireFullscreen])

  const prepareExamMonitoring = async () => {
    const prepared = await acquireRequiredStreams()
    if (prepared) toast.success('Đã cấp đủ quyền giám sát. Bạn có thể bắt đầu thi.')
  }

  const startExam = async () => {
    if (needsDevicePermission && !proctoringReady) {
      toast.error('Hãy cấp đủ quyền thiết bị giám sát trước khi bắt đầu')
      return
    }

    const canStart = await requestExamFullscreen()

    if (!canStart) return

    setHasStarted(true)
  }

  const restoreFullscreen = async () => {
    const devicesRestored = await restoreRequiredStreams()
    if (!devicesRestored) return

    const restored = await requestExamFullscreen()

    if (restored) {
      toast.success('Đã quay lại toàn màn hình')
    }
  }

  const handleAnswer = (questionId, answerIndex) => {
    if (monitoringBlocked && !preview && !isTeacher) return

    setAnswers((prev) => ({
      ...prev,
      [questionId]: answerIndex,
    }))
  }

  const handleTrueFalseAnswer = (questionId, answerIndex, value) => {
    if (monitoringBlocked && !preview && !isTeacher) return

    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [answerIndex]: value,
      },
    }))
  }

  const handleTextAnswer = (questionId, value) => {
    if (monitoringBlocked && !preview && !isTeacher) return

    setTextAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }))
  }

  const normalizedTextAnswers = useMemo(() => {
    const result = {}

    Object.entries(textAnswers).forEach(([questionId, value]) => {
      if (Array.isArray(value)) {
        result[questionId] = value.filter(Boolean).join(' ').trim()
      } else {
        result[questionId] = String(value || '').trim()
      }
    })

    return result
  }, [textAnswers])

  const answeredCount = useMemo(() => {
    let count = 0

    exam?.questions?.forEach((question) => {
      if (question.type === 'short-answer') {
        const value = textAnswers[question.id]

        if (Array.isArray(value)) {
          if (value.some((item) => String(item || '').trim())) count += 1
        } else if (String(value || '').trim()) {
          count += 1
        }

        return
      }

      if (question.type === 'truefalse') {
        const value = answers[question.id]

        if (value && Object.keys(value).length > 0) count += 1
        return
      }

      if (answers[question.id] !== undefined && answers[question.id] !== null) {
        count += 1
      }
    })

    return count
  }, [answers, textAnswers, exam])

  const formatTime = (seconds) => {
    const mins = Math.floor(Number(seconds || 0) / 60)
    const secs = Number(seconds || 0) % 60

    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const handleSubmit = useCallback(
    async (autoSubmit = false, overrideViolations = null) => {
      if (submittedRef.current || !exam) return

      submittedRef.current = true

      const submitViolations = Number(
        overrideViolations ?? violations ?? 0,
      )

      try {
        setSubmitting(true)

        if (!preview && !isTeacher) {
          await flushEvidence()
          const proctoringReport = getProctoringReport()
          await submitExamApi(exam.id, {
            answers,
            textAnswers: normalizedTextAnswers,
            fullscreenViolations: submitViolations,
            proctoringReport,
          })
          stopMonitoring('submitted')
        }

        if (document.fullscreenElement) {
          await document.exitFullscreen().catch(() => {})
        }

        navigate(`/exam/${exam.id}/result`, {
          state: {
            exam,
            answers,
            textAnswers: normalizedTextAnswers,
            autoSubmit,
            violations: submitViolations,
          },
        })
      } catch (error) {
        submittedRef.current = false
        console.error(error)

        toast.error(
          error?.response?.data?.message ||
            error.message ||
            'Không thể nộp bài',
        )
      } finally {
        setSubmitting(false)
      }
    },
    [
      exam,
      preview,
      isTeacher,
      answers,
      normalizedTextAnswers,
      violations,
      navigate,
      getProctoringReport,
      flushEvidence,
      stopMonitoring,
    ],
  )

  useEffect(() => {
    if (!exam || preview || isTeacher || !hasStarted) return

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          handleSubmit(true)
          return 0
        }

        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [exam, preview, isTeacher, hasStarted, handleSubmit])

  useEffect(() => {
    if (
      !exam ||
      preview ||
      isTeacher ||
      !hasStarted ||
      !proctoringConfig.enabled ||
      !proctoringConfig.autoSubmit ||
      violations < proctoringConfig.maxViolations ||
      submittedRef.current
    ) return

    const timer = window.setTimeout(() => handleSubmit(true, violations), 0)
    return () => window.clearTimeout(timer)
  }, [
    exam,
    preview,
    isTeacher,
    hasStarted,
    proctoringConfig,
    violations,
    handleSubmit,
  ])

  return {
    exam,
    loading,
    submitting,
    preview,
    isTeacher,
    hasStarted,
    fullscreenBlocked: monitoringBlocked,
    blockingReason,
    proctoringConfig,
    needsDevicePermission,
    preparingProctoring,
    proctoringError,
    proctoringReady,
    cameraActive,
    microphoneActive,
    screenActive,
    cameraStream,

    answers,
    textAnswers,

    timeLeft,
    violations,
    answeredCount,

    formatTime,

    startExam,
    prepareExamMonitoring,
    restoreFullscreen,
    handleAnswer,
    handleTrueFalseAnswer,
    handleTextAnswer,
    handleSubmit,
  }
}

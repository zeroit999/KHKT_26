import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import { getExamDetailApi, submitExamApi } from '../../api/examApi'

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
  const [fullscreenBlocked, setFullscreenBlocked] = useState(false)

  const [answers, setAnswers] = useState({})
  const [textAnswers, setTextAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [violations, setViolations] = useState(0)

  const submittedRef = useRef(false)
  const violationsRef = useRef(0)

  useEffect(() => {
    violationsRef.current = violations
  }, [violations])

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

      setFullscreenBlocked(false)
      return true
    } catch (error) {
      console.error(error)
      toast.error('Bạn cần cho phép toàn màn hình để làm bài')
      return false
    }
  }, [preview, isTeacher])

  const startExam = async () => {
    const canStart = await requestExamFullscreen()

    if (!canStart) return

    setHasStarted(true)
  }

  const restoreFullscreen = async () => {
    const restored = await requestExamFullscreen()

    if (restored) {
      setFullscreenBlocked(false)
      toast.success('Đã quay lại toàn màn hình')
    }
  }

  const handleAnswer = (questionId, answerIndex) => {
    if (fullscreenBlocked && !preview && !isTeacher) return

    setAnswers((prev) => ({
      ...prev,
      [questionId]: answerIndex,
    }))
  }

  const handleTrueFalseAnswer = (questionId, answerIndex, value) => {
    if (fullscreenBlocked && !preview && !isTeacher) return

    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [answerIndex]: value,
      },
    }))
  }

  const handleTextAnswer = (questionId, value) => {
    if (fullscreenBlocked && !preview && !isTeacher) return

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
        overrideViolations ?? violationsRef.current ?? violations ?? 0,
      )

      try {
        setSubmitting(true)

        if (!preview && !isTeacher) {
          await submitExamApi(exam.id, {
            answers,
            textAnswers: normalizedTextAnswers,
            fullscreenViolations: submitViolations,
          })
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
    if (!exam || preview || isTeacher || !hasStarted) return undefined

    const handleFullscreenChange = () => {
      if (submittedRef.current) return

      if (document.fullscreenElement) {
        setFullscreenBlocked(false)
        return
      }

      setFullscreenBlocked(true)

      setViolations((prev) => {
        const next = prev + 1
        const max = Number(exam.maxFullscreenViolations ?? 2)

        violationsRef.current = next
        toast.error(`Bạn đã thoát toàn màn hình (${next}/${max})`)

        if (next >= max) {
          setTimeout(() => handleSubmit(true, next), 0)
        }

        return next
      })
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [exam, preview, isTeacher, hasStarted, handleSubmit])

  useEffect(() => {
    if (!exam || preview || isTeacher || !hasStarted) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' || event.key === 'F11') {
        event.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [exam, preview, isTeacher, hasStarted])

  return {
    exam,
    loading,
    submitting,
    preview,
    isTeacher,
    hasStarted,
    fullscreenBlocked,

    answers,
    textAnswers,

    timeLeft,
    violations,
    answeredCount,

    formatTime,

    startExam,
    restoreFullscreen,
    handleAnswer,
    handleTrueFalseAnswer,
    handleTextAnswer,
    handleSubmit,
  }
}

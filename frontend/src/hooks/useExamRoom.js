import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import { getExamDetailApi, submitExamApi } from '../api/examApi'

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
  const [violations, setViolations] = useState(0)

  const submittedRef = useRef(false)

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

  const startExam = async () => {
    try {
      if (!preview && !isTeacher && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
      }

      setHasStarted(true)
    } catch (error) {
      console.error(error)
      toast.error('Bạn cần cho phép toàn màn hình để bắt đầu làm bài')
    }
  }

  const handleAnswer = (questionId, answerIndex) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answerIndex,
    }))
  }

  const handleTrueFalseAnswer = (questionId, answerIndex, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [answerIndex]: value,
      },
    }))
  }

  const handleTextAnswer = (questionId, value) => {
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
    async (autoSubmit = false) => {
      if (submittedRef.current || !exam) return

      submittedRef.current = true

      try {
        setSubmitting(true)

        if (!preview && !isTeacher) {
          await submitExamApi(exam.id, {
            answers,
            textAnswers: normalizedTextAnswers,
            fullscreenViolations: violations,
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
            violations,
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
    if (!exam || preview || isTeacher || !hasStarted) return

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) return

      setViolations((prev) => {
        const next = prev + 1
        const max = Number(exam.maxFullscreenViolations ?? 2)

        toast.error(`Bạn đã thoát toàn màn hình (${next}/${max})`)

        if (next >= max) {
          handleSubmit(true)
        }

        return next
      })
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [exam, preview, isTeacher, hasStarted, handleSubmit])

  return {
    exam,
    loading,
    submitting,
    preview,
    isTeacher,
    hasStarted,

    answers,
    textAnswers,

    timeLeft,
    violations,
    answeredCount,

    formatTime,

    startExam,
    handleAnswer,
    handleTrueFalseAnswer,
    handleTextAnswer,
    handleSubmit,
  }
}
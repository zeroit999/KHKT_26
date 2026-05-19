import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import { auth } from '../components/firebase'
import useSyncedDarkMode from './useSyncedDarkMode'
import { getExamDetailApi, submitExamApi } from '../api/examApi'
import { canManageExams } from '../utils/examHelpers'

const requestFullscreen = async () => {
  const element = document.documentElement

  if (document.fullscreenElement) return

  if (element.requestFullscreen) {
    await element.requestFullscreen()
  }
}

const exitFullscreen = async () => {
  if (document.fullscreenElement && document.exitFullscreen) {
    await document.exitFullscreen()
  }
}

export default function useExamRoom() {
  const dark = useSyncedDarkMode()
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()

  const role = location.state?.role
  const preview = Boolean(location.state?.preview)

  const [loading, setLoading] = useState(true)
  const [exam, setExam] = useState(null)
  const [answers, setAnswers] = useState({})
  const [textAnswers, setTextAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [fullscreenWarning, setFullscreenWarning] = useState(false)
  const [fullscreenViolations, setFullscreenViolations] = useState(0)
  const [leaveWarningOpen, setLeaveWarningOpen] = useState(false)

  const submitRef = useRef(false)

  const isTeacher = canManageExams(role)
  const maxFullscreenViolations = Number(exam?.maxFullscreenViolations ?? 2)

  const draftKey = `exam_draft_${id}_${auth.currentUser?.uid || 'guest'}`

  const saveDraftNow = (
    nextAnswers = answers,
    nextTextAnswers = textAnswers,
    nextTimeLeft = timeLeft,
    nextFullscreenViolations = fullscreenViolations,
  ) => {
    if (!exam?.id || isTeacher || preview || submitting) return

    localStorage.setItem(
      draftKey,
      JSON.stringify({
        examId: exam.id,
        answers: nextAnswers,
        textAnswers: nextTextAnswers,
        timeLeft: nextTimeLeft,
        fullscreenViolations: nextFullscreenViolations,
        updatedAt: new Date().toISOString(),
      }),
    )
  }

  const handleSubmit = async () => {
    if (submitting || submitRef.current || !exam?.id) return

    try {
      submitRef.current = true
      setSubmitting(true)

      const response = await submitExamApi(exam.id, {
        answers,
        textAnswers,
        fullscreenViolations,
      })

      localStorage.removeItem(draftKey)

      toast.success('Đã nộp bài thi')

      await exitFullscreen()

      navigate(`/exam/${exam.id}/result`, {
        state: {
          role,
          submitted: true,
          result: response.data?.result || response.data,
        },
      })
    } catch (error) {
      console.error(error)

      toast.error(
        error?.response?.data?.message ||
          error.message ||
          'Không thể nộp bài thi',
      )

      submitRef.current = false
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    const loadExam = async () => {
      try {
        setLoading(true)

        const response = await getExamDetailApi(id)
        const examData = response.data?.exam ?? null

        setExam(examData)

        const defaultTimeLeft = Number(examData?.duration || 45) * 60
        setTimeLeft(defaultTimeLeft)

        const savedDraft = localStorage.getItem(draftKey)

        if (savedDraft) {
          const parsed = JSON.parse(savedDraft)

          if (parsed?.examId === examData?.id) {
            setAnswers(parsed.answers || {})
            setTextAnswers(parsed.textAnswers || {})

            if (Number(parsed.timeLeft) > 0) {
              setTimeLeft(Number(parsed.timeLeft))
            }

            setFullscreenViolations(Number(parsed.fullscreenViolations || 0))

            toast.success('Đã khôi phục bài làm đang lưu')
          }
        }
      } catch (error) {
        console.error(error)

        toast.error(
          error?.response?.data?.message ||
            error.message ||
            'Không thể tải bài thi',
        )

        navigate('/exams')
      } finally {
        setLoading(false)
      }
    }

    loadExam()
  }, [id, navigate, draftKey])

  useEffect(() => {
    if (!exam?.id || !role || loading) return undefined
    if (isTeacher || preview) return undefined

    const enterFullscreen = async () => {
      try {
        await requestFullscreen()
      } catch (error) {
        console.warn('Không thể bật toàn màn hình:', error)
        setFullscreenWarning(true)
      }
    }

    enterFullscreen()

    const handleFullscreenChange = () => {
      const isFullscreen = Boolean(document.fullscreenElement)

      setFullscreenWarning(!isFullscreen)

      if (!isFullscreen) {
        setFullscreenViolations((prev) => {
          const next = prev + 1

          saveDraftNow(answers, textAnswers, timeLeft, next)

          toast.error(
            `Bạn đã thoát toàn màn hình (${next}/${maxFullscreenViolations})`,
          )

          if (next >= maxFullscreenViolations) {
            toast.error('Đã vượt quá số lần cho phép. Hệ thống sẽ tự động nộp bài.')

            setTimeout(() => {
              handleSubmit()
            }, 1200)
          }

          return next
        })
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [
    exam?.id,
    role,
    loading,
    isTeacher,
    preview,
    maxFullscreenViolations,
    answers,
    textAnswers,
    timeLeft,
  ])

  useEffect(() => {
    if (loading || !exam || submitting || isTeacher || preview) return undefined

    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }

    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href)
      setLeaveWarningOpen(true)
    }

    window.history.pushState(null, '', window.location.href)

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [loading, exam, submitting, isTeacher, preview])

  useEffect(() => {
    if (loading || !exam || submitting || isTeacher || preview) return undefined

    if (timeLeft <= 0) {
      handleSubmit()
      return undefined
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1
        return next
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timeLeft, loading, exam, submitting, isTeacher, preview])

  useEffect(() => {
    if (loading || !exam || submitting || isTeacher || preview) return undefined

    const interval = setInterval(() => {
      saveDraftNow()
    }, 10000)

    return () => clearInterval(interval)
  }, [
    draftKey,
    loading,
    exam,
    answers,
    textAnswers,
    timeLeft,
    fullscreenViolations,
    submitting,
    isTeacher,
    preview,
  ])

  const questionCount = useMemo(() => exam?.questions?.length ?? 0, [exam])

  const answeredCount = useMemo(() => {
    if (!exam?.questions?.length) return 0

    return exam.questions.filter((question) => {
      if (question.type === 'essay' || question.type === 'code') {
        return Boolean(textAnswers[question.id]?.trim())
      }

      return answers[question.id] !== undefined
    }).length
  }, [exam, answers, textAnswers])

  const handleAnswer = (questionId, answerIndex) => {
    setAnswers((prev) => {
      const next = {
        ...prev,
        [questionId]: answerIndex,
      }

      saveDraftNow(next, textAnswers)

      return next
    })
  }

  const handleTextAnswer = (questionId, value) => {
    setTextAnswers((prev) => {
      const next = {
        ...prev,
        [questionId]: value,
      }

      saveDraftNow(answers, next)

      return next
    })
  }

  const retryFullscreen = async () => {
    try {
      await requestFullscreen()
      setFullscreenWarning(false)
    } catch (error) {
      console.error(error)
    }
  }

  return {
    dark,
    role,
    preview,
    loading,
    exam,
    answers,
    textAnswers,
    submitting,
    timeLeft,
    fullscreenWarning,
    fullscreenViolations,
    leaveWarningOpen,
    setLeaveWarningOpen,
    isTeacher,
    maxFullscreenViolations,
    questionCount,
    answeredCount,
    handleAnswer,
    handleTextAnswer,
    handleSubmit,
    retryFullscreen,
  }
}
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'

import { logExamProctoringEventApi } from '../../api/examApi.js'
import { normalizeProctoringConfig } from '../../utils/proctoringConfig.js'

const createId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const isTrackActive = (stream) =>
  Boolean(stream?.getTracks().some((track) => track.readyState === 'live'))

export default function useExamProctoring({ exam, active, disabled = false }) {
  const config = useMemo(() => normalizeProctoringConfig(exam || {}), [exam])
  const sessionIdRef = useRef(createId())
  const cameraStreamRef = useRef(null)
  const screenStreamRef = useRef(null)
  const stoppingRef = useRef(false)
  const activeRef = useRef(active)
  const startedAtRef = useRef('')
  const eventsRef = useRef([])
  const countsRef = useRef({})
  const violationsRef = useRef(0)
  const lastViolationRef = useRef(new Map())
  const lastAttentionLossRef = useRef(0)

  const needsDevicePermission = Boolean(
    config.enabled && (config.requireCamera || config.requireScreenShare),
  )

  const [preparing, setPreparing] = useState(false)
  const [permissionError, setPermissionError] = useState('')
  const [preparedExamId, setPreparedExamId] = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const [screenActive, setScreenActive] = useState(false)
  const [cameraStream, setCameraStream] = useState(null)
  const [monitoringBlocked, setMonitoringBlocked] = useState(false)
  const [blockingReason, setBlockingReason] = useState('')
  const [events, setEvents] = useState([])
  const [counts, setCounts] = useState({})
  const [violationCount, setViolationCount] = useState(0)

  useEffect(() => {
    activeRef.current = active
  }, [active])

  const ready = !needsDevicePermission || preparedExamId === exam?.id

  const persistEvent = useCallback((event) => {
    if (!exam?.id || disabled || !config.enabled) return
    logExamProctoringEventApi(exam.id, {
      sessionId: sessionIdRef.current,
      event,
    }).catch((error) => {
      console.warn('Không thể đồng bộ log giám sát:', error?.message || error)
    })
  }, [exam, disabled, config.enabled])

  const appendEvent = useCallback((type, severity, message, metadata = {}) => {
    const event = {
      id: createId(),
      type,
      severity,
      message,
      metadata,
      at: new Date().toISOString(),
    }

    eventsRef.current = [...eventsRef.current.slice(-248), event]
    setEvents(eventsRef.current)

    countsRef.current = {
      ...countsRef.current,
      [type]: Number(countsRef.current[type] || 0) + 1,
    }
    setCounts(countsRef.current)

    if (severity === 'violation') {
      violationsRef.current += 1
      setViolationCount(violationsRef.current)
    }

    persistEvent(event)
    return event
  }, [persistEvent])

  const reportViolation = useCallback((type, message, metadata = {}, dedupeMs = 1000) => {
    if (!activeRef.current || stoppingRef.current) return null
    const now = Date.now()
    const lastAt = Number(lastViolationRef.current.get(type) || 0)
    if (now - lastAt < dedupeMs) return null
    lastViolationRef.current.set(type, now)

    const event = appendEvent(type, 'violation', message, metadata)
    toast.error(`${message} (${violationsRef.current}/${config.maxViolations})`)
    return event
  }, [appendEvent, config.maxViolations])

  const stopStream = useCallback((stream) => {
    stream?.getTracks().forEach((track) => track.stop())
  }, [])

  const registerTrackEnded = useCallback((stream, source) => {
    const track = stream?.getVideoTracks()[0]
    if (!track) return

    track.addEventListener('ended', () => {
      if (stoppingRef.current) return

      if (source === 'camera') {
        setCameraActive(false)
        setCameraStream(null)
        cameraStreamRef.current = null
        setBlockingReason('Camera đã bị tắt. Hãy cấp lại quyền để tiếp tục.')
        reportViolation('camera_stopped', 'Camera đã bị tắt')
      } else {
        setScreenActive(false)
        screenStreamRef.current = null
        setBlockingReason('Chia sẻ màn hình đã dừng. Hãy chia sẻ lại để tiếp tục.')
        reportViolation('screen_stopped', 'Chia sẻ màn hình đã dừng')
      }

      if (activeRef.current) setMonitoringBlocked(true)
    }, { once: true })
  }, [reportViolation])

  const acquireRequiredStreams = useCallback(async () => {
    if (!config.enabled || disabled) return true
    if (!navigator.mediaDevices) {
      setPermissionError('Trình duyệt không hỗ trợ camera hoặc chia sẻ màn hình trong ngữ cảnh này.')
      return false
    }

    setPreparing(true)
    setPermissionError('')
    stoppingRef.current = false

    try {
      if (config.requireCamera && !isTrackActive(cameraStreamRef.current)) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        })
        cameraStreamRef.current = stream
        setCameraStream(stream)
        setCameraActive(true)
        registerTrackEnded(stream, 'camera')
      }

      if (config.requireScreenShare && !isTrackActive(screenStreamRef.current)) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'monitor' },
          audio: false,
        })
        const screenTrack = stream.getVideoTracks()[0]
        const displaySurface = screenTrack?.getSettings?.().displaySurface || 'unknown'

        if (config.requireEntireScreen && displaySurface !== 'unknown' && displaySurface !== 'monitor') {
          stopStream(stream)
          throw new Error('Bạn phải chọn Toàn bộ màn hình, không chọn riêng tab hoặc cửa sổ.')
        }

        screenStreamRef.current = stream
        setScreenActive(true)
        registerTrackEnded(stream, 'screen')
      }

      setPreparedExamId(exam?.id || '')
      setMonitoringBlocked(false)
      setBlockingReason('')
      appendEvent('permissions_granted', 'info', 'Đã cấp đủ quyền giám sát', {
        camera: config.requireCamera,
        screen: config.requireScreenShare,
        displaySurface: screenStreamRef.current?.getVideoTracks()[0]?.getSettings?.().displaySurface || '',
      })
      return true
    } catch (error) {
      const message = error?.message || 'Không thể cấp quyền giám sát.'
      setPermissionError(message)
      setPreparedExamId('')
      if (config.requireCamera && !isTrackActive(cameraStreamRef.current)) {
        setCameraActive(false)
      }
      if (config.requireScreenShare && !isTrackActive(screenStreamRef.current)) {
        setScreenActive(false)
      }
      return false
    } finally {
      setPreparing(false)
    }
  }, [appendEvent, config, disabled, exam, registerTrackEnded, stopStream])

  const restoreMonitoring = useCallback(async () => {
    const restored = await acquireRequiredStreams()
    if (restored) {
      appendEvent('monitoring_restored', 'info', 'Đã khôi phục thiết bị giám sát')
      toast.success('Đã khôi phục thiết bị giám sát')
    }
    return restored
  }, [acquireRequiredStreams, appendEvent])

  const stopMonitoring = useCallback((reason = 'submitted') => {
    if (reason === 'submitted' && activeRef.current) {
      appendEvent('submitted', 'info', 'Phiên giám sát đã kết thúc khi nộp bài')
    }

    stoppingRef.current = true
    stopStream(cameraStreamRef.current)
    stopStream(screenStreamRef.current)
    cameraStreamRef.current = null
    screenStreamRef.current = null
    setCameraStream(null)
    setCameraActive(false)
    setScreenActive(false)
  }, [appendEvent, stopStream])

  useEffect(() => {
    if (!active || disabled || !config.enabled) return undefined

    stoppingRef.current = false
    if (!startedAtRef.current) startedAtRef.current = new Date().toISOString()
    appendEvent('session_started', 'info', 'Bắt đầu phiên giám sát nghiêm ngặt', {
      camera: config.requireCamera,
      screen: config.requireScreenShare,
      fullscreen: config.requireFullscreen,
    })

    const onVisibilityChange = () => {
      if (!config.detectTabSwitch || document.visibilityState !== 'hidden') return
      lastAttentionLossRef.current = Date.now()
      reportViolation('visibility_hidden', 'Phát hiện rời tab hoặc thu nhỏ trình duyệt', {}, 1500)
    }

    const onWindowBlur = () => {
      if (!config.detectWindowBlur) return
      if (Date.now() - lastAttentionLossRef.current < 1500) return
      lastAttentionLossRef.current = Date.now()
      reportViolation('window_blur', 'Cửa sổ phòng thi bị mất focus', {}, 1500)
    }

    const onFullscreenChange = () => {
      if (!config.requireFullscreen || document.fullscreenElement || stoppingRef.current) return
      setMonitoringBlocked(true)
      setBlockingReason('Bạn đã thoát toàn màn hình. Hãy khôi phục để tiếp tục.')
      reportViolation('fullscreen_exit', 'Đã thoát chế độ toàn màn hình', {}, 1500)
    }

    const onClipboard = (event) => {
      if (!config.blockClipboard) return
      event.preventDefault()
      reportViolation('clipboard_blocked', `Đã chặn thao tác ${event.type}`, { action: event.type })
    }

    const onContextMenu = (event) => {
      if (!config.blockContextMenu) return
      event.preventDefault()
      reportViolation('context_menu_blocked', 'Đã chặn thao tác chuột phải')
    }

    const onKeyDown = (event) => {
      if (!config.blockShortcuts) return
      const key = String(event.key || '').toLowerCase()
      const risky =
        key === 'f12' ||
        key === 'f11' ||
        key === 'escape' ||
        (event.ctrlKey && key === 'u') ||
        (event.ctrlKey && event.shiftKey && ['i', 'j', 'c'].includes(key))

      if (!risky) return
      event.preventDefault()
      event.stopPropagation()
      reportViolation('shortcut_blocked', 'Đã chặn phím tắt không được phép', {
        key: [event.ctrlKey && 'Ctrl', event.shiftKey && 'Shift', event.key]
          .filter(Boolean)
          .join('+'),
      })
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('copy', onClipboard, true)
    document.addEventListener('cut', onClipboard, true)
    document.addEventListener('paste', onClipboard, true)
    document.addEventListener('contextmenu', onContextMenu, true)
    window.addEventListener('blur', onWindowBlur)
    window.addEventListener('keydown', onKeyDown, true)

    const heartbeat = window.setInterval(() => {
      appendEvent('heartbeat', 'info', 'Thiết bị giám sát đang hoạt động', {
        cameraActive: isTrackActive(cameraStreamRef.current),
        screenActive: isTrackActive(screenStreamRef.current),
        fullscreenActive: Boolean(document.fullscreenElement),
      })
    }, config.heartbeatSeconds * 1000)

    return () => {
      window.clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('copy', onClipboard, true)
      document.removeEventListener('cut', onClipboard, true)
      document.removeEventListener('paste', onClipboard, true)
      document.removeEventListener('contextmenu', onContextMenu, true)
      window.removeEventListener('blur', onWindowBlur)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [active, appendEvent, config, disabled, reportViolation])

  useEffect(() => () => {
    stoppingRef.current = true
    stopStream(cameraStreamRef.current)
    stopStream(screenStreamRef.current)
  }, [stopStream])

  const getReport = useCallback(() => ({
    sessionId: sessionIdRef.current,
    events: eventsRef.current,
    counts: countsRef.current,
    totalViolations: violationsRef.current,
    cameraRequired: config.requireCamera,
    screenRequired: config.requireScreenShare,
    cameraActiveAtSubmit: isTrackActive(cameraStreamRef.current),
    screenActiveAtSubmit: isTrackActive(screenStreamRef.current),
    startedAt: startedAtRef.current,
    submittedAt: new Date().toISOString(),
  }), [config.requireCamera, config.requireScreenShare])

  return {
    config,
    needsDevicePermission,
    preparing,
    permissionError,
    ready,
    cameraActive,
    screenActive,
    cameraStream,
    monitoringBlocked,
    blockingReason,
    events,
    counts,
    violationCount,
    acquireRequiredStreams,
    restoreMonitoring,
    stopMonitoring,
    getReport,
  }
}

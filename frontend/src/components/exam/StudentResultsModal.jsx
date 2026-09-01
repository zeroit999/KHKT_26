import { useEffect, useState, useRef } from 'react'
import {
  Camera,
  Clock3,
  ImageIcon,
  Mic,
  MonitorUp,
  ShieldAlert,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'

import StudentAnswers from './StudentAnswers.jsx'
import {
  getStudentDisplayName,
} from '../../utils/examHelpers'
import {
  getExamDetailApi,
  getExamResultsApi,
} from '../../api/examApi'
import {
  authService,
} from '../../services/auth'


const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'http://127.0.0.1:5000'


const eventLabels = {
  session_started:
    'Bắt đầu giám sát',

  heartbeat:
    'Thiết bị hoạt động',

  permissions_granted:
    'Đã cấp quyền thiết bị',

  visibility_hidden:
    'Rời tab / thu nhỏ',

  window_blur:
    'Mất focus / Alt-Tab',

  fullscreen_exit:
    'Thoát toàn màn hình',

  clipboard_blocked:
    'Copy / paste bị chặn',

  context_menu_blocked:
    'Chuột phải bị chặn',

  shortcut_blocked:
    'Phím tắt bị chặn',

  camera_stopped:
    'Camera bị tắt',

  microphone_stopped:
    'Microphone bị tắt',

  voice_activity_suspected:
    'Nghi vấn trao đổi bằng giọng nói',

  screen_stopped:
    'Chia sẻ màn hình dừng',

  monitoring_restored:
    'Khôi phục giám sát',

  submitted:
    'Kết thúc và nộp bài',
}


async function getEvidenceUrl(
  path,
) {
  if (!path) {
    throw new Error(
      'Không có đường dẫn ảnh bằng chứng.',
    )
  }

  let accessToken =
    authService
      .getAccessToken()

  if (!accessToken) {
    throw new Error(
      'Phiên đăng nhập không hợp lệ.',
    )
  }

  const buildUrl = () => (
    `${API_BASE_URL}` +
    `/api/storage/proctoring/evidence-url` +
    `?path=${encodeURIComponent(path)}`
  )

  let response =
    await fetch(
      buildUrl(),
      {
        method: 'GET',

        headers: {
          Accept:
            'application/json',

          Authorization:
            `Bearer ${accessToken}`,
        },
      },
    )

  if (
    response.status === 401 &&
    authService
      .getRefreshToken()
  ) {
    accessToken =
      await authService
        .refreshAccessToken()

    response =
      await fetch(
        buildUrl(),
        {
          method: 'GET',

          headers: {
            Accept:
              'application/json',

            Authorization:
              `Bearer ${accessToken}`,
          },
        },
      )
  }

  const data =
    await response
      .json()
      .catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      'Không thể tải ảnh bằng chứng.',
    )
  }

  if (!data.url) {
    throw new Error(
      'Backend không trả về URL ảnh bằng chứng.',
    )
  }

  return data.url
}


function EvidenceThumbnail({
  path,
  label,
}) {
  const [
    url,
    setUrl,
  ] = useState('')

  const [
    loadFailed,
    setLoadFailed,
  ] = useState(false)

  useEffect(() => {
    let active = true

    setUrl('')
    setLoadFailed(false)

    getEvidenceUrl(
      path,
    )
      .then((value) => {
        if (active) {
          setUrl(
            value,
          )
        }
      })
      .catch((error) => {
        console.warn(
          'Không thể tải ảnh bằng chứng:',
          error,
        )

        if (active) {
          setLoadFailed(
            true,
          )
        }
      })

    return () => {
      active = false
    }
  }, [
    path,
  ])

  if (loadFailed) {
    return (
      <span
        className="
          inline-flex
          items-center
          gap-1
          rounded-lg
          bg-red-50
          px-2
          py-1
          text-[11px]
          font-bold
          text-red-600
          dark:bg-red-500/10
          dark:text-red-300
        "
      >
        <ImageIcon
          className="h-3.5 w-3.5"
        />

        Không tải được {label}
      </span>
    )
  }

  if (!url) {
    return (
      <span
        className="
          inline-flex
          items-center
          gap-1
          rounded-lg
          bg-slate-100
          px-2
          py-1
          text-[11px]
          font-bold
          text-slate-500
          dark:bg-white/10
          dark:text-slate-300
        "
      >
        <ImageIcon
          className="h-3.5 w-3.5"
        />

        Đang tải {label}
      </span>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="
        group
        block
        overflow-hidden
        rounded-xl
        border
        border-red-200
        bg-slate-950
      "
    >
      <img
        src={url}
        alt={`Bằng chứng ${label}`}
        className="
          h-28
          w-full
          object-cover
          transition
          group-hover:scale-105
        "
      />

      <span
        className="
          block
          px-2
          py-1
          text-center
          text-[11px]
          font-black
          text-white
        "
      >
        {label}
      </span>
    </a>
  )
}


function ProctoringReport({
  result,
}) {
  const report =
    result?.proctoringReport

  if (!report) {
    return null
  }

  const events =
    Array.isArray(
      report.events,
    )
      ? report.events
      : []

  const violationEvents =
    events.filter(
      (event) =>
        event.severity ===
        'violation',
    )

  return (
    <div
      className="
        mb-4
        rounded-2xl
        border
        border-red-200
        bg-red-50/60
        p-5
        dark:border-red-500/20
        dark:bg-red-500/5
      "
    >
      <div
        className="
          flex
          flex-wrap
          items-start
          justify-between
          gap-4
        "
      >
        <div>
          <div
            className="
              flex
              items-center
              gap-2
              text-red-700
              dark:text-red-200
            "
          >
            <ShieldAlert
              className="h-5 w-5"
            />

            <h3
              className="
                text-lg
                font-black
              "
            >
              Nhật ký giám sát phòng thi
            </h3>
          </div>

          <p
            className="
              mt-1
              text-xs
              font-semibold
              text-slate-500
              dark:text-slate-400
            "
          >
            Session:{' '}
            {report.sessionId ||
              'Không có mã phiên'}
          </p>
        </div>

        <div
          className="
            flex
            flex-wrap
            gap-2
            text-xs
            font-black
          "
        >
          <span
            className="
              rounded-full
              bg-red-600
              px-3
              py-1.5
              text-white
            "
          >
            {violationEvents.length}{' '}
            vi phạm
          </span>

          {report.cameraRequired && (
            <span
              className={
                `rounded-full px-3 py-1.5 ${
                  report.cameraActiveAtSubmit
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
                }`
              }
            >
              <Camera
                className="
                  mr-1
                  inline
                  h-3.5
                  w-3.5
                "
              />

              Camera
            </span>
          )}

          {report.screenRequired && (
            <span
              className={
                `rounded-full px-3 py-1.5 ${
                  report.screenActiveAtSubmit
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
                }`
              }
            >
              <MonitorUp
                className="
                  mr-1
                  inline
                  h-3.5
                  w-3.5
                "
              />

              Màn hình
            </span>
          )}

          {report.microphoneRequired && (
            <span
              className={
                `rounded-full px-3 py-1.5 ${
                  report.microphoneActiveAtSubmit
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
                }`
              }
            >
              <Mic
                className="
                  mr-1
                  inline
                  h-3.5
                  w-3.5
                "
              />

              Microphone
            </span>
          )}
        </div>
      </div>

      <div
        className="
          mt-4
          max-h-72
          space-y-2
          overflow-y-auto
          pr-1
        "
      >
        {events.length
          ? events.map(
              (
                event,
                index,
              ) => (
                <div
                  key={
                    event.id ||
                    `${event.type}-${index}`
                  }
                  className={
                    `flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
                      event.severity ===
                      'violation'
                        ? 'border-red-200 bg-white text-red-700 dark:border-red-500/20 dark:bg-slate-950/50 dark:text-red-200'
                        : 'border-slate-200 bg-white/70 text-slate-600 dark:border-white/10 dark:bg-slate-950/30 dark:text-slate-300'
                    }`
                  }
                >
                  <Clock3
                    className="
                      mt-0.5
                      h-4
                      w-4
                      shrink-0
                    "
                  />

                  <div
                    className="
                      min-w-0
                      flex-1
                    "
                  >
                    <p
                      className="
                        font-black
                      "
                    >
                      {eventLabels[
                        event.type
                      ] ||
                        event.type}
                    </p>

                    <p
                      className="
                        mt-0.5
                        text-xs
                        font-semibold
                        opacity-80
                      "
                    >
                      {event.message}
                    </p>

                    {(
                      event.metadata
                        ?.evidenceCameraPath ||
                      event.metadata
                        ?.evidenceScreenPath
                    ) && (
                      <div
                        className="
                          mt-3
                          grid
                          gap-2
                          sm:grid-cols-2
                        "
                      >
                        {event.metadata
                          ?.evidenceCameraPath && (
                          <EvidenceThumbnail
                            path={
                              event.metadata
                                .evidenceCameraPath
                            }
                            label="Ảnh camera"
                          />
                        )}

                        {event.metadata
                          ?.evidenceScreenPath && (
                          <EvidenceThumbnail
                            path={
                              event.metadata
                                .evidenceScreenPath
                            }
                            label="Ảnh màn hình"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  <time
                    className="
                      shrink-0
                      text-[11px]
                      font-bold
                      opacity-70
                    "
                  >
                    {event.clientAt ||
                    event.at
                      ? new Date(
                          event.clientAt ||
                            event.at,
                        )
                          .toLocaleTimeString(
                            'vi-VN',
                          )
                      : '--:--'}
                  </time>
                </div>
              ),
            )
          : (
              <p
                className="
                  rounded-xl
                  bg-white
                  p-4
                  text-sm
                  font-semibold
                  text-slate-500
                  dark:bg-slate-950/40
                  dark:text-slate-300
                "
              >
                Phiên này chưa có sự kiện chi tiết.
              </p>
            )}
      </div>
    </div>
  )
}


function StudentResultsModal({
  exam,
  open,
  onClose,
}) {
  const [
    openResultId,
    setOpenResultId,
  ] = useState(null)

  const resultRowRefs =
    useRef(new Map())

  const [
    results,
    setResults,
  ] = useState([])

  const [
    fullExam,
    setFullExam,
  ] = useState(null)

  const [
    loading,
    setLoading,
  ] = useState(false)

  useEffect(() => {
    if (!open) {
      setOpenResultId(
        null,
      )

      setResults(
        [],
      )

      setFullExam(
        null,
      )

      return
    }

    if (!exam?.id) {
      return
    }

    const loadData =
      async () => {
        try {
          setLoading(
            true,
          )

          const [
            resultsResponse,
            detailResponse,
          ] =
            await Promise.all([
              getExamResultsApi(
                exam.id,
              ),

              getExamDetailApi(
                exam.id,
              ),
            ])

          const loadedResults =
            resultsResponse
              .data
              ?.results ??
              []

          setResults(
            loadedResults,
          )

          // Chỉ focus bài nộp nếu result đó thực sự xuất hiện
          // trong response authoritative của teacher endpoint.
          const requestedResultId =
            exam.focusResultId != null
              ? String(exam.focusResultId)
              : null

          const requestedStudentId =
            exam.focusStudentId != null
              ? String(exam.focusStudentId)
              : null

          const focusedResult =
            loadedResults.find(
              (result) => {
                if (
                  requestedResultId &&
                  result?.id != null &&
                  String(result.id) ===
                    requestedResultId
                ) {
                  return true
                }

                if (!requestedStudentId) {
                  return false
                }

                const resultStudentId =
                  result?.studentId ??
                  result?.userId ??
                  result?.uid

                return (
                  resultStudentId != null &&
                  String(resultStudentId) ===
                    requestedStudentId
                )
              },
            )

          setOpenResultId(
            focusedResult
              ? (
                  focusedResult.id ??
                  null
                )
              : null,
          )

          setFullExam(
            detailResponse
              .data
              ?.exam ??
              exam,
          )
        } catch (error) {
          console.error(
            error,
          )

          toast.error(
            error?.response
              ?.data
              ?.message ||
              error.message ||
              'Không thể tải bài làm học sinh',
          )

          setResults(
            [],
          )

          setFullExam(
            exam,
          )
        } finally {
          setLoading(
            false,
          )
        }
      }

    loadData()
  }, [
    open,
    exam?.id,
    exam?.focusResultId,
    exam?.focusStudentId,
  ])

  useEffect(() => {
    if (
      !open ||
      openResultId == null
    ) {
      return
    }

    const timer = window.setTimeout(
      () => {
        resultRowRefs.current
          .get(String(openResultId))
          ?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          })
      },
      80,
    )

    return () =>
      window.clearTimeout(timer)
  }, [
    open,
    openResultId,
  ])

  if (
    !open ||
    !exam
  ) {
    return null
  }

  const safeExam =
    fullExam ??
    exam

  const sortedResults =
    results
      .slice()
      .sort(
        (
          a,
          b,
        ) => {
          const timeA =
            new Date(
              a.createdAt ||
                0,
            ).getTime()

          const timeB =
            new Date(
              b.createdAt ||
                0,
            ).getTime()

          return (
            timeB -
            timeA
          )
        },
      )

  const formatSubmittedTime =
    (value) => {
      if (!value) {
        return 'Chưa có thời gian'
      }

      if (
        value?.toDate
      ) {
        return value
          .toDate()
          .toLocaleString(
            'vi-VN',
          )
      }

      const date =
        new Date(
          value,
        )

      if (
        Number.isNaN(
          date.getTime(),
        )
      ) {
        return 'Chưa có thời gian'
      }

      return date
        .toLocaleString(
          'vi-VN',
        )
    }

  return (
    <div
      className="
        fixed
        inset-0
        z-[70]
        flex
        items-center
        justify-center
        bg-slate-950/50
        p-4
        backdrop-blur-sm
      "
      onMouseDown={
        onClose
      }
    >
      <div
        className="
          max-h-[90vh]
          w-full
          max-w-7xl
          overflow-y-auto
          rounded-3xl
          border
          border-slate-200
          bg-white
          p-6
          shadow-2xl
          dark:border-white/10
          dark:bg-slate-950
        "
        onMouseDown={
          (event) =>
            event
              .stopPropagation()
        }
      >
        <div
          className="
            mb-5
            flex
            items-start
            justify-between
            gap-4
          "
        >
          <div>
            <p
              className="
                text-xs
                font-black
                uppercase
                tracking-[0.18em]
                text-blue-600
              "
            >
              Bài làm học sinh
            </p>

            <h2
              className="
                mt-2
                text-2xl
                font-black
                text-slate-950
                dark:text-white
              "
            >
              {safeExam.title ||
                'Đề thi'}
            </h2>

            <p
              className="
                mt-1
                text-sm
                font-semibold
                text-slate-500
                dark:text-slate-300
              "
            >
              {loading
                ? 'Đang tải bài làm học sinh...'
                : sortedResults.length
                  ? `Có ${sortedResults.length} lượt nộp bài.`
                  : 'Chưa có học sinh nộp bài.'}
            </p>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="
              rounded-xl
              p-2
              text-slate-500
              transition
              hover:bg-slate-100
              dark:text-slate-300
              dark:hover:bg-white/10
            "
          >
            <X
              className="
                h-5
                w-5
              "
            />
          </button>
        </div>

        {loading ? (
          <div
            className="
              rounded-2xl
              bg-slate-50
              p-8
              text-center
              text-sm
              font-bold
              text-slate-500
              dark:bg-white/5
              dark:text-slate-300
            "
          >
            Đang tải dữ liệu bài làm...
          </div>
        ) : sortedResults.length ? (
          <div
            className="
              overflow-hidden
              rounded-2xl
              border
              border-slate-200
              dark:border-white/10
            "
          >
            <div
              className="
                grid
                grid-cols-[1.3fr_0.55fr_0.75fr_1fr_0.8fr_0.75fr_0.8fr]
                gap-3
                bg-slate-50
                px-4
                py-3
                text-xs
                font-black
                uppercase
                tracking-[0.12em]
                text-slate-500
                dark:bg-white/5
                dark:text-slate-300
              "
            >
              <span>
                Học sinh
              </span>

              <span>
                Điểm
              </span>

              <span>
                Đã trả lời
              </span>

              <span>
                Thời gian nộp
              </span>

              <span>
                Lỗi sai
              </span>

              <span>
                Vi phạm
              </span>

              <span>
                Bài làm
              </span>
            </div>

            <div
              className="
                divide-y
                divide-slate-200
                dark:divide-white/10
              "
            >
              {sortedResults.map(
                (
                  result,
                  index,
                ) => {
                  const resultKey =
                    result.id ??
                    `${result.studentId || 'student'}-${index}`

                  const isOpen =
                    openResultId ===
                    resultKey

                  return (
                    <div
                      key={
                        resultKey
                      }
                      ref={(node) => {
                        const key =
                          String(resultKey)

                        if (node) {
                          resultRowRefs.current.set(
                            key,
                            node,
                          )
                        } else {
                          resultRowRefs.current.delete(
                            key,
                          )
                        }
                      }}
                    >
                      <div
                        className="
                          grid
                          grid-cols-[1.3fr_0.55fr_0.75fr_1fr_0.8fr_0.75fr_0.8fr]
                          gap-3
                          px-4
                          py-4
                          text-sm
                          font-semibold
                          text-slate-600
                          dark:text-slate-300
                        "
                      >
                        <span
                          className="
                            break-words
                            text-slate-900
                            dark:text-white
                          "
                        >
                          {getStudentDisplayName(
                            result,
                          )}
                        </span>

                        <span
                          className="
                            text-xl
                            font-black
                            text-blue-600
                          "
                        >
                          {Number(
                            result.score ??
                              0,
                          ).toFixed(
                            1,
                          )}
                        </span>

                        <span>
                          {result
                            .answeredCount ??
                            0}
                          /
                          {result
                            .totalQuestions ??
                            safeExam
                              .questionCount ??
                            0}
                        </span>

                        <span>
                          {formatSubmittedTime(
                            result.createdAt,
                          )}
                        </span>

                        <span>
                          {(
                            result
                              .wrongQuestions ??
                            []
                          ).length
                            ? `${
                                (
                                  result
                                    .wrongQuestions ??
                                  []
                                ).length
                              } câu sai`
                            : 'Không có câu sai'}
                        </span>

                        <span
                          className="
                            font-black
                            text-red-600
                            dark:text-red-300
                          "
                        >
                          {Number(
                            result
                              .proctoringViolations ??
                              result
                                .fullscreenViolations ??
                              0,
                          )}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            setOpenResultId(
                              (
                                value,
                              ) =>
                                value ===
                                resultKey
                                  ? null
                                  : resultKey,
                            )
                          }
                          className="
                            rounded-xl
                            bg-blue-600
                            px-3
                            py-2
                            text-xs
                            font-black
                            text-white
                            shadow-lg
                            shadow-blue-500/20
                            transition
                            hover:bg-blue-700
                          "
                        >
                          {isOpen
                            ? 'Ẩn bài làm'
                            : 'Xem bài làm'}
                        </button>
                      </div>

                      {isOpen && (
                        <div
                          className="
                            px-4
                            pb-4
                          "
                        >
                          <ProctoringReport
                            result={
                              result
                            }
                          />

                          <StudentAnswers
                            exam={
                              safeExam
                            }
                            result={
                              result
                            }
                          />
                        </div>
                      )}
                    </div>
                  )
                },
              )}
            </div>
          </div>
        ) : (
          <div
            className="
              rounded-2xl
              bg-slate-50
              p-8
              text-center
              text-sm
              font-bold
              text-slate-500
              dark:bg-white/5
              dark:text-slate-300
            "
          >
            Chưa có dữ liệu bài làm và điểm của học sinh.
          </div>
        )}
      </div>
    </div>
  )
}


export default StudentResultsModal
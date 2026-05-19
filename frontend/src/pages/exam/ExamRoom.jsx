import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  MonitorSmartphone,
} from 'lucide-react'

import useExamRoom from '../../hooks/useExamRoom'
import { formatDuration } from '../../utils/examHelpers'

function ExamRoom() {
  const {
    dark,
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
  } = useExamRoom()

  if (loading) {
    return (
      <div className={dark ? 'dark min-h-screen bg-slate-950' : 'min-h-screen bg-slate-50'}>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />

            <p className="mt-4 text-sm font-bold text-slate-500 dark:text-slate-300">
              Đang tải bài thi...
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!exam) return null

  return (
    <div className={dark ? 'dark' : ''}>
      <section className="min-h-screen bg-slate-50 text-slate-950 transition dark:bg-slate-950">
        {fullscreenWarning && !isTeacher && !preview && !submitting && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-slate-900">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-200">
                <MonitorSmartphone className="h-8 w-8" />
              </div>

              <h2 className="mt-5 text-2xl font-black text-slate-950 dark:text-white">
                Cần bật toàn màn hình
              </h2>

              <p className="mt-3 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">
                Học sinh bắt buộc phải ở chế độ toàn màn hình để tiếp tục làm bài thi.
              </p>

              <p className="mt-3 text-sm font-black text-red-600 dark:text-red-300">
                Vi phạm: {fullscreenViolations}/{maxFullscreenViolations}
              </p>

              <button
                type="button"
                onClick={retryFullscreen}
                className="mt-6 w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
              >
                Bật toàn màn hình
              </button>
            </div>
          </div>
        )}

        {leaveWarningOpen && !isTeacher && !preview && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-slate-900">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-200">
                <AlertTriangle className="h-8 w-8" />
              </div>

              <h2 className="mt-5 text-2xl font-black text-slate-950 dark:text-white">
                Không nên rời phòng thi
              </h2>

              <p className="mt-3 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">
                Bạn đang làm bài. Nếu rời trang, bài làm có thể bị mất hoặc bị tính là vi phạm.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setLeaveWarningOpen(false)}
                  className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                >
                  Tiếp tục làm bài
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Đang nộp...' : 'Nộp bài'}
                </button>
              </div>
            </div>
          </div>
        )}

        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div>
              <h1 className="text-3xl font-black text-slate-950 dark:text-white">
                {exam.title}
              </h1>

              <p className="mt-1 text-base font-semibold text-slate-500 dark:text-slate-300">
                {exam.subject} • {questionCount} câu hỏi
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-2xl bg-orange-100 px-5 py-3 text-base font-black text-orange-700 dark:bg-orange-500/20 dark:text-orange-100">
                <Clock3 className="h-5 w-5" />
                {formatDuration(timeLeft)}
              </div>

              <div className="inline-flex items-center gap-2 rounded-2xl bg-blue-100 px-5 py-3 text-base font-black text-blue-700 dark:bg-blue-500/20 dark:text-blue-100">
                <CheckCircle2 className="h-5 w-5" />
                {answeredCount}/{questionCount}
              </div>

              {!isTeacher && !preview && (
                <div className="inline-flex items-center gap-2 rounded-2xl bg-red-100 px-5 py-3 text-base font-black text-red-700 dark:bg-red-500/20 dark:text-red-100">
                  Vi phạm: {fullscreenViolations}/{maxFullscreenViolations}
                </div>
              )}

              {!preview && !isTeacher && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmit}
                  className="rounded-2xl bg-emerald-600 px-6 py-3 text-base font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Đang nộp bài...' : 'Nộp bài'}
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="space-y-7">
            {exam.questions?.map((question, index) => (
              <div
                key={question.id}
                className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex items-start gap-6">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white">
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-black leading-9 text-slate-950 dark:text-white">
                      {question.question}
                    </h2>

                    {question.type === 'essay' || question.type === 'code' ? (
                      <textarea
                        value={textAnswers[question.id] || ''}
                        onChange={(event) =>
                          handleTextAnswer(question.id, event.target.value)
                        }
                        disabled={preview || isTeacher}
                        placeholder="Nhập câu trả lời..."
                        className="mt-6 min-h-[220px] w-full rounded-2xl border border-slate-200 bg-white px-5 py-5 text-lg font-medium text-slate-700 outline-none transition focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                      />
                    ) : (
                      <div className="mt-6 grid gap-4">
                        {question.answers?.map((answer, answerIndex) => {
                          const selected = answers[question.id] === answerIndex

                          return (
                            <button
                              key={answer.id ?? answerIndex}
                              type="button"
                              disabled={preview || isTeacher}
                              onClick={() => handleAnswer(question.id, answerIndex)}
                              className={`flex items-center gap-5 rounded-2xl border px-6 py-6 text-left transition ${
                                selected
                                  ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10'
                                  : 'border-slate-200 bg-white hover:border-blue-300 dark:border-white/10 dark:bg-slate-900'
                              }`}
                            >
                              <div
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-black ${
                                  selected
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white'
                                }`}
                              >
                                {String.fromCharCode(65 + answerIndex)}
                              </div>

                              <span className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                                {answer.content || answer.text || ''}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!preview && !isTeacher && (
            <div className="mt-8 rounded-3xl border border-orange-200 bg-orange-50 p-7 dark:border-orange-500/20 dark:bg-orange-500/10">
              <div className="flex items-start gap-4">
                <AlertTriangle className="mt-0.5 h-6 w-6 text-orange-600 dark:text-orange-300" />

                <div>
                  <h3 className="text-base font-black text-orange-700 dark:text-orange-100">
                    Lưu ý khi làm bài
                  </h3>

                  <ul className="mt-3 space-y-1.5 text-base font-semibold text-orange-700 dark:text-orange-100">
                    <li>• Không thoát khỏi chế độ toàn màn hình</li>
                    <li>• Quá số lần thoát cho phép sẽ tự động nộp bài</li>
                    <li>• Không reload hoặc quay lại khi đang làm bài</li>
                    <li>• Hệ thống sẽ tự động nộp khi hết giờ</li>
                    <li>• Hệ thống tự lưu bài làm mỗi 10 giây</li>
                    <li>• Kiểm tra kỹ trước khi nộp bài</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </main>
      </section>
    </div>
  )
}

export default ExamRoom
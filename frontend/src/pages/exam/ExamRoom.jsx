import { AlertTriangle, CheckCircle2, Clock3, LockKeyhole, Maximize2 } from 'lucide-react'

import useExamRoom from '../../hooks/useExamRoom'

function ExamRoom() {
  const {
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
  } = useExamRoom()

  const lockedByFullscreen = fullscreenBlocked && !preview && !isTeacher

  if (loading) {
    return (
      <section className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-3xl bg-white px-8 py-6 text-lg font-black text-slate-700 shadow-sm">
          Đang tải đề thi...
        </div>
      </section>
    )
  }

  if (!exam) {
    return (
      <section className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-3xl bg-white px-8 py-6 text-lg font-black text-red-600 shadow-sm">
          Không tìm thấy đề thi
        </div>
      </section>
    )
  }

  if (!preview && !isTeacher && !hasStarted) {
    return (
      <section className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-xl rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-600 text-white shadow-lg shadow-blue-500/25">
            <Maximize2 className="h-10 w-10" />
          </div>

          <h1 className="mt-6 text-3xl font-black text-slate-950">
            Vào phòng thi
          </h1>

          <p className="mt-3 text-base font-semibold leading-7 text-slate-500">
            Bài thi yêu cầu chế độ toàn màn hình. Khi bắt đầu, hệ thống sẽ ghi nhận số lần thoát toàn màn hình.
          </p>

          <div className="mt-6 rounded-2xl bg-orange-50 p-4 text-left text-sm font-bold text-orange-700">
            <p>• Không thoát khỏi chế độ toàn màn hình</p>
            <p>• Quá số lần thoát cho phép sẽ tự động nộp bài</p>
            <p>• Hệ thống tự động nộp khi hết giờ</p>
          </div>

          <button
            type="button"
            onClick={startExam}
            className="mt-7 w-full rounded-2xl bg-blue-600 px-6 py-4 text-lg font-black text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-700"
          >
            Bắt đầu làm bài
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="min-h-screen bg-slate-100">
      {lockedByFullscreen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[32px] border border-red-200 bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-red-600 text-white shadow-lg shadow-red-500/25">
              <LockKeyhole className="h-10 w-10" />
            </div>

            <h2 className="mt-6 text-3xl font-black text-slate-950">
              Bạn đã thoát toàn màn hình
            </h2>

            <p className="mt-3 text-base font-semibold leading-7 text-slate-500">
              Hệ thống đã ghi nhận vi phạm. Bạn phải quay lại toàn màn hình mới được tiếp tục làm bài.
            </p>

            <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-black text-red-700">
              Vi phạm: {violations}/{exam.maxFullscreenViolations ?? 2}
            </div>

            <button
              type="button"
              onClick={restoreFullscreen}
              className="mt-7 w-full rounded-2xl bg-blue-600 px-6 py-4 text-lg font-black text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-700"
            >
              Quay lại toàn màn hình
            </button>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-5">
          <div>
            <h1 className="text-3xl font-black text-slate-950">
              {exam.title}
            </h1>

            <p className="mt-1 text-base font-semibold text-slate-500">
              {exam.subject} • {exam.questions?.length || 0} câu hỏi
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-orange-100 px-5 py-3 font-black text-orange-600">
              <div className="flex items-center gap-2">
                <Clock3 className="h-5 w-5" />
                {formatTime(timeLeft)}
              </div>
            </div>

            <div className="rounded-2xl bg-blue-100 px-5 py-3 font-black text-blue-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                {answeredCount}/{exam.questions?.length || 0}
              </div>
            </div>

            <div className="rounded-2xl bg-red-100 px-5 py-3 font-black text-red-600">
              Vi phạm: {violations}/{exam.maxFullscreenViolations ?? 2}
            </div>

            {!preview && !isTeacher && (
              <button
                type="button"
                disabled={submitting || lockedByFullscreen}
                onClick={() => handleSubmit(false)}
                className="rounded-2xl bg-emerald-600 px-7 py-3 text-base font-black text-white shadow-lg transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Đang nộp...' : 'Nộp bài'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="space-y-8">
          {exam.questions?.map((question, index) => (
            <div
              key={question.id}
              className="rounded-[30px] border border-slate-200 bg-white p-8 shadow-sm"
            >
              <div className="flex items-start gap-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-black text-white">
                  {index + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-3xl font-black leading-tight text-slate-950">
                    {question.question}
                  </h2>

                  {question.type === 'truefalse' ? (
                    <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200">
                      <div className="grid grid-cols-[1fr_130px_130px] bg-slate-100 text-base font-black text-slate-700">
                        <div className="px-6 py-4">Ý</div>
                        <div className="px-6 py-4 text-center">Đúng</div>
                        <div className="px-6 py-4 text-center">Sai</div>
                      </div>

                      {(question.answers || []).slice(0, 4).map((answer, answerIndex) => {
                        const selected = answers[question.id]?.[answerIndex]

                        return (
                          <div
                            key={answer.id ?? answerIndex}
                            className="grid grid-cols-[1fr_130px_130px] border-t border-slate-200"
                          >
                            <div className="px-6 py-5 text-base font-bold text-slate-800">
                              <span className="mr-2 font-black">
                                {String.fromCharCode(97 + answerIndex)})
                              </span>
                              {answer.content}
                            </div>

                            <button
                              type="button"
                              disabled={preview || isTeacher || lockedByFullscreen}
                              onClick={() =>
                                handleTrueFalseAnswer(question.id, answerIndex, true)
                              }
                              className={`m-3 rounded-2xl px-4 py-3 text-base font-black transition ${
                                selected === true
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 text-slate-700 hover:bg-emerald-50'
                              }`}
                            >
                              Đúng
                            </button>

                            <button
                              type="button"
                              disabled={preview || isTeacher || lockedByFullscreen}
                              onClick={() =>
                                handleTrueFalseAnswer(question.id, answerIndex, false)
                              }
                              className={`m-3 rounded-2xl px-4 py-3 text-base font-black transition ${
                                selected === false
                                  ? 'bg-red-600 text-white'
                                  : 'bg-slate-100 text-slate-700 hover:bg-red-50'
                              }`}
                            >
                              Sai
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  ) : question.type === 'short-answer' ? (
                    <div className="mt-8 grid gap-4 sm:grid-cols-4">
                      {[0, 1, 2, 3].map((item) => {
                        const currentValue = Array.isArray(textAnswers[question.id])
                          ? textAnswers[question.id]
                          : ['', '', '', '']

                        return (
                          <input
                            key={item}
                            value={currentValue[item] || ''}
                            disabled={preview || isTeacher || lockedByFullscreen}
                            onChange={(event) => {
                              const nextValue = [...currentValue]
                              nextValue[item] = event.target.value
                              handleTextAnswer(question.id, nextValue)
                            }}
                            placeholder={`Ô ${item + 1}`}
                            className="rounded-2xl border border-slate-200 bg-white px-5 py-5 text-xl font-bold text-slate-800 outline-none transition focus:border-blue-500"
                          />
                        )
                      })}
                    </div>
                  ) : question.type === 'essay' || question.type === 'code' ? (
                    <div className="mt-8">
                      <textarea
                        disabled={preview || isTeacher || lockedByFullscreen}
                        value={textAnswers[question.id] || ''}
                        onChange={(event) =>
                          handleTextAnswer(question.id, event.target.value)
                        }
                        placeholder="Nhập bài làm tự luận..."
                        rows={8}
                        className="w-full rounded-3xl border border-slate-200 bg-white px-6 py-5 text-lg font-semibold text-slate-800 outline-none transition focus:border-blue-500"
                      />
                    </div>
                  ) : (
                    <div className="mt-8 space-y-4">
                      {question.answers?.map((answer, answerIndex) => {
                        const selected = answers[question.id] === answerIndex

                        return (
                          <button
                            key={answer.id ?? answerIndex}
                            type="button"
                            disabled={preview || isTeacher || lockedByFullscreen}
                            onClick={() => handleAnswer(question.id, answerIndex)}
                            className={`flex w-full items-center gap-5 rounded-3xl border px-6 py-5 text-left transition ${
                              selected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-slate-200 bg-white hover:border-blue-300'
                            }`}
                          >
                            <div
                              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-black ${
                                selected
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {String.fromCharCode(65 + answerIndex)}
                            </div>

                            <span className="text-xl font-bold text-slate-800">
                              {answer.content}
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
          <div className="mt-10 rounded-[30px] border border-orange-200 bg-orange-50 p-8">
            <div className="flex items-start gap-4">
              <AlertTriangle className="mt-1 h-7 w-7 text-orange-500" />

              <div>
                <h3 className="text-2xl font-black text-orange-700">
                  Lưu ý khi làm bài
                </h3>

                <ul className="mt-4 space-y-2 text-lg font-semibold text-orange-600">
                  <li>• Không thoát khỏi chế độ toàn màn hình</li>
                  <li>• Quá số lần thoát cho phép sẽ tự động nộp bài</li>
                  <li>• Hệ thống sẽ tự động nộp khi hết giờ</li>
                  <li>• Kiểm tra kỹ trước khi nộp bài</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>
    </section>
  )
}

export default ExamRoom
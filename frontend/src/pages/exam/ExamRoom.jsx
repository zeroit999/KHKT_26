import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  LockKeyhole,
  Maximize2,
  Mic,
  MonitorUp,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import useExamRoom from '../../hooks/exam/useExamRoom';
import useSyncedDarkMode from '../../hooks/common/useSyncedDarkMode.js';

const renderRichContent = (content = '', isDark = false) => {
  const rawContent = String(content || '');

  const html = rawContent
    .replace(
      /<img\s+/g,
      `<img class="my-5 max-h-[460px] max-w-full rounded-2xl border ${
        isDark ? 'border-white/10' : 'border-slate-200'
      } object-contain shadow-sm" `
    )
    .replace(/\n/g, '<br />');

  return (
    <div
      className={`max-w-none text-[18px] font-bold leading-8 sm:text-[20px] ${
        isDark ? 'text-slate-100' : 'text-slate-900'
      }`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

const getQuestionTypeLabel = (type) => {
  if (type === 'truefalse') return 'Đúng / Sai';
  if (type === 'short-answer') return 'Trả lời ngắn';
  if (type === 'code') return 'Lập trình / Code';
  if (type === 'essay') return 'Tự luận';
  return 'Trắc nghiệm';
};

const SHORT_ANSWER_SLOT_COUNT = 4;

const SHORT_ANSWER_ROWS = [
  { key: 'dash', label: '-', value: '-' },
  { key: 'comma-1', label: ',', value: ',' },
  { key: 'digit-0', label: '0', value: '0' },
  { key: 'digit-1', label: '1', value: '1' },
  { key: 'digit-2', label: '2', value: '2' },
  { key: 'digit-3', label: '3', value: '3' },
  { key: 'digit-4', label: '4', value: '4' },
  { key: 'digit-5', label: '5', value: '5' },
  { key: 'digit-6', label: '6', value: '6' },
  { key: 'digit-7', label: '7', value: '7' },
  { key: 'digit-8', label: '8', value: '8' },
  { key: 'digit-9', label: '9', value: '9' },
];

function StatusChip({ icon: Icon, label, active = true, tone = 'slate' }) {
  const styles = {
    slate: active
      ? 'border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200'
      : 'border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300',
    blue: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300',
    amber:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
    red: 'border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300',
    green:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  };

  return (
    <div
      className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-black ${styles[tone]}`}
    >
      <Icon className="h-4 w-4" />
      <span className="whitespace-nowrap">{label}</span>
    </div>
  );
}

function ExamRoom() {
  const dark = useSyncedDarkMode();
  const {
    exam,
    loading,
    submitting,
    preview,
    isTeacher,
    hasStarted,
    fullscreenBlocked,
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
  } = useExamRoom();

  const cameraPreviewRef = useRef(null);
  const questionRefs = useRef([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [flaggedQuestions, setFlaggedQuestions] = useState(() => new Set());
  const [mobileNavigatorOpen, setMobileNavigatorOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  useEffect(() => {
    if (cameraPreviewRef.current) {
      cameraPreviewRef.current.srcObject = cameraStream || null;
    }
  }, [cameraStream]);

  const questions = useMemo(() => exam?.questions || [], [exam?.questions]);
  const currentQuestion = questions[currentQuestionIndex];
  const lockedByFullscreen = fullscreenBlocked && !preview && !isTeacher;
  const canAnswer = !preview && !isTeacher && !lockedByFullscreen;

  const isQuestionAnswered = (question) => {
    if (!question) return false;

    if (question.type === 'truefalse') {
      const current = answers[question.id];
      return current && Object.keys(current).length > 0;
    }

    if (question.type === 'short-answer') {
      const current = textAnswers[question.id];
      return (
        Array.isArray(current) &&
        current.some((value) => String(value || '').trim())
      );
    }

    if (question.type === 'essay' || question.type === 'code') {
      return Boolean(String(textAnswers[question.id] || '').trim());
    }

    return answers[question.id] !== undefined && answers[question.id] !== null;
  };

  const goToQuestion = (index) => {
    if (index < 0 || index >= questions.length) return;
    setCurrentQuestionIndex(index);
    setMobileNavigatorOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleFlagQuestion = (questionId) => {
    setFlaggedQuestions((previous) => {
      const next = new Set(previous);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const handleShortAnswerSlotChange = (questionId, slotIndex, choice) => {
    const currentValue = Array.isArray(textAnswers[questionId])
      ? textAnswers[questionId]
      : Array.from({ length: SHORT_ANSWER_SLOT_COUNT }, () => '');

    const nextValue = [...currentValue];
    nextValue[slotIndex] = choice;
    handleTextAnswer(questionId, nextValue);
  };

  if (loading) {
    return (
      <section className="flex min-h-[calc(100dvh-var(--zuny-navbar-height,72px))] items-center justify-center bg-[#f4f7fb] px-4 text-slate-950 dark:bg-[#060b16] dark:text-white">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-black shadow-sm dark:border-white/10 dark:bg-[#101827]">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          Đang tải đề thi...
        </div>
      </section>
    );
  }

  if (!exam) {
    return (
      <section className="flex min-h-[calc(100dvh-var(--zuny-navbar-height,72px))] items-center justify-center bg-[#f4f7fb] px-4 dark:bg-[#060b16]">
        <div className="rounded-3xl border border-red-200 bg-white px-8 py-7 text-center shadow-xl dark:border-red-500/20 dark:bg-[#101827]">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
          <p className="mt-4 text-lg font-black text-red-600 dark:text-red-300">
            Không tìm thấy đề thi
          </p>
        </div>
      </section>
    );
  }

  if (!preview && !isTeacher && !hasStarted) {
    return (
      <section className="min-h-[calc(100dvh-var(--zuny-navbar-height,72px))] bg-[#f4f7fb] px-4 py-10 text-slate-950 dark:bg-[#060b16] dark:text-white">
        <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#101827]">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/25">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
                  Phòng thi ZUNY
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                  {exam.title}
                </h1>
                <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {exam.subject || 'Môn học'} • {questions.length} câu •{' '}
                  {exam.duration || 45} phút
                </p>
              </div>
            </div>

            <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
              <p className="text-sm font-black text-slate-900 dark:text-white">
                Trước khi bắt đầu
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">
                {proctoringConfig.enabled
                  ? 'Bài thi sử dụng giám sát theo cấu hình của giáo viên. Hãy cấp đủ quyền thiết bị và duy trì trạng thái giám sát trong suốt thời gian làm bài.'
                  : 'Bài thi này không bật giám sát nâng cao. Bạn có thể bắt đầu ngay khi đã sẵn sàng.'}
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                [
                  proctoringConfig.requireFullscreen,
                  'Toàn màn hình',
                  Maximize2,
                ],
                [proctoringConfig.requireCamera, 'Camera', Camera],
                [proctoringConfig.requireMicrophone, 'Microphone', Mic],
                [
                  proctoringConfig.requireScreenShare,
                  'Chia sẻ màn hình',
                  MonitorUp,
                ],
                [
                  proctoringConfig.detectTabSwitch,
                  'Phát hiện rời tab',
                  ShieldAlert,
                ],
                [proctoringConfig.blockClipboard, 'Chặn sao chép', LockKeyhole],
              ]
                .filter(([enabled]) => enabled)
                .map(([, label, Icon]) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 dark:border-white/10 dark:bg-[#0b1220] dark:text-slate-200"
                  >
                    <Icon className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                    {label}
                  </div>
                ))}
            </div>

            {proctoringError && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                {proctoringError}
              </div>
            )}

            {needsDevicePermission && !proctoringReady ? (
              <button
                type="button"
                onClick={prepareExamMonitoring}
                disabled={preparingProctoring}
                className="mt-7 w-full rounded-2xl bg-blue-600 px-6 py-4 text-base font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
              >
                {preparingProctoring
                  ? 'Đang kiểm tra thiết bị...'
                  : 'Cấp quyền và kiểm tra thiết bị'}
              </button>
            ) : (
              <button
                type="button"
                onClick={startExam}
                className="mt-7 w-full rounded-2xl bg-blue-600 px-6 py-4 text-base font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
              >
                Bắt đầu làm bài
              </button>
            )}
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#101827]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  Kiểm tra thiết bị
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                  Trạng thái giám sát
                </h2>
              </div>
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-black ${proctoringReady ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'}`}
              >
                {proctoringReady ? 'Sẵn sàng' : 'Chưa hoàn tất'}
              </span>
            </div>

            <div className="mt-5 grid gap-3">
              <StatusChip
                icon={Camera}
                label={`Camera ${cameraActive ? 'ON' : 'OFF'}`}
                active={cameraActive || !proctoringConfig.requireCamera}
                tone={cameraActive ? 'green' : 'slate'}
              />
              <StatusChip
                icon={Mic}
                label={`Microphone ${microphoneActive ? 'ON' : 'OFF'}`}
                active={microphoneActive || !proctoringConfig.requireMicrophone}
                tone={microphoneActive ? 'green' : 'slate'}
              />
              <StatusChip
                icon={MonitorUp}
                label={`Màn hình ${screenActive ? 'ON' : 'OFF'}`}
                active={screenActive || !proctoringConfig.requireScreenShare}
                tone={screenActive ? 'green' : 'slate'}
              />
            </div>

            {cameraActive ? (
              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 p-2 dark:border-white/10">
                <video
                  ref={cameraPreviewRef}
                  autoPlay
                  muted
                  playsInline
                  className="aspect-video w-full rounded-xl object-cover"
                />
              </div>
            ) : (
              <div className="mt-5 flex aspect-video items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm font-bold text-slate-400 dark:border-white/10 dark:bg-white/5">
                Camera preview
              </div>
            )}

            <p className="mt-4 text-xs font-semibold leading-5 text-slate-400 dark:text-slate-500">
              Camera, microphone và màn hình chỉ được truy cập sau khi bạn chủ
              động cấp quyền. Microphone chỉ phân tích mức âm thanh, không ghi
              âm.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-[calc(100dvh-var(--zuny-navbar-height,72px))] bg-[#f4f7fb] text-slate-950 transition-colors dark:bg-[#060b16] dark:text-white">
      {lockedByFullscreen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-md">
          <div className="w-full max-w-xl rounded-[30px] border border-red-200 bg-white p-8 text-center shadow-2xl dark:border-red-500/25 dark:bg-[#101827]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600 text-white">
              <LockKeyhole className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-2xl font-black text-slate-950 dark:text-white">
              Giám sát phòng thi bị gián đoạn
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">
              {blockingReason ||
                'Hệ thống đã ghi nhận vi phạm. Bạn phải khôi phục giám sát mới được tiếp tục làm bài.'}
            </p>
            <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-black text-red-700 dark:bg-red-500/10 dark:text-red-300">
              Vi phạm: {violations}/{proctoringConfig.maxViolations}
            </div>
            <button
              type="button"
              onClick={restoreFullscreen}
              className="mt-6 w-full rounded-2xl bg-blue-600 px-6 py-4 text-base font-black text-white hover:bg-blue-700"
            >
              Khôi phục giám sát
            </button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1220]/95">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-4 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-blue-600 dark:text-blue-300">
              <span>{exam.subject || 'Môn học'}</span>
              <span className="h-1 w-1 rounded-full bg-current" />
              <span>{getQuestionTypeLabel(currentQuestion?.type)}</span>
            </div>
            <h1 className="mt-1 truncate text-xl font-black tracking-tight text-slate-950 dark:text-white sm:text-2xl">
              {exam.title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusChip
              icon={Clock3}
              label={formatTime(timeLeft)}
              tone="amber"
            />
            <StatusChip
              icon={CheckCircle2}
              label={`${answeredCount}/${questions.length}`}
              tone="blue"
            />
            <StatusChip
              icon={ShieldAlert}
              label={`Vi phạm ${violations}/${proctoringConfig.maxViolations}`}
              tone="red"
            />
            {proctoringConfig.requireCamera && (
              <StatusChip
                icon={Camera}
                label={`Camera ${cameraActive ? 'ON' : 'OFF'}`}
                active={cameraActive}
                tone={cameraActive ? 'green' : 'slate'}
              />
            )}
            {proctoringConfig.requireScreenShare && (
              <StatusChip
                icon={MonitorUp}
                label={`Screen ${screenActive ? 'ON' : 'OFF'}`}
                active={screenActive}
                tone={screenActive ? 'green' : 'slate'}
              />
            )}
            {proctoringConfig.requireMicrophone && (
              <StatusChip
                icon={Mic}
                label={`Mic ${microphoneActive ? 'ON' : 'OFF'}`}
                active={microphoneActive}
                tone={microphoneActive ? 'green' : 'slate'}
              />
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[minmax(0,1fr)_330px]">
        <main className="min-w-0">
          {currentQuestion ? (
            <article
              ref={(node) => {
                questionRefs.current[currentQuestionIndex] = node;
              }}
              className="rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.07)] dark:border-white/10 dark:bg-[#101827]"
            >
              <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-500/20">
                    {currentQuestionIndex + 1}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                      Câu {currentQuestionIndex + 1} / {questions.length}
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-700 dark:text-slate-200">
                      {getQuestionTypeLabel(currentQuestion.type)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleFlagQuestion(currentQuestion.id)}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black transition ${
                    flaggedQuestions.has(currentQuestion.id)
                      ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
                  }`}
                >
                  <Flag className="h-4 w-4" />
                  {flaggedQuestions.has(currentQuestion.id)
                    ? 'Đã đánh dấu'
                    : 'Đánh dấu'}
                </button>
              </div>

              <div className="px-5 py-6 sm:px-7 sm:py-8">
                {renderRichContent(currentQuestion.question, dark)}

                {currentQuestion.type === 'truefalse' ? (
                  <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
                    <div className="hidden grid-cols-[1fr_110px_110px] bg-slate-50 text-xs font-black uppercase tracking-[0.08em] text-slate-500 dark:bg-white/5 dark:text-slate-300 sm:grid">
                      <div className="px-5 py-4">Nội dung</div>
                      <div className="px-4 py-4 text-center">Đúng</div>
                      <div className="px-4 py-4 text-center">Sai</div>
                    </div>
                    {(currentQuestion.answers || [])
                      .slice(0, 4)
                      .map((answer, answerIndex) => {
                        const selected =
                          answers[currentQuestion.id]?.[answerIndex];
                        return (
                          <div
                            key={answer.id ?? answerIndex}
                            className="border-t border-slate-200 p-4 first:border-t-0 dark:border-white/10 sm:grid sm:grid-cols-[1fr_110px_110px] sm:items-center sm:p-0"
                          >
                            <div className="text-sm font-bold leading-6 text-slate-800 dark:text-slate-100 sm:px-5 sm:py-5">
                              <span className="mr-2 font-black">
                                {String.fromCharCode(97 + answerIndex)})
                              </span>
                              {answer.content}
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 sm:contents">
                              <button
                                type="button"
                                disabled={!canAnswer}
                                onClick={() =>
                                  handleTrueFalseAnswer(
                                    currentQuestion.id,
                                    answerIndex,
                                    true
                                  )
                                }
                                className={`rounded-xl px-3 py-3 text-sm font-black transition sm:m-2 ${selected === true ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-emerald-500/10'}`}
                              >
                                Đúng
                              </button>
                              <button
                                type="button"
                                disabled={!canAnswer}
                                onClick={() =>
                                  handleTrueFalseAnswer(
                                    currentQuestion.id,
                                    answerIndex,
                                    false
                                  )
                                }
                                className={`rounded-xl px-3 py-3 text-sm font-black transition sm:m-2 ${selected === false ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-red-50 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-red-500/10'}`}
                              >
                                Sai
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : currentQuestion.type === 'short-answer' ? (
                  <div className="mt-8 flex justify-center">
                    <div className="w-full max-w-[760px] overflow-hidden rounded-[30px] border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-[0_22px_70px_rgba(15,23,42,0.10)] dark:border-white/10 dark:from-[#101827] dark:to-[#0b1220]">
                      <div className="border-b border-slate-200 px-5 py-5 text-center dark:border-white/10 sm:px-7">
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                          Phiếu trả lời ngắn
                        </span>
                        <h3 className="mt-3 text-xl font-black tracking-tight text-slate-950 dark:text-white sm:text-2xl">
                          Chọn ký tự cho từng ô đáp án
                        </h3>
                        <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
                          Mỗi cột tương ứng với một vị trí. Bạn có thể chọn chữ số,
                          dấu phẩy hoặc dấu âm cho từng ô.
                        </p>
                      </div>

                      {(() => {
                        const currentValue = Array.isArray(
                          textAnswers[currentQuestion.id]
                        )
                          ? textAnswers[currentQuestion.id]
                          : Array.from(
                              { length: SHORT_ANSWER_SLOT_COUNT },
                              () => ''
                            );

                        return (
                          <div className="px-4 py-5 sm:px-7 sm:py-7">
                            <div className="mx-auto mb-5 grid w-fit grid-cols-[44px_repeat(4,52px)] items-center gap-2 sm:grid-cols-[52px_repeat(4,62px)] sm:gap-3">
                              <div />
                              {Array.from(
                                { length: SHORT_ANSWER_SLOT_COUNT },
                                (_, slotIndex) => (
                                  <div
                                    key={`short-answer-header-${slotIndex}`}
                                    className="flex h-9 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-500 dark:bg-white/5 dark:text-slate-400"
                                  >
                                    Ô {slotIndex + 1}
                                  </div>
                                )
                              )}
                            </div>

                            <div className="mx-auto w-fit space-y-2">
                              {SHORT_ANSWER_ROWS.map((row) => (
                                <div
                                  key={row.key}
                                  className="grid grid-cols-[44px_repeat(4,52px)] items-center gap-2 rounded-2xl px-1.5 py-1.5 transition hover:bg-slate-100/80 dark:hover:bg-white/[0.04] sm:grid-cols-[52px_repeat(4,62px)] sm:gap-3"
                                >
                                  <div className="flex h-11 items-center justify-center rounded-xl bg-slate-100 text-base font-black text-slate-800 dark:bg-white/5 dark:text-slate-100">
                                    {row.label}
                                  </div>

                                  {Array.from(
                                    { length: SHORT_ANSWER_SLOT_COUNT },
                                    (_, slotIndex) => {
                                      const selected =
                                        currentValue[slotIndex] === row.value;

                                      return (
                                        <button
                                          key={`${currentQuestion.id}-${row.key}-${slotIndex}`}
                                          type="button"
                                          disabled={!canAnswer}
                                          onClick={() =>
                                            handleShortAnswerSlotChange(
                                              currentQuestion.id,
                                              slotIndex,
                                              row.value
                                            )
                                          }
                                          className={`group flex h-11 items-center justify-center rounded-xl border transition-all duration-200 sm:h-12 ${
                                            selected
                                              ? 'border-blue-600 bg-blue-600 text-white shadow-[0_8px_22px_rgba(37,99,235,0.28)] ring-4 ring-blue-500/10'
                                              : 'border-slate-200 bg-white text-slate-400 hover:-translate-y-0.5 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-500 dark:hover:border-blue-400 dark:hover:bg-blue-500/10 dark:hover:text-blue-300'
                                          } ${
                                            !canAnswer
                                              ? 'cursor-not-allowed opacity-60 hover:translate-y-0'
                                              : ''
                                          }`}
                                          aria-label={`Câu ${currentQuestionIndex + 1}, ô ${slotIndex + 1}, chọn ${row.label}`}
                                          title={`Ô ${slotIndex + 1}: ${row.label}`}
                                        >
                                          <span
                                            className={`h-3.5 w-3.5 rounded-full border-2 transition sm:h-4 sm:w-4 ${
                                              selected
                                                ? 'border-white bg-white shadow-[inset_0_0_0_3px_#2563eb]'
                                                : 'border-slate-300 bg-transparent group-hover:border-blue-500 dark:border-slate-600 dark:group-hover:border-blue-400'
                                            }`}
                                          />
                                        </button>
                                      );
                                    }
                                  )}
                                </div>
                              ))}
                            </div>

                            <div className="mx-auto mt-7 flex max-w-xl flex-col items-center justify-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-4 text-center dark:border-blue-500/15 dark:bg-blue-500/[0.08] sm:flex-row">
                              <span className="text-xs font-black uppercase tracking-[0.1em] text-blue-600 dark:text-blue-300">
                                Đáp án hiện tại
                              </span>
                              <div className="flex min-h-12 items-center justify-center gap-2">
                                {currentValue.map((value, slotIndex) => (
                                  <span
                                    key={`short-answer-preview-${slotIndex}`}
                                    className={`flex h-11 min-w-11 items-center justify-center rounded-xl border px-3 text-lg font-black shadow-sm ${
                                      value
                                        ? 'border-blue-200 bg-white text-blue-700 dark:border-blue-500/20 dark:bg-[#101827] dark:text-blue-300'
                                        : 'border-dashed border-slate-300 bg-white/70 text-slate-300 dark:border-white/15 dark:bg-white/5 dark:text-slate-600'
                                    }`}
                                  >
                                    {value || '—'}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : currentQuestion.type === 'essay' ||
                  currentQuestion.type === 'code' ? (
                  <textarea
                    disabled={!canAnswer}
                    value={textAnswers[currentQuestion.id] || ''}
                    onChange={(event) =>
                      handleTextAnswer(currentQuestion.id, event.target.value)
                    }
                    placeholder="Nhập bài làm tự luận..."
                    rows={10}
                    className="mt-7 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base font-semibold leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-[#0b1220] dark:text-white"
                  />
                ) : (
                  <div className="mt-7 grid gap-3">
                    {currentQuestion.answers?.map((answer, answerIndex) => {
                      const selected =
                        answers[currentQuestion.id] === answerIndex;
                      return (
                        <button
                          key={answer.id ?? answerIndex}
                          type="button"
                          disabled={!canAnswer}
                          onClick={() =>
                            handleAnswer(currentQuestion.id, answerIndex)
                          }
                          className={`group flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition sm:px-5 ${
                            selected
                              ? 'border-blue-500 bg-blue-50 shadow-[0_0_0_3px_rgba(59,130,246,0.08)] dark:border-blue-400 dark:bg-blue-500/15'
                              : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40 dark:border-white/10 dark:bg-[#0b1220] dark:hover:border-blue-400 dark:hover:bg-blue-500/5'
                          }`}
                        >
                          <span
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black transition ${selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700 dark:bg-white/10 dark:text-slate-200'}`}
                          >
                            {String.fromCharCode(65 + answerIndex)}
                          </span>
                          <span className="text-[15px] font-bold leading-6 text-slate-800 dark:text-slate-100">
                            {answer.content}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <button
                  type="button"
                  onClick={() => goToQuestion(currentQuestionIndex - 1)}
                  disabled={currentQuestionIndex === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  <ChevronLeft className="h-4 w-4" /> Câu trước
                </button>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setMobileNavigatorOpen(true)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 xl:hidden"
                  >
                    Danh sách câu hỏi
                  </button>
                  {currentQuestionIndex < questions.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => goToQuestion(currentQuestionIndex + 1)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
                    >
                      Câu tiếp theo <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : !preview && !isTeacher ? (
                    <button
                      type="button"
                      disabled={submitting || lockedByFullscreen}
                      onClick={() => handleSubmit(false)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <Send className="h-4 w-4" />{' '}
                      {submitting ? 'Đang nộp...' : 'Nộp bài'}
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ) : null}
        </main>

        <aside className="hidden xl:block">
          <div className="sticky top-[118px] space-y-4">
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[#101827]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    Danh sách câu hỏi
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    Chọn câu để chuyển nhanh
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                  {answeredCount}/{questions.length}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-5 gap-2">
                {questions.map((question, index) => {
                  const active = index === currentQuestionIndex;
                  const answered = isQuestionAnswered(question);
                  const flagged = flaggedQuestions.has(question.id);
                  return (
                    <button
                      key={question.id ?? index}
                      type="button"
                      onClick={() => goToQuestion(index)}
                      title={`Câu ${index + 1}`}
                      className={`relative flex h-10 items-center justify-center rounded-xl border text-sm font-black transition ${
                        active
                          ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                          : answered
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-blue-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                      }`}
                    >
                      {index + 1}
                      {flagged && (
                        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-500 dark:border-[#101827]" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-emerald-100 ring-1 ring-emerald-200 dark:bg-emerald-500/20 dark:ring-emerald-500/30" />
                  Đã trả lời
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-white ring-1 ring-slate-200 dark:bg-white/5 dark:ring-white/10" />
                  Chưa trả lời
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-blue-600" />
                  Đang xem
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-amber-500" />
                  Đánh dấu
                </span>
              </div>
            </div>

            {!preview && !isTeacher && (
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/20 dark:bg-amber-500/10">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
                  <div>
                    <p className="text-sm font-black text-amber-800 dark:text-amber-200">
                      Lưu ý phòng thi
                    </p>
                    <p className="mt-2 text-xs font-semibold leading-5 text-amber-700 dark:text-amber-300">
                      Không chuyển tab, không tắt thiết bị giám sát và kiểm tra
                      kỹ câu trả lời trước khi nộp bài.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!preview && !isTeacher && (
              <button
                type="button"
                disabled={submitting || lockedByFullscreen}
                onClick={() => handleSubmit(false)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-700 disabled:opacity-60"
              >
                <Send className="h-4 w-4" />{' '}
                {submitting ? 'Đang nộp...' : 'Nộp bài'}
              </button>
            )}
          </div>
        </aside>
      </div>

      {mobileNavigatorOpen && (
        <div className="fixed inset-0 z-[90] xl:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setMobileNavigatorOpen(false)}
            aria-label="Đóng danh sách câu hỏi"
          />
          <div className="absolute inset-x-4 bottom-4 max-h-[72vh] overflow-y-auto rounded-[26px] border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#101827]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Danh sách câu hỏi
                </h2>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  {answeredCount}/{questions.length} câu đã trả lời
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavigatorOpen(false)}
                className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600 dark:bg-white/10 dark:text-white"
              >
                Đóng
              </button>
            </div>
            <div className="mt-5 grid grid-cols-6 gap-2 sm:grid-cols-8">
              {questions.map((question, index) => {
                const active = index === currentQuestionIndex;
                const answered = isQuestionAnswered(question);
                return (
                  <button
                    key={question.id ?? index}
                    type="button"
                    onClick={() => goToQuestion(index)}
                    className={`relative flex h-11 items-center justify-center rounded-xl border text-sm font-black ${active ? 'border-blue-600 bg-blue-600 text-white' : answered ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'}`}
                  >
                    {index + 1}
                    {flaggedQuestions.has(question.id) && (
                      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ExamRoom;

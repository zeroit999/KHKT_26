import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  Camera,
  CalendarClock,
  ClipboardX,
  FileText,
  GraduationCap,
  Loader2,
  MonitorUp,
  MousePointer2,
  ScanEye,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  UsersRound,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import DarkModeSelect from './DarkModeSelect.jsx';
import DateTimePicker from './DateTimePicker.jsx';
import RichEditor from './RichEditor.jsx';

import { parseWordExamApi } from '../../api/examApi';
import {
  LEGACY_PROCTORING_CONFIG,
  PROCTORING_SETTING_ITEMS,
  STRICT_PROCTORING_CONFIG,
  normalizeProctoringConfig,
} from '../../utils/proctoringConfig.js';

import {
  addMinutesToDateTime,
  createDefaultAnswers,
  createDefaultQuestion,
  getCodeNumberFromExam,
  getExamCode,
  normalizeSubject,
} from '../../utils/examHelpers';

const questionTypes = [
  { value: 'multiple', label: 'Trắc nghiệm A/B/C/D' },
  { value: 'truefalse', label: 'Đúng/Sai 4 ý' },
  { value: 'short-answer', label: 'Trả lời ngắn' },
  { value: 'code', label: 'Lập trình / Code' },
];

const defaultScoring = {
  part1: {
    perQuestion: '',
  },
  part2: {
    oneCorrect: '',
    twoCorrect: '',
    threeCorrect: '',
    fourCorrect: '',
  },
  part3: {
    perQuestion: '',
  },
};

const proctoringIcons = {
  requireFullscreen: MonitorUp,
  detectTabSwitch: ScanEye,
  detectWindowBlur: ScanEye,
  blockClipboard: ClipboardX,
  blockContextMenu: MousePointer2,
  blockShortcuts: ShieldAlert,
  requireCamera: Camera,
  requireScreenShare: MonitorUp,
  requireEntireScreen: MonitorUp,
  autoSubmit: ShieldAlert,
};

function ProctoringToggle({
  settingKey,
  title,
  description,
  checked,
  onChange,
  disabled,
}) {
  const Icon = proctoringIcons[settingKey] || ShieldCheck;

  return (
    <button
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-start justify-between gap-4 rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
        checked
          ? 'border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10'
          : 'border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900'
      }`}
    >
      <span className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${checked ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-white/10'}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-sm font-black text-slate-900 dark:text-white">
            {title}
          </span>
          <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
            {description}
          </span>
        </span>
      </span>

      <span
        className={`mt-1 flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition ${checked ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-700'}`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : ''}`}
        />
      </span>
    </button>
  );
}

function CreateExamModal({
  open,
  onClose,
  onSave,
  editingExam,
  teacherSubject = 'Toán',
  teacherName = 'GiaoVien',
  availableClasses = [],
}) {
  const fixedTeacherSubject = normalizeSubject(teacherSubject);

  const createQuestionWithSection = (section = 'part1') => ({
    ...createDefaultQuestion(),
    section,
    type:
      section === 'part2'
        ? 'truefalse'
        : section === 'part3'
          ? 'short-answer'
          : 'multiple',
    score: '',
    correctAnswer: '',
  });

  const normalizeQuestions = (questions = []) =>
    questions.map((question) => ({
      ...question,
      section:
        question.section ||
        (question.type === 'truefalse'
          ? 'part2'
          : question.type === 'short-answer' || question.type === 'code'
            ? 'part3'
            : 'part1'),
      score: question.score ?? '',
      correctAnswer: question.correctAnswer ?? '',
    }));

  const [parsingWord, setParsingWord] = useState(false);

  const [form, setForm] = useState({
    title: '',
    subject: fixedTeacherSubject,
    codeNumber: '0001',
    topic: '',
    status: 'public',
    selectedClasses: [],
    selectedGrades: [],
    attemptMode: 'once',
    maxAttempts: 1,
    duration: 45,
    openDate: '',
    closeDate: '',
    shuffleQuestions: false,
    shuffleAnswers: false,
    totalScore: 0,
    scoring: defaultScoring,
    wordFileName: '',
    maxFullscreenViolations: 2,
    proctoring: { ...STRICT_PROCTORING_CONFIG },
    questions: [createQuestionWithSection('part1')],
  });

  const examCodePreview = useMemo(() => {
    return getExamCode(teacherName, fixedTeacherSubject, form.codeNumber);
  }, [teacherName, fixedTeacherSubject, form.codeNumber]);

  const sectionCounts = useMemo(() => {
    const counts = {
      part1: 0,
      part2: 0,
      part3: 0,
    };

    for (const question of form.questions ?? []) {
      const section = question.section || 'part1';
      counts[section] = (counts[section] || 0) + 1;
    }

    return counts;
  }, [form.questions]);

  const part1Total =
    Number(form.scoring.part1.perQuestion || 0) * sectionCounts.part1;
  const part2Total =
    Number(form.scoring.part2.fourCorrect || 0) * sectionCounts.part2;
  const part3Total =
    Number(form.scoring.part3.perQuestion || 0) * sectionCounts.part3;

  const computedTotalScore = Number(
    (part1Total + part2Total + part3Total).toFixed(2)
  );

  const scoreOverLimit = computedTotalScore > 10;

  const openTimeValue = form.openDate ? new Date(form.openDate).getTime() : 0;
  const closeTimeValue = form.closeDate
    ? new Date(form.closeDate).getTime()
    : 0;
  const invalidCloseDate = Boolean(
    form.openDate &&
    form.closeDate &&
    !Number.isNaN(openTimeValue) &&
    !Number.isNaN(closeTimeValue) &&
    closeTimeValue <= openTimeValue
  );

  const getValidCloseDate = (openDate, duration = 45, closeDate = '') => {
    if (!openDate) return closeDate || '';

    const fallbackCloseDate = addMinutesToDateTime(openDate, duration || 45);

    if (!closeDate) return fallbackCloseDate;

    const openTime = new Date(openDate).getTime();
    const closeTime = new Date(closeDate).getTime();

    if (Number.isNaN(openTime) || Number.isNaN(closeTime)) {
      return fallbackCloseDate;
    }

    return closeTime > openTime ? closeDate : fallbackCloseDate;
  };

  useEffect(() => {
    if (!open) return;

    if (editingExam) {
      const existingQuestions =
        editingExam.questions?.length > 0
          ? normalizeQuestions(editingExam.questions)
          : [createQuestionWithSection('part1')];

      // Đồng bộ dữ liệu khi mở modal chỉnh sửa là chủ đích của component form.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        id: editingExam.id,
        title: editingExam.title ?? '',
        subject: fixedTeacherSubject,
        codeNumber: getCodeNumberFromExam(editingExam, '0001'),
        topic: editingExam.topic ?? '',
        status: editingExam.status ?? 'public',
        selectedClasses: editingExam.selectedClasses ?? [],
        selectedGrades: editingExam.selectedGrades ?? [],
        attemptMode: editingExam.attemptMode ?? 'once',
        maxAttempts: Number(editingExam.maxAttempts || 1),
        duration: Number(editingExam.duration || 45),
        openDate: editingExam.openDate ?? '',
        closeDate: getValidCloseDate(
          editingExam.openDate ?? '',
          Number(editingExam.duration || 45),
          editingExam.closeDate ?? ''
        ),
        shuffleQuestions: Boolean(editingExam.shuffleQuestions),
        shuffleAnswers: Boolean(editingExam.shuffleAnswers),
        totalScore: Number(editingExam.totalScore || 0),
        scoring: {
          ...defaultScoring,
          ...(editingExam.scoring ?? {}),
          part1: {
            ...defaultScoring.part1,
            ...(editingExam.scoring?.part1 ?? {}),
          },
          part2: {
            ...defaultScoring.part2,
            ...(editingExam.scoring?.part2 ?? {}),
          },
          part3: {
            ...defaultScoring.part3,
            ...(editingExam.scoring?.part3 ?? {}),
          },
        },
        wordFileName: editingExam.wordFileName ?? '',
        maxFullscreenViolations: Number(
          editingExam.maxFullscreenViolations ?? 2
        ),
        proctoring: normalizeProctoringConfig(
          editingExam,
          LEGACY_PROCTORING_CONFIG
        ),
        questions: existingQuestions,
      });
    } else {
      setForm({
        title: '',
        subject: fixedTeacherSubject,
        codeNumber: String(Date.now()).slice(-4),
        topic: '',
        status: 'public',
        selectedClasses: [],
        selectedGrades: [],
        attemptMode: 'once',
        maxAttempts: 1,
        duration: 45,
        openDate: '',
        closeDate: '',
        shuffleQuestions: false,
        shuffleAnswers: false,
        totalScore: 0,
        scoring: defaultScoring,
        wordFileName: '',
        maxFullscreenViolations: 2,
        proctoring: { ...STRICT_PROCTORING_CONFIG },
        questions: [createQuestionWithSection('part1')],
      });
    }
  }, [open, editingExam, fixedTeacherSubject]);

  if (!open) return null;

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateScoring = (part, key, value) => {
    setForm((prev) => ({
      ...prev,
      scoring: {
        ...prev.scoring,
        [part]: {
          ...prev.scoring[part],
          [key]: value,
        },
      },
    }));
  };

  const updateProctoring = (key, value) => {
    setForm((prev) => {
      const nextProctoring = {
        ...prev.proctoring,
        [key]: value,
      };
      if (key === 'requireCamera' && !value) {
        nextProctoring.captureCameraEvidence = false;
      }
      if (key === 'requireMicrophone' && !value) {
        nextProctoring.detectVoiceActivity = false;
      }
      if (key === 'requireScreenShare' && !value) {
        nextProctoring.requireEntireScreen = false;
        nextProctoring.captureScreenEvidence = false;
      }
      return {
        ...prev,
        proctoring: nextProctoring,
      };
    });
  };

  const updateQuestion = (questionIndex, key, value) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question, index) =>
        index === questionIndex ? { ...question, [key]: value } : question
      ),
    }));
  };

  const updateQuestionType = (questionIndex, type) => {
    const section =
      type === 'truefalse'
        ? 'part2'
        : type === 'short-answer' || type === 'code'
          ? 'part3'
          : 'part1';

    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question, index) =>
        index === questionIndex
          ? {
              ...question,
              type,
              section,
              answers:
                type === 'multiple' || type === 'truefalse'
                  ? question.answers?.length
                    ? question.answers
                    : createDefaultAnswers()
                  : [],
            }
          : question
      ),
    }));
  };

  const updateAnswer = (questionIndex, answerIndex, key, value) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question, index) => {
        if (index !== questionIndex) return question;

        return {
          ...question,
          answers: question.answers.map((answer, currentAnswerIndex) =>
            currentAnswerIndex === answerIndex
              ? { ...answer, [key]: value }
              : answer
          ),
        };
      }),
    }));
  };

  const setCorrectAnswer = (questionIndex, answerIndex) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question, index) => {
        if (index !== questionIndex) return question;

        return {
          ...question,
          answers: question.answers.map((answer, currentAnswerIndex) => ({
            ...answer,
            isCorrect: currentAnswerIndex === answerIndex,
          })),
        };
      }),
    }));
  };

  const toggleTrueFalseAnswer = (questionIndex, answerIndex, value) => {
    updateAnswer(questionIndex, answerIndex, 'isCorrect', value);
  };

  const addQuestion = (section = 'part1') => {
    setForm((prev) => ({
      ...prev,
      questions: [...prev.questions, createQuestionWithSection(section)],
    }));
  };

  const removeQuestion = (questionIndex) => {
    setForm((prev) => ({
      ...prev,
      questions:
        prev.questions.length > 1
          ? prev.questions.filter((_, index) => index !== questionIndex)
          : prev.questions,
    }));
  };

  const addAnswer = (questionIndex) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question, index) =>
        index === questionIndex
          ? {
              ...question,
              answers: [
                ...question.answers,
                {
                  id: Date.now().toString(),
                  content: '',
                  isCorrect: false,
                  trueFalse: '',
                },
              ],
            }
          : question
      ),
    }));
  };

  const removeAnswer = (questionIndex, answerIndex) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question, index) => {
        if (index !== questionIndex) return question;

        return {
          ...question,
          answers:
            question.answers.length > 2
              ? question.answers.filter(
                  (_, currentAnswerIndex) => currentAnswerIndex !== answerIndex
                )
              : question.answers,
        };
      }),
    }));
  };

  const toggleClass = (className) => {
    setForm((prev) => {
      const selected = prev.selectedClasses ?? [];

      return {
        ...prev,
        selectedClasses: selected.includes(className)
          ? selected.filter((item) => item !== className)
          : [...selected, className],
      };
    });
  };

  const toggleGrade = (grade) => {
    setForm((prev) => {
      const selected = prev.selectedGrades ?? [];

      return {
        ...prev,
        selectedGrades: selected.includes(grade)
          ? selected.filter((item) => item !== grade)
          : [...selected, grade],
      };
    });
  };

  const handleWordFileChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    updateForm('wordFileName', file.name);

    const formData = new FormData();
    formData.append('file', file);

    try {
      setParsingWord(true);

      const response = await parseWordExamApi(formData);
      const parsedQuestions = response.data?.questions ?? [];

      if (!parsedQuestions.length) {
        toast.error('Không tìm thấy câu hỏi trong file Word');
        return;
      }

      setForm((prev) => ({
        ...prev,
        wordFileName: file.name,
        questions: normalizeQuestions(parsedQuestions),
      }));

      toast.success(`Đã nhập ${parsedQuestions.length} câu hỏi từ file Word`);
    } catch (error) {
      console.error(error);

      toast.error(
        error?.response?.data?.message ||
          error.message ||
          'Không thể đọc file Word'
      );
    } finally {
      setParsingWord(false);
      event.target.value = '';
    }
  };

  const handleSubmit = () => {
    if (!form.title.trim()) {
      alert('Vui lòng nhập tên bài thi');
      return;
    }

    if (!form.questions.length) {
      alert('Vui lòng thêm ít nhất 1 câu hỏi');
      return;
    }

    const emptyQuestionIndex = form.questions.findIndex(
      (question) =>
        !String(question.question || '')
          .replace(/<[^>]+>/g, '')
          .trim()
    );

    if (emptyQuestionIndex >= 0) {
      alert(`Vui lòng nhập nội dung câu ${emptyQuestionIndex + 1}`);
      return;
    }

    const invalidAnswerIndex = form.questions.findIndex((question) => {
      if (question.type === 'multiple' || question.type === 'truefalse') {
        const answers = question.answers ?? [];
        const requiredAnswerCount = question.type === 'truefalse' ? 4 : 2;
        return (
          answers.length < requiredAnswerCount ||
          answers.some((answer) => !String(answer.content || '').trim()) ||
          (question.type === 'multiple' &&
            !answers.some((answer) => answer.isCorrect))
        );
      }

      return (
        question.type === 'short-answer' &&
        !String(question.correctAnswer || '').trim()
      );
    });

    if (invalidAnswerIndex >= 0) {
      alert(`Vui lòng nhập đầy đủ đáp án cho câu ${invalidAnswerIndex + 1}`);
      return;
    }

    if (form.status === 'public' && !(form.selectedGrades ?? []).length) {
      alert('Bài thi công khai bắt buộc phải chọn ít nhất 1 khối');
      return;
    }

    if (form.status === 'private' && !(form.selectedClasses ?? []).length) {
      alert('Bài thi riêng tư bắt buộc phải chọn ít nhất 1 lớp');
      return;
    }

    if (!form.openDate) {
      alert('Vui lòng chọn thời gian mở bài thi');
      return;
    }

    if (!form.closeDate) {
      alert('Vui lòng chọn thời gian đóng bài thi');
      return;
    }

    if (invalidCloseDate) {
      alert('Thời gian đóng phải sau thời gian mở');
      return;
    }

    if (computedTotalScore <= 0) {
      alert('Vui lòng nhập điểm cho từng phần');
      return;
    }

    if (scoreOverLimit) {
      alert('Tổng điểm đang vượt quá 10. Vui lòng điều chỉnh điểm từng phần.');
      return;
    }

    const questionsWithScore = form.questions.map((question) => ({
      ...question,
      score: 0,
    }));

    onSave({
      ...form,
      code: examCodePreview,
      questions: questionsWithScore,
      subject: fixedTeacherSubject,
      selectedGrades: form.selectedGrades ?? [],
      selectedClasses: form.selectedClasses ?? [],
      maxAttempts: Number(form.maxAttempts || 1),
      duration: Number(form.duration || 45),
      totalScore: computedTotalScore,
      scoring: {
        part1: {
          perQuestion: Number(form.scoring.part1.perQuestion || 0),
        },
        part2: {
          oneCorrect: Number(form.scoring.part2.oneCorrect || 0),
          twoCorrect: Number(form.scoring.part2.twoCorrect || 0),
          threeCorrect: Number(form.scoring.part2.threeCorrect || 0),
          fourCorrect: Number(form.scoring.part2.fourCorrect || 0),
        },
        part3: {
          perQuestion: Number(form.scoring.part3.perQuestion || 0),
        },
      },
      maxFullscreenViolations: Number(form.proctoring?.maxViolations ?? 2),
      proctoring: normalizeProctoringConfig(
        form.proctoring,
        STRICT_PROCTORING_CONFIG
      ),
    });
  };

  const renderScoreSettings = () => (
    <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200">
              <BookOpenCheck className="h-5 w-5" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">
                Cấu hình chấm điểm theo cấu trúc đề
              </h3>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                Thiết lập điểm cho từng phần; phần tự luận không còn dùng điểm
                riêng.
              </p>
            </div>
          </div>
        </div>

        <div
          className={`rounded-2xl px-4 py-3 text-sm font-black ${
            scoreOverLimit
              ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200'
          }`}
        >
          Tổng điểm: {computedTotalScore}/10
        </div>
      </div>

      {scoreOverLimit && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 dark:bg-red-500/10 dark:text-red-200">
          <AlertTriangle className="h-5 w-5" />
          Tổng điểm vượt quá 10. Hệ thống sẽ không cho tạo/cập nhật đề.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 dark:bg-slate-900">
          <p className="font-black text-slate-900 dark:text-white">
            Phần 1: A/B/C/D
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {sectionCounts.part1} câu
          </p>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.scoring.part1.perQuestion}
            onChange={(event) =>
              updateScoring('part1', 'perQuestion', event.target.value)
            }
            className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
            placeholder="Điểm mỗi câu"
          />
          <p className="mt-2 text-xs font-bold text-blue-600">
            Tổng phần 1: {Number(part1Total.toFixed(2))}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 dark:bg-slate-900">
          <p className="font-black text-slate-900 dark:text-white">
            Phần 2: Đúng/Sai 4 ý
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {sectionCounts.part2} câu • tính tối đa theo 4 ý đúng
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              ['oneCorrect', 'Đúng 1 ý'],
              ['twoCorrect', 'Đúng 2 ý'],
              ['threeCorrect', 'Đúng 3 ý'],
              ['fourCorrect', 'Đúng 4 ý'],
            ].map(([key, label]) => (
              <input
                key={key}
                type="number"
                min={0}
                step="0.01"
                value={form.scoring.part2[key]}
                onChange={(event) =>
                  updateScoring('part2', key, event.target.value)
                }
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                placeholder={label}
              />
            ))}
          </div>

          <p className="mt-2 text-xs font-bold text-blue-600">
            Tổng phần 2 tối đa: {Number(part2Total.toFixed(2))}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 dark:bg-slate-900">
          <p className="font-black text-slate-900 dark:text-white">
            Phần 3: Trả lời ngắn
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {sectionCounts.part3} câu
          </p>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.scoring.part3.perQuestion}
            onChange={(event) =>
              updateScoring('part3', 'perQuestion', event.target.value)
            }
            className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
            placeholder="Điểm mỗi câu"
          />
          <p className="mt-2 text-xs font-bold text-blue-600">
            Tổng phần 3: {Number(part3Total.toFixed(2))}
          </p>
        </div>
      </div>
    </div>
  );

  const renderQuestion = (question, questionIndex) => {
    const type = question.type ?? 'multiple';

    return (
      <div
        key={question.id ?? questionIndex}
        className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-blue-600">
              Câu {questionIndex + 1}
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-500">
              {question.section === 'part1'
                ? 'Phần 1'
                : question.section === 'part2'
                  ? 'Phần 2'
                  : 'Phần 3'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => removeQuestion(questionIndex)}
            className="rounded-xl bg-red-100 p-2 text-red-600 transition hover:bg-red-200 dark:bg-red-500/20 dark:text-red-200"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
            Loại câu hỏi
          </label>

          <DarkModeSelect
            value={type}
            onChange={(value) => updateQuestionType(questionIndex, value)}
            options={questionTypes}
          />
        </div>

        <RichEditor
          label="Nội dung câu hỏi"
          value={question.question ?? ''}
          onChange={(value) => updateQuestion(questionIndex, 'question', value)}
          rows={5}
        />

        {type === 'short-answer' && (
          <div className="mt-4">
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
              Đáp án trả lời ngắn
            </label>
            <input
              value={question.correctAnswer ?? ''}
              onChange={(event) =>
                updateQuestion(
                  questionIndex,
                  'correctAnswer',
                  event.target.value
                )
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              placeholder="Nhập đáp án đúng"
            />
          </div>
        )}

        {(type === 'short-answer' || type === 'essay' || type === 'code') && (
          <div className="mt-4">
            <RichEditor
              label="Gợi ý / hướng dẫn chấm"
              value={question.explanation ?? ''}
              onChange={(value) =>
                updateQuestion(questionIndex, 'explanation', value)
              }
            />
          </div>
        )}

        {type === 'multiple' && (
          <div className="mt-4 space-y-3">
            {(question.answers ?? createDefaultAnswers()).map(
              (answer, answerIndex) => (
                <div
                  key={answer.id ?? answerIndex}
                  className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900 lg:grid-cols-[auto_1fr_auto_auto]"
                >
                  <button
                    type="button"
                    onClick={() => setCorrectAnswer(questionIndex, answerIndex)}
                    className={`h-10 w-10 rounded-xl text-sm font-black ${
                      answer.isCorrect
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white'
                    }`}
                  >
                    {String.fromCharCode(65 + answerIndex)}
                  </button>

                  <input
                    value={answer.content ?? ''}
                    onChange={(event) =>
                      updateAnswer(
                        questionIndex,
                        answerIndex,
                        'content',
                        event.target.value
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                    placeholder={`Đáp án ${String.fromCharCode(65 + answerIndex)}`}
                  />

                  <span className="flex items-center text-xs font-black text-slate-500">
                    {answer.isCorrect ? 'Đáp án đúng' : 'Đáp án sai'}
                  </span>

                  <button
                    type="button"
                    onClick={() => removeAnswer(questionIndex, answerIndex)}
                    className="rounded-xl bg-red-100 px-3 py-2 text-xs font-black text-red-600 transition hover:bg-red-200 dark:bg-red-500/20 dark:text-red-200"
                  >
                    Xóa
                  </button>
                </div>
              )
            )}

            <button
              type="button"
              onClick={() => addAnswer(questionIndex)}
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
            >
              + Thêm đáp án
            </button>

            <RichEditor
              label="Giải thích đáp án"
              value={question.explanation ?? ''}
              onChange={(value) =>
                updateQuestion(questionIndex, 'explanation', value)
              }
            />
          </div>
        )}

        {type === 'truefalse' && (
          <div className="mt-4 space-y-3">
            {(question.answers ?? createDefaultAnswers())
              .slice(0, 4)
              .map((answer, answerIndex) => (
                <div
                  key={answer.id ?? answerIndex}
                  className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900 lg:grid-cols-[auto_1fr_auto]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-600 dark:bg-white/10 dark:text-white">
                    {String.fromCharCode(97 + answerIndex)})
                  </div>

                  <input
                    value={answer.content ?? ''}
                    onChange={(event) =>
                      updateAnswer(
                        questionIndex,
                        answerIndex,
                        'content',
                        event.target.value
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                    placeholder={`Ý ${answerIndex + 1}`}
                  />

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        toggleTrueFalseAnswer(questionIndex, answerIndex, true)
                      }
                      className={`rounded-xl px-3 py-2 text-xs font-black ${
                        answer.isCorrect
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white'
                      }`}
                    >
                      Đúng
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        toggleTrueFalseAnswer(questionIndex, answerIndex, false)
                      }
                      className={`rounded-xl px-3 py-2 text-xs font-black ${
                        !answer.isCorrect
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white'
                      }`}
                    >
                      Sai
                    </button>
                  </div>
                </div>
              ))}

            <RichEditor
              label="Giải thích đáp án"
              value={question.explanation ?? ''}
              onChange={(value) =>
                updateQuestion(questionIndex, 'explanation', value)
              }
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-950"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
              {editingExam ? 'Cập nhật bài thi' : 'Tạo bài thi'}
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
              {editingExam ? 'Sửa bài thi' : 'Tạo bài thi mới'}
            </h2>

            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">
              Giáo viên: {teacherName}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-200">
              <FileText className="h-5 w-5" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">
                Thông tin định danh bài thi
              </h3>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                Nhập tên bài, chủ đề và mã đề theo đúng quy ước hệ thống.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
                Tên bài thi
              </label>
              <input
                value={form.title}
                onChange={(event) => updateForm('title', event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                placeholder="Nhập tên bài thi..."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
                Môn thi theo chuyên môn giáo viên
              </label>
              <input
                value={fixedTeacherSubject}
                disabled
                className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 outline-none dark:border-white/10 dark:bg-white/10 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
                Mã đề do giáo viên nhập
              </label>
              <input
                value={form.codeNumber}
                onChange={(event) =>
                  updateForm('codeNumber', event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                placeholder="Ví dụ: 001"
              />
              <p className="mt-2 text-xs font-semibold text-slate-500">
                Mã bài thi hoàn chỉnh:{' '}
                <span className="font-black text-blue-600">
                  {examCodePreview}
                </span>
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
                Chủ đề
              </label>
              <input
                value={form.topic}
                onChange={(event) => updateForm('topic', event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                placeholder="Nhập chủ đề..."
              />
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
              <ShieldCheck className="h-5 w-5" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">
                1. Phạm vi hiển thị bài thi
              </h3>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                Chọn cách mở bài thi trước, sau đó chọn khối hoặc lớp được phép
                nhìn thấy bài thi.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
                Chế độ hiển thị
              </label>
              <DarkModeSelect
                value={form.status}
                onChange={(value) => updateForm('status', value)}
                options={[
                  { value: 'public', label: 'Công khai theo khối' },
                  { value: 'private', label: 'Riêng tư theo lớp' },
                ]}
              />
              <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                Công khai: học sinh cùng khối sẽ thấy bài thi. Riêng tư: chỉ lớp
                được chọn thấy bài thi.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 dark:bg-slate-900">
              <p className="text-sm font-black text-slate-900 dark:text-white">
                Tóm tắt phạm vi
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-300">
                {form.status === 'public'
                  ? `Đã chọn ${(form.selectedGrades ?? []).length} khối`
                  : `Đã chọn ${(form.selectedClasses ?? []).length} lớp`}
              </p>
            </div>
          </div>

          {form.status === 'public' && (
            <div className="mt-5 rounded-3xl border border-blue-100 bg-blue-50 p-5 dark:border-blue-500/20 dark:bg-blue-500/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
                    <GraduationCap className="h-5 w-5" />
                  </div>

                  <div>
                    <h4 className="text-lg font-black text-slate-950 dark:text-white">
                      Chọn khối học sinh
                    </h4>
                    <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">
                      Bắt buộc chọn ít nhất 1 khối để học sinh nhìn thấy bài thi
                      công khai.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white">
                  Đã chọn: {(form.selectedGrades ?? []).length} khối
                </div>
              </div>

              {!(form.selectedGrades ?? []).length && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  Bài thi công khai chưa chọn khối nên học sinh sẽ không thấy
                  bài thi.
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                {['10', '11', '12'].map((grade) => {
                  const selected = (form.selectedGrades ?? []).includes(grade);

                  return (
                    <button
                      key={grade}
                      type="button"
                      onClick={() => toggleGrade(grade)}
                      className={`rounded-2xl border px-6 py-3 text-sm font-black transition-all ${
                        selected
                          ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:hover:bg-white/10'
                      }`}
                    >
                      Khối {grade}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {form.status === 'private' && (
            <div className="mt-5 rounded-3xl border border-violet-100 bg-violet-50 p-5 dark:border-violet-500/20 dark:bg-violet-500/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-500/20">
                    <UsersRound className="h-5 w-5" />
                  </div>

                  <div>
                    <h4 className="text-lg font-black text-slate-950 dark:text-white">
                      Chọn lớp làm bài
                    </h4>
                    <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">
                      Dữ liệu lớp lấy từ Quản lý lớp học. Bắt buộc chọn ít nhất
                      1 lớp.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-violet-600 px-4 py-2 text-sm font-black text-white">
                  Đã chọn: {(form.selectedClasses ?? []).length} lớp
                </div>
              </div>

              {!(form.selectedClasses ?? []).length && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  Bài thi riêng tư chưa chọn lớp nên học sinh sẽ không thấy bài
                  thi.
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                {availableClasses.length > 0 ? (
                  availableClasses.map((classItem) => {
                    const className =
                      typeof classItem === 'string'
                        ? classItem
                        : classItem.name ||
                          classItem.className ||
                          classItem.title ||
                          classItem.id ||
                          'Lớp';

                    const selected = (form.selectedClasses ?? []).includes(
                      className
                    );

                    return (
                      <button
                        key={className}
                        type="button"
                        onClick={() => toggleClass(className)}
                        className={`rounded-2xl border px-5 py-3 text-sm font-black transition-all ${
                          selected
                            ? 'border-violet-600 bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                            : 'border-slate-300 bg-white text-slate-700 hover:border-violet-400 hover:bg-violet-50 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:hover:bg-white/10'
                        }`}
                      >
                        {className}
                      </button>
                    );
                  })
                ) : (
                  <div className="w-full rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-bold text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400">
                    Chưa có lớp học nào trong hệ thống
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-200">
              <CalendarClock className="h-5 w-5" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">
                2. Thời gian và quy định làm bài
              </h3>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                Thiết lập lịch mở, lịch đóng, thời lượng, số lượt làm và giới
                hạn thoát toàn màn hình.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
                Thời gian mở
              </label>
              <DateTimePicker
                value={form.openDate}
                onChange={(value) => {
                  updateForm('openDate', value);
                  updateForm(
                    'closeDate',
                    addMinutesToDateTime(value, form.duration)
                  );
                }}
                hasError={Boolean(!form.openDate && form.closeDate)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
                Thời gian đóng
              </label>
              <DateTimePicker
                value={form.closeDate}
                min={form.openDate || undefined}
                onChange={(value) => updateForm('closeDate', value)}
                hasError={invalidCloseDate}
              />
              {invalidCloseDate && (
                <p className="mt-2 text-xs font-black text-red-600 dark:text-red-300">
                  Thời gian đóng phải sau thời gian mở.
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
                Thời lượng phút
              </label>
              <input
                type="number"
                min={1}
                value={form.duration}
                onChange={(event) => {
                  const duration = Number(event.target.value || 45);
                  updateForm('duration', duration);

                  if (form.openDate) {
                    updateForm(
                      'closeDate',
                      addMinutesToDateTime(form.openDate, duration)
                    );
                  }
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
                Số lượt làm
              </label>
              <DarkModeSelect
                value={form.attemptMode}
                onChange={(value) => {
                  updateForm('attemptMode', value);
                  if (value === 'once') updateForm('maxAttempts', 1);
                }}
                options={[
                  { value: 'once', label: 'Chỉ 1 lần' },
                  { value: 'multiple', label: 'Nhiều lần' },
                ]}
              />

              {form.attemptMode === 'multiple' && (
                <input
                  type="number"
                  min={1}
                  value={form.maxAttempts}
                  onChange={(event) =>
                    updateForm('maxAttempts', Number(event.target.value || 1))
                  }
                  className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
                Ngưỡng tổng vi phạm
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={form.proctoring?.maxViolations ?? 3}
                onChange={(event) =>
                  updateProctoring(
                    'maxViolations',
                    Number(event.target.value || 1)
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-red-200 bg-gradient-to-br from-red-50 to-orange-50 p-5 dark:border-red-500/20 dark:from-red-500/10 dark:to-orange-500/5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-500/20">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-950 dark:text-white">
                  Giám sát phòng thi nghiêm ngặt
                </h3>
                <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                  Mỗi đề có cấu hình riêng. Camera, microphone và chia sẻ màn
                  hình luôn yêu cầu học sinh đồng ý trước khi bắt đầu.
                </p>
              </div>
            </div>

            <button
              type="button"
              aria-pressed={Boolean(form.proctoring?.enabled)}
              onClick={() =>
                updateProctoring('enabled', !form.proctoring?.enabled)
              }
              className={`rounded-2xl px-5 py-3 text-sm font-black transition ${
                form.proctoring?.enabled
                  ? 'bg-red-600 text-white shadow-lg shadow-red-500/20'
                  : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300'
              }`}
            >
              {form.proctoring?.enabled
                ? 'Đang bật giám sát'
                : 'Đã tắt giám sát'}
            </button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {PROCTORING_SETTING_ITEMS.map(
              ([settingKey, title, description]) => (
                <ProctoringToggle
                  key={settingKey}
                  settingKey={settingKey}
                  title={title}
                  description={description}
                  checked={Boolean(form.proctoring?.[settingKey])}
                  disabled={
                    !form.proctoring?.enabled ||
                    (settingKey === 'requireEntireScreen' &&
                      !form.proctoring?.requireScreenShare) ||
                    (settingKey === 'detectVoiceActivity' &&
                      !form.proctoring?.requireMicrophone) ||
                    (settingKey === 'captureCameraEvidence' &&
                      !form.proctoring?.requireCamera) ||
                    (settingKey === 'captureScreenEvidence' &&
                      !form.proctoring?.requireScreenShare)
                  }
                  onChange={(value) => updateProctoring(settingKey, value)}
                />
              )
            )}
          </div>

          <div className="mt-4 grid gap-4 rounded-2xl border border-red-200 bg-white/80 p-4 sm:grid-cols-2 dark:border-red-500/20 dark:bg-slate-950/50">
            <div>
              <label className="text-sm font-black text-slate-800 dark:text-slate-100">
                Tự nộp sau số vi phạm
              </label>
              <input
                type="number"
                min={1}
                max={20}
                disabled={!form.proctoring?.enabled}
                value={form.proctoring?.maxViolations ?? 3}
                onChange={(event) =>
                  updateProctoring(
                    'maxViolations',
                    Number(event.target.value || 1)
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-red-500 disabled:opacity-50 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-sm font-black text-slate-800 dark:text-slate-100">
                Chu kỳ kiểm tra thiết bị
              </label>
              <DarkModeSelect
                value={String(form.proctoring?.heartbeatSeconds ?? 30)}
                onChange={(value) =>
                  updateProctoring('heartbeatSeconds', Number(value))
                }
                options={[
                  { value: '15', label: '15 giây (rất nghiêm)' },
                  { value: '30', label: '30 giây' },
                  { value: '60', label: '60 giây' },
                ]}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-200">
              <Upload className="h-5 w-5" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">
                3. Tệp đề thi và định dạng nhập liệu
              </h3>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                Có thể nhập câu hỏi thủ công hoặc tải file Word theo mẫu.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_auto]">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">
                File Word đề thi
              </label>

              <label
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 text-sm font-black transition ${
                  parsingWord
                    ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
                    : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200'
                }`}
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  {parsingWord ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                  ) : (
                    <Upload className="h-5 w-5 shrink-0" />
                  )}

                  <span className="truncate">
                    {parsingWord
                      ? 'Đang đọc file Word...'
                      : form.wordFileName || 'Chọn file .docx'}
                  </span>
                </span>

                <input
                  type="file"
                  accept=".docx"
                  onChange={handleWordFileChange}
                  className="hidden"
                  disabled={parsingWord}
                />
              </label>

              {form.wordFileName && (
                <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <FileText className="h-4 w-4" />
                  {form.wordFileName}
                </p>
              )}
            </div>

            <div className="flex items-end">
              <a
                href="/De Mau Trac Nghiem Online - DoanVan.docx"
                download
                className="inline-flex h-[48px] items-center justify-center gap-2 rounded-xl bg-slate-100 px-5 text-sm font-black text-slate-700 transition hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              >
                <FileText className="h-4 w-4" />
                Format đề thi
              </a>
            </div>
          </div>
        </div>
        {renderScoreSettings()}

        <div className="mt-6 space-y-5">
          <div className="sticky top-0 z-20 -mx-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-white/10 dark:bg-slate-950/95">
            <div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">
                Câu hỏi
              </h3>

              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                {form.questions.length} câu • Tổng điểm: {computedTotalScore}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => addQuestion('part1')}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white"
              >
                + Phần 1
              </button>

              <button
                type="button"
                onClick={() => addQuestion('part2')}
                className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white"
              >
                + Phần 2
              </button>

              <button
                type="button"
                onClick={() => addQuestion('part3')}
                className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white"
              >
                + Phần 3
              </button>
            </div>
          </div>

          {form.questions.map(renderQuestion)}
        </div>

        <div className="sticky bottom-0 z-30 -mx-6 mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white/95 px-6 py-5 backdrop-blur dark:border-white/10 dark:bg-slate-950/95 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={parsingWord || scoreOverLimit || invalidCloseDate}
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {editingExam ? 'Cập nhật bài thi' : 'Tạo bài thi'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateExamModal;

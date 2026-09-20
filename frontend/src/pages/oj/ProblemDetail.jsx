import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  Link,
  useParams,
} from 'react-router-dom'

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Code2,
  Copy,
  FileText,
  Gauge,
  LoaderCircle,
  MemoryStick,
  RotateCcw,
  Send,
  Terminal,
  XCircle,
} from 'lucide-react'

import Editor from '@monaco-editor/react'

import ojApi from '../../services/ojApi'


const MONACO_LANGUAGE = {
  CPP23: 'cpp',
  PYTHON314: 'python',
  JAVA21: 'java',
}


const defineDraculaTheme = (monaco) => {
  monaco.editor.defineTheme(
    'zuny-dracula',
    {
      base: 'vs-dark',
      inherit: true,

      rules: [
        {
          token: 'comment',
          foreground: '6272A4',
          fontStyle: 'italic',
        },
        {
          token: 'keyword',
          foreground: 'FF79C6',
        },
        {
          token: 'keyword.control',
          foreground: 'FF79C6',
        },
        {
          token: 'string',
          foreground: 'F1FA8C',
        },
        {
          token: 'string.escape',
          foreground: 'FF79C6',
        },
        {
          token: 'number',
          foreground: 'BD93F9',
        },
        {
          token: 'type',
          foreground: '8BE9FD',
          fontStyle: 'italic',
        },
        {
          token: 'type.identifier',
          foreground: '8BE9FD',
        },
        {
          token: 'identifier',
          foreground: 'F8F8F2',
        },
        {
          token: 'delimiter',
          foreground: 'F8F8F2',
        },
      ],

      colors: {
        'editor.background': '#282A36',
        'editor.foreground': '#F8F8F2',

        'editorLineNumber.foreground': '#6272A4',
        'editorLineNumber.activeForeground': '#F8F8F2',

        'editorCursor.foreground': '#F8F8F0',

        'editor.selectionBackground': '#44475A',
        'editor.inactiveSelectionBackground': '#3A3C4E',

        'editor.lineHighlightBackground': '#44475A55',

        'editorIndentGuide.background1': '#44475A',
        'editorIndentGuide.activeBackground1': '#6272A4',

        'editorBracketMatch.background': '#44475A',
        'editorBracketMatch.border': '#50FA7B',

        'editorGutter.background': '#282A36',

        'editorWhitespace.foreground': '#44475A',

        'editorOverviewRuler.border': '#00000000',

        'scrollbarSlider.background': '#6272A455',
        'scrollbarSlider.hoverBackground': '#6272A488',
        'scrollbarSlider.activeBackground': '#6272A4AA',
      },
    },
  )
}


const languageConfig = {
  CPP23: {
    label: 'C++23',
    code: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // Viết lời giải tại đây.

    return 0;
}
`,
  },

  PYTHON314: {
    label: 'Python 3.14',
    code: `# Viết lời giải tại đây.
`,
  },

  JAVA21: {
    label: 'Java 21',
    code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        // Viết lời giải tại đây.
    }
}
`,
  },
}


const POLL_INTERVAL_MS = 1_000
const POLL_TIMEOUT_MS = 45_000

const pendingVerdicts = new Set([
  'PENDING',
  'JUDGING',
])


const difficultyLabels = {
  EASY: 'Dễ',
  MEDIUM: 'Trung bình',
  HARD: 'Khó',
}


function difficultyClass(
  difficulty,
) {
  if (difficulty === 'EASY') {
    return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
  }

  if (difficulty === 'MEDIUM') {
    return 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
  }

  return 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
}


function SectionTitle({
  children,
}) {
  return (
    <h2 className="mb-3 text-[15px] font-black text-slate-900 dark:text-white">
      {children}
    </h2>
  )
}


function CodeBox({
  children,
}) {
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-[13px] font-medium leading-6 text-slate-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-200">
      {children}
    </pre>
  )
}


function Verdict({
  submission,
}) {
  if (!submission) {
    return null
  }

  const verdict =
    submission.verdict

  const accepted =
    verdict === 'AC'

  const pending =
    verdict === 'PENDING'
    || verdict === 'JUDGING'

  return (
    <div
      className={
        `mt-4 rounded-xl border p-4 ${
          accepted
            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10'
            : pending
              ? 'border-violet-200 bg-violet-50 dark:border-violet-500/20 dark:bg-violet-500/10'
              : 'border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10'
        }`
      }
    >
      <div className="flex items-center gap-2">
        {accepted ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : pending ? (
          <LoaderCircle className="h-5 w-5 animate-spin text-violet-500" />
        ) : (
          <XCircle className="h-5 w-5 text-red-500" />
        )}

        <span className="text-sm font-black">
          {verdict}
        </span>
      </div>

      {pending && (
        <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          Bài đã được đưa vào hàng chờ
          chấm của ZUNY.
        </p>
      )}

      {submission.judgeMessage && (
        <p className="mt-2 text-xs font-semibold">
          {submission.judgeMessage}
        </p>
      )}
    </div>
  )
}


export default function ProblemDetail() {
  const { id } = useParams()

  const problemId =
    String(id || '').trim()

  const [
    problem,
    setProblem,
  ] = useState(null)

  const [
    availableLanguages,
    setAvailableLanguages,
  ] = useState([])

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    error,
    setError,
  ] = useState('')

  const [
    language,
    setLanguage,
  ] = useState('CPP23')

  const [
    code,
    setCode,
  ] = useState(
    languageConfig.CPP23.code,
  )

  const [
    sourceBuffers,
    setSourceBuffers,
  ] = useState(() => ({
    CPP23: languageConfig.CPP23.code,
    PYTHON314:
      languageConfig.PYTHON314.code,
    JAVA21: languageConfig.JAVA21.code,
  }))

  const [
    submitting,
    setSubmitting,
  ] = useState(false)

  const [
    submission,
    setSubmission,
  ] = useState(null)

  const pollingGenerationRef =
    useRef(0)

  const pollingTimerRef =
    useRef(null)


  const stopSubmissionPolling = () => {
    pollingGenerationRef.current += 1

    if (pollingTimerRef.current) {
      clearTimeout(
        pollingTimerRef.current,
      )

      pollingTimerRef.current = null
    }
  }


  useEffect(() => {
    let active = true

    stopSubmissionPolling()

    const loadProblem = async () => {
      setLoading(true)
      setError('')

      try {
        const data =
          await ojApi.getProblem(
            problemId,
          )

        if (!active) {
          return
        }

        setProblem(
          data?.problem || null,
        )

        const languages =
          Array.isArray(data?.languages)
            ? data.languages.filter(
                (item) =>
                  languageConfig[item],
              )
            : []

        setAvailableLanguages(
          languages,
        )

        const firstLanguage =
          languages.includes('CPP23')
            ? 'CPP23'
            : languages[0]
              || 'CPP23'

        const initialBuffers = {
          CPP23:
            languageConfig.CPP23.code,
          PYTHON314:
            languageConfig.PYTHON314.code,
          JAVA21:
            languageConfig.JAVA21.code,
        }

        setSourceBuffers(
          initialBuffers,
        )

        setLanguage(firstLanguage)

        setCode(
          initialBuffers[firstLanguage]
          || '',
        )
      } catch (loadError) {
        if (!active) {
          return
        }

        setError(
          loadError.message
          || 'Không thể tải bài toán.',
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    if (problemId) {
      loadProblem()
    }

    return () => {
      active = false
      stopSubmissionPolling()
    }
  }, [problemId])


  const constraints =
    useMemo(() => {
      if (!problem?.constraints) {
        return []
      }

      return String(
        problem.constraints,
      )
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)
    }, [problem])


  const changeLanguage = (
    event,
  ) => {
    stopSubmissionPolling()

    const nextLanguage =
      event.target.value

    const nextBuffers = {
      ...sourceBuffers,
      [language]: code,
    }

    setSourceBuffers(
      nextBuffers,
    )

    setLanguage(nextLanguage)

    setCode(
      nextBuffers[nextLanguage]
      ?? languageConfig[nextLanguage]
        ?.code
      ?? '',
    )

    setSubmission(null)
    setError('')
  }


  const resetCode = () => {
    stopSubmissionPolling()

    const template =
      languageConfig[language]
        ?.code
      || ''

    setCode(template)

    setSourceBuffers(
      (current) => ({
        ...current,
        [language]: template,
      }),
    )

    setSubmission(null)
  }


  const copyCode = async () => {
    try {
      await navigator.clipboard
        .writeText(code)
    } catch {
      // Clipboard có thể bị chặn.
    }
  }


  const pollSubmission = async (
    submissionId,
  ) => {
    stopSubmissionPolling()

    const generation =
      pollingGenerationRef.current

    const startedAt =
      Date.now()

    const poll = async () => {
      if (
        generation
        !== pollingGenerationRef.current
      ) {
        return
      }

      try {
        const data =
          await ojApi.getSubmission(
            submissionId,
          )

        if (
          generation
          !== pollingGenerationRef.current
        ) {
          return
        }

        const latest =
          data?.submission || null

        if (!latest) {
          throw new Error(
            'Không nhận được trạng thái bài nộp.',
          )
        }

        setSubmission(latest)

        const verdict =
          String(
            latest.verdict || '',
          ).toUpperCase()

        if (
          !pendingVerdicts.has(verdict)
        ) {
          pollingTimerRef.current = null
          return
        }

        if (
          Date.now() - startedAt
          >= POLL_TIMEOUT_MS
        ) {
          pollingTimerRef.current = null

          setError(
            'Bài vẫn đang được chấm. '
            + 'Bạn có thể chờ thêm và nộp lại '
            + 'sau nếu cần.',
          )

          return
        }

        pollingTimerRef.current =
          setTimeout(
            poll,
            POLL_INTERVAL_MS,
          )
      } catch (pollError) {
        if (
          generation
          !== pollingGenerationRef.current
        ) {
          return
        }

        pollingTimerRef.current = null

        setError(
          pollError.message
          || 'Không thể cập nhật trạng thái bài nộp.',
        )
      }
    }

    await poll()
  }


  const submitCode = async () => {
    if (!code.trim()) {
      setError(
        'Source code không được để trống.',
      )

      return
    }

    stopSubmissionPolling()

    setSubmitting(true)
    setSubmission(null)
    setError('')

    try {
      const data =
        await ojApi.submitProblem(
          problemId,
          {
            language,
            sourceCode: code,
          },
        )

      const createdSubmission =
        data?.submission || null

      setSubmission(
        createdSubmission,
      )

      const submissionId =
        createdSubmission?.id

      if (!submissionId) {
        throw new Error(
          'Không nhận được mã bài nộp.',
        )
      }

      const verdict =
        String(
          createdSubmission.verdict || '',
        ).toUpperCase()

      if (
        pendingVerdicts.has(verdict)
      ) {
        void pollSubmission(
          submissionId,
        )
      }
    } catch (submitError) {
      setError(
        submitError.message
        || 'Không thể nộp bài.',
      )
    } finally {
      setSubmitting(false)
    }
  }


  if (loading) {
    return (
      <section className="flex min-h-screen items-center justify-center bg-[#f7f9fc] pt-20 dark:bg-slate-950">
        <div className="text-center">
          <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-violet-500" />

          <p className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-400">
            Đang tải đề bài...
          </p>
        </div>
      </section>
    )
  }


  if (!problem) {
    return (
      <section className="flex min-h-screen items-center justify-center bg-[#f7f9fc] px-4 pt-20 dark:bg-slate-950">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-500" />

          <h1 className="mt-4 text-xl font-black dark:text-white">
            Không thể mở bài toán
          </h1>

          <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            {error
              || 'Không tìm thấy bài lập trình.'}
          </p>

          <Link
            to="/oj"
            className="mt-5 inline-flex rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white"
          >
            Quay lại Online Judge
          </Link>
        </div>
      </section>
    )
  }


  return (
    <section className="min-h-screen bg-[#f7f9fc] pb-8 pt-24 text-slate-950 transition-colors dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-[1600px] px-3 sm:px-4 lg:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/oj"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-violet-300 hover:text-violet-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-black text-violet-500">
                  {problem.id}
                </span>

                <span
                  className={
                    `rounded-lg px-2 py-1 text-[11px] font-black ${
                      difficultyClass(
                        problem.difficulty,
                      )
                    }`
                  }
                >
                  {difficultyLabels[
                    problem.difficulty
                  ]
                    || problem.difficulty}
                </span>
              </div>

              <h1 className="mt-1 truncate text-xl font-black tracking-tight sm:text-2xl">
                {problem.title}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <Clock3 className="h-4 w-4 text-violet-500" />

              {problem.timeLimitMs} ms
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <MemoryStick className="h-4 w-4 text-cyan-500" />

              {problem.memoryLimitMb} MB
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <Gauge className="h-4 w-4 text-amber-500" />

              {problem.points} điểm
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            <AlertCircle className="h-5 w-5 shrink-0" />

            {error}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.09)] dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 dark:border-white/10">
              <FileText className="h-5 w-5 text-violet-500" />

              <span className="text-sm font-black">
                Đề bài
              </span>
            </div>

            <div className="space-y-7 p-5 sm:p-6">
              <section>
                <SectionTitle>
                  Mô tả
                </SectionTitle>

                <p className="whitespace-pre-wrap text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                  {problem.description}
                </p>
              </section>

              <section>
                <SectionTitle>
                  Dữ liệu vào
                </SectionTitle>

                <p className="whitespace-pre-wrap text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                  {problem.inputDescription
                    || 'Không có mô tả.'}
                </p>
              </section>

              <section>
                <SectionTitle>
                  Kết quả
                </SectionTitle>

                <p className="whitespace-pre-wrap text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                  {problem.outputDescription
                    || 'Không có mô tả.'}
                </p>
              </section>

              {constraints.length > 0 && (
                <section>
                  <SectionTitle>
                    Giới hạn
                  </SectionTitle>

                  <div className="space-y-2">
                    {constraints.map(
                      (
                        constraint,
                        index,
                      ) => (
                        <div
                          key={
                            `${index}-${constraint}`
                          }
                          className="rounded-xl bg-violet-50 px-4 py-3 font-mono text-sm font-bold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"
                        >
                          {constraint}
                        </div>
                      ),
                    )}
                  </div>
                </section>
              )}

              <section>
                <SectionTitle>
                  Ví dụ
                </SectionTitle>

                {problem.samples?.length ? (
                  <div className="space-y-4">
                    {problem.samples.map(
                      (
                        sample,
                        index,
                      ) => (
                        <div
                          key={
                            sample.id
                            || index
                          }
                          className="grid gap-3 sm:grid-cols-2"
                        >
                          <div>
                            <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
                              Input
                            </p>

                            <CodeBox>
                              {sample.input}
                            </CodeBox>
                          </div>

                          <div>
                            <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
                              Output
                            </p>

                            <CodeBox>
                              {sample.output}
                            </CodeBox>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Bài này chưa có ví dụ công khai.
                  </p>
                )}
              </section>
            </div>
          </article>

          <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.09)] dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-violet-500" />

                <span className="text-sm font-black">
                  Trình soạn thảo
                </span>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={language}
                  onChange={
                    changeLanguage
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black outline-none dark:border-white/10 dark:bg-slate-900"
                >
                  {availableLanguages.map(
                    (item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {languageConfig[item]
                          ?.label
                          || item}
                      </option>
                    ),
                  )}
                </select>

                <button
                  type="button"
                  onClick={copyCode}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:text-violet-500 dark:border-white/10"
                  title="Sao chép"
                >
                  <Copy className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={resetCode}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:text-violet-500 dark:border-white/10"
                  title="Đặt lại code"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-4">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 dark:border-white/10">
                <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <Code2 className="h-4 w-4" />

                  {languageConfig[language]
                    ?.label
                    || language}
                </div>

                <Editor
                  height="520px"
                  language={
                    MONACO_LANGUAGE[
                      language
                    ] || 'plaintext'
                  }
                  value={code}
                  theme="zuny-dracula"
                  beforeMount={
                    defineDraculaTheme
                  }
                  onChange={(value) => {
                    const nextCode =
                      value || ''

                    setCode(nextCode)

                    setSourceBuffers(
                      (current) => ({
                        ...current,
                        [language]:
                          nextCode,
                      }),
                    )
                  }}
                  options={{
                    automaticLayout: true,

                    fontSize: 14,
                    lineHeight: 22,
                    fontLigatures: true,

                    minimap: {
                      enabled: true,
                    },

                    lineNumbers: 'on',
                    lineNumbersMinChars: 3,

                    scrollBeyondLastLine: false,

                    smoothScrolling: true,

                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation:
                      'on',

                    tabSize: 4,
                    insertSpaces: true,

                    wordWrap: 'off',

                    matchBrackets: 'always',

                    bracketPairColorization: {
                      enabled: true,
                      independentColorPoolPerBracketType:
                        true,
                    },

                    guides: {
                      bracketPairs: true,
                      bracketPairsHorizontal:
                        true,
                      highlightActiveBracketPair:
                        true,
                      indentation: true,
                      highlightActiveIndentation:
                        true,
                    },

                    renderWhitespace:
                      'selection',

                    padding: {
                      top: 14,
                      bottom: 14,
                    },

                    suggest: {
                      showKeywords: true,
                      showSnippets: true,
                    },

                    quickSuggestions: {
                      other: true,
                      comments: false,
                      strings: false,
                    },

                    folding: true,
                    foldingHighlight: true,

                    links: false,

                    overviewRulerLanes: 0,

                    hideCursorInOverviewRuler:
                      true,

                    scrollbar: {
                      verticalScrollbarSize: 10,
                      horizontalScrollbarSize: 10,
                    },
                  }}
                />
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={submitCode}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#5339f7] px-5 py-3 text-sm font-black text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}

                  {submitting
                    ? 'Đang gửi...'
                    : 'Nộp bài'}
                </button>
              </div>

              <Verdict
                submission={submission}
              />

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold leading-5 text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                Hiện tại bài nộp được lưu vào
                hàng chờ chấm. Judge Worker
                sẽ xử lý mã nguồn ở bước tiếp
                theo.
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

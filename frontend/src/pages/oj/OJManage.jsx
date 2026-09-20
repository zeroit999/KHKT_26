import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import {
  AlertCircle,
  ArrowLeft,
  Check,
  Code2,
  Eye,
  EyeOff,
  FilePlus2,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  ShieldCheck,
  Terminal,
  Trash2,
} from 'lucide-react'

import { useAuth } from '../../contexts/AuthContext'
import ojApi from '../../services/ojApi'


const emptyProblem = {
  title: '',
  description: '',
  inputDescription: '',
  outputDescription: '',
  constraints: '',
  difficulty: 'EASY',
  category: '',
  points: 100,
  timeLimitMs: 1000,
  memoryLimitMb: 256,
  status: 'DRAFT',
}


const emptyTestcase = {
  input: '',
  output: '',
  isSample: false,
  points: '',
}


const statusLabels = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Công khai',
  ARCHIVED: 'Lưu trữ',
}


const difficultyLabels = {
  EASY: 'Dễ',
  MEDIUM: 'Trung bình',
  HARD: 'Khó',
}


const errorMessage = (
  error,
  fallback,
) => (
  error?.response?.data?.message
  || error?.response?.data?.error
  || error?.message
  || fallback
)


function Field({
  label,
  children,
  className = '',
}) {
  return (
    <label
      className={`block ${className}`}
    >
      <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>

      {children}
    </label>
  )
}


const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-violet-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100'


const textareaClass =
  `${inputClass} min-h-[110px] resize-y font-medium leading-6`


function StatusBadge({
  status,
}) {
  const className =
    status === 'PUBLISHED'
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      : status === 'ARCHIVED'
        ? 'bg-slate-500/10 text-slate-500 dark:text-slate-400'
        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black ${className}`}
    >
      {statusLabels[status] || status}
    </span>
  )
}


export default function OJManage() {
  const {
    canManageOJ,
    isLoading: authLoading,
  } = useAuth()

  const [
    problems,
    setProblems,
  ] = useState([])

  const [
    selectedProblemId,
    setSelectedProblemId,
  ] = useState('')

  const [
    form,
    setForm,
  ] = useState(emptyProblem)

  const [
    testcases,
    setTestcases,
  ] = useState([])

  const [
    testcaseForm,
    setTestcaseForm,
  ] = useState(emptyTestcase)

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    detailLoading,
    setDetailLoading,
  ] = useState(false)

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    testcaseSaving,
    setTestcaseSaving,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  const [
    success,
    setSuccess,
  ] = useState('')


  const isEditing =
    Boolean(selectedProblemId)


  const loadProblems =
    useCallback(async () => {
      if (!canManageOJ) {
        return
      }

      setLoading(true)
      setError('')

      try {
        const data =
          await ojApi.listProblems()

        setProblems(
          Array.isArray(data?.problems)
            ? data.problems
            : [],
        )
      } catch (loadError) {
        setError(
          errorMessage(
            loadError,
            'Không thể tải danh sách bài.',
          ),
        )
      } finally {
        setLoading(false)
      }
    }, [canManageOJ])


  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProblems()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [loadProblems])


  const resetEditor = () => {
    setSelectedProblemId('')
    setForm(emptyProblem)
    setTestcases([])
    setTestcaseForm(emptyTestcase)
    setError('')
    setSuccess('')
  }


  const openProblem = async (
    problemId,
  ) => {
    setDetailLoading(true)
    setError('')
    setSuccess('')

    try {
      const data =
        await ojApi.getManagerProblem(
          problemId,
        )

      const problem =
        data?.problem

      if (!problem) {
        throw new Error(
          'Không nhận được dữ liệu bài.',
        )
      }

      setSelectedProblemId(problem.id)

      setForm({
        title: problem.title || '',
        description:
          problem.description || '',
        inputDescription:
          problem.inputDescription || '',
        outputDescription:
          problem.outputDescription || '',
        constraints:
          problem.constraints || '',
        difficulty:
          problem.difficulty || 'EASY',
        category:
          problem.category || '',
        points:
          problem.points ?? 100,
        timeLimitMs:
          problem.timeLimitMs ?? 1000,
        memoryLimitMb:
          problem.memoryLimitMb ?? 256,
        status:
          problem.status || 'DRAFT',
      })

      setTestcases(
        Array.isArray(problem.testcases)
          ? problem.testcases
          : [],
      )

      setTestcaseForm(emptyTestcase)
    } catch (loadError) {
      setError(
        errorMessage(
          loadError,
          'Không thể mở bài.',
        ),
      )
    } finally {
      setDetailLoading(false)
    }
  }


  const updateField = (
    field,
    value,
  ) => {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      }),
    )
  }


  const saveProblem = async (
    event,
  ) => {
    event.preventDefault()

    setSaving(true)
    setError('')
    setSuccess('')

    const payload = {
      ...form,
      points:
        Number(form.points),
      timeLimitMs:
        Number(form.timeLimitMs),
      memoryLimitMb:
        Number(form.memoryLimitMb),
    }

    try {
      const data =
        isEditing
          ? await ojApi.updateProblem(
              selectedProblemId,
              payload,
            )
          : await ojApi.createProblem(
              payload,
            )

      const problem =
        data?.problem

      setSuccess(
        isEditing
          ? 'Đã lưu thay đổi.'
          : 'Đã tạo bài lập trình.',
      )

      await loadProblems()

      if (problem?.id) {
        await openProblem(
          problem.id,
        )

        setSuccess(
          isEditing
            ? 'Đã lưu thay đổi.'
            : 'Đã tạo bài lập trình.',
        )
      }
    } catch (saveError) {
      setError(
        errorMessage(
          saveError,
          'Không thể lưu bài.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }


  const addTestcase = async (
    event,
  ) => {
    event.preventDefault()

    if (!selectedProblemId) {
      setError(
        'Hãy tạo bài trước khi thêm testcase.',
      )
      return
    }

    setTestcaseSaving(true)
    setError('')
    setSuccess('')

    try {
      await ojApi.addTestcase(
        selectedProblemId,
        {
          input: testcaseForm.input,
          output: testcaseForm.output,
          isSample:
            testcaseForm.isSample,
          points:
            testcaseForm.points === ''
              ? null
              : Number(
                  testcaseForm.points,
                ),
        },
      )

      setTestcaseForm(
        emptyTestcase,
      )

      await openProblem(
        selectedProblemId,
      )

      setSuccess(
        'Đã thêm testcase.',
      )
    } catch (saveError) {
      setError(
        errorMessage(
          saveError,
          'Không thể thêm testcase.',
        ),
      )
    } finally {
      setTestcaseSaving(false)
    }
  }


  const updateTestcase = async (
    testcase,
  ) => {
    setError('')
    setSuccess('')

    try {
      await ojApi.updateTestcase(
        selectedProblemId,
        testcase.id,
        {
          input: testcase.input,
          output: testcase.output,
          isSample:
            Boolean(
              testcase.isSample,
            ),
          points:
            testcase.points ?? null,
          position:
            testcase.position,
        },
      )

      setSuccess(
        `Đã lưu testcase #${testcase.position}.`,
      )

      await openProblem(
        selectedProblemId,
      )

      setSuccess(
        `Đã lưu testcase #${testcase.position}.`,
      )
    } catch (saveError) {
      setError(
        errorMessage(
          saveError,
          'Không thể cập nhật testcase.',
        ),
      )
    }
  }


  const deleteTestcase = async (
    testcase,
  ) => {
    const confirmed =
      window.confirm(
        `Xóa testcase #${testcase.position}?`,
      )

    if (!confirmed) {
      return
    }

    setError('')
    setSuccess('')

    try {
      await ojApi.deleteTestcase(
        selectedProblemId,
        testcase.id,
      )

      await openProblem(
        selectedProblemId,
      )

      setSuccess(
        `Đã xóa testcase #${testcase.position}.`,
      )
    } catch (deleteError) {
      setError(
        errorMessage(
          deleteError,
          'Không thể xóa testcase.',
        ),
      )
    }
  }


  const sampleCount =
    useMemo(
      () => (
        testcases.filter(
          (item) => item.isSample,
        ).length
      ),
      [testcases],
    )

  const hiddenCount =
    testcases.length - sampleCount


  if (authLoading) {
    return (
      <section className="flex min-h-screen items-center justify-center bg-[#f6f8fb] pt-20 dark:bg-[#0d1117]">
        <LoaderCircle className="h-8 w-8 animate-spin text-violet-500" />
      </section>
    )
  }


  if (!canManageOJ) {
    return (
      <section className="flex min-h-screen items-center justify-center bg-[#f6f8fb] px-4 pt-20 dark:bg-[#0d1117]">
        <div className="max-w-md text-center">
          <ShieldCheck className="mx-auto h-11 w-11 text-violet-500" />

          <h1 className="mt-4 text-xl font-black dark:text-white">
            Không có quyền quản lý OJ
          </h1>

          <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
            Khu vực này dành cho giáo viên
            Tin học và quản trị viên hệ thống.
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
    <section className="min-h-screen bg-[#f6f8fb] pb-14 pt-20 text-slate-950 dark:bg-[#0d1117] dark:text-slate-100">
      <div className="border-b border-slate-200 bg-white dark:border-[#30363d] dark:bg-[#161b22]">
        <div className="mx-auto flex min-h-16 max-w-[1500px] flex-wrap items-center gap-3 px-4 py-3">
          <Link
            to="/oj"
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 dark:border-[#30363d]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="grid h-9 w-9 place-items-center rounded-lg bg-violet-600 text-white">
            <Terminal className="h-4 w-4" />
          </div>

          <div>
            <h1 className="text-sm font-black">
              ZUNY OJ Manager
            </h1>

            <p className="text-[10px] font-semibold text-slate-400">
              Quản lý bài lập trình và testcase
            </p>
          </div>

          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => {
                void loadProblems()
              }}
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:text-violet-500 dark:border-[#30363d]"
              title="Tải lại"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={resetEditor}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-violet-600 px-3 text-xs font-black text-white"
            >
              <FilePlus2 className="h-4 w-4" />

              Tạo bài
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto grid max-w-[1500px] gap-4 px-4 pt-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#30363d] dark:bg-[#161b22]">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-[#30363d]">
            <p className="text-xs font-black">
              Danh sách bài
            </p>

            <p className="mt-1 text-[10px] font-semibold text-slate-400">
              {problems.length} bài
            </p>
          </div>

          <div className="max-h-[calc(100vh-190px)] overflow-y-auto">
            {loading ? (
              <div className="grid min-h-36 place-items-center">
                <LoaderCircle className="h-5 w-5 animate-spin text-violet-500" />
              </div>
            ) : problems.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs font-semibold text-slate-400">
                Chưa có bài lập trình.
              </div>
            ) : (
              problems.map(
                (problem) => (
                  <button
                    key={problem.id}
                    type="button"
                    onClick={() => {
                      void openProblem(
                        problem.id,
                      )
                    }}
                    className={
                      `block w-full border-b border-slate-100 px-4 py-3 text-left transition dark:border-[#252c34] ${
                        selectedProblemId
                          === problem.id
                          ? 'bg-violet-50 dark:bg-violet-500/10'
                          : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                      }`
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-black text-violet-500">
                        {problem.id}
                      </span>

                      <StatusBadge
                        status={
                          problem.status
                        }
                      />
                    </div>

                    <p className="mt-1 line-clamp-2 text-xs font-bold">
                      {problem.title}
                    </p>
                  </button>
                ),
              )
            )}
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-500">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4 shrink-0" />
              {success}
            </div>
          )}

          <form
            onSubmit={saveProblem}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#30363d] dark:bg-[#161b22]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-[#30363d]">
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-violet-500" />

                <div>
                  <h2 className="text-sm font-black">
                    {isEditing
                      ? 'Chỉnh sửa bài'
                      : 'Tạo bài lập trình'}
                  </h2>

                  {isEditing && (
                    <p className="mt-0.5 font-mono text-[10px] font-bold text-slate-400">
                      {selectedProblemId}
                    </p>
                  )}
                </div>
              </div>

              {detailLoading && (
                <LoaderCircle className="h-5 w-5 animate-spin text-violet-500" />
              )}
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2">
              {isEditing && (
                <Field label="Mã bài">
                  <input
                    value={selectedProblemId || ''}
                    disabled
                    className={inputClass}
                  />
                </Field>
              )}

              <Field label="Tên bài">
                <input
                  value={form.title}
                  onChange={(event) => {
                    updateField(
                      'title',
                      event.target.value,
                    )
                  }}
                  required
                  className={inputClass}
                />
              </Field>

              <Field
                label="Mô tả đề bài"
                className="md:col-span-2"
              >
                <textarea
                  value={form.description}
                  onChange={(event) => {
                    updateField(
                      'description',
                      event.target.value,
                    )
                  }}
                  required
                  className={textareaClass}
                />
              </Field>

              <Field label="Dữ liệu vào">
                <textarea
                  value={
                    form.inputDescription
                  }
                  onChange={(event) => {
                    updateField(
                      'inputDescription',
                      event.target.value,
                    )
                  }}
                  className={textareaClass}
                />
              </Field>

              <Field label="Kết quả">
                <textarea
                  value={
                    form.outputDescription
                  }
                  onChange={(event) => {
                    updateField(
                      'outputDescription',
                      event.target.value,
                    )
                  }}
                  className={textareaClass}
                />
              </Field>

              <Field
                label="Giới hạn / ràng buộc"
                className="md:col-span-2"
              >
                <textarea
                  value={form.constraints}
                  onChange={(event) => {
                    updateField(
                      'constraints',
                      event.target.value,
                    )
                  }}
                  className={textareaClass}
                  placeholder="Mỗi giới hạn một dòng..."
                />
              </Field>

              <Field label="Phân loại">
                <input
                  value={form.category}
                  onChange={(event) => {
                    updateField(
                      'category',
                      event.target.value,
                    )
                  }}
                  className={inputClass}
                  placeholder="Mảng, DP, Đồ thị..."
                />
              </Field>

              <Field label="Độ khó">
                <select
                  value={form.difficulty}
                  onChange={(event) => {
                    updateField(
                      'difficulty',
                      event.target.value,
                    )
                  }}
                  className={inputClass}
                >
                  {Object.entries(
                    difficultyLabels,
                  ).map(
                    ([value, label]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <Field label="Điểm">
                <input
                  type="number"
                  min="0"
                  value={form.points}
                  onChange={(event) => {
                    updateField(
                      'points',
                      event.target.value,
                    )
                  }}
                  className={inputClass}
                />
              </Field>

              <Field label="Thời gian (ms)">
                <input
                  type="number"
                  min="1"
                  max="30000"
                  value={form.timeLimitMs}
                  onChange={(event) => {
                    updateField(
                      'timeLimitMs',
                      event.target.value,
                    )
                  }}
                  className={inputClass}
                />
              </Field>

              <Field label="Bộ nhớ (MB)">
                <input
                  type="number"
                  min="1"
                  value={
                    form.memoryLimitMb
                  }
                  onChange={(event) => {
                    updateField(
                      'memoryLimitMb',
                      event.target.value,
                    )
                  }}
                  className={inputClass}
                />
              </Field>

              <Field label="Trạng thái">
                <select
                  value={form.status}
                  onChange={(event) => {
                    updateField(
                      'status',
                      event.target.value,
                    )
                  }}
                  className={inputClass}
                >
                  <option value="DRAFT">
                    Bản nháp
                  </option>

                  <option value="PUBLISHED">
                    Công khai
                  </option>

                  <option value="ARCHIVED">
                    Lưu trữ
                  </option>
                </select>
              </Field>
            </div>

            <div className="flex justify-end border-t border-slate-100 px-5 py-4 dark:border-[#30363d]">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-60"
              >
                {saving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}

                {isEditing
                  ? 'Lưu thay đổi'
                  : 'Tạo bài'}
              </button>
            </div>
          </form>

          {isEditing && (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#30363d] dark:bg-[#161b22]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 dark:border-[#30363d]">
                <div>
                  <h2 className="text-sm font-black">
                    Testcase
                  </h2>

                  <p className="mt-1 text-[10px] font-semibold text-slate-400">
                    {sampleCount} sample · {hiddenCount} hidden
                  </p>
                </div>

                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-[10px] font-black text-amber-600 dark:text-amber-400">
                  <EyeOff className="h-3.5 w-3.5" />

                  Hidden chỉ Manager thấy
                </span>
              </div>

              <div className="space-y-3 p-5">
                {testcases.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-xs font-semibold text-slate-400 dark:border-[#30363d]">
                    Chưa có testcase.
                  </div>
                ) : (
                  testcases.map(
                    (
                      testcase,
                      index,
                    ) => (
                      <div
                        key={testcase.id}
                        className="rounded-xl border border-slate-200 p-4 dark:border-[#30363d]"
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black">
                              #{testcase.position}
                            </span>

                            <span
                              className={
                                `inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${
                                  testcase.isSample
                                    ? 'bg-blue-500/10 text-blue-500'
                                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                }`
                              }
                            >
                              {testcase.isSample ? (
                                <Eye className="h-3 w-3" />
                              ) : (
                                <EyeOff className="h-3 w-3" />
                              )}

                              {testcase.isSample
                                ? 'Sample'
                                : 'Hidden'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              void deleteTestcase(
                                testcase,
                              )
                            }}
                            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-red-500/10 hover:text-red-500"
                            title="Xóa testcase"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-2">
                          <Field label="Input">
                            <textarea
                              value={
                                testcase.input
                              }
                              onChange={(
                                event,
                              ) => {
                                const value =
                                  event.target
                                    .value

                                setTestcases(
                                  (current) =>
                                    current.map(
                                      (
                                        item,
                                        itemIndex,
                                      ) =>
                                        itemIndex
                                          === index
                                          ? {
                                              ...item,
                                              input:
                                                value,
                                            }
                                          : item,
                                    ),
                                )
                              }}
                              className={`${textareaClass} font-mono`}
                            />
                          </Field>

                          <Field label="Expected output">
                            <textarea
                              value={
                                testcase.output
                              }
                              onChange={(
                                event,
                              ) => {
                                const value =
                                  event.target
                                    .value

                                setTestcases(
                                  (current) =>
                                    current.map(
                                      (
                                        item,
                                        itemIndex,
                                      ) =>
                                        itemIndex
                                          === index
                                          ? {
                                              ...item,
                                              output:
                                                value,
                                            }
                                          : item,
                                    ),
                                )
                              }}
                              className={`${textareaClass} font-mono`}
                            />
                          </Field>
                        </div>

                        <div className="mt-3 flex flex-wrap items-end gap-3">
                          <Field
                            label="Vị trí"
                            className="w-24"
                          >
                            <input
                              type="number"
                              min="1"
                              value={
                                testcase.position
                              }
                              onChange={(
                                event,
                              ) => {
                                const value =
                                  Number(
                                    event.target
                                      .value,
                                  )

                                setTestcases(
                                  (current) =>
                                    current.map(
                                      (
                                        item,
                                        itemIndex,
                                      ) =>
                                        itemIndex
                                          === index
                                          ? {
                                              ...item,
                                              position:
                                                value,
                                            }
                                          : item,
                                    ),
                                )
                              }}
                              className={inputClass}
                            />
                          </Field>

                          <Field
                            label="Điểm"
                            className="w-28"
                          >
                            <input
                              type="number"
                              min="0"
                              value={
                                testcase.points
                                ?? ''
                              }
                              onChange={(
                                event,
                              ) => {
                                const raw =
                                  event.target
                                    .value

                                setTestcases(
                                  (current) =>
                                    current.map(
                                      (
                                        item,
                                        itemIndex,
                                      ) =>
                                        itemIndex
                                          === index
                                          ? {
                                              ...item,
                                              points:
                                                raw === ''
                                                  ? null
                                                  : Number(
                                                      raw,
                                                    ),
                                            }
                                          : item,
                                    ),
                                )
                              }}
                              className={inputClass}
                            />
                          </Field>

                          <label className="flex h-[42px] items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold dark:border-[#30363d]">
                            <input
                              type="checkbox"
                              checked={
                                testcase.isSample
                              }
                              onChange={(
                                event,
                              ) => {
                                const checked =
                                  event.target
                                    .checked

                                setTestcases(
                                  (current) =>
                                    current.map(
                                      (
                                        item,
                                        itemIndex,
                                      ) =>
                                        itemIndex
                                          === index
                                          ? {
                                              ...item,
                                              isSample:
                                                checked,
                                            }
                                          : item,
                                    ),
                                )
                              }}
                            />

                            Sample công khai
                          </label>

                          <button
                            type="button"
                            onClick={() => {
                              void updateTestcase(
                                testcase,
                              )
                            }}
                            className="ml-auto inline-flex h-[42px] items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-black text-white dark:bg-white dark:text-slate-900"
                          >
                            <Pencil className="h-4 w-4" />

                            Lưu testcase
                          </button>
                        </div>
                      </div>
                    ),
                  )
                )}
              </div>

              <form
                onSubmit={addTestcase}
                className="border-t border-slate-100 p-5 dark:border-[#30363d]"
              >
                <div className="mb-4 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-violet-500" />

                  <h3 className="text-xs font-black">
                    Thêm testcase
                  </h3>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <Field label="Input">
                    <textarea
                      value={
                        testcaseForm.input
                      }
                      onChange={(event) => {
                        setTestcaseForm(
                          (current) => ({
                            ...current,
                            input:
                              event.target.value,
                          }),
                        )
                      }}
                      className={`${textareaClass} font-mono`}
                    />
                  </Field>

                  <Field label="Expected output">
                    <textarea
                      value={
                        testcaseForm.output
                      }
                      onChange={(event) => {
                        setTestcaseForm(
                          (current) => ({
                            ...current,
                            output:
                              event.target.value,
                          }),
                        )
                      }}
                      className={`${textareaClass} font-mono`}
                    />
                  </Field>
                </div>

                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <Field
                    label="Điểm"
                    className="w-28"
                  >
                    <input
                      type="number"
                      min="0"
                      value={
                        testcaseForm.points
                      }
                      onChange={(event) => {
                        setTestcaseForm(
                          (current) => ({
                            ...current,
                            points:
                              event.target.value,
                          }),
                        )
                      }}
                      className={inputClass}
                    />
                  </Field>

                  <label className="flex h-[42px] items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold dark:border-[#30363d]">
                    <input
                      type="checkbox"
                      checked={
                        testcaseForm.isSample
                      }
                      onChange={(event) => {
                        setTestcaseForm(
                          (current) => ({
                            ...current,
                            isSample:
                              event.target.checked,
                          }),
                        )
                      }}
                    />

                    Sample công khai
                  </label>

                  <button
                    type="submit"
                    disabled={testcaseSaving}
                    className="ml-auto inline-flex h-[42px] items-center gap-2 rounded-lg bg-violet-600 px-4 text-xs font-black text-white disabled:opacity-60"
                  >
                    {testcaseSaving ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}

                    Thêm testcase
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      </main>
    </section>
  )
}

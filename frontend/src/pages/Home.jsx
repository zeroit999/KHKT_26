import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  FileText,
  FlaskConical,
  GraduationCap,
  Languages,
  Map,
  Microscope,
  PenLine,
  Play,
  Sigma,
  Sparkles,
  Trophy,
  UsersRound,
  Zap,
} from 'lucide-react'

import { getPublicExamsApi } from '../api/examApi'
import { useAuth } from '../contexts/AuthContext'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

const SUBJECTS = [
  {
    key: 'toan',
    name: 'Toán học',
    aliases: ['toán', 'toan', 'toán học', 'toan hoc', 'math'],
    icon: Sigma,
    iconClass: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    badgeClass: 'bg-blue-500/10 text-blue-400',
    progressClass: 'bg-blue-500',
  },
  {
    key: 'ngu-van',
    name: 'Ngữ văn',
    aliases: ['ngữ văn', 'ngu van', 'văn', 'van', 'literature'],
    icon: PenLine,
    iconClass: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
    badgeClass: 'bg-violet-500/10 text-violet-400',
    progressClass: 'bg-violet-400',
  },
  {
    key: 'tieng-anh',
    name: 'Tiếng Anh',
    aliases: ['tiếng anh', 'tieng anh', 'anh', 'english', 'ngoại ngữ', 'ngoai ngu'],
    icon: Languages,
    iconClass: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
    badgeClass: 'bg-emerald-500/10 text-emerald-400',
    progressClass: 'bg-emerald-400',
  },
  {
    key: 'vat-ly',
    name: 'Vật lý',
    aliases: ['vật lý', 'vat ly', 'lý', 'ly', 'physics'],
    icon: Zap,
    iconClass: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    badgeClass: 'bg-amber-500/10 text-amber-400',
    progressClass: 'bg-amber-400',
  },
  {
    key: 'hoa-hoc',
    name: 'Hóa học',
    aliases: ['hóa học', 'hoa hoc', 'hóa', 'hoa', 'chemistry'],
    icon: FlaskConical,
    iconClass: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
    badgeClass: 'bg-rose-500/10 text-rose-400',
    progressClass: 'bg-rose-400',
  },
  {
    key: 'sinh-hoc',
    name: 'Sinh học',
    aliases: ['sinh học', 'sinh hoc', 'sinh', 'biology'],
    icon: Microscope,
    iconClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    badgeClass: 'bg-emerald-500/10 text-emerald-400',
    progressClass: 'bg-emerald-400',
  },
  {
    key: 'lich-su',
    name: 'Lịch sử',
    aliases: ['lịch sử', 'lich su', 'sử', 'su', 'history'],
    icon: FileText,
    iconClass: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
    badgeClass: 'bg-orange-500/10 text-orange-400',
    progressClass: 'bg-orange-400',
  },
  {
    key: 'dia-ly',
    name: 'Địa lý',
    aliases: ['địa lý', 'dia ly', 'địa', 'dia', 'geography'],
    icon: Map,
    iconClass: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
    badgeClass: 'bg-sky-500/10 text-sky-400',
    progressClass: 'bg-sky-400',
  },
]

const FEATURES = [
  {
    icon: FileText,
    eyebrow: 'KHO ĐỀ THỰC',
    title: 'Đề thi được cập nhật từ hệ thống',
    description:
      'Mọi số liệu trên trang chủ được tính trực tiếp từ các đề thi đang được công khai trong ZUNY.',
    iconClass: 'text-sky-400',
  },
  {
    icon: BookOpen,
    eyebrow: 'CÂU HỎI THỰC',
    title: 'Số câu hỏi được đếm tự động',
    description:
      'Hệ thống cộng tổng questionCount hoặc số phần tử trong mảng questions của từng đề thi.',
    iconClass: 'text-rose-400',
  },
  {
    icon: BarChart3,
    eyebrow: 'DỮ LIỆU SỐNG',
    title: 'Tự cập nhật khi dữ liệu thay đổi',
    description:
      'Khi giáo viên tạo, xuất bản hoặc xóa đề, số liệu trên Home sẽ thay đổi sau lần tải tiếp theo.',
    iconClass: 'text-emerald-400',
  },
  {
    icon: Trophy,
    eyebrow: 'LƯỢT LÀM BÀI',
    title: 'Thống kê từ kết quả thi',
    description:
      'Lượt thi được lấy từ attempts hoặc studentResults của từng đề, không dùng số liệu minh họa.',
    iconClass: 'text-amber-400',
  },
]

const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim()
    .toLowerCase()

const getQuestionCount = (exam) => {
  const explicitCount = Number(exam?.questionCount)
  if (Number.isFinite(explicitCount) && explicitCount >= 0) return explicitCount
  return Array.isArray(exam?.questions) ? exam.questions.length : 0
}

const getAttemptCount = (exam) => {
  if (Array.isArray(exam?.attempts)) return exam.attempts.length
  if (Array.isArray(exam?.studentResults)) return exam.studentResults.length
  if (Array.isArray(exam?.results)) return exam.results.length

  const explicitCount = Number(exam?.attemptCount ?? exam?.submissionCount)
  return Number.isFinite(explicitCount) && explicitCount >= 0 ? explicitCount : 0
}

const isPublicPublishedExam = (exam) => {
  const privacy = normalizeText(
    exam?.status ?? exam?.privacy ?? exam?.visibility ?? exam?.accessType ?? 'public',
  )

  const publishState = normalizeText(
    exam?.publishStatus ?? exam?.availabilityStatus ?? exam?.state ?? '',
  )

  const isPrivate = ['private', 'restricted', 'internal'].includes(privacy)
  const isUnavailable = ['draft', 'deleted', 'archived', 'hidden'].includes(publishState)
  const explicitlyUnpublished = exam?.isPublished === false || exam?.published === false

  return !isPrivate && !isUnavailable && !explicitlyUnpublished
}

const formatNumber = (value) =>
  new Intl.NumberFormat('vi-VN').format(Number(value) || 0)

function SectionTitle({ eyebrow, title, description, centered = false }) {
  return (
    <div className={centered ? 'text-center' : ''}>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400 sm:text-sm">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-3xl font-black leading-tight text-slate-950 dark:text-white sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-400 sm:text-base">
          {description}
        </p>
      )}
    </div>
  )
}

function StatSkeleton() {
  return (
    <div className="flex min-h-36 animate-pulse flex-col items-center justify-center px-3 py-6">
      <div className="h-6 w-6 rounded bg-blue-900/70" />
      <div className="mt-3 h-8 w-24 rounded bg-blue-900/70" />
      <div className="mt-3 h-4 w-28 rounded bg-slate-200 dark:bg-blue-950" />
    </div>
  )
}

function Home() {
  const { user } = useAuth()

  const [exams, setExams] = useState([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [statsError, setStatsError] = useState('')

  useEffect(() => {
    let active = true

    const loadHomeStatistics = async () => {
      try {
        setLoadingStats(true)
        setStatsError('')

        const response = await getPublicExamsApi()
        const examList = Array.isArray(response?.data?.exams)
          ? response.data.exams
          : Array.isArray(response?.data)
            ? response.data
            : []

        if (active) setExams(examList.filter(isPublicPublishedExam))
      } catch (error) {
        console.error('Không thể tải thống kê trang chủ:', error)

        if (active) {
          setExams([])
          setStatsError(
            error?.response?.data?.message ||
              error?.message ||
              'Không thể tải dữ liệu thống kê.',
          )
        }
      } finally {
        if (active) setLoadingStats(false)
      }
    }

    loadHomeStatistics()

    return () => {
      active = false
    }
  }, [])

  const homeData = useMemo(() => {
    const totalExams = exams.length
    const totalQuestions = exams.reduce(
      (sum, exam) => sum + getQuestionCount(exam),
      0,
    )
    const totalAttempts = exams.reduce(
      (sum, exam) => sum + getAttemptCount(exam),
      0,
    )

    const subjectStats = SUBJECTS.map((subject) => {
      const matchingExams = exams.filter((exam) => {
        const examSubject = normalizeText(exam?.subject)
        return subject.aliases.some((alias) => normalizeText(alias) === examSubject)
      })

      return {
        ...subject,
        exams: matchingExams.length,
        questions: matchingExams.reduce(
          (sum, exam) => sum + getQuestionCount(exam),
          0,
        ),
      }
    })

    const subjectsWithExams = subjectStats.filter((subject) => subject.exams > 0).length
    const maxExamCount = Math.max(1, ...subjectStats.map((subject) => subject.exams))

    return {
      totalExams,
      totalQuestions,
      totalAttempts,
      subjectsWithExams,
      subjectStats: subjectStats.map((subject) => ({
        ...subject,
        progress: `${Math.max(5, Math.round((subject.exams / maxExamCount) * 100))}%`,
      })),
    }
  }, [exams])

  const stats = [
    {
      icon: FileText,
      value: formatNumber(homeData.totalExams),
      label: 'Đề thi công khai',
    },
    {
      icon: BookOpen,
      value: formatNumber(homeData.totalQuestions),
      label: 'Câu hỏi trong kho đề',
    },
    {
      icon: GraduationCap,
      value: formatNumber(homeData.subjectsWithExams),
      label: 'Môn học có đề',
    },
    {
      icon: UsersRound,
      value: formatNumber(homeData.totalAttempts),
      label: 'Lượt làm bài đã ghi nhận',
    },
  ]

  return (
    <main className="min-h-dvh overflow-x-hidden bg-slate-50 text-slate-950 transition-colors dark:bg-[#050b19] dark:text-white">
      <section className="relative border-b border-slate-200 dark:border-blue-950/70">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-16 h-[430px] w-[650px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[130px]" />
        </div>

        <div className="relative mx-auto flex min-h-[720px] max-w-7xl flex-col items-center justify-center px-4 pb-16 pt-28 text-center sm:px-6 lg:px-8">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.45 }}
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-xs font-semibold text-blue-400 sm:text-sm"
          >
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            <span className="truncate">Kho đề thi đang được cập nhật trực tiếp từ ZUNY</span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mt-7 max-w-4xl text-[2.65rem] font-black leading-[1.08] tracking-[-0.045em] sm:text-6xl lg:text-7xl"
          >
            Ôn thi{' '}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              THPTQG
            </span>
            <br className="hidden sm:block" /> thông minh hơn
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.5, delay: 0.16 }}
            className="mt-7 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-400 sm:text-lg sm:leading-8"
          >
            Luyện thi theo cấu trúc CBT, làm đề trực tuyến và theo dõi kết quả trên cùng một nền tảng.
          </motion.p>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.5, delay: 0.24 }}
            className="mt-9 flex w-full max-w-xl flex-col justify-center gap-3 sm:flex-row"
          >
            <Link
              to="/exams"
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-3 text-sm font-bold text-white shadow-[0_15px_40px_rgba(59,130,246,0.25)] transition hover:-translate-y-0.5 sm:w-auto"
            >
              <Play className="h-4 w-4" />
              Bắt đầu luyện thi
            </Link>

            <Link
              to="/exams"
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-blue-300 bg-white/80 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-500/40 dark:bg-blue-950/10 dark:text-slate-300 dark:hover:bg-blue-500/10 dark:hover:text-white sm:w-auto"
            >
              Xem kho đề
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.5, delay: 0.32 }}
            className="mt-16 grid w-full max-w-6xl grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white/85 shadow-sm md:grid-cols-4 dark:border-blue-900/60 dark:bg-[#08112a]/85 dark:shadow-none"
          >
            {loadingStats
              ? Array.from({ length: 4 }).map((_, index) => (
                  <StatSkeleton key={index} />
                ))
              : stats.map((item, index) => {
                  const Icon = item.icon
                  return (
                    <div
                      key={item.label}
                      className={`flex min-h-36 flex-col items-center justify-center px-3 py-6 ${
                        index % 2 === 0 ? 'border-r border-slate-200 dark:border-blue-900/50' : ''
                      } ${
                        index < 2 ? 'border-b border-slate-200 md:border-b-0 dark:border-blue-900/50' : ''
                      } ${
                        index !== stats.length - 1
                          ? 'md:border-r md:border-slate-200 dark:md:border-blue-900/50'
                          : ''
                      }`}
                    >
                      <Icon className="h-6 w-6 text-blue-400" />
                      <p className="mt-3 text-2xl font-black text-blue-400 sm:text-3xl">
                        {item.value}
                      </p>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-500 sm:text-sm">
                        {item.label}
                      </p>
                    </div>
                  )
                })}
          </motion.div>

          {statsError && (
            <p className="mt-4 max-w-2xl text-sm text-amber-300">
              Không tải được thống kê: {statsError}
            </p>
          )}
        </div>
      </section>

      <section className="border-b border-slate-200 py-20 dark:border-blue-950/70 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-5">
            <SectionTitle eyebrow="Môn học" title="Kho đề theo từng môn" />

            <Link
              to="/exams"
              className="hidden items-center gap-1 text-sm font-medium text-blue-400 hover:text-blue-300 sm:flex"
            >
              Xem tất cả
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {homeData.subjectStats.map((subject) => {
              const Icon = subject.icon

              return (
                <Link
                  key={subject.key}
                  to={`/exams?subject=${encodeURIComponent(subject.name)}`}
                  className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-400 hover:shadow-[0_18px_45px_rgba(37,99,235,0.10)] dark:border-blue-900/50 dark:bg-[#08112a] dark:shadow-none dark:hover:border-blue-600/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl border ${subject.iconClass}`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${subject.badgeClass}`}
                    >
                      {formatNumber(subject.exams)} đề thi
                    </span>
                  </div>

                  <h3 className="mt-5 text-lg font-bold text-slate-950 dark:text-white">{subject.name}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-500">
                    {formatNumber(subject.questions)} câu hỏi · {formatNumber(subject.exams)} đề thi
                  </p>

                  <div className="mt-5 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-blue-950">
                    <div
                      className={`h-full rounded-full ${subject.progressClass}`}
                      style={{ width: subject.exams > 0 ? subject.progress : '0%' }}
                    />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-100 py-20 dark:border-blue-950/70 dark:bg-[#071020] sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionTitle
            centered
            eyebrow="Dữ liệu thật"
            title="Thống kê trực tiếp từ hệ thống ZUNY"
            description="Không sử dụng số liệu minh họa. Các con số được tính từ danh sách đề thi mà API trả về."
          />

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <article
                  key={feature.title}
                  className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-blue-900/50 dark:bg-[#08112a] dark:shadow-none"
                >
                  <Icon className={`h-9 w-9 ${feature.iconClass}`} />
                  <p className="mt-6 text-xs font-medium uppercase tracking-wide text-blue-400">
                    {feature.eyebrow}
                  </p>
                  <h3 className="mt-3 text-lg font-bold text-slate-950 dark:text-white">{feature.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-500">
                    {feature.description}
                  </p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-3xl border border-blue-200 bg-gradient-to-r from-blue-100 to-violet-100 px-5 py-14 text-center shadow-sm dark:border-blue-700/50 dark:from-blue-950 dark:to-indigo-950 dark:shadow-none sm:px-10 sm:py-20">
          <CheckCircle2 className="mx-auto h-10 w-10 text-blue-400" />
          <h2 className="mt-6 text-3xl font-black leading-tight text-slate-950 dark:text-white sm:text-5xl">
            Sẵn sàng bắt đầu luyện thi?
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-400 sm:text-lg">
            Chọn một đề đang được công khai trên ZUNY và bắt đầu làm bài ngay.
          </p>

          <div className="mx-auto mt-8 flex max-w-xl flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/exams"
              className="inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-6 text-sm font-bold text-white transition hover:-translate-y-0.5 sm:w-auto"
            >
              Xem kho đề thi
            </Link>
            {!user && (
              <Link
                to="/register"
                className="inline-flex min-h-14 w-full items-center justify-center rounded-xl border border-blue-300 bg-white/70 px-6 text-sm font-medium text-slate-700 transition hover:bg-white hover:text-blue-700 dark:border-blue-700/50 dark:bg-transparent dark:text-slate-300 dark:hover:bg-blue-500/10 dark:hover:text-white sm:w-auto"
              >
                Tạo tài khoản
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

export default Home
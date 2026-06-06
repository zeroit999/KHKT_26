import { useEffect, useMemo, useState } from 'react'
import {
  Award,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Filter,
  Flame,
  Medal,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserRound,
  UsersRound,
  X,
  Zap,
} from 'lucide-react'
import { collection, getDocs } from 'firebase/firestore'

import { auth, db } from '../../components/firebase'
import useSyncedDarkMode from '../../hooks/common/useSyncedDarkMode'

const timeTabs = [
  { value: 'all', label: 'Mọi thời gian' },
  { value: 'today', label: 'Hôm nay' },
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
]

const scopeTabs = [
  { value: 'student', label: 'Cá nhân' },
  { value: 'class', label: 'Lớp' },
  { value: 'school', label: 'Trường' },
]

const avatarClasses = [
  'bg-fuchsia-500 text-white',
  'bg-sky-500 text-white',
  'bg-emerald-500 text-white',
  'bg-orange-500 text-white',
  'bg-pink-500 text-white',
  'bg-violet-500 text-white',
  'bg-blue-500 text-white',
  'bg-rose-500 text-white',
]

const normalizeRole = (value = '') => String(value || '').trim().toUpperCase()

const isStudentRole = (value = '') => {
  const role = normalizeRole(value)
  return role === 'STUDENT' || role === 'HOCSINH' || role === 'HỌC SINH'
}

const removeVietnameseTones = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')

const normalizeSearchText = (value = '') =>
  removeVietnameseTones(value).toLowerCase().trim()

const getStudentGrade = (student = {}) => {
  const grade =
    student.grade ||
    student.khoi ||
    student.gradeLevel ||
    student.studentGrade ||
    student.block ||
    ''

  const match = String(grade).match(/10|11|12/)
  return match?.[0] || String(grade || '').trim()
}

const getStudentName = (student = {}) => {
  return (
    student.fullName ||
    student.displayName ||
    student.name ||
    student.studentName ||
    student.email ||
    student.studentEmail ||
    'Học sinh'
  )
}

const getStudentHandle = (student = {}) => {
  const source =
    student.username ||
    student.handle ||
    student.email?.split('@')[0] ||
    student.studentEmail?.split('@')[0] ||
    getStudentName(student)

  const handle = removeVietnameseTones(source)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return `@${handle || 'student'}`
}

const getStudentClass = (student = {}) =>
  String(student.className || student.lop || student.studentClass || student.class || '').trim()

const getStudentSchool = (student = {}) => {
  return (
    student.school ||
    student.schoolName ||
    student.truong ||
    student.highSchool ||
    getStudentClass(student) ||
    'Chưa cập nhật trường/lớp'
  )
}

const getResultStudentId = (result = {}) => {
  return String(
    result.studentId ||
      result.userId ||
      result.uid ||
      result.id ||
      result.email ||
      result.studentEmail ||
      '',
  )
}

const toMillis = (value) => {
  if (!value) return 0
  if (value?.toDate) return value.toDate().getTime()
  if (typeof value === 'number') return value

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

const getLocalDateKey = (value = Date.now()) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const getStartOfToday = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

const getTimeWindowRange = (timeFilter, dateFrom = '', dateTo = '') => {
  if (dateFrom || dateTo) {
    const startDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null
    const endDate = dateTo ? new Date(`${dateTo}T00:00:00`) : null

    const start = startDate && !Number.isNaN(startDate.getTime()) ? startDate.getTime() : 0

    if (endDate && !Number.isNaN(endDate.getTime())) {
      endDate.setDate(endDate.getDate() + 1)
      return { start, end: endDate.getTime() }
    }

    return { start, end: Date.now() }
  }

  const now = Date.now()
  if (timeFilter === 'today') return { start: getStartOfToday(), end: now }
  if (timeFilter === '7d') return { start: now - 7 * 24 * 60 * 60 * 1000, end: now }
  if (timeFilter === '30d') return { start: now - 30 * 24 * 60 * 60 * 1000, end: now }

  return { start: 0, end: 0 }
}

const getClassNameFromClassDoc = (classDoc) => {
  const data = classDoc.data?.() || classDoc || {}

  return String(
    data.name ||
      data.className ||
      data.title ||
      data.code ||
      data.lop ||
      data.label ||
      classDoc.id ||
      '',
  ).trim()
}

const getClassMembersFromClassDoc = (classDoc) => {
  const data = classDoc.data?.() || classDoc || {}
  const rawMembers =
    data.students ||
    data.studentIds ||
    data.members ||
    data.memberIds ||
    data.studentList ||
    data.classStudents ||
    []

  if (!Array.isArray(rawMembers)) return []

  return rawMembers
    .map((member) => {
      if (typeof member === 'string') return member

      return (
        member.uid ||
        member.id ||
        member.studentId ||
        member.userId ||
        member.email ||
        member.studentEmail ||
        ''
      )
    })
    .filter(Boolean)
    .map(String)
}

const findFirebaseClassForStudent = (student = {}, classes = []) => {
  const studentIds = new Set(
    [student.id, student.uid, student.email, student.studentEmail]
      .filter(Boolean)
      .map(String),
  )

  const normalizedStudentClass = normalizeSearchText(getStudentClass(student))

  return classes.find((classItem) => {
    if (classItem.memberIds?.some((memberId) => studentIds.has(String(memberId)))) {
      return true
    }

    return normalizedStudentClass && normalizeSearchText(classItem.name) === normalizedStudentClass
  })
}

const scoreToPoint = (score) => Math.round(Number(score || 0) * 100)

const formatDateTimeText = (value) => {
  const millis = toMillis(value)

  if (!millis || millis === Number.MAX_SAFE_INTEGER) {
    return 'Chưa có thời gian'
  }

  return new Date(millis).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const getBadgeList = (student = {}) => {
  const badges = []

  if (student.rank === 1) badges.push({ icon: Trophy, label: 'Quán quân', className: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200' })
  if (student.points >= 800) badges.push({ icon: ShieldCheck, label: 'Olympian', className: 'bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200' })
  if (student.submissions >= 10) badges.push({ icon: BookOpen, label: 'Học giả', className: 'bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-200' })
  if (student.streak >= 7) badges.push({ icon: Flame, label: 'Chăm chỉ', className: 'bg-orange-100 text-orange-700 dark:bg-orange-400/15 dark:text-orange-200' })
  if (student.averageScore >= 8) badges.push({ icon: Zap, label: 'Hiệu suất cao', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200' })

  return badges.slice(0, 3)
}

const calculateStreak = (dateKeys = []) => {
  const uniqueDates = new Set(dateKeys.filter(Boolean))
  if (!uniqueDates.size) return 0

  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  while (uniqueDates.has(getLocalDateKey(cursor.getTime()))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

function LoadingState({ dark }) {
  return (
    <div className={dark ? 'dark' : ''}>
      <section className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.22),transparent_35%),linear-gradient(135deg,#f8fafc,#eef2ff,#ede9fe)] dark:bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.25),transparent_35%),linear-gradient(135deg,#020617,#111827,#1e1b4b)]" />
        <div className="relative flex flex-col items-center">
          <div className="leaderboard-cup-zoom flex h-32 w-32 items-center justify-center rounded-[2rem] bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-500 text-white shadow-2xl shadow-amber-500/40">
            <Trophy className="h-20 w-20 drop-shadow-xl" />
          </div>
          <p className="leaderboard-loading-text mt-8 text-xl font-black text-slate-800 dark:text-white">
            Đang mở bảng xếp hạng...
          </p>
        </div>
      </section>
    </div>
  )
}

function EmptyState({ onReload }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:shadow-2xl dark:shadow-black/20">
      <Trophy className="mx-auto h-14 w-14 text-slate-400 dark:text-slate-500" />
      <h2 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">
        Chưa có dữ liệu xếp hạng
      </h2>
      <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
        Hệ thống chưa tìm thấy học sinh phù hợp với bộ lọc hiện tại.
      </p>
      <button
        type="button"
        onClick={onReload}
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-700"
      >
        <RefreshCcw className="h-4 w-4" />
        Tải lại dữ liệu
      </button>
    </div>
  )
}

function RankBadge({ rank }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-white shadow-lg shadow-amber-500/30">
        <Trophy className="h-4 w-4" /> #{rank}
      </span>
    )
  }

  if (rank === 2) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-400 px-3 py-1 text-xs font-black text-white shadow-lg shadow-slate-500/20">
        <Medal className="h-4 w-4" /> #{rank}
      </span>
    )
  }

  if (rank === 3) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-3 py-1 text-xs font-black text-white shadow-lg shadow-orange-500/20">
        <Award className="h-4 w-4" /> #{rank}
      </span>
    )
  }

  return <span className="font-black text-slate-400">#{rank}</span>
}

function TrendBadge({ delta }) {
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200">
        <TrendingUp className="h-3.5 w-3.5" /> +{delta}
      </span>
    )
  }

  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-black text-red-700 dark:bg-red-400/15 dark:text-red-200">
        <TrendingDown className="h-3.5 w-3.5" /> {delta}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500 dark:bg-white/10 dark:text-slate-300">
      —
    </span>
  )
}

function BadgePills({ badges }) {
  if (!badges.length) return null

  return (
    <div className="mt-3 flex flex-wrap justify-center gap-2">
      {badges.map((badge) => {
        const Icon = badge.icon
        return (
          <span
            key={badge.label}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ${badge.className}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {badge.label}
          </span>
        )
      })}
    </div>
  )
}

function LeaderboardHeroBackground({ students, totalSubmissions, highestPoint, currentChampion }) {
  const championTime =
    currentChampion?.latestSubmitAt ||
    (currentChampion?.firstSubmitAt === Number.MAX_SAFE_INTEGER ? 0 : currentChampion?.firstSubmitAt)

  return (
    <div className="relative overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.18),transparent_35%),linear-gradient(135deg,#f8fafc,#eef2ff_55%,#ede9fe)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.5),transparent_35%),linear-gradient(135deg,#111827,#1e1b4b_55%,#2e1065)]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:48px_48px] dark:bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)]" />

      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 inline-flex items-center gap-3 rounded-full bg-white/80 px-4 py-2 text-sm font-black uppercase tracking-[0.16em] text-blue-700 ring-1 ring-slate-200 dark:bg-white/5 dark:text-blue-200 dark:ring-white/10">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white">
            <Star className="h-5 w-5 fill-current" />
          </span>
          Ranking Overview
        </div>

        <div className="grid gap-8 xl:grid-cols-[1fr_380px] xl:items-end">
          <div>
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-300/30 bg-violet-500/15 text-violet-700 shadow-lg shadow-violet-500/10 dark:text-violet-200 dark:shadow-violet-500/20">
                <Trophy className="h-9 w-9" />
              </div>

              <div>
                <h1 className="text-4xl font-black tracking-tight text-slate-950 md:text-6xl dark:text-white">
                  Bảng Xếp Hạng
                </h1>
                <p className="mt-3 text-base font-semibold text-slate-600 md:text-lg dark:text-blue-200">
                  Thành tích học sinh xuất sắc theo cá nhân, lớp và trường
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 dark:border-blue-300/20 dark:bg-blue-400/10 dark:text-blue-200">
                <UsersRound className="h-4 w-4" />
                {students.length} học sinh
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-black text-indigo-700 dark:border-indigo-300/20 dark:bg-indigo-400/10 dark:text-indigo-200">
                <BookOpen className="h-4 w-4" />
                {totalSubmissions.toLocaleString('vi-VN')} bài làm
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-black text-amber-700 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-200">
                <Flame className="h-4 w-4" />
                Cao nhất: {highestPoint} điểm
              </span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-amber-200 bg-white/85 p-5 shadow-2xl shadow-amber-500/10 backdrop-blur-xl dark:border-amber-300/20 dark:bg-white/[0.06] dark:shadow-amber-500/10">
            <div className="absolute -right-14 -top-14 h-40 w-40 rounded-full bg-amber-300/20 blur-3xl" />
            <div className="relative flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-500 text-white shadow-lg shadow-amber-500/30">
                <CalendarDays className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">
                  Lần cuối đứng giải nhất
                </p>
                <h2 className="mt-2 truncate text-xl font-black text-slate-950 dark:text-white">
                  {currentChampion?.name || 'Chưa có giải nhất'}
                </h2>
                <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-300">
                  {currentChampion ? formatDateTimeText(championTime) : 'Chưa có học sinh nào đạt giải nhất'}
                </p>
                {currentChampion && (
                  <p className="mt-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700 dark:bg-amber-400/15 dark:text-amber-200">
                    {currentChampion.points} điểm • {currentChampion.submissions} bài làm
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PodiumCard({ item, spot, equalRankHeight, onOpenProfile }) {
  if (!item) return <div className="hidden lg:block" />

  const rank = item.rank
  const isChampionSpot = !equalRankHeight && spot === 'center' && rank === 1
  const badges = getBadgeList(item)

  const shellByRank = {
    1: 'border-amber-300 bg-amber-50 shadow-amber-200 dark:border-amber-400/60 dark:bg-amber-500/10 dark:shadow-amber-500/20',
    2: 'border-slate-300 bg-slate-50 shadow-slate-200 dark:border-slate-300/50 dark:bg-slate-500/10 dark:shadow-slate-500/20',
    3: 'border-orange-300 bg-orange-50 shadow-orange-200 dark:border-orange-500/60 dark:bg-orange-500/10 dark:shadow-orange-500/20',
  }

  const textByRank = {
    1: 'text-amber-600 dark:text-amber-300',
    2: 'text-slate-700 dark:text-slate-200',
    3: 'text-orange-700 dark:text-orange-300',
  }

  const podiumByRank = {
    1: 'h-44 bg-gradient-to-b from-yellow-300 via-amber-400 to-orange-500 border-amber-300 shadow-amber-500/30',
    2: 'h-36 bg-gradient-to-b from-slate-200 via-slate-300 to-slate-500 border-slate-300 shadow-slate-500/20',
    3: 'h-28 bg-gradient-to-b from-orange-300 via-amber-700 to-stone-800 border-orange-300 shadow-orange-700/20',
  }

  return (
    <article className="relative flex flex-col justify-end">
      {isChampionSpot && (
        <div className="pointer-events-none absolute -top-16 left-1/2 z-20 -translate-x-1/2">
          <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300/30 blur-2xl" />
          <div className="leaderboard-glory-ring absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-amber-300/60" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-yellow-200 via-amber-400 to-orange-500 text-white shadow-2xl shadow-amber-500/40">
            <Trophy className="h-11 w-11 fill-white/20 drop-shadow-xl" />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onOpenProfile(item)}
        className={`relative z-10 mx-auto w-full max-w-sm rounded-[2rem] border p-6 text-center shadow-xl backdrop-blur transition hover:-translate-y-1 hover:shadow-2xl ${
          shellByRank[rank] || shellByRank[3]
        } ${isChampionSpot ? 'lg:-translate-y-4' : ''}`}
      >
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
          <RankBadge rank={rank} />
        </div>
        <div className="absolute right-4 top-4">
          <TrendBadge delta={item.rankDelta} />
        </div>
        <div className={`mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-full border-2 text-2xl font-black ring-4 ring-white/70 dark:ring-slate-950/40 ${item.avatarClass}`}>
          {item.initial}
        </div>
        <h3 className="mt-4 truncate text-lg font-black text-slate-950 dark:text-white">{item.name}</h3>
        <p className="mt-1 truncate text-sm font-bold text-blue-600 dark:text-blue-300">{item.handle}</p>
        <p className="mt-3 line-clamp-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{item.school}</p>
        <span className="mt-4 inline-flex rounded-full bg-cyan-100 px-3 py-1 text-xs font-black text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300">
          • Lớp {item.className || '—'}
        </span>
        <BadgePills badges={badges} />
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white/70 p-3 dark:bg-black/20">
            <p className={`text-xl font-black ${textByRank[rank] || textByRank[3]}`}>{item.points}</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">điểm</p>
          </div>
          <div className="rounded-2xl bg-white/70 p-3 dark:bg-black/20">
            <p className="text-xl font-black text-slate-800 dark:text-slate-200">{item.submissions}</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">bài</p>
          </div>
          <div className="rounded-2xl bg-white/70 p-3 dark:bg-black/20">
            <p className="text-xl font-black text-orange-600 dark:text-orange-300">{item.streak}</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">streak</p>
          </div>
        </div>
      </button>

      <div className={`relative mx-auto mt-0 flex w-full max-w-sm items-center justify-center rounded-b-[2rem] rounded-t-xl border-x border-b px-6 text-center shadow-2xl ${
        podiumByRank[rank] || podiumByRank[3]
      } ${isChampionSpot ? 'lg:h-52' : ''}`}>
        <div className="absolute inset-x-4 top-3 h-3 rounded-full bg-white/35 blur-sm" />
        <div className="relative text-white drop-shadow">
          <p className="text-5xl font-black">#{rank}</p>
          <p className="mt-1 text-sm font-black uppercase tracking-[0.25em]">
            {rank === 1 ? 'Giải nhất' : rank === 2 ? 'Giải nhì' : 'Giải ba'}
          </p>
        </div>
      </div>
    </article>
  )
}

function PodiumStage({ topThree, onOpenProfile }) {
  const equalRankHeight = topThree.length > 1 && topThree.every((item) => item.rank === topThree[0]?.rank)
  const sortedPodium = [...topThree].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    const timeA = a.firstSubmitAt ?? Number.MAX_SAFE_INTEGER
    const timeB = b.firstSubmitAt ?? Number.MAX_SAFE_INTEGER
    if (timeA !== timeB) return timeA - timeB
    return String(a.name).localeCompare(String(b.name), 'vi')
  })

  const champion = sortedPodium.find((item) => item.rank === 1) || sortedPodium[0] || null
  const lowerRanks = sortedPodium.filter((item) => item.id !== champion?.id)
  const left = lowerRanks[0] || null
  const right = lowerRanks[1] || null

  return (
    <div className="relative mt-8 rounded-[2rem] border border-slate-200 bg-white/70 p-5 shadow-xl shadow-slate-200/70 backdrop-blur dark:border-white/10 dark:bg-white/[0.04] dark:shadow-black/20 sm:p-8">
      <div className="absolute inset-x-8 bottom-8 h-24 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="relative grid gap-8 lg:grid-cols-3 lg:items-end">
        <PodiumCard item={left} spot="left" equalRankHeight={equalRankHeight} onOpenProfile={onOpenProfile} />
        <PodiumCard item={champion} spot="center" equalRankHeight={equalRankHeight} onOpenProfile={onOpenProfile} />
        <PodiumCard item={right} spot="right" equalRankHeight={equalRankHeight} onOpenProfile={onOpenProfile} />
      </div>
    </div>
  )
}

function ProgressToNextRank({ student, rankedStudents }) {
  if (!student || student.rank <= 1) return null

  const target = rankedStudents.find((item) => item.rank < student.rank)
  if (!target) return null

  const gap = Math.max(0, target.points - student.points + 1)
  const base = Math.max(1, target.points)
  const progress = Math.max(4, Math.min(100, Math.round((student.points / base) * 100)))

  return (
    <div className="mb-6 rounded-3xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm dark:border-cyan-300/20 dark:bg-cyan-400/10">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-black text-cyan-800 dark:text-cyan-100">
            Bạn đang đứng #{student.rank}
          </p>
          <p className="mt-1 text-sm font-semibold text-cyan-700 dark:text-cyan-200">
            Còn {gap} điểm để vượt #{target.rank} {target.name}
          </p>
        </div>
        <div className="min-w-0 flex-1 md:max-w-md">
          <div className="h-3 overflow-hidden rounded-full bg-white dark:bg-slate-950/60">
            <span className="block h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-600" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ProfileModal({ student, onClose }) {
  if (!student) return null

  const badges = getBadgeList(student)

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-950"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl text-3xl font-black ${student.avatarClass}`}>
              {student.initial}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">
                Hồ sơ học sinh
              </p>
              <h2 className="mt-2 truncate text-3xl font-black text-slate-950 dark:text-white">
                {student.name}
              </h2>
              <p className="mt-1 text-sm font-bold text-blue-600 dark:text-blue-300">{student.handle}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <BadgePills badges={badges} />

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ProfileMetric label="Hạng" value={`#${student.rank}`} Icon={Trophy} />
          <ProfileMetric label="Điểm" value={student.points} Icon={Target} />
          <ProfileMetric label="Bài làm" value={student.submissions} Icon={BookOpen} />
          <ProfileMetric label="Streak" value={`${student.streak} ngày`} Icon={Flame} />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <InfoPanel label="Trường / Lớp" value={student.school} />
          <InfoPanel label="Lớp" value={student.className || 'Chưa cập nhật'} />
          <InfoPanel label="Điểm trung bình" value={student.averageScore.toFixed(1)} />
          <InfoPanel label="Lần nộp gần nhất" value={formatDateTimeText(student.latestSubmitAt)} />
        </div>
      </div>
    </div>
  )
}

function ProfileMetric({ label, value, Icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
      <Icon className="h-5 w-5 text-violet-600 dark:text-violet-300" />
      <p className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}

function InfoPanel({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 break-words text-sm font-bold text-slate-800 dark:text-slate-200">{value}</p>
    </div>
  )
}

function aggregateGroups(students, scope, firebaseClasses = []) {
  const groupMap = new Map()
  const allowedClasses = new Set(firebaseClasses.map((classItem) => normalizeSearchText(classItem.name)))

  students.forEach((student) => {
    const studentClassName = String(student.className || '').trim()

    if (scope === 'class' && allowedClasses.size && !allowedClasses.has(normalizeSearchText(studentClassName))) {
      return
    }

    const key = scope === 'class' ? studentClassName || 'Chưa có lớp trong Firebase' : student.school || 'Chưa cập nhật'
    const existing = groupMap.get(key) || {
      id: key,
      name: key,
      handle: scope === 'class' ? 'BXH lớp' : 'BXH trường',
      school: scope === 'class' ? 'Dữ liệu từ Firebase classes' : 'Nhóm theo trường',
      grade: scope === 'class' ? '—' : '—',
      className: key,
      initial: key.charAt(0).toUpperCase() || 'N',
      avatarClass: avatarClasses[groupMap.size % avatarClasses.length],
      points: 0,
      submissions: 0,
      solved: 0,
      streak: 0,
      averageScore: 0,
      latestSubmitAt: 0,
      firstSubmitAt: Number.MAX_SAFE_INTEGER,
      memberCount: 0,
      rankDelta: 0,
    }

    existing.points += student.points
    existing.submissions += student.submissions
    existing.solved += student.solved
    existing.streak = Math.max(existing.streak, student.streak)
    existing.latestSubmitAt = Math.max(existing.latestSubmitAt, student.latestSubmitAt)
    existing.firstSubmitAt = Math.min(existing.firstSubmitAt, student.firstSubmitAt)
    existing.memberCount += 1
    existing.averageScore = existing.submissions ? existing.points / existing.submissions / 100 : 0

    groupMap.set(key, existing)
  })

  return Array.from(groupMap.values())
}

function rankRows(rows) {
  let previousPoints = null
  let currentRank = 0

  return rows.map((row, index) => {
    if (previousPoints === null || row.points !== previousPoints) {
      currentRank = index + 1
      previousPoints = row.points
    }

    return { ...row, rank: currentRank }
  })
}

function Leaderboard() {
  const dark = useSyncedDarkMode()

  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [activeTime, setActiveTime] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [activeScope, setActiveScope] = useState('student')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)

  const currentUserId = auth.currentUser?.uid || ''

  const loadLeaderboard = async () => {
    try {
      setLoading(true)
      setError('')

      const [usersSnap, examsSnap, learningStatsSnap, classesSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'exams')),
        getDocs(collection(db, 'learningStats')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'classes')).catch(() => ({ docs: [] })),
      ])

      const classList = classesSnap.docs
        .map((classDoc) => ({
          id: classDoc.id,
          name: getClassNameFromClassDoc(classDoc),
          memberIds: getClassMembersFromClassDoc(classDoc),
        }))
        .filter((classItem) => classItem.name)

      setClasses(classList)

      const learningStatsMap = new Map()
      learningStatsSnap.docs.forEach((statsDoc) => {
        const data = statsDoc.data() || {}
        const watchedDates = Array.isArray(data.watchedDates) ? data.watchedDates : []
        learningStatsMap.set(statsDoc.id, {
          watchedDates,
          watchedLessons: Number(data.watchedLessons || data.watchedCourses || 0),
          streak: calculateStreak(watchedDates),
        })
      })

      const studentMap = new Map()

      usersSnap.docs.forEach((userDoc, index) => {
        const data = userDoc.data() || {}
        const role = data.role || data.userRole || data.type || ''
        if (!isStudentRole(role)) return

        const grade = getStudentGrade(data)
        const name = getStudentName(data)
        const key = String(userDoc.id || data.uid || data.email || name)
        const learningStats = learningStatsMap.get(key) || {}
        const firebaseClass = findFirebaseClassForStudent({ id: key, uid: userDoc.id, ...data }, classList)
        const className = firebaseClass?.name || getStudentClass(data)

        studentMap.set(key, {
          id: key,
          uid: userDoc.id,
          name,
          handle: getStudentHandle(data),
          school: getStudentSchool(data),
          grade,
          className,
          initial: String(name).trim().charAt(0).toUpperCase() || 'S',
          avatarClass: avatarClasses[index % avatarClasses.length],
          resultItems: [],
          watchedDates: learningStats.watchedDates || [],
          watchedLessons: learningStats.watchedLessons || 0,
          streak: learningStats.streak || 0,
        })
      })

      const subcollectionJobs = examsSnap.docs.map(async (examDoc) => {
        const exam = { id: examDoc.id, ...(examDoc.data() || {}) }
        let results = Array.isArray(exam.studentResults) ? exam.studentResults : []

        try {
          const resultsSnap = await getDocs(collection(db, 'exams', examDoc.id, 'results'))
          const subResults = resultsSnap.docs.map((resultDoc) => ({ id: resultDoc.id, ...resultDoc.data() }))
          results = [...results, ...subResults]
        } catch (subError) {
          console.warn('Không thể tải results subcollection:', examDoc.id, subError)
        }

        return { examId: examDoc.id, results }
      })

      const examResults = await Promise.all(subcollectionJobs)

      examResults.forEach(({ examId, results }) => {
        results.forEach((result) => {
          const studentId = getResultStudentId(result)
          if (!studentId) return

          if (!studentMap.has(studentId)) {
            const name = getStudentName(result)
            const learningStats = learningStatsMap.get(studentId) || {}
            const firebaseClass = findFirebaseClassForStudent({ id: studentId, uid: studentId, ...result }, classList)
            const className = firebaseClass?.name || getStudentClass(result)

            studentMap.set(studentId, {
              id: studentId,
              uid: studentId,
              name,
              handle: getStudentHandle(result),
              school: getStudentSchool(result),
              grade: getStudentGrade(result),
              className,
              initial: String(name).trim().charAt(0).toUpperCase() || 'S',
              avatarClass: avatarClasses[studentMap.size % avatarClasses.length],
              resultItems: [],
              watchedDates: learningStats.watchedDates || [],
              watchedLessons: learningStats.watchedLessons || 0,
              streak: learningStats.streak || 0,
            })
          }

          const student = studentMap.get(studentId)
          const score = Number(result.score || result.totalScore || 0)
          const submitAt = toMillis(result.createdAt || result.submittedAt || result.updatedAt)

          student.resultItems.push({ examId, score, submitAt })
        })
      })

      setStudents(Array.from(studentMap.values()))
    } catch (loadError) {
      console.error(loadError)
      setError(loadError.message || 'Không thể tải bảng xếp hạng')
      setStudents([])
    } finally {
      setTimeout(() => setLoading(false))
    }
  }

  useEffect(() => {
    loadLeaderboard()
  }, [])

  const computedStudents = useMemo(() => {
    const { start, end } = getTimeWindowRange(activeTime, dateFrom, dateTo)
    const windowEnd = end || Date.now()
    const previousStart = start ? start - (windowEnd - start) : 0
    const previousEnd = start ? start : 0

    const allRows = students.map((student) => {
      const scopedItems = student.resultItems.filter((item) => {
        if (!start) return true
        return item.submitAt >= start && (!end || item.submitAt < end)
      })
      const previousItems = student.resultItems.filter((item) => previousStart && item.submitAt >= previousStart && item.submitAt < previousEnd)

      const bestByExam = {}
      scopedItems.forEach((item) => {
        const currentBest = bestByExam[item.examId]
        if (!currentBest || item.score > currentBest.score) bestByExam[item.examId] = item
      })

      const previousBestByExam = {}
      previousItems.forEach((item) => {
        const currentBest = previousBestByExam[item.examId]
        if (!currentBest || item.score > currentBest.score) previousBestByExam[item.examId] = item
      })

      const points = Object.values(bestByExam).reduce((total, item) => total + scoreToPoint(item.score), 0)
      const previousPoints = Object.values(previousBestByExam).reduce((total, item) => total + scoreToPoint(item.score), 0)
      const submissions = scopedItems.length
      const latestSubmitAt = scopedItems.reduce((max, item) => Math.max(max, item.submitAt), 0)
      const firstSubmitAt = scopedItems.reduce((min, item) => (item.submitAt ? Math.min(min, item.submitAt) : min), Number.MAX_SAFE_INTEGER)
      const averageScore = submissions ? scopedItems.reduce((total, item) => total + Number(item.score || 0), 0) / submissions : 0

      return {
        ...student,
        points,
        previousPoints,
        submissions,
        solved: Object.keys(bestByExam).length,
        latestSubmitAt,
        firstSubmitAt,
        averageScore,
      }
    })

    const sorted = allRows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      const timeA = a.firstSubmitAt ?? Number.MAX_SAFE_INTEGER
      const timeB = b.firstSubmitAt ?? Number.MAX_SAFE_INTEGER
      if (timeA !== timeB) return timeA - timeB
      if (b.solved !== a.solved) return b.solved - a.solved
      if (a.submissions !== b.submissions) return a.submissions - b.submissions
      return String(a.name).localeCompare(String(b.name), 'vi')
    })

    const ranked = rankRows(sorted)

    if (activeTime === 'all' && !dateFrom && !dateTo) {
      return ranked.map((student) => ({ ...student, rankDelta: 0 }))
    }

    const previousRanked = rankRows(
      [...allRows]
        .sort((a, b) => {
          if (b.previousPoints !== a.previousPoints) return b.previousPoints - a.previousPoints
          return String(a.name).localeCompare(String(b.name), 'vi')
        })
        .map((student) => ({ ...student, points: student.previousPoints })),
    )

    const previousRankById = new Map(previousRanked.map((student) => [student.id, student.rank]))

    return ranked.map((student) => {
      const previousRank = previousRankById.get(student.id) || student.rank
      return { ...student, rankDelta: previousRank - student.rank }
    })
  }, [students, activeTime, dateFrom, dateTo])

  const scopedRows = useMemo(() => {
    const rows = activeScope === 'student' ? computedStudents : aggregateGroups(computedStudents, activeScope, classes)

    return rankRows(
      [...rows].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        const timeA = a.firstSubmitAt ?? Number.MAX_SAFE_INTEGER
        const timeB = b.firstSubmitAt ?? Number.MAX_SAFE_INTEGER
        if (timeA !== timeB) return timeA - timeB
        return String(a.name).localeCompare(String(b.name), 'vi')
      }),
    )
  }, [computedStudents, activeScope, classes])

  const searchKeyword = normalizeSearchText(search)

  const visibleRows = useMemo(() => {
    if (!searchKeyword) return scopedRows

    return scopedRows.filter((student) => {
      return (
        normalizeSearchText(student.name).includes(searchKeyword) ||
        normalizeSearchText(student.handle).includes(searchKeyword) ||
        normalizeSearchText(student.school).includes(searchKeyword) ||
        normalizeSearchText(student.className).includes(searchKeyword)
      )
    })
  }, [scopedRows, searchKeyword])

  const { topThree, rest } = useMemo(() => {
    if (searchKeyword || activeScope !== 'student') {
      return { topThree: [], rest: visibleRows }
    }

    const rankOne = scopedRows.filter((student) => student.rank === 1)
    const rankTwo = scopedRows.filter((student) => student.rank === 2)
    const rankThree = scopedRows.filter((student) => student.rank === 3)

    if (rankOne.length >= 4) {
      return { topThree: [], rest: scopedRows }
    }

    let podium = []
    if (rankOne.length > 1) podium = rankOne.slice(0, 3)
    else if (rankOne.length === 1 && rankTwo.length > 1) podium = [...rankOne, ...rankTwo.slice(0, 2)]
    else if (rankOne.length === 1 && rankTwo.length === 1) podium = [...rankOne, ...rankTwo, ...rankThree.slice(0, 1)]
    else podium = scopedRows.slice(0, 3)

    const podiumIds = new Set(podium.map((student) => student.id))
    return { topThree: podium, rest: scopedRows.filter((student) => !podiumIds.has(student.id)) }
  }, [scopedRows, searchKeyword, visibleRows, activeScope])

  const totalSubmissions = computedStudents.reduce((total, student) => total + student.submissions, 0)
  const highestPoint = computedStudents.reduce((max, student) => Math.max(max, student.points), 0)
  const currentChampion = scopedRows.find((student) => student.rank === 1)
  const currentUserRow = scopedRows.find((student) => student.id === currentUserId || student.uid === currentUserId)

  if (loading) return <LoadingState dark={dark} />

  return (
    <div className={dark ? 'dark' : ''}>
      <section className="min-h-screen bg-slate-50 text-slate-950 transition dark:bg-slate-950 dark:text-white">
        <LeaderboardHeroBackground
          students={computedStudents}
          totalSubmissions={totalSubmissions}
          highestPoint={highestPoint}
          currentChampion={currentChampion}
        />

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="relative w-full lg:w-auto">
              <button
                type="button"
                onClick={() => setFilterOpen((current) => !current)}
                className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 lg:w-auto"
              >
                <Filter className="h-5 w-5 text-violet-600 dark:text-violet-300" />
                Lọc
                <ChevronDown className={`h-4 w-4 transition ${filterOpen ? 'rotate-180' : ''}`} />
              </button>

              <div
                className={`grid transition-all duration-300 ease-out ${
                  filterOpen ? 'mt-4 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="w-full rounded-[2rem] border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-200/70 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/30 lg:w-[760px]">
                    <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
                      <div>
                        <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                          Xếp theo
                        </p>
                        <div className="flex flex-wrap gap-3">
                          {scopeTabs.map((tab) => (
                            <button
                              key={tab.value}
                              type="button"
                              onClick={() => setActiveScope(tab.value)}
                              className={`rounded-2xl border px-5 py-3 text-sm font-black transition ${
                                activeScope === tab.value
                                  ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-300 hover:bg-blue-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                          Thời gian
                        </p>
                        <div className="flex flex-wrap gap-3">
                          {timeTabs.map((tab) => (
                            <button
                              key={tab.value}
                              type="button"
                              onClick={() => {
                                setActiveTime(tab.value)
                                setDateFrom('')
                                setDateTo('')
                              }}
                              className={`rounded-2xl border px-4 py-2.5 text-xs font-black transition ${
                                activeTime === tab.value && !dateFrom && !dateTo
                                  ? 'border-amber-400 bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/25'
                                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-amber-300 hover:bg-amber-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>

                        <label className="mt-4 block text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                          Chọn khoảng thời gian
                        </label>
                        <div className="mt-2 grid gap-3 sm:grid-cols-2">
                          <div>
                            <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                              Từ ngày
                            </span>
                            <input
                              type="date"
                              value={dateFrom}
                              max={dateTo || undefined}
                              onChange={(event) => {
                                setDateFrom(event.target.value)
                                setActiveTime('all')
                              }}
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 outline-none transition focus:border-amber-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
                            />
                          </div>

                          <div>
                            <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                              Đến ngày
                            </span>
                            <input
                              type="date"
                              value={dateTo}
                              min={dateFrom || undefined}
                              onChange={(event) => {
                                setDateTo(event.target.value)
                                setActiveTime('all')
                              }}
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 outline-none transition focus:border-amber-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
                            />
                          </div>
                        </div>

                        {(dateFrom || dateTo) && (
                          <button
                            type="button"
                            onClick={() => {
                              setDateFrom('')
                              setDateTo('')
                              setActiveTime('all')
                            }}
                            className="mt-3 rounded-xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15"
                          >
                            Xóa khoảng thời gian
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300 lg:w-96">
              <Search className="h-5 w-5 text-slate-400 dark:text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm học sinh, lớp, trường..."
                className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          <ProgressToNextRank student={currentUserRow} rankedStudents={scopedRows} />

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </div>
          )}

          {!visibleRows.length ? (
            <EmptyState onReload={loadLeaderboard} />
          ) : (
            <>
              {!searchKeyword && activeScope === 'student' && topThree.length > 0 && <PodiumStage topThree={topThree} onOpenProfile={setSelectedStudent} />}

              <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:shadow-2xl dark:shadow-black/20">
                <div className="grid grid-cols-[90px_1.45fr_130px_120px_120px_120px] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 max-lg:hidden">
                  <span>Hạng</span>
                  <span>{activeScope === 'student' ? 'Học sinh' : activeScope === 'class' ? 'Lớp' : 'Trường'}</span>
                  <span>{activeScope === 'class' ? 'Thành viên' : 'Lớp'}</span>
                  <span>Số bài</span>
                  <span>TB</span>
                  <span className="text-right">Điểm</span>
                </div>

                <div className="divide-y divide-slate-200 dark:divide-white/10">
                  {rest.map((student) => {
                    const isMe = activeScope === 'student' && (student.id === currentUserId || student.uid === currentUserId)
                    const badges = getBadgeList(student)

                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => activeScope === 'student' && setSelectedStudent(student)}
                        className={`grid w-full gap-4 px-6 py-4 text-left text-sm font-semibold text-slate-600 transition dark:text-slate-300 lg:grid-cols-[90px_1.45fr_130px_120px_120px_120px] lg:items-center ${
                          isMe
                            ? 'bg-cyan-50 ring-2 ring-inset ring-cyan-300 dark:bg-cyan-400/10 dark:ring-cyan-300/40'
                            : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <RankBadge rank={student.rank} />
                          {activeScope === 'student' && <TrendBadge delta={student.rankDelta} />}
                        </div>

                        <div className="flex min-w-0 items-center gap-4">
                          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black ${student.avatarClass}`}>
                            {student.initial}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-black text-slate-950 dark:text-white">
                              {student.name}
                              {isMe && <span className="ml-2 rounded-full bg-cyan-500 px-2 py-0.5 text-[10px] text-white">Bạn</span>}
                            </p>
                            <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                              <span className="text-blue-600 dark:text-blue-300">{student.handle}</span>
                              <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
                              {activeScope === 'student' ? student.school : `${student.memberCount || 0} thành viên`}
                            </p>
                            {activeScope === 'student' && badges.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {badges.map((badge) => {
                                  const Icon = badge.icon
                                  return (
                                    <span key={badge.label} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${badge.className}`}>
                                      <Icon className="h-3 w-3" />
                                      {badge.label}
                                    </span>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <span className="inline-flex rounded-full bg-cyan-100 px-3 py-1 text-xs font-black text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300">
                            {activeScope === 'class' ? `${student.memberCount || 0} thành viên` : `• Lớp ${student.className || '—'}`}
                          </span>
                        </div>

                        <div>
                          <p className="text-base font-black text-slate-950 dark:text-white">{student.submissions}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-500">bài làm</p>
                        </div>

                        <div>
                          <p className="text-base font-black text-emerald-700 dark:text-emerald-200">{student.averageScore.toFixed(1)}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-500">điểm TB</p>
                        </div>

                        <div className="lg:text-right">
                          <p className="text-lg font-black text-blue-700 dark:text-blue-200">{student.points}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-500">điểm</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {!rest.length && (
                <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm font-bold text-slate-500 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
                  <Sparkles className="mx-auto mb-3 h-8 w-8 text-violet-300" />
                  Chưa đủ dữ liệu để hiển thị bảng chi tiết phía dưới.
                </div>
              )}
            </>
          )}
        </main>

        <ProfileModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />
      </section>
    </div>
  )
}

export default Leaderboard

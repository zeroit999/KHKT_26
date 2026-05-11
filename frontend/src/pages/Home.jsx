import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  Play,
  Rocket,
  Star,
  Trophy,
  UsersRound,
} from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { exams, featureCards, leaderboardRows, progressData, subjects } from '../data/mockData.js'
import GlassCard from '../components/ui/GlassCard.jsx'
import GradientButton from '../components/ui/GradientButton.jsx'
import SectionHeader from '../components/ui/SectionHeader.jsx'

function HeroPreview() {
  return (
    <div className="hero-scene" aria-hidden="true">
      <motion.div
        className="hero-panel hero-panel-main"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-200">CBT trực tiếp</span>
          <span className="flex items-center gap-1 rounded-lg bg-orange-400/15 px-2 py-1 text-xs font-bold text-orange-500">
            <Clock3 className="h-3 w-3" />
            42:18
          </span>
        </div>
        <div className="mt-5 h-3 w-3/4 rounded bg-slate-200 dark:bg-white/15" />
        <div className="mt-3 h-3 w-1/2 rounded bg-slate-200 dark:bg-white/15" />
        <div className="mt-6 grid gap-3">
          {['A', 'B', 'C'].map((item, index) => (
            <span
              key={item}
              className={`flex h-11 items-center rounded-lg border px-3 text-sm font-bold ${
                index === 1
                  ? 'border-cyan-300 bg-cyan-400/15 text-cyan-700 dark:text-cyan-100'
                  : 'border-slate-200 bg-white/70 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
              }`}
            >
              {item}. Phương án trả lời
            </span>
          ))}
        </div>
      </motion.div>
      <motion.div
        className="hero-panel hero-panel-score"
        animate={{ y: [0, 12, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <p className="text-sm font-bold text-slate-500 dark:text-slate-300">Điểm dự kiến</p>
        <p className="mt-1 text-4xl font-black text-cyan-600 dark:text-cyan-200">8.7</p>
        <div className="mt-3 h-16">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={progressData}>
              <Area type="monotone" dataKey="score" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.22} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
      <motion.div
        className="hero-panel hero-panel-rank"
        animate={{ x: [0, 8, 0] }}
        transition={{ duration: 5.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Trophy className="h-6 w-6 text-amber-400" />
        <div>
          <p className="text-sm font-bold text-slate-950 dark:text-white">Top 8%</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">toàn hệ thống</p>
        </div>
      </motion.div>
    </div>
  )
}

function Home() {
  return (
    <>
      <section className="relative min-h-[calc(100vh-80px)] overflow-hidden px-4 pb-10 pt-16 sm:px-6 lg:px-8">
        <HeroPreview />
        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 lg:min-h-[650px] lg:grid-cols-[1fr_0.9fr]">
          <div className="max-w-3xl">
            <motion.div
              className="mb-5 inline-flex items-center gap-2 rounded-lg border border-cyan-300/30 bg-white/70 px-4 py-2 text-sm font-bold text-cyan-700 shadow-soft backdrop-blur dark:bg-white/10 dark:text-cyan-200"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Rocket className="h-4 w-4" />
              Startup EdTech cho học sinh THPT
            </motion.div>
            <motion.h1
              className="max-w-4xl text-5xl font-black tracking-tight text-slate-950 dark:text-white sm:text-6xl lg:text-7xl"
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
            >
              Luyện thi online chuẩn CBT, học tập thông minh hơn mỗi ngày.
            </motion.h1>
            <motion.p
              className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300"
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
            >
              Giao diện thi thử, dashboard tiến độ, phân tích kết quả và bảng xếp hạng được thiết kế cho trải nghiệm
              ôn thi THPT hiện đại.
            </motion.p>
            <motion.div
              className="mt-8 flex flex-col gap-3 sm:flex-row"
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
            >
              <Link to="/exams">
                <GradientButton icon={Play}>Bắt đầu luyện thi</GradientButton>
              </Link>
              <Link to="/dashboard">
                <GradientButton variant="subtle" icon={BarChart3}>
                  Xem dashboard
                </GradientButton>
              </Link>
            </motion.div>
            <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
              {[
                ['120K+', 'lượt làm bài'],
                ['94%', 'hài lòng UI'],
                ['24/7', 'học demo'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-lg border border-white/60 bg-white/70 p-4 backdrop-blur dark:border-white/10 dark:bg-white/10">
                  <p className="text-2xl font-black text-slate-950 dark:text-white">{value}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden lg:block" />
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Tính năng nổi bật"
            title="Một hệ sinh thái luyện thi có cảm giác như sản phẩm thật"
            description="Tất cả trạng thái trong bản này là giao diện mô phỏng, tập trung vào trải nghiệm, layout và animation."
          />
          <div className="grid gap-4 md:grid-cols-3">
            {featureCards.map((feature, index) => (
              <GlassCard key={feature.title} delay={index * 0.08}>
                <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-600 dark:text-cyan-200">
                  <feature.icon className="h-6 w-6" />
                </span>
                <h3 className="text-xl font-bold text-slate-950 dark:text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{feature.description}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader eyebrow="Môn học" title="Subject cards cho lộ trình THPT" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject, index) => (
              <GlassCard key={subject.name} delay={index * 0.05} className="group">
                <div className="flex items-start justify-between gap-4">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${subject.color} text-white`}>
                    <subject.icon className="h-6 w-6" />
                  </span>
                  <span className="rounded-lg bg-white/70 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    {subject.exams} đề
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-bold text-slate-950 dark:text-white">{subject.name}</h3>
                <div className="mt-4 h-2 overflow-hidden rounded bg-slate-200 dark:bg-white/10">
                  <span
                    className={`block h-full rounded bg-gradient-to-r ${subject.color} transition-all duration-500 group-hover:w-full`}
                    style={{ width: `${subject.progress}%` }}
                  />
                </div>
                <p className="mt-3 text-sm font-semibold text-cyan-700 dark:text-cyan-200">{subject.progress}% mục tiêu tuần</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <GlassCard className="p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-300">
                  Xem trước dashboard
                </p>
                <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">Tiến độ học tập rõ ràng</h2>
              </div>
              <BookOpenCheck className="h-8 w-8 text-cyan-500" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {['Điểm TB 8.4', 'Streak 12 ngày', '34 bài thi'].map((item) => (
                <div key={item} className="rounded-lg border border-white/60 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <CheckCircle2 className="mb-3 h-5 w-5 text-cyan-500" />
                  <p className="font-bold text-slate-950 dark:text-white">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={progressData}>
                  <defs>
                    <linearGradient id="homeScore" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <Area dataKey="score" type="monotone" stroke="#22d3ee" strokeWidth={3} fill="url(#homeScore)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-950 dark:text-white">Xem trước bảng xếp hạng</h2>
              <Trophy className="h-7 w-7 text-amber-400" />
            </div>
            <div className="space-y-3">
              {leaderboardRows.slice(0, 4).map((row) => (
                <div key={row.rank} className="flex items-center gap-3 rounded-lg border border-white/60 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-300 to-blue-600 text-sm font-black text-white">
                    {row.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-950 dark:text-white">{row.name}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{row.school}</p>
                  </div>
                  <p className="font-black text-cyan-700 dark:text-cyan-200">{row.score}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <GlassCard className="overflow-hidden p-0">
            <div className="grid gap-6 p-6 lg:grid-cols-[1fr_0.8fr] lg:p-10">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-lg bg-cyan-400/15 px-4 py-2 text-sm font-bold text-cyan-700 dark:text-cyan-200">
                  <Star className="h-4 w-4" />
                  Khu E-Learning
                </div>
                <h2 className="text-3xl font-black text-slate-950 dark:text-white md:text-4xl">Khu học liệu đang được nâng cấp</h2>
                <p className="mt-4 max-w-2xl text-slate-600 dark:text-slate-300">
                  Các trang khóa học sẽ hiển thị trạng thái bảo trì đúng yêu cầu, không dùng dữ liệu khóa học giả.
                </p>
                <Link to="/courses" className="mt-6 inline-flex">
                  <GradientButton icon={ArrowRight}>Xem trạng thái E-Learning</GradientButton>
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {exams.slice(0, 2).map((exam) => (
                  <div key={exam.id} className="rounded-lg border border-white/60 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                    <UsersRound className="mb-4 h-6 w-6 text-cyan-500" />
                    <p className="font-bold text-slate-950 dark:text-white">{exam.subject}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{exam.attempts.toLocaleString('vi-VN')} lượt thi</p>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>
      </section>
    </>
  )
}

export default Home

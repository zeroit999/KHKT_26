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

import {
  Area,
  AreaChart,
  ResponsiveContainer,
} from 'recharts'

import {
  exams,
  featureCards,
  leaderboardRows,
  progressData,
  subjects,
} from '../data/mockData.js'

import GlassCard from '../components/ui/GlassCard.jsx'
import GradientButton from '../components/ui/GradientButton.jsx'
import SectionHeader from '../components/ui/SectionHeader.jsx'

function HeroPreview() {
  return (
    <div
      className="hero-scene"
      aria-hidden="true"
    >
      {/* MAIN PANEL */}
      <motion.div
        className="hero-panel hero-panel-main"
        animate={{
          y: [0, -10, 0],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-200">
            CBT trực tiếp
          </span>

          <span className="flex items-center gap-1 rounded-lg bg-orange-400/15 px-2 py-1 text-xs font-bold text-orange-500">
            <Clock3 className="h-3 w-3" />
            42:18
          </span>
        </div>

        <div className="mt-5 h-3 w-3/4 rounded bg-slate-200 dark:bg-white/15" />

        <div className="mt-3 h-3 w-1/2 rounded bg-slate-200 dark:bg-white/15" />

        <div className="mt-6 grid gap-3">
          {['A', 'B', 'C'].map(
            (
              item,
              index
            ) => (
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
            )
          )}
        </div>
      </motion.div>

      {/* SCORE PANEL */}
      <motion.div
        className="hero-panel hero-panel-score"
        animate={{
          y: [0, 12, 0],
        }}
        transition={{
          duration: 4.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <p className="text-sm font-bold text-slate-500 dark:text-slate-300">
          Điểm dự kiến
        </p>

        <p className="mt-1 text-4xl font-black text-cyan-600 dark:text-cyan-200">
          8.7
        </p>

        {/* FIX RECHART */}
        <div className="mt-3 w-full overflow-hidden rounded-xl">
          <div className="h-[120px] w-full min-w-0">
            <ResponsiveContainer
              width="99%"
              height={120}
            >
              <AreaChart data={progressData}>
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#22d3ee"
                  fill="#22d3ee"
                  fillOpacity={0.22}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>

      {/* RANK PANEL */}
      <motion.div
        className="hero-panel hero-panel-rank"
        animate={{
          x: [0, 8, 0],
        }}
        transition={{
          duration: 5.8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <Trophy className="h-6 w-6 text-amber-400" />

        <div>
          <p className="text-sm font-bold text-slate-950 dark:text-white">
            Top 8%
          </p>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            toàn hệ thống
          </p>
        </div>
      </motion.div>
    </div>
  )
}

function Home() {
  return (
    <>
      {/* HERO */}
      <section className="relative min-h-[calc(100vh-80px)] overflow-hidden px-4 pb-10 pt-16 sm:px-6 lg:px-8">
        <HeroPreview />

        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 lg:min-h-[650px] lg:grid-cols-[1fr_0.9fr]">
          <div className="max-w-3xl">
            {/* BADGE */}
            <motion.div
              className="mb-5 inline-flex items-center gap-2 rounded-lg border border-cyan-300/30 bg-white/70 px-4 py-2 text-sm font-bold text-cyan-700 shadow-soft backdrop-blur dark:bg-white/10 dark:text-cyan-200"
              initial={{
                opacity: 0,
                y: 16,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
            >
              <Rocket className="h-4 w-4" />
              Startup EdTech cho học sinh THPT
            </motion.div>

            {/* TITLE */}
            <motion.h1
              className="max-w-4xl text-5xl font-black tracking-tight text-slate-950 dark:text-white sm:text-6xl lg:text-7xl"
              initial={{
                opacity: 0,
                y: 22,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: 0.08,
              }}
            >
              Luyện thi online chuẩn CBT,
              học tập thông minh hơn mỗi ngày.
            </motion.h1>

            {/* DESCRIPTION */}
            <motion.p
              className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300"
              initial={{
                opacity: 0,
                y: 22,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: 0.16,
              }}
            >
              Giao diện thi thử,
              dashboard tiến độ,
              phân tích kết quả và
              bảng xếp hạng được
              thiết kế cho trải nghiệm
              ôn thi THPT hiện đại.
            </motion.p>

            {/* BUTTONS */}
            <motion.div
              className="mt-8 flex flex-col gap-3 sm:flex-row"
              initial={{
                opacity: 0,
                y: 22,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: 0.24,
              }}
            >
              <Link to="/exams">
                <GradientButton icon={Play}>
                  Bắt đầu luyện thi
                </GradientButton>
              </Link>
            </motion.div>
          </div>

          <div className="hidden lg:block" />
        </div>
      </section>
    </>
  )
}

export default Home
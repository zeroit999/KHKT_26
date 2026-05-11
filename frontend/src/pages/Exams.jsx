import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Clock3, FileCheck2, Filter, Search, ShieldCheck, UsersRound } from 'lucide-react'
import { exams, subjects } from '../data/mockData.js'
import GlassCard from '../components/ui/GlassCard.jsx'
import GradientButton from '../components/ui/GradientButton.jsx'
import SectionHeader from '../components/ui/SectionHeader.jsx'

function Exams() {
  return (
    <section className="px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.34fr]">
          <div>
            <SectionHeader
              eyebrow="Kho đề thi"
              title="Luyện thi CBT với trải nghiệm như phòng thi thật"
              description="Danh sách đề thi dùng dữ liệu mô phỏng để trình diễn layout, trạng thái và tương tác frontend."
            />
            <div className="mb-6 flex flex-col gap-3 rounded-lg border border-white/60 bg-white/70 p-3 backdrop-blur dark:border-white/10 dark:bg-white/5 sm:flex-row">
              <label className="flex min-h-12 flex-1 items-center gap-3 rounded-lg bg-white px-4 text-sm font-semibold text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                <Search className="h-5 w-5 text-cyan-500" />
                <input
                  className="w-full bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
                  placeholder="Tìm đề thi, môn học, chủ đề"
                />
              </label>
              <button
                type="button"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-cyan-300/35 px-4 text-sm font-bold text-cyan-700 transition hover:bg-cyan-400/10 dark:text-cyan-200"
              >
                <Filter className="h-4 w-4" />
                Bộ lọc
              </button>
            </div>
          </div>

          <GlassCard className="p-5" delay={0.1}>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-300">Trạng thái</p>
            <div className="mt-5 grid gap-3">
              {[
                ['156', 'đề thi UI'],
                ['6', 'môn trọng tâm'],
                ['90 phút', 'CBT dài nhất'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-lg bg-white/70 p-4 dark:bg-white/5">
                  <p className="text-2xl font-black text-slate-950 dark:text-white">{value}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {exams.map((exam, index) => (
            <GlassCard key={exam.id} delay={index * 0.08} className="group overflow-hidden">
              <div className={`-mx-5 -mt-5 mb-5 h-2 bg-gradient-to-r ${exam.accent}`} />
              <div className="mb-5 flex items-start justify-between gap-4">
                <span className="rounded-lg bg-cyan-400/15 px-3 py-1 text-xs font-bold text-cyan-700 dark:text-cyan-200">
                  {exam.tag}
                </span>
                <span className="rounded-lg bg-white/70 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                  {exam.level}
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-950 dark:text-white">{exam.title}</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{exam.subject}</p>
              <div className="mt-6 grid grid-cols-3 gap-2">
                {[
                  [Clock3, `${exam.duration}p`],
                  [FileCheck2, `${exam.questions} câu`],
                  [UsersRound, exam.attempts.toLocaleString('vi-VN')],
                ].map(([Icon, label]) => (
                  <div key={label} className="rounded-lg bg-white/70 p-3 text-center dark:bg-white/5">
                    <Icon className="mx-auto mb-2 h-4 w-4 text-cyan-500" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <div className="mb-2 flex justify-between text-sm font-semibold">
                  <span className="text-slate-500 dark:text-slate-400">Hoàn thành trung bình</span>
                  <span className="text-cyan-700 dark:text-cyan-200">{exam.completion}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-slate-200 dark:bg-white/10">
                  <motion.span
                    className={`block h-full rounded bg-gradient-to-r ${exam.accent}`}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${exam.completion}%` }}
                    viewport={{ once: true }}
                  />
                </div>
              </div>
              <Link to={`/exam/${exam.id}`} className="mt-6 flex">
                <GradientButton className="w-full" icon={ArrowRight}>
                  Vào phòng thi
                </GradientButton>
              </Link>
            </GlassCard>
          ))}
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {subjects.map((subject) => (
            <div
              key={subject.name}
              className="rounded-lg border border-white/60 bg-white/70 p-4 text-center backdrop-blur transition hover:-translate-y-1 hover:border-cyan-300 dark:border-white/10 dark:bg-white/5"
            >
              <subject.icon className="mx-auto h-6 w-6 text-cyan-500" />
              <p className="mt-3 text-sm font-bold text-slate-950 dark:text-white">{subject.name}</p>
            </div>
          ))}
        </div>

        <GlassCard className="mt-12 grid gap-5 p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-300">
              <ShieldCheck className="h-4 w-4" />
              Lời mời thi thử
            </p>
            <h2 className="text-2xl font-black text-slate-950 dark:text-white">Sẵn sàng thử giao diện CBT?</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-300">Chọn đề đầu tiên để xem sidebar câu hỏi, timer, modal nộp bài và trạng thái chọn đáp án.</p>
          </div>
          <Link to={`/exam/${exams[0].id}`}>
            <GradientButton icon={ArrowRight}>Mở CBT mô phỏng</GradientButton>
          </Link>
        </GlassCard>
      </div>
    </section>
  )
}

export default Exams

import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, BookOpenCheck, CalendarCheck2, Clock3, Flame, PlayCircle } from 'lucide-react'
import { dashboardStats, exams, progressData } from '../data/mockData.js'
import MetricCard from '../components/dashboard/MetricCard.jsx'
import GlassCard from '../components/ui/GlassCard.jsx'
import GradientButton from '../components/ui/GradientButton.jsx'
import SectionHeader from '../components/ui/SectionHeader.jsx'

function Dashboard() {
  return (
    <section className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Dashboard học sinh"
          title="Theo dõi tiến độ luyện thi theo thời gian thực"
          description="Các số liệu bên dưới là dữ liệu mô phỏng để trình diễn giao diện dashboard học sinh."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {dashboardStats.map((item, index) => (
            <MetricCard key={item.label} {...item} delay={index * 0.06} />
          ))}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
          <GlassCard className="p-6">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950 dark:text-white">Biểu đồ tiến độ</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Điểm số và thời lượng học trong tuần</p>
              </div>
              <span className="rounded-lg bg-cyan-400/15 px-3 py-1 text-sm font-bold text-cyan-700 dark:text-cyan-200">
                +14% hiệu suất
              </span>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={progressData}>
                  <defs>
                    <linearGradient id="dashboardScore" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.22)" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 12 }} domain={[0, 10]} />
                  <Tooltip />
                  <Area dataKey="score" type="monotone" stroke="#22d3ee" strokeWidth={3} fill="url(#dashboardScore)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <h2 className="mb-5 text-2xl font-black text-slate-950 dark:text-white">Learning streak</h2>
            <div className="rounded-lg border border-orange-300/25 bg-orange-400/10 p-5">
              <Flame className="mb-4 h-9 w-9 text-orange-500" />
              <p className="text-5xl font-black text-slate-950 dark:text-white">12</p>
              <p className="mt-2 font-semibold text-orange-500">ngày liên tiếp</p>
            </div>
            <div className="mt-5 grid grid-cols-7 gap-2">
              {progressData.map((day, index) => (
                <div key={day.name} className="text-center">
                  <span
                    className={`mx-auto block h-10 rounded-lg ${
                      index < 6 ? 'bg-gradient-to-t from-cyan-500 to-blue-400' : 'bg-slate-200 dark:bg-white/10'
                    }`}
                  />
                  <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">{day.name}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <GlassCard className="p-6">
            <h2 className="mb-5 text-2xl font-black text-slate-950 dark:text-white">Activity cards</h2>
            <div className="space-y-3">
              {[
                [BookOpenCheck, 'Hoàn thành đề Toán mô phỏng', '8.4 điểm • 42 phút'],
                [CalendarCheck2, 'Duy trì streak học tập', '12 ngày liên tiếp'],
                [Clock3, 'Ôn lại câu sai', '6 câu cần xem lại'],
              ].map(([Icon, title, detail]) => (
                <div key={title} className="flex items-center gap-3 rounded-lg border border-white/60 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-600 dark:text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-bold text-slate-950 dark:text-white">{title}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950 dark:text-white">Tiếp tục học</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Tiếp tục với các đề thi đã mở gần đây</p>
              </div>
              <Link to="/exams">
                <GradientButton variant="subtle" icon={ArrowRight}>
                  Kho đề
                </GradientButton>
              </Link>
            </div>
            <div className="grid gap-3">
              {exams.map((exam) => (
                <div key={exam.id} className="grid gap-4 rounded-lg border border-white/60 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="font-bold text-slate-950 dark:text-white">{exam.title}</p>
                    <div className="mt-3 h-2 overflow-hidden rounded bg-slate-200 dark:bg-white/10">
                      <span className={`block h-full rounded bg-gradient-to-r ${exam.accent}`} style={{ width: `${exam.completion}%` }} />
                    </div>
                  </div>
                  <Link to={`/exam/${exam.id}`}>
                    <GradientButton icon={PlayCircle}>Tiếp tục</GradientButton>
                  </Link>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        <GlassCard className="mt-6 p-6">
          <h2 className="mb-5 text-2xl font-black text-slate-950 dark:text-white">Thời lượng học</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.22)" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="time" fill="#38bdf8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
    </section>
  )
}

export default Dashboard

import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { exams, progressData, questions, resultBreakdown, skillRadar } from '../data/mockData.js'
import GlassCard from '../components/ui/GlassCard.jsx'
import GradientButton from '../components/ui/GradientButton.jsx'

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 26 }).map((_, index) => (
        <span
          key={index}
          className="confetti-piece"
          style={{
            '--delay': `${index * 0.04}s`,
            '--left': `${(index * 13) % 100}%`,
            '--color': ['#22d3ee', '#60a5fa', '#f59e0b', '#34d399'][index % 4],
          }}
        />
      ))}
    </div>
  )
}

function ResultPage() {
  const { id } = useParams()
  const exam = exams.find((item) => item.id === id) ?? exams[0]

  return (
    <section className="relative px-4 py-10 sm:px-6 lg:px-8">
      <Confetti />
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 grid gap-5 lg:grid-cols-[1fr_0.8fr] lg:items-stretch">
          <GlassCard className="relative overflow-hidden p-7">
            <div className="absolute inset-0 bg-[linear-gradient(130deg,rgba(34,211,238,0.14),transparent_48%,rgba(37,99,235,0.16))]" />
            <div className="relative z-10">
              <p className="mb-3 inline-flex items-center gap-2 rounded-lg bg-cyan-400/15 px-4 py-2 text-sm font-bold text-cyan-700 dark:text-cyan-200">
                <Sparkles className="h-4 w-4" />
                Kết quả mô phỏng
              </p>
              <h1 className="text-3xl font-black text-slate-950 dark:text-white md:text-5xl">{exam.title}</h1>
              <div className="mt-8 grid gap-4 sm:grid-cols-4">
                {[
                  ['8.4', 'Điểm số'],
                  ['42', 'Câu đúng'],
                  ['6', 'Câu sai'],
                  ['2', 'Bỏ trống'],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-lg border border-white/60 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="text-3xl font-black text-slate-950 dark:text-white">{value}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-950 dark:text-white">Tỉ lệ đáp án</h2>
              <Target className="h-6 w-6 text-cyan-500" />
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={resultBreakdown} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={4}>
                    {resultBreakdown.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <GlassCard className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <BrainCircuit className="h-7 w-7 text-cyan-500" />
              <h2 className="text-2xl font-black text-slate-950 dark:text-white">Phân tích AI mô phỏng</h2>
            </div>
            <div className="space-y-4">
              {[
                ['Điểm mạnh', 'Tốc độ xử lý câu đại số tốt, ít mất điểm ở câu nhận biết.'],
                ['Cần cải thiện', 'Nên luyện thêm câu vận dụng cao và đọc kỹ dữ kiện hình học.'],
                ['Gợi ý tiếp theo', 'Làm một đề 60 phút, sau đó xem lại nhóm câu sai trong 20 phút.'],
              ].map(([title, text], index) => (
                <motion.div
                  key={title}
                  className="rounded-lg border border-white/60 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5"
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                >
                  <p className="mb-1 flex items-center gap-2 font-bold text-slate-950 dark:text-white">
                    <Lightbulb className="h-4 w-4 text-cyan-500" />
                    {title}
                  </p>
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{text}</p>
                </motion.div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <h2 className="mb-5 text-2xl font-black text-slate-950 dark:text-white">Biểu đồ năng lực</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={skillRadar}>
                  <PolarGrid stroke="rgba(148, 163, 184, 0.35)" />
                  <PolarAngleAxis dataKey="skill" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Radar dataKey="value" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.28} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        <GlassCard className="mt-5 p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 text-2xl font-black text-slate-950 dark:text-white">
              <ClipboardList className="h-6 w-6 text-cyan-500" />
              Chi tiết đáp án
            </h2>
            <div className="h-40 w-full max-w-md">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={progressData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.22)" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis hide domain={[0, 10]} />
                  <Tooltip />
                  <Bar dataKey="score" fill="#22d3ee" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid gap-3">
            {questions.slice(0, 5).map((question, index) => {
              const correct = index !== 3
              return (
                <div key={question.id} className="rounded-lg border border-white/60 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-start gap-3">
                    {correct ? <CheckCircle2 className="mt-1 h-5 w-5 text-cyan-500" /> : <XCircle className="mt-1 h-5 w-5 text-orange-500" />}
                    <div>
                      <p className="font-bold text-slate-950 dark:text-white">
                        Câu {index + 1}: {question.question}
                      </p>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{question.explanation}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link to={`/exam/${exam.id}`}>
              <GradientButton variant="subtle" icon={RotateCcw}>
                Làm lại
              </GradientButton>
            </Link>
            <Link to="/dashboard">
              <GradientButton icon={ArrowRight}>Về dashboard</GradientButton>
            </Link>
          </div>
        </GlassCard>
      </div>
    </section>
  )
}

export default ResultPage

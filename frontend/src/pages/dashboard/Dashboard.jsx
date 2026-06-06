// import MaintenanceState from '../../components/ui/MaintenanceState.jsx'

// function Dashboard() {
//   return (
//     <MaintenanceState
//       badge="Dashboard"
//       title="Đang bảo trì"
//       subtitle="Dữ liệu dashboard đang được cập nhật"
//       description="Vui lòng quay lại sau"
//     />
//   )
// }

// export default Dashboard


import { useState } from 'react'
import { BarChart3, Database, Filter, MoreHorizontal, Plus, Search, UploadCloud, UsersRound } from 'lucide-react'
import { adminQuestions, progressData } from '../../data/mockData.js'
import UploadModal from '../../components/admin/UploadModal.jsx'
import GlassCard from '../../components/ui/GlassCard.jsx'
import GradientButton from '../../components/ui/GradientButton.jsx'
import SectionHeader from '../../components/ui/SectionHeader.jsx'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function AdminDashboard() {
  const [uploadOpen, setUploadOpen] = useState(false)

  return (
    <section className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <SectionHeader
            eyebrow="Giao diện quản trị"
            title="Quản trị ngân hàng câu hỏi và thống kê hệ thống"
            description="Chỉ là giao diện admin dashboard, không upload thật và không gọi backend."
          />
          <GradientButton icon={UploadCloud} onClick={() => setUploadOpen(true)}>
            Tải câu hỏi
          </GradientButton>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [Database, '12.480', 'Câu hỏi trong kho'],
            [UsersRound, '8.920', 'Học sinh hoạt động'],
            [BarChart3, '76%', 'Tỉ lệ hoàn thành'],
            [UploadCloud, '24', 'File đang xử lý'],
          ].map(([Icon, value, label], index) => (
            <GlassCard key={label} delay={index * 0.06}>
              <Icon className="mb-4 h-7 w-7 text-cyan-500" />
              <p className="text-3xl font-black text-slate-950 dark:text-white">{value}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
            </GlassCard>
          ))}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <GlassCard className="p-5">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950 dark:text-white">Bảng câu hỏi</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Tìm kiếm, bộ lọc, phân trang và trạng thái bảng câu hỏi</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="flex min-h-11 items-center gap-2 rounded-lg bg-white px-3 text-sm text-slate-500 dark:bg-slate-950/60">
                  <Search className="h-4 w-4 text-cyan-500" />
                  <input className="w-full bg-transparent outline-none" placeholder="Tìm câu hỏi" />
                </label>
                <button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-cyan-300/35 px-4 text-sm font-bold text-cyan-700 dark:text-cyan-200">
                  <Filter className="h-4 w-4" />
                  Lọc
                </button>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
              <div className="hidden grid-cols-[110px_1fr_120px_120px_110px_44px] bg-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:bg-white/10 dark:text-slate-400 lg:grid">
                <span>Mã</span>
                <span>Nội dung</span>
                <span>Môn</span>
                <span>Mức độ</span>
                <span>Trạng thái</span>
                <span />
              </div>
              <div className="divide-y divide-slate-200 dark:divide-white/10">
                {adminQuestions.map((question) => (
                  <div key={question.id} className="grid gap-2 px-4 py-4 lg:grid-cols-[110px_1fr_120px_120px_110px_44px] lg:items-center">
                    <p className="font-black text-cyan-700 dark:text-cyan-200">{question.id}</p>
                    <p className="font-bold text-slate-950 dark:text-white">{question.title}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{question.subject}</p>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{question.level}</p>
                    <span className="w-fit rounded-lg bg-cyan-400/15 px-3 py-1 text-xs font-bold text-cyan-700 dark:text-cyan-200">
                      {question.status}
                    </span>
                    <button type="button" className="rounded-lg p-2 text-slate-500 transition hover:bg-white/70 dark:hover:bg-white/10" aria-label="Thêm tùy chọn">
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">Trang 1 trong 8</p>
              <div className="flex gap-2">
                {[1, 2, 3].map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={`h-10 w-10 rounded-lg text-sm font-black ${
                      page === 1
                        ? 'bg-cyan-400 text-white'
                        : 'bg-white/70 text-slate-600 hover:bg-cyan-400/10 dark:bg-white/10 dark:text-slate-300'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
            </div>
          </GlassCard>

          <div className="space-y-5">
            <GlassCard className="p-5">
              <h2 className="mb-5 text-2xl font-black text-slate-950 dark:text-white">Thẻ phân tích</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={progressData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.22)" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="time" fill="#22d3ee" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <h2 className="mb-4 text-2xl font-black text-slate-950 dark:text-white">Khu tải lên kéo thả</h2>
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-cyan-300/55 bg-cyan-400/10 p-8 text-center transition hover:bg-cyan-400/15"
              >
                <Plus className="mb-3 h-8 w-8 text-cyan-500" />
                <span className="font-bold text-slate-950 dark:text-white">Thêm file câu hỏi</span>
                <span className="mt-1 text-sm text-slate-500 dark:text-slate-400">Thanh tiến độ nằm trong modal</span>
              </button>
            </GlassCard>
          </div>
        </div>
      </div>
      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </section>
  )
}

export default AdminDashboard

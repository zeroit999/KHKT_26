import { useState } from 'react'
import { Flame, Medal, Trophy, UsersRound } from 'lucide-react'
import { leaderboardRows } from '../data/mockData.js'
import LeaderboardTable from '../components/leaderboard/LeaderboardTable.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import GlassCard from '../components/ui/GlassCard.jsx'
import GradientButton from '../components/ui/GradientButton.jsx'
import SectionHeader from '../components/ui/SectionHeader.jsx'

function Leaderboard() {
  const [emptyMode, setEmptyMode] = useState(false)
  const rows = emptyMode ? [] : leaderboardRows

  return (
    <section className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <SectionHeader
            eyebrow="Bảng xếp hạng"
            title="Bảng xếp hạng học sinh"
            description="Huy hiệu thứ hạng, bảng điểm và animation được dựng bằng dữ liệu mô phỏng frontend."
          />
          <GradientButton variant="subtle" onClick={() => setEmptyMode((value) => !value)}>
            {emptyMode ? 'Hiển thị dữ liệu mô phỏng' : 'Xem trạng thái trống'}
          </GradientButton>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="Dữ liệu đang cập nhật" description="Vui lòng quay lại sau" icon={Trophy} />
        ) : (
          <>
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              {rows.slice(0, 3).map((student, index) => (
                <GlassCard key={student.rank} delay={index * 0.08} className={index === 0 ? 'md:-translate-y-3' : ''}>
                  <div className="mb-4 flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-amber-300 to-cyan-400 text-slate-950">
                      <Medal className="h-6 w-6" />
                    </span>
                    <span className="text-3xl font-black text-cyan-700 dark:text-cyan-200">#{student.rank}</span>
                  </div>
                  <h2 className="text-xl font-black text-slate-950 dark:text-white">{student.name}</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{student.school}</p>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-white/70 p-3 dark:bg-white/5">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Điểm</p>
                      <p className="font-black text-slate-950 dark:text-white">{student.score.toLocaleString('vi-VN')}</p>
                    </div>
                    <div className="rounded-lg bg-white/70 p-3 dark:bg-white/5">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Streak</p>
                      <p className="flex items-center gap-1 font-black text-orange-500">
                        <Flame className="h-4 w-4" />
                        {student.streak}
                      </p>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>

            <GlassCard className="p-5">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-950 dark:text-white">Bảng thứ hạng</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Responsive leaderboard cho desktop và mobile</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-lg bg-cyan-400/15 px-3 py-2 text-sm font-bold text-cyan-700 dark:text-cyan-200">
                  <UsersRound className="h-4 w-4" />
                  {rows.length} học sinh nổi bật
                </span>
              </div>
              <LeaderboardTable rows={rows} />
            </GlassCard>
          </>
        )}
      </div>
    </section>
  )
}

export default Leaderboard

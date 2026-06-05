import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import useSyncedDarkMode from '../../hooks/common/useSyncedDarkMode'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { mockELearnings, mockLessons, USER_ROLES } from '../../data/eLearningMockData'
import { formatOpenTime, isTeacherLike, resolveDisplayRole } from '../../utils/eLearningUiUtils'
import { GlassPanel, ProgressBar, StatPill } from '../../components/e-learning/ELearningUI'

function ELearningDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isDarkMode = useSyncedDarkMode()
  const { userDetails } = useAuth()

  const role = resolveDisplayRole(
    userDetails?.role ||
      userDetails?.Role ||
      userDetails?.accountType ||
      userDetails?.userRole ||
      userDetails?.type ||
      USER_ROLES.STUDENT,
  )
  const item = useMemo(() => mockELearnings.find((lesson) => lesson.id === id) || mockELearnings[0], [id])
  const canManage = isTeacherLike(role)

  return (
    <main className={`${isDarkMode ? 'dark ' : ''}min-h-screen bg-slate-50 px-4 py-8 text-slate-950 transition-colors dark:bg-[#020617] dark:text-white sm:px-6 lg:px-8`}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => navigate('/e-learning')} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
            ← Quay lại E-learning
          </button>

        </div>

        <GlassPanel className="overflow-hidden">
          <div className="relative h-[420px] overflow-hidden">
            <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent" />
            <div className="absolute bottom-8 left-6 right-6 md:left-8 md:right-8">
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-sky-400 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-950">{item.subject}</span>
                <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white backdrop-blur">{item.visibility === 'private' ? item.className : 'Công khai'}</span>
              </div>
              <h1 className="max-w-5xl text-4xl font-black tracking-tight text-white md:text-6xl">{item.title}</h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-200">{item.description}</p>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="grid gap-4 md:grid-cols-4">
              <StatPill icon="👨‍🏫" label="Giáo viên" value={item.teacherName} />
              <StatPill icon="⏱️" label="Thời lượng" value={item.duration} />
              <StatPill icon="📖" label="Số bài" value={item.lessons} />
              <StatPill icon="⭐" label="Đánh giá" value={item.rating} />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
              <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[0.035]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.3em] text-sky-500 dark:text-sky-300">Lộ trình học</div>
                    <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">Danh sách bài nhỏ</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">Mở lúc {formatOpenTime(item.openAt)}</span>
                </div>

                <div className="mt-5 space-y-3">
                  {mockLessons.map((lesson, index) => (
                    <div key={lesson.title} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/40">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-black ${lesson.completed ? 'bg-emerald-400 text-slate-950' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'}`}>
                        {lesson.completed ? '✓' : index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-black text-slate-950 dark:text-white">{lesson.title}</h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{lesson.type} • {lesson.duration}</p>
                      </div>
                      <button type="button" className="rounded-full bg-sky-400 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-sky-300">
                        Xem
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <aside className="space-y-5">
                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035]">
                  <div className="text-xs font-black uppercase tracking-[0.3em] text-violet-500 dark:text-violet-300">Tiến độ</div>
                  <div className="mt-3 text-4xl font-black text-slate-950 dark:text-white">{item.progress}%</div>
                  <div className="mt-4"><ProgressBar value={item.progress} /></div>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">UI hiển thị tiến độ. Logic lưu tiến độ sẽ tách riêng sau.</p>
                </section>

                {canManage && (
                  <button type="button" className="w-full rounded-2xl bg-gradient-to-r from-sky-400 to-violet-500 px-5 py-3 text-sm font-black text-white shadow-xl shadow-sky-500/20">
                    Chỉnh sửa E-learning
                  </button>
                )}
              </aside>
            </div>
          </div>
        </GlassPanel>
      </div>
    </main>
  )
}

export default ELearningDetail

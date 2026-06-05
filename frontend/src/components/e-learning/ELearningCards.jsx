import { formatOpenTime, getStatusText } from '../../utils/eLearningUiUtils'
import { ProgressBar } from './ELearningUI'

export function ELearningCard({
  item,
  canManage,
  currentUserDetails,
  onOpen,
  onEdit,
}) {
  const progress = Math.max(0, Math.min(100, Number(item.progress || 0)))
  const isCompleted = progress >= 100
  const isStarted = progress > 0 && progress < 100

  const studentStatusText = isCompleted
    ? 'Đã hoàn thành'
    : isStarted
      ? 'Đang học'
      : 'Sẵn sàng học'

  const teacherName = getTeacherDisplayName(item, currentUserDetails)

  return (
    <article className="group flex min-h-[670px] flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60 transition hover:-translate-y-1 hover:shadow-sky-200/70 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-slate-950/30 dark:hover:shadow-sky-950/30">
      <div className="relative h-56 overflow-hidden">
        <img
          src={item.thumbnail}
          alt={item.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent" />

        <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-slate-900 shadow-lg">
          {item.subject}
        </div>

        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="line-clamp-3 min-h-[84px] text-xl font-black leading-7 text-white">
            {item.title}
          </h3>

          <p className="mt-2 line-clamp-1 text-sm font-semibold text-slate-200">
            {item.topic}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Info label="Bài" value={item.lessons} />
          <Info label="Lượt xem" value={item.views} />
          <Info label="Sao" value={`★ ${item.rating}`} />
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
          <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>Tiến độ</span>
            <span className="font-black text-sky-600 dark:text-sky-300">
              {progress}%
            </span>
          </div>

          <div className="mt-2">
            <ProgressBar value={progress} />
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          <p>
            <span className="font-bold text-slate-950 dark:text-white">
              Giáo viên:
            </span>{' '}
            {teacherName}
          </p>

          <p>
            <span className="font-bold text-slate-950 dark:text-white">
              Lớp:
            </span>{' '}
            {item.visibility === 'private' ? item.className : 'Công khai'}
          </p>

          <p>
            <span className="font-bold text-slate-950 dark:text-white">
              Mở lúc:
            </span>{' '}
            {formatOpenTime(item.openAt)}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          {canManage ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
              {getStatusText(item.status)}
            </span>
          ) : (
            <span
              className={`rounded-full px-3 py-1 text-xs font-black ${
                isCompleted
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200'
                  : isStarted
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-400/10 dark:text-sky-200'
                    : 'bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-200'
              }`}
            >
              {studentStatusText}
            </span>
          )}

          {canManage ? (
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="rounded-full bg-sky-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-sky-300"
            >
              Quản lý
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="rounded-full bg-gradient-to-r from-violet-500 to-sky-400 px-4 py-2 text-sm font-black text-white transition hover:-translate-y-0.5"
            >
              Vào học
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-100 p-3 text-center dark:bg-white/[0.05]">
      <div className="font-black text-slate-950 dark:text-white">{value}</div>
      <div className="mt-1 text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  )
}

function getTeacherDisplayName(item, currentUserDetails) {
  return (
    item.teacherName ||
    item.createdByName ||
    item.ownerName ||
    item.authorName ||
    item.teacherDisplayName ||
    currentUserDetails?.fullName ||
    currentUserDetails?.name ||
    currentUserDetails?.displayName ||
    currentUserDetails?.email ||
    'Giáo viên'
  )
}
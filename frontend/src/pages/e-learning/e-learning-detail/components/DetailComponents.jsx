import { useEffect, useRef, useState } from 'react'
import { addDoc, arrayUnion, collection, deleteDoc, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../../../../components/firebase'
import { getCurrentCourseTeacherName, getInitials, formatFullDateTime, stripHtml, getDifficultyLabel, formatEstimatedMinutes, getYoutubeVideoId, isPdfFile, getRatingAverage, normalizeChecklist, defaultLearningChecklist, getLocalDateKey, canTrackLearningProgress, loadYoutubeIframeApi, formatSeconds } from '../utils/detailUtils'


function isSimulationCourse(course = {}) {
  return Boolean(
    course.contentType === 'simulation' ||
    course.attachMode === 'simulation' ||
    course.simulationUrl ||
    course.simulationHtml ||
    course.simulationCode ||
    Object.values(course.simulationCodes || {}).some((value) => String(value || '').trim()),
  )
}

function getSimulationLanguageLabel(course = {}) {
  const labels = {
    html: 'HTML / CSS / JavaScript',
    javascript: 'JavaScript',
    python: 'Python',
    typescript: 'TypeScript',
    rust: 'Rust',
  }
  const language = String(course.simulationLanguage || 'html').toLowerCase()
  return labels[language] || course.simulationLanguage || 'HTML / CSS / JavaScript'
}

export function CourseGateState({ icon, title, description, onBack, isDarkMode, tone = 'normal' }) {
  const toneClass = tone === 'danger' ? 'border-rose-200 dark:border-rose-500/20' : tone === 'warning' ? 'border-amber-200 dark:border-amber-500/20' : 'border-slate-200 dark:border-white/10'
  return <main className={`${isDarkMode ? 'dark ' : ''}min-h-screen bg-white px-4 py-10 text-slate-950 dark:bg-[#0f0f0f] dark:text-white`}><div className={`mx-auto max-w-xl rounded-3xl border ${toneClass} bg-white p-8 text-center shadow-xl dark:bg-[#181818]`}><div className="text-5xl">{icon}</div><h1 className="mt-5 text-2xl font-black">{title}</h1><p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p><button type="button" onClick={onBack} className="mt-6 rounded-full bg-slate-950 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950">Quay lại thư viện</button></div></main>
}
export function DetailHeader({ course, courseTeacherProfile, visibleProgress, ratingAverage, lessonCount, learningRecord, onBookmark, onShare, onComplete }) {
  const teacherName = getCurrentCourseTeacherName(course, courseTeacherProfile)
  const avatar = courseTeacherProfile?.photoURL || courseTeacherProfile?.avatar || courseTeacherProfile?.avatarUrl || ''
  return (
    <header className="mt-4">
      <h1 className="w-full min-w-0 max-w-[900px] max-h-24 overflow-y-auto whitespace-normal break-words pr-1 text-xl font-black leading-8 text-slate-950 [overflow-wrap:anywhere] dark:text-white sm:text-2xl lg:max-w-[min(900px,100%)]" dangerouslySetInnerHTML={{ __html: course.title }} />
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500 dark:text-slate-400"><span>{Number(course.views || 0).toLocaleString('vi-VN')} lượt xem</span><span>•</span><span>{formatFullDateTime(course.createdAt)}</span><span>•</span><span>{course.category || 'Môn học'}</span><span>•</span><span>★ {ratingAverage}</span><span>•</span><span>{visibleProgress}% hoàn thành</span></div>
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3"><div className="relative h-11 w-11 shrink-0 overflow-visible">{avatar ? <img src={avatar} alt={teacherName} className="h-11 w-11 rounded-full object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-full bg-blue-600 text-sm font-black text-white">{getInitials(teacherName)}</div>}{(['ADMIN','ADMINDEV'].includes(String(course.createdByRole||courseTeacherProfile?.role||'').replace(/[\s_-]/g,'').toUpperCase())||courseTeacherProfile?.elearningVerified)&&<span className={`absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-white text-[9px] font-black text-white shadow ${['ADMIN','ADMINDEV'].includes(String(course.createdByRole||courseTeacherProfile?.role||'').replace(/[\s_-]/g,'').toUpperCase())?'bg-amber-500':'bg-blue-600'}`}>✓</span>}</div><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-black text-slate-950 dark:text-white">{teacherName}</p>{['ADMIN','ADMINDEV'].includes(String(course.createdByRole||courseTeacherProfile?.role||'').replace(/[\s_-]/g,'').toUpperCase())?<span className="shrink-0 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[9px] font-black text-white">ADMIN ✓</span>:courseTeacherProfile?.elearningVerified?<span className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-black text-white">Đã xác nhận</span>:null}</div><p className="truncate text-xs text-slate-500 dark:text-slate-400">{courseTeacherProfile?.subject || course.teacherSubject || course.category || 'Giáo viên ZUNY'} • {lessonCount} bài học</p></div></div>
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ActionPill active={learningRecord.bookmarked} onClick={onBookmark} label={learningRecord.bookmarked ? 'Đã lưu' : 'Lưu'} icon={learningRecord.bookmarked ? '★' : '☆'} />
          <ActionPill onClick={onShare} label="Chia sẻ" icon="↗" />
          <ActionPill onClick={onComplete} label="Hoàn thành" icon="✓" />
          {course.wordFileUrl && <a href={course.wordFileUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20">📄 Tài liệu</a>}
        </div>
      </div>
    </header>
  )
}
export function ActionPill({ icon, label, onClick, active = false }) { return <button type="button" onClick={onClick} className={`group relative inline-flex shrink-0 cursor-pointer items-center gap-2 overflow-hidden rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-300 active:scale-95 ${active ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:-translate-y-0.5' : 'bg-slate-100 text-slate-800 hover:-translate-y-0.5 hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20'}`}><span className={`transition-transform duration-300 ${active?'rotate-12 scale-110':'group-hover:-rotate-12 group-hover:scale-110'}`}>{icon}</span><span>{label}</span>{active&&<span className="pointer-events-none absolute -left-1/3 top-0 h-full w-1/3 skew-x-[-20deg] bg-white/25 transition-transform duration-700 group-hover:translate-x-[520%]"/>}</button> }
export function DescriptionBox({ course, expanded, onToggle }) {
  const descriptionRef = useRef(null)
  const [hasOverflow, setHasOverflow] = useState(false)
  const descriptionHtml = course.description || 'Giáo viên chưa thêm mô tả bài học.'

  useEffect(() => {
    const element = descriptionRef.current
    if (!element) return undefined

    const measureOverflow = () => {
      const computedStyle = window.getComputedStyle(element)
      const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 24
      const collapsedHeight = lineHeight * 3

      const clone = element.cloneNode(true)
      clone.removeAttribute('ref')
      clone.classList.remove('line-clamp-3')
      clone.style.position = 'fixed'
      clone.style.left = '-99999px'
      clone.style.top = '0'
      clone.style.width = `${element.getBoundingClientRect().width}px`
      clone.style.height = 'auto'
      clone.style.maxHeight = 'none'
      clone.style.overflow = 'visible'
      clone.style.visibility = 'hidden'
      clone.style.pointerEvents = 'none'
      document.body.appendChild(clone)

      const fullHeight = clone.getBoundingClientRect().height
      clone.remove()
      setHasOverflow(fullHeight > collapsedHeight + 1)
    }

    const frameId = window.requestAnimationFrame(measureOverflow)
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(measureOverflow)
      : null

    resizeObserver?.observe(element)
    window.addEventListener('resize', measureOverflow)

    return () => {
      window.cancelAnimationFrame(frameId)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', measureOverflow)
    }
  }, [descriptionHtml])

  return <section className="mt-5 min-w-0 rounded-2xl bg-slate-100 p-4 text-sm text-slate-700 dark:bg-white/[0.08] dark:text-slate-200"><div className="flex flex-wrap gap-x-3 gap-y-1 font-bold"><span>{Number(course.views || 0).toLocaleString('vi-VN')} lượt xem</span><span>{formatFullDateTime(course.createdAt)}</span><span className="min-w-0 break-words [overflow-wrap:anywhere]">{course.courseCode || course.category || 'ZUNY'}</span></div><div ref={descriptionRef} className={`mt-3 w-full min-w-0 max-w-[900px] whitespace-normal break-words leading-6 [overflow-wrap:anywhere] [&_*]:max-w-full [&_*]:whitespace-normal [&_*]:break-words ${expanded ? '' : 'line-clamp-3'}`} dangerouslySetInnerHTML={{ __html: descriptionHtml }} />{expanded && <div className="mt-4 grid w-full max-w-[900px] gap-2 border-t border-slate-200 pt-4 text-xs dark:border-white/10 sm:grid-cols-2"><span className="min-w-0 max-h-[4.5rem] overflow-y-auto break-words pr-1 leading-6 [overflow-wrap:anywhere]"><b>Chủ đề:</b> {stripHtml(course.topic) || '---'}</span><span className="min-w-0 break-words [overflow-wrap:anywhere]"><b>Độ khó:</b> {getDifficultyLabel(course.difficulty)}</span><span className="min-w-0 break-words [overflow-wrap:anywhere]"><b>{isSimulationCourse(course) ? 'Ngôn ngữ:' : 'Thời lượng:'}</b> {isSimulationCourse(course) ? getSimulationLanguageLabel(course) : (formatEstimatedMinutes(course.estimatedMinutes) || course.duration || '---')}</span><span className="min-w-0 break-words [overflow-wrap:anywhere]"><b>Quyền xem:</b> {course.visibility === 'class' ? `Dành cho lớp${course.className ? ` • ${course.className}` : ''}` : course.visibility === 'private' ? `Dành cho khối${course.className ? ` • ${course.className}` : ''}` : 'Công khai'}</span></div>}{hasOverflow && <button type="button" onClick={onToggle} className="mt-2 cursor-pointer font-black text-slate-950 hover:underline dark:text-white">{expanded ? 'Thu gọn' : 'Xem thêm'}</button>}</section>
}

function buildPublishedSimulationDocument(language, code) {
  const safeCode = String(code || '').replace(/<\/script/gi, '<\\/script')
  if (language === 'python') return `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js"><\/script><style>body{font-family:system-ui;margin:0;padding:20px}#status{color:#64748b;font-size:13px}</style></head><body><div id="status">Đang tải Python...</div><div id="app"></div><script>(async()=>{try{const pyodide=await loadPyodide();document.getElementById('status').textContent='';await pyodide.runPythonAsync(${JSON.stringify(safeCode)});}catch(error){document.getElementById('status').textContent='Lỗi: '+error.message;document.getElementById('status').style.color='#dc2626';}})();<\/script></body></html>`
  if (language === 'typescript') return `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.jsdelivr.net/npm/typescript@5.6.3/lib/typescript.js"><\/script><style>body{font-family:system-ui;margin:0;padding:20px}#error{white-space:pre-wrap;color:#dc2626}</style></head><body><div id="app"></div><pre id="error"></pre><script>try{const output=ts.transpile(${JSON.stringify(safeCode)},{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None});(0,eval)(output);}catch(error){document.getElementById('error').textContent=error.message;}<\/script></body></html>`
  if (language === 'rust') return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:system-ui;margin:0;padding:28px;background:#fff7ed;color:#7c2d12}.box{border:1px solid #fdba74;border-radius:18px;padding:22px;background:white}pre{overflow:auto;background:#111827;color:#f8fafc;padding:16px;border-radius:12px}</style></head><body><div class="box"><h2>Rust → WebAssembly</h2><p>Mã Rust của bài mô phỏng đã được lưu. Cần biên dịch sang WebAssembly để chạy trực tiếp.</p><pre>${safeCode.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre></div></body></html>`
  return safeCode
}

export function MainLearningViewer({ course, mainVideoLesson, selectedLessonIndex, realCourseId, currentUser, currentRole, lessonCount, onSkipWarning, autoPlay = false, onEnded, focusMode = false }) {
  const lesson = mainVideoLesson || (getYoutubeVideoId(course.youtubeUrl) ? { title: course.title, youtubeUrl: course.youtubeUrl, attachMode: 'youtube' } : null)
  const mode = lesson?.attachMode || (lesson?.mp4FileUrl ? 'mp4' : course.attachMode || 'youtube')
  const youtubeUrl = lesson?.youtubeUrl || course.youtubeUrl
  const lumiUrl = lesson?.lumiUrl || course.lumiUrl
  const mp4Url = lesson?.mp4FileUrl || course.mp4FileUrl
  const fileUrl = lesson?.wordFileUrl || course.wordFileUrl
  const fileName = lesson?.wordFileName || course.wordFileName
  const codeContent = lesson?.codeContent || course.codeContent
  const richDocument = lesson?.richDocument || course.richDocument
  const simulationUrl = course.simulationUrl || ''
  const simulationHtml = course.simulationHtml || ''
  const simulationLanguage = course.simulationLanguage || 'html'
  const simulationCode = course.simulationCodes?.[simulationLanguage] || course.simulationCode || ''
  const simulationDocument = buildPublishedSimulationDocument(simulationLanguage, simulationLanguage === 'html' ? simulationHtml : simulationCode)
  const isSimulation = course.contentType === 'simulation' || course.attachMode === 'simulation' || simulationUrl || simulationHtml || simulationCode
  const viewerClass = focusMode
    ? 'h-full w-full overflow-hidden rounded-xl'
    : 'mx-auto w-full max-w-[min(100%,calc((100dvh-150px)*16/9))] overflow-hidden rounded-xl sm:rounded-2xl lg:w-[min(100%,800px)] lg:max-w-[800px] 2xl:w-[min(100%,1100px)] 2xl:max-w-[1100px]'
  return <section className={`${viewerClass} bg-black shadow-xl shadow-black/25 transition-all duration-300`}>{isSimulation ? <div className="bg-[#181818] p-2">{simulationUrl ? <iframe src={simulationUrl} title={stripHtml(course.title) || 'Mô phỏng'} className={`${focusMode ? 'h-[calc(100dvh-104px)]' : 'h-[clamp(320px,70dvh,820px)]'} min-h-0 w-full rounded-lg bg-white sm:rounded-xl`} sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" /> : <iframe srcDoc={simulationDocument} title={stripHtml(course.title) || 'Mô phỏng tự tạo'} className={`${focusMode ? 'h-[calc(100dvh-104px)]' : 'h-[clamp(320px,70dvh,820px)]'} min-h-0 w-full rounded-lg bg-white sm:rounded-xl`} sandbox="allow-scripts allow-forms allow-modals" />}{course.simulationInstructions && <div className="mt-2 rounded-xl bg-white/10 p-4 text-sm leading-6 text-slate-200">{course.simulationInstructions}</div>}</div> : (mode === 'lumi' || lumiUrl) && lumiUrl ? <div className="bg-[#181818] p-1 sm:p-2"><div className="relative mx-auto aspect-video w-full max-h-[calc(100dvh-150px)]"><iframe src={lumiUrl} title={stripHtml(lesson?.title || course.title) || 'Bài học tương tác Lumi'} className="absolute inset-0 h-full w-full rounded-lg border-0 bg-white sm:rounded-xl" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-presentation" allow="fullscreen; autoplay; clipboard-read; clipboard-write" allowFullScreen /></div></div> : getYoutubeVideoId(youtubeUrl) ? <YoutubeProgressPlayer youtubeUrl={youtubeUrl} title={stripHtml(lesson?.title || course.title)} courseId={realCourseId} currentUser={currentUser} currentRole={currentRole} lessonIndex={selectedLessonIndex} totalLessons={lessonCount} onSkipWarning={onSkipWarning} autoPlay={autoPlay} onEnded={onEnded} /> : (mode === 'mp4' || mp4Url) && mp4Url ? <Mp4LearningPlayer src={mp4Url} autoPlay={autoPlay} onEnded={onEnded} courseId={realCourseId} currentUser={currentUser} currentRole={currentRole} lessonIndex={selectedLessonIndex} totalLessons={lessonCount} onSkipWarning={onSkipWarning} /> : fileUrl && isPdfFile(fileName, fileUrl) ? <div className="bg-[#181818] p-2"><iframe src={fileUrl} title={fileName || 'PDF'} className="h-[clamp(360px,70dvh,820px)] min-h-0 w-full rounded-lg bg-white sm:rounded-xl" /><FileActions url={fileUrl} name={fileName} /></div> : fileUrl ? <div className="grid min-h-[420px] place-items-center bg-[#181818] p-8 text-center text-white"><div><div className="text-6xl">📄</div><h2 className="mt-4 text-xl font-black">{fileName || 'Tài liệu bài học'}</h2><FileActions url={fileUrl} name={fileName} /></div></div> : course.documentImageUrl ? <div className="grid min-h-[420px] place-items-center bg-[#181818] p-3"><img src={course.documentImageUrl} alt={course.documentImageName || stripHtml(course.title)} className="max-h-[78vh] w-full rounded-xl object-contain" /></div> : codeContent ? <div className="grid gap-3 bg-[#181818] p-3 lg:grid-cols-2"><pre className="max-h-[70vh] min-h-[420px] overflow-auto rounded-xl bg-black p-5 font-mono text-sm leading-7 text-emerald-300">{codeContent}</pre>{(lesson?.codeLanguage || course.codeLanguage) === 'cpp' ? <CppNote /> : <CodeRunner code={codeContent} />}</div> : richDocument ? <div className="prose min-h-[420px] max-w-none bg-white p-6 text-slate-800 dark:prose-invert dark:bg-[#181818] dark:text-slate-100 [&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_ol]:ml-6 [&_ol]:list-decimal [&_ul]:ml-6 [&_ul]:list-disc [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:p-2 dark:[&_td]:border-white/20 [&_th]:border [&_th]:border-slate-300 [&_th]:p-2 dark:[&_th]:border-white/20" dangerouslySetInnerHTML={{ __html: richDocument }} /> : <div className="grid aspect-video place-items-center bg-[#181818] p-8 text-center text-slate-300"><div><div className="text-5xl">▶</div><p className="mt-4 font-bold">Chọn một bài trong playlist để bắt đầu học.</p></div></div>}</section>
}
export function FileActions({ url, name }) { return <div className="mt-4 flex flex-wrap justify-center gap-3"><a href={url} target="_blank" rel="noreferrer" className="rounded-full bg-white px-5 py-2.5 text-sm font-black text-slate-950">Mở trong tab mới</a><a href={url} download={name || true} className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-black text-white hover:bg-white/20">Tải xuống</a></div> }
export function DetailSidebar({ course, courseTeacherProfile, lessons, selectedLessonIndex, onSelectLesson, visibleProgress, ratingAverage, checklist, completedChecklist, learningRecord, nextCourse, onComplete, onToggleChecklist, onBookmark, onNext }) {
  return <aside className="space-y-4 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto xl:pr-1"><PlaylistPanel lessons={lessons} selectedLessonIndex={selectedLessonIndex} learningRecord={learningRecord} onSelectLesson={onSelectLesson} /><ProgressSummaryCard progress={visibleProgress} onComplete={onComplete} /><ChecklistSummaryCard checklist={checklist} completedChecklist={completedChecklist} onToggleChecklist={onToggleChecklist} /><CourseInfoCard course={course} courseTeacherProfile={courseTeacherProfile} ratingAverage={ratingAverage} /><CourseActionCard course={course} bookmarked={learningRecord.bookmarked} onBookmark={onBookmark} /><RelatedCourseCard course={nextCourse} onOpen={onNext} /></aside>
}
export function PlaylistPanel({ lessons, selectedLessonIndex, learningRecord, onSelectLesson, playlistCourses = [], currentCourseId = '', currentPlaylistIndex = 0, onSelectPlaylistCourse, collapsed = false, onToggleCollapsed, autoPlayEnabled = true, onToggleAutoPlay }) {
  const lessonProgress = learningRecord.lessonProgress || {}
  const [collapsedTopics, setCollapsedTopics] = useState({})

  useEffect(() => {
    setCollapsedTopics({})
  }, [lessons])

  function toggleTopic(topicTitle) {
    const key = String(topicTitle || '').trim()
    if (!key) return
    setCollapsedTopics((current) => ({ ...current, [key]: !current[key] }))
  }

  const hasCoursePlaylist = playlistCourses.length > 0

  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#181818]">
    <div className="border-b border-slate-200 p-4 dark:border-white/10">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onToggleCollapsed} className="min-w-0 flex-1 text-left" aria-expanded={!collapsed}>
          <span className="flex items-center gap-2"><span className={`text-sm transition-transform ${collapsed ? '-rotate-90' : 'rotate-0'}`}>⌄</span><span className="truncate font-black">{hasCoursePlaylist ? 'Danh sách phát' : 'Nội dung khóa học'}</span></span>
          <span className="mt-1 block pl-6 text-xs text-slate-500 dark:text-slate-400">{hasCoursePlaylist ? `${playlistCourses.length} bài học phát theo thứ tự` : `${lessons.length} bài trong playlist`}</span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-[11px] font-black text-slate-500 sm:inline">Tự động phát</span>
          <button type="button" onClick={onToggleAutoPlay} className={`relative h-7 w-12 rounded-full transition ${autoPlayEnabled?'bg-blue-600':'bg-slate-300 dark:bg-slate-600'}`} aria-pressed={autoPlayEnabled} aria-label="Bật hoặc tắt tự động phát"><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${autoPlayEnabled?'left-6':'left-1'}`}/></button>
        </div>
      </div>
    </div>

    {!collapsed && hasCoursePlaylist && <div className="border-b border-slate-200 p-2 dark:border-white/10">
      <div className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
        {playlistCourses.map((playlistCourse, index) => {
          const activeCourse = String(playlistCourse.id) === String(currentCourseId)
          const firstLesson = Array.isArray(playlistCourse.lessons) ? playlistCourse.lessons[0] : null
          const previewLesson = firstLesson || {
            thumbnail: playlistCourse.thumbnail || '',
            attachMode: playlistCourse.attachMode || (playlistCourse.mp4FileUrl ? 'mp4' : 'youtube'),
            youtubeUrl: playlistCourse.youtubeUrl || '',
            mp4FileUrl: playlistCourse.mp4FileUrl || '',
            wordFileUrl: playlistCourse.wordFileUrl || '',
            wordFileName: playlistCourse.wordFileName || '',
          }
          return <button key={playlistCourse.id} type="button" onClick={() => onSelectPlaylistCourse?.(playlistCourse.id)} className={`group flex w-full cursor-pointer gap-3 rounded-xl p-2 text-left transition ${activeCourse ? 'bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-500/15 dark:ring-blue-400/20' : 'hover:bg-slate-50 dark:hover:bg-white/[0.06]'}`}>
            <div className="relative grid aspect-video w-24 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-200 text-2xl dark:bg-black sm:w-28">
              {playlistCourse.thumbnail ? <img src={playlistCourse.thumbnail} alt="" className="h-full w-full object-cover" /> : courseLessonThumbnail(previewLesson)}
              <span className="absolute left-1 top-1 grid h-6 min-w-6 place-items-center rounded-full bg-black/75 px-1.5 text-[10px] font-black text-white">{index + 1}</span>
              {activeCourse && <span className="absolute bottom-1 right-1 rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-black text-white">ĐANG PHÁT</span>}
            </div>
            <div className="min-w-0 flex-1 py-1">
              <p className={`line-clamp-2 text-sm font-black ${activeCourse ? 'text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-white'}`}>{stripHtml(playlistCourse.title) || `Bài học ${index + 1}`}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{playlistCourse.category || 'Bài học'} • {Array.isArray(playlistCourse.lessons) && playlistCourse.lessons.length ? `${playlistCourse.lessons.length} video` : '1 video'}</p>
            </div>
          </button>
        })}
      </div>
    </div>}

    {!collapsed && <div className="max-h-[420px] overflow-y-auto p-2 sm:max-h-[520px]">
      {hasCoursePlaylist && <p className="px-2 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Video trong bài đang phát</p>}
      {lessons.length ? lessons.map((lesson, index) => {
        const active = index === selectedLessonIndex
        const progress = Number(lessonProgress[index] || 0)
        const topicTitle = String(lesson.topicTitle || '').trim()
        const showTopic = Boolean(topicTitle && (index === 0 || lessons[index - 1]?.topicTitle !== lesson.topicTitle))
        const topicCollapsed = Boolean(topicTitle && collapsedTopics[topicTitle])
        return <div key={index}>{showTopic && <button type="button" onClick={() => toggleTopic(topicTitle)} aria-expanded={!topicCollapsed} className="mb-1 mt-3 flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg bg-blue-50 px-3 py-2 text-left text-[11px] font-black uppercase tracking-[0.12em] text-blue-700 transition hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"><span className="min-w-0 truncate">{topicTitle}</span><span className={`shrink-0 text-sm transition-transform ${topicCollapsed ? '-rotate-90' : 'rotate-0'}`}>⌄</span></button>}{!topicCollapsed && <button type="button" onClick={() => onSelectLesson(index)} className={`flex w-full cursor-pointer gap-3 rounded-xl p-2 text-left transition ${active ? 'bg-slate-100 dark:bg-white/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.06]'}`}><div className="relative grid aspect-video w-24 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-200 text-2xl dark:bg-black sm:w-32">{courseLessonThumbnail(lesson)}<span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white">{getLessonTypeLabel(lesson)}</span>{progress >= 100 && <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-[10px] font-black text-white">✓</span>}</div><div className="min-w-0 flex-1 py-1"><p className={`line-clamp-2 text-sm font-bold ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>{index + 1}. {lesson.title || `Bài ${index + 1}`}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{getLessonTypeLabel(lesson)}{progress ? ` • ${Math.round(progress)}%` : ''}</p></div></button>}</div>
      }) : <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Chưa có bài nhỏ trong khóa học.</p>}
    </div>}
  </section>
}
export function courseLessonThumbnail(lesson) { if (lesson.thumbnail) return <img src={lesson.thumbnail} alt="" className="h-full w-full object-cover" />; const mode=String(lesson.attachMode || 'youtube').toLowerCase(); if (getYoutubeVideoId(lesson.youtubeUrl)) return <div className="grid h-full w-full place-items-center bg-gradient-to-br from-red-600 to-rose-800 text-white"><span className="rounded-xl bg-white px-3 py-1 text-xs font-black text-red-600 shadow">YouTube ▶</span></div>; if (mode==='mp4'||lesson.mp4FileUrl) return <div className="grid h-full w-full place-items-center bg-gradient-to-br from-blue-600 to-indigo-800 text-white"><span className="text-3xl">▶</span></div>; if (mode==='file'||mode==='document'||lesson.wordFileUrl) return <div className="grid h-full w-full place-items-center bg-gradient-to-br from-emerald-600 to-teal-800 text-white"><span className="text-3xl">📄</span></div>; if (mode==='simulation'||lesson.simulationUrl||lesson.simulationHtml) return <div className="grid h-full w-full place-items-center bg-gradient-to-br from-violet-600 to-purple-800 text-white"><span className="text-3xl">⚙</span></div>; if (mode==='code') return '⌘'; if (mode==='rich') return '¶'; return '▶' }
export function getLessonTypeLabel(lesson) { const mode=lesson?.attachMode || 'youtube'; if (mode==='youtube') return getYoutubeVideoId(lesson.youtubeUrl) ? 'YouTube' : lesson.mp4FileUrl ? 'MP4' : 'Video'; if (mode==='lumi') return 'Lumi'; if (mode==='mp4') return 'MP4'; if (mode==='file' || mode==='document') return isPdfFile(lesson.wordFileName, lesson.wordFileUrl) ? 'PDF' : 'Tài liệu'; if (mode==='code') return lesson.codeLanguage==='cpp' ? 'C++' : 'JavaScript'; if (mode==='rich') return 'Rich text'; return 'Bài học' }
export function ProgressSummaryCard({ progress, onComplete }) { return <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#181818]"><div className="flex items-center justify-between"><span className="font-black">Tiến độ học tập</span><span className="text-lg font-black">{progress}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><div className="h-full rounded-full bg-red-600 transition-all" style={{ width: `${progress}%` }} /></div><button type="button" onClick={onComplete} className="mt-4 w-full rounded-full bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950">Đánh dấu hoàn thành</button></div> }
export function ChecklistSummaryCard({ checklist, completedChecklist, onToggleChecklist }) { const safe=checklist.length?checklist:defaultLearningChecklist; const done=safe.filter((item)=>completedChecklist[item.id]).length; return <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#181818]"><div className="flex items-center justify-between"><span className="font-black">Checklist</span><span className="text-xs font-bold text-slate-500 dark:text-slate-400">{done}/{safe.length}</span></div><div className="mt-3 grid gap-2">{safe.map((item)=>{const checked=Boolean(completedChecklist[item.id]); return <label key={item.id} className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${checked?'bg-emerald-50 dark:bg-emerald-500/10':'bg-slate-50 dark:bg-white/[0.05]'}`}><input type="checkbox" checked={checked} onChange={()=>onToggleChecklist(item.id)} className="h-4 w-4 accent-emerald-600"/><span className={`text-sm font-semibold ${checked?'text-emerald-700 line-through dark:text-emerald-300':'text-slate-700 dark:text-slate-200'}`}>{item.label}</span></label>})}</div></div> }
export function CourseInfoCard({ course, courseTeacherProfile, ratingAverage }) {
  const rows = [
    ['Môn học', course.category || '---'],
    ['Chủ đề', stripHtml(course.topic) || '---'],
    ['Mã bài', course.courseCode || '---'],
    ['Giáo viên', getCurrentCourseTeacherName(course, courseTeacherProfile)],
    [isSimulationCourse(course) ? 'Ngôn ngữ' : 'Thời lượng', isSimulationCourse(course) ? getSimulationLanguageLabel(course) : (formatEstimatedMinutes(course.estimatedMinutes) || course.duration || '---')],
    ['Lượt xem', Number(course.views || 0).toLocaleString('vi-VN')],
    ['Đánh giá', `★ ${ratingAverage}`],
    ['Chế độ', course.visibility === 'class' ? 'Dành cho lớp' : course.visibility === 'private' ? 'Dành cho khối' : 'Công khai'],
    [course.visibility === 'private' ? 'Khối được xem' : 'Lớp được xem', course.className || 'Tất cả'],
  ]

  return <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#181818]"><div className="font-black">Thông tin khóa học</div><div className="mt-3 divide-y divide-slate-100 dark:divide-white/10">{rows.map(([label, value]) => <div key={label} className="flex min-w-0 items-start justify-between gap-3 py-2 text-xs"><span className="shrink-0 text-slate-500 dark:text-slate-400">{label}</span><span className={`${label === 'Chủ đề' ? 'w-[58%] min-w-0 max-w-[190px] max-h-[3.75rem] overflow-y-auto whitespace-normal break-words pr-1 leading-5 sm:w-[180px] xl:w-[160px]' : 'min-w-0 max-w-[60%] break-words'} text-right font-bold [overflow-wrap:anywhere] text-slate-800 dark:text-slate-100`}>{value}</span></div>)}</div></div>
}
export function CourseActionCard({ course, bookmarked, onBookmark }) { return <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#181818]"><div className="font-black">Tài nguyên</div><div className="mt-3 grid gap-2"><button type="button" onClick={onBookmark} className={`group relative cursor-pointer overflow-hidden rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-300 active:scale-95 ${bookmarked?'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:-translate-y-0.5':'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-white/10 dark:text-white'}`}><span className={`mr-2 inline-block transition-transform ${bookmarked?'rotate-12 scale-110':'group-hover:-rotate-12 group-hover:scale-110'}`}>{bookmarked?'★':'☆'}</span>{bookmarked?'Đang lưu':'Lưu bài học'}{bookmarked&&<span className="pointer-events-none absolute -left-1/3 top-0 h-full w-1/3 skew-x-[-20deg] bg-white/25 transition-transform duration-700 group-hover:translate-x-[520%]"/>}</button>{course.wordFileUrl&&<a href={course.wordFileUrl} target="_blank" rel="noreferrer" className="rounded-full bg-slate-950 px-4 py-2.5 text-center text-sm font-bold text-white dark:bg-white dark:text-slate-950">Mở tài liệu</a>}</div></div> }
export function RelatedCourseCard({ course, onOpen }) { return <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#181818]"><div className="font-black">Bài học tiếp theo</div>{course?<button type="button" onClick={()=>onOpen(course)} className="mt-3 block w-full text-left"><div className="aspect-video overflow-hidden rounded-xl bg-slate-200 dark:bg-black">{course.thumbnail?<img src={course.thumbnail} alt={stripHtml(course.title)} className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center text-4xl">▶</div>}</div><p className="mt-3 line-clamp-2 text-sm font-black">{stripHtml(course.title)}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{course.category||stripHtml(course.topic)||'Bài học phù hợp'} • ★ {getRatingAverage(course)}</p></button>:<div className="mt-3 rounded-2xl bg-emerald-50 p-4 text-center dark:bg-emerald-500/10"><div className="text-3xl">🎉</div><p className="mt-2 text-sm font-black text-emerald-700 dark:text-emerald-300">Bạn đã xem hết bài học rồi!</p><p className="mt-1 text-xs leading-5 text-emerald-600/80 dark:text-emerald-300/80">Chúc mừng bạn đã hoàn thành hành trình hiện tại. Nghỉ một chút rồi quay lại khám phá nội dung mới nhé!</p></div>}</div> }
export function OverviewList({ title, items, empty }) { return <div className="rounded-2xl bg-slate-100 p-5 dark:bg-white/[0.06]"><h3 className="font-black">{title}</h3>{items.length?<ul className="mt-3 space-y-2">{items.map((item,index)=><li key={`${item}-${index}`} className="flex gap-2 text-sm leading-6 text-slate-700 dark:text-slate-200"><span className="font-black">✓</span><span>{item}</span></li>)}</ul>:<p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{empty}</p>}</div> }
export function NotesPanel({ noteDraft, setNoteDraft, noteColor = '#000000', setNoteColor, savingNote, onSave }) {
  const editorRef = useRef(null)
  const selectionRef = useRef(null)
  const colors = [
    { value: '#1d4ed8', label: 'Xanh dương' },
    { value: '#15803d', label: 'Xanh lá' },
    { value: '#b45309', label: 'Cam' },
    { value: '#be123c', label: 'Hồng đỏ' },
    { value: '#7e22ce', label: 'Tím' },
    { value: 'theme', label: 'Màu theo giao diện' },
  ]

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== String(noteDraft || '')) {
      editorRef.current.innerHTML = noteDraft || ''
    }
  }, [noteDraft])

  function rememberSelection() {
    const selection = window.getSelection?.()
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) {
      selectionRef.current = selection.getRangeAt(0).cloneRange()
    }
  }

  function applyColor(item) {
    const color = item.value === 'theme'
      ? (document.documentElement.classList.contains('dark') || document.body.classList.contains('dark') ? '#ffffff' : '#000000')
      : item.value
    setNoteColor?.(color)
    editorRef.current?.focus()
    const selection = window.getSelection?.()
    if (selectionRef.current && selection) {
      selection.removeAllRanges()
      selection.addRange(selectionRef.current)
    }
    document.execCommand('styleWithCSS', false, true)
    document.execCommand('foreColor', false, color)
    rememberSelection()
    setNoteDraft?.(editorRef.current?.innerHTML || '')
  }

  return <section><h2 className="text-xl font-black">Ghi chú cá nhân</h2><div className="mt-4 flex flex-wrap items-center gap-2"><span className="mr-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">Màu chữ</span>{colors.map((item)=>{const resolved=item.value==='theme'?(document.documentElement.classList.contains('dark')?'#ffffff':'#000000'):item.value; return <button key={item.value} type="button" onMouseDown={(event)=>event.preventDefault()} onClick={()=>applyColor(item)} title={item.label} aria-label={item.label} className={`h-9 w-9 rounded-full border-4 shadow-sm transition hover:scale-110 ${noteColor===resolved?'border-slate-950 ring-2 ring-slate-300 dark:border-white dark:ring-slate-600':'border-white dark:border-[#0c1a2f]'}`} style={{backgroundColor:resolved}}/>})}</div><div ref={editorRef} contentEditable suppressContentEditableWarning onInput={(event)=>setNoteDraft?.(event.currentTarget.innerHTML)} onKeyUp={rememberSelection} onMouseUp={rememberSelection} onFocus={rememberSelection} data-placeholder="Viết lại ý chính, câu hỏi chưa hiểu hoặc mốc cần ôn lại..." className="mt-4 h-[280px] max-h-[280px] min-h-[220px] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold leading-7 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-[#181818] empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]" style={{caretColor:noteColor}}/><button type="button" disabled={savingNote} onClick={onSave} className="mt-3 rounded-full bg-slate-950 px-6 py-3 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-slate-950">{savingNote?'Đang lưu...':'Lưu ghi chú'}</button></section>
}
export function EmptyLearningState({ text }) { return <div className="my-6 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/20 dark:text-slate-400">{text}</div> }
export function CourseFileViewer({ course }) {
  return <section className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.04]"><div className="text-sm font-bold uppercase tracking-[0.3em] text-blue-600 dark:text-blue-300">File Word / PDF</div>{isPdfFile(course.wordFileName, course.wordFileUrl) && <iframe src={course.wordFileUrl} title={course.wordFileName || 'PDF'} className="mt-5 h-[clamp(380px,70dvh,760px)] w-full rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-950" />}<a href={course.wordFileUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-3 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700">📄 Mở file {course.wordFileName || 'tài liệu'}</a></section>
}
export function CourseCodeViewer({ course }) {
  return <section className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.04]"><div className="text-sm font-bold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">Code</div><div className="mt-5 grid gap-4 lg:grid-cols-2"><pre className="min-h-72 overflow-auto rounded-2xl border border-emerald-400/20 bg-black p-5 font-mono text-sm leading-7 text-emerald-300">{course.codeContent}</pre><CodeRunner code={course.codeContent} /></div></section>
}
export function CourseRichDocumentViewer({ course }) {
  return <section className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.04]"><div className="text-sm font-bold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">Tài liệu</div><div className="prose mt-5 max-w-none rounded-2xl bg-slate-50 p-5 text-base leading-8 text-slate-700 dark:prose-invert dark:bg-slate-950/50 dark:text-slate-200 [&_ol]:ml-6 [&_ol]:list-decimal [&_ul]:ml-6 [&_ul]:list-disc" dangerouslySetInnerHTML={{ __html: course.richDocument }} /></section>
}
export function CBTStudyPanel({ objectives, prerequisites, checklist, completedChecklist, progress, notes, savingNote, onToggleChecklist, onChangeNotes, onSaveNotes, onComplete }) {
  return (
    <section className="mt-8 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="text-sm font-bold uppercase tracking-[0.3em] text-sky-600 dark:text-sky-300">Mục tiêu học tập</div>
        <h2 className="mt-3 text-2xl font-black text-slate-950 dark:text-white">Sau bài này bạn cần đạt</h2>
        <ListOrEmpty items={objectives} empty="Giáo viên chưa thêm mục tiêu học tập." />
        <div className="mt-6 text-sm font-bold uppercase tracking-[0.3em] text-violet-600 dark:text-violet-300">Kiến thức cần có</div>
        <ListOrEmpty items={prerequisites} empty="Không yêu cầu kiến thức nền cụ thể." />
      </div>

      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">Checklist CBT</div>
            <h2 className="mt-3 text-2xl font-black text-slate-950 dark:text-white">Theo dõi từng bước học</h2>
          </div>
          <div className="rounded-full bg-sky-100 px-4 py-2 text-sm font-black text-sky-700 dark:bg-sky-400/10 dark:text-sky-200">{progress}%</div>
        </div>
        <div className="mt-4 grid gap-2">
          {(checklist.length ? checklist : defaultLearningChecklist).map((item) => (
            <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
              <input type="checkbox" checked={Boolean(completedChecklist[item.id])} onChange={() => onToggleChecklist(item.id)} />
              <span className="font-bold text-slate-800 dark:text-white">{item.label}</span>
            </label>
          ))}
        </div>
        <button type="button" onClick={onComplete} className="mt-4 w-full rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white hover:bg-emerald-400">Đánh dấu hoàn thành bài học</button>
      </div>

      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.04] lg:col-span-2">
        <div className="text-sm font-bold uppercase tracking-[0.3em] text-amber-600 dark:text-amber-300">Ghi chú cá nhân</div>
        <h2 className="mt-3 text-2xl font-black text-slate-950 dark:text-white">Ghi chú của tôi</h2>
        <textarea value={notes} onChange={(event) => onChangeNotes(event.target.value)} rows="6" placeholder="Viết lại ý chính, câu hỏi chưa hiểu hoặc mốc cần ôn lại..." className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-800 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-slate-950/50 dark:text-white" />
        <button type="button" onClick={onSaveNotes} className="mt-3 rounded-xl bg-sky-500 px-5 py-2 text-sm font-black text-white hover:bg-sky-400">{savingNote ? 'Đang lưu...' : 'Lưu ghi chú'}</button>
      </div>
    </section>
  )
}
export function ListOrEmpty({ items, empty }) {
  if (!items.length) return <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{empty}</p>
  return <ul className="mt-4 grid gap-2">{items.map((item, index) => <li key={`${item}-${index}`} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 dark:bg-slate-950/50 dark:text-slate-200">✓ {item}</li>)}</ul>
}
export function MiniQuizPanel({ quiz, answers, submitted, savedResult, onAnswer, onSubmit }) {
  if (!quiz.length) return null
  const result = savedResult || null
  const showResult = submitted || result
  const isQuestionAnswered = (item, index) => {
    if (item.sourceType === 'true_false') {
      const answerMap = answers[index] && typeof answers[index] === 'object' ? answers[index] : {}
      return item.statements.every((_, statementIndex) => Object.prototype.hasOwnProperty.call(answerMap, statementIndex))
    }
    return answers[index] !== undefined
  }
  const allAnswered = quiz.every(isQuestionAnswered)

  return (
    <section className="mt-8 min-w-0 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-4 sm:p-6 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="text-sm font-bold uppercase tracking-[0.3em] text-fuchsia-600 dark:text-fuchsia-300">Quiz nhanh</div>
      <h2 className="mt-3 break-words text-2xl font-black text-slate-950 dark:text-white">Kiểm tra hiểu bài</h2>
      <div className="mt-5 grid min-w-0 gap-4">
        {quiz.map((item, index) => {
          const selected = answers[index]

          if (item.sourceType === 'true_false') {
            const answerMap = selected && typeof selected === 'object' ? selected : {}
            const allCorrect = item.statements.every((statement, statementIndex) =>
              Boolean(answerMap[statementIndex]) === Boolean(statement.correct),
            )
            return (
              <div key={index} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
                <div className="max-h-32 overflow-y-auto break-words whitespace-pre-wrap pr-1 font-black leading-6 text-slate-950 dark:text-white">Câu {index + 1}: {item.question}</div>
                <div className="mt-4 grid min-w-0 gap-3">
                  {item.statements.map((statement, statementIndex) => {
                    const answered = Object.prototype.hasOwnProperty.call(answerMap, statementIndex)
                    const value = answered ? Boolean(answerMap[statementIndex]) : false
                    const statementCorrect = answered && value === Boolean(statement.correct)
                    return (
                      <div key={statement.id || statementIndex} className="grid min-w-0 gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04] sm:grid-cols-[minmax(0,1fr)_130px] sm:items-center">
                        <div className="max-h-28 min-w-0 overflow-y-auto break-words whitespace-pre-wrap pr-1 text-sm font-bold leading-6 text-slate-700 dark:text-slate-200">
                          <span className="mr-2 font-black text-fuchsia-600 dark:text-fuchsia-300">{String.fromCharCode(97 + statementIndex)}.</span>{statement.text}
                        </div>
                        <button
                          type="button"
                          disabled={Boolean(showResult)}
                          onClick={() => onAnswer(index, !value, statementIndex)}
                          aria-pressed={answered ? value : undefined}
                          className={`relative flex h-11 w-full items-center rounded-full p-1 transition disabled:cursor-default ${value ? 'justify-end' : 'justify-start'} ${answered ? (value ? 'bg-emerald-500' : 'bg-rose-500') : 'bg-slate-300 dark:bg-slate-700'}`}
                        >
                          <span className={`absolute text-[11px] font-black text-white ${value ? 'left-3' : 'right-3'}`}>{answered ? (value ? 'ĐÚNG' : 'SAI') : 'CHỌN'}</span>
                          <span className="h-9 w-9 rounded-full bg-white shadow transition-all" />
                        </button>
                        {showResult && answered && (
                          <div className={`sm:col-span-2 rounded-xl px-3 py-2 text-xs font-bold ${statementCorrect ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200' : 'bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-200'}`}>
                            {statementCorrect ? 'Ý này chính xác.' : `Ý này chưa đúng. Đáp án là ${statement.correct ? 'Đúng' : 'Sai'}.`} {statement.explanation}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {showResult && isQuestionAnswered(item, index) && (
                  <div className={`mt-3 rounded-2xl px-4 py-3 text-sm font-bold ${allCorrect ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200' : 'bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-200'}`}>
                    {allCorrect ? 'Bạn đã chọn đúng cả 4 ý.' : 'Câu đúng/sai này vẫn còn ý chưa chính xác.'} {item.explanation}
                  </div>
                )}
              </div>
            )
          }

          const isCorrect = Number(selected) === Number(item.correctAnswer)
          return (
            <div key={index} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
              {item.passage && <div className="mb-4 max-h-56 min-w-0 overflow-auto rounded-2xl border border-fuchsia-200 bg-fuchsia-50 px-4 py-3 text-sm leading-6 text-slate-700 dark:border-fuchsia-400/20 dark:bg-fuchsia-500/10 dark:text-slate-200"><span className="font-black text-fuchsia-700 dark:text-fuchsia-300">Đoạn văn:</span> <span className="break-words whitespace-pre-wrap">{item.passage}</span></div>}
              <div className="max-h-32 min-w-0 overflow-y-auto break-words whitespace-pre-wrap pr-1 font-black leading-6 text-slate-950 dark:text-white">Câu {index + 1}: {item.question}</div>
              <div className="mt-3 grid min-w-0 gap-2 md:grid-cols-2">
                {item.options.map((option, optionIndex) => (
                  <button key={optionIndex} type="button" disabled={Boolean(showResult)} onClick={() => onAnswer(index, optionIndex)} className={`min-h-14 max-h-36 min-w-0 overflow-y-auto break-words whitespace-pre-wrap rounded-2xl border px-4 py-3 text-left text-sm font-bold leading-6 transition disabled:cursor-default ${Number(selected) === optionIndex ? 'border-sky-400 bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-200' : 'border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200'}`}>{option || `Đáp án ${optionIndex + 1}`}</button>
                ))}
              </div>
              {showResult && selected !== undefined && (
                <div className={`mt-3 rounded-2xl px-4 py-3 text-sm font-bold ${isCorrect ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200' : 'bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-200'}`}>
                  {isCorrect ? 'Đúng rồi.' : `Chưa đúng. Đáp án đúng là ${String.fromCharCode(65 + Number(item.correctAnswer))}.`} {item.explanation}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {result ? (
        <div className="mt-5 rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-black text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">Bạn đã hoàn thành quiz: {result.correct}/{result.total} câu đúng.</div>
      ) : (
        <button type="button" onClick={onSubmit} disabled={!allAnswered} className="mt-5 rounded-2xl bg-fuchsia-500 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">Nộp quiz</button>
      )}
    </section>
  )
}
export function NextCoursePanel({ course, onOpen }) {
  return (
    <section className="mt-8 rounded-[1.5rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="text-sm font-bold uppercase tracking-[0.3em] text-sky-600 dark:text-sky-300">Bước tiếp theo</div>
      <h2 className="mt-3 text-2xl font-black text-slate-950 dark:text-white">Bài học tiếp theo nên học</h2>
      {course ? (
        <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-black text-slate-950 dark:text-white">{stripHtml(course.title)}</div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{stripHtml(course.topic) || course.category || 'Bài học phù hợp'}</div>
          </div>
          <button type="button" onClick={() => onOpen(course)} className="rounded-xl bg-sky-500 px-5 py-2 text-sm font-black text-white hover:bg-sky-400">Học tiếp</button>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl bg-emerald-50 p-5 text-center dark:bg-emerald-500/10"><div className="text-4xl">🎉</div><p className="mt-3 font-black text-emerald-700 dark:text-emerald-300">Bạn đã xem hết các bài học hiện có!</p><p className="mt-2 text-sm leading-6 text-emerald-600/80 dark:text-emerald-300/80">Chúc mừng bạn! Hãy nghỉ ngơi một chút và quay lại khi ZUNY có nội dung mới nhé.</p></div>
      )}
    </section>
  )
}
export function CompletionModal({ onClose, nextCourse, onNext, isDarkMode }) {
  return (
    <div className={`${isDarkMode ? 'dark ' : ''}fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-md`}>
      <div className="w-full max-w-md rounded-[2rem] border border-emerald-200 bg-white p-6 text-center shadow-2xl shadow-emerald-900/20 dark:border-emerald-300/20 dark:bg-[#0f1324]">
        <div className="text-5xl">✅</div>
        <h2 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">Hoàn thành bài học</h2>
        <p className="mt-3 text-sm font-bold leading-6 text-slate-600 dark:text-slate-300">Tiến độ hoàn thành đã được ghi nhận vào hồ sơ học tập của bạn.</p>
        <div className="mt-6 grid gap-3">
          {nextCourse ? <button type="button" onClick={() => onNext(nextCourse)} className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white hover:bg-emerald-400">Tiếp tục bài ngẫu nhiên</button> : <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-sm font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">🎊 Bạn đã xem hết bài học hiện có. Tuyệt vời lắm!</div>}
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-200 dark:border-white/10 dark:bg-white/10 dark:text-white">Ở lại bài này</button>
        </div>
      </div>
    </div>
  )
}
export function LessonDetailBlock({ lesson, index, courseId, currentUser, currentRole, totalLessons, onSkipWarning }) {
  const mode = lesson.attachMode || 'youtube'

  return (
    <div id={`lesson-block-${index}`} className="scroll-mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-slate-950/50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-bold text-slate-950 dark:text-white">Bài {index + 1}: {lesson.title}</div>
          {lesson.content && <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{lesson.content}</div>}
        </div>
        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700 dark:bg-sky-400/10 dark:text-sky-200">
          {mode === 'youtube' ? 'YouTube' : mode === 'file' ? 'Word/PDF' : mode === 'code' ? `Code ${lesson.codeLanguage === 'cpp' ? 'C++' : 'JavaScript'}` : 'Tài liệu'}
        </span>
      </div>

      {mode === 'lumi' && lesson.lumiUrl && (
        <div className="mt-4 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10"><div className="relative h-[clamp(400px,70vh,820px)] w-full sm:h-[clamp(500px,76vh,900px)]"><iframe src={lesson.lumiUrl} title={lesson.title || `Lumi bài ${index + 1}`} className="absolute inset-0 h-full w-full border-0 bg-white" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-presentation" allow="fullscreen; autoplay; clipboard-read; clipboard-write" allowFullScreen /></div></div>
      )}

      {mode === 'youtube' && getYoutubeVideoId(lesson.youtubeUrl) && (
        <YoutubeProgressPlayer
          youtubeUrl={lesson.youtubeUrl}
          title={lesson.title || `Bài ${index + 1}`}
          courseId={courseId}
          currentUser={currentUser}
          currentRole={currentRole}
          lessonIndex={index}
          totalLessons={totalLessons}
          onSkipWarning={onSkipWarning}
        />
      )}

      {(mode === 'youtube' || mode === 'mp4') && !getYoutubeVideoId(lesson.youtubeUrl) && lesson.mp4FileUrl && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-black dark:border-white/10">
          <video
            src={lesson.mp4FileUrl}
            title={lesson.title || `MP4 bài ${index + 1}`}
            controls
            className="aspect-video w-full"
          />
        </div>
      )}

      {(mode === 'file' || mode === 'document') && lesson.wordFileUrl && (
        <div className="mt-4">
          {isPdfFile(lesson.wordFileName, lesson.wordFileUrl) && (
            <iframe
              src={lesson.wordFileUrl}
              title={lesson.wordFileName || `File bài ${index + 1}`}
              className="h-[500px] w-full rounded-2xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-950"
            />
          )}
          {lesson.fileExtractedText && (
            <div className="mt-4 whitespace-pre-line rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
              {lesson.fileExtractedText}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={lesson.wordFileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-3 rounded-2xl bg-sky-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-sky-300"
            >
              📄 Mở file {lesson.wordFileName || 'tài liệu'}
            </a>

            <a
              href={lesson.wordFileUrl}
              download={lesson.wordFileName || true}
              className="inline-flex items-center gap-3 rounded-2xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-emerald-300"
            >
              ⬇️ Tải xuống
            </a>
          </div>
        </div>
      )}

      {mode === 'code' && lesson.codeContent && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <pre className="min-h-72 overflow-auto rounded-2xl border border-emerald-400/20 bg-black p-5 font-mono text-sm leading-7 text-emerald-300">
            {lesson.codeContent}
          </pre>
          {lesson.codeLanguage === 'cpp' ? <CppNote /> : <CodeRunner code={lesson.codeContent} />}
        </div>
      )}

      {(mode === 'document' || mode === 'rich') && lesson.richDocument && (
        <div
          className="prose mt-4 max-w-none rounded-2xl bg-white p-5 text-base leading-8 text-slate-700 dark:prose-invert dark:bg-slate-950/70 dark:text-slate-200 [&_ol]:ml-6 [&_ol]:list-decimal [&_ul]:ml-6 [&_ul]:list-disc"
          dangerouslySetInnerHTML={{ __html: lesson.richDocument }}
        />
      )}
    </div>
  )
}
export function YoutubeProgressPlayer({
  youtubeUrl,
  title,
  courseId,
  currentUser,
  currentRole,
  lessonIndex = 0,
  totalLessons = 1,
  onSkipWarning,
  autoPlay = false,
  onEnded,
}) {
  const videoId = getYoutubeVideoId(youtubeUrl)
  const playerElementId = `youtube-player-${courseId || 'course'}-${lessonIndex}-${videoId}`
  const [progressText, setProgressText] = useState('Đang tải tiến trình đã lưu...')
  const [progressValue, setProgressValue] = useState(0)
  const maxWatchedRef = useRef(0)
  const lastPlayerTimeRef = useRef(0)
  const warningCooldownRef = useRef(0)
  const seekViolationCountRef = useRef(0)
  const warningActiveRef = useRef(false)
  const hasRestoredRef = useRef(false)
  const onSkipWarningRef = useRef(onSkipWarning)
  const onEndedRef = useRef(onEnded)
  const playerRef = useRef(null)

  useEffect(() => {
    onSkipWarningRef.current = onSkipWarning
  }, [onSkipWarning])

  useEffect(() => {
    onEndedRef.current = onEnded
  }, [onEnded])

  useEffect(() => {
    if (!videoId) return

    let player = null
    let interval = null
    let cancelled = false

    seekViolationCountRef.current = 0
    warningActiveRef.current = false
    hasRestoredRef.current = false

    async function loadSavedProgress() {
      if (!currentUser || !courseId || !canTrackLearningProgress(currentRole)) return 0

      try {
        const progressRef = doc(db, 'learningStats', currentUser.uid, 'courses', courseId)
        const progressSnap = await getDoc(progressRef)

        if (!progressSnap.exists()) return 0

        const data = progressSnap.data()
        const lessonMaxWatchedSeconds = data.lessonMaxWatchedSeconds || {}
        const lessonWatchedSeconds = data.lessonWatchedSeconds || {}
        const savedTime =
          Number(lessonMaxWatchedSeconds[lessonIndex] || 0) ||
          Number(lessonWatchedSeconds[lessonIndex] || 0) ||
          Number(data.watchedSeconds || 0)

        return Math.max(0, savedTime)
      } catch (error) {
        console.warn('Không thể tải tiến trình YouTube đã lưu:', error)
        return 0
      }
    }

    async function saveYoutubeProgress(watchedTime, duration) {
      if (!currentUser || !courseId || !canTrackLearningProgress(currentRole) || !duration) return

      const safeWatchedTime = Math.min(Number(watchedTime || 0), Number(duration || 0))
      const watchedSeconds = Math.floor(safeWatchedTime)
      const durationSeconds = Math.floor(duration)
      const lessonProgress = Math.min(100, Math.round((safeWatchedTime / duration) * 100))
      const safeTotalLessons = Math.max(1, Number(totalLessons || 1))
      const courseProgress =
        safeTotalLessons <= 1
          ? lessonProgress
          : Math.min(100, Math.round(((lessonIndex + lessonProgress / 100) / safeTotalLessons) * 100))

      const today = getLocalDateKey()
      const statsRef = doc(db, 'learningStats', currentUser.uid)
      const progressRef = doc(db, 'learningStats', currentUser.uid, 'courses', courseId)

      await setDoc(
        progressRef,
        {
          courseId,
          progress: courseProgress,
          watchedSeconds,
          durationSeconds,
          lastViewedAt: serverTimestamp(),
          lastWatchedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          watchedDate: today,
          [`lessonProgress.${lessonIndex}`]: lessonProgress,
          [`lessonWatchedSeconds.${lessonIndex}`]: watchedSeconds,
          [`lessonDurationSeconds.${lessonIndex}`]: durationSeconds,
          [`lessonMaxWatchedSeconds.${lessonIndex}`]: watchedSeconds,
        },
        { merge: true },
      )

      const statsSnap = await getDoc(statsRef)
      const statsData = statsSnap.exists() ? statsSnap.data() : {}
      const oldDates = Array.isArray(statsData.watchedDates) ? statsData.watchedDates : []
      const oldCourseIds = Array.isArray(statsData.watchedCourseIds) ? statsData.watchedCourseIds : []
      const nextDates = oldDates.includes(today) ? oldDates : [...oldDates, today]
      const nextCourseIds = oldCourseIds.includes(courseId) ? oldCourseIds : [...oldCourseIds, courseId]

      await setDoc(
        statsRef,
        {
          watchedLessons: nextCourseIds.length,
          watchedCourses: nextCourseIds.length,
          watchedCourseIds: nextCourseIds,
          watchedDates: nextDates,
          firstWatchedAt: statsData.firstWatchedAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    }

    function showSkipWarning(payload) {
      const now = Date.now()
      if (warningActiveRef.current || now - warningCooldownRef.current < 700) return
      warningCooldownRef.current = now
      warningActiveRef.current = true

      const finishWarning = () => {
        warningActiveRef.current = false
        payload?.onConfirm?.()
      }
      const warningPayload = { ...payload, onConfirm: finishWarning }

      if (typeof onSkipWarningRef.current === 'function') {
        onSkipWarningRef.current(warningPayload)
      } else {
        window.dispatchEvent(new CustomEvent('youtube-skip-warning', { detail: warningPayload }))
      }
    }

    function updateProgressDisplay(watchedTime, duration) {
      if (!duration) return

      const safeWatchedTime = Math.min(Number(watchedTime || 0), Number(duration || 0))
      const nextProgress = Math.min(100, Math.round((safeWatchedTime / duration) * 100))

      setProgressValue(nextProgress)
      setProgressText(`${formatSeconds(safeWatchedTime)} / ${formatSeconds(duration)} • ${nextProgress}%`)
    }

    function syncProgress() {
      if (!player || typeof player.getCurrentTime !== 'function') return

      const currentTime = Number(player.getCurrentTime() || 0)
      const duration = Number(player.getDuration() || 0)

      if (!duration) return

      const currentMaxWatched = Number(maxWatchedRef.current || 0)
      const allowedForwardLimit = currentMaxWatched + 60

      if (currentTime > allowedForwardLimit && !warningActiveRef.current) {
        const previousTime = Math.max(0, Math.min(Number(lastPlayerTimeRef.current || currentMaxWatched), currentMaxWatched))
        seekViolationCountRef.current += 1
        const violationCount = seekViolationCountRef.current
        const forceRestart = violationCount > 3
        const waitSeconds = forceRestart ? 30 : violationCount === 3 ? 20 : 0
        const resumeTime = forceRestart ? 0 : previousTime

        player.pauseVideo?.()
        player.seekTo(resumeTime, true)
        lastPlayerTimeRef.current = resumeTime

        if (forceRestart) {
          maxWatchedRef.current = 0
          seekViolationCountRef.current = 0
          updateProgressDisplay(0, duration)
          saveYoutubeProgress(0, duration).catch((error) => console.warn('Không thể đặt lại tiến trình sau khi tua quá nhiều:', error))
        } else {
          updateProgressDisplay(currentMaxWatched, duration)
        }

        showSkipWarning({
          violationCount,
          waitSeconds,
          forceRestart,
          previousTime,
          attemptedTime: currentTime,
          onConfirm: () => {
            player.seekTo(resumeTime, true)
            lastPlayerTimeRef.current = resumeTime
            player.playVideo?.()
          },
        })
        return
      }

      if (currentTime > currentMaxWatched) {
        maxWatchedRef.current = currentTime
      }

      lastPlayerTimeRef.current = currentTime

      const safeWatchedTime = Math.min(maxWatchedRef.current, duration)
      updateProgressDisplay(safeWatchedTime, duration)

      saveYoutubeProgress(safeWatchedTime, duration).catch((error) => {
        console.warn('Không thể lưu tiến trình YouTube:', error)
      })
    }

    function createPlayer() {
      if (cancelled || !window.YT?.Player || !document.getElementById(playerElementId)) return

      player = new window.YT.Player(playerElementId, {
        host: 'https://www.youtube-nocookie.com',
        videoId,
        playerVars: {
          autoplay: autoPlay ? 1 : 0,
          controls: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          cc_load_policy: 0,
          fs: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: async () => {
            playerRef.current = player
            const savedTime = await loadSavedProgress()

            if (cancelled || !player) return

            const duration = Number(player.getDuration?.() || 0)
            const safeSavedTime = duration ? Math.min(savedTime, duration) : savedTime

            maxWatchedRef.current = safeSavedTime
            lastPlayerTimeRef.current = safeSavedTime

            if (safeSavedTime > 0 && !hasRestoredRef.current) {
              hasRestoredRef.current = true
              player.seekTo(safeSavedTime, true)
            }

            updateProgressDisplay(safeSavedTime, duration)

            interval = setInterval(syncProgress, 500)
          },
          onStateChange: (event) => {
            syncProgress()
            if (event?.data === window.YT?.PlayerState?.ENDED && typeof onEndedRef.current === 'function') onEndedRef.current()
          },
        },
      })
    }

    loadYoutubeIframeApi().then(createPlayer)

    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
      playerRef.current = null
      if (player?.destroy) player.destroy()
    }
  }, [videoId, playerElementId, courseId, currentUser?.uid, currentRole, lessonIndex, totalLessons, autoPlay])

  if (!videoId) return null


  const fitClass = 'aspect-video w-[min(100%,calc((100dvh-150px)*16/9))] max-h-[calc(100dvh-150px)] lg:h-[min(500px,calc(100dvh-180px))] lg:w-[min(100%,800px)] lg:aspect-auto lg:max-h-none 2xl:h-[min(680px,calc(100dvh-160px))] 2xl:w-[min(100%,1100px)]'

  return (
    <div className="flex w-full flex-col items-center justify-center bg-black">
      <div className={`relative mx-auto shrink-0 overflow-hidden bg-black ${fitClass}`}>
        <div id={playerElementId} title={title} className="absolute inset-0 h-full w-full" />
      </div>
      <div className="w-full border-t border-white/10 bg-[#111] px-2.5 py-2.5 sm:px-4">
        <div className="flex justify-end">
          <span className="shrink-0 text-[11px] font-bold text-slate-300 sm:text-xs">{progressText}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-gradient-to-r from-red-400 to-sky-400 transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, progressValue))}%` }} />
        </div>
      </div>
    </div>
  )
}


function Mp4LearningPlayer({ src, autoPlay, onEnded, courseId, currentUser, currentRole, lessonIndex = 0, totalLessons = 1, onSkipWarning }) {
  const videoRef = useRef(null)
  const maxWatchedRef = useRef(0)
  const lastTimeRef = useRef(0)
  const violationCountRef = useRef(0)
  const warningActiveRef = useRef(false)
  const [progressText, setProgressText] = useState('Đang tải tiến trình đã lưu...')
  const [progressValue, setProgressValue] = useState(0)
  const fitClass = 'aspect-video w-[min(100%,calc((100dvh-150px)*16/9))] max-h-[calc(100dvh-150px)] lg:h-[min(500px,calc(100dvh-180px))] lg:w-[min(100%,800px)] lg:aspect-auto lg:max-h-none 2xl:h-[min(680px,calc(100dvh-160px))] 2xl:w-[min(100%,1100px)]'

  useEffect(() => {
    let cancelled = false
    violationCountRef.current = 0
    warningActiveRef.current = false

    async function restore() {
      if (!currentUser?.uid || !courseId || !canTrackLearningProgress(currentRole)) return
      try {
        const snap = await getDoc(doc(db, 'learningStats', currentUser.uid, 'courses', courseId))
        if (!snap.exists() || cancelled) return
        const data = snap.data()
        const saved = Number(data.lessonMaxWatchedSeconds?.[lessonIndex] || data.lessonWatchedSeconds?.[lessonIndex] || data.watchedSeconds || 0)
        maxWatchedRef.current = Math.max(0, saved)
        lastTimeRef.current = maxWatchedRef.current
        const video = videoRef.current
        if (video && saved > 0) video.currentTime = Math.min(saved, Number(video.duration || saved))
      } catch (error) {
        console.warn('Không thể khôi phục tiến trình MP4:', error)
      }
    }
    restore()
    return () => { cancelled = true }
  }, [src, courseId, currentUser?.uid, currentRole, lessonIndex])

  async function saveProgress(watchedTime, duration) {
    if (!currentUser?.uid || !courseId || !duration || !canTrackLearningProgress(currentRole)) return
    const safe = Math.max(0, Math.min(Number(watchedTime || 0), duration))
    const lessonProgress = Math.min(100, Math.round((safe / duration) * 100))
    const safeTotalLessons = Math.max(1, Number(totalLessons || 1))
    const courseProgress = safeTotalLessons <= 1 ? lessonProgress : Math.min(100, Math.round(((lessonIndex + lessonProgress / 100) / safeTotalLessons) * 100))
    await setDoc(doc(db, 'learningStats', currentUser.uid, 'courses', courseId), {
      courseId,
      progress: courseProgress,
      watchedSeconds: Math.floor(safe),
      durationSeconds: Math.floor(duration),
      lastViewedAt: serverTimestamp(),
      lastWatchedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      [`lessonProgress.${lessonIndex}`]: lessonProgress,
      [`lessonWatchedSeconds.${lessonIndex}`]: Math.floor(safe),
      [`lessonDurationSeconds.${lessonIndex}`]: Math.floor(duration),
      [`lessonMaxWatchedSeconds.${lessonIndex}`]: Math.floor(safe),
    }, { merge: true })
  }

  function updateDisplay(watched, duration) {
    if (!duration) return
    const safe = Math.max(0, Math.min(watched, duration))
    const percent = Math.min(100, Math.round((safe / duration) * 100))
    setProgressValue(percent)
    setProgressText(`${formatSeconds(safe)} / ${formatSeconds(duration)} • ${percent}%`)
  }

  function handleTimeUpdate() {
    const video = videoRef.current
    if (!video || !video.duration) return
    const currentTime = Number(video.currentTime || 0)
    const currentMax = Number(maxWatchedRef.current || 0)

    if (currentTime > currentMax + 60 && !warningActiveRef.current) {
      const previousTime = Math.max(0, Math.min(Number(lastTimeRef.current || currentMax), currentMax))
      violationCountRef.current += 1
      const violationCount = violationCountRef.current
      const forceRestart = violationCount > 3
      const waitSeconds = forceRestart ? 30 : violationCount === 3 ? 20 : 0
      const resumeTime = forceRestart ? 0 : previousTime
      video.pause()
      video.currentTime = resumeTime
      lastTimeRef.current = resumeTime
      warningActiveRef.current = true

      if (forceRestart) {
        maxWatchedRef.current = 0
        violationCountRef.current = 0
        updateDisplay(0, video.duration)
        saveProgress(0, video.duration).catch(() => {})
      }

      const finish = () => {
        warningActiveRef.current = false
        video.currentTime = resumeTime
        lastTimeRef.current = resumeTime
        video.play().catch(() => {})
      }
      const payload = { violationCount, waitSeconds, forceRestart, previousTime, attemptedTime: currentTime, onConfirm: finish }
      if (typeof onSkipWarning === 'function') onSkipWarning(payload)
      else window.dispatchEvent(new CustomEvent('youtube-skip-warning', { detail: payload }))
      return
    }

    if (currentTime > currentMax) maxWatchedRef.current = currentTime
    lastTimeRef.current = currentTime
    updateDisplay(maxWatchedRef.current, video.duration)
    saveProgress(maxWatchedRef.current, video.duration).catch(() => {})
  }

  return <div className="flex w-full flex-col items-center justify-center bg-black">
    <div className={`relative mx-auto shrink-0 overflow-hidden bg-black ${fitClass}`}>
      <video ref={videoRef} src={src} controls autoPlay={autoPlay} onEnded={onEnded} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleTimeUpdate} className="absolute inset-0 h-full w-full bg-black object-contain" />
    </div>
    <div className="w-full border-t border-white/10 bg-[#111] px-2.5 py-2.5 sm:px-4">
      <div className="flex justify-end"><span className="text-[11px] font-bold text-slate-300 sm:text-xs">{progressText}</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-red-400 to-sky-400 transition-all duration-500" style={{ width: `${progressValue}%` }} /></div>
    </div>
  </div>
}

export function HonestyWarningModal({ warning = {}, onClose, isDarkMode }) {
  const waitSeconds = Math.max(0, Number(warning.waitSeconds || 0))
  const [remaining, setRemaining] = useState(waitSeconds)

  useEffect(() => {
    setRemaining(waitSeconds)
    if (!waitSeconds) return undefined
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [waitSeconds, warning.violationCount, warning.forceRestart])

  const forceRestart = Boolean(warning.forceRestart)
  const thirdWarning = !forceRestart && Number(warning.violationCount || 0) === 3
  const title = forceRestart ? 'Bạn đã tua quá nhiều 😵‍💫' : thirdWarning ? 'Đến lượt kiểm điểm bản thân rồi 😄' : 'Khoan đã, học chậm mà chắc nhé!'
  const message = forceRestart
    ? 'Bạn đã tua quá số lần cho phép. Tôi phạt bạn kiểm điểm bản thân 30 giây, sau đó video sẽ bắt đầu lại từ đầu.'
    : thirdWarning
      ? 'Đây là lần vi phạm thứ ba hãy tự kiểm điểm mình 20 giây rồi mới tiếp tục học nhé!'
      : 'Hãy trung thực khi xem video !!! Video đã quay lại đúng vị trí trước khi bạn tua.'

  function confirm() {
    if (remaining > 0) return
    warning.onConfirm?.()
    onClose?.()
  }

  return (
    <div className={`${isDarkMode ? 'dark ' : ''}fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-md`}>
      <div className={`w-full max-w-md rounded-[2rem] border bg-white p-6 text-center shadow-2xl dark:bg-[#0f1324] ${forceRestart ? 'border-rose-200 shadow-rose-900/20 dark:border-rose-300/20' : 'border-amber-200 shadow-amber-900/20 dark:border-amber-300/20'}`}>
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-3xl text-4xl ${forceRestart ? 'bg-rose-400/15' : 'bg-amber-400/15'}`}>{forceRestart ? '🌀' : thirdWarning ? '📝' : '⚠️'}</div>
        <h2 className="mt-5 text-2xl font-black text-slate-950 dark:text-white">{title}</h2>
        <p className="mt-3 text-sm font-bold leading-6 text-slate-600 dark:text-slate-300">{message}</p>
        {remaining > 0 && <div className="mx-auto mt-5 grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-xl font-black text-slate-800 dark:bg-white/10 dark:text-white">{remaining}s</div>}
        <button type="button" disabled={remaining > 0} onClick={confirm} className={`mt-6 w-full rounded-2xl px-4 py-3 text-sm font-black transition ${remaining > 0 ? 'cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-white/10 dark:text-slate-500' : forceRestart ? 'cursor-pointer bg-gradient-to-r from-rose-500 to-pink-500 text-white hover:-translate-y-0.5' : 'cursor-pointer bg-gradient-to-r from-amber-300 to-orange-400 text-slate-950 hover:-translate-y-0.5'}`}>
          {remaining > 0 ? `Vui lòng chờ ${remaining} giây` : forceRestart ? 'Bắt đầu học lại từ đầu' : 'Tôi đã hiểu, tiếp tục học'}
        </button>
      </div>
    </div>
  )
}

export function QAPanel({ courseId, currentUser, userProfile, currentRole, courseOwnerId, focusQuestionId = '', focusReplyId = '', onOpenUser }) {
  const [questions, setQuestions] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [replyDrafts, setReplyDrafts] = useState({})
  const [replyingId, setReplyingId] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editingDraft, setEditingDraft] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [cooldownLeft, setCooldownLeft] = useState(0)
  const [reportTarget, setReportTarget] = useState(null)
  const [reportReason, setReportReason] = useState('Nội dung không phù hợp')
  const [reportDetail, setReportDetail] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportCooldownLeft, setReportCooldownLeft] = useState(0)
  const [pendingWarnings, setPendingWarnings] = useState([])
  const [warningCountdown, setWarningCountdown] = useState(10)
  const [notice, setNotice] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [highlightTarget, setHighlightTarget] = useState('')
  const focusedTargetRef = useRef('')
  const emojis = ['😀', '😊', '👍', '❤️', '🎉', '🤔', '😢', '😮', '🙏', '🔥']
  const reportReasons = ['Nội dung không phù hợp', 'Spam hoặc quảng cáo', 'Quấy rối hoặc xúc phạm', 'Thông tin sai lệch', 'Vi phạm bản quyền', 'Lý do khác']
  const normalizedRole = String(currentRole || userProfile?.role || userProfile?.Role || userProfile?.accountType || '').replace(/[\s_-]/g, '').toUpperCase()
  const isCurrentAdmin = ['ADMIN', 'ADMINDEV'].includes(normalizedRole)
  const displayName = userProfile?.fullName || userProfile?.name || userProfile?.displayName || currentUser?.displayName || currentUser?.email || 'Người dùng ZUNY'
  const avatar = userProfile?.photoURL || userProfile?.avatar || userProfile?.avatarUrl || userProfile?.profileImage || currentUser?.photoURL || ''
  const activeWarning = pendingWarnings[0] || null

  function getTime(value) { return value?.toMillis?.() || (value?.seconds ? value.seconds * 1000 : new Date(value || 0).getTime()) || 0 }
  function sameSender(first, second) { return Boolean(first && second && String(first.userId || '') === String(second.userId || '')) }
  function showNotice(type, title, message) {
    setNotice({ type, title, message })
    window.setTimeout(() => setNotice(null), 3200)
  }

  useEffect(() => {
    if (!courseId) return undefined
    return onSnapshot(collection(db, 'courses', courseId, 'questions'), (snapshot) => {
      setQuestions(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => getTime(a.createdAt) - getTime(b.createdAt)))
    }, (error) => console.warn('Không thể đồng bộ hỏi đáp:', error))
  }, [courseId])

  useEffect(() => {
    if (!currentUser?.uid) { setPendingWarnings([]); return undefined }
    return onSnapshot(collection(db, 'users', currentUser.uid, 'commentWarnings'), (snapshot) => {
      const warnings = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((item) => !item.acknowledgedAt && String(item.status || 'pending') === 'pending')
        .sort((a, b) => getTime(a.createdAt) - getTime(b.createdAt))
      setPendingWarnings(warnings)
    }, (error) => console.warn('Không thể đồng bộ cảnh báo comment:', error))
  }, [currentUser?.uid])

  useEffect(() => {
    setWarningCountdown(activeWarning ? 10 : 0)
  }, [activeWarning?.id])

  useEffect(() => {
    if (warningCountdown <= 0) return undefined
    const timer = window.setInterval(() => setWarningCountdown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [warningCountdown])

  useEffect(() => {
    if (cooldownLeft <= 0) return undefined
    const timer = window.setInterval(() => setCooldownLeft((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [cooldownLeft])

  useEffect(() => {
    if (reportCooldownLeft <= 0) return undefined
    const timer = window.setInterval(() => setReportCooldownLeft((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [reportCooldownLeft])

  function openUser(userId) { if (userId) onOpenUser?.(String(userId)) }
  async function notifyCourseOwner(notificationId, payload = {}) {
    const ownerId = String(courseOwnerId || '')
    if (!ownerId || !notificationId || ownerId === String(currentUser?.uid || '')) return
    try {
      const dismissalSnap = await getDoc(doc(db, 'users', ownerId, 'elearningNotificationDismissals', notificationId))
      if (dismissalSnap.exists()) return
      await setDoc(doc(db, 'users', ownerId, 'elearningNotifications', notificationId), {
        title: payload.title || 'Hoạt động hỏi đáp mới',
        message: payload.message || '',
        type: payload.type || 'course_qa',
        courseId,
        questionId: payload.questionId || '',
        replyId: payload.replyId || '',
        actorId: currentUser?.uid || '',
        read: false,
        createdAt: serverTimestamp(),
      }, { merge: true })
    } catch (error) {
      console.warn('Không thể tạo thông báo hỏi đáp:', error)
    }
  }

  function requireWarningAcknowledgement() {
    if (!activeWarning) return false
    showNotice('warning', 'Bạn có cảnh báo chưa xác nhận', 'Hãy đọc và xác nhận cảnh báo trước khi tiếp tục bình luận.')
    return true
  }

  async function acknowledgeWarning() {
    if (!currentUser?.uid || !activeWarning || warningCountdown > 0) return
    try {
      await updateDoc(doc(db, 'users', currentUser.uid, 'commentWarnings', activeWarning.id), {
        status: 'acknowledged', acknowledgedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
    } catch (error) {
      console.error('Không thể xác nhận cảnh báo:', error)
      showNotice('error', 'Chưa xác nhận được', 'Vui lòng thử lại sau.')
    }
  }

  async function sendQuestion(event) {
    event.preventDefault()
    if (requireWarningAcknowledgement()) return
    const content = draft.trim()
    if (!content || !currentUser?.uid || sending || cooldownLeft > 0) return
    try {
      setSending(true)
      const questionRef = doc(collection(db, 'courses', courseId, 'questions'))
      await setDoc(questionRef, {
        content, userId: currentUser.uid, userName: displayName, userAvatar: avatar,
        userRole: normalizedRole || 'STUDENT', isAdmin: isCurrentAdmin, replies: [],
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
      await notifyCourseOwner(`course_question_${courseId}_${questionRef.id}`, {
        type: 'course_question',
        questionId: questionRef.id,
        title: 'Bài học có câu hỏi mới',
        message: `${displayName} đã đặt câu hỏi trong bài học của bạn: “${content.slice(0, 120)}${content.length > 120 ? '…' : ''}”`,
      })
      setDraft(''); setEmojiOpen(false); setCooldownLeft(10)
    } catch (error) {
      console.error('Không thể gửi câu hỏi:', error)
      showNotice('error', 'Chưa gửi được câu hỏi', 'Vui lòng thử lại.')
    } finally { setSending(false) }
  }

  async function sendReply(question) {
    if (requireWarningAcknowledgement()) return
    const content = String(replyDrafts[question.id] || '').trim()
    if (!content || !currentUser?.uid) return
    try {
      const replyId = `${currentUser.uid}_${Date.now()}`
      await updateDoc(doc(db, 'courses', courseId, 'questions', question.id), {
        replies: arrayUnion({
          id: replyId, content, userId: currentUser.uid, userName: displayName,
          userAvatar: avatar, userRole: normalizedRole || 'STUDENT', isAdmin: isCurrentAdmin,
          isTeacherReply: String(currentUser.uid) === String(courseOwnerId || ''), createdAt: new Date().toISOString(),
        }), updatedAt: serverTimestamp(),
      })
      await notifyCourseOwner(`course_reply_${courseId}_${question.id}_${replyId}`, {
        type: 'course_reply',
        questionId: question.id,
        replyId,
        title: 'Bài học có câu trả lời mới',
        message: `${displayName} đã trả lời trong phần hỏi đáp bài học của bạn: “${content.slice(0, 120)}${content.length > 120 ? '…' : ''}”`,
      })
      setReplyDrafts((current) => ({ ...current, [question.id]: '' })); setReplyingId('')
    } catch (error) {
      console.error('Không thể gửi câu trả lời:', error)
      showNotice('error', 'Chưa gửi được câu trả lời', 'Vui lòng thử lại.')
    }
  }

  function canDeleteQuestion(question) {
    if (!currentUser?.uid) return false
    return String(question.userId || '') === String(currentUser.uid) || (isCurrentAdmin && !Boolean(question.isAdmin))
  }
  function canDeleteReply(reply) {
    if (!currentUser?.uid) return false
    return String(reply.userId || '') === String(currentUser.uid) || (isCurrentAdmin && !Boolean(reply.isAdmin))
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      if (deleteTarget.reply) {
        const nextReplies = (deleteTarget.question.replies || []).filter((item) => item.id !== deleteTarget.reply.id)
        await updateDoc(doc(db, 'courses', courseId, 'questions', deleteTarget.question.id), { replies: nextReplies, updatedAt: serverTimestamp() })
      } else {
        await deleteDoc(doc(db, 'courses', courseId, 'questions', deleteTarget.question.id))
      }
      setDeleteTarget(null)
      showNotice('success', 'Đã xóa bình luận', 'Nội dung đã được cập nhật.')
    } catch (error) {
      console.error('Không thể xóa bình luận:', error)
      showNotice('error', 'Chưa xóa được bình luận', 'Vui lòng thử lại.')
    }
  }

  async function saveQuestionEdit(question) {
    const content = editingDraft.trim()
    if (!content || String(question.userId || '') !== String(currentUser?.uid || '')) return
    try {
      await updateDoc(doc(db, 'courses', courseId, 'questions', question.id), { content, updatedAt: serverTimestamp(), editedAt: serverTimestamp() })
      setEditingId(''); setEditingDraft('')
    } catch (error) { showNotice('error', 'Chưa lưu được thay đổi', 'Vui lòng thử lại.') }
  }

  async function submitReport(event) {
    event.preventDefault()
    if (!currentUser?.uid || !reportTarget || reportSubmitting || reportCooldownLeft > 0) return
    const targetKey = `${reportTarget.questionId}_${reportTarget.replyId || 'question'}`
    const reportId = `${currentUser.uid}_${targetKey}`.replace(/[^a-zA-Z0-9_-]/g, '_')
    try {
      setReportSubmitting(true)
      await runTransaction(db, async (transaction) => {
        const reportRef = doc(db, 'learningCommentReports', reportId)
        const userRef = doc(db, 'users', currentUser.uid)
        const [reportSnap, userSnap] = await Promise.all([transaction.get(reportRef), transaction.get(userRef)])
        if (reportSnap.exists()) throw new Error('DUPLICATE_REPORT')
        const lastReportMs = getTime(userSnap.exists() ? userSnap.data().lastCommentReportAt : null)
        if (lastReportMs && Date.now() - lastReportMs < 10000) throw new Error(`REPORT_COOLDOWN_${Math.ceil((10000 - (Date.now() - lastReportMs)) / 1000)}`)
        transaction.set(reportRef, {
          courseId, courseOwnerId: courseOwnerId || '', questionId: reportTarget.questionId,
          replyId: reportTarget.replyId || '', commentType: reportTarget.replyId ? 'reply' : 'question',
          commentContent: reportTarget.content || '', commentUserId: reportTarget.userId || '',
          commentUserName: reportTarget.userName || '', reporterId: currentUser.uid,
          reporterName: displayName, reporterEmail: currentUser.email || '', reason: reportReason,
          detail: reportDetail.trim(), status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        })
        transaction.set(userRef, { lastCommentReportAt: serverTimestamp() }, { merge: true })
      })
      await setDoc(doc(db, 'users', currentUser.uid, 'elearningNotifications', `comment_report_submitted_${reportId}`), {
        title: 'Đã gửi báo cáo tới quản trị viên',
        message: `Báo cáo về ${reportTarget.replyId ? 'phản hồi' : 'bình luận'} của ${reportTarget.userName || 'người dùng'} đã được tiếp nhận và đang chờ xử lý.`,
        type: 'comment_report_submitted',
        courseId,
        reportId,
        actorId: currentUser.uid,
        read: false,
        createdAt: serverTimestamp(),
      })
      setReportTarget(null); setReportDetail(''); setReportReason(reportReasons[0]); setReportCooldownLeft(10)
      showNotice('success', 'Đã gửi báo cáo tới quản trị viên', 'Bạn sẽ nhận thông báo khi báo cáo được giải quyết.')
    } catch (error) {
      const code = String(error?.message || '')
      if (code === 'DUPLICATE_REPORT') showNotice('warning', 'Bạn đã báo cáo tin nhắn này', 'Mỗi người chỉ được báo cáo một lần cho cùng một tin nhắn.')
      else if (code.startsWith('REPORT_COOLDOWN_')) {
        const seconds = Number(code.split('_').pop() || 10); setReportCooldownLeft(seconds)
        showNotice('warning', 'Hãy chờ trước khi báo cáo tiếp', `Bạn có thể báo cáo tin nhắn khác sau ${seconds} giây.`)
      } else showNotice('error', 'Chưa gửi được báo cáo', 'Vui lòng thử lại.')
    } finally { setReportSubmitting(false) }
  }

  useEffect(() => {
    const targetId = focusReplyId ? `qa-reply-${focusReplyId}` : focusQuestionId ? `qa-question-${focusQuestionId}` : ''
    if (!targetId || !questions.length || focusedTargetRef.current === targetId) return
    const element = document.getElementById(targetId)
    if (!element) return
    focusedTargetRef.current = targetId
    setHighlightTarget(targetId)
    window.setTimeout(() => element.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120)
    const timer = window.setTimeout(() => setHighlightTarget(''), 2000)
    return () => window.clearTimeout(timer)
  }, [questions, focusQuestionId, focusReplyId])

  useEffect(() => {
    focusedTargetRef.current = ''
  }, [focusQuestionId, focusReplyId])

  return <section className="[&_button]:cursor-pointer">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-sky-600 dark:text-sky-300">Trao đổi trực tiếp</p><h2 className="mt-1 text-xl font-black">Hỏi đáp bài học</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Gửi câu hỏi và theo dõi câu trả lời.</p></div><span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-black text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">{questions.length} câu hỏi</span></div>

    <div className="mt-5 max-h-[520px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 [scrollbar-color:#94a3b8_transparent] [scrollbar-width:thin] dark:border-white/10 dark:bg-white/[0.02] sm:p-4">
      {questions.length ? questions.map((question, index) => {
        const previous = questions[index - 1]
        const grouped = sameSender(previous, question)
        const replies = Array.isArray(question.replies) ? question.replies : []
        return <article id={`qa-question-${question.id}`} key={question.id} className={`${grouped ? 'mt-1.5 border-t-0 pt-1.5' : index ? 'mt-4 border-t border-slate-200 pt-4 dark:border-white/10' : ''} scroll-mt-28 rounded-2xl transition-all duration-300 ${highlightTarget === `qa-question-${question.id}` ? 'animate-pulse bg-amber-100/90 ring-4 ring-amber-400/70 dark:bg-amber-500/20' : ''}`}>
          <div className="flex gap-3">
            <div className="w-10 shrink-0">{!grouped && <button type="button" onClick={() => openUser(question.userId)} className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-blue-600 text-xs font-black text-white" title="Xem kênh của người dùng">{question.userAvatar ? <img src={question.userAvatar} alt="" className="h-full w-full object-cover" /> : String(question.userName || 'Z').slice(0, 2).toUpperCase()}</button>}</div>
            <div className="min-w-0 flex-1">
              {!grouped && <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => openUser(question.userId)} className="text-sm font-black hover:text-blue-600 dark:hover:text-sky-400">{question.userName || 'Người dùng ZUNY'}</button>{question.isAdmin && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black text-white">ADMIN</span>}<span className="text-[11px] text-slate-400">đã hỏi</span></div>}
              <div className={`${grouped ? '' : 'mt-1.5'} rounded-2xl bg-slate-50 px-3.5 py-2.5 dark:bg-white/[0.045]`}>
                {editingId === question.id ? <div><textarea value={editingDraft} onChange={(event) => setEditingDraft(event.target.value)} rows="2" className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-blue-500 dark:border-white/10 dark:bg-white/5" /><div className="mt-2 flex gap-2"><button type="button" onClick={() => saveQuestionEdit(question)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-black text-white">Lưu</button><button type="button" onClick={() => { setEditingId(''); setEditingDraft('') }} className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-black dark:bg-white/10">Hủy</button></div></div> : <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{question.content}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-black"><span className="font-semibold text-slate-400">{formatFullDateTime(question.createdAt || question.updatedAt)}</span><button type="button" onClick={() => setReplyingId((current) => current === question.id ? '' : question.id)} className="text-blue-600 dark:text-sky-400">↩ Trả lời</button>{String(question.userId || '') === String(currentUser?.uid || '') && <button type="button" onClick={() => { setEditingId(question.id); setEditingDraft(question.content || '') }} className="text-amber-600">✎ Chỉnh sửa</button>}{canDeleteQuestion(question) && <button type="button" onClick={() => setDeleteTarget({ question })} className="text-rose-600">🗑 Xóa</button>}<button type="button" onClick={() => setReportTarget({ questionId: question.id, content: question.content, userId: question.userId, userName: question.userName })} className="text-slate-500 hover:text-rose-600">⚑ Báo cáo</button></div>
              </div>
            </div>
          </div>
          {replies.length > 0 && <div className="ml-[52px] mt-2 border-l-2 border-slate-200 pl-3 dark:border-white/10">{replies.map((reply, replyIndex) => { const previousReply = replies[replyIndex - 1]; const groupedReply = sameSender(previousReply, reply); return <div id={`qa-reply-${reply.id}`} key={reply.id} className={`${groupedReply ? 'mt-1' : replyIndex ? 'mt-3' : ''} scroll-mt-28 rounded-xl transition-all duration-300 ${highlightTarget === `qa-reply-${reply.id}` ? 'animate-pulse bg-amber-100/90 ring-4 ring-amber-400/70 dark:bg-amber-500/20' : ''} flex gap-2`}><div className="w-8 shrink-0">{!groupedReply && <button type="button" onClick={() => openUser(reply.userId)} className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-indigo-600 text-[10px] font-black text-white">{reply.userAvatar ? <img src={reply.userAvatar} alt="" className="h-full w-full object-cover" /> : String(reply.userName || 'Z').slice(0, 2).toUpperCase()}</button>}</div><div className="min-w-0 flex-1">{!groupedReply && <div className="flex flex-wrap items-center gap-2 text-xs"><button type="button" onClick={() => openUser(reply.userId)} className="font-black hover:text-blue-600">{reply.userName || 'Người dùng ZUNY'}</button>{reply.isAdmin && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black text-white">ADMIN</span>}{reply.isTeacherReply && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black text-white">TÁC GIẢ</span>}</div>}<div className={`${groupedReply ? '' : 'mt-1'} rounded-xl px-3 py-2 ${reply.isTeacherReply ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-slate-50 dark:bg-white/[0.04]'}`}><p className="whitespace-pre-wrap text-sm leading-6">{reply.content}</p><div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] font-black"><span className="font-semibold text-slate-400">{formatFullDateTime(reply.createdAt || reply.updatedAt)}</span>{canDeleteReply(reply) && <button type="button" onClick={() => setDeleteTarget({ question, reply })} className="text-rose-600">🗑 Xóa</button>}<button type="button" onClick={() => setReportTarget({ questionId: question.id, replyId: reply.id, content: reply.content, userId: reply.userId, userName: reply.userName })} className="text-slate-500 hover:text-rose-600">⚑ Báo cáo</button></div></div></div></div> })}</div>}
          {replyingId === question.id && <div className="ml-[52px] mt-2 flex gap-2"><input value={replyDrafts[question.id] || ''} onChange={(event) => setReplyDrafts((current) => ({ ...current, [question.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendReply(question) } }} placeholder="Nhập câu trả lời..." className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10 dark:bg-white/[0.05]" /><button type="button" onClick={() => sendReply(question)} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-lg text-white dark:bg-white dark:text-slate-950" title="Gửi câu trả lời">➤</button></div>}
        </article>
      }) : <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-500 dark:border-white/15">Chưa có câu hỏi. Hãy là người đầu tiên bắt đầu thảo luận.</div>}
    </div>

    <form onSubmit={sendQuestion} className="relative mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.04]"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows="2" placeholder="Bạn chưa hiểu phần nào? Hãy đặt câu hỏi tại đây..." className="w-full resize-none bg-transparent px-2 py-2 text-sm leading-6 outline-none" /><div className="mt-2 flex items-center justify-between gap-3"><div className="relative"><button type="button" onClick={() => setEmojiOpen((value) => !value)} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-lg hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10" title="Chọn biểu tượng">☺</button>{emojiOpen && <div className="absolute bottom-12 left-0 z-20 grid w-52 grid-cols-5 gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#10203a]">{emojis.map((emoji) => <button key={emoji} type="button" onClick={() => { setDraft((value) => `${value}${emoji}`); setEmojiOpen(false) }} className="grid h-9 w-9 place-items-center rounded-lg text-lg hover:bg-slate-100 dark:hover:bg-white/10">{emoji}</button>)}</div>}</div><div className="flex items-center gap-3">{cooldownLeft > 0 && <span className="text-xs font-bold text-amber-600">Gửi tiếp sau {cooldownLeft}s</span>}<button disabled={sending || !draft.trim() || cooldownLeft > 0} className="grid h-10 w-10 place-items-center rounded-full bg-blue-600 text-lg text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40" title="Gửi câu hỏi">{sending ? '…' : '➤'}</button></div></div></form>

    {reportTarget && <div className="fixed inset-0 z-[1200] grid place-items-center bg-slate-950/65 px-4 backdrop-blur-sm"><form onSubmit={submitReport} className="w-full max-w-lg rounded-[26px] border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#10203a]"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-rose-500">Báo cáo bình luận</p><h3 className="mt-1 text-xl font-black">Chọn lý do báo cáo</h3></div><button type="button" onClick={() => setReportTarget(null)} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-xl dark:bg-white/10">×</button></div><div className="mt-5 grid gap-2">{reportReasons.map((reason) => <button key={reason} type="button" onClick={() => setReportReason(reason)} className={`rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${reportReason === reason ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : 'border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5'}`}>{reason}</button>)}</div><textarea value={reportDetail} onChange={(event) => setReportDetail(event.target.value)} rows="3" placeholder="Mô tả thêm để quản trị viên dễ kiểm tra..." className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-rose-500 dark:border-white/10 dark:bg-white/5" /><button disabled={reportSubmitting || reportCooldownLeft > 0} className="mt-4 w-full rounded-xl bg-rose-600 px-5 py-3 text-sm font-black text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">{reportCooldownLeft > 0 ? `Báo cáo tiếp sau ${reportCooldownLeft}s` : reportSubmitting ? 'Đang gửi...' : 'Gửi báo cáo'}</button></form></div>}

    {activeWarning && <div className="fixed inset-0 z-[1300] grid place-items-center bg-slate-950/70 px-4 backdrop-blur-sm"><div className="w-full max-w-xl rounded-[28px] border border-amber-200 bg-white p-6 shadow-2xl dark:border-amber-500/30 dark:bg-[#10203a]"><div className="flex items-start gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-500 text-3xl text-white">⚠</span><div><p className="text-xs font-black uppercase tracking-[0.16em] text-amber-600">Cảnh báo bình luận</p><h3 className="mt-1 text-xl font-black">Bạn đã nhận cảnh báo lần {Number(activeWarning.warningCount || 1)}</h3></div></div><div className="mt-5 space-y-3 rounded-2xl bg-amber-50 p-4 text-sm dark:bg-amber-500/10"><p><b>Lý do:</b> {activeWarning.reason || 'Vi phạm quy tắc cộng đồng'}</p><p><b>Bình luận bị báo cáo:</b></p><blockquote className="rounded-xl border border-amber-200 bg-white px-4 py-3 font-semibold leading-6 dark:border-amber-500/20 dark:bg-white/[0.05]">“{activeWarning.commentContent || 'Nội dung không còn tồn tại'}”</blockquote>{activeWarning.detail && <p><b>Ghi chú quản trị viên:</b> {activeWarning.detail}</p>}</div><button type="button" disabled={warningCountdown > 0} onClick={acknowledgeWarning} className="mt-5 w-full rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50">{warningCountdown > 0 ? `Đọc và xác nhận sau ${warningCountdown}s` : 'Tôi đã hiểu và xác nhận'}</button></div></div>}

    {deleteTarget && <div className="fixed inset-0 z-[1250] grid place-items-center bg-slate-950/65 px-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#10203a]"><h3 className="text-xl font-black">Xóa bình luận?</h3><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Nội dung sẽ bị xóa khỏi hệ thống vĩnh viễn.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDeleteTarget(null)} className="rounded-full px-4 py-2 text-sm font-black">Hủy</button><button type="button" onClick={confirmDelete} className="rounded-full bg-rose-600 px-5 py-2 text-sm font-black text-white">Xóa</button></div></div></div>}

    {notice && <div className={`fixed right-4 top-4 z-[1400] w-[min(92vw,380px)] rounded-2xl border p-4 shadow-2xl ${notice.type === 'success' ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950' : notice.type === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950' : 'border-rose-300 bg-rose-50 text-rose-900 dark:bg-rose-950'}`}><p className="font-black">{notice.title}</p><p className="mt-1 text-sm leading-5 opacity-80">{notice.message}</p></div>}
  </section>
}
export function RatingStars({
  selectedRating,
  ratingAverage,
  ratingCount,
  ratingBurst,
  onRate,
}) {
  return (
    <section className="relative mt-8 rounded-[1.5rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="text-sm font-bold uppercase tracking-[0.3em] text-amber-500 dark:text-amber-300">Đánh giá bài học</div>
      <h2 className="mt-3 text-2xl font-black text-slate-950 dark:text-white">Bạn thấy bài học này thế nào?</h2>
      <div className="relative mt-5 flex flex-wrap items-center gap-3">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onRate(star)}
            className={`relative cursor-pointer text-4xl transition duration-200 hover:scale-125 ${
              star <= selectedRating
                ? 'text-amber-300 drop-shadow-[0_0_14px_rgba(252,211,77,0.9)]'
                : 'text-slate-300 hover:text-amber-300 dark:text-slate-600 dark:hover:text-amber-200'
            }`}
          >
            ★
          </button>
        ))}
        <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">Trung bình: ★ {ratingAverage} ({ratingCount} lượt)</span>
        {ratingBurst && (
          <div className="pointer-events-none absolute left-16 top-1/2">
            {Array.from({ length: 14 }).map((_, index) => (
              <span
                key={index}
                className="absolute h-2 w-2 animate-[ratingBurst_650ms_ease-out_forwards] rounded-full bg-amber-300"
                style={{ '--rotate': `${index * 26}deg` }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
export function CodeRunner({ code }) {
  const [output, setOutput] = useState('Ấn "Chạy code" để xem console.')

  function runCode() {
    const logs = []
    const customConsole = {
      log: (...args) => logs.push(args.map(String).join(' ')),
      error: (...args) => logs.push(`Error: ${args.map(String).join(' ')}`),
      warn: (...args) => logs.push(`Warn: ${args.map(String).join(' ')}`),
    }

    try {
      const runner = new Function('console', code || '')
      const result = runner(customConsole)
      if (result !== undefined) logs.push(String(result))
      setOutput(logs.length ? logs.join('\n') : 'Code đã chạy xong nhưng không có output.')
    } catch (error) {
      setOutput(error.message)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-sky-600 dark:text-sky-300">Console</div>
        <button type="button" onClick={runCode} className="cursor-pointer rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-300">
          Chạy code
        </button>
      </div>
      <pre className="mt-4 min-h-60 whitespace-pre-wrap rounded-xl bg-white p-4 font-mono text-sm text-slate-700 dark:bg-black/50 dark:text-slate-300">{output}</pre>
    </div>
  )
}
export function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.05]">
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 font-bold text-slate-950 dark:text-white">{value}</div>
    </div>
  )
}
export function InfoPanel({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.05]">
      <div className="text-xs font-bold uppercase tracking-[0.25em] text-sky-600 dark:text-sky-300">{label}</div>
      <div className="mt-2 font-bold text-slate-950 dark:text-white">{value}</div>
    </div>
  )
}

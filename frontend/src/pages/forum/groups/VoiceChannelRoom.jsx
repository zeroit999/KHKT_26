// import { useEffect, useMemo, useRef, useState } from 'react'
// import {
//   addDoc,
//   collection,
//   deleteDoc,
//   doc,
//   getDoc,
//   getDocs,
//   onSnapshot,
//   query,
//   serverTimestamp,
//   setDoc,
//   where,
// } from 'firebase/firestore'
// import { ArrowLeft, Eraser, Headphones, Maximize2, Mic, MicOff, Minus, Palette, PenTool, PhoneOff, Pin, PinOff, Plus, ScreenShare, ScreenShareOff, SmilePlus, Trash2, Type, Users, Video, VideoOff, Volume2, VolumeX } from 'lucide-react'
// import toast from 'react-hot-toast'

// import { db } from '../../../components/firebase'
// import { getInitials } from '../utils/forumUtils'

// const RTC_CONFIGURATION = {
//   iceServers: [
//     { urls: 'stun:stun.l.google.com:19302' },
//     { urls: 'stun:stun1.l.google.com:19302' },
//   ],
//   bundlePolicy: 'max-bundle',
// }

// const shouldCreateOffer = (localId = '', remoteId = '') => localId.localeCompare(remoteId) < 0


// function StreamVideo({ stream, muted = false, className = '' }) {
//   const videoRef = useRef(null)

//   useEffect(() => {
//     const video = videoRef.current
//     if (!video) return
//     if (video.srcObject !== stream) video.srcObject = stream || null
//     if (stream) video.play().catch(() => {})
//     return () => {
//       if (video && video.srcObject === stream) video.srcObject = null
//     }
//   }, [stream])

//   return <video ref={videoRef} autoPlay playsInline muted={muted} className={className} />
// }


// function RealtimeWhiteboard({
//   operations = [],
//   canEdit = false,
//   allowAll = false,
//   isOwner = false,
//   onAddOperation = () => {},
//   onClear = () => {},
//   onToggleAllowAll = () => {},
// }) {
//   const BOARD_WIDTH = 2200
//   const BOARD_HEIGHT = 1400
//   const STROKE_SYNC_DELAY = 700
//   const MIN_ZOOM = 0.4
//   const MAX_ZOOM = 1.6

//   const canvasRef = useRef(null)
//   const viewportRef = useRef(null)
//   const textInputRef = useRef(null)
//   const drawingRef = useRef(false)
//   const lastPointRef = useRef(null)
//   const syncedPointIndexRef = useRef(0)
//   const strokeSyncTimerRef = useRef(null)
//   const draggingTextRef = useRef(null)
//   const textDragPreviewRef = useRef(null)
//   const erasedTextIdsRef = useRef(new Set())
//   const [tool, setTool] = useState('pen')
//   const [penSize, setPenSize] = useState(4)
//   const [eraserSize, setEraserSize] = useState(24)
//   const [color, setColor] = useState('#2563eb')
//   const [emoji, setEmoji] = useState('⭐')
//   const [zoom, setZoom] = useState(0.72)
//   const [textDraft, setTextDraft] = useState(null)
//   const [textDragPreview, setTextDragPreview] = useState(null)

//   const inkColors = ['#0f172a', '#2563eb', '#0891b2', '#059669', '#65a30d', '#eab308', '#f97316', '#ef4444', '#db2777', '#7c3aed']

//   const resolvedTexts = useMemo(() => {
//     const texts = new Map()
//     operations.forEach((operation) => {
//       if (operation.kind === 'clear') {
//         texts.clear()
//         return
//       }
//       if (operation.kind === 'text') {
//         texts.set(operation.textId || operation.id, {
//           ...operation,
//           textId: operation.textId || operation.id,
//         })
//         return
//       }
//       if (operation.kind === 'text-move') {
//         const current = texts.get(operation.textId)
//         if (current) texts.set(operation.textId, { ...current, x: operation.x, y: operation.y })
//         return
//       }
//       if (operation.kind === 'text-delete') {
//         texts.delete(operation.textId)
//       }
//     })
//     if (textDragPreview?.textId && texts.has(textDragPreview.textId)) {
//       texts.set(textDragPreview.textId, { ...texts.get(textDragPreview.textId), x: textDragPreview.x, y: textDragPreview.y })
//     }
//     return [...texts.values()]
//   }, [operations, textDragPreview])

//   const drawStroke = (context, operation, width, height) => {
//     const points = Array.isArray(operation.points) ? operation.points : []
//     if (points.length < 2) return
//     const fallbackSize = operation.tool === 'eraser' ? 18 : 4
//     const size = Number(operation.size || fallbackSize)
//     context.save()
//     context.lineCap = 'round'
//     context.lineJoin = 'round'
//     context.lineWidth = Math.max(1, size * (width / 1000))
//     context.globalCompositeOperation = operation.tool === 'eraser' ? 'destination-out' : 'source-over'
//     context.strokeStyle = operation.color || '#2563eb'
//     context.beginPath()
//     context.moveTo(points[0].x * width, points[0].y * height)
//     points.slice(1).forEach((point) => context.lineTo(point.x * width, point.y * height))
//     context.stroke()
//     context.restore()
//   }

//   const drawCurrentDraft = (context, width, height) => {
//     const points = lastPointRef.current || []
//     if (!drawingRef.current || points.length < 2) return
//     drawStroke(context, {
//       kind: 'stroke',
//       tool,
//       size: tool === 'eraser' ? eraserSize : penSize,
//       ...(tool === 'pen' ? { color } : {}),
//       points,
//     }, width, height)
//   }

//   const redrawCanvas = () => {
//     const canvas = canvasRef.current
//     if (!canvas) return
//     const width = BOARD_WIDTH * zoom
//     const height = BOARD_HEIGHT * zoom
//     const ratio = window.devicePixelRatio || 1
//     canvas.width = Math.max(1, Math.floor(width * ratio))
//     canvas.height = Math.max(1, Math.floor(height * ratio))
//     canvas.style.width = `${width}px`
//     canvas.style.height = `${height}px`
//     const context = canvas.getContext('2d')
//     context.setTransform(ratio, 0, 0, ratio, 0, 0)
//     context.clearRect(0, 0, width, height)

//     operations.forEach((operation) => {
//       if (!operation) return
//       if (operation.kind === 'clear') {
//         context.clearRect(0, 0, width, height)
//         return
//       }
//       if (operation.kind === 'stroke') drawStroke(context, operation, width, height)
//       if (operation.kind === 'emoji') {
//         context.save()
//         context.font = `${Math.max(28, 44 * zoom)}px sans-serif`
//         context.textAlign = 'center'
//         context.textBaseline = 'middle'
//         context.fillText(operation.emoji || '⭐', Number(operation.x || 0) * width, Number(operation.y || 0) * height)
//         context.restore()
//       }
//     })

//     resolvedTexts.forEach((item) => {
//       context.save()
//       const fontSize = Math.max(14, Number(item.fontSize || 22) * zoom)
//       context.font = `700 ${fontSize}px sans-serif`
//       context.textAlign = 'left'
//       context.textBaseline = 'top'
//       context.fillStyle = item.color || '#0f172a'
//       context.fillText(item.text || '', Number(item.x || 0) * width, Number(item.y || 0) * height)
//       context.restore()
//     })

//     drawCurrentDraft(context, width, height)
//   }

//   useEffect(() => {
//     redrawCanvas()
//     window.addEventListener('resize', redrawCanvas)
//     return () => window.removeEventListener('resize', redrawCanvas)
//   }, [operations, resolvedTexts, zoom])

//   useEffect(() => {
//     if (!textDraft) return
//     window.setTimeout(() => textInputRef.current?.focus(), 0)
//   }, [textDraft?.x, textDraft?.y])

//   useEffect(() => () => window.clearTimeout(strokeSyncTimerRef.current), [])

//   const getPoint = (event) => {
//     const rect = canvasRef.current?.getBoundingClientRect()
//     if (!rect) return null
//     return {
//       x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
//       y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
//     }
//   }

//   const findTextAtPoint = (point) => {
//     const canvas = canvasRef.current
//     if (!canvas || !point) return null
//     const rect = canvas.getBoundingClientRect()
//     const context = canvas.getContext('2d')
//     for (let index = resolvedTexts.length - 1; index >= 0; index -= 1) {
//       const item = resolvedTexts[index]
//       const fontSize = Math.max(14, Number(item.fontSize || 22) * zoom)
//       context.font = `700 ${fontSize}px sans-serif`
//       const textWidth = context.measureText(item.text || '').width
//       const left = Number(item.x || 0) * rect.width
//       const top = Number(item.y || 0) * rect.height
//       const px = point.x * rect.width
//       const py = point.y * rect.height
//       if (px >= left - 8 && px <= left + textWidth + 8 && py >= top - 8 && py <= top + fontSize + 12) return item
//     }
//     return null
//   }

//   const flushStrokeChunk = (final = false) => {
//     const points = lastPointRef.current || []
//     const startIndex = Math.max(0, syncedPointIndexRef.current - (syncedPointIndexRef.current > 0 ? 1 : 0))
//     const chunk = points.slice(startIndex)
//     if (chunk.length > 1) {
//       onAddOperation({
//         kind: 'stroke',
//         tool,
//         size: tool === 'eraser' ? eraserSize : penSize,
//         ...(tool === 'pen' ? { color } : {}),
//         points: chunk,
//       })
//       syncedPointIndexRef.current = points.length
//     }
//     if (final) {
//       window.clearTimeout(strokeSyncTimerRef.current)
//       strokeSyncTimerRef.current = null
//     }
//   }

//   const scheduleStrokeSync = () => {
//     if (strokeSyncTimerRef.current) return
//     strokeSyncTimerRef.current = window.setTimeout(() => {
//       strokeSyncTimerRef.current = null
//       if (!drawingRef.current) return
//       flushStrokeChunk(false)
//       scheduleStrokeSync()
//     }, STROKE_SYNC_DELAY)
//   }

//   const drawLiveSegment = (from, to) => {
//     const canvas = canvasRef.current
//     if (!canvas || !from || !to) return
//     const rect = canvas.getBoundingClientRect()
//     const context = canvas.getContext('2d')
//     drawStroke(context, {
//       kind: 'stroke',
//       tool,
//       size: tool === 'eraser' ? eraserSize : penSize,
//       ...(tool === 'pen' ? { color } : {}),
//       points: [from, to],
//     }, rect.width, rect.height)
//   }

//   const eraseTextAtPoint = (point) => {
//     if (tool !== 'eraser') return false
//     const selectedText = findTextAtPoint(point)
//     const textId = selectedText?.textId
//     if (!textId || erasedTextIdsRef.current.has(textId)) return false
//     erasedTextIdsRef.current.add(textId)
//     onAddOperation({ kind: 'text-delete', textId })
//     return true
//   }

//   const handlePointerDown = (event) => {
//     if (!canEdit) return
//     const point = getPoint(event)
//     if (!point) return

//     erasedTextIdsRef.current = new Set()

//     if (tool === 'text') {
//       const selectedText = findTextAtPoint(point)
//       if (selectedText) {
//         textDragPreviewRef.current = null
//         draggingTextRef.current = {
//           textId: selectedText.textId,
//           offsetX: point.x - Number(selectedText.x || 0),
//           offsetY: point.y - Number(selectedText.y || 0),
//         }
//         canvasRef.current?.setPointerCapture?.(event.pointerId)
//         setTextDraft(null)
//       } else {
//         setTextDraft({ x: point.x, y: point.y, value: '' })
//       }
//       return
//     }

//     canvasRef.current?.setPointerCapture?.(event.pointerId)
//     if (tool === 'eraser') eraseTextAtPoint(point)
//     if (tool === 'emoji') {
//       onAddOperation({ kind: 'emoji', x: point.x, y: point.y, emoji })
//       return
//     }
//     drawingRef.current = true
//     lastPointRef.current = [point]
//     syncedPointIndexRef.current = 0
//     scheduleStrokeSync()
//   }

//   const handlePointerMove = (event) => {
//     if (!canEdit) return
//     const point = getPoint(event)
//     if (!point) return

//     if (tool === 'text' && draggingTextRef.current) {
//       const nextPreview = {
//         textId: draggingTextRef.current.textId,
//         x: Math.min(0.98, Math.max(0, point.x - draggingTextRef.current.offsetX)),
//         y: Math.min(0.96, Math.max(0, point.y - draggingTextRef.current.offsetY)),
//       }
//       textDragPreviewRef.current = nextPreview
//       setTextDragPreview(nextPreview)
//       return
//     }

//     if (!drawingRef.current) return
//     if (tool === 'eraser') eraseTextAtPoint(point)
//     const points = lastPointRef.current || []
//     const previous = points[points.length - 1]
//     if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.0012) return
//     points.push(point)
//     lastPointRef.current = points
//     drawLiveSegment(previous, point)
//   }

//   const finishPointerAction = () => {
//     if (draggingTextRef.current) {
//       const preview = textDragPreviewRef.current
//       draggingTextRef.current = null
//       textDragPreviewRef.current = null
//       setTextDragPreview(null)
//       if (preview) onAddOperation({ kind: 'text-move', textId: preview.textId, x: preview.x, y: preview.y })
//       return
//     }
//     if (!drawingRef.current) return
//     drawingRef.current = false
//     flushStrokeChunk(true)
//     lastPointRef.current = null
//     syncedPointIndexRef.current = 0
//     erasedTextIdsRef.current = new Set()
//   }

//   const submitText = () => {
//     const value = String(textDraft?.value || '').trim()
//     if (!value) {
//       setTextDraft(null)
//       return
//     }
//     onAddOperation({
//       kind: 'text',
//       textId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
//       text: value,
//       x: textDraft.x,
//       y: textDraft.y,
//       color,
//       fontSize: 22,
//     })
//     setTextDraft(null)
//   }

//   const updateZoom = (nextZoom) => {
//     const viewport = viewportRef.current
//     const oldZoom = zoom
//     const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom))
//     if (!viewport || clamped === oldZoom) {
//       setZoom(clamped)
//       return
//     }
//     const centerX = (viewport.scrollLeft + viewport.clientWidth / 2) / oldZoom
//     const centerY = (viewport.scrollTop + viewport.clientHeight / 2) / oldZoom
//     setZoom(clamped)
//     window.requestAnimationFrame(() => {
//       viewport.scrollLeft = centerX * clamped - viewport.clientWidth / 2
//       viewport.scrollTop = centerY * clamped - viewport.clientHeight / 2
//     })
//   }

//   const fitBoard = () => {
//     const viewport = viewportRef.current
//     if (!viewport) return
//     const next = Math.min(1, (viewport.clientWidth - 32) / BOARD_WIDTH, (viewport.clientHeight - 32) / BOARD_HEIGHT)
//     setZoom(Math.max(MIN_ZOOM, next))
//     window.requestAnimationFrame(() => {
//       viewport.scrollLeft = 0
//       viewport.scrollTop = 0
//     })
//   }

//   return (
//     <div className="relative flex h-full min-h-[360px] flex-col overflow-hidden rounded-2xl sm:min-h-[420px] sm:rounded-[2rem] border border-white/10 bg-white text-slate-900 shadow-2xl">
//       <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50 px-3 py-2.5 sm:flex-wrap sm:px-4 sm:py-3">
//         <div className="mr-auto hidden shrink-0 items-center gap-2 sm:flex">
//           <Palette className="h-5 w-5 text-blue-600" />
//           <div>
//             <p className="text-sm font-black">Bảng trắng realtime</p>
//             <p className="text-[11px] font-bold text-slate-500">Không gian 2200 × 1400 · đồng bộ nét vẽ khoảng 700ms</p>
//           </div>
//         </div>

//         <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
//           <button type="button" onClick={() => updateZoom(zoom - 0.1)} disabled={zoom <= MIN_ZOOM} className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40" title="Thu nhỏ"><Minus className="h-4 w-4" /></button>
//           <span className="min-w-12 text-center text-[11px] font-black text-slate-600">{Math.round(zoom * 100)}%</span>
//           <button type="button" onClick={() => updateZoom(zoom + 0.1)} disabled={zoom >= MAX_ZOOM} className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40" title="Phóng to"><Plus className="h-4 w-4" /></button>
//           <button type="button" onClick={fitBoard} className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100" title="Vừa màn hình"><Maximize2 className="h-4 w-4" /></button>
//         </div>

//         {canEdit && (
//           <>
//             <button type="button" onClick={() => setTool('pen')} className={`rounded-xl p-2 ${tool === 'pen' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`} title="Bút"><PenTool className="h-4 w-4" /></button>
//             <button type="button" onClick={() => setTool('eraser')} className={`rounded-xl p-2 ${tool === 'eraser' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`} title="Gôm"><Eraser className="h-4 w-4" /></button>
//             <button type="button" onClick={() => setTool('text')} className={`rounded-xl p-2 ${tool === 'text' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600'}`} title="Thêm và di chuyển văn bản"><Type className="h-4 w-4" /></button>
//             <button type="button" onClick={() => setTool('emoji')} className={`rounded-xl p-2 ${tool === 'emoji' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`} title="Thêm icon"><SmilePlus className="h-4 w-4" /></button>

//             {(tool === 'pen' || tool === 'eraser') && (
//               <label className="flex min-w-[150px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-500">
//                 {tool === 'pen' ? 'Cỡ bút' : 'Cỡ gôm'}
//                 <input type="range" min={tool === 'pen' ? 1 : 8} max={tool === 'pen' ? 24 : 56} value={tool === 'pen' ? penSize : eraserSize} onChange={(event) => tool === 'pen' ? setPenSize(Number(event.target.value)) : setEraserSize(Number(event.target.value))} className="w-20 accent-blue-600" />
//                 <span className="w-5 text-right text-slate-700">{tool === 'pen' ? penSize : eraserSize}</span>
//               </label>
//             )}

//             {tool !== 'eraser' && <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5" title="10 màu mực">
//               {inkColors.map((item) => (
//                 <button key={item} type="button" onClick={() => setColor(item)} className={`h-6 w-6 rounded-full border-2 transition hover:scale-110 ${color === item ? 'border-blue-600 ring-2 ring-blue-200' : 'border-white'}`} style={{ backgroundColor: item }} aria-label={`Chọn màu ${item}`} />
//               ))}
//             </div>}

//             {tool === 'emoji' && <select value={emoji} onChange={(event) => setEmoji(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm font-black"><option>⭐</option><option>✅</option><option>📌</option><option>💡</option><option>❤️</option><option>🎯</option></select>}
//           </>
//         )}
//         {isOwner && (
//           <>
//             <button type="button" onClick={onToggleAllowAll} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black ${allowAll ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600'}`}><Users className="h-4 w-4" />{allowAll ? 'Mọi người được viết' : 'Chỉ mình tôi viết'}</button>
//             <button type="button" onClick={onClear} className="rounded-xl bg-rose-100 p-2 text-rose-600" title="Xóa toàn bộ bảng"><Trash2 className="h-4 w-4" /></button>
//           </>
//         )}
//       </div>

//       <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-auto bg-slate-200/70 p-4">
//         <div
//           className="relative origin-top-left overflow-hidden rounded-2xl bg-white shadow-xl"
//           style={{ width: BOARD_WIDTH * zoom, height: BOARD_HEIGHT * zoom }}
//         >
//           <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.055)_1px,transparent_1px)] bg-[size:24px_24px]" />
//           <canvas
//             ref={canvasRef}
//             onPointerDown={handlePointerDown}
//             onPointerMove={handlePointerMove}
//             onPointerUp={finishPointerAction}
//             onPointerCancel={finishPointerAction}
//             onPointerLeave={finishPointerAction}
//             className={`relative z-10 touch-none ${canEdit ? tool === 'text' ? 'cursor-text' : 'cursor-crosshair' : 'cursor-default'}`}
//           />
//           {textDraft && (
//             <div className="absolute z-20 min-w-[220px] rounded-xl border-2 border-blue-500 bg-white p-2 shadow-xl" style={{ left: `${textDraft.x * 100}%`, top: `${textDraft.y * 100}%`, transform: 'translateY(-4px)' }}>
//               <input
//                 ref={textInputRef}
//                 value={textDraft.value}
//                 onChange={(event) => setTextDraft((previous) => ({ ...previous, value: event.target.value }))}
//                 onKeyDown={(event) => {
//                   if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitText() }
//                   if (event.key === 'Escape') setTextDraft(null)
//                 }}
//                 onBlur={submitText}
//                 placeholder="Nhập nội dung..."
//                 className="w-full bg-transparent px-2 py-1 text-sm font-bold text-slate-900 outline-none placeholder:text-slate-400"
//               />
//               <p className="px-2 pt-1 text-[10px] font-bold text-slate-400">Enter để thêm · Chọn Text rồi kéo để di chuyển</p>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   )
// }

// export default function VoiceChannelRoom({
//   groupId,
//   channel,
//   currentUser,
//   displayName,
//   initials,
//   avatarUrl = '',
//   onBack = () => {},
// }) {
//   const roomId = useMemo(() => `${groupId}_${channel?.id || 'voice'}`, [groupId, channel?.id])
//   const [participants, setParticipants] = useState([])
//   const [joined, setJoined] = useState(false)
//   const [joining, setJoining] = useState(false)
//   const [micEnabled, setMicEnabled] = useState(false)
//   const [deafened, setDeafened] = useState(false)
//   const [cameraEnabled, setCameraEnabled] = useState(false)
//   const [screenSharing, setScreenSharing] = useState(false)
//   const [whiteboardOpen, setWhiteboardOpen] = useState(false)
//   const [whiteboardAllowAll, setWhiteboardAllowAll] = useState(false)
//   const [whiteboardOwnerId, setWhiteboardOwnerId] = useState('')
//   const [whiteboardOps, setWhiteboardOps] = useState([])
//   const [pinnedParticipantId, setPinnedParticipantId] = useState('')
//   const [mutedParticipantIds, setMutedParticipantIds] = useState([])
//   const [speakingIds, setSpeakingIds] = useState([])
//   const [remoteStreams, setRemoteStreams] = useState({})
//   const [remoteCameraStreams, setRemoteCameraStreams] = useState({})
//   const [remoteScreenStreams, setRemoteScreenStreams] = useState({})

//   const localStreamRef = useRef(null)
//   const peerConnectionsRef = useRef(new Map())
//   const remoteAudiosRef = useRef(new Map())
//   const pendingCandidatesRef = useRef(new Map())
//   const analysersRef = useRef(new Map())
//   const animationFramesRef = useRef(new Map())
//   const joinedRef = useRef(false)
//   const localVideoRef = useRef(null)
//   const screenStreamRef = useRef(null)
//   const remoteMediaStreamsRef = useRef(new Map())
//   const remoteCameraStreamsRef = useRef(new Map())
//   const remoteScreenStreamsRef = useRef(new Map())
//   const remoteMediaMidsRef = useRef(new Map())
//   const localVideoSendersRef = useRef(new Map())
//   const negotiationLocksRef = useRef(new Map())
//   const pageClosingRef = useRef(false)
//   const connectionIdRef = useRef(`${currentUser?.uid || 'guest'}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)

//   const participantRef = (uid = currentUser?.uid) => doc(db, 'forumVoiceRooms', roomId, 'participants', uid)
//   const signalsRef = () => collection(db, 'forumVoiceRooms', roomId, 'signals')

//   const getPresencePayload = () => ({
//     uid: currentUser?.uid || '',
//     connectionId: connectionIdRef.current,
//     name: displayName,
//     initials: initials || getInitials(displayName),
//     avatarUrl,
//     micEnabled,
//     deafened,
//     cameraEnabled,
//     screenSharing,
//     status: 'joined',
//     lastSeenAt: serverTimestamp(),
//   })

//   const deleteCurrentConnectionParticipant = async () => {
//     if (!currentUser?.uid) return
//     const ref = participantRef()
//     try {
//       const snapshot = await getDoc(ref)
//       if (!snapshot.exists()) return
//       const data = snapshot.data() || {}
//       if (data.connectionId && data.connectionId !== connectionIdRef.current) return
//       await deleteDoc(ref)
//     } catch {
//       // Việc đóng tab có thể ngắt request; heartbeat sẽ loại phiên cũ khỏi giao diện.
//     }
//   }

//   const getLocalStream = async () => {
//     if (localStreamRef.current) return localStreamRef.current
//     if (!navigator.mediaDevices?.getUserMedia) throw new Error('MEDIA_NOT_SUPPORTED')

//     let stream
//     try {
//       stream = await navigator.mediaDevices.getUserMedia({
//         audio: {
//           echoCancellation: { ideal: true },
//           noiseSuppression: { ideal: true },
//           autoGainControl: { ideal: true },
//           channelCount: { ideal: 1 },
//         },
//         video: false,
//       })
//     } catch (error) {
//       // Microsoft Edge có thể từ chối một số constraint nâng cao trên vài thiết bị.
//       if (!['OverconstrainedError', 'NotReadableError'].includes(error?.name)) throw error
//       stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
//     }

//     localStreamRef.current = stream
//     return stream
//   }

//   const sendSignal = async ({ toUserId, type, payload }) => {
//     if (!currentUser?.uid || !toUserId) return
//     await addDoc(signalsRef(), {
//       fromUserId: currentUser.uid,
//       toUserId,
//       type,
//       payload,
//       createdAt: serverTimestamp(),
//     })
//   }

//   const stopSpeakingMonitor = (uid) => {
//     const frame = animationFramesRef.current.get(uid)
//     if (frame) cancelAnimationFrame(frame)
//     animationFramesRef.current.delete(uid)
//     analysersRef.current.delete(uid)
//     setSpeakingIds((previous) => previous.filter((id) => id !== uid))
//   }

//   const monitorSpeaking = (uid, stream) => {
//     stopSpeakingMonitor(uid)
//     try {
//       const context = new AudioContext()
//       const source = context.createMediaStreamSource(stream)
//       const analyser = context.createAnalyser()
//       analyser.fftSize = 256
//       source.connect(analyser)
//       const data = new Uint8Array(analyser.frequencyBinCount)
//       analysersRef.current.set(uid, { context, analyser })

//       const tick = () => {
//         analyser.getByteFrequencyData(data)
//         const average = data.reduce((sum, value) => sum + value, 0) / data.length
//         setSpeakingIds((previous) => {
//           const active = average > 18
//           const exists = previous.includes(uid)
//           if (active && !exists) return [...previous, uid]
//           if (!active && exists) return previous.filter((id) => id !== uid)
//           return previous
//         })
//         animationFramesRef.current.set(uid, requestAnimationFrame(tick))
//       }
//       tick()
//     } catch {
//       // Chỉ bỏ hiệu ứng phát hiện giọng nói nếu trình duyệt không hỗ trợ AudioContext.
//     }
//   }

//   const closePeerConnection = (remoteUserId) => {
//     const peerConnection = peerConnectionsRef.current.get(remoteUserId)
//     if (peerConnection) {
//       peerConnection.ontrack = null
//       peerConnection.onicecandidate = null
//       peerConnection.close()
//     }
//     peerConnectionsRef.current.delete(remoteUserId)

//     const audio = remoteAudiosRef.current.get(remoteUserId)
//     if (audio) {
//       audio.pause()
//       audio.srcObject = null
//     }
//     remoteAudiosRef.current.delete(remoteUserId)
//     setRemoteStreams((previous) => {
//       const next = { ...previous }
//       delete next[remoteUserId]
//       return next
//     })
//     setRemoteCameraStreams((previous) => {
//       const next = { ...previous }
//       delete next[remoteUserId]
//       return next
//     })
//     setRemoteScreenStreams((previous) => {
//       const next = { ...previous }
//       delete next[remoteUserId]
//       return next
//     })
//     pendingCandidatesRef.current.delete(remoteUserId)
//     remoteMediaStreamsRef.current.delete(remoteUserId)
//     remoteCameraStreamsRef.current.delete(remoteUserId)
//     remoteScreenStreamsRef.current.delete(remoteUserId)
//     remoteMediaMidsRef.current.delete(remoteUserId)
//     localVideoSendersRef.current.delete(remoteUserId)
//     negotiationLocksRef.current.delete(remoteUserId)

//     const analyserEntry = analysersRef.current.get(remoteUserId)
//     analyserEntry?.context?.close?.().catch?.(() => {})
//     stopSpeakingMonitor(remoteUserId)
//   }

//   const flushPendingCandidates = async (remoteUserId, peerConnection) => {
//     const candidates = pendingCandidatesRef.current.get(remoteUserId) || []
//     pendingCandidatesRef.current.delete(remoteUserId)
//     for (const candidate of candidates) {
//       await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
//     }
//   }

//   const buildMediaDescriptionPayload = (peerConnection, description, remoteUserId = '') => {
//     const mediaMids = { camera: [], screen: [] }
//     const localVideoSenders = localVideoSendersRef.current.get(remoteUserId) || {}
//     peerConnection.getTransceivers().forEach((transceiver) => {
//       const mid = transceiver.mid
//       if (mid == null) return
//       if (transceiver.sender === localVideoSenders.cameraSender) mediaMids.camera.push(String(mid))
//       if (transceiver.sender === localVideoSenders.screenSender) mediaMids.screen.push(String(mid))
//     })
//     return {
//       description: description?.toJSON?.() || description,
//       mediaMids,
//     }
//   }

//   const readSignalDescription = (payload = {}) => {
//     if (payload?.description) return payload
//     return { description: payload, mediaMids: { camera: [], screen: [] } }
//   }

//   const updateRemoteTrackStream = (remoteUserId, kind, track) => {
//     const targetRef = kind === 'screen' ? remoteScreenStreamsRef : remoteCameraStreamsRef
//     const setter = kind === 'screen' ? setRemoteScreenStreams : setRemoteCameraStreams
//     let stream = targetRef.current.get(remoteUserId)
//     if (!stream) {
//       stream = new MediaStream()
//       targetRef.current.set(remoteUserId, stream)
//     }
//     if (!stream.getTracks().some((item) => item.id === track.id)) stream.addTrack(track)
//     const publishStream = () => setter((previous) => ({ ...previous, [remoteUserId]: stream }))
//     publishStream()
//     track.onunmute = publishStream
//     track.onended = () => {
//       stream.removeTrack(track)
//       setter((previous) => {
//         const next = { ...previous }
//         if (stream.getTracks().length) next[remoteUserId] = stream
//         else delete next[remoteUserId]
//         return next
//       })
//     }
//   }

//   const createPeerConnection = async (remoteUserId) => {
//     const existing = peerConnectionsRef.current.get(remoteUserId)
//     if (existing) return existing

//     const localStream = await getLocalStream()
//     const peerConnection = new RTCPeerConnection(RTC_CONFIGURATION)

//     localStream.getAudioTracks().forEach((track) => peerConnection.addTrack(track, localStream))

//     const cameraTrack = localStream.getVideoTracks()[0] || null
//     const screenTrack = screenStreamRef.current?.getVideoTracks?.()[0] || null
//     const screenAudioTrack = screenStreamRef.current?.getAudioTracks?.()[0] || null
//     const cameraTransceiver = peerConnection.addTransceiver(cameraTrack || 'video', {
//       direction: 'sendrecv',
//       streams: cameraTrack ? [localStream] : [],
//     })
//     const screenTransceiver = peerConnection.addTransceiver(screenTrack || 'video', {
//       direction: 'sendrecv',
//       streams: screenTrack && screenStreamRef.current ? [screenStreamRef.current] : [],
//     })
//     const screenAudioTransceiver = peerConnection.addTransceiver(screenAudioTrack || 'audio', {
//       direction: 'sendrecv',
//       streams: screenAudioTrack && screenStreamRef.current ? [screenStreamRef.current] : [],
//     })
//     localVideoSendersRef.current.set(remoteUserId, {
//       cameraSender: cameraTransceiver.sender,
//       screenSender: screenTransceiver.sender,
//       screenAudioSender: screenAudioTransceiver.sender,
//     })

//     peerConnection.onicecandidate = (event) => {
//       if (!event.candidate) return
//       sendSignal({
//         toUserId: remoteUserId,
//         type: 'candidate',
//         payload: event.candidate.toJSON(),
//       }).catch((error) => console.warn('Không thể gửi ICE candidate:', error))
//     }

//     peerConnection.ontrack = (event) => {
//       let remoteStream = remoteMediaStreamsRef.current.get(remoteUserId)
//       if (!remoteStream) {
//         remoteStream = new MediaStream()
//         remoteMediaStreamsRef.current.set(remoteUserId, remoteStream)
//       }
//       if (!remoteStream.getTracks().some((track) => track.id === event.track.id)) remoteStream.addTrack(event.track)
//       setRemoteStreams((previous) => ({ ...previous, [remoteUserId]: remoteStream }))

//       if (event.track.kind === 'video') {
//         const mediaMids = remoteMediaMidsRef.current.get(remoteUserId) || { camera: [], screen: [] }
//         const mid = String(event.transceiver?.mid ?? '')
//         const sourceKind = mediaMids.screen.includes(mid)
//           ? 'screen'
//           : mediaMids.camera.includes(mid)
//             ? 'camera'
//             : (remoteScreenStreamsRef.current.has(remoteUserId) ? 'camera' : 'camera')
//         updateRemoteTrackStream(remoteUserId, sourceKind, event.track)
//       }

//       if (event.track.kind === 'audio') {
//         let audio = remoteAudiosRef.current.get(remoteUserId)
//         if (!audio) {
//           audio = new Audio()
//           audio.autoplay = true
//           audio.playsInline = true
//           remoteAudiosRef.current.set(remoteUserId, audio)
//         }
//         audio.srcObject = remoteStream
//         audio.muted = deafened || mutedParticipantIds.includes(remoteUserId)
//         audio.volume = 1
//         audio.setAttribute('playsinline', 'true')
//         audio.play().catch(() => {})
//         monitorSpeaking(remoteUserId, remoteStream)
//       }
//     }

//     peerConnection.oniceconnectionstatechange = () => {
//       if (peerConnection.iceConnectionState === 'failed') {
//         peerConnection.restartIce?.()
//         createOfferForUser(remoteUserId).catch(() => {})
//       }
//     }

//     peerConnection.onconnectionstatechange = () => {
//       if (['failed', 'closed'].includes(peerConnection.connectionState)) {
//         closePeerConnection(remoteUserId)
//       }
//     }

//     peerConnectionsRef.current.set(remoteUserId, peerConnection)
//     return peerConnection
//   }

//   const createOfferForUser = async (remoteUserId) => {
//     if (!remoteUserId || negotiationLocksRef.current.get(remoteUserId)) return
//     negotiationLocksRef.current.set(remoteUserId, true)

//     try {
//       const peerConnection = await createPeerConnection(remoteUserId)
//       if (peerConnection.signalingState !== 'stable') return

//       const senders = localVideoSendersRef.current.get(remoteUserId) || {}
//       peerConnection.getTransceivers().forEach((transceiver) => {
//         if (transceiver.sender === senders.cameraSender || transceiver.sender === senders.screenSender || transceiver.sender === senders.screenAudioSender) {
//           transceiver.direction = 'sendrecv'
//         }
//       })

//       const offer = await peerConnection.createOffer()
//       await peerConnection.setLocalDescription(offer)
//       await sendSignal({
//         toUserId: remoteUserId,
//         type: 'offer',
//         payload: buildMediaDescriptionPayload(peerConnection, peerConnection.localDescription || offer, remoteUserId),
//       })
//     } finally {
//       negotiationLocksRef.current.delete(remoteUserId)
//     }
//   }

//   const renegotiateMediaForAllPeers = async () => {
//     const remoteUserIds = [...peerConnectionsRef.current.keys()]
//     for (const remoteUserId of remoteUserIds) {
//       await createOfferForUser(remoteUserId).catch((error) => {
//         console.warn('Không thể đồng bộ lại camera/chia sẻ màn hình:', error)
//       })
//     }
//   }

//   const leaveVoiceRoom = async ({ silent = false } = {}) => {
//     joinedRef.current = false
//     setJoined(false)

//     peerConnectionsRef.current.forEach((_, uid) => closePeerConnection(uid))
//     localStreamRef.current?.getTracks().forEach((track) => track.stop())
//     localStreamRef.current = null

//     if (currentUser?.uid) {
//       await deleteCurrentConnectionParticipant()
//     }

//     setParticipants([])
//     setSpeakingIds([])
//     setRemoteStreams({})
//     setRemoteCameraStreams({})
//     setRemoteScreenStreams({})
//     setMicEnabled(false)
//     setCameraEnabled(false)
//     setScreenSharing(false)
//     screenStreamRef.current?.getTracks().forEach((track) => track.stop())
//     screenStreamRef.current = null
//     if (!silent) toast.success('Đã rời phòng thoại')
//   }

//   const joinVoiceRoom = async () => {
//     if (!currentUser?.uid || joining || joined) return
//     setJoining(true)
//     try {
//       const initialMicEnabled = micEnabled
//       const initialCameraEnabled = cameraEnabled
//       const stream = await getLocalStream()
//       stream.getAudioTracks().forEach((track) => { track.enabled = initialMicEnabled })

//       if (initialCameraEnabled && !stream.getVideoTracks().length) {
//         const cameraStream = await navigator.mediaDevices.getUserMedia({
//           video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
//           audio: false,
//         })
//         const videoTrack = cameraStream.getVideoTracks()[0]
//         if (videoTrack) stream.addTrack(videoTrack)
//       }

//       if (localVideoRef.current && stream.getVideoTracks().length) {
//         localVideoRef.current.srcObject = stream
//         localVideoRef.current.play().catch(() => {})
//       }

//       await setDoc(
//         doc(db, 'forumVoiceRooms', roomId),
//         {
//           groupId,
//           channelId: channel.id,
//           channelName: channel.label,
//           updatedAt: serverTimestamp(),
//         },
//         { merge: true },
//       )
//       await setDoc(
//         participantRef(),
//         {
//           uid: currentUser.uid,
//           connectionId: connectionIdRef.current,
//           name: displayName,
//           initials: initials || getInitials(displayName),
//           avatarUrl,
//           micEnabled: initialMicEnabled,
//           deafened: false,
//           cameraEnabled: initialCameraEnabled,
//           screenSharing: false,
//           status: 'joined',
//           joinedAt: serverTimestamp(),
//           lastSeenAt: serverTimestamp(),
//         },
//         { merge: true },
//       )
//       joinedRef.current = true
//       setJoined(true)
//       setMicEnabled(initialMicEnabled)
//       setDeafened(false)
//       setCameraEnabled(initialCameraEnabled)

//       const existingParticipants = await getDocs(collection(db, 'forumVoiceRooms', roomId, 'participants')).catch(() => null)
//       if (existingParticipants) {
//         await Promise.allSettled(existingParticipants.docs
//           .map((item) => ({ id: item.id, ...item.data() }))
//           .filter((participant) => (participant.uid || participant.id) !== currentUser.uid && participant.status !== 'left')
//           .map((participant) => sendSignal({
//             toUserId: participant.uid || participant.id,
//             type: 'sync-request',
//             payload: { requestedBy: currentUser.uid },
//           })))
//       }

//       toast.success(`Đã tham gia ${channel.label}`)
//     } catch (error) {
//       console.error('Không thể tham gia phòng thoại:', error)
//       if (error?.name === 'NotAllowedError') toast.error('Bạn cần cho phép trình duyệt sử dụng microphone')
//       else if (error?.name === 'NotFoundError') toast.error('Không tìm thấy microphone trên thiết bị')
//       else if (error?.message === 'MEDIA_NOT_SUPPORTED') toast.error('Trình duyệt này không hỗ trợ microphone')
//       else toast.error('Không thể tham gia phòng thoại')
//     } finally {
//       setJoining(false)
//     }
//   }

//   const toggleMicrophone = async () => {
//     const stream = localStreamRef.current
//     if (!stream || !currentUser?.uid) return
//     const nextEnabled = !micEnabled
//     stream.getAudioTracks().forEach((track) => { track.enabled = nextEnabled })
//     setMicEnabled(nextEnabled)
//     await setDoc(participantRef(), { micEnabled: nextEnabled, lastSeenAt: serverTimestamp() }, { merge: true }).catch(() => {})
//   }

//   const toggleDeafen = async () => {
//     if (!currentUser?.uid) return
//     const nextValue = !deafened
//     setDeafened(nextValue)
//     remoteAudiosRef.current.forEach((audio) => { audio.muted = nextValue })
//     await setDoc(participantRef(), { deafened: nextValue, lastSeenAt: serverTimestamp() }, { merge: true }).catch(() => {})
//   }


//   const replaceVideoTrackForAllPeers = async (kind, track) => {
//     const tasks = []
//     localVideoSendersRef.current.forEach((senders, remoteUserId) => {
//       const sender = kind === 'screen' ? senders.screenSender : senders.cameraSender
//       if (!sender) return

//       const peerConnection = peerConnectionsRef.current.get(remoteUserId)
//       const transceiver = peerConnection?.getTransceivers().find((item) => item.sender === sender)
//       if (transceiver) transceiver.direction = 'sendrecv'
//       tasks.push(sender.replaceTrack(track || null))
//     })

//     await Promise.allSettled(tasks)

//     // replaceTrack không luôn tạo negotiationneeded trên Edge/Chrome.
//     // Tạo lại SDP để người đang ở sẵn trong phòng nhận camera/màn hình ngay,
//     // thay vì chỉ nhận được sau khi rời phòng rồi vào lại.
//     await renegotiateMediaForAllPeers()
//   }

//   const replaceScreenAudioTrackForAllPeers = async (track) => {
//     const tasks = []
//     localVideoSendersRef.current.forEach((senders, remoteUserId) => {
//       const sender = senders.screenAudioSender
//       if (!sender) return

//       const peerConnection = peerConnectionsRef.current.get(remoteUserId)
//       const transceiver = peerConnection?.getTransceivers().find((item) => item.sender === sender)
//       if (transceiver) transceiver.direction = 'sendrecv'
//       tasks.push(sender.replaceTrack(track || null))
//     })

//     await Promise.allSettled(tasks)
//     await renegotiateMediaForAllPeers()
//   }

//   const toggleCamera = async () => {
//     if (!joined || !currentUser?.uid) return
//     const stream = localStreamRef.current
//     if (!stream) return

//     if (cameraEnabled) {
//       const videoTracks = stream.getVideoTracks()
//       await replaceVideoTrackForAllPeers('camera', null)
//       videoTracks.forEach((track) => {
//         track.stop()
//         stream.removeTrack(track)
//       })
//       setCameraEnabled(false)
//       if (localVideoRef.current) localVideoRef.current.srcObject = null
//       await setDoc(participantRef(), { cameraEnabled: false, lastSeenAt: serverTimestamp() }, { merge: true }).catch(() => {})
//       return
//     }

//     try {
//       const cameraStream = await navigator.mediaDevices.getUserMedia({
//         video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
//         audio: false,
//       })
//       const videoTrack = cameraStream.getVideoTracks()[0]
//       if (!videoTrack) throw new Error('CAMERA_NOT_FOUND')
//       stream.addTrack(videoTrack)
//       await replaceVideoTrackForAllPeers('camera', videoTrack)
//       if (localVideoRef.current) {
//         localVideoRef.current.srcObject = stream
//         localVideoRef.current.play().catch(() => {})
//       }
//       setCameraEnabled(true)
//       await setDoc(participantRef(), { cameraEnabled: true, lastSeenAt: serverTimestamp() }, { merge: true })
//     } catch (error) {
//       console.error('Không thể mở camera:', error)
//       if (error?.name === 'NotAllowedError') toast.error('Bạn cần cho phép trình duyệt sử dụng camera')
//       else if (error?.name === 'NotFoundError') toast.error('Không tìm thấy camera trên thiết bị')
//       else toast.error('Không thể mở camera')
//     }
//   }


//   const stopScreenShare = async () => {
//     const displayStream = screenStreamRef.current
//     if (!displayStream) return
//     const displayTrack = displayStream.getVideoTracks()[0]

//     await replaceVideoTrackForAllPeers('screen', null)
//     await replaceScreenAudioTrackForAllPeers(null)
//     displayStream.getTracks().forEach((track) => track.stop())
//     screenStreamRef.current = null
//     setScreenSharing(false)
//     await setDoc(participantRef(), { screenSharing: false, lastSeenAt: serverTimestamp() }, { merge: true }).catch(() => {})
//   }

//   const toggleScreenShare = async () => {
//     if (!joined || !currentUser?.uid) return
//     if (screenSharing) {
//       await stopScreenShare()
//       return
//     }

//     if (!navigator.mediaDevices?.getDisplayMedia) {
//       toast.error('Trình duyệt này không hỗ trợ chia sẻ màn hình')
//       return
//     }

//     try {
//       const displayStream = await navigator.mediaDevices.getDisplayMedia({
//         video: true,
//         audio: {
//           echoCancellation: false,
//           noiseSuppression: false,
//           autoGainControl: false,
//         },
//       })
//       const displayTrack = displayStream.getVideoTracks()[0]
//       const displayAudioTrack = displayStream.getAudioTracks()[0] || null
//       if (!displayTrack) throw new Error('SCREEN_NOT_FOUND')

//       screenStreamRef.current = displayStream
//       displayTrack.onended = () => { stopScreenShare().catch(() => {}) }

//       // Screen dùng một sender cố định riêng, không thay camera và không tạo lại kết nối.
//       await replaceVideoTrackForAllPeers('screen', displayTrack)
//       await replaceScreenAudioTrackForAllPeers(displayAudioTrack)

//       if (!displayAudioTrack) {
//         toast('Tab hoặc cửa sổ đang chia sẻ không cung cấp âm thanh. Hãy chọn Chia sẻ tab và bật Chia sẻ âm thanh.', { icon: '🔇' })
//       }

//       setScreenSharing(true)
//       await setDoc(participantRef(), { screenSharing: true, lastSeenAt: serverTimestamp() }, { merge: true })
//     } catch (error) {
//       if (error?.name !== 'NotAllowedError') console.error('Không thể chia sẻ màn hình:', error)
//       if (error?.name === 'NotAllowedError') toast.error('Bạn đã hủy hoặc chưa cho phép chia sẻ màn hình')
//       else toast.error('Không thể chia sẻ màn hình')
//     }
//   }

//   const whiteboardRef = doc(db, 'forumVoiceRooms', roomId, 'whiteboard', 'state')
//   const whiteboardOperationsRef = () => collection(db, 'forumVoiceRooms', roomId, 'whiteboardOperations')

//   const openWhiteboard = async () => {
//     if (!joined || !currentUser?.uid) return
//     if (whiteboardOpen && whiteboardOwnerId && whiteboardOwnerId !== currentUser.uid) {
//       toast.error('Bảng trắng đang được một thành viên khác chia sẻ')
//       return
//     }
//     const nextOpen = !whiteboardOpen
//     setWhiteboardOpen(nextOpen)
//     if (nextOpen) {
//       setWhiteboardOwnerId(currentUser.uid)
//       setWhiteboardAllowAll(false)
//       await setDoc(whiteboardRef, {
//         open: true,
//         ownerId: currentUser.uid,
//         ownerName: displayName,
//         allowAll: false,
//         updatedAt: serverTimestamp(),
//       }, { merge: true })
//     } else if (whiteboardOwnerId === currentUser.uid) {
//       await setDoc(whiteboardRef, { open: false, ownerId: '', allowAll: false, updatedAt: serverTimestamp() }, { merge: true })
//     }
//   }

//   const addWhiteboardOperation = async (operation) => {
//     if (!currentUser?.uid) return
//     const canEdit = whiteboardOwnerId === currentUser.uid || whiteboardAllowAll
//     if (!canEdit) return
//     const safeOperation = Object.fromEntries(
//       Object.entries(operation || {}).filter(([, value]) => value !== undefined),
//     )
//     await addDoc(whiteboardOperationsRef(), {
//       ...safeOperation,
//       authorId: currentUser.uid,
//       createdAt: serverTimestamp(),
//     }).catch((error) => console.warn('Không thể đồng bộ thao tác bảng trắng:', error))
//   }

//   const clearWhiteboard = async () => {
//     if (whiteboardOwnerId !== currentUser?.uid) return
//     try {
//       const clearRef = await addDoc(whiteboardOperationsRef(), {
//         kind: 'clear',
//         authorId: currentUser.uid,
//         createdAt: serverTimestamp(),
//       })
//       const snapshot = await getDocs(whiteboardOperationsRef())
//       await Promise.all(snapshot.docs
//         .filter((item) => item.id !== clearRef.id)
//         .map((item) => deleteDoc(item.ref).catch(() => {})))
//     } catch (error) {
//       console.warn('Không thể xóa bảng trắng:', error)
//       toast.error('Không thể xóa bảng trắng')
//     }
//   }

//   const toggleWhiteboardAllowAll = async () => {
//     if (whiteboardOwnerId !== currentUser?.uid) return
//     const next = !whiteboardAllowAll
//     setWhiteboardAllowAll(next)
//     await setDoc(whiteboardRef, { allowAll: next, updatedAt: serverTimestamp() }, { merge: true })
//   }

//   const togglePinnedParticipant = (uid) => {
//     setPinnedParticipantId((previous) => previous === uid ? '' : uid)
//   }

//   const toggleMutedParticipant = (uid) => {
//     setMutedParticipantIds((previous) => {
//       const next = previous.includes(uid) ? previous.filter((item) => item !== uid) : [...previous, uid]
//       const audio = remoteAudiosRef.current.get(uid)
//       if (audio) audio.muted = deafened || next.includes(uid)
//       return next
//     })
//   }

//   useEffect(() => {
//     const unsubscribe = onSnapshot(whiteboardRef, (snapshot) => {
//       const data = snapshot.exists() ? snapshot.data() : {}
//       setWhiteboardOpen(Boolean(data.open))
//       setWhiteboardOwnerId(data.ownerId || '')
//       setWhiteboardAllowAll(Boolean(data.allowAll))
//     }, (error) => console.warn('Không thể tải trạng thái bảng trắng:', error))
//     return unsubscribe
//   }, [roomId])

//   useEffect(() => {
//     if (!whiteboardOpen) {
//       setWhiteboardOps([])
//       return undefined
//     }
//     const unsubscribe = onSnapshot(whiteboardOperationsRef(), (snapshot) => {
//       const operations = snapshot.docs
//         .map((item) => ({ id: item.id, ...item.data() }))
//         .sort((first, second) => {
//           const firstMs = first.createdAt?.toMillis?.() || 0
//           const secondMs = second.createdAt?.toMillis?.() || 0
//           return firstMs - secondMs
//         })
//       setWhiteboardOps(operations)
//     }, (error) => console.warn('Không thể đồng bộ bảng trắng:', error))
//     return unsubscribe
//   }, [roomId, whiteboardOpen])

//   useEffect(() => {
//     const unsubscribe = onSnapshot(
//       collection(db, 'forumVoiceRooms', roomId, 'participants'),
//       async (snapshot) => {
//         const now = Date.now()
//         const activeParticipants = snapshot.docs
//           .map((item) => ({ id: item.id, ref: item.ref, ...item.data() }))
//           .filter((participant) => {
//             const lastSeenMs = participant.lastSeenAt?.toMillis?.() || participant.joinedAt?.toMillis?.() || now
//             const stale = now - lastSeenMs > 180000
//             return !stale && participant.status !== 'left'
//           })

//         // Mỗi tài khoản chỉ được xuất hiện một lần, kể cả dữ liệu cũ từng tạo trùng document.
//         const uniqueParticipants = new Map()
//         activeParticipants.forEach((participant) => {
//           const participantKey = participant.uid || participant.id
//           const previous = uniqueParticipants.get(participantKey)
//           const participantSeenMs = participant.lastSeenAt?.toMillis?.() || participant.joinedAt?.toMillis?.() || 0
//           const previousSeenMs = previous?.lastSeenAt?.toMillis?.() || previous?.joinedAt?.toMillis?.() || 0
//           if (!previous || participantSeenMs >= previousSeenMs) uniqueParticipants.set(participantKey, participant)
//         })
//         const next = [...uniqueParticipants.values()].map((participant) => ({
//           ...participant,
//           id: participant.uid || participant.id,
//         }))
//         setParticipants(next)
//         if (!joinedRef.current || !currentUser?.uid) return

//         for (const participant of next) {
//           if (participant.id === currentUser.uid) continue
//           if (!peerConnectionsRef.current.has(participant.id) && shouldCreateOffer(currentUser.uid, participant.id)) {
//             createOfferForUser(participant.id).catch((error) => console.warn('Không thể tạo offer:', error))
//           }
//         }

//         const activeIds = new Set(next.map((participant) => participant.id))
//         peerConnectionsRef.current.forEach((_, uid) => {
//           if (!activeIds.has(uid)) closePeerConnection(uid)
//         })
//       },
//       (error) => console.warn('Không thể tải thành viên phòng thoại:', error),
//     )
//     return unsubscribe
//   }, [roomId, currentUser?.uid])

//   useEffect(() => {
//     if (!joined || !currentUser?.uid) return undefined
//     const signalQuery = query(signalsRef(), where('toUserId', '==', currentUser.uid))
//     const unsubscribe = onSnapshot(signalQuery, async (snapshot) => {
//       for (const change of snapshot.docChanges()) {
//         if (change.type !== 'added') continue
//         const signalDocument = change.doc
//         const signal = signalDocument.data()
//         try {
//           // Khi một người rời rồi vào lại, kết nối cũ theo cùng UID phải được đóng
//           // trước khi tạo SDP mới. Đồng thời chỉ một phía được phép tạo offer để
//           // tránh glare (hai offer xuất hiện cùng lúc) làm mất camera/màn hình.
//           if (signal.type === 'sync-request') {
//             closePeerConnection(signal.fromUserId)

//             if (shouldCreateOffer(currentUser.uid, signal.fromUserId)) {
//               await createOfferForUser(signal.fromUserId)
//             } else {
//               await sendSignal({
//                 toUserId: signal.fromUserId,
//                 type: 'sync-ready',
//                 payload: { requestedBy: signal.fromUserId },
//               })
//             }
//           } else if (signal.type === 'sync-ready') {
//             const existingPeer = peerConnectionsRef.current.get(signal.fromUserId)
//             const hasActiveNegotiation = existingPeer && (
//               existingPeer.signalingState !== 'stable' ||
//               ['connecting', 'connected'].includes(existingPeer.connectionState)
//             )

//             // Người vừa vào có thể đã tạo offer từ listener participant.
//             // Không đóng kết nối đang đàm phán vì việc đó làm mất track camera/screen.
//             if (!hasActiveNegotiation) {
//               if (existingPeer) closePeerConnection(signal.fromUserId)
//               await createOfferForUser(signal.fromUserId)
//             }
//           } else {
//             const peerConnection = await createPeerConnection(signal.fromUserId)

//             if (signal.type === 'offer') {
//             const incoming = readSignalDescription(signal.payload)
//             remoteMediaMidsRef.current.set(signal.fromUserId, incoming.mediaMids || { camera: [], screen: [] })
//             if (peerConnection.signalingState !== 'stable') {
//               await peerConnection.setLocalDescription({ type: 'rollback' }).catch(() => {})
//             }
//             await peerConnection.setRemoteDescription(new RTCSessionDescription(incoming.description))
//             await flushPendingCandidates(signal.fromUserId, peerConnection)
//             const answer = await peerConnection.createAnswer()
//             await peerConnection.setLocalDescription(answer)
//             await sendSignal({
//               toUserId: signal.fromUserId,
//               type: 'answer',
//               payload: buildMediaDescriptionPayload(peerConnection, peerConnection.localDescription || answer, signal.fromUserId),
//             })
//           } else if (signal.type === 'answer') {
//             const incoming = readSignalDescription(signal.payload)
//             remoteMediaMidsRef.current.set(signal.fromUserId, incoming.mediaMids || { camera: [], screen: [] })
//             if (peerConnection.signalingState === 'have-local-offer') {
//               await peerConnection.setRemoteDescription(new RTCSessionDescription(incoming.description))
//               await flushPendingCandidates(signal.fromUserId, peerConnection)
//             }
//             } else if (signal.type === 'candidate') {
//               if (peerConnection.remoteDescription) {
//                 await peerConnection.addIceCandidate(new RTCIceCandidate(signal.payload))
//               } else {
//                 const queued = pendingCandidatesRef.current.get(signal.fromUserId) || []
//                 pendingCandidatesRef.current.set(signal.fromUserId, [...queued, signal.payload])
//               }
//             }
//           }
//         } catch (error) {
//           console.warn('Không thể xử lý tín hiệu WebRTC:', error)
//         } finally {
//           await deleteDoc(signalDocument.ref).catch(() => {})
//         }
//       }
//     })
//     return unsubscribe
//   }, [joined, roomId, currentUser?.uid])

//   useEffect(() => {
//     if (!joined || !currentUser?.uid) return undefined

//     const refreshPresence = () => {
//       if (!joinedRef.current || pageClosingRef.current) return
//       setDoc(participantRef(), getPresencePayload(), { merge: true }).catch(() => {})
//     }

//     refreshPresence()
//     const interval = window.setInterval(refreshPresence, 10000)
//     return () => window.clearInterval(interval)
//   }, [joined, roomId, currentUser?.uid, displayName, initials, avatarUrl, micEnabled, deafened, cameraEnabled, screenSharing])


//   useEffect(() => {
//     const cleanupStaleParticipants = async () => {
//       const snapshot = await getDocs(collection(db, 'forumVoiceRooms', roomId, 'participants')).catch(() => null)
//       if (!snapshot) return
//       const now = Date.now()
//       const staleDocs = snapshot.docs.filter((item) => {
//         const data = item.data() || {}
//         const lastSeenMs = data.lastSeenAt?.toMillis?.() || data.joinedAt?.toMillis?.() || now
//         return now - lastSeenMs > 180000 && (data.uid || item.id) === currentUser?.uid
//       })
//       await Promise.all(staleDocs.map((item) => deleteDoc(item.ref).catch(() => {})))
//     }
//     cleanupStaleParticipants()
//     const interval = window.setInterval(cleanupStaleParticipants, 15000)
//     return () => window.clearInterval(interval)
//   }, [roomId, currentUser?.uid])

//   useEffect(() => {
//     if (!joined || !currentUser?.uid) return undefined

//     const leaveOnPageExit = (event) => {
//       // pagehide với persisted=true chỉ đưa trang vào back-forward cache, không phải rời web.
//       if (event?.type === 'pagehide' && event.persisted) return
//       if (pageClosingRef.current) return
//       pageClosingRef.current = true
//       joinedRef.current = false
//       deleteCurrentConnectionParticipant()
//       localStreamRef.current?.getTracks().forEach((track) => track.stop())
//       screenStreamRef.current?.getTracks().forEach((track) => track.stop())
//     }

//     const refreshPresence = () => {
//       if (!joinedRef.current || pageClosingRef.current) return
//       setDoc(participantRef(), getPresencePayload(), { merge: true }).catch(() => {})
//     }

//     const handleVisibilityChange = () => {
//       // Chuyển tab, thu nhỏ cửa sổ hoặc mở ứng dụng khác không được xem là rời phòng.
//       refreshPresence()
//     }

//     window.addEventListener('pagehide', leaveOnPageExit)
//     window.addEventListener('beforeunload', leaveOnPageExit)
//     window.addEventListener('focus', refreshPresence)
//     window.addEventListener('online', refreshPresence)
//     document.addEventListener('visibilitychange', handleVisibilityChange)
//     return () => {
//       window.removeEventListener('pagehide', leaveOnPageExit)
//       window.removeEventListener('beforeunload', leaveOnPageExit)
//       window.removeEventListener('focus', refreshPresence)
//       window.removeEventListener('online', refreshPresence)
//       document.removeEventListener('visibilitychange', handleVisibilityChange)
//     }
//   }, [joined, roomId, currentUser?.uid, displayName, initials, avatarUrl, micEnabled, deafened, cameraEnabled, screenSharing])

//   useEffect(() => {
//     pageClosingRef.current = false
//     return () => {
//       if (joinedRef.current) leaveVoiceRoom({ silent: true })
//       analysersRef.current.forEach((entry) => entry.context?.close?.().catch?.(() => {}))
//     }
//   }, [roomId])

//   const createTrackStream = (track) => track ? new MediaStream([track]) : null

//   const getRawParticipantStream = (participant) => {
//     if (!participant) return null
//     if (participant.id === currentUser?.uid) return localStreamRef.current
//     return remoteStreams[participant.id] || null
//   }

//   const getParticipantCameraStream = (participant) => {
//     if (!participant?.cameraEnabled) return null
//     if (participant.id === currentUser?.uid) return localStreamRef.current
//     return remoteCameraStreams[participant.id] || null
//   }

//   const getParticipantShareStream = (participant) => {
//     if (!participant?.screenSharing) return null
//     if (participant.id === currentUser?.uid) return screenStreamRef.current
//     return remoteScreenStreams[participant.id] || null
//   }

//   const sharingParticipants = participants.filter((participant) => participant.screenSharing && getParticipantShareStream(participant))
//   const pinnedParticipant = participants.find((participant) => participant.id === pinnedParticipantId)
//   const primaryParticipant = pinnedParticipant
//     || participants.find((participant) => speakingIds.includes(participant.id) && participant.micEnabled)
//     || participants.find((participant) => participant.id === currentUser?.uid)
//     || participants[0]
//   const canEditWhiteboard = Boolean(whiteboardOwnerId === currentUser?.uid || whiteboardAllowAll)

//   if (!joined) {
//     return (
//       <section className="relative flex h-[100dvh] max-h-[100dvh] min-h-0 flex-1 flex-col overflow-hidden bg-slate-950 text-white">
//         <button type="button" onClick={onBack} className="absolute left-3 top-3 z-30 inline-flex items-center gap-2 rounded-xl sm:left-4 sm:top-4 sm:rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-2 text-sm font-black text-white shadow-lg backdrop-blur transition hover:bg-slate-800"><ArrowLeft className="h-4 w-4" /> Quay lại kênh văn bản</button>

//         <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-5 pt-16 sm:px-8 sm:pb-8 sm:pt-20">
//           <div className="mx-auto w-full max-w-5xl">
//             <div className="text-center">
//               <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Sảnh chờ kênh âm thanh</p>
//               <h2 className="mt-3 text-3xl font-black">{channel.label}</h2>
//               <p className="mt-2 text-sm font-semibold text-slate-400">{participants.length} người đang tham gia · cập nhật realtime</p>
//             </div>

//             <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur sm:mt-8 sm:rounded-[2rem] sm:p-5">
//               <div className="mb-4 flex items-center gap-2 text-sm font-black text-slate-200"><Users className="h-5 w-5 text-blue-400" /> Người đang trong phòng</div>
//               {participants.length ? (
//                 <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
//                   {participants.map((participant) => (
//                     <div key={participant.id} className="min-w-0 flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 p-2 sm:gap-3 sm:rounded-2xl sm:p-3">
//                       <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-sky-500 to-blue-700 text-xs font-black">
//                         {participant.avatarUrl ? <img src={participant.avatarUrl} alt={participant.name} className="h-full w-full object-cover" /> : participant.initials || getInitials(participant.name)}
//                       </div>
//                       <div className="min-w-0"><p className="truncate text-sm font-black">{participant.name || 'Thành viên'}</p><p className="mt-1 text-[11px] font-bold text-emerald-400">Đang trong phòng</p></div>
//                     </div>
//                   ))}
//                 </div>
//               ) : (
//                 <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm font-bold text-slate-500">Chưa có ai trong phòng. Hãy là người đầu tiên tham gia.</div>
//               )}
//             </div>
//           </div>

//           <div className="mt-auto flex flex-col items-center justify-center gap-3 pt-6 sm:gap-5 sm:pt-10">
//             <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 p-2 backdrop-blur">
//               <button
//                 type="button"
//                 onClick={() => setMicEnabled((value) => !value)}
//                 title={micEnabled ? 'Tắt microphone trước khi vào phòng' : 'Bật microphone khi vào phòng'}
//                 className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12 transition ${micEnabled ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' : 'bg-rose-600 text-white'}`}
//               >
//                 {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
//               </button>
//               <button
//                 type="button"
//                 onClick={() => setCameraEnabled((value) => !value)}
//                 title={cameraEnabled ? 'Tắt camera trước khi vào phòng' : 'Bật camera khi vào phòng'}
//                 className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12 transition ${cameraEnabled ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' : 'bg-white/10 text-white hover:bg-white/20'}`}
//               >
//                 {cameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
//               </button>
//             </div>
//             <p className="text-xs font-bold text-slate-400">Mic và camera mặc định tắt. Trạng thái bạn chọn sẽ được giữ khi vào phòng.</p>
//             <button type="button" onClick={joinVoiceRoom} disabled={joining} className="group relative inline-flex w-full max-w-[320px] items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 px-10 py-5 text-lg font-black text-white shadow-[0_0_45px_rgba(56,189,248,0.42)] transition hover:-translate-y-1 hover:shadow-[0_0_65px_rgba(56,189,248,0.58)] disabled:cursor-not-allowed disabled:opacity-60">
//               <span className="absolute inset-0 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-[120%]" />
//               <Headphones className="relative h-6 w-6" /><span className="relative">{joining ? 'Đang kết nối...' : 'Tham gia phòng thoại'}</span>
//             </button>
//           </div>
//         </div>
//       </section>
//     )
//   }

//   return (
//     <section className="relative flex h-[100dvh] max-h-[100dvh] min-h-0 flex-1 flex-col overflow-hidden bg-slate-950 text-white">
//       <button type="button" onClick={onBack} className="absolute left-3 top-3 z-30 inline-flex items-center gap-2 rounded-xl sm:left-4 sm:top-4 sm:rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-2 text-sm font-black text-white shadow-lg backdrop-blur transition hover:bg-slate-800"><ArrowLeft className="h-4 w-4" /> Quay lại kênh văn bản</button>

//       <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-2 pt-20 sm:px-5 sm:pt-5">
//         <div className="mx-auto flex w-full max-w-[1700px] items-center justify-end gap-3 pb-4">
//           <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-right backdrop-blur"><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">{channel.label}</p><p className="mt-0.5 text-xs font-bold text-slate-400">{participants.length} người · realtime</p></div>
//         </div>

//         <div className="mx-auto grid min-h-0 w-full max-w-[1700px] flex-1 grid-cols-1 gap-2 overflow-y-auto sm:gap-3 lg:grid-cols-[minmax(0,1fr)_300px] lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_320px]">
//           <main className="min-h-[260px] overflow-hidden rounded-xl sm:min-h-[320px] sm:rounded-[1.5rem] border border-white/10 bg-slate-900 shadow-2xl lg:min-h-0">
//             {whiteboardOpen ? (
//               <RealtimeWhiteboard
//                 operations={whiteboardOps}
//                 canEdit={canEditWhiteboard}
//                 allowAll={whiteboardAllowAll}
//                 isOwner={whiteboardOwnerId === currentUser?.uid}
//                 onAddOperation={addWhiteboardOperation}
//                 onClear={clearWhiteboard}
//                 onToggleAllowAll={toggleWhiteboardAllowAll}
//               />
//             ) : sharingParticipants.length ? (
//               <div className={`grid h-full min-h-[360px] gap-2 p-2 ${sharingParticipants.length === 1 ? 'grid-cols-1' : sharingParticipants.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 xl:grid-cols-3'}`}>
//                 {sharingParticipants.map((participant) => {
//                   const shareStream = getParticipantShareStream(participant)
//                   return (
//                     <div key={participant.id} className="relative min-h-[240px] overflow-hidden rounded-2xl border border-cyan-400/30 bg-black">
//                       <StreamVideo stream={shareStream} muted={participant.id === currentUser?.uid} className="h-full w-full object-contain" />
//                       <div className="absolute bottom-3 left-3 rounded-xl bg-slate-950/75 px-3 py-2 text-xs font-black backdrop-blur">{participant.name}{participant.id === currentUser?.uid ? ' (Bạn)' : ''} · Đang chia sẻ</div>
//                     </div>
//                   )
//                 })}
//               </div>
//             ) : primaryParticipant ? (() => {
//               const speaking = speakingIds.includes(primaryParticipant.id) && primaryParticipant.micEnabled
//               const cameraStream = getParticipantCameraStream(primaryParticipant)
//               return (
//                 <div className={`relative h-full min-h-[360px] w-full ${speaking ? 'ring-4 ring-inset ring-emerald-400' : ''}`}>
//                   {cameraStream ? (
//                     <StreamVideo stream={cameraStream} muted={primaryParticipant.id === currentUser?.uid} className="h-full w-full object-cover" />
//                   ) : (
//                     <div className="grid h-full min-h-[360px] place-items-center bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.22),transparent_55%)]"><div className={`grid h-36 w-36 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-sky-500 to-blue-700 text-4xl font-black shadow-2xl ${speaking ? 'animate-pulse ring-8 ring-emerald-400/30' : ''}`}>{primaryParticipant.avatarUrl ? <img src={primaryParticipant.avatarUrl} alt={primaryParticipant.name} className="h-full w-full object-cover" /> : primaryParticipant.initials || getInitials(primaryParticipant.name)}</div></div>
//                   )}
//                   <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-2xl bg-slate-950/70 px-4 py-2 backdrop-blur"><span className={`h-2.5 w-2.5 rounded-full ${speaking ? 'bg-emerald-400' : 'bg-slate-500'}`} /><span className="font-black">{primaryParticipant.name || 'Thành viên'}{primaryParticipant.id === currentUser?.uid ? ' (Bạn)' : ''}</span>{pinnedParticipantId === primaryParticipant.id && <Pin className="h-4 w-4 text-cyan-300" />}{!primaryParticipant.micEnabled && <MicOff className="h-4 w-4 text-rose-400" />}</div>
//                 </div>
//               )
//             })() : <div className="grid h-full min-h-[360px] place-items-center text-center"><div><Headphones className="mx-auto h-12 w-12 text-slate-600" /><p className="mt-4 text-lg font-black text-slate-300">Phòng đang trống</p></div></div>}
//           </main>

//           <aside className="flex min-h-[180px] flex-col overflow-hidden rounded-xl sm:min-h-[220px] sm:rounded-[1.5rem] border border-white/10 bg-slate-900/80 lg:min-h-0">
//             <div className="border-b border-white/10 px-4 py-3"><p className="text-sm font-black">Người tham gia</p><p className="mt-1 text-xs font-bold text-slate-400">Hover để ghim hoặc tắt loa từng người</p></div>
//             <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto p-2 sm:grid-cols-3 sm:p-3 lg:grid-cols-1">
//               {participants.map((participant) => {
//                 const speaking = speakingIds.includes(participant.id) && participant.micEnabled
//                 const cameraStream = getParticipantCameraStream(participant)
//                 const isSelf = participant.id === currentUser?.uid
//                 const mutedLocally = mutedParticipantIds.includes(participant.id)
//                 return (
//                   <div key={participant.id} className={`group relative aspect-video min-h-[92px] w-full sm:min-h-[112px] overflow-hidden rounded-2xl border bg-slate-950 ${speaking ? 'border-emerald-400 ring-2 ring-emerald-400/30' : pinnedParticipantId === participant.id ? 'border-cyan-400 ring-2 ring-cyan-400/25' : 'border-white/10'}`}>
//                     {cameraStream ? <StreamVideo stream={cameraStream} muted={isSelf} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-sky-500 to-blue-700 font-black">{participant.avatarUrl ? <img src={participant.avatarUrl} alt={participant.name} className="h-full w-full object-cover" /> : participant.initials || getInitials(participant.name)}</div></div>}
//                     {!isSelf && <div className="absolute right-2 top-2 flex translate-y-[-6px] gap-1 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100"><button type="button" onClick={() => togglePinnedParticipant(participant.id)} title={pinnedParticipantId === participant.id ? 'Bỏ ghim' : 'Ghim giữa màn hình'} className={`rounded-xl p-2 backdrop-blur ${pinnedParticipantId === participant.id ? 'bg-cyan-500 text-white' : 'bg-slate-950/70 text-white hover:bg-slate-800'}`}>{pinnedParticipantId === participant.id ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}</button><button type="button" onClick={() => toggleMutedParticipant(participant.id)} title={mutedLocally ? 'Bật lại loa người này' : 'Tắt loa người này'} className={`rounded-xl p-2 backdrop-blur ${mutedLocally ? 'bg-rose-600 text-white' : 'bg-slate-950/70 text-white hover:bg-slate-800'}`}>{mutedLocally ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button></div>}
//                     <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-950 px-3 py-2 text-xs font-black"><span className="truncate">{participant.name}{isSelf ? ' (Bạn)' : ''}</span><span className="flex items-center gap-1">{participant.screenSharing && <ScreenShare className="h-3.5 w-3.5 text-cyan-300" />}{participant.cameraEnabled && <Video className="h-3.5 w-3.5 text-blue-300" />}{participant.micEnabled ? <Mic className={`h-3.5 w-3.5 ${speaking ? 'text-emerald-400' : 'text-slate-400'}`} /> : <MicOff className="h-3.5 w-3.5 text-rose-400" />}</span></div>
//                   </div>
//                 )
//               })}
//             </div>
//           </aside>
//         </div>
//       </div>

//       <div className="sticky bottom-0 z-40 shrink-0 border-t border-white/10 bg-slate-900/95 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-3 sm:py-3 shadow-[0_-16px_40px_rgba(2,6,23,0.45)] backdrop-blur-xl">
//         <div className="mx-auto flex max-w-4xl flex-nowrap items-center justify-start gap-2 overflow-x-auto px-1 sm:justify-center sm:gap-3">
//           <button type="button" onClick={toggleMicrophone} title={micEnabled ? 'Tắt microphone' : 'Bật microphone'} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12 transition ${micEnabled ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-rose-600 text-white'}`}>{micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</button>
//           <button type="button" onClick={toggleCamera} title={cameraEnabled ? 'Tắt camera' : 'Bật camera'} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12 transition ${cameraEnabled ? 'bg-blue-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>{cameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}</button>
//           <button type="button" onClick={toggleScreenShare} title={screenSharing ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12 transition ${screenSharing ? 'bg-cyan-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>{screenSharing ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}</button>
//           <button type="button" onClick={openWhiteboard} title={whiteboardOpen && whiteboardOwnerId === currentUser?.uid ? 'Đóng bảng trắng' : 'Mở bảng trắng'} className={`flex h-12 w-12 items-center justify-center rounded-full transition ${whiteboardOpen ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}><PenTool className="h-5 w-5" /></button>
//           <button type="button" onClick={toggleDeafen} title={deafened ? 'Bật âm thanh' : 'Tắt toàn bộ âm thanh'} className={`flex h-12 w-12 items-center justify-center rounded-full transition ${deafened ? 'bg-amber-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>{deafened ? <VolumeX className="h-5 w-5" /> : <Headphones className="h-5 w-5" />}</button>
//           <button type="button" onClick={() => leaveVoiceRoom()} title="Rời phòng thoại" className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-rose-600 px-4 sm:h-12 sm:px-5 text-sm font-black text-white transition hover:bg-rose-700"><PhoneOff className="h-5 w-5" /><span className="hidden sm:inline">Rời phòng</span></button>
//         </div>
//       </div>
//     </section>
//   )
// }

export default function VoiceChannelRoom() {
  return null
}
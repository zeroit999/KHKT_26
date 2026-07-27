import {
  ArrowUpRight,
  Database,
  Maximize2,
  Minimize2,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.jsx'
import useSyncedDarkMode from '../../hooks/common/useSyncedDarkMode.js'
import {
  collectSafePageContext,
  executeSafePageAction,
  getPageAssistantProfile,
  normalizeAssistantRole,
} from './pageAssistant.js'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.VITE_LOCAL_DEV_MODE === 'true' ? 'http://127.0.0.1:5000' : '')
).replace(/\/$/, '')

function normalizeReply(text) {
  return String(text || '').trim()
}

function buildPageWelcome(profile) {
  return {
    id: `${profile.id}-${Date.now()}`,
    role: 'assistant',
    content: `${profile.description}\n\nTôi đã chuyển sang chế độ hỗ trợ riêng cho trang này. Bạn có thể hỏi bằng câu tự nhiên hoặc chọn một gợi ý nhanh.`,
    contextIntro: true,
  }
}

async function buildAuthHeaders(user) {
  if (!user) return {}
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

export default function ChatbotWidget() {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [memoryCount, setMemoryCount] = useState(0)
  const [grounding, setGrounding] = useState(null)

  const isDark = useSyncedDarkMode()
  const messagesEndRef = useRef(null)
  const activeContextRef = useRef('')
  const { user, userDetails } = useAuth()

  const pageProfile = useMemo(
    () => getPageAssistantProfile(location.pathname),
    [location.pathname],
  )

  const userRole = normalizeAssistantRole(userDetails?.role)

  const botLogo = isDark
    ? '/logo_chatbot-darkmode.png'
    : '/logo_chatbot-lightmode.png'

  const userName =
    userDetails?.displayName ||
    userDetails?.fullName ||
    userDetails?.name ||
    user?.displayName ||
    user?.email ||
    'Bạn'

  const userAvatar =
    userDetails?.photoURL ||
    userDetails?.avatar ||
    userDetails?.avatarUrl ||
    user?.photoURL ||
    ''

  const userInitial = useMemo(() => {
    return String(userName || 'B').trim().charAt(0).toUpperCase()
  }, [userName])

  useEffect(() => {
    let cancelled = false

    async function loadHistory() {
      if (!user) {
        setMessages([])
        setMemoryCount(0)
        return
      }

      setHistoryLoading(true)
      try {
        const response = await fetch(`${API_BASE_URL}/api/chat/history`, {
          headers: await buildAuthHeaders(user),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data?.error || 'Không tải được lịch sử')
        if (!cancelled) {
          const restored = (data.messages || []).map((message, index) => ({
            ...message,
            id: `history-${index}-${message.createdAt || ''}`,
          }))
          setMessages(restored)
          setMemoryCount(Number(data.messageCount || restored.length))
        }
      } catch (error) {
        console.warn('Không thể tải lịch sử ZUNY AI:', error)
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    }

    loadHistory()
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    })
  }, [messages, loading])

  useEffect(() => {
    if (!open || activeContextRef.current === pageProfile.id) return

    activeContextRef.current = pageProfile.id
    setMessages((prev) => [...prev, buildPageWelcome(pageProfile)])
  }, [open, pageProfile])

  const handleToggle = () => {
    setOpen((prev) => !prev)
  }

  const handleSend = async (suggestedMessage = '') => {
    const trimmedInput = String(suggestedMessage || input).trim()

    if (!trimmedInput || loading) return

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: 'user',
        content: trimmedInput,
      },
    ])

    setInput('')
    setLoading(true)

    try {
      if (!API_BASE_URL) {
        throw new Error('Chưa cấu hình VITE_API_BASE_URL cho chatbot backend.')
      }
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...(await buildAuthHeaders(user)),
        },
        body: JSON.stringify({
          message: trimmedInput,
          history: messages
            .filter((message) => !message.contextIntro && !message.actionResult)
            .slice(-20)
            .map(({ role, content }) => ({ role, content })),
          context: {
            path: location.pathname,
            pageId: pageProfile.id,
            role: userRole,
            visible: collectSafePageContext(pageProfile),
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.reply || 'Không thể kết nối tới ZUNY AI.')
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: normalizeReply(
            data.reply || 'Xin lỗi, tôi chưa có câu trả lời cho câu hỏi này.',
          ),
          actions: Array.isArray(data.actions) ? data.actions : [],
          provider: data.provider,
          page: data.page,
        },
      ])
      setMemoryCount(Number(data.memoryCount || 0))
      setGrounding(data.grounding || null)
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: error?.message || 'Không thể kết nối tới ZUNY AI. Vui lòng thử lại sau.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (action) => {
    if (action?.type === 'navigate' && String(action.target || '').startsWith('/')) {
      navigate(action.target)
      return
    }

    if (action?.type === 'prompt' && action.prompt) {
      await handleSend(action.prompt)
      return
    }

    if (action?.type === 'page_action' && action.command) {
      const result = executeSafePageAction(action.command)
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: 'assistant',
          content: result.success ? `✓ ${result.message}` : result.message,
          actionResult: true,
        },
      ])
    }
  }

  const handleClearHistory = async () => {
    if (!user || loading) return
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/history`, {
        method: 'DELETE',
        headers: await buildAuthHeaders(user),
      })
      if (!response.ok) throw new Error('Không thể xóa lịch sử')
      setMessages([buildPageWelcome(pageProfile)])
      setMemoryCount(0)
      setGrounding(null)
      activeContextRef.current = ''
    } catch (error) {
      console.warn('Không thể xóa lịch sử ZUNY AI:', error)
    }
  }

  const renderBotAvatar = (size = 'small') => {
    const sizeClass = size === 'large' ? 'h-10 w-10 rounded-2xl' : 'h-8 w-8 rounded-full'
    const imgSizeClass = size === 'large' ? 'h-8 w-8' : 'h-6 w-6'

    return (
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden shadow-sm ${sizeClass} ${
          isDark
            ? 'bg-violet-500 text-white shadow-violet-500/30'
            : 'bg-cyan-500 text-white shadow-cyan-500/30'
        }`}
      >
        <img
          src={botLogo}
          alt="ZUNY AI"
          className={`${imgSizeClass} object-contain`}
        />
      </div>
    )
  }

  const renderUserAvatar = () => (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#9b7b6a] text-xs font-bold text-white shadow-sm">
      {userAvatar ? (
        <img
          src={userAvatar}
          alt={userName}
          className="h-full w-full object-cover"
        />
      ) : (
        userInitial
      )}
    </div>
  )

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
      {open && (
        <div
          role="dialog"
          aria-label={pageProfile.title}
          className={`${expanded
            ? 'fixed inset-2 w-auto sm:inset-5 lg:inset-8'
            : 'mb-3 w-[min(390px,calc(100vw-2rem))]'
          } overflow-hidden rounded-[28px] border shadow-2xl transition-all duration-300 ${
            isDark
              ? 'border-violet-400/30 bg-[#080808] shadow-violet-500/20'
              : 'border-cyan-200 bg-white shadow-cyan-500/20'
          }`}
        >
          <div className={`relative flex flex-col overflow-hidden ${expanded ? 'h-full' : 'h-[580px] max-h-[calc(100vh-7rem)]'}`}>
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div
                className={`absolute -right-16 top-8 h-14 w-40 rounded-full border ${
                  isDark ? 'border-violet-400/35' : 'border-cyan-300/60'
                }`}
              />

              <div
                className={`absolute -left-16 top-28 h-20 w-44 rounded-full border ${
                  isDark ? 'border-violet-400/30' : 'border-cyan-300/50'
                }`}
              />

              <div
                className={`absolute left-8 top-60 h-20 w-48 rounded-full border ${
                  isDark ? 'border-violet-400/30' : 'border-cyan-300/50'
                }`}
              />
            </div>

            <div
              className={`relative z-10 flex shrink-0 items-center justify-between border-b px-4 py-3 backdrop-blur-md ${
                isDark
                  ? 'border-violet-400/20 bg-black/45 text-violet-100'
                  : 'border-cyan-200 bg-white/75 text-slate-900'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                {renderBotAvatar('large')}

                <div>
                  <h2 className={`${expanded ? 'max-w-[55vw]' : 'max-w-[190px]'} truncate text-sm font-black leading-none`}>
                    {pageProfile.title}
                  </h2>

                  <p
                    className={`mt-1 flex items-center gap-1 text-[11px] ${
                      isDark ? 'text-violet-200/70' : 'text-slate-500'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {pageProfile.eyebrow}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {user && (
                  <button type="button" onClick={handleClearHistory} disabled={loading || historyLoading} className={`flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-40 ${isDark ? 'text-violet-300 hover:bg-violet-500/20' : 'text-cyan-600 hover:bg-cyan-100'}`} aria-label="Xóa lịch sử trò chuyện" title="Xóa lịch sử">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button type="button" onClick={() => setExpanded((value) => !value)} className={`flex h-8 w-8 items-center justify-center rounded-lg ${isDark ? 'text-violet-300 hover:bg-violet-500/20' : 'text-cyan-600 hover:bg-cyan-100'}`} aria-label={expanded ? 'Thu nhỏ chatbot' : 'Mở rộng chatbot'} title={expanded ? 'Thu nhỏ' : 'Mở rộng'}>
                  {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <button type="button" onClick={() => setOpen(false)} className={`flex h-8 w-8 items-center justify-center rounded-lg ${isDark ? 'text-violet-300 hover:bg-violet-500/20' : 'text-cyan-600 hover:bg-cyan-100'}`} aria-label="Đóng chatbot">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div
              className={`relative z-10 shrink-0 border-b px-4 py-3 ${
                isDark
                  ? 'border-violet-400/15 bg-violet-500/5'
                  : 'border-cyan-100 bg-gradient-to-r from-cyan-50 to-violet-50'
              }`}
            >
              <div className="flex items-start gap-2">
                <Sparkles className={`mt-0.5 h-4 w-4 shrink-0 ${isDark ? 'text-violet-300' : 'text-cyan-600'}`} />
                <p className={`text-xs font-semibold leading-5 ${isDark ? 'text-violet-100/75' : 'text-slate-600'}`}>
                  {pageProfile.description}
                </p>
              </div>

              <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold ${isDark ? 'text-violet-200/60' : 'text-slate-500'}`}>
                <span className="inline-flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  {grounding?.authenticated
                    ? grounding.restricted
                      ? 'Dữ liệu bị giới hạn an toàn trong phòng thi'
                      : `Đã đọc ${grounding.courseCount || 0} khóa học · ${grounding.examCount || 0} bài thi · ${grounding.classCount || 0} lớp · ${grounding.forumPostCount || 0} bài viết`
                    : user
                      ? 'AI sẵn sàng đọc dữ liệu theo câu hỏi và quyền của Bạn'
                      : 'Đăng nhập để AI đọc dữ liệu được cấp quyền'}
                </span>
                {user && <span>Nhớ {memoryCount} tin nhắn</span>}
              </div>

              <div className="mt-3 flex max-h-24 flex-wrap gap-2 overflow-y-auto pb-1 pr-1">
                {pageProfile.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSend(suggestion)}
                    disabled={loading}
                    className={`max-w-full break-words rounded-full border px-3 py-1.5 text-left text-[11px] font-bold leading-4 transition disabled:opacity-50 ${
                      isDark
                        ? 'border-violet-400/25 bg-black/30 text-violet-200 hover:bg-violet-500/15'
                        : 'border-cyan-200 bg-white text-cyan-700 hover:border-cyan-300'
                    }`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            <div className={`relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 overscroll-contain ${expanded ? 'sm:px-8' : ''}`}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`mb-4 flex items-end gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && renderBotAvatar()}

                  <div className={expanded ? 'max-w-[82%]' : 'max-w-[76%]'}>
                    <div
                    className={`break-words whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                      message.role === 'user'
                        ? isDark
                          ? 'rounded-br-md bg-violet-500 text-white'
                          : 'rounded-br-md bg-cyan-500 text-white'
                        : isDark
                          ? 'rounded-bl-md border border-violet-400/25 bg-black/65 text-violet-100'
                          : 'rounded-bl-md border border-cyan-200 bg-white/90 text-slate-700'
                    }`}
                  >
                    {message.content}
                    {message.provider === 'mock' && (
                      <div className="mt-2 text-[10px] font-bold uppercase tracking-wide opacity-60">Local mock</div>
                    )}
                    </div>

                    {message.role === 'assistant' && message.actions?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.actions.map((action) => (
                          <button
                            key={action.id || `${action.type}-${action.target}`}
                            type="button"
                            onClick={() => handleAction(action)}
                            className={`max-w-full break-words rounded-full border px-3 py-1.5 text-left text-xs font-bold leading-5 transition ${
                              isDark
                                ? 'border-violet-400/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20'
                                : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                            }`}
                          >
                            {action.label}
                            {action.type === 'navigate' && (
                              <ArrowUpRight className="ml-1 inline h-3 w-3" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {message.role === 'user' && renderUserAvatar()}
                </div>
              ))}

              {(loading || historyLoading) && (
                <div className="mb-4 flex items-end gap-3">
                  {renderBotAvatar()}

                  <div
                    className={`max-w-[70%] rounded-2xl rounded-bl-md px-4 py-3 text-sm shadow-sm ${
                      isDark
                        ? 'border border-violet-400/25 bg-black/65 text-violet-100'
                        : 'border border-cyan-200 bg-white/90 text-slate-700'
                    }`}
                  >
                    {historyLoading ? 'Đang khôi phục cuộc trò chuyện...' : 'Đang đọc dữ liệu và suy nghĩ...'}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div
              className={`relative z-10 shrink-0 border-t p-3 backdrop-blur-md ${
                isDark
                  ? 'border-violet-400/20 bg-black/55'
                  : 'border-cyan-200 bg-white/85'
              }`}
            >
              <div
                className={`flex items-center gap-2 rounded-2xl border p-2 ${
                  isDark
                    ? 'border-violet-400/30 bg-black/70'
                    : 'border-cyan-200 bg-slate-50'
                }`}
              >
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      handleSend()
                    }
                  }}
                  disabled={loading}
                  rows={1}
                  className={`max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
                    isDark
                      ? 'text-white placeholder:text-violet-300/50'
                      : 'text-slate-900 placeholder:text-cyan-700/40'
                  }`}
                  placeholder={
                    loading ? 'ZUNY AI đang trả lời...' : `Hỏi về ${pageProfile.title}...`
                  }
                />

                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={loading || !input.trim()}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                    isDark
                      ? 'bg-violet-500 hover:bg-violet-600'
                      : 'bg-cyan-500 hover:bg-cyan-600'
                  }`}
                  aria-label="Gửi tin nhắn"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={handleToggle}
          className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border shadow-xl transition-all duration-500 hover:scale-105 ${
            isDark
              ? 'border-violet-400/40 bg-[#080808] shadow-violet-500/30'
              : 'border-cyan-200 bg-white shadow-cyan-500/30'
          }`}
          aria-label="Mở chatbot"
        >
          <img
            src={botLogo}
            alt="ZUNY AI"
            className="h-10 w-10 object-contain"
          />
        </button>
      )}
    </div>
  )
}

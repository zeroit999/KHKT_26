import { Send, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.jsx'
import useSyncedDarkMode from '../../hooks/common/useSyncedDarkMode.js'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.VITE_LOCAL_DEV_MODE === 'true' ? 'http://127.0.0.1:5000' : '')
).replace(/\/$/, '')

if (!API_BASE_URL) {
  throw new Error('Missing environment variable: VITE_API_BASE_URL')
}

function normalizeReply(text) {
  return String(text || '').trim()
}

export default function ChatbotWidget() {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const isDark = useSyncedDarkMode()
  const messagesEndRef = useRef(null)
  const { user, userDetails } = useAuth()

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
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    })
  }, [messages, loading])

  const handleToggle = () => {
    if (!open && messages.length === 0) {
      setMessages([
        {
          id: Date.now(),
          role: 'assistant',
          content:
            'Xin chào 👋 Tôi là ZUNY AI Assistant.\n\nTôi có thể hướng dẫn Bạn sử dụng các chức năng của ZUNY và mở nhanh trang phù hợp.',
          actions: [
            { id: 'courses', label: 'Khóa học', type: 'navigate', target: '/e-learning' },
            { id: 'exams', label: 'Luyện thi', type: 'navigate', target: '/exams' },
            { id: 'forum', label: 'Diễn đàn', type: 'navigate', target: '/Forum' },
          ],
        },
      ])
    }

    setOpen((prev) => !prev)
  }

  const handleSend = async () => {
    const trimmedInput = input.trim()

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
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          message: trimmedInput,
          history: messages.slice(-8).map(({ role, content }) => ({ role, content })),
          context: { path: location.pathname },
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
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: 'Không thể kết nối tới ZUNY AI. Vui lòng thử lại sau.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleAction = (action) => {
    if (action?.type !== 'navigate' || !String(action.target || '').startsWith('/')) return
    navigate(action.target)
    setOpen(false)
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
          className={`mb-3 w-[320px] overflow-hidden rounded-[24px] border shadow-2xl transition-all duration-500 ${
            isDark
              ? 'border-violet-400/30 bg-[#080808] shadow-violet-500/20'
              : 'border-cyan-200 bg-white shadow-cyan-500/20'
          }`}
        >
          <div className="relative flex h-[430px] max-h-[calc(100vh-7rem)] flex-col overflow-hidden">
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
              <div className="flex items-center gap-3">
                {renderBotAvatar('large')}

                <div>
                  <h2 className="text-sm font-black leading-none">
                    ZUNY AI
                  </h2>

                  <p
                    className={`mt-1 flex items-center gap-1 text-[11px] ${
                      isDark ? 'text-violet-200/70' : 'text-slate-500'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Trợ lý học tập
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  isDark
                    ? 'text-violet-300 hover:bg-violet-500/20'
                    : 'text-cyan-600 hover:bg-cyan-100'
                }`}
                aria-label="Đóng chatbot"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 overscroll-contain">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`mb-4 flex items-end gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && renderBotAvatar()}

                  <div className="max-w-[76%]">
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
                            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                              isDark
                                ? 'border-violet-400/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20'
                                : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                            }`}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {message.role === 'user' && renderUserAvatar()}
                </div>
              ))}

              {loading && (
                <div className="mb-4 flex items-end gap-3">
                  {renderBotAvatar()}

                  <div
                    className={`max-w-[70%] rounded-2xl rounded-bl-md px-4 py-3 text-sm shadow-sm ${
                      isDark
                        ? 'border border-violet-400/25 bg-black/65 text-violet-100'
                        : 'border border-cyan-200 bg-white/90 text-slate-700'
                    }`}
                  >
                    Đang suy nghĩ...
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
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleSend()
                    }
                  }}
                  disabled={loading}
                  className={`flex-1 bg-transparent px-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
                    isDark
                      ? 'text-white placeholder:text-violet-300/50'
                      : 'text-slate-900 placeholder:text-cyan-700/40'
                  }`}
                  placeholder={
                    loading ? 'ZUNY AI đang trả lời...' : 'Nhập câu hỏi...'
                  }
                />

                <button
                  type="button"
                  onClick={handleSend}
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

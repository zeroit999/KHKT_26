import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom'

import {
  ArrowLeft,
  Mail,
  ShieldCheck,
} from 'lucide-react'

import { authService } from '../../services/auth'

import lightLogo from '../../assets/favicon-light-mode.png'
import darkLogo from '../../assets/favicon-dark-mode.png'

const PENDING_EMAIL_KEY =
  'zuny_pending_verification_email'

const RESEND_COOLDOWN = 60

function VerifyEmail() {
  const location = useLocation()
  const navigate = useNavigate()

  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] =
    useState(false)
  const [resending, setResending] =
    useState(false)
  const [cooldown, setCooldown] =
    useState(0)

  const [darkMode, setDarkMode] =
    useState(
      document.documentElement.classList.contains(
        'dark'
      )
    )

  const email = useMemo(() => {
    const stateEmail =
      location.state?.email

    const storedEmail =
      sessionStorage.getItem(
        PENDING_EMAIL_KEY
      )

    return String(
      stateEmail ||
        storedEmail ||
        ''
    )
      .trim()
      .toLowerCase()
  }, [location.state])

  useEffect(() => {
    const observer =
      new MutationObserver(() => {
        setDarkMode(
          document.documentElement.classList.contains(
            'dark'
          )
        )
      })

    observer.observe(
      document.documentElement,
      {
        attributes: true,
        attributeFilter: ['class'],
      }
    )

    return () =>
      observer.disconnect()
  }, [])

  useEffect(() => {
    if (!email) {
      navigate('/login', {
        replace: true,
      })
      return
    }

    sessionStorage.setItem(
      PENDING_EMAIL_KEY,
      email
    )
  }, [email, navigate])

  useEffect(() => {
    if (cooldown <= 0) {
      return undefined
    }

    const timer =
      window.setInterval(() => {
        setCooldown((value) =>
          Math.max(0, value - 1)
        )
      }, 1000)

    return () =>
      window.clearInterval(timer)
  }, [cooldown])

  const handleCodeChange = (event) => {
    const value =
      event.target.value
        .replace(/\D/g, '')
        .slice(0, 6)

    setCode(value)
    setError('')
  }

  const handleVerify =
    async (event) => {
      event.preventDefault()

      if (code.length !== 6) {
        setError(
          'Vui lòng nhập đủ mã xác minh gồm 6 chữ số.'
        )
        return
      }

      setError('')
      setMessage('')
      setLoading(true)

      try {
        await authService.verifyEmail(
          email,
          code
        )

        sessionStorage.removeItem(
          PENDING_EMAIL_KEY
        )

        navigate('/login', {
          replace: true,
          state: {
            verifiedEmail: email,
            emailVerified: true,
          },
        })
      } catch (err) {
        setError(
          err?.message ||
            'Không thể xác minh email. Vui lòng thử lại.'
        )
      } finally {
        setLoading(false)
      }
    }

  const handleResend =
    async () => {
      if (
        resending ||
        cooldown > 0
      ) {
        return
      }

      setError('')
      setMessage('')
      setResending(true)

      try {
        const data =
          await authService.resendVerification(
            email
          )

        setMessage(
          data?.message ||
            'Đã gửi lại mã xác minh.'
        )

        setCooldown(
          RESEND_COOLDOWN
        )
      } catch (err) {
        setError(
          err?.message ||
            'Không thể gửi lại mã xác minh.'
        )

        if (
          err?.status === 429
        ) {
          setCooldown(
            RESEND_COOLDOWN
          )
        }
      } finally {
        setResending(false)
      }
    }

  if (!email) {
    return null
  }

  return (
    <div
      className={`relative flex min-h-screen items-center justify-center overflow-hidden px-4 transition-colors duration-300 ${
        darkMode
          ? 'bg-[#030712]'
          : 'bg-slate-100'
      }`}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-96 w-96 animate-pulse rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-[28rem] w-[28rem] animate-pulse rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 animate-pulse rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:70px_70px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div
          className={`rounded-[2rem] p-8 backdrop-blur-2xl transition-colors duration-300 ${
            darkMode
              ? 'bg-white/10 shadow-[0_25px_80px_rgba(0,0,0,0.45)]'
              : 'border border-slate-200 bg-white/80 shadow-[0_25px_80px_rgba(15,23,42,0.15)]'
          }`}
        >
          <div className="mb-8 text-center">
            <div className="mb-6 flex items-center justify-center">
              <div className="relative flex items-center justify-center">
                <div className="absolute h-32 w-32 rounded-[2rem] bg-cyan-500/20 blur-3xl" />
                <div className="absolute h-28 w-28 rounded-[2rem] bg-fuchsia-500/20 blur-3xl" />

                <div
                  className={`relative rounded-[2rem] p-3 backdrop-blur-xl ${
                    darkMode
                      ? 'border border-white/5 bg-black shadow-[0_0_45px_rgba(59,130,246,0.35)]'
                      : 'border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.15)]'
                  }`}
                >
                  <img
                    src={
                      darkMode
                        ? darkLogo
                        : lightLogo
                    }
                    alt="ZUNY"
                    className="h-14 w-14 rounded-xl object-cover"
                  />
                </div>
              </div>
            </div>

            <div className="mb-4 flex justify-center">
              <div className="rounded-2xl bg-cyan-500/10 p-3">
                <ShieldCheck className="h-7 w-7 text-cyan-400" />
              </div>
            </div>

            <h1
              className={`text-3xl font-black ${
                darkMode
                  ? 'text-white'
                  : 'text-slate-900'
              }`}
            >
              Xác minh email
            </h1>

            <p
              className={`mt-3 text-sm ${
                darkMode
                  ? 'text-slate-300'
                  : 'text-slate-600'
              }`}
            >
              Chúng tôi đã gửi mã gồm
              6 chữ số đến
            </p>

            <div
              className={`mt-2 flex items-center justify-center gap-2 break-all text-sm font-bold ${
                darkMode
                  ? 'text-cyan-300'
                  : 'text-cyan-700'
              }`}
            >
              <Mail className="h-4 w-4 shrink-0" />
              <span>{email}</span>
            </div>
          </div>

          <form
            onSubmit={handleVerify}
            className="space-y-5"
          >
            <div>
              <label className="mb-2 block text-sm font-semibold text-cyan-400">
                Mã xác minh
              </label>

              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={
                  handleCodeChange
                }
                placeholder="000000"
                maxLength={6}
                autoFocus
                className={`w-full rounded-2xl px-4 py-4 text-center font-mono text-3xl font-black tracking-[0.45em] outline-none backdrop-blur-xl transition ${
                  darkMode
                    ? 'bg-white/10 text-white placeholder:text-slate-600'
                    : 'border border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-300'
                }`}
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-500">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={
                loading ||
                code.length !== 6
              }
              className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-600 py-4 text-lg font-bold text-white shadow-[0_10px_40px_rgba(14,165,233,0.35)] transition enabled:hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? 'Đang xác minh...'
                : 'Xác minh email'}
            </button>

            <div className="text-center">
              <p
                className={`text-sm ${
                  darkMode
                    ? 'text-slate-400'
                    : 'text-slate-600'
                }`}
              >
                Chưa nhận được mã?
              </p>

              <button
                type="button"
                onClick={
                  handleResend
                }
                disabled={
                  resending ||
                  cooldown > 0
                }
                className="mt-2 font-semibold text-cyan-400 transition hover:text-cyan-300 disabled:cursor-not-allowed disabled:text-slate-500"
              >
                {resending
                  ? 'Đang gửi...'
                  : cooldown > 0
                    ? `Gửi lại sau ${cooldown}s`
                    : 'Gửi lại mã xác minh'}
              </button>
            </div>

            <div className="pt-2 text-center">
              <Link
                to="/login"
                className={`inline-flex items-center gap-2 text-sm font-semibold ${
                  darkMode
                    ? 'text-slate-300 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowLeft className="h-4 w-4" />
                Quay lại đăng nhập
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default VerifyEmail

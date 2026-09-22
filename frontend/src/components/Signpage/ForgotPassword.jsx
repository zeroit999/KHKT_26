import { useEffect, useState } from 'react'
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { authService } from '../../services/auth'
import lightLogo from '../../assets/favicon-light-mode.png'
import darkLogo from '../../assets/favicon-dark-mode.png'

const RESEND_COOLDOWN = 60

function validatePassword(value) {
  if (value.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự.'
  if (!/[0-9]/.test(value)) return 'Mật khẩu phải có ít nhất 1 chữ số.'
  if (!/[A-Z]/.test(value)) return 'Mật khẩu phải có ít nhất 1 chữ cái in hoa.'
  if (!/[^A-Za-z0-9]/.test(value)) return 'Mật khẩu phải có ít nhất 1 ký tự đặc biệt.'
  return ''
}

function ForgotPassword() {
  const navigate = useNavigate()
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'))
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const observer = new MutationObserver(() => setDarkMode(document.documentElement.classList.contains('dark')))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  const clearFeedback = () => {
    setError('')
    setMessage('')
  }

  const requestCode = async (event) => {
    event.preventDefault()
    clearFeedback()
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setError('Vui lòng nhập email của bạn.')
      return
    }

    setLoading(true)
    try {
      const data = await authService.requestPasswordReset(normalizedEmail)
      setEmail(normalizedEmail)
      setStep(2)
      setCooldown(RESEND_COOLDOWN)
      setMessage(data?.message || 'Mã xác minh đã được gửi đến email của bạn.')
    } catch (requestError) {
      setError(requestError?.message || 'Không thể gửi mã xác minh.')
    } finally {
      setLoading(false)
    }
  }

  const verifyCode = async (event) => {
    event.preventDefault()
    clearFeedback()
    if (code.length !== 6) {
      setError('Vui lòng nhập đủ mã xác minh gồm 6 chữ số.')
      return
    }

    setLoading(true)
    try {
      const data = await authService.verifyPasswordResetCode(email, code)
      setResetToken(data.reset_token)
      setStep(3)
      setMessage('Mã hợp lệ. Hãy tạo mật khẩu mới.')
    } catch (requestError) {
      setError(requestError?.message || 'Mã xác minh không hợp lệ hoặc đã hết hạn.')
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (event) => {
    event.preventDefault()
    clearFeedback()
    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }

    setLoading(true)
    try {
      await authService.resetPassword(email, resetToken, password)
      navigate('/login', { replace: true, state: { resetSuccess: true, email } })
    } catch (requestError) {
      setError(requestError?.message || 'Không thể đặt lại mật khẩu.')
    } finally {
      setLoading(false)
    }
  }

  const resendCode = async () => {
    if (loading || cooldown > 0) return
    clearFeedback()
    setLoading(true)
    try {
      const data = await authService.requestPasswordReset(email)
      setCooldown(RESEND_COOLDOWN)
      setMessage(data?.message || 'Mã xác minh mới đã được gửi.')
    } catch (requestError) {
      setError(requestError?.message || 'Không thể gửi lại mã xác minh.')
    } finally {
      setLoading(false)
    }
  }

  const title = step === 1 ? 'Quên mật khẩu?' : step === 2 ? 'Xác minh email' : 'Tạo mật khẩu mới'
  const description = step === 1
    ? 'Nhập email để nhận mã khôi phục tài khoản.'
    : step === 2
      ? `Nhập mã 6 chữ số đã gửi đến ${email}.`
      : 'Mật khẩu mới cần có chữ hoa, chữ số và ký tự đặc biệt.'

  return (
    <div className={`relative flex h-dvh min-h-0 items-center justify-center overflow-y-auto overflow-x-hidden px-4 py-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${darkMode ? 'bg-[#030712]' : 'bg-slate-100'}`}>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-[28rem] w-[28rem] rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:70px_70px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className={`rounded-[2rem] p-6 shadow-[0_25px_80px_rgba(15,23,42,0.15)] backdrop-blur-2xl sm:p-8 ${darkMode ? 'bg-white/10' : 'border border-slate-200 bg-white/85'}`}>
          <header className="mb-7 text-center">
            <div className="mx-auto mb-5 w-fit rounded-2xl bg-white p-2 shadow-lg dark:bg-black">
              <img src={darkMode ? darkLogo : lightLogo} alt="ZUNY" className="h-12 w-12 rounded-xl object-cover" />
            </div>
            <div className="mx-auto mb-4 flex w-fit rounded-2xl bg-cyan-500/10 p-3 text-cyan-500">
              {step === 1 ? <KeyRound className="h-7 w-7" /> : step === 2 ? <ShieldCheck className="h-7 w-7" /> : <Lock className="h-7 w-7" />}
            </div>
            <h1 className={`text-3xl font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>{title}</h1>
            <p className={`mt-3 text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{description}</p>
          </header>

          {step === 1 && (
            <form onSubmit={requestCode} className="space-y-5">
              <label className="block text-sm font-semibold text-cyan-500">Email
                <span className="relative mt-2 block">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Nhập email của bạn" autoComplete="email" required className={`w-full rounded-2xl py-4 pl-12 pr-4 outline-none ${darkMode ? 'bg-white/10 text-white placeholder:text-slate-400' : 'border border-slate-300 bg-slate-50 text-slate-900'}`} />
                </span>
              </label>
              <button type="submit" disabled={loading} className="w-full rounded-2xl bg-cyan-500 px-4 py-4 font-black text-white hover:bg-cyan-600 disabled:opacity-60">{loading ? 'Đang gửi mã...' : 'Gửi mã xác minh'}</button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={verifyCode} className="space-y-5">
              <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); clearFeedback() }} placeholder="000000" aria-label="Mã xác minh" className={`w-full rounded-2xl px-4 py-4 text-center text-2xl font-black tracking-[0.35em] outline-none ${darkMode ? 'bg-white/10 text-white placeholder:text-slate-500' : 'border border-slate-300 bg-slate-50 text-slate-900'}`} />
              <button type="submit" disabled={loading} className="w-full rounded-2xl bg-cyan-500 px-4 py-4 font-black text-white hover:bg-cyan-600 disabled:opacity-60">{loading ? 'Đang xác minh...' : 'Xác minh mã'}</button>
              <button type="button" onClick={resendCode} disabled={loading || cooldown > 0} className="w-full text-sm font-bold text-cyan-500 disabled:text-slate-400">{cooldown > 0 ? `Gửi lại mã sau ${cooldown}s` : 'Gửi lại mã'}</button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={resetPassword} className="space-y-4">
              {[
                ['Mật khẩu mới', password, setPassword, showPassword, setShowPassword],
                ['Nhập lại mật khẩu', confirmPassword, setConfirmPassword, showConfirmPassword, setShowConfirmPassword],
              ].map(([label, value, setter, visible, setVisible]) => (
                <label key={label} className="relative block text-sm font-semibold text-cyan-500">{label}
                  <span className="relative mt-2 block">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
                    <input type={visible ? 'text' : 'password'} value={value} onChange={(event) => setter(event.target.value)} autoComplete="new-password" required className={`w-full rounded-2xl py-4 pl-12 pr-12 outline-none ${darkMode ? 'bg-white/10 text-white' : 'border border-slate-300 bg-slate-50 text-slate-900'}`} />
                    <button type="button" onClick={() => setVisible((current) => !current)} aria-label="Hiện hoặc ẩn mật khẩu" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button>
                  </span>
                </label>
              ))}
              <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Tối thiểu 8 ký tự, gồm chữ hoa, chữ số và ký tự đặc biệt.</p>
              <button type="submit" disabled={loading} className="w-full rounded-2xl bg-cyan-500 px-4 py-4 font-black text-white hover:bg-cyan-600 disabled:opacity-60">{loading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}</button>
            </form>
          )}

          {error && <p role="alert" className="mt-4 rounded-xl bg-rose-500/10 px-3 py-2 text-center text-sm font-semibold text-rose-500">{error}</p>}
          {message && <p role="status" className="mt-4 rounded-xl bg-emerald-500/10 px-3 py-2 text-center text-sm font-semibold text-emerald-500">{message}</p>}
          <Link to="/login" className={`mt-6 flex items-center justify-center gap-2 text-sm font-bold ${darkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}><ArrowLeft size={16} /> Quay lại đăng nhập</Link>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword

import {
  useState,
  useEffect,
} from 'react'

import {
  Link,
  useNavigate,
} from 'react-router-dom'

import {
  signInWithEmailAndPassword,
} from 'firebase/auth'

import { auth } from '../firebase.js'

import {
  useAuth,
} from '../../contexts/AuthContext'

import SignWithGoogle from './signWithGoogle'

import {
  Mail,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react'

import {
  doc,
  getDoc,
} from 'firebase/firestore'

import { db } from '../firebase.js'

import lightLogo from '../../assets/favicon-light-mode.png'
import darkLogo from '../../assets/favicon-dark-mode.png'
import { LOCAL_DEMO_ACCOUNTS } from '../../utils/localAuth.js'

const LOCAL_DEV_MODE = import.meta.env.VITE_LOCAL_DEV_MODE === 'true'
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD || ''

function Login() {
  const [email, setEmail] =
    useState('')

  const [password, setPassword] =
    useState('')

  const [
    showPassword,
    setShowPassword,
  ] = useState(false)

  const [error, setError] =
    useState('')

  const [loading, setLoading] =
    useState(false)

  const navigate = useNavigate()

  const { user, isLoading, loginWithDemoAccount } =
    useAuth()

  // =========================
  // DARK MODE
  // =========================
  const [darkMode, setDarkMode] =
    useState(
      document.documentElement.classList.contains(
        'dark'
      )
    )

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

  // =========================
  // LOGIN
  // =========================
  const handleSubmit =
    async (e) => {
      e.preventDefault()

      setError('')

      setLoading(true)

      try {
        if (LOCAL_DEV_MODE) {
          await loginWithDemoAccount(email, password)
          navigate('/')
          return
        }

        console.log(
          '🔄 Logging in with Firebase...'
        )

        const userCredential =
          await signInWithEmailAndPassword(
            auth,
            email,
            password
          )

        console.log(
          '✅ Firebase login successful:',
          userCredential.user.email
        )

        const userDoc =
          await getDoc(
            doc(
              db,
              'users',
              userCredential.user.uid
            )
          )

        if (
          !userDoc.exists() ||
          !userDoc.data()
            ?.isSetupComplete
        ) {
          navigate('/setup')
        } else {
          navigate('/')
        }
      } catch (error) {
        console.error(
          '❌ Login error:',
          error
        )

        if (
          error.code ===
          'auth/user-not-found'
        ) {
          setError(
            'Không tìm thấy tài khoản với email này'
          )
        } else if (
          error.code ===
          'auth/wrong-password'
        ) {
          setError(
            'Mật khẩu không chính xác'
          )
        } else if (
          error.code ===
          'auth/invalid-email'
        ) {
          setError(
            'Email không hợp lệ'
          )
        } else if (
          error.code ===
          'auth/invalid-credential'
        ) {
          setError(
            'Thông tin đăng nhập không chính xác'
          )
        } else {
          setError(
            'Đăng nhập thất bại. Vui lòng thử lại.'
          )
        }

        setTimeout(
          () => setError(''),
          5000
        )
      } finally {
        setLoading(false)
      }
    }

  // =========================
  // REDIRECT
  // =========================
  useEffect(() => {
    if (!isLoading && user) {
      console.log(
        '✅ User already logged in, redirecting...'
      )

      navigate('/')
    }
  }, [user, isLoading, navigate])

  return (
    <div
      className={`relative flex min-h-screen items-center justify-center overflow-hidden px-4 transition-colors duration-300 ${
        darkMode
          ? 'bg-[#030712]'
          : 'bg-slate-100'
      }`}
    >
      {/* ========================= */}
      {/* BACKGROUND */}
      {/* ========================= */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-96 w-96 animate-pulse rounded-full bg-cyan-500/20 blur-3xl" />

        <div className="absolute right-0 top-1/3 h-[28rem] w-[28rem] animate-pulse rounded-full bg-fuchsia-500/10 blur-3xl" />

        <div className="absolute bottom-0 left-1/3 h-80 w-80 animate-pulse rounded-full bg-blue-500/10 blur-3xl" />

        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:70px_70px]" />
      </div>

      {/* ========================= */}
      {/* CARD */}
      {/* ========================= */}
      <div className="relative z-10 w-full max-w-md">
        <div
          className={`rounded-[2rem] p-8 backdrop-blur-2xl transition-colors duration-300 ${
            darkMode
              ? 'bg-white/10 shadow-[0_25px_80px_rgba(0,0,0,0.45)]'
              : 'border border-slate-200 bg-white/80 shadow-[0_25px_80px_rgba(15,23,42,0.15)]'
          }`}
        >
          {/* ========================= */}
          {/* HEADER */}
          {/* ========================= */}
          <div className="mb-8 text-center">
            <div className="mb-6 flex items-center justify-center">
              <div className="relative flex items-center justify-center">
                {/* CYAN GLOW */}
                <div className="absolute h-32 w-32 rounded-[2rem] bg-cyan-500/20 blur-3xl" />

                {/* PURPLE GLOW */}
                <div className="absolute h-28 w-28 rounded-[2rem] bg-fuchsia-500/20 blur-3xl" />

                {/* LOGO BOX */}
                <div
                  className={`
                    relative
                    rounded-[2rem]
                    p-3
                    backdrop-blur-xl
                    transition-all
                    duration-300
                    ${
                      darkMode
                        ? `
                          bg-black
                          border border-white/5
                          shadow-[0_0_45px_rgba(59,130,246,0.35)]
                        `
                        : `
                          bg-white
                          border border-slate-200
                          shadow-[0_20px_50px_rgba(15,23,42,0.15)]
                        `
                    }
                  `}
                >
                  <img
                    src={
                      darkMode
                        ? darkLogo
                        : lightLogo
                    }
                    alt="EduSprint"
                    className="h-14 w-14 rounded-xl object-cover"
                  />
                </div>
              </div>
            </div>

            <h1
              className={`text-4xl font-black ${
                darkMode
                  ? 'text-white'
                  : 'text-slate-900'
              }`}
            >
              Chào mừng trở lại
            </h1>

            <p
              className={`mt-3 ${
                darkMode
                  ? 'text-slate-300'
                  : 'text-slate-600'
              }`}
            >
              Đăng nhập để tiếp tục học tập.
            </p>
          </div>

          {/* ========================= */}
          {/* FORM */}
          {/* ========================= */}
          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            {LOCAL_DEV_MODE && (
              <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-sm">
                <p className={`font-bold ${darkMode ? 'text-cyan-200' : 'text-cyan-800'}`}>
                  Tài khoản demo local
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {LOCAL_DEMO_ACCOUNTS.map((account) => (
                    <button
                      key={account.uid}
                      type="button"
                      onClick={() => {
                        setEmail(account.email)
                        setPassword(DEMO_PASSWORD)
                      }}
                      className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                        darkMode
                          ? 'border-cyan-300/20 text-cyan-100 hover:bg-cyan-400/10'
                          : 'border-cyan-200 text-cyan-800 hover:bg-cyan-100'
                      }`}
                    >
                      {account.role === 'TEACHER' ? 'Giáo viên' : 'Học sinh'}
                    </button>
                  ))}
                </div>
                <p className={`mt-3 text-xs ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Mật khẩu chung: <code>{DEMO_PASSWORD}</code>
                </p>
              </div>
            )}

            {/* EMAIL */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-cyan-400">
                Email
              </label>

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-400" />

                <input
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(
                      e.target.value
                    )
                  }
                  placeholder="Nhập email của bạn"
                  className={`w-full rounded-2xl py-4 pl-12 pr-4 outline-none backdrop-blur-xl transition ${
                    darkMode
                      ? 'bg-white/10 text-white placeholder:text-slate-400'
                      : 'border border-slate-300 bg-slate-50 text-slate-900'
                  }`}
                  required
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-semibold text-cyan-400">
                  Mật khẩu
                </label>

                <Link
                  to="/forgotpass"
                  className="text-sm text-cyan-400 hover:text-cyan-300"
                >
                  Quên mật khẩu?
                </Link>
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-400" />

                <input
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  value={password}
                  onChange={(e) =>
                    setPassword(
                      e.target.value
                    )
                  }
                  placeholder="Nhập mật khẩu"
                  className={`w-full rounded-2xl py-4 pl-12 pr-14 outline-none backdrop-blur-xl transition ${
                    darkMode
                      ? 'bg-white/10 text-white placeholder:text-slate-400'
                      : 'border border-slate-300 bg-slate-50 text-slate-900'
                  }`}
                  required
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan-400"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* ERROR */}
            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 backdrop-blur-xl">
                {error}
              </div>
            )}

            {/* BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-600 py-4 text-lg font-bold text-white shadow-[0_10px_40px_rgba(14,165,233,0.35)] transition hover:scale-[1.02]"
            >
              {loading
                ? 'Đang đăng nhập...'
                : 'Đăng nhập'}
            </button>

            {/* DIVIDER */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div
                  className={`w-full ${
                    darkMode
                      ? 'border-t border-white/10'
                      : 'border-t border-slate-300'
                  }`}
                />
              </div>

              <div className="relative flex justify-center text-sm">
                <span
                  className={`px-3 ${
                    darkMode
                      ? 'bg-[#030712] text-slate-400'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  hoặc tiếp tục với
                </span>
              </div>
            </div>

            {!LOCAL_DEV_MODE && <SignWithGoogle />}

            <p
              className={`text-center ${
                darkMode
                  ? 'text-slate-300'
                  : 'text-slate-600'
              }`}
            >
              Chưa có tài khoản?{' '}
              <Link
                to="/register"
                className="font-semibold text-cyan-400 hover:text-cyan-300"
              >
                Đăng ký ngay
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login

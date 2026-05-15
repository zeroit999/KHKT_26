import React, {
  useState,
  useEffect,
} from 'react'

import {
  Link,
  useNavigate,
} from 'react-router-dom'

import {
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'

import {
  auth,
  db,
} from '../firebase.js'

import {
  doc,
  setDoc,
} from 'firebase/firestore'

import SignWithGoogle from './signWithGoogle'

import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  User,
} from 'lucide-react'

import lightLogo from '../../assets/favicon-light-mode.png'
import darkLogo from '../../assets/favicon-dark-mode.png'

function Register() {
  const [fullName, setFullName] =
    useState('')

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
  // REGISTER
  // =========================
  const handleSubmit =
    async (e) => {
      e.preventDefault()

      setError('')

      setLoading(true)

      try {
        console.log(
          '🔄 Creating account...'
        )

        const userCredential =
          await createUserWithEmailAndPassword(
            auth,
            email,
            password
          )

        await updateProfile(
          userCredential.user,
          {
            displayName:
              fullName,
          }
        )

        await setDoc(
          doc(
            db,
            'users',
            userCredential.user.uid
          ),
          {
            uid: userCredential.user.uid,

            fullName,

            email,

            photoURL: '',

            role: '',

            points: 0,

            learningStreak: 0,

            school: '',

            className: '',

            subject: '',

            phone: '',

            city: '',

            address: '',

            facebook: '',

            isSetupComplete:
              false,

            createdAt:
              new Date().toISOString(),
          }
        )

        console.log(
          '✅ Register success'
        )

        navigate('/setup')
      } catch (error) {
        console.error(
          '❌ Register error:',
          error
        )

        if (
          error.code ===
          'auth/email-already-in-use'
        ) {
          setError(
            'Email đã được sử dụng'
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
          'auth/weak-password'
        ) {
          setError(
            'Mật khẩu phải có ít nhất 6 ký tự'
          )
        } else {
          setError(
            'Đăng ký thất bại. Vui lòng thử lại.'
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
              Tạo tài khoản
            </h1>

            <p
              className={`mt-3 ${
                darkMode
                  ? 'text-slate-300'
                  : 'text-slate-600'
              }`}
            >
              Đăng ký để bắt đầu học tập.
            </p>
          </div>

          {/* ========================= */}
          {/* FORM */}
          {/* ========================= */}
          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            {/* FULLNAME */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-cyan-400">
                Họ và tên
              </label>

              <div className="relative">
                <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-400" />

                <input
                  type="text"
                  value={fullName}
                  onChange={(e) =>
                    setFullName(
                      e.target.value
                    )
                  }
                  placeholder="Nhập họ và tên"
                  className={`w-full rounded-2xl py-4 pl-12 pr-4 outline-none backdrop-blur-xl transition ${
                    darkMode
                      ? 'bg-white/10 text-white placeholder:text-slate-400'
                      : 'border border-slate-300 bg-slate-50 text-slate-900'
                  }`}
                  required
                />
              </div>
            </div>

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
              <label className="mb-2 block text-sm font-semibold text-cyan-400">
                Mật khẩu
              </label>

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
                ? 'Đang đăng ký...'
                : 'Đăng ký'}
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

            <SignWithGoogle />

            <p
              className={`text-center ${
                darkMode
                  ? 'text-slate-300'
                  : 'text-slate-600'
              }`}
            >
              Đã có tài khoản?{' '}
              <Link
                to="/login"
                className="font-semibold text-cyan-400 hover:text-cyan-300"
              >
                Đăng nhập
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Register
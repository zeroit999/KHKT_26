import { useEffect, useMemo, useState } from 'react'

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'

import {
  AnimatePresence,
  motion,
} from 'framer-motion'

import { Toaster } from 'react-hot-toast'

import AppLayout from './components/layout/AppLayout.jsx'

import Home from './pages/Home.jsx'
import Exams from './pages/exam/Exams.jsx'
import ExamRoom from './pages/exam/ExamRoom.jsx'
import ResultPage from './pages/exam/ResultPage.jsx'
import Dashboard from './pages/dashboard/Dashboard.jsx'
import Leaderboard from './pages/dashboard/Leaderboard.jsx'
import Courses from './pages/course//Courses.jsx'
import CourseDetail from './pages/course/CourseDetail.jsx'
import LearningPage from './pages/learning/LearningPage.jsx'
import AdminDashboard from './pages/dashboard/AdminDashboard.jsx'
import Classes from './pages/learning/Classes.jsx'
import Setup from './pages/auth/Setup.jsx'
import NotFound from './pages/NotFound.jsx'

import Login from './components/Signpage/login.jsx'
import Register from './components/Signpage/register.jsx'
import Profile from './components/Signpage/profile.jsx'

import {
  AuthProvider,
  useAuth,
} from './contexts/AuthContext.jsx'

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }, [pathname])

  return null
}

function LoadingScreen() {
  const isDark =
    document.documentElement.classList.contains('dark')

  return (
    <div
      className={`flex min-h-screen items-center justify-center transition-colors duration-300 ${
        isDark
          ? 'bg-[#020817] text-white'
          : 'bg-slate-100 text-slate-900'
      }`}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className={`h-10 w-10 animate-spin rounded-full border-4 border-t-transparent ${
            isDark
              ? 'border-cyan-400'
              : 'border-blue-600'
          }`}
        />

        <p className="text-lg font-semibold">
          Đang tải...
        </p>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

// =========================
// TEACHER ROUTE
// =========================
function TeacherRoute({ children }) {
  const {
    user,
    userDetails,
    isLoading,
  } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const allowed =
    userDetails?.role === 'TEACHER' ||
    userDetails?.role === 'ADMIN_DEV'

  if (!allowed) {
    return <Navigate to="/" replace />
  }

  return children
}

// =========================
// ADMIN DEV ROUTE
// =========================
function AdminDevRoute({ children }) {
  const {
    user,
    userDetails,
    isLoading,
  } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (
    userDetails?.role !==
    'ADMIN_DEV'
  ) {
    return <Navigate to="/" replace />
  }

  return children
}

function SetupRoute() {
  const {
    user,
    userDetails,
    isLoading,
  } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Đã onboarding xong
  if (
    userDetails?.isSetupComplete === true
  ) {
    return <Navigate to="/" replace />
  }

  return <Setup />
}

function ProfileRoute() {
  const {
    user,
    userDetails,
    isLoading,
  } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (
    userDetails &&
    userDetails.isSetupComplete === false
  ) {
    return <Navigate to="/setup" replace />
  }

  return <Profile />
}

function AppContent({
  darkMode,
  onToggleDarkMode,
}) {
  const location = useLocation()

  const {
    user,
    userDetails,
    isLoading,
  } = useAuth()

  console.log(userDetails)
  console.log(userDetails?.role)

  if (isLoading) {
    return <LoadingScreen />
  }

  // Chưa onboarding xong
  // => ép về setup
  if (
    user &&
    userDetails &&
    userDetails.isSetupComplete === false &&
    location.pathname !== '/setup'
  ) {
    return <Navigate to="/setup" replace />
  }

  // Setup page
  // => KHÔNG hiện Navbar/Footer
  if (location.pathname === '/setup') {
    return (
      <>
        <ScrollToTop />

        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{
              duration: 0.28,
              ease: 'easeOut',
            }}
          >
            <Routes location={location}>
              <Route
                path="/setup"
                element={
                  <ProtectedRoute>
                    <SetupRoute />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </>
    )
  }

  // App bình thường
  return (
    <>
      <ScrollToTop />

      <AppLayout
        darkMode={darkMode}
        onToggleDarkMode={onToggleDarkMode}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{
              duration: 0.28,
              ease: 'easeOut',
            }}
          >
            <Routes location={location}>
              {/* ========================= */}
              {/* PUBLIC ROUTES */}
              {/* ========================= */}
              <Route
                path="/"
                element={<Home />}
              />

              <Route
                path="/home"
                element={
                  <Navigate
                    to="/"
                    replace
                  />
                }
              />

              <Route
                path="/login"
                element={<Login />}
              />

              <Route
                path="/register"
                element={<Register />}
              />

              {/* ========================= */}
              {/* SETUP */}
              {/* ========================= */}
              <Route
                path="/setup"
                element={
                  <ProtectedRoute>
                    <SetupRoute />
                  </ProtectedRoute>
                }
              />

              {/* ========================= */}
              {/* PROFILE */}
              {/* ========================= */}
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfileRoute />
                  </ProtectedRoute>
                }
              />

              {/* ========================= */}
              {/* DASHBOARD */}
              {/* ========================= */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              {/* ========================= */}
              {/* LEADERBOARD */}
              {/* ========================= */}
              <Route
                path="/leaderboard"
                element={
                  <ProtectedRoute>
                    <Leaderboard />
                  </ProtectedRoute>
                }
              />

              {/* ========================= */}
              {/* COURSES */}
              {/* ========================= */}
              <Route
                path="/courses"
                element={
                  <ProtectedRoute>
                    <Courses />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/courses/:id"
                element={
                  <ProtectedRoute>
                    <CourseDetail />
                  </ProtectedRoute>
                }
              />

              {/* ========================= */}
              {/* LEARNING */}
              {/* ========================= */}
              <Route
                path="/learn/:id"
                element={
                  <ProtectedRoute>
                    <LearningPage />
                  </ProtectedRoute>
                }
              />

              {/* ========================= */}
              {/* EXAMS */}
              {/* ========================= */}
              <Route
                path="/exams"
                element={
                  <ProtectedRoute>
                    <Exams />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/exam/:id"
                element={
                  <ProtectedRoute>
                    <ExamRoom />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/exam/:id/result"
                element={
                  <ProtectedRoute>
                    <ResultPage />
                  </ProtectedRoute>
                }
              />

              {/* ========================= */}
              {/* TEACHER ROUTE */}
              {/* ========================= */}
              <Route
                path="/classes"
                element={
                  <TeacherRoute>
                    <Classes />
                  </TeacherRoute>
                }
              />

              {/* ========================= */}
              {/* ADMIN DEV ROUTE */}
              {/* ========================= */}
              <Route
                path="/admin"
                element={
                  <AdminDevRoute>
                    <AdminDashboard />
                  </AdminDevRoute>
                }
              />

              {/* ========================= */}
              {/* 404 */}
              {/* ========================= */}
              <Route
                path="*"
                element={<NotFound />}
              />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </AppLayout>
    </>
  )
}

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true'
  })

  useEffect(() => {
    localStorage.setItem('darkMode', String(darkMode))

    document.documentElement.classList.toggle(
      'dark',
      darkMode
    )

    const favicon =
      document.getElementById('favicon')

    if (favicon) {
      favicon.setAttribute(
        'href',
        darkMode
          ? '/dark-mode.png'
          : '/light-mode.png'
      )
    }
  }, [darkMode])

  const toastOptions = useMemo(
    () => ({
      duration: 2600,

      style: {
        border:
          '1px solid rgba(34, 211, 238, 0.28)',

        background: darkMode
          ? 'rgba(6, 12, 30, 0.92)'
          : 'rgba(255, 255, 255, 0.95)',

        color: darkMode
          ? '#e5faff'
          : '#0f172a',

        boxShadow:
          '0 12px 32px rgba(15, 23, 42, 0.18)',

        backdropFilter: 'blur(18px)',
      },

      success: {
        iconTheme: {
          primary: '#22d3ee',
          secondary: '#ecfeff',
        },
      },

      error: {
        iconTheme: {
          primary: '#f87171',
          secondary: '#fff1f2',
        },
      },
    }),
    [darkMode]
  )

  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent
          darkMode={darkMode}
          onToggleDarkMode={() =>
            setDarkMode((prev) => !prev)
          }
        />

        <Toaster
          position="top-right"
          toastOptions={toastOptions}
        />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
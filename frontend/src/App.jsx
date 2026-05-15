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

function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020817] text-white">
        Loading...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020817] text-white">
        Loading...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (
    userDetails &&
    userDetails.isSetupComplete
  ) {
    return <Navigate to="/profile" replace />
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020817] text-white">
        Loading...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (
    userDetails &&
    !userDetails.isSetupComplete
  ) {
    return <Navigate to="/setup" replace />
  }

  return <Profile />
}

function AnimatedRoutes({
  darkMode,
  onToggleDarkMode,
}) {
  const location = useLocation()

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

              <Route
                path="/setup"
                element={
                  <ProtectedRoute>
                    <SetupRoute />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfileRoute />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/dashboard"
                element={<Dashboard />}
              />

              <Route
                path="/leaderboard"
                element={<Leaderboard />}
              />

              <Route
                path="/courses"
                element={<Courses />}
              />

              <Route
                path="/courses/:id"
                element={<CourseDetail />}
              />

              <Route
                path="/learn/:id"
                element={<LearningPage />}
              />

              <Route
                path="/exams"
                element={<Exams />}
              />

              <Route
                path="/exam/:id"
                element={<ExamRoom />}
              />

              <Route
                path="/exam/:id/result"
                element={<ResultPage />}
              />

              <Route
                path="/classes"
                element={<Classes />}
              />

              <Route
                path="/admin"
                element={<AdminDashboard />}
              />

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
          '0 18px 50px rgba(8, 47, 73, 0.24)',
      },
    }),
    [darkMode]
  )

  return (
    <AuthProvider>
      <BrowserRouter>
        <AnimatedRoutes
          darkMode={darkMode}
          onToggleDarkMode={() =>
            setDarkMode((value) => !value)
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
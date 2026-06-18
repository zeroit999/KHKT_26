import { useEffect, useLayoutEffect, useMemo, useState } from 'react'

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom'

import { AnimatePresence, motion } from 'framer-motion'
import { Toaster } from 'react-hot-toast'

import AppLayout from './components/layout/AppLayout.jsx'
import LoadingSkeleton from './components/ui/LoadingSkeleton.jsx'
import ChatbotWidget from './components/ChatbotAI/ChatbotWidget.jsx'

import Home from './pages/Home.jsx'
import Exams from './pages/exam/Exams.jsx'
import ExamRoom from './pages/exam/ExamRoom.jsx'
import ResultPage from './pages/exam/ResultPage.jsx'
import Forum from './pages/forum/Forum.jsx'
import Leaderboard from './pages/leaderboard/Leaderboard.jsx'
import ELearning from './pages/e-learning/E-learning.jsx'
import ELearningDetail from './pages/e-learning/E-learningDetail.jsx'
import LearningPage from './pages/learning/LearningPage.jsx'
import Classes from './pages/learning/Classes.jsx'
import Setup from './pages/auth/Setup.jsx'
import NotFound from './pages/NotFound.jsx'
import Setting from './pages/setting/Setting.jsx'

import Login from './components/Signpage/login.jsx'
import Register from './components/Signpage/register.jsx'
import Profile from './components/Signpage/profile.jsx'

import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'

function getInitialDarkMode() {
  if (typeof window === 'undefined') return false

  const savedDarkMode = window.localStorage.getItem('darkMode')
  const savedTheme =
    window.localStorage.getItem('theme') ||
    window.localStorage.getItem('color-theme')

  if (savedDarkMode === 'true' || savedTheme === 'dark') return true
  if (savedDarkMode === 'false' || savedTheme === 'light') return false

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function applyDarkModeToDocument(isDark) {
  if (typeof document === 'undefined') return

  document.documentElement.classList.toggle('dark', isDark)
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'

  const favicon = document.getElementById('favicon')
  if (favicon) {
    favicon.setAttribute('href', isDark ? '/dark-mode.png' : '/light-mode.png')
  }
}

function normalizeAppRole(role) {
  return String(role || '').trim().replace(/[\s_-]/g, '').toUpperCase()
}

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
  return <LoadingSkeleton />
}

function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />

  return children
}

function TeacherRoute({ children }) {
  const { user, userDetails, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />

  const normalizedRole = normalizeAppRole(userDetails?.role)
  const allowed = normalizedRole === 'TEACHER' || normalizedRole === 'ADMINDEV'

  if (!allowed) return <Navigate to="/" replace />

  return children
}

function AdminDevRoute({ children }) {
  const { user, userDetails, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />

  const allowed = normalizeAppRole(userDetails?.role) === 'ADMINDEV'

  if (!allowed) return <Navigate to="/" replace />

  return children
}

function SetupRoute() {
  const { user, userDetails, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />

  if (userDetails?.isSetupComplete === true) {
    return <Navigate to="/" replace />
  }

  return <Setup />
}

function ProfileRoute() {
  const { user, userDetails, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />

  if (userDetails && userDetails.isSetupComplete === false) {
    return <Navigate to="/setup" replace />
  }

  return <Profile />
}

function LegacyCourseDetailRedirect() {
  const { id } = useParams()
  return <Navigate to={`/e-learning/${id}`} replace />
}

function AppContent({ darkMode, onToggleDarkMode }) {
  const location = useLocation()
  const { user, userDetails, isLoading } = useAuth()

  const isExamRoomRoute =
    location.pathname.startsWith('/exam/') &&
    !location.pathname.endsWith('/result')

  if (isLoading) return <LoadingScreen />

  if (
    user &&
    userDetails &&
    userDetails.isSetupComplete === false &&
    location.pathname !== '/setup'
  ) {
    return <Navigate to="/setup" replace />
  }

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
            transition={{ duration: 0.28, ease: 'easeOut' }}
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

  if (isExamRoomRoute) {
    return (
      <>
        <ScrollToTop />

        <Routes location={location}>
          <Route
            path="/exam/:id"
            element={
              <ProtectedRoute>
                <ExamRoom />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/exams" replace />} />
        </Routes>
      </>
    )
  }

  return (
    <>
      <ScrollToTop />

      <AppLayout darkMode={darkMode} onToggleDarkMode={onToggleDarkMode}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/home" element={<Navigate to="/" replace />} />

              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

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
                path="/Forum"
                element={
                  <ProtectedRoute>
                    <Forum />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/leaderboard"
                element={
                  <ProtectedRoute>
                    <Leaderboard />
                  </ProtectedRoute>
                }
              />

              <Route path="/courses" element={<Navigate to="/e-learning" replace />} />
              <Route path="/courses/:id" element={<LegacyCourseDetailRedirect />} />

              <Route
                path="/e-learning"
                element={
                  <ProtectedRoute>
                    <ELearning />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/e-learning/:id"
                element={
                  <ProtectedRoute>
                    <ELearningDetail />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/learn/:id"
                element={
                  <ProtectedRoute>
                    <LearningPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/exams"
                element={
                  <ProtectedRoute>
                    <Exams />
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

              <Route
                path="/classes"
                element={
                  <TeacherRoute>
                    <Classes />
                  </TeacherRoute>
                }
              />

              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Setting
                      darkMode={darkMode}
                      onToggleDarkMode={onToggleDarkMode}
                    />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </AppLayout>
    </>
  )
}

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const initialDarkMode = getInitialDarkMode()
    applyDarkModeToDocument(initialDarkMode)
    return initialDarkMode
  })

  useLayoutEffect(() => {
    applyDarkModeToDocument(darkMode)
  }, [darkMode])

  useEffect(() => {
    localStorage.setItem('darkMode', String(darkMode))
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const toastOptions = useMemo(
    () => ({
      duration: 2600,

      style: {
        border: '1px solid rgba(34, 211, 238, 0.28)',
        background: darkMode
          ? 'rgba(6, 12, 30, 0.92)'
          : 'rgba(255, 255, 255, 0.95)',
        color: darkMode ? '#e5faff' : '#0f172a',
        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18)',
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
    [darkMode],
  )

  const [showInitialLoading, setShowInitialLoading] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowInitialLoading(false)
    }, 2500)

    return () => window.clearTimeout(timer)
  }, [])

  if (showInitialLoading) {
    return <LoadingSkeleton />
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((prev) => !prev)}
        />

        <ChatbotWidget />

        <Toaster position="top-right" toastOptions={toastOptions} />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
import {
  BookOpenCheck,
  ChevronDown,
  ClipboardList,
  GraduationCap,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  Trophy,
  User,
  Users,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

import darkLogo from '../../assets/favicon-dark-mode.png'
import lightLogo from '../../assets/favicon-light-mode.png'

const normalizeRole = (role) =>
  String(role || '')
    .trim()
    .replace(/[\s_-]/g, '')
    .toUpperCase()

export default function MobileNavbar({
  darkMode,
  onToggleDarkMode,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, userDetails, logout } = useAuth()

  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  const navbarRef = useRef(null)
  const accountRef = useRef(null)

  const role = normalizeRole(userDetails?.role)

  const displayName =
    userDetails?.fullName ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'Tài khoản'

  const classItem = useMemo(() => {
    const teacherRoles = ['TEACHER', 'ADMINUSER', 'ADMINDEV']
    const studentRoles = ['STUDENT', 'STUDENR', 'USER']

    if (teacherRoles.includes(role)) {
      return {
        label: 'Quản lý lớp học',
        shortLabel: 'Quản lý lớp học',
        path: '/classes',
        icon: LayoutDashboard,
      }
    }

    if (studentRoles.includes(role)) {
      return {
        label: 'Lớp học',
        shortLabel: 'Lớp học',
        path: '/LearningPage',
        icon: GraduationCap,
      }
    }

    return null
  }, [role])

  const navItems = useMemo(
    () => [
      {
        label: 'Trang chủ',
        shortLabel: 'Trang chủ',
        path: '/',
        icon: Home,
      },
      {
        label: 'Đề thi',
        shortLabel: 'Đề thi',
        path: '/exams',
        icon: ClipboardList,
      },
      {
        label: 'E-learning',
        shortLabel: 'E-learning',
        path: '/e-learning',
        icon: BookOpenCheck,
      },
      {
        label: 'Cộng đồng',
        shortLabel: 'Cộng đồng',
        path: '/forum',
        icon: Users,
      },
      ...(classItem ? [classItem] : []),
    ],
    [classItem]
  )

  const currentItem =
    navItems.find((item) =>
      item.path === '/'
        ? location.pathname === '/'
        : location.pathname
            .toLowerCase()
            .startsWith(item.path.toLowerCase())
    ) || {
      label:
        location.pathname === '/profile'
          ? 'Trang cá nhân'
          : location.pathname === '/settings'
            ? 'Cài đặt'
            : 'ZUNY',
      shortLabel:
        location.pathname === '/profile'
          ? 'Trang cá nhân'
          : location.pathname === '/settings'
            ? 'Cài đặt'
            : 'ZUNY',
      icon:
        location.pathname === '/profile'
          ? User
          : location.pathname === '/settings'
            ? Settings
            : Home,
    }

  const CurrentIcon = currentItem.icon

  const isItemActive = (path) => {
    if (path === '/') {
      return location.pathname === '/'
    }

    return location.pathname
      .toLowerCase()
      .startsWith(path.toLowerCase())
  }

  useEffect(() => {
    setMenuOpen(false)
    setAccountOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const handleOutsideClick = (event) => {
      const clickedNavbar =
        navbarRef.current &&
        navbarRef.current.contains(event.target)

      const clickedAccount =
        accountRef.current &&
        accountRef.current.contains(event.target)

      if (!clickedNavbar && !clickedAccount) {
        setMenuOpen(false)
        setAccountOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick)

    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideClick
      )
      document.removeEventListener(
        'touchstart',
        handleOutsideClick
      )
    }
  }, [])

  useEffect(() => {
    if (!menuOpen && !accountOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [menuOpen, accountOpen])

  const toggleMenu = () => {
    setMenuOpen((value) => !value)
    setAccountOpen(false)
  }

  const toggleAccount = () => {
    setAccountOpen((value) => !value)
    setMenuOpen(false)
  }

  const closeAllMenus = () => {
    setMenuOpen(false)
    setAccountOpen(false)
  }

  const handleLogout = async () => {
    try {
      await logout()
      closeAllMenus()
      navigate('/login')
    } catch (error) {
      console.error('Không thể đăng xuất:', error)
    }
  }

  return (
    <>
      <AnimatePresence>
        {(menuOpen || accountOpen) && (
          <motion.button
            type="button"
            aria-label="Đóng menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeAllMenus}
            className="fixed inset-0 z-[90] bg-black/35 backdrop-blur-[2px]"
          />
        )}
      </AnimatePresence>

      <div
        ref={navbarRef}
        className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex justify-center px-3"
      >
        <motion.header
          layout
          initial={false}
          transition={{
            type: 'spring',
            stiffness: 420,
            damping: 34,
            mass: 0.75,
          }}
          className={`pointer-events-auto w-full max-w-[460px] overflow-hidden rounded-[28px] border backdrop-blur-3xl ${
            darkMode
              ? 'border-violet-400/25 bg-[#090912]/95 shadow-[0_18px_55px_rgba(124,58,237,0.28)]'
              : 'border-slate-200/90 bg-white/95 shadow-[0_18px_50px_rgba(15,23,42,0.16)]'
          }`}
        >
          <div className="flex h-16 min-w-0 items-center gap-1.5 px-2">
            <Link
              to="/"
              aria-label="ZUNY - Trang chủ"
              onClick={closeAllMenus}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors ${
                darkMode
                  ? 'hover:bg-white/8'
                  : 'hover:bg-slate-100'
              }`}
            >
              <span className="rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 p-[2px] shadow-[0_0_14px_rgba(99,102,241,0.5)]">
                <img
                  src={darkMode ? darkLogo : lightLogo}
                  alt="ZUNY"
                  className="h-9 w-9 rounded-full object-cover"
                />
              </span>
            </Link>

            <button
              type="button"
              onClick={toggleMenu}
              aria-expanded={menuOpen}
              aria-label={
                menuOpen
                  ? 'Đóng menu điều hướng'
                  : 'Mở menu điều hướng'
              }
              className={`flex min-w-0 flex-1 items-center gap-2 rounded-full px-2.5 py-2.5 text-left transition-colors ${
                darkMode
                  ? 'hover:bg-white/7'
                  : 'hover:bg-slate-100'
              }`}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 shadow-[0_0_11px_rgba(124,58,237,0.95)]" />

              <CurrentIcon
                size={18}
                strokeWidth={2.2}
                className={`shrink-0 ${
                  darkMode
                    ? 'text-violet-300'
                    : 'text-violet-600'
                }`}
              />

              <span
                className={`min-w-0 flex-1 truncate text-sm font-bold ${
                  darkMode
                    ? 'text-violet-100'
                    : 'text-slate-800'
                }`}
              >
                {currentItem.shortLabel}
              </span>

              <ChevronDown
                size={17}
                className={`shrink-0 transition-transform duration-200 ${
                  menuOpen ? 'rotate-180' : ''
                } ${
                  darkMode
                    ? 'text-white/50'
                    : 'text-slate-500'
                }`}
              />
            </button>

            <button
              type="button"
              onClick={toggleMenu}
              aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${
                darkMode
                  ? 'border-violet-400/25 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20'
                  : 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100'
              }`}
            >
              {menuOpen ? (
                <X size={20} />
              ) : (
                <Menu size={20} />
              )}
            </button>

            {user ? (
              <button
                type="button"
                onClick={toggleAccount}
                aria-label="Mở menu tài khoản"
                aria-expanded={accountOpen}
                className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border transition ${
                  accountOpen
                    ? darkMode
                      ? 'border-violet-300 ring-2 ring-violet-400/30'
                      : 'border-violet-500 ring-2 ring-violet-300/40'
                    : darkMode
                      ? 'border-violet-400/30'
                      : 'border-violet-200'
                }`}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={displayName}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-400 to-violet-600 text-sm font-bold text-white">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </button>
            ) : (
              <Link
                to="/login"
                aria-label="Đăng nhập"
                onClick={closeAllMenus}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  darkMode
                    ? 'border-violet-400/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20'
                    : 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100'
                }`}
              >
                <LogIn size={19} />
              </Link>
            )}
          </div>

          <AnimatePresence initial={false}>
            {menuOpen && (
              <motion.div
                key="mobile-navigation"
                initial={{
                  height: 0,
                  opacity: 0,
                }}
                animate={{
                  height: 'auto',
                  opacity: 1,
                }}
                exit={{
                  height: 0,
                  opacity: 0,
                }}
                transition={{
                  height: {
                    duration: 0.22,
                  },
                  opacity: {
                    duration: 0.16,
                  },
                }}
                className="overflow-hidden"
              >
                <div
                  className={`mx-2 border-t pb-2 pt-2 ${
                    darkMode
                      ? 'border-white/10'
                      : 'border-slate-200'
                  }`}
                >
                  <nav className="grid grid-cols-2 gap-1.5">
                    {navItems.map((item) => {
                      const Icon = item.icon
                      const active = isItemActive(item.path)

                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          title={item.label}
                          aria-label={item.label}
                          onClick={closeAllMenus}
                          className={`relative flex min-w-0 items-center gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors ${
                            active
                              ? darkMode
                                ? 'border-violet-400/25 bg-violet-500/20 text-violet-200'
                                : 'border-violet-200 bg-violet-100 text-violet-700'
                              : darkMode
                                ? 'border-transparent text-white/65 hover:border-white/8 hover:bg-white/7 hover:text-white'
                                : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          <Icon
                            size={18}
                            strokeWidth={2.1}
                            className="shrink-0"
                          />

                          <span className="min-w-0 truncate">
                            {item.shortLabel}
                          </span>

                          {active && (
                            <motion.span
                              layoutId="mobile-navbar-active-dot"
                              className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.95)]"
                            />
                          )}
                        </Link>
                      )
                    })}
                  </nav>

                  <div
                    className={`mt-2 flex items-center justify-between gap-2 border-t pt-2 ${
                      darkMode
                        ? 'border-white/10'
                        : 'border-slate-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={onToggleDarkMode}
                      className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                        darkMode
                          ? 'text-amber-300 hover:bg-white/8'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {darkMode ? (
                        <Sun size={18} className="shrink-0" />
                      ) : (
                        <Moon size={18} className="shrink-0" />
                      )}

                      <span className="truncate">
                        {darkMode ? 'Giao diện sáng' : 'Giao diện tối'}
                      </span>
                    </button>

                    {user ? (
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10"
                      >
                        <LogOut size={18} className="shrink-0" />
                        <span className="truncate">Đăng xuất</span>
                      </button>
                    ) : (
                      <Link
                        to="/login"
                        onClick={closeAllMenus}
                        className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                          darkMode
                            ? 'text-violet-200 hover:bg-violet-500/12'
                            : 'text-violet-700 hover:bg-violet-100'
                        }`}
                      >
                        <LogIn size={18} className="shrink-0" />
                        <span className="truncate">Đăng nhập</span>
                      </Link>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.header>
      </div>

      <AnimatePresence>
        {accountOpen && user && (
          <motion.div
            ref={accountRef}
            initial={{
              opacity: 0,
              y: -10,
              scale: 0.97,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: -10,
              scale: 0.97,
            }}
            transition={{
              duration: 0.18,
            }}
            className={`fixed left-3 right-3 top-[84px] z-[110] mx-auto w-auto max-w-[460px] overflow-hidden rounded-[26px] border p-2 shadow-2xl backdrop-blur-3xl ${
              darkMode
                ? 'border-white/10 bg-[#0b0b16]/97'
                : 'border-slate-200 bg-white/97'
            }`}
          >
            <div
              className={`mb-1 rounded-2xl px-3 py-3 ${
                darkMode
                  ? 'bg-white/[0.04]'
                  : 'bg-slate-50'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={displayName}
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-violet-600 font-bold text-white">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-bold ${
                      darkMode
                        ? 'text-white'
                        : 'text-slate-900'
                    }`}
                  >
                    {displayName}
                  </p>

                  <p
                    className={`truncate text-xs ${
                      darkMode
                        ? 'text-white/45'
                        : 'text-slate-500'
                    }`}
                  >
                    {user.email}
                  </p>
                </div>
              </div>
            </div>

            <Link
              to="/profile"
              onClick={closeAllMenus}
              className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors ${
                darkMode
                  ? 'text-white/70 hover:bg-white/8 hover:text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <User size={18} />
              Trang cá nhân
            </Link>

            <Link
              to="/settings"
              onClick={closeAllMenus}
              className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors ${
                darkMode
                  ? 'text-white/70 hover:bg-white/8 hover:text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Settings size={18} />
              Cài đặt
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
            >
              <LogOut size={18} />
              Đăng xuất
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
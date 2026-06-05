import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  User,
  X,
} from 'lucide-react'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom'

import { signOut } from 'firebase/auth'

import { auth } from '../firebase'
import { useAuth } from '../../contexts/AuthContext'

import darkLogo from '../../assets/favicon-dark-mode.png'
import lightLogo from '../../assets/favicon-light-mode.png'

export default function Navbar({
  darkMode,
  onToggleDarkMode,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, userDetails } = useAuth()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setOpenDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      navigate('/login')
    } catch (error) {
      console.error(error)
    }
  }

  const navItems = useMemo(
    () => [
      { label: 'Trang chủ', path: '/' },
      { label: 'Đề thi', path: '/exams' },
      { label: 'E-Learning', path: '/e-learning' },
      { label: 'Xếp hạng', path: '/leaderboard' },
      { label: 'Dashboard', path: '/dashboard' },
      ...(userDetails?.role === 'TEACHER'
        ? [{ label: 'Quản lý lớp học', path: '/classes' }]
        : []),
    ],
    [userDetails?.role]
  )

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-all duration-300 ${
        darkMode
          ? 'border-white/10 bg-[#020817]/90'
          : 'border-slate-200 bg-white/90'
      }`}
    >
      <div className="mx-auto flex h-20 max-w-screen-xl items-center px-6">
        <div className="flex shrink-0 items-center">
          <Link to="/" className="flex items-center gap-3">

            <div className="rounded-md bg-gradient-to-r from-cyan-400 to-blue-500 p-[2px] shadow-lg">
              <img
                src={darkMode ? darkLogo : lightLogo}
                alt="logo"
                className="h-9 w-9 rounded-sm object-cover"
              />
            </div>

            <div>
              <h1
                className={`text-2xl font-bold ${
                  darkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                ZUNY
              </h1>

              <p className="text-xs font-medium text-cyan-500">
                THPT Platform
              </p>
            </div>

          </Link>
        </div>

        <nav className="hidden flex-1 items-center justify-center gap-5 lg:flex">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative whitespace-nowrap text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'text-cyan-400'
                    : darkMode
                    ? 'text-white/80 hover:text-white'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                {item.label}

                {isActive && (
                  <span className="absolute -bottom-2 left-0 h-[2px] w-full rounded-full bg-cyan-400" />
                )}
              </Link>
            )
          })}
        </nav>

        <div className="flex shrink-0 items-center justify-end gap-1">
          <button
            type="button"
            className={`rounded-xl p-2.5 transition-all ${
              darkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'
            }`}
          >
            <Search
              size={18}
              className={darkMode ? 'text-white' : 'text-slate-700'}
            />
          </button>

          <button
            type="button"
            className={`relative rounded-xl p-2.5 transition-all ${
              darkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'
            }`}
          >
            <Bell
              size={18}
              className={darkMode ? 'text-white' : 'text-slate-700'}
            />

            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-cyan-400" />
          </button>

          <button
            type="button"
            onClick={onToggleDarkMode}
            className={`rounded-xl p-2.5 transition-all ${
              darkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'
            }`}
          >
            {darkMode ? (
              <Sun size={18} className="text-yellow-400" />
            ) : (
              <Moon size={18} className="text-slate-700" />
            )}
          </button>

          {user ? (
            <div className="relative ml-1" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setOpenDropdown(!openDropdown)}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-all ${
                  darkMode
                    ? 'border-white/10 bg-white/5 hover:bg-white/10'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="avatar"
                    className="h-6 w-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-sm font-bold text-white">
                    {(
                      userDetails?.fullName ||
                      user.displayName ||
                      user.email
                    )
                      ?.charAt(0)
                      ?.toUpperCase()}
                  </div>
                )}

                <div className="hidden text-left md:block">
                  <p
                    className={`max-w-[100px] truncate text-sm font-semibold ${
                      darkMode ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {userDetails?.fullName ||
                      user?.displayName ||
                      user?.email?.split('@')[0] ||
                      'User'}
                  </p>
                </div>

                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${
                    openDropdown ? 'rotate-180' : ''
                  } ${darkMode ? 'text-white' : 'text-slate-700'}`}
                />
              </button>

              {openDropdown && (
                <div
                  className={`absolute right-0 top-[calc(100%+10px)] w-56 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl ${
                    darkMode
                      ? 'border-white/10 bg-[#0f1829]/80'
                      : 'border-slate-200/80 bg-white/80'
                  }`}
                >
                  <div
                    className={`border-b px-4 py-3 ${
                      darkMode ? 'border-white/10' : 'border-slate-100'
                    }`}
                  >
                    <p
                      className={`truncate text-sm font-semibold ${
                        darkMode ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {userDetails?.fullName || user?.displayName || 'User'}
                    </p>

                    <p
                      className={`truncate text-xs ${
                        darkMode ? 'text-white/50' : 'text-slate-400'
                      }`}
                    >
                      {user?.email}
                    </p>
                  </div>

                  <div className="p-1.5">
                    <Link
                      to="/profile"
                      onClick={() => setOpenDropdown(false)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                        darkMode
                          ? 'text-white/80 hover:bg-white/10 hover:text-white'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <User size={16} />
                      Trang cá nhân
                    </Link>

                    <Link
                      to="/settings"
                      onClick={() => setOpenDropdown(false)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                        darkMode
                          ? 'text-white/80 hover:bg-white/10 hover:text-white'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Settings size={16} />
                      Cài đặt
                    </Link>
                  </div>

                  <div
                    className={`border-t p-1.5 ${
                      darkMode ? 'border-white/10' : 'border-slate-100'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-400 transition-all hover:bg-red-500/10"
                    >
                      <LogOut size={16} />
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="ml-1 flex items-center gap-2">
              <Link
                to="/login"
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                  darkMode
                    ? 'text-white/80 hover:bg-white/10 hover:text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                Đăng nhập
              </Link>

              <Link
                to="/register"
                className="whitespace-nowrap rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:opacity-90"
              >
                Đăng ký
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className={`rounded-xl p-2.5 lg:hidden ${
              darkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'
            }`}
          >
            {mobileOpen ? (
              <X
                size={20}
                className={darkMode ? 'text-white' : 'text-slate-700'}
              />
            ) : (
              <Menu
                size={20}
                className={darkMode ? 'text-white' : 'text-slate-700'}
              />
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
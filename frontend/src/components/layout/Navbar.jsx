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

import reactLogo from '../../assets/react.svg'

export default function Navbar({
  darkMode,
  onToggleDarkMode,
}) {
  const navigate = useNavigate()

  const location = useLocation()

  const {
    user,
    userDetails,
  } = useAuth()

  const [mobileOpen, setMobileOpen] =
    useState(false)

  const [openDropdown, setOpenDropdown] =
    useState(false)

  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (
      event
    ) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(
          event.target
        )
      ) {
        setOpenDropdown(false)
      }
    }

    document.addEventListener(
      'mousedown',
      handleClickOutside
    )

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      )
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

  const navItems = [
    {
      label: 'Trang chủ',
      path: '/',
    },
    {
      label: 'Đề thi',
      path: '/exams',
    },
    {
      label: 'E-Learning',
      path: '/courses',
    },
    {
      label: 'Xếp hạng',
      path: '/leaderboard',
    },
    {
      label: 'Dashboard',
      path: '/dashboard',
    },
  ]

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-all duration-300 ${
        darkMode
          ? 'border-white/10 bg-[#020817]/90'
          : 'border-slate-200 bg-white/90'
      }`}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4">
        {/* LEFT */}
        <div className="flex items-center gap-8">
          {/* LOGO */}
          <Link
            to="/"
            className="flex items-center gap-3"
          >
            <div className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 p-2 shadow-lg">
              <img
                src={reactLogo}
                alt="logo"
                className="h-7 w-7"
              />
            </div>

            <div>
              <h1
                className={`text-2xl font-bold ${
                  darkMode
                    ? 'text-white'
                    : 'text-slate-900'
                }`}
              >
                EduSprint
              </h1>

              <p className="text-xs font-medium text-cyan-500">
                THPT Platform
              </p>
            </div>
          </Link>

          {/* NAV */}
          <nav className="hidden items-center gap-6 lg:flex">
            {navItems.map((item) => {
              const isActive =
                location.pathname ===
                item.path

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative text-base font-semibold transition-all duration-200 ${
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
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-2">
          {/* SEARCH */}
          <button
            className={`rounded-xl p-2.5 transition-all ${
              darkMode
                ? 'hover:bg-white/10'
                : 'hover:bg-slate-100'
            }`}
          >
            <Search
              size={20}
              className={
                darkMode
                  ? 'text-white'
                  : 'text-slate-700'
              }
            />
          </button>

          {/* NOTIFICATION */}
          <button
            className={`relative rounded-xl p-2.5 transition-all ${
              darkMode
                ? 'hover:bg-white/10'
                : 'hover:bg-slate-100'
            }`}
          >
            <Bell
              size={20}
              className={
                darkMode
                  ? 'text-white'
                  : 'text-slate-700'
              }
            />

            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-cyan-400" />
          </button>

          {/* DARKMODE */}
          <button
            onClick={onToggleDarkMode}
            className={`rounded-xl p-2.5 transition-all ${
              darkMode
                ? 'hover:bg-white/10'
                : 'hover:bg-slate-100'
            }`}
          >
            {darkMode ? (
              <Sun
                size={20}
                className="text-yellow-400"
              />
            ) : (
              <Moon
                size={20}
                className="text-slate-700"
              />
            )}
          </button>

          {/* USER */}
          {user && (
            <div
              className="relative"
              ref={dropdownRef}
            >
              <button
                onClick={() =>
                  setOpenDropdown(
                    !openDropdown
                  )
                }
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-all ${
                  darkMode
                    ? 'border-white/10 bg-white/5 hover:bg-white/10'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                {/* AVATAR */}
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="avatar"
                    className="h-8 w-8 rounded-full object-cover"
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

                {/* NAME */}
                <div className="hidden text-left md:block">
                  <p
                    className={`max-w-[110px] truncate text-sm font-semibold ${
                      darkMode
                        ? 'text-white'
                        : 'text-slate-900'
                    }`}
                  >
                    {userDetails?.fullName ||
                      user?.displayName ||
                      user?.email?.split(
                        '@'
                      )[0] ||
                      'User'}
                  </p>
                </div>

                <ChevronDown
                  size={15}
                  className={
                    darkMode
                      ? 'text-white'
                      : 'text-slate-700'
                  }
                />
              </button>

              {/* DROPDOWN */}
              {openDropdown && (
                <div
                  className={`absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl ${
                    darkMode
                      ? 'border-white/10 bg-[#050816]/95'
                      : 'border-slate-200 bg-white/95'
                  }`}
                >
                  {/* USER INFO */}
                  <div
                    className={`border-b px-4 py-4 ${
                      darkMode
                        ? 'border-white/10'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          user?.photoURL ||
                          reactLogo
                        }
                        alt="avatar"
                        className="h-9 w-9 rounded-full border border-cyan-400 object-cover"
                      />

                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm font-semibold ${
                            darkMode
                              ? 'text-white'
                              : 'text-slate-900'
                          }`}
                        >
                          {userDetails?.fullName ||
                            user?.displayName ||
                            user?.email?.split(
                              '@'
                            )[0] ||
                            'User'}
                        </p>

                        <p
                          className={`truncate text-xs ${
                            darkMode
                              ? 'text-gray-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {user?.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* MENU */}
                  <div className="p-2">
                    <button
                      onClick={() => {
                        navigate(
                          '/profile'
                        )

                        setOpenDropdown(
                          false
                        )
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm transition-all duration-200 ${
                        darkMode
                          ? 'text-white hover:bg-white/10'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <User size={16} />

                      <span className="font-medium">
                        Hồ sơ học tập
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        navigate(
                          '/settings'
                        )

                        setOpenDropdown(
                          false
                        )
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm transition-all duration-200 ${
                        darkMode
                          ? 'text-white hover:bg-white/10'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Settings size={16} />

                      <span className="font-medium">
                        Cài đặt
                      </span>
                    </button>

                    <button
                      onClick={
                        handleLogout
                      }
                      className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm text-red-500 transition-all duration-200 hover:bg-red-500/10"
                    >
                      <LogOut size={16} />

                      <span className="font-medium">
                        Đăng xuất
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MOBILE MENU */}
          <button
            onClick={() =>
              setMobileOpen(
                !mobileOpen
              )
            }
            className={`rounded-xl p-2.5 lg:hidden ${
              darkMode
                ? 'hover:bg-white/10'
                : 'hover:bg-slate-100'
            }`}
          >
            {mobileOpen ? (
              <X
                size={20}
                className={
                  darkMode
                    ? 'text-white'
                    : 'text-slate-700'
                }
              />
            ) : (
              <Menu
                size={20}
                className={
                  darkMode
                    ? 'text-white'
                    : 'text-slate-700'
                }
              />
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
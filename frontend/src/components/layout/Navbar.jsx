import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  ChevronDown,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Moon,
  Search,
  Settings,
  Shield,
  Sun,
  Trophy,
  UserRound,
  X,
  LogOut,
  LogIn
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { auth } from '../firebase'
import toast from 'react-hot-toast'

const navItems = [
  { label: 'Trang chủ', href: '/' },
  { label: 'Đề thi', href: '/exams' },
  { label: 'E-Learning', href: '/courses' },
  { label: 'Xếp hạng', href: '/leaderboard' },
  { label: 'Dashboard', href: '/dashboard' },
]

function navClass({ isActive }) {
  return `rounded-lg px-3 py-2 text-sm font-semibold transition ${
    isActive
      ? 'bg-cyan-400/15 text-cyan-700 dark:text-cyan-200'
      : 'text-slate-600 hover:bg-white/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
  }`
}

function Navbar({ darkMode, onToggleDarkMode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const { user, userData, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await auth.signOut();
      toast.success("Đã đăng xuất");
      navigate("/");
      setProfileOpen(false);
      setMenuOpen(false);
    } catch (error) {
      toast.error("Lỗi đăng xuất");
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/60 bg-white/75 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/65">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3" onClick={() => setMenuOpen(false)}>
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-300 to-blue-600 text-white shadow-[0_14px_35px_rgba(14,165,233,0.32)]">
            <GraduationCap className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-lg font-black leading-5 tracking-tight text-slate-950 dark:text-white">
              EduSprint
            </span>
            <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">THPT Platform</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <NavLink key={item.href} to={item.href} className={navClass}>
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            className="rounded-lg p-2.5 text-slate-600 transition hover:bg-white/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Tìm kiếm"
            title="Tìm kiếm"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="relative rounded-lg p-2.5 text-slate-600 transition hover:bg-white/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Thông báo"
            title="Thông báo"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-cyan-400" />
          </button>
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="rounded-lg p-2.5 text-slate-600 transition hover:bg-white/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Đổi chế độ màu"
            title="Đổi chế độ màu"
          >
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((value) => !value)}
                className="flex items-center gap-2 rounded-lg border border-cyan-300/30 bg-white/70 px-2.5 py-2 text-sm font-semibold text-slate-800 transition hover:border-cyan-300 dark:bg-white/10 dark:text-white"
                aria-expanded={profileOpen}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 text-white overflow-hidden">
                  {userData?.photo ? (
                    <img src={userData.photo} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold">{userData?.firstName?.charAt(0) || user.email?.charAt(0).toUpperCase()}</span>
                  )}
                </span>
                <ChevronDown className="h-4 w-4" />
              </button>
              <AnimatePresence>
                {profileOpen ? (
                  <motion.div
                    className="absolute right-0 mt-3 w-64 rounded-lg border border-white/60 bg-white/95 p-2 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95"
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  >
                    <div className="border-b border-slate-200 p-3 dark:border-white/10">
                      <p className="font-bold text-slate-950 dark:text-white truncate">{userData?.firstName || 'Người dùng'}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                    </div>
                    {[
                      { label: 'Hồ sơ học tập', icon: UserRound, href: '/profile' },
                      { label: 'Quản trị hệ thống', icon: Shield, href: '/admin', show: isAdmin },
                      { label: 'Cài đặt', icon: Settings, href: '/settings' },
                    ].filter(item => item.show !== false).map((item) => (
                      <Link
                        key={item.label}
                        to={item.href ?? '#'}
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-cyan-400/10 hover:text-cyan-700 dark:text-slate-300 dark:hover:text-cyan-200"
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    ))}
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      <LogOut className="h-4 w-4" />
                      Đăng xuất
                    </button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex items-center gap-3 ml-2">
              <Link to="/login" className="text-sm font-bold text-slate-600 hover:text-blue-600 transition dark:text-slate-300 dark:hover:text-white">
                Đăng nhập
              </Link>
              <Link to="/register" className="px-4 py-2 bg-gradient-to-r from-cyan-400 to-blue-600 text-white text-sm font-bold rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95">
                Gia nhập ngay
              </Link>
            </div>
          )}
        </div>

        <button
          type="button"
          className="rounded-lg p-2.5 text-slate-700 transition hover:bg-white/80 dark:text-slate-200 dark:hover:bg-white/10 md:hidden"
          onClick={() => setMenuOpen((value) => !value)}
          aria-label="Mở menu"
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            className="border-t border-white/60 bg-white/95 px-4 pb-4 pt-2 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 md:hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="grid gap-2">
              {navItems.map((item) => (
                <NavLink key={item.href} to={item.href} className={navClass} onClick={() => setMenuOpen(false)}>
                  {item.label}
                </NavLink>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button type="button" className="mobile-icon-button" aria-label="Thông báo">
                <Bell className="h-5 w-5" />
              </button>
              <button type="button" className="mobile-icon-button" onClick={onToggleDarkMode} aria-label="Đổi chế độ màu">
                {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <Link to="/leaderboard" className="mobile-icon-button" onClick={() => setMenuOpen(false)} aria-label="Xếp hạng">
                <Trophy className="h-5 w-5" />
              </Link>
              
              {user ? (
                 <>
                   <Link to="/dashboard" className="mobile-icon-button col-span-3" onClick={() => setMenuOpen(false)}>
                    <LayoutDashboard className="h-5 w-5" />
                    Dashboard
                  </Link>
                  <Link to="/profile" className="mobile-icon-button col-span-2" onClick={() => setMenuOpen(false)}>
                    <UserRound className="h-5 w-5" />
                    Hồ sơ cá nhân
                  </Link>
                  <button onClick={handleLogout} className="mobile-icon-button text-red-500">
                    <LogOut className="h-5 w-5" />
                  </button>
                 </>
              ) : (
                <>
                  <Link to="/login" className="mobile-icon-button col-span-1" onClick={() => setMenuOpen(false)}>
                    <LogIn className="h-5 w-5" />
                    Đăng nhập
                  </Link>
                  <Link to="/register" className="mobile-icon-button col-span-2 bg-gradient-to-r from-cyan-400 to-blue-600 text-white" onClick={() => setMenuOpen(false)}>
                    Đăng ký ngay
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  )
}

export default Navbar

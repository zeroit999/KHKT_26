import {
  Bell,
  BookOpenCheck,
  ClipboardList,
  ChevronDown,
  GraduationCap,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Moon,
  Search,
  Settings,
  Sun,
  Trophy,
  User,
  Users,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

import useResponsive from '../../hooks/common/useResponsive';
import { getUserAvatar } from '../../utils/userAvatar';

import darkLogo from '../../assets/favicon-dark-mode.png';
import lightLogo from '../../assets/favicon-light-mode.png';

const normalizeRole = (role) =>
  String(role || '')
    .trim()
    .replace(/[\s_-]/g, '')
    .toUpperCase();

export default function DesktopNavbar({ darkMode, onToggleDarkMode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userDetails, logout } = useAuth();

  const [isHovered, setIsHovered] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const accountRef = useRef(null);

  const role = normalizeRole(userDetails?.role);
  const displayName =
    userDetails?.fullName ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'Tài khoản';

  const avatarSrc = getUserAvatar(user);

  const classItem = useMemo(() => {
    const teacherRoles = ['TEACHER', 'ADMINUSER', 'ADMINDEV'];
    const studentRoles = ['STUDENT', 'STUDENR', 'USER'];

    if (teacherRoles.includes(role)) {
      return {
        label: 'Quản lý lớp học',
        shortLabel: 'Quản lý lớp học',
        path: '/classes',
        icon: LayoutDashboard,
      };
    }

    if (studentRoles.includes(role)) {
      return {
        label: 'Lớp học',
        shortLabel: 'Lớp học',
        path: '/LearningPage',
        icon: GraduationCap,
      };
    }

    return null;
  }, [role]);

  const navItems = useMemo(
    () => [
      { label: 'Trang chủ', shortLabel: 'Trang chủ', path: '/', icon: Home },
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
  );

  const currentItem = navItems.find((item) =>
    item.path === '/'
      ? location.pathname === '/'
      : location.pathname.toLowerCase().startsWith(item.path.toLowerCase())
  ) || {
    label: location.pathname === '/profile' ? 'Trang cá nhân' : 'ZUNY',
    shortLabel: location.pathname === '/profile' ? 'Trang cá nhân' : 'ZUNY',
    icon: Home,
  };

  const expanded = isHovered || isAccountOpen;

  useEffect(() => {
    setIsAccountOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setIsAccountOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      setIsAccountOpen(false);
      navigate('/login');
    } catch (error) {
      console.error('Không thể đăng xuất:', error);
    }
  };

  const CurrentIcon = currentItem.icon;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-3 sm:top-5">
      <motion.header
        layout
        initial={false}
        transition={{
          type: 'spring',
          stiffness: 420,
          damping: 34,
          mass: 0.75,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          if (!isAccountOpen) setIsHovered(false);
        }}
        className={`pointer-events-auto relative h-16 max-w-[96vw] rounded-full border backdrop-blur-3xl ${
          expanded ? 'w-[min(97vw,1320px)]' : 'w-auto'
        } ${
          darkMode
            ? 'border-violet-400/25 bg-[#090912]/92 shadow-[0_20px_60px_rgba(124,58,237,0.25)]'
            : 'border-slate-200/90 bg-white/90 shadow-[0_20px_55px_rgba(15,23,42,0.16)]'
        }`}
      >
        <div className="flex h-full min-w-0 items-center gap-2 overflow-visible px-2.5">
          <Link
            to="/"
            aria-label="ZUNY - Trang chủ"
            className={`flex h-12 shrink-0 items-center rounded-full transition-colors ${
              expanded ? 'gap-2 px-2' : 'w-10 justify-center'
            } ${darkMode ? 'hover:bg-white/8' : 'hover:bg-slate-100'}`}
          >
            <span className="rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 p-[2px] shadow-[0_0_14px_rgba(99,102,241,0.42)]">
              <img
                src={darkMode ? darkLogo : lightLogo}
                alt="ZUNY"
                className="h-9 w-9 rounded-full object-cover"
              />
            </span>

            <AnimatePresence initial={false}>
              {expanded && (
                <motion.span
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className={`overflow-hidden whitespace-nowrap text-base font-extrabold tracking-wide ${
                    darkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  ZUNY
                </motion.span>
              )}
            </AnimatePresence>
          </Link>

          <div
            className={`h-7 w-px shrink-0 ${
              darkMode ? 'bg-white/10' : 'bg-slate-200'
            }`}
          />

          <AnimatePresence mode="popLayout" initial={false}>
            {expanded ? (
              <motion.nav
                key="expanded-nav"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.16 }}
                className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden"
              >
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.path === '/'
                      ? location.pathname === '/'
                      : location.pathname
                          .toLowerCase()
                          .startsWith(item.path.toLowerCase());

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={item.label}
                      aria-label={item.label}
                      className={`relative flex min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 py-2.5 text-sm font-semibold transition-colors 2xl:px-3 ${
                        active
                          ? darkMode
                            ? 'bg-violet-500/22 text-violet-200'
                            : 'bg-violet-100 text-violet-700'
                          : darkMode
                            ? 'text-white/48 hover:bg-white/7 hover:text-white/85'
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon size={18} strokeWidth={2} />
                      <span className="whitespace-nowrap">
                        {item.shortLabel}
                      </span>
                      {active && (
                        <motion.span
                          layoutId="navbar-active-dot"
                          className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.95)]"
                        />
                      )}
                    </Link>
                  );
                })}
              </motion.nav>
            ) : (
              <motion.div
                key="collapsed-nav"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.16 }}
                className="flex min-w-0 flex-none items-center gap-2 px-2 sm:min-w-max"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 shadow-[0_0_12px_rgba(124,58,237,0.95)]" />
                <CurrentIcon
                  size={18}
                  className={darkMode ? 'text-violet-300' : 'text-violet-600'}
                />
                <span
                  className={`min-w-0 truncate text-base font-bold sm:whitespace-nowrap ${
                    darkMode ? 'text-violet-200' : 'text-slate-800'
                  }`}
                >
                  {currentItem.shortLabel}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className={`mx-1.5 h-8 w-px shrink-0 ${
              darkMode ? 'bg-white/10' : 'bg-slate-200'
            }`}
          />

          {expanded && (
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                aria-label="Tìm kiếm"
                className={`hidden rounded-full p-2.5 transition sm:inline-flex ${
                  darkMode
                    ? 'text-white/55 hover:bg-white/8 hover:text-white'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Search size={18} />
              </button>

              <button
                type="button"
                aria-label="Thông báo"
                className={`relative hidden rounded-full p-2 transition sm:inline-flex ${
                  darkMode
                    ? 'text-white/55 hover:bg-white/8 hover:text-white'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Bell size={18} />
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-400" />
              </button>

              <button
                type="button"
                onClick={onToggleDarkMode}
                aria-label={
                  darkMode ? 'Bật giao diện sáng' : 'Bật giao diện tối'
                }
                className={`rounded-full p-2.5 transition ${
                  darkMode
                    ? 'text-amber-300 hover:bg-white/8'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          )}

          <div className="relative shrink-0" ref={accountRef}>
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsAccountOpen((value) => !value)}
                  className={`flex h-12 items-center gap-2.5 rounded-full border px-1.5 pr-3 transition ${
                    darkMode
                      ? 'border-violet-400/35 bg-violet-500/10 hover:bg-violet-500/18'
                      : 'border-violet-200 bg-violet-50 hover:bg-violet-100'
                  }`}
                >
                  <img
                    src={avatarSrc}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = lightLogo;
                    }}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                  <span
                    className={`max-w-[120px] truncate text-sm font-medium ${
                      darkMode ? 'text-violet-200' : 'text-violet-800'
                    }`}
                  >
                    {expanded ? displayName : displayName.split(' ')[0]}
                  </span>

                  {expanded && (
                    <ChevronDown
                      size={15}
                      className={`transition-transform ${
                        isAccountOpen ? 'rotate-180' : ''
                      }`}
                    />
                  )}
                </button>

                <AnimatePresence>
                  {isAccountOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.16 }}
                      className={`absolute right-0 top-[calc(100%+12px)] w-56 overflow-hidden rounded-2xl border p-1.5 shadow-2xl backdrop-blur-2xl ${
                        darkMode
                          ? 'border-white/10 bg-[#0b0b16]/96'
                          : 'border-slate-200 bg-white/96'
                      }`}
                    >
                      <div className="px-3 py-2">
                        <p
                          className={`truncate text-sm font-semibold ${
                            darkMode ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {displayName}
                        </p>
                        <p
                          className={`truncate text-xs ${
                            darkMode ? 'text-white/45' : 'text-slate-500'
                          }`}
                        >
                          {user.email}
                        </p>
                      </div>

                      <Link
                        to="/profile"
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                          darkMode
                            ? 'text-white/70 hover:bg-white/8 hover:text-white'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <User size={16} />
                        Trang cá nhân
                      </Link>

                      <Link
                        to="/settings"
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                          darkMode
                            ? 'text-white/70 hover:bg-white/8 hover:text-white'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Settings size={16} />
                        Cài đặt
                      </Link>

                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                      >
                        <LogOut size={16} />
                        Đăng xuất
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <Link
                to="/login"
                className={`flex h-12 items-center gap-2.5 rounded-full border px-4 text-sm font-semibold ${
                  darkMode
                    ? 'border-violet-400/30 bg-violet-500/10 text-violet-200'
                    : 'border-violet-200 bg-violet-50 text-violet-700'
                }`}
              >
                <LogIn size={17} />
                <span>{expanded ? 'Đăng nhập' : 'Khách'}</span>
              </Link>
            )}
          </div>
        </div>
      </motion.header>
    </div>
  );
}
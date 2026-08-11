import DesktopNavbar from './DesktopNavbar'
import MobileNavbar from './MobileNavbar'

import useResponsive from '../../hooks/common/useResponsive'

export default function Navbar({
  darkMode,
  onToggleDarkMode,
}) {
  const { isMobileOrTablet } = useResponsive()

  if (isMobileOrTablet) {
    return (
      <MobileNavbar
        darkMode={darkMode}
        onToggleDarkMode={onToggleDarkMode}
      />
    )
  }

  const classNavItem = useMemo(() => {
    if (userDetails?.role === 'TEACHER') {
      return {
        label: 'Quản lý lớp học',
        path: '/classes',
      }
    }

    if (userDetails?.role === 'STUDENT') {
      return {
        label: 'Lớp học',
        path: '/classes',
      }
    }

    return null
  }, [userDetails?.role])

  const navItems = useMemo(
    () => [
      { label: 'Trang chủ', path: '/' },
      { label: 'Đề thi', path: '/exams' },
      { label: 'Thư viện', path: '/e-learning' },
      { label: 'Xếp hạng', path: '/leaderboard' },
      { label: 'Cộng đồng', path: '/forum' },
      ...(classNavItem ? [classNavItem] : []),
    ],
    [classNavItem]
  )

  return (
    <DesktopNavbar
      darkMode={darkMode}
      onToggleDarkMode={onToggleDarkMode}
    />
  )
}
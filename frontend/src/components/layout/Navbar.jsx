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

  return (
    <DesktopNavbar
      darkMode={darkMode}
      onToggleDarkMode={onToggleDarkMode}
    />
  )
}
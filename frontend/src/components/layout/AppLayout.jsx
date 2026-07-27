import AnimatedBackground from '../ui/AnimatedBackground.jsx'
import Footer from './Footer.jsx'
import Navbar from './Navbar.jsx'

function AppLayout({
  children,
  darkMode,
  onToggleDarkMode,
  mainClassName = 'pt-24',
  showFooter = true,
  showNavbar = true,
  lockPageScroll = false,
}) {
  return (
    <div className="min-h-screen text-slate-900 transition-colors dark:text-slate-100">
      <AnimatedBackground />

      {showNavbar && (
        <Navbar
          darkMode={darkMode}
          onToggleDarkMode={onToggleDarkMode}
        />
      )}

      <main
        className={`${mainClassName} ${
          lockPageScroll ? 'overflow-hidden' : ''
        }`}
      >
        {children}
      </main>

      {showFooter && <Footer darkMode={darkMode} />}
    </div>
  )
}

export default AppLayout
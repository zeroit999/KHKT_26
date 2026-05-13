import AnimatedBackground from '../ui/AnimatedBackground.jsx'

import Footer from './Footer.jsx'
import Navbar from './Navbar.jsx'

function AppLayout({
  children,
  darkMode,
  onToggleDarkMode,
}) {
  return (
    <div className="min-h-screen text-slate-900 transition-colors dark:text-slate-100">

      <AnimatedBackground />

      <Navbar
        darkMode={darkMode}
        onToggleDarkMode={onToggleDarkMode}
      />

      <main className="pt-20">
        {children}
      </main>

      <Footer darkMode={darkMode} />

    </div>
  )
}

export default AppLayout
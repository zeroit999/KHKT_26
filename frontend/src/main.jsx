import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
const savedDarkMode = window.localStorage.getItem('darkMode')
const savedTheme =
  window.localStorage.getItem('theme') ||
  window.localStorage.getItem('color-theme')

const shouldUseDarkMode =
  savedDarkMode === 'true' ||
  savedTheme === 'dark' ||
  (savedDarkMode === null &&
    savedTheme === null &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches)

document.documentElement.classList.toggle('dark', Boolean(shouldUseDarkMode))
document.documentElement.style.colorScheme = shouldUseDarkMode ? 'dark' : 'light'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

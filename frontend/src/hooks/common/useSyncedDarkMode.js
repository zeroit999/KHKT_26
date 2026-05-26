import { useEffect, useState } from 'react'

const getSyncedDarkMode = () => {
  if (typeof window === 'undefined') return false

  const root = document.documentElement
  const body = document.body

  if (root.classList.contains('dark') || body.classList.contains('dark')) {
    return true
  }

  if (root.classList.contains('light') || body.classList.contains('light')) {
    return false
  }

  const storageKeys = [
    'theme',
    'color-theme',
    'vite-ui-theme',
    'darkMode',
    'dark-mode',
    'mode',
  ]

  for (const key of storageKeys) {
    const value = window.localStorage.getItem(key)?.toLowerCase()

    if (['dark', 'true', '1', 'night'].includes(value)) return true
    if (['light', 'false', '0', 'day'].includes(value)) return false
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

export default function useSyncedDarkMode() {
  const [isDark, setIsDark] = useState(getSyncedDarkMode)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncDarkMode = () => setIsDark(getSyncedDarkMode())

    const root = document.documentElement
    const body = document.body
    const observer = new MutationObserver(syncDarkMode)
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class'],
    })

    if (body) {
      observer.observe(body, {
        attributes: true,
        attributeFilter: ['class'],
      })
    }

    window.addEventListener('storage', syncDarkMode)
    media?.addEventListener?.('change', syncDarkMode)

    syncDarkMode()

    return () => {
      observer.disconnect()
      window.removeEventListener('storage', syncDarkMode)
      media?.removeEventListener?.('change', syncDarkMode)
    }
  }, [])

  return isDark
}
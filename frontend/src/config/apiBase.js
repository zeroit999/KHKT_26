const configuredBaseUrl = String(
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  '',
).replace(/\/$/, '')

const localDevMode = import.meta.env.VITE_LOCAL_DEV_MODE === 'true'

export function getApiBaseUrl() {
  if (!localDevMode) return configuredBaseUrl

  if (typeof window === 'undefined') {
    return configuredBaseUrl || 'http://127.0.0.1:5000'
  }

  const configuredUrl = configuredBaseUrl || 'http://127.0.0.1:5000'

  try {
    const url = new URL(configuredUrl)
    const hostname = window.location.hostname

    if (hostname && ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) {
      url.hostname = hostname
    }

    return url.toString().replace(/\/$/, '')
  } catch {
    return configuredUrl
  }
}

export default getApiBaseUrl

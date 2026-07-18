const STORAGE_KEY = 'zuny.local.demo-session'

export const LOCAL_DEMO_ACCOUNTS = [
  {
    uid: 'local-student-001',
    email: import.meta.env.VITE_DEMO_STUDENT_EMAIL || '',
    displayName: 'Học sinh Demo',
    role: 'STUDENT',
  },
  {
    uid: 'local-teacher-001',
    email: import.meta.env.VITE_DEMO_TEACHER_EMAIL || '',
    displayName: 'Giáo viên Demo',
    role: 'TEACHER',
  },
]

function buildSession(account) {
  return {
    user: {
      uid: account.uid,
      email: account.email,
      displayName: account.displayName,
      photoURL: '',
    },
    userDetails: {
      uid: account.uid,
      email: account.email,
      fullName: account.displayName,
      displayName: account.displayName,
      photoURL: '',
      role: account.role,
      points: 0,
      learningStreak: 0,
      isSetupComplete: true,
      isLocalDemo: true,
    },
  }
}

export function getLocalDemoSession() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function signInLocalDemo(email, password) {
  const expectedPassword = String(import.meta.env.VITE_DEMO_PASSWORD || '')
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const account = LOCAL_DEMO_ACCOUNTS.find((item) => item.email === normalizedEmail)

  if (!expectedPassword || !account || password !== expectedPassword) {
    const error = new Error('Thông tin tài khoản demo không chính xác')
    error.code = 'local/invalid-credential'
    throw error
  }

  const session = buildSession(account)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  return session
}

export function signOutLocalDemo() {
  window.localStorage.removeItem(STORAGE_KEY)
}

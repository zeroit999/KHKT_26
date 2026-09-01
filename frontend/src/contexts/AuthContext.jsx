import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'

import {
  authService,
} from '../services/auth'

const AuthContext =
  createContext()

export function AuthProvider({
  children,
}) {
  const [user, setUser] =
    useState(null)

  const [
    userDetails,
    setUserDetails,
  ] = useState(null)

  const [isLoading, setIsLoading] =
    useState(true)

  const applyUser = (
    currentUser
  ) => {
    setUser(currentUser)
    setUserDetails(currentUser)

    authService.currentUser =
      currentUser
  }

  // =========================
  // REFRESH USER DATA
  // =========================
  const refreshUserData =
    async () => {
      try {
        const currentUser =
          await authService.getMe()

        if (!currentUser) {
          applyUser(null)
          return null
        }

        applyUser(currentUser)

        return currentUser
      } catch (error) {
        console.error(
          'Refresh user error:',
          error
        )

        applyUser(null)

        return null
      }
    }

  // =========================
  // RESTORE LOGIN SESSION
  // =========================
  useEffect(() => {
    let active = true

    const restoreSession =
      async () => {
        try {
          setIsLoading(true)

          const currentUser =
            await authService.getMe()

          if (!active) return

          applyUser(
            currentUser || null
          )
        } catch (error) {
          console.error(
            'Restore session error:',
            error
          )

          if (active) {
            applyUser(null)
          }
        } finally {
          if (active) {
            setIsLoading(false)
          }
        }
      }

    restoreSession()

    return () => {
      active = false
    }
  }, [])

  // =========================
  // LOGIN HELPERS
  // =========================
  const loginWithEmailPassword =
    async (
      email,
      password
    ) => {
      const currentUser =
        await authService
          .loginWithEmailPassword(
            email,
            password
          )

      applyUser(currentUser)

      return currentUser
    }

  const register =
    async (
      email,
      password,
      additionalData = {}
    ) => {
      const currentUser =
        await authService.register(
          email,
          password,
          additionalData
        )

      applyUser(currentUser)

      return currentUser
    }

  const loginWithGoogleCredential =
    async (
      credential
    ) => {
      const currentUser =
        await authService
          .loginWithGoogleCredential(
            credential
          )

      applyUser(currentUser)

      return currentUser
    }

  // =========================
  // LOGOUT
  // =========================
  const logout =
    async () => {
      try {
        await authService.logout()
      } finally {
        applyUser(null)
      }
    }

  const normalizedRole =
    String(
      userDetails?.role || ''
    )
      .trim()
      .toLowerCase()

  const isUser =
    normalizedRole === 'user' ||
    normalizedRole === 'student'

  const isAdmin =
    normalizedRole === 'admin' ||
    normalizedRole === 'teacher'

  const isAdminDev =
    normalizedRole ===
    'admin_dev'

  const canManageAll =
    isAdminDev

  const canManageExams =
    isAdmin ||
    isAdminDev

  return (
    <AuthContext.Provider
      value={{
        user,
        userDetails,
        setUserDetails,

        refreshUserData,

        loginWithEmailPassword,
        register,
        loginWithGoogleCredential,
        logout,

        isLoading,

        normalizedRole,
        isUser,
        isAdmin,
        isAdminDev,
        canManageAll,
        canManageExams,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(
    AuthContext
  )
}
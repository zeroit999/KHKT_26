import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'

import {
  onAuthStateChanged,
  signOut,
} from 'firebase/auth'

import {
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore'

import {
  auth,
  db,
} from '../components/firebase'
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

  // =========================
  // REFRESH USER DATA
  // =========================
  const refreshUserData =
    async (currentUser = user) => {
      try {
        if (!currentUser) return

        const userRef = doc(
          db,
          'users',
          currentUser.uid
        )

        const userSnap =
          await getDoc(userRef)

        if (
          userSnap.exists()
        ) {
          const data =
            userSnap.data()

          console.log(
            'USER DATA:',
            data
          )

          setUserDetails(
            data
          )

          return data
        }

        return null
      } catch (error) {
        console.error(
          'Refresh user error:',
          error
        )

        return null
      }
    }

  // =========================
  // AUTH LISTENER
  // =========================
  useEffect(() => {
    console.log(
      'AuthContext: Setting up auth listener'
    )

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          currentUser
        ) => {
          try {
            console.log(
              'Auth state changed:',
              currentUser?.email
            )

            setIsLoading(true)

            if (
              !currentUser
            ) {
              setUser(null)

              setUserDetails(
                null
              )

              setIsLoading(
                false
              )

              return
            }

            setUser(
              currentUser
            )

            // =========================
            // GET USER DATA
            // =========================
            console.log(
              'Fetching user data for:',
              currentUser.email
            )

            const userRef =
              doc(
                db,
                'users',
                currentUser.uid
              )

            const userSnap =
              await getDoc(
                userRef
              )

            // =========================
            // USER EXISTS
            // =========================
            if (
              userSnap.exists()
            ) {
              const data =
                userSnap.data()

              console.log(
                'User data loaded:',
                data
              )

              setUserDetails(
                data
              )
            }

            // =========================
            // CREATE NEW USER
            // =========================
            else {
              console.log(
                'Creating new user document'
              )

              const newUser =
                {
                  uid: currentUser.uid,

                  email:
                    currentUser.email,

                  fullName:
                    currentUser.displayName ||
                    '',

                  photoURL:
                    currentUser.photoURL ||
                    '',

                  role:
                    'user',

                  points: 0,

                  learningStreak: 0,

                  school: '',

                  className:
                    '',

                  subject: '',

                  phone: '',

                  city: '',

                  address: '',

                  facebook:
                    '',

                  isSetupComplete:
                    false,

                  createdAt:
                    new Date().toISOString(),
                }

              await setDoc(
                userRef,
                newUser
              )

              setUserDetails(
                newUser
              )
            }
          } catch (error) {
            console.error(
              'Error fetching user data:',
              error
            )
          } finally {
            setIsLoading(
              false
            )
          }
        }
      )

    return () =>
      unsubscribe()
  }, [])

  // =========================
  // LOGOUT
  // =========================
  const logout =
    async () => {
      try {
        await signOut(
          auth
        )

        setUser(null)

        setUserDetails(
          null
        )
      } catch (error) {
        console.error(
          'Logout error:',
          error
        )
      }
    }

  const normalizedRole =
    String(userDetails?.role || '').trim().toLowerCase()

  const isUser =
    normalizedRole === 'user' ||
    normalizedRole === 'student'

  const isAdmin =
    normalizedRole === 'admin' ||
    normalizedRole === 'teacher'

  const isAdminDev =
    normalizedRole === 'admin_dev'

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

// Hook và provider cùng file để giữ API hiện tại của dự án.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(
    AuthContext
  )
}

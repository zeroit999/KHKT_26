import axios from 'axios'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../components/firebase'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

const waitForFirebaseUser = () => {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(auth.currentUser)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe()
      resolve(user)
    })
  })
}

apiClient.interceptors.request.use(
  async (config) => {
    const user = await waitForFirebaseUser()

    if (!user) {
      throw new Error('Bạn chưa đăng nhập')
    }

    const token = await user.getIdToken()

    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`

    return config
  },
  (error) => Promise.reject(error),
)

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Có lỗi xảy ra'

    return Promise.reject({
      ...error,
      message,
    })
  },
)

export default apiClient
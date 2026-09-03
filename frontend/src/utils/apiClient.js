import axios from 'axios'

import {
  authService,
} from '../services/auth'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? 'http://127.0.0.1:5000' : '')

const apiClient =
  axios.create({
    baseURL:
      `${API_BASE_URL}/api`,

    headers: {
      'Content-Type':
        'application/json',
    },
  })

apiClient.interceptors.request.use(
  (config) => {
    const token =
      authService
        .getAccessToken()

    if (token) {
      config.headers =
        config.headers || {}

      config.headers.Authorization =
        `Bearer ${token}`
    }

    return config
  },

  (error) =>
    Promise.reject(error)
)

let refreshPromise = null

apiClient.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest =
      error.config

    if (
      error.response?.status ===
        401 &&
      originalRequest &&
      !originalRequest._retry &&
      authService
        .getRefreshToken()
    ) {
      originalRequest._retry =
        true

      try {
        if (!refreshPromise) {
          refreshPromise =
            authService
              .refreshAccessToken()
              .finally(() => {
                refreshPromise =
                  null
              })
        }

        const newToken =
          await refreshPromise

        originalRequest.headers =
          originalRequest.headers ||
          {}

        originalRequest
          .headers
          .Authorization =
          `Bearer ${newToken}`

        return apiClient(
          originalRequest
        )
      } catch {
        authService.clearSession()
      }
    }

    const message =
      error.response?.data
        ?.message ||
      error.response?.data
        ?.error ||
      error.message ||
      'Có lỗi xảy ra'

    error.message = message

    return Promise.reject(
      error
    )
  }
)

export default apiClient
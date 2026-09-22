import getApiBaseUrl from '../config/apiBase'

const API_BASE_URL = getApiBaseUrl()

const ACCESS_TOKEN_KEY = 'zuny_access_token'
const REFRESH_TOKEN_KEY = 'zuny_refresh_token'
let refreshPromise = null

class AuthService {
  constructor() {
    this.currentUser = null

    this.accessToken =
      localStorage.getItem(
        ACCESS_TOKEN_KEY
      )

    this.refreshToken =
      localStorage.getItem(
        REFRESH_TOKEN_KEY
      )
  }

  async request(
    path,
    options = {}
  ) {
    let response
    try {
      response = await fetch(
        `${API_BASE_URL}${path}`,
        {
          ...options,
          headers: {
            Accept: 'application/json',
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers,
          },
        },
      )
    } catch {
      throw new Error(
        'Không thể kết nối máy chủ. Hãy kiểm tra backend và kết nối mạng.',
      )
    }

    const data =
      await response
        .json()
        .catch(() => ({}))

    if (!response.ok) {
      const error = new Error(
        data.error ||
          data.message ||
          'Có lỗi xảy ra.'
      )

      error.status = response.status
      error.code = data.code || null
      error.data = data

      throw error
    }

    return data
  }

  async loginWithEmailPassword(
    email,
    password
  ) {
    const data =
      await this.request(
        '/auth/login',
        {
          method: 'POST',

          body: JSON.stringify({
            email,
            password,
          }),
        }
      )

    this.setTokens(
      data.access_token,
      data.refresh_token
    )

    this.currentUser =
      data.user

    return data.user
  }

  async register(
    email,
    password,
    additionalData = {}
  ) {
    if (typeof password !== 'string' || password.length < 8) {
      throw new Error('Mật khẩu phải có ít nhất 8 ký tự.')
    }

    if (!/[0-9]/.test(password)) {
      throw new Error('Mật khẩu phải có ít nhất 1 chữ số (0-9).')
    }

    if (!/[A-Z]/.test(password)) {
      throw new Error('Mật khẩu phải có ít nhất 1 chữ cái in hoa (A-Z).')
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      throw new Error('Mật khẩu phải có ít nhất 1 ký tự đặc biệt.')
    }

    const data =
      await this.request(
        '/auth/register',
        {
          method: 'POST',

          body: JSON.stringify({
            email,
            password,
            ...additionalData,
          }),
        }
      )

    // Đăng ký local phải xác minh email trước khi đăng nhập.
    // Backend không cấp JWT tại bước này.
    return data
  }

  async verifyEmail(
    email,
    code
  ) {
    return this.request(
      '/auth/verify-email',
      {
        method: 'POST',
        body: JSON.stringify({
          email,
          code,
        }),
      }
    )
  }

  async resendVerification(
    email
  ) {
    return this.request(
      '/auth/resend-verification',
      {
        method: 'POST',
        body: JSON.stringify({
          email,
        }),
      }
    )
  }

  async requestPasswordReset(email) {
    return this.request(
      '/auth/forgot-password',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
    )
  }

  async verifyPasswordResetCode(email, code) {
    return this.request(
      '/auth/verify-reset-otp',
      {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      },
    )
  }

  async resetPassword(email, resetToken, newPassword) {
    return this.request(
      '/auth/reset-password',
      {
        method: 'POST',
        body: JSON.stringify({
          email,
          reset_token: resetToken,
          new_password: newPassword,
        }),
      },
    )
  }

  async loginWithGoogleCredential(
    credential
  ) {
    const data =
      await this.request(
        '/auth/google',
        {
          method: 'POST',

          body: JSON.stringify({
            credential,
          }),
        }
      )

    this.setTokens(
      data.access_token,
      data.refresh_token
    )

    this.currentUser =
      data.user

    return data.user
  }

  async getMe() {
    const accessToken = this.getAccessToken()

    if (!accessToken) {
      this.currentUser = null
      return null
    }

    let response = await fetch(
      `${API_BASE_URL}/auth/me`,
      {
        headers: {
          Accept:
            'application/json',

          Authorization:
            `Bearer ${accessToken}`,
        },
      }
    )

    if (
      response.status === 401 &&
      this.getRefreshToken()
    ) {
      try {
        await this.refreshAccessToken()

        const refreshedAccessToken = this.getAccessToken()

        response = await fetch(
          `${API_BASE_URL}/auth/me`,
          {
            headers: {
              Accept:
                'application/json',

              Authorization:
                `Bearer ${refreshedAccessToken}`,
            },
          }
        )
      } catch {
        this.clearSession()
        return null
      }
    }

    if (!response.ok) {
      this.clearSession()
      return null
    }

    const data =
      await response.json()

    this.currentUser =
      data.user

    return data.user
  }

  async updateMe(data = {}) {
    if (!this.accessToken) {
      throw new Error(
        'Bạn chưa đăng nhập.'
      )
    }

    let response = await fetch(
      `${API_BASE_URL}/auth/me`,
      {
        method: 'PATCH',

        headers: {
          Accept:
            'application/json',

          'Content-Type':
            'application/json',

          Authorization:
            `Bearer ${this.accessToken}`,
        },

        body: JSON.stringify(
          data
        ),
      }
    )

    if (
      response.status === 401 &&
      this.refreshToken
    ) {
      try {
        await this.refreshAccessToken()

        response = await fetch(
          `${API_BASE_URL}/auth/me`,
          {
            method: 'PATCH',

            headers: {
              Accept:
                'application/json',

              'Content-Type':
                'application/json',

              Authorization:
                `Bearer ${this.accessToken}`,
            },

            body: JSON.stringify(
              data
            ),
          }
        )
      } catch {
        this.clearSession()

        throw new Error(
          'Phiên đăng nhập đã hết hạn.'
        )
      }
    }

    const responseData =
      await response
        .json()
        .catch(() => ({}))

    if (!response.ok) {
      throw new Error(
        responseData.error ||
          responseData.message ||
          'Không thể cập nhật hồ sơ.'
      )
    }

    if (responseData.access_token) {
      this.accessToken =
        responseData.access_token

      localStorage.setItem(
        ACCESS_TOKEN_KEY,
        responseData.access_token
      )
    }

    if (responseData.user) {
      this.currentUser =
        responseData.user
    }

    return responseData
  }

  async logout() {
    try {
      if (this.accessToken) {
        await fetch(
          `${API_BASE_URL}/auth/logout`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',

              Authorization:
                `Bearer ${this.accessToken}`,
            },

            body: JSON.stringify({
              refresh_token:
                this.refreshToken,
            }),
          }
        )
      }
    } catch (error) {
      console.error(
        'Logout error:',
        error
      )
    } finally {
      this.clearSession()
    }
  }

  setTokens(
    accessToken,
    refreshToken
  ) {
    this.accessToken =
      accessToken || null

    this.refreshToken =
      refreshToken || null

    if (this.accessToken) {
      localStorage.setItem(
        ACCESS_TOKEN_KEY,
        this.accessToken
      )
    } else {
      localStorage.removeItem(
        ACCESS_TOKEN_KEY
      )
    }

    if (this.refreshToken) {
      localStorage.setItem(
        REFRESH_TOKEN_KEY,
        this.refreshToken
      )
    } else {
      localStorage.removeItem(
        REFRESH_TOKEN_KEY
      )
    }
  }

  clearTokens() {
    this.accessToken = null
    this.refreshToken = null

    localStorage.removeItem(
      ACCESS_TOKEN_KEY
    )

    localStorage.removeItem(
      REFRESH_TOKEN_KEY
    )
  }

  clearSession() {
    this.clearTokens()
    this.currentUser = null
  }

  getAccessToken() {
    const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (storedToken && storedToken !== this.accessToken) {
      this.accessToken = storedToken
    }
    return this.accessToken
  }

  getRefreshToken() {
    const storedToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (storedToken && storedToken !== this.refreshToken) {
      this.refreshToken = storedToken
    }
    return this.refreshToken
  }

  getCurrentUser() {
    return this.currentUser
  }

  isAuthenticated() {
    return Boolean(
      this.accessToken
    )
  }

  async refreshAccessToken() {
    const refreshToken = this.getRefreshToken()

    if (!refreshToken) {
      throw new Error(
        'No refresh token available'
      )
    }

    if (refreshPromise) {
      return refreshPromise
    }

    refreshPromise = (async () => {
      try {
        const data = await this.request(
          '/auth/refresh',
          {
            method: 'POST',
            body: JSON.stringify({
              refresh_token: refreshToken,
            }),
          },
        )

        if (!data.access_token || !data.refresh_token) {
          throw new Error('Phản hồi làm mới phiên không hợp lệ.')
        }

        this.setTokens(data.access_token, data.refresh_token)
        return data.access_token
      } catch (error) {
        this.clearSession()
        throw error
      } finally {
        refreshPromise = null
      }
    })()

    return refreshPromise
  }
}

export const authService =
  new AuthService()

export default AuthService

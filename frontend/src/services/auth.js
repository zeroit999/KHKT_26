const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'http://127.0.0.1:5000'

const ACCESS_TOKEN_KEY = 'zuny_access_token'
const REFRESH_TOKEN_KEY = 'zuny_refresh_token'

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
    const response = await fetch(
      `${API_BASE_URL}${path}`,
      {
        ...options,

        headers: {
          Accept:
            'application/json',

          ...(options.body
            ? {
                'Content-Type':
                  'application/json',
              }
            : {}),

          ...options.headers,
        },
      }
    )

    const data =
      await response
        .json()
        .catch(() => ({}))

    if (!response.ok) {
      throw new Error(
        data.error ||
          data.message ||
          'Có lỗi xảy ra.'
      )
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

    this.setTokens(
      data.access_token,
      data.refresh_token
    )

    this.currentUser =
      data.user

    return data.user
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
    if (!this.accessToken) {
      return null
    }

    let response = await fetch(
      `${API_BASE_URL}/auth/me`,
      {
        headers: {
          Accept:
            'application/json',

          Authorization:
            `Bearer ${this.accessToken}`,
        },
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
            headers: {
              Accept:
                'application/json',

              Authorization:
                `Bearer ${this.accessToken}`,
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
    return this.accessToken
  }

  getRefreshToken() {
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
    if (!this.refreshToken) {
      throw new Error(
        'No refresh token available'
      )
    }

    try {
      const data =
        await this.request(
          '/auth/refresh',
          {
            method: 'POST',

            body: JSON.stringify({
              refresh_token:
                this.refreshToken,
            }),
          }
        )

      if (
        !data.access_token ||
        !data.refresh_token
      ) {
        throw new Error(
          'Phản hồi làm mới phiên không hợp lệ.'
        )
      }

      this.setTokens(
        data.access_token,
        data.refresh_token
      )

      return data.access_token
    } catch (error) {
      this.clearSession()
      throw error
    }
  }
}

export const authService =
  new AuthService()

export default AuthService

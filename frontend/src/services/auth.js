/* eslint-disable no-useless-catch */
import { auth } from '../components/firebase.js'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

class AuthService {
  constructor() {
    this.currentUser = null
    this.accessToken = null
    this.refreshToken = null
  }

  async loginWithEmailPassword(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const firebaseToken = await userCredential.user.getIdToken()

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          firebase_token: firebaseToken,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to authenticate with backend')
      }

      const data = await response.json()

      this.setTokens(data.access_token, data.refresh_token)
      this.currentUser = data.user

      return data.user
    } catch (error) {
      throw error
    }
  }

  async loginWithGoogle() {
    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const firebaseToken = await result.user.getIdToken()

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          firebase_token: firebaseToken,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to authenticate with backend')
      }

      const data = await response.json()

      this.setTokens(data.access_token, data.refresh_token)
      this.currentUser = data.user

      return data.user
    } catch (error) {
      throw error
    }
  }

  async register(email, password, additionalData = {}) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const firebaseToken = await userCredential.user.getIdToken()

      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          firebase_token: firebaseToken,
          ...additionalData,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to register with backend')
      }

      const data = await response.json()

      this.setTokens(data.access_token, data.refresh_token)
      this.currentUser = data.user

      return data.user
    } catch (error) {
      throw error
    }
  }

  async logout() {
    try {
      await firebaseSignOut(auth)

      if (this.accessToken) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
          credentials: 'include',
        })
      }

      this.clearTokens()
      this.currentUser = null
    } catch (error) {
      console.error('Logout error:', error)
      this.clearTokens()
      this.currentUser = null
    }
  }

  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken
    this.refreshToken = refreshToken
  }

  clearTokens() {
    this.accessToken = null
    this.refreshToken = null
  }

  getAccessToken() {
    return this.accessToken
  }

  isAuthenticated() {
    return !!this.accessToken && !!this.currentUser
  }

  getCurrentUser() {
    return this.currentUser
  }

  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available')
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          refresh_token: this.refreshToken,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to refresh token')
      }

      const data = await response.json()

      this.accessToken = data.access_token

      return data.access_token
    } catch (error) {
      this.clearTokens()
      this.currentUser = null
      throw error
    }
  }
}

export const authService = new AuthService()
export default AuthService
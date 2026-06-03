import { initializeApp } from "firebase/app"
import { getAnalytics, isSupported } from "firebase/analytics"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"
import { getDatabase } from "firebase/database"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const requiredConfig = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
]

const exampleValues = [
  "your_api_key",
  "your_auth_domain",
  "your_project_id",
  "your_storage_bucket",
  "your_messaging_sender_id",
  "your_app_id",
  "your_measurement_id",
]

for (const key of requiredConfig) {
  const value = String(import.meta.env[key] || "").trim()

  if (!value || exampleValues.includes(value)) {
    throw new Error(`${key}=${value || "empty"}`)
  }
}

const app = initializeApp(firebaseConfig)

isSupported()
  .then((supported) => {
    if (supported && firebaseConfig.measurementId) {
      getAnalytics(app)
    }
  })
  .catch(() => {})

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const realtimeDb = getDatabase(app)

export default app
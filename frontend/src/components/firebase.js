import { initializeApp } from "firebase/app"
import { getAnalytics, isSupported } from "firebase/analytics"
import { connectAuthEmulator, getAuth } from "firebase/auth"
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore"
import { connectStorageEmulator, getStorage } from "firebase/storage"
import { connectDatabaseEmulator, getDatabase } from "firebase/database"

const localDevMode = import.meta.env.VITE_LOCAL_DEV_MODE === "true"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (localDevMode ? "demo-key" : ""),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (localDevMode ? "zuny-local.firebaseapp.com" : ""),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || (localDevMode ? "zuny-local" : ""),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (localDevMode ? "zuny-local.appspot.com" : ""),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || (localDevMode ? "123456789" : ""),
  appId: import.meta.env.VITE_FIREBASE_APP_ID || (localDevMode ? "1:123456789:web:local" : ""),
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

for (const key of localDevMode ? [] : requiredConfig) {
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

if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true })
  connectFirestoreEmulator(db, "127.0.0.1", 8080)
  connectStorageEmulator(storage, "127.0.0.1", 9199)
  connectDatabaseEmulator(realtimeDb, "127.0.0.1", 9000)
}

export default app

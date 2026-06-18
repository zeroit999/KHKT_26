import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

import { db } from '../components/firebase.js'
import { defaultSettings } from '../data/settingsData.js'

export async function getUserSettings(uid) {
  if (!uid) return defaultSettings

  const userRef = doc(db, 'users', uid)
  const snap = await getDoc(userRef)

  if (!snap.exists()) {
    await setDoc(
      userRef,
      {
        settings: defaultSettings,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )

    return defaultSettings
  }

  return {
    ...defaultSettings,
    ...(snap.data()?.settings || {}),
  }
}

export async function updateUserSetting(uid, key, value) {
  if (!uid) return

  const userRef = doc(db, 'users', uid)

  await updateDoc(userRef, {
    [`settings.${key}`]: value,
    updatedAt: serverTimestamp(),
  })
}

export async function updateUserProfileField(uid, key, value) {
  if (!uid) return

  const allowedFields = ['fullName', 'phone']

  if (!allowedFields.includes(key)) {
    throw new Error('Field này không được phép chỉnh sửa')
  }

  const userRef = doc(db, 'users', uid)

  await updateDoc(userRef, {
    [key]: value,
    updatedAt: serverTimestamp(),
  })
}
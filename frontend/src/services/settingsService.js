import { authService } from './auth'
import { defaultSettings } from '../data/settingsData.js'

export async function getUserSettings(uid) {
  if (!uid) return defaultSettings

  const user =
    await authService.getMe()

  if (!user) {
    return defaultSettings
  }

  return {
    ...defaultSettings,
    ...(user.settings || {}),
  }
}

export async function updateUserSetting(uid, key, value) {
  if (!uid) return

  const user =
    await authService.getMe()

  const currentSettings = {
    ...defaultSettings,
    ...(user?.settings || {}),
  }

  return authService.updateMe({
    settings: {
      ...currentSettings,
      [key]: value,
    },
  })
}

export async function updateUserProfileField(uid, key, value) {
  if (!uid) return

  const allowedFields = [
    'fullName',
    'phone',
  ]

  if (!allowedFields.includes(key)) {
    throw new Error(
      'Field này không được phép chỉnh sửa',
    )
  }

  return authService.updateMe({
    [key]: value,
  })
}
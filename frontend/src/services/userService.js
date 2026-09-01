import { authService } from './auth'

export const saveUserProfile = async (uid, data) => {
  if (!uid) return

  return authService.updateMe(
    data,
  )
}
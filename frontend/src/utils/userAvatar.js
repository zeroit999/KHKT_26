import defaultAvatar from '../assets/favicon-light-mode.png'

export function isGoogleAccount(user) {
  return Boolean(
    user?.providerData?.some(
      (provider) => provider.providerId === 'google.com'
    )
  )
}

export function getUserAvatar(user) {
  if (
    isGoogleAccount(user) &&
    user?.photoURL
  ) {
    return user.photoURL
  }

  return defaultAvatar
}
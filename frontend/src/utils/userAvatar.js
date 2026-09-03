import lightLogo from '../assets/favicon-light-mode.png'
import darkLogo from '../assets/favicon-dark-mode.png'

const CUSTOM_AVATAR_FIELDS = [
  'customAvatar',
  'customAvatarUrl',
  'uploadedAvatar',
  'uploadedAvatarUrl',
  'profileImage',
  'profilePicture',
  'imageUrl',
  'photoURL',
  'photoUrl',
  'avatarUrl',
  'avatar',
]

function firstNonEmpty(...values) {
  return values.find(
    (value) =>
      typeof value === 'string' &&
      value.trim()
  )?.trim() || ''
}

export function getAuthProvider(user) {
  return String(
    user?.authProvider ||
    user?.auth_provider ||
    ''
  )
    .trim()
    .toLowerCase()
}

export function isGoogleAccount(user) {
  const provider = getAuthProvider(user)

  return (
    provider === 'google' ||
    provider === 'hybrid' ||
    Boolean(user?.googleSub) ||
    Boolean(user?.google_sub) ||
    Boolean(
      user?.providerData?.some(
        (item) =>
          item?.providerId === 'google.com'
      )
    )
  )
}

export function getCustomAvatar(user) {
  if (!user) return ''

  for (const field of CUSTOM_AVATAR_FIELDS) {
    const value = user?.[field]

    if (
      typeof value === 'string' &&
      value.trim()
    ) {
      return value.trim()
    }
  }

  return ''
}

export function getGoogleAvatar(user) {
  if (!isGoogleAccount(user)) {
    return ''
  }

  return firstNonEmpty(
    user?.googlePhotoURL,
    user?.google_photo_url,
    user?.picture,
    user?.photoURL,
    user?.photoUrl
  )
}

export function getZunyDefaultAvatar(
  darkMode = null
) {
  const resolvedDarkMode =
    typeof darkMode === 'boolean'
      ? darkMode
      : (
          typeof document !== 'undefined' &&
          document.documentElement.classList.contains('dark')
        )

  return resolvedDarkMode
    ? darkLogo
    : lightLogo
}

export function getUserAvatar(
  user,
  darkMode = null
) {
  const customAvatar =
    getCustomAvatar(user)

  if (customAvatar) {
    return customAvatar
  }

  const googleAvatar =
    getGoogleAvatar(user)

  if (googleAvatar) {
    return googleAvatar
  }

  return getZunyDefaultAvatar(darkMode)
}

export function usesZunyDefaultAvatar(user) {
  return (
    !getCustomAvatar(user) &&
    !getGoogleAvatar(user)
  )
}

import { Bell, Globe2, Lock, Palette, User } from 'lucide-react'

export const defaultSettings = {
  notifications: true,
  emailNotifications: true,
  examReminder: true,
  forumNotification: true,

  darkMode: false,
  compactMode: false,
  animations: true,

  twoFactor: false,
  loginAlert: true,
  publicProfile: true,

  language: 'vi',
}

export const settingsTabs = [
  { id: 'account', label: 'Tài khoản', icon: User },
  { id: 'notifications', label: 'Thông báo', icon: Bell },
  { id: 'security', label: 'Bảo mật', icon: Lock },
  { id: 'appearance', label: 'Giao diện', icon: Palette },
  { id: 'language', label: 'Ngôn ngữ', icon: Globe2 },
]
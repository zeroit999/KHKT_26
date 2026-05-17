import {
  BookOpen,
  Camera,
  Edit3,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  School,
  Shield,
  User,
} from 'lucide-react'

import { doc, updateDoc } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { db } from '../firebase'
import { useAuth } from '../../contexts/AuthContext'
import defaultAvatar from '../../assets/favicon-light-mode.png'

function InfoRow({
  icon: Icon,
  label,
  value,
  name,
  isEditing,
  onChange,
  iconColor = '#6366F1',
  theme,
  readOnly = false,
}) {
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: theme.iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={18} color={iconColor} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            color: theme.mutedText,
            fontWeight: 500,
            marginBottom: 2,
          }}
        >
          {label}
        </div>

        {isEditing && name && !readOnly ? (
          (
          <input
            name={name}
            value={value || ''}
            onChange={onChange}
            style={{
              width: '100%',
              fontSize: 14,
              fontWeight: 600,
              color: theme.text,
              border: `1.5px solid ${theme.border}`,
              borderRadius: 8,
              padding: '4px 10px',
              outline: 'none',
              background: theme.inputBg,
              boxSizing: 'border-box',
            }}
          />
          )
        ) : (
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: theme.text,
              wordBreak: 'break-word',
            }}
          >
            {value || '—'}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Profile() {
  const { user, userDetails, refreshUserData } = useAuth()

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [coverPreview, setCoverPreview] = useState('')
  const [isDark, setIsDark] = useState(false)

  const [profileData, setProfileData] = useState({
    fullName: '',
    bio: '',
    phone: '',
    school: '',
    className: '',
    subject: '',
    city: '',
    learningStreak: 0,
    points: 0,
    role: 'STUDENT',
    avatar: defaultAvatar,
    coverPhoto: '',
  })

  useEffect(() => {
    const checkDarkMode = () => {
      const html = document.documentElement
      const body = document.body

      setIsDark(
        html.classList.contains('dark') ||
          body.classList.contains('dark') ||
          html.getAttribute('data-theme') === 'dark' ||
          body.getAttribute('data-theme') === 'dark' ||
          window.matchMedia?.('(prefers-color-scheme: dark)').matches
      )
    }

    checkDarkMode()

    const observer = new MutationObserver(checkDarkMode)

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    })

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    })

    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    media?.addEventListener?.('change', checkDarkMode)

    return () => {
      observer.disconnect()
      media?.removeEventListener?.('change', checkDarkMode)
    }
  }, [])

  const theme = useMemo(() => {
    if (isDark) {
      return {
        pageBg: '#0B1020',
        cardBg: '#111827',
        inputBg: '#0F172A',
        iconBg: '#1F2937',
        text: '#F9FAFB',
        subText: '#CBD5E1',
        mutedText: '#94A3B8',
        border: '#334155',
        shadow: '0 2px 16px rgba(0,0,0,0.35)',
        shadowSm: '0 2px 8px rgba(0,0,0,0.35)',
        cancelBg: '#1F2937',
        cancelText: '#CBD5E1',
        badgeBg: '#1E1B4B',
        badgeText: '#C7D2FE',
        pointsBg: '#422006',
        pointsText: '#FDE68A',
      }
    }

    return {
      pageBg: '#F3F4F8',
      cardBg: '#FFFFFF',
      inputBg: '#FFFFFF',
      iconBg: '#F5F5FA',
      text: '#111827',
      subText: '#6B7280',
      mutedText: '#9CA3AF',
      border: '#E5E7EB',
      shadow: '0 2px 16px rgba(0,0,0,0.08)',
      shadowSm: '0 2px 8px rgba(0,0,0,0.12)',
      cancelBg: '#F3F4F8',
      cancelText: '#6B7280',
      badgeBg: '#EEF2FF',
      badgeText: '#4338CA',
      pointsBg: '#FEF9C3',
      pointsText: '#92400E',
    }
  }, [isDark])

  useEffect(() => {
    if (userDetails) {
      setProfileData({
        fullName: userDetails.fullName || user?.displayName || '',
        bio: userDetails.bio || '',
        phone: userDetails.phone || '',
        school: userDetails.school || '',
        className: userDetails.className || '',
        subject: userDetails.subject || '',
        city: userDetails.city || '',
        learningStreak: userDetails.learningStreak || 0,
        points: userDetails.points || 0,
        role: userDetails.role || 'STUDENT',
        avatar:
          userDetails.avatar ||
          userDetails.photoURL ||
          user?.photoURL ||
          defaultAvatar,
        coverPhoto: userDetails.coverPhoto || '',
      })
    }
  }, [userDetails, user])

  useEffect(() => {
    setAvatarPreview(profileData.avatar || '')
    setCoverPreview(profileData.coverPhoto || '')
  }, [profileData.avatar, profileData.coverPhoto])

  const isTeacher =
    profileData.role?.trim()?.toUpperCase() === 'TEACHER'

  const avatarSrc = useMemo(() => {
    if (userDetails?.avatar) return userDetails.avatar
    if (userDetails?.photoURL) return userDetails.photoURL
    if (user?.photoURL) return user.photoURL
    return defaultAvatar
  }, [user, userDetails])

  const handleChange = (e) => {
    const { name, value } = e.target
    setProfileData((prev) => ({ ...prev, [name]: value }))
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    setAvatarPreview(url)
    setProfileData((prev) => ({ ...prev, avatar: url }))
  }

  const handleCoverChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    setCoverPreview(url)
    setProfileData((prev) => ({ ...prev, coverPhoto: url }))
  }

  const handleSave = async () => {
    if (!user?.uid) {
      toast.error('Không tìm thấy người dùng')
      return
    }

    try {
      setIsSaving(true)

      const dataToSave = {
        ...profileData,
      }

      const userRef = doc(db, 'users', user.uid)

      await updateDoc(userRef, dataToSave)

      if (refreshUserData) await refreshUserData()

      toast.success('Đã cập nhật thông tin')

      setIsEditing(false)
    } catch (error) {
      console.error(error)
      toast.error('Cập nhật thất bại')
    } finally {
      setIsSaving(false)
    }
  }

  const page = {
    minHeight: '100vh',
    background: theme.pageBg,
    padding: '24px 16px',
    fontFamily: "'Be Vietnam Pro', 'Segoe UI', sans-serif",
    transition: 'background 0.2s ease',
  }

  const container = {
    maxWidth: 900,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  }

  const card = {
    background: theme.cardBg,
    borderRadius: 20,
    padding: 24,
    boxShadow: theme.shadow,
    border: `1px solid ${
      isDark ? theme.border : 'transparent'
    }`,
  }

  return (
    <div style={page}>
      <div style={container}>
        <div
          style={{
            background: theme.cardBg,
            borderRadius: 24,
            overflow: 'hidden',
            boxShadow: theme.shadow,
            border: `1px solid ${
              isDark ? theme.border : 'transparent'
            }`,
          }}
        >
          <div style={{ position: 'relative', height: 180 }}>
            {coverPreview ? (
              <img
                src={coverPreview}
                alt="cover"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background:
                    'linear-gradient(135deg, #6366F1 0%, #8B5CF6 40%, #EC4899 80%, #F43F5E 100%)',
                }}
              />
            )}

            {isEditing && (
              <label
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: 'rgba(0,0,0,0.45)',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '6px 14px',
                  cursor: 'pointer',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  backdropFilter: 'blur(6px)',
                }}
              >
                <Camera size={15} /> Đổi ảnh bìa
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleCoverChange}
                />
              </label>
            )}
          </div>

          <div
            style={{
              padding: '0 28px 24px',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'relative',
                display: 'inline-block',
                marginTop: -48,
              }}
            >
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  border: `4px solid ${theme.cardBg}`,
                  background:
                    'linear-gradient(135deg, #6366F1, #EC4899)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                }}
              >
                {avatarPreview || avatarSrc ? (
                  <img
                    src={avatarPreview || avatarSrc}
                    alt="avatar"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <GraduationCap size={40} color="#fff" />
                )}
              </div>

              {isEditing && (
                <label
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    right: 2,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#6366F1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    border: `2px solid ${theme.cardBg}`,
                    boxShadow:
                      '0 2px 6px rgba(0,0,0,0.2)',
                  }}
                >
                  <Edit3 size={13} color="#fff" />
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleAvatarChange}
                  />
                </label>
              )}
            </div>

            <div
              style={{
                marginTop: 12,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1 }}>
                {isEditing ? (
                  <input
                    name="fullName"
                    value={profileData.fullName || ''}
                    onChange={handleChange}
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: theme.text,
                      border: `1.5px solid ${theme.border}`,
                      borderRadius: 8,
                      padding: '4px 10px',
                      outline: 'none',
                      width: '100%',
                      marginBottom: 8,
                      background: theme.inputBg,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: theme.text,
                      marginBottom: 6,
                    }}
                  >
                    {profileData.fullName ||
                      user?.displayName ||
                      'Tên người dùng'}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      background: theme.pointsBg,
                      color: theme.pointsText,
                      borderRadius: 20,
                      padding: '3px 12px',
                      fontSize: 13,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    ⭐ {profileData.points} Points
                  </span>

                  <span
                    style={{
                      background: theme.badgeBg,
                      color: theme.badgeText,
                      borderRadius: 20,
                      padding: '3px 12px',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {isTeacher
                      ? '👨‍🏫 Giáo viên'
                      : '🎓 Học sinh'}
                  </span>
                </div>

                {isEditing ? (
                  <textarea
                    name="bio"
                    value={profileData.bio || ''}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Giới thiệu bản thân..."
                    style={{
                      width: '100%',
                      fontSize: 14,
                      color: theme.subText,
                      border: `1.5px solid ${theme.border}`,
                      borderRadius: 8,
                      padding: '6px 10px',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                      background: theme.inputBg,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      fontSize: 14,
                      color: theme.subText,
                      lineHeight: 1.6,
                      maxWidth: 540,
                    }}
                  >
                    {profileData.bio ||
                      'Tôi là một người yêu thích khoa học và học tập, luôn tìm kiếm cơ hội để khám phá những điều mới mẻ và phát triển bản thân.'}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  flexShrink: 0,
                }}
              >
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    style={{
                      background: '#6366F1',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 12,
                      padding: '10px 22px',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Edit3 size={16} /> Chỉnh sửa
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      style={{
                        background: theme.cancelBg,
                        color: theme.cancelText,
                        border: `1px solid ${theme.border}`,
                        borderRadius: 12,
                        padding: '10px 18px',
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: 'pointer',
                      }}
                    >
                      Huỷ
                    </button>

                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      style={{
                        background: '#10B981',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 12,
                        padding: '10px 22px',
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: 'pointer',
                        opacity: isSaving ? 0.7 : 1,
                      }}
                    >
                      {isSaving
                        ? 'Đang lưu...'
                        : 'Lưu thay đổi'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 20,
          }}
        >
          <div style={card}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: theme.badgeBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Mail size={16} color="#6366F1" />
              </div>

              <div
                style={{
                  fontWeight: 800,
                  fontSize: 16,
                  color: theme.text,
                }}
              >
                Thông tin liên hệ
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <InfoRow
                icon={Mail}
                label="Email"
                value={user?.email}
                isEditing={false}
                theme={theme}
              />

              <InfoRow
                icon={Phone}
                label="Số điện thoại"
                value={profileData.phone}
                name="phone"
                isEditing={isEditing}
                onChange={handleChange}
                theme={theme}
                readOnly={true}
              />


              <InfoRow
                icon={MapPin}
                label="Thành phố"
                value={profileData.city}
                name="city"
                isEditing={isEditing}
                onChange={handleChange}
                theme={theme}
                readOnly={true}
              />
            </div>
          </div>

          <div style={card}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: theme.badgeBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <User size={16} color="#6366F1" />
              </div>

              <div
                style={{
                  fontWeight: 800,
                  fontSize: 16,
                  color: theme.text,
                }}
              >
                Thông tin cá nhân
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <InfoRow
                icon={User}
                label="Họ tên"
                value={profileData.fullName}
                name="fullName"
                isEditing={isEditing}
                onChange={handleChange}
                theme={theme}
              />

              <InfoRow
                icon={School}
                label="Trường"
                value={profileData.school}
                name="school"
                isEditing={isEditing}
                onChange={handleChange}
                theme={theme}
              />


              <InfoRow
                icon={
                  isTeacher
                    ? BookOpen
                    : GraduationCap
                }
                label={
                  isTeacher
                    ? 'Chuyên môn'
                    : 'Lớp'
                }
                value={
                  isTeacher
                    ? profileData.subject
                    : profileData.className
                }
                name={
                  isTeacher
                    ? 'subject'
                    : 'className'
                }
                isEditing={isEditing}
                onChange={handleChange}
                theme={theme}
                readOnly={isTeacher}
              />

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
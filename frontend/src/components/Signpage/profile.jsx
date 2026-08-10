import {
  BookOpen,
  Camera,
  Edit3,
  Flame,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Save,
  School,
  User,
  X,
} from 'lucide-react'

import {
  doc,
  updateDoc,
} from 'firebase/firestore'

import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from 'firebase/storage'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import toast from 'react-hot-toast'

import { db } from '../firebase'

import {
  useAuth,
} from '../../contexts/AuthContext'

import defaultAvatar from '../../assets/favicon-light-mode.png'

import InfoRow from './profile/InfoRow'

import {
  normalizeProfileData,
  validateImage,
} from './profile/profileUtils'

import {
  getProfileTheme,
} from './profile/profileTheme'

import {
  getUserAvatar,
} from '../../utils/userAvatar'

import './profile/profile.css'

export default function Profile() {
  const {
    user,
    userDetails,
    refreshUserData,
  } = useAuth()

  const storage = useMemo(
    () => getStorage(),
    []
  )

  const coverInputRef =
    useRef(null)

  const [
    isEditing,
    setIsEditing,
  ] = useState(false)

  const [
    isSaving,
    setIsSaving,
  ] = useState(false)

  const [
    isUploadingCover,
    setIsUploadingCover,
  ] = useState(false)

  /* =====================================================
     DARK MODE

     Chỉ đồng bộ với class .dark mà ZUNY đang sử dụng.

     Không dùng:
     - prefers-color-scheme
     - body.dark
     - data-theme

     => Không bị lệch với Navbar.
  ===================================================== */

  const [
    isDark,
    setIsDark,
  ] = useState(() => {
    if (
      typeof document ===
      'undefined'
    ) {
      return false
    }

    return document
      .documentElement
      .classList
      .contains('dark')
  })

  const [
    profileData,
    setProfileData,
  ] = useState(() =>
    normalizeProfileData(
      null,
      null
    )
  )

  /* =====================================================
     SYNC DARK MODE
  ===================================================== */

  useEffect(() => {
    const html =
      document.documentElement

    const syncDarkMode = () => {
      setIsDark(
        html.classList.contains(
          'dark'
        )
      )
    }

    syncDarkMode()

    const observer =
      new MutationObserver(
        syncDarkMode
      )

    observer.observe(
      html,
      {
        attributes: true,
        attributeFilter: [
          'class',
        ],
      }
    )

    return () => {
      observer.disconnect()
    }
  }, [])

  const theme = useMemo(
    () =>
      getProfileTheme(
        isDark
      ),
    [isDark]
  )

  /* =====================================================
     FIREBASE -> PROFILE
  ===================================================== */

  useEffect(() => {
    if (
      !user &&
      !userDetails
    ) {
      return
    }

    setProfileData(
      normalizeProfileData(
        user,
        userDetails
      )
    )
  }, [
    user,
    userDetails,
  ])

  /* =====================================================
     ROLE

     Role chỉ dùng để quyết định UI.
     Không cho phép sửa role.
  ===================================================== */

  const isTeacher =
    profileData.role
      ?.trim()
      ?.toUpperCase() ===
    'TEACHER'

  /* =====================================================
     AVATAR

     Google:
       Firebase Auth user.photoURL

     Email/password:
       Logo ZUNY
  ===================================================== */

  const avatarSrc =
    getUserAvatar(user)

  /* =====================================================
     HERO IMAGE
  ===================================================== */

  const heroImage =
    profileData.coverPhoto ||
    avatarSrc

  /* =====================================================
     INPUT
  ===================================================== */

  const handleChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target

    setProfileData(
      (previous) => ({
        ...previous,
        [name]: value,
      })
    )
  }

  /* =====================================================
     COVER PHOTO
  ===================================================== */

  const handleCoverChange =
    async (event) => {
      const file =
        event.target
          .files?.[0]

      event.target.value =
        ''

      if (!file) {
        return
      }

      if (!user?.uid) {
        toast.error(
          'Không tìm thấy người dùng'
        )

        return
      }

      const validation =
        validateImage(file)

      if (
        !validation.valid
      ) {
        if (
          validation.message
        ) {
          toast.error(
            validation.message
          )
        }

        return
      }

      try {
        setIsUploadingCover(
          true
        )

        const extension =
          file.name
            .split('.')
            .pop()
            ?.toLowerCase() ||
          'jpg'

        const storageRef =
          ref(
            storage,
            `users/${user.uid}/profile/cover.${extension}`
          )

        await uploadBytes(
          storageRef,
          file,
          {
            contentType:
              file.type,
          }
        )

        const downloadURL =
          await getDownloadURL(
            storageRef
          )

        const userRef =
          doc(
            db,
            'users',
            user.uid
          )

        await updateDoc(
          userRef,
          {
            coverPhoto:
              downloadURL,
          }
        )

        setProfileData(
          (previous) => ({
            ...previous,
            coverPhoto:
              downloadURL,
          })
        )

        if (
          refreshUserData
        ) {
          await refreshUserData()
        }

        toast.success(
          'Đã cập nhật ảnh bìa'
        )
      } catch (error) {
        console.error(
          'Upload cover error:',
          error
        )

        toast.error(
          'Không thể cập nhật ảnh bìa'
        )
      } finally {
        setIsUploadingCover(
          false
        )
      }
    }

  /* =====================================================
     SAVE PROFILE

     ĐƯỢC SỬA:
     - fullName
     - bio
     - phone
     - grade (học sinh)

     KHÔNG ĐƯỢC SỬA:
     - email
     - city
     - school
     - subject
     - role
     - points
     - learningStreak
     - avatar

     Học sinh không còn cập nhật className.
  ===================================================== */

  const handleSave =
    async () => {
      if (!user?.uid) {
        toast.error(
          'Không tìm thấy người dùng'
        )

        return
      }

      try {
        setIsSaving(true)

        const userRef =
          doc(
            db,
            'users',
            user.uid
          )

        const dataToSave = {
          fullName:
            profileData
              .fullName
              .trim(),

          bio:
            profileData
              .bio
              .trim(),

          phone:
            profileData
              .phone
              .trim(),
        }

        /*
         * Chỉ học sinh mới chỉnh Khối.
         */
        if (!isTeacher) {
          const grade =
            profileData
              .grade
              .trim()

          dataToSave.grade =
            grade

          dataToSave.khoi =
            grade

          dataToSave.gradeLevel =
            grade

          dataToSave.studentGrade =
            grade
        }

        await updateDoc(
          userRef,
          dataToSave
        )

        if (
          refreshUserData
        ) {
          await refreshUserData()
        }

        setIsEditing(false)

        toast.success(
          'Đã cập nhật thông tin'
        )
      } catch (error) {
        console.error(
          'Update profile error:',
          error
        )

        toast.error(
          'Cập nhật thông tin thất bại'
        )
      } finally {
        setIsSaving(false)
      }
    }

  /* =====================================================
     CANCEL
  ===================================================== */

  const handleCancelEdit =
    () => {
      setProfileData(
        normalizeProfileData(
          user,
          userDetails
        )
      )

      setIsEditing(false)
    }

  return (
    <div
      className="zuny-profile-page"

      style={{
        '--zuny-profile-page-bg': theme.pageBg,
        '--zuny-profile-glow': theme.glow,

        background:
          theme.pageBg,

        fontFamily:
          "'Be Vietnam Pro', 'Segoe UI', sans-serif",

        transition:
          'background 0.25s ease',
      }}
    >
      {/* =================================================
          FULL-VIEWPORT BACKGROUND
          Phủ kín cả vùng phía sau Dynamic Navbar, kể cả khi
          layout cha đang chừa khoảng trống cho navbar fixed.
      ================================================= */}

      <div className="zuny-profile-backdrop" />

      {/* =================================================
          BACKGROUND GRID
      ================================================= */}

      <div
        className="zuny-profile-grid"

        style={{
          opacity:
            isDark
              ? 0.12
              : 0.045,
        }}
      />

      {/* =================================================
          BACKGROUND GLOW
      ================================================= */}

      <div
        className="zuny-profile-glow"

        style={{
          background:
            theme.glow,
        }}
      />

      {/* =================================================
          PROFILE CARD
      ================================================= */}

      <div
        className="zuny-profile-card"

        style={{
          border:
            `1px solid ${theme.border}`,

          background:
            theme.panelSolid,

          boxShadow:
            isDark
              ? '0 30px 90px rgba(0,0,0,0.34)'
              : '0 30px 90px rgba(15,23,42,0.10)',

          transition:
            'background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
        }}
      >
        {/* =================================================
            LEFT SIDE
        ================================================= */}

        <section
          className="zuny-profile-left"
        >
          <img
            className="zuny-profile-cover"

            src={
              heroImage
            }

            alt={
              profileData.fullName ||
              'Profile'
            }

            referrerPolicy="no-referrer"

            onError={(
              event
            ) => {
              event.currentTarget.onerror =
                null

              event.currentTarget.src =
                defaultAvatar
            }}
          />

          <div
            className="zuny-profile-left-overlay"
          />

          {/* ROLE BADGE */}

          <div
            className="zuny-profile-role-badge"

            style={{
              background:
                isTeacher
                  ? 'rgba(52,65,95,0.72)'
                  : 'rgba(3,59,87,0.72)',
            }}
          >
            <span
              className="zuny-profile-role-dot"

              style={{
                background:
                  isTeacher
                    ? '#4ADE80'
                    : '#38BDF8',

                boxShadow:
                  isTeacher
                    ? '0 0 15px rgba(74,222,128,.9)'
                    : '0 0 15px rgba(56,189,248,.9)',
              }}
            />

            {isTeacher
              ? 'Giáo viên'
              : 'Học sinh'}
          </div>

          {/* CHANGE COVER */}

          {isEditing && (
            <>
              <button
                type="button"

                className="zuny-profile-cover-button"

                disabled={
                  isUploadingCover
                }

                onClick={() =>
                  coverInputRef
                    .current
                    ?.click()
                }

                style={{
                  opacity:
                    isUploadingCover
                      ? 0.7
                      : 1,

                  cursor:
                    isUploadingCover
                      ? 'wait'
                      : 'pointer',
                }}
              >
                <Camera
                  size={15}
                />

                {isUploadingCover
                  ? 'Đang tải...'
                  : 'Đổi ảnh bìa'}
              </button>

              <input
                ref={
                  coverInputRef
                }

                type="file"

                accept="image/jpeg,image/png,image/webp"

                hidden

                onChange={
                  handleCoverChange
                }
              />
            </>
          )}

          {/* LEFT NAME */}

          <div
            className="zuny-profile-left-info"
          >
            <h1
              className="zuny-profile-left-name"
            >
              {profileData.fullName ||
                user?.displayName ||
                'Chưa cập nhật tên'}
            </h1>

            <div
              className="zuny-profile-left-subtitle"
            >
              {profileData.bio ||
                (isTeacher
                  ? 'Giáo viên'
                  : 'Học sinh')}
            </div>
          </div>
        </section>

        {/* =================================================
            RIGHT SIDE
        ================================================= */}

        <section
          className="zuny-profile-right"

          style={{
            background:
              theme.panel,

            transition:
              'background 0.25s ease',
          }}
        >
          {/* SECTION TITLE */}

          <div
            className="zuny-profile-section-label"

            style={{
              color:
                theme.label,
            }}
          >
            Thông tin cá nhân
          </div>

          {/* =================================================
              IDENTITY
          ================================================= */}

          <div
            className="zuny-profile-identity"
          >
            {/* AVATAR */}

            <div
              className="zuny-profile-avatar-wrapper"
            >
              <div
                className="zuny-profile-avatar-border"

                style={{
                  background:
                    isTeacher
                      ? 'linear-gradient(135deg,#8B5CF6,#6D28D9)'
                      : 'linear-gradient(135deg,#38BDF8,#2563EB)',

                  boxShadow:
                    isTeacher
                      ? '0 0 0 4px rgba(139,92,246,0.12)'
                      : '0 0 0 4px rgba(56,189,248,0.12)',
                }}
              >
                <div
                  className="zuny-profile-avatar-inner"

                  style={{
                    border:
                      isDark
                        ? '3px solid #211A3E'
                        : '3px solid #FFFFFF',
                  }}
                >
                  <img
                    className="zuny-profile-avatar-image"

                    src={
                      avatarSrc
                    }

                    alt={
                      profileData.fullName ||
                      'Avatar'
                    }

                    referrerPolicy="no-referrer"

                    onError={(
                      event
                    ) => {
                      event.currentTarget.onerror =
                        null

                      event.currentTarget.src =
                        defaultAvatar
                    }}
                  />
                </div>
              </div>
            </div>

            {/* NAME */}

            <div
              className="zuny-profile-name-wrapper"
            >
              {isEditing ? (
                <input
                  name="fullName"

                  value={
                    profileData.fullName
                  }

                  onChange={
                    handleChange
                  }

                  placeholder="Họ và tên"

                  className="zuny-profile-name-input"

                  style={{
                    border:
                      `1px solid ${theme.inputBorder}`,

                    background:
                      theme.inputBg,

                    color:
                      theme.text,
                  }}
                />
              ) : (
                <h2
                  className="zuny-profile-name"

                  style={{
                    color:
                      theme.text,
                  }}
                >
                  {profileData.fullName ||
                    user?.displayName ||
                    'Chưa cập nhật tên'}
                </h2>
              )}

              <span
                className="zuny-profile-role-small"

                style={{
                  border:
                    isTeacher
                      ? '1px solid rgba(139,92,246,0.30)'
                      : '1px solid rgba(14,165,233,0.30)',

                  background:
                    isTeacher
                      ? 'rgba(124,58,237,0.10)'
                      : 'rgba(14,165,233,0.10)',

                  color:
                    isTeacher
                      ? '#A78BFA'
                      : '#38BDF8',
                }}
              >
                {isTeacher
                  ? '👨‍🏫 Giáo viên'
                  : '🎓 Học sinh'}
              </span>
            </div>

            {/* ACTIONS */}

            <div
              className="zuny-profile-actions"
            >
              {!isEditing ? (
                <button
                  type="button"

                  className="zuny-profile-button"

                  onClick={() =>
                    setIsEditing(
                      true
                    )
                  }

                  style={{
                    border:
                      'none',

                    background:
                      '#7C3AED',

                    color:
                      '#FFFFFF',

                    boxShadow:
                      '0 7px 20px rgba(124,58,237,0.25)',
                  }}
                >
                  <Edit3
                    size={14}
                  />

                  Chỉnh sửa
                </button>
              ) : (
                <>
                  <button
                    type="button"

                    className="zuny-profile-button"

                    disabled={
                      isSaving
                    }

                    onClick={
                      handleCancelEdit
                    }

                    style={{
                      border:
                        `1px solid ${theme.border}`,

                      background:
                        theme.buttonSecondary,

                      color:
                        theme.buttonSecondaryText,
                    }}
                  >
                    <X
                      size={14}
                    />

                    Huỷ
                  </button>

                  <button
                    type="button"

                    className="zuny-profile-button"

                    disabled={
                      isSaving
                    }

                    onClick={
                      handleSave
                    }

                    style={{
                      border:
                        'none',

                      background:
                        '#10B981',

                      color:
                        '#FFFFFF',

                      opacity:
                        isSaving
                          ? 0.7
                          : 1,

                      cursor:
                        isSaving
                          ? 'wait'
                          : 'pointer',
                    }}
                  >
                    <Save
                      size={14}
                    />

                    {isSaving
                      ? 'Đang lưu'
                      : 'Lưu'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* DIVIDER */}

          <div
            className="zuny-profile-divider"

            style={{
              background:
                theme.divider,
            }}
          />

          {/* =================================================
              INFORMATION

              1 CỘT — KHÔNG CHIA GRID 2 CỘT
          ================================================= */}

          <div
            className="zuny-profile-information"
          >
            <div
              className="zuny-profile-info-grid"
            >
              {/* EMAIL — LOCK */}

              <InfoRow
                icon={
                  Mail
                }

                label="Email"

                value={
                  user?.email ||
                  ''
                }

                readOnly

                isEditing={
                  isEditing
                }

                theme={
                  theme
                }

                accentColor={
                  isDark
                    ? '#8C83A5'
                    : '#64748B'
                }
              />

              {/* PHONE — EDITABLE */}

              <InfoRow
                icon={
                  Phone
                }

                label="Số điện thoại"

                value={
                  profileData.phone
                }

                name="phone"

                isEditing={
                  isEditing
                }

                onChange={
                  handleChange
                }

                theme={
                  theme
                }

                placeholder="Nhập số điện thoại"

                accentColor="#C43B91"
              />

              {/* SCHOOL — LOCK */}

              <InfoRow
                icon={
                  School
                }

                label={
                  isTeacher
                    ? 'Đơn vị / Trường'
                    : 'Trường theo học'
                }

                value={
                  profileData.school
                }

                readOnly

                isEditing={
                  isEditing
                }

                theme={
                  theme
                }

                accentColor="#7C5CC4"
              />

              {/* CITY — LOCK */}

              <InfoRow
                icon={
                  MapPin
                }

                label="Tỉnh / Thành phố"

                value={
                  profileData.city
                }

                readOnly

                isEditing={
                  isEditing
                }

                theme={
                  theme
                }

                accentColor="#C43B91"
              />

              {/* TEACHER / STUDENT */}

              {isTeacher ? (
                /* TEACHER SUBJECT — LOCK */

                <InfoRow
                  icon={
                    BookOpen
                  }

                  label="Chuyên môn"

                  value={
                    profileData.subject
                  }

                  readOnly

                  isEditing={
                    isEditing
                  }

                  theme={
                    theme
                  }

                  accentColor="#8B5CF6"
                />
              ) : (
                /* STUDENT — ONLY GRADE */

                <InfoRow
                  icon={
                    GraduationCap
                  }

                  label="Khối"

                  value={
                    profileData.grade
                  }

                  name="grade"

                  isEditing={
                    isEditing
                  }

                  onChange={
                    handleChange
                  }

                  theme={
                    theme
                  }

                  placeholder="Ví dụ: 12"

                  accentColor="#4F6DE0"
                />
              )}

              {/* BIO */}

              <InfoRow
                icon={
                  User
                }

                label="Giới thiệu bản thân"

                value={
                  profileData.bio
                }

                name="bio"

                isEditing={
                  isEditing
                }

                onChange={
                  handleChange
                }

                theme={
                  theme
                }

                multiline

                placeholder="Giới thiệu bản thân..."

                accentColor="#8B5CF6"
              />
            </div>
          </div>

          {/* =================================================
              STATS
          ================================================= */}

          {!isTeacher && (
            <div
              className="zuny-profile-stats"

              style={{
                borderTop:
                  `1px solid ${theme.divider}`,
              }}
            >
              <div
                className="zuny-profile-stat-card"

                style={{
                  border:
                    `1px solid ${theme.border}`,

                  background:
                    isDark
                      ? 'rgba(255,255,255,0.035)'
                      : 'rgba(255,255,255,0.60)',
                }}
              >
                <Flame
                  size={18}

                  color="#F97316"
                />

                <div>
                  <div
                    style={{
                      color:
                        theme.label,

                      fontSize:
                        10,

                      fontWeight:
                        800,

                      textTransform:
                        'uppercase',

                      letterSpacing:
                        '0.05em',
                    }}
                  >
                    Learning Streak
                  </div>

                  <div
                    style={{
                      marginTop:
                        2,

                      color:
                        theme.text,

                      fontWeight:
                        800,

                      fontSize:
                        15,
                    }}
                  >
                    {
                      profileData.learningStreak
                    }{' '}
                    ngày
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
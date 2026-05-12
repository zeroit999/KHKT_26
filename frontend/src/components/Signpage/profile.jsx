import {
  BookOpen,
  Edit3,
  Mail,
  Shield,
  Trophy,
  User,
} from 'lucide-react'

import {
  doc,
  updateDoc,
} from 'firebase/firestore'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import toast from 'react-hot-toast'

import { db } from '../firebase'

import { useAuth } from '../../contexts/AuthContext'

import reactLogo from '../../assets/react.svg'

export default function Profile() {
  const {
    user,
    userDetails,
    refreshUserData,
  } = useAuth()

  // =========================
  // DARKMODE REALTIME
  // =========================
  const [darkMode, setDarkMode] =
    useState(
      document.documentElement.classList.contains(
        'dark'
      )
    )

  useEffect(() => {
    const observer =
      new MutationObserver(() => {
        setDarkMode(
          document.documentElement.classList.contains(
            'dark'
          )
        )
      })

    observer.observe(
      document.documentElement,
      {
        attributes: true,
        attributeFilter: ['class'],
      }
    )

    return () =>
      observer.disconnect()
  }, [])

  const [isEditing, setIsEditing] =
    useState(false)

  const [isSaving, setIsSaving] =
    useState(false)

  const [profileData, setProfileData] =
    useState({
      fullName: '',
      phone: '',
      school: '',
      className: '',
      subject: '',
      city: '',
      address: '',
      facebook: '',
      bio: '',
      learningStreak: 0,
      points: 0,
      role: 'STUDENT',
    })

  // =========================
  // LOAD USER DATA
  // =========================
  useEffect(() => {
    if (userDetails) {
      setProfileData({
        fullName:
          userDetails.fullName ||
          user?.displayName ||
          '',

        phone:
          userDetails.phone ||
          '',

        school:
          userDetails.school ||
          '',

        className:
          userDetails.className ||
          '',

        subject:
          userDetails.subject ||
          '',

        city:
          userDetails.city ||
          '',

        address:
          userDetails.address ||
          userDetails.schoolAddress ||
          '',

        facebook:
          userDetails.facebook ||
          '',

        bio:
          userDetails.bio ||
          '',

        learningStreak:
          userDetails.learningStreak ||
          userDetails.streak ||
          0,

        points:
          userDetails.points ||
          0,

        role:
          userDetails.role ||
          'STUDENT',
      })
    }
  }, [userDetails, user])

  const isTeacher =
    profileData.role ===
    'TEACHER'

  // =========================
  // AVATAR
  // =========================
  const avatarSrc = useMemo(() => {
    if (
      user?.photoURL
    ) {
      return user.photoURL
    }

    if (
      userDetails?.avatar
    ) {
      return userDetails.avatar
    }

    return reactLogo
  }, [user, userDetails])

  // =========================
  // INPUT CHANGE
  // =========================
  const handleChange = (
    e
  ) => {
    const {
      name,
      value,
    } = e.target

    setProfileData(
      (prev) => ({
        ...prev,
        [name]:
          value,
      })
    )
  }

  // =========================
  // SAVE
  // =========================
  const handleSave =
    async () => {
      try {
        setIsSaving(
          true
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
            fullName:
              profileData.fullName,

            phone:
              profileData.phone,

            school:
              profileData.school,

            className:
              profileData.className,

            subject:
              profileData.subject,

            city:
              profileData.city,

            address:
              profileData.address,

            facebook:
              profileData.facebook,

            bio:
              profileData.bio,
          }
        )

        await refreshUserData()

        toast.success(
          'Đã cập nhật thông tin'
        )

        setIsEditing(
          false
        )
      } catch (error) {
        console.error(
          error
        )

        toast.error(
          'Cập nhật thất bại'
        )
      } finally {
        setIsSaving(
          false
        )
      }
    }

  // =========================
  // STYLES
  // =========================
  const inputClass = `w-full rounded-2xl border px-5 py-4 outline-none transition-all ${
    darkMode
      ? 'border-white/10 bg-white/[0.04] text-white placeholder:text-gray-500 focus:border-cyan-400'
      : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-cyan-500'
  }`

  const cardClass = `rounded-[28px] border p-6 transition-all duration-300 ${
    darkMode
      ? 'border-white/10 bg-[#071224]'
      : 'border-slate-200 bg-white'
  }`

  return (
    <div
      className={`min-h-screen px-4 py-10 transition-all duration-300 md:px-8 ${
        darkMode
          ? 'bg-[#020817]'
          : 'bg-slate-100'
      }`}
    >
      <div className="mx-auto max-w-7xl space-y-8">
        {/* HEADER */}
        <div
          className={`relative overflow-hidden rounded-[32px] border transition-all duration-300 ${
            darkMode
              ? 'border-white/10 bg-[#071224]'
              : 'border-slate-200 bg-white'
          }`}
        >
          {/* GRADIENT */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-purple-500 opacity-90" />

          <div className="relative flex flex-col items-center gap-6 px-8 py-10 md:flex-row md:items-center">
            {/* AVATAR */}
            <div className="shrink-0">
              <img
                src={
                  avatarSrc
                }
                alt="avatar"
                className="h-28 w-28 rounded-full border-4 border-white/90 object-cover shadow-2xl md:h-32 md:w-32"
              />
            </div>

            {/* INFO */}
            <div className="flex min-w-0 flex-1 flex-col justify-center text-center md:text-left">
              <h1 className="truncate text-3xl font-bold text-white md:text-4xl">
                {profileData.fullName ||
                  'Người dùng'}
              </h1>

              <p className="mt-2 text-base text-blue-100">
                @
                {
                  user?.email?.split(
                    '@'
                  )[0]
                }
              </p>

              {/* BADGES */}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                {/* ROLE */}
                <div className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md">
                  {isTeacher
                    ? '👨‍🏫 Giáo viên'
                    : '🎓 Học sinh'}
                </div>

                {/* POINTS */}
                <div className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md">
                  ⭐{' '}
                  {
                    profileData.points
                  }{' '}
                  Points
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* POINTS */}
          <div
            className={
              cardClass
            }
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-yellow-500/10 p-3">
                <Trophy className="text-yellow-400" />
              </div>

              <p
                className={`text-lg font-medium ${
                  darkMode
                    ? 'text-gray-300'
                    : 'text-slate-600'
                }`}
              >
                Points
              </p>
            </div>

            <h2
              className={`text-5xl font-bold ${
                darkMode
                  ? 'text-white'
                  : 'text-slate-900'
              }`}
            >
              {
                profileData.points
              }
            </h2>
          </div>

          {/* STREAK / SUBJECT */}
          <div
            className={
              cardClass
            }
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-cyan-500/10 p-3">
                <BookOpen className="text-cyan-400" />
              </div>

              <p
                className={`text-lg font-medium ${
                  darkMode
                    ? 'text-gray-300'
                    : 'text-slate-600'
                }`}
              >
                {isTeacher
                  ? 'Chuyên môn'
                  : 'Learning Streak'}
              </p>
            </div>

            <h2
              className={`text-3xl font-bold ${
                darkMode
                  ? 'text-white'
                  : 'text-slate-900'
              }`}
            >
              {isTeacher
                ? profileData.subject ||
                  'Chưa cập nhật'
                : `${profileData.learningStreak} ngày`}
            </h2>
          </div>

          {/* ROLE */}
          <div
            className={
              cardClass
            }
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-blue-500/10 p-3">
                <Shield className="text-blue-400" />
              </div>

              <p
                className={`text-lg font-medium ${
                  darkMode
                    ? 'text-gray-300'
                    : 'text-slate-600'
                }`}
              >
                Vai trò
              </p>
            </div>

            <h2
              className={`text-3xl font-bold ${
                darkMode
                  ? 'text-white'
                  : 'text-slate-900'
              }`}
            >
              {isTeacher
                ? 'Giáo viên'
                : 'Học sinh'}
            </h2>
          </div>
        </div>

        {/* CONTENT */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* LEFT */}
          <div
            className={
              cardClass
            }
          >
            <div className="mb-6 flex items-center gap-3">
              <Mail className="text-cyan-400" />

              <h2
                className={`text-3xl font-bold ${
                  darkMode
                    ? 'text-white'
                    : 'text-slate-900'
                }`}
              >
                Thông tin liên hệ
              </h2>
            </div>

            <div className="space-y-5">
              {/* EMAIL */}
              <div>
                <label className="mb-2 block text-sm text-slate-500 dark:text-gray-400">
                  Email
                </label>

                <input
                  disabled
                  value={
                    user?.email ||
                    ''
                  }
                  className={`${inputClass} opacity-70`}
                />
              </div>

              {/* PHONE */}
              <div>
                <label className="mb-2 block text-sm text-slate-500 dark:text-gray-400">
                  Số điện thoại
                </label>

                <input
                  name="phone"
                  disabled={
                    !isEditing
                  }
                  value={
                    profileData.phone
                  }
                  onChange={
                    handleChange
                  }
                  className={
                    inputClass
                  }
                />
              </div>

              {/* SCHOOL */}
              <div>
                <label className="mb-2 block text-sm text-slate-500 dark:text-gray-400">
                  Trường
                </label>

                <input
                  name="school"
                  disabled={
                    !isEditing
                  }
                  value={
                    profileData.school
                  }
                  onChange={
                    handleChange
                  }
                  className={
                    inputClass
                  }
                />
              </div>

              {/* CLASS / SUBJECT */}
              <div>
                <label className="mb-2 block text-sm text-slate-500 dark:text-gray-400">
                  {isTeacher
                    ? 'Chuyên môn'
                    : 'Lớp'}
                </label>

                <input
                  name={
                    isTeacher
                      ? 'subject'
                      : 'className'
                  }
                  disabled={
                    !isEditing
                  }
                  value={
                    isTeacher
                      ? profileData.subject
                      : profileData.className
                  }
                  onChange={
                    handleChange
                  }
                  className={
                    inputClass
                  }
                />
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div
            className={
              cardClass
            }
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="text-cyan-400" />

                <h2
                  className={`text-3xl font-bold ${
                    darkMode
                      ? 'text-white'
                      : 'text-slate-900'
                  }`}
                >
                  Thông tin cá nhân
                </h2>
              </div>

              {!isEditing ? (
                <button
                  onClick={() =>
                    setIsEditing(
                      true
                    )
                  }
                  className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-white transition-all hover:scale-105"
                >
                  <Edit3 size={18} />

                  Chỉnh sửa
                </button>
              ) : (
                <button
                  onClick={
                    handleSave
                  }
                  disabled={
                    isSaving
                  }
                  className="rounded-2xl bg-green-500 px-5 py-3 font-semibold text-white transition-all hover:scale-105 disabled:opacity-60"
                >
                  {isSaving
                    ? 'Đang lưu...'
                    : 'Lưu'}
                </button>
              )}
            </div>

            <div className="space-y-5">
              {/* NAME */}
              <div>
                <label className="mb-2 block text-sm text-slate-500 dark:text-gray-400">
                  Họ và tên
                </label>

                <input
                  name="fullName"
                  disabled={
                    !isEditing
                  }
                  value={
                    profileData.fullName
                  }
                  onChange={
                    handleChange
                  }
                  className={
                    inputClass
                  }
                />
              </div>

              {/* FACEBOOK */}
              <div>
                <label className="mb-2 block text-sm text-slate-500 dark:text-gray-400">
                  Facebook
                </label>

                <input
                  name="facebook"
                  disabled={
                    !isEditing
                  }
                  value={
                    profileData.facebook
                  }
                  onChange={
                    handleChange
                  }
                  className={
                    inputClass
                  }
                />
              </div>

              {/* ADDRESS */}
              <div>
                <label className="mb-2 block text-sm text-slate-500 dark:text-gray-400">
                  Địa chỉ trường
                </label>

                <input
                  name="address"
                  disabled={
                    !isEditing
                  }
                  value={
                    profileData.address
                  }
                  onChange={
                    handleChange
                  }
                  className={
                    inputClass
                  }
                />
              </div>

              {/* BIO */}
              <div>
                <label className="mb-2 block text-sm text-slate-500 dark:text-gray-400">
                  Bio
                </label>

                <textarea
                  rows={4}
                  name="bio"
                  disabled={
                    !isEditing
                  }
                  value={
                    profileData.bio
                  }
                  onChange={
                    handleChange
                  }
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
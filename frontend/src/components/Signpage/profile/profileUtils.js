import { getUserAvatar } from '../../../utils/userAvatar'

export function normalizeProfileData(
  user,
  userDetails
) {
  return {
    fullName:
      userDetails?.fullName ||
      user?.displayName ||
      '',

    bio:
      userDetails?.bio ||
      '',

    phone:
      userDetails?.phone ||
      '',

    school:
      userDetails?.school ||
      '',

    className:
      userDetails?.className ||
      userDetails?.class ||
      userDetails?.lop ||
      userDetails?.studentClass ||
      '',

    grade: String(
      userDetails?.grade ||
        userDetails?.khoi ||
        userDetails?.gradeLevel ||
        userDetails?.studentGrade ||
        ''
    ).trim(),

    subject:
      userDetails?.subject ||
      userDetails?.teacherSubject ||
      userDetails?.major ||
      userDetails?.specialization ||
      userDetails?.chuyenMon ||
      userDetails?.['chuyênMôn'] ||
      '',

    city:
      userDetails?.city ||
      '',

    learningStreak: Number(
      userDetails?.learningStreak ||
        0
    ),

    points: Number(
      userDetails?.points ||
        0
    ),

    role:
      userDetails?.role ||
      'STUDENT',

    avatar:
      getUserAvatar(user),

    coverPhoto:
      userDetails?.coverPhoto ||
      '',
  }
}

export function validateImage(file) {
  if (!file) {
    return {
      valid: false,
      message: '',
    }
  }

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ]

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      message:
        'Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP',
    }
  }

  const maxSize =
    5 * 1024 * 1024

  if (file.size > maxSize) {
    return {
      valid: false,
      message:
        'Ảnh không được vượt quá 5MB',
    }
  }

  return {
    valid: true,
    message: '',
  }
}
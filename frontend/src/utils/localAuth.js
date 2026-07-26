export const LOCAL_DEMO_ACCOUNTS = [
  {
    uid: 'local-student-001',
    email: import.meta.env.VITE_DEMO_STUDENT_EMAIL || '',
    displayName: 'Học sinh Demo',
    role: 'STUDENT',
  },
  {
    uid: 'local-teacher-001',
    email: import.meta.env.VITE_DEMO_TEACHER_EMAIL || '',
    displayName: 'Giáo viên Demo',
    role: 'TEACHER',
  },
]

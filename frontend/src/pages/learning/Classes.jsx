import { lazy, Suspense } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';

const LearningPage = lazy(() => import('./LearningPage.jsx'));

const TeacherClasses = lazy(() =>
  import('./class-core/TeacherClasses.jsx').then((module) => ({
    default: module.default,
  }))
);

const AttendanceQrCheckIn = lazy(() =>
  import('./class-core/TeacherClasses.jsx').then((module) => ({
    default: module.AttendanceQrCheckIn,
  }))
);

function ClassesLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">
        Đang tải...
      </div>
    </div>
  );
}

function Classes() {
  const { userDetails } = useAuth();

  const params =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : null;

  const attendanceQr = params?.get('attendanceQr') || '';
  const attendanceClassId = params?.get('classId') || '';
  const attendanceDate = params?.get('date') || '';

  if (attendanceQr && attendanceClassId && attendanceDate) {
    return (
      <Suspense fallback={<ClassesLoading />}>
        <AttendanceQrCheckIn
          classId={attendanceClassId}
          date={attendanceDate}
          token={attendanceQr}
        />
      </Suspense>
    );
  }

  if (userDetails?.role === 'STUDENT') {
    return (
      <Suspense fallback={<ClassesLoading />}>
        <LearningPage />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<ClassesLoading />}>
      <TeacherClasses />
    </Suspense>
  );
}

export default Classes;

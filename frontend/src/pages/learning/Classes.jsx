import { useAuth } from '../../contexts/AuthContext.jsx';
import TeacherClasses, { AttendanceQrCheckIn } from './class-core/TeacherClasses.jsx';
import LearningPage from './LearningPage.jsx';

function Classes() {
  const { userDetails } = useAuth();
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const attendanceQr = params?.get('attendanceQr') || '';
  const attendanceClassId = params?.get('classId') || '';
  const attendanceDate = params?.get('date') || '';

  if (attendanceQr && attendanceClassId && attendanceDate) {
    return (
      <AttendanceQrCheckIn
        classId={attendanceClassId}
        date={attendanceDate}
        token={attendanceQr}
      />
    );
  }

  if (userDetails?.role === 'STUDENT') {
    return <LearningPage />;
  }

  return <TeacherClasses />;
}

export default Classes;

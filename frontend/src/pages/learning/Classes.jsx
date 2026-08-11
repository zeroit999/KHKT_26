import { useAuth } from '../../contexts/AuthContext.jsx';
import MaintenanceState from '../../components/ui/MaintenanceState.jsx';
import TeacherClasses, { AttendanceQrCheckIn } from './class-core/TeacherClasses.jsx';

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
    return (
      <MaintenanceState
        badge="Lớp học"
        title="Tính năng đang bảo trì"
        subtitle="Lớp học dành cho học sinh đang được phát triển"
        description="Chúng tôi đang hoàn thiện trải nghiệm lớp học. Vui lòng quay lại trong thời gian sớm nhất."
      />
    );
  }

  return <TeacherClasses />;
}

export default Classes;

import MaintenanceState from '../../components/ui/MaintenanceState.jsx'

function Exams() {
  return (
    <MaintenanceState
      badge="Kho đề thi"
      title="Đang bảo trì"
      subtitle="Dữ liệu đề thi đang được cập nhật"
      description="Vui lòng quay lại sau"
    />
  )
}

export default Exams
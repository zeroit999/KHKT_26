import MaintenanceState from '../../components/ui/MaintenanceState.jsx'

function Dashboard() {
  return (
    <MaintenanceState
      badge="Dashboard"
      title="Đang bảo trì"
      subtitle="Dữ liệu dashboard đang được cập nhật"
      description="Vui lòng quay lại sau"
    />
  )
}

export default Dashboard
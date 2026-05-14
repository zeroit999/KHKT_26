import MaintenanceState from '../../components/ui/MaintenanceState.jsx'

function Leaderboard() {
  return (
    <MaintenanceState
      badge="Bảng xếp hạng"
      title="Đang bảo trì"
      subtitle="Dữ liệu xếp hạng đang được cập nhật"
      description="Vui lòng quay lại sau"
    />
  )
}

export default Leaderboard
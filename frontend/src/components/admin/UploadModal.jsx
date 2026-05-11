import { useState } from 'react'
import { FileSpreadsheet, UploadCloud } from 'lucide-react'
import GradientButton from '../ui/GradientButton.jsx'
import Modal from '../ui/Modal.jsx'

function UploadModal({ open, onClose }) {
  const [progress, setProgress] = useState(64)

  return (
    <Modal open={open} onClose={onClose} title="Tải lên ngân hàng câu hỏi">
      <div className="rounded-lg border border-dashed border-cyan-300/60 bg-cyan-400/10 p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-white/80 text-cyan-600 dark:bg-white/10 dark:text-cyan-200">
          <UploadCloud className="h-8 w-8" />
        </div>
        <p className="font-bold text-slate-950 dark:text-white">Kéo thả file đề thi vào đây</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Hỗ trợ XLSX, CSV, DOCX ở trạng thái UI mô phỏng.</p>
      </div>
      <div className="mt-5 rounded-lg border border-white/60 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-cyan-500" />
            <div>
              <p className="text-sm font-bold text-slate-950 dark:text-white">de-thi-thpt-2026.xlsx</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Đang xử lý cấu trúc câu hỏi</p>
            </div>
          </div>
          <span className="text-sm font-bold text-cyan-700 dark:text-cyan-200">{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded bg-slate-200 dark:bg-white/10">
          <span className="block h-full rounded bg-gradient-to-r from-cyan-300 to-blue-500" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <GradientButton variant="subtle" onClick={() => setProgress((value) => Math.min(100, value + 12))}>
          Tăng tiến độ mô phỏng
        </GradientButton>
        <GradientButton onClick={onClose}>Hoàn tất</GradientButton>
      </div>
    </Modal>
  )
}

export default UploadModal

import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import GradientButton from '../ui/GradientButton.jsx'
import Modal from '../ui/Modal.jsx'

function SubmitModal({ open, answered, total, onClose, onConfirm }) {
  const unanswered = total - answered

  return (
    <Modal open={open} onClose={onClose} title="Xác nhận nộp bài">
      <div className="rounded-lg border border-cyan-300/25 bg-cyan-400/10 p-4">
        <div className="flex items-start gap-3">
          {unanswered > 0 ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 text-orange-500" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-cyan-500" />
          )}
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">
              Bạn đã trả lời {answered}/{total} câu.
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {unanswered > 0
                ? `Còn ${unanswered} câu chưa chọn đáp án. Kết quả bên dưới chỉ là giao diện mô phỏng.`
                : 'Toàn bộ câu hỏi đã có lựa chọn. Kết quả bên dưới chỉ là giao diện mô phỏng.'}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <GradientButton variant="subtle" onClick={onClose}>
          Tiếp tục làm bài
        </GradientButton>
        <GradientButton onClick={onConfirm}>Nộp bài</GradientButton>
      </div>
    </Modal>
  )
}

export default SubmitModal

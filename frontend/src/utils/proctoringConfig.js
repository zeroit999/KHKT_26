export const LEGACY_PROCTORING_CONFIG = {
  enabled: true,
  requireFullscreen: true,
  detectTabSwitch: false,
  detectWindowBlur: false,
  blockClipboard: false,
  blockContextMenu: false,
  blockShortcuts: true,
  requireCamera: false,
  requireScreenShare: false,
  requireEntireScreen: false,
  autoSubmit: true,
  maxViolations: 2,
  heartbeatSeconds: 30,
}

export const STRICT_PROCTORING_CONFIG = {
  enabled: true,
  requireFullscreen: true,
  detectTabSwitch: true,
  detectWindowBlur: true,
  blockClipboard: true,
  blockContextMenu: true,
  blockShortcuts: true,
  requireCamera: true,
  requireScreenShare: true,
  requireEntireScreen: true,
  autoSubmit: true,
  maxViolations: 3,
  heartbeatSeconds: 30,
}

export function normalizeProctoringConfig(examOrConfig = {}, fallback = LEGACY_PROCTORING_CONFIG) {
  const source = examOrConfig?.proctoring || examOrConfig || {}
  const legacyLimit = Number(examOrConfig?.maxFullscreenViolations)
  const maxViolations = Number(source.maxViolations)
  const heartbeatSeconds = Number(source.heartbeatSeconds)

  return {
    ...fallback,
    ...source,
    enabled: source.enabled ?? fallback.enabled,
    requireFullscreen: source.requireFullscreen ?? fallback.requireFullscreen,
    detectTabSwitch: source.detectTabSwitch ?? fallback.detectTabSwitch,
    detectWindowBlur: source.detectWindowBlur ?? fallback.detectWindowBlur,
    blockClipboard: source.blockClipboard ?? fallback.blockClipboard,
    blockContextMenu: source.blockContextMenu ?? fallback.blockContextMenu,
    blockShortcuts: source.blockShortcuts ?? fallback.blockShortcuts,
    requireCamera: source.requireCamera ?? fallback.requireCamera,
    requireScreenShare: source.requireScreenShare ?? fallback.requireScreenShare,
    requireEntireScreen: source.requireEntireScreen ?? fallback.requireEntireScreen,
    autoSubmit: source.autoSubmit ?? fallback.autoSubmit,
    maxViolations: Number.isFinite(maxViolations)
      ? Math.max(1, Math.min(maxViolations, 20))
      : Number.isFinite(legacyLimit)
        ? Math.max(1, Math.min(legacyLimit, 20))
        : fallback.maxViolations,
    heartbeatSeconds: Number.isFinite(heartbeatSeconds)
      ? Math.max(15, Math.min(heartbeatSeconds, 120))
      : fallback.heartbeatSeconds,
  }
}

export const PROCTORING_SETTING_ITEMS = [
  ['requireFullscreen', 'Bắt buộc toàn màn hình', 'Khóa bài khi học sinh thoát toàn màn hình.'],
  ['detectTabSwitch', 'Phát hiện rời tab', 'Ghi vi phạm khi đổi tab, thu nhỏ hoặc chuyển ứng dụng.'],
  ['detectWindowBlur', 'Phát hiện mất focus', 'Tăng độ nhạy với Alt-Tab và cửa sổ khác.'],
  ['blockClipboard', 'Chặn copy / cut / paste', 'Ngăn sao chép và dán nội dung trong phòng thi.'],
  ['blockContextMenu', 'Chặn chuột phải', 'Vô hiệu hóa menu ngữ cảnh trong phòng thi.'],
  ['blockShortcuts', 'Chặn phím tắt rủi ro', 'Chặn F12, Ctrl+Shift+I/J/C, Ctrl+U và phím thoát.'],
  ['requireCamera', 'Bắt buộc camera', 'Không cho bắt đầu nếu camera chưa được cấp quyền.'],
  ['requireScreenShare', 'Bắt buộc chia sẻ màn hình', 'Khóa bài nếu học sinh dừng chia sẻ.'],
  ['requireEntireScreen', 'Chỉ chấp nhận toàn màn hình', 'Từ chối lựa chọn chỉ một tab hoặc cửa sổ khi trình duyệt cung cấp thông tin.'],
  ['autoSubmit', 'Tự nộp khi quá ngưỡng', 'Tự động nộp bài khi tổng vi phạm đạt giới hạn.'],
]

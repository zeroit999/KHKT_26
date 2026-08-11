import { useEffect, useMemo, useRef, useState } from 'react'
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from 'firebase/storage'
import {
  ChevronDown,
  Clipboard,
  GripVertical,
  Image,
  Loader2,
  ShieldCheck,
  Upload,
  Users,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  generateGroupCode,
  generateInviteCode,
  normalizeGroupCode,
} from '../utils/forumUtils'

const DRAFT_KEY = 'zuny_group_modal_draft'
const MAX_TEXT_CHANNELS = 10
const MAX_VOICE_CHANNELS = 10

const GROUP_COVER_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

const buildSafeFileName = (fileName = 'cover-image') => {
  const [name = 'cover-image', ...extParts] = String(fileName || 'cover-image').split('.')
  const extension = extParts.length ? `.${extParts.pop()}` : ''
  const safeName = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'cover-image'

  return `${safeName}${extension.toLowerCase()}`
}

const uploadGroupCoverImage = async (file) => {
  if (!file) return ''
  if (!GROUP_COVER_IMAGE_TYPES.includes(file.type)) {
    throw new Error('INVALID_IMAGE_TYPE')
  }

  const storage = getStorage()
  const fileName = buildSafeFileName(file.name)
  const uploadPath = `forumGroupCovers/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${fileName}`
  const fileRef = storageRef(storage, uploadPath)

  await uploadBytes(fileRef, file, { contentType: file.type })
  return getDownloadURL(fileRef)
}

const CUSTOM_COLOR_TYPES = [
  { value: 'hex', label: 'HEX', placeholder: '#8b5cf6' },
  { value: 'rgb', label: 'RGB', placeholder: '139, 92, 246' },
  { value: 'hsl', label: 'HSL', placeholder: '262, 83%, 58%' },
]

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, Number(value)))

const hexToRgb = (hex = '') => {
  let value = String(hex || '').trim().replace(/^#/, '')
  if (value.length === 3) value = value.split('').map((item) => item + item).join('')
  if (!/^[0-9A-Fa-f]{6}$/.test(value)) return null
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  }
}

const rgbToHex = (r, g, b) => `#${[r, g, b].map((item) => clampNumber(item, 0, 255).toString(16).padStart(2, '0')).join('')}`

const rgbToHsl = ({ r, g, b }) => {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === red) h = (green - blue) / d + (green < blue ? 6 : 0)
    else if (max === green) h = (blue - red) / d + 2
    else h = (red - green) / d + 4
    h /= 6
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

const hslToRgb = (h, s, l) => {
  const hue = (((Number(h) % 360) + 360) % 360) / 360
  const sat = clampNumber(s, 0, 100) / 100
  const light = clampNumber(l, 0, 100) / 100

  if (sat === 0) {
    const gray = Math.round(light * 255)
    return { r: gray, g: gray, b: gray }
  }

  const hueToRgb = (p, q, t) => {
    let nextT = t
    if (nextT < 0) nextT += 1
    if (nextT > 1) nextT -= 1
    if (nextT < 1 / 6) return p + (q - p) * 6 * nextT
    if (nextT < 1 / 2) return q
    if (nextT < 2 / 3) return p + (q - p) * (2 / 3 - nextT) * 6
    return p
  }

  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat
  const p = 2 * light - q
  return {
    r: Math.round(hueToRgb(p, q, hue + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, hue) * 255),
    b: Math.round(hueToRgb(p, q, hue - 1 / 3) * 255),
  }
}

const formatColorForInput = (color = '#8b5cf6', type = 'hex') => {
  const rgb = hexToRgb(color)
  if (!rgb) return String(color || '')
  if (type === 'rgb') return `${rgb.r}, ${rgb.g}, ${rgb.b}`
  if (type === 'hsl') {
    const hsl = rgbToHsl(rgb)
    return `${hsl.h}, ${hsl.s}%, ${hsl.l}%`
  }
  return color
}

const parseCustomColorInput = (input = '', type = 'hex') => {
  const raw = String(input || '').trim()
  if (!raw) return { ok: false, error: 'Vui lòng nhập mã màu.' }

  if (type === 'hex') {
    const normalized = raw.startsWith('#') ? raw : `#${raw}`
    if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(normalized)) {
      return { ok: false, error: 'HEX phải có dạng #RGB hoặc #RRGGBB.' }
    }
    const rgb = hexToRgb(normalized)
    return { ok: true, value: rgbToHex(rgb.r, rgb.g, rgb.b) }
  }

  if (type === 'rgb') {
    const values = raw.replace(/rgba?\(/i, '').replace(/\)/g, '').split(/[\s,\/]+/).filter(Boolean).slice(0, 3)
    if (values.length !== 3) return { ok: false, error: 'RGB cần 3 số, ví dụ: 139, 92, 246.' }
    const [r, g, b] = values.map(Number)
    if ([r, g, b].some((value) => !Number.isFinite(value) || value < 0 || value > 255)) {
      return { ok: false, error: 'RGB phải nằm trong khoảng 0 - 255.' }
    }
    return { ok: true, value: rgbToHex(Math.round(r), Math.round(g), Math.round(b)) }
  }

  if (type === 'hsl') {
    const values = raw.replace(/hsla?\(/i, '').replace(/\)/g, '').replace(/%/g, '').split(/[\s,\/]+/).filter(Boolean).slice(0, 3)
    if (values.length !== 3) return { ok: false, error: 'HSL cần 3 giá trị, ví dụ: 262, 83%, 58%.' }
    const [h, s, l] = values.map(Number)
    if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l) || s < 0 || s > 100 || l < 0 || l > 100) {
      return { ok: false, error: 'HSL gồm Hue bất kỳ, Saturation/Lightness từ 0% - 100%.' }
    }
    const rgb = hslToRgb(h, s, l)
    return { ok: true, value: rgbToHex(rgb.r, rgb.g, rgb.b) }
  }

  return { ok: false, error: 'Kiểu màu không hợp lệ.' }
}

function ChannelSortRow({ channel, idx, dragOverIdx, handleDragStart, handleDragOver, handleDrop, handleDragEnd, onRemove }) {
  return (
    <div
      draggable
      onDragStart={() => handleDragStart(idx)}
      onDragOver={(event) => handleDragOver(event, idx)}
      onDrop={() => handleDrop(idx)}
      onDragEnd={handleDragEnd}
      className={`flex cursor-grab items-center gap-3 rounded-xl border px-3 py-2.5 transition active:cursor-grabbing ${dragOverIdx === idx ? 'border-blue-400 bg-blue-500/20' : 'border-white/10 bg-white/5'}`}
    >
      <GripVertical className="h-4 w-4 shrink-0 text-slate-500" />
      {channel.icon ? <span className="text-base">{channel.icon}</span> : null}
      <span className="flex-1 text-sm font-black text-white">{channel.type === 'voice' ? '🔊' : '#'} {channel.label}</span>
      <button type="button" onClick={onRemove} className="rounded-lg p-1 text-slate-500 transition hover:bg-white/10 hover:text-rose-300" aria-label={`Xóa kênh ${channel.label}`}><X className="h-4 w-4" /></button>
    </div>
  )
}

function GroupModal({ open, onClose, onSubmit, existingGroups = [] }) {
  const themeColors = [
    { name: 'Đỏ', value: '#ef4444' },
    { name: 'Cam', value: '#f97316' },
    { name: 'Vàng', value: '#eab308' },
    { name: 'Lục', value: '#22c55e' },
    { name: 'Lam', value: '#06b6d4' },
    { name: 'Chàm', value: '#6366f1' },
    { name: 'Tím', value: '#8b5cf6' },
    { name: 'Trắng', value: '#ffffff' },
    { name: 'Đen', value: '#020617' },
  ]

  // Gradient presets for theme
  const themeGradients = [
    { name: 'Tím Hồng', value: 'linear-gradient(135deg, #8b5cf6, #ec4899)' },
    { name: 'Xanh Tím', value: 'linear-gradient(135deg, #6366f1, #06b6d4)' },
    { name: 'Cam Đỏ', value: 'linear-gradient(135deg, #f97316, #ef4444)' },
    { name: 'Xanh Lá', value: 'linear-gradient(135deg, #22c55e, #06b6d4)' },
    { name: 'Vàng Cam', value: 'linear-gradient(135deg, #eab308, #f97316)' },
    { name: 'Tím Xanh', value: 'linear-gradient(135deg, #8b5cf6, #6366f1)' },
  ]

  const iconSuggestions = ['👥', '🏆', '📚', '💻', '🧪', '🎯', '⚽', '🤖', '🔥', '🧠', '📖', '💯']

  const channelOptions = [
    { id: 'thong-bao', label: 'thông-báo', icon: '📢', type: 'announce', lockedDefault: true },
    { id: 'thao-luan', label: 'thảo-luận', icon: '💬', type: 'chat', lockedDefault: true },
    { id: 'hoi-bai', label: 'hỏi-bài', icon: '❓', type: 'chat' },
    { id: 'tai-lieu', label: 'tài-liệu', icon: '📚', type: 'files' },
    { id: 'on-thi', label: 'ôn-thi', icon: '🎯', type: 'chat' },
    { id: 'meo-hoc', label: 'mẹo-học', icon: '💡', type: 'chat' },
    { id: 'thanh-tich', label: 'thành-tích', icon: '🏆', type: 'info' },
    { id: 'noi-quy', label: 'nội-quy', icon: '📌', type: 'info' },
    { id: 'phong-hoc-thoai', label: 'phòng-học-thoại', icon: '🔊', type: 'voice' },
  ]

  const defaultChannelIds = ['thong-bao', 'thao-luan']
  const subjectSuggestions = ['Toán', 'Văn', 'Anh', 'Lý', 'Hóa', 'Sinh']

  const INVITE_EXPIRY_OPTIONS = [
    { value: '1d', label: '1 ngày' },
    { value: '7d', label: '7 ngày' },
    { value: '30d', label: '30 ngày' },
    { value: 'unlimited', label: 'Không giới hạn' },
  ]

  const existingGroupCodes = useMemo(
    () => new Set((existingGroups || []).map((group) => normalizeGroupCode(group.groupCode)).filter(Boolean)),
    [existingGroups],
  )

  const existingInviteCodes = useMemo(
    () => new Set((existingGroups || []).map((group) => (group.inviteCode)).filter(Boolean)),
    [existingGroups],
  )

  const generateUniqueGroupCode = () => {
    for (let index = 0; index < 80; index += 1) {
      const code = generateGroupCode()
      if (!existingGroupCodes.has(code)) return code
    }
    return generateGroupCode()
  }

  const generateUniqueInviteCode = () => {
    for (let index = 0; index < 120; index += 1) {
      const code = generateInviteCode()
      if (!existingInviteCodes.has((code))) return code
    }
    return generateInviteCode()
  }

  const initialForm = () => ({
    name: '',
    description: '',
    emoji: '👥',
    tags: '',
    groupType: 'public',
    isPrivate: false,
    isHidden: false,
    password: '',
    themeColor: '#8b5cf6',
    themeGradient: '',       // new: gradient value or empty for solid
    groupCode: generateUniqueGroupCode(),
    inviteCode: generateUniqueInviteCode(),
    inviteExpiry: 'unlimited', // new
    coverImage: '',
    channelIds: [],
    customChannels: [],      // new: [{id, label, icon, type}] for drag-n-drop ordered
    memberLimit: '',
    minGrade: '',            // new: minimum grade/class filter
    requireApproval: false,  // new: admin must approve before joining
    permissions: {
      sendMessage: true,
      sendImage: true,
      sendFile: true,
      invite: true,
      createPost: true,
    },
  })

  const [form, setForm] = useState(initialForm)
  const [activePanel, setActivePanel] = useState('basic')
  const [gradeDropdownOpen, setGradeDropdownOpen] = useState(false)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [colorMode, setColorMode] = useState('solid') // 'solid' | 'gradient'
  const [customColorType, setCustomColorType] = useState('hex')
  const [customColorInput, setCustomColorInput] = useState('#8b5cf6')
  const [customColorError, setCustomColorError] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [customChannelName, setCustomChannelName] = useState('')
  const [customChannelIcon, setCustomChannelIcon] = useState('')
  const [customChannelIconOpen, setCustomChannelIconOpen] = useState(false)
  const [textChannelListCollapsed, setTextChannelListCollapsed] = useState(false)
  const [voiceChannelListCollapsed, setVoiceChannelListCollapsed] = useState(false)
  const [customChannelType, setCustomChannelType] = useState('chat')
  const dragIdxRef = useRef(null)
  const coverImageInputRef = useRef(null)
  const [coverImageUploading, setCoverImageUploading] = useState(false)

  // Load draft from localStorage on open
  useEffect(() => {
    if (!open) return
    setActivePanel('basic')
    setColorPickerOpen(false)
    setCustomColorType('hex')
    setCustomColorInput('#8b5cf6')
    setCustomColorError('')
    setShowConfirm(false)
    setCoverImageUploading(false)
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const draft = JSON.parse(raw)
        // regenerate unique codes in case they conflict now
        setForm({
          ...initialForm(),
          ...draft,
          groupCode: generateUniqueGroupCode(),
          inviteCode: generateUniqueInviteCode(),
        })
        return
      }
    } catch {
      // ignore
    }
    setForm(initialForm())
  }, [open])

  // Save draft to localStorage on every form change
  useEffect(() => {
    if (!open) return
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form))
    } catch {
      // ignore
    }
  }, [form, open])

  if (!open) return null

  const gradeOptions = [
    { value: '', label: 'Không' },
    { value: 'grade10', label: 'Lớp 10' },
    { value: 'grade11', label: 'Lớp 11' },
    { value: 'grade12', label: 'Lớp 12' },
    { value: 'teacher', label: 'Giáo viên' },
    { value: 'none', label: 'Không' },
  ]

  const customChannelIcons = ['📢', '💬', '❓', '📚', '🎯', '💡', '📌', '🧠', '🏆', '🔊']
  const customChannelIconText = customChannelIcon || ''

  const handleCoverImageUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!GROUP_COVER_IMAGE_TYPES.includes(file.type)) {
      toast.error('Vui lòng chọn ảnh JPG, PNG hoặc WEBP')
      event.target.value = ''
      return
    }

    setCoverImageUploading(true)
    try {
      const downloadUrl = await uploadGroupCoverImage(file)
      setForm((prev) => ({ ...prev, coverImage: downloadUrl }))
      toast.success('Đã tải ảnh bìa lên hệ thống')
    } catch (error) {
      console.error('Không thể tải ảnh bìa:', error)
      toast.error(error?.message === 'INVALID_IMAGE_TYPE' ? 'Vui lòng chọn ảnh JPG, PNG hoặc WEBP' : 'Không thể tải ảnh bìa. Vui lòng thử lại')
    } finally {
      setCoverImageUploading(false)
      event.target.value = ''
    }
  }

  const selectedTags = form.tags
    ? form.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
    : ['khác']

  // Build ordered channel list (preset + custom)
  const orderedChannelIds = form.channelIds.length ? form.channelIds : defaultChannelIds
  const selectedChannels = orderedChannelIds
    .map((id) => {
      const custom = (form.customChannels || []).find((c) => c.id === id)
      if (custom) return custom
      return channelOptions.find((item) => item.id === id)
    })
    .filter(Boolean)

  const selectedTextChannels = selectedChannels.filter((channel) => channel.type !== 'voice')
  const selectedVoiceChannels = selectedChannels.filter((channel) => channel.type === 'voice')
  const channelLimitForType = (type) => type === 'voice' ? MAX_VOICE_CHANNELS : MAX_TEXT_CHANNELS
  const channelCountForType = (type) => type === 'voice' ? selectedVoiceChannels.length : selectedTextChannels.length

  const inviteCode = form.inviteCode

  const groupTypeOptions = [
    {
      value: 'public',
      label: 'Hiển thị công khai',
      icon: '🌍',
      helper: 'Nhóm xuất hiện trong danh sách và mọi người có thể bấm tham gia.',
    },
    {
      value: 'private',
      label: 'Riêng tư',
      icon: '🔒',
      helper: 'Mọi người thấy nhóm nhưng cần mật khẩu khi tham gia.',
    },
    {
      value: 'invite_only',
      label: 'Chỉ qua mã mời',
      icon: '✉️',
      helper: 'Không hiện nút tham gia. Người dùng phải nhập đúng mã mời để vào nhóm.',
    },
  ]

  const panelItems = [
    { id: 'basic', label: 'Thông tin cơ bản', icon: '🧩' },
    { id: 'privacy', label: 'Cấu hình nhóm', icon: '🔐' },
    { id: 'appearance', label: 'Giao diện', icon: '🎨' },
    { id: 'channels', label: 'Kênh ban đầu', icon: '#️⃣' },
    { id: 'members', label: 'Thành viên', icon: '👥' },
    { id: 'confirm', label: 'Xác nhận & tạo', icon: '✅' },
  ]

  const setGroupType = (groupType) => {
    setForm({
      ...form,
      groupType,
      isPrivate: groupType === 'private',
      password: groupType === 'private' ? form.password : '',
    })
  }

  const toggleChannel = (id) => {
    const currentIds = form.channelIds.length ? form.channelIds : defaultChannelIds
    const isRemoving = currentIds.includes(id)
    const channel = channelOptions.find((item) => item.id === id)
    const channelType = channel?.type === 'voice' ? 'voice' : 'chat'

    if (!isRemoving && channelCountForType(channelType) >= channelLimitForType(channelType)) {
      toast.error(channelType === 'voice' ? `Chỉ được tạo tối đa ${MAX_VOICE_CHANNELS} kênh âm thanh` : `Chỉ được tạo tối đa ${MAX_TEXT_CHANNELS} kênh văn bản`)
      return
    }

    const nextIds = isRemoving
      ? currentIds.filter((item) => item !== id)
      : [...currentIds, id]

    setForm({ ...form, channelIds: nextIds })
  }

  const addCustomChannel = () => {
    const label = customChannelName.trim()
    if (!label) {
      toast.error('Vui lòng nhập tên kênh')
      return
    }

    const currentIds = form.channelIds.length ? form.channelIds : defaultChannelIds
    if (channelCountForType(customChannelType) >= channelLimitForType(customChannelType)) {
      toast.error(customChannelType === 'voice' ? `Chỉ được tạo tối đa ${MAX_VOICE_CHANNELS} kênh âm thanh` : `Chỉ được tạo tối đa ${MAX_TEXT_CHANNELS} kênh văn bản`)
      return
    }

    const normalizedLabel = label.toLowerCase()
    const duplicated = selectedChannels.some(
      (channel) => String(channel?.label || '').trim().toLowerCase() === normalizedLabel,
    )
    if (duplicated) {
      toast.error('Tên kênh này đã tồn tại')
      return
    }

    const id = `custom-${Date.now()}`
    const newCh = {
      id,
      label,
      icon: customChannelIconText,
      type: customChannelType,
    }
    setForm({
      ...form,
      channelIds: [...currentIds, id],
      customChannels: [...(form.customChannels || []), newCh],
    })
    setCustomChannelName('')
    setCustomChannelIcon('')
    setCustomChannelIconOpen(false)
    setCustomChannelType('chat')
  }

  // Drag-and-drop for channel ordering
  const handleDragStart = (idx) => { dragIdxRef.current = idx }
  const handleDragOver = (e, idx) => { e.preventDefault(); setDragOverIdx(idx) }
  const handleDrop = (idx) => {
    const from = dragIdxRef.current
    if (from == null || from === idx) { setDragOverIdx(null); return }
    const currentIds = form.channelIds.length ? form.channelIds : defaultChannelIds
    const next = [...currentIds]
    const [moved] = next.splice(from, 1)
    next.splice(idx, 0, moved)
    setForm({ ...form, channelIds: next })
    dragIdxRef.current = null
    setDragOverIdx(null)
  }
  const handleDragEnd = () => { dragIdxRef.current = null; setDragOverIdx(null) }

  const togglePermission = (key) => {
    setForm({
      ...form,
      permissions: {
        ...form.permissions,
        [key]: !form.permissions[key],
      },
    })
  }

  const addTag = (tag) => {
    const currentTags = form.tags
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    if (currentTags.includes(tag)) return
    if (currentTags.length >= 3) {
      toast.error('Chỉ được chọn tối đa 3 môn học')
      return
    }
    setForm({ ...form, tags: [...currentTags, tag].slice(0, 3).join(', ') })
  }

  const updateCustomColorInput = (value, type = customColorType) => {
    setCustomColorInput(value)
    const parsed = parseCustomColorInput(value, type)

    if (!parsed.ok) {
      setCustomColorError(parsed.error)
      return
    }

    setCustomColorError('')
    setForm((prev) => ({
      ...prev,
      themeColor: parsed.value,
      themeGradient: '',
    }))
  }

  const changeCustomColorType = (nextType) => {
    setCustomColorType(nextType)
    setCustomColorError('')
    setCustomColorInput(formatColorForInput(form.themeColor, nextType))
  }

  const openSolidColorPicker = () => {
    setColorPickerOpen((value) => {
      const nextValue = !value
      if (nextValue) {
        setCustomColorInput(formatColorForInput(form.themeColor, customColorType))
        setCustomColorError('')
      }
      return nextValue
    })
  }

  const resetForm = () => {
    setActivePanel('basic')
    setColorPickerOpen(false)
    setCustomColorType('hex')
    setCustomColorInput('#8b5cf6')
    setCustomColorError('')
    setShowConfirm(false)
    try { window.localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
    setForm(initialForm())
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const copyInviteCode = async () => {
    try {
      await navigator.clipboard?.writeText(inviteCode)
      toast.success('Đã copy mã mời')
    } catch {
      toast.error('Không thể copy')
    }
  }

  const validateAndShowConfirm = (event) => {
    event.preventDefault()

    if (!form.name.trim()) {
      toast.error('Vui lòng nhập tên nhóm')
      setActivePanel('basic')
      return
    }

    if (form.name.trim().length < 4) {
      toast.error('Tên nhóm nên có ít nhất 4 ký tự')
      setActivePanel('basic')
      return
    }

    if (selectedTextChannels.length > MAX_TEXT_CHANNELS || selectedVoiceChannels.length > MAX_VOICE_CHANNELS) {
      toast.error(`Mỗi nhóm chỉ được tạo tối đa ${MAX_TEXT_CHANNELS} kênh văn bản và ${MAX_VOICE_CHANNELS} kênh âm thanh`)
      setActivePanel('channels')
      return
    }

    const safeGroupCode = normalizeGroupCode(form.groupCode)
    if (safeGroupCode.length !== 7) {
      toast.error('Mã nhóm phải gồm đúng 7 ký tự A-Z, a-z hoặc 0-9')
      setActivePanel('basic')
      return
    }

    if (existingGroupCodes.has(safeGroupCode)) {
      toast.error('Mã nhóm này đã tồn tại, vui lòng đổi mã khác')
      setActivePanel('basic')
      return
    }

    if (form.groupType === 'invite_only') {
      const safeInviteCode = inviteCode
      if (!/^[-A-Za-z0-9!@#$%^&*]{6}_[0-9]{4}$/.test(safeInviteCode)) {
        toast.error('Mã mời tự động không hợp lệ, vui lòng đóng rồi mở lại form tạo nhóm')
        setActivePanel('privacy')
        return
      }
      if (existingInviteCodes.has(safeInviteCode)) {
        toast.error('Mã mời đã tồn tại, vui lòng đóng rồi mở lại form tạo nhóm')
        setActivePanel('privacy')
        return
      }
    }

    if (form.groupType === 'private' && form.password.trim().length < 6) {
      toast.error('Mật khẩu nhóm riêng tư cần ít nhất 6 ký tự')
      setActivePanel('privacy')
      return
    }

    const memberLimit = form.memberLimit === '' ? 1000 : Number(form.memberLimit)
    if (!Number.isFinite(memberLimit) || memberLimit < 1) {
      toast.error('Giới hạn thành viên phải là số lớn hơn 0')
      setActivePanel('members')
      return
    }

    setActivePanel('confirm')
    setShowConfirm(true)
  }

  const submit = () => {
    if (selectedTextChannels.length > MAX_TEXT_CHANNELS || selectedVoiceChannels.length > MAX_VOICE_CHANNELS) {
      toast.error(`Mỗi nhóm chỉ được tạo tối đa ${MAX_TEXT_CHANNELS} kênh văn bản và ${MAX_VOICE_CHANNELS} kênh âm thanh`)
      setActivePanel('channels')
      return
    }

    const safeGroupCode = normalizeGroupCode(form.groupCode)
    const memberLimit = form.memberLimit === '' ? 1000 : Number(form.memberLimit)
    const channelIds = form.channelIds.length ? form.channelIds : defaultChannelIds
    const channels = channelIds
      .map((id) => {
        const custom = (form.customChannels || []).find((c) => c.id === id)
        if (custom) return custom
        const preset = channelOptions.find((item) => item.id === id)
        return preset ? { id: preset.id, label: preset.label, icon: preset.icon, type: preset.type } : null
      })
      .filter(Boolean)

    const themeValue = colorMode === 'gradient' && form.themeGradient
      ? form.themeGradient
      : form.themeColor

    onSubmit({
      ...form,
      groupCode: safeGroupCode,
      inviteCode: form.groupType === 'invite_only' ? inviteCode : '',
      isPrivate: form.groupType === 'private',
      password: form.groupType === 'private' ? form.password.trim() : '',
      isHidden: Boolean(form.isHidden),
      channels,
      defaultChannels: channels,
      memberLimit,
      coverImage: String(form.coverImage || '').trim(),
      themeColor: themeValue,
      requireApproval: Boolean(form.requireApproval),
      inviteExpiry: form.groupType === 'invite_only' ? form.inviteExpiry : 'unlimited',
      minGrade: form.minGrade || '',
    })

    resetForm()
  }

  const activeGroupType = groupTypeOptions.find((item) => item.value === form.groupType) || groupTypeOptions[0]

  // Computed preview background
  const previewBg = colorMode === 'gradient' && form.themeGradient
    ? { background: form.themeGradient }
    : { backgroundColor: form.themeColor }

  const creationStep = activePanel === 'confirm'
    ? 3
    : ['channels', 'members'].includes(activePanel)
      ? 2
      : 1

  const visiblePanelItems = creationStep === 1
    ? panelItems.filter((item) => ['basic', 'privacy', 'appearance'].includes(item.id))
    : creationStep === 2
      ? panelItems.filter((item) => ['channels', 'members'].includes(item.id))
      : panelItems.filter((item) => item.id === 'confirm')

  return (
    <div
      className="zuny-group-modal fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-slate-950/75 backdrop-blur-md dark:bg-black/80"
      onMouseDown={handleClose}
    >
      <style>{`
        html:not(.dark) .zuny-group-modal .zuny-group-modal-body { color: #0f172a; }
        html:not(.dark) .zuny-group-modal .zuny-group-modal-body aside,
        html:not(.dark) .zuny-group-modal .zuny-group-modal-body > div:last-child,
        html:not(.dark) .zuny-group-modal .zuny-group-modal-body .bg-white\/\[0\.03\] {
          background: #f8fafc !important;
          border-color: #e2e8f0 !important;
        }
        html:not(.dark) .zuny-group-modal .zuny-group-modal-body input,
        html:not(.dark) .zuny-group-modal .zuny-group-modal-body textarea {
          background: #ffffff !important;
          border-color: #cbd5e1 !important;
          color: #0f172a !important;
        }
        html:not(.dark) .zuny-group-modal .zuny-group-modal-body input::placeholder,
        html:not(.dark) .zuny-group-modal .zuny-group-modal-body textarea::placeholder {
          color: #94a3b8 !important;
        }
        html:not(.dark) .zuny-group-modal .zuny-group-modal-body .text-white:not(.bg-blue-600):not(.bg-emerald-500):not(.bg-rose-600):not(.bg-cyan-600):not(.bg-amber-500):not(.bg-fuchsia-600) { color: #0f172a !important; }
        html:not(.dark) .zuny-group-modal .zuny-group-modal-body .text-slate-300,
        html:not(.dark) .zuny-group-modal .zuny-group-modal-body .text-slate-400 { color: #475569 !important; }
        html:not(.dark) .zuny-group-modal .zuny-group-modal-body .text-slate-500 { color: #64748b !important; }
        html:not(.dark) .zuny-group-modal .zuny-group-modal-body .border-white\/10 { border-color: #e2e8f0 !important; }
        html:not(.dark) .zuny-group-modal .zuny-group-modal-body .bg-white\/5,
        html:not(.dark) .zuny-group-modal .zuny-group-modal-body .bg-white\/10 { background: #ffffff !important; }
        html:not(.dark) .zuny-group-modal .zuny-group-modal-body button:not(.bg-blue-600):not(.bg-emerald-500):not([class*='bg-gradient']):hover {
          background: #f1f5f9 !important;
        }
        html:not(.dark) .zuny-group-modal .zuny-group-modal-body .bg-slate-900 { background: #ffffff !important; }
        html:not(.dark) .zuny-group-modal .zuny-group-modal-body .border-slate-900 { border-color: #ffffff !important; }
        html:not(.dark) .zuny-group-modal > form > div:last-child {
          background: #f8fafc !important;
          border-color: #e2e8f0 !important;
        }
        html:not(.dark) .zuny-group-modal > form > div:last-child button[type='button']:first-child {
          background: #e2e8f0 !important;
          color: #334155 !important;
        }
        .dark .zuny-group-modal * { scrollbar-color: rgba(148,163,184,.55) rgba(15,23,42,.55); }
        @keyframes zunyGroupWorkspaceIn { from { opacity: 0; transform: scale(.985) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .zuny-group-workspace { animation: zunyGroupWorkspaceIn 240ms cubic-bezier(.2,.8,.2,1); }
      `}</style>
      <form
        onSubmit={validateAndShowConfirm}
        onMouseDown={(event) => event.stopPropagation()}
        className="zuny-group-workspace flex h-[100dvh] w-screen flex-col overflow-hidden border-0 bg-white text-slate-950 shadow-2xl dark:bg-slate-950 dark:text-white"
      >
        <div className="relative shrink-0 border-b border-slate-200 bg-white px-3 py-3 sm:px-6 sm:py-4 dark:border-white/10 dark:bg-slate-950 sm:px-6">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-500">Cộng đồng ZUNY</p>
              <h2 className="mt-1 truncate text-xl font-black tracking-tight text-slate-950 dark:text-white sm:text-2xl">Tạo nhóm học mới</h2>
            </div>

            <div className="hidden flex-1 items-center justify-center md:flex">
              {[
                { step: 1, label: 'Thông tin' },
                { step: 2, label: 'Kênh & quyền' },
                { step: 3, label: 'Hoàn tất' },
              ].map((item, index, items) => {
                const active = creationStep === item.step
                const completed = creationStep > item.step
                return (
                  <div key={item.step} className="flex items-center">
                    <button
                      type="button"
                      onClick={() => setActivePanel(item.step === 1 ? 'basic' : item.step === 2 ? 'channels' : 'confirm')}
                      className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-black transition ${
                        active
                          ? 'text-blue-600 dark:text-blue-300'
                          : completed
                            ? 'text-sky-600 dark:text-sky-300'
                            : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      <span className={`grid h-9 w-9 place-items-center rounded-full border text-sm ${
                        active
                          ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                          : completed
                            ? 'border-sky-400 bg-sky-50 text-sky-600 dark:bg-sky-500/10'
                            : 'border-slate-200 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400'
                      }`}>
                        {completed ? '✓' : item.step}
                      </span>
                      <span>{item.label}</span>
                    </button>
                    {index < items.length - 1 && (
                      <div className={`mx-3 h-px w-16 lg:w-28 ${creationStep > item.step ? 'bg-sky-400' : 'bg-slate-200 dark:bg-white/10'}`} />
                    )}
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Đóng"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="zuny-group-modal-body mx-auto grid min-h-0 w-full max-w-[1500px] flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950 lg:grid-cols-[minmax(0,1fr)_390px]">
          <aside className="col-span-full shrink-0 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-6 sm:py-3 dark:border-white/10 dark:bg-slate-950 sm:px-6">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {visiblePanelItems.map((item) => {
                const active = activePanel === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActivePanel(item.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black transition ${
                      active
                        ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-blue-500/10 dark:hover:text-blue-200'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </aside>

          <div className="min-h-0 overflow-y-auto bg-white p-3 pb-24 sm:p-6 sm:pb-24 dark:bg-slate-950 sm:p-6 lg:p-7">
            {/* ── BASIC ─────────────────────────────────────────── */}
            {activePanel === 'basic' && (
              <div className="space-y-5">
                <SectionTitle title="Thông tin cơ bản" description="Tên, mô tả, tag và mã nhóm công khai giúp người dùng nhận diện nhóm." />

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Tên nhóm</label>
                    <span className="text-xs font-bold text-slate-500">{form.name.length}/50 ký tự</span>
                  </div>
                  <input
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value.slice(0, 50) })}
                    placeholder="VD: Toán 12 ôn thi THPTQG"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-white/10"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Mô tả nhóm</label>
                    <span className="text-xs font-bold text-slate-500">{form.description.length}/200 ký tự</span>
                  </div>
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value.slice(0, 200) })}
                    rows={5}
                    placeholder="Có thể bỏ trống hoặc ghi ngắn gọn mục tiêu của nhóm."
                    className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-white/10"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Tags</label>
                  <input
                    value={form.tags}
                    onChange={(event) => {
                      const nextTags = event.target.value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 3)
                      setForm({ ...form, tags: nextTags.join(', ') })
                    }}
                    placeholder="[môn học], [môn học], [môn học] (tối đa 3)"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-white/10"
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    {subjectSuggestions.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => addTag(tag)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black text-slate-300 transition hover:border-blue-400/60 hover:bg-blue-500/15 hover:text-white"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Mã nhóm công khai</label>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="font-mono text-lg font-black tracking-[0.25em] text-white">
                      {form.groupCode}
                    </p>
                    <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                      Mã nhóm gồm đúng 7 ký tự A-Z, a-z hoặc 0-9. Mã này hiện công khai trên thẻ nhóm, không phải mã mời và không thể chỉnh sửa.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── PRIVACY ───────────────────────────────────────── */}
            {activePanel === 'privacy' && (
              <div className="space-y-5">
                <SectionTitle title="Cấu hình nhóm" description="Chọn chế độ hiển thị và bảo mật nhóm." />

                <div className="grid gap-3">
                  {groupTypeOptions.map((item) => {
                    const active = form.groupType === item.value
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setGroupType(item.value)}
                        className={`rounded-3xl border p-4 text-left transition ${
                          active
                            ? 'border-blue-400 bg-blue-500/15 text-white'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:border-blue-400/50 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-xl">{item.icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-black">{item.label}</p>
                            <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">{item.helper}</p>
                          </div>
                          <span className={`mt-1 h-4 w-4 rounded-full border ${active ? 'border-blue-300 bg-blue-400' : 'border-white/20'}`} />
                        </div>
                      </button>
                    )
                  })}
                </div>

                {['private', 'invite_only'].includes(form.groupType) && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, isHidden: !form.isHidden })}
                    className={`rounded-3xl border p-4 text-left transition ${
                      form.isHidden
                        ? 'border-cyan-400 bg-cyan-500/15 text-white'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:border-cyan-400/50 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-xl">🔍</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black">Không công khai</p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">Option con của riêng tư/chỉ qua mã mời: nhóm không hiện ở đại sảnh, chỉ hiện khi nhập đúng mã nhóm. Admin_dev và trưởng nhóm vẫn nhìn thấy.</p>
                      </div>
                      <span className={`mt-1 h-4 w-4 rounded-full border ${form.isHidden ? 'border-cyan-300 bg-cyan-400' : 'border-white/20'}`} />
                    </div>
                  </button>
                )}

                {form.isHidden && (
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-xs font-bold leading-5 text-cyan-100">
                    Nhóm đang bật Không công khai. Nhóm sẽ không hiển thị ở đại sảnh, chỉ hiện khi nhập đúng mã nhóm.
                  </div>
                )}

                {form.groupType === 'private' && (
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Mật khẩu nhóm riêng tư</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(event) => setForm({ ...form, password: event.target.value })}
                      placeholder="Tối thiểu 6 ký tự"
                      className="w-full rounded-2xl border border-amber-400/20 bg-white/5 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300 focus:bg-white/10"
                    />
                  </div>
                )}

                {form.groupType === 'invite_only' && (
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Mã mời tự động</label>
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="flex-1 font-mono text-lg font-black tracking-[0.25em] text-white">
                        {inviteCode}
                      </p>
                      <button
                        type="button"
                        onClick={copyInviteCode}
                        title="Copy mã mời"
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300 transition hover:bg-blue-500/40 hover:text-white"
                      >
                        <Clipboard className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                      Mã mời được hệ thống tự tạo theo dạng 6 ký tự + _ + 4 chữ số.
                    </p>

                    <div className="mt-4">
                      <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Thời hạn mã mời</label>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {INVITE_EXPIRY_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setForm({ ...form, inviteExpiry: opt.value })}
                            className={`rounded-2xl border px-3 py-2.5 text-xs font-black transition ${
                              form.inviteExpiry === opt.value
                                ? 'border-blue-400 bg-blue-500/20 text-white'
                                : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Duyệt thành viên */}
                <div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, requireApproval: !form.requireApproval })}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      form.requireApproval
                        ? 'border-amber-400 bg-amber-500/10 text-white'
                        : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-black">
                          <ShieldCheck className="h-4 w-4 text-amber-400" />
                          Duyệt thành viên
                        </p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                          Admin phải phê duyệt yêu cầu trước khi thành viên mới vào được nhóm.
                        </p>
                      </div>
                      <span className={`mt-1 inline-flex h-6 w-11 items-center rounded-full p-1 transition ${form.requireApproval ? 'bg-amber-500' : 'bg-white/10'}`}>
                        <span className={`h-4 w-4 rounded-full bg-white transition ${form.requireApproval ? 'translate-x-5' : ''}`} />
                      </span>
                    </div>
                  </button>
                </div>

                {/* Lớp học / tuổi tối thiểu */}
                <div className="relative">
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Lớp học tối thiểu để tham gia</label>
                  <button
                    type="button"
                    onClick={() => setGradeDropdownOpen((value) => !value)}
                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-bold text-white transition hover:bg-white/10 focus:border-blue-400"
                  >
                    <span>{gradeOptions.find((option) => option.value === form.minGrade)?.label || 'Không giới hạn'}</span>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition ${gradeDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {gradeDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-slate-950 p-1 shadow-2xl">
                      {gradeOptions.filter((option, index, items) => items.findIndex((item) => item.value === option.value) === index).map((option) => (
                        <button
                          key={option.value || 'empty'}
                          type="button"
                          onClick={() => { setForm({ ...form, minGrade: option.value }); setGradeDropdownOpen(false) }}
                          className={`block w-full rounded-xl px-4 py-3 text-left text-sm font-black transition ${form.minGrade === option.value ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-xs font-bold leading-5 text-slate-500">Dùng để lọc đối tượng tham gia nhóm. Để trống nếu không giới hạn lớp học.</p>
                </div>
              </div>
            )}

            {/* ── CHANNELS ─────────────────────────────────────── */}
            {activePanel === 'channels' && (
              <div className="space-y-5">
                <SectionTitle title="Kênh ban đầu" description="Chọn kênh mặc định, đặt tên tùy ý hoặc kéo thả để sắp xếp thứ tự." />
                <div className="mb-4 flex justify-end">
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${selectedTextChannels.length >= MAX_TEXT_CHANNELS ? 'bg-rose-500/15 text-rose-300' : 'bg-blue-500/15 text-blue-300'}`}># {selectedTextChannels.length}/{MAX_TEXT_CHANNELS} văn bản</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${selectedVoiceChannels.length >= MAX_VOICE_CHANNELS ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}`}>🔊 {selectedVoiceChannels.length}/{MAX_VOICE_CHANNELS} âm thanh</span>
                  </div>
                </div>

                {/* Custom channel input */}
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Thêm kênh tùy chỉnh</label>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setCustomChannelType('chat')} className={`rounded-2xl px-4 py-3 text-xs font-black transition ${customChannelType === 'chat' ? 'bg-blue-600 text-white' : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}># Kênh văn bản</button>
                    <button type="button" onClick={() => setCustomChannelType('voice')} className={`rounded-2xl px-4 py-3 text-xs font-black transition ${customChannelType === 'voice' ? 'bg-emerald-600 text-white' : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}>🔊 Kênh thoại</button>
                  </div>
                  <div className="grid items-start gap-3 md:grid-cols-[190px_minmax(0,1fr)]">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setCustomChannelIconOpen((value) => !value)}
                        className="flex h-10 w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-black text-slate-200 transition hover:bg-white/10"
                      >
                        <span className="flex items-center gap-2">
                          <span className="grid h-6 w-6 place-items-center rounded-lg bg-white/10 text-sm">{customChannelIcon || '∅'}</span>
                          {customChannelIcon ? 'Đã chọn icon' : 'Không có icon'}
                        </span>
                        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${customChannelIconOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {customChannelIconOpen && (
                        <div className="absolute left-0 top-full z-30 mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 p-2 shadow-2xl">
                          <button
                            type="button"
                            onClick={() => { setCustomChannelIcon(''); setCustomChannelIconOpen(false) }}
                            className={`mb-2 flex h-9 w-full items-center justify-center rounded-xl border text-xs font-black transition ${!customChannelIcon ? 'border-blue-300 bg-blue-500/25 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}
                          >
                            Không
                          </button>
                          <div className="grid grid-cols-5 gap-2">
                            {customChannelIcons.map((icon) => (
                              <button
                                key={icon}
                                type="button"
                                onClick={() => { setCustomChannelIcon(icon); setCustomChannelIconOpen(false) }}
                                className={`h-9 rounded-xl border text-sm font-black transition ${customChannelIcon === icon ? 'border-blue-300 bg-blue-500/25 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}
                              >
                                {icon}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={customChannelName}
                        onChange={(e) => setCustomChannelName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomChannel() } }}
                        placeholder="Tên kênh tùy ý..."
                        className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-white/10"
                      />
                      <button
                        type="button"
                        onClick={addCustomChannel}
                        className="h-10 shrink-0 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-500"
                      >
                        Thêm
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs font-bold text-slate-500">Kênh văn bản hiển thị dấu #; kênh thoại hiển thị biểu tượng 🔊 và cho phép thành viên nói chuyện bằng microphone.</p>
                </div>

                {/* Preset channel selector */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {channelOptions.filter((channel) => customChannelType === 'voice' ? channel.type === 'voice' : channel.type !== 'voice').map((channel) => {
                    const currentIds = form.channelIds.length ? form.channelIds : defaultChannelIds
                    const active = currentIds.includes(channel.id)
                    return (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() => toggleChannel(channel.id)}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          active
                            ? 'border-cyan-400 bg-cyan-500/10 text-white'
                            : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <p className="text-sm font-black">{channel.icon} {channel.type === 'voice' ? '🔊' : '#'} {channel.label}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{channel.type}</p>
                      </button>
                    )
                  })}
                </div>

                {/* Drag-n-drop reorder */}
                {selectedChannels.length > 0 && (
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Kéo thả để sắp xếp thứ tự kênh</label>
                    <div className="space-y-3">
                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                        <button type="button" onClick={() => setTextChannelListCollapsed((value) => !value)} className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/5">
                          <span className="text-sm font-black text-white"># Kênh văn bản <span className="ml-2 text-xs text-slate-500">{selectedTextChannels.length}</span></span>
                          <ChevronDown className={`h-4 w-4 text-slate-400 transition ${textChannelListCollapsed ? '-rotate-90' : ''}`} />
                        </button>
                        {!textChannelListCollapsed && <div className="space-y-2 border-t border-white/10 p-3">
                          {selectedTextChannels.length ? selectedTextChannels.map((channel) => {
                            const idx = selectedChannels.findIndex((item) => item.id === channel.id)
                            return (
                              <ChannelSortRow key={channel.id} channel={channel} idx={idx} dragOverIdx={dragOverIdx} handleDragStart={handleDragStart} handleDragOver={handleDragOver} handleDrop={handleDrop} handleDragEnd={handleDragEnd} onRemove={() => { const currentIds = form.channelIds.length ? form.channelIds : defaultChannelIds; setForm({ ...form, channelIds: currentIds.filter((id) => id !== channel.id) }) }} />
                            )
                          }) : <p className="px-2 py-3 text-xs font-bold text-slate-500">Chưa có kênh văn bản.</p>}
                        </div>}
                      </div>

                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                        <button type="button" onClick={() => setVoiceChannelListCollapsed((value) => !value)} className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/5">
                          <span className="text-sm font-black text-white">🔊 Kênh âm thanh <span className="ml-2 text-xs text-slate-500">{selectedVoiceChannels.length}</span></span>
                          <ChevronDown className={`h-4 w-4 text-slate-400 transition ${voiceChannelListCollapsed ? '-rotate-90' : ''}`} />
                        </button>
                        {!voiceChannelListCollapsed && <div className="space-y-2 border-t border-white/10 p-3">
                          {selectedVoiceChannels.length ? selectedVoiceChannels.map((channel) => {
                            const idx = selectedChannels.findIndex((item) => item.id === channel.id)
                            return (
                              <ChannelSortRow key={channel.id} channel={channel} idx={idx} dragOverIdx={dragOverIdx} handleDragStart={handleDragStart} handleDragOver={handleDragOver} handleDrop={handleDrop} handleDragEnd={handleDragEnd} onRemove={() => { const currentIds = form.channelIds.length ? form.channelIds : defaultChannelIds; setForm({ ...form, channelIds: currentIds.filter((id) => id !== channel.id) }) }} />
                            )
                          }) : <p className="px-2 py-3 text-xs font-bold text-slate-500">Chưa có kênh âm thanh.</p>}
                        </div>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── COVER ────────────────────────────────────────── */}
            {activePanel === 'appearance' && (
              <div className="space-y-5">
                <SectionTitle title="Ảnh bìa" description="Dán URL ảnh bìa để nhóm nổi bật hơn trong danh sách khám phá." />

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">URL ảnh bìa</label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={form.coverImage}
                      onChange={(event) => setForm({ ...form, coverImage: event.target.value })}
                      placeholder="https://..."
                      className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-white/10"
                    />
                    <input
                      ref={coverImageInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleCoverImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => coverImageInputRef.current?.click()}
                      disabled={coverImageUploading}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {coverImageUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {coverImageUploading ? 'Đang tải...' : 'Tải ảnh'}
                    </button>
                  </div>
                </div>

                <div
                  className="flex h-48 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-white/5"
                  style={form.coverImage ? { backgroundImage: `url(${form.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : previewBg}
                >
                  {!form.coverImage && <Image className="h-10 w-10 text-white/60" />}
                </div>
              </div>
            )}

            {/* ── ICON & COLOR ─────────────────────────────────── */}
            {activePanel === 'appearance' && (
              <div className="space-y-5">
                <SectionTitle title="Icon & màu chủ đề" description="Chọn icon và màu nhận diện cho nhóm. Hỗ trợ màu đơn và gradient." />

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Icon nhóm</label>
                  <div className="grid grid-cols-6 gap-2">
                    {iconSuggestions.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setForm({ ...form, emoji: icon })}
                        className={`flex h-12 items-center justify-center rounded-2xl border text-xl transition ${
                          form.emoji === icon
                            ? 'border-blue-400 bg-blue-500/20'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Màu chủ đề</label>

                  {/* Mode toggle */}
                  <div className="mb-4 flex gap-2">
                    {['solid', 'gradient'].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setColorMode(mode)}
                        className={`rounded-xl px-4 py-2 text-xs font-black transition ${
                          colorMode === mode
                            ? 'bg-blue-600 text-white'
                            : 'border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {mode === 'solid' ? '🎨 Màu đơn' : '🌈 Gradient'}
                      </button>
                    ))}
                  </div>

                  {colorMode === 'solid' && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={openSolidColorPicker}
                        className="flex h-[58px] w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 text-left transition hover:bg-white/10"
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className="flex h-9 w-9 items-center justify-center rounded-xl text-xl shadow-sm"
                            style={{
                              backgroundColor: form.themeColor,
                              color: form.themeColor === '#ffffff' ? '#020617' : '#ffffff',
                            }}
                          >
                            🖌️
                          </span>
                          <span className="text-sm font-black text-white">
                            {themeColors.find((color) => color.value === form.themeColor)?.name || form.themeColor || 'Chọn màu'}
                          </span>
                        </span>
                        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${colorPickerOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {colorPickerOpen && (
                        <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl border border-white/10 bg-slate-950 p-3 shadow-2xl">
                          <div className="grid grid-cols-5 gap-2">
                            {themeColors.map((color) => (
                              <button
                                key={color.value}
                                type="button"
                                title={color.name}
                                onClick={() => {
                                  setForm({ ...form, themeColor: color.value, themeGradient: '' })
                                  setCustomColorInput(formatColorForInput(color.value, customColorType))
                                  setCustomColorError('')
                                }}
                                className={`h-9 w-9 rounded-full border-2 transition hover:scale-110 ${
                                  form.themeColor === color.value
                                    ? 'border-white ring-2 ring-blue-400'
                                    : 'border-white/20'
                                }`}
                                style={{ backgroundColor: color.value }}
                              />
                            ))}
                          </div>

                          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Nhập mã màu</p>
                              <div
                                className="h-7 w-7 rounded-lg border border-white/15 shadow-sm"
                                style={{ backgroundColor: parseCustomColorInput(customColorInput, customColorType).ok ? parseCustomColorInput(customColorInput, customColorType).value : form.themeColor }}
                              />
                            </div>

                            <div className="flex overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition focus-within:border-blue-400 focus-within:bg-white/10">
                              <input
                                value={customColorInput}
                                onChange={(event) => updateCustomColorInput(event.target.value)}
                                placeholder={CUSTOM_COLOR_TYPES.find((item) => item.value === customColorType)?.placeholder || '#8b5cf6'}
                                className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500"
                              />

                              <select
                                value={customColorType}
                                onChange={(event) => changeCustomColorType(event.target.value)}
                                className="w-24 border-l border-white/10 bg-slate-900 px-3 py-3 text-xs font-black text-white outline-none"
                              >
                                {CUSTOM_COLOR_TYPES.map((item) => (
                                  <option key={item.value} value={item.value} className="bg-slate-950 text-white">
                                    {item.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {customColorError ? (
                              <p className="mt-2 text-xs font-bold leading-5 text-rose-400">{customColorError}</p>
                            ) : (
                              <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                                Hỗ trợ HEX, RGB và HSL. Ví dụ: #8b5cf6, 139, 92, 246 hoặc 262, 83%, 58%.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {colorMode === 'gradient' && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {themeGradients.map((grad) => (
                        <button
                          key={grad.value}
                          type="button"
                          onClick={() => setForm({ ...form, themeGradient: grad.value })}
                          className={`relative h-16 overflow-hidden rounded-2xl border-2 transition hover:scale-105 ${
                            form.themeGradient === grad.value
                              ? 'border-white ring-2 ring-blue-400'
                              : 'border-white/10'
                          }`}
                          style={{ background: grad.value }}
                        >
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-white/90 drop-shadow">
                            {grad.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── PERMISSIONS ──────────────────────────────────── */}
            {activePanel === 'members' && (
              <div className="space-y-5">
                <SectionTitle title="Quyền thành viên" description="Tắt quyền nào thì thành viên thường sẽ không dùng được hành động đó trong nhóm." />

                <div className="grid gap-3">
                  {[
                    ['sendMessage', 'Gửi tin nhắn', 'Cho phép thành viên trò chuyện trong kênh.'],
                    ['sendImage', 'Gửi ảnh', 'Cho phép gửi ảnh minh họa trong nhóm.'],
                    ['sendFile', 'Gửi file', 'Cho phép gửi tài liệu và tệp học tập.'],
                    ['createPost', 'Tạo bài viết', 'Cho phép đăng bài viết thuộc nhóm.'],
                    ['invite', 'Mời người khác', 'Cho phép copy/chia sẻ mã mời nhóm.'],
                  ].map(([key, label, helper]) => {
                    const active = form.permissions[key]
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => togglePermission(key)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          active
                            ? 'border-emerald-400 bg-emerald-500/10 text-white'
                            : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-black">{label}</p>
                            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{helper}</p>
                          </div>
                          <span className={`mt-1 inline-flex h-6 w-11 items-center rounded-full p-1 transition ${active ? 'bg-emerald-500' : 'bg-white/10'}`}>
                            <span className={`h-4 w-4 rounded-full bg-white transition ${active ? 'translate-x-5' : ''}`} />
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── LIMIT ────────────────────────────────────────── */}
            {activePanel === 'members' && (
              <div className="space-y-5">
                <SectionTitle title="Giới hạn thành viên" description="Nếu bỏ trống, hệ thống tự đặt giới hạn mặc định là 1000 thành viên." />

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Số thành viên tối đa</label>
                  <input
                    type="number"
                    min="1"
                    value={form.memberLimit}
                    onChange={(event) => setForm({ ...form, memberLimit: event.target.value })}
                    placeholder="1000"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-white/10"
                  />
                  <p className="mt-3 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-xs font-bold leading-5 text-cyan-100/80">
                    Giới hạn thành viên giúp kiểm soát được lưu lượng thành viên, giảm giật lag khi tải chat nhóm.
                  </p>
                </div>
              </div>
            )}

            {/* ── CONFIRM ──────────────────────────────────────── */}
            {activePanel === 'confirm' && (
              <div className="space-y-5">
                <SectionTitle title="Xác nhận tạo nhóm" description="Kiểm tra lại toàn bộ cấu hình trước khi tạo nhóm." />

                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                  <ConfirmRow label="Tên nhóm" value={form.name || '—'} />
                  <ConfirmRow label="Mô tả" value={form.description || '(trống)'} />
                  <ConfirmRow label="Mã nhóm" value={form.groupCode} mono />
                  <ConfirmRow label="Loại nhóm" value={groupTypeOptions.find((o) => o.value === form.groupType)?.label || '—'} />
                  <ConfirmRow label="Không công khai" value={form.isHidden ? 'Bật' : 'Tắt'} />
                  {form.groupType === 'invite_only' && (
                    <>
                      <ConfirmRow label="Mã mời" value={inviteCode} mono />
                      <ConfirmRow label="Thời hạn mã mời" value={INVITE_EXPIRY_OPTIONS.find((o) => o.value === form.inviteExpiry)?.label || '—'} />
                    </>
                  )}
                  <ConfirmRow label="Duyệt thành viên" value={form.requireApproval ? 'Bật' : 'Tắt'} />
                  {form.minGrade && <ConfirmRow label="Lớp tối thiểu" value={gradeOptions.find((o) => o.value === form.minGrade)?.label || form.minGrade} />}
                  <ConfirmRow label="Màu chủ đề" value={colorMode === 'gradient' ? 'Gradient' : form.themeColor} />
                  <ConfirmRow label="Giới hạn thành viên" value={form.memberLimit ? `${form.memberLimit} người` : '1000 người (mặc định)'} />
                  <ConfirmRow label="Số kênh" value={`${selectedChannels.length} kênh`} />
                  <ConfirmRow label="Quyền bật" value={`${Object.values(form.permissions).filter(Boolean).length}/5`} />
                </div>

                <p className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs font-bold leading-5 text-amber-200">
                  ⚠️ Sau khi tạo, mã nhóm không thể thay đổi. Kiểm tra kỹ trước khi xác nhận.
                </p>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="min-h-0 overflow-y-auto border-t border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/70 lg:border-l lg:border-t-0 lg:p-6">
            <div className="sticky top-0 rounded-[1.75rem] border border-blue-100 bg-white p-4 shadow-xl shadow-blue-950/5 dark:border-blue-400/10 dark:bg-white/5">
              <p className="mb-3 text-sm font-black text-slate-900 dark:text-white">Xem trước nhóm</p>

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
                <div
                  className="h-24"
                  style={form.coverImage
                    ? { backgroundImage: `url(${form.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                    : (colorMode === 'gradient' && form.themeGradient
                        ? { background: form.themeGradient }
                        : { backgroundColor: form.themeColor })}
                />
                <div className="p-4">
                  <div
                    className="-mt-10 flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-slate-900 text-3xl shadow-lg"
                    style={{
                      ...(colorMode === 'gradient' && form.themeGradient ? { background: form.themeGradient } : { backgroundColor: form.themeColor }),
                      color: form.themeColor === '#ffffff' ? '#020617' : '#ffffff',
                    }}
                  >
                    {form.emoji || '👥'}
                  </div>

                  <h3 className="mt-3 line-clamp-1 text-base font-black text-white">{form.name || 'Tên nhóm học'}</h3>

                  <p className="mt-2 line-clamp-3 text-xs font-semibold leading-5 text-slate-400">
                    {form.description || 'Chưa có mô tả.'}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {selectedTags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black text-slate-300">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 space-y-2 rounded-2xl bg-white/5 px-3 py-3 text-[11px] font-black text-slate-300">
                    <div className="flex items-center justify-between gap-3">
                      <span>{activeGroupType.icon} {activeGroupType.label}</span>
                      <span className="font-mono tracking-widest">{form.groupCode}</span>
                    </div>
                    {form.requireApproval && (
                      <div className="text-amber-300">🛡️ Cần duyệt thành viên</div>
                    )}
                  </div>

                  <div className="mt-3 rounded-2xl bg-white/5 px-3 py-3">
                    <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">Kênh ban đầu</p>
                    <div className="space-y-1">
                      {selectedChannels.slice(0, 5).map((channel) => (
                        <p key={channel.id} className="text-xs font-bold text-slate-300">
                          {channel.icon} # {channel.label}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-black text-slate-300">
                    <div className="rounded-xl bg-white/5 px-3 py-2">👥 {form.memberLimit || 1000} tối đa</div>
                    <div className="rounded-xl bg-white/5 px-3 py-2">🛡️ {Object.values(form.permissions).filter(Boolean).length} quyền bật</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-3 dark:border-white/10 dark:bg-slate-950 sm:px-6">
          <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-2 sm:gap-3">
          <p className="hidden text-xs font-bold text-slate-500 sm:block">
            {form.name.trim()
              ? 'Nhóm đã sẵn sàng để tạo.'
              : 'Gợi ý: tên nhóm rõ ràng sẽ giúp học sinh tìm thấy nhóm dễ hơn.'}
          </p>

          <div className="ml-auto grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:gap-3">
            <button type="button" onClick={handleClose} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10">
              Hủy
            </button>

            {activePanel === 'confirm' ? (
              <button
                type="button"
                onClick={submit}
                disabled={!form.name.trim()}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-3 py-2.5 text-xs sm:rounded-2xl sm:px-6 sm:py-3 sm:text-sm font-black text-white shadow-lg shadow-blue-500/25 transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-sky-600 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 disabled:shadow-none disabled:hover:translate-y-0 dark:disabled:from-slate-700 dark:disabled:to-slate-700 dark:disabled:text-slate-400"
              >
                ✅ Xác nhận tạo nhóm
              </button>
            ) : creationStep === 1 ? (
              <button
                type="button"
                onClick={() => setActivePanel('channels')}
                disabled={!form.name.trim()}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-3 py-2.5 text-xs sm:rounded-2xl sm:px-6 sm:py-3 sm:text-sm font-black text-white shadow-lg shadow-blue-500/25 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500"
              >
                Tiếp theo →
              </button>
            ) : (
              <button
                type="submit"
                disabled={!form.name.trim()}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-3 py-2.5 text-xs sm:rounded-2xl sm:px-6 sm:py-3 sm:text-sm font-black text-white shadow-lg shadow-blue-500/25 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500"
              >
                Tiếp theo →
              </button>
            )}
          </div>
          </div>
        </div>
      </form>
    </div>
  )
}

function SectionTitle({ title, description }) {
  return (
    <div>
      <h3 className="text-xl font-black text-white">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">{description}</p>
    </div>
  )
}

function ConfirmRow({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl bg-white/5 px-3 py-2">
      <span className="text-xs font-bold text-slate-400 shrink-0">{label}</span>
      <span className={`text-right text-xs font-black text-white break-all ${mono ? 'font-mono tracking-widest' : ''}`}>{value}</span>
    </div>
  )
}

export default GroupModal
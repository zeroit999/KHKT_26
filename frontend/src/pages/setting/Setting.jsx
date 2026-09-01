import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Loader2,
  Lock,
  Mail,
  Menu,
  MonitorSmartphone,
  Palette,
  ShieldCheck,
  X,
} from 'lucide-react'

import { useAuth } from '../../contexts/AuthContext.jsx'
import { authService } from '../../services/auth.js'
import { settingsTabs } from '../../data/settingsData.js'
import {
  getUserSettings,
  updateUserProfileField,
  updateUserSetting,
} from '../../services/settingsService.js'

export default function Setting({ darkMode, onToggleDarkMode }) {
  const { user, userDetails } = useAuth()

  const validTabIds = useMemo(
    () => new Set(settingsTabs.map((tab) => String(tab.id))),
    [],
  )

  const getTabFromUrl = () => {
    if (typeof window === 'undefined') return 'account'
    const requestedTab = new URLSearchParams(window.location.search).get('tab')
    return requestedTab && validTabIds.has(requestedTab)
      ? requestedTab
      : 'account'
  }

  const [activeTab, setActiveTab] = useState(getTabFromUrl)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const [settings, setSettings] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const [localProfile, setLocalProfile] = useState({
    fullName: '',
    phone: '',
  })

  const [editModal, setEditModal] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  useEffect(() => {
    setLocalProfile({
      fullName:
        userDetails?.fullName ||
        user?.displayName ||
        user?.email?.split('@')[0] ||
        '',
      phone:
        userDetails?.phone ||
        userDetails?.phoneNumber ||
        user?.phoneNumber ||
        '',
    })
  }, [userDetails, user])

  const displayName =
    localProfile.fullName ||
    userDetails?.fullName ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'Người dùng'

  const role = userDetails?.role || 'Học sinh'

  const avatarText = useMemo(
    () => displayName.charAt(0).toUpperCase(),
    [displayName],
  )

  const currentTab = settingsTabs.find((tab) => tab.id === activeTab)

  useEffect(() => {
    async function loadSettings() {
      try {
        setIsLoading(true)
        const data = await getUserSettings(user?.uid)
        setSettings(data)
      } catch (error) {
        console.error(error)
        toast.error('Không thể tải cài đặt')
      } finally {
        setIsLoading(false)
      }
    }

    if (user?.uid) loadSettings()
  }, [user?.uid])

  const handleUpdateSetting = async (key, value) => {
    try {
      setSettings((prev) => ({
        ...prev,
        [key]: value,
      }))

      await updateUserSetting(user?.uid, key, value)
      toast.success('Đã lưu thay đổi')
    } catch (error) {
      console.error(error)
      toast.error('Lưu thất bại')
    }
  }

  const handleToggleDarkMode = async () => {
    const nextValue = !darkMode
    onToggleDarkMode?.()
    await handleUpdateSetting('darkMode', nextValue)
  }

  const openEditModal = (field, label, value) => {
    setEditModal({ field, label })
    setEditValue(value || '')
  }

  const closeEditModal = () => {
    setEditModal(null)
    setEditValue('')
  }

  const saveProfileField = async () => {
    try {
      if (!editModal) return

      const value = editValue.trim()

      if (!value) {
        toast.error('Nội dung không được để trống')
        return
      }

      if (editModal.field === 'phone' && !/^\d{10}$/.test(value)) {
        toast.error('Số điện thoại phải gồm đúng 10 chữ số')
        return
      }

      await updateUserProfileField(user.uid, editModal.field, value)

      setLocalProfile((prev) => ({
        ...prev,
        [editModal.field]: value,
      }))

      toast.success('Đã cập nhật')
      closeEditModal()
    } catch (error) {
      console.error(error)
      toast.error('Cập nhật thất bại')
    }
  }

  const handleChangePassword = async () => {
    try {
      if (!user?.email) {
        toast.error('Tài khoản chưa có email')
        return
      }

      if (!passwordForm.currentPassword) {
        toast.error('Nhập mật khẩu hiện tại')
        return
      }

      if (passwordForm.newPassword.length < 6) {
        toast.error('Mật khẩu mới tối thiểu 6 ký tự')
        return
      }

      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        toast.error('Mật khẩu xác nhận không khớp')
        return
      }

      const accessToken = authService.getAccessToken()

      if (!accessToken) {
        toast.error('Vui lòng đăng nhập lại trước khi đổi mật khẩu')
        return
      }

      const apiBaseUrl =
        import.meta.env.VITE_API_BASE_URL ||
        'http://127.0.0.1:5000'

      const response = await fetch(
        `${apiBaseUrl}/auth/change-password`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            current_password: passwordForm.currentPassword,
            new_password: passwordForm.newPassword,
          }),
        },
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            'Đổi mật khẩu thất bại',
        )
      }

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })

      setShowPasswordModal(false)
      toast.success('Đổi mật khẩu thành công')
    } catch (error) {
      console.error(error)

      toast.error(
        error?.message ||
          'Đổi mật khẩu thất bại',
      )
    }
  }

  const closePasswordModal = () => {
    setShowPasswordModal(false)
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
  }

  const handleChangeTab = (tabId) => {
    const safeTab = validTabIds.has(String(tabId))
      ? String(tabId)
      : 'account'

    setActiveTab(safeTab)
    setMobileSidebarOpen(false)

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)

      if (safeTab === 'account') {
        url.searchParams.delete('tab')
      } else {
        url.searchParams.set('tab', safeTab)
      }

      window.history.pushState(
        {},
        '',
        `${url.pathname}${url.search}${url.hash}`,
      )
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncTabFromUrl = () => {
      const params = new URLSearchParams(window.location.search)
      const requestedTab = params.get('tab')
      const safeTab =
        requestedTab && validTabIds.has(requestedTab)
          ? requestedTab
          : 'account'

      setActiveTab(safeTab)

      if (requestedTab && requestedTab !== safeTab) {
        const url = new URL(window.location.href)
        url.searchParams.delete('tab')
        window.history.replaceState(
          {},
          '',
          `${url.pathname}${url.search}${url.hash}`,
        )
      }
    }

    window.addEventListener('popstate', syncTabFromUrl)
    return () => window.removeEventListener('popstate', syncTabFromUrl)
  }, [validTabIds])

  if (isLoading) {
    return (
      <main className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="animate-spin text-blue-600" size={34} />
      </main>
    )
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <aside
        className={`fixed left-0 top-[72px] z-40 hidden h-[calc(100vh-72px)] border-r border-slate-200 bg-white transition-all duration-300 dark:border-white/10 dark:bg-slate-900 xl:block ${
          sidebarCollapsed ? 'w-[88px]' : 'w-[240px]'
        }`}
      >
        <SidebarContent
          user={user}
          displayName={displayName}
          role={role}
          avatarText={avatarText}
          activeTab={activeTab}
          onChangeTab={handleChangeTab}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        />
      </aside>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={() => setMobileSidebarOpen(false)}
            className="absolute inset-0 bg-black/40"
          />

          <aside className="relative h-full w-[280px] max-w-[86vw] bg-white dark:bg-slate-900">
            <SidebarContent
              user={user}
              displayName={displayName}
              role={role}
              avatarText={avatarText}
              activeTab={activeTab}
              onChangeTab={handleChangeTab}
              onClose={() => setMobileSidebarOpen(false)}
            />
          </aside>
        </div>
      )}

      <section
        className={`min-h-[calc(100vh-72px)] transition-all duration-300 ${
          sidebarCollapsed ? 'xl:pl-[88px]' : 'xl:pl-[240px]'
        }`}
      >
        <header className="border-b border-slate-200 bg-white px-5 py-5 dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="rounded-xl border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-slate-800 xl:hidden"
            >
              <Menu size={22} />
            </button>

            <div>
              <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                Cài đặt
              </p>
              <h1 className="text-2xl font-black">
                {currentTab?.label || 'Tài khoản'}
              </h1>
            </div>
          </div>
        </header>

        <div className="p-5 lg:p-7">
          <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900 lg:p-8">
            <SettingsContent
              activeTab={activeTab}
              settings={settings}
              darkMode={darkMode}
              user={user}
              userDetails={userDetails}
              displayName={displayName}
              localProfile={localProfile}
              onToggleDarkMode={handleToggleDarkMode}
              onUpdateSetting={handleUpdateSetting}
              onEdit={openEditModal}
              onOpenPasswordModal={() => setShowPasswordModal(true)}
            />
          </div>
        </div>
      </section>

      {editModal && (
        <EditModal
          label={editModal.label}
          value={editValue}
          onChange={setEditValue}
          onClose={closeEditModal}
          onSave={saveProfileField}
        />
      )}

      {showPasswordModal && (
        <PasswordModal
          passwordForm={passwordForm}
          setPasswordForm={setPasswordForm}
          onClose={closePasswordModal}
          onSave={handleChangePassword}
        />
      )}
    </main>
  )
}

function SidebarContent({
  user,
  displayName,
  role,
  avatarText,
  activeTab,
  onChangeTab,
  onClose,
  collapsed = false,
  onToggleCollapse,
}) {
  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900">
      <div
        className={`flex items-center border-b border-slate-200 px-4 py-4 dark:border-white/10 ${
          collapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        {!collapsed && (
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Cài đặt
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Quản lý tài khoản
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onClose || onToggleCollapse}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {onClose ? (
            <X size={18} />
          ) : collapsed ? (
            <ChevronRight size={19} />
          ) : (
            <ChevronLeft size={19} />
          )}
        </button>
      </div>

      <div className={collapsed ? 'px-0 py-4' : 'px-4 py-4'}>
        <div
          className={`flex items-center gap-3 ${
            collapsed
              ? 'justify-center'
              : 'rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-800/60'
          }`}
        >
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={displayName}
              title={displayName}
              className="h-11 w-11 rounded-full object-cover"
            />
          ) : (
            <div
              title={displayName}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-black text-white"
            >
              {avatarText}
            </div>
          )}

          {!collapsed && (
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black text-slate-900 dark:text-white">
                {displayName}
              </h3>
              <p className="truncate text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                {role}
              </p>
            </div>
          )}
        </div>
      </div>

      <nav className={`flex-1 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
        {settingsTabs.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id

          return (
            <button
              key={tab.id}
              type="button"
              title={tab.label}
              onClick={() => onChangeTab(tab.id)}
              className={`flex w-full items-center rounded-xl font-bold transition ${
                collapsed
                  ? 'h-12 justify-center'
                  : 'gap-3 px-3 py-2.5 text-left text-sm'
              } ${
                active
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span
                className={`flex shrink-0 items-center justify-center rounded-xl ${
                  collapsed ? 'h-10 w-10' : 'h-9 w-9'
                } ${
                  active
                    ? 'bg-white/15 text-white'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                <Icon size={collapsed ? 21 : 18} />
              </span>

              {!collapsed && <span>{tab.label}</span>}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function SettingsContent({
  activeTab,
  settings,
  darkMode,
  user,
  userDetails,
  displayName,
  localProfile,
  onToggleDarkMode,
  onUpdateSetting,
  onEdit,
  onOpenPasswordModal,
}) {
  if (activeTab === 'account') {
    return (
      <Panel
        title="Thông tin tài khoản"
        description="Cập nhật thông tin cá nhân dùng trong hệ thống học tập."
      >
        <InfoRow
          label="Họ tên"
          value={displayName}
          editable
          onEdit={() => onEdit('fullName', 'Họ tên', displayName)}
        />

        <InfoRow label="Email" value={user?.email || 'Chưa cập nhật'} />

        <InfoRow
          label="Số điện thoại"
          value={localProfile.phone || 'Chưa cập nhật'}
          editable
          onEdit={() => onEdit('phone', 'Số điện thoại', localProfile.phone)}
        />

        <InfoRow label="Vai trò" value={userDetails?.role || 'Học sinh'} />
      </Panel>
    )
  }

  if (activeTab === 'security') {
    return (
      <Panel
        title="Bảo mật và đăng nhập"
        description="Quản lý thông tin đăng nhập và bảo vệ tài khoản."
      >
        <InfoRow label="Email đăng nhập" value={user?.email || 'Chưa cập nhật'} />

        <InfoRow
          label="Mật khẩu"
          value="••••••••••••"
          editable
          buttonText="Đổi mật khẩu"
          onEdit={onOpenPasswordModal}
        />

        <SettingRow
          icon={ShieldCheck}
          title="Bảo mật 2 lớp"
          description="Thêm một lớp xác minh khi đăng nhập."
          checked={settings?.twoFactor}
          onChange={() => onUpdateSetting('twoFactor', !settings?.twoFactor)}
        />

        <SettingRow
          icon={Lock}
          title="Cảnh báo đăng nhập"
          description="Nhận thông báo khi có đăng nhập mới."
          checked={settings?.loginAlert}
          onChange={() => onUpdateSetting('loginAlert', !settings?.loginAlert)}
        />
      </Panel>
    )
  }

  if (activeTab === 'notifications') {
    return (
      <Panel
        title="Thông báo"
        description="Tùy chỉnh cách ZUNY gửi nhắc nhở và thông báo học tập."
      >
        <SettingRow
          icon={Bell}
          title="Thông báo chung"
          description="Nhận thông báo từ hệ thống ZUNY."
          checked={settings?.notifications}
          onChange={() =>
            onUpdateSetting('notifications', !settings?.notifications)
          }
        />

        <SettingRow
          icon={Mail}
          title="Thông báo qua email"
          description="Gửi thông báo quan trọng về email."
          checked={settings?.emailNotifications}
          onChange={() =>
            onUpdateSetting(
              'emailNotifications',
              !settings?.emailNotifications,
            )
          }
        />

        <SettingRow
          title="Nhắc lịch thi"
          description="Nhắc trước khi bài thi bắt đầu."
          checked={settings?.examReminder}
          onChange={() =>
            onUpdateSetting('examReminder', !settings?.examReminder)
          }
        />

        <SettingRow
          title="Thông báo cộng đồng"
          description="Nhận thông báo khi có phản hồi diễn đàn."
          checked={settings?.forumNotification}
          onChange={() =>
            onUpdateSetting(
              'forumNotification',
              !settings?.forumNotification,
            )
          }
        />
      </Panel>
    )
  }

  if (activeTab === 'appearance') {
    return (
      <Panel
        title="Giao diện"
        description="Điều chỉnh cách hiển thị giao diện học tập."
      >
        <SettingRow
          icon={MonitorSmartphone}
          title="Chế độ tối"
          description="Đồng bộ giao diện tối với tài khoản."
          checked={darkMode}
          onChange={onToggleDarkMode}
        />

        <SettingRow
          icon={Palette}
          title="Chế độ gọn"
          description="Giảm khoảng cách giữa các thành phần."
          checked={settings?.compactMode}
          onChange={() => onUpdateSetting('compactMode', !settings?.compactMode)}
        />
      </Panel>
    )
  }

  return (
    <Panel
      title="Ngôn ngữ"
      description="Chọn ngôn ngữ hiển thị cho giao diện ZUNY."
    >
      <div className="space-y-3 py-5">
        {[
          { id: 'vi', label: 'Tiếng Việt', desc: 'Ngôn ngữ mặc định' },
          { id: 'en', label: 'English', desc: 'English interface' },
        ].map((lang) => {
          const selected = settings?.language === lang.id

          return (
            <button
              key={lang.id}
              type="button"
              onClick={() => onUpdateSetting('language', lang.id)}
              className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                selected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/15'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5'
              }`}
            >
              <div>
                <h4 className="font-bold">{lang.label}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {lang.desc}
                </p>
              </div>

              {selected && <Check className="text-blue-600" size={20} />}
            </button>
          )
        })}
      </div>
    </Panel>
  )
}

function Panel({ title, description, children }) {
  return (
    <div>
      <div className="border-b border-slate-200 pb-5 dark:border-white/10">
        <h2 className="text-2xl font-black">{title}</h2>

        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>

      <div className="divide-y divide-slate-200 dark:divide-white/10">
        {children}
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
  editable = false,
  buttonText = 'Chỉnh sửa',
  onEdit,
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-5">
      <div>
        <h3 className="font-bold">{label}</h3>

        <p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">
          {value}
        </p>
      </div>

      {editable && (
        <button
          type="button"
          onClick={onEdit}
          className="rounded-xl px-3 py-2 text-sm font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10"
        >
          {buttonText}
        </button>
      )}
    </div>
  )
}

function SettingRow({ icon: Icon, title, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-6 py-5">
      <div className="flex items-center gap-4">
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Icon size={19} />
          </div>
        )}

        <div>
          <h3 className="font-bold">{title}</h3>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>
      </div>

      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

function PasswordModal({
  passwordForm,
  setPasswordForm,
  onClose,
  onSave,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black">Đổi mật khẩu</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Dùng mật khẩu mạnh và không dùng lại ở nơi khác.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <Input
            type="password"
            placeholder="Mật khẩu hiện tại"
            value={passwordForm.currentPassword}
            onChange={(value) =>
              setPasswordForm((prev) => ({
                ...prev,
                currentPassword: value,
              }))
            }
          />

          <Input
            type="password"
            placeholder="Mật khẩu mới"
            value={passwordForm.newPassword}
            onChange={(value) =>
              setPasswordForm((prev) => ({
                ...prev,
                newPassword: value,
              }))
            }
          />

          <Input
            type="password"
            placeholder="Nhập lại mật khẩu mới"
            value={passwordForm.confirmPassword}
            onChange={(value) =>
              setPasswordForm((prev) => ({
                ...prev,
                confirmPassword: value,
              }))
            }
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-4 py-2 font-bold dark:bg-slate-800"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={onSave}
            className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
          >
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  )
}

function EditModal({ label, value, onChange, onClose, onSave }) {
  const isPhone = label === 'Số điện thoại'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black">Chỉnh sửa {label}</h3>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <Input
          value={value}
          onChange={(newValue) => {
            if (isPhone) {
              onChange(newValue.replace(/\D/g, '').slice(0, 10))
              return
            }

            onChange(newValue)
          }}
          className="mt-5"
          inputMode={isPhone ? 'numeric' : undefined}
          maxLength={isPhone ? 10 : undefined}
          placeholder={isPhone ? 'Nhập 10 chữ số' : undefined}
        />

        {isPhone && (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Số điện thoại phải gồm đúng 10 chữ số.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-4 py-2 font-bold dark:bg-slate-800"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={onSave}
            className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  )
}

function Input({ value, onChange, className = '', ...props }) {
  return (
    <input
      {...props}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white dark:border-white/10 dark:bg-slate-800 dark:focus:bg-slate-900 ${className}`}
    />
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${
        checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
          checked ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  )
}
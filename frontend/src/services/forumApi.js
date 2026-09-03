import { authService } from './auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://127.0.0.1:5000' : '')

const readJson = async (response) => response.json().catch(() => ({}))

const request = async (path, options = {}, retry = true) => {
  let accessToken = authService.getAccessToken()
  const headers = new Headers(options.headers || {})
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  if (!(options.body instanceof FormData) && options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })

  if (response.status === 401 && retry && authService.getRefreshToken()) {
    accessToken = await authService.refreshAccessToken()
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  }

  const data = await readJson(response)
  if (!response.ok) {
    const error = new Error(data.error || data.message || `HTTP_${response.status}`)
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

const json = (method, path, body) => request(path, {
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
})

const upload = async (path, file, extra = {}) => {
  const form = new FormData()
  form.append('file', file, file?.name || 'upload.bin')
  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== null) form.append(key, String(value))
  })
  return request(path, { method: 'POST', body: form })
}

export const forumApi = {
  me: () => request('/auth/me'),
  users: () => request('/api/forum/users?limit=500'),
  updateUserRestriction: (userId, key, blocked) => json('PATCH', `/api/forum/users/${userId}/restrictions`, { key, blocked }),

  posts: (params = {}) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
    })
    return request(`/api/forum/posts${query.size ? `?${query.toString()}` : ''}`)
  },
  post: (postId) => request(`/api/forum/posts/${postId}`),
  createPost: (payload) => json('POST', '/api/forum/posts', payload),
  deletePost: (postId, reason = '') => json('DELETE', `/api/forum/posts/${postId}`, { reason }),
  moderatePost: (postId, action, reason = '') => json('PATCH', `/api/forum/posts/${postId}/moderation`, { action, reason }),
  viewPost: (postId) => json('POST', `/api/forum/posts/${postId}/view`, {}),
  reactPost: (postId, reaction) => json('POST', `/api/forum/posts/${postId}/reaction`, { reaction }),
  savePost: (postId) => json('POST', `/api/forum/posts/${postId}/save`, {}),
  eventInterest: (postId, interest) => json('POST', `/api/forum/posts/${postId}/event-interest`, { interest }),
  vote: (postId, optionId) => json('POST', `/api/forum/posts/${postId}/vote`, { optionId }),
  comments: (postId) => request(`/api/forum/posts/${postId}/comments?limit=300`),
  createComment: (postId, payload) => json('POST', `/api/forum/posts/${postId}/comments`, payload),
  reactComment: (postId, commentId, reaction) => json('POST', `/api/forum/posts/${postId}/comments/${commentId}/reaction`, { reaction }),

  reports: () => request('/api/forum/reports?limit=120'),
  createReport: (postId, reason, detail = '') => json('POST', `/api/forum/posts/${postId}/reports`, { reason, detail }),
  deleteReport: (reportId) => json('DELETE', `/api/forum/reports/${reportId}`),

  notifications: () => request('/api/forum/notifications?limit=200'),
  readNotification: (id) => json('PATCH', `/api/forum/notifications/${id}/read`, {}),
  deleteNotification: (id) => json('DELETE', `/api/forum/notifications/${id}`),
  broadcastNotification: (payload) => json('POST', '/api/forum/notifications/broadcast', payload),

  groups: () => request('/api/forum/groups?limit=160'),
  createGroup: (payload) => json('POST', '/api/forum/groups', payload),
  updateGroup: (groupId, payload) => json('PATCH', `/api/forum/groups/${groupId}`, payload),
  deleteGroup: (groupId, reason = '') => json('DELETE', `/api/forum/groups/${groupId}`, { reason }),
  membership: (groupId, action, extra = {}) => json('POST', `/api/forum/groups/${groupId}/membership`, { action, ...extra }),
  adminJoinGroup: (groupId) => json('POST', `/api/forum/groups/${groupId}/admin-join`, {}),
  rotateInvite: (groupId) => json('POST', `/api/forum/groups/${groupId}/rotate-invite`, {}),

  groupReports: () => request('/api/forum/group-reports?limit=160'),
  createGroupReport: (groupId, reason, detail = '') => json('POST', `/api/forum/groups/${groupId}/reports`, { reason, detail }),
  resolveGroupReport: (reportId, status = 'resolved') => json('PATCH', `/api/forum/group-reports/${reportId}`, { status }),
  groupWarning: (groupId, payload) => json('POST', `/api/forum/groups/${groupId}/warnings`, payload),

  groupMessages: (groupId, channelId = '', limit = 300) => {
    const query = new URLSearchParams()
    if (channelId) query.set('channelId', String(channelId))
    query.set('limit', String(limit))
    return request(`/api/forum/groups/${groupId}/messages?${query.toString()}`)
  },
  sendGroupMessage: (groupId, payload) => json(
    'POST',
    `/api/forum/groups/${groupId}/messages`,
    typeof payload === 'string' ? { content: payload } : payload,
  ),
  updateGroupMessage: (groupId, messageId, payload) => json(
    'PATCH',
    `/api/forum/groups/${groupId}/messages/${messageId}`,
    payload,
  ),
  deleteGroupMessage: (groupId, messageId) => json(
    'DELETE',
    `/api/forum/groups/${groupId}/messages/${messageId}`,
    {},
  ),
  reactGroupMessage: (groupId, messageId, emoji) => json(
    'POST',
    `/api/forum/groups/${groupId}/messages/${messageId}/reaction`,
    { emoji },
  ),
  deleteGroupChannelMessages: (groupId, channelId) => json(
    'DELETE',
    `/api/forum/groups/${groupId}/channels/${encodeURIComponent(channelId)}/messages`,
    {},
  ),
  groupPresence: (groupId) => request(`/api/forum/groups/${groupId}/presence`),
  updateGroupPresence: (groupId, payload) => json(
    'POST',
    `/api/forum/groups/${groupId}/presence`,
    payload,
  ),
  manageGroupMember: (groupId, userId, action) => json(
    'PATCH',
    `/api/forum/groups/${groupId}/members/${userId}`,
    { action },
  ),
  updateMyForumSettings: (payload) => json(
    'PATCH',
    '/api/forum/users/me/forum-settings',
    payload,
  ),

  uploadForumAsset: (file, kind = 'post') => upload('/api/storage/forum/asset', file, { kind }),
}

export default forumApi
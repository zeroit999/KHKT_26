import apiClient from '../utils/apiClient'
import { authService } from './auth'

const unwrap = (response) => response?.data || {}

export const eLearningApi = {
  me: async () =>
    authService.getMe(),

  users: async () =>
    unwrap(await apiClient.get('/forum/users', {
      params: { limit: 500 },
    })),

  updateUser: async (userId, payload) =>
    unwrap(await apiClient.patch(`/learning/users/${userId}`, payload)),

  classrooms: async () =>
    unwrap(await apiClient.get('/classrooms')),

  courses: async (params = {}) =>
    unwrap(await apiClient.get('/courses', { params })),

  course: async (courseId) =>
    unwrap(await apiClient.get(`/courses/${courseId}`)),

  createCourse: async (payload) =>
    unwrap(await apiClient.post('/courses', payload)),

  updateCourse: async (courseId, payload) =>
    unwrap(await apiClient.patch(`/courses/${courseId}`, payload)),

  deleteCourse: async (courseId) =>
    unwrap(await apiClient.delete(`/courses/${courseId}`)),

  progress: async (courseId) =>
    unwrap(await apiClient.get(`/courses/${courseId}/progress`)),

  updateProgress: async (courseId, payload) =>
    unwrap(await apiClient.patch(`/courses/${courseId}/progress`, payload)),

  ratings: async (courseId) =>
    unwrap(await apiClient.get(`/courses/${courseId}/ratings`)),

  questions: async (courseId) =>
    unwrap(await apiClient.get(`/courses/${courseId}/questions`)),

  deleteQuestion: async (courseId, questionId) =>
    unwrap(await apiClient.delete(`/courses/${courseId}/questions/${questionId}`)),

  deleteReply: async (courseId, questionId, replyId) =>
    unwrap(await apiClient.delete(
      `/courses/${courseId}/questions/${questionId}/replies/${replyId}`,
    )),

  savedLists: async () =>
    unwrap(await apiClient.get('/learning/saved-lists')),

  createSavedList: async (payload) =>
    unwrap(await apiClient.post('/learning/saved-lists', payload)),

  updateSavedList: async (listId, payload) =>
    unwrap(await apiClient.patch(`/learning/saved-lists/${listId}`, payload)),

  deleteSavedList: async (listId) =>
    unwrap(await apiClient.delete(`/learning/saved-lists/${listId}`)),

  enableSavedListShare: async (listId) =>
    unwrap(await apiClient.post(`/learning/saved-lists/${listId}/share`, {})),

  importSavedList: async (code) =>
    unwrap(await apiClient.post('/learning/saved-lists/import', { code })),

  playlists: async () =>
    unwrap(await apiClient.get('/learning/playlists')),

  createPlaylist: async (payload) =>
    unwrap(await apiClient.post('/learning/playlists', payload)),

  updatePlaylist: async (playlistId, payload) =>
    unwrap(await apiClient.patch(`/learning/playlists/${playlistId}`, payload)),

  deletePlaylist: async (playlistId) =>
    unwrap(await apiClient.delete(`/learning/playlists/${playlistId}`)),

  following: async () =>
    unwrap(await apiClient.get('/learning/following')),

  toggleFollow: async (targetUserId) =>
    unwrap(await apiClient.post(`/learning/following/${targetUserId}`, {})),

  touchFollow: async (targetUserId) =>
    unwrap(await apiClient.patch(`/learning/following/${targetUserId}`, {
      lastOpened: true,
    })),

  notifications: async () =>
    unwrap(await apiClient.get('/learning/notifications')),

  createNotification: async (payload) =>
    unwrap(await apiClient.post('/learning/notifications', payload)),

  updateNotification: async (notificationId, payload) =>
    unwrap(await apiClient.patch(`/learning/notifications/${notificationId}`, payload)),

  reports: async () =>
    unwrap(await apiClient.get('/learning/reports')),

  createReport: async (payload) =>
    unwrap(await apiClient.post('/learning/reports', payload)),

  updateReport: async (reportId, payload) =>
    unwrap(await apiClient.patch(`/learning/reports/${reportId}`, payload)),

  createCommentWarning: async (payload) =>
    unwrap(await apiClient.post('/learning/comment-warnings', payload)),

  uploadAsset: async (file, kind, folder = '') => {
    const form = new FormData()
    form.append('file', file, file?.name || 'upload.bin')
    form.append('kind', kind)
    if (folder) form.append('folder', folder)

    const response = await apiClient.post('/storage/e-learning/asset', form, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    return unwrap(response)
  },
}

export default eLearningApi

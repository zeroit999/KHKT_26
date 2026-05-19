import apiClient from '../utils/apiClient'

export const getExamsApi = () => {
  return apiClient.get('/exams')
}

export const getExamDetailApi = (examId) => {
  return apiClient.get(`/exams/${examId}`)
}

export const createExamApi = (payload) => {
  return apiClient.post('/exams', payload)
}

export const updateExamApi = (examId, payload) => {
  return apiClient.put(`/exams/${examId}`, payload)
}

export const deleteExamApi = (examId) => {
  return apiClient.delete(`/exams/${examId}`)
}

export const submitExamApi = (examId, payload) => {
  return apiClient.post(`/exams/${examId}/submit`, payload)
}

export const getMyExamResultApi = (examId) => {
  return apiClient.get(`/exams/${examId}/my-result`)
}

export const getExamResultsApi = (examId) => {
  return apiClient.get(`/exams/${examId}/results`)
}
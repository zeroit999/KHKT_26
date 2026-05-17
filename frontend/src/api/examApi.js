import apiClient from '../utils/apiClient'

export const submitExamApi = (examId, payload) => {
  return apiClient.post(`/exams/${examId}/submit`, payload)
}

export const getMyExamResultApi = (examId) => {
  return apiClient.get(`/exams/${examId}/my-result`)
}

export const getExamResultsApi = (examId) => {
  return apiClient.get(`/exams/${examId}/results`)
}
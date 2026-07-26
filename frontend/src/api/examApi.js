import apiClient from '../utils/apiClient';

export const getExamsApi = () => apiClient.get('/exams');

export const getExamDetailApi = (examId) => apiClient.get(`/exams/${examId}`);

export const createExamApi = (payload) => apiClient.post('/exams', payload);

export const updateExamApi = (examId, payload) =>
  apiClient.put(`/exams/${examId}`, payload);

export const deleteExamApi = (examId) => apiClient.delete(`/exams/${examId}`);

export const submitExamApi = (examId, payload) =>
  apiClient.post(`/exams/${examId}/submit`, payload);

export const getMyExamResultApi = (examId) =>
  apiClient.get(`/exams/${examId}/my-result`);

export const getExamResultsApi = (examId) =>
  apiClient.get(`/exams/${examId}/results`);

export const gradeExamResultApi = (examId, resultId, payload) =>
  apiClient.post(`/exams/${examId}/results/${resultId}/grade`, payload);

export const parseWordExamApi = (formData) =>
  apiClient.post('/exams/parse-word', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
export const getDeletedExamsApi = () => apiClient.get('/exams/trash');

export const restoreExamApi = (examId) =>
  apiClient.post(`/exams/${examId}/restore`);

export const permanentDeleteExamApi = (examId) =>
  apiClient.delete(`/exams/${examId}/permanent`);

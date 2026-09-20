import apiClient from '../utils/apiClient'


const normalizeProblemId = (value) => (
  String(value ?? '').trim()
)


const unwrap = (response) => (
  response?.data ?? response
)


const listProblems = async () => {
  const response = await apiClient.get(
    '/oj/problems',
  )

  return unwrap(response)
}


const getProblem = async (problemId) => {
  const response = await apiClient.get(
    `/oj/problems/${normalizeProblemId(problemId)}`,
  )

  return unwrap(response)
}


const createProblem = async (payload) => {
  const response = await apiClient.post(
    '/oj/problems',
    payload,
  )

  return unwrap(response)
}


const updateProblem = async (
  problemId,
  payload,
) => {
  const response = await apiClient.put(
    `/oj/problems/${normalizeProblemId(problemId)}`,
    payload,
  )

  return unwrap(response)
}


const addTestcase = async (
  problemId,
  payload,
) => {
  const response = await apiClient.post(
    `/oj/problems/${normalizeProblemId(problemId)}/testcases`,
    payload,
  )

  return unwrap(response)
}


const getManagerProblem = async (problemId) => {
  const response = await apiClient.get(
    `/oj/manage/problems/${normalizeProblemId(problemId)}`,
  )

  return unwrap(response)
}


const updateTestcase = async (
  problemId,
  testcaseId,
  payload,
) => {
  const response = await apiClient.put(
    `/oj/manage/problems/${normalizeProblemId(problemId)}/testcases/${testcaseId}`,
    payload,
  )

  return unwrap(response)
}


const deleteTestcase = async (
  problemId,
  testcaseId,
) => {
  const response = await apiClient.delete(
    `/oj/manage/problems/${normalizeProblemId(problemId)}/testcases/${testcaseId}`,
  )

  return unwrap(response)
}



const submitProblem = async (
  problemId,
  payload,
) => {
  const response = await apiClient.post(
    `/oj/problems/${normalizeProblemId(problemId)}/submit`,
    payload,
  )

  return unwrap(response)
}


const listSubmissions = async (
  problemCode = '',
) => {
  const response = await apiClient.get(
    '/oj/submissions',
    {
      params: problemCode
        ? {
            problemCode:
              normalizeProblemId(problemCode),
          }
        : {},
    },
  )

  return unwrap(response)
}


const getSubmission = async (
  submissionId,
) => {
  const response = await apiClient.get(
    `/oj/submissions/${submissionId}`,
  )

  return unwrap(response)
}


const ojApi = {
  listProblems,
  getProblem,
  createProblem,
  updateProblem,
  addTestcase,
  getManagerProblem,
  updateTestcase,
  deleteTestcase,
  submitProblem,
  listSubmissions,
  getSubmission,
}


export default ojApi

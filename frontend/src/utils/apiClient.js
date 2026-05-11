// apiClient.js - Utility cho authenticated API requests

const API_BASE_URL = import.meta.env.VITE_RAG_API_URL || "http://localhost:5002";

export class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  /**
   * Tạo headers cho authenticated requests
   */
  createHeaders(token, userId, isPro = false) {
    const headers = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    if (userId) {
      headers["X-User-ID"] = userId;
    }

    headers["X-User-Pro"] = isPro.toString();

    return headers;
  }

  /**
   * Generic request method với retry logic
   */
  async request(endpoint, options = {}, retryOnAuth = true) {
    const url = `${this.baseURL}${endpoint}`;

    try {
      const response = await fetch(url, options);

      // Nếu 401 và cho phép retry, thử refresh token
      if (response.status === 401 && retryOnAuth && options.onAuthError) {
        const newToken = await options.onAuthError();
        if (newToken) {
          // Update headers với token mới
          const newOptions = {
            ...options,
            headers: {
              ...options.headers,
              "Authorization": `Bearer ${newToken}`
            }
          };
          // Retry request với token mới (không retry lần nữa)
          return this.request(endpoint, newOptions, false);
        }
      }

      return response;
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Test authentication endpoint
   */
  async testAuth(authData) {
    const { token, userId, isPro, onAuthError } = authData;

    const options = {
      method: "POST",
      headers: this.createHeaders(token, userId, isPro),
      body: JSON.stringify({
        test_message: "Hello from frontend",
        userId,
        isPro
      }),
      onAuthError
    };

    const response = await this.request("/api/auth-test", options);
    return response.json();
  }

  /**
   * Chatbot API call
   */
  async askChatbot(question, authData) {
    const { token, userId, isPro, onAuthError } = authData;

    const options = {
      method: "POST",
      headers: this.createHeaders(token, userId, isPro),
      body: JSON.stringify({
        question,
        userId,
        isPro
      }),
      onAuthError
    };

    const response = await this.request("/api/ask", options);
    return response.json();
  }

  /**
   * CV Evaluation API call
   */
  async evaluateCV(cvData, authData) {
    const { token, userId, isPro, onAuthError } = authData;

    const options = {
      method: "POST",
      headers: this.createHeaders(token, userId, isPro),
      body: JSON.stringify({
        ...cvData,
        userId,
        isPro
      }),
      onAuthError
    };

    const response = await this.request("/api/evaluate-cv", options);
    return response.json();
  }

  /**
   * Interview API call
   */
  async conductInterview(interviewData, authData) {
    const { token, userId, isPro, onAuthError } = authData;

    const options = {
      method: "POST",
      headers: this.createHeaders(token, userId, isPro),
      body: JSON.stringify({
        ...interviewData,
        userId,
        isPro
      }),
      onAuthError
    };

    const response = await this.request("/api/interview", options);
    return response.json();
  }

  /**
   * Check system status
   */
  async checkStatus() {
    const response = await this.request("/api/status", { method: "GET" }, false);
    return response.json();
  }

  /**
   * Career guidance API call
   */
  async getCareerGuidance(guidanceData, authData) {
    const { token, userId, isPro, onAuthError } = authData;

    const options = {
      method: "POST",
      headers: this.createHeaders(token, userId, isPro),
      body: JSON.stringify({
        ...guidanceData,
        userId,
        isPro
      }),
      onAuthError
    };

    const response = await this.request("/api/career-guidance", options);
    return response.json();
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export helper function để sử dụng với useAuth hook
export const createAuthData = (user, authToken, isPro, getAuthToken) => ({
  token: authToken,
  userId: user?.uid,
  isPro,
  onAuthError: async () => {
    try {
      return await getAuthToken();
    } catch (error) {
      console.error("Failed to refresh auth token:", error);
      return null;
    }
  }
});

export default apiClient;
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request (reads from zustand persisted state)
api.interceptors.request.use((config) => {
  const stored = localStorage.getItem('attrition-auth')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      const token = parsed?.state?.token
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    } catch {
      // ignore malformed storage
    }
  }
  return config
})

// Auto-logout on 401 (for expired/invalid session on protected endpoints)
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || ''
      const isAuthAttempt = url.includes('/auth/login') || url.includes('/auth/register')
      if (!isAuthAttempt) {
        localStorage.removeItem('attrition-auth')
        if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api
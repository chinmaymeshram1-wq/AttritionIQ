/// <reference types="vite/client" />

import axios from 'axios'

const API_URL =
  import.meta.env.VITE_API_URL || 'https://attritioniq-backend.onrender.com'

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach JWT token to every request
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
      // Ignore malformed localStorage data
    }
  }

  return config
})

// Automatically log out when JWT expires/is invalid
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('attrition-auth')
      window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)

export default api
import api from './api'
import type { TokenResponse, RegisterRequest, LoginRequest, OnboardingRequest } from '@/types'

export const authService = {
  async login(data: LoginRequest): Promise<TokenResponse> {
    const params = new URLSearchParams()
    params.append('username', data.email)
    params.append('password', data.password)
    const res = await api.post<TokenResponse>('/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    return res.data
  },
  async register(data: RegisterRequest): Promise<TokenResponse> {
    const res = await api.post<TokenResponse>('/auth/register', data)
    return res.data
  },
  async forgotPassword(email: string): Promise<void> {
    await api.post('/auth/forgot-password', { email })
  },
  async onboarding(data: OnboardingRequest): Promise<void> {
    await api.post('/auth/onboarding', data)
  },
}

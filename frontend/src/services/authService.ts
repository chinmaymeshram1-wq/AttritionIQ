import api from './api'
import type { TokenResponse, RegisterRequest, LoginRequest, OnboardingRequest } from '@/types'

export const authService = {
  async login(data: LoginRequest): Promise<TokenResponse> {
    const res = await api.post<TokenResponse>('/auth/login', {
      email: data.email.trim(),
      password: data.password,
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

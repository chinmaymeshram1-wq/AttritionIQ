import api from './api'
import type { ChatRequest, ChatResponse } from '@/types'

export const aiService = {
  async chat(data: ChatRequest): Promise<ChatResponse> {
    const res = await api.post<ChatResponse>('/ai/chat', data)
    return res.data
  },
}

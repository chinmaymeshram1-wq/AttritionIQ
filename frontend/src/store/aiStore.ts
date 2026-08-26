import { create } from 'zustand'
import { aiService } from '@/services/aiService'
import type { ChatMessage, Conversation, PredictionResponse } from '@/types'

const STORAGE_KEY = 'attrition-ai-history'
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

function generateTitle(message: string): string {
  const clean = message.trim().replace(/\s+/g, ' ')
  if (clean.length <= 40) return clean
  return clean.slice(0, 38) + '…'
}

function isConversationValid(c: Conversation): boolean {
  if (!c || !c.id) return false
  const time = new Date(c.updatedAt || c.createdAt).getTime()
  if (isNaN(time)) return false
  return Date.now() - time < TWENTY_FOUR_HOURS_MS
}

function loadStoredConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: Conversation[] = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const valid = parsed.filter(isConversationValid)
    if (valid.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid))
    }
    return valid
  } catch {
    return []
  }
}

function saveStoredConversations(conversations: Conversation[]): void {
  try {
    const valid = conversations.filter(isConversationValid)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(valid))
  } catch {
    // Ignore storage quota or serialization errors safely
  }
}

interface AiState {
  conversations: Conversation[]
  activeConversationId: string | null
  input: string
  loading: boolean
  predictionContext: PredictionResponse | undefined

  cleanupExpired: () => void
  startNewConversation: (context?: PredictionResponse) => void
  selectConversation: (id: string) => void
  deleteConversation: (id: string) => void
  clearAllHistory: () => void
  setInput: (input: string) => void
  setPredictionContext: (context?: PredictionResponse) => void
  sendMessage: (text: string, context?: PredictionResponse) => Promise<void>
}

const initialConversations = loadStoredConversations()
const initialActiveId = initialConversations.length > 0 ? initialConversations[0].id : null

export const useAiStore = create<AiState>((set, get) => ({
  conversations: initialConversations,
  activeConversationId: initialActiveId,
  input: '',
  loading: false,
  predictionContext: undefined,

  cleanupExpired: () => {
    const current = get().conversations
    const valid = current.filter(isConversationValid)
    if (valid.length !== current.length) {
      const activeId = get().activeConversationId
      const stillActive = valid.some((c) => c.id === activeId)
      set({
        conversations: valid,
        activeConversationId: stillActive ? activeId : valid[0]?.id || null,
      })
      saveStoredConversations(valid)
    }
  },

  startNewConversation: (context?: PredictionResponse) => {
    get().cleanupExpired()
    set({
      activeConversationId: null,
      input: '',
      predictionContext: context || undefined,
    })
  },

  selectConversation: (id: string) => {
    get().cleanupExpired()
    const target = get().conversations.find((c) => c.id === id)
    if (target) {
      set({
        activeConversationId: id,
        input: '',
      })
    }
  },

  deleteConversation: (id: string) => {
    const remaining = get().conversations.filter((c) => c.id !== id)
    let nextActiveId = get().activeConversationId
    if (nextActiveId === id) {
      nextActiveId = remaining.length > 0 ? remaining[0].id : null
    }
    set({
      conversations: remaining,
      activeConversationId: nextActiveId,
    })
    saveStoredConversations(remaining)
  },

  clearAllHistory: () => {
    set({
      conversations: [],
      activeConversationId: null,
      input: '',
      loading: false,
    })
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore storage errors
    }
  },

  setInput: (input: string) => set({ input }),

  setPredictionContext: (predictionContext) => set({ predictionContext }),

  sendMessage: async (text: string, overrideContext?: PredictionResponse) => {
    const trimmed = text.trim()
    if (!trimmed || get().loading) return

    get().cleanupExpired()

    const now = new Date().toISOString()
    const context = overrideContext || get().predictionContext
    const userMsg: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: now,
    }

    let targetConvId = get().activeConversationId
    let conversations = [...get().conversations]
    let existingConv = targetConvId ? conversations.find((c) => c.id === targetConvId) : null

    if (!existingConv) {
      targetConvId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      existingConv = {
        id: targetConvId,
        title: generateTitle(trimmed),
        createdAt: now,
        updatedAt: now,
        messages: [userMsg],
        predictionContext: context
          ? {
              employee_number: context.employee_number,
              attrition_probability: context.attrition_probability,
              risk_level: context.risk_level,
              top_risk_factors: context.explanation?.top_risk_factors,
              top_protective_factors: context.explanation?.top_protective_factors,
            }
          : undefined,
      }
      conversations = [existingConv, ...conversations]
    } else {
      const updatedMessages = [...existingConv.messages, userMsg]
      existingConv = {
        ...existingConv,
        messages: updatedMessages,
        updatedAt: now,
        title: existingConv.messages.length === 0 ? generateTitle(trimmed) : existingConv.title,
      }
      conversations = [
        existingConv,
        ...conversations.filter((c) => c.id !== existingConv!.id),
      ]
    }

    set({
      conversations,
      activeConversationId: targetConvId,
      input: '',
      loading: true,
      predictionContext: context,
    })
    saveStoredConversations(conversations)

    try {
      const history = existingConv.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        content: m.content,
      }))

      const res = await aiService.chat({
        message: trimmed,
        employee_context: context
          ? {
              employee_number: context.employee_number,
            }
          : undefined,
        prediction_context: context
          ? {
              attrition_probability: context.attrition_probability,
              risk_level: context.risk_level,
              top_risk_factors: context.explanation?.top_risk_factors,
              top_protective_factors: context.explanation?.top_protective_factors,
            }
          : undefined,
        conversation_history: history,
      })

      const aiMsg: ChatMessage = {
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toISOString(),
      }

      const latestConversations = get().conversations.map((c) => {
        if (c.id === targetConvId) {
          return {
            ...c,
            messages: [...c.messages, aiMsg],
            updatedAt: new Date().toISOString(),
          }
        }
        return c
      })

      set({
        conversations: latestConversations,
        loading: false,
      })
      saveStoredConversations(latestConversations)
    } catch (e: unknown) {
      const serverDetail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const errMsg: ChatMessage = {
        role: 'assistant',
        content:
          serverDetail ||
          'Unable to communicate with AI Assistant. Ensure GEMINI_API_KEY is configured in the backend environment variables.',
        timestamp: new Date().toISOString(),
      }

      const latestConversations = get().conversations.map((c) => {
        if (c.id === targetConvId) {
          return {
            ...c,
            messages: [...c.messages, errMsg],
            updatedAt: new Date().toISOString(),
          }
        }
        return c
      })

      set({
        conversations: latestConversations,
        loading: false,
      })
      saveStoredConversations(latestConversations)
    }
  },
}))

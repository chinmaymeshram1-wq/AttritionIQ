import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAiStore } from '@/store/aiStore'
import type { PredictionResponse } from '@/types'
import LoadingSpinner from '@/components/LoadingSpinner'
import {
  Send, Bot, User, Sparkles, ShieldAlert, Plus,
  MessageSquare, Trash2, History, X, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatConversationTime } from '@/utils/formatters'

const SUGGESTED_PROMPTS = [
  'Why is this employee estimated as high attrition risk?',
  'What are the primary factors driving this risk prediction?',
  'Explain the top SHAP contributing features in simple HR terms.',
  'What constructive retention and engagement strategies are recommended?',
  'How does overtime and satisfaction interact in this employee profile?',
]

export default function AiAssistantPage() {
  const location = useLocation()
  const predictionFromNav = location.state?.prediction as PredictionResponse | undefined

  const {
    conversations,
    activeConversationId,
    input,
    loading,
    predictionContext,
    cleanupExpired,
    startNewConversation,
    selectConversation,
    deleteConversation,
    clearAllHistory,
    setInput,
    setPredictionContext,
    sendMessage,
  } = useAiStore()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Run 24h expiration cleanup on mount and when accessing
  useEffect(() => {
    cleanupExpired()
  }, [cleanupExpired])

  // If navigated with new prediction context from Individual Prediction or What-If
  useEffect(() => {
    if (predictionFromNav) {
      setPredictionContext(predictionFromNav)
    }
  }, [predictionFromNav, setPredictionContext])

  const activeConversation = conversations.find((c) => c.id === activeConversationId)
  const activeMessages = activeConversation ? activeConversation.messages : []
  const activeContext = activeConversation?.predictionContext || predictionFromNav || predictionContext

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages, loading])

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return
    await sendMessage(text, activeContext)
  }

  const handleNewConversation = () => {
    startNewConversation(activeContext)
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }

  const handleSelect = (id: string) => {
    selectConversation(id)
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }

  return (
    <div className="flex flex-col space-y-4" style={{ height: 'calc(100vh - 7.5rem)' }}>
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-[#111111]" />
            AI HR Assistant
          </h1>
          <p className="text-xs sm:text-sm text-[#666666] mt-0.5">
            Ask questions to interpret model predictions, explain SHAP risk factors, and explore retention strategies.
          </p>
        </div>

        {/* Mobile History Toggle */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="lg:hidden btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
        >
          <History className="w-4 h-4" />
          <span>History ({conversations.length})</span>
        </button>
      </div>

      {/* Main Container: Split Layout (History + Chat) */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden relative">
        {/* ── Conversation History Sidebar ────────────────────────────── */}
        <div
          className={cn(
            'flex flex-col bg-white border border-border rounded-xl p-3 w-72 flex-shrink-0 transition-all duration-200 z-20',
            'absolute inset-y-0 left-0 lg:relative lg:translate-x-0',
            sidebarOpen ? 'translate-x-0 shadow-lg' : '-translate-x-full lg:translate-x-0'
          )}
        >
          {/* Top Actions */}
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-border">
            <button
              onClick={handleNewConversation}
              className="flex-1 btn-primary text-xs py-2 px-3 flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New Conversation</span>
            </button>

            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-[#666666] hover:text-[#111111] hover:bg-[#F2F2F2]"
              aria-label="Close history panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Section Header */}
          <div className="flex items-center justify-between px-2 pt-3 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A8A]">
              Recent (24h)
            </span>
            <span className="text-[10px] text-[#8A8A8A] font-mono">
              {conversations.length} {conversations.length === 1 ? 'chat' : 'chats'}
            </span>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {conversations.length === 0 ? (
              <div className="text-center py-8 px-2 text-[#8A8A8A]">
                <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-medium">No recent conversations</p>
                <p className="text-[10px] mt-0.5 opacity-80">Conversations expire after 24 hours</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.id === activeConversationId
                return (
                  <div
                    key={conv.id}
                    className={cn(
                      'group flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer',
                      isActive
                        ? 'bg-[#F7F7F7] border border-[#E5E5E5] text-[#111111]'
                        : 'border border-transparent text-[#666666] hover:bg-[#F7F7F7] hover:text-[#111111]'
                    )}
                    onClick={() => handleSelect(conv.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs truncate leading-snug', isActive && 'font-semibold')}>
                        {conv.title || 'Untitled Conversation'}
                      </p>
                      <p className="text-[10px] text-[#8A8A8A] mt-0.5 leading-tight">
                        {formatConversationTime(conv.updatedAt || conv.createdAt)}
                      </p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteConversation(conv.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#8A8A8A] hover:text-red-600 rounded transition-opacity"
                      title="Delete conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {/* Clear History Button */}
          {conversations.length > 0 && (
            <div className="pt-2 border-t border-border mt-2">
              <button
                onClick={() => setShowClearConfirm(true)}
                className="w-full text-xs text-[#666666] hover:text-red-600 hover:bg-red-50 py-1.5 px-2 rounded-md transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            </div>
          )}
        </div>

        {/* ── Chat Messages View ───────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-white border border-border rounded-xl p-4 overflow-hidden justify-between">
          {/* Active Context Banner */}
          {activeContext && (
            <div className="bg-[#F7F7F7] border border-border rounded-lg px-3.5 py-2 flex items-center justify-between text-xs mb-3 flex-shrink-0">
              <div className="flex items-center gap-2 truncate">
                <span className="font-semibold text-[#111111]">
                  Active Context: Employee #{activeContext.employee_number}
                </span>
                <span className="text-[#666666]">
                  &bull; {(activeContext.attrition_probability * 100).toFixed(1)}% ({activeContext.risk_level} Risk)
                </span>
              </div>
              <span className="text-[11px] font-semibold text-[#111111] bg-white px-2 py-0.5 rounded border border-border flex-shrink-0">
                Context Injected
              </span>
            </div>
          )}

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
            {activeMessages.length === 0 && (
              <div className="text-center py-10">
                <div className="w-12 h-12 bg-[#F7F7F7] border border-border rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Bot className="w-6 h-6 text-[#111111]" />
                </div>
                <h3 className="text-base font-bold text-[#111111]">How can I assist your HR analytics today?</h3>
                <p className="text-xs text-[#666666] max-w-md mx-auto mt-1">
                  I can interpret prediction scores, explain SHAP feature contributions, and provide constructive talent engagement perspectives.
                </p>

                <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-xl mx-auto">
                  {SUGGESTED_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => handleSend(p)}
                      className="text-xs bg-[#F7F7F7] border border-border rounded-xl px-3 py-2 text-[#111111] hover:bg-white hover:border-[#111111] transition-all text-left"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeMessages.map((msg, i) => (
              <div key={i} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-semibold',
                    msg.role === 'user'
                      ? 'bg-[#111111] text-white'
                      : 'bg-[#F7F7F7] text-[#111111] border border-border'
                  )}
                >
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div
                  className={cn(
                    'max-w-2xl rounded-2xl px-4 py-3 text-xs sm:text-sm shadow-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-[#111111] text-white rounded-tr-none'
                      : 'bg-[#F7F7F7] text-[#111111] border border-border rounded-tl-none'
                  )}
                >
                  <p className="whitespace-pre-wrap font-sans">{msg.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#F7F7F7] border border-border flex items-center justify-center">
                  <Bot className="w-4 h-4 text-[#111111]" />
                </div>
                <div className="bg-[#F7F7F7] rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2 border border-border">
                  <LoadingSpinner size="sm" />
                  <span className="text-xs text-[#666666] font-medium">Analyzing prediction context...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Advisory Footer Note */}
          <div className="flex items-center gap-1.5 text-[11px] text-[#8A8A8A] mt-2 mb-2">
            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
            <span>AI outputs are for HR advisory & retention strategy guidance only.</span>
          </div>

          {/* Input Box */}
          <div className="flex gap-2.5 pt-1">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend(input))}
              className="input-field flex-1 text-xs sm:text-sm"
              placeholder="Ask a question about this employee's risk factors or HR retention strategies..."
              disabled={loading}
            />
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || loading}
              className="btn-primary px-4 sm:px-5 flex items-center gap-2 shadow-sm"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Clear History Confirmation Modal ──────────────────────────── */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 border border-border shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center border border-red-200">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#111111]">Clear all AI conversation history?</h3>
                <p className="text-xs text-[#666666] mt-0.5">This will remove all conversations from the past 24 hours.</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="btn-ghost text-xs py-1.5 px-3"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearAllHistory()
                  setShowClearConfirm(false)
                }}
                className="btn-primary bg-red-600 hover:bg-red-700 text-white text-xs py-1.5 px-3"
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

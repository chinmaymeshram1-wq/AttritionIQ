import { Menu, LogOut, User, Building2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useBatchStore } from '@/store/batchStore'
import { usePredictionStore } from '@/store/predictionStore'
import { useWhatIfStore } from '@/store/whatIfStore'
import { useEmployeeSearchStore } from '@/store/employeeSearchStore'
import { useAiStore } from '@/store/aiStore'
import { useNavigate } from 'react-router-dom'

interface TopbarProps {
  onMenuClick: () => void
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  const batchLoading = useBatchStore((s) => s.loading)
  const batchChecking = useBatchStore((s) => s.checking)
  const predictionSubmitting = usePredictionStore((s) => s.isSubmitting)
  const whatIfLoading = useWhatIfStore((s) => s.loading)
  const employeeAnalyzing = useEmployeeSearchStore((s) => s.analyzing)
  const employeeSearching = useEmployeeSearchStore((s) => s.searching)
  const aiLoading = useAiStore((s) => s.loading)

  let activeOperation: { label: string; route: string } | null = null
  if (batchLoading) {
    activeOperation = { label: 'Batch Processing...', route: '/batch' }
  } else if (batchChecking) {
    activeOperation = { label: 'Checking CSV Compatibility...', route: '/batch' }
  } else if (predictionSubmitting) {
    activeOperation = { label: 'Calculating Risk...', route: '/prediction' }
  } else if (whatIfLoading) {
    activeOperation = { label: 'Simulating Scenario...', route: '/what-if' }
  } else if (employeeAnalyzing) {
    activeOperation = { label: 'Analysing Dataset...', route: '/employees' }
  } else if (employeeSearching) {
    activeOperation = { label: 'Searching Employee...', route: '/employees' }
  } else if (aiLoading) {
    activeOperation = { label: 'AI Assistant generating...', route: '/ai-assistant' }
  }

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  return (
    <header className="flex-shrink-0 h-16 bg-white border-b border-border flex items-center justify-between px-5 sm:px-6 z-30">
      {/* Left controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-1.5 rounded-lg text-[#666666] hover:text-[#111111] hover:bg-[#F2F2F2] transition-colors lg:hidden"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {user?.organization_name && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#666666] font-medium px-2.5 py-1 rounded-md bg-[#F7F7F7] border border-border">
            <Building2 className="w-3.5 h-3.5 text-[#8A8A8A]" />
            <span className="text-[#111111] font-semibold">{user.organization_name}</span>
          </div>
        )}

        {activeOperation && (
          <button
            onClick={() => navigate(activeOperation.route)}
            className="flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-[#111111] text-white hover:bg-neutral-800 transition-all shadow-sm"
            title={`Active background operation: ${activeOperation.label}. Click to open.`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
            <span className="truncate max-w-[200px] sm:max-w-xs">{activeOperation.label}</span>
          </button>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* User profile identifier */}
        <div className="flex items-center gap-2 px-2 py-1 rounded-lg border border-transparent hover:border-border transition-colors">
          <div className="w-7 h-7 rounded-full bg-[#111111] text-white flex items-center justify-center text-xs font-semibold">
            {user?.full_name?.charAt(0) || <User className="w-3.5 h-3.5" />}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-[#111111] leading-tight">
              {user?.full_name || 'HR Specialist'}
            </p>
            <p className="text-[10px] text-[#8A8A8A] leading-tight">
              {user?.email || 'enterprise@attritioniq.ai'}
            </p>
          </div>
        </div>

        <div className="h-4 w-px bg-border mx-0.5" />

        {/* Logout action */}
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 p-2 rounded-lg text-[#666666] hover:text-[#111111] hover:bg-[#F2F2F2] transition-colors text-xs font-medium"
          title="Sign out of AttritionIQ"
          aria-label="Log out"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden md:inline">Sign out</span>
        </button>
      </div>
    </header>
  )
}

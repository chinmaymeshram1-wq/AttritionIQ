import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { analyticsService } from '@/services/analyticsService'
import StatCard from '@/components/StatCard'
import RiskBadge from '@/components/RiskBadge'
import LoadingSpinner from '@/components/LoadingSpinner'
import {
  Users, AlertTriangle, TrendingUp, Activity, UserSearch,
  Upload, MessageSquare, Sliders, BarChart3, ChevronRight,
  Database, Cpu, ShieldCheck, Sparkles, ArrowRight, Contact,
  RotateCcw, Check, X,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useBatchStore } from '@/store/batchStore'
import { usePredictionStore } from '@/store/predictionStore'
import { useWhatIfStore } from '@/store/whatIfStore'
import { useEmployeeSearchStore } from '@/store/employeeSearchStore'
import { useAiStore } from '@/store/aiStore'
import { formatProbability } from '@/utils/formatters'
import DatasetSelector from '@/components/DatasetSelector'
import { useDatasetStore } from '@/store/datasetStore'
import type { DashboardSummary } from '@/types'

const QUICK_ACTIONS = [
  {
    to: '/prediction',
    icon: UserSearch,
    label: 'Individual Prediction',
    desc: 'Estimate attrition risk for an individual employee profile',
  },
  {
    to: '/batch',
    icon: Upload,
    label: 'Batch Prediction',
    desc: 'Upload CSV dataset to score attrition risk across teams',
  },
  {
    to: '/employees',
    icon: Users,
    label: 'Employee Search',
    desc: 'Lookup employee profiles and historical prediction records',
  },
  {
    to: '/contact',
    icon: Contact,
    label: 'Contact Intelligence',
    desc: 'Access employee contact information & risk tier filtering',
  },
  {
    to: '/analytics',
    icon: BarChart3,
    label: 'Analytics & Insights',
    desc: 'Deep-dive risk breakdowns across departments and roles',
  },
  {
    to: '/what-if',
    icon: Sliders,
    label: 'What-If Simulation',
    desc: 'Simulate compensation, overtime, and satisfaction levers',
  },
  {
    to: '/ai-assistant',
    icon: MessageSquare,
    label: 'AI HR Assistant',
    desc: 'Ask questions to explain SHAP risk factors & retention plans',
  },
]

function getDynamicGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDashboardDateTime(date: Date): string {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
  const monthName = date.toLocaleDateString('en-US', { month: 'long' })
  const dayNum = date.getDate()
  const year = date.getFullYear()
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${dayName}, ${monthName} ${dayNum}, ${year} · ${timeStr}`
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const activeDatasetId = useDatasetStore((s) => s.activeDatasetId)
  const navigate = useNavigate()

  // Real-time local date & time ticker
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 10_000)
    return () => clearInterval(timer)
  }, [])

  // Primary KPI data query
  const { data, isLoading } = useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary', activeDatasetId],
    queryFn: () => analyticsService.getDashboardSummary(activeDatasetId),
  })

  // Phase 7D Demo Reset State
  const queryClient = useQueryClient()
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)

  const handleOpenResetModal = () => {
    setResetError(null)
    setResetModalOpen(true)
  }

  const handleConfirmReset = async () => {
    setResetting(true)
    setResetError(null)
    try {
      await analyticsService.resetDemoData()
      setResetting(false)
      setResetModalOpen(false)
      setResetSuccessMessage('Demo data reset successfully.')

      // Invalidate queries so dashboard and analytics naturally refresh from backend
      await queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      await queryClient.invalidateQueries({ queryKey: ['analytics-overview'] })
      await queryClient.invalidateQueries({ queryKey: ['analytics-dept'] })
      await queryClient.invalidateQueries({ queryKey: ['analytics-role'] })
      await queryClient.invalidateQueries({ queryKey: ['employees'] })

      setTimeout(() => {
        setResetSuccessMessage(null)
      }, 5000)
    } catch (err: unknown) {
      setResetting(false)
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setResetError(msg || 'Unable to reset demo data. No changes were made.')
    }
  }

  // Phase 3 Active Background Operations subscriptions
  const batchLoading = useBatchStore((s) => s.loading)
  const batchChecking = useBatchStore((s) => s.checking)
  const predictionSubmitting = usePredictionStore((s) => s.isSubmitting)
  const whatIfLoading = useWhatIfStore((s) => s.loading)
  const employeeSearching = useEmployeeSearchStore((s) => s.searching)
  const aiLoading = useAiStore((s) => s.loading)

  const activeOperations: { name: string; status: string; route: string }[] = []
  if (batchLoading) activeOperations.push({ name: 'Batch Prediction', status: 'Processing batch rows...', route: '/batch' })
  if (batchChecking) activeOperations.push({ name: 'Batch Compatibility Check', status: 'Analysing CSV columns...', route: '/batch' })
  if (predictionSubmitting) activeOperations.push({ name: 'Individual Prediction', status: 'Estimating risk...', route: '/prediction' })
  if (whatIfLoading) activeOperations.push({ name: 'What-If Simulation', status: 'Executing simulation...', route: '/what-if' })
  if (employeeSearching) activeOperations.push({ name: 'Employee Profile Search', status: 'Searching records...', route: '/employees' })
  if (aiLoading) activeOperations.push({ name: 'AI HR Assistant', status: 'Generating response...', route: '/ai-assistant' })

  // Escape key handler for modal accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && resetModalOpen && !resetting) {
        setResetModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [resetModalOpen, resetting])

  // Calculate Risk Distribution Percentages
  const highCount = data?.high_risk_count ?? 0
  const medCount = data?.medium_risk_count ?? 0
  const lowCount = data?.low_risk_count ?? 0
  const totalScored = highCount + medCount + lowCount
  const highPct = totalScored > 0 ? (highCount / totalScored) * 100 : 0
  const medPct = totalScored > 0 ? (medCount / totalScored) * 100 : 0
  const lowPct = totalScored > 0 ? (lowCount / totalScored) * 100 : 0

  const greeting = getDynamicGreeting()
  const userName = user?.full_name?.split(' ')[0] || 'User'

  return (
    <div className="space-y-8">
      {/* ── 1. Enterprise Command-Center Header ────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">
            {greeting}, {userName}
          </h1>
          <p className="text-xs sm:text-sm text-[#666666] mt-1">
            Employee attrition intelligence overview
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <DatasetSelector />
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F7F7F7] border border-border text-xs text-[#666666] font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="font-mono text-[#111111]">{formatDashboardDateTime(currentDate)}</span>
          </div>
        </div>
      </div>

      {/* ── 2. Primary KPI Area ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Employees Analyzed"
          value={data?.total_employees_analyzed ?? 0}
          subtitle="Distinct profiles"
          icon={Users}
          loading={isLoading}
        />
        <StatCard
          title="High Risk"
          value={data?.high_risk_count ?? 0}
          subtitle="Elevated likelihood"
          icon={AlertTriangle}
          iconColor="text-red-600"
          iconBg="bg-red-50"
          loading={isLoading}
        />
        <StatCard
          title="Medium Risk"
          value={data?.medium_risk_count ?? 0}
          subtitle="Moderate watch list"
          icon={Activity}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          loading={isLoading}
        />
        <StatCard
          title="Low Risk"
          value={data?.low_risk_count ?? 0}
          subtitle="Stable retention"
          icon={TrendingUp}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          loading={isLoading}
        />
        <StatCard
          title="Avg. Probability"
          value={data ? formatProbability(data.average_attrition_probability) : '—'}
          subtitle="Estimated mean risk"
          icon={Activity}
          loading={isLoading}
        />
        <StatCard
          title="Total Predictions"
          value={data?.total_predictions ?? 0}
          subtitle="Cumulative runs"
          icon={Cpu}
          loading={isLoading}
        />
      </div>

      {/* ── 3. Active Background Operations (Conditional) ─────────────── */}
      {activeOperations.length > 0 && (
        <div className="card border-l-4 border-[#111111] p-4 bg-[#FAFAFA] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                Active Operations ({activeOperations.length})
              </h3>
            </div>
            <span className="text-[11px] text-[#8A8A8A]">Running in background</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {activeOperations.map((op, idx) => (
              <button
                key={idx}
                onClick={() => navigate(op.route)}
                className="flex items-center justify-between p-3 rounded-lg bg-white border border-border hover:border-[#111111] transition-colors text-left group"
              >
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-bold text-[#111111] truncate">{op.name}</p>
                  <p className="text-[11px] text-[#666666] mt-0.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>{op.status}</span>
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-[#8A8A8A] group-hover:text-[#111111] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. Risk Overview & System Status ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Risk Distribution Overview (7 cols) */}
        <div className="card p-6 lg:col-span-7 flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#111111]">Risk Distribution Overview</h3>
                <p className="text-xs text-[#8A8A8A] mt-0.5">Aggregate breakdown of scored profiles</p>
              </div>
              <Link
                to="/analytics"
                className="text-xs font-semibold text-[#111111] hover:underline flex items-center gap-1"
              >
                <span>Full Analytics</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Segmented Distribution Bar */}
            <div className="mt-5 space-y-2">
              <div className="h-3 w-full rounded-full bg-[#F2F2F2] flex overflow-hidden">
                <div
                  style={{ width: `${highPct}%` }}
                  className="bg-red-500 transition-all duration-500"
                  title={`High Risk: ${highPct.toFixed(1)}%`}
                />
                <div
                  style={{ width: `${medPct}%` }}
                  className="bg-amber-500 transition-all duration-500"
                  title={`Medium Risk: ${medPct.toFixed(1)}%`}
                />
                <div
                  style={{ width: `${lowPct}%` }}
                  className="bg-emerald-500 transition-all duration-500"
                  title={`Low Risk: ${lowPct.toFixed(1)}%`}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#8A8A8A] pt-1">
                <span>{totalScored} total profiles scored</span>
                <span>{data ? formatProbability(data.average_attrition_probability) : '0%'} avg. probability</span>
              </div>
            </div>

            {/* Segmented Details Table */}
            <div className="mt-5 space-y-2.5">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAFAFA] border border-border text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="font-semibold text-[#111111]">High Risk Tier</span>
                  <RiskBadge level="HIGH" size="sm" />
                </div>
                <div className="flex items-center gap-3 font-mono">
                  <span className="font-bold text-[#111111]">{highCount} profiles</span>
                  <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 text-[11px] font-semibold">
                    {highPct.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAFAFA] border border-border text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="font-semibold text-[#111111]">Medium Risk Tier</span>
                  <RiskBadge level="MEDIUM" size="sm" />
                </div>
                <div className="flex items-center gap-3 font-mono">
                  <span className="font-bold text-[#111111]">{medCount} profiles</span>
                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px] font-semibold">
                    {medPct.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAFAFA] border border-border text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-[#111111]">Low Risk Tier</span>
                  <RiskBadge level="LOW" size="sm" />
                </div>
                <div className="flex items-center gap-3 font-mono">
                  <span className="font-bold text-[#111111]">{lowCount} profiles</span>
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px] font-semibold">
                    {lowPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* System Architecture & Status (5 cols) */}
        <div className="card p-6 lg:col-span-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="border-b border-border pb-3 mb-4">
              <h3 className="text-sm font-bold text-[#111111]">System Architecture & Status</h3>
              <p className="text-xs text-[#8A8A8A] mt-0.5">Platform runtime components</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAFAFA] border border-border">
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-4 h-4 text-[#111111]" />
                  <div>
                    <p className="text-xs font-semibold text-[#111111]">Supervised ML Pipeline</p>
                    <p className="text-[10px] text-[#8A8A8A]">Logistic Regression v1.0</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Operational
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAFAFA] border border-border">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#111111]" />
                  <div>
                    <p className="text-xs font-semibold text-[#111111]">Explainability Engine</p>
                    <p className="text-[10px] text-[#8A8A8A]">SHAP LinearExplainer</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Operational
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAFAFA] border border-border">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#111111]" />
                  <div>
                    <p className="text-xs font-semibold text-[#111111]">AI HR Assistant</p>
                    <p className="text-[10px] text-[#8A8A8A]">Gemini 1.5 Flash</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Operational
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAFAFA] border border-border">
                <div className="flex items-center gap-2.5">
                  <Database className="w-4 h-4 text-[#111111]" />
                  <div>
                    <p className="text-xs font-semibold text-[#111111]">Application Database</p>
                    <p className="text-[10px] text-[#8A8A8A]">Relational Store & Sessions</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Connected
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. Quick Actions ─────────────────────────────────────────── */}
      <div>
        <div className="border-b border-border pb-3 mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#666666]">
            Quick Actions & Capabilities
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {QUICK_ACTIONS.map(({ to, icon: Icon, label, desc }) => (
            <Link
              key={to}
              to={to}
              className="card hover:border-[#111111] group flex items-start justify-between p-4 transition-all duration-150"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 bg-[#F7F7F7] border border-border rounded-lg flex items-center justify-center flex-shrink-0 text-[#111111] group-hover:bg-[#111111] group-hover:text-white transition-colors duration-150 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#111111] text-xs leading-snug group-hover:text-black">
                    {label}
                  </h3>
                  <p className="text-[11px] text-[#666666] mt-0.5 leading-relaxed">
                    {desc}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#8A8A8A] group-hover:text-[#111111] group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
            </Link>
          ))}
        </div>
      </div>

      {/* ── 6. System Controls (Reset Demo Data) ───────────────────────── */}
      <div className="card p-6 border border-[#E5E5E5] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#8A8A8A] uppercase tracking-wider">
                System Controls
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#F7F7F7] text-[#666666] border border-border">
                Demo environment
              </span>
            </div>
            <h3 className="text-sm font-bold text-[#111111] mt-1">
              Reset Demo Data
            </h3>
            <p className="text-xs text-[#666666] mt-0.5 max-w-xl">
              Remove prediction and employee demo records from the database while keeping your account, authentication, ML models, and configuration intact.
            </p>
          </div>

          <button
            onClick={handleOpenResetModal}
            className="btn-secondary text-xs px-4 py-2 flex items-center gap-2 flex-shrink-0 self-start sm:self-auto hover:bg-[#F7F7F7]"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#666666]" />
            <span>Reset Demo Data</span>
          </button>
        </div>

        {/* Success notification banner if present */}
        {resetSuccessMessage && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{resetSuccessMessage}</span>
            </div>
            <button
              onClick={() => setResetSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-900"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── Confirmation Modal ────────────────────────────────────────── */}
      {resetModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0 text-amber-700">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-[#111111]">
                  Reset Demo Data?
                </h3>
                <p className="text-xs text-[#666666] mt-1.5 leading-relaxed">
                  This will remove prediction results and the analytics data generated from those predictions. Your users, employee data, ML model, authentication and application configuration will not be affected.
                </p>
              </div>
            </div>

            <div className="bg-[#F7F7F7] p-3 rounded-lg border border-[#E5E5E5] text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[#666666] font-medium">Predictions to be removed:</span>
                <span className="font-bold font-mono text-[#111111]">
                  {data?.total_predictions ?? 0}
                </span>
              </div>
            </div>

            {resetError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {resetError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E5E5E5]">
              <button
                onClick={() => setResetModalOpen(false)}
                disabled={resetting}
                className="btn-secondary text-xs px-4 py-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                disabled={resetting}
                className="bg-[#111111] text-white hover:bg-[#262626] text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {resetting ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>Resetting demo data...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Demo Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

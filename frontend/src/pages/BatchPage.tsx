import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDatasetStore } from '@/store/datasetStore'
import { analyticsService } from '@/services/analyticsService'
import { employeeService } from '@/services/employeeService'
import type { EmployeeListItem } from '@/types'
import DatasetSelector from '@/components/DatasetSelector'
import RiskBadge from '@/components/RiskBadge'
import LoadingSpinner from '@/components/LoadingSpinner'
import { formatProbability } from '@/utils/formatters'
import {
  Database, BarChart2, Users, AlertTriangle, TrendingUp,
  ShieldCheck, ShieldAlert, Shield,
} from 'lucide-react'

// ── Dataset Overview Cards ─────────────────────────────────────────────────────

function OverviewCards({ summary }: { summary: Record<string, number> | null }) {
  if (!summary) return null

  const {
    total_employees_analyzed = 0,
    high_risk_count = 0,
    medium_risk_count = 0,
    low_risk_count = 0,
    average_attrition_probability = 0,
  } = summary

  const cards = [
    {
      label: 'Total Employees',
      value: total_employees_analyzed.toLocaleString(),
      icon: Users,
      color: 'text-[#111111]',
      bg: 'bg-[#F7F7F7]',
    },
    {
      label: 'High Risk',
      value: high_risk_count.toLocaleString(),
      icon: ShieldAlert,
      color: 'text-red-700',
      bg: 'bg-red-50',
      border: 'border-red-200',
    },
    {
      label: 'Medium Risk',
      value: medium_risk_count.toLocaleString(),
      icon: Shield,
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    },
    {
      label: 'Low Risk',
      value: low_risk_count.toLocaleString(),
      icon: ShieldCheck,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
    },
    {
      label: 'Avg Attrition Risk',
      value: `${(average_attrition_probability * 100).toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-[#111111]',
      bg: 'bg-[#F7F7F7]',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map(({ label, value, icon: Icon, color, bg, border }) => (
        <div
          key={label}
          className={`card p-4 text-center ${bg} ${border ? `border ${border}` : ''}`}
        >
          <Icon className={`w-5 h-5 mx-auto mb-2 ${color}`} />
          <p className="text-xs text-[#666666] font-medium">{label}</p>
          <p className={`text-2xl font-black mt-1 tracking-tight ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  )
}

// ── Risk Distribution Bar ─────────────────────────────────────────────────────

function RiskDistributionBar({ summary }: { summary: Record<string, number> | null }) {
  if (!summary) return null

  const total = summary.total_employees_analyzed || 0
  if (total === 0) return null

  const high = summary.high_risk_count || 0
  const medium = summary.medium_risk_count || 0
  const low = summary.low_risk_count || 0

  const highPct = total > 0 ? (high / total) * 100 : 0
  const medPct = total > 0 ? (medium / total) * 100 : 0
  const lowPct = total > 0 ? (low / total) * 100 : 0

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <BarChart2 className="w-4 h-4 text-[#111111]" />
        <h3 className="text-xs font-bold text-[#666666] uppercase tracking-wider">Risk Distribution</h3>
      </div>
      <div className="h-4 rounded-full overflow-hidden flex bg-[#F7F7F7] border border-border">
        {highPct > 0 && (
          <div
            className="h-full bg-[#B42318] transition-all"
            style={{ width: `${highPct}%` }}
            title={`High: ${high} (${highPct.toFixed(1)}%)`}
          />
        )}
        {medPct > 0 && (
          <div
            className="h-full bg-[#B54708] transition-all"
            style={{ width: `${medPct}%` }}
            title={`Medium: ${medium} (${medPct.toFixed(1)}%)`}
          />
        )}
        {lowPct > 0 && (
          <div
            className="h-full bg-[#067647] transition-all"
            style={{ width: `${lowPct}%` }}
            title={`Low: ${low} (${lowPct.toFixed(1)}%)`}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#B42318] inline-block" />
          <span className="text-[#666666]">High Risk</span>
          <span className="font-bold text-[#111111]">{highPct.toFixed(1)}%</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#B54708] inline-block" />
          <span className="text-[#666666]">Medium Risk</span>
          <span className="font-bold text-[#111111]">{medPct.toFixed(1)}%</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#067647] inline-block" />
          <span className="text-[#666666]">Low Risk</span>
          <span className="font-bold text-[#111111]">{lowPct.toFixed(1)}%</span>
        </span>
      </div>
    </div>
  )
}

// ── Employee Risk Table ───────────────────────────────────────────────────────

function EmployeeRiskTable({ employees }: { employees: EmployeeListItem[] }) {
  const [filter, setFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL')
  const PAGE_SIZE = 50
  const [page, setPage] = useState(1)

  const filtered = filter === 'ALL'
    ? employees
    : employees.filter(e => e.risk_level === filter)

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const filterBtns: Array<{ key: typeof filter; label: string; dot?: string }> = [
    { key: 'ALL', label: 'All' },
    { key: 'HIGH', label: 'High', dot: 'bg-[#B42318]' },
    { key: 'MEDIUM', label: 'Medium', dot: 'bg-[#B54708]' },
    { key: 'LOW', label: 'Low', dot: 'bg-[#067647]' },
  ]

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#111111]">Employee Risk Records</h3>
          <p className="text-xs text-[#8A8A8A] mt-0.5">
            {employees.length.toLocaleString()} employees with predictions in this dataset
          </p>
        </div>
        {/* Filter pills */}
        <div className="inline-flex p-1 bg-[#F7F7F7] rounded-lg border border-border gap-1">
          {filterBtns.map(({ key, label, dot }) => (
            <button
              key={key}
              onClick={() => { setFilter(key); setPage(1) }}
              className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors ${
                filter === key
                  ? 'bg-[#111111] text-white shadow-sm'
                  : 'text-[#666666] hover:text-[#111111] hover:bg-[#EAEAEA]'
              }`}
            >
              {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {paginated.length === 0 ? (
        <div className="py-10 text-center text-xs text-[#8A8A8A]">
          No employees match this filter.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-[#F7F7F7] text-left">
                  <th className="py-2.5 px-3 font-semibold text-[#666666] uppercase tracking-wider">Employee #</th>
                  <th className="py-2.5 px-3 font-semibold text-[#666666] uppercase tracking-wider">Risk Level</th>
                  <th className="py-2.5 px-3 font-semibold text-[#666666] uppercase tracking-wider">Probability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginated.map((e) => (
                  <tr key={e.id} className="hover:bg-[#FAFAFA]">
                    <td className="py-2.5 px-3 font-mono font-semibold text-[#111111]">
                      #{e.employee_number}
                    </td>
                    <td className="py-2.5 px-3">
                      {e.risk_level ? (
                        <RiskBadge level={e.risk_level} size="sm" />
                      ) : (
                        <span className="text-[11px] text-[#8A8A8A] italic">No prediction</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-medium text-[#111111]">
                      {e.attrition_probability != null
                        ? formatProbability(e.attrition_probability)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between text-xs text-[#666666] pt-2 border-t border-border">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary text-xs px-2.5 py-1 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="font-medium text-[#111111]">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-secondary text-xs px-2.5 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Main BatchPage ─────────────────────────────────────────────────────────────

export default function BatchPage() {
  const navigate = useNavigate()
  const { activeDatasetId, datasets } = useDatasetStore()

  const [summary, setSummary] = useState<Record<string, number> | null>(null)
  const [employees, setEmployees] = useState<EmployeeListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const readyDatasets = datasets.filter(d => d.status === 'READY')
  const activeDataset = readyDatasets.find(d => d.id === activeDatasetId)

  useEffect(() => {
    if (!activeDatasetId) {
      setSummary(null)
      setEmployees([])
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      analyticsService.getDashboardSummary(activeDatasetId),
      employeeService.listEmployeesWithRisk(activeDatasetId, 1, 1000),
    ])
      .then(([summaryData, empData]) => {
        if (cancelled) return
        setSummary(summaryData)
        setEmployees(empData.employees || [])
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        const msg = err?.response?.data?.detail || 'Failed to load analytics data.'
        setError(msg)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [activeDatasetId])

  const hasNoDatasets = readyDatasets.length === 0

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">
            Risk / Prediction Analytics
          </h1>
          <p className="text-xs sm:text-sm text-[#666666] mt-1">
            Analyze attrition risk across the selected employee dataset.
          </p>
        </div>

        <DatasetSelector />
      </div>

      {/* No datasets empty state */}
      {hasNoDatasets && (
        <div className="card p-10 sm:p-12 text-center max-w-xl mx-auto space-y-4 border border-[#E5E5E5] mt-4">
          <div className="w-12 h-12 rounded-xl bg-[#F7F7F7] border border-border flex items-center justify-center mx-auto">
            <Database className="w-6 h-6 text-[#8A8A8A]" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#8A8A8A] uppercase tracking-wider block">
              No Datasets Available
            </span>
            <h2 className="text-base font-bold text-[#111111] mt-2">
              Upload an HR CSV to generate risk predictions.
            </h2>
            <p className="text-xs text-[#666666] mt-1.5 leading-relaxed">
              Upload your employee dataset in Dataset Manager. Predictions and SHAP explanations are generated automatically on upload.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => navigate('/datasets')}
              className="btn-primary text-xs px-5 py-2.5 inline-flex items-center gap-2"
            >
              <Database className="w-3.5 h-3.5" />
              Open Dataset Manager
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {!hasNoDatasets && loading && (
        <div className="card flex items-center gap-3 py-10 justify-center text-xs text-[#666666]">
          <LoadingSpinner size="sm" />
          <span>Loading risk analytics…</span>
        </div>
      )}

      {/* Error */}
      {!hasNoDatasets && error && (
        <div className="card border-l-4 border-red-500 bg-red-50/40 flex items-start gap-3 p-4">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* No predictions yet */}
      {!hasNoDatasets && !loading && !error && activeDatasetId && (summary?.total_employees_analyzed ?? 0) === 0 && (
        <div className="card p-10 text-center border border-dashed border-[#E5E5E5] bg-[#FAFAFA] space-y-3">
          <ShieldCheck className="w-8 h-8 text-[#CCCCCC] mx-auto" />
          <p className="text-sm font-semibold text-[#666666]">No predictions yet for this dataset</p>
          <p className="text-xs text-[#999999]">
            {activeDataset
              ? `Dataset "${activeDataset.name}" has ${activeDataset.employee_count} employees. Predictions are generated automatically when a dataset is uploaded.`
              : 'Select a dataset to view its risk analytics.'}
          </p>
        </div>
      )}

      {/* Analytics content */}
      {!hasNoDatasets && !loading && !error && summary && (summary.total_employees_analyzed ?? 0) > 0 && (
        <>
          <OverviewCards summary={summary} />
          <RiskDistributionBar summary={summary} />
          {employees.length > 0 && (
            <EmployeeRiskTable
              employees={employees.filter(e => e.risk_level !== null)}
            />
          )}
        </>
      )}
    </div>
  )
}

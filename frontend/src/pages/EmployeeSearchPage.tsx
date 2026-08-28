import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEmployeeSearchStore } from '@/store/employeeSearchStore'
import { useDatasetStore } from '@/store/datasetStore'
import type { EmployeeDbResult } from '@/types'
import RiskBadge from '@/components/RiskBadge'
import LoadingSpinner from '@/components/LoadingSpinner'
import DatasetSelector from '@/components/DatasetSelector'
import { formatProbability } from '@/utils/formatters'
import {
  Search, User, ShieldCheck, AlertCircle,
  AlertTriangle, XCircle, Database,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDisplayLabel(key: string): string {
  const spacedPascal = key.replace(/([a-z])([A-Z])/g, '$1 $2')
  return spacedPascal.replace(/[_-]/g, ' ')
}

function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  const s = String(val).trim()
  if (s === '' || s.toLowerCase() === 'nan' || s.toLowerCase() === 'null') return '—'
  return s
}

// ── Employee Profile Card ─────────────────────────────────────────────────────

function EmployeeProfileCard({
  result,
  searchId,
}: {
  result: EmployeeDbResult
  searchId: string
}) {
  const { employee, latest_prediction, explanation } = result
  const snapshot = employee.feature_snapshot || {}
  const entries = Object.entries(snapshot)

  return (
    <div className="space-y-6">
      {/* Profile header */}
      <div className="card flex items-start gap-4 flex-wrap justify-between border-l-4 border-[#111111]">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-[#F7F7F7] rounded-xl flex items-center justify-center flex-shrink-0 border border-border">
            <User className="w-6 h-6 text-[#111111]" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[#111111]">
              Employee&nbsp;
              <span className="font-mono">#{employee.employee_number}</span>
            </h2>
            <p className="text-xs text-[#8A8A8A] mt-0.5">
              Dataset record · ID{' '}
              <span className="font-mono text-[#666666]">{employee.id.slice(0, 8)}…</span>
            </p>
          </div>
        </div>

        {latest_prediction ? (
          <div className="text-right">
            <span className="text-xs text-[#8A8A8A] block font-medium">Attrition Risk</span>
            <div className="flex items-center gap-2 justify-end mt-1">
              <span className="text-2xl sm:text-3xl font-black text-[#111111] tracking-tight">
                {formatProbability(latest_prediction.attrition_probability)}
              </span>
              <RiskBadge level={latest_prediction.risk_level as 'LOW' | 'MEDIUM' | 'HIGH'} size="md" />
            </div>
          </div>
        ) : (
          <div className="text-xs text-[#8A8A8A] italic self-center">No prediction on record</div>
        )}
      </div>

      {/* Feature snapshot */}
      {entries.length > 0 && (
        <div className="card">
          <h3 className="text-xs font-bold text-[#666666] uppercase tracking-wider mb-4 border-b border-border pb-2">
            Employee Profile
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {entries.map(([key, val]) => (
              <div key={key} className="bg-[#F7F7F7] p-2.5 rounded-lg border border-border">
                <p className="text-[11px] text-[#8A8A8A] leading-snug capitalize">
                  {toDisplayLabel(key)}
                </p>
                <p className="text-xs font-semibold text-[#111111] mt-0.5 truncate">
                  {formatCellValue(val)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prediction details */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4 border-b border-border pb-2">
          <ShieldCheck className="w-4 h-4 text-[#111111]" />
          <h3 className="text-xs font-bold text-[#666666] uppercase tracking-wider">
            Risk Assessment
          </h3>
        </div>

        {latest_prediction ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#F7F7F7] p-3 rounded-lg border border-border">
                <p className="text-[11px] text-[#8A8A8A] font-medium">Attrition Probability</p>
                <p className="text-sm font-bold text-[#111111] mt-0.5">
                  {formatProbability(latest_prediction.attrition_probability)}
                </p>
              </div>
              <div className="bg-[#F7F7F7] p-3 rounded-lg border border-border">
                <p className="text-[11px] text-[#8A8A8A] font-medium">Risk Level</p>
                <p className="text-sm font-bold text-[#111111] mt-0.5">{latest_prediction.risk_level}</p>
              </div>
              <div className="bg-[#F7F7F7] p-3 rounded-lg border border-border">
                <p className="text-[11px] text-[#8A8A8A] font-medium">Model Pipeline</p>
                <p className="text-sm font-bold text-[#111111] mt-0.5">{latest_prediction.model_version}</p>
              </div>
              <div className="bg-[#F7F7F7] p-3 rounded-lg border border-border">
                <p className="text-[11px] text-[#8A8A8A] font-medium">Prediction ID</p>
                <p className="text-[11px] font-mono text-[#666666] mt-0.5 break-all">{latest_prediction.id}</p>
              </div>
            </div>
            <div className="bg-[#F7F7F7] p-2.5 rounded-lg border border-border inline-block">
              <p className="text-[11px] text-[#8A8A8A] font-medium">
                Recorded At:{' '}
                <span className="font-semibold text-[#111111]">
                  {new Date(latest_prediction.created_at).toLocaleString()}
                </span>
              </p>
            </div>

            {/* SHAP factors */}
            {explanation && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-border">
                <div className="bg-red-50/60 rounded-lg p-3.5 border border-red-200">
                  <p className="text-xs font-bold text-red-800 uppercase mb-2">Key Risk Elevators</p>
                  <ul className="space-y-1 text-xs">
                    {explanation.top_risk_factors.map((f, i) => (
                      <li key={i} className="flex justify-between py-1 border-b border-red-100 last:border-0">
                        <span className="text-[#111111]">{f.display_name}</span>
                        <span className="text-red-700 font-mono text-xs font-bold">
                          +{f.shap_value.toFixed(3)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-emerald-50/60 rounded-lg p-3.5 border border-emerald-200">
                  <p className="text-xs font-bold text-emerald-800 uppercase mb-2">Key Risk Reducers</p>
                  <ul className="space-y-1 text-xs">
                    {explanation.top_protective_factors.map((f, i) => (
                      <li key={i} className="flex justify-between py-1 border-b border-emerald-100 last:border-0">
                        <span className="text-[#111111]">{f.display_name}</span>
                        <span className="text-emerald-700 font-mono text-xs font-bold">
                          {f.shap_value.toFixed(3)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 py-3 text-[#8A8A8A]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p className="text-xs italic">
              No prediction available for this employee. Upload a dataset in Dataset Manager to generate predictions.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function EmployeeSearchPage() {
  const navigate = useNavigate()
  const { activeDatasetId, datasets } = useDatasetStore()
  const {
    query,
    searching,
    searchResult,
    searchError,
    notFound,
    searchByDataset,
    setQuery,
    clear,
  } = useEmployeeSearchStore()

  const profileRef = useRef<HTMLDivElement>(null)
  const notFoundRef = useRef<HTMLDivElement>(null)

  // Auto-scroll when result/not-found state updates
  useEffect(() => {
    if (searchResult) {
      profileRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [searchResult])

  useEffect(() => {
    if (notFound) {
      notFoundRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [notFound])

  // Clear search result when dataset changes
  useEffect(() => {
    clear()
  }, [activeDatasetId, clear])

  const handleSearch = async () => {
    await searchByDataset(query, activeDatasetId)
  }

  const readyDatasets = datasets.filter(d => d.status === 'READY')
  const hasNoDatasets = readyDatasets.length === 0

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">
            Employee Profile Search
          </h1>
          <p className="text-xs sm:text-sm text-[#666666] mt-1">
            Search employees within the selected dataset. Read-only — no records are created.
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
              Upload an HR dataset to begin searching employees.
            </h2>
            <p className="text-xs text-[#666666] mt-1.5 leading-relaxed">
              All employee records are managed through the Dataset Manager. Upload a CSV to get started.
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

      {/* Search card */}
      {!hasNoDatasets && (
        <div className="card space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[#111111] uppercase tracking-wider mb-1.5">
              Search Employee
            </label>
            <p className="text-xs text-[#8A8A8A] mb-3">
              Enter an Employee ID to retrieve their profile and risk assessment from the selected dataset.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="input-field pl-10"
                placeholder="Enter Employee ID (e.g. 1, 42, 1001)"
                disabled={searching}
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching || !query.trim() || !activeDatasetId}
              className="btn-primary px-6 flex items-center gap-2 text-xs"
            >
              {searching ? <LoadingSpinner size="sm" /> : <Search className="w-3.5 h-3.5" />}
              Search
            </button>
          </div>

          {/* Errors */}
          {searchError && (
            <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              <XCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
              {searchError}
            </div>
          )}

          {!activeDatasetId && !hasNoDatasets && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
              Select a dataset above before searching.
            </div>
          )}
        </div>
      )}

      {/* Empty state before search */}
      {!hasNoDatasets && !searching && !searchResult && !notFound && !searchError && (
        <div className="card p-10 text-center border border-dashed border-[#E5E5E5] bg-[#FAFAFA]">
          <User className="w-8 h-8 text-[#CCCCCC] mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#666666]">Enter an Employee ID to view their profile</p>
          <p className="text-xs text-[#999999] mt-1">
            Results are scoped to the selected dataset. Switching datasets will clear the search.
          </p>
        </div>
      )}

      {/* Not found */}
      {notFound && (
        <div ref={notFoundRef} className="card border-l-4 border-amber-500 bg-amber-50/40 flex items-start gap-3 scroll-mt-6 p-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">Employee Not Found</p>
            <p className="text-xs text-amber-800 mt-1">
              Employee ID{' '}
              <span className="font-mono font-semibold">"{query}"</span>{' '}
              was not found in the selected dataset. Check that the correct dataset is active or try a different ID.
            </p>
          </div>
        </div>
      )}

      {/* Employee profile */}
      {searchResult && (
        <div ref={profileRef} className="scroll-mt-6">
          <EmployeeProfileCard result={searchResult} searchId={query} />
        </div>
      )}
    </div>
  )
}

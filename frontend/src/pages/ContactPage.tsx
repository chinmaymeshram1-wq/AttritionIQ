import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDatasetStore } from '@/store/datasetStore'
import { employeeService } from '@/services/employeeService'
import type { EmployeeListItem } from '@/types'
import RiskBadge from '@/components/RiskBadge'
import LoadingSpinner from '@/components/LoadingSpinner'
import DatasetSelector from '@/components/DatasetSelector'
import {
  Users, Search, Copy, Check, Database,
  AlertCircle, ChevronLeft, ChevronRight,
} from 'lucide-react'

// ── Field Helpers ─────────────────────────────────────────────────────────────

function toDisplayLabel(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ')
}

function formatVal(val: unknown): string {
  if (val === null || val === undefined) return '—'
  const s = String(val).trim()
  return s === '' || s.toLowerCase() === 'nan' || s.toLowerCase() === 'null' ? '—' : s
}

type RiskFilter = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'
const PAGE_SIZE = 25

// ── Main ContactPage ──────────────────────────────────────────────────────────

export default function ContactPage() {
  const navigate = useNavigate()
  const { activeDatasetId, datasets } = useDatasetStore()

  const [employees, setEmployees] = useState<EmployeeListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('ALL')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const readyDatasets = datasets.filter((d) => d.status === 'READY')
  const activeDataset = readyDatasets.find((d) => d.id === activeDatasetId)
  const hasNoDatasets = readyDatasets.length === 0

  // ── Fetch employees when dataset changes ─────────────────────────────────────
  useEffect(() => {
    if (!activeDatasetId) {
      setEmployees([])
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setSearchQuery('')
    setRiskFilter('ALL')
    setCurrentPage(1)

    employeeService
      .listEmployeesWithRisk(activeDatasetId, 1, 1500)
      .then((data) => {
        if (cancelled) return
        setEmployees(data.employees || [])
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        const msg = err?.response?.data?.detail || 'Failed to load employees.'
        setError(msg)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeDatasetId])

  // Reset page when filter/search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, riskFilter])

  // ── Copy handler ──────────────────────────────────────────────────────────────
  const handleCopy = useCallback((text: string, key: string) => {
    if (!text || text === '—') return
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }, [])

  // ── Filter rows ───────────────────────────────────────────────────────────────
  const filteredEmployees = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return employees.filter((e) => {
      if (riskFilter !== 'ALL' && e.risk_level !== riskFilter) return false
      if (q) {
        const numStr = String(e.employee_number)
        if (!numStr.includes(q)) return false
      }
      return true
    })
  }, [employees, riskFilter, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE))
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredEmployees.slice(start, start + PAGE_SIZE)
  }, [filteredEmployees, currentPage])

  // ── Risk counts ───────────────────────────────────────────────────────────────
  const { highCount, medCount, lowCount, hasPredictions } = useMemo(() => {
    let h = 0, m = 0, l = 0, hasPred = false
    for (const e of employees) {
      if (e.risk_level === 'HIGH') { h++; hasPred = true }
      else if (e.risk_level === 'MEDIUM') { m++; hasPred = true }
      else if (e.risk_level === 'LOW') { l++; hasPred = true }
    }
    return { highCount: h, medCount: m, lowCount: l, hasPredictions: hasPred }
  }, [employees])

  // ── Empty state: no datasets ──────────────────────────────────────────────────
  if (hasNoDatasets) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">
              Contact Intelligence
            </h1>
            <p className="text-xs sm:text-sm text-[#666666] mt-1">
              View employee contact information organized by attrition risk.
            </p>
          </div>
        </div>

        <div className="card p-10 sm:p-12 text-center max-w-xl mx-auto space-y-4 border border-[#E5E5E5] mt-4">
          <div className="w-12 h-12 rounded-xl bg-[#F7F7F7] border border-border flex items-center justify-center mx-auto">
            <Users className="w-6 h-6 text-[#8A8A8A]" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#8A8A8A] uppercase tracking-wider block">
              No Datasets Available
            </span>
            <h2 className="text-base font-bold text-[#111111] mt-2">
              Upload an HR dataset from Dataset Manager to begin.
            </h2>
            <p className="text-xs text-[#666666] mt-1.5 leading-relaxed">
              Contact Intelligence displays employee records from your selected dataset, complete with attrition risk indicators.
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
      </div>
    )
  }

  // ── Main view ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">
            Contact Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-[#666666] mt-1">
            View employee records organized by attrition risk for the selected dataset.
          </p>
        </div>
        <DatasetSelector />
      </div>

      {/* Loading */}
      {loading && (
        <div className="card flex items-center gap-3 py-10 justify-center text-xs text-[#666666]">
          <LoadingSpinner size="sm" />
          <span>Loading employees…</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="card border-l-4 border-red-500 bg-red-50/40 flex items-start gap-3 p-4">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Empty dataset */}
      {!loading && !error && employees.length === 0 && activeDatasetId && (
        <div className="card p-10 text-center border border-dashed border-[#E5E5E5] bg-[#FAFAFA] space-y-3">
          <Users className="w-8 h-8 text-[#CCCCCC] mx-auto" />
          <p className="text-sm font-semibold text-[#666666]">No employees in this dataset</p>
          <p className="text-xs text-[#999999]">
            {activeDataset
              ? `"${activeDataset.name}" doesn't have any employee records yet.`
              : 'Select a dataset to view employees.'}
          </p>
        </div>
      )}

      {/* Content */}
      {!loading && !error && employees.length > 0 && (
        <>
          {/* Summary metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#FFFFFF] p-3.5 rounded-lg border border-border">
              <p className="text-[11px] font-semibold text-[#8A8A8A] uppercase tracking-wider">
                Total Employees
              </p>
              <p className="text-lg sm:text-xl font-bold text-[#111111] mt-1 font-mono">
                {employees.length.toLocaleString()}
              </p>
            </div>
            <div className="bg-[#FFFFFF] p-3.5 rounded-lg border border-border">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#B42318]" />
                <p className="text-[11px] font-semibold text-[#8A8A8A] uppercase tracking-wider">High Risk</p>
              </div>
              <p className="text-lg sm:text-xl font-bold text-[#111111] mt-1 font-mono">
                {hasPredictions ? highCount.toLocaleString() : '—'}
              </p>
            </div>
            <div className="bg-[#FFFFFF] p-3.5 rounded-lg border border-border">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#B54708]" />
                <p className="text-[11px] font-semibold text-[#8A8A8A] uppercase tracking-wider">Medium Risk</p>
              </div>
              <p className="text-lg sm:text-xl font-bold text-[#111111] mt-1 font-mono">
                {hasPredictions ? medCount.toLocaleString() : '—'}
              </p>
            </div>
            <div className="bg-[#FFFFFF] p-3.5 rounded-lg border border-border">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#067647]" />
                <p className="text-[11px] font-semibold text-[#8A8A8A] uppercase tracking-wider">Low Risk</p>
              </div>
              <p className="text-lg sm:text-xl font-bold text-[#111111] mt-1 font-mono">
                {hasPredictions ? lowCount.toLocaleString() : '—'}
              </p>
            </div>
          </div>

          {/* No predictions notice */}
          {!hasPredictions && (
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[#F7F7F7] border border-[#E5E5E5] text-xs">
              <AlertCircle className="w-4 h-4 text-[#666666] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#111111]">No risk predictions yet</p>
                <p className="text-[#666666] mt-0.5">
                  This dataset hasn't generated predictions. Upload it through Dataset Manager to score attrition risk.
                </p>
              </div>
            </div>
          )}

          {/* Controls + Table */}
          <div className="card space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Employee ID…"
                  className="input-field pl-10"
                />
              </div>

              {/* Risk filter */}
              <div className="inline-flex p-1 bg-[#F7F7F7] rounded-lg border border-border gap-1 flex-shrink-0 self-start md:self-auto">
                {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as RiskFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setRiskFilter(f)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                      riskFilter === f
                        ? 'bg-[#111111] text-white shadow-sm'
                        : 'text-[#666666] hover:text-[#111111] hover:bg-[#EAEAEA]'
                    }`}
                  >
                    {f === 'HIGH' && <span className="w-1.5 h-1.5 rounded-full bg-[#B42318]" />}
                    {f === 'MEDIUM' && <span className="w-1.5 h-1.5 rounded-full bg-[#B54708]" />}
                    {f === 'LOW' && <span className="w-1.5 h-1.5 rounded-full bg-[#067647]" />}
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-[#F7F7F7] text-[#666666]">
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Employee #</th>
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Risk Level</th>
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Probability</th>
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Key Profile Fields</th>
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-xs">
                        <p className="font-bold text-[#111111] text-sm">No employees found</p>
                        <p className="text-[#666666] mt-1">Try another search or risk filter.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedEmployees.map((e, idx) => {
                      const snapshot = e.feature_snapshot || {}
                      // Show a few key profile fields inline
                      const keyFields = ['Department', 'JobRole', 'Age', 'MaritalStatus']
                        .map((k) => {
                          const val = formatVal(snapshot[k])
                          return val !== '—' ? `${toDisplayLabel(k)}: ${val}` : null
                        })
                        .filter(Boolean)
                        .slice(0, 3)

                      const empStr = String(e.employee_number)
                      const copyKey = `${empStr}-${idx}`

                      return (
                        <tr key={e.id} className="hover:bg-[#FAFAFA] transition-colors">
                          <td className="py-3 px-3 font-mono font-semibold text-[#111111]">
                            #{e.employee_number}
                          </td>
                          <td className="py-3 px-3">
                            {e.risk_level ? (
                              <RiskBadge level={e.risk_level} size="sm" />
                            ) : (
                              <span className="text-[11px] text-[#8A8A8A] italic">No prediction</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono font-medium text-[#111111]">
                            {e.attrition_probability != null
                              ? formatProbability(e.attrition_probability)
                              : '—'}
                          </td>
                          <td className="py-3 px-3 text-[#666666]">
                            {keyFields.length > 0 ? keyFields.join(' · ') : '—'}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleCopy(empStr, copyKey)}
                              className="btn-secondary text-[11px] py-1 px-2 flex items-center gap-1 font-medium ml-auto"
                              title={`Copy Employee ID ${empStr}`}
                            >
                              {copiedKey === copyKey ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-700">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-[#8A8A8A]" />
                                  <span>Copy ID</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredEmployees.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border text-xs text-[#666666]">
                <div>
                  Showing{' '}
                  <span className="font-semibold text-[#111111]">
                    {(currentPage - 1) * PAGE_SIZE + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-semibold text-[#111111]">
                    {Math.min(currentPage * PAGE_SIZE, filteredEmployees.length)}
                  </span>{' '}
                  of{' '}
                  <span className="font-semibold text-[#111111]">
                    {filteredEmployees.length.toLocaleString()}
                  </span>{' '}
                  employees
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="btn-secondary text-xs px-2.5 py-1 flex items-center gap-1 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Previous
                  </button>
                  <span className="px-2 text-xs font-medium text-[#111111]">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="btn-secondary text-xs px-2.5 py-1 flex items-center gap-1 disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Helpers (internal) ────────────────────────────────────────────────────────

function formatProbability(p: number): string {
  return `${(p * 100).toFixed(1)}%`
}

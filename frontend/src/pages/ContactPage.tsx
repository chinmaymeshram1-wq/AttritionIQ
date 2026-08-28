import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDatasetStore } from '@/store/datasetStore'
import { employeeService } from '@/services/employeeService'
import type { EmployeeListItem } from '@/types'
import RiskBadge from '@/components/RiskBadge'
import LoadingSpinner from '@/components/LoadingSpinner'
import DatasetSelector from '@/components/DatasetSelector'
import { formatProbability } from '@/utils/formatters'
import {
  Users, Search, Copy, Check, Database,
  AlertCircle, ChevronLeft, ChevronRight,
} from 'lucide-react'

// ── Contact Field Aliases ──────────────────────────────────────────────────────

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[\s_-]/g, '')
}

const NAME_ALIASES = ['name', 'employeename', 'fullname']
const EMAIL_ALIASES = ['email', 'emailaddress', 'workemail']
const PHONE_ALIASES = ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'contactnumber']
const ADDRESS_ALIASES = ['address', 'employeeaddress', 'homeaddress', 'location', 'city']
const DEPT_ALIASES = ['department', 'dept']
const ROLE_ALIASES = ['jobrole', 'role', 'title', 'position']

function formatVal(val: unknown): string {
  if (val === null || val === undefined) return '—'
  const s = String(val).trim()
  return s === '' || s.toLowerCase() === 'nan' || s.toLowerCase() === 'null' ? '—' : s
}

function getFieldByAliases(row: Record<string, unknown>, aliases: string[]): string {
  const entries = Object.entries(row)
  for (const alias of aliases) {
    const entry = entries.find(([k]) => normalizeHeader(k) === alias)
    if (entry) {
      const formatted = formatVal(entry[1])
      if (formatted !== '—') return formatted
    }
  }
  return '—'
}

type RiskFilter = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'
const PAGE_SIZE = 25

interface ProcessedContact {
  id: string
  employeeNumber: number
  name: string
  email: string
  phone: string
  address: string
  department: string
  jobRole: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | null
  attritionProbability: number | null
}

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

  // ── Fetch employees when active dataset changes ──────────────────────────────
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
      .listEmployeesWithRisk(activeDatasetId, 1, 2000)
      .then((data) => {
        if (cancelled) return
        setEmployees(data.employees || [])
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        const msg = err?.response?.data?.detail || 'Failed to load employees for selected dataset.'
        setError(msg)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeDatasetId])

  // Reset page on search or filter change
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

  // ── Process employees into contact rows ──────────────────────────────────────
  const processedContacts: ProcessedContact[] = useMemo(() => {
    return employees.map((e) => {
      const snap = e.feature_snapshot || {}
      return {
        id: e.id,
        employeeNumber: e.employee_number,
        name: getFieldByAliases(snap, NAME_ALIASES),
        email: getFieldByAliases(snap, EMAIL_ALIASES),
        phone: getFieldByAliases(snap, PHONE_ALIASES),
        address: getFieldByAliases(snap, ADDRESS_ALIASES),
        department: getFieldByAliases(snap, DEPT_ALIASES),
        jobRole: getFieldByAliases(snap, ROLE_ALIASES),
        riskLevel: e.risk_level,
        attritionProbability: e.attrition_probability,
      }
    })
  }, [employees])

  // ── Filter rows ───────────────────────────────────────────────────────────────
  const filteredContacts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return processedContacts.filter((c) => {
      if (riskFilter !== 'ALL' && c.riskLevel !== riskFilter) return false
      if (q) {
        const numStr = String(c.employeeNumber)
        const nameMatch = c.name.toLowerCase().includes(q)
        const emailMatch = c.email.toLowerCase().includes(q)
        const phoneMatch = c.phone.toLowerCase().includes(q)
        const deptMatch = c.department.toLowerCase().includes(q)
        const roleMatch = c.jobRole.toLowerCase().includes(q)
        const numMatch = numStr.includes(q)
        if (!numMatch && !nameMatch && !emailMatch && !phoneMatch && !deptMatch && !roleMatch) {
          return false
        }
      }
      return true
    })
  }, [processedContacts, riskFilter, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / PAGE_SIZE))
  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredContacts.slice(start, start + PAGE_SIZE)
  }, [filteredContacts, currentPage])

  // ── Summary metrics ───────────────────────────────────────────────────────────
  const { highCount, medCount, lowCount, hasPredictions, hasContactData } = useMemo(() => {
    let h = 0, m = 0, l = 0, hasPred = false, hasContact = false
    for (const c of processedContacts) {
      if (c.riskLevel === 'HIGH') { h++; hasPred = true }
      else if (c.riskLevel === 'MEDIUM') { m++; hasPred = true }
      else if (c.riskLevel === 'LOW') { l++; hasPred = true }
      if (c.name !== '—' || c.email !== '—' || c.phone !== '—' || c.address !== '—') {
        hasContact = true
      }
    }
    return { highCount: h, medCount: m, lowCount: l, hasPredictions: hasPred, hasContactData: hasContact }
  }, [processedContacts])

  // ── Empty State: No Datasets ──────────────────────────────────────────────────
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
              Contact Intelligence displays employee records from your selected dataset, complete with attrition risk indicators and contact details.
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">
            Contact Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-[#666666] mt-1">
            View employee contact and profile information organized by attrition risk for the selected dataset.
          </p>
        </div>
        <DatasetSelector />
      </div>

      {/* Loading */}
      {loading && (
        <div className="card flex items-center gap-3 py-10 justify-center text-xs text-[#666666]">
          <LoadingSpinner size="sm" />
          <span>Loading employees from dataset…</span>
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

      {/* Main Content */}
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

          {/* Contact Fields Notice when absent from CSV */}
          {!hasContactData && (
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[#F7F7F7] border border-[#E5E5E5] text-xs">
              <AlertCircle className="w-4 h-4 text-[#666666] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#111111]">Contact fields (Name, Email, Phone, Address)</p>
                <p className="text-[#666666] mt-0.5 leading-relaxed">
                  This dataset does not contain dedicated contact columns. Uploading an HR CSV with Name, Email, Phone, or Address columns in Dataset Manager will automatically populate them here.
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
                  placeholder="Search by Employee ID, Name, Email, Phone, Department, or Role…"
                  className="input-field pl-10"
                />
              </div>

              {/* Risk filter pills */}
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
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Employee ID</th>
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Name</th>
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Email</th>
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Phone</th>
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Department</th>
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Job Role</th>
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Risk Level</th>
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Probability</th>
                    <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedContacts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-xs">
                        <p className="font-bold text-[#111111] text-sm">No employees found</p>
                        <p className="text-[#666666] mt-1">Try another search or risk filter.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedContacts.map((c, idx) => {
                      const empStr = String(c.employeeNumber)
                      const emailKey = `${c.id}-${idx}-email`
                      const phoneKey = `${c.id}-${idx}-phone`
                      const idKey = `${c.id}-${idx}-id`

                      return (
                        <tr key={c.id} className="hover:bg-[#FAFAFA] transition-colors">
                          <td className="py-3 px-3 font-mono font-semibold text-[#111111]">
                            #{c.employeeNumber}
                          </td>
                          <td className="py-3 px-3 font-medium text-[#111111]">
                            {c.name}
                          </td>
                          <td className="py-3 px-3 text-[#111111] break-all">
                            {c.email}
                          </td>
                          <td className="py-3 px-3 text-[#111111] whitespace-nowrap">
                            {c.phone}
                          </td>
                          <td className="py-3 px-3 text-[#666666]">
                            {c.department}
                          </td>
                          <td className="py-3 px-3 text-[#666666]">
                            {c.jobRole}
                          </td>
                          <td className="py-3 px-3">
                            {c.riskLevel ? (
                              <RiskBadge level={c.riskLevel} size="sm" />
                            ) : (
                              <span className="text-[11px] text-[#8A8A8A] italic">No prediction</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono font-medium text-[#111111]">
                            {c.attritionProbability != null
                              ? formatProbability(c.attritionProbability)
                              : '—'}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {c.email !== '—' && (
                                <button
                                  onClick={() => handleCopy(c.email, emailKey)}
                                  className="btn-secondary text-[11px] py-1 px-2 flex items-center gap-1 font-medium"
                                  title={`Copy Email: ${c.email}`}
                                >
                                  {copiedKey === emailKey ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span className="text-emerald-700">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 text-[#8A8A8A]" />
                                      <span>Copy Email</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {c.phone !== '—' && (
                                <button
                                  onClick={() => handleCopy(c.phone, phoneKey)}
                                  className="btn-secondary text-[11px] py-1 px-2 flex items-center gap-1 font-medium"
                                  title={`Copy Phone: ${c.phone}`}
                                >
                                  {copiedKey === phoneKey ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span className="text-emerald-700">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 text-[#8A8A8A]" />
                                      <span>Copy Phone</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {c.email === '—' && c.phone === '—' && (
                                <button
                                  onClick={() => handleCopy(empStr, idKey)}
                                  className="btn-secondary text-[11px] py-1 px-2 flex items-center gap-1 font-medium"
                                  title={`Copy Employee ID ${empStr}`}
                                >
                                  {copiedKey === idKey ? (
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
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredContacts.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border text-xs text-[#666666]">
                <div>
                  Showing{' '}
                  <span className="font-semibold text-[#111111]">
                    {(currentPage - 1) * PAGE_SIZE + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-semibold text-[#111111]">
                    {Math.min(currentPage * PAGE_SIZE, filteredContacts.length)}
                  </span>{' '}
                  of{' '}
                  <span className="font-semibold text-[#111111]">
                    {filteredContacts.length.toLocaleString()}
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

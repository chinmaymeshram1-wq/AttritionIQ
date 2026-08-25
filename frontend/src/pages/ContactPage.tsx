import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEmployeeSearchStore } from '@/store/employeeSearchStore'
import { useBatchStore } from '@/store/batchStore'
import { usePredictionStore } from '@/store/predictionStore'
import RiskBadge from '@/components/RiskBadge'
import LoadingSpinner from '@/components/LoadingSpinner'
import type { BatchPredictionRecord } from '@/types'
import {
  Users, Search, Copy, Check, Database, FileText,
  AlertCircle, ArrowRight, ChevronLeft, ChevronRight,
} from 'lucide-react'

// ── Contact Field Aliases (Phase 7A, 7B & 7E) ──────────────────────────────────

function normalizeColumnHeader(header: string): string {
  return header.toLowerCase().replace(/[\s_-]/g, '')
}

const NAME_ALIASES = ['name', 'employeename', 'fullname']
const EMAIL_ALIASES = ['email', 'emailaddress', 'workemail']
const PHONE_ALIASES = ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'contactnumber']
const ADDRESS_ALIASES = ['address', 'employeeaddress', 'homeaddress', 'location', 'city']
const ID_ALIASES = ['employeenumber', 'employeeid', 'empid', 'empno', 'id']

/** Format a cell value for display. */
function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  const s = String(val).trim()
  if (s === '' || s.toLowerCase() === 'nan' || s.toLowerCase() === 'null') return '—'
  return s
}

/** Look up a field in a row matching any of the normalized aliases. */
function getContactFieldValue(row: Record<string, string>, aliases: string[]): string {
  const entries = Object.entries(row)
  for (const alias of aliases) {
    const entry = entries.find(([k]) => normalizeColumnHeader(k) === alias)
    if (entry) {
      const formatted = formatCellValue(entry[1])
      if (formatted !== '—') {
        return formatted
      }
    }
  }
  return '—'
}

/** Detect the Employee ID column from CSV headers. */
function detectEmployeeIdColumn(headers: string[], preferred?: string | null): string | null {
  if (preferred && headers.some((h) => h.toLowerCase() === preferred.toLowerCase())) {
    return headers.find((h) => h.toLowerCase() === preferred.toLowerCase()) || preferred
  }
  for (const alias of ID_ALIASES) {
    const found = headers.find((h) => normalizeColumnHeader(h) === alias)
    if (found) return found
  }
  return null
}

/** Fast in-memory CSV parser handling quoted strings and commas */
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines: string[][] = []
  let row: string[] = []
  let inQuotes = false
  let field = ''

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        row.push(field.trim())
        field = ''
      } else if (char === '\r') {
        // ignore CR
      } else if (char === '\n') {
        row.push(field.trim())
        if (row.some((cell) => cell.length > 0)) {
          lines.push(row)
        }
        row = []
        field = ''
      } else {
        field += char
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim())
    if (row.some((cell) => cell.length > 0)) {
      lines.push(row)
    }
  }

  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = lines[0].map((h) => h.trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const rowObj: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      rowObj[headers[j]] = line[j] !== undefined ? line[j].trim() : ''
    }
    rows.push(rowObj)
  }

  return { headers, rows }
}

type RiskFilter = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'

interface ProcessedContactRow {
  raw: Record<string, string>
  employeeId: string
  name: string
  email: string
  phone: string
  address: string
  risk: 'HIGH' | 'MEDIUM' | 'LOW' | null
}

const PAGE_SIZE = 25

export default function ContactPage() {
  const navigate = useNavigate()

  // 1. Data sources
  const employeeSearchFile = useEmployeeSearchStore((s) => s.file)
  const batchFile = useBatchStore((s) => s.file)
  const file = employeeSearchFile || batchFile

  const analysis = useEmployeeSearchStore((s) => s.analysis)
  const batchCompat = useBatchStore((s) => s.compatReport)

  const searchResult = useEmployeeSearchStore((s) => s.searchResult)
  const batchResult = useBatchStore((s) => s.result)
  const singlePredictionResult = usePredictionStore((s) => s.result)

  const [parsing, setParsing] = useState(false)
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [detectedIdCol, setDetectedIdCol] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('ALL')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // ── Parse CSV on file change ────────────────────────────────────────────────
  useEffect(() => {
    if (!file) {
      setRawRows([])
      setDetectedIdCol('')
      return
    }

    let isSubscribed = true
    setParsing(true)

    file.text()
      .then((text) => {
        if (!isSubscribed) return
        const { headers, rows } = parseCSV(text)
        setRawRows(rows)

        // Robust ID Column detection
        const preferredId =
          analysis?.employee_id_column || batchCompat?.employee_id_column || null
        const idCol = detectEmployeeIdColumn(headers, preferredId) || headers[0] || ''
        setDetectedIdCol(idCol)
        setParsing(false)
      })
      .catch(() => {
        if (!isSubscribed) return
        setRawRows([])
        setParsing(false)
      })

    return () => {
      isSubscribed = false
    }
  }, [file, analysis, batchCompat])

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, riskFilter])

  // ── Build Map of known stored predictions ───────────────────────────────────
  const predictionsMap = useMemo(() => {
    const map = new Map<string, 'HIGH' | 'MEDIUM' | 'LOW'>()

    // 1. From Batch Prediction results
    if (batchResult?.results && Array.isArray(batchResult.results)) {
      for (const rec of batchResult.results) {
        if (rec.employee_number !== undefined && rec.employee_number !== null) {
          const rawRisk = rec.risk_level?.toUpperCase().trim()
          if (rawRisk === 'HIGH' || rawRisk === 'MEDIUM' || rawRisk === 'LOW') {
            const rLevel = rawRisk as 'HIGH' | 'MEDIUM' | 'LOW'
            const numStr = String(rec.employee_number).trim()
            map.set(numStr, rLevel)
            map.set(numStr.toLowerCase(), rLevel)
            const asInt = parseInt(numStr, 10)
            if (!isNaN(asInt)) {
              map.set(String(asInt), rLevel)
            }
          }
        }
      }
    }

    // 2. From Employee Search single prediction record
    if (searchResult?.stored_prediction) {
      const sp = searchResult.stored_prediction
      const rawRisk = sp.risk_level?.toUpperCase().trim()
      if (rawRisk === 'HIGH' || rawRisk === 'MEDIUM' || rawRisk === 'LOW') {
        const rLevel = rawRisk as 'HIGH' | 'MEDIUM' | 'LOW'
        const idVal = searchResult.employee_row[searchResult.employee_id_column]
        if (idVal !== undefined && idVal !== null) {
          const strVal = String(idVal).trim()
          map.set(strVal, rLevel)
          map.set(strVal.toLowerCase(), rLevel)
          const asInt = parseInt(strVal, 10)
          if (!isNaN(asInt)) {
            map.set(String(asInt), rLevel)
          }
        }
      }
    }

    // 3. From Individual Prediction result
    if (singlePredictionResult) {
      const rawRisk = singlePredictionResult.risk_level?.toUpperCase().trim()
      if (rawRisk === 'HIGH' || rawRisk === 'MEDIUM' || rawRisk === 'LOW') {
        const rLevel = rawRisk as 'HIGH' | 'MEDIUM' | 'LOW'
        const numStr = String(singlePredictionResult.employee_number).trim()
        map.set(numStr, rLevel)
        map.set(numStr.toLowerCase(), rLevel)
        const asInt = parseInt(numStr, 10)
        if (!isNaN(asInt)) {
          map.set(String(asInt), rLevel)
        }
      }
    }

    return map
  }, [batchResult, searchResult, singlePredictionResult])

  // ── Process Rows ────────────────────────────────────────────────────────────
  const processedRows: ProcessedContactRow[] = useMemo(() => {
    const idCol = analysis?.employee_id_column || detectedIdCol
    const batchRecords: BatchPredictionRecord[] | undefined = batchResult?.results

    return rawRows.map((row, rowIndex) => {
      // 1. Extract Employee ID
      let idVal = '—'
      if (idCol && row[idCol] !== undefined) {
        idVal = formatCellValue(row[idCol])
      } else {
        idVal = getContactFieldValue(row, ID_ALIASES)
      }

      // 2. Extract Contact Fields
      const name = getContactFieldValue(row, NAME_ALIASES)
      const email = getContactFieldValue(row, EMAIL_ALIASES)
      const phone = getContactFieldValue(row, PHONE_ALIASES)
      const address = getContactFieldValue(row, ADDRESS_ALIASES)

      // 3. Match Risk Level against verified prediction records
      let risk: 'HIGH' | 'MEDIUM' | 'LOW' | null = null

      if (idVal !== '—') {
        const cleanId = idVal.trim()
        if (predictionsMap.has(cleanId)) {
          risk = predictionsMap.get(cleanId)!
        } else if (predictionsMap.has(cleanId.toLowerCase())) {
          risk = predictionsMap.get(cleanId.toLowerCase())!
        } else {
          const asInt = parseInt(cleanId, 10)
          if (!isNaN(asInt) && predictionsMap.has(String(asInt))) {
            risk = predictionsMap.get(String(asInt))!
          }
        }
      }

      // Fallback: 1-to-1 index matching if batch prediction was executed on this dataset
      if (!risk && batchRecords && batchRecords[rowIndex]) {
        const rec = batchRecords[rowIndex]
        const rawRisk = rec.risk_level?.toUpperCase().trim()
        if (rawRisk === 'HIGH' || rawRisk === 'MEDIUM' || rawRisk === 'LOW') {
          const asInt = parseInt(idVal, 10)
          if (
            rec.employee_number === rowIndex + 1 ||
            rec.employee_number === rowIndex + 2 ||
            String(rec.employee_number) === idVal ||
            (!isNaN(asInt) && rec.employee_number === asInt)
          ) {
            risk = rawRisk as 'HIGH' | 'MEDIUM' | 'LOW'
          }
        }
      }

      // Fallback: Check if CSV row explicitly contains a prediction risk column
      if (!risk) {
        const rawRisk = row['Risk'] || row['Risk_Level'] || row['RiskLevel'] || row['risk_level']
        if (rawRisk) {
          const normRisk = String(rawRisk).toUpperCase().trim()
          if (normRisk === 'HIGH' || normRisk === 'MEDIUM' || normRisk === 'LOW') {
            risk = normRisk as 'HIGH' | 'MEDIUM' | 'LOW'
          }
        }
      }

      return {
        raw: row,
        employeeId: idVal,
        name,
        email,
        phone,
        address,
        risk,
      }
    })
  }, [rawRows, analysis, detectedIdCol, predictionsMap, batchResult])

  // ── Metrics Calculation ─────────────────────────────────────────────────────
  const { totalEmployees, highRiskCount, mediumRiskCount, lowRiskCount, hasPredictionData } =
    useMemo(() => {
      let high = 0
      let med = 0
      let low = 0
      let hasData = false

      for (const row of processedRows) {
        if (row.risk === 'HIGH') {
          high++
          hasData = true
        } else if (row.risk === 'MEDIUM') {
          med++
          hasData = true
        } else if (row.risk === 'LOW') {
          low++
          hasData = true
        }
      }

      return {
        totalEmployees: processedRows.length,
        highRiskCount: high,
        mediumRiskCount: med,
        lowRiskCount: low,
        hasPredictionData: hasData,
      }
    }, [processedRows])

  // ── Check if Contact Columns are available in this dataset ──────────────────
  const hasContactColumns = useMemo(() => {
    return processedRows.some(
      (r) => r.name !== '—' || r.email !== '—' || r.phone !== '—' || r.address !== '—',
    )
  }, [processedRows])

  // ── Filter & Search Rows ────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()

    return processedRows.filter((row) => {
      // Risk Filter
      if (riskFilter === 'HIGH' && row.risk !== 'HIGH') return false
      if (riskFilter === 'MEDIUM' && row.risk !== 'MEDIUM') return false
      if (riskFilter === 'LOW' && row.risk !== 'LOW') return false

      // Search Query
      if (q) {
        const matchesId = row.employeeId.toLowerCase().includes(q)
        const matchesName = row.name.toLowerCase().includes(q)
        const matchesEmail = row.email.toLowerCase().includes(q)
        const matchesPhone = row.phone.toLowerCase().includes(q)
        const matchesAddress = row.address.toLowerCase().includes(q)
        if (!matchesId && !matchesName && !matchesEmail && !matchesPhone && !matchesAddress) {
          return false
        }
      }

      return true
    })
  }, [processedRows, riskFilter, searchQuery])

  // ── Pagination Calculation ──────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredRows.slice(start, start + PAGE_SIZE)
  }, [filteredRows, currentPage])

  // ── Copy Handler ────────────────────────────────────────────────────────────
  const handleCopy = useCallback((text: string, key: string) => {
    if (!text || text === '—') return
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => {
      setCopiedKey(null)
    }, 2000)
  }, [])

  // ── 1. Empty State when no dataset is loaded ────────────────────────────────
  if (!file) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">
            Contact Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-[#666666] mt-1">
            View employee contact information organized by attrition risk.
          </p>
        </div>

        <div className="card p-10 sm:p-12 text-center max-w-xl mx-auto space-y-4 border border-[#E5E5E5] mt-8">
          <div className="w-12 h-12 rounded-xl bg-[#F7F7F7] border border-border flex items-center justify-center mx-auto text-[#111111]">
            <Users className="w-6 h-6 text-[#8A8A8A]" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#8A8A8A] uppercase tracking-wider block">
              Contact Intelligence
            </span>
            <h2 className="text-base font-bold text-[#111111] mt-2">
              No employee dataset is currently loaded.
            </h2>
            <p className="text-xs text-[#666666] mt-1.5 leading-relaxed max-w-md mx-auto">
              Upload an employee dataset through Employee Search first to view employee contact information.
            </p>
          </div>
          <div className="pt-3">
            <button
              onClick={() => navigate('/employees')}
              className="btn-primary text-xs px-5 py-2.5 inline-flex items-center gap-2"
            >
              <Users className="w-3.5 h-3.5" />
              Go to Employee Search
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── 2. Loading State while CSV is parsed ────────────────────────────────────
  if (parsing) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">
            Contact Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-[#666666] mt-1">
            View employee contact information organized by attrition risk.
          </p>
        </div>
        <div className="card flex items-center justify-center py-16 gap-3 text-xs text-[#666666]">
          <LoadingSpinner size="sm" />
          <span>Processing dataset contacts…</span>
        </div>
      </div>
    )
  }

  // ── 3. Contact Intelligence View ────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">
          Contact Intelligence
        </h1>
        <p className="text-xs sm:text-sm text-[#666666] mt-1">
          View employee contact information organized by attrition risk.
        </p>
      </div>

      {/* Dataset Status Bar */}
      <div className="card p-3.5 bg-[#FAFAFA] border-border flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-border flex-shrink-0">
            <Database className="w-4 h-4 text-[#111111]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-bold text-[#111111]">
              <FileText className="w-3.5 h-3.5 text-[#8A8A8A]" />
              <span>{file.name}</span>
            </div>
            <p className="text-[11px] text-[#666666] mt-0.5">
              {totalEmployees.toLocaleString()} employees &nbsp;&bull;&nbsp; Employee ID Column:{' '}
              <span className="font-mono font-semibold text-[#111111]">
                {analysis?.employee_id_column || detectedIdCol || 'Auto-detected'}
              </span>
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/employees')}
          className="text-xs font-medium text-[#666666] hover:text-[#111111] hover:underline flex items-center gap-1"
        >
          <span>Switch Dataset in Employee Search</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#FFFFFF] p-3.5 rounded-lg border border-border">
          <p className="text-[11px] font-semibold text-[#8A8A8A] uppercase tracking-wider">
            Total Employees
          </p>
          <p className="text-lg sm:text-xl font-bold text-[#111111] mt-1 font-mono">
            {totalEmployees.toLocaleString()}
          </p>
        </div>

        <div className="bg-[#FFFFFF] p-3.5 rounded-lg border border-border">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#B42318]" />
            <p className="text-[11px] font-semibold text-[#8A8A8A] uppercase tracking-wider">
              High Risk
            </p>
          </div>
          <p className="text-lg sm:text-xl font-bold text-[#111111] mt-1 font-mono">
            {hasPredictionData ? highRiskCount.toLocaleString() : '—'}
          </p>
        </div>

        <div className="bg-[#FFFFFF] p-3.5 rounded-lg border border-border">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#B54708]" />
            <p className="text-[11px] font-semibold text-[#8A8A8A] uppercase tracking-wider">
              Medium Risk
            </p>
          </div>
          <p className="text-lg sm:text-xl font-bold text-[#111111] mt-1 font-mono">
            {hasPredictionData ? mediumRiskCount.toLocaleString() : '—'}
          </p>
        </div>

        <div className="bg-[#FFFFFF] p-3.5 rounded-lg border border-border">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#067647]" />
            <p className="text-[11px] font-semibold text-[#8A8A8A] uppercase tracking-wider">
              Low Risk
            </p>
          </div>
          <p className="text-lg sm:text-xl font-bold text-[#111111] mt-1 font-mono">
            {hasPredictionData ? lowRiskCount.toLocaleString() : '—'}
          </p>
        </div>
      </div>

      {/* Information Banner when contact columns are unavailable */}
      {!hasContactColumns && (
        <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[#F7F7F7] border border-[#E5E5E5] text-xs">
          <AlertCircle className="w-4 h-4 text-[#666666] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-[#111111]">Contact fields unavailable</p>
            <p className="text-[#666666] mt-0.5 leading-relaxed">
              This dataset does not contain employee contact information. Upload a dataset containing Name, Email, Phone, or Address fields to enable contact details.
            </p>
          </div>
        </div>
      )}

      {/* Controls: Search & Segmented Risk Filter */}
      <div className="card space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search employees by name, ID, email or phone..."
              className="input-field pl-10"
            />
          </div>

          {/* Segmented Risk Filter Controls */}
          <div className="inline-flex p-1 bg-[#F7F7F7] rounded-lg border border-border gap-1 flex-shrink-0 self-start md:self-auto">
            <button
              onClick={() => setRiskFilter('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                riskFilter === 'ALL'
                  ? 'bg-[#111111] text-white shadow-sm'
                  : 'text-[#666666] hover:text-[#111111] hover:bg-[#EAEAEA]'
              }`}
            >
              ALL
            </button>

            <button
              onClick={() => setRiskFilter('HIGH')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                riskFilter === 'HIGH'
                  ? 'bg-[#111111] text-white shadow-sm'
                  : 'text-[#666666] hover:text-[#111111] hover:bg-[#EAEAEA]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#B42318]" />
              <span>HIGH RISK</span>
            </button>

            <button
              onClick={() => setRiskFilter('MEDIUM')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                riskFilter === 'MEDIUM'
                  ? 'bg-[#111111] text-white shadow-sm'
                  : 'text-[#666666] hover:text-[#111111] hover:bg-[#EAEAEA]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#B54708]" />
              <span>MEDIUM RISK</span>
            </button>

            <button
              onClick={() => setRiskFilter('LOW')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                riskFilter === 'LOW'
                  ? 'bg-[#111111] text-white shadow-sm'
                  : 'text-[#666666] hover:text-[#111111] hover:bg-[#EAEAEA]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#067647]" />
              <span>LOW RISK</span>
            </button>
          </div>
        </div>

        {/* ── Contact Table ─────────────────────────────────────────────────── */}
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-[#F7F7F7] text-[#666666]">
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Employee ID</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Name</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Email</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Phone</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Address</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Risk</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs">
                    <p className="font-bold text-[#111111] text-sm">No employees found</p>
                    <p className="text-[#666666] mt-1">Try another search or risk filter.</p>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r, idx) => {
                  const emailKey = `${r.employeeId}-${idx}-email`
                  const phoneKey = `${r.employeeId}-${idx}-phone`
                  const hasEmail = r.email !== '—'
                  const hasPhone = r.phone !== '—'

                  return (
                    <tr key={`${r.employeeId}-${idx}`} className="hover:bg-[#FAFAFA] transition-colors">
                      <td className="py-3 px-3 font-mono font-semibold text-[#111111]">
                        {r.employeeId !== '—' ? (
                          <button
                            onClick={() => {
                              useEmployeeSearchStore.getState().setQuery(r.employeeId)
                              navigate('/employees')
                            }}
                            className="hover:underline hover:text-black font-mono font-semibold text-[#111111] text-left transition-colors"
                            title={`Search Employee ${r.employeeId} in Employee Search`}
                          >
                            {r.employeeId}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-3 font-medium text-[#111111]">
                        {r.name}
                      </td>
                      <td className="py-3 px-3 text-[#111111] break-all">
                        {r.email}
                      </td>
                      <td className="py-3 px-3 text-[#111111] whitespace-nowrap">
                        {r.phone}
                      </td>
                      <td className="py-3 px-3 text-[#666666]">
                        {r.address}
                      </td>
                      <td className="py-3 px-3">
                        {r.risk ? (
                          <RiskBadge level={r.risk} size="sm" />
                        ) : (
                          <span className="text-[11px] text-[#8A8A8A] italic">Risk unavailable</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {hasEmail && (
                            <button
                              onClick={() => handleCopy(r.email, emailKey)}
                              className="btn-secondary text-[11px] py-1 px-2 flex items-center gap-1 font-medium"
                              title={`Copy Email: ${r.email}`}
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

                          {hasPhone && (
                            <button
                              onClick={() => handleCopy(r.phone, phoneKey)}
                              className="btn-secondary text-[11px] py-1 px-2 flex items-center gap-1 font-medium"
                              title={`Copy Phone: ${r.phone}`}
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

                          {!hasEmail && !hasPhone && (
                            <span className="text-[#8A8A8A] font-mono text-xs pr-2">—</span>
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

        {/* Pagination Footer */}
        {filteredRows.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border text-xs text-[#666666]">
            <div>
              Showing <span className="font-semibold text-[#111111]">{(currentPage - 1) * PAGE_SIZE + 1}</span> to{' '}
              <span className="font-semibold text-[#111111]">
                {Math.min(currentPage * PAGE_SIZE, filteredRows.length)}
              </span> of <span className="font-semibold text-[#111111]">{filteredRows.length.toLocaleString()}</span> employees
              {filteredRows.length !== totalEmployees && (
                <span className="text-[#8A8A8A] ml-1">
                  (filtered from {totalEmployees.toLocaleString()})
                </span>
              )}
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
    </div>
  )
}

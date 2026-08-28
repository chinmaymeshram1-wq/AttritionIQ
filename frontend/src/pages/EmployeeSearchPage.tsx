import { useCallback, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { useEmployeeSearchStore } from '@/store/employeeSearchStore'
import type { DatasetAnalysisResult, EmployeeSearchResult } from '@/types'
import RiskBadge from '@/components/RiskBadge'
import LoadingSpinner from '@/components/LoadingSpinner'
import { formatProbability } from '@/utils/formatters'
import {
  Upload, FileText, Search, User, ShieldCheck, AlertCircle,
  AlertTriangle, XCircle, X, Database, Contact,
} from 'lucide-react'
import DatasetSelector from '@/components/DatasetSelector'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a snake_case or PascalCase key to a readable display label. */
function toDisplayLabel(key: string): string {
  // Handle PascalCase → insert spaces before uppercase letters
  const spacedPascal = key.replace(/([a-z])([A-Z])/g, '$1 $2')
  // Replace underscores/hyphens with spaces
  return spacedPascal.replace(/[_-]/g, ' ')
}

/** Format a cell value for display. */
function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  const s = String(val).trim()
  if (s === '' || s.toLowerCase() === 'nan' || s.toLowerCase() === 'null') return '—'
  return s
}

/** Normalize a column header for matching against alias lists (lowercase, no spaces, underscores, or hyphens). */
function normalizeColumnHeader(header: string): string {
  return header.toLowerCase().replace(/[\s_-]/g, '')
}

const NAME_ALIASES = ['name', 'employeename', 'fullname']
const EMAIL_ALIASES = ['email', 'emailaddress', 'workemail']
const PHONE_ALIASES = ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'contactnumber']
const ADDRESS_ALIASES = ['address', 'employeeaddress', 'homeaddress', 'location', 'city']

/** Look up a field in the employee row matching any of the normalized aliases. */
function getContactFieldValue(row: Record<string, unknown>, aliases: string[]): string {
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

// ── Compatibility Badge ───────────────────────────────────────────────────────

function CompatBadge({ status, found, required, pct }: {
  status: string
  found: number
  required: number
  pct: number
}) {
  const config = {
    FULLY_COMPATIBLE: {
      icon: '●',
      label: 'FULLY COMPATIBLE',
      badge: 'bg-emerald-100 text-emerald-800',
    },
    PARTIALLY_COMPATIBLE: {
      icon: '●',
      label: 'PARTIALLY COMPATIBLE',
      badge: 'bg-amber-100 text-amber-800',
    },
    INCOMPATIBLE: {
      icon: '●',
      label: 'INCOMPATIBLE',
      badge: 'bg-red-100 text-red-800',
    },
  }[status] ?? {
    icon: '●',
    label: status,
    badge: 'bg-[#F7F7F7] text-[#666666]',
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${config.badge}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span> &nbsp;&bull;&nbsp; <span>{found}/{required} features</span> &nbsp;&bull;&nbsp; <span>{pct}%</span>
    </span>
  )
}

// ── Dataset Status Card ───────────────────────────────────────────────────────

function DatasetStatusCard({
  analysis,
  file,
  onClear,
}: {
  analysis: DatasetAnalysisResult
  file: File
  onClear: () => void
}) {
  const hasIdCol = !!analysis.employee_id_column
  const isIncompat = analysis.compatibility.status === 'INCOMPATIBLE'

  return (
    <div className="card border-l-4 border-[#111111] space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#F7F7F7] rounded-lg flex items-center justify-center border border-border flex-shrink-0">
            <Database className="w-4 h-4 text-[#111111]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#111111]">Dataset Ready</h3>
            <p className="text-xs text-[#8A8A8A] mt-0.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              {file.name}
            </p>
          </div>
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 text-xs text-[#666666] hover:text-red-600 transition-colors px-2 py-1 rounded-md hover:bg-red-50 border border-transparent hover:border-red-200"
        >
          <X className="w-3.5 h-3.5" />
          Clear Dataset
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-[#F7F7F7] rounded-lg p-3 border border-border">
          <p className="text-xs text-[#666666] font-medium">Employees Found</p>
          <p className="text-lg font-bold text-[#111111] mt-0.5">{analysis.row_count.toLocaleString()}</p>
        </div>
        <div className="bg-[#F7F7F7] rounded-lg p-3 border border-border">
          <p className="text-xs text-[#666666] font-medium">Columns</p>
          <p className="text-lg font-bold text-[#111111] mt-0.5">{analysis.column_count}</p>
        </div>
        <div className="bg-[#F7F7F7] rounded-lg p-3 border border-border col-span-2 sm:col-span-1">
          <p className="text-xs text-[#666666] font-medium">Employee ID Column</p>
          <p className="text-xs font-bold text-[#111111] mt-1 font-mono truncate">
            {analysis.employee_id_column ?? (
              <span className="text-red-600 not-italic">Not detected</span>
            )}
          </p>
        </div>
      </div>

      {/* Compatibility badge */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[#666666] font-medium">ML Compatibility:</span>
        <CompatBadge
          status={analysis.compatibility.status}
          found={analysis.compatibility.features_found}
          required={analysis.compatibility.features_required}
          pct={analysis.compatibility.data_completeness_percentage}
        />
      </div>

      {/* Warnings */}
      {!hasIdCol && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
          <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">
            <strong>No employee identifier column detected.</strong> Employee search is
            unavailable. Ensure the CSV contains a column such as{' '}
            <span className="font-mono">EmployeeNumber</span>,{' '}
            <span className="font-mono">Employee_ID</span>, or{' '}
            <span className="font-mono">EmpID</span>.
          </p>
        </div>
      )}

      {isIncompat && hasIdCol && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            This dataset is <strong>incompatible</strong> with the ML model (too few
            recognised features). Employee profile lookup will still work, but no ML
            prediction can be generated for employees in this dataset.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Employee Contact Information Card ─────────────────────────────────────────

function EmployeeContactInfoCard({
  row,
  employeeId,
}: {
  row: Record<string, unknown>
  employeeId: string
}) {
  const name = getContactFieldValue(row, NAME_ALIASES)
  const email = getContactFieldValue(row, EMAIL_ALIASES)
  const phone = getContactFieldValue(row, PHONE_ALIASES)
  const address = getContactFieldValue(row, ADDRESS_ALIASES)

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4 border-b border-border pb-2">
        <Contact className="w-4 h-4 text-[#111111]" />
        <h3 className="text-xs font-bold text-[#666666] uppercase tracking-wider">
          Employee Contact Information
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#F7F7F7] p-3 rounded-lg border border-border">
          <p className="text-[11px] text-[#8A8A8A] font-medium uppercase tracking-wider">Name</p>
          <p className="text-xs font-semibold text-[#111111] mt-1 break-words">
            {name}
          </p>
        </div>

        <div className="bg-[#F7F7F7] p-3 rounded-lg border border-border">
          <p className="text-[11px] text-[#8A8A8A] font-medium uppercase tracking-wider">Employee ID</p>
          <p className="text-xs font-mono font-semibold text-[#111111] mt-1 break-words">
            {employeeId}
          </p>
        </div>

        <div className="bg-[#F7F7F7] p-3 rounded-lg border border-border">
          <p className="text-[11px] text-[#8A8A8A] font-medium uppercase tracking-wider">Email</p>
          <p className="text-xs font-semibold text-[#111111] mt-1 break-all">
            {email}
          </p>
        </div>

        <div className="bg-[#F7F7F7] p-3 rounded-lg border border-border">
          <p className="text-[11px] text-[#8A8A8A] font-medium uppercase tracking-wider">Phone</p>
          <p className="text-xs font-semibold text-[#111111] mt-1 break-words">
            {phone}
          </p>
        </div>

        <div className="bg-[#F7F7F7] p-3 rounded-lg border border-border sm:col-span-2 lg:col-span-4">
          <p className="text-[11px] text-[#8A8A8A] font-medium uppercase tracking-wider">Address</p>
          <p className="text-xs font-semibold text-[#111111] mt-1 break-words">
            {address}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Employee Profile Card ─────────────────────────────────────────────────────

function EmployeeProfileCard({
  result,
  searchId,
}: {
  result: EmployeeSearchResult
  searchId: string
}) {
  const { employee_row, employee_id_column, stored_prediction, explanation } = result

  // Separate the ID column from the rest for display ordering
  const idValue = formatCellValue(employee_row[employee_id_column])
  const displayId = idValue !== '—' ? idValue : (searchId || '—')
  const otherEntries = Object.entries(employee_row).filter(
    ([k]) => k !== employee_id_column,
  )

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
              <span className="font-mono">{displayId}</span>
            </h2>
            <p className="text-xs text-[#8A8A8A] mt-0.5">
              Identified by column:{' '}
              <span className="font-mono font-semibold text-[#111111]">{employee_id_column}</span>
            </p>
          </div>
        </div>

        {stored_prediction ? (
          <div className="text-right">
            <span className="text-xs text-[#8A8A8A] block font-medium">Stored Risk Probability</span>
            <div className="flex items-center gap-2 justify-end mt-1">
              <span className="text-2xl sm:text-3xl font-black text-[#111111] tracking-tight">
                {formatProbability(stored_prediction.attrition_probability)}
              </span>
              <RiskBadge level={stored_prediction.risk_level} size="md" />
            </div>
          </div>
        ) : (
          <div className="text-xs text-[#8A8A8A] italic">No prediction on record</div>
        )}
      </div>

      {/* Employee profile fields */}
      <div className="card">
        <h3 className="text-xs font-bold text-[#666666] uppercase tracking-wider mb-4 border-b border-border pb-2">
          Employee Profile
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {otherEntries.map(([key, val]) => (
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

      {/* Stored prediction details */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4 border-b border-border pb-2">
          <ShieldCheck className="w-4 h-4 text-[#111111]" />
          <h3 className="text-xs font-bold text-[#666666] uppercase tracking-wider">
            Stored Prediction
          </h3>
        </div>

        {stored_prediction ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#F7F7F7] p-3 rounded-lg border border-border">
                <p className="text-[11px] text-[#8A8A8A] font-medium">Attrition Probability</p>
                <p className="text-sm font-bold text-[#111111] mt-0.5">
                  {formatProbability(stored_prediction.attrition_probability)}
                </p>
              </div>
              <div className="bg-[#F7F7F7] p-3 rounded-lg border border-border">
                <p className="text-[11px] text-[#8A8A8A] font-medium">Risk Level</p>
                <p className="text-sm font-bold text-[#111111] mt-0.5">{stored_prediction.risk_level}</p>
              </div>
              <div className="bg-[#F7F7F7] p-3 rounded-lg border border-border">
                <p className="text-[11px] text-[#8A8A8A] font-medium">Model Pipeline</p>
                <p className="text-sm font-bold text-[#111111] mt-0.5">{stored_prediction.model_version}</p>
              </div>
              <div className="bg-[#F7F7F7] p-3 rounded-lg border border-border">
                <p className="text-[11px] text-[#8A8A8A] font-medium">Prediction ID</p>
                <p className="text-[11px] font-mono text-[#666666] mt-0.5 break-all">{stored_prediction.id}</p>
              </div>
            </div>
            <div className="bg-[#F7F7F7] p-2.5 rounded-lg border border-border inline-block">
              <p className="text-[11px] text-[#8A8A8A] font-medium">Recorded At: <span className="font-semibold text-[#111111]">{new Date(stored_prediction.created_at).toLocaleString()}</span></p>
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
              No prediction is currently available for this employee. Run an Individual or
              Batch prediction to generate one.
            </p>
          </div>
        )}
      </div>

      {/* Employee Contact Information */}
      <EmployeeContactInfoCard row={employee_row} employeeId={displayId} />
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function EmployeeSearchPage() {
  const {
    file,
    analyzing,
    analysis,
    analyzeError,
    query,
    searching,
    searchResult,
    searchError,
    notFound,
    uploadAndAnalyze,
    searchInDataset,
    setQuery,
    clear,
  } = useEmployeeSearchStore()

  // Scroll references
  const profileRef = useRef<HTMLDivElement>(null)
  const notFoundRef = useRef<HTMLDivElement>(null)

  // Auto-scroll when search result or not-found status updates
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

  // ── Drop handler ────────────────────────────────────────────────────────────

  const onDrop = useCallback(async (accepted: File[]) => {
    const dropped = accepted[0] ?? null
    await uploadAndAnalyze(dropped)
  }, [uploadAndAnalyze])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  })

  // ── Search handler ──────────────────────────────────────────────────────────

  const handleSearch = async () => {
    await searchInDataset()
  }

  // ── Clear handler ───────────────────────────────────────────────────────────

  const handleClear = () => {
    clear()
  }

  const showUploadArea = !file || (!analysis && !analyzing && !analyzeError)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">Employee Profile Search</h1>
          <p className="text-xs sm:text-sm text-[#666666] mt-1">
            Upload an employee dataset or select active dataset to search for a specific employee profile.
          </p>
        </div>

        <DatasetSelector />
      </div>

      {/* ── STEP 1 / STEP 2: Upload zone ──────────────────────────────────── */}
      {showUploadArea && (
        <div className="card">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-[#111111] bg-[#F7F7F7]'
                : 'border-border hover:border-border-dark hover:bg-[#F7F7F7]'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-8 h-8 text-[#8A8A8A] mx-auto mb-3" />
            <p className="text-sm font-semibold text-[#111111] mb-1">Upload Employee CSV</p>
            {isDragActive ? (
              <p className="text-xs text-[#111111] font-medium">Drop the CSV file here…</p>
            ) : (
              <>
                <p className="text-xs text-[#666666]">
                  Drag &amp; drop your HR CSV file here, or click to browse
                </p>
                <p className="text-[11px] text-[#8A8A8A] mt-1">
                  Accepts .csv files &bull; Max 10 MB &bull; Auto-detects employee ID column
                </p>
              </>
            )}
          </div>

          {analyzeError && (
            <div className="mt-3 flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              <XCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
              {analyzeError}
            </div>
          )}
        </div>
      )}

      {/* Analysing spinner */}
      {analyzing && (
        <div className="card flex items-center gap-3 text-xs text-[#666666]">
          <LoadingSpinner size="sm" />
          <span>Analysing dataset…</span>
        </div>
      )}

      {/* ── STEP 2: Dataset status card ───────────────────────────────────── */}
      {analysis && file && !analyzing && (
        <DatasetStatusCard analysis={analysis} file={file} onClear={handleClear} />
      )}

      {/* ── Search Employee — always visible ──────────────────────────────── */}
      <div className="card space-y-3">
        <div>
          <label className="block text-xs font-semibold text-[#111111] uppercase tracking-wider mb-1.5">
            Search Employee
          </label>
          <p className="text-xs text-[#8A8A8A] mb-3">
            {analysis?.employee_id_column
              ? <>Enter the employee ID as it appears in the{' '}
                  <span className="font-mono font-semibold text-[#111111]">
                    {analysis.employee_id_column}
                  </span>{' '}
                  column.</>
              : 'Enter an Employee ID to search within the uploaded dataset.'}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="input-field pl-10"
              placeholder="Enter Employee ID (e.g. 1, 1001, EMP-042)"
              disabled={searching}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="btn-primary px-6 flex items-center gap-2 text-xs"
          >
            {searching ? <LoadingSpinner size="sm" /> : <Search className="w-3.5 h-3.5" />}
            Search Employee
          </button>
        </div>

        {/* Validation / search error */}
        {searchError && (
          <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            <XCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
            {searchError}
          </div>
        )}
      </div>

      {/* ── STEP 4a: Not found ────────────────────────────────────────────── */}
      {notFound && (
        <div ref={notFoundRef} className="card border-l-4 border-amber-500 bg-amber-50/40 flex items-start gap-3 scroll-mt-6 p-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">Employee Not Found</p>
            <p className="text-xs text-amber-800 mt-1">
              Employee ID <span className="font-mono font-semibold">"{query}"</span> was not
              found in the uploaded dataset.
            </p>
          </div>
        </div>
      )}

      {/* ── STEP 4b: Employee profile ─────────────────────────────────────── */}
      {searchResult && (
        <div ref={profileRef} className="scroll-mt-6">
          <EmployeeProfileCard result={searchResult} searchId={query} />
        </div>
      )}
    </div>
  )
}

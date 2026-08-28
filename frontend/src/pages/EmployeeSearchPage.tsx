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
  AlertTriangle, XCircle, Database, Contact, Sparkles, SlidersHorizontal,
  TrendingDown, CheckCircle, ArrowRight
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

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[\s_-]/g, '')
}

const NAME_ALIASES = ['name', 'employeename', 'fullname']
const EMAIL_ALIASES = ['email', 'emailaddress', 'workemail']
const PHONE_ALIASES = ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'contactnumber']
const ADDRESS_ALIASES = ['address', 'employeeaddress', 'homeaddress', 'location', 'city']

function getFieldByAliases(row: Record<string, unknown>, aliases: string[]): string {
  const entries = Object.entries(row)
  for (const alias of aliases) {
    const entry = entries.find(([k]) => normalizeHeader(k) === alias)
    if (entry) {
      const formatted = formatCellValue(entry[1])
      if (formatted !== '—') return formatted
    }
  }
  return '—'
}

// ── Employee Contact Info Card ────────────────────────────────────────────────

function EmployeeContactInfoCard({
  snapshot,
  employeeNumber,
}: {
  snapshot: Record<string, unknown>
  employeeNumber: number
}) {
  const name = getFieldByAliases(snapshot, NAME_ALIASES)
  const email = getFieldByAliases(snapshot, EMAIL_ALIASES)
  const phone = getFieldByAliases(snapshot, PHONE_ALIASES)
  const address = getFieldByAliases(snapshot, ADDRESS_ALIASES)

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
            #{employeeNumber}
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

// ── HR Retention Action Plan Card ─────────────────────────────────────────────

interface RetentionActionItem {
  factor: string
  currentValue: string
  recommendedTarget: string
  proposedChange: string
  riskImpact: string
  isElevating: boolean
}

function buildRetentionActionPlan(
  snapshot: Record<string, unknown>,
  shapRiskFactors?: Array<{ display_name: string; feature: string; shap_value: number }>
): RetentionActionItem[] {
  const items: RetentionActionItem[] = []
  const riskFeatureNames = (shapRiskFactors || []).map(f => f.feature.toLowerCase())

  // 1. OverTime
  const ot = snapshot['OverTime'] ?? snapshot['overtime'] ?? snapshot['over_time']
  if (ot !== undefined && String(ot).toLowerCase() === 'yes') {
    items.push({
      factor: 'Overtime',
      currentValue: 'Yes (Mandatory / Frequent)',
      recommendedTarget: 'No (Standard 40h workweek)',
      proposedChange: 'Transition to standard hours or rebalance workload across team',
      riskImpact: 'High Risk Reducer (Primary Attrition Driver)',
      isElevating: true,
    })
  }

  // 2. Monthly Income
  const income = Number(snapshot['MonthlyIncome'] ?? snapshot['monthly_income'])
  if (!isNaN(income) && income > 0) {
    if (income < 3500) {
      items.push({
        factor: 'Monthly Compensation',
        currentValue: `$${income.toLocaleString()}`,
        recommendedTarget: '$4,000+ / month (Market Median)',
        proposedChange: 'Perform salary benchmark adjustment (+15% to +25%)',
        riskImpact: 'Moderate Risk Reducer (Compensation Alignment)',
        isElevating: true,
      })
    }
  }

  // 3. Job Satisfaction
  const jobSat = Number(snapshot['JobSatisfaction'] ?? snapshot['job_satisfaction'])
  if (!isNaN(jobSat) && jobSat <= 2) {
    items.push({
      factor: 'Job Satisfaction',
      currentValue: `${jobSat} / 4 (Low)`,
      recommendedTarget: '3+ / 4 (Satisfied)',
      proposedChange: 'Conduct 1-on-1 career check-in, review project assignments and autonomy',
      riskImpact: 'High Risk Reducer (Engagement & Morale)',
      isElevating: true,
    })
  }

  // 4. Work-Life Balance
  const wlb = Number(snapshot['WorkLifeBalance'] ?? snapshot['work_life_balance'])
  if (!isNaN(wlb) && wlb <= 2) {
    items.push({
      factor: 'Work-Life Balance',
      currentValue: `${wlb} / 4 (Low / Strained)`,
      recommendedTarget: '3+ / 4 (Good Balance)',
      proposedChange: 'Introduce flexible working hours or remote work options',
      riskImpact: 'High Risk Reducer (Burnout Prevention)',
      isElevating: true,
    })
  }

  // 5. Environment Satisfaction
  const envSat = Number(snapshot['EnvironmentSatisfaction'] ?? snapshot['environment_satisfaction'])
  if (!isNaN(envSat) && envSat <= 2) {
    items.push({
      factor: 'Environment Satisfaction',
      currentValue: `${envSat} / 4 (Dissatisfied)`,
      recommendedTarget: '3+ / 4 (Favorable)',
      proposedChange: 'Review workplace tooling, team dynamics, and manager feedback loop',
      riskImpact: 'Moderate Risk Reducer (Workplace Culture)',
      isElevating: true,
    })
  }

  // 6. Stock Option Level
  const stock = Number(snapshot['StockOptionLevel'] ?? snapshot['stock_option_level'])
  if (!isNaN(stock) && stock === 0) {
    items.push({
      factor: 'Equity / Stock Incentive',
      currentValue: 'Level 0 (No Options)',
      recommendedTarget: 'Level 1+ (Retention Grant)',
      proposedChange: 'Grant annual stock option / long-term incentive vesting package',
      riskImpact: 'Moderate Risk Reducer (Long-term Retention)',
      isElevating: riskFeatureNames.some(f => f.includes('stock')),
    })
  }

  // 7. Salary Hike %
  const hike = Number(snapshot['PercentSalaryHike'] ?? snapshot['percent_salary_hike'])
  if (!isNaN(hike) && hike < 14) {
    items.push({
      factor: 'Salary Hike %',
      currentValue: `${hike}% (Below Average)`,
      recommendedTarget: '15% – 18% (Target Retention Band)',
      proposedChange: 'Include in next merit cycle review for competitive increase',
      riskImpact: 'Moderate Risk Reducer',
      isElevating: false,
    })
  }

  return items
}

function HRRetentionActionPlanCard({
  snapshot,
  shapRiskFactors,
  onSimulate,
}: {
  snapshot: Record<string, unknown>
  shapRiskFactors?: Array<{ display_name: string; feature: string; shap_value: number }>
  onSimulate: () => void
}) {
  const planItems = buildRetentionActionPlan(snapshot, shapRiskFactors)

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-emerald-600" />
          <div>
            <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
              HR Retention Action Plan
            </h3>
            <p className="text-[11px] text-[#8A8A8A]">
              Actionable interventions recommended to mitigate employee attrition risk
            </p>
          </div>
        </div>

        <button
          onClick={onSimulate}
          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 hover:border-[#111111]"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Simulate in What-If</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {planItems.length === 0 ? (
        <div className="p-4 bg-[#F7F7F7] rounded-lg text-xs text-[#666666] flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>No critical retention risk elevators flagged for this employee profile.</span>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-[#F7F7F7] text-left text-[#666666]">
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Factor</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Current Value</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Recommended Target</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Proposed Action / Change</th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Risk Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {planItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-[#FAFAFA]">
                  <td className="py-3 px-3 font-semibold text-[#111111] whitespace-nowrap">
                    {item.factor}
                  </td>
                  <td className="py-3 px-3 font-mono font-medium text-[#111111]">
                    {item.currentValue}
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold text-emerald-700">
                    {item.recommendedTarget}
                  </td>
                  <td className="py-3 px-3 text-[#666666]">
                    {item.proposedChange}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      item.riskImpact.includes('High')
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {item.riskImpact}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Employee Profile Card ─────────────────────────────────────────────────────

function EmployeeProfileCard({
  result,
  searchId,
}: {
  result: EmployeeDbResult
  searchId: string
}) {
  const navigate = useNavigate()
  const { employee, latest_prediction, explanation } = result
  const snapshot = employee.feature_snapshot || {}
  const entries = Object.entries(snapshot)

  const handleSimulateInWhatIf = () => {
    navigate('/what-if', { state: { prediction: snapshot } })
  }

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

      {/* Employee Contact Information Card */}
      <EmployeeContactInfoCard snapshot={snapshot} employeeNumber={employee.employee_number} />

      {/* HR Retention Action Plan */}
      <HRRetentionActionPlanCard
        snapshot={snapshot}
        shapRiskFactors={explanation?.top_risk_factors}
        onSimulate={handleSimulateInWhatIf}
      />

      {/* Feature snapshot */}
      {entries.length > 0 && (
        <div className="card">
          <h3 className="text-xs font-bold text-[#666666] uppercase tracking-wider mb-4 border-b border-border pb-2">
            Employee Feature Snapshot
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
                  <p className="text-xs font-bold text-red-800 uppercase mb-2">Key Risk Elevators (SHAP)</p>
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
                  <p className="text-xs font-bold text-emerald-800 uppercase mb-2">Key Risk Reducers (SHAP)</p>
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
              Enter an Employee ID to retrieve their profile, contact details, and retention action plan from the selected dataset.
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

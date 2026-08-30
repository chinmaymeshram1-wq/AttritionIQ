import { useState } from 'react'
import type { CompatibilityReport } from '@/types'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  Info,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Layers,
  HelpCircle
} from 'lucide-react'
import { cn } from '@/utils/cn'

interface CompatibilityReportCardProps {
  report: CompatibilityReport
  fileName?: string
  fileSize?: number
  className?: string
}

function formatFeatureName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function CompatibilityReportCard({
  report,
  fileName,
  fileSize,
  className,
}: CompatibilityReportCardProps) {
  const [showAllResolved, setShowAllResolved] = useState(false)
  const [showUnrecognized, setShowUnrecognized] = useState(false)

  const isFull = report.status === 'FULLY_COMPATIBLE'
  const isPartial = report.status === 'PARTIALLY_COMPATIBLE'
  const isIncompat = report.status === 'INCOMPATIBLE'

  const resolvedEntries = Object.entries(report.mapped_columns || {})

  return (
    <div className={cn('bg-white border rounded-xl p-5 space-y-4 shadow-sm', className)}>
      {/* File Info & Status Badge Row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border',
              isFull && 'bg-emerald-50 text-emerald-700 border-emerald-200',
              isPartial && 'bg-amber-50 text-amber-700 border-amber-200',
              isIncompat && 'bg-red-50 text-red-700 border-red-200'
            )}
          >
            {isFull && <CheckCircle2 className="w-5 h-5" />}
            {isPartial && <AlertTriangle className="w-5 h-5" />}
            {isIncompat && <XCircle className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm text-[#111111] flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-[#666666]" />
                {fileName || 'Uploaded CSV Dataset'}
              </h3>
              {fileSize && (
                <span className="text-[11px] text-[#8A8A8A] font-mono">
                  ({formatFileSize(fileSize)})
                </span>
              )}
            </div>
            <p className="text-xs text-[#666666] mt-0.5">
              Pre-flight schema analysis against canonical 30-feature ML model definition
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <div>
          {isFull && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              FULLY COMPATIBLE
            </span>
          )}
          {isPartial && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
              <ShieldAlert className="w-3.5 h-3.5" />
              PARTIALLY COMPATIBLE
            </span>
          )}
          {isIncompat && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
              <XCircle className="w-3.5 h-3.5" />
              INCOMPATIBLE
            </span>
          )}
        </div>
      </div>

      {/* Progress & Metric Stats */}
      <div className="bg-[#F7F7F7] border border-border rounded-xl p-4 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-semibold text-[#111111] flex-wrap gap-2">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#666666]" />
            Feature Completeness: {report.features_found} of {report.features_required} Features Resolved
          </span>
          <span className="font-mono text-sm">{report.data_completeness_percentage}%</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#E5E5E5] h-2.5 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              isFull && 'bg-[#067647]',
              isPartial && 'bg-[#B54708]',
              isIncompat && 'bg-[#B42318]'
            )}
            style={{ width: `${Math.min(100, Math.max(0, report.data_completeness_percentage))}%` }}
          />
        </div>

        {/* Identifier and Stats Meta */}
        <div className="flex items-center justify-between text-[11px] text-[#666666] pt-1 flex-wrap gap-2">
          <span>
            Employee ID Column:{' '}
            <strong className="text-[#111111] font-mono">
              {report.employee_id_column ? report.employee_id_column : 'Auto-detected / Generated'}
            </strong>
          </span>
          <span>
            {report.missing_features.length > 0
              ? `${report.missing_features.length} missing feature(s)`
              : 'All 30 features matched'}
          </span>
        </div>
      </div>

      {/* TIER-SPECIFIC EXPLANATION BOXES */}

      {/* FULLY COMPATIBLE BANNER */}
      {isFull && (
        <div className="bg-emerald-50/70 border border-emerald-200 text-emerald-900 rounded-xl p-3.5 text-xs flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Full Model Compatibility Verified</p>
            <p className="text-emerald-800 leading-relaxed">
              All 30 model features were resolved with high confidence. The trained classification pipeline and SHAP attribution engine will operate at full predictive precision.
            </p>
          </div>
        </div>
      )}

      {/* PARTIALLY COMPATIBLE WARNING & IMPUTATION NOTICE */}
      {isPartial && (
        <div className="space-y-3">
          <div className="bg-amber-50/80 border border-amber-200 text-amber-950 rounded-xl p-3.5 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="font-bold text-amber-900 flex items-center gap-1.5">
                <span>ESTIMATED / Reduced Confidence Prediction Mode</span>
              </p>
              <p className="text-amber-800 leading-relaxed">
                This CSV contains <strong>{report.features_found} of {report.features_required}</strong> canonical model features. The missing attributes will be automatically populated using the training pipeline's <strong>median value (for numerical attributes)</strong> and <strong>most-frequent mode (for categorical attributes)</strong>.
              </p>
              <p className="text-amber-900 font-medium">
                Predictions and risk levels generated from this dataset will be designated as <strong>ESTIMATED</strong>.
              </p>
            </div>
          </div>

          {/* Missing Features List */}
          {report.missing_features.length > 0 && (
            <div className="border border-amber-200 bg-white rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#111111] flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-600" />
                  Missing Model Features ({report.missing_features.length}):
                </span>
                <span className="text-[11px] text-[#8A8A8A]">Will be imputed</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {report.missing_features.map((feat) => (
                  <span
                    key={feat}
                    className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-mono font-medium"
                    title={`Feature: ${feat} will be filled via SimpleImputer`}
                  >
                    {formatFeatureName(feat)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* INCOMPATIBLE ERROR & BLOCKING NOTICE */}
      {isIncompat && (
        <div className="space-y-3">
          <div className="bg-red-50/80 border border-red-200 text-red-950 rounded-xl p-3.5 text-xs flex items-start gap-2.5">
            <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="font-bold text-red-900">
                Dataset Incompatible — Prediction Blocked
              </p>
              <p className="text-red-800 leading-relaxed">
                Only <strong>{report.features_found} of {report.features_required}</strong> canonical model features could be resolved. At least <strong>16 required workplace features</strong> are necessary to perform meaningful attrition risk prediction.
              </p>
              <p className="text-red-900 font-medium">
                To prevent inaccurate or arbitrary risk scores, this dataset cannot be uploaded as a prediction-ready dataset. Please ensure your CSV includes standard HR attributes (such as Age, Department, Monthly Income, Overtime, Job Role, and Tenure).
              </p>
            </div>
          </div>

          {/* Missing Required Features */}
          {report.missing_features.length > 0 && (
            <div className="border border-red-200 bg-white rounded-xl p-3.5 space-y-2">
              <span className="font-bold text-xs text-red-900 block">
                Unresolved Model Features ({report.missing_features.length}):
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {report.missing_features.map((feat) => (
                  <span
                    key={feat}
                    className="bg-red-50 text-red-800 border border-red-200 px-2 py-0.5 rounded text-[11px] font-mono"
                  >
                    {formatFeatureName(feat)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expandable Mapped Columns Breakdown */}
      {resolvedEntries.length > 0 && (
        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowAllResolved(!showAllResolved)}
            className="text-xs text-[#666666] hover:text-[#111111] font-semibold flex items-center gap-1.5 transition-colors"
          >
            {showAllResolved ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>
              {showAllResolved ? 'Hide' : 'View'} Resolved Column Mappings ({resolvedEntries.length})
            </span>
          </button>

          {showAllResolved && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left bg-[#F7F7F7]">
                    <th className="py-2 px-3 font-semibold text-[#666666]">CSV Header</th>
                    <th className="py-2 px-3 font-semibold text-[#666666]">Canonical Model Feature</th>
                    <th className="py-2 px-3 font-semibold text-[#666666]">Match Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {resolvedEntries.map(([csvCol, canonical]) => {
                    const method = report.mapping_method?.[canonical] || 'alias'
                    return (
                      <tr key={csvCol} className="hover:bg-[#FAFAFA]">
                        <td className="py-1.5 px-3 font-mono text-[#111111]">{csvCol}</td>
                        <td className="py-1.5 px-3 font-medium text-[#111111]">
                          {formatFeatureName(canonical)}
                        </td>
                        <td className="py-1.5 px-3 text-[#666666] font-mono text-[11px]">
                          {method}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Unrecognized Columns (if any) */}
      {report.unrecognized_columns && report.unrecognized_columns.length > 0 && (
        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowUnrecognized(!showUnrecognized)}
            className="text-xs text-[#8A8A8A] hover:text-[#666666] font-medium flex items-center gap-1.5 transition-colors"
          >
            {showUnrecognized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>
              {showUnrecognized ? 'Hide' : 'View'} Ignored / Non-Model Columns ({report.unrecognized_columns.length})
            </span>
          </button>

          {showUnrecognized && (
            <div className="mt-2 p-3 bg-[#F7F7F7] rounded-lg border border-border">
              <p className="text-[11px] text-[#666666] mb-2">
                These columns are not part of the 30-feature ML model definition and are preserved for contact/audit records without influencing prediction weights:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {report.unrecognized_columns.map((col) => (
                  <span
                    key={col}
                    className="bg-white text-[#666666] border border-border px-2 py-0.5 rounded text-[11px] font-mono"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

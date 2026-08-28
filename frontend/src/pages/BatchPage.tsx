import { useState, useCallback, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { useBatchStore } from '@/store/batchStore'
import type { CompatibilityReport } from '@/types'
import LoadingSpinner from '@/components/LoadingSpinner'
import RiskBadge from '@/components/RiskBadge'
import { formatProbability } from '@/utils/formatters'
import {
  Upload, FileText, CheckCircle, Download, AlertTriangle,
  ChevronDown, ChevronUp, Info, XCircle,
} from 'lucide-react'
import DatasetSelector from '@/components/DatasetSelector'

// ── Compatibility Panel ────────────────────────────────────────────────────────

function CompatibilityPanel({
  report,
  checking,
}: {
  report: CompatibilityReport | null
  checking: boolean
}) {
  const [showMapped, setShowMapped] = useState(false)
  const [showMissing, setShowMissing] = useState(false)

  if (checking) {
    return (
      <div className="mt-4 flex items-center gap-3 text-xs text-[#666666] bg-[#F7F7F7] p-3 rounded-lg border border-border">
        <LoadingSpinner size="sm" />
        <span>Analysing CSV column compatibility…</span>
      </div>
    )
  }

  if (!report) return null

  const isGreen  = report.status === 'FULLY_COMPATIBLE'
  const isYellow = report.status === 'PARTIALLY_COMPATIBLE'
  const isRed    = report.status === 'INCOMPATIBLE'

  const statusConfig = {
    FULLY_COMPATIBLE:    { icon: '●', label: 'Fully Compatible',    border: 'border-emerald-500', bg: 'bg-emerald-50/50', text: 'text-emerald-900', badge: 'bg-emerald-100 text-emerald-800' },
    PARTIALLY_COMPATIBLE:{ icon: '●', label: 'Partially Compatible', border: 'border-amber-500',   bg: 'bg-amber-50/50',   text: 'text-amber-900',   badge: 'bg-amber-100 text-amber-800'   },
    INCOMPATIBLE:        { icon: '●', label: 'Incompatible',         border: 'border-red-500',     bg: 'bg-red-50/50',     text: 'text-red-900',     badge: 'bg-red-100 text-red-800'     },
  }[report.status]

  const mappedEntries = Object.entries(report.mapped_columns)

  return (
    <div className={`mt-4 rounded-lg border-l-4 ${statusConfig.border} ${statusConfig.bg} p-4 space-y-3 border border-border`}>
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${statusConfig.text}`}>{statusConfig.label}</h3>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusConfig.badge}`}>
              {report.features_found}/{report.features_required} features &bull; {report.data_completeness_percentage}%
            </span>
          </div>
          <p className={`text-xs mt-1 ${statusConfig.text} opacity-90`}>
            {isGreen  && 'All required model features detected. Prediction will use the full feature set.'}
            {isYellow && `${report.missing_features.length} required feature(s) missing. Predictions will use the pipeline's built-in imputation — results are ESTIMATED / REDUCED CONFIDENCE.`}
            {isRed    && `Too few usable features (${report.features_found} of minimum 16 required). Prediction cannot be generated.`}
          </p>
        </div>
      </div>

      {/* PARTIALLY_COMPATIBLE warning banner */}
      {isYellow && (
        <div className="flex items-start gap-2 bg-white border border-amber-300 rounded-lg p-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 font-medium">
            <strong>Reduced-confidence prediction mode:</strong> Missing features will be filled by the
            model pipeline's training-set median/mode imputer. These predictions are{' '}
            <strong>not</strong> fully reliable and must not be treated as accurate assessments.
            All results will be labelled <strong>ESTIMATED</strong>.
          </p>
        </div>
      )}

      {/* Missing features */}
      {report.missing_features.length > 0 && (
        <div>
          <button
            onClick={() => setShowMissing(v => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#666666] hover:text-[#111111]"
          >
            {showMissing ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Missing features ({report.missing_features.length})
          </button>
          {showMissing && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {report.missing_features.map(f => (
                <span key={f} className="text-xs bg-white border border-border text-[#666666] px-2 py-0.5 rounded font-mono">
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mapped columns */}
      {mappedEntries.length > 0 && (
        <div>
          <button
            onClick={() => setShowMapped(v => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#666666] hover:text-[#111111]"
          >
            {showMapped ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Mapped columns ({mappedEntries.length})
          </button>
          {showMapped && (
            <div className="mt-2 overflow-x-auto max-h-48 overflow-y-auto rounded-lg border border-border bg-white">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#F7F7F7] border-b border-border">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-[#666666]">Your Column</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#666666]">Mapped To</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#666666]">Method</th>
                    <th className="text-right px-3 py-2 font-semibold text-[#666666]">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {mappedEntries.map(([uploadCol, canonicalName]) => {
                    const confidence = report.mapping_confidence[canonicalName] ?? 0
                    const method = report.mapping_method[canonicalName] ?? ''
                    const conf100 = Math.round(confidence * 100)
                    const confColor = conf100 === 100 ? 'text-emerald-700' : conf100 >= 90 ? 'text-amber-700' : 'text-red-700'
                    return (
                      <tr key={uploadCol} className="hover:bg-[#F7F7F7]">
                        <td className="px-3 py-1.5 font-mono text-[#111111]">{uploadCol}</td>
                        <td className="px-3 py-1.5 font-mono text-[#111111] font-semibold">{canonicalName}</td>
                        <td className="px-3 py-1.5 text-[#666666] capitalize">{method.replace(/_/g, ' ')}</td>
                        <td className={`px-3 py-1.5 text-right font-semibold ${confColor}`}>{conf100}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Unrecognized columns */}
      {report.unrecognized_columns.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-[#666666]">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Unrecognized columns</strong> (ignored): {report.unrecognized_columns.join(', ')}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Main BatchPage ─────────────────────────────────────────────────────────────

export default function BatchPage() {
  const {
    file,
    loading,
    checking,
    compatReport,
    result,
    error,
    compatError,
    setFileAndCheck,
    runBatch,
    clearBatch,
  } = useBatchStore()

  const resultRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to batch results when available
  useEffect(() => {
    if (result) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result])

  const onDrop = useCallback(async (accepted: File[]) => {
    const dropped = accepted[0] || null
    await setFileAndCheck(dropped)
  }, [setFileAndCheck])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  })

  const handleUpload = async () => {
    await runBatch()
  }

  const handleClear = () => {
    clearBatch()
  }

  const handleDownload = () => {
    if (!result) return
    const headers = 'EmployeeNumber,AttritionProbability,RiskLevel,PredictionID,IsEstimated\n'
    const rows = result.results.map(r =>
      `${r.employee_number},${r.attrition_probability},${r.risk_level},${r.prediction_id},${r.is_estimated}`
    ).join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'batch_attrition_predictions.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const canRunPrediction = compatReport &&
    (compatReport.status === 'FULLY_COMPATIBLE' || compatReport.status === 'PARTIALLY_COMPATIBLE')
  const isEstimatedRun = compatReport?.status === 'PARTIALLY_COMPATIBLE'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">Risk / Prediction Analytics</h1>
          <p className="text-xs sm:text-sm text-[#666666] mt-1">
            Upload an HR dataset CSV file to score attrition risk across an organization or department.
          </p>
        </div>

        <DatasetSelector />
      </div>

      {/* Dropzone */}
      <div className="card">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-[#111111] bg-[#F7F7F7]' : 'border-border hover:border-border-dark hover:bg-[#F7F7F7]'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-8 h-8 text-[#8A8A8A] mx-auto mb-3" />
          {file ? (
            <div>
              <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[#111111]">
                <FileText className="w-4 h-4 text-[#111111]" />
                {file.name}
              </div>
              <p className="text-xs text-[#8A8A8A] mt-1">{(file.size / 1024).toFixed(1)} KB &bull; Drop a new file to replace</p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-[#111111]">
                {isDragActive ? 'Drop the CSV file here' : 'Drag & drop HR CSV file here, or click to browse'}
              </p>
              <p className="text-xs text-[#8A8A8A] mt-1">Supports IBM HR format and common HR column variations &bull; Max 10 MB</p>
            </div>
          )}
        </div>

        {/* Compatibility panel renders automatically after drop */}
        {compatError && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
            <XCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
            {compatError}
          </div>
        )}
        <CompatibilityPanel report={compatReport} checking={checking} />

        {/* Action buttons */}
        {file && !loading && !checking && (
          <div className="mt-4 flex gap-3 flex-wrap">
            {canRunPrediction ? (
              <button onClick={handleUpload} className="btn-primary flex items-center gap-2 text-xs">
                <CheckCircle className="w-4 h-4" />
                {isEstimatedRun ? 'Run Estimated Predictions' : 'Process Batch Predictions'}
              </button>
            ) : (
              <button
                disabled
                className="btn-primary flex items-center gap-2 opacity-40 cursor-not-allowed text-xs"
                title={compatReport?.status === 'INCOMPATIBLE' ? 'Dataset is incompatible — too few recognizable features' : 'Run a compatibility check first'}
              >
                <XCircle className="w-4 h-4" />
                Prediction Unavailable
              </button>
            )}
            <button onClick={handleClear} className="btn-ghost text-xs">Clear File</button>
          </div>
        )}

        {loading && (
          <div className="mt-4 flex items-center gap-3 text-xs text-[#666666] bg-[#F7F7F7] p-3 rounded-lg border border-border">
            <LoadingSpinner size="sm" />
            <span>
              {isEstimatedRun
                ? 'Running estimated predictions (missing features will be imputed by the model pipeline)…'
                : 'Processing batch rows through ML pipeline & SHAP explainer…'}
            </span>
          </div>
        )}
      </div>

      {/* Prediction error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div ref={resultRef} className="space-y-4 scroll-mt-6">
          {/* Estimated-mode global warning */}
          {result.results.some(r => r.is_estimated) && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-900">Results contain estimated predictions</p>
                <p className="text-xs text-amber-800 mt-0.5">
                  Some records were scored with missing input features. The model pipeline's built-in
                  imputation was used to fill gaps. These predictions are <strong>reduced-confidence
                  estimates</strong> and should not be treated as fully reliable assessments.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card text-center p-4">
              <p className="text-xs text-[#666666] font-medium">Total Rows</p>
              <p className="text-2xl font-bold mt-1 text-[#111111]">{result.total_rows}</p>
            </div>
            <div className="card text-center p-4">
              <p className="text-xs text-[#666666] font-medium">Successfully Scored</p>
              <p className="text-2xl font-bold mt-1 text-emerald-700">{result.successful}</p>
            </div>
            <div className="card text-center p-4">
              <p className="text-xs text-[#666666] font-medium">Failed / Invalid</p>
              <p className="text-2xl font-bold mt-1 text-red-700">{result.failed}</p>
            </div>
            <div className="card text-center p-4">
              <p className="text-xs text-[#666666] font-medium">Validation Issues</p>
              <p className="text-2xl font-bold mt-1 text-amber-700">{result.validation_errors.length}</p>
            </div>
          </div>

          {result.validation_errors.length > 0 && (
            <div className="card border-l-4 border-amber-500 bg-amber-50/40 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider">Batch Validation Errors</h3>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {result.validation_errors.map((err, i) => (
                  <div key={i} className="text-xs bg-white p-2.5 rounded-lg border border-amber-200">
                    <span className="font-semibold text-gray-800">Row {err.row}</span>
                    {err.employee_number && <span className="text-gray-500 font-mono"> (Emp #{err.employee_number})</span>}
                    <ul className="mt-1 ml-4 list-disc text-red-600 space-y-0.5">
                      {err.errors.map((e, j) => <li key={j}>{e}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.results.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-border flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#111111]">Scored Records ({result.successful})</h3>
                  <p className="text-xs text-[#8A8A8A]">All results persisted to database with SHAP explanations</p>
                </div>
                <button onClick={handleDownload} className="btn-secondary text-xs flex items-center gap-2 py-1.5 px-3">
                  <Download className="w-3.5 h-3.5" /> Download Predictions CSV
                </button>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#F7F7F7] border-b border-border">
                    <tr className="text-left">
                      <th className="py-2.5 px-3 font-semibold text-[#666666] uppercase">Employee #</th>
                      <th className="py-2.5 px-3 font-semibold text-[#666666] uppercase">Probability</th>
                      <th className="py-2.5 px-3 font-semibold text-[#666666] uppercase">Risk Level</th>
                      <th className="py-2.5 px-3 font-semibold text-[#666666] uppercase">Confidence</th>
                      <th className="py-2.5 px-3 font-semibold text-[#666666] uppercase">Prediction ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {result.results.map(r => (
                      <tr key={r.prediction_id} className="hover:bg-[#F7F7F7]">
                        <td className="py-2.5 px-3 font-semibold text-[#111111]">#{r.employee_number}</td>
                        <td className="py-2.5 px-3 font-mono font-medium">{formatProbability(r.attrition_probability)}</td>
                        <td className="py-2.5 px-3"><RiskBadge level={r.risk_level} size="sm" /></td>
                        <td className="py-2.5 px-3">
                          {r.is_estimated ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              <AlertTriangle className="w-3 h-3" /> ESTIMATED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              <CheckCircle className="w-3 h-3" /> FULL
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[#8A8A8A] font-mono">{r.prediction_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

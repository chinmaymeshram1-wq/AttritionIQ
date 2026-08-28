import { useState, useEffect, useRef } from 'react'
import { useDatasetStore } from '@/store/datasetStore'
import LoadingSpinner from '@/components/LoadingSpinner'
import {
  Database, Upload, Trash2, CheckCircle2, AlertTriangle,
  Clock, FileText, Plus, ShieldCheck, Layers
} from 'lucide-react'
import { cn } from '@/utils/cn'

export default function DatasetManagerPage() {
  const {
    datasets,
    activeDatasetId,
    loading,
    uploading,
    error,
    maxAllowed,
    fetchDatasets,
    setActiveDatasetId,
    uploadDataset,
    deleteDataset,
  } = useDatasetStore()

  const [customName, setCustomName] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchDatasets()
  }, [fetchDatasets])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError(null)
    try {
      await uploadDataset(file, customName || undefined)
      setCustomName('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload CSV dataset.')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteDataset(id)
      setDeleteConfirmId(null)
    } catch (err: any) {
      alert(err.message || 'Failed to delete dataset.')
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-b border-border pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight flex items-center gap-2.5">
            <Database className="w-7 h-7 text-[#111111]" />
            Dataset Manager
          </h1>
          <p className="text-xs sm:text-sm text-[#666666] mt-1">
            Manage independent CSV datasets for multi-dataset workforce risk analytics. Upload up to {maxAllowed} datasets.
          </p>
        </div>

        {/* Upload Button */}
        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            className="hidden"
            disabled={datasets.length >= maxAllowed || uploading}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={datasets.length >= maxAllowed || uploading}
            className="btn-primary py-2.5 px-4 flex items-center gap-2 shadow-sm text-xs sm:text-sm"
          >
            {uploading ? <LoadingSpinner size="sm" /> : <Upload className="w-4 h-4" />}
            <span>{uploading ? 'Processing CSV...' : 'Upload Dataset'}</span>
          </button>
        </div>
      </div>

      {/* Dataset Quota Banner */}
      <div className="bg-[#F7F7F7] border border-border rounded-xl p-4 flex items-center justify-between text-xs flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <Layers className="w-4 h-4 text-[#111111]" />
          <span className="font-semibold text-[#111111]">
            Capacity: {datasets.length} / {maxAllowed} Datasets Uploaded
          </span>
          <span className="text-[#666666]">&bull; Each dataset maintains isolated employees, predictions, and analytics.</span>
        </div>
        {datasets.length >= maxAllowed && (
          <span className="bg-amber-100 border border-amber-300 text-amber-900 font-semibold px-2.5 py-1 rounded text-[11px]">
            Maximum {maxAllowed} Datasets Limit Reached
          </span>
        )}
      </div>

      {uploadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Dataset List */}
      <div className="space-y-4">
        {loading && datasets.length === 0 ? (
          <div className="text-center py-16 bg-white border border-border rounded-xl">
            <LoadingSpinner size="md" />
            <p className="text-xs text-[#666666] mt-2">Loading datasets...</p>
          </div>
        ) : datasets.length === 0 ? (
          <div className="text-center py-16 bg-white border border-border rounded-xl p-6">
            <Database className="w-12 h-12 text-[#8A8A8A] mx-auto mb-3 opacity-40" />
            <h3 className="text-base font-bold text-[#111111]">No datasets available</h3>
            <p className="text-xs text-[#666666] mt-1 max-w-sm mx-auto">
              Upload an HR CSV dataset to begin multi-dataset workforce risk prediction and analytics.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary mt-4 py-2 px-4 text-xs inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Upload CSV Dataset</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {datasets.map((dataset) => {
              const isActive = dataset.id === activeDatasetId
              const numStr = dataset.dataset_number < 10 ? `0${dataset.dataset_number}` : `${dataset.dataset_number}`

              return (
                <div
                  key={dataset.id}
                  className={cn(
                    'bg-white border rounded-xl p-5 shadow-sm transition-all flex flex-col justify-between space-y-4 relative',
                    isActive ? 'border-[#111111] ring-1 ring-[#111111]' : 'border-border hover:border-[#111111]/40'
                  )}
                >
                  {/* Top Header Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-xl font-bold text-sm flex items-center justify-center flex-shrink-0 border',
                          isActive ? 'bg-[#111111] text-white border-[#111111]' : 'bg-[#F7F7F7] text-[#111111] border-border'
                        )}
                      >
                        {numStr}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-[#111111] line-clamp-1">
                          Dataset {numStr}
                        </h3>
                        <p className="text-xs text-[#666666] truncate max-w-[200px]">
                          {dataset.original_filename}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-1.5">
                      {dataset.status === 'READY' && (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>READY</span>
                        </span>
                      )}
                      {dataset.status === 'PROCESSING' && (
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                          <Clock className="w-3 h-3 animate-spin" />
                          <span>PROCESSING</span>
                        </span>
                      )}
                      {dataset.status === 'FAILED' && (
                        <span className="bg-red-50 text-red-700 border border-red-200 text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>FAILED</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metadata Stats */}
                  <div className="grid grid-cols-2 gap-2 bg-[#F7F7F7] rounded-lg p-3 text-xs border border-border">
                    <div>
                      <span className="text-[#8A8A8A] text-[10px] uppercase font-bold block">Employees</span>
                      <span className="font-bold text-[#111111] text-sm">{dataset.employee_count}</span>
                    </div>
                    <div>
                      <span className="text-[#8A8A8A] text-[10px] uppercase font-bold block">Uploaded</span>
                      <span className="text-[#666666] text-xs truncate block">
                        {dataset.created_at ? new Date(dataset.created_at).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Action Row */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                    {isActive ? (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Active Dataset</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => setActiveDatasetId(dataset.id)}
                        disabled={dataset.status !== 'READY'}
                        className="btn-secondary text-xs py-1 px-3 hover:border-[#111111]"
                      >
                        Set Active
                      </button>
                    )}

                    <button
                      onClick={() => setDeleteConfirmId(dataset.id)}
                      className="p-1.5 text-[#8A8A8A] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Dataset"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 border border-border shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-200 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#111111]">Delete Dataset?</h3>
                <p className="text-xs text-[#666666] mt-0.5">
                  This will permanently delete this dataset and all associated employee records, predictions, and SHAP explanations.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button onClick={() => setDeleteConfirmId(null)} className="btn-ghost text-xs py-1.5 px-3">
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="btn-primary bg-red-600 hover:bg-red-700 text-white text-xs py-1.5 px-3"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

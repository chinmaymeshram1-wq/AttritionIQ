import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDatasetStore } from '@/store/datasetStore'
import { Database, Plus, Check } from 'lucide-react'
import { cn } from '@/utils/cn'

interface DatasetSelectorProps {
  className?: string
  showManagerLink?: boolean
}

export default function DatasetSelector({ className, showManagerLink = true }: DatasetSelectorProps) {
  const navigate = useNavigate()
  const { datasets, activeDatasetId, fetchDatasets, setActiveDatasetId, loading } = useDatasetStore()

  useEffect(() => {
    fetchDatasets()
  }, [fetchDatasets])

  const readyDatasets = datasets.filter((d) => d.status === 'READY')
  const activeDataset = readyDatasets.find((d) => d.id === activeDatasetId) || readyDatasets[0]

  if (loading && datasets.length === 0) {
    return (
      <div className={cn('flex items-center gap-2 text-xs text-[#666666] bg-[#F7F7F7] border border-border rounded-lg px-3 py-1.5', className)}>
        <Database className="w-3.5 h-3.5 animate-spin" />
        <span>Loading datasets...</span>
      </div>
    )
  }

  if (readyDatasets.length === 0) {
    return (
      <div className={cn('flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-1.5', className)}>
        <Database className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="font-medium">No datasets uploaded</span>
        {showManagerLink && (
          <button
            onClick={() => navigate('/datasets')}
            className="ml-2 font-bold underline hover:text-amber-900"
          >
            Upload CSV
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-2 text-xs flex-wrap', className)}>
      <span className="font-bold uppercase tracking-wider text-[#8A8A8A] text-[10px]">Data Source:</span>
      <div className="relative flex items-center">
        <select
          value={activeDataset?.id || ''}
          onChange={(e) => setActiveDatasetId(e.target.value)}
          className="appearance-none bg-white border border-border hover:border-[#111111] rounded-lg pl-8 pr-8 py-1.5 font-semibold text-[#111111] shadow-sm cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#111111] transition-all"
        >
          {readyDatasets.map((d) => (
            <option key={d.id} value={d.id}>
              Dataset {d.dataset_number < 10 ? `0${d.dataset_number}` : d.dataset_number} — {d.name.replace(/^Dataset \d+ — /, '')} ({d.employee_count} employees)
            </option>
          ))}
        </select>
        <Database className="w-3.5 h-3.5 text-[#111111] absolute left-2.5 pointer-events-none" />
        <span className="absolute right-2.5 pointer-events-none text-[#666666] text-[10px]">▼</span>
      </div>

      {showManagerLink && (
        <button
          onClick={() => navigate('/datasets')}
          className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 hover:border-[#111111]"
          title="Manage Datasets"
        >
          <Plus className="w-3 h-3" />
          <span>Manage</span>
        </button>
      )}
    </div>
  )
}

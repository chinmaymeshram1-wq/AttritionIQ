import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/services/api'

export interface Dataset {
  id: string
  dataset_number: number
  name: string
  original_filename: string
  status: string
  employee_count: number
  organization_id?: string
  created_at?: string
  updated_at?: string
}

export interface DatasetListResponse {
  datasets: Dataset[]
  max_allowed: number
}

interface DatasetState {
  datasets: Dataset[]
  activeDatasetId: string | null
  loading: boolean
  uploading: boolean
  error: string | null
  maxAllowed: number

  fetchDatasets: () => Promise<void>
  setActiveDatasetId: (id: string | null) => void
  uploadDataset: (file: File, customName?: string) => Promise<Dataset>
  deleteDataset: (id: string) => Promise<void>
}

export const useDatasetStore = create<DatasetState>()(
  persist(
    (set, get) => ({
      datasets: [],
      activeDatasetId: null,
      loading: false,
      uploading: false,
      error: null,
      maxAllowed: 7,

      fetchDatasets: async () => {
        set({ loading: true, error: null })
        try {
          const res = await api.get<DatasetListResponse>('/datasets')
          const datasets = res.data.datasets || []
          const currentActive = get().activeDatasetId

          // Auto-select first ready dataset if activeDatasetId is not set or invalid
          let newActive = currentActive
          const readyDatasets = datasets.filter((d) => d.status === 'READY')
          if (!currentActive || !readyDatasets.some((d) => d.id === currentActive)) {
            newActive = readyDatasets.length > 0 ? readyDatasets[0].id : null
          }

          set({
            datasets,
            activeDatasetId: newActive,
            maxAllowed: res.data.max_allowed || 7,
            loading: false,
          })
        } catch (err: any) {
          const msg = err.response?.data?.detail || 'Failed to load datasets'
          set({ error: msg, loading: false })
        }
      },

      setActiveDatasetId: (id: string | null) => {
        set({ activeDatasetId: id })
      },

      uploadDataset: async (file: File, customName?: string) => {
        set({ uploading: true, error: null })
        try {
          const formData = new FormData()
          formData.append('file', file)
          if (customName) {
            formData.append('custom_name', customName)
          }

          const res = await api.post<Dataset>('/datasets/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          const newDataset = res.data

          // Fetch fresh list from server to get accurate dataset numbers and metadata
          const listRes = await api.get<DatasetListResponse>('/datasets')
          const updatedDatasets = listRes.data.datasets || [newDataset]

          set({
            datasets: updatedDatasets,
            activeDatasetId: newDataset.id,
            maxAllowed: listRes.data.max_allowed || 7,
            uploading: false,
            loading: false,
            error: null,
          })
          return newDataset
        } catch (err: any) {
          const msg = err.response?.data?.detail || 'Failed to upload dataset'
          set({ error: msg, uploading: false })
          throw new Error(msg)
        }
      },

      deleteDataset: async (id: string) => {
        set({ loading: true, error: null })
        try {
          await api.delete(`/datasets/${id}`)
          
          // Refetch fresh list directly from backend
          const listRes = await api.get<DatasetListResponse>('/datasets')
          const updatedDatasets = listRes.data.datasets || []
          const currentActive = get().activeDatasetId

          let newActive = currentActive
          if (currentActive === id) {
            const remainingReady = updatedDatasets.filter((d) => d.status === 'READY')
            newActive = remainingReady.length > 0 ? remainingReady[0].id : null
          }

          set({
            datasets: updatedDatasets,
            activeDatasetId: newActive,
            maxAllowed: listRes.data.max_allowed || 7,
            loading: false,
            error: null,
          })
        } catch (err: any) {
          const msg = err.response?.data?.detail || 'Failed to delete dataset'
          set({ error: msg, loading: false })
          throw new Error(msg)
        }
      },
    }),
    {
      name: 'attrition-active-dataset',
      partialize: (state) => ({ activeDatasetId: state.activeDatasetId }),
    }
  )
)

import { create } from 'zustand'
import { predictionService } from '@/services/predictionService'
import type { BatchPredictionResponse, CompatibilityReport } from '@/types'

interface BatchState {
  file: File | null
  loading: boolean
  checking: boolean
  compatReport: CompatibilityReport | null
  result: BatchPredictionResponse | null
  error: string
  compatError: string

  setFileAndCheck: (file: File | null) => Promise<void>
  runBatch: () => Promise<void>
  clearBatch: () => void
}

export const useBatchStore = create<BatchState>((set, get) => ({
  file: null,
  loading: false,
  checking: false,
  compatReport: null,
  result: null,
  error: '',
  compatError: '',

  setFileAndCheck: async (file: File | null) => {
    set({
      file,
      result: null,
      error: '',
      compatReport: null,
      compatError: '',
    })

    if (!file) return

    set({ checking: true })
    try {
      const report = await predictionService.checkBatchCompatibility(file)
      set({ compatReport: report, checking: false })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      set({
        compatError: msg || 'Could not analyse CSV compatibility.',
        checking: false,
      })
    }
  },

  runBatch: async () => {
    const { file, loading } = get()
    if (!file || loading) return

    set({ loading: true, error: '' })

    try {
      const res = await predictionService.predictBatch(file)
      set({
        result: res,
        compatReport: res.compatibility_report || get().compatReport,
        loading: false,
      })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      set({
        error: msg || (e instanceof Error ? e.message : 'Batch prediction failed. Please check CSV format.'),
        loading: false,
      })
    }
  },

  clearBatch: () => {
    set({
      file: null,
      loading: false,
      checking: false,
      compatReport: null,
      result: null,
      error: '',
      compatError: '',
    })
  },
}))

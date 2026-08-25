import api from './api'
import type { PredictionRequest, PredictionResponse, BatchPredictionResponse, CompatibilityReport } from '@/types'

// Batch operations (ML pipeline + SHAP per row) can take 60-120+ seconds
// for large CSVs. Use a separate per-request timeout so individual prediction
// and other calls keep the default 30 s timeout.
const BATCH_TIMEOUT_MS = 300_000  // 5 minutes

export const predictionService = {
  async predictIndividual(data: PredictionRequest): Promise<PredictionResponse> {
    const res = await api.post<PredictionResponse>('/prediction/individual', data)
    return res.data
  },
  async predictBatch(file: File): Promise<BatchPredictionResponse> {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post<BatchPredictionResponse>('/prediction/batch', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: BATCH_TIMEOUT_MS,
    })
    return res.data
  },
  async checkBatchCompatibility(file: File): Promise<CompatibilityReport> {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post<CompatibilityReport>(
      '/prediction/batch/check-compatibility',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: BATCH_TIMEOUT_MS,
      },
    )
    return res.data
  },
  async getExplanation(predictionId: string) {
    const res = await api.get(`/prediction/explanation/${predictionId}`)
    return res.data
  },
}

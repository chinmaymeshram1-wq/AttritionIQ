import api from './api'

export const analyticsService = {
  async getDashboardSummary(datasetId?: string | null) {
    const res = await api.get('/dashboard/summary', { params: { dataset_id: datasetId || undefined } })
    return res.data
  },
  async getAnalyticsOverview(datasetId?: string | null) {
    const res = await api.get('/analytics/overview', { params: { dataset_id: datasetId || undefined } })
    return res.data
  },
  async getDepartmentAnalytics(datasetId?: string | null) {
    const res = await api.get('/analytics/department', { params: { dataset_id: datasetId || undefined } })
    return res.data
  },
  async getJobRoleAnalytics(datasetId?: string | null) {
    const res = await api.get('/analytics/job-role', { params: { dataset_id: datasetId || undefined } })
    return res.data
  },
  async resetDemoData(): Promise<{ success: boolean; deleted_predictions: number }> {
    const res = await api.post('/dashboard/reset-demo-data')
    return res.data
  },
}

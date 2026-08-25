import api from './api'

export const analyticsService = {
  async getDashboardSummary() {
    const res = await api.get('/dashboard/summary')
    return res.data
  },
  async getAnalyticsOverview() {
    const res = await api.get('/analytics/overview')
    return res.data
  },
  async getDepartmentAnalytics() {
    const res = await api.get('/analytics/department')
    return res.data
  },
  async getJobRoleAnalytics() {
    const res = await api.get('/analytics/job-role')
    return res.data
  },
  async resetDemoData(): Promise<{ success: boolean; deleted_predictions: number }> {
    const res = await api.post('/dashboard/reset-demo-data')
    return res.data
  },
}


import api from './api'
import type { DatasetAnalysisResult, EmployeeSearchResult } from '@/types'

export const employeeService = {
  async getEmployee(employeeNumber: number) {
    const res = await api.get(`/employees/${employeeNumber}`)
    return res.data
  },
  async listEmployees(page = 1, pageSize = 20) {
    const res = await api.get('/employees', { params: { page, page_size: pageSize } })
    return res.data
  },

  // ── Employee Search: CSV-upload-first workflow ─────────────────────────────

  /**
   * Analyse an uploaded HR CSV file to detect the employee-ID column and
   * dataset compatibility without performing any employee search yet.
   */
  async analyzeDataset(file: File): Promise<DatasetAnalysisResult> {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post<DatasetAnalysisResult>(
      '/employees/search/analyze',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return res.data
  },

  /**
   * Search for a specific employee ID inside the uploaded CSV.
   * The CSV is sent with every request — it is NOT stored on the server.
   * Also returns any stored prediction from the application database.
   */
  async searchInDataset(file: File, employeeId: string): Promise<EmployeeSearchResult> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('employee_id', employeeId.trim())
    const res = await api.post<EmployeeSearchResult>(
      '/employees/search',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return res.data
  },
}

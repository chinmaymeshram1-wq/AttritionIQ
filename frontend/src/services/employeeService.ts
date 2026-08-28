import api from './api'
import type { EmployeeDbResult, EmployeeListItem } from '@/types'

export const employeeService = {
  /**
   * Fetch a single employee from the DB by employee_number, scoped to a dataset.
   * Returns employee profile + latest prediction + SHAP explanation.
   * READ-ONLY — never creates or modifies records.
   */
  async getEmployeeByNumber(
    employeeNumber: number | string,
    datasetId?: string | null,
  ): Promise<EmployeeDbResult> {
    const params: Record<string, string> = {}
    if (datasetId) params.dataset_id = datasetId
    const res = await api.get<EmployeeDbResult>(`/employees/${employeeNumber}`, { params })
    return res.data
  },

  /**
   * List employees for a dataset, optionally with risk data.
   * Returns paginated results.
   */
  async listEmployeesWithRisk(
    datasetId: string,
    page = 1,
    pageSize = 500,
  ): Promise<{ employees: EmployeeListItem[]; total: number; page: number }> {
    const res = await api.get('/employees', {
      params: {
        dataset_id: datasetId,
        include_risk: true,
        page,
        page_size: pageSize,
      },
    })
    return res.data
  },

  /**
   * List employees for a dataset (basic, no risk data).
   */
  async listEmployees(datasetId?: string | null, page = 1, pageSize = 20) {
    const params: Record<string, unknown> = { page, page_size: pageSize }
    if (datasetId) params.dataset_id = datasetId
    const res = await api.get('/employees', { params })
    return res.data
  },
}

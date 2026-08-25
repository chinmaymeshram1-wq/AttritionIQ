import { create } from 'zustand'
import { whatIfService } from '@/services/whatIfService'
import type { PredictionRequest, WhatIfResponse } from '@/types'

export const DEFAULT_WHATIF_PROFILE: PredictionRequest = {
  employee_number: 1001,
  age: 35,
  gender: 'Male',
  marital_status: 'Single',
  education: 3,
  education_field: 'Life Sciences',
  department: 'Research & Development',
  job_role: 'Research Scientist',
  job_level: 2,
  business_travel: 'Travel_Rarely',
  overtime: 'Yes',
  monthly_income: 4200,
  percent_salary_hike: 12,
  stock_option_level: 0,
  total_working_years: 8,
  years_at_company: 4,
  years_in_current_role: 2,
  years_since_last_promotion: 1,
  years_with_curr_manager: 2,
  num_companies_worked: 3,
  job_satisfaction: 2,
  environment_satisfaction: 2,
  relationship_satisfaction: 3,
  work_life_balance: 1,
  job_involvement: 2,
  distance_from_home: 18,
  hourly_rate: 55,
  daily_rate: 650,
  monthly_rate: 12000,
  training_times_last_year: 2,
  performance_rating: 3,
}

export const DEFAULT_WHATIF_MODIFIED: PredictionRequest = {
  ...DEFAULT_WHATIF_PROFILE,
  overtime: 'No',
  work_life_balance: 3,
  job_satisfaction: 4,
  percent_salary_hike: 18,
}

interface WhatIfState {
  original: PredictionRequest
  modified: PredictionRequest
  loading: boolean
  result: WhatIfResponse | null
  error: string

  setOriginal: (original: PredictionRequest) => void
  setModified: (modified: PredictionRequest) => void
  setForms: (original: PredictionRequest, modified: PredictionRequest) => void
  simulate: (data: { original: PredictionRequest; modified: PredictionRequest }) => Promise<void>
  reset: () => void
}

export const useWhatIfStore = create<WhatIfState>((set, get) => ({
  original: DEFAULT_WHATIF_PROFILE,
  modified: DEFAULT_WHATIF_MODIFIED,
  loading: false,
  result: null,
  error: '',

  setOriginal: (original) => set({ original }),
  setModified: (modified) => set({ modified }),
  setForms: (original, modified) => set({ original, modified }),

  simulate: async (data: { original: PredictionRequest; modified: PredictionRequest }) => {
    if (get().loading) return

    set({
      original: data.original,
      modified: data.modified,
      loading: true,
      error: '',
      result: null,
    })

    try {
      const res = await whatIfService.simulate({
        original: data.original,
        modified: data.modified,
      })
      set({ result: res, loading: false })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      set({
        error: msg || 'Simulation failed. Please check inputs.',
        loading: false,
      })
    }
  },

  reset: () =>
    set({
      original: DEFAULT_WHATIF_PROFILE,
      modified: DEFAULT_WHATIF_MODIFIED,
      loading: false,
      result: null,
      error: '',
    }),
}))

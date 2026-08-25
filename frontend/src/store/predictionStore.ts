import { create } from 'zustand'
import { predictionService } from '@/services/predictionService'
import type { PredictionRequest, PredictionResponse } from '@/types'

export const DEFAULT_PREDICTION_VALUES: PredictionRequest = {
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
  overtime: 'No',
  monthly_income: 5000,
  percent_salary_hike: 14,
  stock_option_level: 1,
  total_working_years: 10,
  years_at_company: 5,
  years_in_current_role: 3,
  years_since_last_promotion: 1,
  years_with_curr_manager: 3,
  num_companies_worked: 2,
  job_satisfaction: 3,
  environment_satisfaction: 3,
  relationship_satisfaction: 3,
  work_life_balance: 3,
  job_involvement: 3,
  distance_from_home: 10,
  hourly_rate: 65,
  daily_rate: 800,
  monthly_rate: 15000,
  training_times_last_year: 3,
  performance_rating: 3,
}

interface PredictionState {
  formData: PredictionRequest
  isSubmitting: boolean
  result: PredictionResponse | null
  error: string
  setFormData: (data: PredictionRequest) => void
  predict: (data: PredictionRequest) => Promise<void>
  clearResult: () => void
  reset: () => void
}

export const usePredictionStore = create<PredictionState>((set, get) => ({
  formData: DEFAULT_PREDICTION_VALUES,
  isSubmitting: false,
  result: null,
  error: '',

  setFormData: (formData) => set({ formData }),

  predict: async (data: PredictionRequest) => {
    // If already submitting, prevent duplicate submissions
    if (get().isSubmitting) return

    set({ formData: data, isSubmitting: true, error: '', result: null })

    try {
      const res = await predictionService.predictIndividual(data)
      set({ result: res, isSubmitting: false })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      set({
        error: msg || 'Prediction failed. Please check your inputs.',
        isSubmitting: false,
      })
    }
  },

  clearResult: () => set({ result: null, error: '' }),

  reset: () =>
    set({
      formData: DEFAULT_PREDICTION_VALUES,
      isSubmitting: false,
      result: null,
      error: '',
    }),
}))

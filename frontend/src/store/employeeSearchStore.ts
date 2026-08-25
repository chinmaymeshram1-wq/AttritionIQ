import { create } from 'zustand'
import { employeeService } from '@/services/employeeService'
import type { DatasetAnalysisResult, EmployeeSearchResult } from '@/types'

interface EmployeeSearchState {
  file: File | null
  analyzing: boolean
  analysis: DatasetAnalysisResult | null
  analyzeError: string

  query: string
  searching: boolean
  searchResult: EmployeeSearchResult | null
  searchError: string
  notFound: boolean

  uploadAndAnalyze: (file: File | null) => Promise<void>
  searchInDataset: (employeeId?: string) => Promise<void>
  setQuery: (query: string) => void
  clear: () => void
}

export const useEmployeeSearchStore = create<EmployeeSearchState>((set, get) => ({
  file: null,
  analyzing: false,
  analysis: null,
  analyzeError: '',

  query: '',
  searching: false,
  searchResult: null,
  searchError: '',
  notFound: false,

  setQuery: (query: string) =>
    set({
      query,
      searchResult: null,
      searchError: '',
      notFound: false,
    }),

  uploadAndAnalyze: async (file: File | null) => {
    set({
      file,
      analysis: null,
      analyzeError: '',
      query: '',
      searchResult: null,
      searchError: '',
      notFound: false,
    })

    if (!file) return

    set({ analyzing: true })
    try {
      const result = await employeeService.analyzeDataset(file)
      set({ analysis: result, analyzing: false })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      set({
        analyzeError: msg || 'Could not analyse the CSV file. Please check the format and try again.',
        analyzing: false,
      })
    }
  },

  searchInDataset: async (employeeId?: string) => {
    const targetQuery = (employeeId !== undefined ? employeeId : get().query).trim()
    const file = get().file

    if (!targetQuery) return

    if (!file) {
      set({ searchError: 'Please upload an employee CSV file first.' })
      return
    }

    set({
      query: targetQuery,
      searching: true,
      searchResult: null,
      searchError: '',
      notFound: false,
    })

    try {
      const result = await employeeService.searchInDataset(file, targetQuery)
      set({ searchResult: result, searching: false })
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail

      if (status === 404) {
        set({ notFound: true, searching: false })
      } else {
        set({
          searchError: msg || 'Search failed. Please try again.',
          searching: false,
        })
      }
    }
  },

  clear: () =>
    set({
      file: null,
      analyzing: false,
      analysis: null,
      analyzeError: '',
      query: '',
      searching: false,
      searchResult: null,
      searchError: '',
      notFound: false,
    }),
}))

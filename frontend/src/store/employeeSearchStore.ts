import { create } from 'zustand'
import { employeeService } from '@/services/employeeService'
import type { EmployeeDbResult } from '@/types'

interface EmployeeSearchState {
  query: string
  searching: boolean
  searchResult: EmployeeDbResult | null
  searchError: string
  notFound: boolean

  setQuery: (query: string) => void
  searchByDataset: (employeeNumber: string, datasetId: string | null) => Promise<void>
  clear: () => void
}

export const useEmployeeSearchStore = create<EmployeeSearchState>((set, get) => ({
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

  searchByDataset: async (employeeNumber: string, datasetId: string | null) => {
    const targetQuery = employeeNumber.trim()
    if (!targetQuery) return

    set({
      query: targetQuery,
      searching: true,
      searchResult: null,
      searchError: '',
      notFound: false,
    })

    try {
      const result = await employeeService.getEmployeeByNumber(targetQuery, datasetId)
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
      query: '',
      searching: false,
      searchResult: null,
      searchError: '',
      notFound: false,
    }),
}))

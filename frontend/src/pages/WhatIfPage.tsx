import { useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useWhatIfStore, DEFAULT_WHATIF_PROFILE } from '@/store/whatIfStore'
import type { PredictionRequest } from '@/types'
import LoadingSpinner from '@/components/LoadingSpinner'
import RiskBadge from '@/components/RiskBadge'
import { formatProbability } from '@/utils/formatters'
import { ArrowRight, Sliders, AlertCircle, Info } from 'lucide-react'

export default function WhatIfPage() {
  const location = useLocation()
  const predictionFromNav = location.state?.prediction as PredictionRequest | undefined

  const {
    original: storeOriginal,
    modified: storeModified,
    loading,
    result,
    error,
    simulate,
    setForms,
  } = useWhatIfStore()

  // If navigated with a new prediction profile, update the form
  useEffect(() => {
    if (predictionFromNav) {
      setForms(
        predictionFromNav,
        { ...predictionFromNav, overtime: 'No', work_life_balance: 3, job_satisfaction: 4, percent_salary_hike: 18 }
      )
    }
  }, [predictionFromNav, setForms])

  const initialOriginal = predictionFromNav || storeOriginal || DEFAULT_WHATIF_PROFILE
  const initialModified = predictionFromNav
    ? { ...predictionFromNav, overtime: 'No', work_life_balance: 3, job_satisfaction: 4, percent_salary_hike: 18 }
    : storeModified

  const resultRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to simulation outcome when available
  useEffect(() => {
    if (result) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result])

  const { register, handleSubmit } = useForm<{ original: PredictionRequest; modified: PredictionRequest }>({
    defaultValues: {
      original: initialOriginal,
      modified: initialModified,
    },
  })

  const onSubmit = async (data: { original: PredictionRequest; modified: PredictionRequest }) => {
    await simulate(data)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight flex items-center gap-2.5">
          <Sliders className="w-6 h-6 text-[#111111]" />
          What-If Attrition Risk Simulation
        </h1>
        <p className="text-xs sm:text-sm text-[#666666] mt-1">
          Adjust compensation, overtime, and satisfaction variables to simulate estimated probability delta.
        </p>
      </div>

      <div className="bg-[#F7F7F7] border border-border rounded-lg p-3.5 flex items-start gap-2.5 text-xs text-[#666666]">
        <Info className="w-4 h-4 text-[#111111] flex-shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold text-[#111111]">Model Simulation Notice:</strong> This simulation calculates the statistical response of the supervised machine learning pipeline to altered inputs. It does not predict future real-world actions with certainty.
        </div>
      </div>

      {result && (
        <div ref={resultRef} className="card border-l-4 border-[#111111] bg-white scroll-mt-6">
          <h3 className="text-xs font-bold text-[#8A8A8A] uppercase tracking-wider mb-4 border-b border-border pb-2">Simulation Outcome</h3>
          <div className="flex items-center justify-around flex-wrap gap-6 py-2">
            <div className="text-center">
              <p className="text-xs text-[#8A8A8A] font-medium mb-1">Baseline Risk</p>
              <p className="text-2xl sm:text-3xl font-black text-[#111111] tracking-tight">{formatProbability(result.original_probability)}</p>
              <div className="mt-1.5"><RiskBadge level={result.original_risk_level} size="sm" /></div>
            </div>

            <ArrowRight className="w-5 h-5 text-[#8A8A8A] hidden sm:block" />

            <div className="text-center">
              <p className="text-xs text-[#8A8A8A] font-medium mb-1">Modified Scenario Risk</p>
              <p className="text-2xl sm:text-3xl font-black text-[#111111] tracking-tight">{formatProbability(result.modified_probability)}</p>
              <div className="mt-1.5"><RiskBadge level={result.modified_risk_level} size="sm" /></div>
            </div>

            <div className="text-center bg-[#F7F7F7] px-6 py-3 rounded-lg border border-border">
              <p className="text-xs text-[#8A8A8A] font-medium mb-1">Estimated Risk Delta</p>
              <p className={`text-2xl sm:text-3xl font-black tracking-tight ${result.difference < 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {result.difference > 0 ? '+' : ''}{(result.difference * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-[#666666] mt-1 font-medium">
                {result.difference < 0 ? 'Risk reduction observed' : 'Risk increase observed'}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Baseline Scenario */}
          <div className="card">
            <div className="border-b border-border pb-3 mb-4">
              <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider">Baseline Parameters</h3>
              <p className="text-xs text-[#8A8A8A]">Current employee configuration</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label text-xs">Overtime</label>
                <select {...register('original.overtime')} className="input-field py-2 text-xs">
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div>
                <label className="label text-xs">Monthly Income ($)</label>
                <input {...register('original.monthly_income', { valueAsNumber: true })} type="number" className="input-field py-2 text-xs" />
              </div>

              <div>
                <label className="label text-xs">Percent Salary Hike (%)</label>
                <input {...register('original.percent_salary_hike', { valueAsNumber: true })} type="number" className="input-field py-2 text-xs" />
              </div>

              <div>
                <label className="label text-xs">Stock Option Level (0-3)</label>
                <select {...register('original.stock_option_level', { valueAsNumber: true })} className="input-field py-2 text-xs">
                  {[0, 1, 2, 3].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              <div>
                <label className="label text-xs">Job Satisfaction (1-4)</label>
                <select {...register('original.job_satisfaction', { valueAsNumber: true })} className="input-field py-2 text-xs">
                  {[1, 2, 3, 4].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              <div>
                <label className="label text-xs">Work-Life Balance (1-4)</label>
                <select {...register('original.work_life_balance', { valueAsNumber: true })} className="input-field py-2 text-xs">
                  {[1, 2, 3, 4].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              <div>
                <label className="label text-xs">Environment Satisfaction (1-4)</label>
                <select {...register('original.environment_satisfaction', { valueAsNumber: true })} className="input-field py-2 text-xs">
                  {[1, 2, 3, 4].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Modified Scenario */}
          <div className="card bg-[#FAFAFA]">
            <div className="border-b border-border pb-3 mb-4">
              <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider">Simulated Alterations</h3>
              <p className="text-xs text-[#666666]">Simulate workplace, compensation or engagement changes</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label text-xs">Overtime Policy</label>
                <select {...register('modified.overtime')} className="input-field py-2 text-xs">
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div>
                <label className="label text-xs">Proposed Monthly Income ($)</label>
                <input {...register('modified.monthly_income', { valueAsNumber: true })} type="number" className="input-field py-2 text-xs" />
              </div>

              <div>
                <label className="label text-xs">Proposed Salary Hike (%)</label>
                <input {...register('modified.percent_salary_hike', { valueAsNumber: true })} type="number" className="input-field py-2 text-xs" />
              </div>

              <div>
                <label className="label text-xs">Stock Option Incentive (0-3)</label>
                <select {...register('modified.stock_option_level', { valueAsNumber: true })} className="input-field py-2 text-xs">
                  {[0, 1, 2, 3].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              <div>
                <label className="label text-xs">Target Job Satisfaction (1-4)</label>
                <select {...register('modified.job_satisfaction', { valueAsNumber: true })} className="input-field py-2 text-xs">
                  {[1, 2, 3, 4].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              <div>
                <label className="label text-xs">Target Work-Life Balance (1-4)</label>
                <select {...register('modified.work_life_balance', { valueAsNumber: true })} className="input-field py-2 text-xs">
                  {[1, 2, 3, 4].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              <div>
                <label className="label text-xs">Target Environment Satisfaction (1-4)</label>
                <select {...register('modified.environment_satisfaction', { valueAsNumber: true })} className="input-field py-2 text-xs">
                  {[1, 2, 3, 4].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary px-8 py-3 flex items-center gap-2 text-sm font-semibold"
        >
          {loading ? <><LoadingSpinner size="sm" /> Calculating Simulation...</> : 'Execute What-If Simulation'}
        </button>
      </form>
    </div>
  )
}

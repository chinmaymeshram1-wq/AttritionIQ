import { useRef, useEffect } from 'react'
import { usePredictionStore } from '@/store/predictionStore'
import type { PredictionRequest } from '@/types'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import RiskBadge from '@/components/RiskBadge'
import LoadingSpinner from '@/components/LoadingSpinner'
import { formatProbability } from '@/utils/formatters'
import { Sparkles, SlidersHorizontal, AlertCircle } from 'lucide-react'

const GENDERS = ['Male', 'Female']
const MARITAL = ['Single', 'Married', 'Divorced']
const DEPARTMENTS = ['Sales', 'Research & Development', 'Human Resources']
const JOB_ROLES = [
  'Sales Executive', 'Research Scientist', 'Laboratory Technician',
  'Manufacturing Director', 'Healthcare Representative', 'Manager',
  'Sales Representative', 'Research Director', 'Human Resources'
]
const TRAVEL = ['Non-Travel', 'Travel_Rarely', 'Travel_Frequently']
const EDU_FIELDS = ['Life Sciences', 'Medical', 'Marketing', 'Technical Degree', 'Human Resources', 'Other']
const RATINGS = [1, 2, 3, 4]

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-4 border-b border-border pb-2">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  )
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

export default function PredictionPage() {
  const { formData, isSubmitting, result, error, predict } = usePredictionStore()

  const { register, handleSubmit, formState: { errors }, getValues } = useForm<PredictionRequest>({
    defaultValues: formData,
  })

  const navigate = useNavigate()
  const resultRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to prediction result when available
  useEffect(() => {
    if (result) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result])

  const onSubmit = async (data: PredictionRequest) => {
    await predict(data)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">Individual Attrition Prediction</h1>
        <p className="text-xs sm:text-sm text-[#666666] mt-1">Estimate attrition risk for an individual employee using the supervised ML pipeline.</p>
      </div>

      {/* Result Card */}
      {result && (
        <div ref={resultRef} className="card border-l-4 border-[#111111] bg-white transition-all scroll-mt-6">
          <div className="flex items-start justify-between flex-wrap gap-4 pb-4 border-b border-border">
            <div>
              <span className="text-[11px] font-semibold text-[#8A8A8A] uppercase tracking-wider">Prediction Result</span>
              <h2 className="text-lg font-bold text-[#111111] mt-0.5">Employee #{result.employee_number}</h2>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-[#111111] tracking-tight">
                  {formatProbability(result.attrition_probability)}
                </span>
                <RiskBadge level={result.risk_level} size="lg" />
              </div>
              <p className="text-xs text-[#666666] mt-1.5">Model Version: {result.model_version} &bull; Predicted at: {new Date(result.predicted_at).toLocaleTimeString()}</p>
              <p className="text-xs text-amber-700 mt-1 font-medium">Model estimation for advisory guidance. Do not use for automated personnel actions.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => navigate('/ai-assistant', { state: { prediction: result } })}
                className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#111111]" />
                Ask AI Assistant
              </button>
              <button
                onClick={() => navigate('/what-if', { state: { prediction: getValues() } })}
                className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#111111]" />
                What-If Simulation
              </button>
            </div>
          </div>

          {result.explanation && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-red-50/60 rounded-lg p-4 border border-red-200">
                <p className="text-xs font-bold text-red-800 uppercase tracking-wider mb-3">Top Risk Contributing Factors</p>
                <ul className="space-y-2">
                  {result.explanation.top_risk_factors.map((f, idx) => (
                    <li key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[#111111] font-medium">{f.display_name}</span>
                        {f.feature_value !== null && f.feature_value !== undefined && (
                          <span className="text-[11px] text-[#666666] bg-white px-1.5 py-0.5 rounded border border-red-200 font-mono">
                            {String(f.feature_value)}
                          </span>
                        )}
                      </div>
                      <span className="text-red-700 font-mono text-xs font-bold bg-white px-2 py-0.5 rounded border border-red-200">
                        +{f.shap_value.toFixed(3)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-emerald-50/60 rounded-lg p-4 border border-emerald-200">
                <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-3">Top Protective Factors</p>
                <ul className="space-y-2">
                  {result.explanation.top_protective_factors.map((f, idx) => (
                    <li key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[#111111] font-medium">{f.display_name}</span>
                        {f.feature_value !== null && f.feature_value !== undefined && (
                          <span className="text-[11px] text-[#666666] bg-white px-1.5 py-0.5 rounded border border-emerald-200 font-mono">
                            {String(f.feature_value)}
                          </span>
                        )}
                      </div>
                      <span className="text-emerald-700 font-mono text-xs font-bold bg-white px-2 py-0.5 rounded border border-emerald-200">
                        {f.shap_value.toFixed(3)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormSection title="1. Profile & Demographics">
          <Field label="Employee Number (Stored for lookup, not ML feature)" error={errors.employee_number?.message}>
            <input {...register('employee_number', { valueAsNumber: true })} type="number" className="input-field" placeholder="1001" />
          </Field>
          <Field label="Age">
            <input {...register('age', { valueAsNumber: true })} type="number" className="input-field" placeholder="35" />
          </Field>
          <Field label="Gender">
            <select {...register('gender')} className="input-field">
              {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Marital Status">
            <select {...register('marital_status')} className="input-field">
              {MARITAL.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Education Level (1: Below College, 5: Doctor)">
            <select {...register('education', { valueAsNumber: true })} className="input-field">
              {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="Education Field">
            <select {...register('education_field')} className="input-field">
              {EDU_FIELDS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </Field>
        </FormSection>

        <FormSection title="2. Position & Role">
          <Field label="Department">
            <select {...register('department')} className="input-field">
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Job Role">
            <select {...register('job_role')} className="input-field">
              {JOB_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Job Level (1-5)">
            <select {...register('job_level', { valueAsNumber: true })} className="input-field">
              {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="Business Travel">
            <select {...register('business_travel')} className="input-field">
              {TRAVEL.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Overtime">
            <select {...register('overtime')} className="input-field">
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
          </Field>
          <Field label="Distance From Home (km)">
            <input {...register('distance_from_home', { valueAsNumber: true })} type="number" className="input-field" placeholder="10" />
          </Field>
        </FormSection>

        <FormSection title="3. Compensation & Rates">
          <Field label="Monthly Income ($)">
            <input {...register('monthly_income', { valueAsNumber: true })} type="number" className="input-field" placeholder="5000" />
          </Field>
          <Field label="Percent Salary Hike (%)">
            <input {...register('percent_salary_hike', { valueAsNumber: true })} type="number" className="input-field" placeholder="15" />
          </Field>
          <Field label="Stock Option Level (0-3)">
            <select {...register('stock_option_level', { valueAsNumber: true })} className="input-field">
              {[0, 1, 2, 3].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="Hourly Rate ($)">
            <input {...register('hourly_rate', { valueAsNumber: true })} type="number" className="input-field" placeholder="65" />
          </Field>
          <Field label="Daily Rate ($)">
            <input {...register('daily_rate', { valueAsNumber: true })} type="number" className="input-field" placeholder="800" />
          </Field>
          <Field label="Monthly Rate ($)">
            <input {...register('monthly_rate', { valueAsNumber: true })} type="number" className="input-field" placeholder="15000" />
          </Field>
        </FormSection>

        <FormSection title="4. Tenure & Experience">
          <Field label="Total Working Years">
            <input {...register('total_working_years', { valueAsNumber: true })} type="number" className="input-field" placeholder="10" />
          </Field>
          <Field label="Years at Company">
            <input {...register('years_at_company', { valueAsNumber: true })} type="number" className="input-field" placeholder="5" />
          </Field>
          <Field label="Years in Current Role">
            <input {...register('years_in_current_role', { valueAsNumber: true })} type="number" className="input-field" placeholder="3" />
          </Field>
          <Field label="Years Since Last Promotion">
            <input {...register('years_since_last_promotion', { valueAsNumber: true })} type="number" className="input-field" placeholder="1" />
          </Field>
          <Field label="Years With Current Manager">
            <input {...register('years_with_curr_manager', { valueAsNumber: true })} type="number" className="input-field" placeholder="3" />
          </Field>
          <Field label="Number of Companies Worked">
            <input {...register('num_companies_worked', { valueAsNumber: true })} type="number" className="input-field" placeholder="2" />
          </Field>
          <Field label="Training Times Last Year">
            <input {...register('training_times_last_year', { valueAsNumber: true })} type="number" className="input-field" placeholder="3" />
          </Field>
        </FormSection>

        <FormSection title="5. Sentiment & Engagement">
          {[
            { field: 'job_satisfaction', label: 'Job Satisfaction (1-4)' },
            { field: 'environment_satisfaction', label: 'Environment Satisfaction (1-4)' },
            { field: 'relationship_satisfaction', label: 'Relationship Satisfaction (1-4)' },
            { field: 'work_life_balance', label: 'Work-Life Balance (1-4)' },
            { field: 'job_involvement', label: 'Job Involvement (1-4)' },
            { field: 'performance_rating', label: 'Performance Rating (1-4)' },
          ].map(({ field, label }) => (
            <Field key={field} label={label}>
              <select {...register(field as keyof PredictionRequest, { valueAsNumber: true })} className="input-field">
                {RATINGS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
          ))}
        </FormSection>

        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary px-8 py-3 flex items-center gap-2 text-sm font-semibold"
          >
            {isSubmitting ? <><LoadingSpinner size="sm" /> Estimating Risk...</> : 'Calculate Attrition Risk'}
          </button>
        </div>
      </form>
    </div>
  )
}

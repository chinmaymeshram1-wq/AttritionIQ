import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'
import type { OnboardingRequest } from '@/types'

const INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Education', 'Other']
const EMPLOYEE_RANGES = [
  { label: '1–50', value: 25 },
  { label: '51–200', value: 125 },
  { label: '201–500', value: 350 },
  { label: '501–1000', value: 750 },
  { label: '1000+', value: 1500 },
]

export default function OnboardingPage() {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<OnboardingRequest>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const onSubmit = async (data: OnboardingRequest) => {
    try {
      await authService.onboarding(data)
    } finally {
      navigate('/dashboard')
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-[#111111] mb-1">Set up your organization</h2>
      <p className="text-sm text-[#666666] mb-6">
        Tell us a bit about {user?.organization_name || 'your organization'}
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Organization Name</label>
          <input
            {...register('organization_name')}
            className="input-field"
            placeholder="Acme Corp"
            defaultValue={user?.organization_name || ''}
          />
        </div>
        <div>
          <label className="label">Industry</label>
          <select {...register('industry')} className="input-field">
            <option value="">Select industry</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Approximate Employee Count</label>
          <select {...register('employee_count_approx', { valueAsNumber: true })} className="input-field">
            <option value="">Select range</option>
            {EMPLOYEE_RANGES.map((r) => <option key={r.label} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3">
          {isSubmitting ? 'Saving...' : 'Continue to Dashboard'}
        </button>
        <button type="button" onClick={() => navigate('/dashboard')} className="btn-ghost w-full">
          Skip for now
        </button>
      </form>
    </div>
  )
}

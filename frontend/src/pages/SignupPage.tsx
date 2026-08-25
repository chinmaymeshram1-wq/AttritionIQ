import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authService } from '@/services/authService'
import { useState } from 'react'
import type { RegisterRequest } from '@/types'

const schema = z.object({
  full_name: z.string().min(2, 'Full name required'),
  email: z.string().email('Invalid email'),
  organization_name: z.string().min(2, 'Organization name required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

export default function SignupPage() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterRequest>({
    resolver: zodResolver(schema),
  })
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()
  const [error, setError] = useState('')

  const onSubmit = async (data: RegisterRequest) => {
    setError('')
    try {
      const res = await authService.register(data)
      setAuth(res.access_token, {
        id: res.user_id,
        full_name: res.full_name,
        email: res.email,
        organization_id: res.organization_id,
        organization_name: res.organization_name,
      })
      navigate('/onboarding')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Registration failed. Please try again.')
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-[#111111] mb-1">Create your account</h2>
      <p className="text-sm text-[#666666] mb-6">Start your enterprise HR analytics trial</p>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Full Name</label>
          <input {...register('full_name')} className="input-field" placeholder="Jane Smith" />
          {errors.full_name && <p className="mt-1 text-xs text-red-600">{errors.full_name.message}</p>}
        </div>
        <div>
          <label className="label">Work Email</label>
          <input {...register('email')} type="email" className="input-field" placeholder="jane@company.com" />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label">Organization</label>
          <input {...register('organization_name')} className="input-field" placeholder="Acme Corp" />
          {errors.organization_name && <p className="mt-1 text-xs text-red-600">{errors.organization_name.message}</p>}
        </div>
        <div>
          <label className="label">Password</label>
          <input {...register('password')} type="password" className="input-field" placeholder="Min 8 characters" />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>
        <div>
          <label className="label">Confirm Password</label>
          <input {...register('confirm_password')} type="password" className="input-field" placeholder="••••••••" />
          {errors.confirm_password && <p className="mt-1 text-xs text-red-600">{errors.confirm_password.message}</p>}
        </div>
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3">
          {isSubmitting ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-[#666666]">
        Already have an account?{' '}
        <Link to="/login" className="text-[#111111] font-semibold hover:underline">Sign in</Link>
      </p>
    </div>
  )
}

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authService } from '@/services/authService'
import { useState } from 'react'
import type { LoginRequest } from '@/types'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
})

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginRequest>({
    resolver: zodResolver(schema),
  })
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()
  const [error, setError] = useState('')

  const onSubmit = async (data: LoginRequest) => {
    setError('')
    try {
      const res = await authService.login(data)
      setAuth(res.access_token, {
        id: res.user_id,
        full_name: res.full_name,
        email: res.email,
        organization_id: res.organization_id,
        organization_name: res.organization_name,
      })
      navigate('/dashboard')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Login failed. Please try again.')
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-[#111111] mb-1">Welcome back</h2>
      <p className="text-sm text-[#666666] mb-6">Sign in to your account</p>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input {...register('email')} type="email" className="input-field" placeholder="you@company.com" />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label">Password</label>
          <input {...register('password')} type="password" className="input-field" placeholder="••••••••" />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>
        <div className="flex items-center justify-between">
          <Link to="/forgot-password" className="text-xs text-[#666666] hover:text-[#111111] font-medium">Forgot password?</Link>
        </div>
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3">
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-[#666666]">
        No account?{' '}
        <Link to="/signup" className="text-[#111111] font-semibold hover:underline">Sign up</Link>
      </p>
    </div>
  )
}

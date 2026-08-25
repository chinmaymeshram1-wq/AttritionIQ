import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authService } from '@/services/authService'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authService.forgotPassword(email)
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-bold text-[#111111] mb-2">Check your email</h2>
        <p className="text-sm text-[#666666]">If that email is registered, a reset link will be sent.</p>
        <Link to="/login" className="mt-6 block text-sm text-[#111111] font-semibold hover:underline">Back to login</Link>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-[#111111] mb-1">Reset password</h2>
      <p className="text-sm text-[#666666] mb-6">Enter your email to receive a reset link</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="input-field" placeholder="you@company.com" required
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
      <Link to="/login" className="mt-4 block text-center text-sm text-[#666666] hover:text-[#111111]">
        Back to login
      </Link>
    </div>
  )
}

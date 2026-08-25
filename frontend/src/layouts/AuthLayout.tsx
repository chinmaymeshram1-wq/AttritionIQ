import { Outlet } from 'react-router-dom'
import { Brain } from 'lucide-react'

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4 text-[#111111] antialiased">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-[#111111] rounded-xl mb-3 text-white">
            <Brain className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-[#111111] tracking-tight">AttritionIQ</h1>
          <p className="text-xs text-[#666666] mt-1">Enterprise HR Intelligence & Risk Platform</p>
        </div>
        <div className="bg-white rounded-card border border-border p-8 shadow-card">
          <Outlet />
        </div>
        <div className="mt-8 text-center text-xs text-[#8A8A8A]">
          <span>Protected by Enterprise IAM &bull; Secure ML Pipeline</span>
        </div>
      </div>
    </div>
  )
}

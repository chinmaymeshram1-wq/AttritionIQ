import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function BackNavigation() {
  const navigate = useNavigate()
  const location = useLocation()

  // Hide the back button on the primary dashboard root page to avoid redundant top-level clutter
  if (location.pathname === '/dashboard' || location.pathname === '/') {
    return null
  }

  const handleBack = () => {
    // If navigation history exists, go back one step; otherwise fallback to dashboard
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1)
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="mb-4">
      <button
        onClick={handleBack}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#666666] hover:text-[#111111] px-2 py-1 -ml-2 rounded-md hover:bg-[#F2F2F2] transition-colors duration-150 group"
        aria-label="Go back to previous page"
      >
        <ArrowLeft className="w-3.5 h-3.5 text-[#666666] group-hover:text-[#111111] transition-transform duration-150 group-hover:-translate-x-0.5" />
        <span>Back</span>
      </button>
    </div>
  )
}

import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, UserSearch, Upload, Users,
  BarChart3, MessageSquare, Sliders, Brain, X, Contact,
} from 'lucide-react'
import { cn } from '@/utils/cn'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/employees', icon: Users, label: 'Employee Search' },
  { to: '/prediction', icon: UserSearch, label: 'Individual Prediction' },
  { to: '/batch', icon: Upload, label: 'Batch Prediction' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/ai-assistant', icon: MessageSquare, label: 'AI Assistant' },
  { to: '/what-if', icon: Sliders, label: 'What-If Analysis' },
  { to: '/contact', icon: Contact, label: 'Contact' },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden transition-opacity duration-200"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'flex-shrink-0 flex flex-col bg-white border-r border-border transition-all duration-200 z-50',
          'fixed lg:relative h-full w-60',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#111111] rounded-lg flex items-center justify-center text-white">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-[#111111] tracking-tight block leading-none">
                AttritionIQ
              </span>
              <span className="text-[10px] uppercase font-semibold text-[#8A8A8A] tracking-wider mt-0.5 block leading-none">
                Enterprise SaaS
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#666666] hover:text-[#111111] hover:bg-[#F2F2F2] transition-colors lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
          <div className="px-2 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A8A]">
              Main Platform
            </span>
          </div>

          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => {
                if (window.innerWidth < 1024) {
                  onClose()
                }
              }}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-[#F7F7F7] text-[#111111] font-semibold border border-border'
                    : 'text-[#666666] hover:bg-[#F7F7F7] hover:text-[#111111] border border-transparent'
                )
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </div>

        {/* System Meta Footer */}
        <div className="p-3 border-t border-border bg-[#FAFAFA]">
          <div className="flex items-center justify-between px-2 py-1.5 text-[11px] text-[#666666]">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="font-medium text-[#111111]">Engine Online</span>
            </div>
            <span className="font-mono text-[#8A8A8A]">v1.0.0</span>
          </div>
        </div>
      </aside>
    </>
  )
}

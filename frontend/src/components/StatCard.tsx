import { cn } from '@/utils/cn'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  loading?: boolean
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-[#111111]',
  iconBg = 'bg-[#F7F7F7]',
  loading = false,
}: StatCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#666666]">{title}</p>
          {loading ? (
            <div className="mt-2 h-7 w-20 bg-[#F2F2F2] rounded animate-pulse" />
          ) : (
            <p className="mt-1.5 text-2xl lg:text-3xl font-bold text-[#111111] tracking-tight">{value}</p>
          )}
          {subtitle && <p className="mt-1 text-[11px] text-[#8A8A8A] font-medium">{subtitle}</p>}
        </div>
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border border-border', iconBg)}>
          <Icon className={cn('w-4 h-4', iconColor)} />
        </div>
      </div>
    </div>
  )
}

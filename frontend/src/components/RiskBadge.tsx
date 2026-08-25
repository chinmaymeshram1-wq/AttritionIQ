import { cn } from '@/utils/cn'
import { getRiskBgColor, getRiskDotColor } from '@/utils/formatters'

interface RiskBadgeProps {
  level: string
  size?: 'sm' | 'md' | 'lg'
  showDot?: boolean
}

export default function RiskBadge({ level, size = 'md', showDot = true }: RiskBadgeProps) {
  const dotColor = getRiskDotColor(level)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md font-medium border uppercase tracking-wider',
        getRiskBgColor(level),
        size === 'sm' && 'px-2 py-0.5 text-[10px]',
        size === 'md' && 'px-2.5 py-1 text-xs',
        size === 'lg' && 'px-3 py-1 text-xs font-semibold'
      )}
    >
      {showDot && (
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColor)} aria-hidden="true" />
      )}
      <span>{level}</span>
    </span>
  )
}

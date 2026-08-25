export function formatProbability(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function formatRiskLevel(level: string): string {
  return level.charAt(0) + level.slice(1).toLowerCase()
}

export function getRiskBgColor(level: string): string {
  switch (level?.toUpperCase()) {
    case 'HIGH':
      return 'bg-[#FEF2F2] text-[#B91C1C] border-[#FEE2E2]'
    case 'MEDIUM':
      return 'bg-[#FFFBEB] text-[#B45309] border-[#FEF3C7]'
    case 'LOW':
      return 'bg-[#F0FDF4] text-[#15803D] border-[#DCFCE7]'
    default:
      return 'bg-[#F7F7F7] text-[#555555] border-[#E5E5E5]'
  }
}

export function getRiskDotColor(level: string): string {
  switch (level?.toUpperCase()) {
    case 'HIGH':
      return 'bg-[#DC2626]'
    case 'MEDIUM':
      return 'bg-[#D97706]'
    case 'LOW':
      return 'bg-[#16A34A]'
    default:
      return 'bg-[#737373]'
  }
}

export function formatConversationTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) return ''
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    if (isToday) return `Today · ${timeStr}`

    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday · ${timeStr}`
    }
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${timeStr}`
  } catch {
    return ''
  }
}


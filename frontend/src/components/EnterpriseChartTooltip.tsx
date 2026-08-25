import React from 'react'

interface TooltipEntry {
  name?: string
  dataKey?: string
  value?: number | string
  color?: string
  fill?: string
  payload?: Record<string, unknown>
}

interface EnterpriseChartTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
  type?: 'donut' | 'department' | 'role' | 'default'
  totalCount?: number
}

const RISK_COLOR_MAP: Record<string, string> = {
  HIGH: '#DC2626',
  'HIGH RISK': '#DC2626',
  MEDIUM: '#D97706',
  'MEDIUM RISK': '#D97706',
  LOW: '#16A34A',
  'LOW RISK': '#16A34A',
}

export default function EnterpriseChartTooltip({
  active,
  payload,
  label,
  type = 'default',
  totalCount,
}: EnterpriseChartTooltipProps) {
  if (!active || !payload || !payload.length) {
    return null
  }

  // ── 1. Donut / Pie Slice Tooltip ───────────────────────────────────────────
  if (type === 'donut') {
    const entry = payload[0]
    const rawName = String(entry.name || entry.dataKey || 'Risk').toUpperCase()
    const numVal = Number(entry.value || 0)
    const color = entry.color || entry.fill || RISK_COLOR_MAP[rawName] || '#111111'
    const share = totalCount && totalCount > 0
      ? ((numVal / totalCount) * 100).toFixed(1) + '%'
      : null

    const title = rawName.includes('RISK') ? rawName : `${rawName} RISK`

    return (
      <div className="bg-white border border-[#E5E5E5] rounded-lg p-3 shadow-card text-xs min-w-[150px] space-y-2 z-50">
        <div className="flex items-center gap-1.5 pb-1.5 border-b border-[#E5E5E5]">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="font-bold tracking-wider text-[11px]" style={{ color }}>
            {title}
          </span>
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#666666]">Employees</span>
            <span className="font-mono font-semibold text-[#111111]">
              {numVal.toLocaleString()}
            </span>
          </div>

          {share && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-[#666666]">Share</span>
              <span className="font-mono font-semibold text-[#111111]">
                {share}
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── 2. Department & Job Role Breakdown Tooltip ──────────────────────────────
  let totalSum = 0
  let hasNumbers = false

  payload.forEach((item) => {
    if (typeof item.value === 'number') {
      totalSum += item.value
      hasNumbers = true
    }
  })

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg p-3 shadow-card text-xs min-w-[170px] space-y-2 z-50">
      {label && (
        <div className="pb-1.5 border-b border-[#E5E5E5]">
          <p className="font-semibold text-[#111111] text-xs leading-snug break-words">
            {label}
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        {payload.map((entry, index) => {
          const entryName = String(entry.name || entry.dataKey || '')
          const normKey = entryName.toUpperCase()
          const dotColor =
            entry.color || entry.fill || RISK_COLOR_MAP[normKey] || '#111111'
          const valDisplay =
            typeof entry.value === 'number'
              ? entry.value.toLocaleString()
              : entry.value ?? '0'

          return (
            <div
              key={`tooltip-item-${index}`}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: dotColor }}
                />
                <span className="text-[#666666] truncate">{entryName}</span>
              </div>
              <span className="font-mono font-semibold text-[#111111]">
                {valDisplay}
              </span>
            </div>
          )
        })}
      </div>

      {hasNumbers && payload.length > 1 && (
        <div className="pt-1.5 border-t border-[#E5E5E5] flex items-center justify-between gap-4">
          <span className="font-semibold text-[#111111]">Total</span>
          <span className="font-mono font-bold text-[#111111]">
            {totalSum.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  )
}
